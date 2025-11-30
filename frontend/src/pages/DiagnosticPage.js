import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import { 
  Target, 
  Headphones, 
  BookOpen, 
  PenTool, 
  CheckCircle, 
  Clock, 
  Award,
  AlertCircle,
  X
} from 'lucide-react';

const DiagnosticPage = () => {
  const [diagnosticData, setDiagnosticData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDiagnosticData();
  }, []);

  const fetchDiagnosticData = async () => {
    try {
      const response = await api.get('/diagnostic/summary/');
      setDiagnosticData(response.data);
    } catch (err) {
      console.error('Error fetching diagnostic data:', err);
      setError('Failed to load diagnostic information');
    } finally {
      setLoading(false);
    }
  };

  const startTest = async (module) => {
    try {
      if (module === 'listening') {
        const response = await api.get('/listening-tests/');
        const diagnosticTest = response.data.find(test => test.is_diagnostic_template);
        if (!diagnosticTest) {
          alert('No diagnostic listening test template found');
          return;
        }
        navigate(`/listening-test/${diagnosticTest.id}?diagnostic=1`);
      } else if (module === 'reading') {
        const response = await api.get('/reading-tests/');
        const diagnosticTest = response.data.find(test => test.is_diagnostic_template);
        if (!diagnosticTest) {
          alert('No diagnostic reading test template found');
          return;
        }
        navigate(`/reading-test/${diagnosticTest.id}?diagnostic=1`);
      } else if (module === 'writing') {
        const response = await api.get('/writing-tests/');
        const diagnosticTest = response.data.find(test => test.is_diagnostic_template);
        if (!diagnosticTest) {
          alert('No diagnostic writing test template found');
          return;
        }
        
        // Создаем сессию напрямую (как Listening/Reading)
        try {
          const sessionResponse = await api.post('/start-writing-session/?diagnostic=true', { 
            test_id: diagnosticTest.id 
          });
          const sessionId = sessionResponse.data.session_id;
          navigate(`/writing/task1/${sessionId}`);
        } catch (err) {
          if (err.response?.status === 409) {
            alert('You have already completed the diagnostic test for Writing.');
          } else if (err.response?.status === 403) {
            alert('Diagnostic tests are not available if you have completed any regular tests.');
          } else if (err.response?.status === 400) {
            alert('This test is not marked as a diagnostic template.');
          } else {
            alert('Failed to start writing diagnostic test');
          }
        }
      }
    } catch (error) {
      console.error('Error loading diagnostic test:', error);
      alert('Failed to load diagnostic test');
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading diagnostic information..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="bg-red-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Diagnostic</h3>
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

  if (diagnosticData?.locked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="bg-amber-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Diagnostic Not Available</h3>
            <p className="text-gray-600 mb-4">
              You have already completed regular tests. Diagnostic assessments are only available before you begin regular testing.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tests = [
    { 
      key: 'listening', 
      title: 'Listening Test', 
      description: '40 minutes • Multiple choice and fill-in questions',
      icon: () => <Headphones className="w-8 h-8" />,
      completed: diagnosticData?.listening?.band !== null && diagnosticData?.listening?.band !== undefined,
      band: diagnosticData?.listening?.band,
      bgColor: 'from-blue-50 to-blue-100',
      borderColor: 'border-blue-200',
      iconBg: 'from-blue-500 to-blue-600'
    },
    { 
      key: 'reading', 
      title: 'Reading Test', 
      description: '60 minutes • Academic passages and questions',
      icon: () => <BookOpen className="w-8 h-8" />,
      completed: diagnosticData?.reading?.band !== null && diagnosticData?.reading?.band !== undefined,
      band: diagnosticData?.reading?.band,
      bgColor: 'from-green-50 to-green-100',
      borderColor: 'border-green-200',
      iconBg: 'from-green-500 to-green-600'
    },
    { 
      key: 'writing', 
      title: 'Writing Test', 
      description: '60 minutes • Task 1 and Task 2 essays',
      icon: () => <PenTool className="w-8 h-8" />,
      completed: diagnosticData?.writing?.band !== null && diagnosticData?.writing?.band !== undefined,
      band: diagnosticData?.writing?.band,
      bgColor: 'from-purple-50 to-purple-100',
      borderColor: 'border-purple-200',
      iconBg: 'from-purple-500 to-purple-600'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-4 mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-800 to-indigo-800 bg-clip-text text-transparent">
              IELTS Diagnostic Test
            </h1>
          </div>
          
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed mb-8">
            Complete all three modules to establish your baseline IELTS band score. 
            This diagnostic helps identify your strengths and areas for improvement.
          </p>
          
          {/* Progress */}
          <div className="mt-8">
            <div className="bg-gray-200 rounded-full h-4 max-w-lg mx-auto shadow-inner">
              <div 
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-4 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${(diagnosticData?.completed_count || 0) * 33.33}%` }}
              />
            </div>
            <p className="text-lg font-semibold text-gray-700 mt-3">
              {diagnosticData?.completed_count || 0} of 3 tests completed
            </p>
          </div>

          {/* Overall Score Display */}
          {diagnosticData?.completed_count === 3 && (
            <div className="mt-8 relative bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 border border-green-200 rounded-2xl p-8 max-w-lg mx-auto shadow-xl overflow-hidden">
              {/* Background Pattern */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full opacity-20 transform translate-x-12 -translate-y-12"></div>
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-gradient-to-tr from-teal-100 to-green-100 rounded-full opacity-20 transform -translate-x-10 translate-y-10"></div>
              
              <div className="relative text-center">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Award className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-green-800 to-emerald-800 bg-clip-text text-transparent">Overall Band Score</h3>
                </div>
                <div className="text-5xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-4">
                  {diagnosticData.overall_band || 'N/A'}
                </div>
                <div className="flex justify-center gap-6 text-lg font-semibold">
                  <span className="px-3 py-2 bg-green-100 text-green-700 rounded-lg border border-green-200">L: {diagnosticData.listening?.band || 'N/A'}</span>
                  <span className="px-3 py-2 bg-green-100 text-green-700 rounded-lg border border-green-200">R: {diagnosticData.reading?.band || 'N/A'}</span>
                  <span className="px-3 py-2 bg-green-100 text-green-700 rounded-lg border border-green-200">W: {diagnosticData.writing?.band || 'N/A'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Test Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {tests.map((test) => (
            <div 
              key={test.key}
              className={`relative bg-gradient-to-br ${test.bgColor} ${test.borderColor} border rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden`}
            >
              {/* Background Pattern */}
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white to-gray-100 rounded-full opacity-20 transform translate-x-10 -translate-y-10"></div>
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr from-white to-gray-100 rounded-full opacity-20 transform -translate-x-8 translate-y-8"></div>
              
              <div className="relative text-center">
                <div className={`w-16 h-16 bg-gradient-to-br ${test.iconBg} rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg`}>
                  <div className="text-white">
                    {test.icon()}
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">{test.title}</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">{test.description}</p>
                
                {test.completed ? (
                  <div className="space-y-4">
                    <div className="bg-green-100 border border-green-200 rounded-xl p-4">
                      <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm font-semibold">Completed</span>
                      </div>
                      <div className="text-3xl font-bold text-green-700">
                        Band {test.band}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (test.key === 'listening' && diagnosticData?.listening?.session_id) {
                          navigate(`/listening-result/${diagnosticData.listening.session_id}`);
                        } else if (test.key === 'reading' && diagnosticData?.reading?.session_id) {
                          navigate(`/reading-result/${diagnosticData.reading.session_id}`);
                        } else if (test.key === 'writing' && diagnosticData?.writing?.session_id) {
                          navigate(`/writing-result/${diagnosticData.writing.session_id}`);
                        }
                      }}
                      className="w-full px-6 py-3 bg-white border-2 border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                      View Results
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startTest(test.key)}
                    className="w-full px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    {diagnosticData?.completed_count > 0 ? 'Continue Test' : 'Start Test'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Info */}
        <div className="text-center bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-gray-400" />
            <span className="text-lg font-semibold text-gray-700">Important Information</span>
          </div>
          <p className="text-gray-600 leading-relaxed">
            Complete all three tests to receive your comprehensive diagnostic report.
          </p>
          <p className="text-gray-600 mt-2">
            Each test can only be taken once as a diagnostic assessment.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticPage;
