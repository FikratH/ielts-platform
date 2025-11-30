import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function CuratorTestComparisonPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('writing');
  const [selectedTests, setSelectedTests] = useState([]);
  const [filters, setFilters] = useState({ 
    group: '', 
    teacher: '', 
    date_from: '', 
    date_to: '' 
  });
  const [filterOptions, setFilterOptions] = useState({ groups: [], teachers: [] });
  const [activeTests, setActiveTests] = useState({ 
    writing_tests: [], 
    listening_tests: [], 
    reading_tests: [] 
  });

  const loadData = useCallback(async () => {
    if (selectedTests.length < 2) {
      setData(null);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.append('category', category);
      selectedTests.forEach(id => params.append('test_ids', id));
      
      // Add filters if they have values
      if (filters.group) params.append('group', filters.group);
      if (filters.teacher) params.append('teacher', filters.teacher);
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);

      const res = await api.get(`/curator/test-comparison/?${params.toString()}`);
      setData(res.data);
    } catch (e) {
      setError('Failed to load comparison data');
      console.error('Comparison error:', e);
    } finally {
      setLoading(false);
    }
  }, [category, selectedTests, filters]);

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
    loadFilterOptions();
    loadActiveTests();
  }, [loadFilterOptions, loadActiveTests]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset selected tests when category changes
  useEffect(() => {
    setSelectedTests([]);
  }, [category]);

  const handleTestSelection = (testId) => {
    setSelectedTests(prev => {
      if (prev.includes(testId)) {
        return prev.filter(id => id !== testId);
      } else {
        return [...prev, testId];
      }
    });
  };

  const getCurrentTests = () => {
    switch (category) {
      case 'writing':
        return activeTests.writing_tests || [];
      case 'listening':
        return activeTests.listening_tests || [];
      case 'reading':
        return activeTests.reading_tests || [];
      default:
        return [];
    }
  };

  const exportComparison = async () => {
    if (!data || selectedTests.length < 2) return;

    try {
      const params = new URLSearchParams();
      params.append('category', category);
      selectedTests.forEach(id => params.append('test_ids', id));
      
      // Add filters if they have values
      if (filters.group) params.append('group', filters.group);
      if (filters.teacher) params.append('teacher', filters.teacher);
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);

      const response = await api.get(`/curator/test-comparison-export-csv/?${params.toString()}`, { 
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test_comparison_${category}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error('Export error:', e);
      alert('Failed to export comparison data');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/curator/dashboard')}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold">Test Comparison</h1>
        </div>
        <div className="flex space-x-3">
          {data && selectedTests.length >= 2 && (
            <button
              onClick={exportComparison}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              📊 Export Comparison
            </button>
          )}
        </div>
      </div>

      {/* Category and Test Selection */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Select Tests to Compare</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="writing">Writing</option>
              <option value="listening">Listening</option>
              <option value="reading">Reading</option>
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Tests (minimum 2)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {getCurrentTests().map(test => (
              <label key={test.id} className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={selectedTests.includes(test.id)}
                  onChange={() => handleTestSelection(test.id)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">{test.title}</span>
              </label>
            ))}
          </div>
          {selectedTests.length < 2 && (
            <p className="text-sm text-red-600 mt-2">
              Please select at least 2 tests to compare
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Filters</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Group
            </label>
            <select
              value={filters.group}
              onChange={(e) => setFilters(prev => ({ ...prev, group: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Groups</option>
              {filterOptions.groups?.map(group => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Teacher
            </label>
            <select
              value={filters.teacher}
              onChange={(e) => setFilters(prev => ({ ...prev, teacher: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Teachers</option>
              {filterOptions.teachers?.map(teacher => (
                <option key={teacher} value={teacher}>{teacher}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date From
            </label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters(prev => ({ ...prev, date_from: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date To
            </label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters(prev => ({ ...prev, date_to: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading comparison data...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Comparison Results */}
      {data && !loading && (
        <div className="space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.tests.map(test => (
              <div key={test.id} className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold text-sm text-gray-600 mb-2">{test.title}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Avg Score:</span>
                    <span className="font-semibold">
                      {test.average_scores.overall || test.average_scores.band_score || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Completion:</span>
                    <span className="font-semibold">{test.completion_rate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Students:</span>
                    <span className="font-semibold">{test.total_students}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Comparison Summary */}
          {data.comparison && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Comparison Summary</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-green-600 mb-2">Best Performing Test</h3>
                  <p className="text-sm text-gray-600">
                    {data.comparison.best_performing_test.title} 
                    (Score: {data.comparison.best_performing_test.score})
                  </p>
                </div>
                
                <div>
                  <h3 className="font-medium text-red-600 mb-2">Worst Performing Test</h3>
                  <p className="text-sm text-gray-600">
                    {data.comparison.worst_performing_test.title} 
                    (Score: {data.comparison.worst_performing_test.score})
                  </p>
                </div>
              </div>

              {/* Score Differences */}
              {data.comparison.score_differences.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-medium mb-3">Score Differences</h3>
                  <div className="space-y-2">
                    {data.comparison.score_differences.map((diff, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="text-sm">
                          {diff.test1} vs {diff.test2}
                        </span>
                        <span className={`text-sm font-medium ${
                          diff.difference > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {diff.difference > 0 ? '+' : ''}{diff.difference}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Detailed Test Data */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Detailed Test Analysis</h2>
            
            <div className="space-y-6">
              {data.tests.map(test => (
                <div key={test.id} className="border rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-3">{test.title}</h3>
                  
                  {/* Test Overview */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {test.average_scores.overall || test.average_scores.band_score || 0}
                      </div>
                      <div className="text-sm text-gray-600">Average Score</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {test.completion_rate}%
                      </div>
                      <div className="text-sm text-gray-600">Completion Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {test.total_students}
                      </div>
                      <div className="text-sm text-gray-600">Total Students</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {test.completed_students}
                      </div>
                      <div className="text-sm text-gray-600">Completed</div>
                    </div>
                  </div>

                  {/* Score Distribution */}
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">Score Distribution</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-2 bg-red-50 rounded">
                        <div className="text-lg font-semibold text-red-600">
                          {test.score_distribution.low}
                        </div>
                        <div className="text-sm text-gray-600">Low (&lt;5.0)</div>
                      </div>
                      <div className="text-center p-2 bg-yellow-50 rounded">
                        <div className="text-lg font-semibold text-yellow-600">
                          {test.score_distribution.medium}
                        </div>
                        <div className="text-sm text-gray-600">Medium (5.0-7.0)</div>
                      </div>
                      <div className="text-center p-2 bg-green-50 rounded">
                        <div className="text-lg font-semibold text-green-600">
                          {test.score_distribution.high}
                        </div>
                        <div className="text-sm text-gray-600">High (≥7.0)</div>
                      </div>
                    </div>
                  </div>

                  {/* Group Statistics */}
                  {test.group_statistics.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium mb-2">Group Performance</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Group
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Students
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Completed
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Completion Rate
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Avg Score
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {test.group_statistics.map((group, index) => (
                              <tr key={index}>
                                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {group.group}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                  {group.total_students}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                  {group.completed}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                  {group.completion_rate}%
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                  {group.avg_score}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Teacher Statistics */}
                  {test.teacher_statistics.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Teacher Performance</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Teacher
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Students
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Completed
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Completion Rate
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Avg Score
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {test.teacher_statistics.map((teacher, index) => (
                              <tr key={index}>
                                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {teacher.teacher}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                  {teacher.total_students}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                  {teacher.completed}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                  {teacher.completion_rate}%
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                  {teacher.avg_score}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
