import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase-config';
import LoadingSpinner from '../components/LoadingSpinner';

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
            const response = await api.get(`/reading-sessions/${sessionId}/result/`);
            setResult(response.data);
        } catch (err) {
            console.error("Error fetching result:", err.response?.data || err);
            setError('Failed to load test results. Please try again.');
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



    const renderBreakdown = () => {
        if (!result || !result.breakdown) {
            return <p className="text-gray-600">No detailed breakdown available.</p>;
        }
        
        const entries = Object.entries(result.breakdown);
        entries.sort(([, a], [, b]) => {
            const pa = a.part_number ?? 999;
            const pb = b.part_number ?? 999;
            if (pa !== pb) return pa - pb;
            const aid = Number.isFinite(parseInt(a.sub_questions?.[0]?.id)) ? parseInt(a.sub_questions?.[0]?.id) : 0;
            const bid = Number.isFinite(parseInt(b.sub_questions?.[0]?.id)) ? parseInt(b.sub_questions?.[0]?.id) : 0;
            return aid - bid;
        });

        return entries.map(([questionId, data]) => (
            <div key={questionId} className="mb-8 p-6 border border-blue-100 rounded-2xl bg-gradient-to-br from-blue-50/30 to-white shadow-md">
                <h3 className="text-xl font-bold mb-4 text-blue-700">
                    {data.header || `Question ${questionId}`}
                </h3>
                {data.sub_questions && data.sub_questions.map ? data.sub_questions.map((sub, index) => {
                    const isCorrect = sub.is_correct;
                    const bgColor = isCorrect ? 'bg-green-50' : 'bg-red-50';
                    const borderColor = isCorrect ? 'border-green-300' : 'border-red-300';
                    
                    return (
                        <div key={sub.id || index} className={`p-4 border-l-4 rounded-r-xl mb-3 ${bgColor} ${borderColor} shadow-sm`}>
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold text-gray-800">
                                    {sub.question_text || `Sub-question ${index + 1}`}
                                </h4>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                    isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                    {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                                </span>
                            </div>
                            
                            {/* Multiple Choice Question */}
                            {sub.type === 'mcq_single' && sub.options ? (
                                <div className="text-sm space-y-2">
                                    <p className="font-medium text-gray-600 mb-2">Answer options:</p>
                                    <div className="space-y-1">
                                        {sub.options.map(opt => (
                                            <div key={opt.label} className={`p-2 border rounded-md text-sm ${
                                                opt.label === sub.correct_answer ? 'border-green-400 bg-green-50' : 
                                                opt.label === sub.student_answer && !isCorrect ? 'border-red-400 bg-red-50' : 
                                                'border-gray-300'
                                            }`}>
                                                <span className={`font-bold mr-2 ${opt.label === sub.correct_answer ? 'text-green-700' : ''}`}>
                                                    {opt.label}.
                                                </span>
                                                <span>{typeof opt.text === 'string' ? opt.text : JSON.stringify(opt.text)}</span>
                                                {opt.label === sub.correct_answer && (
                                                    <span className="text-green-600 font-semibold ml-2">(Correct)</span>
                                                )}
                                                {opt.label === sub.student_answer && !isCorrect && (
                                                    <span className="text-red-600 font-semibold ml-2">(Your Answer)</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : sub.type === 'multiple_response' && sub.options ? (
                                /* Multiple Response Question */
                                <div className="text-sm space-y-2">
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="font-medium text-gray-600">Answer options:</p>
                                        {sub.scoring_mode && (
                                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                                {sub.scoring_mode === 'all_or_nothing' ? 'All or Nothing' : 'Per Correct Option'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        {sub.options.map(opt => (
                                            <div key={opt.label} className={`p-2 border rounded-md text-sm ${
                                                opt.is_correct_option ? 'border-green-400 bg-green-50' : 
                                                opt.student_selected && !opt.is_correct_option ? 'border-red-400 bg-red-50' : 
                                                'border-gray-300'
                                            }`}>
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <span className={`font-bold mr-2 ${opt.is_correct_option ? 'text-green-700' : ''}`}>
                                                            {opt.label}.
                                                        </span>
                                                        <span>{typeof opt.text === 'string' ? opt.text : JSON.stringify(opt.text)}</span>
                                                        {opt.is_correct_option && (
                                                            <span className="text-green-600 font-semibold ml-2">(Correct)</span>
                                                        )}
                                                        {opt.student_selected && (
                                                            <span className="text-blue-600 font-semibold ml-2">(Selected)</span>
                                                        )}
                                                        {opt.student_selected && !opt.is_correct_option && (
                                                            <span className="text-red-600 font-semibold ml-2">(Incorrect Selection)</span>
                                                        )}
                                                    </div>
                                                    {opt.points && sub.scoring_mode === 'per_correct_option' && (
                                                        <div className="text-xs text-gray-500 ml-2">
                                                            {opt.student_selected && opt.is_correct_option ? 
                                                                `+${opt.points} pts` : 
                                                                `${opt.points} pts`
                                                            }
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {sub.final_score !== undefined && (
                                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                                            <span className="font-medium">Score: </span>
                                            <span className="font-bold text-blue-600">{sub.final_score}</span>
                                            {sub.scoring_mode === 'per_correct_option' && sub.max_score && (
                                                <span className="text-gray-500"> / {sub.max_score}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Default text-based answers */
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
                                    {sub.explanation && (
                                        <p className="mt-2 text-gray-700 italic">
                                            <span className="font-medium">Explanation:</span> {sub.explanation}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                }) : <p>No sub-questions available</p>}
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
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-8 mb-6 sm:mb-8 border border-blue-100">
                    <div className="flex flex-col items-center gap-2">
                      <h1 className="text-xl sm:text-3xl font-bold text-blue-700">Test Results</h1>
                      <h2 className="text-base sm:text-xl text-gray-600">{result.test_title || 'IELTS Reading Test'}</h2>
                    </div>
                    
                    {/* Score Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 mb-4 sm:mb-6">
                        <div className="text-center p-3 sm:p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border border-blue-200">
                            <div className={`text-lg sm:text-3xl font-bold mb-1 sm:mb-2 ${getBandScoreColor(result.band_score)}`}>{result.band_score}</div>
                            <div className="text-xs sm:text-sm text-blue-700 font-medium">Band Score</div>
                            <div className="text-xs text-gray-600 mt-1">{getBandScoreLabel(result.band_score)}</div>
                        </div>
                        <div className="text-center p-3 sm:p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl border border-green-200">
                            <div className="text-lg sm:text-3xl font-bold text-green-600 mb-1 sm:mb-2">{result.correct_answers_text || `${Math.floor(result.correct_answers_count || 0)} / ${Math.floor(result.total_questions_count || 0)}`}</div>
                            <div className="text-xs sm:text-sm text-green-700 font-medium">Correct Answers</div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center">
                        <button
                            onClick={() => navigate('/reading')}
                            className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-300 text-xs sm:text-base"
                        >
                            Take Another Test
                        </button>
                        {result?.explanation_url && (
                          <a
                            href={result.explanation_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 sm:px-6 py-2 sm:py-3 bg-white text-emerald-700 border border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50 font-semibold rounded-xl shadow-sm transition-all duration-300 text-xs sm:text-base text-center"
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

                {/* Detailed Breakdown */}
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

export default ReadingResultPage; 