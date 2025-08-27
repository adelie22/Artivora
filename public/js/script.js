// Import functions from the Firebase SDK
import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, connectStorageEmulator } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";
import {
    getFirestore, doc, setDoc, getDoc, onSnapshot, enableIndexedDbPersistence,
    addDoc, collection, getDocs, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import {
    getAuth,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    FacebookAuthProvider,
    signOut
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-functions.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);
const storage = getStorage(app);

// 로컬 개발 환경일 경우 에뮬레이터에 연결
if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
    connectStorageEmulator(storage, "127.0.0.1", 9199);
}

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
const adminUploadBtn = document.getElementById('admin-upload-btn');


// --- Auth State Observer ---
onAuthStateChanged(auth, user => {
    if (user) {
        navLoggedOutCenter.classList.add('hidden');
        navLoggedOutRight.classList.add('hidden');
        navLoggedIn.classList.remove('hidden');
        userEmailEl.textContent = user.email || user.displayName;
        const userDocRef = doc(db, "users", user.uid);
        onSnapshot(userDocRef, (doc) => {
            if (doc.exists()) {
                creditCountEl.textContent = doc.data().credits;
                if (doc.data().role === 'admin') {
                    adminUploadBtn.classList.remove('hidden');
                } else {
                    adminUploadBtn.classList.add('hidden');
                }
            } else {
                creditCountEl.textContent = 0;
                adminUploadBtn.classList.add('hidden');
            }
        });
    } else {
        navLoggedOutCenter.classList.remove('hidden');
        navLoggedOutRight.classList.remove('hidden');
        navLoggedIn.classList.add('hidden');
        userEmailEl.textContent = '';
        creditCountEl.textContent = '0';
        adminUploadBtn.classList.add('hidden');
    }
});



// --- Page Navigation & Header Scroll Logic ---
const pageContent = document.querySelector('.page-content');
const header = document.querySelector('header');
pageContent.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', pageContent.scrollTop > 50);
});

const navLinks = document.querySelectorAll('.sidebar-nav a[data-target], .logo[data-target]');
const mainPageContent = document.querySelector('#main-page-content');
const musicBrowser = document.querySelector('#music-browser');
const photosBrowser = document.querySelector('#photos-browser');

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();

        // -> 1. 페이지 전환 시 재생 중인 모든 음악을 정지시키는 로직 추가
        if (currentlyPlaying) {
            currentlyPlaying.stop();
            currentlyPlaying = null;
        }

        const targetId = link.getAttribute('data-target');
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


