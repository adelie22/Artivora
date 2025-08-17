// Import functions from the Firebase SDK
import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged,
    createUserWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider, 
    FacebookAuthProvider,
    signOut,
    signInWithCustomToken
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc,
    getDoc,
    onSnapshot,
    enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-functions.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

// Enable Firestore Offline Persistence
enableIndexedDbPersistence(db)
  .catch((err) => {
      if (err.code == 'failed-precondition') {
          console.warn('Firestore persistence failed: multiple tabs open.');
      } else if (err.code == 'unimplemented') {
          console.warn('Firestore persistence not available in this browser.');
      }
  });


// --- UI Elements ---
const navLoggedOutCenter = document.getElementById('nav-logged-out-center');
const navLoggedOutRight = document.getElementById('nav-logged-out-right');
const navLoggedIn = document.getElementById('nav-logged-in');
const userEmailEl = document.getElementById('user-email');
const creditCountEl = document.getElementById('credit-count');
const logoutBtn = document.getElementById('logout-btn');

// --- Auth State Observer ---
onAuthStateChanged(auth, user => {
    if (user) {
        // User is signed in
        navLoggedOutCenter.classList.add('hidden');
        navLoggedOutRight.classList.add('hidden');
        navLoggedIn.classList.remove('hidden');
        userEmailEl.textContent = user.email || user.displayName;

        // Get user's credit data from Firestore
        const userDocRef = doc(db, "users", user.uid);
        onSnapshot(userDocRef, (doc) => {
            if (doc.exists()) {
                creditCountEl.textContent = doc.data().credits;
            } else {
                creditCountEl.textContent = 0;
            }
        });

    } else {
        // User is signed out
        navLoggedOutCenter.classList.remove('hidden');
        navLoggedOutRight.classList.remove('hidden');
        navLoggedIn.classList.add('hidden');
        userEmailEl.textContent = '';
        creditCountEl.textContent = '0';
    }
});


// --- Page Navigation & Header Scroll Logic ---
const pageContent = document.querySelector('.page-content');
const header = document.querySelector('header');

pageContent.addEventListener('scroll', () => {
    if (pageContent.scrollTop > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

const navLinks = document.querySelectorAll('.sidebar-nav a[data-target], .logo[data-target]');
const mainPageContent = document.querySelector('#main-page-content');
const musicBrowser = document.querySelector('#music-browser');
const photosBrowser = document.querySelector('#photos-browser');

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('data-target');

        // Hide all major sections first
        mainPageContent.classList.remove('active');
        musicBrowser.classList.remove('active');
        photosBrowser.classList.remove('active');

        if (targetId === 'music-browser') {
            musicBrowser.classList.add('active');
        } else if (targetId === 'photos-browser') {
            photosBrowser.classList.add('active');
        } else {
            mainPageContent.classList.add('active');
            pageContent.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
});


// --- Signup Modal Logic ---
const signupTriggers = document.querySelectorAll('.signup-trigger');
const modalOverlay = document.getElementById('signup-modal');
const closeModalBtn = document.querySelector('.close-modal-btn');

signupTriggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
        modalOverlay.classList.add('active');
    });
});

closeModalBtn.addEventListener('click', () => {
    modalOverlay.classList.remove('active');
});

modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
        modalOverlay.classList.remove('active');
    }
});

// --- Firebase Auth Logic ---
const modalForm = document.querySelector('#signup-modal form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const googleLoginBtn = document.querySelector('.social-btn.google');
const facebookLoginBtn = document.querySelector('.social-btn.facebook');
const naverLoginBtn = document.querySelector('.social-btn.naver');
const kakaoLoginBtn = document.querySelector('.social-btn.kakao');

// Email/Password Signup
modalForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;

    createUserWithEmailAndPassword(auth, email, password)
        .then(async (userCredential) => {
            console.log('회원가입 성공:', userCredential.user);
            // Create user document in Firestore with 0 credits
            const userDocRef = doc(db, "users", userCredential.user.uid);
            await setDoc(userDocRef, {
                email: userCredential.user.email,
                credits: 0 
            });
            alert('회원가입에 성공했습니다!');
            modalOverlay.classList.remove('active');
        })
        .catch((error) => {
            console.error('회원가입 오류:', error);
            alert('오류가 발생했습니다: ' + error.message);
        });
});

// Social Login
const handleSocialLogin = (provider) => {
    signInWithPopup(auth, provider)
        .then(async (result) => {
            const user = result.user;
            console.log('소셜 로그인 성공:', user);
            
            const userDocRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(userDocRef);

            if (!docSnap.exists()) {
                await setDoc(userDocRef, {
                    email: user.email,
                    displayName: user.displayName,
                    credits: 5
                });
                alert('가입을 환영합니다! 5 크레딧이 지급되었습니다.');
            } else {
                alert('다시 오신 것을 환영합니다!');
            }
            
            modalOverlay.classList.remove('active');
        })
        .catch((error) => {
            console.error('소셜 로그인 오류:', error);
            alert('오류가 발생했습니다: ' + error.message);
        });
};

