import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider,
    OAuthProvider,
    FacebookAuthProvider,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- SUAS CONFIGURAÇÕES ---
const firebaseConfig = {
  apiKey: "AIzaSyBYHAyzwUgvRJ_AP9ZV9MMrtpPb3s3ENIc",
  authDomain: "stockbrasil-e06ff.firebaseapp.com",
  projectId: "stockbrasil-e06ff",
  storageBucket: "stockbrasil-e06ff.firebasestorage.app",
  messagingSenderId: "796401246692",
  appId: "1:796401246692:web:1570c40124165fcef227f1"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// =================================================================
// 1. SISTEMA DE TOAST (NOTIFICAÇÕES BONITAS)
// =================================================================
function showToast(message, type = 'error') {
    const container = document.getElementById('toast-container');
    if (!container) return; // Segurança caso o HTML não tenha o container

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Ícone baseado no tipo
    const icon = type === 'success' ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-exclamation-triangle"></i>';
    
    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);

    // Remove após 4 segundos
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}


// =================================================================
// 2. LOGIN COM GOOGLE
// =================================================================
async function handleGoogleLogin() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        
        // Verifica se o usuário já existe no banco
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            await setDoc(doc(db, "users", user.uid), {
                businessName: user.displayName,
                email: user.email,
                createdAt: new Date().toISOString(),
                photoURL: user.photoURL
            });
        }

        showToast("Login com Google realizado!", "success");
        setTimeout(() => window.location.href = "index.html", 1000);

    } catch (error) {
        console.error("Erro Google:", error);
        if (error.code === 'auth/popup-closed-by-user') return;
        if (error.code === 'auth/unauthorized-domain') {
            showToast("Domínio não autorizado no Firebase. Configure no Console.", "error");
        } else {
            showToast("Erro ao entrar com Google: " + error.message, "error");
        }
    }
}

// =================================================================
// 3. LOGIN COM EMAIL E SENHA
// =================================================================
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const btn = loginForm.querySelector('button');

        try {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
            btn.disabled = true;
            
            await signInWithEmailAndPassword(auth, email, password);
            
            showToast("Login realizado com sucesso!", "success");
            setTimeout(() => window.location.href = "index.html", 1000);

        } catch (error) {
            btn.innerHTML = 'Entrar';
            btn.disabled = false;
            console.error(error.code);

            // Tratamento de erros específicos
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                showToast("E-mail ou senha incorretos.", "error");
            } else if (error.code === 'auth/too-many-requests') {
                showToast("Muitas tentativas. Aguarde um momento.", "error");
            } else {
                showToast("Erro ao entrar: " + error.message, "error");
            }
        }
    });
}

// =================================================================
// 4. CADASTRO COM EMAIL E SENHA
// =================================================================
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const btn = registerForm.querySelector('button');

        if(password.length < 6) {
            showToast("A senha deve ter pelo menos 6 caracteres.", "error");
            return;
        }

        try {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando...';
            btn.disabled = true;
            
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Salva nome do negócio no banco
            await setDoc(doc(db, "users", user.uid), {
                businessName: name,
                email: email,
                createdAt: new Date().toISOString()
            });

            showToast("Conta criada com sucesso!", "success");
            setTimeout(() => window.location.href = "index.html", 1500);

        } catch (error) {
            btn.innerHTML = 'Cadastrar';
            btn.disabled = false;
            console.error(error);
            
            if (error.code === 'auth/email-already-in-use') {
                showToast("Este e-mail já está cadastrado.", "error");
            } else if (error.code === 'auth/invalid-email') {
                showToast("E-mail inválido.", "error");
            } else {
                showToast("Erro ao cadastrar: " + error.message, "error");
            }
        }
    });
}

// Exporta para o HTML
window.handleGoogleLogin = handleGoogleLogin;

// =================================================================
// 5. RECUPERAÇÃO DE SENHA
// =================================================================

// Abre o Modal
function openResetModal() {
    document.getElementById('reset-modal').style.display = 'flex';
    // Tenta preencher com o email que já estava digitado no login
    const emailLogin = document.getElementById('login-email').value;
    if(emailLogin) document.getElementById('reset-email-input').value = emailLogin;
}

// Fecha o Modal
function closeResetModal() {
    document.getElementById('reset-modal').style.display = 'none';
}

// Envia o E-mail
async function handlePasswordReset() {
    const email = document.getElementById('reset-email-input').value;
    
    if(!email) {
        showToast("Digite seu e-mail.", "error");
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        showToast("Link enviado! Verifique seu e-mail.", "success");
        closeResetModal();
    } catch (error) {
        console.error(error);
        if (error.code === 'auth/user-not-found') {
            showToast("E-mail não cadastrado.", "error");
        } else if (error.code === 'auth/invalid-email') {
            showToast("E-mail inválido.", "error");
        } else {
            showToast("Erro ao enviar: " + error.message, "error");
        }
    }
}

// EXPORTA AS FUNÇÕES PARA O HTML
window.openResetModal = openResetModal;
window.closeResetModal = closeResetModal;
window.handlePasswordReset = handlePasswordReset;