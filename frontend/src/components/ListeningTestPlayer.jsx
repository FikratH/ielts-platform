import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth } from '../firebase-config';
import { useAuthState } from 'react-firebase-hooks/auth';

const ListeningTimer = ({ timeLeft, color = 'text-blue-600' }) => {
  const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const secs = (timeLeft % 60).toString().padStart(2, '0');
  return (
    <div className="flex flex-col items-center">
      <span className={`text-4xl font-mono font-bold ${color} tracking-widest`} style={{ letterSpacing: '0.05em' }}>{mins}:{secs}</span>
      <span className="text-xs text-gray-400 mt-1">Time Remaining</span>
    </div>
  );
};

const ListeningTestPlayer = () => {
  const { id: testId } = useParams();
  const navigate = useNavigate();
  const [user, loading] = useAuthState(auth);
  
  // Test state
  const [test, setTest] = useState(null);
  const [session, setSession] = useState(null);
  const [currentPart, setCurrentPart] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState({}); // Track flagged questions
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioPlayed, setAudioPlayed] = useState(false); // Track if audio was played
  const [audioEnded, setAudioEnded] = useState(false); // Track if audio ended
  const audioRef = useRef(null);
  
  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState(null);
  const [showNavigationWarning, setShowNavigationWarning] = useState(false);

  // Глобальное состояние громкости (0..1), с восстановлением из localStorage
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('audioVolume');
    return saved !== null ? parseFloat(saved) : 1;
  });
  useEffect(() => {
    localStorage.setItem('audioVolume', volume);
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [currentPart]);

  console.log('ListeningTestPlayer MOUNTED', { testId, user, loading });

  if (loading) {
    console.log('Auth loading...');
  }
  if (!user && !loading) {
    console.log('No user!');
  }

  // Timer effect
  useEffect(() => {
    if (session && !isSubmitted && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [session, isSubmitted, timeLeft]);

  // Start session on component mount
  useEffect(() => {
    console.log('useEffect: user', user, 'testId', testId, 'loading', loading, 'error', error);
    if (user && testId && !error) {
      startSession();
    }
  }, [user, testId, error]);

  // IELTS Rules: Prevent navigation away
  // useEffect(() => {
  //   const handleBeforeUnload = (e) => {
  //     if (session && !isSubmitted) {
  //       e.preventDefault();
  //       e.returnValue = 'Test will be auto-submitted if you leave this page.';
  //       return 'Test will be auto-submitted if you leave this page.';
  //     }
  //   };

  //   window.addEventListener('beforeunload', handleBeforeUnload);
  //   return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  // }, [session, isSubmitted]);

  // IELTS Rules: Auto-submit on disconnect
  // useEffect(() => {
  //   const handleVisibilityChange = () => {
  //     if (document.hidden && session && !isSubmitted) {
  //       // User switched tabs or minimized - auto-submit after delay
  //       setTimeout(() => {
  //         if (document.hidden) {
  //           handleAutoSubmit();
  //         }
  //       }, 30000); // 30 seconds delay
  //     }
  //   };

  //   document.addEventListener('visibilitychange', handleVisibilityChange);
  //   return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  // }, [session, isSubmitted]);

  const startSession = async () => {
    console.log('startSession CALLED', { user, testId });
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/listening-tests/${testId}/start/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const sessionData = await response.json();
        setSession(sessionData);
        setTimeLeft(sessionData.time_left || 1800);
        loadTest();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to start session');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Network error');
      setIsLoading(false);
    }
  };

  const normalizeQuestions = (questions) =>
    questions.map(q => {
      const extra = q.extra_data || {};
      const normalized = {
        ...q,
        table: q.table || extra.table,
        fields: q.fields || extra.fields,
        gaps: q.gaps || extra.gaps,
        options: q.options || extra.options,
        left: q.left || extra.left,
        right: q.right || extra.right,
        answer: q.answer || extra.answer,
        points: q.points || extra.points,
      };
      
      // Дополнительная отладка для табличных вопросов
      if (["table", "table_completion", "tablecompletion"].includes((q.question_type || '').toLowerCase())) {
        console.log('Normalizing table question:', {
          questionId: q.id,
          originalTable: q.table,
          extraDataTable: extra.table,
          normalizedTable: normalized.table,
          extraData: extra
        });
      }
      
      return normalized;
    });

  const loadTest = async () => {
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/listening-tests/${testId}/`, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });
      
      if (response.ok) {
        const testData = await response.json();
        // Нормализуем вопросы для каждой части
        if (Array.isArray(testData.parts)) {
          testData.parts = testData.parts.map(part => ({
            ...part,
            questions: normalizeQuestions(part.questions || [])
          }));
        }
        setTest(testData);
      }
    } catch (err) {
      setError('Failed to load test');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSession = async (sessionId) => {
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/listening-sessions/${sessionId}/sync/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers, time_left: timeLeft }),
      });
      
      if (response.ok) {
        const sessionData = await response.json();
        // setAnswers(sessionData.answers || {}); // Не сбрасываем локальные ответы!
        setTimeLeft(sessionData.time_left || 1800);
      }
    } catch (err) {
      console.error('Failed to sync session');
    }
  };

  const handleAnswerChange = (subKey, value) => {
    setAnswers(prev => ({
      ...prev,
      [subKey]: value
    }));
  };

  const toggleFlag = (questionId) => {
    setFlagged(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
    
    // Auto-sync after a delay
    setTimeout(syncAnswers, 1000);
  };

  const syncAnswers = async () => {
    if (!session) return;
    
    try {
      const idToken = await user.getIdToken();
      await fetch(`/api/listening-sessions/${session.id}/sync/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          answers, 
          flagged, // Include flagged questions
          time_left: timeLeft 
        }),
      });
    } catch (err) {
      console.error('Failed to sync answers');
    }
  };

  const handleAutoSubmit = async () => {
    if (isSubmitted) return;
    await submitTest();
  };

  const submitTest = async () => {
    if (!session || isSubmitted) return;
    
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/listening-sessions/${session.id}/submit/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers, time_left: timeLeft }),
      });
      
      if (response.ok) {
        const resultData = await response.json();
        setResults(resultData);
        setIsSubmitted(true);
        setShowResults(true);
      }
    } catch (err) {
      setError('Failed to submit test');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Добавить функцию форматирования времени
  function formatTimeTaken(time) {
    const seconds = Math.floor(Number(time));
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  const renderQuestion = (question) => {
    const value = answers[question.id] || '';
    const isFlagged = flagged[question.id] || false;
    const type = (question.question_type || '').toLowerCase();
    // Универсальный вывод header/instruction для всех типов
    const headerBlock = (
      <div className="mb-3">
      {question.header && (
          <div
            className="font-bold text-xl text-blue-900 mb-1"
            style={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}
          >
            {question.header}
          </div>
      )}
      {question.instruction && (
          <div
            className="text-gray-800 mb-2"
            style={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}
          >
            {question.instruction}
          </div>
      )}
        {/* Универсальный блок для изображения */}
        {question.image && (
          <div className="mb-3 flex justify-center">
            <img
              src={question.image}
              alt="Question"
              style={{ maxWidth: '350px', maxHeight: '220px', borderRadius: '8px', border: '1px solid #e0e7ef', background: '#fff' }}
            />
          </div>
        )}
      </div>
    );
    // Типы, для которых не нужно показывать текст вопроса в заголовке
    const hideHeaderTextTypes = [
      "sentence_completion", "summary_completion", "note_completion", "flow_chart", "gap_fill",
      "gapfill", "sentencecompletion", "summarycompletion", "notecompletion", "flowchart"
    ];
    const hideHeaderText = hideHeaderTextTypes.includes(type);
    const questionHeader = (
      <div className="flex justify-between items-center mb-3">
        {!hideHeaderText && (
          <p className="font-semibold text-lg text-gray-800">{question.question_text}</p>
        )}
        <button
          onClick={() => toggleFlag(question.id)}
          className={`ml-2 px-3 py-1 rounded-xl text-base font-semibold flex items-center gap-1 border transition ${
            isFlagged
              ? 'bg-yellow-100 text-yellow-800 border-yellow-300 shadow'
              : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-yellow-50'
          }`}
          title={isFlagged ? 'Remove flag' : 'Flag for review'}
        >
          {isFlagged ? <span>🚩 Flagged</span> : <span>⚐ Flag</span>}
        </button>
      </div>
    );

    // Table Completion (все алиасы)
    if (["table", "table_completion", "tablecompletion"].includes(type)) {
      // Проверяем все возможные места, где могут быть данные таблицы
      const table = question.table || 
                   (question.extra_data && question.extra_data.table) || 
                   null;
      
      console.log('Table question debug:', {
        questionId: question.id,
        type: type,
        hasTable: !!question.table,
        hasExtraData: !!question.extra_data,
        hasExtraDataTable: !!(question.extra_data && question.extra_data.table),
        table: table,
        extraData: question.extra_data
      });
      
      if (!table || !Array.isArray(table.cells)) {
        console.log('Table data missing or invalid:', table);
        return (
          <div key={question.id} className="mb-6 p-6 border border-red-200 rounded-2xl shadow bg-red-50/30">
            {headerBlock}
            {questionHeader}
            <div className="text-red-600">
              <p>⚠️ Table data is missing or invalid for this question.</p>
              <p>Question type: {type}</p>
              <p>Has table: {!!question.table}</p>
              <p>Has extra_data: {!!question.extra_data}</p>
              <p>Table structure: {JSON.stringify(table, null, 2)}</p>
            </div>
          </div>
        );
      }
      
      return (
        <div key={question.id} className="mb-6 p-6 border border-blue-100 rounded-2xl shadow bg-blue-50/30">
          {headerBlock}
          {questionHeader}
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <tbody>
                {table.cells.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => (
                      <td key={c} className="border p-2 align-middle bg-white">
                        {cell.isAnswer ? (
                          <input
                            type="text"
                            value={answers[`${question.id}__r${r}c${c}`] || ''}
                            onChange={e => handleAnswerChange(`${question.id}__r${r}c${c}`, e.target.value)}
                            className="w-full p-2 border rounded"
                            placeholder="Your answer"
                          />
                        ) : (
                          <span>{cell.text}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // Form Completion (все алиасы)
    if (["form", "form_completion", "formcompletion"].includes(type) && (Array.isArray(question.fields) || (question.extra_data && Array.isArray(question.extra_data.fields)))) {
      const fields = question.fields || (question.extra_data && question.extra_data.fields) || [];
      return (
        <div key={question.id} className="mb-6 p-6 border border-blue-100 rounded-2xl shadow bg-blue-50/30">
          {headerBlock}
          {questionHeader}
          <div className="space-y-4">
            {fields.map((field, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="font-bold bg-blue-100 text-blue-700 rounded-full w-8 h-8 flex items-center justify-center">{field.label || idx + 1}</span>
                <input
                  type="text"
                  value={answers[`${question.id}__${idx}`] || ''}
                  onChange={e => handleAnswerChange(`${question.id}__${idx}`, e.target.value)}
                  className="flex-1 p-3 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-400 text-lg bg-white shadow-sm"
                  placeholder="Your answer..."
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Gap Fill (универсальный IELTS)
    if (type === 'gap_fill') {
      const gapRegex = /\[\[(\d+)\]\]/g;
      let text = question.question_text;
      let match;
      let lastIndex = 0;
      let gapIdx = 0;
      const parts = [];
      const gaps = Array.isArray(question.gaps) ? question.gaps : [];
      // Проверка на совпадение количества gaps и [[номер]]
      const matches = [...(text.matchAll(gapRegex) || [])];
      let warning = null;
      if (gaps.length !== matches.length) {
        warning = (
          <div className="text-red-600 text-sm mb-2">⚠️ Количество [[номер]] в тексте ({matches.length}) не совпадает с количеством gaps ({gaps.length})</div>
        );
      }
      while ((match = gapRegex.exec(text)) !== null) {
        const before = text.slice(lastIndex, match.index);
        if (before) parts.push(<span key={`t${gapIdx}`}>{before}</span>);
        const gapNumber = parseInt(match[1], 10);
        const gapObj = gaps.find(g => g.number === gapNumber) || { number: gapNumber };
        parts.push(
          <span key={`gap${gapNumber}`} style={{ display: 'inline-flex', alignItems: 'center', margin: '0 8px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#e0f2fe',
              color: '#0284c7',
              fontWeight: 700,
              fontSize: 16,
              marginRight: 6
            }}>{gapNumber}</span>
            <input
              type="text"
              value={answers[`${question.id}__gap${gapNumber}`] || ''}
              onChange={e => handleAnswerChange(`${question.id}__gap${gapNumber}`, e.target.value)}
              style={{
                height: '28px',
                minWidth: '40px',
                padding: '0 6px',
                border: '1.5px solid #b6c2cf',
                borderRadius: '16px',
                fontSize: '15px',
                background: '#fff',
                color: '#222',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border 0.2s',
                marginBottom: '4px'
              }}
              autoComplete="off"
            />
          </span>
        );
        lastIndex = gapRegex.lastIndex;
        gapIdx++;
      }
      if (lastIndex < text.length) {
        parts.push(<span key="end">{text.slice(lastIndex)}</span>);
      }
      return (
        <div key={question.id} className="mb-6 p-6 border border-blue-100 rounded-2xl shadow bg-blue-50/30">
          {headerBlock}
          {questionHeader}
          {warning}
          <div className="text-lg leading-relaxed" style={{whiteSpace: 'pre-line'}}>{parts}</div>
        </div>
      );
    }

    // Short Answer
    if (["short_answer"].includes(type)) {
      return (
        <div key={question.id} className="mb-6 p-6 border border-blue-100 rounded-2xl shadow bg-blue-50/30">
          {headerBlock}
          {questionHeader}
          <input
            type="text"
            value={value}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            className="w-full p-4 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-400 text-lg transition placeholder-gray-400 bg-white shadow-sm"
            placeholder="Your answer..."
          />
        </div>
      );
    }

    // True/False/Not Given
    if (["true_false", "true_false_not_given"].includes(type)) {
      return (
        <div key={question.id} className="mb-6 p-6 border border-blue-100 rounded-2xl shadow bg-blue-50/30">
          {headerBlock}
          {questionHeader}
          <div className="flex gap-6 mt-2">
            {['True', 'False', 'Not Given'].map(opt => (
              <label key={opt} className="flex items-center gap-2 text-lg cursor-pointer">
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={opt}
                  checked={value === opt}
                  onChange={e => handleAnswerChange(question.id, e.target.value)}
                  className="accent-blue-600 w-5 h-5"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </div>
      );
    }

    // Multiple Response (multi-select, все алиасы)
    if (["multiple_response", "multipleresponse", "multi_select", "multiselect"].includes(type) && (Array.isArray(question.options) || (question.extra_data && Array.isArray(question.extra_data.options)))) {
      const options = question.options || (question.extra_data && question.extra_data.options) || [];
      return (
        <div key={question.id} className="mb-6 p-6 border border-blue-100 rounded-2xl shadow bg-blue-50/30">
          {headerBlock}
          {questionHeader}
          <div className="space-y-3">
            {options.map((option, idx) => {
              const subKey = `${question.id}__${option.label}`;
              const checked = !!answers[subKey];
              return (
              <label key={option.id || idx} className="flex items-center space-x-3 cursor-pointer text-lg">
                <input
                  type="checkbox"
                  name={`question-${question.id}`}
                  value={option.label}
                    checked={checked}
                    onChange={e => handleAnswerChange(subKey, e.target.checked)}
                  className="accent-blue-600 w-5 h-5"
                />
                <span className="font-medium">{option.label}. {option.text}</span>
              </label>
              );
            })}
          </div>
        </div>
      );
    }

    // Multiple Choice (single answer)
    if (["multiple_choice", "multiplechoice", "single_choice", "singlechoice"].includes(type) && Array.isArray(question.options)) {
      return (
        <div key={question.id} className="mb-6 p-6 border border-blue-100 rounded-2xl shadow bg-blue-50/30">
          {headerBlock}
          {questionHeader}
          <div className="space-y-3">
            {question.options.map((option, idx) => {
              const subKey = `${question.id}__${option.label}`;
              return (
              <label key={option.id || idx} className="flex items-center space-x-3 cursor-pointer text-lg">
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={option.label}
                    checked={!!answers[subKey]}
                    onChange={e => handleAnswerChange(subKey, e.target.checked ? option.label : '')}
                  className="accent-blue-600 w-5 h-5"
                />
                <span className="font-medium">{option.label}. {option.text}</span>
              </label>
              );
            })}
          </div>
        </div>
      );
    }

    // Default fallback (text input)
    return (
      <div key={question.id} className="mb-6 p-6 border border-blue-100 rounded-2xl shadow focus-within:ring-2 focus-within:ring-blue-300 bg-blue-50/30">
        {headerBlock}
        {questionHeader}
        <input
          type="text"
          value={value}
          onChange={(e) => handleAnswerChange(question.id, e.target.value)}
          className="w-full p-4 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-400 text-lg transition placeholder-gray-400 bg-white shadow-sm"
          placeholder="Your answer..."
        />
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading test...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600 text-xl">{error}</div>
      </div>
    );
  }

  if (showResults && results) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-center mb-8">Test Results</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{results.score}</div>
                <div className="text-sm text-gray-600">Band Score</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{results.correct_answers_count}/{results.total_questions_count}</div>
                <div className="text-sm text-gray-600">Correct Answers</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{formatTimeTaken(results.time_taken)}</div>
                <div className="text-sm text-gray-600">Time Taken</div>
              </div>
            </div>
            
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!test || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Test not found</div>
      </div>
    );
  }

  const currentPartData = test.parts?.[currentPart];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header with timer */}
      <div className="bg-white shadow-md border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col md:flex-row md:justify-between md:items-center">
          <div>
            <h1 className="text-2xl font-extrabold text-blue-700 tracking-tight">{test.title}</h1>
            <p className="text-sm text-gray-500">Part {currentPart + 1} of {test.parts?.length || 0}</p>
          </div>
          <div className="flex items-center gap-2 mt-2 md:mt-0">
            <ListeningTimer timeLeft={timeLeft} />
          </div>
        </div>
      </div>

      <div className="w-full px-2 py-8">
        <div className="grid grid-cols-4 gap-8 justify-center items-start">
          {/* Audio Player */}
          <div className="col-span-1">
            <div className="bg-white rounded-2xl shadow-xl p-8 sticky top-24 border border-blue-100">
              <h2 className="text-lg font-bold text-blue-700 mb-4">Audio Player</h2>
              {currentPartData?.audio && (
                <audio
                  ref={audioRef}
                  src={currentPartData.audio}
                  onLoadedMetadata={() => setDuration(audioRef.current.duration)}
                  onTimeUpdate={() => setCurrentTime(audioRef.current.currentTime)}
                  onPlay={() => {
                    setIsPlaying(true);
                    setAudioPlayed(true);
                  }}
                  className="w-full mb-4 rounded-lg border border-blue-100"
                  preload="auto"
                />
              )}
              <div className="space-y-4">
                {currentPartData?.audio ? (
                  <>
                    <div className="flex flex-col items-center gap-3 w-full">
                  <button
                    onClick={() => audioRef.current?.play()}
                    disabled={!currentPartData?.audio || isPlaying || audioEnded}
                    className="bg-blue-100 text-blue-700 font-semibold px-8 py-3 rounded-xl shadow hover:bg-blue-200 transition disabled:opacity-50 text-lg"
                  >
                    {audioEnded ? 'Audio Completed' : isPlaying ? 'Playing...' : '▶ Play Audio'}
                  </button>
                      {/* Глобальный контрол громкости */}
                      <div className="flex flex-row items-center gap-2 justify-center w-full">
                        <button
                          onClick={() => setVolume(volume === 0 ? 1 : 0)}
                          className="p-2 rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-100 transition"
                          title={volume === 0 ? 'Unmute' : 'Mute'}
                          type="button"
                        >
                          {volume === 0 ? (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-blue-700">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l6 6m0-6l-6 6M15.75 5.25v13.5a.75.75 0 01-1.28.53l-4.72-4.72H5.25A.75.75 0 014.5 14.25v-4.5a.75.75 0 01.75-.75h4.5l4.72-4.72a.75.75 0 011.28.53z" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-blue-700">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5a.75.75 0 01-1.28.53l-4.72-4.72H5.25A.75.75 0 014.5 14.25v-4.5a.75.75 0 01.75-.75h4.5l4.72-4.72a.75.75 0 011.28.53z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.386-.564-2.636-1.464-3.536m0 7.072A4.978 4.978 0 0019.5 12z" />
                            </svg>
                          )}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={volume}
                          onChange={e => setVolume(parseFloat(e.target.value))}
                          className="w-24 accent-blue-600"
                          aria-label="Volume"
                        />
                        <span className="text-sm text-gray-500 font-mono w-8 text-right">{Math.round(volume * 100)}</span>
                      </div>
                      <div className="flex flex-row items-center gap-3 justify-center w-full text-xs text-gray-600">
                        <span>Current: <span className="font-mono">{formatTime(Math.floor(currentTime))}</span></span>
                        <span>Duration: <span className="font-mono">{formatTime(Math.floor(duration))}</span></span>
                </div>
                  {audioEnded && (
                    <div className="text-green-600 font-medium mt-1">✓ Audio completed</div>
                  )}
                {audioPlayed && !audioEnded && (
                  <div className="text-orange-600 text-xs text-center">⚠️ Audio can only be played once. Do not pause or refresh.</div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-gray-400 text-center">No audio for this part</div>
                )}
              </div>
              {/* Part Navigation */}
              <div className="mt-8">
                <h3 className="font-medium text-blue-700 mb-3">Parts</h3>
                <div className="space-y-2">
                  {test.parts?.map((part, index) => (
                    <button
                      key={part.id}
                      onClick={() => setCurrentPart(index)}
                      className={`w-full text-left p-3 rounded-xl font-semibold transition text-base ${
                        currentPart === index
                          ? 'bg-blue-100 text-blue-700 shadow'
                          : 'hover:bg-blue-50 text-gray-700'
                      }`}
                    >
                      Part {index + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Questions */}
          <div className="col-span-3 flex justify-center">
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-blue-100 w-full">
              {currentPartData && (
                <>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-blue-700 mb-2">Part {currentPart + 1}</h2>
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
      </div>

      {/* Submit Button */}
      <div className="max-w-3xl mx-auto px-2 pb-[60px]">
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

export default ListeningTestPlayer; 