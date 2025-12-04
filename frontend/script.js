
// =================================================================
// 1. CONFIGURAÇÃO E CONEXÃO COM FIREBASE
// =================================================================
// Importa as funções do Google (Versão Web)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Sua configuração (Copiada do seu projeto)
const firebaseConfig = {
  apiKey: "AIzaSyBYHAyzwUgvRJ_AP9ZV9MMrtpPb3s3ENIc",
  authDomain: "stockbrasil-e06ff.firebaseapp.com",
  projectId: "stockbrasil-e06ff",
  storageBucket: "stockbrasil-e06ff.firebasestorage.app",
  messagingSenderId: "796401246692",
  appId: "1:796401246692:web:1570c40124165fcef227f1"
};

// Inicia o Banco de Dados
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// =================================================================
// MONITORAMENTO DE USUÁRIO (CORREÇÃO DO "CARREGANDO...")
// =================================================================
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const auth = getAuth(app);

onAuthStateChanged(auth, async (user) => {
    const nomeEl = document.getElementById("sidebar-user-name");
    
    if (user) {
        console.log("Usuário conectado:", user.email);
        
        // 1. Define um nome provisório (Email) caso a busca falhe
        let nomeFinal = user.email.split('@')[0];

        // 2. Busca o nome real no Banco de Dados (Firestore)
        try {
            // Busca o documento do usuário pelo ID (uid)
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const dados = docSnap.data();
                // Tenta pegar 'businessName' (usado no registro) ou 'nome'
                if (dados.businessName) {
                    nomeFinal = dados.businessName;
                } else if (dados.nome) {
                    nomeFinal = dados.nome;
                }
            }
        } catch (error) {
            console.error("Erro ao buscar nome do usuário:", error);
        }
        
        // 3. Atualiza a tela com o nome correto
        if(nomeEl) {
            nomeEl.textContent = nomeFinal;
            nomeEl.style.color = "var(--color-text-primary)";
            // Remove o efeito de piscar/carregando
            nomeEl.style.opacity = "1";
        }
        
        // Carrega os dados do sistema
        loadAllData();

    } else {
        // Usuário Deslogado
        console.log("Nenhum usuário logado.");
        if(nomeEl) nomeEl.textContent = "Visitante";
        
        // Se quiser forçar login:
        // window.location.href = "auth.html";
    }
});

// Variáveis Globais (Mantivemos para o resto do site funcionar)
let products = [];
let cart = [];
let salesHistory = [];
let savedCarts = [];
let logHistory = [];
let produtos = [];
let vendas = [];
let clientes = [];

let config = {
  categories: ["Vestuário", "Eletrônicos", "Brindes", "Serviços", "Outros"],
  paymentTypes: ["Pix", "Cartão de Crédito", "Dinheiro", "Boleto"],
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
  compactMode: false,
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
        // NÃO SALVAMOS PRODUTOS (eles vêm do Backend)
        localStorage.setItem("salesHistory", JSON.stringify(salesHistory));
        localStorage.setItem("savedCarts", JSON.stringify(savedCarts));
        localStorage.setItem("logHistory", JSON.stringify(logHistory));
        
        // SALVA AS CONFIGURAÇÕES
        localStorage.setItem("config", JSON.stringify(config));
        localStorage.setItem("systemConfig", JSON.stringify(systemConfig));
        localStorage.setItem("clients", JSON.stringify(clients));
    } catch (error) {
        console.error("Erro ao persistir dados:", error);
    }
}



// =================================================================
// CARREGAR DADOS DA NUVEM (FIREBASE)
// =================================================================

async function loadAllData() {
    try {
        console.log("☁️ Buscando dados no Firebase e LocalStorage...");

        // 1. Busca Produtos e Vendas (FIREBASE)
        const queryProdutos = await getDocs(collection(db, "products"));
        products = []; 
        queryProdutos.forEach((doc) => {
            products.push({ id: doc.id, ...doc.data() });
        });

        const queryVendas = await getDocs(collection(db, "sales"));
        salesHistory = [];
        queryVendas.forEach((doc) => {
            salesHistory.push({ id: doc.id, ...doc.data() });
        });
        salesHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));


        // 2. CARREGA DADOS LOCAIS (HISTÓRICO E CONFIGS)
        logHistory = safeLocalStorageParse("logHistory", []); // <-- CORREÇÃO CRÍTICA AQUI!
        savedCarts = safeLocalStorageParse("savedCarts", []);
        clients = safeLocalStorageParse("clients", []);
        config = safeLocalStorageParse("config", config);
        systemConfig = safeLocalStorageParse("systemConfig", systemConfig);

        console.log(`✅ Carregado: ${products.length} produtos, ${salesHistory.length} vendas, ${logHistory.length} logs.`);

        // 3. Atualiza a tela (Mantém suas funções de renderização)
        if(typeof renderProductTable === 'function') renderProductTable();
        if(typeof updateDashboardMetrics === 'function') updateDashboardMetrics();
        if(typeof renderPdvProducts === 'function') renderPdvProducts();
        if(typeof updateCategorySelect === 'function') updateCategorySelect();
        if(typeof renderHistoryLog === 'function') renderHistoryLog(); // Garante que a renderização seja chamada aqui

    } catch (error) {
        console.error("❌ Erro ao carregar do Firebase:", error);
        alert("Erro de conexão com o banco de dados! Verifique o console.");
    }
}

function logAction(type, detail) {
  const action = {
    id: Date.now(),
    timestamp: new Date().toLocaleString("pt-BR"),
    type: type,
    detail: detail,
  };
  logHistory.unshift(action);
  if (logHistory.length > 50) logHistory.pop();
  
  persistData(); // Primeiro salva
  
  if (typeof renderHistoryLog === 'function') {
      renderHistoryLog(); // Depois renderiza
  } else {
      console.warn("renderHistoryLog não está acessível.");
  }
}

// -------------------------------------------------------------
// CRUD DE PRODUTOS (SALVAR) - AGORA ASSÍNCRONA VIA API!
// -------------------------------------------------------------


function sanitizeHTML(str) {
  if (typeof str !== "string") return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// =================================================================
// 3. NAVEGAÇÃO E LAYOUT
// =================================================================

function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  const sections = document.querySelectorAll(".content-section");
  const titleElement = document.getElementById("current-page-title");

  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const targetSectionId = item.getAttribute("href").substring(1);

      // Remove classe ativa de todos
      navItems.forEach((i) => i.classList.remove("active"));
      item.classList.add("active");

      // Esconde todas as seções
      sections.forEach((sec) => {
        sec.style.display = "none";
        sec.style.opacity = "0";
      });

      // Mostra a seção alvo
      const targetSection = document.getElementById(targetSectionId);
      if (targetSection) {
        targetSection.style.display = "block";
        setTimeout(() => {
          targetSection.style.opacity = "1";
        }, 50);

        // Atualiza título
        titleElement.textContent = item.querySelector("span").textContent;

        // Ações específicas por seção - CORREÇÃO AQUI
        switch (targetSectionId) {
          case "vendas":
            renderPdvProducts();
            break;
          case "carrinhos-salvos":
            renderSavedCarts();
            break;
          case "config":
            renderConfigFields();
            break;
          case "relatorios":
            // CORREÇÃO: Renderiza relatório automaticamente
            setTimeout(() => {
              renderSalesReport();
              updateReportMetrics(); // ✅ GARANTE QUE AS MÉTRICAS SÃO ATUALIZADAS
              showTab("report-resumo");
            }, 100);
            break;
          case "produtos":
            showTab("product-list-tab");
            break;
        }

        // Fecha sidebar no mobile
        if (window.innerWidth <= 768) {
          document.getElementById("sidebar").classList.remove("collapsed");
          document.getElementById("main-content").classList.remove("expanded");
        }
      }
    });
  });

  // Configura tabs
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
  // Remove classe ativa de todos os botões
  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.classList.remove("active");
  });

  // Esconde todos os conteúdos
  document.querySelectorAll(".tab-content").forEach((content) => {
    content.style.display = "none";
  });

  // Ativa o botão e conteúdo selecionado
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
  // Previne que o clique no sino propague para o document
  if (event) {
    event.stopPropagation();
  }

  const dropdown = document.getElementById("alerts-floating-window");
  const isVisible = dropdown.style.display === "block";
  dropdown.style.display = isVisible ? "none" : "block";

  // Atualiza os alertas quando abre o dropdown
  if (!isVisible) {
    updateAlerts();
  }
}

// =================================================================
// 4. DASHBOARD E MÉTRICAS
// =================================================================

