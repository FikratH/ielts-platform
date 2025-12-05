import React, { useEffect, useState, useCallback } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

const StudentsMissingSpeakingWidget = ({ filters, timeRange }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filterOptions, setFilterOptions] = useState({ groups: [], teachers: [] });
  const [selectedGroup, setSelectedGroup] = useState(filters?.group || '');
  const [selectedTeacher, setSelectedTeacher] = useState(filters?.teacher || '');
  const navigate = useNavigate();

  const loadFilterOptions = useCallback(async () => {
    try {
      const res = await api.get('/curator/students/');
      setFilterOptions(res.data.filter_options || { groups: [], teachers: [] });
    } catch (e) {
      console.error('Failed to load filter options:', e);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    if (filters?.group !== undefined) {
      setSelectedGroup(filters.group || '');
    }
    if (filters?.teacher !== undefined) {
      setSelectedTeacher(filters.teacher || '');
    }
  }, [filters?.group, filters?.teacher]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const params = {};
        if (selectedGroup) params.group = selectedGroup;
        if (selectedTeacher) params.teacher = selectedTeacher;
        if (debouncedSearch && debouncedSearch.trim()) {
          params.search = debouncedSearch.trim();
        }
        if (timeRange?.date_from) params.date_from = timeRange.date_from;
        if (timeRange?.date_to) params.date_to = timeRange.date_to;
        params.page = page;
        params.page_size = 10;
        const res = await api.get('/curator/missing-speaking/', { params });
        setData(res.data.students || []);
        setTotalCount(res.data.count || 0);
        setTotalPages(res.data.total_pages || 1);
      } catch (e) {
        setError('Failed to load missing speaking sessions');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedGroup, selectedTeacher, debouncedSearch, timeRange?.date_from, timeRange?.date_to, page]);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold">Students Missing Speaking Sessions</h3>
          <p className="text-sm text-gray-500">Missing speaking session in selected window</p>
        </div>
        <span className="text-xs text-gray-400">{totalCount} students</span>
      </div>
      
      <div className="mb-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <select
            className="border rounded-md px-2 py-1.5 text-xs w-full"
            value={selectedGroup}
            onChange={(e) => {
              setSelectedGroup(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All groups</option>
            {filterOptions.groups.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <select
            className="border rounded-md px-2 py-1.5 text-xs w-full"
            value={selectedTeacher}
            onChange={(e) => {
              setSelectedTeacher(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All teachers</option>
            {filterOptions.teachers.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <input
          type="text"
          placeholder="Search by name, ID, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading && <div className="text-sm text-gray-500">Loading...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {!loading && !error && data.length === 0 && (
        <div className="text-sm text-gray-500">No missing speaking sessions found.</div>
      )}
      <div className="space-y-2 mb-3">
        {data.map(student => (
          <button
            key={student.id}
            className="w-full text-left flex justify-between items-center text-sm text-gray-700 hover:bg-blue-50 rounded px-2 py-1"
            onClick={() => navigate(`/curator/student-detail/${student.id}`)}
          >
            <div>
              <div className="font-medium">{student.name}</div>
              <div className="text-xs text-gray-500">
                {student.student_id || 'No ID'} · {student.group || 'No group'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-red-600">
                speaking
              </div>
              <div className="text-xs text-gray-400">
                {student.last_activity ? new Date(student.last_activity).toLocaleDateString('ru-RU') : 'No activity'}
              </div>
            </div>
          </button>
        ))}
      </div>
      
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-2 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-2 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default StudentsMissingSpeakingWidget;

