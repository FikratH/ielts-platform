import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import WritingTimer from '../components/WritingTimer';
import TestLayout from '../components/TestLayout';

const WritingTaskPage = () => {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [taskType, setTaskType] = useState("task1");
  const [text, setText] = useState("");
  const [promptText, setPromptText] = useState("");
  const [promptImage, setPromptImage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    localStorage.removeItem('writing_timer');
  }, [sessionId]);

  useEffect(() => {
    if (location.pathname.includes("task2")) {
      setTaskType("task2");
    }
  }, [location.pathname]);

  useEffect(() => {
    setText("");
  }, [taskType]);

  useEffect(() => {
    const fetchPrompt = async () => {
      try {
        const res = await axios.get(`/api/prompts/active/?task_type=${taskType}`);
        setPromptText(res.data.prompt_text);
        if (res.data.image) {
          setPromptImage(`http://localhost:8000${res.data.image}`);
        } else {
          setPromptImage("");
        }
      } catch (err) {
        console.error("Task loading error:", err);
        setPromptText("No active task.");
        setPromptImage("");
      }
    };

    fetchPrompt();
  }, [taskType]);

  const handleSubmit = async () => {
    if (!text.trim()) {
      alert("Please enter your essay text");
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      await axios.post('/api/submit-task/', {
        session_id: sessionId,
        task_type: taskType,
        submitted_text: text,
        question_text: promptText,
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (taskType === "task1") {
        navigate(`/writing/task2/${sessionId}`);
      } else {
        await axios.post('/api/finish-writing-session/', {
          session_id: sessionId
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        navigate(`/writing/result/${sessionId}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error saving essay");
    } finally {
      setLoading(false);
    }
  };

  const handleTimeUp = async () => {
    if (loading) return; 
    
    setLoading(true);
    
    try {
      const token = localStorage.getItem("token");
      

      if (text.trim()) {
        await axios.post('/api/submit-task/', {
          session_id: sessionId,
          task_type: taskType,
          submitted_text: text,
          question_text: promptText,
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      }

     
      if (taskType === "task1") {
        navigate(`/writing/task2/${sessionId}`);
      } else {
       
        await axios.post('/api/finish-writing-session/', {
          session_id: sessionId
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        navigate(`/writing/result/${sessionId}`);
      }
    } catch (err) {
      console.error("Autosubmit timer error:", err);
      alert("Error during automatic submission. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const timeLimit = taskType === "task1" ? 20 * 60 : 40 * 60; 

  const renderLeftPanel = () => (
    <div>
      <h3 className="text-xl font-bold mb-4">Writing Task {taskType.toUpperCase()}</h3>
      {promptImage && (
        <div className="mb-4">
          <img src={promptImage} alt="Task illustration" className="w-full max-w-md rounded border" />
        </div>
      )}
      <div className="prose max-w-none">
        <p className="text-lg leading-relaxed">{promptText}</p>
      </div>
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Time:</strong> {taskType === "task1" ? "20 minutes" : "40 minutes"}<br/>
          <strong>Minimum words:</strong> {taskType === "task1" ? "150" : "250"}
        </p>
      </div>
    </div>
  );

  const renderRightPanel = () => (
    <div>
      <h3 className="text-xl font-bold mb-4">Your Essay</h3>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        className="w-full border rounded p-3 h-96 mb-4 resize-none"
        placeholder="Write your essay here..."
      />
      <div className="text-right mb-4 text-sm text-gray-600">
        Words: {text.trim().split(/\s+/).filter(Boolean).length}
      </div>
    </div>
  );

  let submitLabel = "Finish and view result";
  if (taskType === "task1") {
    submitLabel = "Go to Task 2";
  } else {
    submitLabel = "Finish and view result";
  }

  if (loading) {
    return (
      <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center z-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <TestLayout
      title={`IELTS Writing ${taskType.toUpperCase()}`}
      timer={<WritingTimer onTimeUp={handleTimeUp} initialSeconds={timeLimit} />}
      leftPanel={renderLeftPanel()}
      rightPanel={renderRightPanel()}
      onSubmit={handleSubmit}
      isSubmitting={loading}
      submitLabel={submitLabel}
    />
  );
};

export default WritingTaskPage;
