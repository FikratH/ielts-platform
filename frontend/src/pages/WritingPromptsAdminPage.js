import React, { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import axios from 'axios';

const WritingPromptsAdminPage = () => {
  const navigate = useNavigate();

  const [prompts, setPrompts] = useState([]);
  const [taskType, setTaskType] = useState("task1");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const token = localStorage.getItem("token");
  const [imageFile, setImageFile] = useState(null);


  const fetchPrompts = async () => {
    try {
      const res = await axios.get("/api/prompts/", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPrompts(res.data);
    } catch (err) {
      console.error(err);
      alert("Ошибка при загрузке заданий");
    }
  };
    const setActivePrompt = async (id) => {
      const prompt = prompts.find(p => p.id === id);
      const formData = new FormData();
      formData.append('task_type', prompt.task_type);
      formData.append('prompt_text', prompt.prompt_text);
      formData.append('is_active', 'true');

      try {
        await axios.put(`/api/prompts/${id}/`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          }
        });
        fetchPrompts();
      } catch (err) {
        console.error(err);
        alert("Ошибка при установке активного задания");
      }
    };

  useEffect(() => {
    const checkRole = async () => {
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const res = await axios.post("/api/login/", {
          idToken: token,
          role: "admin"
        });
        if (res.data.role !== "admin") {
          alert("Доступ разрешён только администраторам");
          navigate("/dashboard");
        } else {
          fetchPrompts();
        }
      } catch (err) {
        console.error(err);
        alert("Ошибка при проверке доступа");
        navigate("/login");
      }
    };

    checkRole();
  }, [navigate, token]);

  const handleSubmit = async () => {
  if (!text.trim()) return alert("Введите текст задания");

  setLoading(true);
  const formData = new FormData();
  formData.append("task_type", taskType);
  formData.append("prompt_text", text);
  if (imageFile) formData.append("image", imageFile);

  try {
    if (editingId) {
      await axios.patch(`/api/prompts/${editingId}/`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });

    } else {
      await axios.post("/api/prompts/", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
    }

    setText("");
    setTaskType("task1");
    setEditingId(null);
    setImageFile(null);
    document.getElementById("imageInput").value = "";
    fetchPrompts();
  } catch (err) {
    console.error(err);
    alert("Ошибка при сохранении");
  } finally {
    setLoading(false);
  }
};


  const handleEditClick = (prompt) => {
    setEditingId(prompt.id);
    setTaskType(prompt.task_type);
    setText(prompt.prompt_text);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить задание?")) return;
    try {
      await axios.delete(`/api/prompts/${id}/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchPrompts();
    } catch (err) {
      console.error(err);
      alert("Ошибка при удалении");
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Панель заданий (Writing)</h2>

      <div className="mb-6">
        <label className="block mb-2">Тип задания:</label>
        <select
          value={taskType}
          onChange={(e) => setTaskType(e.target.value)}
          className="border p-2 rounded w-full mb-3"
        >
          <option value="task1">Task 1</option>
          <option value="task2">Task 2</option>
        </select>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="border p-2 rounded w-full h-32 mb-3"
          placeholder="Введите текст задания"
        />
        <label className="block mb-2">Изображение</label>
            <input
              type="file"
              id="imageInput"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files[0])}
              className="mb-4"
            />


        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {editingId ? "Сохранить изменения" : loading ? "Добавление..." : "Добавить задание"}
        </button>

        {editingId && (
          <button
            onClick={() => {
              setEditingId(null);
              setText("");
              setTaskType("task1");
            }}
            className="ml-3 text-sm text-red-600 underline"
          >
            Отмена редактирования
          </button>
        )}
      </div>

      <hr className="my-6" />

      <h3 className="text-lg font-semibold mb-2">Список заданий</h3>
      <ul className="space-y-2">
       {prompts.map(prompt => (
  <div key={prompt.id} className="p-2 mb-2 border rounded">
    <strong>{prompt.task_type.toUpperCase()} — </strong>{prompt.prompt_text}

    {prompt.is_active ? (
      <span className="text-green-600 ml-2 font-semibold">[Активно]</span>
    ) : (
      <button
        onClick={() => {
          console.log("нажата кнопка на prompt", prompt.id);
          setActivePrompt(prompt.id);
        }}
        className="text-blue-600 ml-2 hover:underline"
      >
        Сделать активным
      </button>
)}


    <span className="ml-4">
      <button
  onClick={() => {
    setEditingId(prompt.id);
    setText(prompt.prompt_text);
    setTaskType(prompt.task_type);
  }}
  className="text-blue-600 mr-2 hover:underline"
>
  Редактировать
</button>

      <button onClick={() => handleDelete(prompt.id)} className="text-red-600 hover:underline">
        Удалить
      </button>
    </span>
  </div>
))}

      </ul>
    </div>
  );
};

export default WritingPromptsAdminPage;
