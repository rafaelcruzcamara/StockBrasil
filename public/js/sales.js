import { showToast, setBtnLoading, hideLoadingScreen } from './utils.js';
import { getUserCollectionRef, getUserDocumentRef } from './auth-service.js';
import { addDoc, updateDoc, reauthenticateWithCredential, EmailAuthProvider } from './firebase-config.js';

let pagamentoSelecionado = null;

export function addToCart(productId) {
    try {
        // Busca produto (aceita ID string ou number)
        const product = window.products.find((p) => (p._id === productId) || (p.id == productId));
        
        if (!product) return alert("Erro: Produto não encontrado.");

        if (product.quantidade <= 0 && product.categoria !== "Serviços") {
            return showToast("Produto esgotado!", "error");
        }

        const cartItem = window.cart.find((item) => item.id === productId);

        if (cartItem) {
            if (cartItem.quantity < product.quantidade || product.categoria === "Serviços") {
                cartItem.quantity++;
            } else {
                return showToast(`Estoque máximo atingido (${product.quantidade})`, "warning");
            }
        } else {
            window.cart.push({
                id: productId,
                nome: product.nome,
                preco: parseFloat(product.preco),
                custo: parseFloat(product.custo),
                quantity: 1,
            });
        }

        renderCart();
    } catch (error) {
        console.error("Erro carrinho:", error);
    }
}

export function updateCartQuantity(productId, change) {
    const cartItem = window.cart.find((item) => (item.id || item._id) == productId);
    if (!cartItem) return;

    if (change > 0) {
        const product = window.products.find((p) => (p._id || p.id) == productId);
        if (product && product.categoria !== "Serviços") {
            if (cartItem.quantity >= product.quantidade) {
                return showToast("Estoque máximo atingido!", "warning");
            }
        }
        cartItem.quantity++;
    } else {
        cartItem.quantity--;
    }

    if (cartItem.quantity <= 0) {
        removeItemFromCart(productId);
    } else {
        renderCart();
    }
}

export function removeItemFromCart(productId) {
    window.cart = window.cart.filter((item) => (item.id || item._id) != productId);
    renderCart();
}

export function clearCart() {
    if (window.cart.length === 0) return showToast("O carrinho já está vazio!", "info");

    if(confirm("Limpar carrinho?")) {
        window.cart = [];
        renderCart();
    }
}

