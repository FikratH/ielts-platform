import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import ReadingTestPlayer from '../components/ReadingTestPlayer';
// import './ReadingPage.css';

const ReadingPage = () => {
    const navigate = useNavigate();
    const [tests, setTests] = useState([]);
    const [selectedTest, setSelectedTest] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchTests();
    }, []);

    const fetchTests = async () => {
        try {
            setIsLoading(true);
            const response = await api.get('/reading-tests/');
            setTests(response.data);
            setIsLoading(false);
        } catch (error) {
            setError('Failed to load tests');
            setIsLoading(false);
        }
    };

    const startTest = (test) => {
        setSelectedTest(test);
    };

    const handleTestComplete = (sessionId) => {
        // Redirect to results page
        console.log("🔥 TEST COMPLETED, redirecting to result:", sessionId);
        navigate(`/reading-result/${sessionId}`);
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

    if (selectedTest) {
        return (
            <ReadingTestPlayer 
                testId={selectedTest.id} 
                onComplete={handleTestComplete}
            />
        );
    }

    return (
        <div className="p-3 sm:p-6">
            <div className="text-center mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold">IELTS Reading Tests</h1>
                <p className="text-base sm:text-lg text-gray-600">Practice your reading skills with our comprehensive tests</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 max-w-full lg:max-w-7xl mx-auto">
                {tests.filter(test => test.is_active).map(test => (
                    <div key={test.id} className="bg-white rounded-lg shadow-md p-4 sm:p-6 flex flex-col justify-between border-2 border-transparent hover:border-blue-500 transition-all">
                        <div>
                            <div className="flex flex-col sm:flex-row sm:justify-between items-start mb-2 gap-2 sm:gap-0">
                                <h3 className="font-bold text-lg sm:text-xl text-gray-800">{test.title}</h3>
                                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-800">
                                    Available
                                </span>
                            </div>
                            
                            <p className="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4">{test.description}</p>
                        </div>
                        
                        <div>
                            <div className="flex flex-col sm:flex-row justify-around text-center text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4 border-t pt-3 sm:pt-4 gap-2 sm:gap-0">
                                <div>
                                    <span className="font-bold text-gray-700 block">{test.parts?.length || 0}</span>
                                    <span>Parts</span>
                                </div>
                                <div>
                                    <span className="font-bold text-gray-700 block">{test.time_limit}</span>
                                    <span>Minutes</span>
                                </div>
                            </div>
                            
                            <button 
                                onClick={() => startTest(test)}
                                className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold text-sm sm:text-base hover:bg-blue-700 transition-colors"
                            >
                                Start Test
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {tests.length === 0 && !isLoading && (
                <div className="text-center text-gray-500 mt-6 sm:mt-8">
                    <h3 className="text-base sm:text-lg">No Reading tests available</h3>
                    <p className="text-xs sm:text-base">Check back later for new tests or contact your administrator.</p>
                </div>
            )}
        </div>
    );
};

export default ReadingPage; 