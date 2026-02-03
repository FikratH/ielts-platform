import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api'; 
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase-config';
import LoadingSpinner from '../components/LoadingSpinner';
import AiFeedbackPanel from '../components/AiFeedbackPanel';

const ListeningResultPage = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const [user, loading] = useAuthState(auth);
    const [result, setResult] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [aiFeedback, setAiFeedback] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState('');
    const [aiCached, setAiCached] = useState(false);

    useEffect(() => {
        if (user && sessionId) {
            fetchResult();
        }
    }, [user, sessionId]);

    useEffect(() => {
        if (result && sessionId) {
            fetchAiFeedback();
        }
    }, [result, sessionId]);

    const fetchResult = async () => {
        setIsLoading(true);
        try {
            const response = await api.get(`/listening-sessions/${sessionId}/result/`);
            setResult(response.data);
        } catch (err) {
            setError('Failed to load listening test results. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAiFeedback = async () => {
        setAiLoading(true);
        setAiError('');
        try {
            const response = await api.get(`/listening-sessions/${sessionId}/ai-feedback/`);
            setAiFeedback(response.data?.feedback || '');
            setAiCached(Boolean(response.data?.cached));
        } catch (err) {
            setAiError('Failed to load AI feedback. Please try again.');
        } finally {
            setAiLoading(false);
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
                        {question.sub_questions.map((sub, subIndex) => (
                            <div key={sub.sub_id || subIndex}>
                                {renderSubQuestion(sub, sub.is_correct)}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        ));
    };

    if (loading || isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
                <LoadingSpinner fullScreen text="Loading..." />
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
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-4 sm:py-8">
            <div className="max-w-full md:max-w-4xl mx-auto px-2 sm:px-4">
                <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-8 mb-6 sm:mb-8 border border-blue-100">
                    <div className="flex flex-col items-center gap-2">
                      <h1 className="text-xl sm:text-3xl font-bold text-blue-700">Test Results</h1>
                      <h2 className="text-base sm:text-xl text-gray-600">{result.test_title || 'IELTS Listening Test'}</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 mb-4 sm:mb-6">
                        <div className="text-center p-3 sm:p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border border-blue-200">
                            <div className={`text-lg sm:text-3xl font-bold mb-1 sm:mb-2 ${getBandScoreColor(result.band_score)}`}> {result.band_score} </div>
                            <div className="text-xs sm:text-sm text-blue-700 font-medium">Band Score</div>
                            <div className="text-xs text-gray-600 mt-1">{getBandScoreLabel(result.band_score)}</div>
                        </div>
                        <div className="text-center p-3 sm:p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl border border-green-200">
                            <div className="text-lg sm:text-3xl font-bold text-green-600 mb-1 sm:mb-2"> {result.raw_score} / {result.total_score} </div>
                            <div className="text-xs sm:text-sm text-green-700 font-medium">Correct Answers</div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center">
                        <button
                            onClick={() => navigate('/listening')}
                            className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-300 text-xs sm:text-base"
                        >
                            Take Another Test
                        </button>
                        {result?.explanation_url && (
                          <a
                            href={result.explanation_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 sm:px-6 py-2 sm:py-3 bg-white text-blue-700 border border-blue-200 hover:border-blue-300 hover:bg-blue-50 font-semibold rounded-xl shadow-sm transition-all duration-300 text-xs sm:text-base text-center"
                          >
                            Test explanation
                          </a>
                        )}
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white font-semibold rounded-xl shadow-lg hover:from-gray-700 hover:to-gray-800 transition-all duration-300 text-xs sm:text-base"
                        >
                            Back to Dashboard
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-8 mb-6 sm:mb-8 border border-blue-100">
                    <div className="flex items-center justify-between gap-4 mb-4 sm:mb-6 border-b border-blue-100 pb-2 sm:pb-4">
                        <h3 className="text-lg sm:text-2xl font-bold text-blue-700">
                            AI Feedback
                        </h3>
                        {aiCached && (
                            <span className="text-xs text-gray-500">cached</span>
                        )}
                    </div>
                    {aiLoading && (
                        <div className="py-6">
                            <LoadingSpinner text="Generating feedback..." />
                        </div>
                    )}
                    {aiError && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between gap-4">
                            <span>{aiError}</span>
                            <button
                                onClick={fetchAiFeedback}
                                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700"
                            >
                                Retry
                            </button>
                        </div>
                    )}
                    {!aiLoading && !aiError && (
                        <AiFeedbackPanel feedback={aiFeedback} />
                    )}
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-8 border border-blue-100">
                    <h3 className="text-lg sm:text-2xl font-bold mb-4 sm:mb-6 text-blue-700 border-b border-blue-100 pb-2 sm:pb-4">
                        Detailed Analysis
                    </h3>
                    <div className="space-y-4 sm:space-y-6">
                        {renderBreakdown()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ListeningResultPage; 
