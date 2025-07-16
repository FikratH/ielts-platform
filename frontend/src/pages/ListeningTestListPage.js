import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

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
            const response = await axios.get('/api/listening-tests/');
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
            <div className="p-6 text-center">
                <div>Loading Listening tests...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 text-center text-red-500">
                <div>{error}</div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold">IELTS Listening Tests</h1>
                <p className="text-lg text-gray-600">Practice your listening skills with our interactive tests</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
                {tests.map(test => (
                    <div key={test.id} className="bg-white rounded-lg shadow-md p-6 flex flex-col justify-between border-2 border-transparent hover:border-blue-500 transition-all">
                        <div>
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-xl text-gray-800">{test.title}</h3>
                                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${test.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {test.is_active ? 'Available' : 'Unavailable'}
                                </span>
                            </div>
                            
                            <p className="text-gray-600 text-sm mb-4">{test.description || 'No description available.'}</p>
                        </div>
                        
                        <div>
                            <div className="flex justify-around text-center text-sm text-gray-500 mb-4 border-t pt-4">
                                <div>
                                    <span className="font-bold text-gray-700 block">{test.parts_count || 0}</span>
                                    <span>Parts</span>
                                </div>
                                <div>
                                    <span className="font-bold text-gray-700 block">{test.time_limit}</span>
                                    <span>Minutes</span>
                                </div>
                            </div>
                            
                            <button 
                                onClick={() => startTest(test.id)}
                                disabled={!test.is_active}
                                className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {test.is_active ? 'Start Test' : 'Unavailable'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {tests.length === 0 && !isLoading && (
                <div className="text-center text-gray-500 mt-8">
                    <h3>No Listening tests available</h3>
                    <p>Check back later for new tests or contact your administrator.</p>
                </div>
            )}
        </div>
    );
};

export default ListeningTestListPage; 