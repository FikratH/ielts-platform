import React, { useEffect, useState, useCallback } from 'react';
import api from '../api';
import TimeRangeFilter from '../components/TimeRangeFilter';

export default function CuratorReadingPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ group: '', teacher: '' });
  const [filterOptions, setFilterOptions] = useState({ groups: [], teachers: [] });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(30);
  const [totalPages, setTotalPages] = useState(1);
  const [timeRange, setTimeRange] = useState({ label: 'last_2_weeks' });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filters.group) params.group = filters.group;
      if (filters.teacher) params.teacher = filters.teacher;
      params.page = page;
      params.page_size = pageSize;
      if (timeRange?.date_from) params.date_from = timeRange.date_from;
      if (timeRange?.date_to) params.date_to = timeRange.date_to;
      const res = await api.get('/curator/reading-overview/', { params });
      setData(res.data);
      const p = res.data.recent_pagination;
      if (p) setTotalPages(p.total_pages || 1);
    } catch (e) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [filters.group, filters.teacher, page, pageSize, timeRange]);

  const loadFilterOptions = useCallback(async () => {
    try {
      const res = await api.get('/curator/students/');
      setFilterOptions(res.data.filter_options);
    } catch (e) {
      console.error('Failed to load filter options:', e);
    }
  }, []);

  useEffect(() => { 
    loadData(); 
    loadFilterOptions();
  }, [loadData, loadFilterOptions]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Reading Overview</h1>
        <button
          onClick={async () => {
            try {
              const params = new URLSearchParams();
              if (filters.group) params.append('group', filters.group);
              if (filters.teacher) params.append('teacher', filters.teacher);
              
              const response = await api.get(`/admin/reading-test/all/export-csv/?${params.toString()}`, {
                responseType: 'blob'
              });
              
              const blob = new Blob([response.data], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `reading_export_${new Date().toISOString().split('T')[0]}.csv`;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
            } catch (error) {
              console.error('Export error:', error);
              alert('Failed to export CSV');
            }
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Export CSV
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select className="border rounded px-3 py-2" value={filters.group} onChange={e => setFilters({ ...filters, group: e.target.value })}>
          <option value="">All groups</option>
          {filterOptions.groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className="border rounded px-3 py-2" value={filters.teacher} onChange={e => setFilters({ ...filters, teacher: e.target.value })}>
          <option value="">All teachers</option>
          {filterOptions.teachers.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
      </div>

      {loading && <div>Loading...</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && data && (
        <div className="space-y-6">
          {/* Basic Statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPI title="Completed Sessions" value={data.statistics.completed_sessions} />
            <KPI title="Students with Sessions" value={data.statistics.students_with_sessions} />
            <KPI title="Avg Sessions per Student" value={data.statistics.avg_sessions_per_student} />
            <KPI title="Overall Accuracy" value={`${data.statistics.overall_accuracy}%`} />
          </div>

          {/* Performance Distribution */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KPI title="High Performers (7.0+)" value={data.statistics.performance_distribution.high_performers} />
            <KPI title="Medium Performers (5.0-6.9)" value={data.statistics.performance_distribution.medium_performers} />
            <KPI title="Low Performers (<5.0)" value={data.statistics.performance_distribution.low_performers} />
          </div>

          {/* Score Distribution */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KPI title="High Scores (80%+)" value={data.statistics.score_distribution.high_scores} />
            <KPI title="Medium Scores (60-79%)" value={data.statistics.score_distribution.medium_scores} />
            <KPI title="Low Scores (<60%)" value={data.statistics.score_distribution.low_scores} />
          </div>

          {/* Average Scores */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KPI title="Avg Raw Score" value={data.statistics.average_scores?.raw_score ?? '-'} />
            <KPI title="Avg Total Score" value={data.statistics.average_scores?.total_score ?? '-'} />
            <KPI title="Avg Band Score" value={data.statistics.average_scores?.band_score || '-'} />
          </div>

          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <Th>Student</Th>
                  <Th>Group</Th>
                  <Th>Teacher</Th>
                  <Th>Test</Th>
                  <Th>Raw/Total</Th>
                  <Th>Band</Th>
                  <Th>Completed</Th>
                </tr>
              </thead>
              <tbody>
                {data.recent_sessions.map(s => (
                  <tr key={s.id} className="border-t">
                    <Td>{s.student_name}</Td>
                    <Td>{s.group || '-'}</Td>
                    <Td>{s.teacher || '-'}</Td>
                    <Td>{s.test_title}</Td>
                    <Td>{s.raw_score}/{s.total_score}</Td>
                    <Td>{s.band_score ?? '-'}</Td>
                    <Td>{s.completed_at ? new Date(s.completed_at).toLocaleString() : '-'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between p-3 border-t bg-white">
              <div className="text-sm text-gray-500">Page {page} of {totalPages}</div>
              <div className="flex gap-2">
                <button className="px-3 py-1 border rounded disabled:opacity-50" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1}>Prev</button>
                <button className="px-3 py-1 border rounded disabled:opacity-50" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages}>Next</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KPI({ title, value }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-2xl font-bold text-gray-800">{value ?? '-'}</div>
    </div>
  );
}

function Th({ children }) { return <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2">{children}</th>; }
function Td({ children }) { return <td className="px-4 py-2 text-sm text-gray-800">{children}</td>; }
