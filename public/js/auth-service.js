import { auth, db, collection, doc, signOut } from './firebase-config.js';

export function getUserCollectionRef(collectionName) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("Usuário não autenticado.");
    }
    return collection(db, "users", user.uid, collectionName);
}

export function getUserDocumentRef(collectionName, documentId) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("Usuário não autenticado.");
    }
    return doc(db, "users", user.uid, collectionName, documentId);
}

export async function logoutSystem() {
    try {
        await signOut(auth);
        window.location.href = "auth.html";
    } catch (error) {
        console.error(error);
    }
}