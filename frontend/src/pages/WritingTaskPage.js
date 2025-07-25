import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import WritingTimer from '../components/WritingTimer';
import api from '../api';

const WritingTaskPage = () => {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [activeTask, setActiveTask] = useState("task1");
  const [task1Text, setTask1Text] = useState("");
  const [task2Text, setTask2Text] = useState("");
  const [task1Prompt, setTask1Prompt] = useState("");
  const [task2Prompt, setTask2Prompt] = useState("");
  const [task1Image, setTask1Image] = useState("");
  const [task2Image, setTask2Image] = useState("");
  const [task1Id, setTask1Id] = useState(null);
  const [task2Id, setTask2Id] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(60 * 60); // 60 minutes total

  // Autosave essay to localStorage
  useEffect(() => {
    const savedTask1 = localStorage.getItem('writing_task1');
    const savedTask2 = localStorage.getItem('writing_task2');
    if (savedTask1 !== null) setTask1Text(savedTask1);
    if (savedTask2 !== null) setTask2Text(savedTask2);
  }, []);
  useEffect(() => {
    localStorage.setItem('writing_task1', task1Text);
  }, [task1Text]);
  useEffect(() => {
    localStorage.setItem('writing_task2', task2Text);
  }, [task2Text]);

  useEffect(() => {
    localStorage.removeItem('writing_timer');
    fetchPrompts();
  }, [sessionId]);

  const fetchPrompts = async () => {
    try {
      // Fetch Task 1 prompt
      const res1 = await api.get('/prompts/active/?task_type=task1');
      setTask1Prompt(res1.data.prompt_text);
      setTask1Id(res1.data.id);
      if (res1.data.image) {
        setTask1Image(res1.data.image);
      }

      // Fetch Task 2 prompt
      const res2 = await api.get('/prompts/active/?task_type=task2');
      setTask2Prompt(res2.data.prompt_text);
      setTask2Id(res2.data.id);
      if (res2.data.image) {
        setTask2Image(res2.data.image);
      }
    } catch (err) {
      console.error("Task loading error:", err);
    }
  };

  const handleSubmit = async () => {
    if (!task1Text.trim() || !task2Text.trim()) {
      alert("Please complete both tasks before submitting");
      return;
    }

    setLoading(true);
    try {
      // Submit Task 1
      await api.post('/submit-task/', {
        session_id: sessionId,
        task_type: 'task1',
        submitted_text: task1Text,
        question_text: task1Prompt,
        prompt_id: task1Id
      });

      // Submit Task 2
      await api.post('/submit-task/', {
        session_id: sessionId,
        task_type: 'task2',
        submitted_text: task2Text,
        question_text: task2Prompt,
        prompt_id: task2Id
      });

      // Finish session and get AI scoring
      await api.post('/finish-writing-session/', { session_id: sessionId });
      navigate(`/writing/result/${sessionId}`);
    } catch (err) {
      console.error('Submit error:', err);
      alert("Error submitting essays");
    } finally {
      setLoading(false);
    }
  };

  const handleTimeUp = async () => {
    if (loading) return;
    
    setLoading(true);
    try {
      // Auto-submit both tasks if they have content
      if (task1Text.trim()) {
        await api.post('/submit-task/', {
          session_id: sessionId,
          task_type: 'task1',
          submitted_text: task1Text,
          question_text: task1Prompt,
          prompt_id: task1Id
        });
      }

      if (task2Text.trim()) {
        await api.post('/submit-task/', {
          session_id: sessionId,
          task_type: 'task2',
          submitted_text: task2Text,
          question_text: task2Prompt,
          prompt_id: task2Id
        });
      }

      await api.post('/finish-writing-session/', { session_id: sessionId });
      navigate(`/writing/result/${sessionId}`);
    } catch (err) {
      console.error('Auto-submit error:', err);
      alert("Error auto-submitting essays");
    } finally {
      setLoading(false);
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

  const getCurrentPrompt = () => activeTask === 'task1' ? task1Prompt : task2Prompt;
  const getCurrentImage = () => activeTask === 'task1' ? task1Image : task2Image;

  const renderTaskTabs = () => (
    <div className="flex justify-center mb-8">
      <div className="flex bg-gray-100 rounded-lg p-1 shadow-md">
        <button
          onClick={() => setActiveTask('task1')}
          className={`px-8 py-4 rounded-md font-semibold text-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 mr-2 ${
            activeTask === 'task1' 
              ? 'bg-blue-600 text-white shadow' 
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Task 1
        </button>
        <button
          onClick={() => setActiveTask('task2')}
          className={`px-8 py-4 rounded-md font-semibold text-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 ml-2 ${
            activeTask === 'task2' 
              ? 'bg-blue-600 text-white shadow' 
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Task 2
        </button>
      </div>
    </div>
  );

  const renderLeftPanel = () => (
    <div className="bg-white rounded-lg shadow-md p-6 flex flex-col items-center w-full max-w-md ml-0 md:ml-4">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 text-center">IELTS Writing Task {activeTask === 'task1' ? '1' : '2'}</h2>
      {getCurrentImage() && (
        <div className="mb-4 flex justify-center w-full">
          <img src={getCurrentImage()} alt="Task illustration" className="w-full max-w-xs rounded-lg border shadow-sm" />
        </div>
      )}
      <div className="w-full">
        <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-lg">
          <p className="text-xl leading-relaxed text-gray-800 font-semibold">{getCurrentPrompt()}</p>
        </div>
      </div>
    </div>
  );

  const renderRightPanel = () => (
    <div className="bg-white rounded-lg shadow-md p-10 flex flex-col h-full w-full items-center">
      <div className="flex items-center mb-4 w-full">
        <svg className="w-6 h-6 text-blue-600 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.121 2.121 0 113 3L7 19.5 3 21l1.5-4L16.5 3.5z" /></svg>
        <h3 className="text-2xl font-bold text-gray-900">Your Essay</h3>
      </div>
      
      <textarea
        value={getCurrentText()}
        onChange={e => setCurrentText(e.target.value)}
        className="w-full border rounded-lg p-8 h-[32rem] min-h-[24rem] max-h-[40rem] mb-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50 text-gray-800 transition-all shadow-inner text-lg"
        placeholder="Write your essay here..."
      />
      
      <div className="text-right mb-6 text-base text-gray-500 w-full">
        Words: {getCurrentText().trim().split(/\s+/).filter(Boolean).length}
      </div>
      
      <button
        onClick={handleSubmit}
        className="w-full bg-blue-600 text-white px-6 py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-300 text-lg shadow disabled:opacity-50 mt-2"
        disabled={loading || !task1Text.trim() || !task2Text.trim()}
      >
        {loading ? "Submitting..." : "Submit essays"}
      </button>
    </div>
  );

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
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="flex flex-col sm:flex-row items-center justify-between px-3 sm:px-6 md:px-12 py-4 bg-white shadow-lg rounded-b-3xl mb-6 sm:mb-8 border-b border-gray-200 gap-4 sm:gap-0">
        <h1 className="text-2xl sm:text-4xl font-extrabold text-gray-900 tracking-tight text-center sm:text-left">IELTS Writing</h1>
        <WritingTimer onTimeUp={handleTimeUp} initialSeconds={timeRemaining} />
      </header>

      <div className="flex justify-center mb-6 sm:mb-10 px-2">
        <div className="flex bg-gray-100 rounded-2xl shadow-lg p-1 sm:p-2 gap-2 sm:gap-6 w-full max-w-xl">
          <button
            onClick={() => setActiveTask('task1')}
            className={`flex-1 px-4 sm:px-10 py-3 sm:py-5 rounded-xl font-bold text-base sm:text-xl transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
              activeTask === 'task1'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            Task 1
          </button>
          <button
            onClick={() => setActiveTask('task2')}
            className={`flex-1 px-4 sm:px-10 py-3 sm:py-5 rounded-xl font-bold text-base sm:text-xl transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
              activeTask === 'task2'
                ? 'bg-blue-600 text-white shadow-lg'
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
              <div className="mb-3 sm:mb-4 flex justify-center w-full">
                <img src={getCurrentImage()} alt="Task illustration" className="w-full max-w-xs sm:max-w-lg rounded-lg border shadow-sm" />
              </div>
            )}
            <div className="w-full">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 sm:p-6 rounded-r-lg">
                <p className="text-base sm:text-lg leading-relaxed text-gray-800 font-semibold">{getCurrentPrompt()}</p>
              </div>
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
              className="w-full border rounded-xl p-4 sm:p-10 h-[12rem] sm:h-[36rem] min-h-[8rem] sm:min-h-[28rem] max-h-[24rem] sm:max-h-[48rem] mb-4 sm:mb-6 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50 text-gray-800 transition-all shadow-inner text-base sm:text-2xl"
              placeholder="Write your essay here..."
            />
            <div className="text-right mb-4 sm:mb-8 text-sm sm:text-lg text-gray-500 w-full">
              Words: {getCurrentText().trim().split(/\s+/).filter(Boolean).length}
            </div>
            <button
              onClick={handleSubmit}
              className="w-full bg-blue-600 text-white px-4 sm:px-10 py-3 sm:py-6 rounded-xl font-bold hover:bg-blue-700 transition-colors duration-300 text-base sm:text-2xl shadow-lg disabled:opacity-50 mt-2"
              disabled={loading || !task1Text.trim() || !task2Text.trim()}
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