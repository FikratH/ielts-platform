import React, { useEffect, useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

const StudentsMissingTestsWidget = ({ filters, timeRange }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const params = {};
        if (filters?.group) params.group = filters.group;
        if (filters?.teacher) params.teacher = filters.teacher;
        if (timeRange?.date_from) params.date_from = timeRange.date_from;
        if (timeRange?.date_to) params.date_to = timeRange.date_to;
        const res = await api.get('/curator/missing-tests/', { params });
        setData(res.data.students || []);
      } catch (e) {
        setError('Failed to load missing tests');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filters, timeRange]);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold">Students Missing Tests</h3>
          <p className="text-sm text-gray-500">Missing a required module in selected window</p>
        </div>
        <span className="text-xs text-gray-400">{data.length} students</span>
      </div>
      {loading && <div className="text-sm text-gray-500">Loading...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {!loading && !error && data.length === 0 && (
        <div className="text-sm text-gray-500">No missing tests found.</div>
      )}
      <div className="space-y-2">
        {data.slice(0, 5).map(student => (
          <button
            key={student.id}
            className="w-full text-left flex justify-between items-center text-sm text-gray-700 hover:bg-blue-50 rounded px-2 py-1"
            onClick={() => navigate(`/curator/student-detail/${student.id}`)}
          >
            <div>
              <div className="font-medium">{student.name}</div>
              <div className="text-xs text-gray-500">
                {student.student_id} · {student.group || 'No group'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-red-600">
                {student.missing_modules.join(', ')}
              </div>
              <div className="text-xs text-gray-400">
                {student.last_activity ? new Date(student.last_activity).toLocaleDateString() : 'No activity'}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default StudentsMissingTestsWidget;




