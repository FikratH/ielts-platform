import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

const WritingStartPage = () => {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const role = localStorage.getItem('role');
    setUserRole(role);
  }, []);

  const startSession = async () => {
    try {
      setIsLoading(true);
      const res = await api.post('/start-writing-session/');
      localStorage.removeItem('writing_timer');
      localStorage.removeItem('writing_task1');
      localStorage.removeItem('writing_task2');
      const sessionId = res.data.session_id;
      navigate(`/writing/task1/${sessionId}`);
    } catch (err) {
      console.error(err);
      alert("Error starting Writing Test");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-3 sm:p-6">
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">IELTS Writing Tests</h1>
        <p className="text-base sm:text-lg text-gray-600">Practice your writing skills with our official IELTS tasks</p>
      </div>
      {userRole === 'admin' && (
        <div className="mb-4 sm:mb-6 text-right">
          <button
            onClick={() => navigate('/admin/writing')}
            className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold shadow text-sm sm:text-base"
          >
            Manage Writing Tests
          </button>
        </div>
      )}
      
      <div className="flex justify-center">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 flex flex-col justify-between border-2 border-transparent hover:border-blue-500 transition-all">
            <div>
              <div className="flex flex-col sm:flex-row sm:justify-between items-start mb-2 gap-2 sm:gap-0">
                <h3 className="font-bold text-lg sm:text-xl text-gray-800">IELTS Writing Test</h3>
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-800">Available</span>
              </div>
              <p className="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4">Task 1 (Academic/General) + Task 2 (Essay). Both tasks will be scored by AI after completion.</p>
            </div>
            <div>
              <div className="flex flex-col sm:flex-row justify-around text-center text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4 border-t pt-3 sm:pt-4 gap-2 sm:gap-0">
                <div>
                  <span className="font-bold text-gray-700 block">2</span>
                  <span>Tasks</span>
                </div>
                <div>
                  <span className="font-bold text-gray-700 block">60</span>
                  <span>Minutes</span>
                </div>
              </div>
              <button
                onClick={startSession}
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold text-sm sm:text-base hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isLoading ? <LoadingSpinner text="Starting..." size="sm" /> : 'Start Test'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WritingStartPage;
