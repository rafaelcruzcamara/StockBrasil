//os erros no consele sumiram, mas ao reniciar a page os produtos ainda somem

// =================================================================
// NOVO: ENDEREÇO BASE DA API
// =================================================================
const API_BASE_URL = 'http://localhost:3000/api'; 
// A porta 3000 deve ser a mesma que o seu Backend está rodando

// =================================================================
// 1. DADOS E INICIALIZAÇÃO
// =================================================================

let products = [];

let cart = [];
let salesHistory = [];
let savedCarts = [];
let logHistory = [];

let config = {
    categories: ["Vestuário", "Eletrônicos", "Brindes", "Serviços", "Outros"],
    paymentTypes: ["Pix", "Cartão de Crédito", "Dinheiro", "Boleto"]
};
let clients = [];
let systemConfig = {
    alertsEnabled: true,
    autoSaveInterval: 5,
    defaultReportPeriod: 30,
    showProfitMargin: true,
    defaultPaymentMethod: "Pix",
    autoPrintReceipt: false,
    theme: "dark",
    compactMode: false
};

// =================================================================
// 2. FUNÇÕES UTILITÁRIAS E PERSISTÊNCIA
// =================================================================



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
        // localStorage.setItem('products', JSON.stringify(products)); // REMOVIDO!
        localStorage.setItem('salesHistory', JSON.stringify(salesHistory));
        localStorage.setItem('savedCarts', JSON.stringify(savedCarts));
        localStorage.setItem('logHistory', JSON.stringify(logHistory));
        localStorage.setItem('config', JSON.stringify(config));
        localStorage.setItem('systemConfig', JSON.stringify(systemConfig));
        // ... (Mantenha a persistência de outras variáveis locais)
    } catch (error) {
        console.error('❌ Erro ao persistir dados locais:', error);
    }
}

async function loadAllData() {
    try {
        // 1. CARREGA PRODUTOS DA API (NOVO)
        const response = await fetch(`${API_BASE_URL}/products`);
        if (!response.ok) {
            throw new Error(`Falha ao buscar produtos: ${response.statusText}`);
        }
        products = await response.json(); // Preenche a variável global 'products'

        // 2. CARREGA DEMAIS DADOS DO LOCALSTORAGE (TEMPORÁRIO)
        salesHistory = safeLocalStorageParse('salesHistory', []);
        savedCarts = safeLocalStorageParse('savedCarts', []);
        logHistory = safeLocalStorageParse('logHistory', []);
        config = safeLocalStorageParse('config', config); // Usando valor default global
        systemConfig = safeLocalStorageParse('systemConfig', systemConfig); // Usando valor default global

        console.log('✅ Dados carregados. Produtos vieram da API.');
    } catch (error) {
        console.error('❌ FATAL: Erro ao carregar dados. Usando dados vazios.', error);
        products = []; 
    }
}

function logAction(type, detail) {
    const action = {
        id: Date.now(),
        timestamp: new Date().toLocaleString('pt-BR'),
        type: type,
        detail: detail
    };
    logHistory.unshift(action);
    if (logHistory.length > 50) logHistory.pop();
    renderHistoryLog();
    persistData();
}

// -------------------------------------------------------------
// CRUD DE PRODUTOS (SALVAR) - AGORA ASSÍNCRONA VIA API!
// -------------------------------------------------------------
async function saveProduct() {
    // Note: O id do MongoDB é uma string, não um número.
    const isEditing = document.getElementById('product-id').value !== '';
    const productId = document.getElementById('product-id').value;
    
    // ⚠️ Atenção: A validação e UI (mensagens de erro) não estão neste código, mas devem ser mantidas do seu código original.

    const productData = {
        nome: document.getElementById('product-name').value,
        categoria: document.getElementById('product-category').value,
        preco: parseFloat(document.getElementById('product-price').value),
        custo: parseFloat(document.getElementById('product-cost').value || 0),
        quantidade: parseInt(document.getElementById('product-quantity').value),
        minimo: parseInt(document.getElementById('product-min-stock').value || 0)
    };
    
    // Verificação de validação básica (mantenha a sua validação completa)
    if (!productData.nome || isNaN(productData.preco) || isNaN(productData.quantidade)) {
        alert("Por favor, preencha todos os campos obrigatórios (Nome, Preço, Quantidade).");
        return;
    }

    try {
        let response;
        let method;
        let url;

        if (isEditing) {
            // ATUALIZAÇÃO (PATCH) - Usa o ID do MongoDB
            method = 'PATCH';
            url = `${API_BASE_URL}/products/${productId}`; 
            
        } else {
            // CRIAÇÃO (POST)
            method = 'POST';
            url = `${API_BASE_URL}/products`;
        }
        
        // Faz a requisição HTTP para a API
        response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(productData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha ao salvar o produto na API.');
        }

        const savedProduct = await response.json();

        // 3. Atualiza a variável global 'products' e a UI:
        if (isEditing) {
            const index = products.findIndex(p => p._id === productId);
            if (index > -1) {
                products[index] = savedProduct;
            }
            logAction('Produto Atualizado', savedProduct.nome);
        } else {
            products.push(savedProduct);
            logAction('Produto Adicionado', savedProduct.nome);
        }
        
        alert(`✅ Produto ${isEditing ? 'atualizado' : 'adicionado'} com sucesso!`);
        resetProductForm();
        renderProductTable();
        // Garante que o Front-end salve as outras variáveis locais (vendas, carrinho, etc.)
        persistData(); 
    } catch (error) {
        console.error('❌ Erro ao salvar produto:', error);
        alert(`❌ Erro ao salvar produto: ${error.message}`);
    }
}

function sanitizeHTML(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// =================================================================
// 3. NAVEGAÇÃO E LAYOUT
// =================================================================

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');
    const titleElement = document.getElementById('current-page-title');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetSectionId = item.getAttribute('href').substring(1);

            // Remove classe ativa de todos
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // Esconde todas as seções
            sections.forEach(sec => {
                sec.style.display = 'none';
                sec.style.opacity = '0';
            });

            // Mostra a seção alvo
            const targetSection = document.getElementById(targetSectionId);
            if (targetSection) {
                targetSection.style.display = 'block';
                setTimeout(() => {
                    targetSection.style.opacity = '1';
                }, 50);
                
                // Atualiza título
                titleElement.textContent = item.querySelector('span').textContent;

                // Ações específicas por seção - CORREÇÃO AQUI
                switch(targetSectionId) {
                    case 'vendas':
                        renderPdvProducts();
                        break;
                    case 'carrinhos-salvos':
                        renderSavedCarts();
                        break;
                    case 'config':
                        renderConfigFields();
                        break;
                    case 'relatorios':
                    // CORREÇÃO: Renderiza relatório automaticamente
                        setTimeout(() => {
                        renderSalesReport();
                        updateReportMetrics(); // ✅ GARANTE QUE AS MÉTRICAS SÃO ATUALIZADAS
                        showTab('report-resumo');
                        }, 100);
                    break;
                    case 'produtos':
                        showTab('product-list-tab');
                        break;
                }

                // Fecha sidebar no mobile
                if (window.innerWidth <= 768) {
                    document.getElementById('sidebar').classList.remove('collapsed');
                    document.getElementById('main-content').classList.remove('expanded');
                }
            }
        });
    });

    

    // Configura tabs
    setupTabs();
}

function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabContentId = button.getAttribute('data-tab-content');
            showTab(tabContentId);
        });
    });
}

function showTab(tabContentId) {
    // Remove classe ativa de todos os botões
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    // Esconde todos os conteúdos
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });

    // Ativa o botão e conteúdo selecionado
    const activeButton = document.querySelector(`[data-tab-content="${tabContentId}"]`);
    const activeContent = document.getElementById(tabContentId);
    
    if (activeButton && activeContent) {
        activeButton.classList.add('active');
        activeContent.style.display = 'block';
        setTimeout(() => {
            activeContent.style.opacity = '1';
        }, 50);
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
}

function toggleAlertsWindow(event) {
    // Previne que o clique no sino propague para o document
    if (event) {
        event.stopPropagation();
    }
    
    const dropdown = document.getElementById('alerts-floating-window');
    const isVisible = dropdown.style.display === 'block';
    dropdown.style.display = isVisible ? 'none' : 'block';
    
    // Atualiza os alertas quando abre o dropdown
    if (!isVisible) {
        updateAlerts();
    }
}

// =================================================================
// 4. DASHBOARD E MÉTRICAS
// =================================================================

// CORREÇÃO: Dashboard - Todas as métricas
function updateDashboardMetrics() {
    try {
        // Garantir que products existe e tem dados
        if (!products || !Array.isArray(products)) {
            products = [];
        }

        let totalStockItems = products.reduce((sum, p) => sum + (parseInt(p.quantidade) || 0), 0);
        let lowStockCount = products.filter(p => (parseInt(p.quantidade) || 0) <= (parseInt(p.minimo) || 0)).length;
        let totalProducts = products.length;

        // CORREÇÃO: Vendas hoje - método mais robusto
        const today = new Date();
        const todayFormatted = today.toLocaleDateString('pt-BR');
        
        let salesToday = 0;
        salesHistory.forEach(sale => {
            if (!sale || !sale.total) return;
            
            let saleDate;
            if (sale.date) {
                // Converte YYYY-MM-DD para DD/MM/AAAA
                const [year, month, day] = sale.date.split('-');
                saleDate = `${day}/${month}/${year}`;
            } else if (sale.timestamp) {
                // Converte timestamp para DD/MM/AAAA
                try {
                    const dateObj = new Date(sale.timestamp);
                    saleDate = dateObj.toLocaleDateString('pt-BR');
                } catch (e) {
                    return;
                }
            } else {
                return;
            }
            
            if (saleDate === todayFormatted) {
                salesToday += parseFloat(sale.total) || 0;
            }
        });

        // CORREÇÃO: Atualiza os elementos com fallback
        const totalStockEl = document.getElementById('total-stock-items');
        const totalProductsEl = document.getElementById('total-products');
        const lowStockEl = document.getElementById('low-stock-count');
        const salesTodayEl = document.getElementById('sales-today');

        if (totalStockEl) totalStockEl.textContent = totalStockItems.toLocaleString('pt-BR');
        if (totalProductsEl) totalProductsEl.textContent = totalProducts.toLocaleString('pt-BR');
        if (lowStockEl) lowStockEl.textContent = lowStockCount.toLocaleString('pt-BR');
        if (salesTodayEl) {
            salesTodayEl.textContent = salesToday.toLocaleString('pt-BR', { 
                style: 'currency', 
                currency: 'BRL' 
            });
        }

        updateAlerts();
        
        console.log('Dashboard atualizado:', {
            totalStockItems,
            totalProducts,
            lowStockCount,
            salesToday
        });
        
    } catch (error) {
        console.error('Erro ao atualizar métricas do dashboard:', error);
        
        // Fallback em caso de erro
        const elements = [
            'total-stock-items',
            'total-products', 
            'low-stock-count',
            'sales-today'
        ];
        
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '0';
        });
    }
}