// ==========================================
// 2. DASHBOARD (VENDAS HOJE)
// ==========================================
// =========================================================
// 2. CORREÇÃO VENDAS HOJE (POR TEXTO)
// =========================================================
function updateDashboardMetrics() {
    try {
        if (!products || !Array.isArray(products)) products = [];

        // Estoque
        let totalStockItems = products.reduce((sum, p) => sum + (Number(p.quantidade) || 0), 0);
        let lowStockCount = products.filter((p) => (Number(p.quantidade) || 0) <= (Number(p.minimo) || 0)).length;
        let totalProducts = products.length;

        // VENDAS HOJE
        const hojeTexto = new Date().toLocaleDateString("pt-BR"); // ex: "03/12/2023"
        let salesToday = 0;

        salesHistory.forEach((sale) => {
            const dataVenda = parseDataSegura(sale.timestamp || sale.date);
            
            if (dataVenda) {
                // Converte a data da venda para texto BR
                const vendaTexto = dataVenda.toLocaleDateString("pt-BR");
                
                // Se o texto for igual, é hoje!
                if (vendaTexto === hojeTexto) {
                    salesToday += Number(sale.total) || 0;
                }
            }
        });

        // Atualiza a Tela
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

// CORREÇÃO: Alertas do Dashboard

function updateAlerts() {
  try {
    const lowStockProducts = products.filter((p) => p.quantidade <= p.minimo);
    const alertListDropdown = document.getElementById("alerts-dropdown-list");
    const dashboardAlertList = document.getElementById("dashboard-alert-list");
    const bellIcon = document.getElementById("bell-icon");

    const renderAlertsList = (listElement) => {
      if (!listElement) return;

      listElement.innerHTML = "";
      if (lowStockProducts.length === 0) {
        listElement.innerHTML = `<li><i class="fas fa-check-circle" style="color: var(--accent-green); margin-right: 5px;"></i> Estoque saudável.</li>`;
        return;
      }

      lowStockProducts.forEach((p) => {
        const li = document.createElement("li");
        li.innerHTML = `<i class="fas fa-exclamation-circle" style="color: var(--accent-red); margin-right: 5px;"></i> ${sanitizeHTML(
          p.nome
        )} com estoque baixo. (${p.quantidade} und.)`;
        listElement.appendChild(li);
      });
    };

    renderAlertsList(alertListDropdown);
    renderAlertsList(dashboardAlertList);

    // Atualiza estado do sino
    if (lowStockProducts.length > 0) {
      bellIcon.classList.add("has-alerts");
    } else {
      bellIcon.classList.remove("has-alerts");
    }
  } catch (error) {
    console.error("Erro ao atualizar alertas:", error);
  }
}

// =================================================================
// 5. GERENCIAMENTO DE PRODUTOS
// =================================================================

function updateCategorySelect(selectedCategory = "") {
  try {
    // Tenta encontrar o select de várias formas
    let select = document.getElementById("categoria");

    if (!select) {
      console.warn(
        "⚠️ Elemento #categoria não encontrado. Tentando encontrar..."
      );

      // Tenta encontrar em outras localizações possíveis
      select = document.querySelector('select[name="categoria"]');

      if (!select) {
        console.error("❌ Elemento categoria não encontrado em nenhum lugar.");
        return;
      }
    }

    // Limpa o select
    select.innerHTML = "";

    // Adiciona opção vazia
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "Selecione uma categoria";
    emptyOption.disabled = true;
    emptyOption.selected = !selectedCategory;
    select.appendChild(emptyOption);

    // Adiciona categorias
    config.categories.forEach((cat) => {
      const option = document.createElement("option");
      option.value = cat;
      option.textContent = cat;
      if (cat === selectedCategory) option.selected = true;
      select.appendChild(option);
    });

    console.log(
      "✅ updateCategorySelect executada com sucesso. Categorias:",
      config.categories.length
    );
  } catch (error) {
    console.error("❌ Erro em updateCategorySelect:", error);
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

// =================================================================
// SALVAR / EDITAR PRODUTO (FIREBASE)
// =================================================================
async function handleProductForm(event) {
    event.preventDefault();

    const idInput = document.getElementById('product-id').value;
    const isEditing = idInput && idInput !== '';

    // Mapeamento dos dados do formulário
    const productData = {
        nome: document.getElementById('nome').value,
        categoria: document.getElementById('categoria').value,
        preco: parseFloat(document.getElementById('preco').value || 0),
        custo: parseFloat(document.getElementById('custo').value || 0),
        quantidade: parseInt(document.getElementById('quantidade').value || 0),
        minimo: parseInt(document.getElementById('minimo').value || 0)
    };
    
    // ATENÇÃO: Se o Back-end retornar um erro 400, é por aqui.
    if (!productData.nome || isNaN(productData.preco) || productData.preco <= 0) {
        alert("Preencha o nome e o preço corretamente.");
        return;
    }

    try {
        if (isEditing) {
            // EDITAR: Atualiza o documento existente no Firebase
            await updateDoc(doc(db, "products", idInput), productData);
            alert("✅ Produto atualizado na nuvem!");
        } else {
            // NOVO: Cria um novo documento no Firebase
            await addDoc(collection(db, "products"), productData);
            alert("✅ Produto cadastrado na nuvem!");
        }

        // Recarrega os dados para atualizar a tela
        resetProductForm();
        await loadAllData(); 
        showTab('product-list-tab');

    } catch (error) {
        console.error("❌ Erro ao salvar no Firebase:", error);
        alert("Erro ao salvar no banco de dados.");
    }
}

function editProduct(id) {
    // Procura o produto na lista comparando com _id ou id
    const product = products.find(p => (p._id === id) || (p.id == id));
    
    if (!product) {
        console.error("Produto não encontrado na memória local:", id);
        alert('Erro ao carregar produto para edição. Tente recarregar a página.');
        return;
    }

    // Preenche o campo oculto com o ID REAL (_id)
    document.getElementById('product-id').value = product._id || product.id;
    
    // ATENÇÃO: Usando os IDs exatos do HTML (nome, categoria, etc.)
    document.getElementById('nome').value = product.nome; 
    document.getElementById('categoria').value = product.categoria;
    document.getElementById('preco').value = product.preco;
    document.getElementById('custo').value = product.custo;
    document.getElementById('quantidade').value = product.quantidade;
    document.getElementById('minimo').value = product.minimo;
    
    // Ajusta visual dos botões
    document.getElementById('form-title').textContent = 'Editar Produto';
    document.getElementById('submit-btn').innerHTML = '<i class="fas fa-save"></i> Salvar Edição';
    document.getElementById('cancel-edit-btn').style.display = 'inline-flex';
    
    showTab('product-form-tab');
}

// função deleteProduct inteira 
async function deleteProduct(id) {
    if (!confirm("Tem certeza que deseja excluir este produto da nuvem?")) return;

    try {
        // DELETAR: Remove o documento pelo ID do Firebase
        await deleteDoc(doc(db, "products", id));
        
        alert("🗑️ Produto excluído!");
        await loadAllData(); // Atualiza a tela

    } catch (error) {
        console.error("❌ Erro ao deletar:", error);
        alert("Erro ao excluir produto.");
    }
}

function resetProductForm() {
  const form = document.querySelector(".product-form");
  if (form) {
    form.reset();
    document.getElementById("product-id").value = "";
    document.getElementById("form-title").textContent =
      "Formulário de Cadastro de Produto";
    document.getElementById("submit-btn").innerHTML =
      '<i class="fas fa-plus-circle"></i> Cadastrar Produto';
    document.getElementById("cancel-edit-btn").style.display = "none";

    // CORREÇÃO: Garante que a categoria é resetada corretamente
    setTimeout(() => {
      updateCategorySelect(config.categories[0] || "");
    }, 100);
  }
}

function renderProductTable() {
    const tbody = document.querySelector('#product-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Se não tiver produtos ou a lista estiver vazia
    if (!products || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Nenhum produto cadastrado.</td></tr>';
        return;
    }

    products.forEach(p => {
        // CORREÇÃO CRÍTICA: Usa o _id do MongoDB. Se não existir, usa o id legado.
        const idMongo = p._id || p.id; 
        
        // Se o produto não tiver ID nenhum (dados corrompidos), ignora
        if (!idMongo) return;

        const row = tbody.insertRow();
        
        const nome = p.nome || 'Sem nome';
        const preco = parseFloat(p.preco || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const qtd = parseInt(p.quantidade || 0);
        const min = parseInt(p.minimo || 0);
        
        // Verifica estoque baixo
        if (qtd <= min) row.classList.add('low-stock-row');

        // Note que nos botões onclick, estamos passando 'idMongo'
        row.innerHTML = `
            <td>#...${idMongo.toString().slice(-4)}</td>
            <td>${sanitizeHTML(nome)}</td>
            <td>${sanitizeHTML(p.categoria || 'Geral')}</td>
            <td>R$ ${preco}</td>
            <td>${qtd}</td>
            <td>${min}</td>
            <td>
                <button class="action-btn edit-btn" onclick="editProduct('${idMongo}')"><i class="fas fa-pencil-alt"></i></button>
                <button class="action-btn delete-btn" onclick="deleteProduct('${idMongo}')"><i class="fas fa-trash"></i></button>
            </td>
        `;
    });
}

// CORREÇÃO: Histórico de Ações
function renderHistoryLog() {
  try {
    const tbody = document.getElementById("history-log-tbody");
    if (!tbody) {
      console.error("Tabela de histórico não encontrada");
      return;
    }

    tbody.innerHTML = "";

    if (logHistory.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="4" style="text-align: center; padding: 20px;">Nenhuma ação registrada</td></tr>';
      return;
    }

    logHistory.forEach((log) => {
      const row = tbody.insertRow();
      row.innerHTML = `
                <td>#${log.id}</td>
                <td>${sanitizeHTML(log.timestamp)}</td>
                <td>${sanitizeHTML(log.type)}</td>
                <td>${sanitizeHTML(log.detail)}</td>
            `;
    });

    console.log("Histórico renderizado:", logHistory.length, "ações");
  } catch (error) {
    console.error("Erro ao renderizar histórico:", error);
  }
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

// =================================================================
// 6. INICIALIZAÇÃO PRINCIPAL
// =================================================================

function initializeErrorHandling() {
  window.addEventListener("error", (e) => {
    console.error("Erro global:", e.error);
  });

  window.addEventListener("unhandledrejection", (e) => {
    console.error("Promise rejeitada:", e.reason);
    e.preventDefault();
  });
}

// Inicialização quando o DOM estiver pronto
// Substitua o bloco document.addEventListener("DOMContentLoaded", async () => { ... }) inteiro

document.addEventListener("DOMContentLoaded", async () => {
    // 1. CHAMA O CARREGAMENTO PRINCIPAL E ESPERA O FIREBASE
    await loadAllData(); 

    // 2. INICIALIZAÇÃO DE UI E UTILIDADES (O que não depende de dados)
    
    initializeErrorHandling();
    setupNavigation();
    
    // Configurações de campo
    if(typeof initSystemConfig === 'function') initSystemConfig();
    if(typeof applySystemConfig === 'function') applySystemConfig();
    if(typeof setupCartClientAutocomplete === 'function') setupCartClientAutocomplete();
    if(typeof setupSaleDetailsStyles === 'function') setupSaleDetailsStyles();
    
    // Inicia os gráficos
    if(typeof initializeDashboardCharts === 'function') initializeDashboardCharts();
    if(typeof inicializarGraficoCategoria === 'function') inicializarGraficoCategoria();
    
    // 3. FECHA MODAIS (Comportamento UI)
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


// ⚠️ IMPORTANTE: Você deve remover a função loadInitialData() inteira
// Procure e exclua a função loadInitialData() completa do seu script.js.
// O novo loadAllData já assume todas as responsabilidades.

// =================================================================
// 7. PONTO DE VENDA (PDV) - CORRIGIDO
// =================================================================

// CORREÇÃO: Garantir que produtos apareçam no PDV
function renderPdvProducts() {
    try {
        const grid = document.getElementById("products-grid");
        if (!grid) return;

        grid.innerHTML = "";

        if (products.length === 0) {
            grid.innerHTML = '<div class="empty-state">Nenhum produto cadastrado</div>';
            return;
        }

        products.forEach((p) => {
            // CORREÇÃO: Usa o _id do Mongo ou o id antigo como fallback
            const idReal = p._id || p.id;
            
            const inStock = (p.quantidade > 0) || (p.categoria === "Serviços");
            const buttonClass = inStock ? "submit-btn blue-btn" : "submit-btn out-of-stock";
            const buttonText = inStock ? "Adicionar" : "Esgotado";
            const buttonIcon = inStock ? "fa-cart-plus" : "fa-ban";

            const productCard = document.createElement("div");
            productCard.className = "product-card";
            
            // CORREÇÃO: Passamos o ID entre aspas simples '${idReal}' para funcionar com IDs do Mongo
            productCard.innerHTML = `
                <span class="product-id">#...${idReal.toString().slice(-4)}</span>
                <h4 class="product-name">${sanitizeHTML(p.nome)}</h4>
                <p class="product-category">${sanitizeHTML(p.categoria)}</p>
                <p class="product-price">R$ ${parseFloat(p.preco).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                <p class="product-stock ${!inStock ? "out-of-stock-text" : ""}">
                    ${p.categoria === "Serviços" ? "Serviço" : `Estoque: ${p.quantidade}`}
                </p>
                <div class="product-button-container">
                    <button class="${buttonClass}" onclick="addToCart('${idReal}')" ${!inStock ? "disabled" : ""}>
                        <i class="fas ${buttonIcon}"></i> ${buttonText}
                    </button>
                </div>
            `;
            grid.appendChild(productCard);
        });
    } catch (error) {
        console.error("Erro ao renderizar produtos PDV:", error);
    }
}

function filterPdvProducts() {
  try {
    const searchInput = document.getElementById("pdv-search-input");
    if (!searchInput) return;

    const searchTerm = searchInput.value.toLowerCase();
    const productCards = document.querySelectorAll(".product-card");

    productCards.forEach((card) => {
      const name = card
        .querySelector(".product-name")
        .textContent.toLowerCase();
      const id = card.querySelector(".product-id").textContent.toLowerCase();
      const category = card
        .querySelector(".product-category")
        .textContent.toLowerCase();

      const matches =
        name.includes(searchTerm) ||
        id.includes(searchTerm.replace("#", "")) ||
        category.includes(searchTerm);

      card.style.display = matches ? "block" : "none";
    });
  } catch (error) {
    console.error("Erro ao filtrar produtos:", error);
  }
}

// =================================================================
// 8. CARRINHO DE COMPRAS - CORRIGIDO
// =================================================================

function addToCart(productId) {
    try {
        // CORREÇÃO: Compara tanto com _id quanto com id, garantindo que ache o produto
        const product = products.find((p) => (p._id === productId) || (p.id == productId));
        
        if (!product) {
            console.error("Produto não encontrado ID:", productId);
            alert("Erro: Produto não encontrado.");
            return;
        }

        if (product.quantidade <= 0 && product.categoria !== "Serviços") {
            alert("Produto esgotado!");
            return;
        }

        // Procura se já tem no carrinho pelo mesmo ID
        const cartItem = cart.find((item) => item.id === productId);

        if (cartItem) {
            if (cartItem.quantity < product.quantidade || product.categoria === "Serviços") {
                cartItem.quantity++;
            } else {
                alert(`Estoque máximo de ${product.nome} atingido!`);
                return;
            }
        } else {
            // Adiciona novo item usando o ID correto
            cart.push({
                id: productId, // Guarda o ID real (_id)
                nome: product.nome,
                preco: product.preco,
                custo: product.custo,
                quantity: 1,
            });
        }

        renderCart();
    } catch (error) {
        console.error("Erro ao adicionar ao carrinho:", error);
    }
}

function updateCartQuantity(productId, change) {
    // Encontra o item no carrinho (comparando ID como texto ou número)
    const cartItem = cart.find((item) => (item.id || item._id) == productId);

    if (!cartItem) return;

    // Se for adicionar (+1)
    if (change > 0) {
        // Busca o produto original para checar estoque
        const product = products.find((p) => (p._id || p.id) == productId);
        
        // Se achou produto e não for serviço, checa limite
        if (product && product.categoria !== "Serviços") {
            if (cartItem.quantity >= product.quantidade) {
                alert(`Estoque máximo atingido! Apenas ${product.quantidade} unidades disponíveis.`);
                return;
            }
        }
        cartItem.quantity++;
    } 
    // Se for remover (-1)
    else {
        cartItem.quantity--;
    }

    // Se zerou, remove do carrinho
    if (cartItem.quantity <= 0) {
        removeItemFromCart(productId);
    } else {
        renderCart(); // Apenas atualiza
    }
}

function removeItemFromCart(productId) {
    // Filtra removendo o ID selecionado
    cart = cart.filter((item) => (item.id || item._id) != productId);
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
  const subtotal = cart.reduce(
    (sum, item) => sum + item.preco * item.quantity,
    0
  );
  const total = subtotal; // Para futuros descontos/impostos
  return { subtotal, total };
}

function renderCart() {
    const list = document.getElementById("cart-items-list");
    const subtotalEl = document.getElementById("cart-subtotal");
    const totalEl = document.getElementById("cart-total");
    const checkoutBtn = document.querySelector(".finaliza-venda-btn");

    if (!list || !subtotalEl || !totalEl) return;

    list.innerHTML = "";

    if (cart.length === 0) {
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

        cart.forEach((item) => {
            const li = document.createElement("li");
            li.className = "cart-item";
            
            // AQUI ESTAVA O ERRO: Adicionei aspas simples '${item.id}' nos onlicks
            li.innerHTML = `
                <div class="item-info">
                    <span class="item-name">${item.nome}</span>
                    <span class="item-price">R$ ${(item.preco * item.quantity).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="item-controls">
                    <button class="qty-btn" onclick="updateCartQuantity('${item.id}', -1)">
                        <i class="fas fa-minus"></i>
                    </button>
                    <span class="item-qty">${item.quantity}</span>
                    <button class="qty-btn" onclick="updateCartQuantity('${item.id}', 1)">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button class="remove-btn" onclick="removeItemFromCart('${item.id}')">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `;
            list.appendChild(li);
        });
    }

    const { subtotal, total } = calculateTotals();
    subtotalEl.textContent = subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    totalEl.textContent = total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
// =================================================================
// 9. CARRINHOS SALVOS - CORRIGIDO
// =================================================================

// 1. Apenas abre o modal
function saveCurrentCart() {
    if (cart.length === 0) {
        alert("O carrinho está vazio!");
        return;
    }
    // Limpa o campo e abre o modal
    document.getElementById('save-cart-client-name').value = "";
    document.getElementById('save-cart-modal').style.display = 'flex';
    
    // Foca no campo de nome automaticamente
    setTimeout(() => document.getElementById('save-cart-client-name').focus(), 100);
}

// 2. Realmente salva e LIMPA o carrinho
function confirmSaveCart() {
    try {
        const nameInput = document.getElementById('save-cart-client-name');
        const clientName = nameInput.value.trim() || "Sem Identificação";

        const newSavedCart = {
            id: Date.now(),
            timestamp: new Date().toLocaleString("pt-BR"),
            items: JSON.parse(JSON.stringify(cart)), // Copia os itens
            total: calculateTotals().total,
            client: clientName
        };

        // Salva na lista
        savedCarts.unshift(newSavedCart);
        if (savedCarts.length > 15) savedCarts.pop(); // Limite de 15

        persistData();
        renderSavedCarts();

        // --- AQUI ESTÁ A LIMPEZA ---
        cart = []; // Zera o array do carrinho
        renderCart(); // Atualiza a tela (vai mostrar "Carrinho vazio")
        
        // Fecha o modal
        document.getElementById('save-cart-modal').style.display = 'none';

        // Mensagem simples
        alert(`✅ Carrinho salvo com sucesso para "${clientName}"!`);

    } catch (error) {
        console.error(error);
        alert("Erro ao salvar carrinho.");
    }
}

// Verifica se dois carrinhos têm exatamente os mesmos itens e quantidades
function areCartsEqual(cart1, cart2) {
  if (cart1.length !== cart2.length) return false;

  const cart1Map = new Map();
  const cart2Map = new Map();

  // Preenche os maps com ID -> quantidade
  cart1.forEach((item) => cart1Map.set(item.id, item.quantity));
  cart2.forEach((item) => cart2Map.set(item.id, item.quantity));

  // Verifica se todos os IDs e quantidades são iguais
  for (let [id, quantity] of cart1Map) {
    if (cart2Map.get(id) !== quantity) return false;
  }

  return true;
}

// Verifica se dois carrinhos têm os mesmos produtos (ignorando quantidades)
function hasSameProducts(cart1, cart2) {
  const cart1Ids = new Set(cart1.map((item) => item.id));
  const cart2Ids = new Set(cart2.map((item) => item.id));

  // Verifica se têm exatamente os mesmos produtos
  if (cart1Ids.size !== cart2Ids.size) return false;

  for (let id of cart1Ids) {
    if (!cart2Ids.has(id)) return false;
  }

  return true;
}

function loadSavedCart(cartId) {
    const savedCartIndex = savedCarts.findIndex((c) => c.id == cartId); // Comparação solta (==)
    if (savedCartIndex === -1) { alert("Carrinho não encontrado!"); return; }

    const loadedCart = savedCarts[savedCartIndex];
    
    // Validação de estoque corrigida
    const validItems = loadedCart.items.filter((savedItem) => {
        // Busca produto pelo ID novo ou velho
        const product = products.find((p) => (p._id || p.id) == savedItem.id);
        
        // Se for serviço ou tiver estoque, é válido
        if (product && (product.categoria === "Serviços" || product.quantidade >= savedItem.quantity)) {
            return true;
        }
        return false;
    });

    if (validItems.length === 0) {
        alert("Nenhum item deste carrinho tem estoque disponível.");
        return;
    }

    cart = validItems;
    // Removemos da lista de salvos ao carregar (opcional)
    savedCarts.splice(savedCartIndex, 1);
    
    renderCart();
    renderSavedCarts();
    persistData();
    
    // Vai para a aba de vendas
    document.querySelector('.nav-item[href="#vendas"]').click();
    alert(`Carrinho carregado! ( ⚠️ ${loadedCart.items.length - validItems.length} produtos será removido por falta de estoque)`);
}

function deleteSavedCart(cartId) {
    if (!confirm("Excluir este carrinho salvo?")) return;
    // Filtro corrigido com comparação solta
    savedCarts = savedCarts.filter((c) => c.id != cartId);
    renderSavedCarts();
    persistData();
}

function renderSavedCarts() {
    try {
        const container = document.getElementById("saved-carts-list");
        if (!container) return;
        container.innerHTML = "";

        if (savedCarts.length === 0) {
            container.innerHTML = `<div class="empty-state"><p>Nenhum carrinho salvo</p></div>`;
            return;
        }

        savedCarts.forEach((cart) => {
            // Verifica se tem nome de cliente salvo
            const clienteLabel = cart.client ? `👤 ${cart.client}` : "👤 Sem Cliente";

            const cartElement = document.createElement("div");
            cartElement.className = "saved-cart-card";
            cartElement.innerHTML = `
                <div class="cart-info">
                    <span class="cart-title">
                        Carrinho #${cart.id.toString().slice(-4)} 
                        <i class="fas fa-info-circle" style="color:var(--color-accent-blue); cursor:pointer; margin-left:5px;" onclick="viewCartDetails(${cart.id})" title="Ver detalhes"></i>
                    </span>
                    <p class="cart-meta" style="font-weight:bold; color:var(--color-text-primary); margin: 5px 0;">${clienteLabel}</p>
                    <p class="cart-meta">${cart.timestamp}</p>
                    <p class="cart-summary">${cart.items.length} itens - Total: R$ ${cart.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                </div>
                <div class="cart-actions">
                    <button class="submit-btn blue-btn" onclick="loadSavedCart(${cart.id})">Carregar</button>
                    <button class="submit-btn delete-btn" onclick="deleteSavedCart(${cart.id})"><i class="fas fa-trash"></i>Deletar</button>
                </div>
            `;
            container.appendChild(cartElement);
        });
    } catch (error) { console.error(error); }
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
    cart.forEach((item) => {
      const product = products.find((p) => p.id === item.id);
      if (
        product &&
        product.categoria !== "Serviços" &&
        product.quantidade < item.quantity
      ) {
        stockIssues.push(
          `${product.nome} (estoque: ${product.quantidade}, solicitado: ${item.quantity})`
        );
      }
    });

    if (stockIssues.length > 0) {
      alert("Problemas de estoque:\n" + stockIssues.join("\n"));
      return;
    }

    renderPaymentOptions();
    document.getElementById("payment-modal").style.display = "flex";
  } catch (error) {
    console.error("Erro no checkout:", error);
    alert("Erro ao processar venda.");
  }
}

// Variável para guardar a escolha
let pagamentoSelecionado = null;

function renderPaymentOptions() {
    const container = document.getElementById("payment-options-container");
    const totalDisplay = document.getElementById("payment-total-display");

    // Atualiza valor total
    const { total } = calculateTotals();
    if(totalDisplay) totalDisplay.textContent = total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    // Limpa a janela
    container.innerHTML = "";
    pagamentoSelecionado = null;

    // --- 1. CAMPO NOME DO CLIENTE (VOLTOU!) ---
    // Tenta pegar nome se já foi digitado antes
    const nomeAnterior = document.getElementById("cart-client-name-input")?.value || "";
    
    const divCliente = document.createElement("div");
    divCliente.style.marginBottom = "15px";
    divCliente.innerHTML = `
        <label style="display:block; font-weight:bold; margin-bottom:5px; color:#555;">Nome do Cliente:</label>
        <input type="text" id="modal-client-name" value="${nomeAnterior}" placeholder="Digite o nome..." 
               style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
    `;
    container.appendChild(divCliente);

    // --- 2. LISTA DE PAGAMENTOS (CLÁSSICA) ---
    const labelPgto = document.createElement("p");
    labelPgto.style.marginBottom = "10px";
    container.appendChild(labelPgto);

    config.paymentTypes.forEach((type) => {
        const btn = document.createElement("button");
        btn.className = "payment-option-btn"; 
        btn.innerHTML = `<i class="fas fa-credit-card"></i> ${type}`;
        
        btn.onclick = () => {
            // Remove verde dos outros
            document.querySelectorAll('.payment-option-btn').forEach(b => b.classList.remove('selected'));
            // Fica verde neste
            btn.classList.add('selected');
            // Salva a escolha
            pagamentoSelecionado = type;
            
            // Destrava o botão de confirmar
            const btnConfirmar = document.getElementById('btn-finalizar-venda');
            if(btnConfirmar) {
                btnConfirmar.disabled = false;
                btnConfirmar.style.opacity = "1";
                btnConfirmar.style.cursor = "pointer";
            }
        };
        
        container.appendChild(btn);
    });

    // --- 3. BOTÕES DE AÇÃO (CANCELAR + CONFIRMAR) ---
    const row = document.createElement("div");
    row.className = "modal-actions-row";

    // Botão Cancelar
    const btnCancel = document.createElement("button");
    btnCancel.className = "submit-btn delete-btn";
    btnCancel.innerHTML = 'Cancelar';
    btnCancel.onclick = () => document.getElementById('payment-modal').style.display = 'none';

    // Botão Finalizar
    const btnConfirm = document.createElement("button");
    btnConfirm.id = "btn-finalizar-venda";
    btnConfirm.className = "submit-btn green-btn";
    btnConfirm.innerHTML = 'Finalizar';
    
    // Começa travado até escolher pagamento
    btnConfirm.disabled = true;
    btnConfirm.style.opacity = "0.5";
    btnConfirm.style.cursor = "not-allowed";

    btnConfirm.onclick = () => {
        if (!pagamentoSelecionado) {
            alert("⚠️ Selecione uma forma de pagamento na lista acima.");
            return;
        }
        // CHAMA A VENDA COM O PAGAMENTO ESCOLHIDO
        processSale(pagamentoSelecionado);
    };

    row.appendChild(btnCancel);
    row.appendChild(btnConfirm);
    container.appendChild(row);
}



async function processSale(paymentType) {
    // Busca o botão de confirmação para travar/destravar
    const btnConfirm = document.getElementById("btn-finalizar-venda");
    
    // A função try/finally garante que o botão seja destravado em caso de erro
    try {
        // Pega o nome do cliente do modal
        const inputNome = document.getElementById("modal-client-name");
        const clientName = inputNome ? inputNome.value.trim() : "";

        // 1. TRAVA E CONFIGURAÇÃO
        if(btnConfirm) {
            btnConfirm.disabled = true;
            btnConfirm.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
        }

        const { total } = calculateTotals();
        
        // 2. VERIFICA ESTOQUE E PREPARA ATUALIZAÇÕES
        const updates = [];
        for (const cartItem of cart) {
            // CRÍTICO: Buscar o produto original na lista de produtos carregada
            const product = products.find((p) => p.id === cartItem.id); 
            
            if (!product) {
                console.error(`Produto ID ${cartItem.id} não encontrado na lista atual.`);
                throw new Error("Produto não encontrado no estoque atual. Recarregue.");
            }
            
            // Só checa estoque se não for 'Serviços'
            if (product.categoria !== "Serviços") {
                const novaQuantidade = (product.quantidade || 0) - cartItem.quantity;
                
                if (novaQuantidade < 0) {
                    alert(`Estoque insuficiente para: ${product.nome}`);
                    throw new Error("Estoque insuficiente.");
                }
                
                // Prepara o objeto para atualização do Firebase
                updates.push({ id: product.id, novaQtd: novaQuantidade });
            }
        }

        // 3. ATUALIZA ESTOQUE NO FIREBASE (Bulk Update)
        for (const item of updates) {
            // O ERRO OCORRIA AQUI. Agora, garantimos que item.id é o ID do documento.
            await updateDoc(doc(db, "products", item.id), { 
                quantidade: item.novaQtd 
            });
        }

        // 4. SALVA A VENDA NO FIREBASE
        const newSale = {
            timestamp: new Date().toISOString(),
            items: JSON.parse(JSON.stringify(cart)),
            total: total,
            payment: paymentType,
            client: clientName,
        };
        
        // Adiciona um novo documento na coleção "sales"
        await addDoc(collection(db, "sales"), newSale);
        
        // 5. LIMPEZA E FINALIZAÇÃO
        salesHistory.unshift({ id: Date.now(), ...newSale }); 
        persistData(); // Salva histórico local e configs
        
        cart = [];
        renderCart();
        document.getElementById("payment-modal").style.display = "none";
        
        alert(`✅ Venda Finalizada!\nCliente: ${clientName || "Não informado"}\nValor: R$ ${total.toFixed(2)}`);
        
        // Recarrega os dados do Firebase para atualizar a tela e o dashboard
        await loadAllData(); 

    } catch (error) {
        console.error("❌ ERRO FATAL NO PROCESSO DE VENDA:", error);
        alert(`Erro crítico ao processar venda: ${error.message || "Verifique o console."}`);
        
    } finally {
        // GARANTE QUE O BOTÃO VOLTE AO NORMAL
        if(btnConfirm) {
            btnConfirm.disabled = false;
            btnConfirm.innerHTML = 'Finalizar';
        }
    }
}
// =================================================================
// 11. CONFIGURAÇÕES - CORRIGIDO
// =================================================================

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

function saveCategories() {
  try {
    const textarea = document.getElementById("product-categories-config");
    if (!textarea) return;

    const newCategories = textarea.value
      .split("\n")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (newCategories.length === 0) {
      alert("A lista de categorias não pode estar vazia.");
      textarea.value = config.categories.join("\n");
      return;
    }

    // Verifica se há produtos usando categorias que serão removidas
    const removedCategories = config.categories.filter(
      (cat) => !newCategories.includes(cat)
    );
    const productsUsingRemovedCategories = products.filter((p) =>
      removedCategories.includes(p.categoria)
    );

    if (productsUsingRemovedCategories.length > 0) {
      alert(
        `Atenção: ${productsUsingRemovedCategories.length} produto(s) usam categorias que serão removidas. Eles serão movidos para a primeira categoria.`
      );

      // Move produtos para a primeira categoria
      productsUsingRemovedCategories.forEach((product) => {
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
    console.error("Erro ao salvar categorias:", error);
    alert("Erro ao salvar categorias.");
  }
}

function savePaymentTypes() {
  try {
    const textarea = document.getElementById("payment-types-config");
    if (!textarea) return;

    const newPaymentTypes = textarea.value
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (newPaymentTypes.length === 0) {
      alert("A lista de tipos de pagamento não pode estar vazia.");
      textarea.value = config.paymentTypes.join("\n");
      return;
    }

    config.paymentTypes = newPaymentTypes;
    persistData();

    logAction("Configurações", "Tipos de pagamento atualizados");
    alert("Tipos de pagamento salvos com sucesso!");
  } catch (error) {
    console.error("Erro ao salvar tipos de pagamento:", error);
    alert("Erro ao salvar tipos de pagamento.");
  }
}

// =================================================================
// 12. RELATÓRIOS - CORRIGIDO
// =================================================================

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

    // Verifica se a data é válida
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
      // Verifica se sale.items existe e é um array
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach((item) => {
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
    // Retorna valores padrão em caso de erro
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

    // Garante que todos os valores são números válidos
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

    // ATUALIZA AS MÉTRICAS DA ANÁLISE VISUAL
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
                // CORREÇÃO: Busca o produto original para saber a categoria, comparando ID corretamente
                const product = products.find((p) => (p._id || p.id) == item.id);
                // Se não achar o produto (foi deletado), usa 'Deletado/Outros'
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

function renderSalesDetailsTable(sales) {
  try {
    const salesReportTbody = document.querySelector(
      "#sales-report-table tbody"
    );
    if (!salesReportTbody) {
      console.error("Tabela de vendas não encontrada");
      return;
    }

    salesReportTbody.innerHTML = "";

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
    const existingSearch = document.getElementById("sales-search");
    if (!existingSearch) {
      const tableHeader =
        salesReportTbody.closest(".table-responsive").previousElementSibling;
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
    sales.forEach((sale) => {
      const row = salesReportTbody.insertRow();

      // Garante que os dados existem
      const saleId = sale.id || "N/A";
      const timestamp = sale.timestamp || "Data não disponível";
      const total = sale.total || 0;
      const payment = sale.payment || "Não informado";
      const itemsCount = sale.items ? sale.items.length : 0;
      const client = sale.client || "";

      // --- TRECHO CORRIGIDO ---

row.innerHTML = `
    <td>#${saleId}</td>
    <td>${sanitizeHTML(timestamp)}</td>
    <td>${total.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })}</td>
    <td>${sanitizeHTML(payment)}</td>
    <td>${itemsCount} item(s)</td>
    <td>${
      client
        ? sanitizeHTML(client)
        : '<em style="color: var(--color-text-tertiary);">Não informado</em>'
    }</td>
    <td>
        <button class="action-btn view-btn" onclick="viewSaleDetails('${saleId}')" title="Ver detalhes da venda">
            <i class="fas fa-eye"></i> Detalhes
        </button>
    </td>
`;

    });

    console.log(
      "✅ Tabela de vendas renderizada com pesquisa:",
      sales.length,
      "vendas"
    );
  } catch (error) {
    console.error("❌ Erro ao renderizar tabela de vendas:", error);
  }
}

// CORREÇÃO: Gráfico de Análise de Vendas (Últimos 30 Dias)
function initializeDashboardCharts() {
    try {
        const ctx = document.getElementById("daily-sales-chart");
        if (!ctx) return;

        if (window.dailySalesChart instanceof Chart) window.dailySalesChart.destroy();

        const salesMap = {};
        
        // Cria chaves para os últimos 30 dias
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            salesMap[d.toLocaleDateString("pt-BR")] = 0;
        }

        // Preenche com os dados
        salesHistory.forEach(sale => {
            const dataVenda = parseDataSegura(sale.timestamp || sale.date);
            if (dataVenda) {
                const chave = dataVenda.toLocaleDateString("pt-BR");
                if (salesMap.hasOwnProperty(chave)) {
                    salesMap[chave] += Number(sale.total) || 0;
                }
            }
        });

        // Desenha o gráfico
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
    } catch (e) { console.error("Erro Gráfico:", e); }
}

// CORREÇÃO: Verificar se o canvas existe no DOM
function verificarElementosDashboard() {
  const canvas = document.getElementById("daily-sales-chart");
  if (!canvas) {
    console.error("Canvas do gráfico não encontrado no DOM");
    // Tentar recriar após um tempo
    setTimeout(initializeDashboardCharts, 1000);
    return false;
  }
  return true;
}

// CORREÇÃO: Adicionar ao DOMContentLoaded
document.addEventListener("DOMContentLoaded", function () {
  // ... seu código existente

  // Verificar e inicializar gráfico
  setTimeout(() => {
    if (verificarElementosDashboard()) {
      initializeDashboardCharts();
    }
  }, 1000);
});

// CORREÇÃO: CSS para garantir que o gráfico tenha altura
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

// Função para recriar o gráfico (use no console se necessário)
function recriarGraficoVendas() {
  if (window.dailySalesChart) {
    window.dailySalesChart.destroy();
    window.dailySalesChart = null;
  }
  initializeDashboardCharts();
}

// No console, você pode executar: recriarGraficoVendas()

// Variável para controlar alertas ocultos
let hiddenAlerts = JSON.parse(localStorage.getItem("hiddenAlerts")) || [];


// Função para ocultar alerta individual
function hideAlert(productId) {
  if (!hiddenAlerts.includes(productId)) {
    hiddenAlerts.push(productId);
    localStorage.setItem("hiddenAlerts", JSON.stringify(hiddenAlerts));
    updateAlerts();

    // Fecha o dropdown após ocultar
    setTimeout(() => {
      const dropdown = document.getElementById("alerts-floating-window");
      if (dropdown) dropdown.style.display = "none";
    }, 300);
  }
}

// Função para limpar todos os alertas
function clearAllAlerts() {
  const currentAlerts = products
    .filter((p) => p.quantidade <= p.minimo)
    .map((p) => p.id);

  if (currentAlerts.length === 0) {
    alert("Não há alertas para limpar!");
    return;
  }

  if (!confirm(`Deseja ocultar todos os ${currentAlerts.length} alertas?`)) {
    return;
  }

  // Adiciona todos os alertas atuais à lista de ocultos
  hiddenAlerts = [...new Set([...hiddenAlerts, ...currentAlerts])];
  localStorage.setItem("hiddenAlerts", JSON.stringify(hiddenAlerts));
  updateAlerts();

  // Fecha o dropdown
  const dropdown = document.getElementById("alerts-floating-window");
  if (dropdown) dropdown.style.display = "none";

  alert(`Todos os ${currentAlerts.length} alertas foram ocultados!`);
}

// Função para resetar alertas ocultos (útil para desenvolvimento)
function resetHiddenAlerts() {
  hiddenAlerts = [];
  localStorage.setItem("hiddenAlerts", JSON.stringify(hiddenAlerts));
  updateAlerts();
  alert("Alertas ocultos resetados!");
}

// Execute no console: resetHiddenAlerts() se precisar

// Versão mais direta - fecha ao clicar em qualquer lugar
document.addEventListener("click", function (event) {
  const modal = document.getElementById("sale-details-modal");
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
    console.log("Abrindo detalhes da venda:", saleId);

    const sale = salesHistory.find((s) => s.id === saleId);
    if (!sale) {
      alert("Venda não encontrada!");
      return;
    }

    // Preenche as informações básicas da venda
    document.getElementById("detail-sale-id").textContent = `#${sale.id}`;
    document.getElementById("detail-sale-date").textContent =
      sale.timestamp || "Data não disponível";
    document.getElementById("detail-sale-payment").textContent =
      sale.payment || "Não informado";
    document.getElementById("detail-sale-total").textContent = (
      sale.total || 0
    ).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    // Remove cliente anterior se existir
    const existingClient = document.querySelector(".client-meta-item");
    if (existingClient) {
      existingClient.remove();
    }

    // Adiciona cliente se existir
    const saleMeta = document.querySelector(".sale-meta");
    if (sale.client && sale.client.trim() !== "") {
      const clientItem = document.createElement("div");
      clientItem.className = "meta-item client-meta-item";
      clientItem.innerHTML = `
                <span class="meta-label"><i class="fas fa-user"></i> Cliente:</span>
                <span class="meta-value client-value">${sanitizeHTML(
                  sale.client
                )}</span>
            `;
      // Insere antes do total
      const totalItem = saleMeta.querySelector(".total-item");
      if (totalItem) {
        saleMeta.insertBefore(clientItem, totalItem);
      } else {
        saleMeta.appendChild(clientItem);
      }
    }

    // Renderiza os itens da venda
    const itemsContainer = document.getElementById("detail-sale-items");
    itemsContainer.innerHTML = "";

    if (sale.items && Array.isArray(sale.items) && sale.items.length > 0) {
      let subtotal = 0;

      sale.items.forEach((item, index) => {
        const itemElement = document.createElement("div");
        itemElement.className = "item-detail";

        // Garante que os valores são números
        const preco = parseFloat(item.preco) || 0;
        const quantidade = parseInt(item.quantity) || 0;
        const totalItem = preco * quantidade;
        subtotal += totalItem;

        // Calcula lucro do item
        const custo = parseFloat(item.custo) || 0;
        const lucroItem = totalItem - custo * quantidade;
        const margem = totalItem > 0 ? (lucroItem / totalItem) * 100 : 0;

        itemElement.innerHTML = `
                    <div class="item-header">
                        <span class="item-name">${sanitizeHTML(
                          item.nome || "Produto sem nome"
                        )}</span>
                        <span class="item-total">R$ ${totalItem.toLocaleString(
                          "pt-BR",
                          { minimumFractionDigits: 2 }
                        )}</span>
                    </div>
                    <div class="item-details">
                        <div class="item-qty-price">
                            <span class="qty">${quantidade} Uni. -- R$ ${preco.toLocaleString(
          "pt-BR",
          { minimumFractionDigits: 2 }
        )}</span>
                        </div>
                        <div class="item-profit-info">
                            <span class="profit-badge ${
                              lucroItem >= 0
                                ? "profit-positive"
                                : "profit-negative"
                            }">
                                <i class="fas ${
                                  lucroItem >= 0
                                    ? "fa-arrow-up"
                                    : "fa-arrow-down"
                                }"></i>
                                Lucro: R$ ${lucroItem.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                })} (${margem.toFixed(1)}%)
                            </span>
                        </div>
                    </div>
                `;
        itemsContainer.appendChild(itemElement);
      });

      // Linha de totais
      const totalElement = document.createElement("div");
      totalElement.className = "sale-totals";
      totalElement.innerHTML = `
                <div class="total-line">
                    <span class="total-label">Subtotal:</span>
                    <span class="total-value">R$ ${subtotal.toLocaleString(
                      "pt-BR",
                      { minimumFractionDigits: 2 }
                    )}</span>
                </div>
                <div class="total-line main-total">
                    <span class="total-label">Total da Venda:</span>
                    <span class="total-value">R$ ${(
                      sale.total || 0
                    ).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}</span>
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
    document.getElementById("sale-details-modal").style.display = "flex";

    console.log("Detalhes da venda carregados com sucesso");
  } catch (error) {
    console.error("Erro ao abrir detalhes da venda:", error);
    alert(
      "Erro ao carregar detalhes da venda. Verifique o console para mais informações."
    );
  }
}

// Função para fechar detalhes da venda
function closeSaleDetails() {
  document.getElementById("sale-details-modal").style.display = "none";
}

// Fechar modal ao clicar fora ou pressionar ESC
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
  const tabButtons = document.querySelectorAll(".config-tab-button");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabId = button.getAttribute("data-config-tab");
      showConfigTab(tabId);
    });
  });
}

function showConfigTab(tabId) {
  // Remove classe ativa de todos os botões
  document.querySelectorAll(".config-tab-button").forEach((btn) => {
    btn.classList.remove("active");
  });

  // Esconde todos os conteúdos
  document.querySelectorAll(".config-tab-content").forEach((content) => {
    content.style.display = "none";
  });

  // Ativa o botão e conteúdo selecionado
  const activeButton = document.querySelector(`[data-config-tab="${tabId}"]`);
  const activeContent = document.getElementById(`${tabId}-tab`);

  if (activeButton && activeContent) {
    activeButton.classList.add("active");
    activeContent.style.display = "block";
    activeContent.classList.add("active");
  }
}

// Gerenciador de Categorias
function renderCategoriesManager() {
  const container = document.getElementById("categories-container");
  if (!container) return;

  container.innerHTML = "";

  config.categories.forEach((category, index) => {
    const categoryElement = document.createElement("div");
    categoryElement.className = "category-item";
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
  const input = document.getElementById("new-category-name");
  const name = input.value.trim();

  if (!name) {
    alert("Digite um nome para a categoria!");
    return;
  }

  if (config.categories.includes(name)) {
    alert("Esta categoria já existe!");
    return;
  }

  config.categories.push(name);
  persistData();
  renderCategoriesManager();
  updateCategorySelect();

  input.value = "";
  alert(`Categoria "${name}" adicionada com sucesso!`);
}

function editCategory(index) {
  const newName = prompt("Editar nome da categoria:", config.categories[index]);

  if (newName && newName.trim()) {
    config.categories[index] = newName.trim();
    persistData();
    renderCategoriesManager();
    updateCategorySelect();
    alert("Categoria atualizada!");
  }
}

function deleteCategory(index) {
  const categoryName = config.categories[index];

  if (
    !confirm(`Tem certeza que deseja excluir a categoria "${categoryName}"?`)
  ) {
    return;
  }

  // Verifica se há produtos usando esta categoria
  const productsUsingCategory = products.filter(
    (p) => p.categoria === categoryName
  );

  if (productsUsingCategory.length > 0) {
    if (
      !confirm(
        `⚠️ ${productsUsingCategory.length} produto(s) usam esta categoria. Eles serão movidos para "${config.categories[0]}". Continuar?`
      )
    ) {
      return;
    }

    // Move os produtos para a primeira categoria
    productsUsingCategory.forEach((product) => {
      product.categoria = config.categories[0];
    });
    renderProductTable();
  }

  config.categories.splice(index, 1);
  persistData();
  renderCategoriesManager();
  updateCategorySelect();
  alert("Categoria excluída!");
}

// Gerenciador de Pagamentos (similar às categorias)
function renderPaymentsManager() {
  const container = document.getElementById("payments-container");
  if (!container) return;

  container.innerHTML = "";

  config.paymentTypes.forEach((payment, index) => {
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

function addNewPayment() {
  const input = document.getElementById("new-payment-name");
  const name = input.value.trim();

  if (!name) {
    alert("Digite um nome para o método de pagamento!");
    return;
  }

  if (config.paymentTypes.includes(name)) {
    alert("Este método de pagamento já existe!");
    return;
  }

  config.paymentTypes.push(name);
  persistData();
  renderPaymentsManager();

  input.value = "";
  alert(`Método de pagamento "${name}" adicionado com sucesso!`);
}

function editPayment(index) {
  const newName = prompt(
    "Editar método de pagamento:",
    config.paymentTypes[index]
  );

  if (newName && newName.trim()) {
    config.paymentTypes[index] = newName.trim();
    persistData();
    renderPaymentsManager();
    alert("Método de pagamento atualizado!");
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
  alert("Método de pagamento excluído!");
}

// Configurações Gerais
function renderGeneralConfig() {
  // Preenche os campos com os valores atuais
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

  // Preenche o select de pagamento padrão
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
  // Aplica o tema
  document.body.setAttribute("data-theme", systemConfig.theme);

  // Aplica modo compacto
  if (systemConfig.compactMode) {
    document.body.classList.add("compact-mode");
  } else {
    document.body.classList.remove("compact-mode");
  }

  // Atualiza alertas
  updateAlerts();
}

// Backup e Restauração
function exportData(type = "all") {
  let data = {};

  switch (type) {
    case "products":
      data = { products };
      break;
    case "sales":
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
        exportDate: new Date().toISOString(),
      };
  }

  const dataStr = JSON.stringify(data, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });

  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `backup-stockbrasil-${type}-${
    new Date().toISOString().split("T")[0]
  }.json`;
  link.click();

  URL.revokeObjectURL(url);
  alert(`Backup de ${type} exportado com sucesso!`);
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
    if (!confirm("🚨 PERIGO: Isso vai apagar TODOS os produtos e zerar o sistema.\n\nTem certeza?")) return;
    
    const senha = prompt("Digite '192837' para confirmar:");
    if (senha !== "192837") return;

    // Mensagem de loading
    document.body.innerHTML = `
        <div style="
            display: flex; 
            justify-content: center; 
            align-items: center; 
            height: 100vh; 
            width: 100vw; 
            background: #1a1a1a; 
            color: white; 
            flex-direction: column;
            text-align: center;
            font-family: sans-serif;
        ">
            <i class="fas fa-broom fa-3x fa-spin" style="margin-bottom: 20px; color: #e74c3c;"></i>
            <h1 style="margin: 0;">Limpando Sistema...</h1>
            <p style="color: #888; margin-top: 10px;">Aguarde, não feche a página.</p>
        </div>
    `;

    try {
        // 1. Limpa LocalStorage (Configurações e Histórico Local)
        localStorage.clear();

        // 2. Limpa Produtos no Firebase
        const productsQuery = await getDocs(collection(db, "products"));
        for (const docSnapshot of productsQuery.docs) {
            await deleteDoc(doc(db, "products", docSnapshot.id));
        }

        // 3. Limpa Vendas no Firebase
        const salesQuery = await getDocs(collection(db, "sales"));
        for (const docSnapshot of salesQuery.docs) {
            await deleteDoc(doc(db, "sales", docSnapshot.id));
        }
        
        // 4. Limpa Histórico de Logs (Se for uma coleção separada)
        // Se você tiver uma coleção chamada 'logHistory', adicione a limpeza aqui:
        // const logsQuery = await getDocs(collection(db, "logHistory"));
        // for (const docSnapshot of logsQuery.docs) {
        //     await deleteDoc(doc(db, "logHistory", docSnapshot.id));
        // }


        setTimeout(() => {
            alert("✅ Sistema zerado! Reiniciando.");
            location.reload();
        }, 1000);

    } catch (error) {
        console.error("❌ ERRO FATAL AO LIMPAR DADOS:", error);
        alert("Erro crítico ao limpar dados. Verifique suas regras de segurança do Firebase.");
        location.reload(); // Tenta recarregar mesmo com erro
    }
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

// Inicializar quando carregar a página
document.addEventListener("DOMContentLoaded", function () {
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

  sales.forEach((sale) => {
    const method = sale.payment || "Não informado";
    paymentMap[method] = (paymentMap[method] || 0) + 1;
  });

  return paymentMap;
}

// Função para obter produtos mais vendidos
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

// Função para obter produtos mais lucrativos
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

// Função para obter top clientes
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

// Função para gerar insights
function generateInsights(sales, metrics) {
  const insights = [];

  if (sales.length === 0) {
    return ["• Nenhuma venda no período selecionado"];
  }

  // Insight de crescimento
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

  // Insight de ticket médio
  if (metrics.averageTicket > 100) {
    insights.push("• 💎 Ticket médio alto indica vendas de alto valor");
  } else if (metrics.averageTicket > 50) {
    insights.push("• 💰 Ticket médio dentro da média esperada");
  } else {
    insights.push("• 🛒 Ticket médio baixo, considere upselling");
  }

  // Insight de margem
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

  // Insight de clientes
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

// =================================================================
// CORREÇÃO: FUNÇÃO setupCartClientAutocomplete
// =================================================================

function setupCartClientAutocomplete() {
  // Esta função é chamada no carregamento, mas não é crítica
  // Pode ser removida ou implementada se necessário
  console.log("Auto-complete de clientes inicializado");
}

// =================================================================
// CORREÇÃO: PROBLEMA NO ID DO STYLE
// =================================================================

// Remova ou corrija a linha problemática (linha 4112)
// Substitua por:
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

// =================================================================
// INICIALIZAÇÃO CORRIGIDA
// =================================================================

// Atualize o DOMContentLoaded para incluir as novas funções
document.addEventListener("DOMContentLoaded", function () {
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

  console.log("Todas as funções do PDF inicializadas com sucesso!");
});

// =================================================================
// VERSÃO SIMPLIFICADA DO generateCompletePDF PARA TESTE
// =================================================================

// =================================================================
// BOTÃO ALTERNATIVO PARA TESTE
// =================================================================

// Use esta função temporariamente para testar:
function testPDF() {
  if (typeof generateCompletePDF === "function") {
    generateCompletePDF();
  } else if (typeof generateCompletePDFSimple === "function") {
    generateCompletePDFSimple();
  } else {
    alert("❌ Funções do PDF não carregadas. Recarregue a página.");
  }
}

// Adicione este botão temporário no HTML para teste:
/*
<button class="submit-btn blue-btn" onclick="testPDF()">
    <i class="fas fa-file-pdf"></i> Testar PDF
</button>
*/




// =================================================================
// VERSÃO ALTERNATIVA: RELATÓRIO DETALHADO COM CLIENTES
// =================================================================

function generateDetailedSalesPDF(doc, startDate, endDate) {
  const sales = getSalesDataForPeriod(
    startDate.toLocaleDateString("pt-BR"),
    endDate.toLocaleDateString("pt-BR")
  );

  // Cabeçalho
  doc.setFontSize(20);
  doc.setTextColor(41, 128, 185);
  doc.text("RELATÓRIO DETALHADO DE VENDAS", 105, 20, { align: "center" });

  // Período
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Período: ${startDate.toLocaleDateString(
      "pt-BR"
    )} à ${endDate.toLocaleDateString("pt-BR")}`,
    105,
    30,
    { align: "center" }
  );

  // Métricas principais
  const metrics = calculateReportMetrics(sales);
  const salesWithClient = sales.filter(
    (sale) => sale.client && sale.client.trim() !== ""
  );
  const uniqueClients = [
    ...new Set(salesWithClient.map((sale) => sale.client)),
  ];

  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);

  // Coluna esquerda - Métricas gerais
  doc.text("MÉTRICAS GERAIS:", 20, 50);
  doc.text(
    `Total de Vendas: R$ ${metrics.totalSales.toLocaleString("pt-BR")}`,
    20,
    60
  );
  doc.text(`Transações: ${metrics.totalTransactions}`, 20, 68);
  doc.text(
    `Ticket Médio: R$ ${metrics.averageTicket.toLocaleString("pt-BR")}`,
    20,
    76
  );
  doc.text(
    `Lucro Estimado: R$ ${metrics.estimatedProfit.toLocaleString("pt-BR")}`,
    20,
    84
  );

  // Coluna direita - Métricas de clientes
  doc.text("MÉTRICAS DE CLIENTES:", 110, 50);
  doc.text(`Vendas com cliente: ${salesWithClient.length}`, 110, 60);
  doc.text(`Clientes únicos: ${uniqueClients.length}`, 110, 68);
  doc.text(
    `Taxa de identificação: ${(
      (salesWithClient.length / sales.length) *
      100
    ).toFixed(1)}%`,
    110,
    76
  );

  // Tabela detalhada de vendas
  const tableData = sales.map((sale) => [
    `#${sale.id}`,
    sale.timestamp.split(" ")[0],
    `R$ ${sale.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    sale.payment,
    sale.client || "-",
    sale.items.length,
    sale.items
      .map((item) => item.nome)
      .join(", ")
      .substring(0, 30) + "...",
  ]);

  doc.autoTable({
    startY: 100,
    head: [
      ["ID", "Data", "Total", "Pagamento", "Cliente", "Itens", "Produtos"],
    ],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [41, 128, 185] },
    styles: {
      fontSize: 7,
      cellPadding: 2,
    },
    margin: { top: 100 },
  });

  // Rodapé
  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 105, finalY, {
    align: "center",
  });
  doc.text(`Total de registros: ${sales.length} vendas`, 105, finalY + 5, {
    align: "center",
  });
  doc.text("StockBrasil - Sistema de Gestão", 105, finalY + 10, {
    align: "center",
  });
}

// =================================================================
// ATUALIZAR FUNÇÃO generatePDF PARA USAR A VERSÃO CORRIGIDA
// =================================================================



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
  doc.text("RELATÓRIO DE ESTOQUE", 105, 20, { align: "center" });

  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, 105, 30, {
    align: "center",
  });

  // Métricas
  const totalStock = products.reduce((sum, p) => sum + p.quantidade, 0);
  const lowStockCount = products.filter((p) => p.quantidade <= p.minimo).length;
  const totalValue = products.reduce(
    (sum, p) => sum + p.preco * p.quantidade,
    0
  );

  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(`Total de Produtos: ${products.length}`, 20, 50);
  doc.text(`Itens em Estoque: ${totalStock}`, 20, 60);
  doc.text(`Produtos com Estoque Baixo: ${lowStockCount}`, 20, 70);
  doc.text(
    `Valor Total do Estoque: R$ ${totalValue.toLocaleString("pt-BR")}`,
    20,
    80
  );

  // Tabela de produtos (apenas estoque baixo ou todos se poucos)
  const showAll = products.length <= 30;
  const displayProducts = showAll
    ? products
    : products.filter((p) => p.quantidade <= p.minimo);

  const tableData = displayProducts.map((product) => [
    product.nome.length > 25
      ? product.nome.substring(0, 25) + "..."
      : product.nome,
    product.categoria,
    product.quantidade,
    product.minimo,
    `R$ ${product.preco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
  ]);

  doc.autoTable({
    startY: 90,
    head: [["Produto", "Categoria", "Estoque", "Mínimo", "Preço"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [39, 174, 96] },
    didDrawCell: function (data) {
      // Destaca estoque baixo
      if (data.column.index === 2 && data.cell.raw <= data.row.raw[3]) {
        doc.setTextColor(231, 76, 60);
      }
    },
  });

  if (!showAll) {
    const finalY = doc.lastAutoTable.finalY + 5;
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `* Mostrando apenas ${displayProducts.length} produtos com estoque baixo`,
      20,
      finalY
    );
  }
}

// Relatório de Lucros em PDF
function generateProfitPDF(doc, startDate, endDate) {
    try {
        const start = new Date(startDate); start.setHours(0,0,0,0);
        const end = new Date(endDate); end.setHours(23,59,59,999);

        const sales = salesHistory.filter(s => {
            const d = parseDataSegura(s.timestamp || s.date);
            return d && d >= start && d <= end;
        });

        if (sales.length === 0) {
            alert("Nenhuma venda para calcular lucro neste período.");
            return;
        }

        doc.setFontSize(18);
        doc.text("Relatório de Lucros", 14, 20);
        doc.setFontSize(10);
        doc.text(`Período: ${start.toLocaleDateString("pt-BR")} a ${end.toLocaleDateString("pt-BR")}`, 14, 28);

        let receitaTotal = 0;
        let custoTotal = 0;
        const resumoProdutos = {};

        sales.forEach(sale => {
            if (sale.items) {
                sale.items.forEach(item => {
                    const qtd = Number(item.quantity) || 0;
                    const preco = Number(item.preco) || 0;
                    const custo = Number(item.custo) || 0;

                    const receitaItem = preco * qtd;
                    const custoItem = custo * qtd;

                    receitaTotal += receitaItem;
                    custoTotal += custoItem;

                    // Agrupa por nome
                    const nome = item.nome || "Item";
                    if (!resumoProdutos[nome]) {
                        resumoProdutos[nome] = { qtd: 0, receita: 0, custo: 0, lucro: 0 };
                    }
                    resumoProdutos[nome].qtd += qtd;
                    resumoProdutos[nome].receita += receitaItem;
                    resumoProdutos[nome].custo += custoItem;
                    resumoProdutos[nome].lucro += (receitaItem - custoItem);
                });
            }
        });

        const lucroTotal = receitaTotal - custoTotal;
        const margem = receitaTotal > 0 ? ((lucroTotal / receitaTotal) * 100).toFixed(1) : "0.0";

        // Exibe Totais
        doc.text(`Receita: R$ ${receitaTotal.toFixed(2)}`, 14, 40);
        doc.text(`Custo: R$ ${custoTotal.toFixed(2)}`, 80, 40);
        doc.text(`Lucro: R$ ${lucroTotal.toFixed(2)}`, 140, 40);
        doc.text(`Margem: ${margem}%`, 200, 40);

        // Tabela
        const rows = Object.entries(resumoProdutos)
            .sort(([,a], [,b]) => b.lucro - a.lucro)
            .map(([nome, p]) => [
                nome,
                p.qtd,
                `R$ ${p.receita.toFixed(2)}`,
                `R$ ${p.custo.toFixed(2)}`,
                `R$ ${p.lucro.toFixed(2)}`
            ]);

        doc.autoTable({
            startY: 50,
            head: [['Produto', 'Qtd', 'Receita', 'Custo', 'Lucro']],
            body: rows,
            theme: 'grid',
            headStyles: { fillColor: [46, 204, 113] }
        });

    } catch (err) { console.error(err); alert("Erro ao gerar PDF Lucros."); }
}
function setupClientAutocomplete() {
  const clientInput = document.getElementById("client-name");
  const suggestionsContainer = document.getElementById("client-suggestions");

  if (!clientInput || !suggestionsContainer) return;

  clientInput.addEventListener("input", function () {
    const searchTerm = this.value.toLowerCase().trim();
    suggestionsContainer.innerHTML = "";

    if (searchTerm.length < 2) return;

    // Filtra clientes existentes
    const matchingClients = clients
      .filter((client) => client.name.toLowerCase().includes(searchTerm))
      .slice(0, 5); // Limita a 5 sugestões

    // Adiciona sugestões
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

    // Sugere adicionar novo cliente se não encontrado
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

  // Fecha sugestões ao clicar fora
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

  // Preenche o campo com o novo cliente
  document.getElementById("client-name").value = newClient.name;

  console.log(`Novo cliente adicionado: ${newClient.name}`);
}

function filterSalesTable(searchTerm) {
  try {
    const searchLower = searchTerm.toLowerCase().trim();
    const rows = document.querySelectorAll("#sales-report-table tbody tr");
    let visibleCount = 0;

    // Remove mensagem de "nenhum resultado" anterior se existir
    const existingNoResults = document.querySelector(
      "#sales-report-table .no-results"
    );
    if (existingNoResults) {
      existingNoResults.remove();
    }

    // Se pesquisa vazia, mostra todas as linhas
    if (searchLower === "") {
      rows.forEach((row) => {
        row.style.display = "";
        visibleCount++;
      });
      return;
    }

    // Filtra as linhas
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

    // Mostra mensagem se nenhum resultado for encontrado
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

  // Pesquisa em tempo real
  searchInput.addEventListener("input", function (e) {
    filterSalesTable(e.target.value);
  });

  // Limpa com Escape
  searchInput.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
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
  let value = input.value.replace(/\D/g, "");

  if (value.length > 2) {
    value = value.substring(0, 2) + "/" + value.substring(2);
  }
  if (value.length > 5) {
    value = value.substring(0, 5) + "/" + value.substring(5, 9);
  }

  input.value = value;
}

// Função para validar e filtrar
function filtrarPorPeriodo() {
  const dataInicio = document.getElementById("data-inicio").value;
  const dataFim = document.getElementById("data-fim").value;

  // Validação básica
  if (!dataInicio || !dataFim) {
    alert("Por favor, preencha ambas as datas.");
    return;
  }

  // Validação de formato
  const regexData = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!regexData.test(dataInicio) || !regexData.test(dataFim)) {
    alert("Por favor, use o formato DD/MM/AAAA.");
    return;
  }

  // Aqui você adiciona a lógica de filtro real
  console.log("Filtrando de:", dataInicio, "até:", dataFim);

  // Exemplo: Atualizar os dados na tela
  alert(`Filtro aplicado!\nPeríodo: ${dataInicio} à ${dataFim}`);
}

// Inicialização quando a página carregar
document.addEventListener("DOMContentLoaded", function () {
  // Adicionar eventos de formatação automática
  const dataInicio = document.getElementById("data-inicio");
  const dataFim = document.getElementById("data-fim");

  if (dataInicio) {
    dataInicio.addEventListener("input", function () {
      formatarData(this);
    });

    // Placeholder dinâmico
    dataInicio.placeholder = "DD/MM/AAAA";
  }

  if (dataFim) {
    dataFim.addEventListener("input", function () {
      formatarData(this);
    });

    // Placeholder dinâmico
    dataFim.placeholder = "DD/MM/AAAA";
  }

  // Adicionar evento ao botão filtrar
  const btnFiltrar = document.querySelector(
    ".period-filter-custom .filter-btn"
  );
  if (btnFiltrar) {
    btnFiltrar.addEventListener("click", filtrarPorPeriodo);
  }

  // Também filtrar ao pressionar Enter nos campos
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

// Inicializar gráfico de distribuição por categoria

function inicializarGraficoCategoria() {
  try {
    const ctx = document.getElementById("categoryChart");
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
document.addEventListener("DOMContentLoaded", function () {
  inicializarGraficoCategoria();

  // Seu código existente do filtro aqui...
});

document.addEventListener("DOMContentLoaded", function () {
  // Garante que as funções estejam disponíveis globalmente
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

// Adiciona os estilos ao head do documento
// CORREÇÃO: Adiciona os estilos ao head do documento
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

    // Atualiza os elementos HTML
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

// Função para resetar métricas
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


// ==========================================
// 1. FUNÇÃO SIMPLIFICADA DE DATAS
// ==========================================
function obterDataTexto(input) {
    if (!input) return null;

    let data;

    // Tenta criar a data normalmente
    data = new Date(input);

    // Se falhar (data inválida), tenta corrigir formato brasileiro DD/MM/AAAA
    if (isNaN(data.getTime()) && typeof input === 'string') {
        const partes = input.split(' ')[0].split('/'); // Pega só a data
        if (partes.length === 3) {
            // Recria como AAAA-MM-DDT12:00:00 (Meio dia para evitar fuso)
            data = new Date(`${partes[2]}-${partes[1]}-${partes[0]}T12:00:00`);
        }
    }

    // Se ainda for inválida, desiste
    if (isNaN(data.getTime())) return null;

    // Retorna APENAS o texto: "03/12/2023"
    return data.toLocaleDateString("pt-BR");
}

// =========================================================
// 1. FUNÇÃO INFALÍVEL DE TEXTO (DD/MM/AAAA)
// =========================================================
function normalizarDataParaTexto(input) {
    if (!input) return null;

    // Se já veio como string "03/12/2025, 14:30:00"
    if (typeof input === 'string') {
        // Pega só a parte da data (antes da vírgula ou espaço)
        const parteData = input.split(' ')[0].replace(',', '').trim();
        
        // Se já estiver em DD/MM/AAAA, retorna direto!
        if (parteData.includes('/') && parteData.split('/')[0].length === 2) {
            return parteData; 
        }

        // Se estiver em YYYY-MM-DD (ISO do banco antigo/novo)
        if (parteData.includes('-')) {
            const p = parteData.split('-'); // [2025, 12, 03]
            return `${p[2]}/${p[1]}/${p[0]}`; // Retorna 03/12/2025
        }
    }

    // Se for um objeto Date do Javascript
    if (input instanceof Date) {
        return input.toLocaleDateString("pt-BR");
    }

    // Tenta converter em último caso
    try {
        const d = new Date(input);
        if (!isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
    } catch (e) { return null; }

    return null;
}

// ==========================================
// PDF DE VENDAS (CORRIGIDO)
// ==========================================
// ==========================================
// PDF DE VENDAS (VERSÃO BLINDADA)
// ==========================================
// =========================================================
// 1. FUNÇÃO AUXILIAR: Converte texto/ISO para Data Real
// =========================================================
function normalizarData(input) {
    if (!input) return null;

    // Se já for data real, retorna ela
    if (input instanceof Date && !isNaN(input.getTime())) return input;

    // Se for texto (String)
    if (typeof input === 'string') {
        // Caso 1: Formato Brasileiro "25/12/2023" ou "25/12/2023 14:30"
        if (input.includes('/')) {
            const partesData = input.split(' ')[0].split('/'); // Pega só a data: ["25", "12", "2023"]
            if (partesData.length === 3) {
                // Cria data: Ano, Mês (0-11), Dia. 
                // Fixamos hora 12:00 para evitar problemas de fuso horário voltando o dia
                return new Date(partesData[2], partesData[1] - 1, partesData[0], 12, 0, 0);
            }
        }
        
        // Caso 2: Formato ISO "2023-12-25" (Comum em backups JSON)
        const d = new Date(input);
        if (!isNaN(d.getTime())) return d;
    }

    return null;
}

// =================================================================
// 2. CORREÇÃO DE DATAS "BLINDADA" (Para o PDF ler datas antigas)
// =================================================================
function forcarData(input) {
    if (!input) return null;

    // Se já for objeto Date
    if (input instanceof Date && !isNaN(input)) return input;

    // Se for texto
    if (typeof input === 'string') {
        // Tenta formato ISO (2023-11-25)
        if (input.includes('-')) {
            // Adiciona meio-dia para evitar bug de fuso horário
            const d = new Date(input.length <= 10 ? input + "T12:00:00" : input);
            if (!isNaN(d)) return d;
        }

        // Tenta formato BR (25/11/2023)
        if (input.includes('/')) {
            const partes = input.split(' ')[0].split('/'); // Pega [25, 11, 2023]
            if (partes.length === 3) {
                // Mês no JS começa em 0, então subtrai 1
                return new Date(partes[2], partes[1] - 1, partes[0], 12, 0, 0);
            }
        }
    }
    return null;
}

// =================================================================
// 3. PDF DE VENDAS (USANDO A NOVA LÓGICA DE DATAS)
// =================================================================
function generateSalesPDF(doc, startDate, endDate) {
    try {
        console.log("Iniciando PDF...");

        // Configura datas de filtro (começo do dia inicial até fim do dia final)
        const inicio = new Date(startDate); inicio.setHours(0,0,0,0);
        const fim = new Date(endDate); fim.setHours(23,59,59,999);

        // Filtra usando a função forcarData
        const vendasFiltradas = salesHistory.filter(venda => {
            // Verifica 'timestamp' E 'date' (para compatibilidade com backups antigos)
            const dataBruta = venda.timestamp || venda.date; 
            const dataReal = forcarData(dataBruta);

            if (!dataReal) return false; // Se a data estiver corrompida, ignora

            // Compara
            return dataReal >= inicio && dataReal <= fim;
        });

        if (vendasFiltradas.length === 0) {
            alert(`Nenhuma venda encontrada entre ${inicio.toLocaleDateString()} e ${fim.toLocaleDateString()}. \n\nTotal de vendas no sistema: ${salesHistory.length}.`);
            return;
        }

        // Gera o PDF
        doc.setFontSize(18);
        doc.text("Relatório de Vendas", 14, 20);
        doc.setFontSize(10);
        doc.text(`Período: ${inicio.toLocaleDateString("pt-BR")} a ${fim.toLocaleDateString("pt-BR")}`, 14, 30);
        
        const rows = vendasFiltradas.map(v => {
            const d = forcarData(v.timestamp || v.date);
            return [
                d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR").slice(0,5), // Data Hora
                v.client || "-", // Cliente
                v.payment || "-", // Pagamento
                (v.items || []).length, // Qtd
                `R$ ${parseFloat(v.total).toFixed(2)}` // Valor
            ];
        });

        // Calcula total
        const total = vendasFiltradas.reduce((acc, v) => acc + (parseFloat(v.total)||0), 0);

        doc.autoTable({
            startY: 40,
            head: [['Data', 'Cliente', 'Pagto', 'Itens', 'Total']],
            body: rows,
            foot: [['TOTAL', '', '', '', `R$ ${total.toFixed(2)}`]],
            theme: 'grid'
        });

    } catch (e) {
        console.error(e);
        alert("Erro ao gerar PDF: " + e.message);
    }
}

// NOVA FUNÇÃO: Janela de Detalhes do Carrinho Salvo
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

// =========================================================
// FUNÇÃO PARA CORRIGIR DATAS (ISO OU TEXTO)
// =========================================================
function parseDataSegura(input) {
    if (!input) return null;

    // 1. Se já for um objeto Date
    if (input instanceof Date && !isNaN(input.getTime())) return input;

    // 2. Tenta converter String
    if (typeof input === 'string') {
        // Se for data BR (DD/MM/AAAA)
        if (input.includes('/')) {
            const partes = input.split(' ')[0].split('/');
            if (partes.length === 3) {
                // Cria data no meio do dia para evitar erro de fuso horário
                return new Date(partes[2], partes[1] - 1, partes[0], 12, 0, 0);
            }
        }
        
        // Se for ISO do Banco (YYYY-MM-DD...)
        const d = new Date(input);
        if (!isNaN(d.getTime())) return d;
    }

    return null;
}

function criarNovoArquivo() {
    // 1. Pergunta de segurança
    const confirmacao = confirm("⚠️ ATENÇÃO: Isso vai apagar TODOS os dados atuais para começar do zero.\n\nDeseja fazer um backup automático antes de limpar?");

    if (confirmacao) {
        // Tenta exportar os dados atuais antes de apagar
        try {
            exportData(); // Chama sua função de exportar/download
            alert("Backup realizado! Agora vamos limpar o sistema.");
        } catch (e) {
            alert("Erro ao fazer backup. O sistema não será limpo por segurança.");
            return;
        }
    } else {
        // Se o usuário cancelar o backup, pergunta se quer continuar mesmo assim
        if (!confirm("Tem certeza que deseja apagar tudo SEM fazer backup? Essa ação é irreversível.")) {
            return;
        }
    }

    // 2. Limpa tudo
    localStorage.clear();
    
    // 3. Reinicia as variáveis
    produtos = [];
    vendas = [];
    clientes = [];
    
    alert("Sistema limpo com sucesso! Iniciando novo arquivo.");
    window.location.reload();
}

// =================================================================
// CORREÇÃO DEFINITIVA - IMPORTAÇÃO E PDF
// Cole isso no FINAL do seu arquivo script.js
// =================================================================

// 1. IMPORTAÇÃO CORRIGIDA (Lê o ID correto do HTML)
async function importData() {
    // Agora busca o ID que colocamos no passo 1
    const input = document.getElementById('arquivo-backup-input');
    
    // Debug para ver se achou o input
    if (!input) {
        alert("ERRO FATAL: Não encontrei o input com id 'arquivo-backup-input' no HTML.");
        return;
    }

    if (!input.files || input.files.length === 0) {
        alert("⚠️ ATENÇÃO: Você precisa clicar em 'Escolher arquivo' antes de clicar em Importar.");
        return;
    }

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = function(event) {
        try {
            const jsonContent = event.target.result;
            const data = JSON.parse(jsonContent);

            if (!confirm(`Arquivo lido com sucesso!\n\nDeseja substituir todos os dados atuais pelo backup?`)) {
                return;
            }

            // Limpa tudo
            localStorage.clear();

            // Salva cada chave do backup
            Object.keys(data).forEach(key => {
                const valor = typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key];
                localStorage.setItem(key, valor);
            });

            alert("✅ Backup restaurado! A página será recarregada.");
            window.location.reload();

        } catch (error) {
            console.error("Erro importação:", error);
            alert("O arquivo selecionado não é um JSON válido.");
        }
    };
    reader.readAsText(file);
}

// 2. FUNÇÃO MÁGICA DE DATA (Lê qualquer formato antigo ou novo)
function normalizarDataParaFiltro(input) {
    if (!input) return null;

    // Se for string ISO (2023-10-25) ou BR (25/10/2023)
    if (typeof input === 'string') {
        // Formato BR
        if (input.includes('/')) {
            const partes = input.split(' ')[0].split('/'); 
            if (partes.length === 3) {
                // Cria data ano, mes-1, dia
                return new Date(partes[2], partes[1] - 1, partes[0], 12, 0, 0);
            }
        }
        // Formato ISO
        const d = new Date(input);
        if (!isNaN(d.getTime())) {
            d.setHours(12,0,0,0); // Força meio dia pra evitar erro de fuso
            return d;
        }
    }
    // Se já for data
    if (input instanceof Date && !isNaN(input)) return input;
    
    return null;
}

// =================================================================
// RELATÓRIOS PDF - PADRÃO ENTERPRISE (PROFISSIONAL)
// =================================================================

// 1. CONVERSOR DE DATAS (Mantido pois funciona perfeitamente)
function converterDataNaMarra(input) {
    if (!input) return null;
    if (input instanceof Date && !isNaN(input)) return input;
    
    let str = String(input).trim();
    if (str.includes(',')) str = str.split(',')[0];
    else if (str.includes(' ')) str = str.split(' ')[0];

    if (str.includes('/')) {
        const partes = str.split('/');
        if (partes.length === 3) {
            const d = new Date(partes[2], partes[1] - 1, partes[0], 12, 0, 0);
            if (!isNaN(d.getTime())) return d;
        }
    }
    const dISO = new Date(str);
    if (!isNaN(dISO.getTime())) { dISO.setHours(12, 0, 0, 0); return dISO; }
    return null;
}

// Função NOVA: Apenas formata o visual (Data + Hora) sem alterar o valor
function formatarDataHoraVisual(input) {
    if (!input) return "-";
    
    // Converte para texto
    const str = String(input).trim();

    // Se for o formato do seu backup: "17/06/2024, 15:30:00"
    if (str.includes(',')) {
        const partes = str.split(',');
        const data = partes[0].trim();
        const hora = partes[1].trim(); 
        // Retorna "17/06/2024 15:30" (corta os segundos se quiser)
        return `${data} ${hora.slice(0, 5)}`; 
    }

    // Se for objeto Date ou ISO
    const d = new Date(input);
    if (!isNaN(d.getTime())) {
        return d.toLocaleString("pt-BR").slice(0, 16); // "dd/mm/aaaa hh:mm"
    }

    return str; // Retorna original se não souber formatar
}

// 2. GERENTE DE PDF
function generatePDF(type) {
    if (!window.jspdf) { alert("Biblioteca jsPDF não carregada."); return; }

    if (type === 'inventory-report') { imprimirRelatorioEstoque(); return; }

    let startDate, endDate;
    const periodElem = document.getElementById("pdf-period");
    const periodValue = periodElem ? periodElem.value : "30";

    if (periodValue === "custom") {
        const startInput = prompt("Data INICIAL (Dia/Mês/Ano):", "01/01/2023");
        if (!startInput) return;
        const endInput = prompt("Data FINAL (Dia/Mês/Ano):", new Date().toLocaleDateString("pt-BR"));
        startDate = converterDataNaMarra(startInput);
        endDate = converterDataNaMarra(endInput);
    } else {
        const days = parseInt(periodValue) || 30;
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(endDate.getDate() - days);
    }

    if (!startDate || !endDate) { alert("Datas inválidas."); return; }

    startDate.setHours(0,0,0,0);
    endDate.setHours(23,59,59,999);

    if (type === 'sales-report' || type === 'detailed-sales') {
        imprimirRelatorioVendas(startDate, endDate);
    } else if (type === 'profit-report') {
        imprimirRelatorioLucro(startDate, endDate);
    }
}

// =================================================================
// 3. RELATÓRIO DE VENDAS (LAYOUT CORPORATIVO)
// =================================================================
function imprimirRelatorioVendas(startDate, endDate) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // 1. FILTRAGEM (Usa a função bruta para comparar datas corretamente)
    const vendasFiltradas = salesHistory.filter(venda => {
        const d = converterDataNaMarra(venda.timestamp || venda.date || venda.data);
        return d && d >= startDate && d <= endDate;
    });

    if (vendasFiltradas.length === 0) { alert("Nenhuma venda no período."); return; }

    const totalGeral = vendasFiltradas.reduce((acc, v) => acc + (parseFloat(v.total)||0), 0);
    const qtdVendas = vendasFiltradas.length;
    const ticketMedio = totalGeral / qtdVendas;
    const maiorVenda = Math.max(...vendasFiltradas.map(v => parseFloat(v.total)||0));

    // --- CABEÇALHO ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(44, 62, 80);
    doc.text("RELATÓRIO ANALÍTICO DE VENDAS", 14, 18);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text("StockBrasil System", 196, 18, {align: 'right'});
    
    doc.setDrawColor(200);
    doc.setLineWidth(0.1);
    doc.line(14, 22, 196, 22);

    // --- KPIs ---
    doc.setFillColor(245, 247, 250); 
    doc.rect(14, 25, 182, 20, 'F');
    
    function drawKPI(label, value, x) {
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(label.toUpperCase(), x, 32);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(44, 62, 80);
        doc.text(value, x, 39);
    }

    drawKPI("Faturamento Total", `R$ ${totalGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 20);
    drawKPI("Volume de Vendas", `${qtdVendas} transações`, 70);
    drawKPI("Ticket Médio", `R$ ${ticketMedio.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 115);
    
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("MAIOR VENDA", 160, 32);
    doc.setFontSize(11);
    doc.setTextColor(39, 174, 96);
    doc.text(`R$ ${maiorVenda.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 160, 39);

    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.setFont("helvetica", "normal");
    doc.text(`Período: ${startDate.toLocaleDateString("pt-BR")} a ${endDate.toLocaleDateString("pt-BR")}`, 14, 52);

    // --- AQUI ESTÁ A CORREÇÃO DA HORA ---
    const rows = vendasFiltradas.map(v => {
        // Usa a NOVA função visual para exibir a hora certa
        const dataHoraVisual = formatarDataHoraVisual(v.timestamp || v.date || v.data);
        const idVisivel = v.id ? String(v.id).slice(-6) : "---";
        
        return [
            idVisivel,
            dataHoraVisual, // AGORA VAI APARECER A HORA CERTA
            (v.client || "Consumidor Final").substring(0, 35),
            v.payment || "-",
            (v.items || []).length,
            `R$ ${parseFloat(v.total || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
        ];
    });

    doc.autoTable({
        startY: 56,
        head: [['ID', 'Data/Hora', 'Cliente', 'Pagamento', 'Itens', 'Valor']],
        body: rows,
        theme: 'plain',
        headStyles: { 
            fillColor: [255, 255, 255],
            textColor: [44, 62, 80],
            lineWidth: 0.1,
            lineColor: [200, 200, 200],
            fontStyle: 'bold',
            fontSize: 9,
            halign: 'left'
        },
        styles: { 
            fontSize: 9,
            cellPadding: 3,
            textColor: [60, 60, 60],
            valign: 'middle',
            lineWidth: 0.1,
            lineColor: [230, 230, 230]
        },
        columnStyles: {
            0: { cellWidth: 20, fontStyle: 'bold' },
            1: { cellWidth: 35 }, 
            4: { halign: 'center', cellWidth: 15 },
            5: { halign: 'right', fontStyle: 'bold', cellWidth: 30 }
        },
        didDrawPage: function (data) {
            const str = `Página ${doc.internal.getNumberOfPages()} | Gerado em ${new Date().toLocaleString()}`;
            doc.setFontSize(7);
            doc.setTextColor(150);
            doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 10);
        }
    });

    adicionarPaginaGraficos(doc, vendasFiltradas, totalGeral, ticketMedio);

    doc.save(`Relatorio_Vendas_${new Date().toISOString().slice(0,10)}.pdf`);
}

// =================================================================
// 4. PÁGINA DE GRÁFICOS (VISUAL LIMPO)
// =================================================================
function adicionarPaginaGraficos(doc, vendas, total, ticket) {
    doc.addPage();
    
    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80);
    doc.text("Dashboard de Performance", 14, 20);
    doc.setDrawColor(200);
    doc.line(14, 25, 196, 25);

    // Dados
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

    // --- GRÁFICO 1 ---
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
        
        // Barra Sólida (Elegante)
        doc.setFillColor(52, 152, 219);
        doc.rect(50, y, width, 5, 'F');
        
        doc.setFontSize(8);
        doc.text(`R$ ${valor.toFixed(0)}`, 50 + width + 2, y+4);
        y += 10;
    });

    // --- GRÁFICO 2 ---
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



// =================================================================
// 5. RELATÓRIOS SIMPLES (ESTOQUE E LUCRO)
// =================================================================
function imprimirRelatorioEstoque() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    if (!products || products.length === 0) { alert("Estoque vazio."); return; }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("INVENTÁRIO DE ESTOQUE", 14, 18);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Posição em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 24);

    let qtdTotal = 0, valorTotal = 0;
    const rows = products.map(p => {
        const qtd = parseInt(p.quantidade) || 0;
        const total = qtd * (parseFloat(p.preco) || 0);
        qtdTotal += qtd; valorTotal += total;
        return [p.nome, p.categoria, qtd, `R$ ${parseFloat(p.preco).toFixed(2)}`, `R$ ${total.toFixed(2)}`];
    });

    doc.autoTable({
        startY: 30,
        head: [['Produto', 'Categoria', 'Qtd', 'Unitário', 'Total']],
        body: rows,
        theme: 'plain',
        headStyles: { fillColor: [240, 240, 240], textColor: 50, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3, lineWidth: 0.1, lineColor: 220 },
        foot: [['TOTAIS', '', qtdTotal, '', `R$ ${valorTotal.toLocaleString('pt-BR', {minimumFractionDigits:2})}`]],
        footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' }
    });
    doc.save("Inventario.pdf");
}

function imprimirRelatorioLucro(startDate, endDate) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const vendas = salesHistory.filter(v => {
        const d = converterDataNaMarra(v.timestamp || v.date);
        return d && d >= startDate && d <= endDate;
    });

    if (vendas.length === 0) { alert("Sem dados."); return; }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("DEMONSTRATIVO DE RESULTADOS", 14, 18);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Período: ${startDate.toLocaleDateString()} a ${endDate.toLocaleDateString()}`, 14, 24);

    let receita = 0, custo = 0;
    const prodStats = {};

    vendas.forEach(v => {
        if(v.items) v.items.forEach(i => {
            const r = i.preco * i.quantity;
            let cUnit = i.custo || 0;
            if(cUnit === 0) {
                const p = products.find(prod => (prod._id || prod.id) == i.id);
                if(p) cUnit = p.custo;
            }
            const c = cUnit * i.quantity;
            receita += r; custo += c;
            
            if(!prodStats[i.nome]) prodStats[i.nome] = {lucro:0, receita:0, qtd:0};
            prodStats[i.nome].lucro += (r - c);
            prodStats[i.nome].receita += r;
            prodStats[i.nome].qtd += i.quantity;
        });
    });

    // KPI Box
    doc.setFillColor(245, 247, 250);
    doc.rect(14, 30, 182, 18, 'F');
    doc.setFontSize(10);
    doc.text(`Receita: R$ ${receita.toLocaleString('pt-BR', {minimumFractionDigits:2})}`, 20, 42);
    doc.text(`Custo: R$ ${custo.toLocaleString('pt-BR', {minimumFractionDigits:2})}`, 80, 42);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(39, 174, 96);
    doc.text(`Lucro: R$ ${(receita-custo).toLocaleString('pt-BR', {minimumFractionDigits:2})}`, 140, 42);
    doc.setTextColor(0);

    const rows = Object.entries(prodStats).sort((a,b)=>b[1].lucro - a[1].lucro).map(([k,v]) => [
        k, v.qtd, `R$ ${v.receita.toFixed(2)}`, `R$ ${v.lucro.toFixed(2)}`
    ]);

    doc.autoTable({
        startY: 55,
        head: [['Produto', 'Qtd', 'Receita', 'Lucro']],
        body: rows,
        theme: 'plain',
        headStyles: { fillColor: [240, 240, 240], textColor: 50, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3, lineWidth: 0.1, lineColor: 220 }
    });
    doc.save("Lucros.pdf");
}



// Função para abrir o perfil ao clicar no retângulo
function openProfileSettings() {
    // Redireciona para Configurações
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    
    const configLink = document.querySelector('a[href="#config"]');
    if(configLink) configLink.classList.add('active');
    
    const configSection = document.getElementById('config');
    if (configSection) {
        configSection.style.display = 'block';
        showConfigTab('categories');
        document.getElementById('current-page-title').textContent = "Configurações";
    }
    document.getElementById('sidebar-profile-dropdown').classList.remove('show');
}
// Pendura a função no window para o HTML enxergar
window.openProfileSettings = openProfileSettings;



// =================================================================
// 6. EXPORTAÇÃO GLOBAL (FUNÇÕES ONCLICK DO HTML)
// =================================================================

window.loadAllData = loadAllData;
window.handleProductForm = handleProductForm;
window.deleteProduct = deleteProduct;
window.editProduct = editProduct;
window.resetProductForm = resetProductForm;
window.showTab = showTab;
window.toggleSidebar = toggleSidebar;
window.toggleAlertsWindow = toggleAlertsWindow;
window.clearAllAlerts = clearAllAlerts;

// Funções de Vendas/PDV/Carrinho
window.addToCart = addToCart;
window.updateCartQuantity = updateCartQuantity; // FUNÇÃO QUE ESTAVA FALTANDO
window.removeItemFromCart = removeItemFromCart;
window.clearCart = clearCart;
window.checkout = checkout; // FUNÇÃO QUE ESTAVA FALTANDO
window.saveCurrentCart = saveCurrentCart; // FUNÇÃO QUE ESTAVA FALTANDO
window.confirmSaveCart = confirmSaveCart;
window.loadSavedCart = loadSavedCart;
window.deleteSavedCart = deleteSavedCart;
window.setupNavigation = setupNavigation; // Para o DOMContentLoaded

// Funções de Relatórios/Configurações
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
window.imprimirRelatorioVendas = imprimirRelatorioVendas;
window.imprimirRelatorioEstoque = imprimirRelatorioEstoque;
window.imprimirRelatorioLucro = imprimirRelatorioLucro;
window.resetProductForm = resetProductForm; 
window.logout = logout;
window.openProfileSettings = openProfileSettings;
window.toggleSidebarProfileMenu = toggleSidebarProfileMenu;
// -----------------------------------------------------------

// ... o resto das suas exportações globais

// --- NO SEU script.js (ADICIONE ESTA FUNÇÃO SE ELA ESTIVER FALTANDO) ---

// =================================================================
// FUNÇÃO CORRIGIDA: MENU DE PERFIL LATERAL
// =================================================================
function toggleSidebarProfileMenu() {
    const sidebar = document.getElementById('sidebar');
    const menu = document.getElementById('sidebar-profile-dropdown');
    const arrow = document.querySelector('.sidebar-profile-card .arrow-icon'); // Pega a setinha

    if (!sidebar || !menu) return;

    // 1. Se a sidebar estiver colapsada (fechada), abre ela primeiro
    if (sidebar.classList.contains('collapsed')) {
        sidebar.classList.remove('collapsed');
        const mainContent = document.getElementById('main-content');
        if(mainContent) mainContent.classList.remove('expanded');
        
        // Espera 300ms (tempo da animação) para abrir o menu
        setTimeout(() => {
            menu.style.display = 'block';
            menu.classList.add('show');
            if(arrow) arrow.style.transform = 'rotate(180deg)'; // Gira a seta
        }, 300);
    } 
    // 2. Se a sidebar já estiver aberta, apenas alterna o menu
    else {
        // Verifica se está visível (checa display ou classe)
        const isVisible = menu.style.display === 'block' || menu.classList.contains('show');

        if (isVisible) {
            // Esconde
            menu.style.display = 'none';
            menu.classList.remove('show');
            if(arrow) arrow.style.transform = 'rotate(0deg)'; // Volta a seta ao normal
        } else {
            // Mostra
            menu.style.display = 'block';
            menu.classList.add('show');
            if(arrow) arrow.style.transform = 'rotate(180deg)'; // Gira a seta
        }
    }
}

async function logout() {
    // Certifique-se de que 'auth' e 'signOut' estejam importados no topo
    try {
        await signOut(auth);
        console.log("Usuário deslogado com sucesso.");
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
        alert("Erro ao sair da conta. Verifique a conexão.");
    }
}



//--------------------- seta do perfil ---------------------