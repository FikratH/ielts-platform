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
    try {
      const token = await user.getIdToken();
      localStorage.setItem('token', token);
    } catch (e) {
      // если не смогли обновить токен — не рвём сессию мгновенно
    }
  } else {
    // Мягкая обработка потери пользователя: пробуем подождать короткое время
    setTimeout(async () => {
      if (auth.currentUser) {
        try {
          const token = await auth.currentUser.getIdToken(true);
          localStorage.setItem('token', token);
          return;
        } catch (e) {
          // fallthrough to logout
        }
      }
      localStorage.removeItem('token');
      localStorage.removeItem('uid');
      localStorage.removeItem('role');
      localStorage.removeItem('student_id');
      localStorage.removeItem('first_name');
      localStorage.removeItem('last_name');
      localStorage.removeItem('group');
      // Публичные страницы не требуют авторизации
      const publicPaths = ['/login', '/Ptest'];
      if (!publicPaths.includes(window.location.pathname)) {
        window.location.href = '/login';
      }
    }, 1500);
  }
});

export { auth, provider };
