import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

const WritingStartPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userRole, setUserRole] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tests, setTests] = useState([]);
  const [autoStarted, setAutoStarted] = useState(false);

  const startSession = async () => {
    try {
      setIsLoading(true);
      
      // Если тесты ещё не загрузились, дождёмся их
      if (tests.length === 0) {
        const response = await api.get('/writing-tests/');
        setTests(response.data);
      }
      
      const urlParams = new URLSearchParams(location.search);
      const isDiagnostic = urlParams.get('diagnostic');
      const testId = urlParams.get('test_id');
      
      let activeTest;
      if (isDiagnostic && testId) {
        // Для диагностических тестов используем конкретный test_id
        activeTest = tests.find(t => t.id === parseInt(testId));
      } else {
        // Для обычных тестов используем активный тест
        activeTest = tests.find(t => t.is_active);
      }
      
      if (!activeTest) {
        alert(isDiagnostic ? "No diagnostic writing test template found" : "No active writing test found");
        return;
      }
      
      const url = isDiagnostic ? '/start-writing-session/?diagnostic=true' : '/start-writing-session/';
      const res = await api.post(url, { test_id: activeTest.id });
      localStorage.removeItem('writing_timer');
      localStorage.removeItem('writing_task1');
      localStorage.removeItem('writing_task2');
      const sessionId = res.data.session_id;
      navigate(`/writing/task1/${sessionId}`);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 409) {
        alert('You have already completed the diagnostic test for Writing.');
      } else if (err.response?.status === 403) {
        alert('Diagnostic tests are not available if you have completed any regular tests.');
      } else if (err.response?.status === 400) {
        alert('This test is not marked as a diagnostic template.');
      } else {
        alert("Error starting Writing Test");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const role = localStorage.getItem('role');
    setUserRole(role);
    // Load writing tests to know explanation_url and completion
    api.get('/writing-tests/').then(res => {
      setTests(res.data);
    }).catch(() => {});
  }, []);

  // Отдельный useEffect для автоматического запуска диагностических тестов
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const isDiagnostic = urlParams.get('diagnostic');
    
    // Запускаем только для диагностических тестов и только один раз
    if (isDiagnostic && !autoStarted && tests.length > 0) {
      setAutoStarted(true);
      setTimeout(() => startSession(), 500);
    }
  }, [location.search, tests.length, autoStarted, startSession]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-violet-50 p-3 sm:p-6">
      <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-purple-500 to-violet-600 rounded-full mb-6 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-purple-700 mb-4">IELTS Writing Tests</h1>
        </div>

      {userRole === 'admin' && (
        <div className="mb-8 text-center">
          <button
            onClick={() => navigate('/admin/writing')}
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Manage Writing Tests
          </button>
        </div>
      )}
      
      <div className="flex justify-center">
        <div className="w-full max-w-2xl">
          <div className="bg-white rounded-2xl shadow-xl p-8 border-t-4 border-gradient-to-r from-purple-500 to-violet-600 hover:shadow-2xl transition-all duration-300 hover:scale-105 hover:-translate-y-1">
            <div className="flex flex-col sm:flex-row sm:justify-between items-start mb-6 gap-4">
              <div className="flex-1">
                <h3 className="font-bold text-xl sm:text-2xl text-gray-800 mb-2">IELTS Writing Test</h3>
                <p className="text-gray-600 text-sm sm:text-base leading-relaxed">Task 1 (Academic/General) + Task 2 (Essay). Both tasks will be scored by AI after completion.</p>
              </div>
              <div className="flex-shrink-0">
                <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-md">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Available
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl border border-purple-100">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-violet-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-md">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="text-lg font-bold text-purple-700">2</div>
                <div className="text-sm text-gray-600">Tasks</div>
              </div>
              
              <div className="text-center p-4 bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border border-violet-100">
                <div className="w-12 h-12 bg-gradient-to-r from-violet-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-md">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-lg font-bold text-violet-700">60</div>
                <div className="text-sm text-gray-600">Minutes</div>
              </div>
            </div>
            
            <button
              onClick={startSession}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-violet-600 text-white py-4 rounded-xl font-semibold text-lg hover:from-purple-700 hover:to-violet-700 transition-all duration-300 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <LoadingSpinner text="Starting..." size="sm" />
                </div>
              ) : (
                <div className="flex items-center justify-center">
                
                  Start Test
                </div>
              )}
            </button>
            {(() => {
              const urlParams = new URLSearchParams(location.search);
              const isDiagnostic = urlParams.get('diagnostic');
              
              // Показываем explanation только для регулярных тестов
              if (isDiagnostic) return null;
              
              const activeTest = (tests || []).find(t => t.is_active && !t.is_diagnostic_template);
              if (activeTest && activeTest.user_completed && activeTest.explanation_url) {
                return (
                  <a
                    href={activeTest.explanation_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex w-full items-center justify-center bg-white text-purple-700 border border-purple-200 hover:border-purple-300 hover:bg-purple-50 py-3 rounded-xl font-semibold shadow-sm transition-all duration-200"
                  >
                    Test explanation
                  </a>
                );
              }
              return null;
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WritingStartPage;
