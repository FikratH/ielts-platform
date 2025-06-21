import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ListeningTimer from '../components/ListeningTimer';
import AudioPlayer from '../components/AudioPlayer';

const ListeningTestPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.post(`/api/listening/tests/${id}/start/`, {}, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(res => {
         setTest(res.data.test);
         setSessionId(res.data.session_id);
         setLoading(false);
      })
      .catch(err => {
        setLoading(false);
        setError('Ошибка доступа или авторизации. Пожалуйста, войдите заново.');
        console.error(err);
      });
  }, [id]);

  if (!sessionId && !loading) return <p className="p-4 text-red-600">Ошибка: не удалось получить sessionId для теста. Попробуйте обновить страницу или обратитесь к администратору.</p>;

  const handleChange = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = () => {
    if (!sessionId) {
      setError('Ошибка: не удалось получить sessionId для теста. Попробуйте обновить страницу.');
      return;
    }
    setSubmitting(true);
    const token = localStorage.getItem('token');
    axios.post(`/api/listening/sessions/${sessionId}/submit/`, {
      answers,
    }, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(res => {
        navigate(`/listening-result/${sessionId}`);
      })
      .catch(err => {
        setError('Ошибка при отправке теста. Пожалуйста, попробуйте еще раз.');
        console.error("Submit error:", err.response ? err.response.data : err);
      })
      .finally(() => setSubmitting(false));
  };

  if (loading) return <p className="p-4">Loading...</p>;
  if (error) return <p className="p-4 text-red-600">{error}</p>;
  if (!test) return <p className="p-4 text-red-600">Ошибка загрузки теста.</p>;

  const timeLimit = test.time_limit ? test.time_limit * 60 : 30 * 60;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <ListeningTimer onTimeUp={handleSubmit} initialSeconds={timeLimit} />
      <h2 className="text-xl font-bold mb-4">{test.title}</h2>
      {test.audio && test.audio.audio_url && (
        <AudioPlayer src={test.audio.audio_url} />
      )}
      {(test.questions || []).map(q => (
        <div key={q.id} className="mb-6 border p-4 rounded shadow-sm">
          <p className="font-medium">Q{q.order}. {q.question_text}</p>
          {q.image && (
            <img src={q.image} alt="Question image" className="my-2 w-full max-w-xl rounded border" />
          )}
          {q.options ? (
            q.options.map(opt => (
              <label key={opt.label} className="block mt-1">
                <input
                  type="radio"
                  name={`question-${q.id}`}
                  value={opt.label}
                  checked={answers[q.id] === opt.label}
                  onChange={() => handleChange(q.id, opt.label)}
                  className="mr-2"
                  disabled={submitting}
                />
                {opt.label}. {opt.text}
              </label>
            ))
          ) : (
            <input
              type="text"
              value={answers[q.id] || ""}
              onChange={(e) => handleChange(q.id, e.target.value)}
              placeholder="Введите ваш ответ"
              className="mt-1 w-full p-2 border rounded"
              disabled={submitting}
            />
          )}
        </div>
      ))}
      <button
        onClick={handleSubmit}
        className="w-full mt-4 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors duration-300"
        disabled={submitting}
      >
        {submitting ? "Отправка..." : "Завершить и посмотреть результат"}
      </button>
    </div>
  );
};

export default ListeningTestPage; 