googleLoginBtn.addEventListener('click', () => handleSocialLogin(new GoogleAuthProvider()));
facebookLoginBtn.addEventListener('click', () => handleSocialLogin(new FacebookAuthProvider()));

// Naver Login (Popup Method)
naverLoginBtn.addEventListener('click', () => {
    const REDIRECT_URI = `${window.location.origin}/naver_callback.html`; 
    const NAVER_CLIENT_ID = "W4LjGnJ_ulte2VAy_pIu"; // Your Naver Client ID
    const state = "RANDOM_STATE"; // 보안을 위해 실제로는 랜덤 문자열을 생성해야 합니다.
    
    const url = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${NAVER_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&state=${state}`;
    
    window.open(url, "naverloginpop", "titlebar=1, resizable=1, scrollbars=yes, width=600, height=700");
});

// Listen for message from popup
window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) {
        return;
    }

    const { status, message } = event.data;

    if (status === 'success') {
        // onAuthStateChanged가 UI를 자동으로 업데이트합니다.
        alert('네이버 로그인에 성공했습니다!');
        modalOverlay.classList.remove('active');
    } else if (status === 'error') {
        alert(`네이버 로그인 중 오류가 발생했습니다: ${message}`);
    }
}, false);

kakaoLoginBtn.addEventListener('click', () => {
    alert('카카오 로그인은 현재 준비 중입니다. (백엔드 연동 필요)');
});


// Logout Logic
logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        console.log('로그아웃 성공');
    }).catch((error) => {
        console.error('로그아웃 오류:', error);
    });
});


// --- Music Player & Waveform Logic ---
let audioContext;
const audioData = new Map(); 

const styles = getComputedStyle(document.documentElement);
const waveformBg = styles.getPropertyValue('--waveform-bg').trim();
const waveformProgress = styles.getPropertyValue('--waveform-progress').trim();
const sampleAudioSrc = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

function setupAudioContext(audioElement) {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioData.has(audioElement)) return;
    
    const source = audioContext.createMediaElementSource(audioElement);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser).connect(audioContext.destination);
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    audioData.set(audioElement, { analyser, bufferLength, dataArray });
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

function drawWaveform(audioElement, canvas) {
    if (!audioData.has(audioElement) || !canvas) return;

    const { analyser, bufferLength, dataArray } = audioData.get(audioElement);
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    analyser.getByteFrequencyData(dataArray);
    ctx.clearRect(0, 0, width, height);

    const barWidth = (width / bufferLength) * 1.5;
    let x = 0;
    const progress = audioElement.currentTime / audioElement.duration;

    for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height;
        ctx.fillStyle = (x < width * progress) ? waveformProgress : waveformBg;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
    }

    if (!audioElement.paused) {
        requestAnimationFrame(() => drawWaveform(audioElement, canvas));
    }
}

// Combined player logic for both cards and track items
const allPlayers = document.querySelectorAll('.music-card, .track-item');

allPlayers.forEach(player => {
    const playButton = player.querySelector('.play-button');
    const playIcon = player.querySelector('.play-button i');
    const audio = player.querySelector('audio');
    const canvas = player.querySelector('.waveform');
    const waveformContainer = player.querySelector('.waveform-container');
    const currentTimeEl = player.querySelector('.current-time');
    const totalTimeEl = player.querySelector('.total-time');
    
    if (!audio.getAttribute('src')) {
        audio.src = sampleAudioSrc;
    }

    audio.addEventListener('loadedmetadata', () => {
        if(totalTimeEl) totalTimeEl.textContent = formatTime(audio.duration);
    });
    
    audio.addEventListener('timeupdate', () => {
        if(currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
        requestAnimationFrame(() => drawWaveform(audio, canvas));
    });

    const playButtonTarget = player.matches('.track-item') ? player.querySelector('.play-button') : playButton;

    playButtonTarget.addEventListener('click', (e) => {
        e.stopPropagation();
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
        if (!audioData.has(audio)) {
             setupAudioContext(audio);
        }

        const isPlaying = player.classList.contains('playing');

        allPlayers.forEach(otherPlayer => {
            if (otherPlayer !== player) {
                otherPlayer.classList.remove('playing');
                otherPlayer.querySelector('audio').pause();
                otherPlayer.querySelector('.play-button i').classList.replace('fa-pause', 'fa-play');
            }
        });
        
        if (isPlaying) {
            audio.pause();
        } else {
            audio.play().catch(e => console.error("Playback error:", e));
            requestAnimationFrame(() => drawWaveform(audio, canvas));
        }
        player.classList.toggle('playing');
        playIcon.classList.toggle('fa-play');
        playIcon.classList.toggle('fa-pause');
    });
    
    audio.addEventListener('ended', () => {
        player.classList.remove('playing');
        playIcon.classList.replace('fa-pause', 'fa-play');
        audio.currentTime = 0;
    });

    waveformContainer.addEventListener('click', (e) => {
        const rect = waveformContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        audio.currentTime = audio.duration * percentage;
    });
});