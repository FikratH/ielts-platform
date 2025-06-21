import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const TRUE_FALSE_OPTIONS = [
  { label: 'A', text: 'True' },
  { label: 'B', text: 'False' },
  { label: 'C', text: 'Not Given' },
];

const AdminReadingManagePage = () => {
  const [tests, setTests] = useState([]);
  const [currentTest, setCurrentTest] = useState({ title: '', description: '', passage: '', questions: [] });
  const [newQuestion, setNewQuestion] = useState({ question_type: 'MULTIPLE_CHOICE', question_text: '', order: 1, options: [], image: null, correct_answer: '' });
  const [newOption, setNewOption] = useState({ label: '', text: '' });
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef();
  const [editTestIdx, setEditTestIdx] = useState(null);
  const [editQuestionIdx, setEditQuestionIdx] = useState(null);
  const [editTestData, setEditTestData] = useState(null);
  const [editQuestionData, setEditQuestionData] = useState(null);
  const [showDeleteTestId, setShowDeleteTestId] = useState(null);
  const [showDeleteQuestionIdx, setShowDeleteQuestionIdx] = useState(null);
  const [currentTestId, setCurrentTestId] = useState(null);
  const [testCreated, setTestCreated] = useState(false);

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = () => {
    const token = localStorage.getItem('token');
    axios.get('/api/reading/tests/', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(res => setTests(res.data))
      .catch(err => console.error(err));
  };

  const handleTestChange = (e) => {
    const { name, value } = e.target;
    setCurrentTest(prev => ({ ...prev, [name]: value }));
  };

  const handleNewQuestionChange = (e) => {
    const { name, value } = e.target;
    let updated = { ...newQuestion, [name]: value };
    if (name === 'question_type') {
      if (value === 'TRUE_FALSE_NOT_GIVEN') {
        updated.options = TRUE_FALSE_OPTIONS;
      } else if (value === 'MULTIPLE_CHOICE') {
        updated.options = [];
      } else if (value === 'MATCHING_HEADINGS') {
        updated.options = [];
      }
    }
    setNewQuestion(updated);
  };

  const handleNewOptionChange = (e) => {
    const { name, value } = e.target;
    setNewOption(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewQuestion(prev => ({ ...prev, image: file }));
    }
  };

  const addOption = () => {
    if (newOption.label && newOption.text) {
      setNewQuestion(prev => ({ ...prev, options: [...prev.options, { ...newOption }] }));
      setNewOption({ label: '', text: '' });
    }
  };

  const removeOption = (idx) => {
    setNewQuestion(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== idx) }));
  };

  const addQuestion = () => {
    if (newQuestion.question_text) {
      setCurrentTest(prev => ({ ...prev, questions: [...prev.questions, { ...newQuestion }] }));
      setNewQuestion({ question_type: 'MULTIPLE_CHOICE', question_text: '', order: newQuestion.order + 1, options: [], image: null, correct_answer: '' });
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeQuestion = (idx) => {
    setCurrentTest(prev => ({ ...prev, questions: prev.questions.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
     
      const formData = new FormData();
      formData.append('title', currentTest.title);
      formData.append('description', currentTest.description);
      formData.append('passage', currentTest.passage);

      const response = await axios.post('/api/reading/tests/create/', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      const testId = response.data.test_id;
      setCurrentTestId(testId);
      setTestCreated(true);

      
      for (let i = 0; i < currentTest.questions.length; i++) {
        const question = currentTest.questions[i];
        const questionFormData = new FormData();
        
        questionFormData.append('question_type', question.question_type);
        questionFormData.append('question_text', question.question_text);
        questionFormData.append('order', question.order);
        questionFormData.append('paragraph_ref', question.paragraph_ref || '');
        
        if (question.image && question.image instanceof File) {
          questionFormData.append('image', question.image);
        }
        
    
        questionFormData.append('options', JSON.stringify(question.options));
        
       
        if (question.correct_answer) {
          questionFormData.append('correct_answer', question.correct_answer);
        }

        await axios.post(`/api/reading/tests/${testId}/questions/add/`, questionFormData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        });
      }

      alert('Тест успешно создан со всеми вопросами!');
      setCurrentTest({ title: '', description: '', passage: '', questions: [] });
      setNewQuestion({ question_type: 'MULTIPLE_CHOICE', question_text: '', order: 1, options: [], image: null, correct_answer: '' });
      setCurrentTestId(null);
      setTestCreated(false);
      setLoading(false);
      fetchTests();
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error(err);
      alert('Ошибка при создании теста: ' + (err.response?.data?.error || err.message));
      setLoading(false);
    }
  };

  const handleActivate = (id) => {
    const token = localStorage.getItem('token');
    axios.post(`/api/reading/tests/${id}/activate/`, {}, { headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        fetchTests();
      })
      .catch(err => alert('Ошибка при активации теста'));
  };

  const handleDelete = (id) => {
 
    alert('Удаление теста пока не реализовано');
  };

  const activeTest = tests.find(t => t.is_active);

  const openEditTest = (idx) => {
    setEditTestIdx(idx);
    setEditTestData({...tests[idx]});
  };

  const closeEditTest = () => {
    setEditTestIdx(null); setEditTestData(null);
  };

  const openEditQuestion = (idx) => {
    setEditQuestionIdx(idx);
    setEditQuestionData({...currentTest.questions[idx]});
  };

  const closeEditQuestion = () => {
    setEditQuestionIdx(null); setEditQuestionData(null);
  };

  const handleTestUpdate = async () => {
    if (!editTestData) return;
    setLoading(true);
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('title', editTestData.title);
    formData.append('description', editTestData.description);
    formData.append('passage', editTestData.passage || '');
    try {
      await axios.patch(`/api/reading/tests/${editTestData.id}/`, formData, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
      closeEditTest();
      fetchTests();
    } catch (e) { alert('Ошибка при обновлении теста'); }
    setLoading(false);
  };

  const handleTestDelete = async (id) => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`/api/reading/tests/${id}/`, { headers: { Authorization: `Bearer ${token}` } });
      setShowDeleteTestId(null);
      fetchTests();
    } catch (e) { alert('Ошибка при удалении теста'); }
    setLoading(false);
  };

  const handleQuestionUpdate = async () => {
    if (!editQuestionData) return;
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      await axios.patch(`/api/reading/questions/${editQuestionData.id}/`, editQuestionData, { headers: { Authorization: `Bearer ${token}` } });
      closeEditQuestion();
      fetchTests();
    } catch (e) { alert('Ошибка при обновлении вопроса'); }
    setLoading(false);
  };

  const handleQuestionDelete = async (id) => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`/api/reading/questions/${id}/`, { headers: { Authorization: `Bearer ${token}` } });
      setShowDeleteQuestionIdx(null);
      fetchTests();
    } catch (e) { alert('Ошибка при удалении вопроса'); }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Управление Reading тестами (Admin)</h2>
      {activeTest && (
        <div className="mb-6 p-4 bg-green-100 border border-green-400 rounded">
          <span className="font-semibold">Текущий активный тест:</span> {activeTest.title}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-semibold">Название теста</label>
          <input
            type="text"
            name="title"
            value={currentTest.title}
            onChange={handleTestChange}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div>
          <label className="block font-semibold">Описание</label>
          <textarea
            name="description"
            value={currentTest.description}
            onChange={handleTestChange}
            className="w-full p-2 border rounded"
            rows="2"
          />
        </div>
        <div>
          <label className="block font-semibold">Текст (passage)</label>
          <textarea
            name="passage"
            value={currentTest.passage}
            onChange={handleTestChange}
            className="w-full p-2 border rounded"
            rows="6"
            required
          />
        </div>
        <div className="border-t pt-4 mt-4">
          <h3 className="font-bold mb-2">Добавление вопроса</h3>
          <select
            name="question_type"
            value={newQuestion.question_type}
            onChange={handleNewQuestionChange}
            className="w-full p-2 border rounded mb-2"
          >
            <option value="MULTIPLE_CHOICE">Multiple Choice</option>
            <option value="TRUE_FALSE_NOT_GIVEN">True / False / Not Given</option>
            <option value="MATCHING_HEADINGS">Matching Headings</option>
          </select>
          <input
            type="text"
            name="question_text"
            value={newQuestion.question_text}
            onChange={handleNewQuestionChange}
            placeholder="Текст вопроса"
            className="w-full p-2 border rounded mt-1"
          />
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="mt-1"
            ref={fileInputRef}
          />
          {newQuestion.image && (
            <img src={newQuestion.image} alt="Question image (Reading)" className="my-2 w-full max-w-xl rounded border" />
          )}
          {['MULTIPLE_CHOICE', 'TRUE_FALSE_NOT_GIVEN'].includes(newQuestion.question_type) && (
            <div className="mt-2">
              <label className="block font-semibold">Правильный ответ</label>
              {(newQuestion.options || TRUE_FALSE_OPTIONS).map((opt, idx) => (
                <label key={idx} className="mr-4">
                  <input
                    type="radio"
                    name="correct_answer"
                    value={opt.label}
                    checked={newQuestion.correct_answer === opt.label}
                    onChange={() => setNewQuestion(prev => ({ ...prev, correct_answer: opt.label }))}
                  /> {opt.label}
                </label>
              ))}
            </div>
          )}
          {newQuestion.question_type === 'MATCHING_HEADINGS' && (
            <div className="mt-2">
              <label className="block font-semibold">Правильный ответ (текст)</label>
              <input type="text" value={newQuestion.correct_answer || ''} onChange={e => setNewQuestion(prev => ({ ...prev, correct_answer: e.target.value }))} className="w-full p-2 border rounded" />
            </div>
          )}
          {newQuestion.question_type === 'MULTIPLE_CHOICE' && (
            <div className="mt-2">
              <label className="block font-semibold">Добавление варианта</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  name="label"
                  value={newOption.label}
                  onChange={handleNewOptionChange}
                  placeholder="Метка (например, A)"
                  className="w-1/4 p-2 border rounded"
                />
                <input
                  type="text"
                  name="text"
                  value={newOption.text}
                  onChange={handleNewOptionChange}
                  placeholder="Текст варианта"
                  className="w-3/4 p-2 border rounded"
                />
                <button type="button" onClick={addOption} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">Добавить вариант</button>
              </div>
              {newQuestion.options.length > 0 && (
                <ul className="mb-2">
                  {newQuestion.options.map((opt, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span>{opt.label}. {opt.text}</span>
                      <button type="button" onClick={() => removeOption(idx)} className="text-red-500">Удалить</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {newQuestion.question_type === 'TRUE_FALSE_NOT_GIVEN' && (
            <div className="mt-2">
              <label className="block font-semibold">Варианты ответа</label>
              <ul className="mb-2">
                {TRUE_FALSE_OPTIONS.map((opt, idx) => (
                  <li key={idx}>{opt.label}. {opt.text}</li>
                ))}
              </ul>
            </div>
          )}
          {newQuestion.question_type === 'MATCHING_HEADINGS' && (
            <div className="mt-2">
              <label className="block font-semibold">Варианты (только текст, метки будут сгенерированы автоматически)</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  name="text"
                  value={newOption.text}
                  onChange={handleNewOptionChange}
                  placeholder="Текст варианта"
                  className="w-3/4 p-2 border rounded"
                />
                <button type="button" onClick={() => {
                  if (newOption.text) {
                    setNewQuestion(prev => ({ ...prev, options: [...prev.options, { label: String.fromCharCode(65 + prev.options.length), text: newOption.text }] }));
                    setNewOption({ label: '', text: '' });
                  }
                }} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">Добавить вариант</button>
              </div>
              {newQuestion.options.length > 0 && (
                <ul className="mb-2">
                  {newQuestion.options.map((opt, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span>{opt.label}. {opt.text}</span>
                      <button type="button" onClick={() => removeOption(idx)} className="text-red-500">Удалить</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <button type="button" onClick={addQuestion} className="mt-2 bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">Добавить вопрос</button>
        </div>
        {currentTest.questions.length > 0 && (
          <div className="mt-6">
            <h3 className="font-bold mb-2">Список вопросов</h3>
            <ul className="space-y-2">
              {currentTest.questions.map((q, idx) => (
                <li key={idx} className="border p-2 rounded">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Вопрос {idx + 1}: {q.question_text}</span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => openEditQuestion(idx)} className="bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600">Редактировать</button>
                      <button type="button" onClick={() => removeQuestion(idx)} className="text-red-500">Удалить</button>
                    </div>
                  </div>
                  {q.image && (
                    <img src={q.image instanceof File ? URL.createObjectURL(q.image) : q.image} alt="Question preview" className="my-2 w-32 rounded border" />
                  )}
                  {q.options && q.options.length > 0 && (
                    <ul className="ml-4 mt-1 text-sm">
                      {q.options.map((opt, oidx) => (
                        <li key={oidx}>{opt.label}. {opt.text}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <button type="submit" disabled={loading || currentTest.questions.length === 0} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
          {loading ? "Отправка..." : "Сохранить тест"}
        </button>
      </form>
      {tests.length > 0 && (
        <div className="mt-6">
          <h3 className="font-bold">Список тестов</h3>
          <ul className="space-y-2">
            {tests.map((test, idx) => (
              <li key={test.id} className={`border p-2 rounded flex justify-between items-center ${test.is_active ? 'bg-green-100' : ''}`}>
                <div>
                  <p className="font-semibold">{test.title} {test.is_active && <span className="text-green-600">(Активен)</span>}</p>
                  <p className="text-sm text-gray-600">{test.description}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEditTest(idx)} className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600">Редактировать</button>
                  {!test.is_active && <button onClick={() => handleActivate(test.id)} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">Сделать активным</button>}
                  <button onClick={() => handleTestDelete(test.id)} className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700">Удалить</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {editTestIdx !== null && editTestData && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-lg">
            <h3 className="text-xl font-bold mb-4">Редактировать тест</h3>
            <input type="text" name="title" value={editTestData.title} onChange={e => setEditTestData({...editTestData, title: e.target.value})} className="w-full p-2 border rounded mb-2" />
            <textarea name="description" value={editTestData.description} onChange={e => setEditTestData({...editTestData, description: e.target.value})} className="w-full p-2 border rounded mb-2" rows="2" />
            <textarea name="passage" value={editTestData.passage || ''} onChange={e => setEditTestData({...editTestData, passage: e.target.value})} className="w-full p-2 border rounded mb-2" rows="4" placeholder="Текст (passage)" />
            <button onClick={handleTestUpdate} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mr-2">Сохранить</button>
            <button onClick={closeEditTest} className="bg-gray-300 px-4 py-2 rounded">Отмена</button>
          </div>
        </div>
      )}
      {editQuestionIdx !== null && editQuestionData && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-lg">
            <h3 className="text-xl font-bold mb-4">Редактировать вопрос</h3>
            <input type="text" name="question_text" value={editQuestionData.question_text} onChange={e => setEditQuestionData({...editQuestionData, question_text: e.target.value})} className="w-full p-2 border rounded mb-2" />
            {['MULTIPLE_CHOICE', 'TRUE_FALSE_NOT_GIVEN'].includes(editQuestionData.question_type) && (
              <div className="mt-2">
                <label className="block font-semibold">Правильный ответ</label>
                {(editQuestionData.options || TRUE_FALSE_OPTIONS).map((opt, idx) => (
                  <label key={idx} className="mr-4">
                    <input
                      type="radio"
                      name="edit_correct_answer"
                      value={opt.label}
                      checked={editQuestionData.correct_answer === opt.label}
                      onChange={() => setEditQuestionData(prev => ({ ...prev, correct_answer: opt.label }))}
                    /> {opt.label}
                  </label>
                ))}
              </div>
            )}
            {editQuestionData.question_type === 'MATCHING_HEADINGS' && (
              <div className="mt-2">
                <label className="block font-semibold">Правильный ответ (текст)</label>
                <input type="text" value={editQuestionData.correct_answer || ''} onChange={e => setEditQuestionData(prev => ({ ...prev, correct_answer: e.target.value }))} className="w-full p-2 border rounded" />
              </div>
            )}
            <input type="file" accept="image/*" onChange={e => setEditQuestionData(prev => ({ ...prev, image: e.target.files[0] }))} className="mt-2" />
            {editQuestionData.image && (
              <img src={editQuestionData.image instanceof File ? URL.createObjectURL(editQuestionData.image) : editQuestionData.image} alt="Question preview" className="my-2 w-32 rounded border" />
            )}
            <button onClick={handleQuestionUpdate} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mr-2">Сохранить</button>
            <button onClick={closeEditQuestion} className="bg-gray-300 px-4 py-2 rounded">Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReadingManagePage; 