import { showToast, setBtnLoading, hideLoadingScreen, mascaraData } from './utils.js';
import { getUserCollectionRef, getUserDocumentRef } from './auth-service.js';
import { addDoc, updateDoc, deleteDoc, reauthenticateWithCredential, EmailAuthProvider } from './firebase-config.js';

// --- CLIENTES ---

export async function handleClientForm(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    setBtnLoading(btn, true);

    const id = document.getElementById('client-id').value;
    
    const data = {
        nome: document.getElementById('cliNome').value,
        tipo: document.getElementById('cliTipo').value,
        statusManual: document.getElementById('cliStatusManual').value,
        doc: document.getElementById('cliDoc').value,
        ie: document.getElementById('cliIe').value,
        nascimento: document.getElementById('cliNasc').value,
        email: document.getElementById('cliEmail').value,
        tel: document.getElementById('cliTel').value,
        cep: document.getElementById('cliCep').value,
        rua: document.getElementById('cliRua').value,
        num: document.getElementById('cliNum').value,
        bairro: document.getElementById('cliBairro').value,
        cidade: document.getElementById('cliCidade').value,
        uf: document.getElementById('cliUf').value,
        limite: document.getElementById('cliLimite').value,
        obs: document.getElementById('cliObs').value,
        timestamp: new Date().toISOString()
    };

    try {
        if (id) {
            await updateDoc(getUserDocumentRef("clients", id), data);
            showToast("Cliente atualizado!", "success");
        } else {
            await addDoc(getUserCollectionRef("clients"), data);
            showToast("Cliente cadastrado!", "success");
        }
        fecharModalCliente();
        // Recarrega se a função estiver disponível globalmente
        if(typeof window.loadPartnersData === 'function') await window.loadPartnersData();
        
    } catch (error) {
        console.error(error);
        showToast("Erro ao salvar: " + error.message, "error");
    } finally {
        setBtnLoading(btn, false);
    }
}

export function renderClientsTable() {
    const tbody = document.querySelector('#clientes-table tbody');
    if(!tbody) return;
    tbody.innerHTML = '';

    const lista = window.clientesReais || [];

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Nenhum cliente cadastrado.</td></tr>';
        return;
    }

    // Ordena alfabeticamente
    lista.sort((a,b) => a.nome.localeCompare(b.nome));

    lista.forEach(c => {
        // Cálculo simples de LTV (se houver histórico)
        let total = 0;
        if(window.salesHistory) {
            window.salesHistory.forEach(s => {
                if(s.client === c.nome) total += parseFloat(s.total)||0;
            });
        }

        const idLimpo = String(c.id);
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><span class="badge" style="background:#333; color:#aaa;">${c.statusManual || 'Ativo'}</span></td>
            <td>
                <div style="font-weight:bold; color:var(--color-text-primary);">${c.nome}</div>
                <div style="font-size:0.8rem; color:#888;">${c.doc || 'S/ Doc'}</div>
            </td>
            <td>
                <div style="font-size:0.85rem;">${c.tel || c.email || '-'}</div>
            </td>
            <td>
                <div style="font-weight:bold; color:var(--color-accent-green);">R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
            </td>
            <td>
                <div style="display:flex; gap:5px;">
                    <button class="action-btn edit-btn" onclick="editClient('${idLimpo}')"><i class="fas fa-pencil-alt"></i></button>
                    <button class="action-btn delete-btn" onclick="deletePartner('clients', '${idLimpo}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
    });
}

export function editClient(id) {
    const c = window.clientesReais.find(x => String(x.id) === String(id));
    if(!c) return showToast("Cliente não encontrado.", "error");

    const modal = document.getElementById('modal-form-cliente');
    if(!modal) return;

    modal.style.display = 'flex';
    document.getElementById('titulo-modal-cliente').innerHTML = '<i class="fas fa-user-edit"></i> Editar Cliente';
    
    const set = (eid, val) => { const el = document.getElementById(eid); if(el) el.value = val || ''; };

    set('client-id', c.id);
    set('cliNome', c.nome);
    set('cliTipo', c.tipo || 'PF');
    set('cliStatusManual', c.statusManual || 'Ativo');
    set('cliDoc', c.doc);
    set('cliIe', c.ie);
    set('cliNasc', c.nascimento);
    set('cliEmail', c.email);
    set('cliTel', c.tel);
    set('cliCep', c.cep);
    set('cliRua', c.rua);
    set('cliNum', c.num);
    set('cliBairro', c.bairro);
    set('cliCidade', c.cidade);
    set('cliUf', c.uf);
    set('cliLimite', c.limite);
    set('cliObs', c.obs);
}

export function clearClientForm() {
    document.getElementById('client-id').value = '';
    document.getElementById('cliNome').value = '';
    document.getElementById('cliDoc').value = '';
    document.getElementById('cliTel').value = '';
}

// --- FORNECEDORES ---

