import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { QuestionReview } from '../components/QuestionForm';

export default function Dashboard() {
  const [essays, setEssays] = useState([]);
  const [readingSessions, setReadingSessions] = useState([]);
  const [listeningSessions, setListeningSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemDetails, setItemDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAll = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const [essRes, readRes, listenRes] = await Promise.all([
          axios.get('http://localhost:8000/api/essays/', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get('http://localhost:8000/api/reading/sessions/', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get('http://localhost:8000/api/listening/sessions/', {
            headers: { Authorization: `Bearer ${token}` },
          })
        ]);
        setEssays(essRes.data);
        setReadingSessions(readRes.data);
        setListeningSessions(listenRes.data);
      } catch (err) {
        console.error('Ошибка при загрузке истории:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
    // --- ДОБАВЛЕНО: слушатель события обновления истории Listening ---
    const handleListeningHistoryUpdated = () => {
      fetchAll();
    };
    window.addEventListener('listeningHistoryUpdated', handleListeningHistoryUpdated);
    return () => {
      window.removeEventListener('listeningHistoryUpdated', handleListeningHistoryUpdated);
    };
  }, []);

  const handleOpenDetails = async (item) => {
    setSelectedItem(item);
    if (item.type === 'Reading') {
      setDetailsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`http://localhost:8000/api/reading/sessions/${item.item.id}/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setItemDetails(res.data);
      } catch (err) {
        console.error("Failed to load session details", err);
        setItemDetails(null); 
      } finally {
        setDetailsLoading(false);
      }
    } else if (item.type === 'Listening') {
      setDetailsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`http://localhost:8000/api/listening/sessions/${item.item.id}/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setItemDetails(res.data);
      } catch (err) {
        console.error("Failed to load session details", err);
        setItemDetails(null); 
      } finally {
        setDetailsLoading(false);
      }
    } else {
      setItemDetails(item.item);
    }
  };

  const handleCloseDetails = () => {
    setSelectedItem(null);
    setItemDetails(null);
  };

  const allHistory = [
    ...essays.map(e => ({
      type: 'Writing',
      date: e.submitted_at?.slice(0, 10),
      task: e.task_type?.toUpperCase(),
      score: e.overall_band || '-',
      item: e,
    })),
    ...readingSessions.map(r => ({
      type: 'Reading',
      date: r.completed_at?.slice(0, 10),
      task: r.test_title,
      score: r.band_score || '-',
      item: r,
    })),
    ...listeningSessions.map(l => ({
      type: 'Listening',
      date: l.started_at ? l.started_at.slice(0, 10) : '-',
      task: l.test_title || '-',
      score: l.score ?? '-',
      correct: l.correct_answers_count ?? '-',
      total: l.total_questions_count ?? '-',
      item: l,
    })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const getStats = () => {
    const scores = [
      ...essays.map(e => e.overall_band).filter(Boolean),
      ...readingSessions.map(r => r.band_score).filter(Boolean),
      ...listeningSessions.map(l => l.score).filter(Boolean)
    ];
    const avg = scores.length ? (scores.reduce((a, b) => a + b) / scores.length).toFixed(1) : '-';
    const max = scores.length ? Math.max(...scores).toFixed(1) : '-';
    return { count: scores.length, avg, max };
  };

  const { count, avg, max } = getStats();

  return (
    <div className="p-10 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">My Dashboard</h1>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard title="Tests Taken" value={count} />
        <StatCard title="Average Score" value={avg} />
        <StatCard title="Best Result" value={max} />
        <button
          onClick={() => navigate('/writing/start')}
          className="bg-blue-600 text-white rounded-xl px-4 py-2 hover:bg-blue-700"
        >
          Start New Test
        </button>
      </div>

      <h2 className="text-xl font-semibold mb-2">Test History</h2>
      <table className="w-full border rounded-xl overflow-hidden">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 text-left">Date</th>
            <th className="px-4 py-2 text-left">Section</th>
            <th className="px-4 py-2 text-left">Test</th>
            <th className="px-4 py-2 text-left">Score</th>
            <th className="px-4 py-2 text-left">Band Score</th>
            <th className="px-4 py-2 text-left"></th>
          </tr>
        </thead>
        <tbody>
          {allHistory.map((h, idx) => (
            <tr key={idx} className="border-t">
              <td className="px-4 py-2">{h.date}</td>
              <td className="px-4 py-2">{h.type}</td>
              <td className="px-4 py-2">{h.task}</td>
              <td className="px-4 py-2 font-semibold">{h.score}</td>
              <td className="px-4 py-2 font-semibold">
                {h.type === 'Listening' ? (h.item.band_score ?? '-') : h.type === 'Reading' ? (h.item.band_score ?? '-') : '-'}
              </td>
              <td className="px-4 py-2">
                <button
                  onClick={() => handleOpenDetails(h)}
                  className="text-blue-600 hover:underline"
                >
                  Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedItem && selectedItem.type === 'Writing' && (
        <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Writing — {selectedItem.item.submitted_at?.slice(0, 10)}</h3>
              <button onClick={handleCloseDetails} className="text-red-600 hover:underline">Close</button>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-600 font-semibold mb-1">Your Essay:</p>
              <pre className="bg-gray-100 p-3 rounded whitespace-pre-wrap text-sm overflow-x-auto">{selectedItem.item.submitted_text}</pre>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-600 font-semibold mb-1">AI Feedback:</p>
              <pre className="bg-gray-100 p-3 rounded whitespace-pre-wrap text-sm overflow-x-auto">{selectedItem.item.feedback}</pre>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>Task Response:</strong> {selectedItem.item.score_task}</div>
              <div><strong>Coherence:</strong> {selectedItem.item.score_coherence}</div>
              <div><strong>Lexical Resource:</strong> {selectedItem.item.score_lexical}</div>
              <div><strong>Grammar:</strong> {selectedItem.item.score_grammar}</div>
              <div className="col-span-2"><strong>Overall:</strong> {selectedItem.item.overall_band}</div>
            </div>
          </div>
        </div>
      )}

      {selectedItem && selectedItem.type === 'Reading' && (
        <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Results: {selectedItem.item.test_title}</h3>
              <button onClick={handleCloseDetails} className="text-red-600 hover:underline">Close</button>
            </div>

            {detailsLoading ? (
              <p>Loading details...</p>
            ) : itemDetails ? (
              <>
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                    <div className="p-4 bg-blue-100 rounded-lg">
                        <p className="text-sm text-blue-800">Correct Answers</p>
                        <p className="text-2xl font-bold text-blue-900">{itemDetails.raw_score} / {itemDetails.total_questions}</p>
                    </div>
                    <div className="p-4 bg-purple-100 rounded-lg">
                        <p className="text-sm text-purple-800">Band Score</p>
                        <p className="text-2xl font-bold text-purple-900">{itemDetails.band_score}</p>
                    </div>
                </div>

                <h3 className="mt-8 text-xl font-bold border-b pb-2 mb-4 text-gray-700">Detailed Analysis</h3>
                <div className="space-y-4">
                  {itemDetails.question_feedback && itemDetails.question_feedback.length > 0 ? (
                    itemDetails.question_feedback.map((feedback, index) => (
                      <div key={feedback.question_id} className={`p-4 border rounded-lg ${feedback.is_correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                        <div className="flex justify-between items-start">
                           <p className="font-semibold text-gray-800 pr-4">Question {index + 1}: {feedback.question_text}</p>
                           {feedback.is_correct ? (
                                <span className="flex-shrink-0 text-xs font-bold text-green-700 bg-green-200 px-2 py-1 rounded-full">Correct</span>
                           ) : (
                                <span className="flex-shrink-0 text-xs font-bold text-red-700 bg-red-200 px-2 py-1 rounded-full">Incorrect</span>
                           )}
                        </div>
                         <div className="mt-2 text-sm">
                             <p className="text-gray-600">Your answer: <span className={`font-medium ${feedback.is_correct ? 'text-green-800' : 'text-red-800'}`}>{feedback.user_answer || "No answer"}</span></p>
                             {!feedback.is_correct && <p className="text-gray-600 mt-1">Correct answer: <span className="font-medium text-blue-800">{feedback.correct_answer}</span></p>}
                         </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">Detailed analysis not available.</p>
                  )}
                </div>
              </>
            ) : <p>Failed to load details.</p>}
          </div>
        </div>
      )}

      {selectedItem && selectedItem.type === 'Listening' && (
        <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Results: {selectedItem.item.test_title}</h3>
              <button onClick={handleCloseDetails} className="text-red-600 hover:underline">Close</button>
            </div>

            {detailsLoading ? (
              <p>Loading details...</p>
            ) : itemDetails ? (
              <>
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                    <div className="p-4 bg-blue-100 rounded-lg">
                        <p className="text-sm text-blue-800">Correct Answers</p>
                        <p className="text-2xl font-bold text-blue-900">{itemDetails.correct_answers_count} / {itemDetails.total_questions_count}</p>
                    </div>
                    <div className="p-4 bg-purple-100 rounded-lg">
                        <p className="text-sm text-purple-800">Band Score</p>
                        <p className="text-2xl font-bold text-purple-900">{itemDetails.band_score}</p>
                    </div>
                </div>

                <h3 className="mt-8 text-xl font-bold border-b pb-2 mb-4 text-gray-700">Detailed Analysis</h3>
                {itemDetails.test_render_structure && Array.isArray(itemDetails.test_render_structure) ? (
                  <div className="space-y-8">
                    {itemDetails.test_render_structure.map((part, partIdx) => (
                      <div key={partIdx} className="border rounded-lg p-4 bg-gray-50">
                        <h4 className="text-lg font-semibold mb-3 text-gray-800">
                          Section {part.part_number}
                          {part.instructions && (
                            <span className="text-sm font-normal text-gray-600 ml-2">— {part.instructions}</span>
                          )}
                        </h4>
                        <div className="space-y-6">
                          {part.questions.map((q, qIdx) => (
                            <div key={q.id || qIdx} className="mb-6">
                              {q.header && <div className="font-semibold text-gray-700 mb-1">{q.header}</div>}
                              {q.instruction && <div className="text-xs text-gray-500 mb-1 italic">{q.instruction}</div>}
                              <QuestionReview question={q} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">Detailed analysis not available.</p>
                )}
              </>
            ) : <p>Failed to load details.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="bg-white shadow-md rounded-xl p-4 text-center">
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-sm text-gray-500 uppercase">{title}</div>
    </div>
  );
}
