import React from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const WritingStartPage = () => {
  const navigate = useNavigate();

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
    <div className="p-8 text-center">
      <h2 className="text-2xl font-bold mb-6">Начать IELTS Writing Test</h2>
      <p className="mb-4 text-gray-700">Вы пройдёте два задания: Task 1 и Task 2. AI оценит оба после завершения.</p>
      <button
        onClick={startSession}
        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
      >
        Начать тест
      </button>
    </div>
  );
};

export default WritingStartPage;
