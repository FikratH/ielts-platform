import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import api from '../api';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const [sid, setSid] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [role, setRole] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    try {
      const emailRes = await api.get('/get-email-by-sid/', { params: { student_id: sid } });
      const email = emailRes.data.email;
      if (!email) throw new Error('Email not found');
      const result = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await result.user.getIdToken();
      localStorage.setItem('token', idToken);
      const response = await api.post('/login/', {
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
        alert('SID not found. Please check the Student ID.');
      } else if (error.code === 'auth/wrong-password') {
        alert('Incorrect password.');
      } else {
        alert('Login failed. Please check SID and password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-blue-600 px-2">
      <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mt-12 mb-10 text-center drop-shadow-lg select-none leading-tight">
        Welcome to Master Education Testing Platform!
      </h1>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 md:p-10 flex flex-col items-center relative">
        <h2 className="text-xl md:text-2xl font-bold text-blue-700 mb-6 text-center select-none">Login page</h2>
        <form className="w-full flex flex-col gap-5">
          <div className="w-full text-left flex flex-col gap-1">
            <label htmlFor="student-id" className="font-semibold text-blue-700 text-sm md:text-base">Student ID</label>
            <input
              id="student-id"
              type="text"
              value={sid}
              onChange={(e) => setSid(e.target.value)}
              placeholder="Enter your student ID"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-base transition"
              disabled={loading}
            />
          </div>
          <div className="w-full text-left flex flex-col gap-1">
            <label htmlFor="password" className="font-semibold text-blue-700 text-sm md:text-base">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-base transition"
              disabled={loading}
            />
          </div>
          <button
            type="button"
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg text-lg shadow-md hover:bg-blue-700 transition-colors duration-200 mt-2 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <div className="text-gray-500 text-sm text-center mt-6 select-none leading-snug">
          If you do not know your login details, please contact your curator.
        </div>
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-70 flex flex-col items-center justify-center rounded-2xl z-10">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <div className="text-blue-700 font-semibold text-lg">Signing in...</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
