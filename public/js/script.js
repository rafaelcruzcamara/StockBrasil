//imports

import { 
    db, auth, 
    signInWithEmailAndPassword, signOut, onAuthStateChanged, reauthenticateWithCredential, EmailAuthProvider,
    collection, addDoc, getDocs, doc, updateDoc, deleteDoc, setDoc, getDoc,
    query, orderBy, limit, where
} from './firebase-config.js';

import { 
    setBtnLoading, showLoadingScreen, hideLoadingScreen, updateLoadingMessage, showToast,
    mascaraCpfCnpj, mascaraCnpj, mascaraTelefone, mascaraData, fmtMoeda,
    parseDataSegura, converterDataNaMarra
} from './utils.js';

import { DEFAULT_CATEGORIES, DEFAULT_PAYMENT_TYPES, DEFAULT_SYSTEM_CONFIG } from './config.js';

import { getUserCollectionRef, getUserDocumentRef, logoutSystem } from './auth-service.js';

import { 
    converterImagemParaBase64, limparImagemForm, calcularPrecificacao,
    updateCategorySelect, updateEstablishmentSelect, updateProductSupplierDropdown,
    resetProductForm
} from './product-ui.js';

import { 
    generatePDF, imprimirRelatorioVendas, imprimirRelatorioEstoque, 
    imprimirRelatorioLucro, imprimirNotaPDF, generateProfessionalPDF,
    imprimirTabelaDespesas 
} from './reports.js';

import { 
    addToCart, updateCartQuantity, removeItemFromCart, clearCart, renderCart,
    checkout, saveCurrentCart, confirmSaveCart, loadSavedCart, deleteSavedCart,
    renderPaymentOptions, renderSavedCarts, aplicarDescontoVisual, concluirVenda
} from './sales.js';

import { 
    handleClientForm, handleSupplierForm, editClient, editSupplier, deletePartner,
    renderClientsTable, renderSuppliersTable, clearClientForm, clearSupplierForm,
    abrirModalCliente, fecharModalCliente, abrirModalFornecedor, fecharModalFornecedor 
} from './partners.js';




onAuthStateChanged(auth, async (user) => {
    const nomeEl = document.getElementById("sidebar-user-name");
    
    // 1. Inicia o progresso visual (Assume 10% para o processo de autenticação)
    // Isso usa a função auxiliar que criamos dentro do loadAllData
    if (typeof updateLoader === 'function') {
        updateLoader(10, "Verificando sessão do usuário...");
    }
    
    if (user) {
        // --- LÓGICA DO USUÁRIO LOGADO ---
        
        let nomeFinal = user.email.split('@')[0];

        try {
            // Busca o nome da empresa ou nome completo (Consome a fatia inicial do loader)
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const dados = docSnap.data();
                if (dados.businessName) {
                    nomeFinal = dados.businessName;
                } else if (dados.nome) {
                    nomeFinal = dados.nome;
                }
            }
        } catch (error) {
            console.error("Erro ao buscar nome do usuário:", error);
        }
        
        // 2. Atualiza a interface
        if(nomeEl) {
            nomeEl.textContent = nomeFinal;
            nomeEl.style.color = "var(--color-text-primary)";
            nomeEl.style.opacity = "1";
        }
        
        // 3. Dispara o carregamento de dados (onde o loader vai de 10% a 100%)
        loadAllData();

    } else {
        // --- SE O USUÁRIO NÃO ESTÁ LOGADO ---
        console.log("Nenhum usuário logado.");
        if(nomeEl) nomeEl.textContent = "Visitante";
        
        // 4. Oculta a tela de carregamento para mostrar a tela de login
        const loader = document.getElementById('initial-loader');
        if(loader) {
            loader.style.opacity = '0'; // Fade out
            setTimeout(() => loader.remove(), 500); // Remove após a transição
        }
    }
});

window.products = [];
window.cart = [];
window.salesHistory = [];
window.savedCarts = [];
window.inputHistory = [];
window.clientesReais = [];
window.fornecedoresReais = [];
window.expensesData = [];

window.config = {
    categories: DEFAULT_CATEGORIES,
    paymentTypes: DEFAULT_PAYMENT_TYPES,
    productGroups: [],
    establishments: ["Matriz"],
    folders: []
};
window.systemConfig = DEFAULT_SYSTEM_CONFIG;



async function saveConfigToFirebase() {
    try {
        const user = auth.currentUser;
        if (!user) return; 

        const limpar = (arr) => [...new Set(arr.filter(item => item && String(item).trim() !== ""))];

        config.categories = limpar(config.categories);
        config.paymentTypes = limpar(config.paymentTypes);
        config.establishments = limpar(config.establishments); // Salva nova lista

        const docRef = doc(db, "users", user.uid, "settings", "general");
        
        await setDoc(docRef, { 
            categories: config.categories, 
            paymentTypes: config.paymentTypes,
            productGroups: config.productGroups || [],
            establishments: config.establishments,
            folders: config.folders || []
        }, { merge: true });

        console.log("✅ Configurações salvas.");
        return true;
    } catch (error) {
        console.error("❌ Erro ao salvar:", error);
        return false;
    }
}

function renderEstablishmentsManager() {
  const container = document.getElementById("establishments-container");
  if (!container) return;

  container.innerHTML = "";
  if (!Array.isArray(config.establishments)) config.establishments = ["Matriz"];

  config.establishments.forEach((est, index) => {
    if (!est || est.trim() === "") return;

    const div = document.createElement("div");
    div.className = "category-item"; // Reusa estilo CSS
    div.innerHTML = `
            <span class="category-name"><i class="fas fa-store-alt" style="color:#FF9F0A; margin-right:8px;"></i> ${est}</span>
            <div class="category-actions">
                <button class="delete-category-btn" onclick="deleteEstablishment(${index})" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    container.appendChild(div);
  });
}

window.addNewEstablishment = async function() {
  const input = document.getElementById("new-establishment-name");
  const name = input.value.trim();

  if (!name) return showToast("Digite um nome!", "error");
  if (config.establishments.includes(name)) return showToast("Já existe!", "info");

  config.establishments.push(name);
  persistData();
  
  const btn = document.getElementById('btn-add-est');
  if(btn) setBtnLoading(btn, true);
  
  await saveConfigToFirebase();
  
  if(btn) setBtnLoading(btn, false);
  
  renderEstablishmentsManager();
  updateEstablishmentSelect(); 
  input.value = "";
  showToast("Local criado!", "success");
}

window.deleteEstablishment = async function(index) {
    const nome = config.establishments[index];
    customConfirm(`Excluir o local "${nome}"?`, async () => {
        config.establishments.splice(index, 1);
        persistData();
        await saveConfigToFirebase();
        renderEstablishmentsManager();
        updateEstablishmentSelect();
        showToast("Removido!", "success");
    });
}

// =================================================================
// SISTEMA DE MODAIS (COM MÁSCARA DE DATA AUTOMÁTICA)
// =================================================================

var _safeConfirmCallback = null;
var _safePromptCallback = null;

// 1. Alert e 2. Confirm (Mantidos iguais, mas incluídos para garantir que não quebre nada)
window.customAlert = function(message, type = 'info') {
    const modal = document.getElementById('custom-alert');
    if(!modal) return alert(message); 
    const title = document.getElementById('alert-title');
    const msg = document.getElementById('alert-message');
    const icon = document.getElementById('alert-icon');
    msg.textContent = message;
    modal.style.display = 'flex';
    if (type === 'success') {
        icon.innerHTML = '<i class="fas fa-check-circle" style="color: var(--color-accent-green);"></i>';
        if(title) title.textContent = "Sucesso!";
    } else if (type === 'error') {
        icon.innerHTML = '<i class="fas fa-times-circle" style="color: var(--color-accent-red);"></i>';
        if(title) title.textContent = "Erro";
    } else {
        icon.innerHTML = '<i class="fas fa-info-circle" style="color: var(--color-accent-blue);"></i>';
        if(title) title.textContent = "Informação";
    }
}
window.closeCustomAlert = () => { document.getElementById('custom-alert').style.display = 'none'; }

window.customConfirm = function(message, callback) {
    const modal = document.getElementById('custom-confirm');
    if(!modal) return callback(); 
    document.getElementById('confirm-message').textContent = message;
    modal.style.display = 'flex';
    _safeConfirmCallback = callback;
    document.getElementById('btn-confirm-yes').onclick = function() {
        if (_safeConfirmCallback) _safeConfirmCallback();
        window.closeCustomConfirm();
    };
}
window.closeCustomConfirm = () => {
    document.getElementById('custom-confirm').style.display = 'none';
    _safeConfirmCallback = null;
}

window.customPrompt = function(title, message, callback, defaultValue = "", inputType = "text") {
    const modal = document.getElementById('custom-prompt');
    
    // Fallback se não tiver HTML
    if(!modal) {
        const result = prompt(message, defaultValue);
        if(result) callback(result);
        return;
    }

    const t = document.getElementById('prompt-title');
    const m = document.getElementById('prompt-message');
    const inp = document.getElementById('prompt-input');
    const btn = document.getElementById('btn-prompt-confirm');
    
    // --- LIMPEZA DE SEGURANÇA ---
    inp.value = ""; // Limpa qualquer resíduo anterior
    
    // Truques para impedir o navegador de preencher senha salva
    inp.setAttribute('autocomplete', 'new-password'); 
    inp.setAttribute('data-lpignore', 'true'); // Ignora LastPass
    
    // Configura o tipo
    inp.type = inputType;
    t.textContent = title;
    m.textContent = message;
    
    // Só define valor padrão se NÃO for senha
    if (inputType !== 'password') {
        inp.value = defaultValue; 
    }

    modal.style.display = 'flex';
    
    // Mantém readonly por um instante para evitar flash de preenchimento
    inp.setAttribute('readonly', 'readonly');

    _safePromptCallback = callback;
    
    // Lógica da Máscara de Data (Barras automáticas)
    inp.oninput = function() {
        if (title.toLowerCase().includes("data")) {
            let v = this.value.replace(/\D/g, ""); 
            if (v.length > 2) v = v.replace(/^(\d{2})(\d)/, "$1/$2"); 
            if (v.length > 5) v = v.replace(/^(\d{2})\/(\d{2})(\d)/, "$1/$2/$3"); 
            if (v.length > 10) v = v.substr(0, 10); 
            this.value = v;
        }
    };

    // Remove o bloqueio e foca após o modal abrir
    setTimeout(() => {
        inp.removeAttribute('readonly');
        inp.focus();
        if(defaultValue && inputType !== 'password') inp.select(); 
    }, 150);

    // Ação do Botão
    btn.onclick = function() {
        const valorDigitado = inp.value; 
        const acaoSalva = _safePromptCallback; 
        
        window.closeCustomPrompt(); // Fecha primeiro
        
        if (acaoSalva) acaoSalva(valorDigitado); // Executa depois
    };
}


window.closeCustomPrompt = () => {
    const m = document.getElementById('custom-prompt');
    const inp = document.getElementById('prompt-input');
    
    if (inp) {
        inp.value = ""; // LIMPA O CAMPO VISUALMENTE
        inp.type = 'text'; // Reseta para texto (engana o navegador para não salvar senha)
        inp.setAttribute('readonly', 'readonly'); // Trava de novo
    }
    
    if(m) m.style.display = 'none';
    _safePromptCallback = null;
}

function safeLocalStorageParse(key, defaultValue) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Erro ao carregar ${key}:`, error);
    return defaultValue;
  }
}

function persistData() {
    try {
        localStorage.setItem("salesHistory", JSON.stringify(salesHistory));
        localStorage.setItem("savedCarts", JSON.stringify(savedCarts));
        
        // 🛑 ESSENCIAL: Persistir o objeto config que contém as categorias
        localStorage.setItem("config", JSON.stringify(config)); 
        
        localStorage.setItem("systemConfig", JSON.stringify(systemConfig));
        localStorage.setItem("clients", JSON.stringify(clients));
    } catch (error) {
        console.error("Erro ao persistir dados:", error);
    }
}






// =================================================================
// CARREGAMENTO DE DADOS (COM SKELETONS E ANIMAÇÕES)
// =================================================================

// 1. Função auxiliar para desenhar os "esqueletos" de carregamento
// =================================================================
// FUNÇÃO DE SKELETON (Visual de Carregamento) - ATUALIZADA
// =================================================================
function showLoadingState() {
    console.log("⏳ Ativando modo Skeleton...");

    // 1. MÉTRICAS (Cards do topo)
    document.querySelectorAll('.card-value').forEach(el => {
        el.classList.add('skeleton');
        el.style.color = 'transparent'; 
    });

    // 2. GRÁFICOS
    document.querySelectorAll('.chart-container').forEach(el => {
        el.classList.add('skeleton');
        const canvas = el.querySelector('canvas');
        if (canvas) canvas.style.opacity = '0';
    });

    // 3. GRADE DO PDV (Ponto de Venda)
    const pdvGrid = document.getElementById('products-grid');
    if (pdvGrid) {
        pdvGrid.innerHTML = ''; 
        for (let i = 0; i < 8; i++) {
            const div = document.createElement('div');
            div.className = 'product-card'; 
            // Inline style para garantir visibilidade mesmo sem CSS externo
            div.innerHTML = `
                <div class="skeleton" style="height: 15px; width: 40px; margin: 0 auto 10px auto; border-radius: 4px; background: #222;"></div>
                <div class="skeleton" style="height: 20px; width: 80%; margin: 0 auto 10px auto; border-radius: 4px; background: #222;"></div>
                <div class="skeleton" style="height: 15px; width: 50%; margin: 0 auto 15px auto; border-radius: 4px; background: #222;"></div>
                <div class="skeleton" style="height: 40px; width: 100%; border-radius: 6px; margin-top: 10px; background: #222;"></div>
            `;
            pdvGrid.appendChild(div);
        }
    }

    // 4. TABELA DE PRODUTOS (AQUI ESTÁ A CORREÇÃO)
    const table = document.getElementById('product-table');
    if (table) {
        // Tenta pegar o tbody, se não existir, cria um
        let tbody = table.querySelector('tbody');
        if (!tbody) {
            tbody = document.createElement('tbody');
            table.appendChild(tbody);
        }
        
        tbody.innerHTML = ''; // Limpa tabela
        
        // Cria 5 linhas de carregamento
        for (let i = 0; i < 5; i++) {
            const tr = document.createElement('tr');
            tr.className = 'skeleton-row';
            
            // Usamos style inline backgroundColor para garantir que apareça mesmo se o CSS falhar
            const skeletonStyle = "height: 20px; width: 100%; background: #1E2329; display: block; border-radius: 4px; opacity: 0.5;";
            
            tr.innerHTML = `
                <td><div class="skeleton" style="${skeletonStyle} width: 40px;"></div></td>
                <td><div class="skeleton" style="${skeletonStyle} width: 150px;"></div></td>
                <td><div class="skeleton" style="${skeletonStyle} width: 80px;"></div></td>
                <td><div class="skeleton" style="${skeletonStyle} width: 60px;"></div></td>
                <td><div class="skeleton" style="${skeletonStyle} width: 40px;"></div></td>
                <td><div class="skeleton" style="${skeletonStyle} width: 40px;"></div></td>
                <td><div class="skeleton" style="${skeletonStyle} width: 70px;"></div></td>
            `;
            tbody.appendChild(tr);
        }
    }
}

// --- AUXILIARES VISUAIS (BADGES) ---

function getEstoqueBadge(qtd, minimo, categoria) {
    if (categoria === "Serviços") {
        return `<span class="badge badge-info"><i class="fas fa-tools"></i> Serviço</span>`;
    }
    
    const quantidade = parseInt(qtd);
    const min = parseInt(minimo);

    if (quantidade <= 0) {
        return `<span class="badge badge-danger"><i class="fas fa-times-circle"></i> Esgotado</span>`;
    } else if (quantidade <= min) {
        return `<span class="badge badge-warning"><i class="fas fa-exclamation-triangle"></i> Baixo (${quantidade})</span>`;
    } else {
        return `<span class="badge badge-success"><i class="fas fa-check-circle"></i> Normal (${quantidade})</span>`;
    }
}

function getPagamentoBadge(metodo) {
    const m = metodo.toLowerCase();
    if (m.includes('pix')) return `<span class="badge badge-success"><i class="fa-brands fa-pix"></i> Pix</span>`;
    if (m.includes('crédito') || m.includes('credito')) return `<span class="badge badge-info"><i class="fas fa-credit-card"></i> Crédito</span>`;
    if (m.includes('débito') || m.includes('debito')) return `<span class="badge badge-info"><i class="fas fa-credit-card"></i> Débito</span>`;
    if (m.includes('dinheiro')) return `<span class="badge badge-success"><i class="fas fa-money-bill-wave"></i> Dinheiro</span>`;
    return `<span class="badge badge-gray">${metodo}</span>`;
}


// ============================================================
// CARREGAMENTO REAL COM BARRA DE PROGRESSO
// ============================================================

// Função auxiliar para atualizar a tela de loading
// ============================================================
// CARREGAMENTO REAL COM BARRA DE PROGRESSO (CORRIGIDO)
// ============================================================

// 1. Função Auxiliar que faltava
function updateLoader(percent, message) {
    const bar = document.getElementById('loader-bar');
    const text = document.getElementById('loader-text');
    const status = document.getElementById('loader-status');
    const loader = document.getElementById('initial-loader');
    
    // Se o loader não existir no HTML, tenta remover esqueletos antigos
    if (!loader) {
        if(percent >= 100) hideLoadingScreen();
        return;
    }

    if (bar) bar.style.width = percent + '%';
    if (text) text.innerText = percent + '%';
    if (status) status.innerText = message;

    // Se chegar a 100%, some
    if (percent >= 100) {
        setTimeout(() => {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 500);
        }, 500);
    }
}

if (!config.establishments) config.establishments = ["Matriz"]; 

// 2. CORREÇÃO DA FUNÇÃO loadAllData (Havia um erro de digitação 'onfig')
async function loadAllData() {
    try {
        const user = auth.currentUser;
        if (!user) return;

        updateLoader(10, "Conectando ao banco de dados...");

        const pProdutos = getDocs(getUserCollectionRef("products"));
        const pVendas = getDocs(getUserCollectionRef("sales"));
        const pClientes = getDocs(getUserCollectionRef("clients"));
        const pFornecedores = getDocs(getUserCollectionRef("suppliers"));
        const pConfig = getDoc(doc(db, "users", user.uid, "settings", "general"));
        const pDespesas = getDocs(query(getUserCollectionRef("expenses"), orderBy("data", "desc")));
        const pNotasEntrada = getDocs(query(getUserCollectionRef("input_invoices"), orderBy("dataEmissao", "desc")));

        const produtosSnap = await pProdutos;
        products = [];
        produtosSnap.forEach((doc) => products.push({ id: doc.id, ...doc.data() }));
        updateLoader(40, `Carregados ${products.length} produtos...`);

        const vendasSnap = await pVendas;
        salesHistory = [];
        vendasSnap.forEach((doc) => salesHistory.push({ id: doc.id, ...doc.data() }));
        salesHistory.sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date));
        
        const notasSnap = await pNotasEntrada;
        inputHistory = [];
        notasSnap.forEach((doc) => inputHistory.push({ id: doc.id, ...doc.data() }));

        const [clientsSnap, suppSnap] = await Promise.all([pClientes, pFornecedores]);
        clientesReais = [];
        clientsSnap.forEach(doc => clientesReais.push({id: doc.id, ...doc.data()}));
        fornecedoresReais = [];
        suppSnap.forEach(doc => fornecedoresReais.push({id: doc.id, ...doc.data()}));

        // --- CARREGAMENTO DE CONFIGURAÇÕES ---
        const [settingsSnap, despesasSnap] = await Promise.all([pConfig, pDespesas]);
        
        const faxina = (arr) => {
            if (!Array.isArray(arr)) return [];
            return [...new Set(arr.filter(item => item && String(item).trim() !== ""))];
        };

        if (settingsSnap.exists()) {
            const d = settingsSnap.data();
            config.categories = faxina(d.categories);
            config.paymentTypes = faxina(d.paymentTypes);
            config.productGroups = faxina(d.productGroups); // Mantemos por compatibilidade, mas não usaremos na tela
            config.folders = faxina(d.folders);
            // CARREGA ESTABELECIMENTOS
            config.establishments = faxina(d.establishments); 
            if(config.establishments.length === 0) config.establishments = ["Matriz"];
        } else {
            config.categories = ["Geral"];
            config.paymentTypes = ["Dinheiro", "Pix"];
            config.productGroups = [];
            config.establishments = ["Matriz"];
        }

        expensesData = [];
        despesasSnap.forEach(d => expensesData.push({id: d.id, ...d.data()}));
        
        // Renderização
        savedCarts = safeLocalStorageParse("savedCarts", []);
        systemConfig = safeLocalStorageParse("systemConfig", systemConfig);
        if (document.body) document.body.setAttribute('data-theme', systemConfig.theme || 'dark');

        const renderFunctions = [
            renderProductTable,
            updateDashboardMetrics,
            updateCategorySelect,
            updateProductSupplierDropdown, // <--- ADICIONE ESTA LINHA AQUI!
            renderClientsTable,
            renderSuppliersTable,
            renderExpensesTable,
            renderCategoriesManager, 
            renderPaymentsManager,
            renderEstablishmentsManager,
            updateEstablishmentSelect,
            initializeDashboardCharts,
            atualizarDashboardExecutivo,
            renderProductFolders,
            renderFolderTree,
        ];

        renderFunctions.forEach(fn => { if (typeof fn === 'function') fn(); });

        updateLoader(100, "Bem-vindo!");
        if(typeof renderInvoicesTable === 'function') renderInvoicesTable();

    } catch (error) {
        console.error("❌ ERRO NO LOAD:", error);
        updateLoader(100, "Erro ao carregar.");
    }
}
/**
 * Envia uma coleção de itens (com IDs originais) para o Firebase.
 * @param {string} collectionName - Nome da coleção ('products' ou 'sales').
 * @param {Array<Object>} items - Array de itens do arquivo de backup.
 */
async function importCollection(collectionName, items) {
    console.log(`📥 Iniciando lote: ${collectionName} (${items.length} itens)`);
    
    // Processa em lotes de 50 para não travar o navegador
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const chunk = items.slice(i, i + BATCH_SIZE);
        const promises = chunk.map(async (item) => {
            try {
                // Tenta pegar um ID, ou gera um se não tiver
                const originalId = item.id || item._id || Date.now().toString() + Math.random();
                
                // Limpa o objeto (remove IDs duplicados internos)
                const dataToSave = { ...item };
                delete dataToSave.id;
                delete dataToSave._id;

                // Salva no caminho do usuário
                const docRef = getUserDocumentRef(collectionName, String(originalId));
                await setDoc(docRef, dataToSave);
            } catch (e) {
                console.error(`Erro ao importar item em ${collectionName}:`, e);
                // Não damos throw aqui para não parar o loop inteiro
            }
        });

        // Espera esse lote terminar antes de ir para o próximo
        await Promise.all(promises);
        
        // Atualiza a mensagem na tela para o usuário saber que não travou
        if(window.updateLoadingMessage) {
            window.updateLoadingMessage(`Processando ${collectionName}...`, `${Math.min(i + BATCH_SIZE, items.length)} de ${items.length} concluídos`);
        }
    }
    
    console.log(`✅ Lote ${collectionName} finalizado.`);
}

/**
 * Deleta todos os documentos de uma coleção do Firebase.
 * @param {string} collectionName - O nome da coleção ('products' ou 'sales').
 */

async function clearCollection(collectionName) {
    try {
        // CORREÇÃO: Usa a referência do usuário, não a global
        const snapshot = await getDocs(getUserCollectionRef(collectionName));
        
        const deletePromises = [];
        snapshot.forEach((docEntry) => {
            // CORREÇÃO: Deleta do caminho do usuário
            deletePromises.push(deleteDoc(getUserDocumentRef(collectionName, docEntry.id)));
        });

        await Promise.all(deletePromises);
        console.log(`✅ Coleção '${collectionName}' do usuário limpa.`);
    } catch (error) {
        console.error(`❌ Erro ao limpar '${collectionName}':`, error);
        throw error; // Lança o erro para parar a importação se falhar
    }
}



function sanitizeHTML(str) {
  if (typeof str !== "string") return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}


// ============================================================
// NAVEGAÇÃO E INICIALIZAÇÃO DE ABAS (CORRIGIDO)
// ============================================================

function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  const sections = document.querySelectorAll(".content-section");
  const titleElement = document.getElementById("current-page-title");

  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      
      // 1. Identifica para onde ir
      const targetSectionId = item.getAttribute("href").substring(1);

      // 2. Atualiza Menu Lateral (Visual)
      navItems.forEach((i) => i.classList.remove("active"));
      item.classList.add("active");

      // 3. Esconde tudo e mostra a seção certa
      sections.forEach((sec) => {
        sec.style.display = "none";
        sec.style.opacity = "0";
      });

      const targetSection = document.getElementById(targetSectionId);
      if (targetSection) {
        targetSection.style.display = "block";
        
        // Pequeno delay para animação de fade
        setTimeout(() => {
          targetSection.style.opacity = "1";
        }, 50);

        // Atualiza Título
        if(titleElement) titleElement.textContent = item.querySelector("span").textContent;

        // 4. LÓGICA ESPECÍFICA DE CADA TELA (A CORREÇÃO ESTÁ AQUI)
        switch (targetSectionId) {
          
          case "financeiro":
            // Carrega os dados
            if(typeof loadFinancialDashboard === 'function') loadFinancialDashboard();
            // FORÇA abrir a primeira aba (Visão Geral)
            showTab("fin-dashboard"); 
            break;

          case "relatorios":
            // Carrega a tabela
            if(typeof renderSalesDetailsTable === 'function') renderSalesDetailsTable();
            
            // FORÇA O CÁLCULO DOS CARDS AGORA
            if(typeof atualizarDashboardExecutivo === 'function') atualizarDashboardExecutivo();
            
            // Abre a primeira aba
            showTab("rel-vendas"); 
            break;

          case "vendas":
            // Carrega os produtos do PDV
            if(typeof renderPdvProducts === 'function') renderPdvProducts();
            break;

          case "produtos":
            // Abre a lista de produtos por padrão
            showTab("product-list-tab");
            break;
          case "comunidade":
            // Carrega os posts quando a pessoa clica na aba
            if(typeof loadCommunityPosts === 'function') loadCommunityPosts();
            break;      
          case "parceiros":
            // Carrega as tabelas
            if(typeof loadPartnersData === 'function') loadPartnersData();
            // Abre a aba de Clientes por padrão
            showTab("tab-clientes");
            break;
            
          case "carrinhos-salvos":
            if(typeof renderSavedCarts === 'function') renderSavedCarts();
            break;

          case "config":
            if(typeof renderConfigFields === 'function') renderConfigFields();
            // Abre a primeira aba de configuração
            showTab("categories-tab");
            // Atualiza visualmente o botão da aba também
            document.querySelectorAll('.config-tab-button').forEach(b => b.classList.remove('active'));
            const firstConfigBtn = document.querySelector('[data-config-tab="categories"]');
            if(firstConfigBtn) firstConfigBtn.classList.add('active');
            break;
        }
        

        // Fecha sidebar no mobile ao clicar
        if (window.innerWidth <= 768) {
          document.getElementById("sidebar").classList.remove("collapsed");
          document.getElementById("main-content").classList.remove("expanded");
        }
      }
    });
  });

  // Inicializa os cliques das abas internas também
  setupTabs();
}

function setupTabs() {
  const tabButtons = document.querySelectorAll(".tab-button");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabContentId = button.getAttribute("data-tab-content");
      showTab(tabContentId);
    });
  });
}

function showTab(tabContentId) {
  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.classList.remove("active");
  });

  document.querySelectorAll(".tab-content").forEach((content) => {
    content.style.display = "none";
  });

  const activeButton = document.querySelector(
    `[data-tab-content="${tabContentId}"]`
  );
  const activeContent = document.getElementById(tabContentId);

  if (activeButton && activeContent) {
    activeButton.classList.add("active");
    activeContent.style.display = "block";
    setTimeout(() => {
      activeContent.style.opacity = "1";
    }, 50);
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const mainContent = document.getElementById("main-content");
  sidebar.classList.toggle("collapsed");
  mainContent.classList.toggle("expanded");
}

function toggleAlertsWindow(event) {
  if (event) {
    event.stopPropagation();
  }

  const dropdown = document.getElementById("alerts-floating-window");
  const isVisible = dropdown.style.display === "block";
  dropdown.style.display = isVisible ? "none" : "block";

  if (!isVisible) {
    updateAlerts();
  }
}


function updateDashboardMetrics() {
    try {
        if (!products || !Array.isArray(products)) products = [];

        let totalStockItems = products.reduce((sum, p) => sum + (Number(p.quantidade) || 0), 0);
        let lowStockCount = products.filter((p) => (Number(p.quantidade) || 0) <= (Number(p.minimo) || 0)).length;
        let totalProducts = products.length;

        const hojeTexto = new Date().toLocaleDateString("pt-BR"); // ex: "03/12/2023"
        let salesToday = 0;

        salesHistory.forEach((sale) => {
            const dataVenda = parseDataSegura(sale.timestamp || sale.date);
            
            if (dataVenda) {
                const vendaTexto = dataVenda.toLocaleDateString("pt-BR");
                
                if (vendaTexto === hojeTexto) {
                    salesToday += Number(sale.total) || 0;
                }
            }
        });

        const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
        
        setVal("total-stock-items", totalStockItems.toLocaleString("pt-BR"));
        setVal("total-products", totalProducts.toLocaleString("pt-BR"));
        setVal("low-stock-count", lowStockCount.toLocaleString("pt-BR"));
        
        const elSales = document.getElementById("sales-today");
        if(elSales) {
            elSales.textContent = salesToday.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        }
        
        updateAlerts();
    } catch (error) { console.error("Erro Dashboard:", error); }
}


function updateAlerts() {
  try {
    // 1. Carrega a lista de IDs ocultos
    const hidden = JSON.parse(localStorage.getItem("hiddenAlerts")) || [];

    // 2. Filtra: Só mostra se estoque for baixo E o ID NÃO estiver na lista de ocultos
    const lowStockProducts = products.filter((p) => 
        (Number(p.quantidade) || 0) <= (Number(p.minimo) || 0) &&
        !hidden.includes(p.id) // <--- ESTA LINHA FALTAVA
    );

    const alertListDropdown = document.getElementById("alerts-dropdown-list");
    const dashboardAlertList = document.getElementById("dashboard-alert-list");
    const bellIcon = document.getElementById("bell-icon");

    const renderAlertsList = (listElement) => {
      if (!listElement) return;

      listElement.innerHTML = "";
      if (lowStockProducts.length === 0) {
        listElement.innerHTML = `<li><span style="color: var(--color-accent-green);"><i class="fa-solid fa-circle-check"></i>   Estoque saudável.</span></li>`;
        return;
      }

      lowStockProducts.forEach((p) => {
        const li = document.createElement("li");
        li.innerHTML = `<i class="fas fa-exclamation-circle" style="color: var(--color-accent-red); margin-right: 5px;"></i> ${sanitizeHTML(p.nome)} (${p.quantidade} und.)`;
        listElement.appendChild(li);
      });
    };

    renderAlertsList(alertListDropdown);
    renderAlertsList(dashboardAlertList);

    if (lowStockProducts.length > 0) {
      if(bellIcon) bellIcon.classList.add("has-alerts");
    } else {
      if(bellIcon) bellIcon.classList.remove("has-alerts");
    }
  } catch (error) {
    console.error("Erro ao atualizar alertas:", error);
  }
}

function validateProductForm(data) {
  const errors = [];
  const preco = parseFloat(data.get("preco"));
  const custo = parseFloat(data.get("custo"));
  const quantidade = parseInt(data.get("quantidade"));
  const minimo = parseInt(data.get("minimo"));

  if (preco <= custo) {
    errors.push("Preço de venda deve ser maior que o custo");
  }
  if (quantidade < 0) {
    errors.push("Estoque não pode ser negativo");
  }
  if (minimo < 0) {
    errors.push("Estoque mínimo não pode ser negativo");
  }
  if (!data.get("nome") || data.get("nome").trim().length === 0) {
    errors.push("Nome do produto é obrigatório");
  }

  return errors;
}



async function deleteProduct(id) {
    const user = auth.currentUser;
    if (!user) { customAlert("Erro de autenticação.", "error"); return; }

    // Busca nome do produto antes de apagar para o log
    const prod = products.find(p => p.id === id || p._id === id);
    const nomeProd = prod ? prod.nome : "Desconhecido";

    customConfirm(`Tem certeza que deseja excluir o produto "${nomeProd}"?`, async () => {
        const senha = await getPasswordViaPrompt("Autorização", "Digite sua senha para confirmar a exclusão:");
        if (!senha) return;

        try {
            window.showLoadingScreen("Verificando...", "Autenticando...");
            const credential = EmailAuthProvider.credential(user.email, senha);
            await reauthenticateWithCredential(user, credential);
            
            const productRef = doc(db, "users", user.uid, "products", id);
            await deleteDoc(productRef);
            
            // 📝 LOG DE EXCLUSÃO
            await logSystemAction("Exclusão de Produto", `Apagou o produto: ${nomeProd} (ID: ${id})`);

            window.hideLoadingScreen();
            customAlert("Produto excluído com sucesso!", "success");
            await loadAllData();
        } catch (error) {
            window.hideLoadingScreen();
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                showToast("Senha incorreta.", "error");
            } else {
                customAlert("Erro ao excluir: " + error.message, "error");
            }
        }
    });
}


