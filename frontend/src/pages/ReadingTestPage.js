import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ReadingTimer from '../components/ReadingTimer';
import TestLayout from '../components/TestLayout';

const ReadingTestPage = () => {
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
    axios.post(`/api/reading/tests/${id}/start/`, {}, {
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

  const handleChange = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [`${questionId}__${value}`]: value }));
  };

  const handleSubmit = () => {
    if (submitting || !sessionId) return;
    setSubmitting(true);
    const token = localStorage.getItem('token');
    axios.post(`/api/reading/sessions/${sessionId}/submit/`, { answers }, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(res => {
        navigate(`/reading-result/${sessionId}`);
      })
      .catch(err => {
        setError('Ошибка при отправке теста. Пожалуйста, попробуйте еще раз.');
        console.error("Submit error:", err.response ? err.response.data : err);
        setSubmitting(false);
      });
  };

  if (loading) return <p className="p-4 flex justify-center items-center h-screen">Loading test...</p>;
  if (error) return <p className="p-4 text-red-600 flex justify-center items-center h-screen">{error}</p>;
  if (!test) return <p className="p-4 text-red-600 flex justify-center items-center h-screen">Ошибка загрузки теста.</p>;

  const timeLimit = test.time_limit ? test.time_limit * 60 : 60 * 60;

  const renderLeftPanel = () => (
    <div>
      <h3 className="text-xl font-bold mb-4">Reading Passage</h3>
      <div className="prose max-w-none">
        {test.passage?.text || "The reading passage is not available."}
      </div>
    </div>
  );

  const renderRightPanel = () => (
    <div>
      <h3 className="text-xl font-bold mb-4">Questions</h3>
      {(test.questions || []).map(q => (
        <div key={q.id} className="mb-6 pb-4 border-b">
          <p className="font-medium mb-2">Q{q.order}. {q.question_text}</p>
          {q.image && (
            <img src={q.image} alt={`Question ${q.order}`} className="my-2 max-w-sm rounded border" />
          )}
          
          {q.question_type === 'MULTIPLE_CHOICE' || (q.options && q.options.length > 0) ? (
            q.options.map(opt => (
              <label key={opt.id || opt.label} className="block mt-1 cursor-pointer p-2 rounded hover:bg-gray-100">
                <input
                  type="radio"
                  name={`question-${q.id}`}
                  value={opt.label}
                  checked={answers[`${q.id}__${opt.label}`] === opt.label}
                  onChange={() => handleChange(q.id, opt.label)}
                  className="mr-3"
                  disabled={submitting}
                />
                {opt.label}. {opt.text}
              </label>
            ))
          ) : (
            <input
              type="text"
              value={answers[`${q.id}__0`] || ""}
              onChange={(e) => handleChange(q.id, e.target.value)}
              placeholder="Your answer"
              className="mt-1 w-full p-2 border rounded"
              disabled={submitting}
            />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <TestLayout
      title={test.title}
      timer={<ReadingTimer onTimeUp={handleSubmit} initialSeconds={timeLimit} />}
      leftPanel={renderLeftPanel()}
      rightPanel={renderRightPanel()}
      onSubmit={handleSubmit}
      isSubmitting={submitting}
    />
  );
};

export default ReadingTestPage; 