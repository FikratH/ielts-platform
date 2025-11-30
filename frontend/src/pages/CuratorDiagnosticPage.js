import { useEffect, useState } from 'react';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import { 
  Users, 
  CheckCircle, 
  Award, 
  AlertCircle,
  Clipboard
} from 'lucide-react';

const CuratorDiagnosticPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDiagnosticData();
  }, []);

  const fetchDiagnosticData = async () => {
    try {
      const response = await api.get('/diagnostic/curator/');
      setData(response.data);
    } catch (err) {
      console.error('Error fetching diagnostic data:', err);
      if (err.response?.status === 403) {
        setError('Access denied. Curator role required.');
      } else {
        setError('Failed to load diagnostic results.');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getBandDisplay = (band) => {
    return band ? `Band ${band}` : 'Not completed';
  };

  const getCompletionStatus = (student) => {
    const completed = student.completed_count;
    return `${completed}/3 tests`;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="bg-red-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Data</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={fetchDiagnosticData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data?.students?.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="bg-gray-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Diagnostic Results</h3>
            <p className="text-gray-600">No students have started diagnostic tests yet.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Diagnostic Test Results
          </h1>
          
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="bg-blue-100 rounded-lg p-3">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Students</p>
                <p className="text-2xl font-bold text-gray-900">{data.summary.total_diagnostic_students}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="bg-green-100 rounded-lg p-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Fully Completed</p>
                <p className="text-2xl font-bold text-gray-900">{data.summary.completed_diagnostic_students}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="bg-purple-100 rounded-lg p-3">
                <Award className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Average Band</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data.summary.average_overall_band ? 
                    `Band ${data.summary.average_overall_band}` : 
                    'N/A'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Students Table */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Student Diagnostic Results</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Overall Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Listening
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reading
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Writing
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.students.map((student) => (
                  <tr key={student.student_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {student.student_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {student.group && `Group: ${student.group}`}
                        </div>
                        <div className="text-sm text-gray-500">
                          {student.teacher && `Teacher: ${student.teacher}`}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {student.overall_band ? (
                          <span className="px-2 py-1 inline-flex text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            Band {student.overall_band}
                          </span>
                        ) : (
                          <span className="px-2 py-1 inline-flex text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                            {getCompletionStatus(student)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {getBandDisplay(student.listening.band)}
                      </div>
                      {student.listening.date && (
                        <div className="text-xs text-gray-500">
                          {formatDate(student.listening.date)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {getBandDisplay(student.reading.band)}
                      </div>
                      {student.reading.date && (
                        <div className="text-xs text-gray-500">
                          {formatDate(student.reading.date)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {getBandDisplay(student.writing.band)}
                      </div>
                      {student.writing.date && (
                        <div className="text-xs text-gray-500">
                          {formatDate(student.writing.date)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(student.completed_count / 3) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {getCompletionStatus(student)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Analytics Section */}
        <div className="mt-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Analytics Summary</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Completion Overview */}
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <h4 className="text-lg font-semibold text-gray-800 mb-3">Completion Overview</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Students Taking Diagnostic</span>
                  <span className="font-semibold text-blue-600">{data.summary.total_diagnostic_students}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Students Fully Completed</span>
                  <span className="font-semibold text-green-600">{data.summary.completed_diagnostic_students}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Completion Rate</span>
                  <span className="font-semibold">
                    {data.summary.total_diagnostic_students > 0 
                      ? `${Math.round((data.summary.completed_diagnostic_students / data.summary.total_diagnostic_students) * 100)}%`
                      : 'N/A'
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* Band Score Distribution */}
            {data.summary.average_overall_band && (
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h4 className="text-lg font-semibold text-gray-800 mb-3">Band Score Distribution</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Average Overall Band</span>
                    <span className="font-semibold text-purple-600">
                      Band {data.summary.average_overall_band}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {(() => {
                      const completedStudents = data.students.filter(s => s.completed_count === 3);
                      const bands = completedStudents.map(s => s.overall_band).filter(b => b !== null);
                      
                      const bandCounts = {};
                      bands.forEach(band => {
                        bandCounts[band] = (bandCounts[band] || 0) + 1;
                      });
                      
                      const sortedBands = Object.entries(bandCounts)
                        .sort(([a], [b]) => parseFloat(b) - parseFloat(a));
                      
                      return sortedBands.map(([band, count]) => (
                        <div key={band} className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Band {band}</span>
                          <span className="text-sm font-medium text-gray-900">{count} student{count !== 1 ? 's' : ''}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      
        
      </div>
    </div>
  );
};

export default CuratorDiagnosticPage;
