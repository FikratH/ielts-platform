import axios from 'axios';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || '/api'
});

// Флаг для отслеживания готовности Firebase
let authReady = false;
let authPromise = null;

// Функция для ожидания готовности Firebase
const waitForAuth = () => {
  if (authReady) {
    return Promise.resolve();
  }
  
  if (!authPromise) {
    authPromise = new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        authReady = true;
        unsubscribe();
        resolve();
      });
    });
  }
  
  return authPromise;
};

// Интерцептор для подстановки актуального idToken
api.interceptors.request.use(async (config) => {
  // Ждем готовности Firebase
  await waitForAuth();
  
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

export default api; 