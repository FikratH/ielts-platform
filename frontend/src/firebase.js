import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onIdTokenChanged } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
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
      const publicPaths = ['/login', '/Ptest'];
      const testPaths = ['/listening', '/reading', '/writing'];
      const currentPath = window.location.pathname;
      const isPublicPath = publicPaths.includes(currentPath);
      const isTestPath = testPaths.some(path => currentPath.includes(path));

      if (isTestPath) {
        localStorage.removeItem('token');
        localStorage.removeItem('uid');
        localStorage.removeItem('role');
        localStorage.removeItem('student_id');
        localStorage.removeItem('first_name');
        localStorage.removeItem('last_name');
        localStorage.removeItem('group');
        return;
      }

      localStorage.removeItem('token');
      localStorage.removeItem('uid');
      localStorage.removeItem('role');
      localStorage.removeItem('student_id');
      localStorage.removeItem('first_name');
      localStorage.removeItem('last_name');
      localStorage.removeItem('group');

      if (!isPublicPath) {
        window.location.href = '/login';
      }
    }, 1500);
  }
});

export { auth, provider };
