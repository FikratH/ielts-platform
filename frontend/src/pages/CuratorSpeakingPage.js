import React, { useEffect, useState, useCallback } from 'react';
import api from '../api';
import TimeRangeFilter from '../components/TimeRangeFilter';

export default function CuratorSpeakingPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ group: '', teacher: '', search: '' });
  const [filterOptions, setFilterOptions] = useState({ groups: [], teachers: [] });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(30);
  const [totalPages, setTotalPages] = useState(1);
  const [timeRange, setTimeRange] = useState({ label: 'all_time', date_from: '', date_to: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filters.group) params.group = filters.group;
      if (filters.teacher) params.teacher = filters.teacher;
      if (filters.search && filters.search.trim()) params.search = filters.search.trim();
      params.page = page;
      params.page_size = pageSize;
      if (timeRange?.date_from) params.date_from = timeRange.date_from;
      if (timeRange?.date_to) params.date_to = timeRange.date_to;
      const res = await api.get('/curator/speaking-overview/', { params });
      setData(res.data);
      const p = res.data.recent_pagination;
      if (p) setTotalPages(p.total_pages || 1);
    } catch (e) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [filters.group, filters.teacher, filters.search, page, pageSize, timeRange]);

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
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Speaking overview</h1>
        <button
          onClick={async () => {
            try {
              const params = new URLSearchParams();
              if (filters.group) params.append('group', filters.group);
              if (filters.teacher) params.append('teacher', filters.teacher);
              if (filters.search && filters.search.trim()) params.append('search', filters.search.trim());
              if (timeRange?.date_from) params.append('date_from', timeRange.date_from);
              if (timeRange?.date_to) params.append('date_to', timeRange.date_to);
              
              const response = await api.get(`/curator/speaking-export-csv/?${params.toString()}`, {
                responseType: 'blob'
              });
              
              const blob = new Blob([response.data], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `speaking_export_${new Date().toISOString().split('T')[0]}.csv`;
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

      <div className="bg-white rounded-lg shadow p-4 mb-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
            <div className="text-xs text-gray-500">Search student</div>
            <input
              className="border rounded-md px-3 py-2 text-sm w-full"
              placeholder="Name, ID or email"
              value={filters.search}
              onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <div className="border rounded-md px-2 py-1">
            <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
          </div>
        </div>
      </div>

      {loading && <div>Loading...</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && data && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <Th>Student</Th>
                  <Th>Group</Th>
                  <Th>Teacher</Th>
                  <Th>Overall</Th>
                  <Th>Fluency</Th>
                  <Th>Lexical</Th>
                  <Th>Grammar</Th>
                  <Th>Pronunciation</Th>
                  <Th>Date</Th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.map(s => (
                  <tr key={s.session_id} className="border-t">
                    <Td>
                      <div>
                        <div className="font-medium">{s.student_name}</div>
                        <div className="text-xs text-gray-500">{s.student_id}</div>
                      </div>
                    </Td>
                    <Td>{s.group || '-'}</Td>
                    <Td>{s.teacher || '-'}</Td>
                    <Td>
                      {s.overall_band ? (
                        <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                          {s.overall_band}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">No submission</span>
                      )}
                    </Td>
                    <Td>{s.fluency_score || '-'}</Td>
                    <Td>{s.lexical_score || '-'}</Td>
                    <Td>{s.grammar_score || '-'}</Td>
                    <Td>{s.pronunciation_score || '-'}</Td>
                    <Td>{s.conducted_at ? new Date(s.conducted_at).toLocaleDateString() : '-'}</Td>
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

function Th({ children }) { return <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-2">{children}</th>; }
function Td({ children }) { return <td className="px-4 py-2 text-sm text-gray-800">{children}</td>; }
