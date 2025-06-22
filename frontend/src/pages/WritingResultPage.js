import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import TestResultLayout from '../components/TestResultLayout';

const WritingResultPage = () => {
  const { sessionId } = useParams();
  const [essays, setEssays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        const res = await axios.get(`/api/essays/?session_id=${sessionId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setEssays(res.data);
      } catch (err) {
        console.error(err);
        setError("Ошибка при загрузке результатов");
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [sessionId]);

  if (loading) return <div className="p-6 text-center">Загрузка результатов...</div>;
  if (error) return <div className="p-6 text-center text-red-600 bg-red-50 rounded-lg">{error}</div>;
  if (essays.length === 0) return <div className="p-6 text-center">Нет данных для отображения.</div>;

  // Подготавливаем данные для TestResultLayout
  const averageBand = essays.reduce((sum, essay) => sum + parseFloat(essay.overall_band), 0) / essays.length;
  
  const sessionData = {
    test_title: "IELTS Writing Test",
    raw_score: essays.length,
    total_questions: 2,
    band_score: averageBand.toFixed(1),
    question_feedback: essays.map((essay, index) => ({
      question_id: essay.id,
      question_text: `Task ${essay.task_type.toUpperCase()}: ${essay.question_text.substring(0, 100)}...`,
      user_answer: essay.submitted_text.substring(0, 200) + "...",
      correct_answer: `Band Score: ${essay.overall_band}`,
      is_correct: true, // Всегда true для Writing, так как это не тест с правильными ответами
      detailed_feedback: essay.feedback,
      scores: {
        task_response: essay.score_task,
        coherence: essay.score_coherence,
        lexical: essay.score_lexical,
        grammar: essay.score_grammar
      }
    }))
  };

  return (
    <div className="p-6 max-w-4xl mx-auto bg-gray-50 min-h-screen">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-3xl font-bold mb-4 text-gray-800">Результаты IELTS Writing</h2>
        <p className="text-lg text-gray-600">Тест: <span className="font-semibold">{sessionData.test_title}</span></p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
          <div className="p-4 bg-blue-100 rounded-lg">
            <p className="text-sm text-blue-800">Завершено заданий</p>
            <p className="text-2xl font-bold text-blue-900">{sessionData.raw_score} / {sessionData.total_questions}</p>
          </div>
          <div className="p-4 bg-purple-100 rounded-lg">
            <p className="text-sm text-purple-800">Средний Band Score</p>
            <p className="text-2xl font-bold text-purple-900">{sessionData.band_score}</p>
          </div>
        </div>

        <h3 className="mt-8 text-2xl font-bold border-b pb-2 mb-4 text-gray-700">Детальный разбор</h3>
        <div className="space-y-6">
          {essays.map((essay, index) => (
            <div key={essay.id} className="border p-6 rounded-lg bg-gray-50">
              <h4 className="text-xl font-semibold mb-4 text-gray-800">
                Task {essay.task_type.toUpperCase()}
              </h4>
              
              <div className="mb-4">
                <p className="font-medium text-gray-700 mb-2">Задание:</p>
                <p className="text-gray-600 italic">{essay.question_text}</p>
              </div>

              <div className="mb-4">
                <p className="font-medium text-gray-700 mb-2">Ваш ответ:</p>
                <div className="bg-white p-3 rounded border text-gray-800 whitespace-pre-line max-h-40 overflow-y-auto">
                  {essay.submitted_text}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-2 bg-green-100 rounded">
                  <p className="text-sm text-green-800">Task Response</p>
                  <p className="font-bold text-green-900">{essay.score_task}</p>
                </div>
                <div className="text-center p-2 bg-blue-100 rounded">
                  <p className="text-sm text-blue-800">Coherence</p>
                  <p className="font-bold text-blue-900">{essay.score_coherence}</p>
                </div>
                <div className="text-center p-2 bg-purple-100 rounded">
                  <p className="text-sm text-purple-800">Lexical</p>
                  <p className="font-bold text-purple-900">{essay.score_lexical}</p>
                </div>
                <div className="text-center p-2 bg-orange-100 rounded">
                  <p className="text-sm text-orange-800">Grammar</p>
                  <p className="font-bold text-orange-900">{essay.score_grammar}</p>
                </div>
              </div>

              <div className="text-center p-3 bg-indigo-100 rounded-lg">
                <p className="text-sm text-indigo-800">Overall Band Score</p>
                <p className="text-2xl font-bold text-indigo-900">{essay.overall_band}</p>
              </div>

              <div className="mt-4">
                <p className="font-medium text-gray-700 mb-2">Обратная связь:</p>
                <div className="bg-white p-3 rounded border text-sm text-gray-800 whitespace-pre-wrap">
                  {essay.feedback}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          className="mt-8 w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-300"
          onClick={() => navigate('/writing')}
        >
          К списку тестов Writing
        </button>
      </div>
    </div>
  );
};

export default WritingResultPage;
