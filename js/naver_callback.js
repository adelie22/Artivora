import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-functions.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAlTLBVjuX2ZCNc0YpledcsJrIKXtQYYHI",
    authDomain: "artivora-90c86.firebaseapp.com",
    projectId: "artivora-90c86",
    storageBucket: "artivora-90c86.firebasestorage.app",
    messagingSenderId: "24756185840",
    appId: "1:24756185840:web:22a38e71fcd77864e83035",
    measurementId: "G-Y7XW70D54E"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app);

// This function runs in the popup window
async function handleNaverRedirect() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (code) {
        try {
            const naverLogin = httpsCallable(functions, 'naverLogin');
            const result = await naverLogin({ code, state });
            const customToken = result.data.token;
            
            // Use the custom token to sign in
            await signInWithCustomToken(auth, customToken);
            
            // Send a message to the main window that login was successful
            window.opener.postMessage('naver-login-success', window.location.origin);
            window.close(); // Close the popup

        } catch (error) {
            console.error("Naver custom login failed", error);
            window.opener.postMessage('naver-login-error', window.location.origin);
            window.close();
        }
    }
}

handleNaverRedirect();
