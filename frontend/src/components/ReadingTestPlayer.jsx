import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth } from '../firebase-config';
import { useAuthState } from 'react-firebase-hooks/auth';
import axios from '../axios';


const ReadingTimer = ({ timeLeft, color = 'text-blue-600' }) => {
    const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const secs = (timeLeft % 60).toString().padStart(2, '0');
    return (
        <div className="flex flex-col items-center">
            <span className={`text-4xl font-mono font-bold ${color} tracking-widest`} style={{ letterSpacing: '0.05em' }}>{mins}:{secs}</span>
            <span className="text-xs text-gray-400 mt-1">Time Remaining</span>
        </div>
    );
};


const ReadingTestPlayer = ({ testId: propTestId, onComplete }) => {
    const { id: paramTestId } = useParams();
    const testId = propTestId || paramTestId;
    const navigate = useNavigate();
    const [user, loading] = useAuthState(auth);

    // Test state
    const [test, setTest] = useState(null);
    const [session, setSession] = useState(null);
    const [currentPartIndex, setCurrentPartIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [timeLeft, setTimeLeft] = useState(3600); // 60 minutes for reading

    // UI state
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Effect to start session and load test
    useEffect(() => {
        if (user && testId) {
            startSessionAndLoadTest();
        }
    }, [user, testId]);

    // Timer effect
    useEffect(() => {
        if (session && !session.completed && timeLeft > 0) {
            const timer = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        submitTest(); // Auto-submit when time is up
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [session, timeLeft]);

    const startSessionAndLoadTest = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const sessionResponse = await axios.post(`/api/reading-tests/${testId}/start/`);
            const newSession = sessionResponse.data;
            setSession(newSession);
            setTimeLeft(newSession.time_left_seconds || 3600);
            
            // Только загружаем ответы если сессия не завершена
            if (!newSession.completed && !newSession.submitted && newSession.status !== 'completed') {
                setAnswers(newSession.answers || {});
            } else {
                setAnswers({}); // Очищаем ответы для завершенных сессий
            }

            const testResponse = await axios.get(`/api/reading-tests/${testId}/`);
            setTest(testResponse.data);

        } catch (err) {
            setError('Failed to load or start the test. Please try again.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnswerChange = (questionId, subKey, value, type = 'text') => {
        const qIdStr = questionId.toString();
        console.log("🔥 ANSWER CHANGE:", questionId, subKey, value, type);
        
        setAnswers(prev => {
            const newAnswers = { ...prev };

            if (type === 'multiple_choice') {
                newAnswers[qIdStr] = { text: value };
            } else if (type === 'multiple_response') {
                const currentSelection = Array.isArray(newAnswers[qIdStr]) ? newAnswers[qIdStr] : [];
                if (value.checked) {
                    newAnswers[qIdStr] = [...currentSelection, value.text];
                } else {
                    newAnswers[qIdStr] = currentSelection.filter(item => item !== value.text);
                }
            } else { // For gap_fill, matching, table... which use a subKey
                const currentSubAnswers = newAnswers[qIdStr] || {};
                newAnswers[qIdStr] = { ...currentSubAnswers, [subKey]: value };
            }

            console.log("🔥 NEW ANSWERS STATE:", newAnswers);
            return newAnswers;
        });
    };

    const submitTest = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        console.log("🔥 SUBMITTING TEST:", session.id, "with answers:", answers);
        try {
            const response = await axios.put(`/api/reading-sessions/${session.id}/submit/`, { answers });
            console.log("🔥 SUBMIT RESPONSE:", response.data);
            console.log("🔥 onComplete EXISTS:", !!onComplete, typeof onComplete);
            if (onComplete) {
                console.log("🔥 CALLING onComplete() with sessionId:", session.id);
                onComplete(session.id);
            } else {
                console.log("🔥 NAVIGATING TO RESULT:", `/reading-result/${session.id}`);
                navigate(`/reading-result/${session.id}`);
            }
        } catch (err) {
            console.error('🔥 ERROR submitting test:', err.response?.data || err);
            alert('Failed to submit test. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const currentPart = test?.parts?.[currentPartIndex];

    const renderQuestion = (question) => {
        const type = question.question_type?.toLowerCase();

        // Header block for all questions
        const headerBlock = (
            <div className="mb-4">
                {question.header && (
                    <h3 className="text-lg lg:text-xl font-bold text-blue-700 mb-2">
                        {question.header}
                    </h3>
                )}
                {question.instruction && (
                    <div className="text-gray-600 italic mt-1 bg-blue-50/30 p-3 rounded-lg text-sm lg:text-base" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                        {question.instruction}
                    </div>
                )}
                {question.image_url && (
                    <div className="my-4 flex justify-center">
                        <img
                            src={question.image_url}
                            alt="Question Illustration"
                            className="rounded-xl shadow-md border border-blue-100 max-w-full h-auto"
                            style={{ maxWidth: '400px', maxHeight: '250px' }}
                        />
                    </div>
                )}
            </div>
        );
        
        // --- Multiple Choice ---
        if (["multiple_choice", "multiplechoice"].includes(type) && Array.isArray(question.answer_options)) {
            return (
                <div key={question.id} className="mb-6 lg:mb-8 p-4 lg:p-6 border border-blue-100 rounded-2xl shadow-md bg-gradient-to-br from-blue-50/30 to-white">
                    {headerBlock}
                    <p className="font-semibold text-gray-800 mb-3 lg:mb-4 text-base lg:text-lg whitespace-pre-wrap">{question.question_text}</p>
                    <div className="space-y-2 lg:space-y-3">
                        {question.answer_options.map((option) => (
                            <label key={option.id} className="flex items-center space-x-3 lg:space-x-4 cursor-pointer p-2 lg:p-3 rounded-xl hover:bg-blue-50 transition-colors duration-200">
                                <input
                                    type="radio"
                                    name={`question-${question.id}`}
                                    value={option.text}
                                    checked={answers[question.id.toString()]?.text === option.text}
                                    onChange={(e) => handleAnswerChange(question.id, null, e.target.value, 'multiple_choice')}
                                    className="h-4 w-4 lg:h-5 lg:w-5 text-blue-600 border-gray-300 focus:ring-blue-500 accent-blue-600 flex-shrink-0"
                                />
                                <span className="text-gray-700 font-medium text-sm lg:text-lg">{option.label}. {option.text}</span>
                            </label>
                        ))}
                    </div>
                </div>
            );
        }

        // --- Multiple Response ---
        if (type === 'multiple_response' && Array.isArray(question.answer_options)) {

            return (
                <div key={question.id} className="mb-6 lg:mb-8 p-4 lg:p-6 border border-blue-100 rounded-2xl shadow-md bg-gradient-to-br from-blue-50/30 to-white">
                    {headerBlock}
                    <p className="font-semibold text-gray-800 mb-3 lg:mb-4 text-base lg:text-lg whitespace-pre-wrap">{question.question_text}</p>
                    <div className="space-y-2 lg:space-y-3">
                        {question.answer_options.map((option) => (
                            <label key={option.id} className="flex items-center space-x-3 lg:space-x-4 cursor-pointer p-2 lg:p-3 rounded-xl hover:bg-blue-50 transition-colors duration-200">
                                <input
                                    type="checkbox"
                                    name={`question-${question.id}`}
                                    checked={(answers[question.id.toString()] || []).includes(option.text)}
                                    onChange={(e) => handleAnswerChange(question.id, null, { text: option.text, checked: e.target.checked }, 'multiple_response')}
                                    className="h-4 w-4 lg:h-5 lg:w-5 rounded text-blue-600 border-gray-300 focus:ring-blue-500 accent-blue-600 flex-shrink-0"
                                />
                                <span className="text-gray-700 font-medium text-sm lg:text-lg">{option.label}. {option.text}</span>
                            </label>
                        ))}
                    </div>
                </div>
            );
        }

        // --- Gap Fill ---
        if (["gap_fill", "gapfill", "summary_completion", "sentence_completion"].includes(type) && question.question_text) {
            const gapRegex = /\[\[(\d+)\]\]/g;
            const text = question.question_text;
            let lastIndex = 0;
            const parts = [];

            let match;
            while ((match = gapRegex.exec(text)) !== null) {
                parts.push(text.slice(lastIndex, match.index));
                const gapNumber = match[1];
                const subKey = `gap${gapNumber}`;
                parts.push(
                    <span key={subKey} className="inline-block mx-1">
                        <input
                            type="text"
                            value={answers[question.id.toString()]?.[subKey] || ''}
                            onChange={e => handleAnswerChange(question.id, subKey, e.target.value, 'gap_fill')}
                            className="border-b-2 border-blue-400 focus:border-blue-600 outline-none text-center bg-transparent w-32 lg:w-40 rounded-t-lg transition-colors duration-200 text-sm lg:text-base"
                            autoComplete="off"
                        />
                         <span className="text-blue-600 font-bold ml-1 text-sm lg:text-base">{gapNumber}</span>
                    </span>
                );
                lastIndex = gapRegex.lastIndex;
            }
            parts.push(text.slice(lastIndex));

            return (
                <div key={question.id} className="mb-6 lg:mb-8 p-4 lg:p-6 border border-blue-100 rounded-2xl shadow-md bg-gradient-to-br from-blue-50/30 to-white">
                    {headerBlock}
                    <div className="text-gray-800 leading-relaxed text-base lg:text-lg" style={{ whiteSpace: 'pre-wrap' }}>{parts}</div>
                </div>
            );
        }

        // --- Table Completion ---
        if (['table', 'table_completion'].includes(type) && question.extra_data && question.extra_data.headers && question.extra_data.rows) {
            const { headers, rows } = question.extra_data;
            return (
                 <div key={question.id} className="mb-6 lg:mb-8 p-4 lg:p-6 border border-blue-100 rounded-2xl shadow-md bg-gradient-to-br from-blue-50/30 to-white">
                    {headerBlock}
                    <div className="overflow-x-auto">
                        <table className="min-w-full border border-blue-200 rounded-xl overflow-hidden shadow-sm">
                            <thead>
                                <tr className="bg-gradient-to-r from-blue-100 to-blue-50">
                                    {headers.map((h, idx) => <th key={idx} className="p-3 lg:p-4 border-b border-blue-200 text-left font-semibold text-blue-700 text-sm lg:text-base">{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, rIdx) => (
                                    <tr key={rIdx} className="hover:bg-blue-50/50 transition-colors duration-200">
                                        {row.map((cell, cIdx) => (
                                            <td key={cIdx} className="p-3 lg:p-4 border border-blue-100">
                                                {typeof cell === 'object' && cell.type === 'gap' ? (
                                                    <input
                                                        type="text"
                                                        value={answers[question.id.toString()]?.[`r${rIdx}c${cIdx}`] || ''}
                                                        onChange={e => handleAnswerChange(question.id, `r${rIdx}c${cIdx}`, e.target.value, 'table')}
                                                        className="w-full border-2 border-blue-200 rounded-lg p-2 outline-none bg-white focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 text-sm lg:text-base"
                                                        placeholder="..."
                                                        autoComplete="off"
                                                    />
                                                ) : (
                                                    <span className="text-sm lg:text-base">{cell}</span>
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )
        }

        // --- Matching ---
        if (type === 'matching' && question.extra_data && Array.isArray(question.extra_data.items)) {
            const { items, options } = question.extra_data;
            const userAnswers = answers[question.id.toString()] || {};

            return (
                <div key={question.id} className="mb-6 lg:mb-8 p-4 lg:p-6 border border-blue-100 rounded-2xl shadow-md bg-gradient-to-br from-blue-50/30 to-white">
                    {headerBlock}
                    <div className="flex flex-col gap-6 lg:gap-8">
                        {/* Items to be matched */}
                        <div className="flex-1">
                            <ul className="space-y-3 lg:space-y-4">
                                {items.map((item, idx) => (
                                    <li key={idx} className="flex flex-col lg:flex-row lg:items-center lg:justify-between p-3 lg:p-4 bg-white rounded-xl border border-blue-100 shadow-sm gap-3 lg:gap-0">
                                        <span className="text-gray-800 font-medium text-sm lg:text-base">{item.text}</span>
                                        <select
                                            value={userAnswers[item.text] || ''}
                                            onChange={(e) => handleAnswerChange(question.id, item.text, e.target.value, 'matching')}
                                            className="lg:ml-4 p-2 lg:p-3 border-2 border-blue-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 text-sm lg:text-base"
                                        >
                                            <option value="" disabled>Select...</option>
                                            {(options || []).map((opt, optIdx) => (
                                                <option key={optIdx} value={opt.text}>{opt.text}</option>
                                            ))}
                                        </select>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            );
        }

        // --- True/False/Not Given ---
        if (type === 'true_false_not_given' && question.extra_data && Array.isArray(question.extra_data.statements)) {
            const { statements } = question.extra_data;
            const choices = ["True", "False", "Not Given"];
            return (
                <div key={question.id} className="mb-6 lg:mb-8 p-4 lg:p-6 border border-blue-100 rounded-2xl shadow-md bg-gradient-to-br from-blue-50/30 to-white">
                    {headerBlock}
                    <p className="font-semibold text-gray-800 mb-3 lg:mb-4 text-base lg:text-lg whitespace-pre-wrap">{question.question_text}</p>
                    <div className="space-y-3 lg:space-y-4">
                        {statements.map((stmt, sIdx) => (
                            <div key={sIdx} className="p-3 lg:p-4 rounded-xl border border-blue-100 bg-white shadow-sm">
                                <p className="mb-2 lg:mb-3 text-gray-800 font-medium text-sm lg:text-base">{sIdx + 1}. {stmt}</p>
                                <div className="flex flex-wrap gap-4 lg:gap-6">
                                    {choices.map(choice => (
                                        <label key={choice} className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name={`question-${question.id}-stmt-${sIdx}`}
                                                value={choice}
                                                checked={answers[question.id.toString()]?.[`stmt${sIdx}`] === choice}
                                                onChange={(e) => handleAnswerChange(question.id, `stmt${sIdx}`, e.target.value, 'true_false_not_given')}
                                                className="h-4 w-4 lg:h-5 lg:w-5 text-blue-600 border-gray-300 focus:ring-blue-500 accent-blue-600 flex-shrink-0"
                                            />
                                            <span className="font-medium text-sm lg:text-base">{choice}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        
        // --- Fallback for unknown question types ---
        return <div key={question.id} className="p-4 bg-yellow-100 rounded-md">Unsupported question type: {question.question_type}</div>;
    };


    if (isLoading) return <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-white"><div className="text-lg font-semibold text-gray-600">Loading test session...</div></div>;
    if (error) return <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-white"><div className="p-8 bg-red-100 text-red-700 rounded-lg shadow-md">Error: {error}</div></div>;

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
            {/* Header with timer */}
            <div className="bg-white shadow-md border-b sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col md:flex-row md:justify-between md:items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-blue-700 tracking-tight">{test?.title || 'Reading Test'}</h1>
                        <p className="text-sm text-gray-500">Part {currentPartIndex + 1} of {test?.parts?.length || 0}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-2 md:mt-0">
                        <ReadingTimer timeLeft={timeLeft} />
                    </div>
                </div>
            </div>

            <div className="w-full px-2 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 justify-center items-start">
                    {/* Left Panel: Passage + Navigation */}
                    <div className="lg:col-span-1 order-2 lg:order-1">
                        <div className="bg-white rounded-2xl shadow-xl p-6 lg:p-8 lg:sticky lg:top-24 border border-blue-100">
                            <h2 className="text-lg font-bold text-blue-700 mb-4">Passage</h2>
                            
                            {/* Passage content */}
                            <div className="max-h-[500px] lg:max-h-[1000px] overflow-y-auto mb-6">
                                {currentPart ? (
                                    <div className="prose prose-base lg:prose-lg max-w-none text-black leading-relaxed text-base lg:text-lg whitespace-pre-wrap" style={{ lineHeight: '1.6' }}>
                                    {currentPart.passage_text}
                                </div>
                                ) : (
                                    <div className="text-gray-400 text-center">Loading passage...</div>
                                )}
                            </div>


                        </div>
                    </div>
                    
                    {/* Right Panel: Questions */}
                    <div className="lg:col-span-1 order-1 lg:order-2 flex justify-center">
                        <div className="bg-white rounded-2xl shadow-xl p-6 lg:p-8 border border-blue-100 w-full">
                            {currentPart ? (
                                <>
                                    <div className="mb-6">
                                        <h2 className="text-xl lg:text-2xl font-bold text-blue-700 mb-4">Part {currentPartIndex + 1}</h2>
                                        
                                        {/* Part Navigation */}
                                        <div className="mb-4">
                                            <div className="flex flex-wrap gap-2">
                                                {test?.parts?.map((part, index) => (
                                                    <button
                                                        key={part.id}
                                                        onClick={() => setCurrentPartIndex(index)}
                                                        className={`px-3 py-2 rounded-lg font-semibold transition text-sm ${
                                                            currentPartIndex === index
                                                                ? 'bg-blue-100 text-blue-700 shadow border border-blue-200'
                                                                : 'hover:bg-blue-50 text-gray-700 border border-gray-200'
                                                        }`}
                                                    >
                                                        Part {part.part_number || index + 1}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        {currentPart.instructions && (
                                            <p className="text-gray-500 mb-4 text-sm lg:text-base bg-blue-50/30 p-3 lg:p-4 rounded-lg whitespace-pre-wrap">{currentPart.instructions}</p>
                                        )}
                                    </div>
                                    <div className="space-y-6 lg:space-y-8">
                                        {currentPart.questions?.map(renderQuestion)}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center p-8 w-full">Loading test data...</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Submit Button */}
            <div className="max-w-3xl mx-auto px-4 lg:px-2 pb-16 lg:pb-[60px]">
                <button
                    onClick={() => { if(window.confirm('Are you sure you want to finish the test?')) submitTest(); }}
                    disabled={isSubmitting}
                    className="w-full mt-8 lg:mt-10 bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700 font-bold text-lg lg:text-xl py-4 rounded-2xl shadow-lg hover:from-blue-200 hover:to-blue-300 transition-all duration-300 disabled:opacity-50 border border-blue-200"
                >
                    {isSubmitting ? 'Submitting...' : 'Submit Test'}
                </button>
            </div>
        </div>
    );
};

export default ReadingTestPlayer; 