window.renderProductTable = function(listaParaRenderizar = null) {
    const table = document.getElementById('product-table');
    if (!table) return;

    // Garante Cabeçalho com Varinha
    let thead = table.querySelector('thead');
    if (!thead) { thead = document.createElement('thead'); table.appendChild(thead); }
    
    thead.innerHTML = `
        <tr>
            <th style="width: 40px; text-align: center; padding: 0;">
                <div class="magic-wand-header">
                    <div class="magic-trigger" id="master-magic-wand" onclick="toggleSelectAllVisual(this)" title="Selecionar Tudo">
                        <i class="fas fa-magic"></i>
                    </div>
                </div>
            </th>
            <th>Produto / Detalhes</th> 
            <th style="width: 120px;">Venda</th>
            <th style="width: 100px;">Estoque</th>
            <th style="width: 80px;">Ações</th>
        </tr>
    `;

    let tbody = table.querySelector('tbody');
    if (!tbody) { tbody = document.createElement('tbody'); table.appendChild(tbody); }
    tbody.innerHTML = '';

    let lista = listaParaRenderizar || (produtosFiltradosGlobal.length > 0 ? produtosFiltradosGlobal : products);
    const termo = document.getElementById('universal-search') ? document.getElementById('universal-search').value : "";
    if (!termo && !listaParaRenderizar && typeof pastaSelecionada !== 'undefined' && pastaSelecionada === 'todos') lista = products;

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:40px; opacity:0.5;">Pasta vazia.</td></tr>`;
        return;
    }

    lista.forEach(p => {
        const row = tbody.insertRow();
        if (p.quantidade <= p.minimo) row.classList.add('low-stock-row');
        
        const precoVenda = parseFloat(p.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        
        let imgHtml = p.imagem && p.imagem.length > 10 
            ? `<img src="${p.imagem}" style="width:42px; height:42px; border-radius:6px; object-fit:cover; border:1px solid #333;">`
            : `<div style="width:42px; height:42px; border-radius:6px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; color:#666;"><i class="fas fa-box"></i></div>`;

        row.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="product-check" value="${p.id}" onchange="updateBulkBar()">
            </td>
            
            <td onclick="openProductPreview('${p.id}')" style="cursor: pointer;">
                <div style="display:flex; align-items:center; gap:12px;">
                    ${imgHtml}
                    <div style="flex:1; min-width: 0;"> <div style="
                            font-weight:600; 
                            font-size:0.95rem; 
                            color:var(--color-text-primary); 
                            white-space: nowrap; 
                            overflow: hidden; 
                            text-overflow: ellipsis; 
                            max-width: 280px; /* Limite forçado em pixels */
                            display: block;" 
                            title="${p.nome}">
                            ${p.nome}
                        </div>
                        
                        <div style="display:flex; align-items:center; gap:10px; font-size:0.75rem; color:#aaa; margin-top:4px;">
                            <span style="background:rgba(10, 132, 255, 0.1); color:#0A84FF; padding:1px 5px; border-radius:3px;">
                                ${p.cProd || p.codigoBarras || 'S/ Ref'}
                            </span>
                            
                            <span style="max-width: 100px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${p.categoria || 'Geral'}
                            </span>
                            
                            <span style="color:#666;">•</span>
                            <span>${p.estabelecimento || 'Matriz'}</span>
                        </div>
                    </div>
                </div>
            </td>

            <td style="font-weight:bold; font-size:1rem; color:var(--color-text-primary);">R$ ${precoVenda}</td>
            
            <td>${getEstoqueBadge(p.quantidade, p.minimo, p.categoria)}</td>
            
            <td>
                <div style="display:flex; gap:5px;">
                    <button class="action-btn edit-btn" onclick="editProduct('${p.id}')"><i class="fas fa-pencil-alt"></i></button>
                    <button class="action-btn delete-btn" onclick="deleteProduct('${p.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
    });
}

function showUndoModal(type, detail, logId) {
  document.getElementById("undo-action-type").textContent = type;
  document.getElementById("undo-action-detail").textContent = detail;
  document.getElementById("undo-modal").style.display = "flex";
}

function simulateUndoConfirmation() {
  alert(
    "Simulação de reversão concluída. Em um sistema real, a lógica de reversão seria complexa."
  );
  document.getElementById("undo-modal").style.display = "none";
}


function initializeErrorHandling() {
  window.addEventListener("error", (e) => {
  
  });

  window.addEventListener("unhandledrejection", (e) => {
    console.error("Promise rejeitada:", e.reason);
    e.preventDefault();
  });
}


document.addEventListener("DOMContentLoaded", async () => {
    //await loadAllData(); 

    
    initializeErrorHandling();
    setupNavigation();
    
    if(typeof initSystemConfig === 'function') initSystemConfig();
    if(typeof applySystemConfig === 'function') applySystemConfig();
    if(typeof setupCartClientAutocomplete === 'function') setupCartClientAutocomplete();
    if(typeof setupSaleDetailsStyles === 'function') setupSaleDetailsStyles();
    
    if(typeof initializeDashboardCharts === 'function') initializeDashboardCharts();
    if(typeof inicializarGraficoCategoria === 'function') inicializarGraficoCategoria();
    
    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("modal-overlay")) {
            e.target.style.display = "none";
        }
    });

    const elemento = document.getElementById("algum-id");
    if (elemento) {
        elemento.style.display = "none";
    }
    
    console.log("✅ Inicialização do DOM concluída e funções de renderização chamadas!");
});


function renderPdvProducts() {
    const grid = document.getElementById("products-grid");
    if (!grid) return;
    
    // Se estiver carregando (skeleton), não faz nada
    if (products.length === 0 && grid.querySelector('.skeleton')) return;

    grid.innerHTML = "";
    
    if(products.length === 0) {
        grid.innerHTML = `
            <div class="empty-state-container" style="grid-column: 1 / -1; padding: 30px; border:none;">
                <i class="fas fa-tags empty-state-icon"></i>
                <h3 class="empty-state-title">Sem produtos</h3>
            </div>`;
        return;
    }

    products.forEach((p) => {
        const inStock = p.quantidade > 0 || p.categoria === "Serviços";
        const btnClass = inStock ? "blue-btn" : "out-of-stock";
        
        // Indicador de Estoque Baixo
        let lowStockIcon = "";
        if (p.categoria !== "Serviços" && p.quantidade <= p.minimo && p.quantidade > 0) {
            lowStockIcon = `<div class="low-stock-indicator"><i class="fas fa-exclamation"></i></div>`;
        }

        // LÓGICA DA IMAGEM
        let imageHtml = '';
        if (p.imagem && p.imagem.length > 10) {
            imageHtml = `<div style="width:100%; height:120px; background-image: url('${p.imagem}'); background-size: cover; background-position: center; border-radius: 4px 4px 0 0; margin-bottom:10px;"></div>`;
        } else {
            imageHtml = `<div style="width:100%; height:80px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.05); border-radius:4px; margin-bottom:10px;">
                            <i class="fas fa-camera" style="font-size:2rem; opacity:0.2;"></i>
                         </div>`;
        }

        const div = document.createElement("div");
        div.className = "product-card";
        div.style.padding = "10px"; 
        
        // 🛑 AQUI ESTÁ A CORREÇÃO CRÍTICA:
        // Adicionamos o atributo data-ean para a busca funcionar
        const eanLimpo = (p.codigoBarras || "").trim().toLowerCase();
        div.setAttribute("data-ean", eanLimpo); 
        
        div.innerHTML = `
            ${lowStockIcon}
            ${imageHtml}
            
            <h4 class="product-name" style="font-size:0.95rem; margin-bottom:5px;">${p.nome}</h4>
            
            <p style="font-size:0.75rem; color:#666; margin-bottom:5px;">${p.codigoBarras || ''}</p> 

            <p class="product-category" style="font-size:0.8rem; opacity:0.7;">${p.grupo || p.categoria}</p>
            
            <div style="margin: 8px 0;">
                <span class="product-price" style="font-size:1.1rem;">R$ ${parseFloat(p.preco).toFixed(2)}</span>
            </div>
            
            <small class="product-stock" style="display:block; margin-bottom:10px; color:#888;">
                ${p.categoria === "Serviços" ? "Serviço" : `Restam: ${p.quantidade}`}
            </small>
            
            <button class="submit-btn ${btnClass}" style="width:100%; padding:8px;" onclick="addToCart('${p.id}')" ${!inStock ? "disabled" : ""}>
                ${inStock ? `<i class="fas fa-cart-plus"></i> Adicionar` : "Esgotado"}
            </button>
        `;
        grid.appendChild(div);
    });
}

function filterPdvProducts() {
  try {
    const searchInput = document.getElementById("pdv-search-input");
    if (!searchInput) return;

    const term = searchInput.value.toLowerCase().trim();
    const productCards = document.querySelectorAll(".product-card");

    // Verifica se parece um código de barras (apenas números, 8 a 14 dígitos)
    // Se o usuário digitar rápido (leitor), priorizamos a busca exata
    const isBarcode = /^\d{3,}$/.test(term); 

    productCards.forEach((card) => {
      // 1. Pega o EAN escondido no atributo data-ean
      const ean = (card.getAttribute("data-ean") || "").toLowerCase();
      
      // 2. Pega o Nome visível
      const nameElement = card.querySelector(".product-name");
      const name = nameElement ? nameElement.textContent.toLowerCase() : "";
      
      let match = false;

      if (isBarcode) {
          // Se for número, busca: O código começa com o termo OU o termo está contido
          match = ean.includes(term);
      } else {
          // Se for texto, busca no nome OU no código
          match = name.includes(term) || ean.includes(term);
      }

      card.style.display = match ? "block" : "none";
    });
    
    // AUTO-ADD: Se sobrar apenas 1 produto e for código de barras exato, 
    // e o usuário der ENTER (leitor costuma dar enter), poderia adicionar auto.
    // (Lógica para futuro)
    
  } catch (error) {
    console.error("Erro filtro PDV:", error);
  }
}


function areCartsEqual(cart1, cart2) {
  if (cart1.length !== cart2.length) return false;

  const cart1Map = new Map();
  const cart2Map = new Map();

  cart1.forEach((item) => cart1Map.set(item.id, item.quantity));
  cart2.forEach((item) => cart2Map.set(item.id, item.quantity));

  for (let [id, quantity] of cart1Map) {
    if (cart2Map.get(id) !== quantity) return false;
  }

  return true;
}

function hasSameProducts(cart1, cart2) {
  const cart1Ids = new Set(cart1.map((item) => item.id));
  const cart2Ids = new Set(cart2.map((item) => item.id));

  if (cart1Ids.size !== cart2Ids.size) return false;

  for (let id of cart1Ids) {
    if (!cart2Ids.has(id)) return false;
  }

  return true;
}



let pagamentoSelecionado = null;


// Auxiliar para clique nos botões normais
function selecionarPagamento(btn, type) {
    document.querySelectorAll('.payment-option-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    pagamentoSelecionado = type;
    
    // Restaura visual normal
    const totalOriginal = document.getElementById("payment-total-display").dataset.originalTotal;
    aplicarDescontoVisual(); // Recalcula total com desconto se houver
    
    const display = document.getElementById("modal-final-total");
    display.style.color = "var(--color-accent-green)";
    display.style.borderColor = "var(--color-accent-green)";

    const btnConfirmar = document.getElementById('btn-finalizar-venda');
    btnConfirmar.disabled = false;
    btnConfirmar.style.opacity = "1";
    btnConfirmar.style.cursor = "pointer";
    btnConfirmar.className = "submit-btn green-btn";
    btnConfirmar.innerHTML = `<i class="fas fa-check"></i> Finalizar Venda`;
}


// Função auxiliar para obter a senha de forma assíncrona
function getPasswordViaPrompt(title, message) {
    return new Promise((resolve) => {
        // Chamamos customPrompt passando a função de resolução
        window.customPrompt(title, message, (senha) => {
            resolve(senha); // Resolve a Promessa com a senha digitada
        }, "", "password"); // O último 'password' é o novo argumento para o tipo de input
    });
}

function renderConfigFields() {
  try {
    const categoriesTextarea = document.getElementById(
      "product-categories-config"
    );
    const paymentTextarea = document.getElementById("payment-types-config");

    if (categoriesTextarea) {
      categoriesTextarea.value = config.categories.join("\n");
    }
    if (paymentTextarea) {
      paymentTextarea.value = config.paymentTypes.join("\n");
    }
  } catch (error) {
    console.error("Erro ao renderizar configurações:", error);
  }
}

async function saveCategories() {
    // Tenta encontrar o botão próximo ao textarea de categorias
    const textarea = document.getElementById("product-categories-config");
    const btn = textarea ? textarea.nextElementSibling : null; 

    if (!textarea) return;

    const newCategories = textarea.value.split("\n").map(c => c.trim()).filter(c => c.length > 0);

    if (newCategories.length === 0) {
        showToast("A lista não pode estar vazia.", "error");
        return;
    }

    try {
        if(btn) setBtnLoading(btn, true); // <--- ATIVA ANIMAÇÃO

        config.categories = newCategories;
        
        updateCategorySelect();
        persistData();
        await saveConfigToFirebase();

        showToast("Categorias sincronizadas!", "success");

    } catch (error) {
        console.error(error);
        showToast("Erro ao salvar categorias.", "error");
    } finally {
        if(btn) setBtnLoading(btn, false); // <--- DESATIVA ANIMAÇÃO
    }
}

async function savePaymentTypes() {
    const textarea = document.getElementById("payment-types-config");
    if (!textarea) return;

    const newTypes = textarea.value.split("\n").map(t => t.trim()).filter(t => t.length > 0);

    if (newTypes.length === 0) {
        alert("A lista não pode estar vazia.");
        return;
    }

    config.paymentTypes = newTypes;
    
    // Salva Local
    persistData();
    
    // SALVA NA NUVEM (Importante!)
    await saveConfigToFirebase();

    alert("Formas de pagamento salvas e sincronizadas!");
}




let dailySalesChart = null;
let categorySalesChart = null;

function safeChartDestroy(chart) {
  try {
    if (chart && typeof chart.destroy === "function") {
      chart.destroy();
    }
  } catch (error) {
    console.error("Erro ao destruir gráfico:", error);
  }
  return null;
}

function parseDate(dateStr) {
  if (!dateStr || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return null;

  try {
    const [day, month, year] = dateStr.split("/").map(Number);
    const date = new Date(year, month - 1, day);

    return date.getDate() === day &&
      date.getMonth() === month - 1 &&
      date.getFullYear() === year
      ? date
      : null;
  } catch (error) {
    console.error("Erro ao parsear data:", error);
    return null;
  }
}

function getSalesDataForPeriod(startDateStr, endDateStr) {
  try {
    const startDate = parseDate(startDateStr);
    let endDate = parseDate(endDateStr);

    if (!startDate && !endDate) return salesHistory;

    if (endDate) {
      endDate = new Date(endDate);
      endDate.setDate(endDate.getDate() + 1);
    } else {
      endDate = new Date(); // Hoje
    }

    const start = startDate || new Date(0); // Data mínima

    return salesHistory.filter((sale) => {
      let saleDate;
      if (sale.date) {
        saleDate = new Date(sale.date + "T00:00:00");
      } else {
        saleDate = new Date(sale.timestamp);
      }
      return saleDate >= start && saleDate < endDate;
    });
  } catch (error) {
    console.error("Erro ao filtrar vendas por período:", error);
    return salesHistory;
  }
}

function calculateReportMetrics(sales) {
  try {
    const totalSales = sales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const totalTransactions = sales.length;

    let totalRevenue = 0;
    let totalCost = 0;

    sales.forEach((sale) => {
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach((item) => {
          const preco = Number(item.preco) || 0;
          const custo = Number(item.custo) || 0;
          const quantity = Number(item.quantity) || 0;

          totalRevenue += preco * quantity;
          totalCost += custo * quantity;
        });
      }
    });

    const estimatedProfit = totalRevenue - totalCost;
    const averageTicket =
      totalTransactions > 0 ? totalSales / totalTransactions : 0;

    return {
      totalSales: Number(totalSales) || 0,
      totalTransactions: Number(totalTransactions) || 0,
      estimatedProfit: Number(estimatedProfit) || 0,
      averageTicket: Number(averageTicket) || 0,
      totalRevenue: Number(totalRevenue) || 0,
      totalCost: Number(totalCost) || 0,
    };
  } catch (error) {
    console.error("Erro ao calcular métricas:", error);
    return {
      totalSales: 0,
      totalTransactions: 0,
      estimatedProfit: 0,
      averageTicket: 0,
      totalRevenue: 0,
      totalCost: 0,
    };
  }
}

function renderReportMetrics(metrics, containerId) {
  try {
    const container = document.getElementById(containerId);
    if (!container) return;

    const safeMetrics = {
      totalSales: Number(metrics.totalSales) || 0,
      estimatedProfit: Number(metrics.estimatedProfit) || 0,
      totalTransactions: Number(metrics.totalTransactions) || 0,
      averageTicket: Number(metrics.averageTicket) || 0,
    };

    container.innerHTML = `
            <div class="card metric-card blue-card">
                <div class="card-content">
                    <p class="card-label">Total de Vendas</p>
                    <span class="card-value">${safeMetrics.totalSales.toLocaleString(
                      "pt-BR",
                      { style: "currency", currency: "BRL" }
                    )}</span>
                </div>
                <i class="fas fa-money-bill-wave"></i>
            </div>
            <div class="card metric-card green-card">
                <div class="card-content">
                    <p class="card-label">Lucro Estimado</p>
                    <span class="card-value">${safeMetrics.estimatedProfit.toLocaleString(
                      "pt-BR",
                      { style: "currency", currency: "BRL" }
                    )}</span>
                </div>
                <i class="fas fa-hand-holding-usd"></i>
            </div>
            <div class="card metric-card purple-card">
                <div class="card-content">
                    <p class="card-label">Transações</p>
                    <span class="card-value">${safeMetrics.totalTransactions.toLocaleString(
                      "pt-BR"
                    )}</span>
                </div>
                <i class="fas fa-receipt"></i>
            </div>
            <div class="card metric-card orange-card">
                <div class="card-content">
                    <p class="card-label">Ticket Médio</p>
                    <span class="card-value">${safeMetrics.averageTicket.toLocaleString(
                      "pt-BR",
                      { style: "currency", currency: "BRL" }
                    )}</span>
                </div>
                <i class="fas fa-chart-bar"></i>
            </div>
        `;
  } catch (error) {
    console.error("Erro ao renderizar métricas:", error);
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML =
        '<div class="error-message">Erro ao carregar métricas</div>';
    }
  }
}

function renderSalesReport() {
  try {
    const startDateInput = document.getElementById("data-inicio");
    const endDateInput = document.getElementById("data-fim");

    const startDateStr = startDateInput ? startDateInput.value : "";
    const endDateStr = endDateInput ? endDateInput.value : "";

    const sales = getSalesDataForPeriod(startDateStr, endDateStr);
    const metrics = calculateReportMetrics(sales);

    updateReportMetrics(); // ✅ CORREÇÃO ADICIONADA

    renderReportMetrics(metrics, "analysis-summary-metrics");
    renderReportMetrics(metrics, "sales-summary-metrics");

    renderCategorySalesChart(sales);
    renderTopSellingTable(sales);
    renderSalesDetailsTable(sales);
  } catch (error) {
    console.error("Erro ao renderizar relatório:", error);
    alert("Erro ao gerar relatório. Verifique os dados e tente novamente.");
  }
}

function renderCategorySalesChart(sales) {
    if (window.categorySalesChart instanceof Chart) {
        window.categorySalesChart.destroy();
    }

    const categorySalesMap = {};

    sales.forEach((sale) => {
        if (sale.items && Array.isArray(sale.items)) {
            sale.items.forEach((item) => {
                const product = products.find((p) => (p._id || p.id) == item.id);
                const category = product ? product.categoria : "Outros";
                
                const value = (item.preco || 0) * (item.quantity || 0);
                categorySalesMap[category] = (categorySalesMap[category] || 0) + value;
            });
        }
    });

    const ctx = document.getElementById("categoryChart");
    if (!ctx) return;

    window.categorySalesChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: Object.keys(categorySalesMap),
            datasets: [{
                label: "Vendas por Categoria (R$)",
                data: Object.values(categorySalesMap),
                backgroundColor: "rgba(54, 162, 235, 0.6)"
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderTopSellingTable(sales) {
    try {
        const ranking = {};

        sales.forEach(sale => {
            if (sale.items) {
                sale.items.forEach(item => {
                    const id = item.id;
                    if (!ranking[id]) ranking[id] = { nome: item.nome, lucro: 0, qtd: 0 };
                    
                    const custo = Number(item.custo) || 0;
                    const preco = Number(item.preco) || 0;
                    
                    ranking[id].lucro += (preco - custo) * item.quantity;
                    ranking[id].qtd += item.quantity;
                });
            }
        });

        const top5 = Object.values(ranking).sort((a, b) => b.lucro - a.lucro).slice(0, 5);
        const tbody = document.getElementById("top-selling-table-tbody");
        
        if (tbody) {
            tbody.innerHTML = top5.length ? top5.map((p, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${p.nome}</td>
                    <td>${p.lucro.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                    <td>${p.qtd}</td>
                </tr>`).join("") : '<tr><td colspan="4" class="text-center">Sem dados</td></tr>';
        }
    } catch (e) { console.error(e); }
}

window.renderSalesDetailsTable = function(vendasParaMostrar = null) {
    const tbody = document.getElementById("sales-table-body") || document.querySelector("#sales-report-table tbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    const lista = vendasParaMostrar || salesHistory;

    if (!lista || lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px; color: #888;">Nenhum registro encontrado.</td></tr>`;
        return;
    }

    // Ordena por data
    const listaOrdenada = [...lista].sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date));

    listaOrdenada.forEach((sale) => {
        const row = tbody.insertRow();
        
        const saleId = sale.id || "N/A";
        let d = null;
        if(typeof converterDataNaMarra === 'function') d = converterDataNaMarra(sale.timestamp || sale.date);
        else d = new Date(sale.timestamp || sale.date);

        const dataVisual = (d && !isNaN(d)) ? d.toLocaleString("pt-BR") : "-";
        const total = parseFloat(sale.total) || 0;
        const clientName = sale.client || "-";
        
        // --- AQUI ESTÁ A CORREÇÃO DA BUSCA ---
        let dadosExtrasCliente = "";
        
        // 1. Procura o cliente na lista real para pegar o ID e o Documento
        if (typeof clientesReais !== 'undefined') {
            const clienteObj = clientesReais.find(c => c.nome === clientName);
            if (clienteObj) {
                // Adiciona o ID e o CPF/CNPJ na string de busca
                dadosExtrasCliente = `ID:${clienteObj.id} DOC:${clienteObj.doc}`;
            }
        }
        
        // 2. Se a venda já tiver o clientId salvo (versões novas), usa também
        if (sale.clientId) dadosExtrasCliente += ` ID:${sale.clientId}`;

        // Cria a string "invisível" que o campo de busca lê
        const dadosBusca = `${saleId} ${dataVisual} ${clientName} ${sale.payment} R$${total.toFixed(2)} ${dadosExtrasCliente}`.toLowerCase();
        row.setAttribute("data-search", dadosBusca);
        // -------------------------------------
        
        row.innerHTML = `
            <td><span style="opacity:0.6">#${saleId.slice(-4)}</span></td>
            <td>${dataVisual}</td>
            <td style="font-weight:bold; color:var(--color-accent-green);">R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
            <td>${typeof getPagamentoBadge === 'function' ? getPagamentoBadge(sale.payment) : sale.payment}</td>
            <td>${(sale.items || []).length}</td>
            <td>
                ${clientName}
                ${dadosExtrasCliente.includes('ID:') ? `<i class="fas fa-id-badge" title="Cliente Cadastrado" style="font-size:0.7rem; color:#0A84FF; margin-left:5px;"></i>` : ''}
            </td>
            <td>
                <div style="display:flex; gap:5px;">
                    <button class="action-btn view-btn" onclick="viewSaleDetails('${saleId}')" title="Ver Detalhes"><i class="fas fa-eye"></i></button>
                    <button class="action-btn delete-btn" onclick="reverseSale('${saleId}')" title="Estornar"><i class="fas fa-undo"></i></button>
                </div>
            </td>
        `;
    });
}

// --- SUBSTITUA ESTA FUNÇÃO NO SEU script.js ---
function initializeDashboardCharts() {
    try {
        const ctx = document.getElementById("daily-sales-chart");
        if (!ctx) return;

        // 1. GARANTE QUE O GRÁFICO ANTERIOR É DESTRUÍDO
        if (window.dailySalesChart instanceof Chart) {
             window.dailySalesChart.destroy();
        }

        const salesMap = {};
        
        // Preenche 30 dias vazios
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            salesMap[d.toLocaleDateString("pt-BR")] = 0;
        }

        // Popula com dados do salesHistory
        salesHistory.forEach(sale => {
            const dataVenda = parseDataSegura(sale.timestamp || sale.date);
            if (dataVenda) {
                const chave = dataVenda.toLocaleDateString("pt-BR");
                if (salesMap.hasOwnProperty(chave)) {
                    salesMap[chave] += Number(sale.total) || 0;
                }
            }
        });

        // 2. RECria o gráfico
        window.dailySalesChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: Object.keys(salesMap),
                datasets: [{
                    label: "Vendas (R$)",
                    data: Object.values(salesMap),
                    borderColor: "#0A84FF",
                    backgroundColor: "rgba(10, 132, 255, 0.1)",
                    fill: true,
                    tension: 0.3
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } },
                scales: { 
                    x: { ticks: { maxTicksLimit: 10 } }, 
                    y: { beginAtZero: true } 
                }
            }
        });
        
    } catch (e) { 
        console.error("❌ Erro Gráfico:", e); 
        // Em caso de erro, você pode querer exibir uma mensagem na tela
    }
}

function verificarElementosDashboard() {
  const canvas = document.getElementById("daily-sales-chart");
  if (!canvas) {
    console.error("Canvas do gráfico não encontrado no DOM");
    setTimeout(initializeDashboardCharts, 1000);
    return false;
  }
  return true;
}

const style = document.createElement("style");
style.textContent = `
    .chart-container {
        position: relative;
        height: 300px;
        width: 100%;
    }
    
    #daily-sales-chart {
        width: 100% !important;
        height: 100% !important;
    }
    
    .dashboard-secondary-area {
        margin-top: 25px;
    }
    
    .charts-grid {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 20px;
    }
    
    @media (max-width: 768px) {
        .charts-grid {
            grid-template-columns: 1fr;
        }
        
        .chart-container {
            height: 250px;
        }
    }
`;
document.head.appendChild(style);

function recriarGraficoVendas() {
  if (window.dailySalesChart) {
    window.dailySalesChart.destroy();
    window.dailySalesChart = null;
  }
  initializeDashboardCharts();
}


let hiddenAlerts = JSON.parse(localStorage.getItem("hiddenAlerts")) || [];


function hideAlert(productId) {
  if (!hiddenAlerts.includes(productId)) {
    hiddenAlerts.push(productId);
    localStorage.setItem("hiddenAlerts", JSON.stringify(hiddenAlerts));
    updateAlerts();

    setTimeout(() => {
      const dropdown = document.getElementById("alerts-floating-window");
      if (dropdown) dropdown.style.display = "none";
    }, 300);
  }
}

// --- SUBSTITUA ESTA FUNÇÃO NO SEU script.js ---
function clearAllAlerts() {
  const lowStockProducts = products.filter((p) => (Number(p.quantidade) || 0) <= (Number(p.minimo) || 0));
  const currentAlertIds = lowStockProducts.map(p => p.id);

  if (currentAlertIds.length === 0) {
    customAlert("Não há alertas de estoque para limpar!", "info");
    return;
  }

  customConfirm(`Deseja ocultar todos os ${currentAlertIds.length} alertas de estoque baixo?`, () => {
    
    // Adiciona os IDs atuais à lista de alertas ocultos (garantindo unicidade)
    hiddenAlerts = [...new Set([...hiddenAlerts, ...currentAlertIds])];
    localStorage.setItem("hiddenAlerts", JSON.stringify(hiddenAlerts));
    
    // Força a atualização visual
    updateAlerts();

    // Fecha a janela de notificações (melhor UX)
    const dropdown = document.getElementById("alerts-floating-window");
    if (dropdown) dropdown.style.display = 'none';

    customAlert(`${currentAlertIds.length} alertas foram ocultados!`, "success");
  });
}

function resetHiddenAlerts() {
  hiddenAlerts = [];
  localStorage.setItem("hiddenAlerts", JSON.stringify(hiddenAlerts));
  updateAlerts();
  alert("Alertas ocultos resetados!");
}


document.addEventListener("click", function (event) {
  const modal = document.getElementById("sale-details-modal");
  if (event.target === modal) {
    closeSaleDetails();
  }
});

let currentSaleView = null;

window.viewSaleDetails = function(saleId) {
    const headerTitle = document.querySelector('#sale-details-modal .modal-header h3');
    if(headerTitle) headerTitle.innerHTML = '<i class="fas fa-receipt"></i> Detalhes da Venda';
    try {
        const sale = salesHistory.find((s) => s.id === saleId);
        if (!sale) return alert("Venda não encontrada!");

        // Ícone e Cor do Pagamento
        let iconPgto = '<i class="fas fa-money-bill-wave"></i>';
        if(sale.payment?.toLowerCase().includes('pix')) iconPgto = '<i class="fa-brands fa-pix"></i>';
        if(sale.payment?.toLowerCase().includes('crédito')) iconPgto = '<i class="fas fa-credit-card"></i>';

        // Conteúdo do Modal (Novo Layout)
        const modalContent = document.querySelector('#sale-details-modal .sale-info');
        
        // 1. Cabeçalho do Cupom
        let html = `
            <div class="receipt-header">
                <div class="receipt-status">
                    <span class="status-pill success"><i class="fas fa-check-circle"></i> Venda Aprovada</span>
                </div>
                <div class="receipt-date">
                    ${sale.timestamp ? new Date(sale.timestamp).toLocaleString("pt-BR") : "-"}
                </div>
            </div>

            <div class="receipt-grid">
                <div class="receipt-box">
                    <span class="lbl">Cliente</span>
                    <span class="val client">${sale.client || "Consumidor Final"}</span>
                </div>
                <div class="receipt-box">
                    <span class="lbl">Pagamento</span>
                    <span class="val payment">${iconPgto} ${sale.payment || "Dinheiro"}</span>
                </div>
            </div>
        `;

        // 2. Lista de Itens (Estilo Cupom)
        html += `<div class="receipt-items-container"><table class="receipt-table">
            <thead>
                <tr>
                    <th style="text-align:left">Item</th>
                    <th style="text-align:center">Qtd</th>
                    <th style="text-align:right">Total</th>
                </tr>
            </thead>
            <tbody>`;

        let subtotal = 0;
        if (sale.items) {
            sale.items.forEach(item => {
                const totalItem = (item.preco * item.quantity);
                subtotal += totalItem;
                html += `
                    <tr>
                        <td class="item-name">
                            ${item.nome}
                            <div class="unit-price">${parseFloat(item.preco).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} un.</div>
                        </td>
                        <td style="text-align:center">x${item.quantity}</td>
                        <td style="text-align:right; font-weight:bold;">${totalItem.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                    </tr>
                `;
            });
        }

        html += `</tbody></table></div>`;

        // 3. Totais e Rodapé
        html += `
            <div class="receipt-summary">
                <div class="summary-row">
                    <span>Subtotal</span>
                    <span>${subtotal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
                </div>
                ${sale.discount > 0 ? `
                <div class="summary-row discount">
                    <span>Desconto</span>
                    <span>- ${parseFloat(sale.discount).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
                </div>` : ''}
                <div class="summary-row total">
                    <span>TOTAL</span>
                    <span>${(parseFloat(sale.total)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
                </div>
            </div>
            
            <div class="receipt-footer-id">ID: ${sale.id}</div>
        `;

        // Injeta no HTML (Atenção: A estrutura do seu HTML deve ter uma div com classe .sale-info dentro do modal)
        // Se não tiver, vamos injetar direto no modal-content se necessário, mas o padrão é .sale-info
        if(modalContent) {
            modalContent.innerHTML = html;
            // Esconde a div antiga de itens se ela existir separada
            const oldItems = document.getElementById('detail-sale-items');
            if(oldItems) oldItems.style.display = 'none'; 
        } else {
            // Fallback se a estrutura mudou
            document.querySelector('#sale-details-modal .modal-content').innerHTML = `
                <div class="modal-header"><h3><i class="fas fa-receipt"></i> Cupom</h3><button class="close-modal-btn" onclick="closeSaleDetails()">×</button></div>
                <div class="sale-info">${html}</div>
                <div class="modal-actions"><button class="submit-btn blue-btn" onclick="closeSaleDetails()">Fechar</button></div>
            `;
        }

        document.getElementById("sale-details-modal").style.display = "flex";

    } catch (error) {
        console.error(error);
        alert("Erro ao gerar cupom.");
    }
}

function closeSaleDetails() {
  document.getElementById("sale-details-modal").style.display = "none";
}

document.addEventListener("click", function (event) {
  const modal = document.getElementById("sale-details-modal");
  if (event.target === modal) {
    closeSaleDetails();
  }
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeSaleDetails();
  }
});


function initSystemConfig() {
  renderCategoriesManager();
  renderPaymentsManager();
  setupConfigTabs();
  updateStorageInfo();
}

function setupConfigTabs() {
  const tabButtons = document.querySelectorAll(".config-tab-button");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabId = button.getAttribute("data-config-tab");
      showConfigTab(tabId);
    });
  });
}

function showConfigTab(tabId) {
  document.querySelectorAll(".config-tab-button").forEach((btn) => {
    btn.classList.remove("active");
  });

  document.querySelectorAll(".config-tab-content").forEach((content) => {
    content.style.display = "none";
  });

  const activeButton = document.querySelector(`[data-config-tab="${tabId}"]`);
  const activeContent = document.getElementById(`${tabId}-tab`);

  if (activeButton && activeContent) {
    activeButton.classList.add("active");
    activeContent.style.display = "block";
    activeContent.classList.add("active");
  }
}

