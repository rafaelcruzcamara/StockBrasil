import { showLoadingScreen, hideLoadingScreen } from './utils.js';

// 1. Manuseio de Imagem
export function converterImagemParaBase64(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        showLoadingScreen("Processando...", "Otimizando imagem...");

        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.src = e.target.result;
            img.onload = function() {
                const maxWidth = 800;
                const maxHeight = 800;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
                } else {
                    if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

                const inputHidden = document.getElementById('prodImagem');
                const preview = document.getElementById('form-image-preview');
                const placeholder = document.getElementById('form-image-placeholder');

                if(inputHidden) inputHidden.value = dataUrl;
                
                if (preview && placeholder) {
                    preview.src = dataUrl;
                    preview.style.display = 'block';
                    placeholder.style.display = 'none';
                }
                hideLoadingScreen();
            };
            img.onerror = function() {
                hideLoadingScreen();
                alert("Erro ao ler imagem.");
            };
        };
        reader.readAsDataURL(file);
    }
}

export function limparImagemForm() {
    const inputHidden = document.getElementById('prodImagem');
    const inputFile = document.getElementById('prodImagemFile');
    if(inputHidden) inputHidden.value = "";
    if(inputFile) inputFile.value = ""; 
    
    const preview = document.getElementById('form-image-preview');
    const placeholder = document.getElementById('form-image-placeholder');
    
    if (preview) {
        preview.src = "data:,"; 
        preview.style.cssText = "display: none !important;";
    }
    if (placeholder) {
        placeholder.style.cssText = "display: flex !important;";
    }
}

// 2. Cálculos de Preço
export function calcularPrecificacao(origem) {
    const elCusto = document.getElementById('custo');
    const elFrete = document.getElementById('prodFrete');
    const elMarkup = document.getElementById('prodMarkup');
    const elSugerido = document.getElementById('precoSugeridoDisplay');
    const elPrecoFinal = document.getElementById('preco');
    const elSwitch = document.getElementById('autoMarkupSwitch');
    const elLabel = document.getElementById('label-mode');

    const lerValor = (val) => {
        if(!val) return 0;
        if(typeof val === 'number') return val;
        return parseFloat(val.toString().replace(/\./g, '').replace(',', '.')) || 0;
    };
    const formatar = (val) => val.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});

    const custo = parseFloat(elCusto.value) || 0;
    const frete = lerValor(elFrete ? elFrete.value : "0"); 
    const markup = parseFloat(elMarkup.value) || 0;
    const custoTotal = custo + frete;
    const isAuto = elSwitch ? elSwitch.checked : true;

    const valorSugerido = custoTotal * markup;
    if (elSugerido) elSugerido.value = `R$ ${formatar(valorSugerido)}`;

    if (isAuto && elPrecoFinal) {
        if(elLabel) { elLabel.innerText = "Automático"; elLabel.style.color = "#0A84FF"; }
        elPrecoFinal.setAttribute('readonly', true);
        elPrecoFinal.style.opacity = "0.7";
        if (origem !== 'edit') elPrecoFinal.value = formatar(valorSugerido);
    } else if (elPrecoFinal) {
        if(elLabel) { elLabel.innerText = "Manual"; elLabel.style.color = "#FF9F0A"; }
        elPrecoFinal.removeAttribute('readonly');
        elPrecoFinal.style.opacity = "1";
        if ((!elPrecoFinal.value) && origem !== 'edit') elPrecoFinal.value = formatar(custoTotal);
    }

    const precoVenda = lerValor(elPrecoFinal ? elPrecoFinal.value : "0");
    const lucro = precoVenda - custoTotal;
    let margem = 0;
    if (precoVenda > 0) margem = (lucro / precoVenda) * 100;

    const spanLucro = document.getElementById('spanLucro');
    const spanMargem = document.getElementById('spanMargem');

    if(spanLucro) {
        spanLucro.innerText = `R$ ${formatar(lucro)}`;
        spanLucro.style.color = lucro < 0 ? '#FF453A' : 'var(--color-accent-green)';
    }
    if(spanMargem) {
        spanMargem.innerText = `${margem.toFixed(1)}%`;
        spanMargem.style.color = margem < 0 ? '#FF453A' : (margem < 20 ? '#FF9F0A' : 'var(--color-accent-green)');
    }
}

// 3. Atualização de Selects (Listas)
export function updateCategorySelect(selectedCategory = "") {
    let select = document.getElementById("categoria");
    if (!select) return;
    select.innerHTML = "";

    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "Selecione uma categoria";
    emptyOption.disabled = true;
    emptyOption.selected = !selectedCategory;
    select.appendChild(emptyOption);

    const categories = Array.isArray(window.config.categories) ? window.config.categories : [];
    categories.forEach((cat) => {
        const option = document.createElement("option");
        option.value = cat;
        option.textContent = cat;
        if (cat === selectedCategory) option.selected = true;
        select.appendChild(option);
    });

    if (categories.length > 0 && !selectedCategory) select.value = categories[0];
}

export function updateEstablishmentSelect(selected = "") {
    const select = document.getElementById("prodEstabelecimento");
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione...</option>';
    const ests = window.config.establishments || ["Matriz"];

    ests.forEach(est => {
        const option = document.createElement("option");
        option.value = est;
        option.textContent = est;
        if (est === selected) option.selected = true;
        select.appendChild(option);
    });
}

export function updateProductSupplierDropdown() {
    const select = document.getElementById('prodFornecedor');
    if(!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">Geral / Sem Fornecedor</option>';
    
    const forns = window.fornecedoresReais || [];
    forns.forEach(s => {
        const option = document.createElement("option");
        option.value = s.id; 
        option.textContent = s.nome;
        select.appendChild(option);
    });

    if(currentValue) select.value = currentValue;
}

// 4. Reset
export function resetProductForm() {
    const form = document.querySelector(".product-form");
    if (form) {
        form.reset();
        document.getElementById("product-id").value = "";
        
        const title = document.getElementById("form-title");
        if(title) title.innerHTML = '<i class="fas fa-box"></i> Novo Produto';
        
        const btn = document.getElementById("submit-btn");
        if(btn) {
            btn.innerHTML = '<i class="fas fa-plus-circle"></i> Cadastrar Produto';
            btn.className = "submit-btn blue-btn";
        }
        
        document.getElementById("cancel-edit-btn").style.display = "none";
        
        limparImagemForm();
        
        // Reset defaults
        const unidade = document.getElementById("unidade");
        if(unidade) unidade.value = "UN";
        const markup = document.getElementById("prodMarkup");
        if(markup) markup.value = "2.0";
        const switchAuto = document.getElementById('autoMarkupSwitch');
        if(switchAuto) switchAuto.checked = true;

        setTimeout(() => {
            if(window.config && window.config.categories) {
                updateCategorySelect(window.config.categories[0] || "");
            }
            calcularPrecificacao('reset');
        }, 100);
        
        const formTab = document.getElementById('product-form-tab');
        if(formTab) formTab.scrollIntoView({ behavior: 'smooth' });
    }
}