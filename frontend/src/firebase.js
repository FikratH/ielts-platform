import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onIdTokenChanged } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBWa87NKswOQuNAZUj30h6jPWXNXEveXT4",
  authDomain: "ielts-project-459e3.firebaseapp.com",
  projectId: "ielts-project-459e3",
  storageBucket: "ielts-project-459e3.firebasestorage.app",
  messagingSenderId: "992938387814",
  appId: "1:992938387814:web:3ca1f48b933256078700a7",
  measurementId: "G-4XGG4890EC"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Глобальный слушатель для автообновления idToken
onIdTokenChanged(auth, async (user) => {
  if (user) {
    const token = await user.getIdToken();
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
    localStorage.removeItem('uid');
    localStorage.removeItem('role');
    localStorage.removeItem('student_id');
    // Автоматический редирект на логин
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }
});

export { auth, provider };
