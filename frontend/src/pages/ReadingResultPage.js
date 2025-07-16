import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../axios'; // Assuming you have a configured axios instance
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase-config';

const ReadingResultPage = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const [user, loading] = useAuthState(auth);
    const [result, setResult] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (user && sessionId) {
            fetchResult();
        }
    }, [user, sessionId]);

    const fetchResult = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`/api/reading-sessions/${sessionId}/result/`);
            setResult(response.data);
        } catch (err) {
            console.error("Error fetching result:", err.response?.data || err);
            setError('Failed to load test results. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const renderBreakdown = () => {
        if (!result || !result.breakdown || !result.breakdown.parts) {
            return <p>No detailed breakdown available.</p>;
        }

        return result.breakdown.parts.map(part => (
            <div key={part.part_number} className="mb-8">
                <h3 className="text-xl font-bold mb-4 text-gray-800">
                    {part.part_title} (Part {part.part_number})
                </h3>
                {part.questions.map(q => (
                    <div key={q.question_id} className="mb-6 p-4 border rounded-lg bg-white">
                        <p className="font-semibold text-gray-700">{q.question_text}</p>
                        <div className="mt-3 space-y-2">
                            {q.sub_questions.map((sub, index) => {
                                const isCorrect = sub.is_correct;
                                const bgColor = isCorrect ? 'bg-green-50' : 'bg-red-50';
                                const borderColor = isCorrect ? 'border-green-300' : 'border-red-300';
                                
                                return (
                                    <div key={sub.id || index} className={`p-3 border rounded-md ${bgColor} ${borderColor}`}>
                                        <p><strong>Your Answer:</strong> <span className="font-mono">{sub.user_answer || 'No answer'}</span></p>
                                        {!isCorrect && (
                                            <p><strong>Correct Answer:</strong> <span className="font-mono">{sub.correct_answer}</span></p>
                                        )}
                                        <p className={`font-bold ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                                            {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        ));
    };

    if (isLoading) return <div className="text-center p-8">Loading results...</div>;
    if (error) return <div className="text-center p-8 text-red-500">{error}</div>;
    if (!result) return <div className="text-center p-8">No results found.</div>;

    const timeTaken = result.time_taken ? new Date(result.time_taken).toISOString().substr(11, 8) : 'N/A';
    
    return (
        <div className="max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen">
            <div className="bg-white p-8 rounded-xl shadow-lg mb-8">
                <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">Reading Test Result</h1>
                <p className="text-center text-gray-600 mb-6">Session ID: {sessionId}</p>

                <div className="grid grid-cols-3 text-center divide-x divide-gray-200">
                    <div className="p-4">
                        <p className="text-sm text-gray-500">Band Score</p>
                        <p className="text-4xl font-bold text-blue-600">{result.band_score.toFixed(1)}</p>
                    </div>
                    <div className="p-4">
                        <p className="text-sm text-gray-500">Raw Score</p>
                        <p className="text-4xl font-bold text-gray-700">{result.raw_score} / {result.total_score}</p>
                    </div>
                    <div className="p-4">
                        <p className="text-sm text-gray-500">Time Taken</p>
                        <p className="text-4xl font-bold text-gray-700">{timeTaken}</p>
                    </div>
                </div>
            </div>

            <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">Answer Breakdown</h2>
            {renderBreakdown()}
            
            <div className="text-center mt-8">
                <button
                    onClick={() => navigate('/reading')}
                    className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Back to Tests
                </button>
            </div>
        </div>
    );
};

export default ReadingResultPage; 