// CORREÇÃO: Alertas do Dashboard
function updateAlerts() {
    try {
        const lowStockProducts = products.filter(p => 
            (parseInt(p.quantidade) || 0) <= (parseInt(p.minimo) || 0)
        );
        
        const dashboardAlertList = document.getElementById('dashboard-alert-list');
        const bellIcon = document.getElementById('bell-icon');

        // CORREÇÃO: Alertas no dashboard
        if (dashboardAlertList) {
            dashboardAlertList.innerHTML = '';
            
            if (lowStockProducts.length === 0) {
                dashboardAlertList.innerHTML = `
                    <li>
                        <i class="fas fa-check-circle" style="color: var(--color-accent-green); margin-right: 5px;"></i> 
                        Estoque saudável.
                    </li>
                `;
            } else {
                lowStockProducts.slice(0, 5).forEach(p => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <i class="fas fa-exclamation-triangle" style="color: var(--color-accent-red); margin-right: 5px;"></i> 
                        ${sanitizeHTML(p.nome)} (${p.quantidade} und.)
                    `;
                    dashboardAlertList.appendChild(li);
                });
                
                if (lowStockProducts.length > 5) {
                    const li = document.createElement('li');
                    li.innerHTML = `<small>... e mais ${lowStockProducts.length - 5} produtos</small>`;
                    dashboardAlertList.appendChild(li);
                }
            }
        }

        // CORREÇÃO: Sino de alertas
        if (bellIcon) {
            if (lowStockProducts.length > 0) {
                bellIcon.classList.add('has-alerts');
            } else {
                bellIcon.classList.remove('has-alerts');
            }
        }
        
    } catch (error) {
        console.error('Erro ao atualizar alertas:', error);
    }
}
function updateAlerts() {
    try {
        const lowStockProducts = products.filter(p => p.quantidade <= p.minimo);
        const alertListDropdown = document.getElementById('alerts-dropdown-list');
        const dashboardAlertList = document.getElementById('dashboard-alert-list');
        const bellIcon = document.getElementById('bell-icon');

        const renderAlertsList = (listElement) => {
            if (!listElement) return;
            
            listElement.innerHTML = '';
            if (lowStockProducts.length === 0) {
                listElement.innerHTML = `<li><i class="fas fa-check-circle" style="color: var(--accent-green); margin-right: 5px;"></i> Estoque saudável.</li>`;
                return;
            }

            lowStockProducts.forEach(p => {
                const li = document.createElement('li');
                li.innerHTML = `<i class="fas fa-exclamation-circle" style="color: var(--accent-red); margin-right: 5px;"></i> ${sanitizeHTML(p.nome)} com estoque baixo. (${p.quantidade} und.)`;
                listElement.appendChild(li);
            });
        };

        renderAlertsList(alertListDropdown);
        renderAlertsList(dashboardAlertList);

        // Atualiza estado do sino
        if (lowStockProducts.length > 0) {
            bellIcon.classList.add('has-alerts');
        } else {
            bellIcon.classList.remove('has-alerts');
        }
    } catch (error) {
        console.error('Erro ao atualizar alertas:', error);
    }
}

// =================================================================
// 5. GERENCIAMENTO DE PRODUTOS
// =================================================================

function updateCategorySelect(selectedCategory = '') {
    try {
        // Tenta encontrar o select de várias formas
        let select = document.getElementById('categoria');
        
        if (!select) {
            console.warn("⚠️ Elemento #categoria não encontrado. Tentando encontrar...");
            
            // Tenta encontrar em outras localizações possíveis
            select = document.querySelector('select[name="categoria"]');
            
            if (!select) {
                console.error("❌ Elemento categoria não encontrado em nenhum lugar.");
                return;
            }
        }

        // Limpa o select
        select.innerHTML = '';

        // Adiciona opção vazia
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = 'Selecione uma categoria';
        emptyOption.disabled = true;
        emptyOption.selected = !selectedCategory;
        select.appendChild(emptyOption);

        // Adiciona categorias
        config.categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            if (cat === selectedCategory) option.selected = true;
            select.appendChild(option);
        });

        console.log("✅ updateCategorySelect executada com sucesso. Categorias:", config.categories.length);
        
    } catch (error) {
        console.error("❌ Erro em updateCategorySelect:", error);
    }
}


function validateProductForm(data) {
    const errors = [];
    const preco = parseFloat(data.get('preco'));
    const custo = parseFloat(data.get('custo'));
    const quantidade = parseInt(data.get('quantidade'));
    const minimo = parseInt(data.get('minimo'));

    if (preco <= custo) {
        errors.push('Preço de venda deve ser maior que o custo');
    }
    if (quantidade < 0) {
        errors.push('Estoque não pode ser negativo');
    }
    if (minimo < 0) {
        errors.push('Estoque mínimo não pode ser negativo');
    }
    if (!data.get('nome') || data.get('nome').trim().length === 0) {
        errors.push('Nome do produto é obrigatório');
    }

    return errors;
}

function handleProductForm(event) {
    event.preventDefault();
    
    try {
        const form = event.target;
        const data = new FormData(form);
        
        // Validação
        const errors = validateProductForm(data);
        if (errors.length > 0) {
            alert('Erros no formulário:\n' + errors.join('\n'));
            return;
        }

        const product = {
            id: data.get('id') ? parseInt(data.get('id')) : null,
            nome: data.get('nome').trim(),
            categoria: data.get('categoria'),
            preco: parseFloat(data.get('preco')),
            custo: parseFloat(data.get('custo')),
            quantidade: parseInt(data.get('quantidade')),
            minimo: parseInt(data.get('minimo'))
        };

        if (product.id) {
            // Editar produto existente
            const index = products.findIndex(p => p.id === product.id);
            if (index === -1) {
                alert('Produto não encontrado para edição');
                return;
            }
            const oldProduct = { ...products[index] };
            products[index] = product;
            logAction("Produto Editado", `${oldProduct.nome} (R$ ${oldProduct.preco} → R$ ${product.preco})`);
        } else {
            // Novo produto
            product.id = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
            products.push(product);
            logAction("Produto Cadastrado", product.nome);
        }

        renderProductTable();
        updateDashboardMetrics();
        resetProductForm();
        persistData();
        
        alert(`Produto ${product.nome} ${product.id ? 'atualizado' : 'cadastrado'} com sucesso!`);
        
        // Volta para a lista de produtos
        showTab('product-list-tab');
        
    } catch (error) {
        console.error('Erro ao processar formulário:', error);
        alert('Erro ao processar formulário. Tente novamente.');
    }
}

function editProduct(id) {
    try {
        const product = products.find(p => p.id === id);
        if (!product) {
            alert('Produto não encontrado');
            return;
        }

        document.getElementById('product-id').value = product.id;
        document.getElementById('nome').value = product.nome;
        updateCategorySelect(product.categoria);
        document.getElementById('preco').value = product.preco;
        document.getElementById('custo').value = product.custo;
        document.getElementById('quantidade').value = product.quantidade;
        document.getElementById('minimo').value = product.minimo;

        document.getElementById('form-title').textContent = `Editar Produto: ${product.nome}`;
        document.getElementById('submit-btn').innerHTML = '<i class="fas fa-save"></i> Salvar Edição';
        document.getElementById('cancel-edit-btn').style.display = 'inline-flex';

        // Muda para a aba de formulário
        showTab('product-form-tab');
        
    } catch (error) {
        console.error('Erro ao editar produto:', error);
        alert('Erro ao carregar dados do produto.');
    }
}


// CRUD DE PRODUTOS (DELETAR) - AGORA ASSÍNCRONA VIA API!
async function deleteProduct(productId, productName) {
    if (!confirm(`Tem certeza que deseja DELETAR permanentemente o produto: ${productName}?`)) {
        return;
    }
    
    try {
        // Faz a requisição HTTP DELETE
        const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha ao excluir o produto na API.');
        }

        // Atualiza a variável global 'products' (Filtra o produto deletado)
        products = products.filter(p => p._id !== productId);
        
        logAction('Produto Deletado', productName);
        alert(`✅ Produto "${productName}" excluído com sucesso!`);
        renderProductTable();
        persistData();
        
    } catch (error) {
        console.error('❌ Erro ao deletar produto:', error);
        alert(`❌ Erro ao deletar produto: ${error.message}`);
    }
}

function resetProductForm() {
    const form = document.querySelector('.product-form');
    if (form) {
        form.reset();
        document.getElementById('product-id').value = '';
        document.getElementById('form-title').textContent = 'Formulário de Cadastro de Produto';
        document.getElementById('submit-btn').innerHTML = '<i class="fas fa-plus-circle"></i> Cadastrar Produto';
        document.getElementById('cancel-edit-btn').style.display = 'none';
        
        // CORREÇÃO: Garante que a categoria é resetada corretamente
        setTimeout(() => {
            updateCategorySelect(config.categories[0] || '');
        }, 100);
    }
}
// CORREÇÃO: Estoque Atual - Garantir que produtos apareçam na tabela
function renderProductTable() {
    try {
        const tbody = document.querySelector('#product-table tbody');
        if (!tbody) {
            console.error('Tabela de produtos não encontrada');
            return;
        }

        tbody.innerHTML = '';

        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Nenhum produto cadastrado</td></tr>';
            return;
        }

        products.forEach(p => {
            const row = tbody.insertRow();
            const stockClass = p.quantidade <= p.minimo ? 'low-stock' : '';
            
            row.innerHTML = `
                <td>#${p.id}</td>
                <td>${sanitizeHTML(p.nome)}</td>
                <td>${sanitizeHTML(p.categoria)}</td>
                <td>${p.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td class="${stockClass}">${p.quantidade}</td>
                <td>${p.minimo}</td>
                <td>
                    <button class="action-btn edit-btn" onclick="editProduct(${p.id})" title="Editar">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteProduct(${p.id})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
        });
        
        console.log('Tabela de produtos renderizada:', products.length, 'produtos');
    } catch (error) {
        console.error('Erro ao renderizar tabela de produtos:', error);
    }
}

// CORREÇÃO: Histórico de Ações
function renderHistoryLog() {
    try {
        const tbody = document.getElementById('history-log-tbody');
        if (!tbody) {
            console.error('Tabela de histórico não encontrada');
            return;
        }

        tbody.innerHTML = '';

        if (logHistory.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Nenhuma ação registrada</td></tr>';
            return;
        }

        logHistory.forEach(log => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>#${log.id}</td>
                <td>${sanitizeHTML(log.timestamp)}</td>
                <td>${sanitizeHTML(log.type)}</td>
                <td>${sanitizeHTML(log.detail)}</td>
            `;
        });
        
        console.log('Histórico renderizado:', logHistory.length, 'ações');
    } catch (error) {
        console.error('Erro ao renderizar histórico:', error);
    }
}
function renderHistoryLog() {
    try {
        const tbody = document.getElementById('history-log-tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (logHistory.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Nenhuma ação registrada</td></tr>';
            return;
        }

        logHistory.forEach(log => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>#${log.id}</td>
                <td>${sanitizeHTML(log.timestamp)}</td>
                <td>${sanitizeHTML(log.type)}</td>
                <td>${sanitizeHTML(log.detail)}</td>
                <!-- BOTÃO REMOVIDO -->
            `;
        });
    } catch (error) {
        console.error('Erro ao renderizar histórico:', error);
    }
}

function showUndoModal(type, detail, logId) {
    document.getElementById('undo-action-type').textContent = type;
    document.getElementById('undo-action-detail').textContent = detail;
    document.getElementById('undo-modal').style.display = 'flex';
}

function simulateUndoConfirmation() {
    alert("Simulação de reversão concluída. Em um sistema real, a lógica de reversão seria complexa.");
    document.getElementById('undo-modal').style.display = 'none';
}

// =================================================================
// 6. INICIALIZAÇÃO PRINCIPAL
// =================================================================

function loadInitialData() {
    try {
        products = safeLocalStorageParse('products', products);
        salesHistory = safeLocalStorageParse('salesHistory', salesHistory);
        savedCarts = safeLocalStorageParse('savedCarts', savedCarts);
        logHistory = safeLocalStorageParse('logHistory', logHistory);
        config = safeLocalStorageParse('config', config);

        // Renderizações iniciais
        renderProductTable();
        updateDashboardMetrics();
        updateReportMetrics(); // ✅ NOVA LINHA ADICIONADA
        renderHistoryLog();
        updateAlerts();
        renderPdvProducts();
        updateCategorySelect();
        renderConfigFields();
        initializeDashboardCharts();
        renderSavedCarts();
        renderCart();

        console.log('Dados carregados com sucesso');
    } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
        alert('Erro ao carregar dados. Algumas funcionalidades podem não estar disponíveis.');
    }
}

function initializeErrorHandling() {
    window.addEventListener('error', (e) => {
        console.error('Erro global:', e.error);
    });
    
    window.addEventListener('unhandledrejection', (e) => {
        console.error('Promise rejeitada:', e.reason);
        e.preventDefault();
    });
}

// Inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
    // ⚠️ AGORA É ASYNC/AWAIT PARA ESPERAR O BANCO DE DADOS
    await loadAllData();
    
    initializeErrorHandling();
    loadInitialData();
    setupNavigation();
    
    // Fecha modais ao clicar fora
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            e.target.style.display = 'none';
        }
    });

    const elemento = document.getElementById('algum-id');
    if (elemento) {
    elemento.style.display = 'none'; // SÓ EXECUTA SE O ELEMENTO EXISTIR
    }
});

// =================================================================
// 7. PONTO DE VENDA (PDV) - CORRIGIDO
// =================================================================

// CORREÇÃO: Garantir que produtos apareçam no PDV
function renderPdvProducts() {
    try {
        const grid = document.getElementById('products-grid');
        if (!grid) {
            console.error('Elemento products-grid não encontrado');
            return;
        }
        
        console.log('Renderizando', products.length, 'produtos no PDV');
        grid.innerHTML = '';

        if (products.length === 0) {
            grid.innerHTML = '<div class="empty-state">Nenhum produto cadastrado</div>';
            return;
        }

        products.forEach(p => {
            const inStock = p.quantidade > 0 || p.categoria === 'Serviços';
            const buttonClass = inStock ? 'submit-btn blue-btn' : 'submit-btn out-of-stock';
            const buttonText = inStock ? 'Adicionar' : 'Esgotado';
            const buttonIcon = inStock ? 'fa-cart-plus' : 'fa-ban';
            
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.innerHTML = `
                <span class="product-id">#${p.id}</span>
                <h4 class="product-name">${sanitizeHTML(p.nome)}</h4>
                <p class="product-category">${sanitizeHTML(p.categoria)}</p>
                <p class="product-price">R$ ${p.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p class="product-stock ${!inStock ? 'out-of-stock-text' : ''}">
                    ${p.categoria === 'Serviços' ? 'Serviço' : `Estoque: ${p.quantidade}`}
                </p>
                <div class="product-button-container">
                    <button class="${buttonClass}" onclick="${inStock ? `addToCart(${p.id})` : ''}" ${!inStock ? 'disabled' : ''}>
                        <i class="fas ${buttonIcon}"></i> ${buttonText}
                    </button>
                </div>
            `;
            grid.appendChild(productCard);
        });
        
        console.log('Produtos PDV renderizados com sucesso');
    } catch (error) {
        console.error('Erro ao renderizar produtos PDV:', error);
    }
}
function filterPdvProducts() {
    try {
        const searchInput = document.getElementById('pdv-search-input');
        if (!searchInput) return;
        
        const searchTerm = searchInput.value.toLowerCase();
        const productCards = document.querySelectorAll('.product-card');

        productCards.forEach(card => {
            const name = card.querySelector('.product-name').textContent.toLowerCase();
            const id = card.querySelector('.product-id').textContent.toLowerCase();
            const category = card.querySelector('.product-category').textContent.toLowerCase();
            
            const matches = name.includes(searchTerm) || 
                          id.includes(searchTerm.replace('#', '')) || 
                          category.includes(searchTerm);
            
            card.style.display = matches ? 'block' : 'none';
        });
    } catch (error) {
        console.error('Erro ao filtrar produtos:', error);
    }
}

// =================================================================
// 8. CARRINHO DE COMPRAS - CORRIGIDO
// =================================================================

function addToCart(productId) {
    try {
        const product = products.find(p => p.id === productId);
        if (!product) {
            alert("Produto não encontrado!");
            return;
        }

        if (product.quantidade <= 0) {
            alert("Produto esgotado!");
            return;
        }

        const cartItem = cart.find(item => item.id === productId);

        if (cartItem) {
            if (cartItem.quantity < product.quantidade) {
                cartItem.quantity++;
            } else {
                alert(`Estoque máximo de ${product.nome} atingido! (${product.quantidade} unidades)`);
                return;
            }
        } else {
            cart.push({
                id: product.id,
                nome: product.nome,
                preco: product.preco,
                custo: product.custo,
                quantity: 1
            });
        }

        renderCart();
        
    } catch (error) {
        console.error('Erro ao adicionar ao carrinho:', error);
        alert('Erro ao adicionar produto ao carrinho.');
    }
}

function updateCartQuantity(productId, change) {
    try {
        const cartItem = cart.find(item => item.id === productId);
        const product = products.find(p => p.id === productId);

        if (!cartItem || !product) return;

        const newQuantity = cartItem.quantity + change;

        if (newQuantity <= 0) {
            removeItemFromCart(productId);
            return;
        }

        if (newQuantity > product.quantidade) {
            alert(`Estoque máximo de ${product.nome} atingido! (${product.quantidade} unidades)`);
            return;
        }

        cartItem.quantity = newQuantity;
        renderCart();
        
    } catch (error) {
        console.error('Erro ao atualizar quantidade:', error);
    }
}

function removeItemFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    renderCart();
}

function clearCart() {
    if (cart.length === 0) {
        alert("O carrinho já está vazio!");
        return;
    }
    
    if (!confirm("Deseja realmente limpar o carrinho de compras?")) return;
    
    cart = [];
    renderCart();
    alert("Carrinho limpo com sucesso!");
}

function calculateTotals() {
    const subtotal = cart.reduce((sum, item) => sum + (item.preco * item.quantity), 0);
    const total = subtotal; // Para futuros descontos/impostos
    return { subtotal, total };
}

function renderCart() {
    try {
        const list = document.getElementById('cart-items-list');
        const subtotalEl = document.getElementById('cart-subtotal');
        const totalEl = document.getElementById('cart-total');
        const checkoutBtn = document.querySelector('.finaliza-venda-btn');

        if (!list || !subtotalEl || !totalEl || !checkoutBtn) return;

        list.innerHTML = '';

        if (cart.length === 0) {
            list.innerHTML = `<li class="empty-cart-message">
                <i class="fas fa-shopping-cart"></i>
                <span>Carrinho vazio</span>
            </li>`;
            checkoutBtn.disabled = true;
            checkoutBtn.style.opacity = '0.6';
        } else {
            checkoutBtn.disabled = false;
            checkoutBtn.style.opacity = '1';
            
            cart.forEach(item => {
                const li = document.createElement('li');
                li.className = 'cart-item';
                li.innerHTML = `
                    <div class="item-info">
                        <span class="item-name">${sanitizeHTML(item.nome)}</span>
                        <span class="item-price">R$ ${(item.preco * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div class="item-controls">
                        <button class="qty-btn" onclick="updateCartQuantity(${item.id}, -1)">
                            <i class="fas fa-minus"></i>
                        </button>
                        <span class="item-qty">${item.quantity}</span>
                        <button class="qty-btn" onclick="updateCartQuantity(${item.id}, 1)">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button class="remove-btn" onclick="removeItemFromCart(${item.id})">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                `;
                list.appendChild(li);
            });
        }

        const { subtotal, total } = calculateTotals();
        subtotalEl.textContent = subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        totalEl.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
    } catch (error) {
        console.error('Erro ao renderizar carrinho:', error);
    }
}

// =================================================================
// 9. CARRINHOS SALVOS - CORRIGIDO
// =================================================================

function saveCurrentCart() {
    try {
        if (cart.length === 0) {
            alert("O carrinho está vazio. Não há nada para salvar.");
            return;
        }

        // Verifica se já existe um carrinho IDÊNTICO salvo
        const carrinhoDuplicado = savedCarts.find(savedCart => 
            areCartsEqual(savedCart.items, cart)
        );

        if (carrinhoDuplicado) {
            alert(`❌ Já existe um carrinho salvo com os mesmos itens (ID: #${carrinhoDuplicado.id}).\n\nPara evitar duplicatas, carregue o carrinho existente ou altere os itens antes de salvar.`);
            return;
        }

        // Verifica se existe um carrinho SIMILAR (mesmos produtos, quantidades diferentes)
        const carrinhoSimilar = savedCarts.find(savedCart => 
            hasSameProducts(savedCart.items, cart)
        );

        if (carrinhoSimilar) {
            const resposta = confirm(`⚠️ Atenção: Já existe um carrinho salvo com os mesmos produtos (ID: #${carrinhoSimilar.id}), mas quantidades diferentes.\n\nDeseja salvar mesmo assim?`);
            
            if (!resposta) {
                return;
            }
        }

        const newSavedCart = {
            id: Date.now(),
            timestamp: new Date().toLocaleString('pt-BR'),
            items: JSON.parse(JSON.stringify(cart)),
            total: calculateTotals().total
        };

        savedCarts.unshift(newSavedCart);
        
        // Limita a 15 carrinhos salvos (mais restritivo)
        if (savedCarts.length > 15) {
            const removido = savedCarts.pop();
            console.log(`Carrinho #${removido.id} removido por limite máximo`);
        }
        
        persistData();
        renderSavedCarts();
        
        logAction("Carrinho Salvo", `Carrinho #${newSavedCart.id} com R$ ${newSavedCart.total.toFixed(2)}`);
        alert(`✅ Carrinho salvo com sucesso! (ID: #${newSavedCart.id})`);
        
    } catch (error) {
        console.error('Erro ao salvar carrinho:', error);
        alert('Erro ao salvar carrinho.');
    }
}

// Verifica se dois carrinhos têm exatamente os mesmos itens e quantidades
function areCartsEqual(cart1, cart2) {
    if (cart1.length !== cart2.length) return false;
    
    const cart1Map = new Map();
    const cart2Map = new Map();
    
    // Preenche os maps com ID -> quantidade
    cart1.forEach(item => cart1Map.set(item.id, item.quantity));
    cart2.forEach(item => cart2Map.set(item.id, item.quantity));
    
    // Verifica se todos os IDs e quantidades são iguais
    for (let [id, quantity] of cart1Map) {
        if (cart2Map.get(id) !== quantity) return false;
    }
    
    return true;
}

// Verifica se dois carrinhos têm os mesmos produtos (ignorando quantidades)
function hasSameProducts(cart1, cart2) {
    const cart1Ids = new Set(cart1.map(item => item.id));
    const cart2Ids = new Set(cart2.map(item => item.id));
    
    // Verifica se têm exatamente os mesmos produtos
    if (cart1Ids.size !== cart2Ids.size) return false;
    
    for (let id of cart1Ids) {
        if (!cart2Ids.has(id)) return false;
    }
    
    return true;
}

function loadSavedCart(cartId) {
    try {
        const savedCartIndex = savedCarts.findIndex(c => c.id === cartId);
        if (savedCartIndex === -1) {
            alert("Carrinho salvo não encontrado!");
            return;
        }

        const [loadedCart] = savedCarts.splice(savedCartIndex, 1);
        
        // Verifica produtos válidos
        const validItems = loadedCart.items.filter(savedItem => {
            const product = products.find(p => p.id === savedItem.id);
            return product && (
                product.categoria === 'Serviços' || 
                (product.quantidade > 0 && product.quantidade >= savedItem.quantity)
            );
        });

        if (validItems.length !== loadedCart.items.length) {
            const invalidCount = loadedCart.items.length - validItems.length;
            alert(`Atenção: ${invalidCount} item(s) não puderam ser carregados (estoque insuficiente ou produto removido).`);
        }
        
        if (validItems.length === 0) {
            alert("Nenhum item válido para carregar do carrinho salvo.");
            return;
        }
        
        cart = validItems;
        renderCart();
        renderSavedCarts();
        persistData();
        
        logAction("Carrinho Carregado", `Carrinho #${loadedCart.id} com R$ ${loadedCart.total.toFixed(2)}`);
        alert(`Carrinho #${loadedCart.id} carregado com sucesso!`);

        // Navega para o PDV
        document.querySelector('.nav-item[href="#vendas"]').click();
        
    } catch (error) {
        console.error('Erro ao carregar carrinho:', error);
        alert('Erro ao carregar carrinho salvo.');
    }
}

function deleteSavedCart(cartId) {
    if (!confirm("Tem certeza que deseja EXCLUIR este carrinho salvo?")) return;
    
    try {
        savedCarts = savedCarts.filter(c => c.id !== cartId);
        renderSavedCarts();
        persistData();
        
        logAction("Carrinho Deletado", `Carrinho #${cartId}`);
        alert("Carrinho excluído com sucesso!");
        
    } catch (error) {
        console.error('Erro ao deletar carrinho:', error);
        alert('Erro ao excluir carrinho salvo.');
    }
}

