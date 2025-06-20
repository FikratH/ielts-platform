import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const ReadingResultPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sessionId) {
      setError('ID сессии не найден.');
      setLoading(false);
      return;
    }

    const fetchResults = async () => {
      setLoading(true);
      const token = localStorage.getItem('token');
      try {
        const res = await axios.get(`/api/reading/sessions/${sessionId}/`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        setSession(res.data);
      } catch (err) {
        setError('Не удалось загрузить результаты. Пожалуйста, попробуйте обновить страницу.');
        console.error("Fetch results error:", err.response ? err.response.data : err);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [sessionId]);

  if (loading) return <div className="p-6 text-center">Загрузка результатов...</div>;
  if (error) return <div className="p-6 text-center text-red-600 bg-red-50 rounded-lg">{error}</div>;
  if (!session) return <div className="p-6 text-center">Нет данных для отображения.</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto bg-gray-50 min-h-screen">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-3xl font-bold mb-4 text-gray-800">Результаты IELTS Reading</h2>
        <p className="text-lg text-gray-600">Тест: <span className="font-semibold">{session.test_title}</span></p>
        
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
            <div className="p-4 bg-blue-100 rounded-lg">
                <p className="text-sm text-blue-800">Правильные ответы</p>
                <p className="text-2xl font-bold text-blue-900">{session.raw_score} / {session.total_questions}</p>
            </div>
            <div className="p-4 bg-purple-100 rounded-lg">
                <p className="text-sm text-purple-800">Band Score</p>
                <p className="text-2xl font-bold text-purple-900">{session.band_score}</p>
            </div>
        </div>

        <h3 className="mt-8 text-2xl font-bold border-b pb-2 mb-4 text-gray-700">Детальный разбор</h3>
        <div className="space-y-4">
          {session.question_feedback && session.question_feedback.length > 0 ? (
            session.question_feedback.map((feedback, index) => (
              <div key={feedback.question_id} className={`p-4 border-l-4 rounded-r-lg ${feedback.is_correct ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
                 <p className="font-semibold text-gray-800">Вопрос {index + 1}: <span className="font-normal text-gray-600">{feedback.question_text}</span></p>
                 <div className="mt-2">
                     <p>Ваш ответ: <span className={`font-medium ${feedback.is_correct ? 'text-green-700' : 'text-red-700'}`}>{feedback.user_answer || "Нет ответа"}</span></p>
                     {!feedback.is_correct && <p>Правильный ответ: <span className="font-medium text-blue-700">{feedback.correct_answer}</span></p>}
                 </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-4">Детальный разбор недоступен.</p>
          )}
        </div>

        <button
           className="mt-8 w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-300"
           onClick={() => navigate('/reading')}
        >
           К списку тестов
        </button>
      </div>
    </div>
  );
};

export default ReadingResultPage; 