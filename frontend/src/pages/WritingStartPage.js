import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const WritingStartPage = () => {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const role = localStorage.getItem('role');
    setUserRole(role);
  }, []);

  const startSession = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post('/api/start-writing-session/', {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      localStorage.removeItem('writing_timer');
      const sessionId = res.data.session_id;
      navigate(`/writing/task1/${sessionId}`);
    } catch (err) {
      console.error(err);
      alert("Ошибка при старте Writing Test");
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">IELTS Writing Tests</h2>
      {userRole === 'admin' ? (
        <button
          onClick={() => navigate('/admin/writing')}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mb-4"
        >
          Manage Writing Tests
        </button>
      ) : null}
      
      <div className="border p-4 rounded shadow-sm flex items-center justify-between">
        <div>
          <p className="font-semibold">IELTS Writing Test</p>
          <p className="text-sm text-gray-600">Task 1 (Academic/General) + Task 2 (Essay). AI оценит оба задания после завершения.</p>
        </div>
        <button
          onClick={startSession}
          className="ml-4 bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
        >
          Start Test
        </button>
      </div>
    </div>
  );
};

export default WritingStartPage;
