import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import api from '../api';

const ListeningTimer = ({ timeLeft, color = 'text-blue-600' }) => {
  const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const secs = (timeLeft % 60).toString().padStart(2, '0');
  return (
    <div className="flex flex-col items-center">
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4 border border-blue-200 shadow-sm">
        <div className="text-center">
          <div className="text-3xl font-bold text-blue-700 font-mono tracking-wider">{mins}:{secs}</div>
          <div className="text-xs text-blue-600 font-medium mt-1">Time Remaining</div>
        </div>
      </div>
    </div>
  );
};

const ListeningTestPlayer = () => {
  const { id: testId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [user, loading] = useAuthState(auth);
  
  // Test state
  const [test, setTest] = useState(null);
  const [session, setSession] = useState(null);
  const [currentPart, setCurrentPart] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState({}); // Track flagged questions
  const [timeLeft, setTimeLeft] = useState(2400); // 40 minutes
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioPlayed, setAudioPlayed] = useState(false); // Track if audio was played
  const [audioEnded, setAudioEnded] = useState(false); // Track if audio ended
  const [currentPlayingPart, setCurrentPlayingPart] = useState(null); // Track which part is currently playing
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
  }, [volume]);

  // Removed automatic src setting to prevent AbortError

  // Define functions before useEffect
  const startSession = async () => {
    if (!user) {
      setError('Please login again.');
      setIsLoading(false);
      return;
    }
    try {
      const isDiagnostic = location.pathname.includes('/dashboard') ? false : 
                          new URLSearchParams(location.search).get('diagnostic');
      const url = isDiagnostic ? 
        `/listening-tests/${testId}/start/?diagnostic=true` : 
        `/listening-tests/${testId}/start/`;
      const response = await api.post(url);
      setSession(response.data);
      setTimeLeft(response.data.time_left || 2400);
      await loadTest();
    } catch (err) {
      if (err.response?.status === 409) {
        setError('You have already completed the diagnostic test for Listening.');
      } else if (err.response?.status === 403) {
        setError('Diagnostic tests are not available if you have completed any regular tests.');
      } else if (err.response?.status === 400) {
        setError('This test is not marked as a diagnostic template.');
      } else if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        setError('Session expired, please login again.');
        setTimeout(() => navigate('/login'), 1500);
      } else {
        setError('Failed to start session');
      }
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
        group_items: q.group_items || extra.group_items || [],
      };
      

      
      return normalized;
    });

  const loadTest = async () => {
    try {
      const response = await api.get(`/listening-tests/${testId}/`);
      const testData = response.data;
      // Нормализуем вопросы для каждой части
      if (Array.isArray(testData.parts)) {
        testData.parts = testData.parts.map(part => ({
          ...part,
          questions: normalizeQuestions(part.questions || [])
        }));
      }
      setTest(testData);
      setIsLoading(false);
    } catch (err) {
      setError('Failed to load test');
      setIsLoading(false);
    }
  };

  const loadSession = async (sessionId) => {
    try {
      const response = await api.get(`/listening-sessions/${sessionId}/`);
      setSession(response.data);
      setTimeLeft(response.data.time_left || 2400);
      setAnswers(response.data.answers || {});
    } catch (err) {
      setError('Failed to load session');
    }
  };



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
    if (user && testId && !error) {
      startSession();
    }
  }, [user, testId, error]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  if (!user && !loading) {
    return <div className="flex items-center justify-center min-h-screen">Please login to continue</div>;
  }
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading test...</div>;
  }
  if (error) {
    return <div className="flex items-center justify-center min-h-screen text-red-600">Error: {error}</div>;
  }
  if (!test) {
    return <div className="flex items-center justify-center min-h-screen">Test not found</div>;
  }

  // Define currentPartData early
  const currentPartData = test?.parts?.[currentPart];



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

  const handleAnswerChange = (subKey, value) => {
    setAnswers(prev => {
      // Проверяем, это gap fill или multiple choice
      if (subKey.includes('__')) {
        const [questionId, gapPart] = subKey.split('__');
        
        // Если это gap fill (gap1, gap2, gap3...) - НЕ очищаем другие gaps
        if (gapPart.startsWith('gap')) {
          return {
            ...prev,
            [subKey]: value
          };
        }
        
        // Если это multiple choice (A, B, C, D...) - очищаем другие варианты
        if (['A', 'B', 'C', 'D'].includes(gapPart)) {
          // Проверяем, это checkbox (multiple response) или radio (multiple choice)
          const questionElement = document.querySelector(`input[name="question-${questionId}"]`);
          if (questionElement && questionElement.type === 'checkbox') {
            // Multiple Response (checkbox) - НЕ очищаем, позволяем выбрать несколько
            return {
              ...prev,
              [subKey]: value
            };
          } else {
            // Multiple Choice (radio) - очищаем другие варианты
            const newAnswers = { ...prev };
            
            // Очищаем все предыдущие ответы для этого вопроса
            Object.keys(newAnswers).forEach(key => {
              if (key.startsWith(`${questionId}__`)) {
                delete newAnswers[key];
              }
            });
            
            // Устанавливаем новый ответ
            newAnswers[subKey] = value;
            return newAnswers;
          }
        }
      }
      
      // Для других типов вопросов оставляем как есть
      return {
        ...prev,
        [subKey]: value
      };
    });
  };

  const handleGroupAnswerChange = (questionId, itemId, selectedLabel) => {
    setAnswers(prev => {
      const newAnswers = { ...prev };
      const flatKey = `${questionId}__${itemId}`;
      newAnswers[flatKey] = selectedLabel;
      const nested = newAnswers[questionId] && typeof newAnswers[questionId] === 'object' && !Array.isArray(newAnswers[questionId])
        ? { ...newAnswers[questionId] }
        : {};
      nested[itemId] = selectedLabel;
      newAnswers[questionId] = nested;
      return newAnswers;
    });
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
      await api.patch(`/listening-sessions/${session.id}/sync/`, { answers, flagged, time_left: timeLeft });
    } catch (err) {
      // Silent error for sync
    }
  };

  const handleAutoSubmit = async () => {
    if (isSubmitted) return;
    await submitTest();
  };

  const submitTest = async () => {
    if (!session || isSubmitted) return;
    if (!user) {
      setError('Please login to submit the test.');
      return;
    }
    try {
      const response = await api.post(`/listening-sessions/${session.id}/submit/`, { answers, time_left: timeLeft });
      navigate(`/listening-result/${session.id}`);
      window.dispatchEvent(new Event('listeningHistoryUpdated'));
    } catch (err) {
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        setError('Session expired, please login again.');
        setTimeout(() => navigate('/login'), 1500);
      } else {
        setError('Failed to submit test');
      }
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
      {question.task_prompt && (
          <div
            className="font-semibold text-xl text-black text-center mb-3"
            style={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}
          >
            {question.task_prompt}
          </div>
      )}
        {/* Универсальный блок для изображения */}
        {question.image && (
          <div className="mb-3 flex justify-center">
            <img
              src={question.image.startsWith('http://') || question.image.startsWith('https://') || question.image.startsWith('/') 
                ? question.image 
                : `/media/${question.image}`}
              alt="Question"
              style={{ width: '100%', maxWidth: 700, height: 'auto', display: 'block', margin: '0 auto', borderRadius: 12, boxShadow: '0 2px 12px #0002' }}
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
      const text = question.question_text || '';
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
        if (before) parts.push(
          <span
            key={`t${gapIdx}`}
            dangerouslySetInnerHTML={{ __html: before }}
          />
        );
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
        const remaining = text.slice(lastIndex);
        parts.push(
          <span
            key="end"
            dangerouslySetInnerHTML={{ __html: remaining }}
          />
        );
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

    // Multiple Choice Group (several sub-questions with single choice each)
    if (type === 'multiple_choice_group') {
      const groupItems = Array.isArray(question.group_items) && question.group_items.length
        ? question.group_items
        : (Array.isArray(question.extra_data?.group_items) ? question.extra_data.group_items : []);

      return (
        <div key={question.id} className="mb-6 p-6 border border-blue-100 rounded-2xl shadow bg-blue-50/30">
          {headerBlock}
          {questionHeader}
          <div className="space-y-4">
            {groupItems.map((item, idx) => {
              const itemId = item.id || `item-${idx}`;
              const nestedAnswers = answers[question.id] && typeof answers[question.id] === 'object' ? answers[question.id] : {};
              const selectedLabel = nestedAnswers[itemId] ?? answers[`${question.id}__${itemId}`];
              const options = Array.isArray(item.options) ? item.options : [];

              return (
                <div key={itemId} className="p-3 border border-blue-100 rounded-xl bg-white/70">
                  <div className="font-medium text-gray-800 mb-2">
                    {item.prompt || `Question ${idx + 1}`}
                  </div>
                  <div className="space-y-2">
                    {options.map((option, optIdx) => (
                      <label
                        key={option.label || optIdx}
                        className="flex items-center space-x-3 cursor-pointer text-base p-2 rounded-lg hover:bg-blue-50 transition"
                      >
                        <input
                          type="radio"
                          name={`question-${question.id}-${itemId}`}
                          value={option.label}
                          checked={selectedLabel === option.label}
                          onChange={() => handleGroupAnswerChange(question.id, itemId, option.label)}
                          className="accent-blue-600 w-4 h-4 flex-shrink-0"
                        />
                        <span className="font-medium">
                          {(option.label || String.fromCharCode(65 + optIdx))}. {option.text}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
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

    // Multiple Choice
    if (["multiple_choice", "multiplechoice", "single_choice", "singlechoice"].includes(type) && Array.isArray(question.options)) {
      return (
        <div key={question.id} className="mb-6 lg:mb-8 p-4 lg:p-6 border border-blue-100 rounded-2xl shadow bg-blue-50/30">
          {headerBlock}
          {questionHeader}
          <div className="space-y-2 lg:space-y-3">
            {question.options.map((option, idx) => {
              const subKey = `${question.id}__${option.label}`;
              return (
              <label key={option.id || idx} className="flex items-center space-x-3 lg:space-x-4 cursor-pointer text-base lg:text-lg p-2 lg:p-3 rounded-xl hover:bg-blue-50 transition-colors duration-200">
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={option.label}
                    checked={!!answers[subKey]}
                    onChange={() => handleAnswerChange(subKey, option.label)}
                  className="accent-blue-600 w-4 h-4 lg:w-5 lg:h-5 flex-shrink-0"
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
      <div key={question.id} className="mb-6 lg:mb-8 p-4 lg:p-6 border border-blue-100 rounded-2xl shadow focus-within:ring-2 focus-within:ring-blue-300 bg-blue-50/30">
        {headerBlock}
        {questionHeader}
        <input
          type="text"
          value={value}
          onChange={(e) => handleAnswerChange(question.id, e.target.value)}
          className="w-full p-3 lg:p-4 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-400 text-base lg:text-lg transition placeholder-gray-400 bg-white shadow-sm"
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{results.band_score}</div>
                <div className="text-sm text-gray-600">Band Score</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{results.raw_score}/{results.total_score}</div>
                <div className="text-sm text-gray-600">Correct Answers</div>
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





  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Elegant Header with Logo and Timer */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            {/* Left Side - Logo and Test Info */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Master Education" className="w-8 h-8 rounded-full" />
                <div className="text-gray-900">
                  <h2 className="text-sm font-medium">Master Education</h2>
                
                </div>
              </div>
              <div className="hidden sm:block w-px h-8 bg-gray-300"></div>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">{test.title}</h1>
                <p className="text-sm text-gray-600">Part {currentPart + 1} of {test.parts?.length || 0}</p>
              </div>
            </div>
            
            {/* Right Side - Timer */}
            <div className="flex items-center gap-3">
              <ListeningTimer timeLeft={timeLeft} />
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-1 sm:px-2 py-4 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-6 lg:gap-8 justify-center items-start">
          {/* Audio Player */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <div className="bg-white rounded-2xl shadow-xl p-3 sm:p-6 lg:p-8 lg:sticky lg:top-24 border border-blue-100">
              <h2 className="text-base sm:text-lg font-bold text-blue-700 mb-3 sm:mb-4">Audio Player</h2>
                              <audio
                  ref={audioRef}
                  onLoadedMetadata={() => setDuration(audioRef.current.duration)}
                  onTimeUpdate={() => setCurrentTime(audioRef.current.currentTime)}
                  onPlay={() => {
                    setIsPlaying(true);
                    setAudioPlayed(true);
                    setCurrentPlayingPart(currentPart);
                  }}
                  onEnded={() => {
                    setAudioEnded(true);
                    setIsPlaying(false);
                    setCurrentPlayingPart(null);
                  }}
                  onError={(e) => {
                    console.error('Audio error:', e);
                    setIsPlaying(false);
                    setAudioEnded(true);
                    setError('Ошибка загрузки аудио: Network Error');
                  }}
                  onPause={() => {
                    setIsPlaying(false);
                  }}
                  className="w-full mb-4 rounded-lg border border-blue-100"
                  preload="auto"
                />
                              <div className="space-y-4">
                  {currentPartData?.audio ? (
                  <>
                    <div className="flex flex-col items-center gap-3 w-full">
                  <button
                    onClick={async () => {
                      try {
                        // Stop any currently playing audio
                        if (audioRef.current) {
                          audioRef.current.pause();
                          audioRef.current.currentTime = 0;
                        }
                        
                        // Set new source and play
                        audioRef.current.src = currentPartData?.audio;
                        setCurrentPlayingPart(currentPart);
                        setIsPlaying(true);
                        setError(null);
                        
                        await audioRef.current.play();
                      } catch (err) {
                        console.error('Audio play error:', err);
                        setIsPlaying(false);
                        setCurrentPlayingPart(null);
                        setError('Ошибка загрузки аудио: Network Error');
                      }
                    }}
                    disabled={!currentPartData?.audio || (isPlaying && currentPlayingPart === currentPart)}
                    className="bg-blue-100 text-blue-700 font-semibold px-6 lg:px-8 py-3 rounded-xl shadow hover:bg-blue-200 transition disabled:opacity-50 text-base lg:text-lg"
                  >
                    {isPlaying && currentPlayingPart === currentPart ? 'Playing...' : 
                     currentPlayingPart !== null && currentPlayingPart !== currentPart ? '▶ Play New Audio' : 
                     '▶ Play Audio'}
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
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 lg:w-6 lg:h-6 text-blue-700">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l6 6m0-6l-6 6M15.75 5.25v13.5a.75.75 0 01-1.28.53l-4.72-4.72H5.25A.75.75 0 014.5 14.25v-4.5a.75.75 0 01.75-.75h4.5l4.72-4.72a.75.75 0 011.28.53z" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 lg:w-6 lg:h-6 text-blue-700">
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
                          className="w-20 lg:w-24 accent-blue-600"
                          aria-label="Volume"
                        />
                        <span className="text-xs lg:text-sm text-gray-500 font-mono w-8 text-right">{Math.round(volume * 100)}</span>
                      </div>
                      <div className="flex flex-row items-center gap-3 justify-center w-full text-xs text-gray-600">
                        <span>Current: <span className="font-mono">{formatTime(Math.floor(currentTime))}</span></span>
                        <span>Duration: <span className="font-mono">{formatTime(Math.floor(duration))}</span></span>
                </div>
                  {audioEnded && currentPlayingPart === currentPart && (
                    <div className="text-green-600 font-medium mt-1 text-sm lg:text-base">✓ Audio completed</div>
                  )}
                {isPlaying && currentPlayingPart === currentPart && (
                  <div className="text-orange-600 text-xs text-center">⚠️ Audio can only be played once. Do not pause or refresh.</div>
                )}
                {currentPlayingPart !== null && currentPlayingPart !== currentPart && (
                  <div className="text-blue-600 text-xs text-center">🎵 Audio from Part {currentPlayingPart + 1} is currently playing</div>
                )}
                    </div>
                  </>
                ) : (
                  <div className="text-gray-400 text-center">No audio for this part</div>
                )}
              </div>
              {/* Part Navigation */}
              <div className="mt-4 sm:mt-6 lg:mt-8">
                <h3 className="font-medium text-blue-700 mb-2 sm:mb-3">Parts</h3>
                <div className="flex flex-wrap lg:flex-col lg:space-y-2 gap-2 lg:gap-0">
                  {test?.parts?.map((part, index) => (
                    <button
                      key={part.id}
                      onClick={() => setCurrentPart(index)}
                      className={`text-left p-2 sm:p-3 rounded-xl font-semibold transition text-xs sm:text-sm lg:text-base flex-1 lg:flex-none lg:w-full ${
                        currentPart === index
                          ? 'bg-blue-100 text-blue-700 shadow'
                          : currentPlayingPart === index
                          ? 'bg-green-100 text-green-700 border border-green-200'
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
          <div className="lg:col-span-3 order-1 lg:order-2 flex justify-center">
            <div className="bg-white rounded-2xl shadow-xl p-3 sm:p-6 lg:p-8 border border-blue-100 w-full">
              {currentPartData && (
                <>
                  <div className="mb-4 sm:mb-6">
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-700 mb-1 sm:mb-2">Part {currentPart + 1}</h2>
                    {currentPartData.instructions && (
                      <p className="text-xs sm:text-sm lg:text-base text-gray-500 mb-2 sm:mb-4 bg-blue-50/30 p-2 sm:p-3 lg:p-4 rounded-lg">{currentPartData.instructions}</p>
                    )}
                  </div>
                  <div className="space-y-4 sm:space-y-6 lg:space-y-8">
                    {currentPartData.questions?.map(renderQuestion)}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="max-w-3xl mx-auto px-2 sm:px-4 lg:px-2 pb-8 sm:pb-16 lg:pb-[60px]">
        <button
          onClick={submitTest}
          disabled={isSubmitted}
          className="w-full mt-6 sm:mt-8 lg:mt-10 bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700 font-bold text-base sm:text-lg lg:text-xl py-3 sm:py-4 rounded-2xl shadow-lg hover:from-blue-200 hover:to-blue-300 transition-all duration-300 disabled:opacity-50 border border-blue-200"
        >
          Submit Test
        </button>
      </div>
    </div>
  );
};

export default ListeningTestPlayer; 