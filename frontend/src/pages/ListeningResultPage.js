import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../axios'; 
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase-config';

const ListeningResultPage = () => {
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
            const response = await axios.get(`/api/listening/sessions/${sessionId}/`);
            setResult(response.data);
        } catch (err) {
            setError('Failed to load listening test results. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const getBandScoreColor = (score) => {
        if (score >= 7.0) return 'text-green-600';
        if (score >= 6.0) return 'text-blue-600';
        if (score >= 5.0) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getBandScoreLabel = (score) => {
        if (score >= 8.5) return 'Excellent';
        if (score >= 7.0) return 'Good';
        if (score >= 6.0) return 'Competent';
        if (score >= 5.0) return 'Modest';
        return 'Basic';
    };

    const renderSubQuestion = (sub, isCorrect) => {
        const bgColor = isCorrect ? 'bg-green-50' : 'bg-red-50';
        const borderColor = isCorrect ? 'border-green-300' : 'border-red-300';
        
        return (
            <div className={`p-4 border-l-4 rounded-r-xl mb-3 ${bgColor} ${borderColor} shadow-sm`}>
                <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-800">
                        {sub.label}
                    </h4>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                    </span>
                </div>
                <div className="text-sm space-y-1">
                    <p>
                        <span className="font-medium text-gray-600">Your answer:</span> 
                        <span className={`ml-2 font-semibold ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                            {sub.user_answer || "(empty)"}
                        </span>
                    </p>
                    {!isCorrect && (
                        <p>
                            <span className="font-medium text-gray-600">Correct answer:</span> 
                            <span className="ml-2 font-semibold text-blue-700">{sub.correct_answer}</span>
                        </p>
                    )}
                </div>
            </div>
        );
    };

    const renderBreakdown = () => {
        if (!result || !result.detailed_breakdown) {
            return <p className="text-gray-600">No detailed breakdown available.</p>;
        }
        
        return result.detailed_breakdown.map((part, partIndex) => (
            <div key={partIndex} className="mb-8">
                <h2 className="text-2xl font-bold text-blue-800 mb-4 border-b-2 border-blue-100 pb-2">
                    Part {part.part_number}
                </h2>
                {part.questions.map((question, qIndex) => (
                     <div key={question.question_id || qIndex} className="mb-8 p-6 border border-blue-100 rounded-2xl bg-gradient-to-br from-blue-50/30 to-white shadow-md">
                        <h3 className="text-xl font-bold mb-4 text-blue-700" style={{ whiteSpace: 'pre-wrap' }}>
                            {question.header || `Question ${qIndex + 1}`}
                        </h3>
                        {question.sub_questions.map((sub, subIndex) => renderSubQuestion(sub, sub.is_correct))}
                    </div>
                ))}
            </div>
        ));
    };

    if (loading || isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
                <div className="text-xl font-semibold text-gray-600">Loading result...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
                <div className="p-8 bg-red-100 text-red-700 rounded-2xl shadow-lg border border-red-200">
                    Error: {error}
                </div>
            </div>
        );
    }

    if (!result) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
                <div className="text-xl font-semibold text-gray-600">Result not found</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-8">
            <div className="max-w-4xl mx-auto px-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-blue-100">
                    <h1 className="text-3xl font-bold text-center mb-4 text-blue-700">Test Results</h1>
                    <h2 className="text-xl text-center text-gray-600 mb-6">{result.test_title || 'IELTS Listening Test'}</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border border-blue-200">
                            <div className={`text-3xl font-bold mb-2 ${getBandScoreColor(result.band_score)}`}>
                                {result.band_score}
                            </div>
                            <div className="text-sm text-blue-700 font-medium">Band Score</div>
                            <div className="text-xs text-gray-600 mt-1">{getBandScoreLabel(result.band_score)}</div>
                        </div>
                        <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl border border-green-200">
                            <div className="text-3xl font-bold text-green-600 mb-2">
                                {result.raw_score} / {result.total_score}
                            </div>
                            <div className="text-sm text-green-700 font-medium">Correct Answers</div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={() => navigate('/listening')}
                            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-300"
                        >
                            Take Another Test
                        </button>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white font-semibold rounded-xl shadow-lg hover:from-gray-700 hover:to-gray-800 transition-all duration-300"
                        >
                            Back to Dashboard
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-8 border border-blue-100">
                    <h3 className="text-2xl font-bold mb-6 text-blue-700 border-b border-blue-100 pb-4">
                        Detailed Analysis
                    </h3>
                    <div className="space-y-6">
                        {renderBreakdown()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ListeningResultPage; 