function renderCategoriesManager() {
  const container = document.getElementById("categories-container");
  if (!container) return;

  container.innerHTML = "";
  if (!Array.isArray(config.categories)) config.categories = [];

  // Muda o título da lista visualmente
  const header = document.querySelector('.categories-list h5');
  if(header) header.textContent = "Minhas Categorias";

  config.categories.forEach((category, index) => {
    if (!category || category.trim() === "") return;

    const categoryElement = document.createElement("div");
    categoryElement.className = "category-item";
    categoryElement.innerHTML = `
            <span class="category-name">
                <i class="fas fa-tags" style="color:var(--color-accent-purple); margin-right:8px;"></i> 
                ${category}
            </span>
            <div class="category-actions">
                <button class="edit-category-btn" onclick="editCategory(${index})" title="Editar Nome">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="delete-category-btn" onclick="deleteCategory(${index})" title="Excluir Estabelecimento">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    container.appendChild(categoryElement);
  });
}


async function addNewCategory() {
  const input = document.getElementById("new-category-name");
  const name = input.value.trim();

  if (!name) {
    showToast("Digite o nome do estabelecimento (Ex: Lanchonete)!", "error");
    return;
  }

  if (config.categories.includes(name)) {
    showToast("Este estabelecimento já existe!", "info");
    return;
  }

  config.categories.push(name);
  persistData();
  
  const btn = document.querySelector('.categories-manager .blue-btn');
  setBtnLoading(btn, true);

  await saveConfigToFirebase();
  
  setBtnLoading(btn, false);
  renderCategoriesManager();
  updateCategorySelect(); // Atualiza o select lá no formulário de produtos

  input.value = "";
  showToast("Estabelecimento criado com sucesso!", "success");
}


async function editCategory(index) {
  const newName = prompt("Editar nome da categoria:", config.categories[index]);

  if (newName && newName.trim()) {
    config.categories[index] = newName.trim();
    
    // Salva Local
    persistData();
    
    // SALVA NA NUVEM (CORREÇÃO)
    if(typeof saveConfigToFirebase === 'function') await saveConfigToFirebase();

    renderCategoriesManager();
    updateCategorySelect();
    alert("Categoria atualizada!");
  }
}

async function deleteCategory(index) {
    // Pega o nome antes de apagar para usar na mensagem
    const categoryName = config.categories[index];

    customConfirm(`Tem certeza que deseja excluir a categoria "${categoryName}" permanentemente?`, async () => {
        try {
            window.showLoadingScreen("Sincronizando...", "Atualizando banco de dados...");

            // 1. Verificação de Segurança: Existe produto usando?
            const emUso = products.some(p => p.categoria === categoryName);
            if (emUso) {
                window.hideLoadingScreen();
                return customAlert(`Não é possível excluir. Existem produtos usando a categoria "${categoryName}".`, "error");
            }

            // 2. Remove do Array Local
            config.categories.splice(index, 1);
            
            // 3. Salva no LocalStorage (Backup imediato)
            persistData();
            
            // 4. Salva na Nuvem e ESPERA (Await)
            const salvou = await saveConfigToFirebase();

            // 5. Atualiza a Tela
            renderCategoriesManager();
            updateCategorySelect();
            
            window.hideLoadingScreen();

            if (salvou) {
                showToast("Categoria removida e sincronizada!", "success");
            } else {
                showToast("Categoria removida localmente, mas houve erro na nuvem.", "warning");
            }

        } catch (error) {
            window.hideLoadingScreen();
            console.error(error);
            showToast("Erro ao excluir: " + error.message, "error");
            // Se der erro crítico, recarrega os dados originais para evitar desincronia
            await loadAllData(); 
        }
    });
}

function renderPaymentsManager() {
  const container = document.getElementById("payments-container");
  if (!container) return;

  container.innerHTML = "";

  if (!Array.isArray(config.paymentTypes)) config.paymentTypes = [];

  config.paymentTypes.forEach((payment, index) => {
    // Se for fantasma, PULA
    if (!payment || payment.trim() === "") return;

    const paymentElement = document.createElement("div");
    paymentElement.className = "payment-item";
    paymentElement.innerHTML = `
            <span class="payment-name">${payment}</span>
            <div class="payment-actions">
                <button class="edit-payment-btn" onclick="editPayment(${index})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="delete-payment-btn" onclick="deletePayment(${index})" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    container.appendChild(paymentElement);
  });
}

async function addNewPayment() {
    const input = document.getElementById("new-payment-name");
    const name = input.value.trim();

    if (!name) {
        showToast("Digite um nome!", "error");
        return;
    }

    if (config.paymentTypes.includes(name)) {
        showToast("Já existe!", "info");
        return;
    }

    config.paymentTypes.push(name);
    
    persistData();
    
    const btn = document.querySelector('.payments-manager .blue-btn');
    setBtnLoading(btn, true);

    await saveConfigToFirebase();
    
    setBtnLoading(btn, false);
    
    renderPaymentsManager();

    input.value = "";
    showToast("Pagamento adicionado!", "success");
}

async function editPayment(index) {
  const newName = prompt("Editar método de pagamento:", config.paymentTypes[index]);

  if (newName && newName.trim()) {
    config.paymentTypes[index] = newName.trim();
    
    // Salva Local
    persistData();
    
    // SALVA NA NUVEM (CORREÇÃO)
    if(typeof saveConfigToFirebase === 'function') await saveConfigToFirebase();
    
    renderPaymentsManager();
    alert("Método de pagamento atualizado!");
  }
}

async function deletePayment(index) {
    const paymentName = config.paymentTypes[index];

    customConfirm(`Excluir a forma de pagamento "${paymentName}"?`, async () => {
        try {
            window.showLoadingScreen("Sincronizando...", "Removendo do sistema...");

            // 1. Remove do Array Local
            config.paymentTypes.splice(index, 1);
            
            // 2. Salva Local
            persistData();
            
            // 3. Salva na Nuvem e ESPERA
            const salvou = await saveConfigToFirebase();
            
            // 4. Atualiza Visual
            renderPaymentsManager();
            
            window.hideLoadingScreen();

            if (salvou) {
                showToast("Forma de pagamento removida!", "success");
            } else {
                showToast("Atenção: Erro ao sincronizar com a nuvem.", "warning");
            }

        } catch (error) {
            window.hideLoadingScreen();
            showToast("Erro ao excluir: " + error.message, "error");
            await loadAllData();
        }
    });
}

function renderGeneralConfig() {
  document.getElementById("alert-enabled").checked = systemConfig.alertsEnabled;
  document.getElementById("auto-save-interval").value =
    systemConfig.autoSaveInterval;
  document.getElementById("default-report-period").value =
    systemConfig.defaultReportPeriod;
  document.getElementById("show-profit-margin").checked =
    systemConfig.showProfitMargin;
  document.getElementById("auto-print-receipt").checked =
    systemConfig.autoPrintReceipt;
  document.getElementById("theme-select").value = systemConfig.theme;
  document.getElementById("compact-mode").checked = systemConfig.compactMode;

  const paymentSelect = document.getElementById("default-payment-method");
  paymentSelect.innerHTML = "";
  config.paymentTypes.forEach((payment) => {
    const option = document.createElement("option");
    option.value = payment;
    option.textContent = payment;
    if (payment === systemConfig.defaultPaymentMethod) {
      option.selected = true;
    }
    paymentSelect.appendChild(option);
  });
}

function saveGeneralConfig() {
  systemConfig = {
    alertsEnabled: document.getElementById("alert-enabled").checked,
    autoSaveInterval:
      parseInt(document.getElementById("auto-save-interval").value) || 5,
    defaultReportPeriod:
      parseInt(document.getElementById("default-report-period").value) || 30,
    showProfitMargin: document.getElementById("show-profit-margin").checked,
    defaultPaymentMethod: document.getElementById("default-payment-method")
      .value,
    autoPrintReceipt: document.getElementById("auto-print-receipt").checked,
    theme: document.getElementById("theme-select").value,
    compactMode: document.getElementById("compact-mode").checked,
  };

  localStorage.setItem("systemConfig", JSON.stringify(systemConfig));
  applySystemConfig();
  alert("Configurações salvas com sucesso!");
}

function applySystemConfig() {
  document.body.setAttribute("data-theme", systemConfig.theme);

  if (systemConfig.compactMode) {
    document.body.classList.add("compact-mode");
  } else {
    document.body.classList.remove("compact-mode");
  }

  updateAlerts();
}

async function exportData(type = "all") {
    try {
        // 1. Mostra carregamento
        showLoadingScreen("Gerando Backup...", "Compilando seus dados");
        await new Promise(resolve => setTimeout(resolve, 500));

        let data = {
            exportDate: new Date().toISOString(),
            appVersion: "2.0", // Versão atualizada
            dataType: type
        };

        // 2. DADOS PRINCIPAIS (Produtos e Vendas)
        if (type === "all" || type === "products") {
            data.products = (typeof products !== 'undefined') ? products : [];
        }

        if (type === "all" || type === "sales") {
            if (typeof salesHistory !== 'undefined') {
                data.salesHistory = salesHistory;
            } else {
                data.salesHistory = JSON.parse(localStorage.getItem("salesHistory") || "[]");
            }
        }

        // 3. DADOS DE CONFIGURAÇÃO E CLIENTES (Obrigatório no 'all')
        if (type === "all") {
            // Carrinhos em aberto
            data.savedCarts = (typeof savedCarts !== 'undefined') ? savedCarts : [];
            
            // CONFIGURAÇÕES CRÍTICAS (Categorias e Pagamentos)
            // Tenta pegar da variável global, se não, pega do localStorage
            if (typeof config !== 'undefined') {
                data.config = config;
            } else {
                data.config = JSON.parse(localStorage.getItem("config") || '{"categories":[], "paymentTypes":[]}');
            }

            // Preferências do Sistema (Tema, Alertas, etc)
            if (typeof systemConfig !== 'undefined') {
                data.systemConfig = systemConfig;
            } else {
                data.systemConfig = JSON.parse(localStorage.getItem("systemConfig") || "{}");
            }

            // Clientes Cadastrados
            if (typeof clients !== 'undefined') {
                data.clients = clients;
            } else {
                data.clients = JSON.parse(localStorage.getItem("clients") || "[]");
            }
            
            // Histórico e Alertas Ocultos
            data.logHistory = JSON.parse(localStorage.getItem("logHistory") || "[]");
            data.hiddenAlerts = JSON.parse(localStorage.getItem("hiddenAlerts") || "[]");
        }

        // 4. Validação se tem dados
        const totalItems = (data.products?.length || 0) + (data.salesHistory?.length || 0);
        // Se for backup completo, permitimos exportar mesmo sem produtos, pois pode querer salvar só as configs
        if (totalItems === 0 && type !== 'all' && !data.config) {
            hideLoadingScreen();
            return showToast("Não há dados suficientes para exportar.", "info");
        }

        updateLoadingMessage("Criando Arquivo...", "Finalizando download");

        // 5. Gera o Arquivo
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement("a");
        link.href = url;
        const nomeArquivo = type === 'all' ? 'Completo' : (type === 'products' ? 'Produtos' : 'Vendas');
        // Adiciona a data no nome do arquivo para organização
        const dataHoje = new Date().toISOString().split("T")[0];
        link.download = `Backup_StockBrasil_${nomeArquivo}_${dataHoje}.json`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);

        hideLoadingScreen();
        showToast("Backup completo exportado com sucesso!", "success");

    } catch (error) {
        console.error("Erro na exportação:", error);
        hideLoadingScreen();
        showToast("Erro ao gerar arquivo: " + error.message, "error");
    }
}



function clearOldSales() {
  if (
    !confirm("Limpar vendas com mais de 1 ano? Isso não pode ser desfeito.")
  ) {
    return;
  }

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const initialCount = salesHistory.length;
  salesHistory = salesHistory.filter((sale) => {
    const saleDate = sale.date ? new Date(sale.date) : new Date(sale.timestamp);
    return saleDate > oneYearAgo;
  });

  const removedCount = initialCount - salesHistory.length;
  persistData();
  updateDashboardMetrics();

  alert(`${removedCount} vendas antigas foram removidas!`);
}

async function clearAllData() {
    const user = auth.currentUser;
    if (!user) {
        return showToast("Erro: Usuário não autenticado.", "error");
    }

    // 1. Confirmação visual forte
    customConfirm("PERIGO CRÍTICO: Isso apagará PERMANENTEMENTE todos os clientes, vendas, produtos, financeiro e notas.\n\nDeseja realmente continuar?", async () => {
        
        // 2. Pede a senha REAL do usuário (substituindo a fixa "192837")
        const senha = await getPasswordViaPrompt("Segurança Máxima", "Digite sua senha para confirmar a formatação:");
        
        if (!senha) return; // Se cancelar, para aqui

        try {
            window.showLoadingScreen("Formatando Sistema...", "Validando permissões de administrador...");

            // 3. Validação de Segurança Real (Firebase Auth)
            // Se a senha estiver errada, o código vai para o bloco 'catch' automaticamente
            const credential = EmailAuthProvider.credential(user.email, senha);
            await reauthenticateWithCredential(user, credential);

            window.updateLoadingMessage("Apagando Dados...", "Removendo coleções do banco de dados...");

            // 4. Lista COMPLETA de coleções para apagar (Resolvendo o problema de vestígios)
            const collectionsToDelete = [
                "products", 
                "sales", 
                "clients", 
                "suppliers", 
                "expenses", 
                "input_invoices" // Notas Fiscais que estavam sobrando
            ];

            const deletePromises = [];

            // 5. Loop para apagar documento por documento
            for (const colName of collectionsToDelete) {
                const colRef = collection(db, "users", user.uid, colName);
                const snapshot = await getDocs(colRef);
                
                snapshot.forEach(docSnap => {
                    deletePromises.push(deleteDoc(docSnap.ref));
                });
            }

            // 6. Apaga também as configurações (Zera categorias e formas de pagto)
            const settingsRef = doc(db, "users", user.uid, "settings", "general");
            deletePromises.push(deleteDoc(settingsRef));

            // Executa todas as exclusões
            await Promise.all(deletePromises);

            // 7. Limpa o LocalStorage (Memória do navegador)
            localStorage.clear();

            window.hideLoadingScreen();
            
            // Avisa e recarrega
            customAlert("O sistema foi resetado com sucesso! A página será recarregada em 3 segundos.", "success");
            setTimeout(() => location.reload(), 3000);

        } catch (error) {
            window.hideLoadingScreen();
            console.error("Erro no reset:", error);
            
            if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                showToast("Senha incorreta. A formatação foi bloqueada.", "error");
            } else {
                showToast("Erro ao limpar dados: " + error.message, "error");
            }
        }
    });
}


function updateStorageInfo() {
  const totalSize = JSON.stringify(localStorage).length;
  const usedPercentage = (totalSize / (5 * 1024 * 1024)) * 100; // 5MB é o limite comum

  document.getElementById("storage-used").style.width = `${Math.min(
    usedPercentage,
    100
  )}%`;
  document.getElementById("storage-text").textContent = `${(
    totalSize / 1024
  ).toFixed(1)} KB usado (${usedPercentage.toFixed(1)}% do limite)`;
}

document.addEventListener("DOMContentLoaded", function () {
  initSystemConfig();
  applySystemConfig();
  setTimeout(() => {
    setupCartClientAutocomplete();
  }, 1000);
});



function calculateCategorySales(sales) {
  const categoryMap = {};

  sales.forEach((sale) => {
    if (sale.items && Array.isArray(sale.items)) {
      sale.items.forEach((item) => {
        const product = products.find((p) => p.id === item.id);
        const category = product ? product.categoria : "Sem Categoria";
        const value = (item.preco || 0) * (item.quantity || 0);

        categoryMap[category] = (categoryMap[category] || 0) + value;
      });
    }
  });

  return Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .reduce((obj, [key, value]) => {
      obj[key] = value;
      return obj;
    }, {});
}

function calculatePaymentMethods(sales) {
  const paymentMap = {};

  sales.forEach((sale) => {
    const method = sale.payment || "Não informado";
    paymentMap[method] = (paymentMap[method] || 0) + 1;
  });

  return paymentMap;
}

function getTopSellingProducts(sales, limit = 10) {
  const productMap = {};

  sales.forEach((sale) => {
    if (sale.items && Array.isArray(sale.items)) {
      sale.items.forEach((item) => {
        if (!productMap[item.id]) {
          productMap[item.id] = {
            id: item.id,
            nome: item.nome || "Produto sem nome",
            quantitySold: 0,
            revenue: 0,
          };
        }

        productMap[item.id].quantitySold += item.quantity || 0;
        productMap[item.id].revenue += (item.preco || 0) * (item.quantity || 0);
      });
    }
  });

  return Object.values(productMap)
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, limit);
}

function getTopProfitableProducts(sales, limit = 10) {
  const productMap = {};

  sales.forEach((sale) => {
    if (sale.items && Array.isArray(sale.items)) {
      sale.items.forEach((item) => {
        if (!productMap[item.id]) {
          productMap[item.id] = {
            id: item.id,
            nome: item.nome || "Produto sem nome",
            revenue: 0,
            cost: 0,
            profit: 0,
          };
        }

        const revenue = (item.preco || 0) * (item.quantity || 0);
        const cost = (item.custo || 0) * (item.quantity || 0);

        productMap[item.id].revenue += revenue;
        productMap[item.id].cost += cost;
        productMap[item.id].profit += revenue - cost;
      });
    }
  });

  return Object.values(productMap)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, limit);
}

function getTopClients(sales, limit = 5) {
  const clientMap = {};

  sales.forEach((sale) => {
    if (sale.client && sale.client.trim() !== "") {
      if (!clientMap[sale.client]) {
        clientMap[sale.client] = {
          name: sale.client,
          totalSpent: 0,
          purchases: 0,
        };
      }
      clientMap[sale.client].totalSpent += sale.total || 0;
      clientMap[sale.client].purchases += 1;
    }
  });

  return Object.values(clientMap)
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, limit);
}

function generateInsights(sales, metrics) {
  const insights = [];

  if (sales.length === 0) {
    return ["• Nenhuma venda no período selecionado"];
  }

  if (sales.length >= 2) {
    const recent = sales.slice(0, Math.ceil(sales.length / 2));
    const older = sales.slice(Math.ceil(sales.length / 2));
    const recentTotal = recent.reduce((sum, s) => sum + (s.total || 0), 0);
    const olderTotal = older.reduce((sum, s) => sum + (s.total || 0), 0);

    if (recentTotal > olderTotal * 1.2) {
      insights.push("• 📈 Crescimento significativo nas vendas recentes");
    } else if (recentTotal < olderTotal * 0.8) {
      insights.push("• 📉 Queda nas vendas no período recente");
    } else {
      insights.push("• ⚖️ Estabilidade nas vendas ao longo do período");
    }
  }

  if (metrics.averageTicket > 100) {
    insights.push("• 💎 Ticket médio alto indica vendas de alto valor");
  } else if (metrics.averageTicket > 50) {
    insights.push("• 💰 Ticket médio dentro da média esperada");
  } else {
    insights.push("• 🛒 Ticket médio baixo, considere upselling");
  }

  if (metrics.totalRevenue > 0) {
    const margin = (metrics.estimatedProfit / metrics.totalRevenue) * 100;
    if (margin > 40) {
      insights.push("• 🎯 Margem de lucro excelente");
    } else if (margin > 20) {
      insights.push("• ✅ Margem de lucro saudável");
    } else {
      insights.push("• ⚠️ Margem de lucro baixa, revise preços");
    }
  }

  const salesWithClient = sales.filter(
    (s) => s.client && s.client.trim() !== ""
  );
  if (salesWithClient.length / sales.length > 0.7) {
    insights.push("• 👥 Alta taxa de identificação de clientes");
  } else {
    insights.push("• 🗣️ Oportunidade: Melhorar identificação de clientes");
  }

  return insights;
}


function setupCartClientAutocomplete() {
  console.log("Auto-complete de clientes inicializado");
}


function setupSaleDetailsStyles() {
  if (!document.querySelector("#sale-details-beautiful-styles")) {
    const styleElement = document.createElement("style");
    styleElement.id = "sale-details-beautiful-styles";
    styleElement.textContent = `
            /* Seus estilos CSS aqui */
            .sale-details-modal {
                max-width: 700px;
                width: 95%;
            }
            /* ... outros estilos ... */
        `;
    document.head.appendChild(styleElement);
  }
}


document.addEventListener("DOMContentLoaded", function () {

  window.setupCartClientAutocomplete = setupCartClientAutocomplete;
  window.setupSaleDetailsStyles = setupSaleDetailsStyles;

  setupCartClientAutocomplete();
  setupSaleDetailsStyles();

  window.calculateCategorySales = calculateCategorySales;
  window.calculatePaymentMethods = calculatePaymentMethods;
  window.getTopSellingProducts = getTopSellingProducts;
  window.getTopProfitableProducts = getTopProfitableProducts;
  window.getTopClients = getTopClients;
  window.generateInsights = generateInsights;

  console.log("Todas as funções do PDF inicializadas com sucesso!");
});



function testPDF() {
  if (typeof generateCompletePDF === "function") {
    generateCompletePDF();
  } else if (typeof generateCompletePDFSimple === "function") {
    generateCompletePDFSimple();
  } else {
    alert("❌ Funções do PDF não carregadas. Recarregue a página.");
  }
}

function setupClientAutocomplete() {
  const clientInput = document.getElementById("client-name");
  const suggestionsContainer = document.getElementById("client-suggestions");

  if (!clientInput || !suggestionsContainer) return;

  clientInput.addEventListener("input", function () {
    const searchTerm = this.value.toLowerCase().trim();
    suggestionsContainer.innerHTML = "";

    if (searchTerm.length < 2) return;

    const matchingClients = clients
      .filter((client) => client.name.toLowerCase().includes(searchTerm))
      .slice(0, 5); // Limita a 5 sugestões

    matchingClients.forEach((client) => {
      const suggestion = document.createElement("div");
      suggestion.className = "client-suggestion";
      suggestion.textContent = client.name;
      suggestion.onclick = () => {
        clientInput.value = client.name;
        suggestionsContainer.innerHTML = "";
      };
      suggestionsContainer.appendChild(suggestion);
    });

    if (matchingClients.length === 0 && searchTerm.length >= 2) {
      const newSuggestion = document.createElement("div");
      newSuggestion.className = "client-suggestion new-client";
      newSuggestion.innerHTML = `<i class="fas fa-plus"></i> Adicionar "${searchTerm}" como novo cliente`;
      newSuggestion.onclick = () => {
        addNewClient(searchTerm);
        suggestionsContainer.innerHTML = "";
      };
      suggestionsContainer.appendChild(newSuggestion);
    }
  });

  document.addEventListener("click", (e) => {
    if (
      !clientInput.contains(e.target) &&
      !suggestionsContainer.contains(e.target)
    ) {
      suggestionsContainer.innerHTML = "";
    }
  });
}

function addNewClient(clientName) {
  if (!clientName.trim()) return;

  const newClient = {
    id: Date.now(),
    name: clientName.trim(),
    createdAt: new Date().toISOString(),
    totalPurchases: 0,
    totalSpent: 0,
  };

  clients.push(newClient);
  persistData();

  document.getElementById("client-name").value = newClient.name;

  console.log(`Novo cliente adicionado: ${newClient.name}`);
}

function filterSalesTable(searchTerm) {
  try {
    const searchLower = searchTerm.toLowerCase().trim();
    const rows = document.querySelectorAll("#sales-report-table tbody tr");
    let visibleCount = 0;

    const existingNoResults = document.querySelector(
      "#sales-report-table .no-results"
    );
    if (existingNoResults) {
      existingNoResults.remove();
    }

    if (searchLower === "") {
      rows.forEach((row) => {
        row.style.display = "";
        visibleCount++;
      });
      return;
    }

    rows.forEach((row) => {
      if (row.cells.length < 6) {
        row.style.display = "none";
        return;
      }

      const id = row.cells[0].textContent.toLowerCase();
      const data = row.cells[1].textContent.toLowerCase();
      const total = row.cells[2].textContent.toLowerCase();
      const pagamento = row.cells[3].textContent.toLowerCase();
      const itens = row.cells[4].textContent.toLowerCase();
      const cliente = row.cells[5].textContent.toLowerCase();

      const matches =
        id.includes(searchLower) ||
        data.includes(searchLower) ||
        total.includes(searchLower) ||
        pagamento.includes(searchLower) ||
        itens.includes(searchLower) ||
        cliente.includes(searchLower);

      row.style.display = matches ? "" : "none";
      if (matches) visibleCount++;
    });

    if (visibleCount === 0 && searchLower !== "") {
      const tbody = document.querySelector("#sales-report-table tbody");
      if (tbody) {
        const row = tbody.insertRow();
        row.className = "no-results";
        row.innerHTML = `
                    <td colspan="7" style="text-align: center; padding: 30px; color: var(--color-text-secondary); background: var(--color-bg-secondary);">
                        <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 10px; opacity: 0.5;"></i>
                        <br>
                        <strong>Nenhuma venda encontrada</strong>
                        <br>
                        <small>Nenhum resultado para "${searchTerm}"</small>
                    </td>
                `;
      }
    }

    console.log(
      `🔍 Pesquisa: "${searchTerm}" | Resultados: ${visibleCount}/${rows.length}`
    );
  } catch (error) {
    console.error("Erro ao filtrar tabela de vendas:", error);
  }
}

function clearSalesSearch() {
  try {
    const searchInput = document.getElementById("sales-search");
    if (searchInput) {
      searchInput.value = "";
      filterSalesTable("");
      searchInput.focus();
    }
  } catch (error) {
    console.error("Erro ao limpar pesquisa:", error);
  }
}

function setupSalesSearch() {
  const searchInput = document.getElementById("sales-search");
  if (!searchInput) return;

  searchInput.addEventListener("input", function (e) {
    filterSalesTable(e.target.value);
  });

  searchInput.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      clearSalesSearch();
    }
  });

  setTimeout(() => {
    searchInput.focus();
  }, 1000);
}

function formatarData(input) {
  let value = input.value.replace(/\D/g, "");

  if (value.length > 2) {
    value = value.substring(0, 2) + "/" + value.substring(2);
  }
  if (value.length > 5) {
    value = value.substring(0, 5) + "/" + value.substring(5, 9);
  }

  input.value = value;
}

function filtrarPorPeriodo() {
  const dataInicio = document.getElementById("data-inicio").value;
  const dataFim = document.getElementById("data-fim").value;

  if (!dataInicio || !dataFim) {
    alert("Por favor, preencha ambas as datas.");
    return;
  }

  const regexData = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!regexData.test(dataInicio) || !regexData.test(dataFim)) {
    alert("Por favor, use o formato DD/MM/AAAA.");
    return;
  }

  console.log("Filtrando de:", dataInicio, "até:", dataFim);

  alert(`Filtro aplicado!\nPeríodo: ${dataInicio} à ${dataFim}`);
}

document.addEventListener("DOMContentLoaded", function () {
  const dataInicio = document.getElementById("data-inicio");
  const dataFim = document.getElementById("data-fim");

  if (dataInicio) {
    dataInicio.addEventListener("input", function () {
      formatarData(this);
    });

    dataInicio.placeholder = "DD/MM/AAAA";
  }

  if (dataFim) {
    dataFim.addEventListener("input", function () {
      formatarData(this);
    });

    dataFim.placeholder = "DD/MM/AAAA";
  }

  const btnFiltrar = document.querySelector(
    ".period-filter-custom .filter-btn"
  );
  if (btnFiltrar) {
    btnFiltrar.addEventListener("click", filtrarPorPeriodo);
  }

  if (dataInicio) {
    dataInicio.addEventListener("keypress", function (e) {
      if (e.key === "Enter") filtrarPorPeriodo();
    });
  }

  if (dataFim) {
    dataFim.addEventListener("keypress", function (e) {
      if (e.key === "Enter") filtrarPorPeriodo();
    });
  }
});


function inicializarGraficoCategoria() {
  try {
    const ctx = document.getElementById("categoryChart");
    if (!ctx) return;
    if (!ctx) {
      console.warn("Canvas #categoryChart não encontrado.");
      return;
    }

    renderCategorySalesChart(salesHistory);

    console.log("✅ Gráfico de barras por categoria renderizado com sucesso!");
  } catch (err) {
    console.error("❌ Erro ao inicializar gráfico de categorias:", err);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  inicializarGraficoCategoria();

});

document.addEventListener("DOMContentLoaded", function () {
  window.viewSaleDetails = viewSaleDetails;
  window.closeSaleDetails = closeSaleDetails;
  window.filterSalesTable = filterSalesTable;
  window.clearSalesSearch = clearSalesSearch;

  console.log("Funções de detalhes de venda inicializadas");
});

const saleDetailsStyles = `
<style>
.sale-details-modal {
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
}

.sale-info {
    background: var(--color-bg-secondary);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
}

.sale-meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
}

.meta-item {
    display: flex;
    flex-direction: column;
}

.meta-label {
    font-size: 12px;
    color: var(--color-text-secondary);
    margin-bottom: 4px;
}

.meta-value {
    font-weight: 600;
    color: var(--color-text-primary);
}

.meta-item.total-item {
    grid-column: 1 / -1;
    border-top: 1px solid var(--color-border);
    padding-top: 10px;
    margin-top: 5px;
}

.meta-item.total-item .meta-value {
    font-size: 18px;
    color: var(--color-accent-green);
}

.sale-items {
    margin-bottom: 20px;
}

.sale-items h4 {
    margin-bottom: 15px;
    color: var(--color-text-primary);
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 8px;
}

.items-list {
    max-height: 300px;
    overflow-y: auto;
}

.item-detail {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    border-bottom: 1px solid var(--color-border);
}

.item-detail:last-child {
    border-bottom: none;
}

.item-detail.subtotal {
    background: var(--color-bg-secondary);
    border-top: 2px solid var(--color-border);
    border-bottom: none;
    font-weight: bold;
}

.item-info strong {
    display: block;
    margin-bottom: 4px;
}

.item-info small {
    color: var(--color-text-secondary);
}

.item-total {
    font-weight: 600;
    color: var(--color-text-primary);
}

.no-items-message {
    text-align: center;
    padding: 40px 20px;
    color: var(--color-text-secondary);
}

.no-items-message i {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
}

/* Estilos para a tabela de vendas */
.action-btn.view-btn {
    background: var(--color-accent-blue);
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: background 0.2s;
}

.action-btn.view-btn:hover {
    background: var(--color-accent-blue-dark);
}

/* Mensagem de nenhum resultado */
.no-results td {
    background: var(--color-bg-secondary) !important;
}
</style>
`;

if (!document.querySelector("#sale-details-styles")) {
  try {
    const styleElement = document.createElement("style");
    styleElement.id = "sale-details-styles";
    styleElement.textContent = `
            /* Seus estilos CSS aqui */
            .sale-details-modal {
                max-width: 700px;
                width: 95%;
            }
            .sale-info {
                background: var(--color-bg-secondary);
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 20px;
            }
            .sale-meta {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
            }
            .meta-item {
                display: flex;
                flex-direction: column;
            }
            .meta-label {
                font-size: 12px;
                color: var(--color-text-secondary);
                margin-bottom: 4px;
            }
            .meta-value {
                font-weight: 600;
                color: var(--color-text-primary);
            }
            .meta-item.total-item {
                grid-column: 1 / -1;
                border-top: 1px solid var(--color-border);
                padding-top: 10px;
                margin-top: 5px;
            }
            .meta-item.total-item .meta-value {
                font-size: 18px;
                color: var(--color-accent-green);
            }
            .sale-items {
                margin-bottom: 20px;
            }
            .sale-items h4 {
                margin-bottom: 15px;
                color: var(--color-text-primary);
                border-bottom: 1px solid var(--color-border);
                padding-bottom: 8px;
            }
            .items-list {
                max-height: 300px;
                overflow-y: auto;
            }
            .item-detail {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px;
                border-bottom: 1px solid var(--color-border);
            }
            .item-detail:last-child {
                border-bottom: none;
            }
            .item-info strong {
                display: block;
                margin-bottom: 4px;
            }
            .item-info small {
                color: var(--color-text-secondary);
            }
            .item-total {
                font-weight: 600;
                color: var(--color-text-primary);
            }
            .no-items-message {
                text-align: center;
                padding: 40px 20px;
                color: var(--color-text-secondary);
            }
            .no-items-message i {
                font-size: 3rem;
                margin-bottom: 1rem;
                opacity: 0.5;
            }
            .modal-actions {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 20px;
            }
            .action-btn.view-btn {
                background: var(--color-accent-blue);
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                transition: background 0.2s;
            }
            .action-btn.view-btn:hover {
                background: var(--color-accent-blue-dark);
            }
            .no-results td {
                background: var(--color-bg-secondary) !important;
            }
        `;
    document.head.appendChild(styleElement);
    console.log("✅ Estilos de detalhes de venda adicionados com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao adicionar estilos de detalhes de venda:", error);
  }
}

function updateReportMetrics() {
  try {
    const sales = salesHistory;

    if (!sales || sales.length === 0) {
      resetReportMetrics();
      return;
    }

    let totalSales = 0;
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProductsSold = 0;

    sales.forEach((sale) => {
      totalSales += sale.total || 0;

      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach((item) => {
          const quantity = item.quantity || 0;
          const price = item.preco || 0;
          const cost = item.custo || 0;

          totalRevenue += price * quantity;
          totalCost += cost * quantity;
          totalProductsSold += quantity;
        });
      }
    });

    const totalProfit = totalRevenue - totalCost;
    const averageTicket = totalSales / sales.length;

    const totalSalesEl = document.getElementById("report-total-sales");
    const totalProfitEl = document.getElementById("report-total-profit");
    const productsSoldEl = document.getElementById("report-products-sold");
    const averageTicketEl = document.getElementById("report-average-ticket");

    if (totalSalesEl) {
      totalSalesEl.textContent = totalSales.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
    }

    if (totalProfitEl) {
      totalProfitEl.textContent = totalProfit.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
    }

    if (productsSoldEl) {
      productsSoldEl.textContent = totalProductsSold.toLocaleString("pt-BR");
    }

    if (averageTicketEl) {
      averageTicketEl.textContent = averageTicket.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
    }

    console.log("📊 Métricas do relatório atualizadas:", {
      totalSales,
      totalProfit,
      totalProductsSold,
      averageTicket,
    });
  } catch (error) {
    console.error("❌ Erro ao atualizar métricas do relatório:", error);
    resetReportMetrics();
  }
}

