import React, { useEffect, useState } from 'react';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import { FileDown, Search, Filter } from 'lucide-react';

export default function AdminPlacementTestResultsPage() {
  const [submissions, setSubmissions] = useState([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRecommendation, setFilterRecommendation] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchSubmissions();
  }, []);

  useEffect(() => {
    filterResults();
  }, [submissions, search, filterRecommendation, dateFrom, dateTo]);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/placement-test-results/');
      setSubmissions(response.data);
    } catch (error) {
      console.error('Error fetching placement test results:', error);
      alert('Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  const filterResults = () => {
    let filtered = [...submissions];

    // Search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(s =>
        s.full_name.toLowerCase().includes(searchLower) ||
        s.email.toLowerCase().includes(searchLower)
      );
    }

    // Recommendation filter
    if (filterRecommendation !== 'all') {
      filtered = filtered.filter(s => s.recommendation === filterRecommendation);
    }

    // Date filters
    if (dateFrom) {
      filtered = filtered.filter(s => new Date(s.submitted_at) >= new Date(dateFrom));
    }
    if (dateTo) {
      const dateToEnd = new Date(dateTo);
      dateToEnd.setHours(23, 59, 59, 999);
      filtered = filtered.filter(s => new Date(s.submitted_at) <= dateToEnd);
    }

    setFilteredSubmissions(filtered);
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Name', 'Grade', 'Email', 'Planned Exam', 'Score', 'Total', 'Recommendation'];
    const rows = filteredSubmissions.map(s => [
      new Date(s.submitted_at).toLocaleString(),
      s.full_name,
      s.grade || '',
      s.email,
      s.planned_exam_date,
      s.score,
      s.total,
      s.recommendation === 'ielts' ? 'IELTS' : 'Pre-IELTS'
    ]);

    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `placement_test_results_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getRecommendationBadge = (recommendation) => {
    if (recommendation === 'ielts') {
      return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">IELTS</span>;
    }
    return <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold">Pre-IELTS</span>;
  };

  const getScoreColor = (score) => {
    if (score >= 15) return 'text-green-600 font-bold';
    if (score >= 11) return 'text-blue-600 font-semibold';
    if (score >= 7) return 'text-yellow-600 font-semibold';
    return 'text-red-600 font-semibold';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        
        <button
          onClick={exportToCSV}
          disabled={filteredSubmissions.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileDown className="w-5 h-5" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-700">Filters</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Recommendation filter */}
          <select
            value={filterRecommendation}
            onChange={(e) => setFilterRecommendation(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">All Recommendations</option>
            <option value="ielts">IELTS</option>
            <option value="pre-ielts">Pre-IELTS</option>
          </select>

          {/* Date from */}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            placeholder="From date"
          />

          {/* Date to */}
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            placeholder="To date"
          />
        </div>
      </div>

      {/* Results Table */}
      {filteredSubmissions.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-500 text-lg">No results found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-blue-50 border-b-2 border-blue-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-blue-700">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-blue-700">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-blue-700">Grade</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-blue-700">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-blue-700">Planned Exam</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-blue-700">Score</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-blue-700">Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.map((submission, index) => (
                  <tr
                    key={submission.id}
                    className={`border-b hover:bg-gray-50 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(submission.submitted_at).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
                      {submission.full_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {submission.grade || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {submission.email}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {submission.planned_exam_date}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-lg ${getScoreColor(submission.score)}`}>
                        {submission.score}/{submission.total}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getRecommendationBadge(submission.recommendation)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Statistics */}
      {filteredSubmissions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Average Score</h3>
            <p className="text-3xl font-bold text-blue-700">
              {(filteredSubmissions.reduce((sum, s) => sum + s.score, 0) / filteredSubmissions.length).toFixed(1)}
            </p>
            <p className="text-sm text-gray-500 mt-1">out of 20</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">IELTS Ready</h3>
            <p className="text-3xl font-bold text-green-600">
              {filteredSubmissions.filter(s => s.recommendation === 'ielts').length}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {((filteredSubmissions.filter(s => s.recommendation === 'ielts').length / filteredSubmissions.length) * 100).toFixed(0)}%
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Pre-IELTS Recommended</h3>
            <p className="text-3xl font-bold text-orange-600">
              {filteredSubmissions.filter(s => s.recommendation === 'pre-ielts').length}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {((filteredSubmissions.filter(s => s.recommendation === 'pre-ielts').length / filteredSubmissions.length) * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

