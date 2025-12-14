import { showToast, mascaraData, fmtMoeda, parseDataSegura, converterDataNaMarra } from './utils.js';

// Função Principal de Entrada
export function generatePDF(type) {
    if (!window.jspdf) return window.customAlert("Erro: Biblioteca PDF não carregada.", "error");

    // Relatório de Estoque (sempre imprime direto)
    if (type === 'inventory-report') { 
        if(typeof imprimirRelatorioEstoque === 'function') imprimirRelatorioEstoque();
        return; 
    }

    // 1. Verifica Dropdown de período
    const periodElem = document.getElementById("pdf-period");
    const periodValue = periodElem ? periodElem.value : "30"; 

    const gerar = (inicio, fim) => {
        if (type === 'sales-report' || type === 'detailed-sales' || type === 'profit-report') {
            generateProfessionalPDF(inicio, fim);
        }
    };

    // 2. Lógica de Decisão
    if (periodValue === "custom") {
        window.customPrompt("Data Inicial", "Digite o início (DD/MM/AAAA):", (startInput) => {
            if(!startInput) return;
            
            window.customPrompt("Data Final", "Digite o fim (DD/MM/AAAA):", (endInput) => {
                if(!endInput) return;
                gerar(startInput, endInput);
            }, "", "text");
            
            setTimeout(() => {
                const inp = document.getElementById('prompt-input');
                if(inp) inp.oninput = function() { mascaraData(this); };
            }, 100);

        }, "", "text");

        setTimeout(() => {
            const inp = document.getElementById('prompt-input');
            if(inp) inp.oninput = function() { mascaraData(this); };
        }, 100);

    } else {
        const days = parseInt(periodValue) || 30;
        const end = new Date(); 
        const start = new Date();
        start.setDate(end.getDate() - days); 
        gerar(start, end);
    }
}

// Relatório de Estoque
export function imprimirRelatorioEstoque() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const products = window.products || [];

    if (products.length === 0) { alert("Estoque vazio."); return; }

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

// Relatório de Lucros
export function imprimirRelatorioLucro(startDate, endDate) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const salesHistory = window.salesHistory || [];
    const products = window.products || [];

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

// Relatório Simples de Vendas
export function imprimirRelatorioVendas(startDate, endDate) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const salesHistory = window.salesHistory || [];

    const vendasFiltradas = salesHistory.filter(venda => {
        const d = converterDataNaMarra(venda.timestamp || venda.date || venda.data);
        return d && d >= startDate && d <= endDate;
    });

    if (vendasFiltradas.length === 0) { alert("Nenhuma venda no período."); return; }

    const totalGeral = vendasFiltradas.reduce((acc, v) => acc + (parseFloat(v.total)||0), 0);
    const qtdVendas = vendasFiltradas.length;
    const ticketMedio = totalGeral / qtdVendas;
    const maiorVenda = Math.max(...vendasFiltradas.map(v => parseFloat(v.total)||0));

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

    const rows = vendasFiltradas.map(v => {
        let dataHoraVisual = "-";
        if(v.timestamp) {
             const d = new Date(v.timestamp);
             if(!isNaN(d)) dataHoraVisual = d.toLocaleString("pt-BR").slice(0, 16);
        }
        const idVisivel = v.id ? String(v.id).slice(-6) : "---";
        
        return [
            idVisivel,
            dataHoraVisual, 
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
        }
    });

    doc.save(`Relatorio_Vendas_${new Date().toISOString().slice(0,10)}.pdf`);
}