// (이 아래 모달, 인증, 업로드 폼 로직 등은 이전과 동일합니다)
// --- Signup Modal, Auth, Upload Form Logic ---
const signupTriggers = document.querySelectorAll('.signup-trigger');
const modalOverlay = document.getElementById('signup-modal');
const closeModalBtn = document.querySelector('.close-modal-btn');
signupTriggers.forEach(trigger => trigger.addEventListener('click', () => modalOverlay.classList.add('active')));
closeModalBtn.addEventListener('click', () => modalOverlay.classList.remove('active'));
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) modalOverlay.classList.remove('active'); });
const modalForm = document.querySelector('#signup-modal form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const googleLoginBtn = document.querySelector('.social-btn.google');
const facebookLoginBtn = document.querySelector('.social-btn.facebook');
const naverLoginBtn = document.querySelector('.social-btn.naver');
const kakaoLoginBtn = document.querySelector('.social-btn.kakao');
const uploadModal = document.getElementById('upload-modal');
if (adminUploadBtn) adminUploadBtn.addEventListener('click', () => uploadModal.classList.add('active'));
if (uploadModal) { const closeUploadModalBtn = uploadModal.querySelector('.close-modal-btn'); closeUploadModalBtn.addEventListener('click', () => uploadModal.classList.remove('active')); uploadModal.addEventListener('click', (e) => { if (e.target === uploadModal) uploadModal.classList.remove('active'); }); }
modalForm.addEventListener('submit', (e) => { e.preventDefault(); const email = emailInput.value; const password = passwordInput.value; createUserWithEmailAndPassword(auth, email, password).then(async (userCredential) => { const user = userCredential.user; await setDoc(doc(db, "users", user.uid), { email: user.email, displayName: user.email.split('@')[0], credits: 0, role: 'user' }); alert('회원가입에 성공했습니다!'); modalOverlay.classList.remove('active'); }).catch((error) => { console.error('회원가입 오류:', error); alert('오류가 발생했습니다: ' + error.message); }); });
async function checkAndCreateUserDocument(user, additionalInfo = {}) { if (!user) return; const userDocRef = doc(db, "users", user.uid); const docSnap = await getDoc(userDocRef); if (!docSnap.exists()) { await setDoc(userDocRef, { email: additionalInfo.email || user.email, displayName: additionalInfo.displayName || user.displayName, credits: 5, role: 'user' }); alert('가입을 환영합니다! 5 크레딧이 지급되었습니다.'); } else { alert('다시 오신 것을 환영합니다!'); } }
const handleSocialLogin = (provider) => { signInWithPopup(auth, provider).then((result) => { checkAndCreateUserDocument(result.user); modalOverlay.classList.remove('active'); }).catch((error) => { console.error('소셜 로그인 오류:', error); alert('오류가 발생했습니다: ' + error.message); }); };
googleLoginBtn.addEventListener('click', () => handleSocialLogin(new GoogleAuthProvider()));
facebookLoginBtn.addEventListener('click', () => handleSocialLogin(new FacebookAuthProvider()));
naverLoginBtn.addEventListener('click', () => { const REDIRECT_URI = `${window.location.origin}/naver_callback.html`; const NAVER_CLIENT_ID = "W4LjGnJ_ulte2VAy_pIu"; const state = "RANDOM_STATE"; const url = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${NAVER_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&state=${state}`; window.open(url, "naverloginpop", "titlebar=1, resizable=1, scrollbars=yes, width=600, height=700"); });
window.addEventListener("message", (event) => { if (event.origin !== window.location.origin) return; const { status, message, userData } = event.data; if (status === 'success') { modalOverlay.classList.remove('active'); checkAndCreateUserDocument(auth.currentUser, userData); } else if (status === 'error') { alert(`네이버 로그인 중 오류가 발생했습니다: ${message}`); } }, false);
kakaoLoginBtn.addEventListener('click', () => alert('카카오 로그인은 현재 준비 중입니다.'));
logoutBtn.addEventListener('click', () => signOut(auth));
const uploadForm = document.getElementById('upload-form');
const uploadProgress = document.getElementById('upload-progress');
if (uploadForm) { uploadForm.addEventListener('submit', async (e) => { e.preventDefault(); const assetTitle = document.getElementById('asset-title').value; const assetType = document.getElementById('asset-type').value; const assetFile = document.getElementById('asset-file').files[0]; const thumbnailFile = document.getElementById('thumbnail-file').files[0]; const assetPrice = Number(document.getElementById('asset-price').value); if (!assetFile || !thumbnailFile || !assetTitle || assetPrice < 0) { alert('모든 필드를 올바르게 채워주세요.'); return; } const user = auth.currentUser; if (!user) { alert('로그인이 필요합니다.'); return; } try { const assetUrl = await uploadFile(assetFile, `${assetType}/${Date.now()}_${assetFile.name}`, '메인 파일'); const thumbnailUrl = await uploadFile(thumbnailFile, `thumbnails/${Date.now()}_${thumbnailFile.name}`, '썸네일'); uploadProgress.textContent = 'Firestore에 정보 저장 중...'; const collectionName = assetType === 'music' ? 'musics' : 'images'; await addDoc(collection(db, collectionName), { title: assetTitle, price: assetPrice, fileUrl: assetUrl, thumbnailUrl: thumbnailUrl, creatorUid: user.uid, createdAt: new Date() }); uploadProgress.textContent = '✅ 업로드 완료!'; uploadForm.reset(); setTimeout(() => { uploadProgress.textContent = ''; uploadModal.classList.remove('active'); }, 1500); } catch (error) { console.error("업로드 오류:", error); uploadProgress.textContent = `❌ 오류 발생: ${error.message}`; } }); }
function uploadFile(file, path, fileTypeLabel) { return new Promise((resolve, reject) => { const storageRef = ref(storage, path); const uploadTask = uploadBytesResumable(storageRef, file); uploadTask.on('state_changed', (snapshot) => { const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100; uploadProgress.textContent = `${fileTypeLabel} 업로드 중: ${Math.round(progress)}%`; }, (error) => reject(error), async () => { const downloadURL = await getDownloadURL(uploadTask.snapshot.ref); resolve(downloadURL); }); }); }

// --- WaveSurfer.js 및 실시간 업데이트 기반 통합 플레이어 로직 ---

let wavesurferInstances = {};
let currentlyPlaying = null;

function renderAndInitializePlayer(doc, container, renderer) {
    const musicData = doc.data();
    const docId = doc.id;
    const existingItem = container.querySelector(`[data-id="${docId}"]`);
    if (existingItem) return;

    const item = renderer(docId, musicData);
    container.appendChild(item);
    initializeWaveSurferForElement(item);
}

function initializeWaveSurferForElement(item) {
    const docId = item.dataset.id;
    const audio = item.querySelector('audio');
    const container = item.querySelector('.waveform-container');
    const playButton = item.querySelector('.play-button');
    const playIcon = playButton.querySelector('i');
    const currentTimeEl = item.querySelector('.current-time');
    const totalTimeEl = item.querySelector('.total-time');

    const wavesurfer = WaveSurfer.create({
        container: container,
        waveColor: 'rgba(255, 255, 255, 0.2)',
        progressColor: '#00a8ff',
        url: audio.src,
        barWidth: 2, barRadius: 2, barGap: 2,
        height: item.classList.contains('music-card') ? 60 : 40,
    });
    
    if (!wavesurferInstances[docId]) wavesurferInstances[docId] = [];
    wavesurferInstances[docId].push(wavesurfer);

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    wavesurfer.on('ready', () => totalTimeEl.textContent = formatTime(wavesurfer.getDuration()));
    wavesurfer.on('timeupdate', (currentTime) => currentTimeEl.textContent = formatTime(currentTime));
    wavesurfer.on('finish', () => wavesurfer.seekTo(0));

    // -> 2. 아이콘 변경 로직 수정: 복잡한 동기화 대신 자기 자신의 아이콘만 직접 변경
    wavesurfer.on('play', () => {
        playIcon.className = 'fas fa-pause';
        if (currentlyPlaying && currentlyPlaying !== wavesurfer) {
            currentlyPlaying.pause();
        }
        currentlyPlaying = wavesurfer;
    });

    wavesurfer.on('pause', () => {
        playIcon.className = 'fas fa-play';
    });
    
    playButton.addEventListener('click', () => wavesurfer.playPause());
}

function createMusicCardHTML(id, data) {
    const card = document.createElement('div');
    card.classList.add('music-card');
    card.dataset.id = id;
    card.innerHTML = `<div class="card-content"><div class="play-button"><i class="fas fa-play"></i></div><div class="track-info"><h3>${data.title}</h3><p>J-Pop</p></div></div><div class="waveform-container"></div><div class="time-container"><span class="current-time">0:00</span><span class="total-time">0:00</span></div>`;
    const audio = document.createElement('audio');
    audio.src = data.fileUrl;
    audio.crossOrigin = "anonymous";
    card.appendChild(audio);
    return card;
}

function createTrackItemHTML(id, data) {
    const item = document.createElement('div');
    item.classList.add('track-item');
    item.dataset.id = id;
    item.innerHTML = `<div class="play-button"><i class="fas fa-play"></i></div><div class="track-album-art"><img src="${data.thumbnailUrl}" alt="${data.title} 앨범 아트"></div><div class="track-details"><h3>${data.title}</h3><p>Artify Originals</p></div><div class="waveform-container" style="flex-grow: 1; margin: 0 1rem;"></div><div class="time-container" style="display: flex; gap: 5px; align-items: center; min-width: 80px;"><span class="current-time">0:00</span> / <span class="total-time">0:00</span></div><div class="track-actions"><button class="action-btn" title="Download"><i class="fas fa-download"></i></button><button class="action-btn" title="Favorite"><i class="far fa-star"></i></button></div>`;
    const audio = document.createElement('audio');
    audio.src = data.fileUrl;
    audio.crossOrigin = "anonymous";
    item.appendChild(audio);
    return item;
}

function setupMusicListeners() {
    const musicCollection = collection(db, "musics");
    const mainGridContainer = document.querySelector('#music-grid .item-grid');
    const browserListContainer = document.querySelector('#music-browser .music-track-list');

    const latestMusicQuery = query(musicCollection, orderBy("createdAt", "desc"), limit(6));
    onSnapshot(latestMusicQuery, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") renderAndInitializePlayer(change.doc, mainGridContainer, createMusicCardHTML);
            if (change.type === "removed") document.querySelector(`#music-grid [data-id="${change.doc.id}"]`)?.remove();
        });
    });

    const allMusicQuery = query(musicCollection, orderBy("createdAt", "desc"));
    onSnapshot(allMusicQuery, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") renderAndInitializePlayer(change.doc, browserListContainer, createTrackItemHTML);
            if (change.type === "removed") document.querySelector(`#music-browser [data-id="${change.doc.id}"]`)?.remove();
        });
    });
}

// 페이지 로드 시 실시간 리스너를 시작합니다.
setupMusicListeners();