function resetReportMetrics() {
  const elements = [
    "report-total-sales",
    "report-total-profit",
    "report-products-sold",
    "report-average-ticket",
  ];

  elements.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      if (
        id.includes("sales") ||
        id.includes("profit") ||
        id.includes("ticket")
      ) {
        el.textContent = "R$ 0,00";
      } else {
        el.textContent = "0";
      }
    }
  });
}


function obterDataTexto(input) {
    if (!input) return null;

    let data;

    data = new Date(input);

    if (isNaN(data.getTime()) && typeof input === 'string') {
        const partes = input.split(' ')[0].split('/'); // Pega só a data
        if (partes.length === 3) {
            data = new Date(`${partes[2]}-${partes[1]}-${partes[0]}T12:00:00`);
        }
    }

    if (isNaN(data.getTime())) return null;

    return data.toLocaleDateString("pt-BR");
}

function normalizarDataParaTexto(input) {
    if (!input) return null;

    if (typeof input === 'string') {
        const parteData = input.split(' ')[0].replace(',', '').trim();
        
        if (parteData.includes('/') && parteData.split('/')[0].length === 2) {
            return parteData; 
        }

        if (parteData.includes('-')) {
            const p = parteData.split('-'); // [2025, 12, 03]
            return `${p[2]}/${p[1]}/${p[0]}`; // Retorna 03/12/2025
        }
    }

    if (input instanceof Date) {
        return input.toLocaleDateString("pt-BR");
    }

    try {
        const d = new Date(input);
        if (!isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
    } catch (e) { return null; }

    return null;
}

function normalizarData(input) {
    if (!input) return null;

    if (input instanceof Date && !isNaN(input.getTime())) return input;

    if (typeof input === 'string') {
        if (input.includes('/')) {
            const partesData = input.split(' ')[0].split('/'); // Pega só a data: ["25", "12", "2023"]
            if (partesData.length === 3) {
                return new Date(partesData[2], partesData[1] - 1, partesData[0], 12, 0, 0);
            }
        }
        
        const d = new Date(input);
        if (!isNaN(d.getTime())) return d;
    }

    return null;
}

function forcarData(input) {
    if (!input) return null;

    if (input instanceof Date && !isNaN(input)) return input;

    if (typeof input === 'string') {
        if (input.includes('-')) {
            const d = new Date(input.length <= 10 ? input + "T12:00:00" : input);
            if (!isNaN(d)) return d;
        }

        if (input.includes('/')) {
            const partes = input.split(' ')[0].split('/'); // Pega [25, 11, 2023]
            if (partes.length === 3) {
                return new Date(partes[2], partes[1] - 1, partes[0], 12, 0, 0);
            }
        }
    }
    return null;
}

function viewCartDetails(cartId) {
    const savedCart = savedCarts.find(c => c.id == cartId);
    if (!savedCart) return;

    let msg = `🛒 DETALHES DO CARRINHO #${savedCart.id}\n`;
    msg += `📅 Data: ${savedCart.timestamp}\n`;
    msg += `👤 Cliente: ${savedCart.client || "Não informado"}\n`;
    msg += `--------------------------------\n`;
    
    savedCart.items.forEach(item => {
        msg += `• ${item.quantity}x ${item.nome} (R$ ${item.preco.toFixed(2)})\n`;
    });
    
    msg += `--------------------------------\n`;
    msg += `💰 TOTAL: R$ ${savedCart.total.toLocaleString("pt-BR", {minimumFractionDigits: 2})}`;

    alert(msg);
}


function criarNovoArquivo() {
    const confirmacao = confirm("⚠️ ATENÇÃO: Isso vai apagar TODOS os dados atuais para começar do zero.\n\nDeseja fazer um backup automático antes de limpar?");

    if (confirmacao) {
        try {
            exportData(); // Chama sua função de exportar/download
            alert("Backup realizado! Agora vamos limpar o sistema.");
        } catch (e) {
            alert("Erro ao fazer backup. O sistema não será limpo por segurança.");
            return;
        }
    } else {
        if (!confirm("Tem certeza que deseja apagar tudo SEM fazer backup? Essa ação é irreversível.")) {
            return;
        }
    }

    localStorage.clear();
    
    produtos = [];
    vendas = [];
    clientes = [];
    
    alert("Sistema limpo com sucesso! Iniciando novo arquivo.");
    window.location.reload();
}




async function importData() {
    const input = document.getElementById('arquivo-backup-input');
    
    if (!input || !input.files.length) {
        return showToast("Selecione um arquivo de backup primeiro.", "info");
    }

    const file = input.files[0];
    const reader = new FileReader();

    // Evento ao terminar de ler o arquivo
    reader.onload = function(event) {
        try {
            // 1. Tenta ler o JSON primeiro (pra ver se o arquivo é válido)
            const data = JSON.parse(event.target.result);

            // 2. CHAMA A JANELA BONITA (customConfirm)
            // A lógica de importação agora vai dentro da função callback (segundo argumento)
            customConfirm(
                "⚠️ ATENÇÃO CRÍTICA: Isso vai apagar TODOS os dados atuais e restaurar o backup selecionado. Tem certeza?", 
                function() {
                    // O usuário clicou em "Sim", então roda o processo:
                    processarImportacao(data);
                }
            );

        } catch (error) {
            console.error(error);
            showToast("O arquivo selecionado não é um JSON válido.", "error");
            input.value = ""; // Limpa o input
        }
    };
    
    reader.readAsText(file);
}

window.filterSalesTable = function(valor) {
    const termo = valor.toLowerCase().trim();
    const rows = document.querySelectorAll("#sales-report-table tbody tr");

    rows.forEach(row => {
        // Pega os dados invisíveis que colocamos no atributo data-search
        const searchData = row.getAttribute("data-search") || row.innerText.toLowerCase();
        
        // Se o termo estiver em QUALQUER lugar (ID Venda, ID Cliente, Nome, Data), mostra.
        if (searchData.includes(termo)) {
            row.style.display = "";
        } else {
            row.style.display = "none";
        }
    });
}

async function processarImportacao(data) {
    try {
        showLoadingScreen("Iniciando Restauração...", "Aguarde, não feche a página.");

        const user = auth.currentUser;
        if (!user) throw new Error("Usuário não autenticado.");

        // ETAPA 1: LIMPEZA
        updateLoadingMessage("Limpando Banco de Dados...", "Removendo registros antigos...");
        if(typeof clearCollection === 'function') {
            await clearCollection('products');
            await clearCollection('sales');
        }

        // ETAPA 2: RESTAURAÇÃO DE DADOS (FIREBASE)
        if (data.products && Array.isArray(data.products) && data.products.length > 0) {
            updateLoadingMessage("Restaurando Estoque...", `Importando ${data.products.length} produtos...`);
            await importCollection('products', data.products);
        }

        if (data.salesHistory && Array.isArray(data.salesHistory) && data.salesHistory.length > 0) {
            updateLoadingMessage("Restaurando Vendas...", `Importando ${data.salesHistory.length} vendas...`);
            await importCollection('sales', data.salesHistory);
        }

        // ETAPA 3: RESTAURAÇÃO DE CONFIGURAÇÕES (IMPORTANTE!)
        updateLoadingMessage("Configurações...", "Sincronizando preferências com a nuvem...");
        
        localStorage.clear(); // Limpa lixo local

        // --- AQUI ESTÁ A MÁGICA PARA CATEGORIAS E PAGAMENTOS ---
        if (data.config) {
            // 1. Salva no LocalStorage
            localStorage.setItem("config", JSON.stringify(data.config));
            
            // 2. Atualiza a variável global na hora
            config = data.config; 

            // 3. SALVA NA NUVEM (Para não perder ao reiniciar)
            try {
                const settingsRef = doc(db, "users", user.uid, "settings", "general");
                await setDoc(settingsRef, { 
                    categories: data.config.categories || [], 
                    paymentTypes: data.config.paymentTypes || [] 
                }, { merge: true });
                console.log("✅ Configurações restauradas na nuvem.");
            } catch (e) {
                console.error("Erro ao sincronizar config na nuvem:", e);
            }
        }

        // Restaura Clientes
        if (data.clients) {
            localStorage.setItem("clients", JSON.stringify(data.clients));
            // Se você tiver uma coleção de clientes no Firebase no futuro, salve aqui também
        }

        // Restaura Outros Dados Locais
        if (data.logHistory) localStorage.setItem("logHistory", JSON.stringify(data.logHistory));
        if (data.savedCarts) localStorage.setItem("savedCarts", JSON.stringify(data.savedCarts));
        if (data.systemConfig) localStorage.setItem("systemConfig", JSON.stringify(data.systemConfig));
        if (data.hiddenAlerts) localStorage.setItem("hiddenAlerts", JSON.stringify(data.hiddenAlerts));

        // SUCESSO
        updateLoadingMessage("Sucesso!", "Recarregando sistema...");
        setTimeout(() => {
            window.location.reload();
        }, 1500);

    } catch (err) {
        console.error("Erro fatal na importação:", err);
        hideLoadingScreen();
        alert("Erro crítico ao importar: " + err.message);
    }
}

function normalizarDataParaFiltro(input) {
    if (!input) return null;

    if (typeof input === 'string') {
        if (input.includes('/')) {
            const partes = input.split(' ')[0].split('/'); 
            if (partes.length === 3) {
                return new Date(partes[2], partes[1] - 1, partes[0], 12, 0, 0);
            }
        }
        const d = new Date(input);
        if (!isNaN(d.getTime())) {
            d.setHours(12,0,0,0); // Força meio dia pra evitar erro de fuso
            return d;
        }
    }
    if (input instanceof Date && !isNaN(input)) return input;
    
    return null;
}

function formatarDataHoraVisual(input) {
    if (!input) return "-";
    
    const str = String(input).trim();

    if (str.includes(',')) {
        const partes = str.split(',');
        const data = partes[0].trim();
        const hora = partes[1].trim(); 
        return `${data} ${hora.slice(0, 5)}`; 
    }

    const d = new Date(input);
    if (!isNaN(d.getTime())) {
        return d.toLocaleString("pt-BR").slice(0, 16); // "dd/mm/aaaa hh:mm"
    }

    return str; // Retorna original se não souber formatar
}

// Função auxiliar para não repetir código
function executarRelatorio(type, start, end) {
    start.setHours(0,0,0,0);
    end.setHours(23,59,59,999);

    if (type === 'sales-report' || type === 'detailed-sales') {
        imprimirRelatorioVendas(start, end);
    } else if (type === 'profit-report') {
        imprimirRelatorioLucro(start, end);
    }
}


function adicionarPaginaGraficos(doc, vendas, total, ticket) {
    doc.addPage();
    
    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80);
    doc.text("Dashboard de Performance", 14, 20);
    doc.setDrawColor(200);
    doc.line(14, 25, 196, 25);

    const pagamentos = {};
    const categorias = {};
    vendas.forEach(v => {
        const pg = v.payment || "Não Informado";
        pagamentos[pg] = (pagamentos[pg] || 0) + (parseFloat(v.total) || 0);

        if(v.items) {
            v.items.forEach(item => {
                const prod = products.find(p => (p._id || p.id) == item.id);
                const cat = prod ? prod.categoria : "Geral";
                categorias[cat] = (categorias[cat] || 0) + (item.preco * item.quantity);
            });
        }
    });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("FATURAMENTO POR MÉTODO", 14, 40);
    
    let y = 50;
    const maxVal = Math.max(...Object.values(pagamentos), 1);
    
    Object.entries(pagamentos).sort((a,b) => b[1] - a[1]).forEach(([nome, valor]) => {
        const width = (valor / maxVal) * 80; // Max 80mm
        doc.setFontSize(9);
        doc.setTextColor(60);
        doc.text(nome, 14, y+4);
        
        doc.setFillColor(52, 152, 219);
        doc.rect(50, y, width, 5, 'F');
        
        doc.setFontSize(8);
        doc.text(`R$ ${valor.toFixed(0)}`, 50 + width + 2, y+4);
        y += 10;
    });

    let yCat = y + 20;
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("TOP CATEGORIAS", 14, yCat);
    yCat += 10;

    const maxCat = Math.max(...Object.values(categorias), 1);
    Object.entries(categorias).sort((a,b) => b[1] - a[1]).slice(0, 8).forEach(([nome, valor]) => {
        const width = (valor / maxCat) * 80;
        doc.setFontSize(9);
        doc.setTextColor(60);
        doc.text(nome, 14, yCat+4);
        
        doc.setFillColor(155, 89, 182);
        doc.rect(50, yCat, width, 5, 'F');
        
        doc.setFontSize(8);
        doc.text(`R$ ${valor.toFixed(0)}`, 50 + width + 2, yCat+4);
        yCat += 10;
    });
}


// ARQUIVO: script.js

window.editProduct = function(id) {
    const p = products.find(x => (x._id === id) || (x.id == id));
    if (!p) return;

    // --- PROTEÇÃO CONTRA ERROS DE ID ---
    const elTitle = document.getElementById("form-title");
    const elBtn = document.getElementById("submit-btn");
    const elCancel = document.getElementById("cancel-edit-btn");
    const elId = document.getElementById("product-id");

    if(elTitle) elTitle.innerHTML = 'Editar Produto';
    if(elBtn) elBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Alterações';
    if(elCancel) elCancel.style.display = "inline-flex"; // Mostra o botão cancelar
    if(elId) elId.value = p.id;
    // ------------------------------------

    // 3. Atualiza as listas
    if(typeof updateCategorySelect === 'function') updateCategorySelect(); 
    if(typeof updateProductSupplierDropdown === 'function') updateProductSupplierDropdown();
    if(typeof updateEstablishmentSelect === 'function') updateEstablishmentSelect(); 
    if(typeof updateProductSupplierDropdown === 'function') updateProductSupplierDropdown();

    // 4. PREENCHE OS CAMPOS
    const setVal = (eid, val) => { 
        const el = document.getElementById(eid); 
        if(el) el.value = val !== undefined ? val : ""; 
    };

    setVal('nome', p.nome);
    setVal('codigoBarras', p.codigoBarras); 
    setVal('cProd', p.cProd); 
    setVal('quantidade', p.quantidade);
    setVal('minimo', p.minimo);
    setVal('unidade', p.unidade || "UN");
    setVal('ncm', p.ncm);
    setVal('localizacao', p.localizacao);
    setVal('custo', p.custo);
    
    const elFrete = document.getElementById('prodFrete');
    if(elFrete) {
        // Formata para BR se for número
        let valorFrete = p.frete || 0;
        if (typeof valorFrete === 'number') {
            valorFrete = valorFrete.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        }
        elFrete.value = valorFrete;
    }
    
    setVal('prodMarkup', p.markup || 2.0);
    
    // Preço
    const elPreco = document.getElementById('preco');
    if(elPreco) {
        let valorPreco = p.preco || 0;
        if (typeof valorPreco === 'number') {
            valorPreco = valorPreco.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        }
        elPreco.value = valorPreco;
    }

    // Imagem (Salva no hidden)
    setVal('prodImagem', p.imagem);

    // Switch Automático
    const switchAuto = document.getElementById('autoMarkupSwitch');
    if (switchAuto) switchAuto.checked = (p.autoMarkup !== false); 

    // IMAGEM: Atualiza o preview visualmente
    const preview = document.getElementById('form-image-preview');
    const placeholder = document.getElementById('form-image-placeholder');
    
    if (preview && placeholder) {
        if (p.imagem && p.imagem.length > 10) {
            preview.src = p.imagem;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
        } else {
            preview.src = "";
            preview.style.display = 'none';
            placeholder.style.display = 'flex';
        }
    }

    // Selects (Com pequeno delay para garantir que a lista carregou)
    setTimeout(() => {
        setVal('categoria', p.categoria);
        setVal('prodEstabelecimento', p.estabelecimento || "Matriz");
        setVal('prodFornecedor', p.fornecedor);
        
        if(typeof calcularPrecificacao === 'function') calcularPrecificacao('edit');
    }, 50);

    // Muda de aba e rola para o topo
    if(typeof showTab === 'function') showTab('product-form-tab');
    
    const formTab = document.getElementById('product-form-tab');
    if(formTab) formTab.scrollIntoView({ behavior: 'smooth' });
}

// 3. PREENCHER O NOVO MODAL DE DETALHES (ATUALIZADA)
window.openProductPreview = function(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;

    // Elementos da Imagem
    const imgEl = document.getElementById('preview-img');
    const noImgEl = document.getElementById('preview-no-img');
    
    // Lógica de Exibição da Imagem
    if (p.imagem && p.imagem.length > 20) {
        imgEl.src = p.imagem;
        imgEl.style.display = 'block';
        if(noImgEl) noImgEl.style.display = 'none';
    } else {
        imgEl.style.display = 'none';
        if(noImgEl) noImgEl.style.display = 'block';
    }

    // Preenchimento de Textos
    const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if(el) el.textContent = val || "-";
    };

    setTxt('preview-name', p.nome);
    setTxt('preview-category', p.categoria || "GERAL");
    setTxt('preview-price', `R$ ${parseFloat(p.preco || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    
    // Fornecedor
    let nomeForn = "Não informado";
    if(p.fornecedor && typeof fornecedoresReais !== 'undefined') {
        const f = fornecedoresReais.find(x => x.id === p.fornecedor);
        if(f) nomeForn = f.nome;
    }
    setTxt('preview-supplier', nomeForn);

    // Códigos
    setTxt('preview-ean', p.codigoBarras || "---");
    setTxt('preview-cprod', p.cProd || "---");

    // Dados Fiscais e Estoque
    setTxt('preview-stock', `${p.quantidade} ${p.unidade || 'UN'}`);
    
    const localHtml = p.localizacao ? `<i class="fas fa-map-marker-alt"></i> ${p.localizacao}` : "---";
    document.getElementById('preview-local').innerHTML = localHtml;
    
    setTxt('preview-ncm', p.ncm || "---");
    setTxt('preview-estab', p.estabelecimento || "Matriz");

    // Financeiro
    setTxt('preview-cost', `R$ ${parseFloat(p.custo || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    
    const lucro = parseFloat(p.preco || 0) - parseFloat(p.custo || 0);
    const elProfit = document.getElementById('preview-profit');
    if(elProfit) {
        elProfit.textContent = `R$ ${lucro.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        elProfit.style.color = lucro >= 0 ? 'var(--color-accent-green)' : '#FF453A';
    }

    // Botão Editar
    const btnEdit = document.getElementById('btn-edit-preview');
    btnEdit.onclick = function() {
        document.getElementById('product-preview-modal').style.display = 'none';
        editProduct(p.id);
    };

    // Abre o modal
    document.getElementById('product-preview-modal').style.display = 'flex';
}

window.handleProductForm = async function(event) {
    event.preventDefault(); 
    const btn = document.getElementById('submit-btn');
    
    // --- 1. CAPTURA E VALIDAÇÃO ---
    const elNome = document.getElementById('nome');
    const elPreco = document.getElementById('preco'); // Campo visual com máscara
    const elQtd = document.getElementById('quantidade');
    
    // Remove formatação (R$ 1.200,00 -> 1200.00) para validar
    const lerValor = (val) => {
        if(!val) return 0;
        return parseFloat(val.toString().replace("R$", "").replace(/\./g, '').replace(',', '.')) || 0;
    };

    const nomeProd = elNome ? elNome.value.trim() : "";
    const preco = lerValor(elPreco.value);
    const quantidade = elQtd.value; // Pega como string pra ver se está vazio

    // REGRAS DE BLOQUEIO
    if (nomeProd.length < 2) {
        showToast("Erro: O Nome do produto é obrigatório.", "error");
        elNome.focus();
        elNome.classList.add('input-error'); // Efeito visual de erro
        setTimeout(() => elNome.classList.remove('input-error'), 2000);
        return;
    }

    if (preco <= 0) {
        showToast("Erro: O Preço de Venda deve ser maior que zero.", "error");
        elPreco.focus();
        return;
    }

    if (quantidade === "" || parseInt(quantidade) < 0) {
        showToast("Erro: Informe a quantidade atual em estoque.", "error");
        elQtd.focus();
        return;
    }

    // --- 2. PREPARA DADOS ---
    const elCusto = document.getElementById('custo');
    const elFrete = document.getElementById('prodFrete');
    const elMarkup = document.getElementById('prodMarkup');
    const elMin = document.getElementById('minimo');
    
    const custo = parseFloat(elCusto ? elCusto.value : 0) || 0;
    const frete = lerValor(elFrete ? elFrete.value : "0");
    const markup = parseFloat(elMarkup ? elMarkup.value : 0) || 0;
    const custoTotal = custo + frete;

    // Validação extra de segurança
    if (preco < custoTotal) {
        // Apenas avisa, mas permite se o usuário quiser vender com prejuízo (ex: validade)
        // Se quiser bloquear, mude para return;
        showToast("Atenção: O preço está abaixo do custo!", "info");
    }

    const switchAuto = document.getElementById('autoMarkupSwitch');
    const isAuto = switchAuto ? switchAuto.checked : true;
    const idInput = document.getElementById('product-id');
    const isEditing = idInput && idInput.value !== '';

    // Campos Opcionais
    const elCat = document.getElementById('categoria');
    const elEst = document.getElementById('prodEstabelecimento');
    const elBar = document.getElementById('codigoBarras');
    const elCProd = document.getElementById('cProd'); 
    const elForn = document.getElementById('prodFornecedor');
    const elImg = document.getElementById('prodImagem');

    const productData = {
        nome: nomeProd,
        categoria: elCat ? elCat.value : "Geral",
        estabelecimento: elEst ? elEst.value : (config.establishments ? config.establishments[0] : "Matriz"),
        codigoBarras: elBar ? elBar.value : "",
        cProd: elCProd ? elCProd.value.trim() : "",
        grupo: "", 
        preco: preco,
        custo: custo,
        frete: frete,
        markup: markup,
        autoMarkup: isAuto, 
        quantidade: parseInt(quantidade),
        minimo: parseInt(elMin ? elMin.value : 0),
        fornecedor: elForn ? elForn.value : "",
        imagem: elImg ? elImg.value : "",
        
        // Novos Campos
        unidade: document.getElementById('unidade').value || "UN",
        ncm: document.getElementById('ncm').value || "",
        localizacao: document.getElementById('localizacao').value || "",
        maximo: parseInt(document.getElementById('maximo').value || 0),
        leadTime: parseInt(document.getElementById('leadTime').value || 0),
    };

    // --- 3. ENVIA PARA O FIREBASE ---
    try {
        if(btn) setBtnLoading(btn, true);

        if (isEditing) {
            await updateDoc(getUserDocumentRef("products", idInput.value), productData);
            await logSystemAction("Edição de Produto", `Alterou: ${nomeProd}`);
            showToast("Produto atualizado!", "success");
        } else {
            await addDoc(getUserCollectionRef("products"), productData);
            await logSystemAction("Criação de Produto", `Criou: ${nomeProd}`);
            showToast("Produto cadastrado!", "success");
        }

        resetProductForm(); // Limpa tudo (incluindo foto)
        await loadAllData(); 
        if(typeof showTab === 'function') showTab('product-list-tab');

    } catch (error) {
        console.error(error);
        showToast("Erro ao salvar: " + error.message, "error");
    } finally {
        if(btn) setBtnLoading(btn, false);
    }
}

window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    
    // Alterna a classe no CSS
    sidebar.classList.toggle('collapsed');
    
    // Expande o conteúdo
    if (mainContent) {
        mainContent.classList.toggle('expanded');
    }
}



window.openProfileSettings = openProfileSettings;
window.loadAllData = loadAllData;
window.handleProductForm = handleProductForm;
window.deleteProduct = deleteProduct;
window.editProduct = editProduct;

window.showTab = showTab;
window.toggleSidebar = toggleSidebar;
window.toggleAlertsWindow = toggleAlertsWindow;
window.clearAllAlerts = clearAllAlerts;

window.updateCartQuantity = updateCartQuantity; // FUNÇÃO QUE ESTAVA FALTANDO


window.checkout = checkout; // FUNÇÃO QUE ESTAVA FALTANDO
window.saveCurrentCart = saveCurrentCart; // FUNÇÃO QUE ESTAVA FALTANDO



window.setupNavigation = setupNavigation; // Para o DOMContentLoaded

window.generatePDF = generatePDF; // FUNÇÃO QUE ESTAVA FALTANDO (Erro Principal)
window.viewSaleDetails = viewSaleDetails;
window.closeSaleDetails = closeSaleDetails;
window.renderCategoriesManager = renderCategoriesManager;
window.addNewCategory = addNewCategory;
window.editCategory = editCategory;
window.deleteCategory = deleteCategory;
window.renderPaymentsManager = renderPaymentsManager;
window.addNewPayment = addNewPayment;
window.editPayment = editPayment;
window.deletePayment = deletePayment;
window.clearAllData = clearAllData;
window.exportData = exportData;
window.importData = importData;
window.updateReportMetrics = updateReportMetrics;




window.openProfileSettings = openProfileSettings;
window.logout = function() {
    window.customConfirm("Deseja realmente sair?", () => {
        logoutSystem();
    });
};
window.toggleSidebarProfileMenu = toggleSidebarProfileMenu;
document.addEventListener("DOMContentLoaded", () => {
    setupNavigation();
    
    // ... outros códigos ...

    setupFormValidation(); // <--- ADICIONE ISSO PARA LIGAR O SISTEMA
    
});



// =================================================================
// 1. FUNÇÕES DE NAVEGAÇÃO E SISTEMA (BOTOES EDITAR/SAIR)
// =================================================================

// Redireciona para a página de edição de perfil
function openProfileSettings() {
    window.location.href = "profile.html";
}


// =================================================================
// 2. FUNÇÃO DE ABRIR/FECHAR MENU (COM LÓGICA DE SETA)
// =================================================================

// --- NOVO CÓDIGO PARA A FUNÇÃO toggleSidebarProfileMenu ---
function toggleSidebarProfileMenu(event) {
    if(event) event.stopPropagation(); 

    const sidebar = document.getElementById('sidebar');
    const menu = document.getElementById('sidebar-profile-dropdown');
    const arrow = document.querySelector('.arrow-icon');

    if (!menu) return;

    // Se a sidebar estiver fechada, abre ela e mostra o menu
    if (sidebar && sidebar.classList.contains('collapsed')) {
        toggleSidebar(); // Abre a sidebar
        setTimeout(() => {
            menu.style.display = 'flex'; // Liga o display
            menu.classList.add('show');
            if(arrow) arrow.style.transform = 'rotate(180deg)';
        }, 300); // 300ms é a transição da barra
    } else {
        // Se a barra já estiver aberta, alterna o menu
        const isVisible = menu.classList.contains('show');

        if (isVisible) {
            closeProfileMenu(); // Usa a função de fechar suave
        } else {
            // Abre imediatamente
            menu.style.display = 'flex';
            setTimeout(() => menu.classList.add('show'), 10); 
            if(arrow) arrow.style.transform = 'rotate(180deg)';
        }
    }
}


// --- VERIFIQUE TAMBÉM A FUNÇÃO closeProfileMenu ---
function closeProfileMenu() {
    const menu = document.getElementById('sidebar-profile-dropdown');
    const arrow = document.querySelector('.arrow-icon');
    
    if (menu) {
        menu.classList.remove('show');
        // Adicionando um pequeno delay para que a transição de opacidade/transform ocorra
        setTimeout(() => {
            // Só esconde totalmente se a classe 'show' não tiver sido re-adicionada
            if (!menu.classList.contains('show')) {
                 menu.style.display = 'none'; // Desliga o display
            }
        }, 200); 
    }
    if (arrow) arrow.style.transform = 'rotate(0deg)';
}


// =================================================================
// 3. O SEGREDO: FECHAR JANELAS AO CLICAR FORA
// =================================================================

document.addEventListener('click', function(event) {
    // --- A. FECHAR MENU DE PERFIL ---
    const profileMenu = document.getElementById('sidebar-profile-dropdown');
    const profileCard = document.querySelector('.sidebar-profile-card');

    // Se o menu está aberto E o clique NÃO foi no menu E NEM no cartão de perfil
    if (profileMenu && profileMenu.classList.contains('show')) {
        if (!profileMenu.contains(event.target) && !profileCard.contains(event.target)) {
            closeProfileMenu();
        }
    }

    // --- B. FECHAR NOTIFICAÇÕES (SINO) ---
    const notifWindow = document.getElementById('alerts-floating-window');
    const bellIcon = document.getElementById('bell-icon');

    // Se a janela está visível
    if (notifWindow && notifWindow.style.display === 'block') {
        // Se o clique NÃO foi na janela E NEM no sino
        if (!notifWindow.contains(event.target) && !bellIcon.contains(event.target)) {
            notifWindow.style.display = 'none';
        }
    }
});

// =================================================================
// 5. SISTEMA DE MODAIS PERSONALIZADOS (Adeus Alert/Confirm)
// =================================================================

// --- SUBSTITUTO DO ALERT ---
window.customAlert = function(message, type = 'info') {
    const modal = document.getElementById('custom-alert');
    const title = document.getElementById('alert-title');
    const msg = document.getElementById('alert-message');
    const icon = document.getElementById('alert-icon');

    msg.textContent = message;
    modal.style.display = 'flex';

    // Configura ícone e cor baseada no tipo
    if (type === 'success') {
        icon.innerHTML = '<i class="fas fa-check-circle" style="color: var(--color-accent-green);"></i>';
        title.textContent = "Sucesso!";
    } else if (type === 'error') {
        icon.innerHTML = '<i class="fas fa-times-circle" style="color: var(--color-accent-red);"></i>';
        title.textContent = "Erro";
    } else {
        icon.innerHTML = '<i class="fas fa-info-circle" style="color: var(--color-accent-blue);"></i>';
        title.textContent = "Informação";
    }
}

window.closeCustomAlert = function() {
    document.getElementById('custom-alert').style.display = 'none';
}

// --- SUBSTITUTO DO CONFIRM ---
let confirmCallback = null;

window.customConfirm = function(message, callback) {
    const modal = document.getElementById('custom-confirm');
    const msg = document.getElementById('confirm-message');
    const btnYes = document.getElementById('btn-confirm-yes');

    msg.textContent = message;
    modal.style.display = 'flex';
    
    // Guarda a função que deve ser executada se ele clicar em SIM
    confirmCallback = callback;

    // Configura o botão SIM para executar a função guardada
    btnYes.onclick = function() {
        if (confirmCallback) confirmCallback();
        closeCustomConfirm();
    };
}

window.closeCustomConfirm = function() {
    document.getElementById('custom-confirm').style.display = 'none';
    confirmCallback = null;
}

function setupFormValidation() {
    // 1. Mapeia os campos que queremos validar
    const fields = [
        { id: 'nome', type: 'text', msg: 'O nome do produto é obrigatório.' },
        { id: 'preco', type: 'number', min: 0.01, msg: 'O preço deve ser maior que zero.' },
        { id: 'custo', type: 'number', min: 0, msg: 'O custo não pode ser negativo.' },
        { id: 'quantidade', type: 'number', min: 0, msg: 'O estoque não pode ser negativo.' },
        { id: 'minimo', type: 'number', min: 0, msg: 'O estoque mínimo não pode ser negativo.' }
    ];

    fields.forEach(field => {
        const input = document.getElementById(field.id);
        if (!input) return;

        // Cria a mensagem de erro no HTML dinamicamente (para não sujar seu index.html)
        let errorSpan = input.parentNode.querySelector('.error-message');
        if (!errorSpan) {
            errorSpan = document.createElement('div');
            errorSpan.className = 'error-message';
            errorSpan.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${field.msg}`;
            input.parentNode.appendChild(errorSpan);
        }

        // Função de validação individual
        const validate = () => {
            let isValid = true;
            const val = input.value.trim();

            if (field.type === 'text') {
                isValid = val.length > 0;
            } else if (field.type === 'number') {
                isValid = val !== '' && parseFloat(val) >= field.min;
            }

            // Aplica ou remove estilo de erro
            if (!isValid) {
                input.classList.add('input-error');
                errorSpan.style.display = 'block';
            } else {
                input.classList.remove('input-error');
                errorSpan.style.display = 'none';
            }
            
            return isValid;
        };

        // Ouve quando o usuário digita (input) ou sai do campo (blur)
        input.addEventListener('input', validate);
        input.addEventListener('blur', validate);
    });
}

window.importData = importData;

// =================================================================
// BLOCO DE INICIALIZAÇÃO FINAL E EXPOSIÇÃO GLOBAL
// =================================================================

// 1. Funções de Exposição Global (Obrigatório para o HTML)
window.openProfileSettings = openProfileSettings;
window.toggleSidebarProfileMenu = toggleSidebarProfileMenu;
window.renderProductTable = renderProductTable;
window.updateDashboardMetrics = updateDashboardMetrics;




window.exportData = exportData;
window.importData = importData;






window.viewSaleDetails = viewSaleDetails;
window.closeSaleDetails = closeSaleDetails;




window.filterPdvProducts = filterPdvProducts;


document.addEventListener("DOMContentLoaded", () => {
    // showLoadingState(); // REMOVIDO! Deixe o onAuthStateChanged cuidar disso.
    setupNavigation();
    if(typeof setupFormValidation === 'function') setupFormValidation();
    if(typeof renderHistoryLog === 'function') renderHistoryLog();
    if(typeof setupCartClientAutocomplete === 'function') setupCartClientAutocomplete();
});



// Expor para usar no console ou HTML

document.addEventListener("DOMContentLoaded", () => {
    const inputPreco = document.getElementById('preco');
    if(inputPreco) {
        inputPreco.addEventListener('input', window.calcularPrecoVenda);
    }
});

// =================================================================
// GESTÃO DE PARCEIROS (CLIENTES E FORNECEDORES)
// =================================================================

let clientesReais = [];
let fornecedoresReais = [];





// ============================================================
// MÓDULO ENTERPRISE: CRM & ANALYTICS
// (Variáveis globais já declaradas anteriormente, removidas daqui para não dar erro)
// ============================================================

