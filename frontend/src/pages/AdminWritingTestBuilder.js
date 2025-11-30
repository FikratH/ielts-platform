import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { auth } from '../firebase';

const AdminWritingTestBuilder = () => {
  const navigate = useNavigate();
  
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingTest, setEditingTest] = useState(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [explanationUrl, setExplanationUrl] = useState('');
  const [task1Text, setTask1Text] = useState('');
  const [task1Image, setTask1Image] = useState(null);
  const [task2Text, setTask2Text] = useState('');
  const [task2Image, setTask2Image] = useState(null);
  
  const [showForm, setShowForm] = useState(false);
  
  useEffect(() => {
    const token = auth.currentUser?.getIdToken();
    if (!token) {
      navigate("/login");
      return;
    }
    fetchTests();
  }, [navigate]);

  const fetchTests = async () => {
    try {
      const res = await api.get("/writing-tests/");
      setTests(res.data);
    } catch (err) {
      console.error(err);
      alert("Error loading tests");
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setTask1Text('');
    setTask1Image(null);
    setTask2Text('');
    setTask2Image(null);
    setEditingTest(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title.trim() || !task1Text.trim() || !task2Text.trim()) {
      alert('Please fill in all required fields (Title, Task 1, and Task 2)');
      return;
    }
    
    setLoading(true);
    
    try {
      let testData;
      
      if (editingTest) {
        // Update existing test
        const testResponse = await api.put(`/writing-tests/${editingTest.id}/`, {
          title: title.trim(),
          description: description.trim(),
          explanation_url: (explanationUrl || '').trim()
        });
        testData = testResponse.data;
        
        // Update tasks
        const existingTask1 = editingTest.tasks.find(t => t.task_type === 'task1');
        const existingTask2 = editingTest.tasks.find(t => t.task_type === 'task2');
        
        if (existingTask1) {
          await api.put(`/writing-tasks/${existingTask1.id}/`, {
            task_text: task1Text.trim(),
            task_type: 'task1'
          });
          
          if (task1Image) {
            const formData = new FormData();
            formData.append('image', task1Image);
            formData.append('task_text', task1Text.trim());
            formData.append('task_type', 'task1');
            await api.put(`/writing-tasks/${existingTask1.id}/`, formData);
          }
        }
        
        if (existingTask2) {
          await api.put(`/writing-tasks/${existingTask2.id}/`, {
            task_text: task2Text.trim(),
            task_type: 'task2'
          });
          
          if (task2Image) {
            const formData = new FormData();
            formData.append('image', task2Image);
            formData.append('task_text', task2Text.trim());
            formData.append('task_type', 'task2');
            await api.put(`/writing-tasks/${existingTask2.id}/`, formData);
          }
        }
        
      } else {
        // Create new test
        const testResponse = await api.post("/writing-tests/", {
          title: title.trim(),
          description: description.trim(),
          explanation_url: (explanationUrl || '').trim(),
          is_active: false
        });
        testData = testResponse.data;
        
        // Create Task 1
        if (task1Image) {
          const formData = new FormData();
          formData.append('test', testData.id);
          formData.append('task_type', 'task1');
          formData.append('task_text', task1Text.trim());
          formData.append('image', task1Image);
          await api.post("/writing-tasks/", formData);
        } else {
          await api.post("/writing-tasks/", {
            test: testData.id,
            task_type: 'task1',
            task_text: task1Text.trim()
          });
        }
        
        // Create Task 2
        if (task2Image) {
          const formData = new FormData();
          formData.append('test', testData.id);
          formData.append('task_type', 'task2');
          formData.append('task_text', task2Text.trim());
          formData.append('image', task2Image);
          await api.post("/writing-tasks/", formData);
        } else {
          await api.post("/writing-tasks/", {
            test: testData.id,
            task_type: 'task2',
            task_text: task2Text.trim()
          });
        }
      }
      
      await fetchTests();
      resetForm();
      alert(`Test ${editingTest ? 'updated' : 'created'} successfully!`);
      
    } catch (err) {
      console.error(err);
      alert(`Error ${editingTest ? 'updating' : 'creating'} test`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (test) => {
    setEditingTest(test);
    setTitle(test.title);
    setDescription(test.description || '');
    
    const task1 = test.tasks.find(t => t.task_type === 'task1');
    const task2 = test.tasks.find(t => t.task_type === 'task2');
    
    setTask1Text(task1 ? task1.task_text : '');
    setTask2Text(task2 ? task2.task_text : '');
    
    setTask1Image(null);
    setTask2Image(null);
    
    setShowForm(true);
  };

  const handleDelete = async (testId) => {
    if (!window.confirm('Are you sure you want to delete this test? This action cannot be undone.')) {
      return;
    }
    
    try {
      await api.delete(`/writing-tests/${testId}/`);
      await fetchTests();
      alert('Test deleted successfully');
    } catch (err) {
      console.error(err);
      alert('Error deleting test');
    }
  };

  const handleToggleActive = async (testId, currentStatus) => {
    try {
      await api.post(`/writing-tests/${testId}/toggle-active/`);
      await fetchTests();
    } catch (err) {
      console.error(err);
      alert('Error toggling test status');
    }
  };

  const handleExportCSV = async (testId) => {
    try {
      const response = await api.get(`/admin/writing-test/${testId}/export-csv/`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `writing_test_${testId}_results.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      console.error(err);
      alert('Error exporting CSV');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Writing Tests Management</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          {showForm ? 'Cancel' : 'Create New Test'}
        </button>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-xl font-semibold border-b pb-2">
              {editingTest ? 'Edit Writing Test' : 'Create New Writing Test'}
            </h3>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block font-semibold mb-2">Test Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., Academic Writing Test - Set 1"
                  required
                />
              </div>
              
              <div>
                <label className="block font-semibold mb-2">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="block font-semibold mb-2">Explanation URL (YouTube)</label>
                <input
                  type="url"
                  value={explanationUrl || ''}
                  onChange={(e) => setExplanationUrl(e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>
            </div>

            {/* Task 1 */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h4 className="text-lg font-semibold mb-3 text-purple-700">Task 1 (Academic/General) *</h4>
              
              <div className="mb-4">
                <label className="block font-semibold mb-2">Task 1 Text</label>
                <textarea
                  value={task1Text}
                  onChange={(e) => setTask1Text(e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows="6"
                  placeholder="Enter Task 1 instructions and requirements..."
                  required
                />
              </div>
              
              <div>
                <label className="block font-semibold mb-2">Task 1 Image (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setTask1Image(e.target.files[0])}
                  className="w-full p-2 border rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                />
              </div>
            </div>

            {/* Task 2 */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h4 className="text-lg font-semibold mb-3 text-purple-700">Task 2 (Essay) *</h4>
              
              <div className="mb-4">
                <label className="block font-semibold mb-2">Task 2 Text</label>
                <textarea
                  value={task2Text}
                  onChange={(e) => setTask2Text(e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows="6"
                  placeholder="Enter Task 2 essay instructions..."
                  required
                />
              </div>
              
              <div>
                <label className="block font-semibold mb-2">Task 2 Image (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setTask2Image(e.target.files[0])}
                  className="w-full p-2 border rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving...' : (editingTest ? 'Update Test' : 'Create Test')}
            </button>
          </form>
        </div>
      )}

      {/* Tests List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h3 className="text-lg font-semibold">Writing Tests ({tests.length})</h3>
        </div>
        
        {tests.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <div className="text-4xl mb-4">📝</div>
            <p>No writing tests created yet. Create your first test above!</p>
          </div>
        ) : (
          <div className="divide-y">
            {tests.map((test) => (
              <div key={test.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-semibold text-gray-800">{test.title}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        test.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {test.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    
                    {test.description && (
                      <p className="text-gray-600 mb-3">{test.description}</p>
                    )}
                    
                    <div className="text-sm text-gray-500 space-y-1">
                      <p>Tasks: {test.tasks?.length || 0}/2</p>
                      <p>Created: {new Date(test.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(test)}
                      className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                    >
                      Edit
                    </button>
                    
                    <button
                      onClick={() => handleToggleActive(test.id, test.is_active)}
                      className={`px-3 py-2 text-sm rounded transition-colors ${
                        test.is_active 
                          ? 'bg-orange-600 text-white hover:bg-orange-700' 
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {test.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    
                    <button
                      onClick={() => handleExportCSV(test.id)}
                      className="px-3 py-2 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700 transition-colors"
                    >
                      Export CSV
                    </button>
                    
                    <button
                      onClick={() => handleDelete(test.id)}
                      className="px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminWritingTestBuilder;
