import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const ReadingResultPage = () => {
  const { sessionId: paramSessionId } = useParams();
  const [sessionId] = useState(paramSessionId || localStorage.getItem('readingSessionId'));
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionId) {
      setError('Ошибка: не удалось получить sessionId для результатов. Попробуйте пройти тест заново.');
      return;
    }
    axios.get(`/api/reading/sessions/${sessionId}/`)
      .then(res => setSession(res.data))
      .catch(err => setError('Ошибка загрузки результатов'));
  }, [sessionId]);

  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!session) return <p className="p-6">Загрузка...</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Результаты IELTS Reading</h2>
      <p>Правильных ответов: {session.correct_answers} из {session.total_questions}</p>
      <p className="mt-2">📊 Raw Score: {session.raw_score}</p>
      <p className="mt-2 text-xl font-semibold">🏅 Band Score: {session.band_score}</p>

      <h3 className="mt-6 text-xl font-bold">Детали по вопросам</h3>
      {session.question_feedback.map((feedback, index) => (
         <div key={index} className="mt-4 p-4 border rounded shadow-sm">
            <p className="font-semibold">Вопрос {feedback.question_order}.</p>
            <p>Ваш ответ: {feedback.user_answer} ( {feedback.correct ? "✓" : "✗" } )</p>
            <p>Правильный ответ: {feedback.correct_answer}.</p>
            {feedback.feedback && <p className="mt-2 text-sm text-gray-600">{feedback.feedback}</p>}
         </div>
      ))}

      <button
         className="mt-6 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
         onClick={() => navigate('/reading')}
      >
         Пройти другой тест
      </button>
    </div>
  );
};

export default ReadingResultPage; 