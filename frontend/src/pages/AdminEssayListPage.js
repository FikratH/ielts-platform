import React, { useState } from 'react';
import axios from 'axios';

const AdminEssayListPage = () => {
  const [studentId, setStudentId] = useState('');
  const [essays, setEssays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEssay, setSelectedEssay] = useState(null);

  const fetchEssays = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:8000/api/admin/essays${studentId ? `?student_id=${studentId}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEssays(res.data);
    } catch (err) {
      console.error('Ошибка при загрузке эссе:', err);
      alert('Ошибка при получении данных');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Эссе студентов</h2>

      <div className="mb-6 flex gap-4 items-center">
        <input
          type="text"
          placeholder="Введите StudentID (например, student001)"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="border p-2 rounded w-80"
        />
        <button
          onClick={fetchEssays}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Показать
        </button>
      </div>

      {loading ? (
        <p>Загрузка...</p>
      ) : essays.length === 0 ? (
        <p className="text-gray-500">Нет данных</p>
      ) : (
        <table className="w-full border rounded-xl overflow-hidden">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left">Student ID</th>
              <th className="px-4 py-2 text-left">Дата</th>
              <th className="px-4 py-2 text-left">Task</th>
              <th className="px-4 py-2 text-left">Балл</th>
              <th className="px-4 py-2 text-left">Фидбек</th>
              <th className="px-4 py-2 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {essays.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="px-4 py-2 text-sm">{e.student_id}</td>
                <td className="px-4 py-2 text-sm">{e.submitted_at?.slice(0, 10)}</td>
                <td className="px-4 py-2 text-sm">{e.task_type.toUpperCase()}</td>
                <td className="px-4 py-2 font-semibold">{e.overall_band ?? '-'}</td>
                <td className="px-4 py-2 text-sm text-gray-600 max-w-xs truncate">{e.feedback?.slice(0, 150)}...</td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => setSelectedEssay(e)}
                    className="text-blue-600 hover:underline"
                  >
                    Подробнее
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedEssay && (
        <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{selectedEssay.task_type.toUpperCase()} — {selectedEssay.student_id}</h3>
              <button onClick={() => setSelectedEssay(null)} className="text-red-600 hover:underline">Закрыть</button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 font-semibold mb-1">Эссе:</p>
              <pre className="bg-gray-100 p-3 rounded whitespace-pre-wrap text-sm overflow-x-auto">{selectedEssay.submitted_text}</pre>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 font-semibold mb-1">Фидбек:</p>
              <pre className="bg-gray-100 p-3 rounded whitespace-pre-wrap text-sm overflow-x-auto">{selectedEssay.feedback}</pre>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>Task Response:</strong> {selectedEssay.score_task}</div>
              <div><strong>Coherence:</strong> {selectedEssay.score_coherence}</div>
              <div><strong>Lexical Resource:</strong> {selectedEssay.score_lexical}</div>
              <div><strong>Grammar:</strong> {selectedEssay.score_grammar}</div>
              <div className="col-span-2"><strong>Overall:</strong> {selectedEssay.overall_band}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminEssayListPage;
