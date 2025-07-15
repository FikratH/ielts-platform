import React, { useState, useEffect, useRef } from 'react';
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
    const [isSubmitted, setIsSubmitted] = useState(false);

    // UI state
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showResults, setShowResults] = useState(false);
    const [results, setResults] = useState(null);

    // Effect to start session and load test
    useEffect(() => {
        if (user && testId) {
            startSessionAndLoadTest();
        }
    }, [user, testId]);

    // Timer effect
    useEffect(() => {
        if (session && !isSubmitted && timeLeft > 0) {
            const timer = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        // handleAutoSubmit();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [session, isSubmitted, timeLeft]);


    const startSessionAndLoadTest = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Start session
            const sessionResponse = await axios.post(`/api/reading-tests/${testId}/start/`);
            setSession(sessionResponse.data);
            setTimeLeft(sessionResponse.data.time_left || 3600);

            // Load test data
            const testResponse = await axios.get(`/api/reading-tests/${testId}/`);
            const testData = testResponse.data;

            if (Array.isArray(testData.parts)) {
                testData.parts = testData.parts.map(part => ({
                    ...part,
                    questions: normalizeQuestions(part.questions || [])
                }));
            }
            setTest(testData);

        } catch (err) {
            setError('Failed to load or start the test. Please try again.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const normalizeQuestions = (questions) =>
    questions.map(q => {
        const extra = q.extra_data || {};
        return {
            ...q,
            // ensure all possible fields are present
            table: q.table || extra.table,
            fields: q.fields || extra.fields,
            gaps: q.gaps || extra.gaps,
            options: q.options || extra.options,
            left: q.left || extra.left,
            right: q.right || extra.right,
            answer: q.answer || extra.answer,
            points: q.points || extra.points,
        };
    });


    const handleAnswerChange = (subKey, value) => {
        setAnswers(prev => ({
            ...prev,
            [subKey]: value
        }));
    };

    const submitTest = async () => {
        if (!session || isSubmitted) return;
        
        try {
          const response = await axios.post(`/api/reading-sessions/${session.id}/submit/`, { 
              answers, 
              time_left: timeLeft 
          });
          
          if (response.status === 200) {
            setResults(response.data);
            setIsSubmitted(true);
            setShowResults(true);
            window.dispatchEvent(new Event('readingHistoryUpdated'));
          }
        } catch (err) {
          setError('Failed to submit test');
        }
      };
    
    const renderQuestion = (question) => {
        const type = (question.question_type || '').toLowerCase();

        // --- Блок заголовка и инструкции (Стили из Listening) ---
        const headerBlock = (
            <div className="mb-3">
                {question.header && (
                    <div className="font-bold text-xl text-blue-900 mb-1" style={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                        {question.header}
                    </div>
                )}
                {question.instruction && (
                    <div className="text-gray-800 mb-2" style={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                        {question.instruction}
                    </div>
                )}
                {question.image_url && (
                    <div className="mb-3 flex justify-center">
                        <img
                            src={question.image_url}
                            alt="Question Illustration"
                            style={{ maxWidth: '350px', maxHeight: '220px', borderRadius: '8px', border: '1px solid #e0e7ef' }}
                        />
                    </div>
                )}
            </div>
        );
        
        // --- Блок с текстом вопроса (Стили из Listening) ---
        const questionTextBlock = (
             <div className="flex justify-between items-center mb-3">
                <p className="font-semibold text-lg text-gray-800">{question.question_text}</p>
                 {/* TODO: Add flagging button later */}
             </div>
        );


        // --- Multiple Choice (Логика исправлена, стили из Listening) ---
        if (["multiple_choice", "multiplechoice"].includes(type) && Array.isArray(question.answer_options)) {
            const subKey = question.id.toString();
            return (
                <div key={question.id} className="mb-6 p-6 border border-blue-100 rounded-2xl shadow bg-blue-50/30">
                    {headerBlock}
                    {question.question_text && questionTextBlock}
                    <div className="space-y-3">
                        {question.answer_options.map((option) => (
                            <label key={option.id} className="flex items-center space-x-3 cursor-pointer text-lg p-2 rounded-lg hover:bg-blue-100 transition">
                                <input
                                    type="radio"
                                    name={`question-${question.id}`}
                                    value={option.label}
                                    checked={answers[subKey] === option.label}
                                    onChange={(e) => handleAnswerChange(subKey, e.target.value)}
                                    className="accent-blue-600 w-5 h-5"
                                />
                                <span className="font-medium text-gray-700">{option.label}. {option.text}</span>
                            </label>
                        ))}
                    </div>
                </div>
            );
        }

        // --- Gap Fill (Логика и стили из Listening) ---
        if (["gap_fill", "gapfill", "summary_completion", "sentence_completion"].includes(type) && question.question_text) {
            const gapRegex = /\[\[(\d+)\]\]/g;
            const text = question.question_text;
            const parts = [];
            let lastIndex = 0;
            let match;

            while ((match = gapRegex.exec(text)) !== null) {
                const before = text.slice(lastIndex, match.index);
                if (before) parts.push(<span key={`text-${lastIndex}`}>{before}</span>);

                const gapNumber = parseInt(match[1], 10);
                const subKey = `${question.id}__gap${gapNumber}`;

                parts.push(
                    <span key={`gap-${gapNumber}`} style={{ display: 'inline-flex', alignItems: 'center', margin: '0 4px', verticalAlign: 'bottom' }}>
                        <span style={{ fontWeight: 700, color: '#0284c7', marginRight: '4px' }}>{gapNumber}</span>
                        <input
                            type="text"
                            value={answers[subKey] || ''}
                            onChange={e => handleAnswerChange(subKey, e.target.value)}
                            style={{
                                border: 'none',
                                borderBottom: '1.5px solid #9ca3af',
                                background: 'transparent',
                                textAlign: 'center',
                                width: '150px',
                                outline: 'none',
                                padding: '2px 4px',
                                fontSize: '1rem',
                            }}
                            autoComplete="off"
                        />
                    </span>
                );
                lastIndex = gapRegex.lastIndex;
            }
            if (lastIndex < text.length) {
                parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
            }

            return (
                <div key={question.id} className="mb-6 p-6 border border-blue-100 rounded-2xl shadow bg-blue-50/30">
                    {headerBlock}
                    <div className="text-lg leading-loose" style={{ whiteSpace: 'pre-line' }}>{parts}</div>
                </div>
            );
        }
        
        // --- Fallback ---
        return (
            <div key={question.id}>
                {headerBlock}
                {question.question_text && <p className="font-semibold text-lg text-gray-800 mb-3">{question.question_text}</p>}
                <p className="text-sm text-gray-500">Type: {type}</p>
                <p className="text-orange-600">This question type is not fully implemented yet.</p>
            </div>
        );
    };

    if (isLoading) {
        return <div className="text-center p-8">Loading test...</div>;
    }

    if (error) {
        return <div className="text-center p-8 text-red-500 bg-red-100 rounded-lg">{error}</div>;
    }

    // TODO: Add results view later
    if (showResults && results) {
        return (
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold">Test Completed!</h2>
            <p>Score: {results.band_score}</p>
             <button onClick={() => navigate('/dashboard')} className="mt-4 bg-blue-500 text-white px-4 py-2 rounded">Back to Dashboard</button>
          </div>
        );
    }


    if (!test || !session) {
        return <div className="text-center p-8">Could not load test data.</div>;
    }
    
    const currentPartData = test.parts?.[currentPartIndex];

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
            {/* Header */}
            <div className="bg-white shadow-md border-b sticky top-0 z-20">
                <div className="max-w-screen-2xl mx-auto px-4 py-3 flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">{test.title}</h1>
                        <p className="text-sm text-gray-500">Part {currentPartIndex + 1} of {test.parts?.length || 0}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <ReadingTimer timeLeft={timeLeft} />
                    </div>
                </div>
                 {/* Part Navigation */}
                 <div className="max-w-screen-2xl mx-auto px-4 py-2 border-t">
                    <div className="flex space-x-2">
                        {test.parts?.map((part, index) => (
                            <button
                            key={part.id || index}
                            onClick={() => setCurrentPartIndex(index)}
                            className={`px-4 py-2 rounded-md font-semibold text-sm transition ${
                                currentPartIndex === index
                                ? 'bg-blue-600 text-white shadow'
                                : 'bg-white text-gray-700 hover:bg-gray-100'
                            }`}
                            >
                            Part {index + 1}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            <div className="max-w-screen-2xl mx-auto p-4 grid grid-cols-5 gap-8">
                {/* Left: Passage */}
                <div className="col-span-2 bg-white p-6 rounded-2xl shadow-xl border border-gray-200 h-screen-80 overflow-y-auto">
                    <h2 className="text-2xl font-bold mb-4">{currentPartData?.title}</h2>
                    <div 
                        className="prose max-w-none" 
                        dangerouslySetInnerHTML={{ __html: currentPartData?.passage_text }} 
                    />
                </div>

                {/* Right: Questions */}
                <div className="col-span-3 h-screen-80 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200 w-full">
                        {currentPartData && (
                            <>
                                <div className="mb-6">
                                    <h2 className="text-2xl font-bold text-blue-700 mb-2">Part {currentPartIndex + 1}</h2>
                                    {currentPartData.instructions && (
                                    <p className="text-gray-500 mb-4 text-base">{currentPartData.instructions}</p>
                                    )}
                                </div>
                                <div className="space-y-8">
                                    {currentPartData.questions?.map(renderQuestion)}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Submit Button */}
            <div className="max-w-3xl mx-auto px-2 pb-16 pt-8">
                <button
                onClick={submitTest}
                disabled={isSubmitted}
                className="w-full mt-10 bg-blue-100 text-blue-700 font-bold text-xl py-4 rounded-2xl shadow hover:bg-blue-200 transition disabled:opacity-50 border border-blue-200"
                >
                Submit Test
                </button>
            </div>
        </div>
    );
};

export default ReadingTestPlayer; 