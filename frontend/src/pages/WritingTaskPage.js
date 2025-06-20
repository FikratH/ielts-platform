import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import WritingTimer from '../components/WritingTimer';

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
        console.error("Ошибка загрузки задания:", err);
        setPromptText("Нет активного задания.");
        setPromptImage("");
      }
    };

    fetchPrompt();
  }, [taskType]);

  const handleSubmit = async () => {
    if (!text.trim()) {
      alert("Введите текст эссе");
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
      alert("Ошибка при сохранении эссе");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center z-50">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      <div className="p-6 max-w-3xl mx-auto">
        <WritingTimer onTimeUp={handleSubmit} />

        <h2 className="text-xl font-bold mb-4">IELTS Writing {taskType.toUpperCase()}</h2>

        {promptImage && (
          <img src={promptImage} alt="Task illustration" className="mb-4 w-full max-w-xl rounded border" />
        )}

        <p className="mb-4">{promptText}</p>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          className="w-full border rounded p-3 h-[700px] mb-4"
          placeholder="Напишите ваше эссе здесь..."
        />
        <div className="text-right mb-4 text-sm text-gray-600">
          Слов: {text.trim().split(/\s+/).filter(Boolean).length}
        </div>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? "Отправка..." : "Сдать эссе"}
        </button>
      </div>
    </div>
  );
};

export default WritingTaskPage;
