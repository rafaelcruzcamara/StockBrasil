import re

# Lista de funções que DEVEM ser apagadas (pois já estão nos imports)
funcoes_para_apagar = [
    # Utils
    "showToast", "setBtnLoading", "showLoadingScreen", "hideLoadingScreen", 
    "updateLoadingMessage", "mascaraCpfCnpj", "mascaraCnpj", "mascaraTelefone", 
    "mascaraData", "fmtMoeda", "parseDataSegura", "converterDataNaMarra",
    
    # Product UI
    "converterImagemParaBase64", "limparImagemForm", "calcularPrecificacao", 
    "calcularPrecoVenda", "calcularLucroReal", "updateCategorySelect", 
    "updateEstablishmentSelect", "updateProductSupplierDropdown", "resetProductForm",
    
    # Sales (Vendas)
    "addToCart", "updateCartQuantity", "removeItemFromCart", "clearCart", 
    "renderCart", "checkout", "renderPaymentOptions", "aplicarDescontoVisual", 
    "concluirVenda", "processSale", "saveCurrentCart", "confirmSaveCart", 
    "loadSavedCart", "deleteSavedCart", "renderSavedCarts", "filterPdvProducts",
    "renderPdvProducts",
    
    # Partners (Parceiros)
    "handleClientForm", "renderClientsTable", "editClient", "clearClientForm",
    "handleSupplierForm", "renderSuppliersTable", "editSupplier", "clearSupplierForm",
    "deletePartner", "abrirModalCliente", "fecharModalCliente", 
    "abrirModalFornecedor", "fecharModalFornecedor",
    
    # Reports (Relatórios)
    "generatePDF", "imprimirRelatorioEstoque", "imprimirRelatorioVendas", 
    "imprimirRelatorioLucro", "generateProfessionalPDF", "imprimirNotaPDF", 
    "imprimirTabelaDespesas", "generateDetailedSalesPDF", "generateInventoryPDF",
    "generateProfitPDF", "generateSalesPDF"
]

def limpar_script():
    try:
        with open("script.js", "r", encoding="utf-8") as f:
            linhas = f.readlines()
    except FileNotFoundError:
        print("Erro: Arquivo script.js não encontrado.")
        return

    novas_linhas = []
    pular = False
    chaves_abertas = 0
    funcao_atual = ""

    print(f"Iniciando limpeza de {len(funcoes_para_apagar)} funções duplicadas...")

    for i, linha in enumerate(linhas):
        linha_strip = linha.strip()
        
        # Se não estamos pulando, verificamos se começa uma função proibida
        if not pular:
            encontrou = False
            for func in funcoes_para_apagar:
                # Padrão 1: function nome()
                padrao1 = f"function {func}"
                # Padrão 2: window.nome = function
                padrao2 = f"window.{func} = function"
                # Padrão 3: window.nome = (
                padrao3 = f"window.{func} = ("
                
                if (padrao1 in linha) or (padrao2 in linha) or (padrao3 in linha):
                    # CUIDADO: Não apagar as linhas finais de atribuição (ex: window.func = func;)
                    # Se a linha termina com ; e não tem {, é apenas uma referência, mantém.
                    if linha_strip.endswith(";") and "{" not in linha_strip:
                        continue
                        
                    print(f"🗑️ Removendo: {func} (Linha {i+1})")
                    pular = True
                    funcao_atual = func
                    chaves_abertas = linha.count("{") - linha.count("}")
                    encontrou = True
                    break
            
            if not encontrou:
                novas_linhas.append(linha)
        
        else:
            # Estamos dentro de uma função que deve ser apagada
            chaves_abertas += linha.count("{")
            chaves_abertas -= linha.count("}")
            
            # Se as chaves zeraram, a função acabou
            if chaves_abertas <= 0:
                pular = False
                funcao_atual = ""
                # Não adicionamos essa linha (é o fechamento da função apagada)

    with open("script_limpo.js", "w", encoding="utf-8") as f:
        f.writelines(novas_linhas)

    print("\n✅ Concluído! Arquivo salvo como 'script_limpo.js'.")
    print("👉 Verifique o arquivo novo e, se estiver tudo certo, renomeie para script.js")

if __name__ == "__main__":
    limpar_script()