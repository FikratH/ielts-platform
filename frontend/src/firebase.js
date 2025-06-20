import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

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
export { auth, provider };
