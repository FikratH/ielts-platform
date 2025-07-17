import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { QuestionReview } from '../components/QuestionForm';

export default function Dashboard() {
  const [essays, setEssays] = useState([]);

  const [listeningSessions, setListeningSessions] = useState([]);
  const [readingSessions, setReadingSessions] = useState([]);
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
        const [essRes, listenRes, readingRes] = await Promise.all([
          axios.get('http://localhost:8000/api/essays/', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get('http://localhost:8000/api/listening/sessions/', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get('http://localhost:8000/api/reading/sessions/', {
            headers: { Authorization: `Bearer ${token}` },
          })
        ]);
        setEssays(essRes.data);
        setListeningSessions(listenRes.data);
        setReadingSessions(readingRes.data);
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
    if (item.type === 'Listening') {
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
    } else if (item.type === 'Reading') {
      setDetailsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`http://localhost:8000/api/reading-sessions/${item.item.id}/result/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setItemDetails(res.data);
      } catch (err) {
        console.error("Failed to load Reading session details", err);
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

  const allSessions = [
    ...listeningSessions.map(item => ({
        type: 'Listening',
        item,
        date: item.completed_at || item.started_at,
        raw_score: item.correct_answers_count,
        total_score: item.total_questions_count,
        band_score: item.band_score,
        test_title: item.test_title,
    })),
    ...readingSessions.map(item => ({
        type: 'Reading',
        item,
        date: item.submitted_at || item.start_time,
        raw_score: item.correct_answers_count,
        total_score: item.total_questions_count,
        band_score: item.band_score,
        test_title: item.test_title,
    })),
    ...essays.map(item => ({
        type: 'Writing',
        item,
        date: item.submitted_at,
        raw_score: null,
        total_score: null,
        band_score: item.overall_band,
        test_title: 'Writing Task',
    }))
  ].sort((a, b) => {
    const dateA = a.date ? new Date(a.date) : new Date(0);
    const dateB = b.date ? new Date(b.date) : new Date(0);
    return dateB - dateA;
  });


  const getStats = () => {
    const scores = [
      ...essays.map(e => e.overall_band).filter(Boolean),
      ...listeningSessions.map(l => l.score).filter(Boolean),
      ...readingSessions.map(r => r.band_score).filter(Boolean)
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
            <th className="px-4 py-2 text-left">Band Score</th>
            <th className="px-4 py-2 text-left"></th>
          </tr>
        </thead>
        <tbody>
          {allSessions.map((item, idx) => (
            <tr key={idx} className="border-t">
              <td className="px-4 py-2">{item.date ? new Date(item.date).toLocaleString() : 'No date'}</td>
              <td className="px-4 py-2">{item.type}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.test_title || 'Practice'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.band_score || 'N/A'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                {item.type === 'Reading' && item.item.id && (
                  <button onClick={() => navigate(`/reading-result/${item.item.id}`)} className="text-indigo-600 hover:text-indigo-900">Details</button>
                )}
                {item.type === 'Listening' && item.item.id && (
                  <button onClick={() => navigate(`/listening-result/${item.item.id}`)} className="text-indigo-600 hover:text-indigo-900">Details</button>
                )}
                {item.type === 'Writing' && (
                  <button onClick={() => handleOpenDetails(item)} className="text-indigo-600 hover:text-indigo-900">Details</button>
                )}
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
          <div className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Reading Test Results — {selectedItem.item.submitted_at?.slice(0, 10)}</h3>
              <button onClick={handleCloseDetails} className="text-red-600 hover:underline">Close</button>
            </div>
            {detailsLoading ? (
              <p className="text-center py-4">Loading details...</p>
            ) : itemDetails ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-green-100 rounded-lg">
                        <p className="text-sm text-green-800">Score</p>
                        <p className="text-2xl font-bold text-green-900">{itemDetails.raw_score} / {itemDetails.total_score}</p>
                    </div>
                    <div className="p-4 bg-blue-100 rounded-lg">
                        <p className="text-sm text-blue-800">Band Score</p>
                        <p className="text-2xl font-bold text-blue-900">{itemDetails.band_score}</p>
                    </div>
                </div>

                <div className="mb-4">
                  <button
                    onClick={() => navigate(`/reading-result/${selectedItem.item.id}`)}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    View Full Results
                  </button>
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
