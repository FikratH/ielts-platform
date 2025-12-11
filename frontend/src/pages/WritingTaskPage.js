import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import WritingTimer from '../components/WritingTimer';
import api from '../api';
import '../styles/writing-protection.css';

const WritingTaskPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [activeTask, setActiveTask] = useState("task1");
  const [task1Instructions, setTask1Instructions] = useState("");
  const [task2Instructions, setTask2Instructions] = useState("");
  const [task1Text, setTask1Text] = useState("");
  const [task2Text, setTask2Text] = useState("");
  const [task1Image, setTask1Image] = useState("");
  const [task2Image, setTask2Image] = useState("");
  const [task1Id, setTask1Id] = useState(null);
  const [task2Id, setTask2Id] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(60 * 60); // 60 minutes total
  const [timerSeed, setTimerSeed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [syncError, setSyncError] = useState(null);

  // Load saved essays from localStorage (fallback)
  useEffect(() => {
    const savedTask1 = localStorage.getItem(`writing_task1_${sessionId}`);
    const savedTask2 = localStorage.getItem(`writing_task2_${sessionId}`);
    if (savedTask1 !== null) setTask1Text(savedTask1);
    if (savedTask2 !== null) setTask2Text(savedTask2);
  }, [sessionId]);

  // Autosave essay to localStorage with session-specific keys
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem(`writing_task1_${sessionId}`, task1Text);
    }
  }, [task1Text, sessionId]);
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem(`writing_task2_${sessionId}`, task2Text);
    }
  }, [task2Text, sessionId]);

  useEffect(() => {
    localStorage.removeItem('writing_timer');
    fetchPrompts();
  }, [sessionId]);

  const withRetry = async (fn, delays = [0, 500, 1500]) => {
    let lastError;
    for (let i = 0; i < delays.length; i++) {
      if (delays[i]) {
        await new Promise(res => setTimeout(res, delays[i]));
      }
      try {
        return await fn();
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  };

  const fetchPrompts = async () => {
    try {
      // Get session details which includes test tasks
      const sessionResponse = await api.get(`/writing-test-sessions/${sessionId}/`);
      const session = sessionResponse.data;
      
      const serverTimeLeft = session.time_left_seconds ?? 60 * 60;
      setTimeRemaining(serverTimeLeft);
      const deadline = Date.now() + serverTimeLeft * 1000;
      localStorage.setItem(`writing_deadline_${sessionId}`, `${deadline}`);
      setTimerSeed(deadline);
      
      if (session.test && session.test.tasks) {
        const tasks = session.test.tasks;
        const task1 = tasks.find(t => t.task_type === 'task1');
        const task2 = tasks.find(t => t.task_type === 'task2');
        
        if (task1) {
          setTask1Instructions(task1.task_text);
          setTask1Id(task1.id);
          if (task1.image) {
            setTask1Image(task1.image);
          }
        }
        
        if (task2) {
          setTask2Instructions(task2.task_text);
          setTask2Id(task2.id);
          if (task2.image) {
            setTask2Image(task2.image);
          }
        }
      }

      if (session.task1_draft !== undefined && session.task1_draft !== null && session.task1_draft !== '') {
        setTask1Text(session.task1_draft);
      }
      if (session.task2_draft !== undefined && session.task2_draft !== null && session.task2_draft !== '') {
        setTask2Text(session.task2_draft);
      }
    } catch (err) {
      console.error("Task loading error:", err);
      // Fallback: try to get session from local storage or navigate back
      alert("Error loading writing test. Please try again.");
      // navigate('/writing');
    }
  };

  const syncDraft = async () => {
    if (!sessionId) return;
    const payload = {
      task1_text: task1Text,
      task2_text: task2Text,
      time_left: Math.max(0, Math.round(timeRemaining)),
    };
    await api.patch(`/writing-sessions/${sessionId}/sync/`, payload);
    setSyncError(null);
  };

  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(() => {
      if (loading || submitting) return;
      withRetry(() => syncDraft(), [0, 500]).catch(() => setSyncError('Draft not saved'));
    }, 12000);
    return () => clearInterval(interval);
  }, [sessionId, loading, submitting, task1Text, task2Text, timeRemaining]);

  useEffect(() => {
    return () => {
      if (sessionId) {
        syncDraft().catch(() => {});
      }
    };
  }, [sessionId]);

  const handleSubmit = async () => {
    if (submitting) return;
    const task1Clean = task1Text.trim();
    const task2Clean = task2Text.trim();
    if (!task1Clean || !task2Clean) {
      alert("Please complete both tasks before submitting");
      return;
    }

    setSubmitting(true);
    setLoading(true);
    setSubmitError(null);
    try {
      // Submit Task 1
      await withRetry(() => api.post('/submit-task/', {
        session_id: sessionId,
        task_type: 'task1',
        submitted_text: task1Clean,
        question_text: task1Instructions,
        task_id: task1Id
      }));

      // Submit Task 2
      await withRetry(() => api.post('/submit-task/', {
        session_id: sessionId,
        task_type: 'task2',
        submitted_text: task2Clean,
        question_text: task2Instructions,
        task_id: task2Id
      }));

      // Finish session and get AI scoring
      await withRetry(() => api.post('/finish-writing-session/', { session_id: sessionId }));

      // Clear localStorage for this session
      localStorage.removeItem(`writing_task1_${sessionId}`);
      localStorage.removeItem(`writing_task2_${sessionId}`);
      localStorage.removeItem(`writing_deadline_${sessionId}`);

      navigate(`/writing/result/${sessionId}`);
    } catch (err) {
      console.error('Submit error:', err);
      setSubmitError("Error submitting essays. Please try again.");
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  const handleTimeUp = async () => {
    if (loading || submitting) return;
    const task1Clean = task1Text.trim();
    const task2Clean = task2Text.trim();
    if (!task1Clean && !task2Clean) {
      setSubmitError("Time is up. Essays are empty — not submitted.");
      return;
    }

    setLoading(true);
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Auto-submit both tasks if they have content
      if (task1Clean) {
        await withRetry(() => api.post('/submit-task/', {
          session_id: sessionId,
          task_type: 'task1',
          submitted_text: task1Clean,
          question_text: task1Instructions,
          task_id: task1Id
        }));
      }

      if (task2Clean) {
        await withRetry(() => api.post('/submit-task/', {
          session_id: sessionId,
          task_type: 'task2',
          submitted_text: task2Clean,
          question_text: task2Instructions,
          task_id: task2Id
        }));
      }

      await withRetry(() => api.post('/finish-writing-session/', { session_id: sessionId }));

      // Clear localStorage for this session
      localStorage.removeItem(`writing_task1_${sessionId}`);
      localStorage.removeItem(`writing_task2_${sessionId}`);
      localStorage.removeItem(`writing_deadline_${sessionId}`);

      navigate(`/writing/result/${sessionId}`);
    } catch (err) {
      console.error('Auto-submit error:', err);
      setSubmitError("Auto-submit failed. Please check connection and submit manually.");
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  const getCurrentText = () => activeTask === 'task1' ? task1Text : task2Text;
  const setCurrentText = (text) => {
    if (activeTask === 'task1') {
      setTask1Text(text);
    } else {
      setTask2Text(text);
    }
  };

  const getCurrentPrompt = () => activeTask === 'task1' ? task1Instructions : task2Instructions;
  const getCurrentImage = () => activeTask === 'task1' ? task1Image : task2Image;

  // Copy protection handlers
  const handleTaskCopy = (e) => {
    e.preventDefault();
    return false;
  };

  const handleTaskSelectStart = (e) => {
    e.preventDefault();
    return false;
  };

  const handleTaskDragStart = (e) => {
    e.preventDefault();
    return false;
  };

  const handleTaskContextMenu = (e) => {
    e.preventDefault();
    return false;
  };

  // Paste protection handlers
  const handleEssayPaste = (e) => {
    e.preventDefault();
    return false;
  };

  const handleEssayCut = (e) => {
    e.preventDefault();
    return false;
  };

  const handleEssayCopy = (e) => {
    e.preventDefault();
    return false;
  };

  // Global keyboard protection
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check for Ctrl/Cmd + V, C, X
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'c' || e.key === 'x')) {
        e.preventDefault();
        return false;
      }
      
      // Check for F12, Ctrl+Shift+I, Ctrl+Shift+J (DevTools shortcuts)
      if (e.key === 'F12' || 
          ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C'))) {
        e.preventDefault();
        return false;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);



  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white bg-opacity-80">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6"></div>
        <div className="text-xl font-semibold text-blue-700 mb-2">AI is checking your essays...</div>
        <div className="text-gray-600">This may take up to 1-2 minutes. Please wait.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-purple-50 to-white">
      {/* Elegant Header with Logo and Timer */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            {/* Left Side - Logo and Test Info */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Master Education" className="w-8 h-8 rounded-full" />
                <div className="text-gray-900">
                  <h2 className="text-sm font-medium">Master Education</h2>
                  <p className="text-xs text-gray-500">IELTS Testing Platform</p>
                </div>
              </div>
              <div className="hidden sm:block w-px h-8 bg-gray-300"></div>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">IELTS Writing</h1>
                
              </div>
            </div>
            
            {/* Right Side - Timer */}
            <div className="flex items-center gap-3">
              <WritingTimer
                key={`${sessionId || ''}-${timerSeed}`}
                onTimeUp={handleTimeUp}
                onTick={setTimeRemaining}
                initialSeconds={timeRemaining}
                sessionId={sessionId}
                seed={timerSeed}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="flex justify-center mb-6 sm:mb-10 px-2">
        <div className="flex bg-gray-100 rounded-2xl shadow-lg p-1 sm:p-2 gap-2 sm:gap-6 w-full max-w-xl">
          <button
            onClick={() => setActiveTask('task1')}
            className={`flex-1 px-4 sm:px-10 py-3 sm:py-5 rounded-xl font-bold text-base sm:text-xl transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-400 ${
              activeTask === 'task1'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            Task 1
          </button>
          <button
            onClick={() => setActiveTask('task2')}
            className={`flex-1 px-4 sm:px-10 py-3 sm:py-5 rounded-xl font-bold text-base sm:text-xl transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-400 ${
              activeTask === 'task2'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            Task 2
          </button>
        </div>
      </div>

      <main className="flex-grow flex flex-col md:flex-row gap-4 sm:gap-10 px-2 sm:px-4 md:px-8 lg:px-16 pb-8 sm:pb-16 max-w-full md:max-w-[1600px] mx-auto w-full items-start justify-center">
        <div className="w-full md:w-[38%] flex items-start justify-center mb-4 md:mb-0">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl p-4 sm:p-8 flex flex-col items-center min-h-[12rem] sm:min-h-[20rem]">
            <h2 className="text-lg sm:text-2xl font-bold mb-2 sm:mb-4 text-gray-900 text-center">IELTS Writing Task {activeTask === 'task1' ? '1' : '2'}</h2>
            {getCurrentImage() && (
              <div 
                className="mb-3 sm:mb-4 flex justify-center w-full relative"
                onCopy={handleTaskCopy}
                onSelectStart={handleTaskSelectStart}
                onDragStart={handleTaskDragStart}
                onContextMenu={handleTaskContextMenu}
                style={{
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  MozUserSelect: 'none',
                  msUserSelect: 'none',
                  cursor: 'default'
                }}
              >
                <img 
                  src={getCurrentImage()} 
                  alt="Task illustration" 
                  className="w-full max-w-xs sm:max-w-lg rounded-lg border shadow-sm no-copy"
                  draggable={false}
                />
              </div>
            )}
            <div className="w-full">
              <div 
                className="bg-purple-50 border-l-4 border-purple-500 p-3 sm:p-6 rounded-r-lg relative no-copy"
                onCopy={handleTaskCopy}
                onSelectStart={handleTaskSelectStart}
                onDragStart={handleTaskDragStart}
                onContextMenu={handleTaskContextMenu}
                style={{
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  MozUserSelect: 'none',
                  msUserSelect: 'none',
                  cursor: 'default',
                  whiteSpace: 'pre-wrap'
                }}
                dangerouslySetInnerHTML={{ __html: getCurrentPrompt() || '' }}
              />
            </div>
          </div>
        </div>
        <div className="w-full md:w-[62%] flex items-center justify-center">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl p-4 sm:p-12 flex flex-col items-center min-h-[16rem] sm:min-h-[28rem]">
            <div className="flex items-center mb-4 sm:mb-8 w-full">
              <h3 className="text-xl sm:text-3xl font-bold text-gray-900">Your Essay</h3>
            </div>
            <textarea
              value={getCurrentText()}
              onChange={e => setCurrentText(e.target.value)}
              onPaste={handleEssayPaste}
              onCut={handleEssayCut}
              onCopy={handleEssayCopy}
              className="w-full border rounded-xl p-4 sm:p-10 h-[12rem] sm:h-[36rem] min-h-[8rem] sm:min-h-[28rem] max-h-[24rem] sm:max-h-[48rem] mb-4 sm:mb-6 resize-none focus:outline-none focus:ring-2 focus:ring-purple-400 bg-gray-50 text-gray-800 transition-all shadow-inner text-base sm:text-2xl"
              placeholder="Write your essay here..."
            />
            <div className="text-right mb-2 sm:mb-3 text-sm sm:text-lg text-gray-500 w-full">
              Words: {getCurrentText().trim().split(/\s+/).filter(Boolean).length}
            </div>
            {submitError && (
              <div className="w-full mb-3 sm:mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3">
                {submitError}
              </div>
            )}
            {syncError && (
              <div className="w-full mb-3 sm:mb-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                Draft not saved to server. Will retry…
              </div>
            )}
            <button
              onClick={handleSubmit}
              className="w-full bg-purple-600 text-white px-4 sm:px-10 py-3 sm:py-6 rounded-xl font-bold hover:bg-purple-700 transition-colors duration-300 text-base sm:text-2xl shadow-lg disabled:opacity-50 mt-2"
              disabled={loading || submitting || !task1Text.trim() || !task2Text.trim()}
            >
              {loading ? "Submitting..." : "Submit essays"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default WritingTaskPage;