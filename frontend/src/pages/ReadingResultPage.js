import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import TestResultLayout from '../components/TestResultLayout';

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
    <TestResultLayout
      title="Результаты IELTS Reading"
      session={session}
      onBackToList={() => navigate('/reading')}
      moduleName="Reading"
    />
  );
};

export default ReadingResultPage; 