import React, { useState, useEffect } from 'react';
import axios from 'axios';
import QuestionForm from '../components/QuestionForm'; 

const AdminReadingManagePage = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [passage, setPassage] = useState('');
  const [questions, setQuestions] = useState([]);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingTest, setEditingTest] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null);

  const api = axios.create({
    baseURL: 'http://localhost:8000/api',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  });

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reading/tests/');
      setTests(res.data);
      setLoading(false);
    } catch (err) {
      setError('Could not fetch tests.');
      console.error(err);
      setLoading(false);
    }
  };

  const handleEdit = async (testId) => {
    try {
      setLoading(true);
      const res = await api.get(`/reading/tests/${testId}/`);
      const testData = res.data;
      setEditingTest(testData);
      setTitle(testData.title);
      setDescription(testData.description);
      setPassage(testData.passage?.text || '');
      setQuestions(testData.questions || []);
      setError('');
      setLoading(false);
      window.scrollTo(0, 0);
    } catch (err) {
      setError('Could not fetch test details for editing.');
      console.error(err);
      setLoading(false);
    }
  };
  
  const handleCancelEdit = () => {
    setEditingTest(null);
    setTitle('');
    setDescription('');
    setPassage('');
    setQuestions([]);
    setError('');
    setEditingQuestion(null);
  };

  const addQuestion = (question) => {
    const order = questions.length > 0 ? Math.max(...questions.map(q => q.order)) + 1 : 1;
    setQuestions([...questions, { ...question, order, id: `new-${Date.now()}` }]);
  };

  const removeQuestion = (index) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const editQuestion = (question) => {
    setEditingQuestion(question);
  };

  const updateQuestion = (updatedQuestion) => {
    if (!updatedQuestion) {
      setEditingQuestion(null);
      return;
    }
    setQuestions(questions.map(q => q.id === updatedQuestion.id ? updatedQuestion : q));
    setEditingQuestion(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !passage || questions.length === 0) {
      setError('Please fill in all fields and add at least one question.');
      return;
    }

    const testData = {
      title,
      description,
      passage,
      questions: questions.map(q => {
        const newQ = {...q};
        if (String(q.id).startsWith('new-')) {
          delete newQ.id; 
        }
        return newQ;
      })
    };

    setLoading(true);
    setError('');
    try {
      if (editingTest) {
        await api.put(`/admin/reading/${editingTest.id}/`, testData);
      } else {
        await api.post('/reading/tests/create/', testData);
      }
      handleCancelEdit();
      fetchTests();
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err.response ? err.response.data : err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (testId) => {
    if (window.confirm('Are you sure you want to delete this test?')) {
      try {
        await api.delete(`/admin/reading/${testId}/`);
        fetchTests();
      } catch (err) {
        setError('Could not delete the test.');
        console.error(err);
      }
    }
  };

  const activateTest = async (testId, isActive) => {
    try {
      await api.post(`/admin/reading/${testId}/activate/`, { is_active: isActive });
      fetchTests();
    } catch (err) {
      setError('Could not change test status.');
      console.error(err);
    }
  };

  const activeTest = tests.find(t => t.is_active);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Управление тестами Reading</h2>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          <h3 className="text-xl font-semibold border-b pb-2">{editingTest ? 'Редактировать тест' : 'Создать новый тест'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block font-semibold">Название теста</label>
              <input type="text" name="title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-2 border rounded" required />
            </div>
            <div>
              <label className="block font-semibold">Описание</label>
              <textarea name="description" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-2 border rounded" rows="2" />
            </div>
          </div>
          <div>
            <label className="block font-semibold">Текст пассажа</label>
            <textarea name="passage" value={passage} onChange={(e) => setPassage(e.target.value)} className="w-full p-2 border rounded" rows="10" required />
          </div>

          <div>
            <h4 className="font-semibold">Вопросы в тесте ({questions.length})</h4>
            <div className="space-y-2 mt-2 max-h-60 overflow-y-auto border p-2 rounded-md">
              {questions.length > 0 ? questions.map((q, idx) => (
                <div key={q.id || `new-${idx}`} className="border p-2 rounded flex items-center justify-between bg-gray-50">
                  <div><span className="font-semibold">Q{q.order}:</span> {q.question_text.substring(0, 50)}...</div>
                  <div className="flex items-center space-x-2">
                    <button type="button" onClick={() => editQuestion(q)} className="text-blue-600 text-sm hover:underline">Редактировать</button>
                    <button type="button" onClick={() => removeQuestion(idx)} className="text-red-500 text-sm hover:underline">Удалить</button>
                  </div>
                </div>
              )) : <p className="text-sm text-gray-500">Пока нет вопросов.</p>}
            </div>
          </div>

          <QuestionForm 
              onSubmit={addQuestion}
              onUpdate={updateQuestion}
              initialData={editingQuestion}
              initialOrder={questions.length + 1}
          />
          
          <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700">
            {editingTest ? 'Обновить тест' : 'Создать и сохранить тест'}
          </button>
          {editingTest && (
            <button type="button" onClick={handleCancelEdit} className="w-full bg-gray-500 text-white p-3 rounded-lg hover:bg-gray-600 mt-2">
              Отмена
            </button>
          )}
        </form>
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-semibold border-b pb-2 mb-4">Список тестов</h3>
        {loading ? <p>Загрузка...</p> : (
          <div className="space-y-4">
            {tests.map(test => (
              <div key={test.id} className="border p-4 rounded-lg shadow-sm bg-white flex justify-between items-center">
                <div>
                  <p className="font-semibold">{test.title} <span className={`text-xs font-mono p-1 rounded ${test.is_active ? 'bg-green-200 text-green-800' : 'bg-gray-200'}`}>{test.is_active ? 'АКТИВЕН' : 'НЕАКТИВЕН'}</span></p>
                  <p className="text-sm text-gray-600 mt-1">{test.description}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button onClick={() => handleEdit(test.id)} className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600">Редактировать</button>
                  <button onClick={() => activateTest(test.id, !test.is_active)} className={`px-3 py-1 rounded text-sm text-white ${test.is_active ? 'bg-gray-500 hover:bg-gray-600' : 'bg-green-500 hover:bg-green-600'}`}>
                    {test.is_active ? 'Деактивировать' : 'Активировать'}
                  </button>
                  <button onClick={() => handleDelete(test.id)} className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600">Удалить</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminReadingManagePage;