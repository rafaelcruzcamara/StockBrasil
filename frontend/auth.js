import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBYHAyzwUgvRJ_AP9ZV9MMrtpPb3s3ENIc",
  authDomain: "stockbrasil-e06ff.firebaseapp.com",
  projectId: "stockbrasil-e06ff",
  storageBucket: "stockbrasil-e06ff.firebasestorage.app",
  messagingSenderId: "796401246692",
  appId: "1:796401246692:web:1570c40124165fcef227f1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// --- FUNÇÃO PARA MOSTRAR A MENSAGEM BONITA ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-info-circle';
    if(type === 'error') icon = 'fa-times-circle';
    if(type === 'success') icon = 'fa-check-circle';

    toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    container.appendChild(toast);

    // Remove após 4 segundos
    setTimeout(() => {
        toast.style.animation = "fadeOut 0.5s forwards";
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

// --- LOGIN ---
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // IMPEDE A PÁGINA DE RECARREGAR
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const btn = loginForm.querySelector('button');
        const originalText = btn.innerText;

        try {
            btn.disabled = true;
            btn.innerText = "Verificando...";

            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            
            showToast("Login realizado com sucesso!", "success");
            sessionStorage.setItem("usuario_logado", "true");
            
            setTimeout(() => window.location.href = "index.html", 1500);

        } catch (error) {
            console.error(error.code);
            let msg = "Erro ao entrar.";
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                msg = "E-mail ou senha incorretos.";
            } else if (error.code === 'auth/too-many-requests') {
                msg = "Muitas tentativas. Aguarde um pouco.";
            }
            
            showToast(msg, "error");
            btn.disabled = false;
            btn.innerText = originalText;
        }
    });
}

// --- CADASTRO ---
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // IMPEDE A PÁGINA DE RECARREGAR
        
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const name = document.getElementById('register-name').value;
        const btn = registerForm.querySelector('button');
        const originalText = btn.innerText;

        if(password.length < 6) {
            showToast("A senha precisa ter no mínimo 6 caracteres.", "error");
            return;
        }

        try {
            btn.disabled = true;
            btn.innerText = "Criando conta...";

            await createUserWithEmailAndPassword(auth, email, password);
            
            showToast(`Bem-vindo(a), ${name}!`, "success");
            sessionStorage.setItem("usuario_logado", "true");

            setTimeout(() => window.location.href = "index.html", 1500);

        } catch (error) {
            console.error(error.code);
            let msg = "Erro ao criar conta.";
            if (error.code === 'auth/email-already-in-use') msg = "Este e-mail já está em uso.";
            
            showToast(msg, "error");
            btn.disabled = false;
            btn.innerText = originalText;
        }
    });
}