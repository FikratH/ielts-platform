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

            return newAnswers;
        });
    };

    const goToNextPart = () => {
        if (test && currentPartIndex < test.parts.length - 1) {
            setCurrentPartIndex(currentPartIndex + 1);
        }
    };

    const goToPreviousPart = () => {
        if (currentPartIndex > 0) {
            setCurrentPartIndex(currentPartIndex - 1);
        }
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
          setError('Failed to submit test.');
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
        if (['table', 'table_completion'].includes(type) && question.extra_data && question.extra_data.headers && question.extra_data.rows) {
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
        return <div key={question.id} className="p-4 bg-yellow-100 rounded-md">Unsupported question type: {question.question_type}</div>;
    };


    if (isLoading) return <div className="flex items-center justify-center min-h-screen bg-gray-100"><div className="text-lg font-semibold text-gray-600">Loading test session...</div></div>;
    if (error) return <div className="flex items-center justify-center min-h-screen bg-gray-100"><div className="p-8 bg-red-100 text-red-700 rounded-lg shadow-md">Error: {error}</div></div>;

    return (
        <div className="bg-gray-50 min-h-screen font-sans p-2 sm:p-4">
            <div className="container mx-auto">
                {/* Header: Title and Timer */}
                <div className="flex justify-between items-center mb-2">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">{test?.title || 'Reading Test'}</h1>
                        <p className="text-gray-500">Part {currentPartIndex + 1} of {test?.parts?.length || 0}</p>
                    </div>
                        <ReadingTimer timeLeft={timeLeft} />
                </div>

                {/* Main Content Card */}
                <div className="bg-white rounded-xl shadow-lg flex flex-col lg:flex-row" style={{ minHeight: 'calc(100vh - 80px)' }}>
                    { !test || !currentPart ? (
                        <div className="text-center p-8 w-full">Loading test data...</div>
                    ) : (
                        <>
                            {/* Left Column: Passage */}
                            <div className="w-full lg:w-5/12 border-b lg:border-b-0 lg:border-r border-gray-200 p-10 flex flex-col">
                                <h2 className="text-xl font-bold mb-4 flex-shrink-0">Passage</h2>
                                <div className="overflow-y-auto flex-grow">
                                     <div className="prose max-w-none prose-xl text-lg leading-relaxed" dangerouslySetInnerHTML={{ __html: currentPart.passage_text?.replace(/\n/g, '<br />') }} />
                                </div>
                            </div>

                            {/* Right Column: Questions and Navigation */}
                            <div className="w-full lg:w-7/12 p-10 flex flex-col">
                                {/* Part Navigation Tabs */}
                                <div className="flex-shrink-0 border-b border-gray-200 mb-4">
                                    <nav className="-mb-px flex space-x-6">
                                        {test.parts.map((part, index) => (
                            <button
                                                key={part.id}
                            onClick={() => setCurrentPartIndex(index)}
                                                className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                currentPartIndex === index
                                                        ? 'border-blue-500 text-blue-600'
                                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                            >
                                                Part {part.part_number}
                            </button>
                        ))}
                                    </nav>
            </div>

                                {/* Questions Area */}
                                <div className="overflow-y-auto flex-grow text-lg">
                                    <div className="space-y-8">
                                        {currentPart.questions.map(renderQuestion)}
                </div>
                </div>

                                {/* Submit Button Area */}
                                <div className="flex-shrink-0 pt-6 mt-auto">
                                    <button
                                        onClick={() => { if(window.confirm('Are you sure you want to finish the test?')) submitTest(); }}
                                        disabled={isSubmitting}
                                        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-all disabled:bg-gray-400"
                                    >
                                        {isSubmitting ? 'Submitting...' : 'Submit Test'}
                                    </button>
                                </div>
                                </div>
                            </>
                        )}
                    </div>
            </div>
        </div>
    );
};

export default ReadingTestPlayer; 