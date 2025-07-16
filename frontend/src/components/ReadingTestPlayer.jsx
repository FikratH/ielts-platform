import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth } from '../firebase-config';
import { useAuthState } from 'react-firebase-hooks/auth';
import axios from '../axios';


const ReadingTimer = ({ timeLeft, color = 'text-red-600' }) => {
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
            setAnswers(newSession.answers || {});

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
        
        setAnswers(prev => {
            const newAnswers = { ...prev };
            
            if (!newAnswers[qIdStr]) {
                newAnswers[qIdStr] = {};
            }

            if (type === 'multiple_choice') {
                newAnswers[qIdStr] = { text: value };
            } else if (type === 'multiple_response') {
                const currentSelection = newAnswers[qIdStr] || [];
                if (value.checked) {
                    newAnswers[qIdStr] = [...currentSelection, value.text];
                } else {
                    newAnswers[qIdStr] = currentSelection.filter(item => item !== value.text);
                }
            } else if (type === 'matching') {
                newAnswers[qIdStr] = { ...newAnswers[qIdStr], [subKey]: value };
            } else { // Gap-fill, table cells
                newAnswers[qIdStr][subKey] = value;
            }

            return newAnswers;
        });
    };

    const submitTest = async () => {
        if (!session || isSubmitting) return;
        setIsSubmitting(true);
        
        try {
          const response = await axios.put(`/api/reading-sessions/${session.id}/submit/`, { 
              answers,
          });
          
          if (response.status === 200) {
            navigate(`/reading-result/${session.id}`);
          }
        } catch (err) {
          setError('Failed to submit test. Your progress is saved, please contact support.');
          console.error("Submit error:", err.response?.data || err);
          setIsSubmitting(false);
        }
    };

    const currentPart = test?.parts?.[currentPartIndex];

    const renderQuestion = (question) => {
        const type = (question.question_type || '').toLowerCase();

        // --- Standard Question Header Block ---
        const headerBlock = (
            <div className="mb-4">
                {question.header && (
                    <div className="font-bold text-gray-800" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                        {question.header}
                    </div>
                )}
                {question.instruction && (
                    <div className="text-gray-600 italic mt-1" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                        {question.instruction}
                    </div>
                )}
                {question.image_url && (
                    <div className="my-3 flex justify-center">
                        <img
                            src={question.image_url}
                            alt="Question Illustration"
                            style={{ maxWidth: '400px', maxHeight: '250px', borderRadius: '8px' }}
                        />
                    </div>
                )}
            </div>
        );
        
        // --- Multiple Choice ---
        if (["multiple_choice", "multiplechoice"].includes(type) && Array.isArray(question.answer_options)) {
            return (
                <div key={question.id} className="mb-6">
                    {headerBlock}
                    <p className="font-semibold text-gray-800 mb-3">{question.question_text}</p>
                    <div className="space-y-2">
                        {question.answer_options.map((option) => (
                            <label key={option.id} className="flex items-center space-x-3 cursor-pointer p-2 rounded-lg hover:bg-gray-100">
                                <input
                                    type="radio"
                                    name={`question-${question.id}`}
                                    value={option.text}
                                    checked={answers[question.id.toString()]?.text === option.text}
                                    onChange={(e) => handleAnswerChange(question.id, null, e.target.value, 'multiple_choice')}
                                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                />
                                <span className="text-gray-700">{option.label}. {option.text}</span>
                            </label>
                        ))}
                    </div>
                </div>
            );
        }

        // --- Multiple Response ---
        if (type === 'multiple_response' && Array.isArray(question.answer_options)) {

            return (
                <div key={question.id} className="mb-6">
                    {headerBlock}
                    <p className="font-semibold text-gray-800 mb-3">{question.question_text}</p>
                    <div className="space-y-2">
                        {question.answer_options.map((option) => (
                            <label key={option.id} className="flex items-center space-x-3 cursor-pointer p-2 rounded-lg hover:bg-gray-100">
                                <input
                                    type="checkbox"
                                    name={`question-${question.id}`}
                                    checked={(answers[question.id.toString()] || []).includes(option.text)}
                                    onChange={(e) => handleAnswerChange(question.id, null, { text: option.text, checked: e.target.checked }, 'multiple_response')}
                                    className="h-4 w-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                                />
                                <span className="text-gray-700">{option.label}. {option.text}</span>
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
                            className="border-b-2 border-gray-400 focus:border-blue-500 outline-none text-center bg-transparent w-40"
                            autoComplete="off"
                        />
                         <span className="text-gray-500 font-bold ml-1">{gapNumber}</span>
                    </span>
                );
                lastIndex = gapRegex.lastIndex;
            }
            parts.push(text.slice(lastIndex));

            return (
                <div key={question.id} className="mb-6">
                    {headerBlock}
                    <div className="text-gray-800 leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>{parts}</div>
                </div>
            );
        }

        // --- Table Completion ---
        if (type === 'table' && question.extra_data && question.extra_data.headers && question.extra_data.rows) {
            const { headers, rows } = question.extra_data;
            return (
                 <div key={question.id} className="mb-6">
                    {headerBlock}
                    <div className="overflow-x-auto">
                        <table className="min-w-full border border-gray-300">
                            <thead>
                                <tr className="bg-gray-100">
                                    {headers.map((h, idx) => <th key={idx} className="p-2 border-b text-left">{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, rIdx) => (
                                    <tr key={rIdx} className="hover:bg-gray-50">
                                        {row.map((cell, cIdx) => (
                                            <td key={cIdx} className="p-2 border">
                                                {typeof cell === 'object' && cell.type === 'gap' ? (
                                                    <input
                                                        type="text"
                                                        value={answers[question.id.toString()]?.[`r${rIdx}c${cIdx}`] || ''}
                                                        onChange={e => handleAnswerChange(question.id, `r${rIdx}c${cIdx}`, e.target.value, 'table')}
                                                        className="w-full border-none outline-none bg-transparent"
                                                        placeholder="..."
                                                        autoComplete="off"
                                                    />
                                                ) : (
                                                    <span>{cell}</span>
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
                <div key={question.id} className="mb-8">
                    {headerBlock}
                    <div className="flex flex-col md:flex-row gap-8">
                        {/* Items to be matched */}
                        <div className="flex-1">
                            <ul className="space-y-3">
                                {items.map((item, idx) => (
                                    <li key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <span className="text-gray-800">{item.text}</span>
                                        <select
                                            value={userAnswers[item.text] || ''}
                                            onChange={(e) => handleAnswerChange(question.id, item.text, e.target.value, 'matching')}
                                            className="ml-4 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
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
                <div key={question.id} className="mb-6">
                    {headerBlock}
                    <p className="font-semibold text-gray-800 mb-3">{question.question_text}</p>
                    <div className="space-y-4">
                        {statements.map((stmt, sIdx) => (
                            <div key={sIdx} className="p-3 rounded-lg border bg-gray-50">
                                <p className="mb-2 text-gray-800">{sIdx + 1}. {stmt}</p>
                                <div className="flex space-x-4">
                                    {choices.map(choice => (
                                        <label key={choice} className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name={`question-${question.id}-stmt-${sIdx}`}
                                                value={choice}
                                                checked={answers[question.id.toString()]?.[`stmt${sIdx}`] === choice}
                                                onChange={(e) => handleAnswerChange(question.id, `stmt${sIdx}`, e.target.value, 'true_false_not_given')}
                                                className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                            />
                                            <span>{choice}</span>
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
        return (
            <div key={question.id} className="mb-6 p-4 bg-yellow-100 rounded-lg">
                {headerBlock}
                <p>{question.question_text}</p>
                <p className="text-sm text-red-600 mt-2">
                    This question type ({question.question_type}) is not fully supported yet.
                </p>
            </div>
        );
    };

    // --- Main Render ---

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><p>Loading Test...</p></div>;
    }

    if (error) {
        return <div className="flex justify-center items-center h-screen text-red-500"><p>{error}</p></div>;
    }

    if (!test || !session) {
        return <div className="flex justify-center items-center h-screen"><p>Could not load test data.</p></div>;
    }
    
    return (
        <div style={{ height: 'calc(100vh - 80px)' }} className="flex bg-gray-50 font-sans">
            {/* Left Side: Passage */}
            <div className="w-1/2 p-6 overflow-y-auto">
                <h2 className="text-2xl font-bold mb-4 text-gray-800">{currentPart?.title || 'Reading Passage'}</h2>
                <div 
                    className="text-base text-gray-700 leading-relaxed" 
                    style={{ whiteSpace: 'pre-wrap' }}
                    dangerouslySetInnerHTML={{ __html: currentPart?.passage_text || "No passage available." }}
                />
            </div>
            
            {/* Right Side: Questions */}
            <div className="w-1/2 p-6 flex flex-col border-l border-gray-200">
                <div className="flex-grow overflow-y-auto">
                    <h2 className="text-2xl font-bold mb-4 text-gray-800">Questions</h2>
                    {currentPart?.questions?.map(renderQuestion)}
                </div>

                {/* Footer and Navigation */}
                <div className="flex-shrink-0 mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                        <div>
                            {/* Part navigation */}
                            {test.parts.map((part, index) => (
                                <button 
                                    key={part.id || index}
                                    onClick={() => setCurrentPartIndex(index)}
                                    className={`px-3 py-1 rounded-md text-sm mr-2 ${currentPartIndex === index ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                                >
                                    Part {part.part_number}
                                </button>
                            ))}
                        </div>
                        
                        <ReadingTimer timeLeft={timeLeft} />

                        <button
                            onClick={submitTest}
                            disabled={isSubmitting}
                            className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
                        >
                            {isSubmitting ? 'Submitting...' : 'Finish Test'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReadingTestPlayer; 