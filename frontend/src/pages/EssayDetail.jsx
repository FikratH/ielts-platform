import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

export default function EssayDetail() {
  const { id } = useParams();
  const [essay, setEssay] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEssay = async () => {
      try {
        const res = await api.get(`/essays/${id}/`);
        setEssay(res.data);
      } catch (err) {
        console.error('Failed to fetch essay:', err);
      }
    };
    fetchEssay();
  }, [id]);

  if (!essay) return <LoadingSpinner fullScreen text="Loading..." />;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Essay Details</h1>
      <p><strong>Date:</strong> {new Date(essay.submitted_at).toLocaleString()}</p>
      <p><strong>Scores:</strong></p>
      <ul className="mb-4">
        <li>Task Achievement: {essay.score_task}</li>
        <li>Coherence: {essay.score_coherence}</li>
        <li>Lexical Resource: {essay.score_lexical}</li>
        <li>Grammar: {essay.score_grammar}</li>
        <li><strong>Band Score:</strong> {essay.overall_band}</li>
      </ul>
      <p><strong>Essay text:</strong></p>
      <pre className="bg-gray-100 p-4 whitespace-pre-wrap mb-4">{essay.submitted_text}</pre>
      <p><strong>Feedback:</strong></p>
      <pre className="bg-yellow-100 p-4 whitespace-pre-wrap mb-4">{essay.feedback}</pre>
      <button onClick={() => navigate('/dashboard')} className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-xl">
        Back
      </button>
    </div>
  );
}