// Função Principal de Carga
// Função Principal de Carga (CORRIGIDA)
async function loadPartnersData() {
    try {
        console.log("🔄 Carregando parceiros...");
        
        // Carrega dados do Firebase
        const [clientsSnap, suppSnap] = await Promise.all([
            getDocs(getUserCollectionRef("clients")),
            getDocs(getUserCollectionRef("suppliers"))
        ]);

        // Limpa e popula os arrays globais
        clientesReais = [];
        clientsSnap.forEach(doc => clientesReais.push({id: doc.id, ...doc.data()}));
        
        fornecedoresReais = [];
        suppSnap.forEach(doc => fornecedoresReais.push({id: doc.id, ...doc.data()}));

        console.log(`✅ ${clientesReais.length} Clientes e ${fornecedoresReais.length} Fornecedores carregados.`);

        // --- AQUI ESTAVA O ERRO (NOMES DIFERENTES) ---
        // Agora chamamos explicitamente as funções que definimos
        if(typeof renderClientsTable === 'function') {
            renderClientsTable(); 
        } else {
            console.error("❌ Função renderClientsTable não encontrada!");
        }

        if(typeof renderSuppliersTable === 'function') {
            renderSuppliersTable();
        }

        if(typeof updateProductSupplierDropdown === 'function') updateProductSupplierDropdown();
        
        // Atualiza os KPIs do topo
        if(typeof calcularInteligenciaCRM === 'function') calcularInteligenciaCRM();

    } catch (error) {
        console.error("Erro CRM:", error);
        showToast("Erro ao carregar parceiros.", "error");
    }
}

// 1. INTELIGÊNCIA: Calcula Concentração, Risco e Sazonalidade
function calcularInteligenciaCRM() {
    const stats = {};
    let totalFat = 0;
    
    salesHistory.forEach(s => {
        const cli = s.client || "Outros";
        if(cli === "Outros" || cli === "Consumidor Final") return;
        
        if(!stats[cli]) stats[cli] = { total: 0, ultima: 0 };
        stats[cli].total += parseFloat(s.total)||0;
        
        const d = parseDataSegura(s.timestamp || s.date);
        if(d > stats[cli].ultima) stats[cli].ultima = d;
        totalFat += parseFloat(s.total)||0;
    });

    const hoje = new Date();
    let ativos = 0;
    let recuperaveis = 0; // Clientes bons que pararam de comprar (60-120 dias)
    let perdidos = 0;

    Object.values(stats).forEach(c => {
        const dias = Math.floor((hoje - c.ultima) / (86400000));
        if (dias <= 60) ativos++;
        else if (dias <= 120) recuperaveis++;
        else perdidos++;
    });

    // ATUALIZA OS CARDS (Com texto que faz sentido)
    document.getElementById("crm-active-count").innerText = ativos; // Carteira Ativa
    
    // Ticket Médio REAL (Total / Qtd Vendas)
    const ticket = salesHistory.length > 0 ? totalFat / salesHistory.length : 0;
    document.getElementById("crm-ticket-avg").innerText = ticket.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});

    // Risco de Concentração (Quanto % os top 5 representam)
    const top5Total = Object.values(stats).sort((a,b)=>b.total-a.total).slice(0,5).reduce((acc,c)=>acc+c.total,0);
    const conc = totalFat > 0 ? (top5Total/totalFat)*100 : 0;
    
    document.getElementById("crm-concentration").innerText = conc.toFixed(0) + "%";
    document.getElementById("crm-concentration").parentElement.querySelector('small').innerText = "Dependência dos Top 5";

    // Churn agora vira "Oportunidade de Recuperação"
    const elChurn = document.getElementById("crm-churn-count");
    if(elChurn) {
        elChurn.innerText = recuperaveis;
        elChurn.parentElement.querySelector('.card-label').innerText = "Recuperáveis";
        elChurn.parentElement.querySelector('small').innerText = "Inativos (60-120d)";
    }

    // Radar com frases úteis
    const radar = document.getElementById("crm-radar-list");
    if(radar) {
        radar.innerHTML = "";
        radar.innerHTML += `<li style="padding:10px; border-bottom:1px dashed #333"><strong>${ativos} clientes ativos</strong> compraram recentemente.</li>`;
        
        if (recuperaveis > 0) {
            radar.innerHTML += `<li style="padding:10px; border-bottom:1px dashed #333; color:#FF9F0A">⚠️ <strong>${recuperaveis} clientes</strong> não compram há 2 meses. Ligue para eles!</li>`;
        }
        
        if (conc > 50) {
            radar.innerHTML += `<li style="padding:10px; color:#FF453A"><strong>Risco Alto:</strong> Sua empresa depende muito de poucos clientes (${conc.toFixed(0)}%).</li>`;
        } else {
            radar.innerHTML += `<li style="padding:10px; color:#30D158"><strong>Carteira Saudável:</strong> Vendas bem distribuídas.</li>`;
        }
    }
}
// 2. TABELA CLIENTES COM CURVA ABC
function renderClientsTableEnterprise() {
    const tbody = document.querySelector('#clientes-table tbody');
    if(!tbody) return;
    tbody.innerHTML = '';

    // 1. Processamento de Dados
    let clientesProcessados = clientesReais.map(c => {
        let total = 0;
        let ultimaData = null;
        
        // Somar vendas
        salesHistory.forEach(s => {
            if(s.client === c.nome) {
                total += parseFloat(s.total)||0;
                const d = parseDataSegura(s.timestamp || s.date);
                if(!ultimaData || d > ultimaData) ultimaData = d;
            }
        });

        // Verifica Aniversário (Próximos 7 dias)
        let isNiver = false;
        if(c.nascimento) {
            const hoje = new Date();
            const parts = c.nascimento.split('-'); // YYYY-MM-DD
            // Cria data no ano atual
            const niverEsteAno = new Date(hoje.getFullYear(), parseInt(parts[1])-1, parseInt(parts[2]));
            
            // Diferença em dias
            const diff = Math.ceil((niverEsteAno - hoje) / (1000 * 60 * 60 * 24));
            if(diff >= 0 && diff <= 7) isNiver = true;
        }

        return { ...c, total, ultimaData, isNiver };
    });

    // 2. ORDENAÇÃO (Aniversariantes PRIMEIRO, depois LTV)
    clientesProcessados.sort((a, b) => {
        if (a.isNiver && !b.isNiver) return -1; // A sobe
        if (!a.isNiver && b.isNiver) return 1;  // B sobe
        return b.total - a.total; // Desempate por quem gasta mais
    });

    // 3. RENDERIZAÇÃO
    if (clientesProcessados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#888;">Nenhum cliente cadastrado.</td></tr>';
        return;
    }

    clientesProcessados.forEach(c => {
        // Formata Data PT-BR
        const dataVisual = c.ultimaData ? c.ultimaData.toLocaleDateString('pt-BR') : "Sem compras";
        
        // Ícone de Aniversário (BOLO PISCANDO)
        let nomeDisplay = `<span style="font-weight:bold; color:var(--color-text-primary);">${c.nome}</span>`;
        
        if(c.isNiver) {
            // Ícone FontAwesome de Bolo em vez de Emoji
            nomeDisplay = `<span style="font-weight:bold; color:#FF4081; display:flex; align-items:center; gap:5px;">
                             <i class="fas fa-birthday-cake highlight"></i> ${c.nome}
                           </span>`;
        }

        // Badges de Status (Sem emojis)
        let status = '<span class="badge" style="background:#333; color:#aaa;">Novo</span>';
        if(c.total > 1000) status = '<span class="badge" style="background:rgba(10, 132, 255, 0.2); color:#0A84FF;"><i class="fas fa-check"></i> Ativo</span>';
        if(c.total > 5000) status = '<span class="badge" style="background:rgba(191, 90, 242, 0.2); color:#BF5AF2;"><i class="fas fa-crown"></i> VIP</span>';

        // Linha da Tabela
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${status}</td>
            <td>
                ${nomeDisplay}
                <small style="opacity:0.6; display:block; margin-top:2px;">${c.doc || 'CPF n/inf.'}</small>
            </td>
            <td style="color:var(--color-accent-green); font-weight:bold;">
                R$ ${c.total.toLocaleString('pt-BR', {minimumFractionDigits:2})}
            </td>
            <td style="font-size:0.9rem; color:#ccc;">${dataVisual}</td>
            <td>
                <div style="display:flex; gap:5px;">
                    <button class="action-btn view-btn" onclick="openEnterpriseCard('client', '${c.id}')" title="Ver Ficha">
                        <i class="fas fa-id-card"></i>
                    </button>
                    <button class="action-btn edit-btn" onclick="editClient('${c.id}')" title="Editar">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deletePartner('clients', '${c.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
    });
}

// 3. TABELA FORNECEDORES
function renderSuppliersTableEnterprise() {
    const tbody = document.querySelector('#fornecedores-table tbody');
    if(!tbody) return;
    tbody.innerHTML = '';

    fornecedoresReais.forEach(f => {
        const produtosDoFornecedor = products.filter(p => p.fornecedor === f.id);
        const qtdSkus = produtosDoFornecedor.length;
        const valorEstoque = produtosDoFornecedor.reduce((acc,p) => acc + (p.custo * p.quantidade), 0);

        let impacto = "Baixo";
        let corImpacto = "gray";
        if (valorEstoque > 10000) { impacto = "Alto"; corImpacto = "#FF453A"; }
        else if (valorEstoque > 2000) { impacto = "Médio"; corImpacto = "#FF9F0A"; }

        const row = tbody.insertRow();
        row.innerHTML = `
            <td><span style="color:${corImpacto}; font-weight:bold;">${impacto}</span></td>
            <td>
                <div style="font-weight:bold;">${f.nome}</div>
                <small style="opacity:0.6">${f.contato || '-'}</small>
            </td>
            <td>${qtdSkus} SKUs (R$ ${valorEstoque.toLocaleString('pt-BR', {minimumFractionDigits:0})})</td>
            <td>7 dias (Est.)</td>
            <td>
                <button class="action-btn view-btn" onclick="openEnterpriseCard('supplier', '${f.id}')"><i class="fas fa-id-card"></i></button>
                <button class="action-btn delete-btn" onclick="deletePartner('suppliers', '${f.id}')"><i class="fas fa-trash"></i></button>
            </td>
        `;
    });
}

// 4. MODAL FICHA COMPLETA
// ============================================================
// FICHA TÉCNICA (ATUALIZADA COM ENDEREÇO COMPLETO)
// ============================================================
window.openEnterpriseCard = function(type, id) {
    const modal = document.getElementById('partner-details-modal');
    const content = document.getElementById('partner-modal-content');
    if(!modal || !content) return;

    // Função auxiliar para montar o endereço visualmente
   const montarEndereco = (obj) => {
        // Se tiver os campos novos
        if (obj.rua || obj.cidade) {
            return `
                <div class="address-container">
                    <div class="addr-street">
                        <i class="fas fa-map-marker-alt"></i> 
                        ${obj.rua || ''}, ${obj.num || 'S/N'}
                    </div>
                    <div class="addr-city">
                        ${obj.bairro || ''} ${obj.bairro ? '•' : ''} ${obj.cidade || ''}/${obj.uf || ''}
                    </div>
                    <div class="addr-cep">
                        CEP: ${obj.cep || '-'}
                    </div>
                </div>
            `;
        }
        // Fallback para cadastro antigo
        return `<div class="address-container old">${obj.endereco || '-'}</div>`;
    };

    // ------------------------------------------
    // CENÁRIO 1: É UM CLIENTE
    // ------------------------------------------
    if (type === 'client') {
        // Converte ID para string para evitar erro de comparação
        const c = clientesReais.find(x => String(x.id) === String(id));
        if(!c) return showToast("Cliente não encontrado.", "error");

        // Cálculos Financeiros
        let total = 0, count = 0;
        let lastDate = null;
        let history = [];

        salesHistory.forEach(s => {
            if(s.client === c.nome) {
                total += parseFloat(s.total)||0;
                count++;
                const d = parseDataSegura(s.timestamp || s.date);
                if (!lastDate || d > lastDate) lastDate = d;
                history.push({d, val: s.total, items: (s.items||[]).length});
            }
        });

        // HTML DA FICHA DO CLIENTE
        content.innerHTML = `
            <div class="partner-detail-wrapper">
                <div class="partner-header-clean">
                    <div>
                        <h2 style="margin:0; color:var(--color-text-primary);">${c.nome}</h2>
                        <small style="color:#888;">ID: ${String(c.id).slice(-4)}</small>
                    </div>
                    <div style="text-align:right;">
                        <span class="badge" style="background:rgba(10, 132, 255, 0.1); color:#0A84FF;">${c.tipo || 'Cliente'}</span>
                        <div style="margin-top:5px; font-size:0.8rem; color:${c.statusManual === 'Bloqueado' ? '#FF453A' : '#30D158'}">
                            ${c.statusManual || 'Ativo'}
                        </div>
                    </div>
                </div>

                <div class="partner-info-grid">
                    <div class="info-block">
                        <h4 style="color:var(--color-accent-blue);">Dados Pessoais & Contato</h4>
                        <div class="info-row"><span>CPF/CNPJ</span> <span>${c.doc || '-'}</span></div>
                        <div class="info-row"><span>RG/IE</span> <span>${c.ie || '-'}</span></div>
                        <div class="info-row"><span>Nascimento</span> <span>${c.nascimento ? c.nascimento.split('-').reverse().join('/') : '-'}</span></div>
                        <div class="info-row"><span>Celular</span> <span>${c.tel || '-'}</span></div>
                        <div class="info-row"><span>E-mail</span> <span>${c.email || '-'}</span></div>
                        
                        <hr style="border:0; border-top:1px dashed #444; margin:10px 0;">
                        
                        <div class="info-row" style="align-items:flex-start;">
                            <span>Endereço</span> 
                            <span style="font-size:0.85rem; text-align:right;">${montarEndereco(c)}</span>
                        </div>
                        <div class="info-row"><span>Obs</span> <span style="font-size:0.8rem;">${c.obs || '-'}</span></div>
                    </div>

                    <div class="info-block">
                        <h4 style="color:var(--color-accent-green);">Performance</h4>
                        <div class="info-row"><span>LTV (Total)</span> <span style="color:#30D158; font-weight:bold;">R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                        <div class="info-row"><span>Compras</span> <span>${count}</span></div>
                        <div class="info-row"><span>Última Vez</span> <span>${lastDate ? lastDate.toLocaleDateString('pt-BR') : '-'}</span></div>
                        <div class="info-row"><span>Limite Crédito</span> <span>R$ ${parseFloat(c.limite||0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</span></div>
                        
                        <h4 style="margin-top:15px; color:#fff;">Últimas Compras</h4>
                        <ul class="timeline-clean" style="list-style:none; padding:0; margin:0; max-height:150px; overflow-y:auto;">
                            ${history.sort((a,b)=>b.d-a.d).slice(0,5).map(h => `
                                <li>
                                    <div style="font-size:0.8rem; color:#888;">${h.d ? h.d.toLocaleDateString() : '-'}</div>
                                    <div style="color:#fff;">Compra de <strong>R$ ${parseFloat(h.val).toFixed(2)}</strong></div>
                                </li>
                            `).join('') || '<li style="color:#666; font-size:0.8rem; padding:10px 0;">Nenhuma compra registrada.</li>'}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    } 
    // ------------------------------------------
    // CENÁRIO 2: É UM FORNECEDOR (AGORA COM ENDEREÇO COMPLETO)
    // ------------------------------------------
    else if (type === 'supplier') {
        const f = fornecedoresReais.find(x => String(x.id) === String(id));
        if(!f) return showToast("Fornecedor não encontrado.", "error");

        const produtosVinculados = products.filter(p => p.fornecedor === f.id);

        // HTML DA FICHA DO FORNECEDOR
        content.innerHTML = `
            <div class="partner-detail-wrapper">
                <div class="partner-header-clean">
                    <div>
                        <h2 style="margin:0; color:var(--color-text-primary);">${f.nome}</h2>
                        <div style="font-size:0.9rem; color:#aaa;">${f.fantasia || ''}</div>
                    </div>
                    <div style="text-align:right;">
                        <span class="badge" style="background:rgba(255, 159, 10, 0.1); color:#FF9F0A;">Fornecedor</span>
                        <div style="margin-top:5px; font-size:0.8rem; color:#aaa;">ID: ${String(f.id).slice(-4)}</div>
                    </div>
                </div>

                <div class="partner-info-grid">
                    <div class="info-block">
                        <h4 style="color:var(--color-accent-purple);">Dados Cadastrais</h4>
                        <div class="info-row"><span>CNPJ</span> <span>${f.cnpj || '-'}</span></div>
                        <div class="info-row"><span>Inscr. Est.</span> <span>${f.ie || '-'}</span></div>
                        <div class="info-row"><span>Vendedor</span> <span>${f.contatoNome || '-'}</span></div>
                        <div class="info-row"><span>Telefone</span> <span>${f.tel || '-'}</span></div>
                        <div class="info-row"><span>Celular</span> <span>${f.cel || '-'}</span></div>
                        <div class="info-row"><span>E-mail</span> <span>${f.email || '-'}</span></div>
                        <div class="info-row"><span>Prazo Pag.</span> <span>${f.prazo ? f.prazo + ' dias' : '-'}</span></div>

                        <hr style="border:0; border-top:1px dashed #444; margin:10px 0;">

                        <div class="info-row" style="align-items:flex-start;">
                            <span>Endereço</span> 
                            <span style="font-size:0.85rem; text-align:right;">${montarEndereco(f)}</span>
                        </div>
                    </div>

                    <div class="info-block">
                        <h4 style="color:var(--color-accent-purple);">Catálogo de Produtos (${produtosVinculados.length})</h4>
                        <div style="max-height:300px; overflow-y:auto; padding-right:5px;">
                            ${produtosVinculados.length > 0 ? produtosVinculados.map(p => `
                                <div style="padding:8px; background:rgba(255,255,255,0.03); border-radius:4px; margin-bottom:5px; border-left:2px solid var(--color-accent-purple);">
                                    <div style="font-weight:bold; font-size:0.9rem;">${p.nome}</div>
                                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:#aaa; margin-top:2px;">
                                        <span>Estoque: ${p.quantidade}</span>
                                        <span>Custo: R$ ${parseFloat(p.custo||0).toFixed(2)}</span>
                                    </div>
                                </div>
                            `).join('') : '<div style="color:#666; font-style:italic; padding:10px;">Nenhum produto vinculado a este fornecedor.</div>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    modal.style.display = 'flex';
}


window.abrirMuralAniversarios = function() {
    // Define o mês atual no select por padrão
    const mesAtual = new Date().getMonth();
    document.getElementById('filtro-mes-niver').value = mesAtual;
    
    renderizarMuralAniversarios();
    document.getElementById('modal-mural-aniversarios').style.display = 'flex';
}

window.renderizarMuralAniversarios = function() {
    const container = document.getElementById('grid-aniversariantes');
    const filtroMes = document.getElementById('filtro-mes-niver').value;
    
    if(!container) return;
    container.innerHTML = '';

    const meses = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    
    let lista = clientesReais.filter(c => c.nascimento);

    if (filtroMes !== "todos") {
        lista = lista.filter(c => (parseInt(c.nascimento.split('-')[1]) - 1) == filtroMes);
    }

    // Ordena por Mês e Dia
    lista.sort((a, b) => {
        const dateA = a.nascimento.split('-');
        const dateB = b.nascimento.split('-');
        if (dateA[1] !== dateB[1]) return dateA[1] - dateB[1];
        return dateA[2] - dateB[2];
    });

    if (lista.length === 0) {
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:#666;">Nenhum aniversariante encontrado.</div>`;
        return;
    }

    lista.forEach(c => {
        const parts = c.nascimento.split('-');
        const dia = parts[2];
        const mesIdx = parseInt(parts[1]) - 1;
        const hoje = new Date();
        const isHoje = (hoje.getDate() == dia && hoje.getMonth() == mesIdx);

        const card = document.createElement('div');
        card.className = `birthday-card ${isHoje ? 'is-today' : ''}`;
        
        card.innerHTML = `
            <div class="b-month">${meses[mesIdx]}</div>
            <div class="b-day-big">${dia}</div>
            <div class="b-name" title="${c.nome}">${c.nome.split(' ')[0]} ${c.nome.split(' ')[1]?c.nome.split(' ')[1][0]+'.':''}</div>
            ${isHoje ? '<div style="position:absolute; top:5px; right:5px; width:8px; height:8px; background:#FF4081; border-radius:50%;"></div>' : ''}
        `;
        container.appendChild(card);
    });
}

// Abre o modal e carrega os produtos
window.abrirModalEtiquetas = function() {
    const modal = document.getElementById('label-modal');
    const tbody = document.querySelector('#label-selection-table tbody');
    
    if(!modal || !tbody) return;
    
    tbody.innerHTML = '';
    
    // Ordena alfabeticamente
    const produtosOrdenados = [...products].sort((a, b) => a.nome.localeCompare(b.nome));

    produtosOrdenados.forEach(p => {
        const tr = document.createElement('tr');
        // Checkbox marcado por padrão se tiver estoque positivo
        const checked = p.quantidade > 0 ? 'checked' : '';
        // Quantidade padrão = 1 (ou o estoque atual, se preferir mude value="${p.quantidade}")
        const qtdPadrao = 1; 

        tr.innerHTML = `
            <td style="text-align:center;">
                <input type="checkbox" class="label-check" data-id="${p.id}" ${checked}>
            </td>
            <td>
                <span style="font-weight:bold; color:var(--color-text-primary);">${p.nome}</span><br>
                <small style="opacity:0.7;">${p.codigoBarras || 'S/ EAN'} | R$ ${parseFloat(p.preco).toFixed(2)}</small>
            </td>
            <td>
                <input type="number" class="label-qty" min="1" value="${qtdPadrao}" 
                       style="width: 70px; padding: 5px; text-align: center; border-radius: 4px; border: 1px solid #555; background: #333; color: white;">
            </td>
        `;
        tbody.appendChild(tr);
    });

    modal.style.display = 'flex';
}

// Filtro de busca dentro do modal
window.filtrarListaEtiquetas = function() {
    const termo = document.getElementById('label-search').value.toLowerCase();
    const linhas = document.querySelectorAll('#label-selection-table tbody tr');

    linhas.forEach(tr => {
        const texto = tr.innerText.toLowerCase();
        tr.style.display = texto.includes(termo) ? '' : 'none';
    });
}

// Checkbox "Selecionar Todos"
window.toggleTodasEtiquetas = function(source) {
    const checkboxes = document.querySelectorAll('.label-check');
    checkboxes.forEach(cb => {
        // Só marca se a linha estiver visível (respeita o filtro)
        if(cb.closest('tr').style.display !== 'none') {
            cb.checked = source.checked;
        }
    });
}

window.gerarPDFEtiquetasSelecionadas = function() {
    const { jsPDF } = window.jspdf;
    
    // 1. Coletar dados selecionados
    const itensParaImprimir = [];
    const rows = document.querySelectorAll('#label-selection-table tbody tr');

    rows.forEach(tr => {
        const checkbox = tr.querySelector('.label-check');
        const qtyInput = tr.querySelector('.label-qty');
        
        if (checkbox && checkbox.checked) {
            const produtoId = checkbox.dataset.id;
            const produto = products.find(p => p.id === produtoId || p._id === produtoId);
            const quantidade = parseInt(qtyInput.value) || 1;

            if (produto && quantidade > 0) {
                // Adiciona o produto X vezes na lista de impressão
                for(let i=0; i<quantidade; i++) {
                    itensParaImprimir.push(produto);
                }
            }
        }
    });

    if (itensParaImprimir.length === 0) {
        showToast("Selecione pelo menos um produto.", "info");
        return;
    }

    // 2. Configuração do Papel
    const tipoPapel = document.getElementById('label-size').value; // 'thermal' ou 'a4'
    let doc;

    if (tipoPapel === 'thermal') {
        // --- MODO IMPRESSORA TÉRMICA (80mm) ---
        // Cria um PDF onde cada página é uma etiqueta (ex: 60mm largura x 40mm altura)
        // Isso faz a impressora cuspir uma etiqueta, cortar (se tiver cutter) e imprimir a próxima.
        doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: [60, 40] // Tamanho da etiqueta (Ajuste conforme sua impressora)
        });

        itensParaImprimir.forEach((p, index) => {
            if (index > 0) doc.addPage(); // Nova página para cada etiqueta

            // Desenho da Etiqueta
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            // Nome (Quebra de linha se for longo)
            const splitTitle = doc.splitTextToSize(p.nome, 55); 
            doc.text(splitTitle, 30, 5, { align: "center" });

            // Preço
            doc.setFontSize(14);
            doc.text(`R$ ${parseFloat(p.preco).toFixed(2)}`, 30, 14, { align: "center" });

            // Código de Barras
            try {
                const canvas = document.createElement("canvas");
                JsBarcode(canvas, p.codigoBarras || p.id.slice(0, 8), {
                    format: "CODE128",
                    width: 2,
                    height: 40,
                    displayValue: true,
                    fontSize: 10,
                    margin: 0
                });
                const imgData = canvas.toDataURL("image/jpeg");
                // Centraliza imagem (x=5, largura=50)
                doc.addImage(imgData, 'JPEG', 5, 16, 50, 18);
            } catch (e) {
                doc.setFontSize(8);
                doc.text(p.codigoBarras || "CODIGO ERRO", 30, 30, { align: "center" });
            }
        });

    } else {
        // --- MODO A4 (PIMACO 3 Colunas) ---
        // (Usa a lógica antiga de grade)
        doc = new jsPDF();
        let x = 10, y = 10, col = 0;
        const labelW = 60, labelH = 35, gap = 5;

        itensParaImprimir.forEach((p) => {
            doc.rect(x, y, labelW, labelH); // Borda
            
            doc.setFontSize(8);
            doc.text(p.nome.substring(0, 25), x + 2, y + 5);
            
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text(`R$ ${parseFloat(p.preco).toFixed(2)}`, x + 2, y + 10);

            try {
                const canvas = document.createElement("canvas");
                JsBarcode(canvas, p.codigoBarras || p.id.slice(0, 8), {
                    format: "CODE128", width: 1.5, height: 30, displayValue: true, fontSize: 10, margin: 0
                });
                doc.addImage(canvas.toDataURL("image/jpeg"), 'JPEG', x + 2, y + 12, 50, 15);
            } catch (e) {}

            col++; x += labelW + gap;
            if (col >= 3) { col = 0; x = 10; y += labelH + gap; }
            if (y + labelH > 280) { doc.addPage(); y = 10; col = 0; x = 10; }
        });
    }

    doc.save("Etiquetas_Print.pdf");
    document.getElementById('label-modal').style.display = 'none';
}

// ============================================================
// IMPORTAÇÃO DE XML (NÍVEL CONTÁBIL - CORRIGIDO E ROBUSTO)
// ============================================================
window.processarXMLNota = async function(input) {
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    window.showLoadingScreen("Lendo XML Fiscal...", "Calculando custos e fretes...");

    reader.onload = async function(e) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(e.target.result, "text/xml");

            // --- 1. CABEÇALHO ---
            const getTag = (parent, tag) => parent ? parent.getElementsByTagName(tag)[0] : null;
            const getVal = (parent, tag) => {
                const el = getTag(parent, tag);
                return el ? el.textContent : "";
            };

            const ide = getTag(xmlDoc, "ide");
            const emit = getTag(xmlDoc, "emit");
            const total = getTag(xmlDoc, "total");
            const infNFe = getTag(xmlDoc, "infNFe");
            const infProt = getTag(xmlDoc, "infProt");

            if (!emit) throw new Error("XML inválido: Emitente não encontrado.");

            const nNF = getVal(ide, "nNF");
            const serie = getVal(ide, "serie");
            const cnpjFornecedor = getVal(emit, "CNPJ");
            
            // === 🔒 BLOQUEIO DE DUPLICIDADE ===
            const duplicada = inputHistory.find(n => String(n.numero) === String(nNF) && String(n.cnpj) === String(cnpjFornecedor));
            
            if (duplicada) {
                window.hideLoadingScreen();
                input.value = ""; 
                customAlert(`⛔ IMPORTAÇÃO BLOQUEADA\n\nA Nota Fiscal nº ${nNF} já consta no sistema.`, "error");
                return; 
            }

            const natOp = getVal(ide, "natOp");
            const dhEmi = getVal(ide, "dhEmi") || new Date().toISOString();
            let chaveAcesso = infNFe ? infNFe.getAttribute("Id") : "";
            if (chaveAcesso) chaveAcesso = chaveAcesso.replace("NFe", "");
            const nProt = infProt ? getVal(infProt, "nProt") : "";

            // Dados do Fornecedor
            const nomeFornecedor = getVal(emit, "xNome");
            const ieFornecedor = getVal(emit, "IE");
            
            const enderEmit = getTag(emit, "enderEmit");
            let enderecoCompleto = "";
            let enderecoObj = {};

            if (enderEmit) {
                enderecoObj = {
                    rua: getVal(enderEmit, "xLgr"),
                    num: getVal(enderEmit, "nro"),
                    bairro: getVal(enderEmit, "xBairro"),
                    cidade: getVal(enderEmit, "xMun"),
                    uf: getVal(enderEmit, "UF"),
                    cep: getVal(enderEmit, "CEP")
                };
                enderecoCompleto = `${enderecoObj.rua}, ${enderecoObj.num} - ${enderecoObj.bairro}, ${enderecoObj.cidade}/${enderecoObj.uf}`;
            }

            // Totais da Nota
            let vNF=0, vBC=0, vICMS=0, vST=0, vProd=0, vIPI=0;
            if (total) {
                const icmsTot = getTag(total, "ICMSTot");
                if(icmsTot) {
                    vNF = parseFloat(getVal(icmsTot, "vNF")) || 0;
                    vBC = parseFloat(getVal(icmsTot, "vBC")) || 0;
                    vICMS = parseFloat(getVal(icmsTot, "vICMS")) || 0;
                    vST = parseFloat(getVal(icmsTot, "vST")) || 0;
                    vProd = parseFloat(getVal(icmsTot, "vProd")) || 0;
                    vIPI = parseFloat(getVal(icmsTot, "vIPI")) || 0;
                }
            }

            // Garante Fornecedor
            let fornecedorId = await garantirFornecedor(nomeFornecedor, cnpjFornecedor, ieFornecedor, enderecoObj);

            // --- 2. ITENS ---
            const dets = xmlDoc.getElementsByTagName("det");
            let itensNota = [];
            let somaCalculada = 0;

            window.updateLoadingMessage("Processando Itens...", `Lendo ${dets.length} produtos...`);

            for (let i = 0; i < dets.length; i++) {
                const prod = getTag(dets[i], "prod");
                const imposto = getTag(dets[i], "imposto");

                const cProd = getVal(prod, "cProd");
                const cEAN = getVal(prod, "cEAN");
                const xProd = getVal(prod, "xProd");
                const NCM = getVal(prod, "NCM");
                const CFOP = getVal(prod, "CFOP");
                const uCom = getVal(prod, "uCom");
                
                const qCom = parseFloat(getVal(prod, "qCom")); // Quantidade
                const vUnCom = parseFloat(getVal(prod, "vUnCom")); // Valor Unitário (CUSTO DO PRODUTO)
                const vProdItem = parseFloat(getVal(prod, "vProd")); // Valor Total do Item
                
                // === 🚚 CÁLCULO DO FRETE DO ITEM ===
                // Pega o frete total deste item específico
                const vFreteItemTotal = parseFloat(getVal(prod, "vFrete")) || 0;
                
                // Divide pela quantidade para saber o frete unitário
                // Ex: Frete R$ 10,00 para 10 itens = R$ 1,00 de frete por unidade
                const freteUnitario = qCom > 0 ? (vFreteItemTotal / qCom) : 0;
                // ===================================

                somaCalculada += vProdItem;

                // Impostos
                let vICMSItem = 0, pICMSItem = 0, vBCItem = 0, CST = "";
                let vIPIItem = 0, pIPIItem = 0;

                if (imposto) {
                    const icmsContainer = getTag(imposto, "ICMS");
                    if (icmsContainer && icmsContainer.children.length > 0) {
                        const tagICMS = icmsContainer.children[0];
                        CST = getVal(tagICMS, "CST") || getVal(tagICMS, "CSOSN");
                        vBCItem = parseFloat(getVal(tagICMS, "vBC")) || 0;
                        pICMSItem = parseFloat(getVal(tagICMS, "pICMS")) || 0;
                        vICMSItem = parseFloat(getVal(tagICMS, "vICMS")) || 0;
                    }
                    const ipiContainer = getTag(imposto, "IPI");
                    if (ipiContainer) {
                        const ipiTrib = getTag(ipiContainer, "IPITrib");
                        if (ipiTrib) {
                            vIPIItem = parseFloat(getVal(ipiTrib, "vIPI")) || 0;
                            pIPIItem = parseFloat(getVal(ipiTrib, "pIPI")) || 0;
                        }
                    }
                }

                itensNota.push({
                    cProd, ean: cEAN, nome: xProd, ncm: NCM, cfop: CFOP, cst: CST,
                    un: uCom, qtd: qCom, valorUnit: vUnCom, total: vProdItem,
                    vBC: vBCItem, pICMS: pICMSItem, vICMS: vICMSItem, vIPI: vIPIItem, pIPI: pIPIItem,
                    vFrete: vFreteItemTotal // Guarda o frete total no histórico da nota
                });

                // ATUALIZA ESTOQUE NO BANCO
                let produtoExistente = null;
                // 1. Tenta por Código de Barras
                if (cEAN && cEAN !== "SEM GTIN" && cEAN.trim() !== "") {
                    produtoExistente = products.find(p => p.codigoBarras === cEAN);
                }
                // 2. Tenta por Nome
                if (!produtoExistente) {
                    produtoExistente = products.find(p => p.nome.toLowerCase().trim() === xProd.toLowerCase().trim());
                }

                if (produtoExistente) {
                    const novaQtd = (parseInt(produtoExistente.quantidade) || 0) + parseInt(qCom);
                    await updateDoc(getUserDocumentRef("products", produtoExistente.id), {
                        quantidade: novaQtd,
                        custo: vUnCom, // Atualiza Custo Unitário
                        frete: freteUnitario, // 🟢 ATUALIZA O FRETE UNITÁRIO (Frete / Outros)
                        fornecedor: fornecedorId,
                        cProd: cProd
                    });
                } else {
                    const novoProduto = {
                        nome: xProd, cProd: cProd,
                        codigoBarras: (cEAN && cEAN !== "SEM GTIN") ? cEAN : "",
                        categoria: "Geral", 
                        estabelecimento: (config.establishments ? config.establishments[0] : "Matriz"),
                        fornecedor: fornecedorId,
                        quantidade: parseInt(qCom), minimo: 1,
                        custo: vUnCom, // Custo Unitário
                        frete: freteUnitario, // 🟢 FRETE UNITÁRIO INICIAL
                        markup: 2.0, preco: (vUnCom + freteUnitario) * 2.0, // Preço sugere custo + frete
                        autoMarkup: true, imagem: ""
                    };
                    await addDoc(getUserCollectionRef("products"), novoProduto);
                }
            }

            if (vNF === 0) vNF = somaCalculada;

            // SALVA A NOTA NO HISTÓRICO
            const notaFiscalData = {
                numero: nNF, serie, natOp, chNFe: chaveAcesso, nProt,
                dataEmissao: dhEmi, fornecedor: nomeFornecedor,
                cnpj: cnpjFornecedor, ie: ieFornecedor, endereco: enderecoCompleto,
                valorTotal: vNF, vBC, vICMS, vST, vIPI,
                items: itensNota, timestamp: new Date().toISOString()
            };

            await addDoc(getUserCollectionRef("input_invoices"), notaFiscalData);
            
            // 📝 LOG DE AÇÃO
            await logSystemAction("Importação XML", `Nota Fiscal Nº ${nNF} importada. Fornecedor: ${nomeFornecedor}. Total: R$ ${vNF.toFixed(2)}`);

            window.hideLoadingScreen();
            showToast(`Sucesso! Nota ${nNF} importada e fretes calculados.`, "success");
            input.value = "";
            await loadAllData();

        } catch (error) {
            console.error(error);
            window.hideLoadingScreen();
            showToast("Erro ao processar XML: " + error.message, "error");
        }
    };
    reader.readAsText(file);
};

