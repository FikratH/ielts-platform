import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const [sid, setSid] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const [role, setRole] = useState('');

  const handleLogin = async () => {
    try {
      // 1. Получить email по SID
      const emailRes = await axios.get('/api/get-email-by-sid/', { params: { student_id: sid } });
      const email = emailRes.data.email;
      if (!email) throw new Error('Email not found');

      // 2. Вход через Firebase по email и паролю
      const result = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await result.user.getIdToken();

      localStorage.setItem('token', idToken);

      const response = await axios.post('http://127.0.0.1:8000/api/login/', {
        idToken,
        student_id: sid,
      });

      localStorage.setItem('uid', response.data.uid);
      localStorage.setItem('role', response.data.role);
      localStorage.setItem('student_id', response.data.student_id);
      setRole(response.data.role);

      window.dispatchEvent(new Event('local-storage'));

      if (response.data.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error.response && error.response.status === 404) {
        alert('SID не найден. Проверьте правильность Student ID.');
      } else if (error.code === 'auth/wrong-password') {
        alert('Неверный пароль.');
      } else {
        alert('Login failed. Проверьте SID и пароль.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center mb-6">Вход</h2>
        <input
          type="text"
          value={sid}
          onChange={(e) => setSid(e.target.value)}
          placeholder="Enter StudentID"
          className="w-full p-2 mb-4 border rounded"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          className="w-full p-2 mb-4 border rounded"
        />
        <button onClick={handleLogin} className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
          Войти
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
