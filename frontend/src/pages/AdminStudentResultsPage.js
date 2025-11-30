import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AdminStudentResultsPage() {
  const [studentId, setStudentId] = useState('');
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemDetails, setItemDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  
  // Данные как в Dashboard
  const [listeningSessions, setListeningSessions] = useState([]);
  const [readingSessions, setReadingSessions] = useState([]);
  const [essays, setEssays] = useState([]);
  
  const navigate = useNavigate();

  const fetchStudentResults = async () => {
    if (!studentId.trim()) {
      alert('Please enter a Student ID');
      return;
    }

    setLoading(true);
    setSearched(true);
    
    try {
      // Получаем данные студента
      const studentResponse = await api.get(`/admin/student-results/?student_id=${studentId}`);
      setStudent(studentResponse.data.student);
      
      // Получаем Listening сессии
      const listeningResponse = await api.get(`/admin/listening-sessions/?student_id=${studentId}`);
      setListeningSessions(listeningResponse.data);
      
      // Получаем Reading сессии  
      const readingResponse = await api.get(`/admin/reading-sessions/?student_id=${studentId}`);
      setReadingSessions(readingResponse.data);
      
      // Получаем Writing эссе
      const essaysResponse = await api.get(`/admin/essays/?student_id=${studentId}`);
      setEssays(essaysResponse.data);
      
    } catch (err) {
      console.error('Error loading student results:', err);
      if (err.response?.status === 404) {
        alert('Student not found');
      } else {
        alert('Failed to load student results');
      }
      setStudent(null);
      setListeningSessions([]);
      setReadingSessions([]);
      setEssays([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetails = async (item) => {
    setSelectedItem(item);
    if (item.type === 'Listening') {
      setDetailsLoading(true);
      try {
        const res = await api.get(`/admin/listening-sessions/${item.item.id}/`);
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
        const res = await api.get(`/admin/reading-sessions/${item.item.id}/`);
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
        test_title: `Writing Task ${item.task_type.toUpperCase()}`,
    }))
  ].sort((a, b) => {
    const dateA = a.date ? new Date(a.date) : new Date(0);
    const dateB = b.date ? new Date(b.date) : new Date(0);
    return dateB - dateA;
  });

  const getStats = () => {
    const scores = [
      ...essays.map(e => e.overall_band).filter(Boolean),
      ...listeningSessions.map(l => l.band_score).filter(Boolean),
      ...readingSessions.map(r => r.band_score).filter(Boolean)
    ];
    const avg = scores.length ? (scores.reduce((a, b) => a + b) / scores.length).toFixed(1) : '-';
    const max = scores.length ? Math.max(...scores).toFixed(1) : '-';
    return { count: scores.length, avg, max };
  };

  const { count, avg, max } = getStats();

  if (loading) {
    return (
      <div className="p-3 sm:p-4 md:p-8 lg:p-10 max-w-full md:max-w-5xl mx-auto">
        <LoadingSpinner fullScreen text="Loading..." />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-8 lg:p-10 max-w-full md:max-w-5xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Student Results</h1>
      
      <div className="mb-6 flex gap-2">
        <input
          type="text"
          placeholder="Enter Student ID"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="border p-2 rounded w-full md:w-80"
        />
        <button
          onClick={fetchStudentResults}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          disabled={loading}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {!loading && searched && student && (
        <>
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">
              {student.first_name} {student.last_name} ({student.student_id})
            </h2>
            <p className="text-gray-600">{student.email}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8">
            <StatCard title="Tests Taken" value={count} />
            <StatCard title="Average Score" value={avg} />
            <StatCard title="Best Result" value={max} />
          </div>

          <h2 className="text-lg sm:text-xl font-semibold mb-2">Test History</h2>
          
          {/* Mobile: карточки, Desktop: таблица */}
          <div className="block sm:hidden space-y-3 mb-6">
            {allSessions.map((item, idx) => (
              <div key={idx} className="bg-white rounded-xl shadow border p-3 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">{item.date ? new Date(item.date).toLocaleString() : 'No date'}</span>
                  <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-50 text-blue-700">{item.type}</span>
                </div>
                <div className="text-sm font-semibold text-gray-800">{item.test_title || 'Practice'}</div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-gray-500">Band: <span className="font-bold text-gray-800">{item.band_score || 'N/A'}</span></span>
                  <button onClick={() => handleOpenDetails(item)} className="text-indigo-600 hover:text-indigo-900 text-xs font-semibold">Details</button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden sm:block w-full overflow-x-auto">
            <table className="min-w-[600px] w-full border rounded-xl overflow-hidden text-sm sm:text-base">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-2 sm:px-4 py-2 text-left">Date</th>
                  <th className="px-2 sm:px-4 py-2 text-left">Section</th>
                  <th className="px-2 sm:px-6 py-2 text-left">Test</th>
                  <th className="px-2 sm:px-6 py-2 text-left">Band Score</th>
                  <th className="px-2 sm:px-6 py-2 text-left"></th>
                </tr>
              </thead>
              <tbody>
                {allSessions.map((item, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="px-2 sm:px-4 py-2 whitespace-nowrap">{item.date ? new Date(item.date).toLocaleString() : 'No date'}</td>
                    <td className="px-2 sm:px-4 py-2 whitespace-nowrap font-bold">{item.type}</td>
                    <td className="px-2 sm:px-6 py-4 whitespace-nowrap">{item.test_title || 'Practice'}</td>
                    <td className="px-2 sm:px-6 py-4 whitespace-nowrap font-bold">{item.band_score || 'N/A'}</td>
                    <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-right font-medium">
                      <button onClick={() => handleOpenDetails(item)} className="text-indigo-600 hover:text-indigo-900">Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && searched && !student && (
        <p className="text-center text-gray-500">No student found with this ID.</p>
      )}

      {/* Reading Modal */}
      {selectedItem && selectedItem.type === 'Reading' && (
        <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl p-3 sm:p-6 max-w-full sm:max-w-2xl md:max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg sm:text-xl font-bold">Reading Test Results — {selectedItem.date?.slice(0, 10)}</h3>
              <button onClick={handleCloseDetails} className="text-red-600 hover:underline">Close</button>
            </div>
            {detailsLoading ? (
              <div className="text-center py-4">
                <LoadingSpinner text="Loading..." />
              </div>
            ) : itemDetails ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6">
                  <div className="p-3 sm:p-4 bg-green-100 rounded-lg">
                    <p className="text-xs sm:text-sm text-green-800">Score</p>
                    <p className="text-lg sm:text-2xl font-bold text-green-900">{itemDetails.raw_score} / {itemDetails.total_score}</p>
                  </div>
                  <div className="p-3 sm:p-4 bg-blue-100 rounded-lg">
                    <p className="text-xs sm:text-sm text-blue-800">Band Score</p>
                    <p className="text-lg sm:text-2xl font-bold text-blue-900">{itemDetails.band_score}</p>
                  </div>
                </div>

                                 <div className="mb-4">
                   <button
                     onClick={() => navigate(`/admin/reading-result/${selectedItem.item.id}`)}
                     className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-base hover:bg-blue-700"
                   >
                     View Full Results
                   </button>
                 </div>
              </>
            ) : <p>Failed to load details.</p>}
          </div>
        </div>
      )}

      {/* Listening Modal */}
      {selectedItem && selectedItem.type === 'Listening' && (
        <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl p-3 sm:p-6 max-w-full sm:max-w-2xl md:max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg sm:text-xl font-bold">Results: {selectedItem.test_title}</h3>
              <button onClick={handleCloseDetails} className="text-red-600 hover:underline">Close</button>
            </div>

            {detailsLoading ? (
              <div className="text-center py-4">
                <LoadingSpinner text="Loading..." />
              </div>
            ) : itemDetails ? (
              <>
                <div className="mt-4 sm:mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-center">
                  <div className="p-3 sm:p-4 bg-blue-100 rounded-lg">
                    <p className="text-xs sm:text-sm text-blue-800">Correct Answers</p>
                    <p className="text-lg sm:text-2xl font-bold text-blue-900">{itemDetails.correct_answers_count} / {itemDetails.total_questions_count}</p>
                  </div>
                                     <div className="p-3 sm:p-4 bg-purple-100 rounded-lg">
                     <p className="text-xs sm:text-sm text-purple-800">Band Score</p>
                     <p className="text-lg sm:text-2xl font-bold text-purple-900">{itemDetails.band_score || 'Not scored'}</p>
                   </div>
                </div>

                                 <h3 className="mt-6 sm:mt-8 text-lg sm:text-xl font-bold border-b pb-2 mb-4 text-gray-700">Detailed Analysis</h3>
                 <p className="text-gray-500 text-center py-4">Detailed analysis not available.</p>

                                 <div className="mt-6">
                   <button
                     onClick={() => navigate(`/admin/listening-result/${selectedItem.item.id}`)}
                     className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-base hover:bg-blue-700"
                   >
                     View Full Results
                   </button>
                 </div>
              </>
            ) : <p>Failed to load details.</p>}
          </div>
        </div>
      )}

      {/* Writing Modal */}
      {selectedItem && selectedItem.type === 'Writing' && (
        <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl p-3 sm:p-6 max-w-full sm:max-w-2xl md:max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg sm:text-xl font-bold">Writing Task {selectedItem.item.task_type?.toUpperCase()} — {selectedItem.date?.slice(0, 10)}</h3>
              <button onClick={handleCloseDetails} className="text-red-600 hover:underline">Close</button>
            </div>

            {detailsLoading ? (
              <div className="text-center py-4">
                <LoadingSpinner text="Loading..." />
              </div>
            ) : itemDetails ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6">
                  <div className="p-3 sm:p-4 bg-blue-100 rounded-lg">
                    <p className="text-xs sm:text-sm text-blue-800">Overall Band</p>
                    <p className="text-lg sm:text-2xl font-bold text-blue-900">{itemDetails.overall_band || 'Not scored'}</p>
                  </div>
                  <div className="p-3 sm:p-4 bg-green-100 rounded-lg">
                    <p className="text-xs sm:text-sm text-green-800">Task Response</p>
                    <p className="text-lg sm:text-2xl font-bold text-green-900">{itemDetails.score_task || 'Not scored'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
                  <div className="p-3 sm:p-4 bg-purple-100 rounded-lg">
                    <p className="text-xs sm:text-sm text-purple-800">Coherence</p>
                    <p className="text-lg sm:text-2xl font-bold text-purple-900">{itemDetails.score_coherence || 'Not scored'}</p>
                  </div>
                  <div className="p-3 sm:p-4 bg-orange-100 rounded-lg">
                    <p className="text-xs sm:text-sm text-orange-800">Lexical</p>
                    <p className="text-lg sm:text-2xl font-bold text-orange-900">{itemDetails.score_lexical || 'Not scored'}</p>
                  </div>
                  <div className="p-3 sm:p-4 bg-red-100 rounded-lg">
                    <p className="text-xs sm:text-sm text-red-800">Grammar</p>
                    <p className="text-lg sm:text-2xl font-bold text-red-900">{itemDetails.score_grammar || 'Not scored'}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Question:</h4>
                  <p className="bg-gray-100 p-3 rounded mb-4">{itemDetails.question_text}</p>
                   
                  <h4 className="font-semibold mb-2">Essay:</h4>
                  <div className="bg-gray-100 p-3 rounded mb-4 max-h-40 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm">{itemDetails.submitted_text}</pre>
                  </div>

                  {itemDetails.feedback && (
                    <>
                      <h4 className="font-semibold mb-2">Feedback:</h4>
                      <div className="bg-blue-50 p-3 rounded mb-4">
                        <pre className="whitespace-pre-wrap text-sm">{itemDetails.feedback}</pre>
                      </div>
                    </>
                  )}
                </div>

                                 <div className="mb-4">
                   <button
                     onClick={() => navigate(`/admin/writing-result/${selectedItem.item.test_session}`)}
                     className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-base hover:bg-blue-700"
                   >
                     View Full Results
                   </button>
                 </div>
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
    <div className="bg-white shadow-md rounded-xl p-3 sm:p-4 text-center">
      <div className="text-lg sm:text-2xl font-bold mb-1">{value}</div>
      <div className="text-xs sm:text-sm text-gray-500 uppercase">{title}</div>
    </div>
  );
} 