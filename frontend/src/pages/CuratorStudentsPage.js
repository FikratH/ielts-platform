import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import TimeRangeFilter from '../components/TimeRangeFilter';
import StudentsMissingTestsWidget from '../components/StudentsMissingTestsWidget';

export default function CuratorStudentsPage() {
  const [students, setStudents] = useState([]);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ group: '', teacher: '', search: '' });
  const [filterOptions, setFilterOptions] = useState({ groups: [], teachers: [] });
  const [activeTests, setActiveTests] = useState({ listening_tests: [], reading_tests: [] });
  const [testFilters, setTestFilters] = useState({ listening: '', reading: '' });
  const [timeRange, setTimeRange] = useState({ label: 'last_2_weeks' });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filters.group) params.group = filters.group;
      if (filters.teacher) params.teacher = filters.teacher;
      if (testFilters.listening) params.listening = testFilters.listening;
      if (testFilters.reading) params.reading = testFilters.reading;
      if (filters.search) params.search = filters.search;
      if (timeRange?.date_from) params.date_from = timeRange.date_from;
      if (timeRange?.date_to) params.date_to = timeRange.date_to;
      const res = await api.get('/curator/students/', { params });
      setStudents(res.data.students);
    } catch (e) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [
    filters.group,
    filters.teacher,
    testFilters.listening,
    testFilters.reading,
    filters.search,
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
      <h1 className="text-2xl font-bold mb-6">Students</h1>

      <div className="bg-white rounded-lg shadow p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select className="border rounded px-3 py-2" value={filters.group} onChange={e => setFilters({ ...filters, group: e.target.value })}>
          <option value="">All groups</option>
          {filterOptions.groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className="border rounded px-3 py-2" value={filters.teacher} onChange={e => setFilters({ ...filters, teacher: e.target.value })}>
          <option value="">All teachers</option>
          {filterOptions.teachers.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className="border rounded px-3 py-2" placeholder="Search..." value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} />
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
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
        <StudentsMissingTestsWidget filters={{ group: filters.group, teacher: filters.teacher }} timeRange={timeRange} />
      </div>

      {loading && <div>Loading...</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <Th>Student</Th>
                <Th>Group</Th>
                <Th>Teacher</Th>
                <Th>Writing</Th>
                <Th>Listening</Th>
                <Th>Reading</Th>
                <Th>Last Activity</Th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr
                  key={s.id}
                  className="border-t hover:bg-blue-50 cursor-pointer"
                  onClick={() => navigate(`/curator/student-detail/${s.id}`)}
                >
                  <Td>
                    <div>
                      <div className="font-medium">{s.first_name} {s.last_name}</div>
                      <div className="text-xs text-gray-500">{s.student_id}</div>
                    </div>
                  </Td>
                  <Td>{s.group || '-'}</Td>
                  <Td>{s.teacher || '-'}</Td>
                  <Td>
                    <span className={`px-2 py-1 rounded text-xs ${
                      s.test_counts.writing > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {s.test_counts.writing}
                    </span>
                  </Td>
                  <Td>
                    <span className={`px-2 py-1 rounded text-xs ${
                      s.test_counts.listening > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {s.test_counts.listening}
                    </span>
                  </Td>
                  <Td>
                    <span className={`px-2 py-1 rounded text-xs ${
                      s.test_counts.reading > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {s.test_counts.reading}
                    </span>
                  </Td>
                  <Td>
                    {s.last_activity.date ? (
                      <div>
                        <div className="text-xs text-gray-500 capitalize">{s.last_activity.type}</div>
                        <div className="text-xs">{new Date(s.last_activity.date).toLocaleDateString()}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">No activity</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }) { return <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2">{children}</th>; }
function Td({ children }) { return <td className="px-4 py-2 text-sm text-gray-800">{children}</td>; }
