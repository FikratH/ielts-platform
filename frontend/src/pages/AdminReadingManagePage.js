import React, { useState, useEffect } from 'react';
import axios from 'axios';
import QuestionForm from '../components/QuestionForm'; // Импортируем наш новый компонент

const AdminReadingManagePage = () => {
  const [tests, setTests] = useState([]);
  const [currentTest, setCurrentTest] = useState({ title: '', description: '', passage: '', questions: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = () => {
    const token = localStorage.getItem('token');
    axios.get('/api/reading/tests/', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(res => setTests(res.data))
      .catch(err => console.error("Failed to fetch tests:", err));
  };

  const handleTestChange = (e) => {
    const { name, value } = e.target;
    setCurrentTest(prev => ({ ...prev, [name]: value }));
  };

  const addQuestion = (question) => {
    setCurrentTest(prev => ({ ...prev, questions: [...prev.questions, question] }));
  };

  const removeQuestion = (idx) => {
    setCurrentTest(prev => ({
        ...prev,
        questions: prev.questions.filter((_, i) => i !== idx)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentTest.title || !currentTest.passage) {
        alert("Название теста и текст пассажа обязательны.");
        return;
    }
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
        const testFormData = new FormData();
        testFormData.append('title', currentTest.title);
        testFormData.append('description', currentTest.description);
        testFormData.append('passage', currentTest.passage);
        
        const testRes = await axios.post('/api/reading/tests/create/', testFormData, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
        });
        
        const testId = testRes.data.id;
        
        for (const question of currentTest.questions) {
            const qFormData = new FormData();
            qFormData.append('question_type', question.question_type);
            qFormData.append('question_text', question.question_text);
            qFormData.append('order', question.order);
            qFormData.append('correct_answer', question.correct_answer);
            qFormData.append('options', JSON.stringify(question.options));
            if (question.image) {
                qFormData.append('image', question.image, question.image.name);
            }
            await axios.post(`/api/reading/tests/${testId}/questions/add/`, qFormData, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });
        }
        
        alert('Тест успешно создан!');
        fetchTests();
        setCurrentTest({ title: '', description: '', passage: '', questions: [] });

    } catch (err) {
      console.error(err);
      alert('Ошибка при создании теста: ' + (err.response?.data?.detail || err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = (id) => {
    const token = localStorage.getItem('token');
    axios.post(`/api/reading/tests/${id}/activate/`, {}, { headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        alert('Тест активирован!');
        fetchTests();
      })
      .catch(err => alert('Ошибка при активации теста'));
  };

  const handleDelete = (id) => {
    if (window.confirm("Вы уверены, что хотите удалить этот тест? Это действие необратимо.")) {
        const token = localStorage.getItem('token');
        axios.delete(`/api/reading/tests/${id}/`, { headers: { Authorization: `Bearer ${token}` } })
            .then(() => {
                alert('Тест удален.');
                fetchTests();
            })
            .catch(err => alert('Ошибка при удалении теста.'));
    }
  };

  const activeTest = tests.find(t => t.is_active);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Управление Reading тестами (Admin)</h2>
      
      {activeTest && (
        <div className="mb-6 p-4 bg-green-100 border border-green-400 rounded">
          <span className="font-semibold">Текущий активный тест:</span> {activeTest.title}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-md mb-8">
        <h3 className="text-xl font-semibold border-b pb-2">Создать новый тест</h3>
        
        <div>
          <label className="block font-semibold">Название теста</label>
          <input type="text" name="title" value={currentTest.title} onChange={handleTestChange} className="w-full p-2 border rounded" required />
        </div>
        <div>
          <label className="block font-semibold">Описание</label>
          <textarea name="description" value={currentTest.description} onChange={handleTestChange} className="w-full p-2 border rounded" rows="2" />
        </div>
        <div>
          <label className="block font-semibold">Текст пассажа</label>
          <textarea name="passage" value={currentTest.passage} onChange={handleTestChange} className="w-full p-2 border rounded" rows="10" required />
        </div>

        <div>
          <h4 className="font-semibold">Вопросы в тесте ({currentTest.questions.length})</h4>
          <div className="space-y-2 mt-2 max-h-60 overflow-y-auto border p-2 rounded-md">
            {currentTest.questions.length > 0 ? currentTest.questions.map((q, idx) => (
              <div key={idx} className="border p-2 rounded flex items-center justify-between bg-gray-50">
                <div><span className="font-semibold">Q{q.order}:</span> {q.question_text.substring(0, 50)}...</div>
                <button type="button" onClick={() => removeQuestion(idx)} className="text-red-600 font-bold text-sm">Удалить</button>
              </div>
            )) : <p className="text-gray-500">Пока нет вопросов.</p>}
          </div>
        </div>

        <QuestionForm 
            onSubmit={addQuestion}
            initialOrder={currentTest.questions.length + 1}
        />
        
        <button type="submit" className="w-full bg-indigo-600 text-white p-3 rounded hover:bg-indigo-700 disabled:bg-gray-400" disabled={loading}>
          {loading ? 'Создание...' : 'Создать и сохранить тест'}
        </button>
      </form>

      <div>
        <h3 className="text-xl font-semibold border-b pb-2 mb-4">Список тестов</h3>
        <div className="space-y-4">
          {tests.map(test => (
            <div key={test.id} className="border p-4 rounded-lg shadow-sm bg-white flex justify-between items-center">
              <div>
                <p className="font-semibold">{test.title} <span className={`text-xs font-mono p-1 rounded ${test.is_active ? 'bg-green-200 text-green-800' : 'bg-gray-200'}`}>{test.is_active ? 'ACTIVE' : 'INACTIVE'}</span></p>
                <p className="text-sm text-gray-600">{test.description}</p>
              </div>
              <div className="flex items-center space-x-2">
                {!test.is_active && <button onClick={() => handleActivate(test.id)} className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600">Активировать</button>}
                <button onClick={() => handleDelete(test.id)} className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600">Удалить</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminReadingManagePage;