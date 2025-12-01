import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import TimeRangeFilter from '../components/TimeRangeFilter';
import StudentsMissingTestsWidget from '../components/StudentsMissingTestsWidget';

export default function CuratorWeeklyOverviewPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('student');
  const [filters, setFilters] = useState({ group: '', teacher: '', search: '' });
  const [filterOptions, setFilterOptions] = useState({ groups: [], teachers: [] });
  const [activeTests, setActiveTests] = useState({ writing_tests: [], listening_tests: [], reading_tests: [] });
  const [selectedTests, setSelectedTests] = useState({ writing: '', listening: '', reading: '' });
  const [timeRange, setTimeRange] = useState({ label: 'all_time', date_from: '', date_to: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadFilterOptions = useCallback(async () => {
    try {
      const res = await api.get('/curator/students/');
      setFilterOptions(res.data.filter_options);
    } catch (e) {}
  }, []);

  const loadActiveTests = useCallback(async () => {
    try {
      const res = await api.get('/curator/active-tests/');
      setActiveTests(res.data);
    } catch (e) {}
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      params.mode = mode === 'student' ? 'group' : mode;
      if (filters.group) params.group = filters.group;
      if (filters.teacher) params.teacher = filters.teacher;
      if (filters.search && filters.search.trim()) params.search = filters.search.trim();
      if (selectedTests.writing) params.writing_test = selectedTests.writing;
      if (selectedTests.listening) params.listening_test = selectedTests.listening;
      if (selectedTests.reading) params.reading_test = selectedTests.reading;
      if (timeRange?.date_from) params.date_from = timeRange.date_from;
      if (timeRange?.date_to) params.date_to = timeRange.date_to;
      const res = await api.get('/curator/weekly-overview/', { params });
      setData(res.data);
    } catch (e) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [mode, filters.group, filters.teacher, filters.search, selectedTests.writing, selectedTests.listening, selectedTests.reading, timeRange]);

  useEffect(() => {
    loadFilterOptions();
    loadActiveTests();
  }, [loadFilterOptions, loadActiveTests]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentRows = () => {
    if (!data) return [];
    if (data.mode === 'teacher' && data.teachers) return data.teachers;
    if (data.mode === 'group' && data.groups) return data.groups;
    return [];
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      
        <div className="inline-flex rounded-full border border-gray-200 bg-gray-50 overflow-hidden text-xs">
          <button
            className={`px-4 py-2 ${mode === 'student' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-white'}`}
            onClick={() => setMode('student')}
          >
            By students
          </button>
          <button
            className={`px-4 py-2 border-l border-gray-200 ${mode === 'group' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-white'}`}
            onClick={() => setMode('group')}
          >
            By groups
          </button>
          <button
            className={`px-4 py-2 border-l border-gray-200 ${mode === 'teacher' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-white'}`}
            onClick={() => setMode('teacher')}
          >
            By teachers
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <div className="text-xs text-gray-500">Group</div>
            <select
              className="border rounded-md px-3 py-2 text-sm w-full"
              value={filters.group}
              onChange={e => setFilters(prev => ({ ...prev, group: e.target.value }))}
            >
              <option value="">All groups</option>
              {filterOptions.groups.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-gray-500">Teacher</div>
            <select
              className="border rounded-md px-3 py-2 text-sm w-full"
              value={filters.teacher}
              onChange={e => setFilters(prev => ({ ...prev, teacher: e.target.value }))}
            >
              <option value="">All teachers</option>
              {filterOptions.teachers.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-gray-500">Writing test</div>
            <select
              className="border rounded-md px-3 py-2 text-sm w-full"
              value={selectedTests.writing}
              onChange={e => setSelectedTests(prev => ({ ...prev, writing: e.target.value }))}
            >
              <option value="">All Writing Tests</option>
              {activeTests.writing_tests.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-gray-500">Search student</div>
            <input
              className="border rounded-md px-3 py-2 text-sm w-full"
              placeholder="Name, ID or email"
              value={filters.search}
              onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="space-y-1">
            <div className="text-xs text-gray-500">Listening test</div>
            <select
              className="border rounded-md px-3 py-2 text-sm w-full"
              value={selectedTests.listening}
              onChange={e => setSelectedTests(prev => ({ ...prev, listening: e.target.value }))}
            >
              <option value="">All Listening Tests</option>
              {activeTests.listening_tests.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-gray-500">Reading test</div>
            <select
              className="border rounded-md px-3 py-2 text-sm w-full"
              value={selectedTests.reading}
              onChange={e => setSelectedTests(prev => ({ ...prev, reading: e.target.value }))}
            >
              <option value="">All Reading Tests</option>
              {activeTests.reading_tests.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1 md:justify-self-end">
            <div className="border rounded-md px-2 py-1">
              <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center text-sm text-gray-600">
          Loading...
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {!loading && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryCard label="Students" value={data.summary.students_count} />
            <SummaryCard label="Avg Listening" value={data.summary.avg_listening_band ?? '-'} />
            <SummaryCard label="Avg Reading" value={data.summary.avg_reading_band ?? '-'} />
            <SummaryCard label="Avg Writing (teacher)" value={data.summary.avg_writing_teacher_band ?? '-'} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div className="md:col-span-2">
              {mode === 'student' && data.students && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-gray-900">Students overview</h2>
                    <span className="text-xs text-gray-400">{data.students.length} students</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <Th>Student</Th>
                          <Th>Group</Th>
                          <Th>Teacher</Th>
                          <Th>L</Th>
                          <Th>R</Th>
                          <Th>W</Th>
                          <Th>Overall</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.students.map(s => (
                          <tr key={s.id} className="hover:bg-gray-50">
                            <Td>
                              <div className="font-medium text-gray-900">{s.name}</div>
                              <div className="text-xs text-gray-500">{s.student_id}</div>
                            </Td>
                            <Td>{s.group || '—'}</Td>
                            <Td>{s.teacher || '—'}</Td>
                            <Td>
                              <ModuleCell band={s.listening.band} status={s.listening.status} />
                            </Td>
                            <Td>
                              <ModuleCell band={s.reading.band} status={s.reading.status} />
                            </Td>
                            <Td>
                              <ModuleCell
                                band={s.writing.teacher_band}
                                status={s.writing.status}
                                pendingLabel="not checked"
                                onClick={s.writing.latest_writing_session_id ? () => navigate(`/writing-result/${s.writing.latest_writing_session_id}`) : undefined}
                              />
                            </Td>
                            <Td>{s.overall_band ?? '-'}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {mode !== 'student' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-gray-900">
                      {mode === 'group' ? 'Groups overview' : 'Teachers overview'}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setMode('student')}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View students
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <Th>{mode === 'group' ? 'Group' : 'Teacher'}</Th>
                          <Th>Students</Th>
                          <Th>Completed L+R+W</Th>
                          <Th>Avg L</Th>
                          <Th>Avg R</Th>
                          <Th>Avg W</Th>
                          <Th>Avg overall</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {currentRows().map(row => (
                          <tr key={(mode === 'group' ? row.group : row.teacher) || 'unknown'} className="hover:bg-gray-50">
                            <Td>{mode === 'group' ? (row.group || '—') : (row.teacher || '—')}</Td>
                            <Td>{row.students_count}</Td>
                            <Td>{row.completed_all_three}</Td>
                            <Td>{row.avg_listening_band ?? '-'}</Td>
                            <Td>{row.avg_reading_band ?? '-'}</Td>
                            <Td>{row.avg_writing_teacher_band ?? '-'}</Td>
                            <Td>{row.avg_overall_band ?? '-'}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div>
              <StudentsMissingTestsWidget
                filters={{ group: filters.group, teacher: filters.teacher }}
                timeRange={timeRange}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-semibold text-gray-900">{value ?? '-'}</div>
    </div>
  );
}

function Th({ children }) {
  return (
    <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
      {children}
    </th>
  );
}

function Td({ children }) {
  return (
    <td className="px-4 py-2 text-sm text-gray-800 align-middle">
      {children}
    </td>
  );
}

function ModuleCell({ band, status, pendingLabel, onClick }) {
  if (status === 'not_started') {
    return <span className="text-xs text-gray-400">No data</span>;
  }
  if (status === 'pending') {
    return <span className="text-xs text-yellow-600">{pendingLabel || 'Pending'}</span>;
  }
  const content = <span className="text-sm font-semibold">{band ?? '-'}</span>;
  if (!onClick) return content;
  return (
    <button
      type="button"
      className="text-blue-600 hover:underline cursor-pointer"
      onClick={onClick}
    >
      {content}
    </button>
  );
}


