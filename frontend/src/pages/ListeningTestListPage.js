import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

const ListeningTestListPage = () => {
    const [tests, setTests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetchTests();
    }, []);

    const fetchTests = async () => {
        try {
            setIsLoading(true);
            const response = await api.get('/listening-tests/');
            setTests(response.data);
            setIsLoading(false);
        } catch (error) {
            setError('Failed to load listening tests');
            setIsLoading(false);
        }
    };

    const startTest = (testId) => {
        navigate(`/listening-test/${testId}`);
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
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-3 sm:p-6">
            <div className="text-center mb-8 sm:mb-12">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full mb-6 shadow-lg">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-blue-700 mb-4">
                    IELTS Listening Tests
                </h1>
            </div>

            {(() => {
                const filteredTests = tests.filter(test => test.is_active && !test.is_diagnostic_template);
                return (
                    <div className={`${filteredTests.length <= 3 ? 'flex flex-wrap justify-center' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'} gap-6 sm:gap-8 lg:gap-10 max-w-7xl mx-auto`}>
                {filteredTests.map((test, index) => (
                    <div 
                        key={test.id} 
                        className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 hover:scale-105 border border-gray-100 overflow-hidden"
                        style={{
                            background: `linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)`,
                        }}
                    >
                        {/* Gradient top border */}
                        <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
                        
                        {/* Content */}
                        <div className="p-6 sm:p-8">
                            {/* Header */}
                            <div className="flex flex-col sm:flex-row sm:justify-between items-start mb-4 gap-3">
                                <h3 className="font-bold text-xl sm:text-2xl text-gray-800 leading-tight group-hover:text-blue-700 transition-colors duration-300">
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
                            <p className="text-gray-600 text-sm sm:text-base mb-6 leading-relaxed">
                                {test.description || 'Practice your listening with IELTS-style audio and questions.'}
                            </p>
                        </div>
                        
                        {/* Stats and Button */}
                        <div className="px-6 sm:px-8 pb-6 sm:pb-8">
                            {/* Stats */}
                            <div className="flex justify-around text-center mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                                <div className="flex flex-col items-center">
                                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center mb-2 shadow-md">
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                    </div>
                                    <span className="font-bold text-lg text-gray-800">
                                        {typeof test.parts_count !== 'undefined' ? test.parts_count : (test.parts ? test.parts.length : 0)}
                                    </span>
                                    <span className="text-xs text-gray-600 font-medium">Parts</span>
                                </div>
                                
                                <div className="flex flex-col items-center">
                                    <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mb-2 shadow-md">
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <span className="font-bold text-lg text-gray-800">40</span>
                                    <span className="text-xs text-gray-600 font-medium">Minutes</span>
                                </div>
                            </div>
                            
                            {/* Start Button */}
                            <button 
                                onClick={() => startTest(test.id)}
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border-0 focus:outline-none focus:ring-4 focus:ring-blue-300"
                            >
                                <span className="flex items-center justify-center">Start Test</span>
                            </button>
                            {test.user_completed && test.explanation_url && (
                              <a
                                href={test.explanation_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 inline-flex w-full items-center justify-center bg-white text-blue-700 border border-blue-200 hover:border-blue-300 hover:bg-blue-50 py-3 rounded-xl font-semibold shadow-sm transition-all duration-200"
                              >
                                Test explanation
                              </a>
                            )}
                        </div>
                        
                        {/* Hover overlay effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                    </div>
                ))}
                    </div>
                );
            })()}

            {tests.length === 0 && !isLoading && (
                <div className="text-center text-gray-500 mt-12">
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">No Listening tests available</h3>
                    <p className="text-base">Check back later for new tests or contact your administrator.</p>
                </div>
            )}
        </div>
    );
};

export default ListeningTestListPage; 