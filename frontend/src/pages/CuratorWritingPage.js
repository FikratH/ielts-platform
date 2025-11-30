import React, { useEffect, useState, useCallback } from 'react';
import api from '../api';
import TimeRangeFilter from '../components/TimeRangeFilter';

export default function CuratorWritingPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ group: '', teacher: '' });
  const [filterOptions, setFilterOptions] = useState({ groups: [], teachers: [] });
  const [activeTests, setActiveTests] = useState({ writing_tests: [] });
  const [testFilters, setTestFilters] = useState({ writing_test: '' });
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
      if (testFilters.writing_test) params.writing_test = testFilters.writing_test;
      params.page = page;
      params.page_size = pageSize;
      if (timeRange?.date_from) params.date_from = timeRange.date_from;
      if (timeRange?.date_to) params.date_to = timeRange.date_to;
      const res = await api.get('/curator/writing-overview/', { params });
      setData(res.data);
      const p = res.data.recent_pagination;
      if (p) setTotalPages(p.total_pages || 1);
    } catch (e) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [
    filters.group,
    filters.teacher,
    testFilters.writing_test,
    page,
    pageSize,
    timeRange
  ]);

  const loadFilterOptions = useCallback(async () => {
    try {
      const res = await api.get('/curator/students/');
      setFilterOptions(res.data.filter_options);
    } catch (e) {
      console.error('Failed to load filter options:', e);
    }
  }, []);

  const loadActiveTests = useCallback(async () => {
    try {
      const res = await api.get('/curator/active-tests/');
      setActiveTests(res.data);
    } catch (e) {
      console.error('Failed to load active tests:', e);
    }
  }, []);

  useEffect(() => { 
    loadData(); 
    loadFilterOptions();
    loadActiveTests();
  }, [loadData, loadFilterOptions, loadActiveTests]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Writing Overview</h1>
        <button
          onClick={async () => {
            try {
              const params = new URLSearchParams();
              if (filters.group) params.append('group', filters.group);
              if (filters.teacher) params.append('teacher', filters.teacher);
              if (testFilters.writing_test) params.append('writing_test', testFilters.writing_test);
              
              const response = await api.get(`/curator/writing-export-csv/?${params.toString()}`, {
                responseType: 'blob'
              });
              
              const blob = new Blob([response.data], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `writing_export_${new Date().toISOString().split('T')[0]}.csv`;
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

      <div className="bg-white rounded-lg shadow p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select className="w-full border rounded px-3 py-2" value={testFilters.writing_test} onChange={e => setTestFilters({ ...testFilters, writing_test: e.target.value })}>
          <option value="">All Writing Tests</option>
          {activeTests.writing_tests?.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
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
            <KPI title="Submitted Essays" value={data.statistics.submitted_essays} />
            <KPI title="Students with Essays" value={data.statistics.students_with_essays} />
            <KPI title="Avg Essays per Student" value={data.statistics.avg_essays_per_student} />
            <KPI title="Avg Overall Score" value={data.statistics.average_scores.overall} />
          </div>

          {/* Teacher Feedback Performance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPI title="Essays with Feedback" value={data.statistics.teacher_feedback.essays_with_feedback} />
            <KPI title="Essays Published" value={data.statistics.teacher_feedback.essays_published} />
            <KPI title="Essays Pending" value={data.statistics.teacher_feedback.essays_pending_feedback} />
            <KPI title="Feedback Rate" value={`${data.statistics.teacher_feedback.feedback_rate}%`} />
          </div>

          {/* Score Distribution */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KPI title="High Scores (7.0+)" value={data.statistics.score_distribution.high_scores} />
            <KPI title="Medium Scores (5.0-6.9)" value={data.statistics.score_distribution.medium_scores} />
            <KPI title="Low Scores (<5.0)" value={data.statistics.score_distribution.low_scores} />
          </div>

          {/* Detailed Average Scores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPI title="Avg Task Score" value={data.statistics.average_scores.task} />
            <KPI title="Avg Coherence" value={data.statistics.average_scores.coherence} />
            <KPI title="Avg Lexical" value={data.statistics.average_scores.lexical} />
            <KPI title="Avg Grammar" value={data.statistics.average_scores.grammar} />
          </div>

          {/* Teacher Performance Analytics */}
          {data.teacher_analytics && data.teacher_analytics.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <h3 className="text-lg font-semibold p-4 border-b">Teacher Performance</h3>
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <Th>Teacher</Th>
                    <Th>Students</Th>
                    <Th>Essays</Th>
                    <Th>Feedbacks Given</Th>
                    <Th>Published</Th>
                    <Th>Avg Score</Th>
                    <Th>Feedback Rate</Th>
                    <Th>Publish Rate</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.teacher_analytics.map((teacher, index) => (
                    <tr key={index} className="border-t">
                      <Td className="font-medium">{teacher.teacher_name}</Td>
                      <Td>{teacher.students_count}</Td>
                      <Td>{teacher.essays_count}</Td>
                      <Td>{teacher.feedbacks_given}</Td>
                      <Td>{teacher.feedbacks_published}</Td>
                      <Td>{teacher.avg_score || '-'}</Td>
                      <Td>{teacher.feedback_rate}%</Td>
                      <Td>{teacher.publish_rate}%</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Group Performance Analytics */}
          {data.group_analytics && data.group_analytics.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <h3 className="text-lg font-semibold p-4 border-b">Group Performance</h3>
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <Th>Group</Th>
                    <Th>Students</Th>
                    <Th>Essays</Th>
                    <Th>Feedbacks Given</Th>
                    <Th>Published</Th>
                    <Th>Avg Score</Th>
                    <Th>Feedback Rate</Th>
                    <Th>Publish Rate</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.group_analytics.map((group, index) => (
                    <tr key={index} className="border-t">
                      <Td className="font-medium">{group.group_name}</Td>
                      <Td>{group.students_count}</Td>
                      <Td>{group.essays_count}</Td>
                      <Td>{group.feedbacks_given}</Td>
                      <Td>{group.feedbacks_published}</Td>
                      <Td>{group.avg_score || '-'}</Td>
                      <Td>{group.feedback_rate}%</Td>
                      <Td>{group.publish_rate}%</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <Th>Student</Th>
                  <Th>Group</Th>
                  <Th>Teacher</Th>
                  <Th>Test</Th>
                  <Th>Task1</Th>
                  <Th>Task2</Th>
                  <Th>Submitted</Th>
                </tr>
              </thead>
              <tbody>
                {data.recent_sessions.map(s => (
                  <tr key={s.session_id} className="border-t">
                    <Td>{s.student_name}</Td>
                    <Td>{s.group || '-'}</Td>
                    <Td>{s.teacher || '-'}</Td>
                    <Td>{s.test_title}</Td>
                    <Td>
                      {s.task1?.exists ? (
                        <span className={`px-2 py-1 rounded text-xs ${s.task1.feedback?.published ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {s.task1.feedback?.published ? 'Published' : 'Draft'}
                          {s.task1.feedback?.overall != null && ` (${s.task1.feedback.overall})`}
                        </span>
                      ) : '-'}
                    </Td>
                    <Td>
                      {s.task2?.exists ? (
                        <span className={`px-2 py-1 rounded text-xs ${s.task2.feedback?.published ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {s.task2.feedback?.published ? 'Published' : 'Draft'}
                          {s.task2.feedback?.overall != null && ` (${s.task2.feedback.overall})`}
                        </span>
                      ) : '-'}
                    </Td>
                    <Td>{s.submitted_at ? new Date(s.submitted_at).toLocaleString() : '-'}</Td>
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
