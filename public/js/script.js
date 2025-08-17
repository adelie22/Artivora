// Import functions from the Firebase SDK
import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";
import {
    getFirestore, doc, setDoc, getDoc, onSnapshot, enableIndexedDbPersistence,
    addDoc, collection
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
const adminUploadBtn = document.getElementById('admin-upload-btn'); // 업로드 버튼 추가


// --- Auth State Observer ---
onAuthStateChanged(auth, user => {
    if (user) {
        // User is signed in
        navLoggedOutCenter.classList.add('hidden');
        navLoggedOutRight.classList.add('hidden');
        navLoggedIn.classList.remove('hidden');
        userEmailEl.textContent = user.email || user.displayName;

        const userDocRef = doc(db, "users", user.uid);
        onSnapshot(userDocRef, (doc) => {
            if (doc.exists()) {
                creditCountEl.textContent = doc.data().credits;
                if (doc.data().role === 'admin') {
                    adminUploadBtn.classList.remove('hidden'); // 버튼 보이기
                } else {
                    adminUploadBtn.classList.add('hidden'); // 버튼 숨기기
                }
            } else {
                creditCountEl.textContent = 0;
                adminUploadBtn.classList.add('hidden');
            }
        });

    } else {
        // User is signed out
        navLoggedOutCenter.classList.remove('hidden');
        navLoggedOutRight.classList.remove('hidden');
        navLoggedIn.classList.add('hidden');
        userEmailEl.textContent = '';
        creditCountEl.textContent = '0';
        adminUploadBtn.classList.add('hidden'); // 로그아웃 시 버튼 숨기기
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


// --- Upload Modal Logic ---
const uploadModal = document.getElementById('upload-modal');
if (adminUploadBtn) {
    adminUploadBtn.addEventListener('click', () => {
        uploadModal.classList.add('active');
    });
}
if (uploadModal) {
    const closeUploadModalBtn = uploadModal.querySelector('.close-modal-btn');
    closeUploadModalBtn.addEventListener('click', () => {
        uploadModal.classList.remove('active');
    });
    uploadModal.addEventListener('click', (e) => {
        if (e.target === uploadModal) {
            uploadModal.classList.remove('active');
        }
    });
}

// Email/Password Signup
modalForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;

    createUserWithEmailAndPassword(auth, email, password)
        .then(async (userCredential) => {
            const user = userCredential.user;
            await setDoc(doc(db, "users", user.uid), {
                email: user.email,
                displayName: user.email.split('@')[0], // 기본 displayName 설정
                credits: 0,
                role: 'user' // 기본 역할 부여
            });
            alert('회원가입에 성공했습니다!');
            modalOverlay.classList.remove('active');
        })
        .catch((error) => {
            console.error('회원가입 오류:', error);
            alert('오류가 발생했습니다: ' + error.message);
        });
});

async function checkAndCreateUserDocument(user, additionalInfo = {}) {
    if (!user) return;
    const userDocRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userDocRef);
    if (!docSnap.exists()) {
        await setDoc(userDocRef, {
            email: additionalInfo.email || user.email,
            displayName: additionalInfo.displayName || user.displayName,
            credits: 5,
            role: 'user'
        });
        alert('가입을 환영합니다! 5 크레딧이 지급되었습니다.');
    } else {
        alert('다시 오신 것을 환영합니다!');
    }
}

const handleSocialLogin = (provider) => {
    signInWithPopup(auth, provider)
        .then((result) => {
            checkAndCreateUserDocument(result.user);
            modalOverlay.classList.remove('active');
        })
        .catch((error) => {
            console.error('소셜 로그인 오류:', error);
            alert('오류가 발생했습니다: ' + error.message);
        });
};

googleLoginBtn.addEventListener('click', () => handleSocialLogin(new GoogleAuthProvider()));
facebookLoginBtn.addEventListener('click', () => handleSocialLogin(new FacebookAuthProvider()));

naverLoginBtn.addEventListener('click', () => {
    const REDIRECT_URI = `${window.location.origin}/naver_callback.html`;
    const NAVER_CLIENT_ID = "W4LjGnJ_ulte2VAy_pIu";
    const state = "RANDOM_STATE";
    const url = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${NAVER_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&state=${state}`;
    window.open(url, "naverloginpop", "titlebar=1, resizable=1, scrollbars=yes, width=600, height=700");
});

window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) {
        return;
    }
    const { status, message, userData } = event.data;
    if (status === 'success') {
        modalOverlay.classList.remove('active');
        checkAndCreateUserDocument(auth.currentUser, userData);
    } else if (status === 'error') {
        alert(`네이버 로그인 중 오류가 발생했습니다: ${message}`);
    }
}, false);

kakaoLoginBtn.addEventListener('click', () => {
    alert('카카오 로그인은 현재 준비 중입니다.');
});

logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

// --- Music Player & Waveform Logic (생략) ---
// ... 기존 음악 플레이어 코드는 여기에 그대로 유지 ...


// --- Upload Form Logic ---
const uploadForm = document.getElementById('upload-form');
const uploadProgress = document.getElementById('upload-progress');

if(uploadForm){
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const assetTitle = document.getElementById('asset-title').value;
        const assetType = document.getElementById('asset-type').value;
        const assetFile = document.getElementById('asset-file').files[0];
        const thumbnailFile = document.getElementById('thumbnail-file').files[0];
        const assetPrice = Number(document.getElementById('asset-price').value);
        
        if (!assetFile || !thumbnailFile || !assetTitle || assetPrice < 0) {
            alert('모든 필드를 올바르게 채워주세요.');
            return;
        }
        const user = auth.currentUser;
        if (!user) {
            alert('로그인이 필요합니다.');
            return;
        }

        try {
            const assetUrl = await uploadFile(assetFile, `${assetType}/${Date.now()}_${assetFile.name}`, '메인 파일');
            const thumbnailUrl = await uploadFile(thumbnailFile, `thumbnails/${Date.now()}_${thumbnailFile.name}`, '썸네일');
            
            uploadProgress.textContent = 'Firestore에 정보 저장 중...';
            const collectionName = assetType === 'music' ? 'musics' : 'images';
            
            await addDoc(collection(db, collectionName), {
                title: assetTitle,
                price: assetPrice,
                fileUrl: assetUrl,
                thumbnailUrl: thumbnailUrl,
                creatorUid: user.uid,
                createdAt: new Date()
            });
            
            uploadProgress.textContent = '✅ 업로드 완료!';
            uploadForm.reset();
            setTimeout(() => { uploadProgress.textContent = ''; }, 3000);
        } catch (error) {
            console.error("업로드 오류:", error);
            uploadProgress.textContent = `❌ 오류 발생: ${error.message}`;
        }
    });
}


function uploadFile(file, path, fileTypeLabel) {
    return new Promise((resolve, reject) => {
        const storageRef = ref(storage, path);
        const uploadTask = uploadBytesResumable(storageRef, file);
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                uploadProgress.textContent = `${fileTypeLabel} 업로드 중: ${Math.round(progress)}%`;
            },
            (error) => reject(error),
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadURL);
            }
        );
    });
}