function renderSavedCarts() {
    try {
        const container = document.getElementById('saved-carts-list');
        if (!container) return;

        container.innerHTML = '';

        if (savedCarts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-shopping-basket" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <p>Nenhum carrinho salvo</p>
                </div>
            `;
            return;
        }

        savedCarts.forEach(cart => {
            const cartItemsSummary = cart.items
                .slice(0, 3) // Mostra apenas 3 itens no resumo
                .map(item => `${item.nome} (x${item.quantity})`)
                .join(', ');
            
            const remainingItems = cart.items.length - 3;
            const summaryText = remainingItems > 0 ? 
                `${cartItemsSummary} e mais ${remainingItems} item(s)...` : 
                cartItemsSummary;

            const cartElement = document.createElement('div');
            cartElement.className = 'saved-cart-card';
            cartElement.innerHTML = `
                <div class="cart-info">
                    <span class="cart-title">Carrinho #${cart.id}</span>
                    <p class="cart-meta">
                        <i class="fas fa-calendar"></i> ${cart.timestamp} | 
                        <i class="fas fa-receipt"></i> R$ ${cart.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | 
                        <i class="fas fa-cube"></i> ${cart.items.length} itens
                    </p>
                    <p class="cart-summary" title="${cart.items.map(item => `${item.nome} (x${item.quantity})`).join(', ')}">
                        <i class="fas fa-list"></i> ${summaryText}
                    </p>
                </div>
                <div class="cart-actions">
                    <button class="submit-btn blue-btn" onclick="loadSavedCart(${cart.id})" title="Carregar para o PDV">
                        <i class="fas fa-folder-open"></i> Carregar
                    </button>
                    <button class="submit-btn delete-btn" onclick="deleteSavedCart(${cart.id})" title="Excluir carrinho">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
            `;
            container.appendChild(cartElement);
        });
        
    } catch (error) {
        console.error('Erro ao renderizar carrinhos salvos:', error);
    }
}

// =================================================================
// 10. PROCESSAMENTO DE VENDAS - CORRIGIDO
// =================================================================

function checkout() {
    try {
        if (cart.length === 0) {
            alert("O carrinho está vazio. Adicione produtos para finalizar a venda.");
            return;
        }

        // Verifica estoque antes de prosseguir
        const stockIssues = [];
        cart.forEach(item => {
            const product = products.find(p => p.id === item.id);
            if (product && product.categoria !== 'Serviços' && product.quantidade < item.quantity) {
                stockIssues.push(`${product.nome} (estoque: ${product.quantidade}, solicitado: ${item.quantity})`);
            }
        });

        if (stockIssues.length > 0) {
            alert("Problemas de estoque:\n" + stockIssues.join('\n'));
            return;
        }

        renderPaymentOptions();
        document.getElementById('payment-modal').style.display = 'flex';
        
    } catch (error) {
        console.error('Erro no checkout:', error);
        alert('Erro ao processar venda.');
    }
}

function renderPaymentOptions() {
    try {
        const optionsContainer = document.getElementById('payment-options-container');
        const totalDisplay = document.getElementById('payment-total-display');
        
        if (!optionsContainer || !totalDisplay) return;

        const { total } = calculateTotals();
        totalDisplay.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        optionsContainer.innerHTML = '';

        // Campo para nome do cliente
        const clientSection = document.createElement('div');
        clientSection.className = 'client-section';
        clientSection.innerHTML = `
            <div class="form-group" style="margin-bottom: 20px;">
                <label for="client-name"><i class="fas fa-user"></i> Nome do Cliente (Opcional)</label>
                <input type="text" id="client-name" placeholder="Digite o nome do cliente..." style="width: 100%;">
                <div class="client-suggestions" id="client-suggestions"></div>
            </div>
        `;
        optionsContainer.appendChild(clientSection);

        // Opções de pagamento
        const paymentTitle = document.createElement('h4');
        paymentTitle.style.marginTop = '20px';
        paymentTitle.style.marginBottom = '15px';
        paymentTitle.textContent = 'Selecione o Tipo de Pagamento:';
        optionsContainer.appendChild(paymentTitle);

        config.paymentTypes.forEach(type => {
            const button = document.createElement('button');
            button.className = 'payment-option-btn';
            button.innerHTML = `<i class="fas fa-credit-card"></i> ${sanitizeHTML(type)}`;
            button.onclick = () => processSale(type);
            optionsContainer.appendChild(button);
        });

        // Adiciona funcionalidade de autocomplete
        setupClientAutocomplete();
        
    } catch (error) {
        console.error('Erro ao renderizar opções de pagamento:', error);
    }
}

function processSale(paymentType) {
    try {
        const { total } = calculateTotals();
        const clientName = document.getElementById('client-name').value.trim();

        // Atualiza estoque
        cart.forEach(cartItem => {
            const product = products.find(p => p.id === cartItem.id);
            if (product && product.categoria !== 'Serviços') {
                product.quantidade -= cartItem.quantity;
            }
        });

        // Atualiza dados do cliente se fornecido
        if (clientName) {
            let client = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
            if (!client) {
                client = {
                    id: Date.now(),
                    name: clientName,
                    createdAt: new Date().toISOString(),
                    totalPurchases: 0,
                    totalSpent: 0
                };
                clients.push(client);
            }
            client.totalPurchases += 1;
            client.totalSpent += total;
            client.lastPurchase = new Date().toISOString();
        }

        // Registra venda
        const newSale = {
            id: Date.now(),
            timestamp: new Date().toLocaleString('pt-BR'),
            items: JSON.parse(JSON.stringify(cart)), // Deep clone
            total: total,
            payment: paymentType,
            date: new Date().toISOString().split('T')[0],
            client: clientName || null // Adiciona o cliente à venda
        };
        
        salesHistory.unshift(newSale);
        
        // Limita histórico a 1000 vendas
        if (salesHistory.length > 1000) {
            salesHistory.pop();
        }

        const clientInfo = clientName ? ` - Cliente: ${clientName}` : '';
        logAction("Venda Finalizada", `R$ ${total.toFixed(2)} (${paymentType})${clientInfo}`);

        // Limpa e atualiza
        cart = [];
        renderCart();
        renderPdvProducts();
        updateDashboardMetrics();
        persistData();
        
        // Fecha modal
        document.getElementById('payment-modal').style.display = 'none';

        alert(`✅ Venda finalizada com sucesso!\nTotal: R$ ${total.toFixed(2)}\nPagamento: ${paymentType}\n${clientName ? `Cliente: ${clientName}` : 'Cliente: Não informado'}`);
        
    } catch (error) {
        console.error('Erro ao processar venda:', error);
        alert('Erro ao processar venda. Tente novamente.');
    }
}

// =================================================================
// 11. CONFIGURAÇÕES - CORRIGIDO
// =================================================================

function renderConfigFields() {
    try {
        const categoriesTextarea = document.getElementById('product-categories-config');
        const paymentTextarea = document.getElementById('payment-types-config');
        
        if (categoriesTextarea) {
            categoriesTextarea.value = config.categories.join('\n');
        }
        if (paymentTextarea) {
            paymentTextarea.value = config.paymentTypes.join('\n');
        }
    } catch (error) {
        console.error('Erro ao renderizar configurações:', error);
    }
}

function saveCategories() {
    try {
        const textarea = document.getElementById('product-categories-config');
        if (!textarea) return;
        
        const newCategories = textarea.value
            .split('\n')
            .map(c => c.trim())
            .filter(c => c.length > 0);
        
        if (newCategories.length === 0) {
            alert("A lista de categorias não pode estar vazia.");
            textarea.value = config.categories.join('\n');
            return;
        }
        
        // Verifica se há produtos usando categorias que serão removidas
        const removedCategories = config.categories.filter(cat => !newCategories.includes(cat));
        const productsUsingRemovedCategories = products.filter(p => removedCategories.includes(p.categoria));
        
        if (productsUsingRemovedCategories.length > 0) {
            alert(`Atenção: ${productsUsingRemovedCategories.length} produto(s) usam categorias que serão removidas. Eles serão movidos para a primeira categoria.`);
            
            // Move produtos para a primeira categoria
            productsUsingRemovedCategories.forEach(product => {
                product.categoria = newCategories[0];
            });
            
            renderProductTable();
        }
        
        config.categories = newCategories;
        updateCategorySelect();
        persistData();
        
        logAction("Configurações", "Categorias atualizadas");
        alert("Categorias salvas com sucesso!");
        
    } catch (error) {
        console.error('Erro ao salvar categorias:', error);
        alert('Erro ao salvar categorias.');
    }
}

function savePaymentTypes() {
    try {
        const textarea = document.getElementById('payment-types-config');
        if (!textarea) return;
        
        const newPaymentTypes = textarea.value
            .split('\n')
            .map(t => t.trim())
            .filter(t => t.length > 0);
        
        if (newPaymentTypes.length === 0) {
            alert("A lista de tipos de pagamento não pode estar vazia.");
            textarea.value = config.paymentTypes.join('\n');
            return;
        }
        
        config.paymentTypes = newPaymentTypes;
        persistData();
        
        logAction("Configurações", "Tipos de pagamento atualizados");
        alert("Tipos de pagamento salvos com sucesso!");
        
    } catch (error) {
        console.error('Erro ao salvar tipos de pagamento:', error);
        alert('Erro ao salvar tipos de pagamento.');
    }
}

// =================================================================
// 12. RELATÓRIOS - CORRIGIDO
// =================================================================

let dailySalesChart = null;
let categorySalesChart = null;

function safeChartDestroy(chart) {
    try {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    } catch (error) {
        console.error('Erro ao destruir gráfico:', error);
    }
    return null;
}

function parseDate(dateStr) {
    if (!dateStr || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return null;
    
    try {
        const [day, month, year] = dateStr.split('/').map(Number);
        const date = new Date(year, month - 1, day);
        
        // Verifica se a data é válida
        return date.getDate() === day && 
               date.getMonth() === month - 1 && 
               date.getFullYear() === year ? date : null;
    } catch (error) {
        console.error('Erro ao parsear data:', error);
        return null;
    }
}

function getSalesDataForPeriod(startDateStr, endDateStr) {
    try {
        const startDate = parseDate(startDateStr);
        let endDate = parseDate(endDateStr);

        // Se datas inválidas, retorna todo o histórico
        if (!startDate && !endDate) return salesHistory;
        
        // Ajusta data final para incluir o dia inteiro
        if (endDate) {
            endDate = new Date(endDate);
            endDate.setDate(endDate.getDate() + 1);
        } else {
            endDate = new Date(); // Hoje
        }
        
        const start = startDate || new Date(0); // Data mínima

        return salesHistory.filter(sale => {
            let saleDate;
            if (sale.date) {
                saleDate = new Date(sale.date + 'T00:00:00');
            } else {
                saleDate = new Date(sale.timestamp);
            }
            return saleDate >= start && saleDate < endDate;
        });
        
    } catch (error) {
        console.error('Erro ao filtrar vendas por período:', error);
        return salesHistory;
    }
}

function calculateReportMetrics(sales) {
    try {
        const totalSales = sales.reduce((sum, sale) => sum + (sale.total || 0), 0);
        const totalTransactions = sales.length;
        
        let totalRevenue = 0;
        let totalCost = 0;
        
        sales.forEach(sale => {
            // Verifica se sale.items existe e é um array
            if (sale.items && Array.isArray(sale.items)) {
                sale.items.forEach(item => {
                    // Garante que os valores são números válidos
                    const preco = Number(item.preco) || 0;
                    const custo = Number(item.custo) || 0;
                    const quantity = Number(item.quantity) || 0;
                    
                    totalRevenue += preco * quantity;
                    totalCost += custo * quantity;
                });
            }
        });
        
        const estimatedProfit = totalRevenue - totalCost;
        const averageTicket = totalTransactions > 0 ? totalSales / totalTransactions : 0;

        return { 
            totalSales: Number(totalSales) || 0, 
            totalTransactions: Number(totalTransactions) || 0, 
            estimatedProfit: Number(estimatedProfit) || 0, 
            averageTicket: Number(averageTicket) || 0,
            totalRevenue: Number(totalRevenue) || 0,
            totalCost: Number(totalCost) || 0
        };
        
    } catch (error) {
        console.error('Erro ao calcular métricas:', error);
        // Retorna valores padrão em caso de erro
        return {
            totalSales: 0,
            totalTransactions: 0,
            estimatedProfit: 0,
            averageTicket: 0,
            totalRevenue: 0,
            totalCost: 0
        };
    }
}

function renderReportMetrics(metrics, containerId) {
    try {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Garante que todos os valores são números válidos
        const safeMetrics = {
            totalSales: Number(metrics.totalSales) || 0,
            estimatedProfit: Number(metrics.estimatedProfit) || 0,
            totalTransactions: Number(metrics.totalTransactions) || 0,
            averageTicket: Number(metrics.averageTicket) || 0
        };

        container.innerHTML = `
            <div class="card metric-card blue-card">
                <div class="card-content">
                    <p class="card-label">Total de Vendas</p>
                    <span class="card-value">${safeMetrics.totalSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
                <i class="fas fa-money-bill-wave"></i>
            </div>
            <div class="card metric-card green-card">
                <div class="card-content">
                    <p class="card-label">Lucro Estimado</p>
                    <span class="card-value">${safeMetrics.estimatedProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
                <i class="fas fa-hand-holding-usd"></i>
            </div>
            <div class="card metric-card purple-card">
                <div class="card-content">
                    <p class="card-label">Transações</p>
                    <span class="card-value">${safeMetrics.totalTransactions.toLocaleString('pt-BR')}</span>
                </div>
                <i class="fas fa-receipt"></i>
            </div>
            <div class="card metric-card orange-card">
                <div class="card-content">
                    <p class="card-label">Ticket Médio</p>
                    <span class="card-value">${safeMetrics.averageTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
                <i class="fas fa-chart-bar"></i>
            </div>
        `;
    } catch (error) {
        console.error('Erro ao renderizar métricas:', error);
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = '<div class="error-message">Erro ao carregar métricas</div>';
        }
    }
}

function renderSalesReport() {
    try {
        const startDateInput = document.getElementById('data-inicio');
        const endDateInput = document.getElementById('data-fim');
        
        const startDateStr = startDateInput ? startDateInput.value : '';
        const endDateStr = endDateInput ? endDateInput.value : '';

        const sales = getSalesDataForPeriod(startDateStr, endDateStr);
        const metrics = calculateReportMetrics(sales);

        // ATUALIZA AS MÉTRICAS DA ANÁLISE VISUAL
        updateReportMetrics(); // ✅ CORREÇÃO ADICIONADA
        
        renderReportMetrics(metrics, 'analysis-summary-metrics');
        renderReportMetrics(metrics, 'sales-summary-metrics');

        renderCategorySalesChart(sales);
        renderTopSellingTable(sales);
        renderSalesDetailsTable(sales);
        
    } catch (error) {
        console.error('Erro ao renderizar relatório:', error);
        alert('Erro ao gerar relatório. Verifique os dados e tente novamente.');
    }
}

function renderCategorySalesChart(sales) {
    if (window.categorySalesChart && typeof window.categorySalesChart.destroy === 'function') {
        window.categorySalesChart.destroy();
    }

    try {
        const categorySalesMap = {};
        
        sales.forEach(sale => {
            if (sale.items && Array.isArray(sale.items)) {
                sale.items.forEach(item => {
                    const product = products.find(p => p.id === item.id);
                    const category = product ? product.categoria : 'Sem Categoria';
                    const value = (item.preco || 0) * (item.quantity || 0);
                    categorySalesMap[category] = (categorySalesMap[category] || 0) + value;
                });
            }
        });

        const categoryLabels = Object.keys(categorySalesMap);
        const categoryData = Object.values(categorySalesMap);

        const ctxCategorySales = document.getElementById('categoryChart');
        if (!ctxCategorySales) {
            console.error('Elemento categoryChart não encontrado');
            return;
        }

        // Limpa o canvas antes de renderizar
        ctxCategorySales.innerHTML = '';
        
        if (categoryLabels.length === 0) {
            ctxCategorySales.innerHTML = `
                <div class="empty-chart" style="
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    height: 100%; 
                    flex-direction: column; 
                    color: var(--color-text-secondary);
                ">
                    <i class="fas fa-chart-bar" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <p>Nenhuma venda para exibir</p>
                </div>
            `;
            return;
        }

        // 🎨 PALETA DE CORES MODERNA
        const colors = [
            'rgba(74, 144, 226, 0.8)',   // Azul
            'rgba(46, 204, 113, 0.8)',   // Verde
            'rgba(155, 89, 182, 0.8)',   // Roxo
            'rgba(241, 196, 15, 0.8)',   // Amarelo
            'rgba(230, 126, 34, 0.8)',   // Laranja
            'rgba(231, 76, 60, 0.8)',    // Vermelho
            'rgba(52, 152, 219, 0.8)',   // Azul Claro
            'rgba(26, 188, 156, 0.8)',   // Turquesa
            'rgba(149, 165, 166, 0.8)',  // Cinza
            'rgba(52, 73, 94, 0.8)'      // Azul Escuro
        ];

        const hoverColors = colors.map(color => color.replace('0.8', '1'));

        window.categorySalesChart = new Chart(ctxCategorySales, {
            type: 'bar',
            data: {
                labels: categoryLabels,
                datasets: [{
                    label: 'Total de Vendas (R$)',
                    data: categoryData,
                    backgroundColor: colors.slice(0, categoryLabels.length),
                    borderColor: hoverColors.slice(0, categoryLabels.length),
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false,
                    barPercentage: 0.7,
                    categoryPercentage: 0.8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 20,
                        right: 20,
                        bottom: 10,
                        left: 10
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#2c3e50', // Cor de alto contraste
                            font: {
                                size: 14,
                                weight: 'bold',
                                family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                            },
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(44, 62, 80, 0.95)', // Fundo escuro para contraste
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        titleFont: {
                            size: 14,
                            weight: 'bold'
                        },
                        bodyFont: {
                            size: 13
                        },
                        padding: 12,
                        cornerRadius: 8,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed.y;
                                return ` Valor: R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                            },
                            title: function(tooltipItems) {
                                return `Categoria: ${tooltipItems[0].label}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            color: '#2c3e50', // Cor escura para contraste
                            font: {
                                size: 12,
                                weight: '600',
                                family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                            },
                            maxRotation: 45,
                            minRotation: 45
                        },
                        
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(44, 62, 80, 0.1)', // Grid sutil
                            drawBorder: false,
                            tickLength: 0
                        },
                        ticks: {
                            color: '#2c3e50', // Cor escura para contraste
                            font: {
                                size: 12,
                                weight: '600',
                                family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                            },
                            padding: 10,
                            callback: function(value) {
                                if (value >= 1000) {
                                    return 'R$ ' + (value / 1000).toFixed(1) + ' mil';
                                }
                                return 'R$ ' + value;
                            }
                        },
                        title: {
                            display: true,
                            text: 'VALOR (R$)',
                            color: '#2c3e50', // Cor escura para contraste
                            font: {
                                size: 14,
                                weight: 'bold'
                            },
                            padding: { top: 10, bottom: 15 }
                        }
                    }
                },
                animation: {
                    duration: 1200,
                    easing: 'easeOutQuart'
                }
            }
        });

        console.log('✅ Gráfico de barras renderizado com sucesso!', {
            categorias: categoryLabels,
            dados: categoryData
        });
        
    } catch (error) {
        console.error('❌ Erro ao renderizar gráfico de categorias:', error);
        
        const ctxCategorySales = document.getElementById('categoryChart');
        if (ctxCategorySales) {
            ctxCategorySales.innerHTML = `
                <div class="empty-chart" style="
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    height: 100%; 
                    flex-direction: column; 
                    color: #e74c3c;
                ">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <p style="font-weight: bold; color: #2c3e50;">Erro ao carregar gráfico</p>
                    <small style="color: #7f8c8d;">Recarregue a página</small>
                </div>
            `;
        }
    }
}

function renderTopSellingTable(sales) {
    try {
        const productProfitMap = {};
        
        sales.forEach(sale => {
            sale.items.forEach(item => {
                const product = products.find(p => p.id === item.id);
                if (product) {
                    const profit = (item.preco - item.custo) * item.quantity;
                    if (!productProfitMap[product.id]) {
                        productProfitMap[product.id] = {
                            nome: product.nome,
                            profit: 0,
                            quantitySold: 0,
                            revenue: 0
                        };
                    }
                    productProfitMap[product.id].profit += profit;
                    productProfitMap[product.id].quantitySold += item.quantity;
                    productProfitMap[product.id].revenue += item.preco * item.quantity;
                }
            });
        });

        const topSelling = Object.values(productProfitMap)
            .sort((a, b) => b.profit - a.profit)
            .slice(0, 5);

        const topSellingTbody = document.getElementById('top-selling-table-tbody');
        if (!topSellingTbody) return;

        topSellingTbody.innerHTML = topSelling.length > 0 ? 
            topSelling.map((p, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${sanitizeHTML(p.nome)}</td>
                    <td>${p.profit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td>${p.quantitySold}</td>
                </tr>
            `).join('') : 
            '<tr><td colspan="4" style="text-align: center; padding: 20px;">Nenhuma venda no período</td></tr>';
            
    } catch (error) {
        console.error('Erro ao renderizar tabela top vendas:', error);
    }
}

function renderSalesDetailsTable(sales) {
    try {
        const salesReportTbody = document.querySelector('#sales-report-table tbody');
        if (!salesReportTbody) {
            console.error('Tabela de vendas não encontrada');
            return;
        }

        salesReportTbody.innerHTML = '';

        if (sales.length === 0) {
            salesReportTbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: var(--color-text-secondary);">
                        <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                        <br>
                        Nenhuma venda encontrada no período
                    </td>
                </tr>
            `;
            return;
        }

        // Adiciona campo de pesquisa se não existir
        const existingSearch = document.getElementById('sales-search');
        if (!existingSearch) {
            const tableHeader = salesReportTbody.closest('.table-responsive').previousElementSibling;
            if (tableHeader) {
                const searchHtml = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px;">
                        <h3 class="card-title" style="margin: 0;">Relatório de Vendas</h3>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <div style="position: relative;">
                                <input type="text" id="sales-search" placeholder="Pesquisar por ID, cliente, pagamento..." 
                                       style="padding: 10px 15px; padding-left: 40px; width: 350px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg-tertiary); color: var(--color-text-primary); font-size: 14px; transition: all 0.3s ease;">
                                <i class="fas fa-search" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: var(--color-text-secondary);"></i>
                            </div>
                            <button class="submit-btn delete-btn" onclick="clearSalesSearch()" style="padding: 10px 15px; white-space: nowrap;" title="Limpar pesquisa">
                                <i class="fas fa-times"></i> Limpar
                            </button>
                        </div>
                    </div>
                `;
                tableHeader.innerHTML = searchHtml;

                // Configura a pesquisa
                setTimeout(() => {
                    setupSalesSearch();
                }, 100);
            }
        }

        // Renderiza cada venda
        sales.forEach(sale => {
            const row = salesReportTbody.insertRow();
            
            // Garante que os dados existem
            const saleId = sale.id || 'N/A';
            const timestamp = sale.timestamp || 'Data não disponível';
            const total = sale.total || 0;
            const payment = sale.payment || 'Não informado';
            const itemsCount = sale.items ? sale.items.length : 0;
            const client = sale.client || '';
            
            row.innerHTML = `
                <td>#${saleId}</td>
                <td>${sanitizeHTML(timestamp)}</td>
                <td>${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td>${sanitizeHTML(payment)}</td>
                <td>${itemsCount} item(s)</td>
                <td>${client ? sanitizeHTML(client) : '<em style="color: var(--color-text-tertiary);">Não informado</em>'}</td>
                <td>
                    <button class="action-btn view-btn" onclick="viewSaleDetails(${saleId})" title="Ver detalhes da venda">
                        <i class="fas fa-eye"></i> Detalhes
                    </button>
                </td>
            `;
        });

        console.log('✅ Tabela de vendas renderizada com pesquisa:', sales.length, 'vendas');

    } catch (error) {
        console.error('❌ Erro ao renderizar tabela de vendas:', error);
    }
}


// CORREÇÃO: Gráfico de Análise de Vendas (Últimos 30 Dias)
function initializeDashboardCharts() {
    try {
        const ctxDailySales = document.getElementById('daily-sales-chart');
        if (!ctxDailySales) {
            console.error('Canvas do gráfico não encontrado');
            return;
        }
        
        // Destruir gráfico anterior se existir
        if (window.dailySalesChart && typeof window.dailySalesChart.destroy === 'function') {
            window.dailySalesChart.destroy();
        }

        // Prepara dados dos últimos 30 dias
        const salesLast30Days = {};
        const today = new Date();
        
        // Inicializa os últimos 30 dias com zero
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            salesLast30Days[dateKey] = 0;
        }

        // Preenche com vendas reais
        salesHistory.forEach(sale => {
            let saleDate;
            
            if (sale.date) {
                saleDate = sale.date;
            } else if (sale.timestamp) {
                try {
                    const dateObj = new Date(sale.timestamp);
                    saleDate = dateObj.toISOString().split('T')[0];
                } catch (e) {
                    console.warn('Data inválida na venda:', sale.id);
                    return;
                }
            } else {
                return;
            }
            
            if (salesLast30Days.hasOwnProperty(saleDate)) {
                salesLast30Days[saleDate] += (sale.total || 0);
            }
        });

        // Prepara arrays para o gráfico
        const labels = Object.keys(salesLast30Days).sort();
        const data = labels.map(key => salesLast30Days[key]);
        
        // Formata labels para DD/MM (mais legível)
        const formattedLabels = labels.map(dateKey => {
            const [year, month, day] = dateKey.split('-');
            return `${day}/${month}`;
        });

        // Cria o gráfico
        window.dailySalesChart = new Chart(ctxDailySales, {
            type: 'line',
            data: {
                labels: formattedLabels,
                datasets: [{
                    label: 'Vendas (R$)',
                    data: data,
                    backgroundColor: 'rgba(10, 132, 255, 0.1)',
                    borderColor: '#0A84FF',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#0A84FF',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        callbacks: {
                            label: function(context) {
                                return `Vendas: R$ ${context.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#8E8E93',
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#8E8E93',
                            callback: function(value) {
                                return 'R$ ' + value.toLocaleString('pt-BR');
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });

        console.log('Gráfico de vendas inicializado com sucesso - Período: 30 dias');
        
    } catch (error) {
        console.error('Erro ao inicializar gráfico de vendas:', error);
        
        // Fallback: mostra mensagem de erro
        const ctxDailySales = document.getElementById('daily-sales-chart');
        if (ctxDailySales) {
            ctxDailySales.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; flex-direction: column; color: #8E8E93;">
                    <i class="fas fa-chart-line" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <p>Erro ao carregar gráfico</p>
                    <small>Recarregue a página</small>
                </div>
            `;
        }
    }
}

// CORREÇÃO: Função para forçar recriação do gráfico (útil para debug)
function recriarGraficoVendas() {
    if (window.dailySalesChart) {
        window.dailySalesChart.destroy();
        window.dailySalesChart = null;
    }
    initializeDashboardCharts();
}




// CORREÇÃO: Verificar se o canvas existe no DOM
function verificarElementosDashboard() {
    const canvas = document.getElementById('daily-sales-chart');
    if (!canvas) {
        console.error('Canvas do gráfico não encontrado no DOM');
        // Tentar recriar após um tempo
        setTimeout(initializeDashboardCharts, 1000);
        return false;
    }
    return true;
}

// CORREÇÃO: Adicionar ao DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    // ... seu código existente
    
    // Verificar e inicializar gráfico
    setTimeout(() => {
        if (verificarElementosDashboard()) {
            initializeDashboardCharts();
        }
    }, 1000);
});

// CORREÇÃO: CSS para garantir que o gráfico tenha altura
const style = document.createElement('style');
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

// Função para recriar o gráfico (use no console se necessário)
function recriarGraficoVendas() {
    if (dailySalesChart) {
        dailySalesChart.destroy();
        dailySalesChart = null;
    }
    initializeDashboardCharts();
}

// No console, você pode executar: recriarGraficoVendas()

// Variável para controlar alertas ocultos
let hiddenAlerts = JSON.parse(localStorage.getItem('hiddenAlerts')) || [];

function updateAlerts() {
    try {
        // Filtra produtos com estoque baixo, exceto os ocultos
        const lowStockProducts = products.filter(p => 
            p.quantidade <= p.minimo && !hiddenAlerts.includes(p.id)
        );
        
        const alertListDropdown = document.getElementById('alerts-dropdown-list');
        const dashboardAlertList = document.getElementById('dashboard-alert-list');
        const bellIcon = document.getElementById('bell-icon');

        // Renderiza dropdown do sino
        if (alertListDropdown) {
            alertListDropdown.innerHTML = '';
            
            if (lowStockProducts.length === 0) {
                alertListDropdown.innerHTML = `
                    <div class="no-alerts">
                        <i class="fas fa-check-circle"></i>
                        <p>Estoque saudável</p>
                        <small>Nenhum alerta</small>
                    </div>
                `;
            } else {
                lowStockProducts.forEach(p => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <div class="alert-content">
                            <i class="fas fa-exclamation-triangle alert-icon"></i>
                            <span class="alert-text">
                                <strong>${sanitizeHTML(p.nome)}</strong><br>
                                <small>Estoque: ${p.quantidade} (mín: ${p.minimo})</small>
                            </span>
                        </div>
                        <button class="remove-alert-btn" onclick="hideAlert(${p.id})" title="Ocultar alerta">
                            <i class="fas fa-times"></i>
                        </button>
                    `;
                    alertListDropdown.appendChild(li);
                });
            }
        }

        // Renderiza lista do dashboard (sem botões de remover)
        if (dashboardAlertList) {
            dashboardAlertList.innerHTML = '';
            
            if (lowStockProducts.length === 0) {
                dashboardAlertList.innerHTML = `<li><i class="fas fa-check-circle" style="color: var(--color-accent-green); margin-right: 5px;"></i> Estoque saudável.</li>`;
            } else {
                lowStockProducts.forEach(p => {
                    const li = document.createElement('li');
                    li.innerHTML = `<i class="fas fa-exclamation-triangle" style="color: var(--color-accent-red); margin-right: 5px;"></i> ${sanitizeHTML(p.nome)} (${p.quantidade} und.)`;
                    dashboardAlertList.appendChild(li);
                });
            }
        }

        // Atualiza estado do sino
        if (bellIcon) {
            if (lowStockProducts.length > 0) {
                bellIcon.classList.add('has-alerts');
            } else {
                bellIcon.classList.remove('has-alerts');
            }
        }
        
    } catch (error) {
        console.error('Erro ao atualizar alertas:', error);
    }
}

// Função para ocultar alerta individual
function hideAlert(productId) {
    if (!hiddenAlerts.includes(productId)) {
        hiddenAlerts.push(productId);
        localStorage.setItem('hiddenAlerts', JSON.stringify(hiddenAlerts));
        updateAlerts();
        
        // Fecha o dropdown após ocultar
        setTimeout(() => {
            const dropdown = document.getElementById('alerts-floating-window');
            if (dropdown) dropdown.style.display = 'none';
        }, 300);
    }
}

// Função para limpar todos os alertas
function clearAllAlerts() {
    const currentAlerts = products.filter(p => p.quantidade <= p.minimo).map(p => p.id);
    
    if (currentAlerts.length === 0) {
        alert("Não há alertas para limpar!");
        return;
    }
    
    if (!confirm(`Deseja ocultar todos os ${currentAlerts.length} alertas?`)) {
        return;
    }
    
    // Adiciona todos os alertas atuais à lista de ocultos
    hiddenAlerts = [...new Set([...hiddenAlerts, ...currentAlerts])];
    localStorage.setItem('hiddenAlerts', JSON.stringify(hiddenAlerts));
    updateAlerts();
    
    // Fecha o dropdown
    const dropdown = document.getElementById('alerts-floating-window');
    if (dropdown) dropdown.style.display = 'none';
    
    alert(`Todos os ${currentAlerts.length} alertas foram ocultados!`);
}

// Função para resetar alertas ocultos (útil para desenvolvimento)
function resetHiddenAlerts() {
    hiddenAlerts = [];
    localStorage.setItem('hiddenAlerts', JSON.stringify(hiddenAlerts));
    updateAlerts();
    alert("Alertas ocultos resetados!");
}

// Execute no console: resetHiddenAlerts() se precisar

// Versão mais direta - fecha ao clicar em qualquer lugar
document.addEventListener('click', function(event) {
    const modal = document.getElementById('sale-details-modal');
    if (event.target === modal) {
        closeSaleDetails();
    }
});

// Variável para armazenar a venda atual sendo visualizada
let currentSaleView = null;

// Função para abrir detalhes da venda
// CORREÇÃO: Botão Detalhes da venda funcionando
function viewSaleDetails(saleId) {
    try {
        console.log('Abrindo detalhes da venda:', saleId);
        
        const sale = salesHistory.find(s => s.id === saleId);
        if (!sale) {
            alert('Venda não encontrada!');
            return;
        }
        
        // Preenche as informações básicas da venda
        document.getElementById('detail-sale-id').textContent = `#${sale.id}`;
        document.getElementById('detail-sale-date').textContent = sale.timestamp || 'Data não disponível';
        document.getElementById('detail-sale-payment').textContent = sale.payment || 'Não informado';
        document.getElementById('detail-sale-total').textContent = 
            (sale.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        // Remove cliente anterior se existir
        const existingClient = document.querySelector('.client-meta-item');
        if (existingClient) {
            existingClient.remove();
        }
        
        // Adiciona cliente se existir
        const saleMeta = document.querySelector('.sale-meta');
        if (sale.client && sale.client.trim() !== '') {
            const clientItem = document.createElement('div');
            clientItem.className = 'meta-item client-meta-item';
            clientItem.innerHTML = `
                <span class="meta-label"><i class="fas fa-user"></i> Cliente:</span>
                <span class="meta-value client-value">${sanitizeHTML(sale.client)}</span>
            `;
            // Insere antes do total
            const totalItem = saleMeta.querySelector('.total-item');
            if (totalItem) {
                saleMeta.insertBefore(clientItem, totalItem);
            } else {
                saleMeta.appendChild(clientItem);
            }
        }
        
        // Renderiza os itens da venda
        const itemsContainer = document.getElementById('detail-sale-items');
        itemsContainer.innerHTML = '';
        
        if (sale.items && Array.isArray(sale.items) && sale.items.length > 0) {
            let subtotal = 0;
            
            sale.items.forEach((item, index) => {
                const itemElement = document.createElement('div');
                itemElement.className = 'item-detail';
                
                // Garante que os valores são números
                const preco = parseFloat(item.preco) || 0;
                const quantidade = parseInt(item.quantity) || 0;
                const totalItem = preco * quantidade;
                subtotal += totalItem;
                
                // Calcula lucro do item
                const custo = parseFloat(item.custo) || 0;
                const lucroItem = totalItem - (custo * quantidade);
                const margem = totalItem > 0 ? (lucroItem / totalItem) * 100 : 0;
                
                itemElement.innerHTML = `
                    <div class="item-header">
                        <span class="item-name">${sanitizeHTML(item.nome || 'Produto sem nome')}</span>
                        <span class="item-total">R$ ${totalItem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div class="item-details">
                        <div class="item-qty-price">
                            <span class="qty">${quantidade} Uni. -- R$ ${preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div class="item-profit-info">
                            <span class="profit-badge ${lucroItem >= 0 ? 'profit-positive' : 'profit-negative'}">
                                <i class="fas ${lucroItem >= 0 ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
                                Lucro: R$ ${lucroItem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${margem.toFixed(1)}%)
                            </span>
                        </div>
                    </div>
                `;
                itemsContainer.appendChild(itemElement);
            });
            
            // Linha de totais
            const totalElement = document.createElement('div');
            totalElement.className = 'sale-totals';
            totalElement.innerHTML = `
                <div class="total-line">
                    <span class="total-label">Subtotal:</span>
                    <span class="total-value">R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="total-line main-total">
                    <span class="total-label">Total da Venda:</span>
                    <span class="total-value">R$ ${(sale.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
            `;
            itemsContainer.appendChild(totalElement);
            
        } else {
            itemsContainer.innerHTML = `
                <div class="no-items-message">
                    <i class="fas fa-shopping-cart"></i>
                    <h4>Nenhum item encontrado</h4>
                    <p>Esta venda não contém itens registrados.</p>
                </div>
            `;
        }
        
        // Mostra o modal
        document.getElementById('sale-details-modal').style.display = 'flex';
        
        console.log('Detalhes da venda carregados com sucesso');
        
    } catch (error) {
        console.error('Erro ao abrir detalhes da venda:', error);
        alert('Erro ao carregar detalhes da venda. Verifique o console para mais informações.');
    }
}


// Função para fechar detalhes da venda
function closeSaleDetails() {
    document.getElementById('sale-details-modal').style.display = 'none';
}

// Fechar modal ao clicar fora ou pressionar ESC
document.addEventListener('click', function(event) {
    const modal = document.getElementById('sale-details-modal');
    if (event.target === modal) {
        closeSaleDetails();
    }
});

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeSaleDetails();
    }
});

// ==================================================
// CONFIGURAÇÕES DO SISTEMA - NOVAS FUNÇÕES
// ==================================================









// Inicializar configurações
function initSystemConfig() {
    renderCategoriesManager();
    renderPaymentsManager();
    setupConfigTabs();
    updateStorageInfo();
}

// Abas de configuração
function setupConfigTabs() {
    const tabButtons = document.querySelectorAll('.config-tab-button');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-config-tab');
            showConfigTab(tabId);
        });
    });
}

function showConfigTab(tabId) {
    // Remove classe ativa de todos os botões
    document.querySelectorAll('.config-tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Esconde todos os conteúdos
    document.querySelectorAll('.config-tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    // Ativa o botão e conteúdo selecionado
    const activeButton = document.querySelector(`[data-config-tab="${tabId}"]`);
    const activeContent = document.getElementById(`${tabId}-tab`);
    
    if (activeButton && activeContent) {
        activeButton.classList.add('active');
        activeContent.style.display = 'block';
        activeContent.classList.add('active');
    }
}

// Gerenciador de Categorias
function renderCategoriesManager() {
    const container = document.getElementById('categories-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    config.categories.forEach((category, index) => {
        const categoryElement = document.createElement('div');
        categoryElement.className = 'category-item';
        categoryElement.innerHTML = `
            <span class="category-name">${category}</span>
            <div class="category-actions">
                <button class="edit-category-btn" onclick="editCategory(${index})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="delete-category-btn" onclick="deleteCategory(${index})" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(categoryElement);
    });
}

function addNewCategory() {
    const input = document.getElementById('new-category-name');
    const name = input.value.trim();
    
    if (!name) {
        alert('Digite um nome para a categoria!');
        return;
    }
    
    if (config.categories.includes(name)) {
        alert('Esta categoria já existe!');
        return;
    }
    
    config.categories.push(name);
    persistData();
    renderCategoriesManager();
    updateCategorySelect();
    
    input.value = '';
    alert(`Categoria "${name}" adicionada com sucesso!`);
}

function editCategory(index) {
    const newName = prompt('Editar nome da categoria:', config.categories[index]);
    
    if (newName && newName.trim()) {
        config.categories[index] = newName.trim();
        persistData();
        renderCategoriesManager();
        updateCategorySelect();
        alert('Categoria atualizada!');
    }
}

function deleteCategory(index) {
    const categoryName = config.categories[index];
    
    if (!confirm(`Tem certeza que deseja excluir a categoria "${categoryName}"?`)) {
        return;
    }
    
    // Verifica se há produtos usando esta categoria
    const productsUsingCategory = products.filter(p => p.categoria === categoryName);
    
    if (productsUsingCategory.length > 0) {
        if (!confirm(`⚠️ ${productsUsingCategory.length} produto(s) usam esta categoria. Eles serão movidos para "${config.categories[0]}". Continuar?`)) {
            return;
        }
        
        // Move os produtos para a primeira categoria
        productsUsingCategory.forEach(product => {
            product.categoria = config.categories[0];
        });
        renderProductTable();
    }
    
    config.categories.splice(index, 1);
    persistData();
    renderCategoriesManager();
    updateCategorySelect();
    alert('Categoria excluída!');
}

// Gerenciador de Pagamentos (similar às categorias)
function renderPaymentsManager() {
    const container = document.getElementById('payments-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    config.paymentTypes.forEach((payment, index) => {
        const paymentElement = document.createElement('div');
        paymentElement.className = 'payment-item';
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

function addNewPayment() {
    const input = document.getElementById('new-payment-name');
    const name = input.value.trim();
    
    if (!name) {
        alert('Digite um nome para o método de pagamento!');
        return;
    }
    
    if (config.paymentTypes.includes(name)) {
        alert('Este método de pagamento já existe!');
        return;
    }
    
    config.paymentTypes.push(name);
    persistData();
    renderPaymentsManager();
    
    input.value = '';
    alert(`Método de pagamento "${name}" adicionado com sucesso!`);
}

function editPayment(index) {
    const newName = prompt('Editar método de pagamento:', config.paymentTypes[index]);
    
    if (newName && newName.trim()) {
        config.paymentTypes[index] = newName.trim();
        persistData();
        renderPaymentsManager();
        alert('Método de pagamento atualizado!');
    }
}

function deletePayment(index) {
    const paymentName = config.paymentTypes[index];
    
    if (!confirm(`Tem certeza que deseja excluir o método "${paymentName}"?`)) {
        return;
    }
    
    config.paymentTypes.splice(index, 1);
    persistData();
    renderPaymentsManager();
    alert('Método de pagamento excluído!');
}

// Configurações Gerais
function renderGeneralConfig() {
    // Preenche os campos com os valores atuais
    document.getElementById('alert-enabled').checked = systemConfig.alertsEnabled;
    document.getElementById('auto-save-interval').value = systemConfig.autoSaveInterval;
    document.getElementById('default-report-period').value = systemConfig.defaultReportPeriod;
    document.getElementById('show-profit-margin').checked = systemConfig.showProfitMargin;
    document.getElementById('auto-print-receipt').checked = systemConfig.autoPrintReceipt;
    document.getElementById('theme-select').value = systemConfig.theme;
    document.getElementById('compact-mode').checked = systemConfig.compactMode;
    
    // Preenche o select de pagamento padrão
    const paymentSelect = document.getElementById('default-payment-method');
    paymentSelect.innerHTML = '';
    config.paymentTypes.forEach(payment => {
        const option = document.createElement('option');
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
        alertsEnabled: document.getElementById('alert-enabled').checked,
        autoSaveInterval: parseInt(document.getElementById('auto-save-interval').value) || 5,
        defaultReportPeriod: parseInt(document.getElementById('default-report-period').value) || 30,
        showProfitMargin: document.getElementById('show-profit-margin').checked,
        defaultPaymentMethod: document.getElementById('default-payment-method').value,
        autoPrintReceipt: document.getElementById('auto-print-receipt').checked,
        theme: document.getElementById('theme-select').value,
        compactMode: document.getElementById('compact-mode').checked
    };
    
    localStorage.setItem('systemConfig', JSON.stringify(systemConfig));
    applySystemConfig();
    alert('Configurações salvas com sucesso!');
}


function applySystemConfig() {
    // Aplica o tema
    document.body.setAttribute('data-theme', systemConfig.theme);
    
    // Aplica modo compacto
    if (systemConfig.compactMode) {
        document.body.classList.add('compact-mode');
    } else {
        document.body.classList.remove('compact-mode');
    }
    
    // Atualiza alertas
    updateAlerts();
}



// Backup e Restauração
function exportData(type = 'all') {
    let data = {};
    
    switch (type) {
        case 'products':
            data = { products };
            break;
        case 'sales':
            data = { salesHistory };
            break;
        default:
            data = {
                products,
                salesHistory,
                savedCarts,
                logHistory,
                config,
                systemConfig,
                exportDate: new Date().toISOString()
            };
    }
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup-stockbrasil-${type}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    alert(`Backup de ${type} exportado com sucesso!`);
}

function importData() {
    const fileInput = document.getElementById('backup-file');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Selecione um arquivo de backup!');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (!confirm(`⚠️ Isso substituirá seus dados atuais. Continuar?`)) {
                return;
            }
            
            if (data.products) products = data.products;
            if (data.salesHistory) salesHistory = data.salesHistory;
            if (data.savedCarts) savedCarts = data.savedCarts;
            if (data.logHistory) logHistory = data.logHistory;
            if (data.config) config = data.config;
            if (data.systemConfig) systemConfig = data.systemConfig;
            
            persistData();
            loadInitialData();
            applySystemConfig();
            
            alert('Dados importados com sucesso!');
            fileInput.value = '';
            
        } catch (error) {
            alert('Erro ao importar arquivo. Verifique se é um backup válido.');
            console.error(error);
        }
    };
    reader.readAsText(file);
}

function clearOldSales() {
    if (!confirm('Limpar vendas com mais de 1 ano? Isso não pode ser desfeito.')) {
        return;
    }
    
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const initialCount = salesHistory.length;
    salesHistory = salesHistory.filter(sale => {
        const saleDate = sale.date ? new Date(sale.date) : new Date(sale.timestamp);
        return saleDate > oneYearAgo;
    });
    
    const removedCount = initialCount - salesHistory.length;
    persistData();
    updateDashboardMetrics();
    
    alert(`${removedCount} vendas antigas foram removidas!`);
}

function clearAllData() {
    if (!confirm('⚠️🚨 ATENÇÃO: Isso apagará TODOS os dados do sistema! Esta ação não pode ser desfeita. Continuar?')) {
        return;
    }
    
    if (!confirm('🚨 TEM CERTEZA ABSOLUTA? Todos os produtos, vendas e configurações serão perdidos!')) {
        return;
    }
    
    // Reseta tudo
    products = [];
    salesHistory = [];
    savedCarts = [];
    logHistory = [];
    config = {
        categories: ["Vestuário", "Eletrônicos", "Brindes", "Serviços", "Outros"],
        paymentTypes: ["Pix", "Cartão de Crédito", "Dinheiro", "Boleto"]
    };
    
    localStorage.clear();
    loadInitialData();
    
    alert('Todos os dados foram apagados! O sistema foi reiniciado.');
}

function updateStorageInfo() {
    const totalSize = JSON.stringify(localStorage).length;
    const usedPercentage = (totalSize / (5 * 1024 * 1024)) * 100; // 5MB é o limite comum
    
    document.getElementById('storage-used').style.width = `${Math.min(usedPercentage, 100)}%`;
    document.getElementById('storage-text').textContent = 
        `${(totalSize / 1024).toFixed(1)} KB usado (${usedPercentage.toFixed(1)}% do limite)`;
}

// Inicializar quando carregar a página
document.addEventListener('DOMContentLoaded', function() {
    initSystemConfig();
    applySystemConfig();
    setTimeout(() => {
        setupCartClientAutocomplete();
    }, 1000);
});

// Adicione esta biblioteca no <head> do seu HTML:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js"></script>

// =================================================================
// CORREÇÃO: FUNÇÕES QUE ESTAVAM FALTANDO
// =================================================================

// Função para calcular vendas por categoria
function calculateCategorySales(sales) {
    const categoryMap = {};
    
    sales.forEach(sale => {
        if (sale.items && Array.isArray(sale.items)) {
            sale.items.forEach(item => {
                const product = products.find(p => p.id === item.id);
                const category = product ? product.categoria : 'Sem Categoria';
                const value = (item.preco || 0) * (item.quantity || 0);
                
                categoryMap[category] = (categoryMap[category] || 0) + value;
            });
        }
    });
    
    // Ordena por valor decrescente
    return Object.entries(categoryMap)
        .sort((a, b) => b[1] - a[1])
        .reduce((obj, [key, value]) => {
            obj[key] = value;
            return obj;
        }, {});
}

// Função para calcular métodos de pagamento
function calculatePaymentMethods(sales) {
    const paymentMap = {};
    
    sales.forEach(sale => {
        const method = sale.payment || 'Não informado';
        paymentMap[method] = (paymentMap[method] || 0) + 1;
    });
    
    return paymentMap;
}

// Função para obter produtos mais vendidos
function getTopSellingProducts(sales, limit = 10) {
    const productMap = {};
    
    sales.forEach(sale => {
        if (sale.items && Array.isArray(sale.items)) {
            sale.items.forEach(item => {
                if (!productMap[item.id]) {
                    productMap[item.id] = {
                        id: item.id,
                        nome: item.nome || 'Produto sem nome',
                        quantitySold: 0,
                        revenue: 0
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

// Função para obter produtos mais lucrativos
function getTopProfitableProducts(sales, limit = 10) {
    const productMap = {};
    
    sales.forEach(sale => {
        if (sale.items && Array.isArray(sale.items)) {
            sale.items.forEach(item => {
                if (!productMap[item.id]) {
                    productMap[item.id] = {
                        id: item.id,
                        nome: item.nome || 'Produto sem nome',
                        revenue: 0,
                        cost: 0,
                        profit: 0
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

// Função para obter top clientes
function getTopClients(sales, limit = 5) {
    const clientMap = {};
    
    sales.forEach(sale => {
        if (sale.client && sale.client.trim() !== '') {
            if (!clientMap[sale.client]) {
                clientMap[sale.client] = {
                    name: sale.client,
                    totalSpent: 0,
                    purchases: 0
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

// Função para gerar insights
function generateInsights(sales, metrics) {
    const insights = [];
    
    if (sales.length === 0) {
        return ['• Nenhuma venda no período selecionado'];
    }
    
    // Insight de crescimento
    if (sales.length >= 2) {
        const recent = sales.slice(0, Math.ceil(sales.length / 2));
        const older = sales.slice(Math.ceil(sales.length / 2));
        const recentTotal = recent.reduce((sum, s) => sum + (s.total || 0), 0);
        const olderTotal = older.reduce((sum, s) => sum + (s.total || 0), 0);
        
        if (recentTotal > olderTotal * 1.2) {
            insights.push('• 📈 Crescimento significativo nas vendas recentes');
        } else if (recentTotal < olderTotal * 0.8) {
            insights.push('• 📉 Queda nas vendas no período recente');
        } else {
            insights.push('• ⚖️ Estabilidade nas vendas ao longo do período');
        }
    }
    
    // Insight de ticket médio
    if (metrics.averageTicket > 100) {
        insights.push('• 💎 Ticket médio alto indica vendas de alto valor');
    } else if (metrics.averageTicket > 50) {
        insights.push('• 💰 Ticket médio dentro da média esperada');
    } else {
        insights.push('• 🛒 Ticket médio baixo, considere upselling');
    }
    
    // Insight de margem
    if (metrics.totalRevenue > 0) {
        const margin = (metrics.estimatedProfit / metrics.totalRevenue) * 100;
        if (margin > 40) {
            insights.push('• 🎯 Margem de lucro excelente');
        } else if (margin > 20) {
            insights.push('• ✅ Margem de lucro saudável');
        } else {
            insights.push('• ⚠️ Margem de lucro baixa, revise preços');
        }
    }
    
    // Insight de clientes
    const salesWithClient = sales.filter(s => s.client && s.client.trim() !== '');
    if (salesWithClient.length / sales.length > 0.7) {
        insights.push('• 👥 Alta taxa de identificação de clientes');
    } else {
        insights.push('• 🗣️ Oportunidade: Melhorar identificação de clientes');
    }
    
    return insights;
}

// =================================================================
// CORREÇÃO: FUNÇÃO setupCartClientAutocomplete
// =================================================================

function setupCartClientAutocomplete() {
    // Esta função é chamada no carregamento, mas não é crítica
    // Pode ser removida ou implementada se necessário
    console.log('Auto-complete de clientes inicializado');
}

// =================================================================
// CORREÇÃO: PROBLEMA NO ID DO STYLE
// =================================================================

// Remova ou corrija a linha problemática (linha 4112)
// Substitua por:
function setupSaleDetailsStyles() {
    if (!document.querySelector('#sale-details-beautiful-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'sale-details-beautiful-styles';
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

// =================================================================
// INICIALIZAÇÃO CORRIGIDA
// =================================================================

// Atualize o DOMContentLoaded para incluir as novas funções
document.addEventListener('DOMContentLoaded', function() {
    // Sua inicialização existente...
    
    // Adicione estas linhas:
    window.setupCartClientAutocomplete = setupCartClientAutocomplete;
    window.setupSaleDetailsStyles = setupSaleDetailsStyles;
    
    // Inicialize as funções
    setupCartClientAutocomplete();
    setupSaleDetailsStyles();
    
    // Torne as funções do PDF disponíveis globalmente
    window.calculateCategorySales = calculateCategorySales;
    window.calculatePaymentMethods = calculatePaymentMethods;
    window.getTopSellingProducts = getTopSellingProducts;
    window.getTopProfitableProducts = getTopProfitableProducts;
    window.getTopClients = getTopClients;
    window.generateInsights = generateInsights;
    
    console.log('Todas as funções do PDF inicializadas com sucesso!');
});

// =================================================================
// VERSÃO SIMPLIFICADA DO generateCompletePDF PARA TESTE
// =================================================================



// =================================================================
// BOTÃO ALTERNATIVO PARA TESTE
// =================================================================

// Use esta função temporariamente para testar:
function testPDF() {
    if (typeof generateCompletePDF === 'function') {
        generateCompletePDF();
    } else if (typeof generateCompletePDFSimple === 'function') {
        generateCompletePDFSimple();
    } else {
        alert('❌ Funções do PDF não carregadas. Recarregue a página.');
    }
}

// Adicione este botão temporário no HTML para teste:
/*
<button class="submit-btn blue-btn" onclick="testPDF()">
    <i class="fas fa-file-pdf"></i> Testar PDF
</button>
*/



// Relatório de Vendas em PDF
// =================================================================
// CORREÇÃO: RELATÓRIO PDF COM NOME DO CLIENTE
// =================================================================

function generateSalesPDF(doc, startDate, endDate) {
    const sales = getSalesDataForPeriod(
        startDate.toLocaleDateString('pt-BR'), 
        endDate.toLocaleDateString('pt-BR')
    );
    
    // Cabeçalho
    doc.setFontSize(20);
    doc.setTextColor(41, 128, 185);
    doc.text('RELATÓRIO DE VENDAS', 105, 20, { align: 'center' });
    
    // Período
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Período: ${startDate.toLocaleDateString('pt-BR')} à ${endDate.toLocaleDateString('pt-BR')}`, 105, 30, { align: 'center' });
    
    // Métricas
    const metrics = calculateReportMetrics(sales);
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total de Vendas: R$ ${metrics.totalSales.toLocaleString('pt-BR')}`, 20, 50);
    doc.text(`Transações: ${metrics.totalTransactions}`, 20, 60);
    doc.text(`Ticket Médio: R$ ${metrics.averageTicket.toLocaleString('pt-BR')}`, 20, 70);
    doc.text(`Lucro Estimado: R$ ${metrics.estimatedProfit.toLocaleString('pt-BR')}`, 20, 80);
    
    // Tabela de vendas (apenas as 20 mais recentes) - AGORA COM CLIENTE
    const tableData = sales.slice(0, 20).map(sale => [
        `#${sale.id}`,
        sale.timestamp.split(' ')[0],
        `R$ ${sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        sale.payment,
        sale.client || 'Não informado', // ✅ AGORA INCLUI O CLIENTE
        sale.items.length
    ]);
    
    doc.autoTable({
        startY: 90,
        head: [['ID', 'Data', 'Total', 'Pagamento', 'Cliente', 'Itens']], // ✅ COLUNA CLIENTE ADICIONADA
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
        styles: {
            fontSize: 8, // Fonte menor para caber mais informações
            cellPadding: 3
        },
        columnStyles: {
            0: { cellWidth: 25 }, // ID
            1: { cellWidth: 30 }, // Data
            2: { cellWidth: 35 }, // Total
            3: { cellWidth: 40 }, // Pagamento
            4: { cellWidth: 45 }, // Cliente
            5: { cellWidth: 20 }  // Itens
        }
    });
    
    // Estatísticas de clientes
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    
    // Calcula estatísticas de clientes
    const salesWithClient = sales.filter(sale => sale.client && sale.client.trim() !== '');
    const uniqueClients = [...new Set(salesWithClient.map(sale => sale.client))];
    
    doc.text(`Vendas com cliente informado: ${salesWithClient.length} (${((salesWithClient.length / sales.length) * 100).toFixed(1)}%)`, 20, finalY);
    doc.text(`Clientes únicos: ${uniqueClients.length}`, 20, finalY + 8);
    
    // Top clientes (por valor gasto)
    if (salesWithClient.length > 0) {
        const clientSpending = {};
        salesWithClient.forEach(sale => {
            if (!clientSpending[sale.client]) {
                clientSpending[sale.client] = 0;
            }
            clientSpending[sale.client] += sale.total;
        });
        
        const topClients = Object.entries(clientSpending)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
        
        doc.text(`Top clientes:`, 20, finalY + 20);
        topClients.forEach(([client, total], index) => {
            doc.text(`${index + 1}. ${client}: R$ ${total.toLocaleString('pt-BR')}`, 30, finalY + 30 + (index * 8));
        });
    }
    
    // Rodapé
    const footerY = doc.lastAutoTable.finalY + (salesWithClient.length > 0 ? 50 : 30);
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 105, footerY, { align: 'center' });
    doc.text('StockBrasil - Sistema de Gestão', 105, footerY + 5, { align: 'center' });
}

// =================================================================
// VERSÃO ALTERNATIVA: RELATÓRIO DETALHADO COM CLIENTES
// =================================================================

function generateDetailedSalesPDF(doc, startDate, endDate) {
    const sales = getSalesDataForPeriod(
        startDate.toLocaleDateString('pt-BR'), 
        endDate.toLocaleDateString('pt-BR')
    );
    
    // Cabeçalho
    doc.setFontSize(20);
    doc.setTextColor(41, 128, 185);
    doc.text('RELATÓRIO DETALHADO DE VENDAS', 105, 20, { align: 'center' });
    
    // Período
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Período: ${startDate.toLocaleDateString('pt-BR')} à ${endDate.toLocaleDateString('pt-BR')}`, 105, 30, { align: 'center' });
    
    // Métricas principais
    const metrics = calculateReportMetrics(sales);
    const salesWithClient = sales.filter(sale => sale.client && sale.client.trim() !== '');
    const uniqueClients = [...new Set(salesWithClient.map(sale => sale.client))];
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    
    // Coluna esquerda - Métricas gerais
    doc.text('MÉTRICAS GERAIS:', 20, 50);
    doc.text(`Total de Vendas: R$ ${metrics.totalSales.toLocaleString('pt-BR')}`, 20, 60);
    doc.text(`Transações: ${metrics.totalTransactions}`, 20, 68);
    doc.text(`Ticket Médio: R$ ${metrics.averageTicket.toLocaleString('pt-BR')}`, 20, 76);
    doc.text(`Lucro Estimado: R$ ${metrics.estimatedProfit.toLocaleString('pt-BR')}`, 20, 84);
    
    // Coluna direita - Métricas de clientes
    doc.text('MÉTRICAS DE CLIENTES:', 110, 50);
    doc.text(`Vendas com cliente: ${salesWithClient.length}`, 110, 60);
    doc.text(`Clientes únicos: ${uniqueClients.length}`, 110, 68);
    doc.text(`Taxa de identificação: ${((salesWithClient.length / sales.length) * 100).toFixed(1)}%`, 110, 76);
    
    // Tabela detalhada de vendas
    const tableData = sales.map(sale => [
        `#${sale.id}`,
        sale.timestamp.split(' ')[0],
        `R$ ${sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        sale.payment,
        sale.client || '-',
        sale.items.length,
        sale.items.map(item => item.nome).join(', ').substring(0, 30) + '...'
    ]);
    
    doc.autoTable({
        startY: 100,
        head: [['ID', 'Data', 'Total', 'Pagamento', 'Cliente', 'Itens', 'Produtos']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
        styles: {
            fontSize: 7,
            cellPadding: 2
        },
        margin: { top: 100 }
    });
    
    // Rodapé
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 105, finalY, { align: 'center' });
    doc.text(`Total de registros: ${sales.length} vendas`, 105, finalY + 5, { align: 'center' });
    doc.text('StockBrasil - Sistema de Gestão', 105, finalY + 10, { align: 'center' });
}

// =================================================================
// ATUALIZAR FUNÇÃO generatePDF PARA USAR A VERSÃO CORRIGIDA
// =================================================================

function generatePDF(type) {
    console.log(`📊 Gerando PDF: ${type}`);
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const period = document.getElementById('pdf-period').value;
    let startDate, endDate;
    
    // Define o período
    if (period === 'custom') {
        const startInput = prompt('Data início (DD/MM/AAAA):');
        const endInput = prompt('Data fim (DD/MM/AAAA):');
        
        if (!startInput || !endInput) return;
        
        // Converte DD/MM/AAAA para Date
        const [dayStart, monthStart, yearStart] = startInput.split('/').map(Number);
        const [dayEnd, monthEnd, yearEnd] = endInput.split('/').map(Number);
        
        startDate = new Date(yearStart, monthStart - 1, dayStart);
        endDate = new Date(yearEnd, monthEnd - 1, dayEnd);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            alert('Datas inválidas! Use o formato DD/MM/AAAA.');
            return;
        }
    } else {
        const days = parseInt(period);
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(endDate.getDate() - days);
    }
    
    // Configurações do documento
    doc.setFont('helvetica');
    
    switch (type) {
        case 'sales-report':
            generateSalesPDF(doc, startDate, endDate); // ✅ AGORA COM CLIENTE
            break;
        case 'inventory-report':
            generateInventoryPDF(doc, startDate, endDate);
            break;
        case 'profit-report':
            generateProfitPDF(doc, startDate, endDate);
            break;
        case 'detailed-sales': // ✅ NOVA OPÇÃO DETALHADA
            generateDetailedSalesPDF(doc, startDate, endDate);
            break;
    }
    
    // Salva o PDF
    const filename = `relatorio_${type}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    
    alert(`📄 PDF gerado com sucesso: ${filename}`);
}

// =================================================================
// ATUALIZAR OPÇÕES DE PDF NO HTML (OPCIONAL)
// =================================================================

// Adicione esta opção no HTML se quiser o relatório detalhado:
/*
<div class="pdf-options">
    <button class="submit-btn red-btn" onclick="generatePDF('sales-report')">
        <i class="fas fa-file-pdf"></i> Relatório de Vendas (Simples)
    </button>
    <button class="submit-btn purple-btn" onclick="generatePDF('detailed-sales')">
        <i class="fas fa-file-pdf"></i> Relatório de Vendas (Detalhado)
    </button>
    <button class="submit-btn orange-btn" onclick="generatePDF('inventory-report')">
        <i class="fas fa-clipboard-list"></i> Relatório de Estoque
    </button>
    <button class="submit-btn teal-btn" onclick="generatePDF('profit-report')">
        <i class="fas fa-chart-bar"></i> Relatório de Lucros
    </button>
</div>
*/

// Relatório de Estoque em PDF
function generateInventoryPDF(doc, startDate, endDate) {
    // Cabeçalho
    doc.setFontSize(20);
    doc.setTextColor(39, 174, 96);
    doc.text('RELATÓRIO DE ESTOQUE', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 105, 30, { align: 'center' });
    
    // Métricas
    const totalStock = products.reduce((sum, p) => sum + p.quantidade, 0);
    const lowStockCount = products.filter(p => p.quantidade <= p.minimo).length;
    const totalValue = products.reduce((sum, p) => sum + (p.preco * p.quantidade), 0);
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total de Produtos: ${products.length}`, 20, 50);
    doc.text(`Itens em Estoque: ${totalStock}`, 20, 60);
    doc.text(`Produtos com Estoque Baixo: ${lowStockCount}`, 20, 70);
    doc.text(`Valor Total do Estoque: R$ ${totalValue.toLocaleString('pt-BR')}`, 20, 80);
    
    // Tabela de produtos (apenas estoque baixo ou todos se poucos)
    const showAll = products.length <= 30;
    const displayProducts = showAll ? products : products.filter(p => p.quantidade <= p.minimo);
    
    const tableData = displayProducts.map(product => [
        product.nome.length > 25 ? product.nome.substring(0, 25) + '...' : product.nome,
        product.categoria,
        product.quantidade,
        product.minimo,
        `R$ ${product.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    ]);
    
    doc.autoTable({
        startY: 90,
        head: [['Produto', 'Categoria', 'Estoque', 'Mínimo', 'Preço']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [39, 174, 96] },
        didDrawCell: function(data) {
            // Destaca estoque baixo
            if (data.column.index === 2 && data.cell.raw <= data.row.raw[3]) {
                doc.setTextColor(231, 76, 60);
            }
        }
    });
    
    if (!showAll) {
        const finalY = doc.lastAutoTable.finalY + 5;
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text(`* Mostrando apenas ${displayProducts.length} produtos com estoque baixo`, 20, finalY);
    }
}

// Relatório de Lucros em PDF
function generateProfitPDF(doc, startDate, endDate) {
    const sales = getSalesDataForPeriod(
        startDate.toLocaleDateString('pt-BR'), 
        endDate.toLocaleDateString('pt-BR')
    );
    
    // Cabeçalho
    doc.setFontSize(20);
    doc.setTextColor(155, 89, 182);
    doc.text('RELATÓRIO DE LUCROS', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Período: ${startDate.toLocaleDateString('pt-BR')} à ${endDate.toLocaleDateString('pt-BR')}`, 105, 30, { align: 'center' });
    
    // Cálculo detalhado de lucros
    let totalRevenue = 0;
    let totalCost = 0;
    const productProfits = {};
    
    sales.forEach(sale => {
        sale.items.forEach(item => {
            const revenue = item.preco * item.quantity;
            const cost = item.custo * item.quantity;
            const profit = revenue - cost;
            
            totalRevenue += revenue;
            totalCost += cost;
            
            if (!productProfits[item.id]) {
                productProfits[item.id] = {
                    nome: item.nome,
                    revenue: 0,
                    cost: 0,
                    profit: 0,
                    quantity: 0
                };
            }
            
            productProfits[item.id].revenue += revenue;
            productProfits[item.id].cost += cost;
            productProfits[item.id].profit += profit;
            productProfits[item.id].quantity += item.quantity;
        });
    });
    
    const totalProfit = totalRevenue - totalCost;
    const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    
    // Métricas
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`Receita Total: R$ ${totalRevenue.toLocaleString('pt-BR')}`, 20, 50);
    doc.text(`Custo Total: R$ ${totalCost.toLocaleString('pt-BR')}`, 20, 60);
    doc.text(`Lucro Total: R$ ${totalProfit.toLocaleString('pt-BR')}`, 20, 70);
    doc.text(`Margem de Lucro: ${margin.toFixed(1)}%`, 20, 80);
    
    // Top produtos mais lucrativos
    const topProducts = Object.values(productProfits)
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 15);
    
    const tableData = topProducts.map(product => [
        product.nome.length > 20 ? product.nome.substring(0, 20) + '...' : product.nome,
        product.quantity,
        `R$ ${product.revenue.toLocaleString('pt-BR')}`,
        `R$ ${product.cost.toLocaleString('pt-BR')}`,
        `R$ ${product.profit.toLocaleString('pt-BR')}`
    ]);
    
    doc.autoTable({
        startY: 90,
        head: [['Produto', 'Qtd', 'Receita', 'Custo', 'Lucro']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [155, 89, 182] }
    });
}



function setupClientAutocomplete() {
    const clientInput = document.getElementById('client-name');
    const suggestionsContainer = document.getElementById('client-suggestions');

    if (!clientInput || !suggestionsContainer) return;

    clientInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        suggestionsContainer.innerHTML = '';

        if (searchTerm.length < 2) return;

        // Filtra clientes existentes
        const matchingClients = clients.filter(client => 
            client.name.toLowerCase().includes(searchTerm)
        ).slice(0, 5); // Limita a 5 sugestões

        // Adiciona sugestões
        matchingClients.forEach(client => {
            const suggestion = document.createElement('div');
            suggestion.className = 'client-suggestion';
            suggestion.textContent = client.name;
            suggestion.onclick = () => {
                clientInput.value = client.name;
                suggestionsContainer.innerHTML = '';
            };
            suggestionsContainer.appendChild(suggestion);
        });

        // Sugere adicionar novo cliente se não encontrado
        if (matchingClients.length === 0 && searchTerm.length >= 2) {
            const newSuggestion = document.createElement('div');
            newSuggestion.className = 'client-suggestion new-client';
            newSuggestion.innerHTML = `<i class="fas fa-plus"></i> Adicionar "${searchTerm}" como novo cliente`;
            newSuggestion.onclick = () => {
                addNewClient(searchTerm);
                suggestionsContainer.innerHTML = '';
            };
            suggestionsContainer.appendChild(newSuggestion);
        }
    });

    // Fecha sugestões ao clicar fora
    document.addEventListener('click', (e) => {
        if (!clientInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
            suggestionsContainer.innerHTML = '';
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
        totalSpent: 0
    };

    clients.push(newClient);
    persistData();

    // Preenche o campo com o novo cliente
    document.getElementById('client-name').value = newClient.name;
    
    console.log(`Novo cliente adicionado: ${newClient.name}`);
}

function filterSalesTable(searchTerm) {
    try {
        const searchLower = searchTerm.toLowerCase().trim();
        const rows = document.querySelectorAll('#sales-report-table tbody tr');
        let visibleCount = 0;

        // Remove mensagem de "nenhum resultado" anterior se existir
        const existingNoResults = document.querySelector('#sales-report-table .no-results');
        if (existingNoResults) {
            existingNoResults.remove();
        }

        // Se pesquisa vazia, mostra todas as linhas
        if (searchLower === '') {
            rows.forEach(row => {
                row.style.display = '';
                visibleCount++;
            });
            return;
        }

        // Filtra as linhas
        rows.forEach(row => {
            if (row.cells.length < 6) {
                row.style.display = 'none';
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

            row.style.display = matches ? '' : 'none';
            if (matches) visibleCount++;
        });

        // Mostra mensagem se nenhum resultado for encontrado
        if (visibleCount === 0 && searchLower !== '') {
            const tbody = document.querySelector('#sales-report-table tbody');
            if (tbody) {
                const row = tbody.insertRow();
                row.className = 'no-results';
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

        console.log(`🔍 Pesquisa: "${searchTerm}" | Resultados: ${visibleCount}/${rows.length}`);

    } catch (error) {
        console.error('Erro ao filtrar tabela de vendas:', error);
    }
}

function clearSalesSearch() {
    try {
        const searchInput = document.getElementById('sales-search');
        if (searchInput) {
            searchInput.value = '';
            filterSalesTable('');
            searchInput.focus();
        }
    } catch (error) {
        console.error('Erro ao limpar pesquisa:', error);
    }
}

function setupSalesSearch() {
    const searchInput = document.getElementById('sales-search');
    if (!searchInput) return;

    // Pesquisa em tempo real
    searchInput.addEventListener('input', function(e) {
        filterSalesTable(e.target.value);
    });

    // Limpa com Escape
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            clearSalesSearch();
        }
    });

    // Foca no input quando a página carrega
    setTimeout(() => {
        searchInput.focus();
    }, 1000);
}

// Função para formatar data automaticamente com "/"
function formatarData(input) {
    let value = input.value.replace(/\D/g, '');
    
    if (value.length > 2) {
        value = value.substring(0, 2) + '/' + value.substring(2);
    }
    if (value.length > 5) {
        value = value.substring(0, 5) + '/' + value.substring(5, 9);
    }
    
    input.value = value;
}

// Função para validar e filtrar
function filtrarPorPeriodo() {
    const dataInicio = document.getElementById('data-inicio').value;
    const dataFim = document.getElementById('data-fim').value;
    
    // Validação básica
    if (!dataInicio || !dataFim) {
        alert('Por favor, preencha ambas as datas.');
        return;
    }
    
    // Validação de formato
    const regexData = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!regexData.test(dataInicio) || !regexData.test(dataFim)) {
        alert('Por favor, use o formato DD/MM/AAAA.');
        return;
    }
    
    // Aqui você adiciona a lógica de filtro real
    console.log('Filtrando de:', dataInicio, 'até:', dataFim);
    
    // Exemplo: Atualizar os dados na tela
    alert(`Filtro aplicado!\nPeríodo: ${dataInicio} à ${dataFim}`);
}

// Inicialização quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    // Adicionar eventos de formatação automática
    const dataInicio = document.getElementById('data-inicio');
    const dataFim = document.getElementById('data-fim');
    
    if (dataInicio) {
        dataInicio.addEventListener('input', function() {
            formatarData(this);
        });
        
        // Placeholder dinâmico
        dataInicio.placeholder = 'DD/MM/AAAA';
    }
    
    if (dataFim) {
        dataFim.addEventListener('input', function() {
            formatarData(this);
        });
        
        // Placeholder dinâmico
        dataFim.placeholder = 'DD/MM/AAAA';
    }
    
    // Adicionar evento ao botão filtrar
    const btnFiltrar = document.querySelector('.period-filter-custom .filter-btn');
    if (btnFiltrar) {
        btnFiltrar.addEventListener('click', filtrarPorPeriodo);
    }
    
    // Também filtrar ao pressionar Enter nos campos
    if (dataInicio) {
        dataInicio.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') filtrarPorPeriodo();
        });
    }
    
    if (dataFim) {
        dataFim.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') filtrarPorPeriodo();
        });
    }
});

// Inicializar gráfico de distribuição por categoria

function inicializarGraficoCategoria() {
    try {
        const ctx = document.getElementById('categoryChart');
        if (!ctx) {
            console.warn("Canvas #categoryChart não encontrado.");
            return;
        }

        // Chama a função principal de renderização
        renderCategorySalesChart(salesHistory);
        
        console.log("✅ Gráfico de barras por categoria renderizado com sucesso!");
    } catch (err) {
        console.error("❌ Erro ao inicializar gráfico de categorias:", err);
    }
}

// Chamar a função quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    inicializarGraficoCategoria();
    
    // Seu código existente do filtro aqui...
});

document.addEventListener('DOMContentLoaded', function() {
    // Garante que as funções estejam disponíveis globalmente
    window.viewSaleDetails = viewSaleDetails;
    window.closeSaleDetails = closeSaleDetails;
    window.filterSalesTable = filterSalesTable;
    window.clearSalesSearch = clearSalesSearch;
    
    console.log('Funções de detalhes de venda inicializadas');
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

// Adiciona os estilos ao head do documento
// CORREÇÃO: Adiciona os estilos ao head do documento
if (!document.querySelector('#sale-details-styles')) {
    try {
        const styleElement = document.createElement('style');
        styleElement.id = 'sale-details-styles';
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

// CORREÇÃO: Atualizar métricas da análise visual
function updateReportMetrics() {
    try {
        // Pega todas as vendas (ou você pode filtrar por período se quiser)
        const sales = salesHistory;
        
        if (!sales || sales.length === 0) {
            resetReportMetrics();
            return;
        }

        // Calcula as métricas
        let totalSales = 0;
        let totalRevenue = 0;
        let totalCost = 0;
        let totalProductsSold = 0;
        
        sales.forEach(sale => {
            totalSales += sale.total || 0;
            
            if (sale.items && Array.isArray(sale.items)) {
                sale.items.forEach(item => {
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

        // Atualiza os elementos HTML
        const totalSalesEl = document.getElementById('report-total-sales');
        const totalProfitEl = document.getElementById('report-total-profit');
        const productsSoldEl = document.getElementById('report-products-sold');
        const averageTicketEl = document.getElementById('report-average-ticket');

        if (totalSalesEl) {
            totalSalesEl.textContent = totalSales.toLocaleString('pt-BR', { 
                style: 'currency', 
                currency: 'BRL' 
            });
        }

        if (totalProfitEl) {
            totalProfitEl.textContent = totalProfit.toLocaleString('pt-BR', { 
                style: 'currency', 
                currency: 'BRL' 
            });
        }

        if (productsSoldEl) {
            productsSoldEl.textContent = totalProductsSold.toLocaleString('pt-BR');
        }

        if (averageTicketEl) {
            averageTicketEl.textContent = averageTicket.toLocaleString('pt-BR', { 
                style: 'currency', 
                currency: 'BRL' 
            });
        }

        console.log('📊 Métricas do relatório atualizadas:', {
            totalSales,
            totalProfit,
            totalProductsSold,
            averageTicket
        });

    } catch (error) {
        console.error('❌ Erro ao atualizar métricas do relatório:', error);
        resetReportMetrics();
    }
}

// Função para resetar métricas
function resetReportMetrics() {
    const elements = [
        'report-total-sales',
        'report-total-profit', 
        'report-products-sold',
        'report-average-ticket'
    ];
    
    elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id.includes('sales') || id.includes('profit') || id.includes('ticket')) {
                el.textContent = 'R$ 0,00';
            } else {
                el.textContent = '0';
            }
        }
    });
}




