import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const WritingResultPage = () => {
  const { sessionId } = useParams();
  const [essays, setEssays] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`/api/essays/?session_id=${sessionId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setEssays(res.data);
      } catch (err) {
        console.error(err);
        alert("Ошибка при загрузке результатов");
        navigate("/dashboard");
      }
    };

    fetchResults();
  }, [sessionId, navigate]);

  if (essays.length === 0) return <p className="p-6">Загрузка...</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Результаты IELTS Writing</h2>
      {essays.map((essay) => (
        <div key={essay.id} className="mb-6 p-4 border rounded shadow-sm">
          <h3 className="text-lg font-semibold mb-2">Task: {essay.task_type.toUpperCase()}</h3>
          <p className="text-sm text-gray-500 mb-2 italic">Вопрос: {essay.question_text}</p>
          <p className="text-gray-800 whitespace-pre-line mb-4">{essay.submitted_text}</p>
          <p><strong>Task Response:</strong> {essay.score_task}</p>
          <p><strong>Coherence and Cohesion:</strong> {essay.score_coherence}</p>
          <p><strong>Lexical Resource:</strong> {essay.score_lexical}</p>
          <p><strong>Grammar:</strong> {essay.score_grammar}</p>
          <p><strong>Overall Band:</strong> {essay.overall_band}</p>
          <p className="mt-2"><strong>Feedback:</strong></p>
          <div className="bg-gray-100 p-3 rounded text-sm whitespace-pre-wrap break-words overflow-x-auto">{essay.feedback}</div>

        </div>
      ))}
    </div>
  );
};

export default WritingResultPage;
