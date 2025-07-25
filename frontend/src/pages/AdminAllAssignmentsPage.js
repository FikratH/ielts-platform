import { useState } from 'react';
import api from '../api';

export default function AdminAllAssignmentsPage() {
  const [studentId, setStudentId] = useState('');
  const [allAssignments, setAllAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemDetails, setItemDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const fetchAssignments = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const studentQuery = studentId ? `?student_id=${studentId}` : '';
      const [essaysRes, listeningRes] = await Promise.all([
        api.get(`/admin/essays/${studentQuery}`),
        api.get(`/admin/listening-sessions/${studentQuery}`)
      ]);

      const combined = [
        ...essaysRes.data.map(e => ({ type: 'Writing', date: e.submitted_at, score: e.overall_band, task: e.task_type?.toUpperCase(), item: e })),
        ...listeningRes.data.map(l => ({ type: 'Listening', date: l.completed_at, score: l.band_score, task: l.test_title, item: l }))
      ].sort((a, b) => new Date(b.date) - new Date(a.date));
      
      setAllAssignments(combined);
    } catch (err) {
      console.error('Error loading assignments:', err);
      alert('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetails = async (assignment) => {
    setSelectedItem(assignment);
    setItemDetails(assignment.item); 



    if (assignment.type === 'Listening') {
      setDetailsLoading(true);
      try {
        const res = await api.get(`/admin/listening-sessions/${assignment.item.id}/`);
        setItemDetails(res.data);
      } catch (err) {
        console.error("Failed to load session details", err);
        setItemDetails(null); 
      } finally {
        setDetailsLoading(false);
      }
    }
  };

  const handleCloseDetails = () => {
    setSelectedItem(null);
    setItemDetails(null);
  };
  


  const renderWritingDetails = () => (
    <>
      <div className="mb-4">
          <p className="font-semibold">Essay:</p>
          <pre className="bg-gray-100 p-2 rounded whitespace-pre-wrap text-sm">{itemDetails.submitted_text}</pre>
      </div>
      <div>
          <p className="font-semibold">Feedback:</p>
          <pre className="bg-gray-100 p-2 rounded whitespace-pre-wrap text-sm">{itemDetails.feedback}</pre>
      </div>
    </>
  );

  const renderListeningDetails = () => (
    <>
       <div className="p-4 bg-blue-100 rounded-lg text-center mb-4">
          <p className="text-sm text-blue-800">Result</p>
          <p className="text-2xl font-bold text-blue-900">{itemDetails.raw_score} / {itemDetails.total_questions}</p>
      </div>
      <div className="space-y-2">
        {itemDetails.question_feedback?.map((fb, i) => (
          <div key={i} className={`p-2 border-l-4 ${fb.is_correct ? 'border-green-500' : 'border-red-500'}`}>
            <p><strong>{i + 1}.</strong> {fb.question_text}</p>
            <p className={`${fb.is_correct ? 'text-green-700' : 'text-red-700'}`}>Your answer: {fb.user_answer}</p>
            {!fb.is_correct && <p className="text-gray-600">Correct: {fb.correct_answer}</p>}
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="p-10 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Student assignments search</h1>
      
      <div className="mb-6 flex gap-2">
        <input
          type="text"
          placeholder="Enter StudentID"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="border p-2 rounded w-full md:w-80"
        />
        <button
          onClick={fetchAssignments}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          disabled={loading}
        >
          {loading ? 'Searching...' : 'Find'}
        </button>
      </div>

      {loading && <p>Loading...</p>}
      
      {!loading && searched && (
        <>
          {allAssignments.length === 0 ? (
            <p>Nothing found.</p>
          ) : (
            <table className="w-full border rounded-xl overflow-hidden">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Section</th>
                  <th className="px-4 py-2 text-left">Assignment</th>
                  <th className="px-4 py-2 text-left">Score</th>
                  <th className="px-4 py-2 text-left"></th>
                </tr>
              </thead>
              <tbody>
                {allAssignments.map((h, idx) => (
                  <tr key={idx} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">{h.date?.slice(0, 10)}</td>
                    <td className="px-4 py-2">{h.type}</td>
                    <td className="px-4 py-2">{h.task}</td>
                    <td className="px-4 py-2 font-semibold">{h.score || '-'}</td>
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
          )}
        </>
      )}

      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto relative">
            <div className="flex justify-between items-start mb-4 pb-2 border-b">
                <h3 className="text-xl font-bold text-gray-800">Assignment details: {selectedItem.type}</h3>
                <button onClick={handleCloseDetails} className="text-3xl leading-none text-gray-400 hover:text-gray-700">&times;</button>
            </div>
            
            {detailsLoading ? (
              <p>Loading details...</p>
            ) : itemDetails ? (

                selectedItem.type === 'Listening' ? renderListeningDetails() :
                renderWritingDetails()
            ) : (
              <p className="text-red-500">Failed to load detailed information.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
