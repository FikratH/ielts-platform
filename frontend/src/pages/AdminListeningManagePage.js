import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const TRUE_FALSE_OPTIONS = [
  { label: 'A', text: 'True' },
  { label: 'B', text: 'False' },
  { label: 'C', text: 'Not Given' },
];

const AdminListeningManagePage = () => {
  const [tests, setTests] = useState([]);
  const [currentTest, setCurrentTest] = useState({ title: '', description: '', questions: [] });
  const [audioFile, setAudioFile] = useState(null);
  const [newQuestion, setNewQuestion] = useState({ question_type: 'MULTIPLE_CHOICE', question_text: '', order: 1, options: [], image: null, correct_answer: '' });
  const [newOption, setNewOption] = useState({ label: '', text: '' });
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef();
  const audioInputRef = useRef();
  const [currentTestId, setCurrentTestId] = useState(null);
  const [testCreated, setTestCreated] = useState(false);

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = () => {
    const token = localStorage.getItem('token');
    axios.get('/api/listening/tests/', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(res => setTests(res.data))
      .catch(err => console.error(err));
  };

  const handleTestChange = (e) => {
    const { name, value } = e.target;
    setCurrentTest(prev => ({ ...prev, [name]: value }));
  };

  const handleAudioChange = (e) => {
    const file = e.target.files[0];
    if (file) setAudioFile(file);
  };

  const handleNewQuestionChange = (e) => {
    const { name, value } = e.target;
    let updated = { ...newQuestion, [name]: value };
    if (name === 'question_type') {
      if (value === 'TRUE_FALSE_NOT_GIVEN') {
        updated.options = TRUE_FALSE_OPTIONS;
        if (!updated.correct_answer) {
          updated.correct_answer = TRUE_FALSE_OPTIONS[0].text;
        }
      } else {
        updated.options = [];
      }
      updated.correct_answer = '';
    }
    setNewQuestion(updated);
  };

  const handleNewOptionChange = (e) => {
    const { name, value } = e.target;
    setNewOption(prev => ({ ...prev, [name]: value }));
  };

  const handleCorrectAnswerChange = (optionText) => {
    setNewQuestion(prev => ({ ...prev, correct_answer: optionText }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewQuestion(prev => ({ ...prev, image: file }));
    }
  };

  const addOption = () => {
    if (newOption.text) {
      const nextLabel = String.fromCharCode(65 + newQuestion.options.length);
      setNewQuestion(prev => ({ ...prev, options: [...prev.options, { label: nextLabel, text: newOption.text }] }));
      setNewOption({ label: '', text: '' });
    }
  };

  const removeOption = (idx) => {
    const removedOption = newQuestion.options[idx];
    const updatedOptions = newQuestion.options.filter((_, i) => i !== idx);
    
    const reorderedOptions = updatedOptions.map((opt, i) => ({
        ...opt,
        label: String.fromCharCode(65 + i)
    }));

    let updatedCorrectAnswer = newQuestion.correct_answer;
    if (newQuestion.correct_answer === removedOption.text) {
        updatedCorrectAnswer = '';
    }

    setNewQuestion(prev => ({ 
        ...prev, 
        options: reorderedOptions,
        correct_answer: updatedCorrectAnswer
    }));
  };

  const addQuestion = () => {
    if (newQuestion.question_text && (newQuestion.question_type !== 'MULTIPLE_CHOICE' || newQuestion.correct_answer)) {
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
      if (audioFile) formData.append('audio_file', audioFile);

      const response = await axios.post('/api/listening/tests/create/', formData, {
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
        
        if (question.image && question.image instanceof File) {
          questionFormData.append('image', question.image);
        }
        
        questionFormData.append('options', JSON.stringify(question.options));
        
        if (question.correct_answer) {
          questionFormData.append('correct_answer', question.correct_answer);
        }

        await axios.post(`/api/listening/tests/${testId}/questions/add/`, questionFormData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        });
      }

      alert('Тест успешно создан со всеми вопросами!');
      setCurrentTest({ title: '', description: '', questions: [] });
      setAudioFile(null);
      setNewQuestion({ question_type: 'MULTIPLE_CHOICE', question_text: '', order: 1, options: [], image: null, correct_answer: '' });
      setCurrentTestId(null);
      setTestCreated(false);
      setLoading(false);
      fetchTests();
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (audioInputRef.current) audioInputRef.current.value = '';
    } catch (err) {
      console.error(err);
      alert('Ошибка при создании теста: ' + (err.response?.data?.error || err.message));
      setLoading(false);
    }
  };

  const handleActivate = (id) => {
    const token = localStorage.getItem('token');
    axios.post(`/api/listening/tests/${id}/activate/`, {}, { headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        fetchTests();
      })
      .catch(err => alert('Ошибка при активации теста'));
  };

  const activeTest = tests.find(t => t.is_active);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Управление Listening тестами (Admin)</h2>
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
          <label className="block font-semibold">Аудиофайл (mp3, wav)</label>
          <input
            type="file"
            accept="audio/*"
            onChange={handleAudioChange}
            ref={audioInputRef}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div>
          <label className="block font-semibold">Вопросы</label>
          <div className="space-y-2">
            {currentTest.questions.map((q, idx) => (
              <div key={idx} className="border p-2 rounded flex items-center justify-between">
                <div>
                  <span className="font-semibold">Q{q.order}:</span> {q.question_text}
                </div>
                <button type="button" onClick={() => removeQuestion(idx)} className="text-red-600 font-bold">Удалить</button>
              </div>
            ))}
          </div>
        </div>
        <div className="border p-4 rounded bg-gray-50">
          <h4 className="font-semibold mb-2">Добавить вопрос</h4>
          <div className="mb-2">
            <label className="block">Тип вопроса</label>
            <select name="question_type" value={newQuestion.question_type} onChange={handleNewQuestionChange} className="w-full p-2 border rounded">
              <option value="MULTIPLE_CHOICE">Multiple Choice</option>
              <option value="FILL_IN_THE_BLANK">Fill in the Blank</option>
              <option value="TRUE_FALSE_NOT_GIVEN">True/False/Not Given</option>
            </select>
          </div>
          <div className="mb-2">
            <label className="block">Текст вопроса</label>
            <input type="text" name="question_text" value={newQuestion.question_text} onChange={handleNewQuestionChange} className="w-full p-2 border rounded" />
          </div>
          <div className="mb-2">
            <label className="block">Номер вопроса (Order)</label>
            <input type="number" name="order" value={newQuestion.order} onChange={handleNewQuestionChange} className="w-full p-2 border rounded" />
          </div>

          {newQuestion.question_type === 'MULTIPLE_CHOICE' && (
            <div className="mb-2">
              <label className="block">Варианты ответа (Отметьте правильный)</label>
              <div className="space-y-2">
                {newQuestion.options.map((opt, idx) => (
                  <div key={idx} className="flex items-center space-x-2">
                    <input 
                      type="radio" 
                      name={`correct_answer_${newQuestion.order}`} 
                      checked={newQuestion.correct_answer === opt.text}
                      onChange={() => handleCorrectAnswerChange(opt.text)}
                      className="form-radio h-4 w-4"
                    />
                    <span>{opt.label}. {opt.text}</span>
                    <button type="button" onClick={() => removeOption(idx)} className="text-red-500 hover:text-red-700">Удалить</button>
                  </div>
                ))}
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <input
                  type="text"
                  name="text"
                  placeholder="Текст ответа"
                  value={newOption.text}
                  onChange={handleNewOptionChange}
                  className="w-full p-2 border rounded"
                />
                <button type="button" onClick={addOption} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Добавить</button>
              </div>
            </div>
          )}

          {newQuestion.question_type === 'TRUE_FALSE_NOT_GIVEN' && (
             <div className="mb-2">
                <label className="block">Правильный ответ</label>
                <div className="flex flex-col space-y-1">
                    {TRUE_FALSE_OPTIONS.map(opt => (
                         <label key={opt.text} className="flex items-center space-x-2">
                            <input 
                                type="radio" 
                                name={`correct_answer_tf_${newQuestion.order}`}
                                value={opt.text}
                                checked={newQuestion.correct_answer === opt.text}
                                onChange={() => handleCorrectAnswerChange(opt.text)}
                                className="form-radio h-4 w-4"
                            />
                            <span>{opt.text}</span>
                        </label>
                    ))}
                </div>
             </div>
          )}

          {newQuestion.question_type === 'FILL_IN_THE_BLANK' && (
            <div className="mb-2">
              <label className="block">Правильный ответ (или ответы через ;)</label>
              <input
                type="text"
                name="correct_answer"
                value={newQuestion.correct_answer}
                onChange={handleNewQuestionChange}
                className="w-full p-2 border rounded"
                placeholder="Введите правильный ответ"
              />
            </div>
          )}

          <div className="mb-2">
            <label className="block">Изображение к вопросу (опционально)</label>
            <input type="file" accept="image/*" onChange={handleImageChange} ref={fileInputRef} className="w-full" />
            {newQuestion.image && <span className="text-sm">{newQuestion.image.name}</span>}
          </div>
          <button
            type="button"
            onClick={addQuestion}
            className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
            disabled={!newQuestion.question_text || (newQuestion.question_type !== 'FILL_IN_THE_BLANK' && !newQuestion.correct_answer)}
          >
            Добавить вопрос в тест
          </button>
        </div>
        <button type="submit" className="w-full bg-indigo-600 text-white p-3 rounded hover:bg-indigo-700 disabled:bg-gray-400" disabled={loading}>
          {loading ? 'Создание...' : 'Создать и сохранить тест'}
        </button>
      </form>
      <h3 className="mt-8 text-xl font-bold">Список тестов</h3>
      <ul className="space-y-2 mt-2">
        {tests.map(test => (
          <li key={test.id} className="border p-2 rounded flex items-center justify-between">
            <div>
              <span className="font-semibold">{test.title}</span> <span className="text-gray-500">({test.description})</span>
              {test.is_active && <span className="ml-2 text-green-600 font-bold">[Активный]</span>}
            </div>
            <button onClick={() => handleActivate(test.id)} className="bg-green-600 text-white px-3 py-1 rounded">Активировать</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AdminListeningManagePage; 