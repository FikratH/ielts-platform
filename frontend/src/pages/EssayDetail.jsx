import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function EssayDetail() {
  const { id } = useParams();
  const [essay, setEssay] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEssay = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`/api/essays/${id}/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setEssay(res.data);
      } catch (err) {
        console.error('Failed to fetch essay:', err);
      }
    };
    fetchEssay();
  }, [id]);

  if (!essay) return <p className="p-6">Загрузка...</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Детали эссе</h1>
      <p><strong>Дата:</strong> {new Date(essay.submitted_at).toLocaleString()}</p>
      <p><strong>Task:</strong> {essay.task_type}</p>
      <p><strong>Оценки:</strong></p>
      <ul className="mb-4">
        <li>Task Achievement: {essay.score_task}</li>
        <li>Coherence: {essay.score_coherence}</li>
        <li>Lexical Resource: {essay.score_lexical}</li>
        <li>Grammar: {essay.score_grammar}</li>
        <li><strong>Band Score:</strong> {essay.overall_band}</li>
      </ul>
      <p><strong>Текст эссе:</strong></p>
      <pre className="bg-gray-100 p-4 whitespace-pre-wrap mb-4">{essay.submitted_text}</pre>
      <p><strong>Обратная связь:</strong></p>
      <pre className="bg-yellow-100 p-4 whitespace-pre-wrap mb-4">{essay.feedback}</pre>
      <button onClick={() => navigate('/dashboard')} className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-xl">
        Назад
      </button>
    </div>
  );
}