export async function handleSupplierForm(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    setBtnLoading(btn, true);

    const id = document.getElementById('supp-id').value;
    const data = {
        nome: document.getElementById('suppNome').value,
        fantasia: document.getElementById('suppFantasia').value,
        cnpj: document.getElementById('suppCnpj').value,
        ie: document.getElementById('suppIe').value,
        cep: document.getElementById('suppCep').value,
        rua: document.getElementById('suppRua').value,
        num: document.getElementById('suppNum').value,
        bairro: document.getElementById('suppBairro').value,
        cidade: document.getElementById('suppCidade').value,
        uf: document.getElementById('suppUf').value,
        contatoNome: document.getElementById('suppContatoNome').value,
        tel: document.getElementById('suppTel').value,
        email: document.getElementById('suppEmail').value,
        prazo: document.getElementById('suppPrazo').value,
        timestamp: new Date().toISOString()
    };

    try {
        if (id) {
            await updateDoc(getUserDocumentRef("suppliers", id), data);
            showToast("Fornecedor atualizado!", "success");
        } else {
            await addDoc(getUserCollectionRef("suppliers"), data);
            showToast("Fornecedor salvo!", "success");
        }
        fecharModalFornecedor();
        if(typeof window.loadPartnersData === 'function') await window.loadPartnersData();
    } catch (error) { 
        console.error(error); 
        showToast("Erro ao salvar.", "error"); 
    } finally { 
        setBtnLoading(btn, false); 
    }
}

export function renderSuppliersTable() {
    const tbody = document.querySelector('#fornecedores-table tbody');
    if(!tbody) return;
    tbody.innerHTML = '';

    const lista = window.fornecedoresReais || [];

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#888;">Nenhum fornecedor cadastrado.</td></tr>';
        return;
    }

    lista.forEach(f => {
        const idLimpo = String(f.id).trim();
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><span class="badge" style="background:rgba(48, 209, 88, 0.15); color:#30D158;">Ativo</span></td>
            <td>
                <strong style="color:var(--color-text-primary); font-size:0.95rem;">${f.nome}</strong>
                <div style="font-size:0.8rem; color:#888;">${f.cnpj || 'S/ CNPJ'}</div>
            </td>
            <td>${f.contatoNome || '-'}</td>
            <td>-</td>
            <td>
                <div style="display:flex; gap:5px;">
                    <button class="action-btn edit-btn" onclick="editSupplier('${idLimpo}')"><i class="fas fa-pencil-alt"></i></button>
                    <button class="action-btn delete-btn" onclick="deletePartner('suppliers', '${idLimpo}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
    });
}

export function editSupplier(id) {
    const s = window.fornecedoresReais.find(x => String(x.id) === String(id));
    if(!s) return;
    
    document.getElementById('modal-form-fornecedor').style.display = 'flex';
    const set = (eid, val) => { const el = document.getElementById(eid); if(el) el.value = val || ''; };

    set('supp-id', s.id);
    set('suppNome', s.nome);
    set('suppFantasia', s.fantasia);
    set('suppCnpj', s.cnpj);
    set('suppIe', s.ie);
    set('suppCep', s.cep);
    set('suppRua', s.rua);
    set('suppNum', s.num);
    set('suppBairro', s.bairro);
    set('suppCidade', s.cidade);
    set('suppUf', s.uf);
    set('suppContatoNome', s.contatoNome);
    set('suppTel', s.tel);
    set('suppEmail', s.email);
    set('suppPrazo', s.prazo);
}

export function clearSupplierForm() {
    document.getElementById('supp-id').value = '';
    document.getElementById('suppNome').value = '';
}

// --- EXCLUSÃO GENÉRICA ---

export async function deletePartner(collectionName, id) {
    window.customConfirm("Tem certeza que deseja excluir este registro?", async () => {
        window.customPrompt("Autorização", "Digite sua senha para confirmar:", async (senha) => {
            if (!senha) return;

            try {
                window.showLoadingScreen("Verificando...", "Autenticando...");
                const user = window.auth.currentUser;
                const credential = EmailAuthProvider.credential(user.email, senha);
                await reauthenticateWithCredential(user, credential);
                
                window.updateLoadingMessage("Excluindo...", "Removendo do Firebase...");
                await deleteDoc(getUserDocumentRef(collectionName, id));
                
                window.hideLoadingScreen();
                showToast("Excluído com sucesso!", "success");
                if(typeof window.loadPartnersData === 'function') await window.loadPartnersData();

            } catch (error) {
                window.hideLoadingScreen();
                showToast("Erro ao excluir (Senha incorreta?).", "error");
            }
        }, "", "password");
    });
}

// --- MODAIS ---

export function abrirModalCliente() {
    document.getElementById('client-id').value = ""; 
    document.querySelector('#modal-form-cliente form').reset();
    document.getElementById('titulo-modal-cliente').innerHTML = '<i class="fas fa-user-plus"></i> Novo Cliente';
    document.getElementById('modal-form-cliente').style.display = 'flex';
}

export function fecharModalCliente() {
    document.getElementById('modal-form-cliente').style.display = 'none';
}

export function abrirModalFornecedor() {
    document.getElementById('supp-id').value = "";
    document.querySelector('#modal-form-fornecedor form').reset();
    document.getElementById('titulo-modal-fornecedor').innerHTML = '<i class="fas fa-truck-loading"></i> Novo Fornecedor';
    document.getElementById('modal-form-fornecedor').style.display = 'flex';
}

export function fecharModalFornecedor() {
    document.getElementById('modal-form-fornecedor').style.display = 'none';
}