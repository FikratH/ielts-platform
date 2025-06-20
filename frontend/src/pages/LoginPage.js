import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const [sid, setSid] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

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


      if (response.data.role === 'admin') {
        navigate('/admin/essays');
      } else {
        navigate('/dashboard');
      }

    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed. Check SID and password.');
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', textAlign: 'center' }}>
      <input
        type="text"
        placeholder="Enter StudentID"
        value={sid}
        onChange={(e) => setSid(e.target.value)}
        style={{ width: '100%', padding: 8, marginBottom: 10 }}
      />
      <input
        type="password"
        placeholder="Enter password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: '100%', padding: 8, marginBottom: 10 }}
      />
      <button onClick={handleLogin} style={{ padding: 10, width: '100%' }}>
        Login
      </button>
    </div>
  );
};

export default LoginPage;
