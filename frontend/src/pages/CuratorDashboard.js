import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import TimeRangeFilter from '../components/TimeRangeFilter';
import StudentsMissingTestsWidget from '../components/StudentsMissingTestsWidget';

export default function CuratorDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ group: '', teacher: '' });
  const [filterOptions, setFilterOptions] = useState({ groups: [], teachers: [] });
  const [activeTests, setActiveTests] = useState({ writing_tests: [], listening_tests: [], reading_tests: [] });
  const [testFilters, setTestFilters] = useState({ writing: '', listening: '', reading: '' });
  const [timeRange, setTimeRange] = useState({ label: 'last_2_weeks' });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filters.group) params.group = filters.group;
      if (filters.teacher) params.teacher = filters.teacher;
      if (testFilters.writing) params.writing = testFilters.writing;
      if (testFilters.listening) params.listening = testFilters.listening;
      if (testFilters.reading) params.reading = testFilters.reading;
      if (timeRange?.date_from) params.date_from = timeRange.date_from;
      if (timeRange?.date_to) params.date_to = timeRange.date_to;
      const res = await api.get('/curator/overview/', { params });
      setData(res.data);
    } catch (e) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [
    filters.group,
    filters.teacher,
    testFilters.writing,
    testFilters.listening,
    testFilters.reading,
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
        <h1 className="text-2xl font-bold">Overview</h1>
        <div className="flex space-x-3">
          <button
            onClick={() => navigate('/curator/test-comparison')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Compare Tests
          </button>
          <button
          onClick={async () => {
            try {
              const params = new URLSearchParams();
              if (filters.group) params.append('group', filters.group);
              if (filters.teacher) params.append('teacher', filters.teacher);
              if (testFilters.writing) params.append('writing', testFilters.writing);
              if (testFilters.listening) params.append('listening', testFilters.listening);
              if (testFilters.reading) params.append('reading', testFilters.reading);
              
              const response = await api.get(`/curator/overview-export-csv/?${params.toString()}`, {
                responseType: 'blob'
              });
              
              const blob = new Blob([response.data], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `overview_export_${new Date().toISOString().split('T')[0]}.csv`;
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

      <div className="bg-white rounded-lg shadow p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select className="border rounded px-3 py-2" value={testFilters.writing} onChange={e => setTestFilters({ ...testFilters, writing: e.target.value })}>
          <option value="">All Writing Tests</option>
          {activeTests.writing_tests.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        <select className="border rounded px-3 py-2" value={testFilters.listening} onChange={e => setTestFilters({ ...testFilters, listening: e.target.value })}>
          <option value="">All Listening Tests</option>
          {activeTests.listening_tests.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        <select className="border rounded px-3 py-2" value={testFilters.reading} onChange={e => setTestFilters({ ...testFilters, reading: e.target.value })}>
          <option value="">All Reading Tests</option>
          {activeTests.reading_tests.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
      </div>
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
      </div>
      <div className="mb-6">
        <StudentsMissingTestsWidget filters={filters} timeRange={timeRange} />
      </div>

      {loading && <div>Loading...</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && data && (
        <div className="space-y-6">
          {/* Overall Statistics */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Overall Statistics</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPI title="Total Students" value={data.overview.total_students} />
              <KPI title="Writing Completion" value={`${data.overview.completion_rates.writing}%`} />
              <KPI title="Listening Completion" value={`${data.overview.completion_rates.listening}%`} />
              <KPI title="Reading Completion" value={`${data.overview.completion_rates.reading}%`} />
            </div>
          </div>

          {/* Average Scores */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Average Scores</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPI title="Avg Writing Score" value={data.overview.average_scores.writing || '-'} />
              <KPI title="Avg Listening Score" value={data.overview.average_scores.listening || '-'} />
              <KPI title="Avg Reading Score" value={data.overview.average_scores.reading || '-'} />
              <KPI title="Avg Speaking Score" value={data.overview.average_scores.speaking || '-'} />
            </div>
          </div>

          {/* Score Distributions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Score Distributions</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Writing Score Distribution */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Writing Scores</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>High (7.0+)</span>
                    <span className="font-semibold text-green-600">{data.overview.score_distributions.writing.high}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Medium (5.0-6.9)</span>
                    <span className="font-semibold text-yellow-600">{data.overview.score_distributions.writing.medium}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Low (&lt;5.0)</span>
                    <span className="font-semibold text-red-600">{data.overview.score_distributions.writing.low}</span>
                  </div>
                </div>
              </div>

              {/* Listening Score Distribution */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Listening Scores</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>High (30+)</span>
                    <span className="font-semibold text-green-600">{data.overview.score_distributions.listening.high}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Medium (20-29)</span>
                    <span className="font-semibold text-yellow-600">{data.overview.score_distributions.listening.medium}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Low (&lt;20)</span>
                    <span className="font-semibold text-red-600">{data.overview.score_distributions.listening.low}</span>
                  </div>
                </div>
              </div>

              {/* Reading Score Distribution */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Reading Scores</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>High (7.0+)</span>
                    <span className="font-semibold text-green-600">{data.overview.score_distributions.reading.high}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Medium (5.0-6.9)</span>
                    <span className="font-semibold text-yellow-600">{data.overview.score_distributions.reading.medium}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Low (&lt;5.0)</span>
                    <span className="font-semibold text-red-600">{data.overview.score_distributions.reading.low}</span>
                  </div>
                </div>
              </div>

              {/* Speaking Score Distribution */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Speaking Scores</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>High (7.0+)</span>
                    <span className="font-semibold text-green-600">{data.overview.score_distributions.speaking.high}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Medium (5.0-6.9)</span>
                    <span className="font-semibold text-yellow-600">{data.overview.score_distributions.speaking.medium}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Low (&lt;5.0)</span>
                    <span className="font-semibold text-red-600">{data.overview.score_distributions.speaking.low}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Group Statistics */}
          {data.group_statistics && data.group_statistics.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Group Statistics</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Students</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Writing Completed</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Writing Rate</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Listening Completed</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Listening Rate</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reading Completed</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reading Rate</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Speaking Completed</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Speaking Rate</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.group_statistics.map((group, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{group.group}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{group.total_students}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{group.writing_completed}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{group.writing_rate}%</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{group.listening_completed}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{group.listening_rate}%</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{group.reading_completed}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{group.reading_rate}%</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{group.speaking_completed}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{group.speaking_rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Teacher Statistics */}
          {data.teacher_statistics && data.teacher_statistics.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Teacher Statistics</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Students</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Writing Completed</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Writing Rate</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Listening Completed</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Listening Rate</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reading Completed</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reading Rate</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Speaking Completed</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Speaking Rate</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.teacher_statistics.map((teacher, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{teacher.teacher}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{teacher.total_students}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{teacher.writing_completed}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{teacher.writing_rate}%</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{teacher.listening_completed}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{teacher.listening_rate}%</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{teacher.reading_completed}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{teacher.reading_rate}%</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{teacher.speaking_completed}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{teacher.speaking_rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Detailed Test Information */}
          {data.detailed_tests && Object.keys(data.detailed_tests).length > 0 && (
            <div className="space-y-6">
              {data.detailed_tests.writing && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-bold mb-4">Writing Test: {data.detailed_tests.writing.test_title}</h2>
                  
                  {/* Test Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <KPI title="Total Sessions" value={data.detailed_tests.writing.total_sessions} />
                    <KPI title="Completed Sessions" value={data.detailed_tests.writing.completed_sessions} />
                    <KPI title="Essays with Feedback" value={data.detailed_tests.writing.essays_with_feedback} />
                    <KPI title="Average Score" value={data.detailed_tests.writing.average_score || '-'} />
                  </div>

                  {/* Students Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sessions</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Essays</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Feedback</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Published</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Activity</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {data.detailed_tests.writing.students.map((student, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-2 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{student.name}</div>
                              <div className="text-sm text-gray-500">{student.student_id}</div>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{student.group}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{student.teacher}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{student.sessions_count}</td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                student.completed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {student.completed ? 'Yes' : 'No'}
                              </span>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{student.essays_count}</td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                student.has_feedback ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {student.has_feedback ? 'Yes' : 'No'}
                              </span>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                student.published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {student.published ? 'Yes' : 'No'}
                              </span>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{student.score || '-'}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{student.last_activity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {data.detailed_tests.listening && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-bold mb-4">Listening Test: {data.detailed_tests.listening.test_title}</h2>
                  
                  {/* Test Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <KPI title="Total Sessions" value={data.detailed_tests.listening.total_sessions} />
                    <KPI title="Submitted Sessions" value={data.detailed_tests.listening.submitted_sessions} />
                    <KPI title="Average Score" value={data.detailed_tests.listening.average_score || '-'} />
                    <KPI title="Average Band" value={data.detailed_tests.listening.average_band || '-'} />
                  </div>

                  {/* Students Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sessions</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Band Score</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Activity</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {data.detailed_tests.listening.students.map((student, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-2 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{student.name}</div>
                              <div className="text-sm text-gray-500">{student.student_id}</div>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{student.group}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{student.teacher}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{student.sessions_count}</td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                student.submitted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {student.submitted ? 'Yes' : 'No'}
                              </span>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{student.score || '-'}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{student.band_score || '-'}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{student.last_activity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {data.detailed_tests.reading && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-bold mb-4">Reading Test: {data.detailed_tests.reading.test_title}</h2>
                  
                  {/* Test Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <KPI title="Total Sessions" value={data.detailed_tests.reading.total_sessions} />
                    <KPI title="Completed Sessions" value={data.detailed_tests.reading.completed_sessions} />
                    <KPI title="Average Raw Score" value={data.detailed_tests.reading.average_raw_score || '-'} />
                    <KPI title="Average Band" value={data.detailed_tests.reading.average_band || '-'} />
                  </div>

                  {/* Students Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sessions</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Raw Score</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Band Score</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Activity</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {data.detailed_tests.reading.students.map((student, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-2 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{student.name}</div>
                              <div className="text-sm text-gray-500">{student.student_id}</div>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{student.group}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{student.teacher}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{student.sessions_count}</td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                student.completed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {student.completed ? 'Yes' : 'No'}
                              </span>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{student.raw_score || '-'}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{student.band_score || '-'}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{student.last_activity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
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
