import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

const WritingTestListPage = () => {
    const navigate = useNavigate();
    const [tests, setTests] = useState([]);
    const [selectedTest, setSelectedTest] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [userRole, setUserRole] = useState(null);

    useEffect(() => {
        const role = localStorage.getItem('role');
        setUserRole(role);
        fetchTests();
    }, []);

    const fetchTests = async () => {
        try {
            setIsLoading(true);
            const response = await api.get('/writing-tests/');
            setTests(response.data);
            setIsLoading(false);
        } catch (error) {
            setError('Failed to load tests');
            setIsLoading(false);
        }
    };

    const startTest = async (testId) => {
        try {
            setIsLoading(true);
            const response = await api.post(`/writing-tests/${testId}/start/`);
            const sessionId = response.data.session_id;
            navigate(`/writing/task/${sessionId}`);
        } catch (err) {
            console.error(err);
            alert("Error starting Writing Test");
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="p-4 sm:p-6 text-center">
                <LoadingSpinner fullScreen text="Loading..." />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 sm:p-6 text-center text-red-500">
                <div>{error}</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-violet-50 p-3 sm:p-6">
            {/* Header */}
            <div className="text-center mb-8 sm:mb-12">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-purple-500 to-violet-600 rounded-full mb-6 shadow-lg">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-purple-700 mb-4">IELTS Writing Tests</h1>
            </div>

            {/* Admin Button */}
            {userRole === 'admin' && (
                <div className="mb-8 text-center">
                    <button
                        onClick={() => navigate('/admin/writing-tests')}
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

            {/* Tests List */}
            {tests.length === 0 ? (
                <div className="text-center text-gray-600 py-12">
                    <div className="text-6xl mb-4">📝</div>
                    <h3 className="text-xl font-semibold mb-2">No Writing Tests Available</h3>
                    <p>Please check back later or contact your administrator.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
                    {tests.filter(test => test.is_active && !test.is_diagnostic_template).map((test, index) => (
                        <div 
                            key={test.id}
                            className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 hover:scale-105 border border-gray-100 overflow-hidden flex flex-col h-full"
                            style={{
                                background: `linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)`,
                            }}
                        >
                            {/* Gradient top border */}
                            <div className="h-1 bg-gradient-to-r from-purple-500 via-violet-500 to-purple-600"></div>
                            
                            {/* Content */}
                            <div className="p-6 sm:p-8">
                                    {/* Header */}
                                    <div className="flex flex-col sm:flex-row sm:justify-between items-start mb-4 gap-3">
                                        <h3 className="font-bold text-xl sm:text-2xl text-gray-800 leading-tight group-hover:text-purple-700 transition-colors duration-300 line-clamp-2">
                                            {test.title}
                                        </h3>
                                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-md">
                                            <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            Available
                                        </span>
                                    </div>
                                    
                                    {/* Description */}
                                    <p className="text-gray-600 text-sm sm:text-base mb-6 leading-relaxed line-clamp-2">
                                        {test.description || 'Practice your writing with IELTS-style tasks and get AI-powered feedback.'}
                                    </p>
                            </div>
                            
                            {/* Stats and Button */}
                            <div className="px-6 sm:px-8 pb-6 sm:pb-8 mt-auto">
                                {/* Stats */}
                                <div className="flex justify-around text-center mb-6 p-4 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl border border-purple-100">
                                    <div className="flex flex-col items-center">
                                        <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-violet-600 rounded-full flex items-center justify-center mb-2 shadow-md">
                                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <span className="font-bold text-lg text-gray-800">2</span>
                                        <span className="text-xs text-gray-600 font-medium">Tasks</span>
                                    </div>
                                    
                                    <div className="flex flex-col items-center">
                                        <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mb-2 shadow-md">
                                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <span className="font-bold text-lg text-gray-800">60</span>
                                        <span className="text-xs text-gray-600 font-medium">Minutes</span>
                                    </div>
                                </div>
                                
                                {/* Start Button */}
                                <button 
                                    onClick={() => startTest(test.id)}
                                    disabled={isLoading}
                                    className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border-0 focus:outline-none focus:ring-4 focus:ring-purple-300 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed"
                                >
                                    <span className="flex items-center justify-center">
                                        {isLoading ? (
                                            <LoadingSpinner text="Starting..." size="sm" />
                                        ) : (
                                            "Start Test"
                                        )}
                                    </span>
                                </button>
                            </div>
                            
                            {/* Hover overlay effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default WritingTestListPage;

