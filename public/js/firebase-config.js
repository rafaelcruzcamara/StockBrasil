import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged, 
    reauthenticateWithCredential, 
    EmailAuthProvider 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc, 
    setDoc, 
    getDoc,
    query,
    orderBy,
    limit,
    where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBYHAyzwUgvRJ_AP9ZV9MMrtpPb3s3ENIc",
  authDomain: "stockbrasil-e06ff.firebaseapp.com",
  projectId: "stockbrasil-e06ff",
  storageBucket: "stockbrasil-e06ff.firebasestorage.app",
  messagingSenderId: "796401246692",
  appId: "1:796401246692:web:1570c40124165fcef227f1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { 
    db, auth, 
    signInWithEmailAndPassword, signOut, onAuthStateChanged, reauthenticateWithCredential, EmailAuthProvider,
    collection, addDoc, getDocs, doc, updateDoc, deleteDoc, setDoc, getDoc,
    query, orderBy, limit, where
};