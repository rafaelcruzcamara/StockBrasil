// js/utils.js

// 1. Loading e Botões
export function setBtnLoading(btn, isLoading) {
    if (!btn) return;
    if (isLoading) {
        if (!btn.dataset.originalText) btn.dataset.originalText = btn.innerHTML;
        btn.classList.add('loading');
        btn.disabled = true;
    } else {
        btn.classList.remove('loading');
        btn.disabled = false;
        if (btn.dataset.originalText) btn.innerHTML = btn.dataset.originalText;
    }
}

export function showLoadingScreen(message = "Processando...", submessage = "Aguarde...") {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text" id="loading-text">${message}</div>
            <div class="loading-subtext" id="loading-subtext">${submessage}</div>
        `;
        document.body.appendChild(overlay);
    } else {
        const txt = document.getElementById('loading-text');
        const sub = document.getElementById('loading-subtext');
        if (txt) txt.textContent = message;
        if (sub) sub.textContent = submessage;
    }
}

export function updateLoadingMessage(message, submessage = "") {
    const txt = document.getElementById('loading-text');
    const sub = document.getElementById('loading-subtext');
    if (txt) txt.textContent = message;
    if (sub) sub.textContent = submessage;
}

export function hideLoadingScreen() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
    }
}

// 2. Notificações (Toasts)
export function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-check-circle';
    if (type === 'error') iconClass = 'fa-times-circle';
    
    toast.innerHTML = `<i class="fas ${iconClass}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hide'); 
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3500);
}

// 3. Máscaras
export function mascaraCpfCnpj(i) {
    let v = i.value.replace(/\D/g, "");
    if (v.length <= 11) { 
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else { 
        v = v.replace(/^(\d{2})(\d)/, "$1.$2");
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
        v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
        v = v.replace(/(\d{4})(\d)/, "$1-$2");
    }
    i.value = v;
}

export function mascaraCnpj(i) {
    let v = i.value.replace(/\D/g, "");
    v = v.replace(/^(\d{2})(\d)/, "$1.$2");
    v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
    v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
    v = v.replace(/(\d{4})(\d)/, "$1-$2");
    i.value = v;
}

export function mascaraTelefone(i) {
    let v = i.value.replace(/\D/g, "");
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    v = v.replace(/(\d)(\d{4})$/, "$1-$2");
    i.value = v;
}

export function mascaraData(input) {
    let v = input.value.replace(/\D/g, "");
    if (v.length > 2) v = v.replace(/^(\d{2})(\d)/, "$1/$2");
    if (v.length > 5) v = v.replace(/^(\d{2})\/(\d{2})(\d)/, "$1/$2/$3");
    input.value = v.substring(0, 10);
}

// 4. Conversores
export function fmtMoeda(val) {
    return parseFloat(val || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

export function parseDataSegura(input) {
    if (!input) return null;
    if (input instanceof Date && !isNaN(input.getTime())) return input;
    if (typeof input === 'string') {
        if (input.includes('/')) {
            const partes = input.split(' ')[0].split('/');
            if (partes.length === 3) {
                return new Date(partes[2], partes[1] - 1, partes[0], 12, 0, 0);
            }
        }
        const d = new Date(input);
        if (!isNaN(d.getTime())) return d;
    }
    return null;
}

export function converterDataNaMarra(input) {
    return parseDataSegura(input); 
}