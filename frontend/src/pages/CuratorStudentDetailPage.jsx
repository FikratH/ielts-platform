import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import TimeRangeFilter from '../components/TimeRangeFilter';

const formatDate = (value) => value ? new Date(value).toLocaleString() : 'N/A';

const ModulePanel = ({ title, stats, latest }) => (
  <div className="bg-white rounded-lg shadow p-4">
    <h3 className="text-lg font-semibold mb-3">{title}</h3>
    <div className="text-sm text-gray-500 mb-2">Sessions: {stats.sessions}</div>
    <div className="text-sm text-gray-500 mb-2">
      Latest: {latest ? formatDate(latest.date) : 'No activity'}
    </div>
    <div className="text-sm text-gray-700 space-y-1">
      {latest?.score !== undefined && <div>Score: {latest.score ?? '-'}</div>}
      {latest?.band !== undefined && <div>Band: {latest.band ?? '-'}</div>}
      {latest?.status && <div>Status: {latest.status}</div>}
    </div>
  </div>
);

const CuratorStudentDetailPage = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [timeRange, setTimeRange] = useState({ label: 'last_2_weeks' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      setError('');
      try {
        const params = {};
        if (timeRange?.date_from) params.date_from = timeRange.date_from;
        if (timeRange?.date_to) params.date_to = timeRange.date_to;
        const res = await api.get(`/curator/student-detail/${studentId}/`, { params });
        setDetail(res.data);
      } catch (e) {
        setError('Failed to load student detail');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [studentId, timeRange]);

  if (loading) {
    return <div className="p-6 text-center">Loading student data...</div>;
  }
  if (error) {
    return <div className="p-6 text-center text-red-600">{error}</div>;
  }

  const student = detail?.student || {};

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{student.first_name} {student.last_name}</h1>
          <p className="text-sm text-gray-500">ID: {student.student_id} · Group: {student.group || '—'} · Teacher: {student.teacher || '—'}</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 rounded border border-gray-200 text-sm hover:bg-gray-100"
        >
          ← Back
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div className="text-sm text-gray-500">Email: {student.email || '—'}</div>
          <div className="text-sm text-gray-500">Missing modules: {(detail?.missing_tests || []).join(', ') || 'None'}</div>
        </div>
        <div className="mt-3">
          <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ModulePanel
          title="Writing"
          stats={{ sessions: detail?.modules?.writing?.essays || 0 }}
          latest={{
            score: detail?.modules?.writing?.latest?.overall_band,
            band: detail?.modules?.writing?.latest?.overall_band,
            status: detail?.modules?.writing?.with_feedback ? 'Feedbacked' : 'Pending',
            date: detail?.modules?.writing?.latest?.submitted_at
          }}
        />
        <ModulePanel
          title="Listening"
          stats={{ sessions: detail?.modules?.listening?.sessions || 0 }}
          latest={{
            score: detail?.modules?.listening?.latest?.score,
            band: detail?.modules?.listening?.latest?.band,
            date: detail?.modules?.listening?.latest?.completed_at
          }}
        />
        <ModulePanel
          title="Reading"
          stats={{ sessions: detail?.modules?.reading?.sessions || 0 }}
          latest={{
            score: detail?.modules?.reading?.latest?.raw_score,
            band: detail?.modules?.reading?.latest?.band_score,
            date: detail?.modules?.reading?.latest?.end_time
          }}
        />
        <ModulePanel
          title="Speaking"
          stats={{ sessions: detail?.modules?.speaking?.sessions || 0 }}
          latest={{
            score: detail?.modules?.speaking?.latest?.overall_band_score,
            band: detail?.modules?.speaking?.latest?.overall_band_score,
            date: detail?.modules?.speaking?.latest?.conducted_at
          }}
        />
      </div>

      {detail?.missing_tests?.length > 0 && (
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <h3 className="text-lg font-semibold text-red-700 mb-2">Missing Tests</h3>
          <p className="text-sm text-red-600">Student has not completed these modules in the selected window: {detail.missing_tests.join(', ')}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Exports</h3>
        <button
          onClick={() => {
            window.open(`/curator/student-detail/${studentId}/?export=csv`, '_blank');
          }}
          className="px-4 py-2 rounded bg-blue-600 text-white text-sm"
        >
          Export CSV
        </button>
      </div>
    </div>
  );
};

export default CuratorStudentDetailPage;






