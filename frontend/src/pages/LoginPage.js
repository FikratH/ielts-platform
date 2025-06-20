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
    const email = `${sid}@ielts.local`;

    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await result.user.getIdToken();

      localStorage.setItem('token', idToken);

      const response = await axios.post('http://127.0.0.1:8000/api/login/', {
        idToken,
        role: 'student',
        student_id: sid,
      });

      localStorage.setItem('uid', response.data.uid);
      localStorage.setItem('role', response.data.role);
      localStorage.setItem("student_id", response.data.student_id);
      setRole(response.data.role);

      window.dispatchEvent(new Event('local-storage'));

      if (role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/dashboard');
      }

    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed. Check SID and password.');
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
