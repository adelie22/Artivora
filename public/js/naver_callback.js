// js/naver_callback.js


import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
// 1. connectAuthEmulator를 import 목록에 추가합니다.
import { getAuth, signInWithCustomToken, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFunctions, connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-functions.js";

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

// 로컬 환경에서만 에뮬레이터에 연결하도록 설정합니다.
if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    // 2. Auth 에뮬레이터 연결 코드를 여기에 추가합니다.
    connectAuthEmulator(auth, "http://127.0.0.1:9099");
}

// 함수 URL을 동적으로 결정하는 함수
const getNaverLoginUrl = () => {
    if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
        // 로컬 에뮬레이터 환경
        // 'asia-northeast3'를 Firebase 기본값인 'us-central1'으로 수정합니다.
        return 'http://127.0.0.1:5001/artivora-90c86/us-central1/naverLogin';
    } else {
        // 배포된 실제 환경 (여기도 일관성을 위해 us-central1로 맞추거나,
        // 나중에 asia-northeast3로 배포한다면 그에 맞게 수정해야 합니다.)
        return 'https://us-central1-artivora-90c86.cloudfunctions.net/naverLogin';
    }
};

async function handleNaverRedirect() {
    const statusP = document.getElementById('status');
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (!code) {
        const error = params.get('error');
        const errorDescription = params.get('error_description');
        statusP.textContent = `오류가 발생했습니다: ${errorDescription || error}`;
        window.opener.postMessage({ status: 'error', message: `네이버 인증 실패: ${errorDescription || error}` }, window.location.origin);
        return;
    }

    try {
        statusP.textContent = "Firebase와 통신 중입니다...";
        
        // httpsCallable 대신 fetch를 사용
        const response = await fetch(getNaverLoginUrl(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data: { code, state } }), // onCall과 동일한 형식으로 body 구성
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error.message || '서버 응답 오류가 발생했습니다.');
        }

        const result = await response.json();
        const customToken = result.data.token;
        
        if (!customToken) {
            throw new Error("서버로부터 유효한 토큰을 받지 못했습니다.");
        }

        statusP.textContent = "Firebase에 로그인 중입니다...";
        await signInWithCustomToken(auth, customToken);
        
        window.opener.postMessage({ status: 'success' }, window.location.origin);
        window.close();

    } catch (error) {
        console.error("Naver custom login failed", error);
        statusP.textContent = `로그인에 실패했습니다: ${error.message}`;
        window.opener.postMessage({ status: 'error', message: error.message }, window.location.origin);
        setTimeout(() => window.close(), 3000); // 3초 후 창 닫기
    }
}

handleNaverRedirect();