export function renderCart() {
    const list = document.getElementById("cart-items-list");
    const subtotalEl = document.getElementById("cart-subtotal");
    const totalEl = document.getElementById("cart-total");
    const checkoutBtn = document.querySelector(".finaliza-venda-btn");

    if (!list) return;

    list.innerHTML = "";

    if (window.cart.length === 0) {
        list.innerHTML = `<li class="empty-cart-message" style="text-align:center; padding:20px; color:#888;">
            <i class="fas fa-shopping-basket" style="font-size: 2rem; margin-bottom: 10px;"></i>
            <p>Seu carrinho está vazio</p>
        </li>`;
        if(checkoutBtn) {
            checkoutBtn.disabled = true;
            checkoutBtn.style.opacity = "0.5";
            checkoutBtn.style.cursor = "not-allowed";
        }
    } else {
        if(checkoutBtn) {
            checkoutBtn.disabled = false;
            checkoutBtn.style.opacity = "1";
            checkoutBtn.style.cursor = "pointer";
        }

        window.cart.forEach((item) => {
            const li = document.createElement("li");
            li.className = "cart-item";
            li.innerHTML = `
                <div class="item-info">
                    <span class="item-name">${item.nome}</span>
                    <span class="item-price">R$ ${(item.preco * item.quantity).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="item-controls">
                    <button class="qty-btn" onclick="updateCartQuantity('${item.id}', -1)"><i class="fas fa-minus"></i></button>
                    <span class="item-qty">${item.quantity}</span>
                    <button class="qty-btn" onclick="updateCartQuantity('${item.id}', 1)"><i class="fas fa-plus"></i></button>
                    <button class="remove-btn" onclick="removeItemFromCart('${item.id}')"><i class="fas fa-trash-alt"></i></button>
                </div>
            `;
            list.appendChild(li);
        });
    }

    const total = window.cart.reduce((sum, item) => sum + (item.preco * item.quantity), 0);
    if(subtotalEl) subtotalEl.textContent = total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    if(totalEl) totalEl.textContent = total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ============================================================
// CHECKOUT E PAGAMENTO
// ============================================================

export function checkout() {
    if (window.cart.length === 0) return alert("Carrinho vazio.");

    // Validação final de estoque
    const issues = [];
    window.cart.forEach((item) => {
        const product = window.products.find((p) => p.id === item.id);
        if (product && product.categoria !== "Serviços" && product.quantidade < item.quantity) {
            issues.push(`${product.nome} (Estoque: ${product.quantidade})`);
        }
    });

    if (issues.length > 0) return alert("Estoque insuficiente:\n" + issues.join("\n"));

    renderPaymentOptions();
    document.getElementById("payment-modal").style.display = "flex";
}

export function renderPaymentOptions() {
    const container = document.getElementById("payment-options-container");
    const totalDisplay = document.getElementById("payment-total-display");
    const total = window.cart.reduce((sum, item) => sum + (item.preco * item.quantity), 0);
    
    if(totalDisplay) {
        totalDisplay.textContent = total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        totalDisplay.dataset.originalTotal = total;
    }

    container.innerHTML = "";
    pagamentoSelecionado = null;

    // 1. Cliente
    let optionsClientes = '';
    if (typeof window.clientesReais !== 'undefined') {
        const listaAtivos = window.clientesReais
            .filter(c => c.statusManual !== 'Bloqueado')
            .sort((a,b) => a.nome.localeCompare(b.nome));
        listaAtivos.forEach(c => {
            optionsClientes += `<option value="${c.nome}" data-id="${c.id}">ID: ${String(c.id).slice(-4)}</option>`;
        });
    }

    container.innerHTML += `
        <div style="margin-bottom:15px;">
            <label style="display:block; font-weight:bold; margin-bottom:5px; color:#aaa;"><i class="fas fa-user"></i> Cliente</label>
            <input list="clientes-list-pdv" id="modal-client-input" placeholder="Digite o nome..." class="modern-input" autocomplete="off">
            <datalist id="clientes-list-pdv">${optionsClientes}</datalist>
        </div>
        
        <div style="display:flex; gap:10px; margin-bottom:15px; align-items:flex-end;">
            <div style="flex:1;">
                <label style="display:block; font-weight:bold; margin-bottom:5px; color:#aaa;">Desconto (R$)</label>
                <input type="number" id="modal-discount" placeholder="0,00" min="0" step="0.01" class="modern-input" oninput="aplicarDescontoVisual()">
            </div>
            <div style="flex:1;">
                <label style="display:block; font-weight:bold; margin-bottom:5px; color:#aaa;">Total Final</label>
                <input type="text" id="modal-final-total" readonly class="modern-input" style="color:var(--color-accent-green); font-weight:bold;" value="R$ ${total.toFixed(2)}">
            </div>
        </div>
        <p style="margin-bottom:10px; color:#aaa; font-weight:bold;"><i class="fas fa-wallet"></i> Pagamento</p>
    `;

    // 2. Botões de Pagamento
    const divBotoes = document.createElement("div");
    window.config.paymentTypes.forEach((type) => {
        const btn = document.createElement("button");
        btn.className = "payment-option-btn"; 
        btn.innerHTML = `<i class="fas fa-credit-card"></i> ${type}`;
        btn.onclick = () => { 
            document.querySelectorAll('.payment-option-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            pagamentoSelecionado = type;
            habilitarBotaoFinalizar();
        };
        divBotoes.appendChild(btn);
    });
    container.appendChild(divBotoes);

    // 3. Botões Finais
    const row = document.createElement("div");
    row.className = "modal-actions-row";
    row.innerHTML = `
        <button class="submit-btn delete-btn" onclick="document.getElementById('payment-modal').style.display='none'">Cancelar</button>
        <button id="btn-finalizar-venda" class="submit-btn green-btn" disabled style="opacity:0.5; cursor:not-allowed;" onclick="concluirVenda()">
            Selecione Pagamento
        </button>
    `;
    container.appendChild(row);
}

function habilitarBotaoFinalizar() {
    const btn = document.getElementById('btn-finalizar-venda');
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";
    btn.innerHTML = `<i class="fas fa-check"></i> Finalizar Venda`;
    aplicarDescontoVisual(); // Atualiza valores caso tenha desconto
}

export function aplicarDescontoVisual() {
    const totalOriginal = parseFloat(document.getElementById("payment-total-display").dataset.originalTotal);
    const descontoInput = document.getElementById("modal-discount");
    const displayFinal = document.getElementById("modal-final-total");
    
    let desconto = parseFloat(descontoInput.value);
    if(isNaN(desconto)) desconto = 0;
    if(desconto >= totalOriginal) { desconto = totalOriginal; descontoInput.value = totalOriginal.toFixed(2); }

    const final = totalOriginal - desconto;
    displayFinal.value = final.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function concluirVenda() {
    const btn = document.getElementById("btn-finalizar-venda");
    const clienteNome = document.getElementById('modal-client-input').value.trim();
    const desconto = parseFloat(document.getElementById('modal-discount').value) || 0;

    if (!pagamentoSelecionado) return showToast("Selecione a forma de pagamento.", "error");

    if (desconto > 0) {
        // Lógica de senha para desconto
        window.customPrompt("Autorização", "Desconto aplicado. Digite sua senha:", async (senha) => {
            if(!senha) return;
            try {
                const user = window.auth.currentUser;
                const credential = EmailAuthProvider.credential(user.email, senha);
                await reauthenticateWithCredential(user, credential);
                processSale(pagamentoSelecionado, clienteNome, desconto);
            } catch(e) {
                showToast("Senha incorreta.", "error");
            }
        }, "", "password");
    } else {
        processSale(pagamentoSelecionado, clienteNome, 0);
    }
}

async function processSale(paymentType, clientName, discountValue) {
    const btn = document.getElementById("btn-finalizar-venda");
    setBtnLoading(btn, true);

    try {
        const totalOriginal = window.cart.reduce((acc, i) => acc + (i.preco * i.quantity), 0);
        const finalTotal = totalOriginal - discountValue;

        // 1. Atualiza Estoque
        const updates = [];
        for (const item of window.cart) {
            const prod = window.products.find(p => (p._id || p.id) == item.id);
            if (prod && prod.categoria !== "Serviços") {
                updates.push({ id: prod.id, novaQtd: prod.quantidade - item.quantity });
            }
        }
        for (const up of updates) {
            await updateDoc(getUserDocumentRef("products", up.id), { quantidade: up.novaQtd });
        }

        // 2. Busca ID do Cliente se existir
        let finalClientId = null;
        if (typeof window.clientesReais !== 'undefined') {
            const clienteEncontrado = window.clientesReais.find(c => c.nome.toLowerCase() === (clientName||"").toLowerCase());
            if (clienteEncontrado) finalClientId = clienteEncontrado.id;
        }

        // 3. Salva Venda
        const sale = {
            timestamp: new Date().toISOString(),
            items: JSON.parse(JSON.stringify(window.cart)),
            subtotal: totalOriginal,
            discount: discountValue,
            total: finalTotal, 
            payment: paymentType,
            client: clientName || "Consumidor Final",
            clientId: finalClientId
        };
        
        await addDoc(getUserCollectionRef("sales"), sale);

        // 4. Limpeza
        window.cart = [];
        renderCart();
        document.getElementById("payment-modal").style.display = "none";
        showToast("Venda realizada com sucesso!", "success");
        
        // Recarrega dados (Importante para atualizar estoque na tela)
        if(typeof window.loadAllData === 'function') await window.loadAllData();

    } catch (error) {
        console.error(error);
        showToast("Erro na venda: " + error.message, "error");
    } finally {
        setBtnLoading(btn, false);
    }
}

// CARRINHOS SALVOS
export function saveCurrentCart() {
    if (window.cart.length === 0) return showToast("Carrinho vazio.", "info");
    document.getElementById('save-cart-client-name').value = "";
    document.getElementById('save-cart-modal').style.display = 'flex';
}

export function confirmSaveCart() {
    const name = document.getElementById('save-cart-client-name').value.trim() || "Sem Nome";
    const total = window.cart.reduce((sum, item) => sum + (item.preco * item.quantity), 0);

    const newSaved = {
        id: Date.now(),
        timestamp: new Date().toLocaleString("pt-BR"),
        items: JSON.parse(JSON.stringify(window.cart)),
        total: total,
        client: name
    };

    window.savedCarts.unshift(newSaved);
    // Salva no localStorage via persistData (precisamos expor ou fazer manual aqui)
    localStorage.setItem("savedCarts", JSON.stringify(window.savedCarts));
    
    // Renderiza se a função estiver disponível
    if(typeof window.renderSavedCarts === 'function') window.renderSavedCarts();

    window.cart = [];
    renderCart();
    document.getElementById('save-cart-modal').style.display = 'none';
    showToast("Carrinho salvo para depois!", "success");
}

export function loadSavedCart(cartId) {
    const index = window.savedCarts.findIndex(c => c.id == cartId);
    if(index === -1) return;

    window.cart = window.savedCarts[index].items;
    window.savedCarts.splice(index, 1);
    
    localStorage.setItem("savedCarts", JSON.stringify(window.savedCarts));
    if(typeof window.renderSavedCarts === 'function') window.renderSavedCarts();
    
    renderCart();
    document.querySelector('a[href="#vendas"]').click(); // Vai pra aba de vendas
    showToast("Carrinho recuperado.", "success");
}

export function deleteSavedCart(cartId) {
    if(!confirm("Excluir?")) return;
    window.savedCarts = window.savedCarts.filter(c => c.id != cartId);
    localStorage.setItem("savedCarts", JSON.stringify(window.savedCarts));
    if(typeof window.renderSavedCarts === 'function') window.renderSavedCarts();
}

export function renderSavedCarts() {
    const container = document.getElementById("saved-carts-list");
    if (!container) return;
    container.innerHTML = "";

    if (window.savedCarts.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:30px; color:#888;">Nenhum carrinho salvo.</div>`;
        return;
    }

    window.savedCarts.forEach(c => {
        const div = document.createElement("div");
        div.className = "saved-cart-card";
        div.innerHTML = `
            <div class="cart-info">
                <span class="cart-title">#${String(c.id).slice(-4)} - ${c.client}</span>
                <p class="cart-meta">${c.timestamp}</p>
                <p class="cart-summary">R$ ${c.total.toFixed(2)}</p>
            </div>
            <div class="cart-actions">
                <button class="submit-btn blue-btn" onclick="loadSavedCart(${c.id})">Abrir</button>
                <button class="submit-btn delete-btn" onclick="deleteSavedCart(${c.id})"><i class="fas fa-trash"></i></button>
            </div>
        `;
        container.appendChild(div);
    });
}