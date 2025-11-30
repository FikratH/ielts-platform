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
        
        // Загружаем teacher feedback, если есть
        try {
          const feedbackRes = await api.get(`/writing/essays/${id}/teacher-feedback/`);
          if (feedbackRes.data) {
            setEssay(prev => ({
              ...prev,
              teacher_feedback: feedbackRes.data
            }));
          }
        } catch (feedbackErr) {
          // Teacher feedback может не быть, это нормально
          console.log('No teacher feedback available');
        }
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* AI Scores */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 text-gray-800">AI Assessment</h3>
          <ul className="space-y-2">
            <li className="flex justify-between">
              <span>Task Achievement:</span>
              <span className="font-medium">{essay.score_task || 'Not scored'}</span>
            </li>
            <li className="flex justify-between">
              <span>Coherence:</span>
              <span className="font-medium">{essay.score_coherence || 'Not scored'}</span>
            </li>
            <li className="flex justify-between">
              <span>Lexical Resource:</span>
              <span className="font-medium">{essay.score_lexical || 'Not scored'}</span>
            </li>
            <li className="flex justify-between">
              <span>Grammar:</span>
              <span className="font-medium">{essay.score_grammar || 'Not scored'}</span>
            </li>
            <li className="flex justify-between border-t pt-2">
              <span className="font-semibold">Overall Band:</span>
              <span className="font-bold text-lg">{essay.overall_band || 'Not scored'}</span>
            </li>
          </ul>
        </div>

        {/* Teacher Scores */}
        {essay.teacher_feedback && (
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold mb-3 text-blue-800">Teacher Assessment</h3>
            <ul className="space-y-2">
              <li className="flex justify-between">
                <span>Task Response:</span>
                <span className="font-medium">{essay.teacher_feedback.teacher_task_score || 'Not scored'}</span>
              </li>
              <li className="flex justify-between">
                <span>Coherence:</span>
                <span className="font-medium">{essay.teacher_feedback.teacher_coherence_score || 'Not scored'}</span>
              </li>
              <li className="flex justify-between">
                <span>Lexical Resource:</span>
                <span className="font-medium">{essay.teacher_feedback.teacher_lexical_score || 'Not scored'}</span>
            </li>
              <li className="flex justify-between">
                <span>Grammar:</span>
                <span className="font-medium">{essay.teacher_feedback.teacher_grammar_score || 'Not scored'}</span>
              </li>
              <li className="flex justify-between border-t pt-2">
                <span className="font-semibold">Overall Band:</span>
                <span className="font-bold text-lg text-blue-600">{essay.teacher_feedback.teacher_overall_score || 'Not scored'}</span>
              </li>
            </ul>
          </div>
        )}
      </div>
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
