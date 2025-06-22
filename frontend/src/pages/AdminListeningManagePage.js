import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import QuestionForm from '../components/QuestionForm';

// Константы для типов вопросов, чтобы избежать опечаток
const QUESTION_TYPES = {
  MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
  FILL_IN_THE_BLANK: 'FILL_IN_THE_BLANK',
  TRUE_FALSE_NOT_GIVEN: 'TRUE_FALSE_NOT_GIVEN',
};

const TRUE_FALSE_OPTIONS = [
  { label: 'A', text: 'True' },
  { label: 'B', text: 'False' },
  { label: 'C', text: 'Not Given' },
];

const AdminListeningManagePage = () => {
  const [tests, setTests] = useState([]);
  const [currentTest, setCurrentTest] = useState({ title: '', description: '', questions: [] });
  const [audioFile, setAudioFile] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const audioInputRef = useRef();

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = () => {
    const token = localStorage.getItem('token');
    axios.get('/api/listening/tests/', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(res => setTests(res.data))
      .catch(err => console.error("Failed to fetch tests:", err));
  };

  const handleTestChange = (e) => {
    const { name, value } = e.target;
    setCurrentTest(prev => ({ ...prev, [name]: value }));
  };

  const handleAudioChange = (e) => {
    const file = e.target.files[0];
    if (file) setAudioFile(file);
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
    if (!currentTest.title || !audioFile) {
        alert("Название теста и аудиофайл обязательны.");
        return;
    }
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
        // Шаг 1: Создаем тест, получаем его ID
        const testFormData = new FormData();
        testFormData.append('title', currentTest.title);
        testFormData.append('description', currentTest.description);
        testFormData.append('audio_file', audioFile);
        
        const testRes = await axios.post('/api/listening/tests/create/', testFormData, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
        });
        
        const testId = testRes.data.id;
        
        // Шаг 2: Добавляем каждый вопрос к созданному тесту
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
            await axios.post(`/api/listening/tests/${testId}/questions/add/`, qFormData, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });
        }
        
        alert('Тест успешно создан!');
        fetchTests();
        // Сбрасываем форму
        setCurrentTest({ title: '', description: '', questions: [] });
        setAudioFile(null);
        if (audioInputRef.current) audioInputRef.current.value = null;

    } catch (err) {
      console.error(err);
      alert('Ошибка при создании теста: ' + (err.response?.data?.detail || err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = (id) => {
    const token = localStorage.getItem('token');
    axios.post(`/api/listening/tests/${id}/activate/`, {}, { headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        alert('Тест активирован!');
        fetchTests();
      })
      .catch(err => alert('Ошибка при активации теста'));
  };

  const handleDelete = (id) => {
    if (window.confirm("Вы уверены, что хотите удалить этот тест? Это действие необратимо.")) {
        const token = localStorage.getItem('token');
        axios.delete(`/api/listening/tests/${id}/`, { headers: { Authorization: `Bearer ${token}` } })
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
      <h2 className="text-2xl font-bold mb-4">Управление Listening тестами (Admin)</h2>
      
      {/* Active Test Banner */}
      {activeTest && (
        <div className="mb-6 p-4 bg-green-100 border border-green-400 rounded">
          <span className="font-semibold">Текущий активный тест:</span> {activeTest.title}
        </div>
      )}

      {/* Test Creation Form */}
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-md mb-8">
        <h3 className="text-xl font-semibold border-b pb-2">Создать новый тест</h3>
        
        {/* Test Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold">Название теста</label>
            <input type="text" name="title" value={currentTest.title} onChange={handleTestChange} className="w-full p-2 border rounded" required />
          </div>
          <div>
            <label className="block font-semibold">Аудиофайл (mp3, wav)</label>
            <input type="file" accept="audio/*" onChange={handleAudioChange} ref={audioInputRef} className="w-full p-2 border rounded file:mr-4 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" required />
          </div>
        </div>
        <div>
          <label className="block font-semibold">Описание</label>
          <textarea name="description" value={currentTest.description} onChange={handleTestChange} className="w-full p-2 border rounded" rows="2" />
        </div>

        {/* Questions Display */}
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

      {/* List of Existing Tests */}
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

export default AdminListeningManagePage;