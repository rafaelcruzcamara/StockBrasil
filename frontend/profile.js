// =================================================================
// 1. IMPORTAÇÕES E CONFIGURAÇÕES FIREBASE
// =================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, updateDoc, doc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";


const firebaseConfig = {
  apiKey: "AIzaSyBYHAyzwUgvRJ_AP9ZV9MMrtpPb3s3ENIc", // Use a sua chave
  authDomain: "stockbrasil-e06ff.firebaseapp.com",
  projectId: "stockbrasil-e06ff",
  storageBucket: "stockbrasil-e06ff.firebasestorage.app",
  messagingSenderId: "796401246692",
  appId: "1:796401246692:web:1570c40124165fcef227f1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);


// =================================================================
// 2. UTILITÁRIOS (TOAST E REDIRECIONAMENTO)
// =================================================================

// Simples sistema de notificação Toast (pois o customAlert pode não estar no HTML)
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return alert(message);

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Redireciona de volta ao dashboard
function goToDashboard() {
    window.location.href = 'index.html';
}

// =================================================================
// 3. LÓGICA DE CARREGAMENTO (AO ABRIR A PÁGINA)
// =================================================================

async function loadProfileData(user) {
    const emailEl = document.getElementById('profile-email');
    const nameInput = document.getElementById('profile-name');
    
    // Preenche o campo de email (que é desativado)
    if (emailEl) emailEl.value = user.email;

    try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const dados = docSnap.data();
            // Preenche o campo de Nome/Empresa com o que estiver salvo
            if (nameInput) {
                nameInput.value = dados.businessName || dados.nome || "";
            }
        }
    } catch (error) {
        console.error("Erro ao carregar dados do perfil:", error);
    }
}

// =================================================================
// 4. LÓGICA DE SALVAR DADOS PESSOAIS (FUNÇÃO QUE ESTAVA FALTANDO)
// =================================================================

// Substitua handleProfileSave no profile.js
async function handleProfileSave(event) {
    event.preventDefault(); // IMPEDE o envio tradicional da página

    const user = auth.currentUser;
    if (!user) return showToast("Sessão expirada. Faça login novamente.", "error");

    const nomeInput = document.getElementById("profile-name");
    const novoNome = nomeInput ? nomeInput.value.trim() : null;
    
    // Adicione esta linha: verifica se o input de empresa está sendo pego corretamente
    const empresaInput = document.getElementById("profile-business"); 
    const novaEmpresa = empresaInput ? empresaInput.value.trim() : "";

    if (!novoNome) return showToast("O nome não pode ficar vazio.", "info");

    try {
        // 1. Atualiza no Firebase (Firestore)
        const userRef = doc(db, "users", user.uid);
        
        await updateDoc(userRef, {
            nome: novoNome,
            businessName: novaEmpresa 
        });

        // 2. Atualiza a Sidebar Imediatamente (Função Visual)
        const sidebarNameEl = document.getElementById("sidebar-user-name");
        if (sidebarNameEl) {
            const nomeParaExibir = novaEmpresa || novoNome;
            sidebarNameEl.textContent = nomeParaExibir;
            sidebarNameEl.style.color = "#30D158"; // Cor verde
            setTimeout(() => { sidebarNameEl.style.color = ""; }, 1500);
        }

        showToast("Perfil atualizado com sucesso!", "success");

    } catch (error) {
        console.error("Erro ao salvar perfil:", error);
        
        if (error.message.includes("No document to update")) {
             // Se o documento não existir, ele tenta criar (Solução de segurança)
             await setDoc(doc(db, "users", user.uid), {
                email: user.email,
                nome: novoNome,
                businessName: novaEmpresa
            });
            showToast("Perfil criado com sucesso!", "success");
        } else {
             showToast("Erro ao salvar alterações: " + error.message, "error");
        }
    }
}

// =================================================================
// 5. LÓGICA DE ALTERAR SENHA (MAIS COMPLEXA)
// =================================================================

async function handlePasswordUpdate(event) {
    event.preventDefault();

    const user = auth.currentUser;
    if (!user) return showToast("Sessão expirada. Faça login novamente.", "error");

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword !== confirmPassword) {
        return showToast("A nova senha e a confirmação não coincidem.", "error");
    }
    if (newPassword.length < 6) {
        return showToast("A senha deve ter no mínimo 6 caracteres.", "error");
    }

    try {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        
        // 1. Re-autentica o usuário (Segurança: obrigatório para mudar a senha)
        await reauthenticateWithCredential(user, credential);
        
        // 2. Atualiza a senha
        await updatePassword(user, newPassword);

        // 3. Limpa o formulário e avisa
        document.getElementById('security-form').reset();
        showToast("Senha atualizada com sucesso!", "success");

    } catch (error) {
        console.error("Erro ao mudar senha:", error);
        
        let msg = "Erro ao atualizar senha.";
        if (error.code === 'auth/wrong-password') {
            msg = "Senha atual incorreta.";
        } else if (error.code === 'auth/weak-password') {
            msg = "Nova senha muito fraca.";
        }
        showToast(msg, "error");
    }
}

// =================================================================
// 6. INICIALIZAÇÃO E EXPOSIÇÃO GLOBAL
// =================================================================

// Lógica principal: Verifica o login
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Usuário carregado:", user.email);
        loadProfileData(user);
    } else {
        // Se não houver usuário logado, redireciona para a tela de login (auth.html)
        window.location.href = 'auth.html';
    }
});

// FUNÇÕES DE EXPOSIÇÃO (CORRIGE O ReferenceError)
// O HTML PRECISA DESSAS FUNÇÕES GLOBAIS PARA QUE O onclick FUNCIONE
window.saveUserProfile = handleProfileSave; // Conecta o onclick com a função JS
window.updatePassword = handlePasswordUpdate;
window.logout = () => signOut(auth).then(() => window.location.href = 'auth.html');


// 7. CONECTA OS FORMULÁRIOS
document.addEventListener('DOMContentLoaded', () => {
    const profileForm = document.getElementById('profile-form');
    const securityForm = document.getElementById('security-form');

    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileSave);
    }
    
    if (securityForm) {
        securityForm.addEventListener('submit', handlePasswordUpdate);
    }
    
    // Conecta o botão de retorno ao Dashboard
    const navDashboard = document.querySelector('.nav-link[href="index.html"]');
    if (navDashboard) {
        navDashboard.addEventListener('click', (e) => {
            e.preventDefault();
            goToDashboard();
        });
    }
});