// Função auxiliar para pegar valor de tag XML com segurança
function getTagValue(parent, tagName) {
    const el = parent.getElementsByTagName(tagName)[0];
    return el ? el.textContent : "";
}

// ============================================================
// FUNÇÃO GARANTIR FORNECEDOR (AGORA SALVA IE E ENDEREÇO DO XML)
// ============================================================
async function garantirFornecedor(nome, cnpj, ie = "", enderecoObj = {}) {
    // 1. Procura na memória se já existe
    let fornecedor = fornecedoresReais.find(f => f.cnpj === cnpj || f.nome === nome);
    const user = auth.currentUser;
    if (!user) throw new Error("Usuário não autenticado.");

    // Mapeia o objeto de endereço de volta para a ficha do fornecedor
    const dadosEnderecoParaSalvar = {
        ie: ie,
        rua: enderecoObj.rua || '',
        num: enderecoObj.num || '',
        bairro: enderecoObj.bairro || '',
        cidade: enderecoObj.cidade || '',
        uf: enderecoObj.uf || '',
        cep: enderecoObj.cep || '',
    };

    if (fornecedor) {
        const fornecedorRef = getUserDocumentRef("suppliers", fornecedor.id);
        
        // 2. Se o fornecedor existe, verifica se precisa preencher os campos vazios (IE/Endereço)
        // Usamos a lógica: se faltar a rua E o XML tiver a rua, atualiza!
        if (!fornecedor.rua && dadosEnderecoParaSalvar.rua) {
            
            await updateDoc(fornecedorRef, {
                // Atualiza IE e Endereço com os dados do XML
                ...dadosEnderecoParaSalvar, 
                lastUpdate: new Date().toISOString()
            });
            
            // Atualiza a lista local (fornecedoresReais) imediatamente para uso futuro
            fornecedoresReais = fornecedoresReais.map(f => f.id === fornecedor.id ? {...f, ...dadosEnderecoParaSalvar} : f);
        }
        
        return fornecedor.id; // Retorna ID existente
    }

    // 3. Se não existe, cria um novo com todos os detalhes fiscais
    const novoForn = {
        nome: nome,
        cnpj: cnpj,
        contatoNome: "Importado XML",
        tel: "N/I",
        ...dadosEnderecoParaSalvar, // Inclui todos os campos (IE, Rua, etc)
        timestamp: new Date().toISOString()
    };

    const docRef = await addDoc(getUserCollectionRef("suppliers"), novoForn);
    
    // Atualiza a lista local
    fornecedoresReais.push({ id: docRef.id, ...novoForn });
    
    return docRef.id;
}

// MÓDULO FINANCEIRO AVANÇADO (Fase 6)
// ============================================================

let expensesData = []; 

// Função Principal: Carrega tudo quando abre a aba
async function loadFinancialDashboard() {
    // 1. Garante que temos dados atualizados
    const expenses = await getExpensesData(); // Precisamos buscar despesas
    const sales = salesHistory; // Já temos as vendas globais

    // 2. Define o período (Padrão: Mês Atual)
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);

    // 3. Calcula DRE
    calculateDRE(sales, expenses, inicioMes, fimMes);

    // 4. Calcula ABC (Usa todas as vendas para melhor precisão histórica)
    calculateABC(sales);

    // 5. Prepara Simulação
    runSimulation(); // Roda com valores padrão
}

// Função Auxiliar para formatar dinheiro nos cards
function updateFinancialCard(elementId, value) {
    const el = document.getElementById(elementId);
    if(el) el.innerText = value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function getExpensesData() {
    if(typeof expensesData !== 'undefined' && expensesData.length > 0) return expensesData;
    
    // Se não tiver em cache, busca (reutilizando sua lógica existente se houver, ou buscando direto)
    try {
        const q = query(getUserCollectionRef("expenses"), orderBy("data", "desc"));
        const snap = await getDocs(q);
        const data = [];
        snap.forEach(d => data.push({id: d.id, ...d.data()}));
        // Atualiza a variável global
        expensesData = data; 
        renderExpensesTable(); // Já atualiza a tabela da aba 2
        return data;
    } catch(e) {
        console.error(e);
        return [];
    }
}

function calculateDRE(sales, expenses, start, end) {
    // A. RECEITA BRUTA (Total das Vendas no Período)
    const vendasPeriodo = sales.filter(s => {
        const d = parseDataSegura(s.timestamp || s.date);
        return d >= start && d <= end;
    });
    
    const receitaBruta = vendasPeriodo.reduce((acc, s) => acc + (parseFloat(s.total)||0), 0);

    // B. CUSTOS VARIÁVEIS (CMV - Custo da Mercadoria Vendida)
    let cmv = 0;
    vendasPeriodo.forEach(s => {
        if(s.items) {
            s.items.forEach(i => {
                // Tenta pegar custo histórico do item, ou busca no produto atual
                let custoItem = parseFloat(i.custo) || 0;
                if(custoItem === 0) {
                    const prod = products.find(p => (p.id == i.id || p._id == i.id));
                    if(prod) custoItem = parseFloat(prod.custo) || 0;
                }
                cmv += custoItem * (i.quantity || 1);
            });
        }
    });

    // C. LUCRO BRUTO
    const lucroBruto = receitaBruta - cmv;

    // D. DESPESAS OPERACIONAIS (Do módulo de lançamentos)
    const despesasPeriodo = expenses.filter(e => {
        const d = new Date(e.data + "T12:00:00");
        return d >= start && d <= end;
    });
    const totalDespesas = despesasPeriodo.reduce((acc, e) => acc + (parseFloat(e.valor)||0), 0);

    // E. LUCRO LÍQUIDO
    const lucroLiquido = lucroBruto - totalDespesas;
    const margemLiquida = receitaBruta > 0 ? ((lucroLiquido / receitaBruta) * 100) : 0;

    // --- RENDERIZAÇÃO NA TABELA DRE ---
    const tbody = document.getElementById("dre-tbody");
    if(tbody) {
        tbody.innerHTML = `
            <tr style="background: rgba(10, 132, 255, 0.1);">
                <td><strong>(+) RECEITA BRUTA</strong></td>
                <td style="text-align:right; color:var(--color-accent-blue);">R$ ${receitaBruta.toFixed(2)}</td>
                <td style="text-align:right">100%</td>
            </tr>
            <tr>
                <td>(-) Custos Variáveis (CMV)</td>
                <td style="text-align:right; color:#ff453a;">- R$ ${cmv.toFixed(2)}</td>
                <td style="text-align:right; color:#888;">${receitaBruta ? ((cmv/receitaBruta)*100).toFixed(1) : 0}%</td>
            </tr>
            <tr style="border-top: 1px dashed #555;">
                <td><strong>(=) LUCRO BRUTO</strong></td>
                <td style="text-align:right; font-weight:bold;">R$ ${lucroBruto.toFixed(2)}</td>
                <td style="text-align:right">${receitaBruta ? ((lucroBruto/receitaBruta)*100).toFixed(1) : 0}%</td>
            </tr>
            <tr>
                <td>(-) Despesas Operacionais</td>
                <td style="text-align:right; color:#ff453a;">- R$ ${totalDespesas.toFixed(2)}</td>
                <td style="text-align:right; color:#888;">${receitaBruta ? ((totalDespesas/receitaBruta)*100).toFixed(1) : 0}%</td>
            </tr>
            <tr style="background: ${lucroLiquido >= 0 ? 'rgba(48, 209, 88, 0.2)' : 'rgba(255, 69, 58, 0.2)'}; font-size: 1.2rem; border-top: 2px solid #fff;">
                <td><strong>(=) LUCRO LÍQUIDO</strong></td>
                <td style="text-align:right; font-weight:bold; color:${lucroLiquido >= 0 ? 'var(--color-accent-green)' : '#ff453a'};">R$ ${lucroLiquido.toFixed(2)}</td>
                <td style="text-align:right; font-weight:bold;">${margemLiquida.toFixed(1)}%</td>
            </tr>
        `;
    }

    // Atualiza Cards do Topo
    document.getElementById("dre-receita").innerText = receitaBruta.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
    document.getElementById("dre-custos").innerText = (cmv + totalDespesas).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
    document.getElementById("dre-lucro").innerText = lucroLiquido.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
    document.getElementById("dre-margem").innerText = margemLiquida.toFixed(1) + "%";
    
    // Salva dados globais para uso no simulador
    window.financeData = { receitaBruta, cmv, totalDespesas, lucroLiquido };
}

function calculateABC(sales) {
    // 1. Agrupar vendas por produto
    const produtoFaturamento = {};
    let faturamentoTotal = 0;

    sales.forEach(s => {
        if(s.items) s.items.forEach(i => {
            const val = i.preco * i.quantity;
            const nome = i.nome;
            if(!produtoFaturamento[nome]) produtoFaturamento[nome] = 0;
            produtoFaturamento[nome] += val;
            faturamentoTotal += val;
        });
    });

    // 2. Ordenar decrescente
    const lista = Object.entries(produtoFaturamento)
        .map(([nome, valor]) => ({ nome, valor }))
        .sort((a, b) => b.valor - a.valor);

    // 3. Classificar A, B, C
    let acumulado = 0;
    const tbody = document.getElementById("abc-tbody");
    if(!tbody) return;
    tbody.innerHTML = "";

    lista.forEach(p => {
        acumulado += p.valor;
        const pctAcumulado = (acumulado / faturamentoTotal) * 100;
        let classe = 'C';
        let cor = 'gray';

        if (pctAcumulado <= 80) { classe = 'A'; cor = 'var(--color-accent-green)'; }
        else if (pctAcumulado <= 95) { classe = 'B'; cor = 'var(--color-accent-blue)'; }

        // Renderiza apenas os top 50 para não travar, ou se for Classe A
        if (classe === 'A' || lista.indexOf(p) < 20) {
            tbody.innerHTML += `
                <tr>
                    <td><span class="badge" style="background:${cor}; color:#fff; width:30px; justify-content:center; display:flex;">${classe}</span></td>
                    <td>${p.nome}</td>
                    <td>R$ ${p.valor.toFixed(2)}</td>
                    <td>${pctAcumulado.toFixed(1)}%</td>
                </tr>
            `;
        }
    });
}

function runSimulation() {
    if(!window.financeData) return;

    const base = window.financeData;
    const fatorVendas = 1 + (parseFloat(document.getElementById('sim-vendas-pct').value) / 100);
    const fatorCustos = 1 - (parseFloat(document.getElementById('sim-custos-pct').value) / 100);

    // Simulação:
    // Receita sobe X%
    // CMV sobe X% (Custo variável acompanha venda)
    // Despesas fixas caem Y%
    
    const novaReceita = base.receitaBruta * fatorVendas;
    const novoCMV = base.cmv * fatorVendas; // Assume custo proporcional
    const novasDespesas = base.totalDespesas * fatorCustos;
    
    const novoLucro = novaReceita - novoCMV - novasDespesas;
    
    const el = document.getElementById('sim-resultado');
    if(el) {
        el.innerText = novoLucro.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        el.style.color = novoLucro >= 0 ? 'var(--color-accent-green)' : '#ff453a';
    }
}

// Expõe globalmente
window.loadFinancialDashboard = loadFinancialDashboard;
window.runSimulation = runSimulation;

// Renderiza a Tabela (Histórico)
// Função de Renderização de Despesas (CORRIGIDA)
window.renderExpensesTable = function(dataOverride = null) {
    // 1. Decide qual lista usar: O Filtro (se existir) ou Tudo (padrão)
    const listaParaExibir = dataOverride || expensesData; 
    
    const tbody = document.querySelector("#expenses-table tbody");
    if(!tbody) return;
    
    tbody.innerHTML = "";

    // Verifica se a lista está vazia
    if (!listaParaExibir || listaParaExibir.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#888;">Nenhuma despesa encontrada.</td></tr>`;
        return;
    }

    // Ordena por data (mais recente primeiro)
    const listaOrdenada = [...listaParaExibir].sort((a, b) => {
        // Tenta ordenar, tratando strings e objetos de data
        const dateA = new Date(a.data || a.timestamp);
        const dateB = new Date(b.data || b.timestamp);
        return dateB - dateA;
    });

    // 🚨 O ERRO ESTAVA AQUI: Agora usamos 'listaOrdenada' (o filtro), e não 'expensesData' (o global)
    listaOrdenada.forEach((item) => {
        const row = tbody.insertRow();
        
        // Formata data visualmente (YYYY-MM-DD -> DD/MM/AAAA)
        let dataVisual = item.data;
        if(item.data && item.data.includes('-')) {
            const p = item.data.split('-');
            dataVisual = `${p[2]}/${p[1]}/${p[0]}`;
        } else if (item.timestamp) {
            dataVisual = new Date(item.timestamp).toLocaleDateString("pt-BR");
        }
        
        // Ícone por categoria
        let iconCat = '<i class="fas fa-money-bill-wave"></i>';
        if(item.categoria === 'Pessoal') iconCat = '<i class="fas fa-user-friends"></i>';
        if(item.categoria === 'Aluguel') iconCat = '<i class="fas fa-building"></i>';
        if(item.categoria === 'Operacional') iconCat = '<i class="fas fa-bolt"></i>';
        if(item.categoria === 'Marketing') iconCat = '<i class="fas fa-bullhorn"></i>';

        row.innerHTML = `
            <td>${dataVisual}</td>
            <td>${item.descricao}</td>
            <td><span class="badge" style="background:rgba(255,255,255,0.1); color:#fff; border:1px solid #444;">${iconCat} ${item.categoria}</span></td>
            <td style="color: #ff453a; font-weight:bold;">- R$ ${parseFloat(item.valor).toFixed(2)}</td>
            <td>
                <button class="action-btn delete-btn" onclick="deleteExpense('${item.id}')" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
    });
}

// Salvar Nova Despesa
async function handleExpenseForm(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    
    const despesa = {
        descricao: document.getElementById('desc-despesa').value,
        valor: parseFloat(document.getElementById('valor-despesa').value),
        categoria: document.getElementById('cat-despesa').value,
        data: document.getElementById('data-despesa').value,
        timestamp: new Date().toISOString()
    };

    try {
        setBtnLoading(btn, true);
        await addDoc(getUserCollectionRef("expenses"), despesa);
        
        showToast("Despesa lançada com sucesso!", "success");
        e.target.reset();
        
        // Recarrega o painel para atualizar os cálculos
        await loadFinancialDashboard();

        // ... dentro de handleExpenseForm ...
        await addDoc(getUserCollectionRef("expenses"), despesa);
        // 📝 LOG
        await logSystemAction("Despesa Financeira", `Lançou despesa: ${despesa.descricao} - R$ ${despesa.valor.toFixed(2)}`);
        // ...

    } catch (error) {
        showToast("Erro: " + error.message, "error");
    } finally {
        setBtnLoading(btn, false);
    }
}

// Excluir Despesa
async function deleteExpense(id) {
    // Usa o seu modal de confirmação bonito se tiver, senão usa o nativo
    if(window.customConfirm) {
        customConfirm("Tem certeza que deseja apagar este registro financeiro?", async () => {
             await executeDeleteExpense(id);
        });
    } else {
        if(confirm("Apagar despesa?")) await executeDeleteExpense(id);
    }
}

async function executeDeleteExpense(id) {
    try {
        window.showLoadingScreen("Removendo...", "Atualizando saldo...");
        await deleteDoc(getUserDocumentRef("expenses", id));
        await loadFinancialDashboard(); // Recarrega tudo
        window.hideLoadingScreen();
        showToast("Registro removido.", "success");
    } catch(e) {
        window.hideLoadingScreen();
        console.error(e);
        showToast("Erro ao excluir.", "error");
    }
}

async function reverseSale(saleId) {
    const user = auth.currentUser;
    if (!user) return;

    // Busca a venda localmente para ter os dados
    const sale = salesHistory.find(s => s.id === saleId);
    if (!sale) return showToast("Venda não encontrada localmente.", "error");

    // Passo 1: Confirmação Inicial
    customConfirm(`⚠️ Deseja iniciar o estorno da venda #${saleId.slice(-4)}?`, async () => {
        
        // Passo 2: Pede o MOTIVO (Obrigatório)
        customPrompt("Motivo do Estorno", "Por que esta venda está sendo cancelada?", async (motivo) => {
            
            if (!motivo || motivo.trim().length < 3) {
                return showToast("O motivo é obrigatório para estornar.", "error");
            }

            // Passo 3: Pede a SENHA do Admin
            const senha = await getPasswordViaPrompt("Autorização", "Digite sua senha de LOGIN para confirmar:");
            if (!senha) return;

            try {
                window.showLoadingScreen("Processando Estorno...", "Devolvendo itens e registrando log...");
                
                // Re-autentica
                const credential = EmailAuthProvider.credential(user.email, senha);
                await reauthenticateWithCredential(user, credential);

                // 1. Devolve Estoque
                if (sale.items && Array.isArray(sale.items)) {
                    for (const item of sale.items) {
                        const prodRef = doc(db, "users", user.uid, "products", item.id);
                        const prodSnap = await getDoc(prodRef);
                        
                        if (prodSnap.exists()) {
                            const prodData = prodSnap.data();
                            await updateDoc(prodRef, { 
                                quantidade: (parseInt(prodData.quantidade) || 0) + parseInt(item.quantity) 
                            });
                        }
                    }
                }

                // 2. Apaga a Venda
                await deleteDoc(doc(db, "users", user.uid, "sales", saleId));

                // 3. GRAVA O LOG COM O MOTIVO (Aqui está a mágica!)
                await logSystemAction("Estorno de Venda", `Venda #${saleId.slice(-4)} cancelada. Motivo: ${motivo}. Valor: R$ ${parseFloat(sale.total).toFixed(2)}`);

                window.hideLoadingScreen();
                showToast("Estorno realizado e registrado!", "success");
                
                // Recarrega
                await loadAllData();

            } catch (error) {
                window.hideLoadingScreen();
                if (error.code === 'auth/wrong-password') {
                    showToast("Senha incorreta.", "error");
                } else {
                    showToast("Erro: " + error.message, "error");
                }
            }
        }, "", "text"); // Input tipo texto para o motivo
    });
}

function checkBirthdays() {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();
    
    const aniversariantes = clientesReais.filter(c => {
        if (!c.nascimento) return false;
        // Corrige fuso horário simples
        const parts = c.nascimento.split('-'); // YYYY-MM-DD
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);
        
        // Verifica se é hoje ou nos próximos 7 dias
        // (Lógica simplificada para mesmo mês)
        return month === currentMonth && day >= currentDay && day <= currentDay + 7;
    });

    if (aniversariantes.length > 0) {
        const lista = document.getElementById("alerts-dropdown-list");
        const bell = document.getElementById("bell-icon");
        
        aniversariantes.forEach(c => {
            const li = document.createElement("li");
            li.innerHTML = `<i class="fas fa-birthday-cake" style="color:#FF4081"></i> ${c.nome} faz aniversário dia ${c.nascimento.split('-')[2]}!`;
            lista.appendChild(li);
        });
        if(bell) bell.classList.add("has-alerts");
    }
}

function filterExpenses() {
    const startVal = document.getElementById('fin-filter-start').value;
    const endVal = document.getElementById('fin-filter-end').value;
    
    if (!startVal || !endVal) return renderExpensesTable(); // Mostra tudo se vazio

    const start = new Date(startVal); start.setHours(0,0,0,0);
    const end = new Date(endVal); end.setHours(23,59,59,999);

    const filtered = expensesData.filter(e => {
        const d = new Date(e.data); // data está em YYYY-MM-DD
        // Ajuste de fuso simples: criar data com T12:00
        const dAdjust = new Date(e.data + "T12:00:00");
        return dAdjust >= start && dAdjust <= end;
    });

    renderExpensesTable(filtered); // Atualize renderExpensesTable para aceitar argumento opcional
}

// ============================================================
// LÓGICA DE FILTRO DE DATAS (MODAL)
// ============================================================

// 1. Abrir o Modal
window.openDateFilterModal = function() {
    document.getElementById('date-filter-modal').style.display = 'flex';
    // Define hoje como padrão se estiver vazio
    if(!document.getElementById('filter-end-date').value) {
        document.getElementById('filter-end-date').valueAsDate = new Date();
    }
}

// 2. Fechar o Modal
window.closeDateFilterModal = function() {
    document.getElementById('date-filter-modal').style.display = 'none';
}

window.aplicarFiltroVendas = function() {
    // ... (sua lógica de validação de data aqui continua igual) ...
    const startVal = document.getElementById('filter-start-date').value;
    const endVal = document.getElementById('filter-end-date').value;
    
    if(!startVal || !endVal) return showToast("Selecione as datas.", "error");

    const startDate = new Date(startVal); startDate.setHours(0,0,0,0);
    const endDate = new Date(endVal); endDate.setHours(23,59,59,999);

    const vendasFiltradas = salesHistory.filter(venda => {
        const d = parseDataSegura(venda.timestamp || venda.date);
        return d && d >= startDate && d <= endDate;
    });

    closeDateFilterModal();

    if (vendasFiltradas.length === 0) {
        customAlert("Nenhuma venda encontrada neste período.", "info");
    } else {
        renderSalesDetailsTable(vendasFiltradas);
        showToast(`Filtro: ${vendasFiltradas.length} vendas.`, "success");
        
        // MOSTRA O BOTÃO DE LIMPAR FILTRO
        const btnClear = document.getElementById("btn-clear-date");
        if(btnClear) btnClear.style.display = "inline-flex";
    }
}

// 4. Limpar Filtro (Voltar ao normal)
window.limparFiltroVendas = function() {
    renderSalesDetailsTable(salesHistory); // Restaura tudo
    
    // ESCONDE O BOTÃO DE LIMPAR
    const btnClear = document.getElementById("btn-clear-date");
    if(btnClear) btnClear.style.display = "none";
    
    showToast("Filtro de data removido.", "info");
}

// Função auxiliar para renderizar a tabela filtrada (caso a sua principal não aceite parâmetros)
function renderizarTabelaFiltrada(vendas) {
    const tbody = document.querySelector("#sales-report-table tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    vendas.forEach(sale => {
        const row = tbody.insertRow();
        const saleId = sale.id || "#";
        const total = parseFloat(sale.total) || 0;
        
        // Formata data bonita
        const d = parseDataSegura(sale.timestamp || sale.date);
        const dataFormatada = d ? d.toLocaleString("pt-BR") : "-";

        row.innerHTML = `
            <td><span style="opacity:0.6">#${saleId.slice(-4)}</span></td>
            <td>${dataFormatada}</td>
            <td style="font-weight:bold; color:var(--color-accent-green);">R$ ${total.toFixed(2)}</td>
            <td>${getPagamentoBadge(sale.payment || '-')}</td>
            <td>${(sale.items || []).length} itens</td>
            <td>${sale.client || '-'}</td>
            <td>
                <button class="action-btn view-btn" onclick="viewSaleDetails('${saleId}')"><i class="fas fa-eye"></i></button>
                <button class="action-btn delete-btn" onclick="reverseSale('${saleId}')"><i class="fas fa-undo"></i></button>
            </td>
        `;
    });
}

