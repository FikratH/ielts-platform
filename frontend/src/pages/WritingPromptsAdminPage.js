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
  const [imageFile, setImageFile] = useState(null);
  
  const token = localStorage.getItem("token");

  useEffect(() => {
    // Простая проверка токена. Более сложная проверка роли происходит на бэкенде.
    if (!token) {
      navigate("/login");
      return;
    }
    fetchPrompts();
  }, [navigate, token]);

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
    try {
      await axios.post(`/api/prompts/${id}/set_active/`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchPrompts();
    } catch (err) {
      console.error(err);
      alert("Ошибка при установке активного задания");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return alert("Введите текст задания");

    setLoading(true);
    const formData = new FormData();
    formData.append("task_type", taskType);
    formData.append("prompt_text", text);
    if (imageFile) formData.append("image", imageFile);

    const url = editingId ? `/api/prompts/${editingId}/` : "/api/prompts/";
    const method = editingId ? 'patch' : 'post';

    try {
      await axios[method](url, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      // Reset form state
      setText("");
      setTaskType("task1");
      setEditingId(null);
      setImageFile(null);
      if (document.getElementById("imageInput")) {
        document.getElementById("imageInput").value = "";
      }
      fetchPrompts();

    } catch (err) {
      console.error(err);
      alert("Ошибка при сохранении: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (prompt) => {
    setEditingId(prompt.id);
    setTaskType(prompt.task_type);
    setText(prompt.prompt_text);
    window.scrollTo(0, 0); // Прокрутка вверх к форме
  };

  const cancelEdit = () => {
    setEditingId(null);
    setText("");
    setTaskType("task1");
    setImageFile(null);
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

  const activePrompt = prompts.find(p => p.is_active);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Управление Writing тестами (Admin)</h2>

      {activePrompt && (
        <div className="mb-6 p-4 bg-green-100 border border-green-400 rounded">
          <span className="font-semibold">Текущий активный тест:</span> {activePrompt.prompt_text.substring(0, 70)}...
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-md mb-8">
        <h3 className="text-xl font-semibold border-b pb-2">{editingId ? 'Редактировать задание' : 'Создать новое задание'}</h3>

        <div>
          <label className="block font-semibold">Тип задания:</label>
          <select value={taskType} onChange={(e) => setTaskType(e.target.value)} className="w-full p-2 border rounded">
            <option value="task1">Task 1</option>
            <option value="task2">Task 2</option>
          </select>
        </div>

        <div>
            <label className="block font-semibold">Текст задания</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full p-2 border rounded" rows="4" placeholder="Введите текст задания" required />
        </div>
        
        <div>
            <label className="block font-semibold">Изображение (для Task 1)</label>
            <input type="file" id="imageInput" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} className="w-full p-2 border rounded file:mr-4 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
        </div>

        <div className="flex items-center space-x-4">
            <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white p-3 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400">
              {editingId ? (loading ? "Сохранение..." : "Сохранить изменения") : (loading ? "Добавление..." : "Добавить задание")}
            </button>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="w-full bg-gray-500 text-white p-3 rounded-lg hover:bg-gray-600">
                Отмена
              </button>
            )}
        </div>
      </form>

      <div>
        <h3 className="text-xl font-semibold border-b pb-2 mb-4">Список заданий</h3>
        <div className="space-y-4">
          {prompts.map(prompt => (
            <div key={prompt.id} className="border p-4 rounded-lg shadow-sm bg-white flex justify-between items-center">
              <div className="flex-grow">
                <p className="font-semibold">{prompt.task_type.toUpperCase()} <span className={`text-xs font-mono p-1 rounded ${prompt.is_active ? 'bg-green-200 text-green-800' : 'bg-gray-200'}`}>{prompt.is_active ? 'ACTIVE' : 'INACTIVE'}</span></p>
                <p className="text-sm text-gray-600 mt-1">{prompt.prompt_text}</p>
                {prompt.image && <a href={prompt.image} target="_blank" rel="noopener noreferrer" className="text-blue-500 text-sm hover:underline">Посмотреть изображение</a>}
              </div>
              <div className="flex flex-col space-y-2 ml-4">
                {!prompt.is_active && <button onClick={() => setActivePrompt(prompt.id)} className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 w-full text-center">Активировать</button>}
                <button onClick={() => handleEditClick(prompt)} className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600 w-full text-center">Редактировать</button>
                <button onClick={() => handleDelete(prompt.id)} className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 w-full text-center">Удалить</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WritingPromptsAdminPage;