// Relatório Profissional (CEO)
export function generateProfessionalPDF(startDateInput, endDateInput) {
    if (typeof window.jspdf === 'undefined') {
        showToast("Erro: Biblioteca PDF não carregada.", "error");
        return;
    }

    let startDate = converterDataNaMarra(startDateInput);
    let endDate = converterDataNaMarra(endDateInput);

    if (!startDate || !endDate) {
        showToast("Datas inválidas fornecidas.", "error");
        return;
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const salesHistory = window.salesHistory || [];
    const products = window.products || [];

    const vendasFiltradas = salesHistory.filter(venda => {
        const dataVenda = converterDataNaMarra(venda.timestamp || venda.date);
        return dataVenda && dataVenda >= startDate && dataVenda <= endDate;
    });

    if (vendasFiltradas.length === 0) {
        showToast("Nenhuma venda encontrada no período.", "info");
        return;
    }

    let totalFaturamento = 0;
    let totalLucro = 0;
    let totalItensVendidos = 0;
    
    vendasFiltradas.forEach(venda => {
        totalFaturamento += venda.total || 0;
        
        if (venda.items) {
            venda.items.forEach(item => {
                totalItensVendidos += item.quantity || 0;
                const custo = item.custo || 0;
                const preco = item.preco || 0;
                totalLucro += (preco - custo) * (item.quantity || 0);
            });
        }
    });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFillColor(44, 62, 80);
    doc.rect(0, 0, 210, 297, 'F');
    doc.setFontSize(28);
    doc.setTextColor(255, 255, 255);
    doc.text("RELATÓRIO", 105, 50, { align: "center" });
    
    doc.setFontSize(14);
    doc.setTextColor(180, 180, 180);
    doc.text(`Período: ${startDate.toLocaleDateString("pt-BR")} à ${endDate.toLocaleDateString("pt-BR")}`, 105, 100, { align: "center" });
    
    doc.setFillColor(52, 152, 219, 0.2); 
    doc.roundedRect(30, 130, 150, 50, 5, 5, 'F');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text("VISÃO EXECUTIVA", 105, 145, { align: "center" });
    doc.setFontSize(12);
    doc.text(`R$ ${totalFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`, 105, 165, { align: "center" });

    doc.addPage();
    doc.setFillColor(44, 62, 80);
    doc.rect(0, 0, 210, 25, 'F');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text("DETALHAMENTO DE VENDAS", 105, 16, { align: "center" });

    const tableData = vendasFiltradas.map(venda => {
        const data = converterDataNaMarra(venda.timestamp || venda.date);
        return [
            venda.id ? `#${venda.id.slice(-4)}` : "N/A",
            data ? data.toLocaleDateString("pt-BR") : "-",
            (venda.client || "Consumidor Final").substring(0, 25),
            venda.payment || "-",
            venda.items ? venda.items.length : 0,
            `R$ ${(venda.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ];
    });

    doc.autoTable({
        startY: 30,
        head: [['ID', 'Data', 'Cliente', 'Pagamento', 'Itens', 'Valor']],
        body: tableData,
        theme: 'striped'
    });

    const dataInicioStr = startDate.toISOString().split('T')[0];
    const dataFimStr = endDate.toISOString().split('T')[0];
    const nomeArquivo = `Relatorio_CEO_${dataInicioStr}_a_${dataFimStr}.pdf`;
    doc.save(nomeArquivo);
    
    showToast("Relatório gerado com sucesso!", "success");
}

// Gerar Nota Fiscal PDF
export function imprimirNotaPDF(id) {
    const inputHistory = window.inputHistory || [];
    const nota = inputHistory.find(n => n.id === id);
    if (!nota) return;
    
    const listaItens = nota.items || nota.itens || [];
    if (listaItens.length === 0) {
        return alert("Erro: Esta nota não possui itens registrados corretamente.");
    }

    if (!window.jspdf) return alert("Erro: Biblioteca PDF não carregada.");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("DANFE - ENTRADA", 15, 18);
    doc.setFontSize(8);
    doc.text(`Nº ${nota.numero || ''}  SÉRIE ${nota.serie || ''}`, 15, 25);
    doc.text(`Fornecedor: ${nota.fornecedor || ""}`, 15, 30);
    doc.text(`CNPJ: ${nota.cnpj || ''}`, 15, 35);

    const columns = [
        { header: 'CÓD', dataKey: 'cod' },
        { header: 'DESCRIÇÃO', dataKey: 'desc' },
        { header: 'QTD', dataKey: 'qtd' },
        { header: 'V.UNIT', dataKey: 'vun' },
        { header: 'V.TOTAL', dataKey: 'vtot' }
    ];

    const rows = listaItens.map(i => ({
        cod: (i.cProd || i.ean || "").substring(0, 10),
        desc: (i.nome || "").substring(0, 38), 
        qtd: parseFloat(i.qtd || 0).toFixed(2),
        vun: fmtMoeda(i.valorUnit),
        vtot: fmtMoeda(i.total)
    }));

    doc.autoTable({
        startY: 40,
        columns: columns,
        body: rows,
        theme: 'plain'
    });

    doc.save(`DANFE_${nota.numero || 'SN'}.pdf`);
}

export function imprimirTabelaDespesas() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Relatório de Despesas", 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 28);

    const rows = [];
    // Pega direto do HTML para respeitar o filtro atual
    const trs = document.querySelectorAll("#expenses-table tbody tr");
    
    trs.forEach(tr => {
        const tds = tr.querySelectorAll("td");
        if(tds.length > 3) {
            rows.push([
                tds[0].innerText, // Data
                tds[1].innerText, // Descrição
                tds[2].innerText, // Categoria
                tds[3].innerText  // Valor
            ]);
        }
    });

    doc.autoTable({
        startY: 35,
        head: [['Data', 'Descrição', 'Categoria', 'Valor']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [255, 69, 58] } 
    });

    doc.save("Despesas.pdf");
}