window.filtrarDespesasFinanceiro = function() {
    const inicioInput = document.getElementById('fin-start').value;
    const fimInput = document.getElementById('fin-end').value;

    if (!inicioInput || !fimInput) {
        showToast("Defina as datas de início e fim.", "error");
        return;
    }

    if (!expensesData || expensesData.length === 0) {
        showToast("Não há despesas para filtrar.", "info");
        return;
    }

    // Mesma lógica de datas robusta
    const partesInicio = inicioInput.split('-');
    const dInicio = new Date(partesInicio[0], partesInicio[1] - 1, partesInicio[2], 0, 0, 0);

    const partesFim = fimInput.split('-');
    const dFim = new Date(partesFim[0], partesFim[1] - 1, partesFim[2], 23, 59, 59, 999);

    const despesasFiltradas = expensesData.filter(e => {
        // Tenta ler a data da despesa (geralmente vem YYYY-MM-DD do input date)
        const partesData = e.data.split('-'); // 2025-02-12
        const dDespesa = new Date(partesData[0], partesData[1] - 1, partesData[2], 12, 0, 0);
        
        return dDespesa >= dInicio && dDespesa <= dFim;
    });

    if (despesasFiltradas.length === 0) {
        const tbody = document.querySelector("#expenses-table tbody");
        if(tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px;">Nenhuma despesa neste período.</td></tr>`;
    } else {
        renderExpensesTable(despesasFiltradas);
    }
};
window.limparFiltroFinanceiro = function() {
    document.getElementById('fin-start').value = "";
    document.getElementById('fin-end').value = "";
    renderExpensesTable(expensesData); // Mostra tudo
}

window.abrirModalRelatorio = function() {
    const modal = document.getElementById('modal-filtro-vendas');
    if (!modal) {
        console.error("ERRO: Modal 'modal-filtro-vendas' não encontrado no HTML.");
        alert("Erro interno: Janela de filtro não encontrada.");
        return;
    }
    
    modal.style.display = 'flex';
    
    // Define hoje como data final padrão se estiver vazio
    const campoFim = document.getElementById('modal-relatorio-end');
    if(campoFim && !campoFim.value) {
        campoFim.valueAsDate = new Date();
    }
};

window.executarFiltroRelatorio = function() {
    const inicioInput = document.getElementById('modal-relatorio-start').value; // vem YYYY-MM-DD
    const fimInput = document.getElementById('modal-relatorio-end').value;     // vem YYYY-MM-DD

    if (!inicioInput || !fimInput) {
        showToast("Selecione as datas de início e fim.", "error");
        return;
    }

    // Fecha o modal
    document.getElementById('modal-filtro-vendas').style.display = 'none';

    // TRUQUE PARA DATAS: Criar a data usando as partes da string para evitar Fuso Horário
    // Ex: "2025-02-12" -> new Date(2025, 1, 12) (Mês é base 0 no JS)
    const partesInicio = inicioInput.split('-');
    const dInicio = new Date(partesInicio[0], partesInicio[1] - 1, partesInicio[2], 0, 0, 0);

    const partesFim = fimInput.split('-');
    const dFim = new Date(partesFim[0], partesFim[1] - 1, partesFim[2], 23, 59, 59, 999);

    console.log("Filtrando de:", dInicio.toLocaleString(), "até", dFim.toLocaleString());

    // Filtra salesHistory
    const vendasFiltradas = salesHistory.filter(v => {
        // Tenta ler a data da venda de várias formas
        let dataVenda = null;
        
        // 1. Tenta pegar do timestamp ISO
        if (v.timestamp) {
            dataVenda = new Date(v.timestamp);
        } 
        // 2. Se não der, tenta da data legada ou formatada
        else if (v.date) {
            // Se for DD/MM/AAAA converte
            if(v.date.includes('/')) {
                const p = v.date.split('/');
                dataVenda = new Date(p[2], p[1]-1, p[0]);
            } else {
                dataVenda = new Date(v.date);
            }
        }

        if (!dataVenda || isNaN(dataVenda.getTime())) return false;

        // Comparação simples
        return dataVenda >= dInicio && dataVenda <= dFim;
    });

    if (vendasFiltradas.length === 0) {
        customAlert("Nenhuma venda encontrada neste período.", "info");
        
        // Mostra mensagem na tabela
        const tbody = document.getElementById("sales-table-body") || document.querySelector("#sales-report-table tbody");
        if(tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; opacity:0.7;">Nada encontrado entre ${dInicio.toLocaleDateString()} e ${dFim.toLocaleDateString()}</td></tr>`;
        
        // Zera métricas visuais
        updateReportMetrics([]); 
    } else {
        // Renderiza tabela e atualiza os cards de lucro/total
        renderSalesDetailsTable(vendasFiltradas);
        
        // ESSA FUNÇÃO AQUI É IMPORTANTE PARA ATUALIZAR OS NÚMEROS LÁ EM CIMA:
        // Precisamos garantir que ela aceite a lista filtrada.
        // Vou adicionar um pequeno patch nela abaixo.
        atualizarMetricasComFiltro(vendasFiltradas); 
        
        showToast(`${vendasFiltradas.length} vendas filtradas.`, "success");
    }
    
    // Mostra o botão de limpar filtro
    const btnLimpar = document.getElementById("btn-clear-relatorio");
    if(btnLimpar) btnLimpar.style.display = "inline-flex";
};

// Função auxiliar para atualizar os cards coloridos com os dados filtrados
function atualizarMetricasComFiltro(vendas) {
    // Redefine salesHistory temporariamente para o cálculo ou cria lógica própria
    // O jeito mais seguro sem quebrar o resto do código é chamar a lógica de cálculo manual aqui:
    
    let totalSales = 0;
    let totalProfit = 0;
    
    vendas.forEach(sale => {
        totalSales += (parseFloat(sale.total) || 0);
        
        let custoVenda = 0;
        if(sale.items) {
            sale.items.forEach(i => {
                custoVenda += (parseFloat(i.custo)||0) * (parseFloat(i.quantity)||0);
            });
        }
        totalProfit += (parseFloat(sale.total)||0) - custoVenda;
    });

    // Atualiza HTML
    const elSales = document.getElementById("report-total-sales");
    const elProfit = document.getElementById("report-total-profit");
    const elCount = document.getElementById("report-products-sold"); // usando para qtd vendas neste caso
    
    if(elSales) elSales.textContent = totalSales.toLocaleString("pt-BR", {style:"currency", currency:"BRL"});
    if(elProfit) elProfit.textContent = totalProfit.toLocaleString("pt-BR", {style:"currency", currency:"BRL"});
    if(elCount) elCount.textContent = vendas.length;
}
window.limparFiltroRelatorio = function() {
    document.getElementById('modal-relatorio-start').value = "";
    document.getElementById('modal-relatorio-end').value = "";
    renderSalesDetailsTable(salesHistory); // Restaura tudo
    document.getElementById("btn-clear-relatorio").style.display = "none";
}

window.filtrarDespesasV2 = function() {
    console.log("Iniciando filtro de despesas...");

    const inicioVal = document.getElementById('busca-fin-inicio').value;
    const fimVal = document.getElementById('busca-fin-fim').value;

    if (!inicioVal || !fimVal) {
        showToast("⚠️ Selecione data inicial e final.", "error");
        return;
    }

    // Verifica se há dados
    if (!expensesData || expensesData.length === 0) {
        customAlert("Não há despesas lançadas no sistema para filtrar.", "info");
        return;
    }

    // CRIA DATA DE COMPARAÇÃO (Zerando horas para evitar erros de fuso)
    // O input date retorna YYYY-MM-DD.
    // Vamos usar setHours(0,0,0,0) para inicio e (23,59,59,999) para fim
    const partesInicio = inicioVal.split('-');
    const dInicio = new Date(partesInicio[0], partesInicio[1]-1, partesInicio[2], 0, 0, 0);

    const partesFim = fimVal.split('-');
    const dFim = new Date(partesFim[0], partesFim[1]-1, partesFim[2], 23, 59, 59);

    console.log(`Filtrando de: ${dInicio.toLocaleDateString()} até ${dFim.toLocaleDateString()}`);

    const filtrados = expensesData.filter(item => {
        // A data salva no item.data geralmente é "YYYY-MM-DD" (string do input)
        // Mas vamos garantir que funcione mesmo se for timestamp
        let dataItem = null;

        if (item.data && item.data.includes('-')) {
            // Se for "2025-02-12"
            const p = item.data.split('-');
            dataItem = new Date(p[0], p[1]-1, p[2], 12, 0, 0); // Meio-dia para segurança
        } else if (item.timestamp) {
            dataItem = new Date(item.timestamp);
        }

        if (!dataItem || isNaN(dataItem.getTime())) return false;

        return dataItem >= dInicio && dataItem <= dFim;
    });

    console.log(`Resultados: ${filtrados.length} despesas encontradas.`);

    if (filtrados.length === 0) {
        // Limpa a tabela e mostra mensagem
        const tbody = document.querySelector("#expenses-table tbody");
        if(tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; opacity:0.6;"><i class="fas fa-search"></i> Nenhuma despesa encontrada neste período.</td></tr>`;
        showToast("Nenhum registro encontrado.", "info");
    } else {
        // Renderiza com os filtrados
        renderExpensesTable(filtrados);
        showToast(`Filtro aplicado: ${filtrados.length} registros.`, "success");
    }
}

window.resetarFiltroDespesas = function() {
    document.getElementById('busca-fin-inicio').value = "";
    document.getElementById('busca-fin-fim').value = "";
    
    // Recarrega lista completa
    renderExpensesTable(expensesData);
    showToast("Filtro removido.", "info");
}


// ============================================================
// RELATÓRIOS AVANÇADOS (KPIs, GMROI, Executivo)
// ============================================================

// ============================================================
// ATUALIZA OS CARDS DO TOPO (RELATÓRIOS) - VERSÃO BLINDADA
// ============================================================
window.atualizarDashboardExecutivo = function() {
    // 1. LUCRO POTENCIAL DO ESTOQUE
    let lucroEstoqueTotal = 0;
    
    if (typeof products !== 'undefined' && Array.isArray(products)) {
        products.forEach(p => {
            const qtd = parseInt(p.quantidade) || 0;
            // Garante conversão de string "100,00" para número 100.00 se necessário
            let custo = p.custo;
            let preco = p.preco;
            
            if (typeof custo === 'string') custo = parseFloat(custo.replace(',', '.')) || 0;
            if (typeof preco === 'string') preco = parseFloat(preco.replace(',', '.')) || 0;
            
            const lucroUnitario = preco - custo;
            if (lucroUnitario > 0 && qtd > 0) {
                lucroEstoqueTotal += (lucroUnitario * qtd);
            }
        });
    }

    const elEstoque = document.getElementById("exec-estoque-custo");
    if(elEstoque) elEstoque.innerText = lucroEstoqueTotal.toLocaleString("pt-BR", {style:'currency', currency:'BRL'});

    // 2. VENDAS (Ticket e Top Cliente)
    if (!salesHistory || salesHistory.length === 0) {
        if(document.getElementById("exec-ticket")) document.getElementById("exec-ticket").innerText = "R$ 0,00";
        if(document.getElementById("exec-top-cliente")) document.getElementById("exec-top-cliente").innerText = "---";
        return;
    }

    // Função local segura para data
    const pegarData = (v) => {
        if(!v) return null;
        if(v instanceof Date) return v;
        // Tenta usar a função global se existir, senão usa new Date
        if(typeof converterDataNaMarra === 'function') return converterDataNaMarra(v);
        return new Date(v);
    };

    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    // Filtra pelo mês atual
    let vendasFiltradas = salesHistory.filter(s => {
        const d = pegarData(s.timestamp || s.date);
        return d && !isNaN(d) && d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    });

    let textoPeriodo = "(Mês Atual)";

    // Se não tiver vendas no mês, usa TUDO
    if (vendasFiltradas.length === 0) {
        vendasFiltradas = salesHistory;
        textoPeriodo = "(Geral)";
    }

    // Cálculos
    let totalVendas = 0;
    const clientesMap = {};

    vendasFiltradas.forEach(s => {
        const total = parseFloat(s.total) || 0;
        totalVendas += total;

        const cli = s.client || "Consumidor Final";
        if (cli !== "Consumidor Final") {
            clientesMap[cli] = (clientesMap[cli] || 0) + total;
        }
    });

    // Ticket Médio
    const ticket = vendasFiltradas.length > 0 ? (totalVendas / vendasFiltradas.length) : 0;
    
    // Top Cliente
    let topNome = "---";
    let topValor = 0;
    Object.entries(clientesMap).forEach(([nome, valor]) => {
        if (valor > topValor) {
            topValor = valor;
            topNome = nome;
        }
    });

    // Atualiza DOM
    const elTicket = document.getElementById("exec-ticket");
    if(elTicket) {
        elTicket.innerText = ticket.toLocaleString("pt-BR", {style:'currency', currency:'BRL'});
        // Atualiza label
        const label = elTicket.parentElement.querySelector(".card-label");
        if(label) label.innerText = `Ticket Médio ${textoPeriodo}`;
    }
    
    const elTopCli = document.getElementById("exec-top-cliente");
    if(elTopCli) {
        if (topValor > 0) {
            const nomeCurto = topNome.length > 15 ? topNome.substring(0, 12)+'...' : topNome;
            elTopCli.innerHTML = `
                <div style="font-weight:bold; color:var(--color-text-primary); font-size:0.9rem;">${nomeCurto}</div>
                <div style="color:#30D158; font-size:0.8rem;">${topValor.toLocaleString("pt-BR", {style:'currency', currency:'BRL'})}</div>
            `;
        } else {
            elTopCli.innerText = "---";
        }
        const label = elTopCli.parentElement.querySelector(".card-label");
        if(label) label.innerText = `Top Cliente ${textoPeriodo}`;
    }
}
// 2. Inteligência de Estoque (GMROI e Ruptura)
window.calcularKPIsEstoque = function() {
    if (!products || products.length === 0) return;

    // A. Custo do Estoque Parado (Valor total em armazém)
    let custoEstoqueTotal = 0;
    products.forEach(p => {
        custoEstoqueTotal += (parseFloat(p.custo) || 0) * (parseInt(p.quantidade) || 0);
    });

    // B. GMROI (Simplificado: Lucro Bruto Anualizado / Custo Estoque Médio)
    // Vamos usar os dados de vendas totais disponíveis para estimar
    let lucroBrutoTotal = 0;
    salesHistory.forEach(s => {
        let custoVenda = 0;
        if(s.items) s.items.forEach(i => custoVenda += (parseFloat(i.custo||0) * i.quantity));
        lucroBrutoTotal += (parseFloat(s.total||0) - custoVenda);
    });

    // Evita divisão por zero
    const gmroi = custoEstoqueTotal > 0 ? (lucroBrutoTotal / custoEstoqueTotal) : 0;

    // Atualiza Cards
    document.getElementById("kpi-stock-cost").innerText = custoEstoqueTotal.toLocaleString("pt-BR", {style:'currency', currency:'BRL'});
    document.getElementById("kpi-gmroi").innerText = gmroi.toFixed(2);
    // Giro (Estimativa simples: Custo das Vendas / Custo Estoque)
    // Para simplificar aqui sem complicar o código, deixaremos um placeholder ou cálculo simples
    document.getElementById("kpi-giro").innerText = (gmroi > 0 ? (gmroi * 0.8).toFixed(1) : "0") + "x"; 

    // C. Tabela de Risco de Ruptura (Dias de Cobertura)
    const tbody = document.getElementById("ruptura-tbody");
    if(!tbody) return;
    tbody.innerHTML = "";

    // Mapear vendas por produto nos últimos 30 dias
    const vendasPorProduto = {};
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

    salesHistory.forEach(s => {
        const d = parseDataSegura(s.timestamp || s.date);
        if (d >= trintaDiasAtras) {
            if(s.items) s.items.forEach(i => {
                vendasPorProduto[i.id] = (vendasPorProduto[i.id] || 0) + i.quantity;
            });
        }
    });

    // Calcula cobertura para cada produto
    const listaRisco = [];
    products.forEach(p => {
        if (p.categoria === "Serviços") return;
        
        const vendidos30dias = vendasPorProduto[p.id] || vendasPorProduto[p._id] || 0;
        const mediaDiaria = vendidos30dias / 30;
        const estoque = parseInt(p.quantidade) || 0;
        
        let diasCobertura = 999;
        if (mediaDiaria > 0) {
            diasCobertura = estoque / mediaDiaria;
        }

        // Só mostra se tiver risco (menos de 15 dias) ou se já vendeu algo
        if (diasCobertura < 20 || mediaDiaria > 0) {
            listaRisco.push({ 
                nome: p.nome, 
                estoque, 
                media: mediaDiaria, 
                dias: diasCobertura 
            });
        }
    });

    // Ordena pelos que vão acabar primeiro
    listaRisco.sort((a, b) => a.dias - b.dias);

    listaRisco.forEach(item => {
        const row = tbody.insertRow();
        
        let status = '<span class="badge badge-success">OK</span>';
        if (item.dias <= 0) status = '<span class="badge badge-danger">Esgotado</span>';
        else if (item.dias < 7) status = '<span class="badge badge-danger">Crítico (< 7d)</span>';
        else if (item.dias < 15) status = '<span class="badge badge-warning">Alerta (< 15d)</span>';

        // Trata infinito
        const diasDisplay = item.dias > 365 ? "> 1 Ano" : item.dias.toFixed(1) + " dias";

        row.innerHTML = `
            <td>${item.nome}</td>
            <td style="font-weight:bold;">${item.estoque}</td>
            <td>${item.media.toFixed(2)} / dia</td>
            <td>${diasDisplay}</td>
            <td>${status}</td>
        `;
    });
}

// 3. Análise de Margens
// 3. Análise de Margens (Categorias/Grupos e Clientes)
window.calcularAnaliseMargem = function() {
    const catStats = {};
    const cliStats = {};

    salesHistory.forEach(s => {
        // Dados do Cliente (Calculando LUCRO gerado, não só venda bruta)
        const cliente = s.client || "Não Identificado";
        
        // Dados da Categoria e Grupo (Item a item)
        if(s.items) s.items.forEach(i => {
            const prod = products.find(p => (p._id || p.id) == i.id);
            // Cria a chave composta: "Eletrônicos > Celulares"
            const catPrincipal = prod ? prod.categoria : "Geral";
            const subGrupo = (prod && prod.grupo) ? prod.grupo : "Geral";
            const chaveCategoria = `${catPrincipal} <span style="color:#aaa; font-size:0.8em;">❯ ${subGrupo}</span>`;
            
            const r = i.preco * i.quantity; // Receita
            const c = (i.custo || 0) * i.quantity; // Custo
            const l = r - c; // Lucro
            
            // Estatísticas de Categoria
            if (!catStats[chaveCategoria]) catStats[chaveCategoria] = { receita: 0, custo: 0 };
            catStats[chaveCategoria].receita += r;
            catStats[chaveCategoria].custo += c;

            // Estatísticas de Cliente (Acumula Lucro)
            if (cliente !== "Não Identificado") {
                if (!cliStats[cliente]) cliStats[cliente] = { lucro: 0, receita: 0, count: 0 };
                cliStats[cliente].lucro += l;
                cliStats[cliente].receita += r;
                // Contamos a venda apenas uma vez por loop de item, cuidado:
                // Melhor contar vendas fora do loop de itens, mas para simplificar aqui:
                // Vamos incrementar count apenas se for o primeiro item da venda ou ajustar lógica.
                // Ajuste simplificado: count será itens comprados neste contexto.
            }
        });
        
        // Ajuste contagem de vendas do cliente (fora do loop de itens)
        if (cliente !== "Não Identificado" && cliStats[cliente]) {
            cliStats[cliente].count++; 
        }
    });

    // A. RENDERIZA TABELA CATEGORIAS (Ordenada por Margem %)
    const tbodyCat = document.getElementById("margem-cat-tbody");
    if(tbodyCat) {
        tbodyCat.innerHTML = "";
        const listaCats = Object.entries(catStats).map(([cat, dados]) => {
            const lucro = dados.receita - dados.custo;
            const margem = dados.receita > 0 ? ((lucro / dados.receita) * 100) : 0;
            return { cat, receita: dados.receita, lucro, margem };
        });

        // Ordena por Lucro Total (R$) decrescente
        listaCats.sort((a, b) => b.lucro - a.lucro);

        listaCats.forEach(item => {
            tbodyCat.innerHTML += `
                <tr>
                    <td>${item.cat}</td> <td>R$ ${item.receita.toFixed(2)}</td>
                    <td style="color:var(--color-accent-green); font-weight:bold;">R$ ${item.lucro.toFixed(2)}</td>
                    <td><span class="badge ${item.margem > 30 ? 'badge-success' : 'badge-warning'}">${item.margem.toFixed(1)}%</span></td>
                </tr>
            `;
        });
    }

    // B. RENDERIZA TABELA CLIENTES (TOP 10 POR RENTABILIDADE/LUCRO)
    const tbodyCli = document.getElementById("margem-cli-tbody");
    if(tbodyCli) {
        tbodyCli.innerHTML = "";
        
        // Ordena por LUCRO
        const topClients = Object.entries(cliStats)
            .sort((a, b) => b[1].lucro - a[1].lucro)
            .slice(0, 10); // Pega Top 10

        topClients.forEach(([nome, dados]) => {
            tbodyCli.innerHTML += `
                <tr>
                    <td>
                        <div style="font-weight:bold;">${nome}</div>
                        <small style="color:#aaa;">${dados.count} compras</small>
                    </td>
                    <td>R$ ${dados.receita.toFixed(2)}</td>
                    <td style="font-weight:bold; color:var(--color-accent-green)">R$ ${dados.lucro.toFixed(2)}</td>
                    <td><span class="badge badge-info">${((dados.lucro/dados.receita)*100).toFixed(0)}%</span></td>
                </tr>
            `;
        });
    }
}
// ============================================================
// RELATÓRIO DUPLO: CEO + EXTRATO COMPACTO
// ============================================================

// Função para atualizar o autocomplete de Subcategorias
window.updateGroupDatalist = function() {
    const listaUL = document.getElementById('lista-grupos-custom');
    if (!listaUL) return;

    listaUL.innerHTML = ''; 

    // Garante que existe a lista
    if (!config.productGroups) config.productGroups = [];

    // Ordena e Cria os itens da lista
    config.productGroups.sort().forEach(grupo => {
        const li = document.createElement('li');
        li.textContent = grupo;
        // Ao clicar no item, preenche o input e fecha
        li.onclick = function() {
            document.getElementById('prodGrupo').value = grupo;
            listaUL.classList.remove('show');
        };
        listaUL.appendChild(li);
    });
}

// 2. Abre/Fecha ao clicar na seta
window.toggleGrupoDropdown = function(e) {
    if(e) e.stopPropagation(); // Impede que feche imediatamente
    const lista = document.getElementById('lista-grupos-custom');
    const input = document.getElementById('prodGrupo');
    
    if (lista.classList.contains('show')) {
        lista.classList.remove('show');
    } else {
        // Reseta o filtro (mostra tudo) e abre
        updateGroupDatalist(); 
        lista.classList.add('show');
        input.focus();
    }
}

// 3. Abre ao focar no input
window.abrirGrupoDropdown = function() {
    const lista = document.getElementById('lista-grupos-custom');
    updateGroupDatalist(); // Garante lista atualizada
    lista.classList.add('show');
}

// 4. Filtra enquanto digita
window.filtrarGrupoDropdown = function() {
    const termo = document.getElementById('prodGrupo').value.toLowerCase();
    const itens = document.querySelectorAll('#lista-grupos-custom li');
    const lista = document.getElementById('lista-grupos-custom');
    
    let temVisivel = false;
    itens.forEach(li => {
        const texto = li.textContent.toLowerCase();
        if (texto.includes(termo)) {
            li.style.display = 'block';
            temVisivel = true;
        } else {
            li.style.display = 'none';
        }
    });

    // Se tiver itens visíveis, mostra a lista, senão esconde
    if (temVisivel) lista.classList.add('show');
    else lista.classList.remove('show');
}

// 5. Fecha se clicar fora (UX Importante)
document.addEventListener('click', function(e) {
    const wrapper = document.querySelector('.custom-dropdown-wrapper');
    const lista = document.getElementById('lista-grupos-custom');
    
    if (wrapper && lista && !wrapper.contains(e.target)) {
        lista.classList.remove('show');
    }
});

// ============================================================
// PROCESSAR CONSUMO PRÓPRIO / BAIXA (CUSTO VIRA DESPESA)
// ============================================================
window.processarBaixaEstoque = async function(motivo) {
    const btn = document.getElementById("btn-finalizar-venda");
    
    // Pede senha por segurança (opcional, mas recomendado para evitar fraudes)
    const senha = await getPasswordViaPrompt("Autorizar Baixa", "Digite a senha para confirmar o consumo/perda:");
    if (!senha) return showToast("Baixa cancelada.", "info");

    try {
        setBtnLoading(btn, true);
        
        // Valida senha (segurança)
        const user = auth.currentUser;
        const credential = EmailAuthProvider.credential(user.email, senha);
        await reauthenticateWithCredential(user, credential);

        let custoTotalDaBaixa = 0;
        const updates = [];

        // 1. Calcula Custo Total e Prepara Estoque
        for (const item of cart) {
            const prod = products.find(p => (p._id || p.id) == item.id);
            if (prod) {
                const custoUnit = parseFloat(prod.custo) || 0;
                custoTotalDaBaixa += (custoUnit * item.quantity);
                
                if (prod.categoria !== "Serviços") {
                    updates.push({ id: prod.id, novaQtd: prod.quantidade - item.quantity });
                }
            }
        }

        // 2. Atualiza Estoque
        for (const up of updates) {
            await updateDoc(getUserDocumentRef("products", up.id), { quantidade: up.novaQtd });
        }

        // 3. Registra "Venda" zerada (Para constar a saída no histórico de itens)
        const sale = {
            timestamp: new Date().toISOString(),
            items: JSON.parse(JSON.stringify(cart)),
            subtotal: 0,
            discount: 0,
            total: 0, // Venda sai a custo zero
            payment: "Consumo Interno",
            client: motivo, // Ex: "Consumo Próprio", "Quebra", "Doação"
            isWriteOff: true // Flag para identificar que não é venda real
        };
        await addDoc(getUserCollectionRef("sales"), sale);

        // 4. LANÇA DESPESA AUTOMÁTICA (O Pulo do Gato!)
        if (custoTotalDaBaixa > 0) {
            const despesa = {
                descricao: `Baixa de Estoque: ${motivo}`,
                valor: custoTotalDaBaixa,
                categoria: "Operacional", // Ou 'Perdas', se tiver
                data: new Date().toISOString().split('T')[0], // Hoje YYYY-MM-DD
                timestamp: new Date().toISOString()
            };
            await addDoc(getUserCollectionRef("expenses"), despesa);
        }

        // Finaliza
        cart = [];
        renderCart();
        document.getElementById("payment-modal").style.display = "none";
        
        await loadAllData();
        await loadFinancialDashboard(); // Atualiza financeiro

        customAlert(`Baixa realizada!\nCusto de R$ ${custoTotalDaBaixa.toFixed(2)} lançado como despesa.`, "success");

    } catch (error) {
        console.error(error);
        if (error.code === 'auth/wrong-password') showToast("Senha incorreta.", "error");
        else showToast("Erro ao processar baixa: " + error.message, "error");
    } finally {
        setBtnLoading(btn, false);
    }
}

// ============================================================
// MÓDULO COMUNIDADE E ROADMAP
// ============================================================

// 1. Carregar Postagens (Falso Real-time para economizar leitura)
async function loadCommunityPosts(filtro = 'todos') {
    const container = document.getElementById('community-posts-list');
    if(!container) return;

    container.innerHTML = '<div style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin"></i> Atualizando feed...</div>';

    try {
        // Usa uma coleção global (fora do usuário) para que todos vejam
        // Nota: Requer regras do Firestore permitindo leitura em 'community_posts'
        const q = query(collection(db, "community_posts"), orderBy("timestamp", "desc"), limit(20));
        const snap = await getDocs(q);
        
        container.innerHTML = '';

        if (snap.empty) {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:#666;">Seja o primeiro a postar!</div>';
            return;
        }

        snap.forEach(doc => {
            const p = doc.data();
            
            // Aplica filtro local
            if (filtro !== 'todos' && p.type !== filtro) return;

            const time = p.timestamp ? new Date(p.timestamp).toLocaleDateString('pt-BR') : 'Hoje';
            const iniciais = p.authorName ? p.authorName.substring(0,2).toUpperCase() : 'AN';
            
            // Badge do Tipo
            let tagClass = 'tag-duvida';
            let tagText = 'Dúvida';
            if(p.type === 'sugestao') { tagClass = 'tag-sugestao'; tagText = 'Sugestão'; }
            if(p.type === 'aviso') { tagClass = 'tag-aviso'; tagText = 'Aviso Admin'; }

            const div = document.createElement('div');
            div.className = 'post-item';
            div.innerHTML = `
                <div class="post-header">
                    <div class="user-badge">
                        <div class="user-avatar-small">${iniciais}</div>
                        <div>
                            <div style="font-weight:bold; font-size:0.9rem;">${p.authorName}</div>
                            <div style="font-size:0.75rem; color:#666;">${time}</div>
                        </div>
                    </div>
                    <span class="post-tag ${tagClass}">${tagText}</span>
                </div>
                <div class="post-title">${p.title}</div>
                <div class="post-body">${p.content}</div>
                <div class="post-footer">
                    <div class="post-actions">
                  
                    </div>
                    ${(auth.currentUser && auth.currentUser.uid === p.authorId) ? `<button style="color:#FF453A; background:none; border:none; cursor:pointer;" onclick="deleteCommunityPost('${doc.id}')"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            `;
            container.appendChild(div);
        });

    } catch (error) {
        console.error("Erro comunidade:", error);
        container.innerHTML = '<div style="text-align:center; color:#FF453A;">Erro ao carregar posts. Verifique sua conexão.</div>';
    }
}

// 2. Nova Postagem
window.handleNewCommunityPost = async function(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if(!user) return showToast("Faça login para postar.", "error");

    const tipo = document.getElementById('post-type').value;
    const titulo = document.getElementById('post-title').value;
    const conteudo = document.getElementById('post-content').value;
    
    // Pega o nome do usuário logado do elemento da sidebar
    const nomeAutor = document.getElementById('sidebar-user-name').innerText || "Usuário";

    const btn = e.target.querySelector('button[type="submit"]');
    setBtnLoading(btn, true);

    try {
        await addDoc(collection(db, "community_posts"), {
            authorId: user.uid,
            authorName: nomeAutor,
            type: tipo,
            title: titulo,
            content: conteudo,
            likes: 0,
            timestamp: new Date().toISOString()
        });

        showToast("Postado com sucesso!", "success");
        fecharModalPostagem();
        loadCommunityPosts(); // Recarrega

    } catch (error) {
        console.error(error);
        showToast("Erro ao publicar.", "error");
    } finally {
        setBtnLoading(btn, false);
    }
}

// 3. Deletar Post (Só o dono)
window.deleteCommunityPost = async function(id) {
    if(!confirm("Apagar esta postagem?")) return;
    try {
        await deleteDoc(doc(db, "community_posts", id));
        showToast("Postagem removida.", "success");
        loadCommunityPosts();
    } catch(e) {
        showToast("Erro ao apagar.", "error");
    }
}

// 4. Filtros e Modais
window.filtrarComunidade = function(tipo) {
    // Atualiza visual dos botões
    document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    
    loadCommunityPosts(tipo);
}

window.abrirModalPostagem = function() {
    document.querySelector('#modal-community-post form').reset();
    document.getElementById('modal-community-post').style.display = 'flex';
}

window.fecharModalPostagem = function() {
    document.getElementById('modal-community-post').style.display = 'none';
}

// ============================================================
// RELATÓRIO DE NOTAS DE ENTRADA
// ============================================================

window.renderInvoicesTable = function(lista = null) {
    const tbody = document.getElementById("invoices-table-body");
    if (!tbody) return;

    const dados = lista || inputHistory;
    tbody.innerHTML = "";

    if (!dados || dados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:#888;">Nenhuma nota fiscal registrada. Importe um XML para começar.</td></tr>`;
        return;
    }

    // Ordena por data de emissão (mais recente primeiro)
    const dadosOrdenados = [...dados].sort((a, b) => new Date(b.dataEmissao) - new Date(a.dataEmissao));

    dadosOrdenados.forEach(nota => {
        const row = tbody.insertRow();
        
        // Data formatada
        const dataVisual = new Date(nota.dataEmissao).toLocaleDateString("pt-BR");
        const itensQtd = nota.items ? nota.items.length : (nota.itens ? nota.itens.length : 0);

        // --- CORREÇÃO DA BUSCA POR ID DO FORNECEDOR ---
        let idFornecedorEncontrado = "";
        
        // Verifica se a lista global de fornecedores existe e cruza os dados
        if (typeof fornecedoresReais !== 'undefined' && Array.isArray(fornecedoresReais)) {
            // Tenta encontrar o fornecedor pelo CNPJ (mais seguro) ou pelo Nome
            const fornecedorObj = fornecedoresReais.find(f => 
                (nota.cnpj && f.cnpj === nota.cnpj) || 
                (f.nome && nota.fornecedor && f.nome.toLowerCase() === nota.fornecedor.toLowerCase())
            );

            if (fornecedorObj) {
                idFornecedorEncontrado = fornecedorObj.id; // Pega o ID real do fornecedor (ex: 8s7d98...)
            }
        }

        // Monta a string de busca incluindo o ID DA NOTA e o ID DO FORNECEDOR
        // O usuário não vê isso, mas o filtro lê
        const searchString = `${nota.id} ${nota.numero} ${nota.fornecedor} ${nota.cnpj} R$${nota.valorTotal} ${idFornecedorEncontrado}`.toLowerCase();
        
        row.setAttribute("data-search", searchString);
        // ---------------------------------------------------

        row.innerHTML = `
            <td>${dataVisual}</td>
            <td style="font-weight:bold; color:var(--color-text-primary);">${nota.numero}</td>
            <td>
                <div>${nota.fornecedor}</div>
                <small style="color:#888; font-size:0.75rem;">${nota.cnpj || ''}</small>
                ${idFornecedorEncontrado ? `<i class="fas fa-link" title="Fornecedor Vinculado" style="font-size:0.7rem; color:#0A84FF; margin-left:5px;"></i>` : ''}
            </td>
            <td><span class="badge badge-info">${itensQtd} itens</span></td>
            <td style="font-weight:bold; color:var(--color-accent-purple);">R$ ${parseFloat(nota.valorTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
            <td>
                <div style="display:flex; gap:8px;">
                    <button class="action-btn" style="background:#FF9F0A; color:white; border:none;" onclick="adicionarFreteManual('${nota.id}')" title="Lançar Frete Manual (Rateio)">
                        <i class="fas fa-truck"></i>
                    </button>

                    <button class="action-btn view-btn" onclick="verDetalhesNota('${nota.id}')" title="Ver Itens">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteInvoice('${nota.id}')" title="Excluir Registro">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
    });
}

// EXCLUIR NOTA FISCAL (COM SENHA E LOG)
window.deleteInvoice = async function(id) {
    const user = auth.currentUser;
    if (!user) return;

    // Busca dados da nota para o log e confirmação
    const nota = inputHistory.find(n => n.id === id);
    const numeroNota = nota ? nota.numero : "Desconhecido";

    customConfirm(`Deseja excluir o registro da Nota Fiscal nº ${numeroNota}?\n\nIsso apaga o histórico de entrada, mas NÃO remove o estoque que já foi adicionado aos produtos.`, async () => {
        
        // Pede a senha do Admin
        const senha = await getPasswordViaPrompt("Segurança", "Digite sua senha de LOGIN para confirmar a exclusão:");
        if (!senha) return;

        try {
            window.showLoadingScreen("Excluindo...", "Validando permissões...");

            // Validação de Segurança
            const credential = EmailAuthProvider.credential(user.email, senha);
            await reauthenticateWithCredential(user, credential);

            // Apaga do Banco
            await deleteDoc(getUserDocumentRef("input_invoices", id));

            // 📝 LOG DE AUDITORIA
            await logSystemAction("Exclusão de Nota", `Apagou a NF nº ${numeroNota} do fornecedor ${nota.fornecedor || '?'}.`);

            window.hideLoadingScreen();
            showToast("Registro da nota excluído com sucesso!", "success");
            
            // Recarrega lista
            await loadAllData();

        } catch (error) {
            window.hideLoadingScreen();
            if (error.code === 'auth/wrong-password') {
                showToast("Senha incorreta. Ação bloqueada.", "error");
            } else {
                showToast("Erro ao excluir: " + error.message, "error");
            }
        }
    });
}

window.filterInvoicesTable = function(termo) {
    const busca = termo.toLowerCase();
    const rows = document.querySelectorAll("#invoices-table-body tr");

    rows.forEach(row => {
        const texto = row.getAttribute("data-search") || "";
        if (texto.includes(busca)) {
            row.style.display = "";
        } else {
            row.style.display = "none";
        }
    });
}

window.verDetalhesNota = function(id) {
    const nota = inputHistory.find(n => n.id === id);
    if (!nota) return;

    // 1. CORREÇÃO DO TÍTULO (Muda de "Venda" para "Nota")
    const headerTitle = document.querySelector('#sale-details-modal .modal-header h3');
    if(headerTitle) headerTitle.innerHTML = '<i class="fas fa-file-invoice"></i> Detalhes da Nota Fiscal';

    // 2. CORREÇÃO DA DATA (Força padrão brasileiro)
    let dataFormatada = "-";
    if(nota.dataEmissao) {
        // Usa UTC para evitar que o fuso horário mude o dia (ex: 12 virar 11)
        const d = new Date(nota.dataEmissao);
        if(!isNaN(d)) {
            dataFormatada = d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        } else {
            // Fallback se for string simples YYYY-MM-DD
            const p = nota.dataEmissao.split('-');
            if(p.length === 3) dataFormatada = `${p[2]}/${p[1]}/${p[0]}`;
        }
    }

    // 3. Monta Lista de Itens
    let htmlItens = `<ul style="list-style:none; padding:0; margin:0;">`;
    const listaItens = nota.items || nota.itens || [];
    
    listaItens.forEach(item => {
        htmlItens += `
            <li style="border-bottom:1px dashed #333; padding:10px 0; display:grid; grid-template-columns: 3fr 1fr; align-items:center;">
                <div style="display:flex; flex-direction:column;">
                    <span style="color:#fff; font-weight:500;">${item.qtd}x ${item.nome}</span>
                    <small style="color:#888;">Unitário: R$ ${parseFloat(item.valorUnit).toFixed(2)}</small>
                </div>
                <strong style="color:#fff; text-align:right;">R$ ${parseFloat(item.total).toFixed(2)}</strong>
            </li>
        `;
    });
    htmlItens += `</ul>`;

    // 4. Injeta no Modal (Com o botão PDF novo)
    const modal = document.getElementById('sale-details-modal');
    const content = modal.querySelector('.sale-info');
    
    content.innerHTML = `
        <div class="receipt-header" style="border-bottom:2px dashed #7B61FF; background:linear-gradient(180deg, #222 0%, #1a1d21 100%);">
            <div class="receipt-status">
                <span class="status-pill" style="background:rgba(123, 97, 255, 0.2); color:#7B61FF; border:1px solid #7B61FF;">
                    <i class="fas fa-arrow-down"></i> Nota de Entrada
                </span>
            </div>
            <div class="receipt-date" style="color:#aaa; font-family:monospace;">${dataFormatada}</div>
        </div>

        <div class="receipt-grid" style="background:#1a1d21;">
            <div class="receipt-box">
                <span class="lbl">Fornecedor</span>
                <span class="val" style="color:#fff;">${nota.fornecedor}</span>
            </div>
            <div class="receipt-box">
                <span class="lbl">Nº Nota / CNPJ</span>
                <span class="val" style="color:#aaa;">${nota.numero} <br> <small>${nota.cnpj || ''}</small></span>
            </div>
        </div>

        <div class="receipt-items-container" style="max-height:250px; overflow-y:auto; padding:15px; background:#1a1d21;">
            ${htmlItens}
        </div>

        <div class="receipt-summary" style="background:#15181c; border-top:1px dashed #444;">
            <div class="summary-row total">
                <span>TOTAL NOTA</span> 
                <span style="color:#7B61FF;">R$ ${parseFloat(nota.valorTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
        </div>
        
        <div style="padding:15px; text-align:center; background:#15181c; border-top:1px solid #333;">
            <button class="submit-btn purple-btn" onclick="imprimirNotaPDF('${nota.id}')" style="width:100%; display:flex; justify-content:center; gap:10px;">
                <i class="fas fa-file-pdf"></i> Baixar PDF da Nota
            </button>
        </div>
    `;
    
    modal.style.display = 'flex';
}


function formatarDataPtBr(dateStr) {
    try {
        if(!dateStr) return "";
        const d = new Date(dateStr);
        if(isNaN(d)) return dateStr;
        return d.toLocaleDateString('pt-BR', {timeZone:'UTC'});
    } catch(e) { return ""; }
}

// ============================================================
// LÓGICA DA SIDEBAR ACCORDION
// ============================================================


// Atualizar a função setupNavigation existente para abrir o grupo do item ativo
// Procure a função setupNavigation no seu código e adicione este trecho no final dela:

/*
   Cole este trecho DENTRO de setupNavigation(), logo antes de fechar a função,
   ou chame esta lógica no DOMContentLoaded
*/
function autoOpenActiveGroup() {
    // Encontra o item ativo
    const activeItem = document.querySelector('.nav-item.active');
    if (activeItem) {
        // Verifica se ele está dentro de um grupo
        const parentGroup = activeItem.closest('.nav-group');
        if (parentGroup) {
            parentGroup.classList.add('open');
        }
    }
}

// Chame isso ao carregar a página
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(autoOpenActiveGroup, 500); // Pequeno delay para garantir renderização
});





window.toggleNavGroup = function(header) {
    const group = header.parentElement;
    group.classList.toggle('open');
}





async function logSystemAction(acao, detalhe) {
    try {
        const user = auth.currentUser;
        if (!user) return;

        // Pega o nome do usuário logado ou "Sistema"
        const userName = document.getElementById("sidebar-user-name") 
            ? document.getElementById("sidebar-user-name").innerText 
            : user.email;

        const logData = {
            action: acao,       // Ex: "Estorno", "Exclusão", "Edição"
            detail: detalhe,    // Ex: "Venda #1234 - Motivo: Cliente desistiu"
            user: userName,     // Quem fez
            email: user.email,
            timestamp: new Date().toISOString()
        };

        // Salva na subcoleção 'audit_logs'
        await addDoc(collection(db, "users", user.uid, "audit_logs"), logData);
        console.log("📝 Log registrado:", acao);

    } catch (error) {
        console.error("Erro ao gravar log:", error);
    }
}

// 2. Renderizar Tabela de Logs (Na aba Configurações)
// 2. Renderizar Tabelas de Logs (SEPARADAS)
window.renderAuditLogs = async function() {
    const tbodyGeral = document.getElementById("audit-geral-tbody");
    const tbodyEstornos = document.getElementById("audit-estornos-tbody");
    
    if (!tbodyGeral || !tbodyEstornos) return;

    const loadingHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';
    tbodyGeral.innerHTML = loadingHTML;
    tbodyEstornos.innerHTML = loadingHTML;

    try {
        const user = auth.currentUser;
        if (!user) return;

        // Busca os últimos 100 logs para não pesar
        const q = query(collection(db, "users", user.uid, "audit_logs"), orderBy("timestamp", "desc"), limit(100));
        const querySnapshot = await getDocs(q);

        tbodyGeral.innerHTML = "";
        tbodyEstornos.innerHTML = "";

        if (querySnapshot.empty) {
            tbodyGeral.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#888;">Sem histórico recente.</td></tr>';
            tbodyEstornos.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#888;">Nenhum estorno registrado.</td></tr>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const log = doc.data();
            const dataFormatada = new Date(log.timestamp).toLocaleString("pt-BR");
            
            // --- TABELA GERAL (Mostra tudo) ---
            let corBadge = "gray";
            if (log.action.includes("Exclu")) corBadge = "#FF453A"; // Vermelho
            if (log.action.includes("Edi") || log.action.includes("Alter")) corBadge = "#FF9F0A"; // Laranja
            if (log.action.includes("Cri") || log.action.includes("Venda") || log.action.includes("Adic")) corBadge = "#30D158"; // Verde
            if (log.action.includes("Login")) corBadge = "#0A84FF"; // Azul

            const rowGeral = document.createElement("tr");
            rowGeral.innerHTML = `
                <td style="font-size:0.8rem; color:#aaa;">${dataFormatada}</td>
                <td><span class="badge" style="background:${corBadge}20; color:${corBadge}; border:1px solid ${corBadge}40; font-size:0.7rem;">${log.action}</span></td>
                <td style="font-weight:600; color:var(--color-text-primary); font-size:0.85rem;">${log.user}</td>
                <td style="font-size:0.85rem;">${log.detail}</td>
            `;
            tbodyGeral.appendChild(rowGeral);

            // --- TABELA DE ESTORNOS (Só mostra se for estorno) ---
            if (log.action.includes("Estorno")) {
                const rowEstorno = document.createElement("tr");
                rowEstorno.innerHTML = `
                    <td style="font-size:0.9rem; color:#fff;">${dataFormatada}</td>
                    <td style="font-weight:600; color:#FF453A;">${log.user}</td>
                    <td style="color:#ddd;">${log.detail}</td>
                `;
                tbodyEstornos.appendChild(rowEstorno);
            }
        });

    } catch (error) {
        console.error("Erro logs:", error);
    }
}

// ============================================================
// LÓGICA DE EDIÇÃO EM MASSA (MAGIC PEN)
// ============================================================

// 1. Atualiza a Barra Flutuante
window.updateBulkBar = function() {
    const checks = document.querySelectorAll('.product-check:checked');
    const bar = document.getElementById('bulk-actions-bar');
    const countSpan = document.getElementById('bulk-count');
    
    if (!bar) return;

    if (checks.length > 0) {
        countSpan.innerText = checks.length;
        // Faz a barra subir (aparecer)
        bar.style.transform = "translateX(-50%) translateY(0)";
    } else {
        // Faz a barra descer (sumir)
        bar.style.transform = "translateX(-50%) translateY(100px)";
    }
}

// 2. Selecionar/Deselecionar Tudo
window.toggleSelectAllProducts = function(source) {
    const checks = document.querySelectorAll('.product-check');
    checks.forEach(c => c.checked = source.checked);
    updateBulkBar();
}

window.deselecionarTudo = function() {
    const checks = document.querySelectorAll('.product-check');
    checks.forEach(c => c.checked = false);
    // Desmarca também o header se houver
    const headerCheck = document.querySelector('#product-table thead input[type="checkbox"]');
    if(headerCheck) headerCheck.checked = false;
    
    updateBulkBar();
}

// 3. Abrir o Modal e Carregar Opções
window.abrirModalBulkEdit = function() {
    const checks = document.querySelectorAll('.product-check:checked');
    if (checks.length === 0) return;
    
    // 1. Atualiza contador
    const countEl = document.getElementById('bulk-modal-count');
    if (countEl) countEl.innerText = checks.length;
    
    // 2. PREENCHE: PASTAS (Mover para Pasta)
    const selPasta = document.getElementById('bulk-pasta');
    if (selPasta) {
        selPasta.innerHTML = '<option value="">-- Não Mover --</option><option value="__REMOVE__">❌ Remover da Pasta Atual</option>';
        if (config.folders) {
            config.folders.sort().forEach(f => {
                selPasta.innerHTML += `<option value="${f}">${f}</option>`;
            });
        }
    }

    // 3. PREENCHE: CATEGORIAS (Etiqueta)
    const selCat = document.getElementById('bulk-categoria');
    if (selCat) {
        selCat.innerHTML = '<option value="">-- Não Alterar --</option>';
        if (config.categories) {
            config.categories.sort().forEach(c => {
                selCat.innerHTML += `<option value="${c}">${c}</option>`;
            });
        }
    }

    // 4. PREENCHE: ESTABELECIMENTOS
    const selEst = document.getElementById('bulk-estabelecimento');
    if (selEst) {
        selEst.innerHTML = '<option value="">-- Não Alterar --</option>';
        if (config.establishments) {
            config.establishments.sort().forEach(e => {
                selEst.innerHTML += `<option value="${e}">${e}</option>`;
            });
        }
    }

    // 5. PREENCHE: FORNECEDORES
    const selForn = document.getElementById('bulk-fornecedor');
    if (selForn) {
        selForn.innerHTML = '<option value="">-- Não Alterar --</option>';
        if (typeof fornecedoresReais !== 'undefined') {
            // Ordena fornecedores por nome
            const listaForn = [...fornecedoresReais].sort((a,b) => a.nome.localeCompare(b.nome));
            listaForn.forEach(f => {
                selForn.innerHTML += `<option value="${f.id}">${f.nome}</option>`;
            });
        }
    }

    // Abre o modal
    document.getElementById('bulk-edit-modal').style.display = 'flex';
}
// 4. Executar a Edição em Massa (O Coração da Função)
window.handleBulkEdit = async function(e) {
    e.preventDefault();
    
    const novaPasta = document.getElementById('bulk-pasta').value;
    // ... pegar outros valores ...

    const checks = document.querySelectorAll('.product-check:checked');
    const ids = Array.from(checks).map(c => c.value);
    
    customConfirm(`Alterar ${ids.length} produtos?`, async () => {
        window.showLoadingScreen("Atualizando...", "Movendo produtos...");
        const updates = [];
        
        for (const id of ids) {
            const data = {};
            // Lógica da Pasta
            if (novaPasta) {
                data.pasta = (novaPasta === '__REMOVE__') ? "" : novaPasta;
            }
            // ... lógica de categoria/fornecedor ...
            
            if (Object.keys(data).length > 0) {
                updates.push(updateDoc(getUserDocumentRef("products", id), data));
            }
        }
        
        await Promise.all(updates);
        window.hideLoadingScreen();
        document.getElementById('bulk-edit-modal').style.display = 'none';
        await loadAllData();
        showToast("Atualizado!", "success");
    });
}

// ATIVAR A VARINHA MÁGICA (SELEÇÃO VISUAL)
window.toggleSelectAllVisual = function(element) {
    // 1. Alterna estado visual da varinha
    const isActive = element.classList.contains('active');
    
    if (isActive) {
        element.classList.remove('active'); // Desliga
    } else {
        element.classList.add('active'); // Liga (Fica Azul Neon)
    }

    // 2. Marca/Desmarca todos os checkboxes reais
    const checks = document.querySelectorAll('.product-check');
    checks.forEach(c => c.checked = !isActive);

    // 3. Atualiza a barra flutuante
    updateBulkBar();
}

// Atualização extra: Quando desmarcar tudo na barra, desliga a varinha também
const originalDeselecionar = window.deselecionarTudo;
window.deselecionarTudo = function() {
    originalDeselecionar(); // Chama a original
    // Desliga a varinha visualmente
    const wand = document.getElementById('master-magic-wand');
    if(wand) wand.classList.remove('active');
}

window.renderAuditLogs = renderAuditLogs;

// ============================================================
// SUPER SINCRONIZAÇÃO DE HISTÓRICO (Mão Dupla)
// ============================================================
window.sincronizarHistoricoCompleto = async function() {
    const user = auth.currentUser;
    if (!user) return;

    customConfirm("⚠️ ATENÇÃO: MODO DE CORREÇÃO PROFUNDA\n\nO sistema vai procurar produtos nas notas fiscais antigas comparando NOME e CÓDIGO DE BARRAS.\n\nSe encontrar, ele vai substituir o código atual pelo código da nota (cProd).\n\nDeseja continuar?", async () => {
        
        try {
            window.showLoadingScreen("Analisando...", "Comparando estoque com histórico de notas...");
            
            let produtosCorrigidos = 0;
            const updates = [];

            // Função para limpar strings para comparação (remove espaços extras e deixa minusculo)
            const limparTexto = (txt) => txt ? txt.toString().trim().toLowerCase().replace(/\s+/g, ' ') : "";

            console.log("--- INICIANDO VARREDURA ---");

            // 1. Percorre TODOS os produtos do estoque
            for (const prod of products) {
                
                let novoCodigoNota = null;
                let novoEAN = null;
                let encontrouNaNota = false;

                // Nome do produto limpo para busca
                const nomeProdLimpo = limparTexto(prod.nome);
                const eanProd = prod.codigoBarras ? prod.codigoBarras.trim() : "";

                // 2. Procura esse produto em TODAS as notas fiscais
                for (const nota of inputHistory) {
                    if (nota.items) {
                        const itemNota = nota.items.find(i => {
                            const nomeItemLimpo = limparTexto(i.nome);
                            const eanItem = i.ean ? i.ean.trim() : "";

                            // COMPARAÇÃO 1: Código de Barras Bate? (Mais forte)
                            if (eanItem && eanProd && eanItem === eanProd && eanItem !== "SEM GTIN") {
                                return true;
                            }

                            // COMPARAÇÃO 2: Nome Bate? (Exato)
                            if (nomeItemLimpo === nomeProdLimpo) {
                                return true;
                            }

                            return false;
                        });

                        if (itemNota) {
                            // ACHOU NA NOTA!
                            novoCodigoNota = itemNota.cProd; // Código interno da nota (Ex: 175200)
                            novoEAN = itemNota.ean;          // EAN da nota
                            encontrouNaNota = true;
                            break; // Para de procurar nas outras notas
                        }
                    }
                }

                // 3. SE ACHOU, VERIFICA SE PRECISA ATUALIZAR
                if (encontrouNaNota) {
                    let precisaSalvar = false;
                    const dadosParaAtualizar = {};

                    // REGRA 1: O código atual é "feio" (ID do banco > 15 chars) OU está vazio OU é diferente do da nota?
                    const codigoAtual = prod.cProd || "";
                    const codigoEhFeio = codigoAtual.length > 15; // IDs do firebase tem 20 chars
                    const codigoEhDiferente = codigoAtual !== novoCodigoNota;

                    if (novoCodigoNota && (codigoEhFeio || codigoEhDiferente)) {
                        console.log(`🔧 Corrigindo Cód: ${prod.nome} | Antigo: ${codigoAtual} -> Novo: ${novoCodigoNota}`);
                        dadosParaAtualizar.cProd = novoCodigoNota;
                        precisaSalvar = true;
                    }

                    // REGRA 2: Preencher EAN se estiver faltando
                    if (novoEAN && novoEAN !== "SEM GTIN" && (!prod.codigoBarras || prod.codigoBarras === "")) {
                        console.log(`📦 Preenchendo EAN: ${prod.nome} -> ${novoEAN}`);
                        dadosParaAtualizar.codigoBarras = novoEAN;
                        precisaSalvar = true;
                    }

                    // 4. Adiciona na fila de atualização
                    if (precisaSalvar) {
                        const docRef = getUserDocumentRef("products", prod.id);
                        updates.push(updateDoc(docRef, dadosParaAtualizar));
                        produtosCorrigidos++;
                    }
                }
            }

            console.log(`--- FIM DA VARREDURA: ${produtosCorrigidos} correções encontradas ---`);

            // 5. Executa tudo de uma vez
            if (updates.length > 0) {
                await Promise.all(updates);
                
                await logSystemAction("Correção em Massa", `Corrigiu códigos de ${produtosCorrigidos} produtos.`);
                
                window.hideLoadingScreen();
                customAlert(`Sucesso! ${produtosCorrigidos} produtos foram corrigidos.\nOs códigos estranhos foram substituídos pelos códigos da Nota Fiscal.`, "success");
                
                await loadAllData(); // Recarrega a tela
            } else {
                window.hideLoadingScreen();
                // Se der zero, explica o motivo provável no console
                console.warn("Nenhuma correção feita. Motivos possíveis: Nomes muito diferentes ou produtos não existem nas notas importadas.");
                showToast("Nenhuma correção necessária encontrada. Verifique se os nomes dos produtos batem com as notas.", "info");
            }

        } catch (error) {
            window.hideLoadingScreen();
            console.error(error);
            customAlert("Erro na sincronização: " + error.message, "error");
        }
    });
}

window.adicionarFreteManual = async function(idNota) {
    const user = auth.currentUser;
    if (!user) return;

    // 1. Busca a nota
    const nota = inputHistory.find(n => n.id === idNota);
    if (!nota) return showToast("Nota não encontrada.", "error");

    // 2. Cria o HTML do Modal de Frete Dinamicamente
    // (Não precisa mexer no app.html, ele cria e destroi sozinho)
    const existingModal = document.getElementById('modal-frete-custom');
    if(existingModal) existingModal.remove();

    const modalHTML = `
    <div id="modal-frete-custom" class="modal-overlay" style="display:flex; z-index: 5000;">
        <div class="modal-content" style="max-width: 450px;">
            <h3><i class="fas fa-truck"></i> Lançamento de Frete</h3>
            <p style="color:#aaa; font-size:0.9rem; margin-bottom:15px;">
                Nota Nº <strong>${nota.numero}</strong> | Fornecedor: ${nota.fornecedor}
            </p>

            <div class="form-group">
                <label>Valor Total do Frete (R$)</label>
                <input type="text" id="frete-valor-input" class="config-input" placeholder="0,00" style="font-size:1.2rem; font-weight:bold; color:var(--color-accent-green);">
            </div>

            <div class="form-group">
                <label>Método de Distribuição (Rateio)</label>
                <select id="frete-tipo-select" class="config-input">
                    <option value="valor">Por Valor (Proporcional ao Preço)</option>
                    <option value="qtd">Por Unidade (Igual por Item)</option>
                    <option value="linha">Por Produto (Igual por Linha)</option>
                </select>
                <small id="frete-desc-help" style="display:block; margin-top:5px; color:#888; font-size:0.8rem;">
                    Recomendado: Produtos mais caros absorvem mais frete.
                </small>
            </div>

            <div class="modal-actions">
                <button type="button" class="submit-btn delete-btn" onclick="document.getElementById('modal-frete-custom').remove()">Cancelar</button>
                <button type="button" class="submit-btn green-btn" onclick="confirmarRateioFrete('${idNota}')">Confirmar Rateio</button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Foca no input e adiciona listener para explicar as opções
    setTimeout(() => {
        const input = document.getElementById('frete-valor-input');
        input.focus();
        
        const select = document.getElementById('frete-tipo-select');
        const help = document.getElementById('frete-desc-help');
        
        select.addEventListener('change', () => {
            if(select.value === 'valor') help.innerText = "Recomendado: Produtos mais caros absorvem mais frete.";
            if(select.value === 'qtd') help.innerText = "Simples: Divide o valor total pela quantidade de peças.";
            if(select.value === 'linha') help.innerText = "Raro: Divide o valor pelo número de itens diferentes na nota.";
        });
    }, 100);
}

window.confirmarRateioFrete = async function(idNota) {
    const valorInput = document.getElementById('frete-valor-input').value;
    const metodo = document.getElementById('frete-tipo-select').value;
    const modal = document.getElementById('modal-frete-custom');

    // Converte "100,00" para 100.00
    const freteTotal = parseFloat(valorInput.replace(/\./g, '').replace(',', '.')) || 0;

    if (freteTotal <= 0) {
        alert("Digite um valor válido.");
        return;
    }

    try {
        window.showLoadingScreen("Calculando Rateio...", "Atualizando custo dos produtos...");
        
        const nota = inputHistory.find(n => n.id === idNota);
        const itens = nota.items || nota.itens || [];
        const batchUpdates = [];
        let itensAtualizados = 0;

        // --- CÁLCULOS TOTAIS PARA AS FÓRMULAS ---
        const totalValorNota = itens.reduce((acc, i) => acc + (parseFloat(i.total)||0), 0);
        const totalQtdPecas = itens.reduce((acc, i) => acc + (parseFloat(i.qtd)||parseFloat(i.quantity)||1), 0);
        const totalLinhas = itens.length;

        // --- LOOP DE ATUALIZAÇÃO ---
        for (const item of itens) {
            // Busca o produto no estoque
            let prod = products.find(p => p.id === item.productId || p.id === item.cProd);
            if (!prod) {
                prod = products.find(p => p.codigoBarras === item.ean || p.nome === item.nome);
            }

            if (prod) {
                const valorItem = parseFloat(item.total) || 0;
                const qtdItem = parseFloat(item.qtd) || parseFloat(item.quantity) || 1;
                
                let freteUnitarioCalculado = 0;

                // === A MÁGICA DOS 3 MÉTODOS ===
                
                // 1. POR VALOR (Padrão Contábil - Mais justo)
                if (metodo === 'valor') {
                    if (totalValorNota > 0) {
                        const proporcao = valorItem / totalValorNota; 
                        const freteDoItemTotal = freteTotal * proporcao; 
                        freteUnitarioCalculado = freteDoItemTotal / qtdItem;
                    }
                }
                
                // 2. POR QUANTIDADE (Simples)
                else if (metodo === 'qtd') {
                    if (totalQtdPecas > 0) {
                        freteUnitarioCalculado = freteTotal / totalQtdPecas;
                    }
                }
                
                // 3. POR LINHA (Igualitário)
                else if (metodo === 'linha') {
                    if (totalLinhas > 0) {
                        const fretePorLinha = freteTotal / totalLinhas;
                        freteUnitarioCalculado = fretePorLinha / qtdItem;
                    }
                }

                // Atualiza o produto (Apenas o campo frete, que compõe o custo total)
                const docRef = getUserDocumentRef("products", prod.id);
                batchUpdates.push(updateDoc(docRef, { 
                    frete: freteUnitarioCalculado 
                }));
                itensAtualizados++;
            }
        }

        await Promise.all(batchUpdates);

        // --- REMOVIDO: BLOCO QUE LANÇAVA DESPESA AUTOMÁTICA ---
        // O valor agora está diluído no custo do produto (CMV)
        // e será abatido no momento da venda (Margem de Lucro).

        window.hideLoadingScreen();
        if(modal) modal.remove();
        
        await logSystemAction("Frete Rateado", `Valor R$ ${freteTotal.toFixed(2)} absorvido nos custos da nota ${nota.numero}.`);
        
        customAlert(`Sucesso!\n\nO Frete de R$ ${freteTotal.toFixed(2)} foi incorporado ao CUSTO de ${itensAtualizados} produtos.\n(Não foi gerada despesa separada).`, "success");
        
        await loadAllData();

    } catch (error) {
        window.hideLoadingScreen();
        console.error(error);
        alert("Erro: " + error.message);
    }
}


// Variável global
let produtosFiltradosGlobal = [];

window.aplicarFiltrosAvancados = function() {
    const input = document.getElementById('universal-search');
    const termo = input ? input.value.toLowerCase().trim() : "";
    const btnClear = document.getElementById('clear-search-btn');

    if(btnClear) btnClear.style.display = termo.length > 0 ? 'block' : 'none';

    // 1. FILTRAGEM
    produtosFiltradosGlobal = products.filter(p => {
        // Filtro de Pasta (Lateral)
        if (typeof pastaSelecionada !== 'undefined' && pastaSelecionada !== 'todos') {
            if (pastaSelecionada === 'sem_pasta') {
                if (p.pasta && p.pasta !== "") return false;
            } else if (p.pasta !== pastaSelecionada) {
                return false;
            }
        }

        // Filtro de Texto
        if (termo) {
            const textao = [
                p.nome, p.cProd, p.codigoBarras, p.fornecedor, p.categoria, p.marca
            ].join(' ').toLowerCase();
            if (!textao.includes(termo)) return false;
        }
        return true;
    });

    // 2. ORDENAÇÃO (Aqui estão as novas opções)
    const sortMode = document.getElementById('sort-order') ? document.getElementById('sort-order').value : 'nome-asc';
    
    produtosFiltradosGlobal.sort((a, b) => {
        const nomeA = a.nome || "";
        const nomeB = b.nome || "";
        const precoA = parseFloat(a.preco) || 0;
        const precoB = parseFloat(b.preco) || 0;
        const estA = parseInt(a.quantidade) || 0;
        const estB = parseInt(b.quantidade) || 0;
        const catA = a.categoria || "";
        const catB = b.categoria || "";

        switch(sortMode) {
            case 'nome-asc': return nomeA.localeCompare(nomeB);
            case 'nome-desc': return nomeB.localeCompare(nomeA);
            
            case 'custo-asc': return precoA - precoB; // Menor Preço
            case 'custo-desc': return precoB - precoA; // Maior Preço
            
            case 'estoque-asc': return estA - estB;
            case 'estoque-desc': return estB - estA;
            
            case 'categoria': return catA.localeCompare(catB); // Agrupa por categoria
            
            case 'data-entrada': 
                // Se tiver timestamp real usa, senão mantém ordem de criação
                return (b.timestamp || 0) > (a.timestamp || 0) ? 1 : -1;
                
            default: return 0;
        }
    });

    renderProductTable(produtosFiltradosGlobal);
    
    // Atualiza contador
    const totalEl = document.getElementById('total-products');
    if(totalEl) totalEl.innerText = `${produtosFiltradosGlobal.length} itens`;
}

// Função para o botão X
window.limparBuscaProdutos = function() {
    const input = document.getElementById('universal-search');
    input.value = "";
    input.focus();
    aplicarFiltrosAvancados(); // Chama a lógica de reset acima
}

// =================================================================
// 🚨 CORREÇÃO DEFINITIVA: RESET, IMAGEM E LOADING 🚨
// COLE ISSO NO FINAL DO SEU SCRIPT.JS PARA SOBRESCREVER TUDO
// =================================================================



// ============================================================
// SISTEMA DE PASTAS E ORGANIZAÇÃO (EXPLORER)
// ============================================================

// Variável para saber qual pasta está aberta
let pastaAtual = { tipo: 'todos', valor: '' };

// 1. Renderiza a Barra Lateral de Pastas
window.renderProductFolders = function() {
    const containerCat = document.getElementById('folder-list-categorias');
    const containerLoc = document.getElementById('folder-list-locais');
    
    if(!containerCat || !containerLoc) return;

    // A. Conta quantos produtos tem em cada categoria/local
    const countCat = {};
    const countLoc = {};
    
    products.forEach(p => {
        const cat = p.categoria || "Sem Categoria";
        const loc = p.estabelecimento || "Matriz";
        
        countCat[cat] = (countCat[cat] || 0) + 1;
        countLoc[loc] = (countLoc[loc] || 0) + 1;
    });

    // Atualiza o contador "Todos"
    const elTodos = document.getElementById('count-todos');
    if(elTodos) elTodos.innerText = products.length;

    // B. Gera HTML Categorias
    containerCat.innerHTML = "";
    Object.keys(countCat).sort().forEach(cat => {
        containerCat.innerHTML += `
            <div class="folder-item" onclick="filtrarPorPasta('categoria', '${cat}', this)">
                <div style="display:flex; align-items:center;">
                    <i class="fas fa-folder" style="color:#0A84FF;"></i> ${cat}
                </div>
                <span class="folder-count">${countCat[cat]}</span>
            </div>
        `;
    });

    // C. Gera HTML Locais
    containerLoc.innerHTML = "";
    Object.keys(countLoc).sort().forEach(loc => {
        containerLoc.innerHTML += `
            <div class="folder-item" onclick="filtrarPorPasta('estabelecimento', '${loc}', this)">
                <div style="display:flex; align-items:center;">
                    <i class="fas fa-map-marker-alt" style="color:#FF453A;"></i> ${loc}
                </div>
                <span class="folder-count">${countLoc[loc]}</span>
            </div>
        `;
    });
}

// 2. Ação de Clicar na Pasta
window.filtrarPorPasta = function(tipo, valor, elementoClicado) {
    // Atualiza visual (classe active)
    document.querySelectorAll('.folder-item').forEach(el => el.classList.remove('active'));
    if(elementoClicado) elementoClicado.classList.add('active');

    // Atualiza estado global
    pastaAtual = { tipo: tipo, valor: valor };

    // Atualiza Título da Lista
    const tituloDisplay = document.getElementById('folder-title-display');
    if(tituloDisplay) {
        if(tipo === 'todos') {
            tituloDisplay.innerHTML = '<i class="fas fa-folder-open" style="color:#FF9F0A;"></i> Todos os Produtos';
        } else if (tipo === 'categoria') {
            tituloDisplay.innerHTML = `<i class="fas fa-folder-open" style="color:#0A84FF;"></i> Pasta: ${valor}`;
        } else {
            tituloDisplay.innerHTML = `<i class="fas fa-map-marker-alt" style="color:#FF453A;"></i> Local: ${valor}`;
        }
    }

    // Chama o filtro principal para aplicar
    aplicarFiltrosAvancados();
}




// ============================================================
// SISTEMA DE ARQUIVOS (PASTAS) v2.0
// ============================================================

// 1. Criar Nova Pasta (Na verdade, cria uma Categoria)
window.criarNovaPasta = async function() {
    // Usa seu prompt customizado se tiver, senão o nativo
    const nomePasta = prompt("Nome da Nova Pasta:");
    
    if (nomePasta && nomePasta.trim()) {
        const nomeFinal = nomePasta.trim();
        
        // Verifica duplicidade
        if (config.categories.includes(nomeFinal)) {
            alert("Esta pasta já existe!");
            return;
        }

        // Adiciona à lista de categorias (que usamos como pastas)
        config.categories.push(nomeFinal);
        config.categories.sort(); // Ordena alfabeticamente

        // Salva
        persistData();
        await saveConfigToFirebase(); // Salva na nuvem

        // Atualiza UI
        renderFolderTree();
        showToast(`Pasta "${nomeFinal}" criada!`, "success");
    }
}

// 2. Renderizar Árvore de Pastas
window.renderFolderTree = function() {
    const container = document.getElementById('custom-folders-list');
    if (!container) return;
    
    container.innerHTML = "";
    
    // Garante que a config existe
    if (!config.folders) config.folders = [];

    if (config.folders.length === 0) {
        document.getElementById('no-folders-msg').style.display = 'block';
    } else {
        document.getElementById('no-folders-msg').style.display = 'none';
    }

    // Conta produtos por pasta
    const countMap = {};
    products.forEach(p => {
        if (p.pasta) countMap[p.pasta] = (countMap[p.pasta] || 0) + 1;
    });

    config.folders.forEach(pasta => {
        const div = document.createElement('div');
        div.className = 'folder-item';
        if (pastaSelecionada === pasta) div.classList.add('active');
        
        // Ação de clique na DIV inteira (Filtrar)
        div.onclick = (e) => {
            // Se clicou nos botões de ação, não filtra
            if (e.target.closest('.folder-btn-mini')) return;
            filtrarPorPastaReal(pasta, div);
        };

        const qtd = countMap[pasta] || 0;

        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
                <i class="fas fa-folder folder-icon"></i>
                <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${pasta}</span>
                ${qtd > 0 ? `<span style="font-size:0.7rem; background:rgba(255,255,255,0.1); padding:1px 6px; border-radius:10px;">${qtd}</span>` : ''}
            </div>
            
            <div class="folder-actions">
                <button class="folder-btn-mini" onclick="editarPasta('${pasta}')" title="Renomear">
                    <i class="fas fa-pencil-alt"></i>
                </button>
                <button class="folder-btn-mini delete" onclick="excluirPasta('${pasta}')" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(div);
    });
    
    // Atualiza Total Geral
    const badgeTotal = document.getElementById('badge-total-items');
    if(badgeTotal) badgeTotal.innerText = products.length;
}


// 3. Filtrar ao Clicar na Pasta
window.filtrarPorPastaReal = function(pasta, element) {
    pastaSelecionada = pasta;
    
    // Atualiza Visual Active
    document.querySelectorAll('.folder-item').forEach(el => el.classList.remove('active'));
    if (element) element.classList.add('active');
    else renderFolderTree(); // Re-renderiza para marcar o certo se não passou elemento

    // Texto do Rodapé
    const path = document.getElementById('folder-path-display');
    if (path) path.innerHTML = `<i class="fas fa-folder-open"></i> / ${pasta === 'todos' ? 'Todos' : pasta}`;

    aplicarFiltrosAvancados(); // Chama o filtro mestre
}

let pastaSelecionada = 'todos'; // Variável de controle

// 1. Criar Pasta (CORRIGIDA - TEXTO VISÍVEL)
window.criarNovaPastaReal = async function() {
    // Agora usa getTextoViaPrompt em vez de getPasswordViaPrompt
    const nome = await getTextoViaPrompt("Nova Pasta", "Nome da pasta:", ""); 
    
    if (!nome) return;

    if (!config.folders) config.folders = [];
    
    if (config.folders.includes(nome)) {
        showToast("Essa pasta já existe!", "info");
        return;
    }

    config.folders.push(nome);
    config.folders.sort();

    await saveConfigToFirebase(); // Salva no banco para não sumir
    renderFolderTree();
    showToast("Pasta criada!", "success");
}

// 2. Editar Pasta (CORRIGIDA - TEXTO VISÍVEL)
window.editarPasta = async function(nomeAtual) {
    // Agora usa getTextoViaPrompt
    const novoNome = await getTextoViaPrompt("Renomear Pasta", `Novo nome para "${nomeAtual}":`, nomeAtual);
    
    if (!novoNome || novoNome === nomeAtual) return;

    // Atualiza a lista
    const index = config.folders.indexOf(nomeAtual);
    if (index !== -1) config.folders[index] = novoNome;

    // Atualiza produtos
    window.showLoadingScreen("Atualizando...", "Movendo produtos...");
    const updates = [];
    
    products.forEach(p => {
        if (p.pasta === nomeAtual) {
            const ref = getUserDocumentRef("products", p.id);
            updates.push(updateDoc(ref, { pasta: novoNome }));
            p.pasta = novoNome; 
        }
    });

    if (updates.length > 0) await Promise.all(updates);

    await saveConfigToFirebase(); // Salva no banco
    window.hideLoadingScreen();
    
    renderFolderTree();
    
    if (typeof pastaSelecionada !== 'undefined' && pastaSelecionada === nomeAtual) {
        filtrarPorPastaReal(novoNome);
    }
    
    showToast("Pasta renomeada!", "success");
}



// 3. Excluir Pasta
window.excluirPasta = async function(nomePasta) {
    // Verifica se tem produtos
    const temProdutos = products.some(p => p.pasta === nomePasta);
    
    let msg = `Excluir a pasta "${nomePasta}"?`;
    if (temProdutos) {
        `\n\n⚠️ ATENÇÃO: Os produtos dentro dela NÃO serão apagados, eles ficarão "Sem Pasta".`;
    }

    customConfirm(msg, async () => {
        // Remove da lista
        config.folders = config.folders.filter(f => f !== nomePasta);
        
        // Remove a etiqueta de pasta dos produtos (opcional, mas limpo)
        const updates = [];
        products.forEach(p => {
            if (p.pasta === nomePasta) {
                const ref = getUserDocumentRef("products", p.id);
                updates.push(updateDoc(ref, { pasta: "" })); // Limpa o campo pasta
                p.pasta = "";
            }
        });

        if (updates.length > 0) await Promise.all(updates);

        await salvarConfiguracoesGlobais();
        renderFolderTree();
        filtrarPorPastaReal('todos'); // Volta pro início
        showToast("Pasta removida.", "success");
    });
}


async function salvarConfiguracoesGlobais() {
    const user = auth.currentUser;
    if(!user) return;
    try {
        await setDoc(doc(db, "users", user.uid, "settings", "general"), {
            folders: config.folders // Salva a lista de pastas
        }, { merge: true });
    } catch(e) { console.error("Erro ao salvar pastas", e); }
}


// Função auxiliar para pedir TEXTO NORMAL (sem bolinha de senha)
function getTextoViaPrompt(title, message, defaultValue = "") {
    return new Promise((resolve) => {
        // O último argumento "text" garante que não seja senha
        window.customPrompt(title, message, (valor) => {
            resolve(valor); 
        }, defaultValue, "text"); 
    });
}



window.updateProductSupplierDropdown = updateProductSupplierDropdown;
window.abrirModalEtiquetas = abrirModalEtiquetas;
window.filtrarListaEtiquetas = filtrarListaEtiquetas;
window.toggleTodasEtiquetas = toggleTodasEtiquetas;
window.gerarPDFEtiquetasSelecionadas = gerarPDFEtiquetasSelecionadas;
window.processarXMLNota = processarXMLNota;
window.handleExpenseForm = handleExpenseForm;
window.deleteExpense = deleteExpense;
window.loadFinancialDashboard = loadFinancialDashboard;
window.reverseSale = reverseSale;
window.abrirMuralAniversarios = abrirMuralAniversarios;
window.renderizarMuralAniversarios = renderizarMuralAniversarios;
window.toggleNavGroup = toggleNavGroup;
window.setupNavigation = setupNavigation;
window.autoOpenActiveGroup = autoOpenActiveGroup;
