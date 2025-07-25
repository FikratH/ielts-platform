import React, { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import api from '../api';
import { auth } from '../firebase';

const WritingPromptsAdminPage = () => {
  const navigate = useNavigate();

  const [prompts, setPrompts] = useState([]);
  const [taskType, setTaskType] = useState("task1");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  
  useEffect(() => {
    const token = auth.currentUser?.getIdToken();
    if (!token) {
      navigate("/login");
      return;
    }
    fetchPrompts();
  }, [navigate]);

  const fetchPrompts = async () => {
    try {
      const res = await api.get("/prompts/");
      setPrompts(res.data);
    } catch (err) {
      console.error(err);
      alert("Error loading prompts");
    }
  };

  const setActivePrompt = async (id) => {
    try {
      await api.post(`/prompts/${id}/set_active/`);
      fetchPrompts();
    } catch (err) {
      console.error(err);
      alert("Error setting active prompt");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return alert("Enter prompt text");

    setLoading(true);
    const formData = new FormData();
    formData.append("task_type", taskType);
    formData.append("prompt_text", text);
    if (imageFile) formData.append("image", imageFile);

    const url = editingId ? `/prompts/${editingId}/` : "/prompts/";
    const method = editingId ? 'patch' : 'post';

    try {
      await api[method](url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });


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
      alert("Error saving: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (prompt) => {
    setEditingId(prompt.id);
    setTaskType(prompt.task_type);
    setText(prompt.prompt_text);
    window.scrollTo(0, 0); 
  };

  const cancelEdit = () => {
    setEditingId(null);
    setText("");
    setTaskType("task1");
    setImageFile(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete prompt?")) return;
    try {
      await api.delete(`/prompts/${id}/`);
      fetchPrompts();
    } catch (err) {
      console.error(err);
      alert("Error deleting prompt");
    }
  };

  const handleExportCSV = async (promptId) => {
    const response = await api.get(`/admin/writing-prompt/${promptId}/export-csv/`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `writing_prompt_${promptId}_essays.csv`);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
  };

  const activePrompt = prompts.find(p => p.is_active);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Writing Prompts Management</h2>

      
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          <h3 className="text-xl font-semibold border-b pb-2">{editingId ? 'Edit prompt' : 'Create new prompt'}</h3>

          <div>
            <label className="block font-semibold">Task type:</label>
            <select value={taskType} onChange={(e) => setTaskType(e.target.value)} className="w-full p-2 border rounded">
              <option value="task1">Task 1</option>
              <option value="task2">Task 2</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold">Prompt text</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full p-2 border rounded" rows="4" placeholder="Enter prompt text" required />
          </div>
          
          <div>
            <label className="block font-semibold">Image</label>
            <input type="file" id="imageInput" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} className="w-full p-2 border rounded file:mr-4 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
            {editingId ? (loading ? "Saving..." : "Save changes") : (loading ? "Adding..." : "Add prompt")}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="w-full bg-gray-500 text-white p-3 rounded-lg hover:bg-gray-600 mt-2">
              Cancel
            </button>
          )}
        </form>
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-semibold border-b pb-2 mb-4">Prompts list</h3>
        <div className="space-y-4">
          {prompts.map(prompt => (
            <div key={prompt.id} className="border p-4 rounded-lg shadow-sm bg-white flex justify-between items-center">
              <div className="flex-grow">
                <p className="font-semibold">{prompt.task_type.toUpperCase()} <span className={`text-xs font-mono p-1 rounded ${prompt.is_active ? 'bg-green-200 text-green-800' : 'bg-gray-200'}`}>{prompt.is_active ? 'ACTIVE' : 'INACTIVE'}</span></p>
                <p className="text-sm text-gray-600 mt-1">{prompt.prompt_text}</p>
                {prompt.image && <a href={prompt.image} target="_blank" rel="noopener noreferrer" className="text-blue-500 text-sm hover:underline">View image</a>}
              </div>
              <div className="flex items-center space-x-2 ml-4">
                {!prompt.is_active && <button onClick={() => setActivePrompt(prompt.id)} className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600">Activate</button>}
                <button onClick={() => handleEditClick(prompt)} className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600">Edit</button>
                <button onClick={() => handleDelete(prompt.id)} className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600">Delete</button>
                <button onClick={() => handleExportCSV(prompt.id)} className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">Export CSV</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WritingPromptsAdminPage;
