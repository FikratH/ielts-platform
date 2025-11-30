import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onIdTokenChanged } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCGaTlQrpo0EB7H-EP7PYR_QeBHIl0oE-c",
  authDomain: "ielts-project-6259a.firebaseapp.com",
  projectId: "ielts-project-6259a",
  storageBucket: "ielts-project-6259a.firebasestorage.app",
  messagingSenderId: "938135977743",
  appId: "1:938135977743:web:8edc003b80c1f2557b087a",
  measurementId: "G-TXD2ZR6SF4"
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
    localStorage.removeItem('first_name');
    localStorage.removeItem('last_name');
    localStorage.removeItem('group');
    // Автоматический редирект на логин
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }
});

export { auth, provider };
