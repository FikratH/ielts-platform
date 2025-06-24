import React, { useState, useEffect, useRef } from 'react';

const QUESTION_TYPES = {
  MULTIPLE_CHOICE: 'Multiple Choice',
  SHORT_ANSWER: 'Short Answer',
  TRUE_FALSE: 'True/False',
};

const TRUE_FALSE_OPTIONS = [
  { label: 'TRUE', text: 'Верно' },
  { label: 'FALSE', text: 'Неверно' },
];

const QuestionForm = ({ onSubmit, onUpdate, initialData, initialOrder }) => {
  const [questionType, setQuestionType] = useState(QUESTION_TYPES.MULTIPLE_CHOICE);
  const [questionText, setQuestionText] = useState('');
  const [order, setOrder] = useState(initialOrder);
  const [options, setOptions] = useState([]);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [image, setImage] = useState(null);
  const [newOption, setNewOption] = useState('');
  const isEditing = !!initialData;
  const fileInputRef = useRef(null);

  useEffect(() => {
    setOrder(initialOrder);
  }, [initialOrder]);

  useEffect(() => {
    if (initialData) {
      setQuestionType(initialData.question_type || QUESTION_TYPES.MULTIPLE_CHOICE);
      setQuestionText(initialData.question_text || '');
      setOrder(initialData.order || initialOrder);
      setOptions(initialData.options || []);
      setCorrectAnswer(initialData.correct_answer || '');
      setImage(null);
      if(fileInputRef.current) fileInputRef.current.value = "";
    } else {
      resetForm();
    }
  }, [initialData, initialOrder]);

  const resetForm = () => {
    setQuestionType(QUESTION_TYPES.MULTIPLE_CHOICE);
    setQuestionText('');
    setOrder(initialOrder);
    setOptions([]);
    setCorrectAnswer('');
    setImage(null);
    setNewOption('');
    if(fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleQuestionTypeChange = (e) => {
    const newType = e.target.value;
    setQuestionType(newType);
    if (newType === QUESTION_TYPES.TRUE_FALSE) {
      setOptions(TRUE_FALSE_OPTIONS);
      setCorrectAnswer('');
    } else {
      setOptions([]);
    }
  };

  const handleAddOption = () => {
    if (newOption.trim()) {
      setOptions([...options, { label: String.fromCharCode(65 + options.length), text: newOption.trim() }]);
      setNewOption('');
    }
  };

  const handleRemoveOption = (index) => {
    const newOptions = options.filter((_, i) => i !== index);
    // Re-label options
    setOptions(newOptions.map((opt, i) => ({ ...opt, label: String.fromCharCode(65 + i) })));
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const questionData = {
      question_type: questionType,
      question_text: questionText,
      order,
      options: questionType === QUESTION_TYPES.TRUE_FALSE ? [] : options, // Не сохраняем опции для True/False
      correct_answer: correctAnswer,
    };

    if (image) {
      questionData.image = image;
    }
    
    if (isEditing) {
      onUpdate({ ...initialData, ...questionData });
    } else {
      onSubmit(questionData);
      resetForm();
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) setImage(file);
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4 p-4 border rounded-lg bg-gray-50 mt-4">
      <h4 className="font-semibold text-lg">{isEditing ? 'Редактировать вопрос' : 'Добавить новый вопрос'}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Тип вопроса</label>
          <select name="question_type" value={questionType} onChange={handleQuestionTypeChange} className="w-full p-2 border rounded">
            <option value={QUESTION_TYPES.MULTIPLE_CHOICE}>Выбор из нескольких</option>
            <option value={QUESTION_TYPES.SHORT_ANSWER}>Краткий ответ</option>
            <option value={QUESTION_TYPES.TRUE_FALSE}>Верно/Неверно</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Номер вопроса (Порядок)</label>
          <input type="number" name="order" value={order} onChange={(e) => setOrder(e.target.value)} className="w-full p-2 border rounded" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium">Текст вопроса</label>
        <input type="text" name="question_text" value={questionText} onChange={(e) => setQuestionText(e.target.value)} className="w-full p-2 border rounded" />
      </div>

      {questionType === QUESTION_TYPES.MULTIPLE_CHOICE && (
        <div>
          <label className="block text-sm font-medium">Варианты ответа (Отметьте правильный)</label>
          <div className="space-y-1 mt-1">
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <input type="radio" name={`correct_answer_${order}`} checked={correctAnswer === opt.text} onChange={() => setCorrectAnswer(opt.text)} />
                <span>{opt.label}. {opt.text}</span>
                <button type="button" onClick={() => handleRemoveOption(idx)} className="text-red-500 text-xs">Удалить</button>
              </div>
            ))}
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <input type="text" placeholder="Новый вариант ответа" value={newOption} onChange={(e) => setNewOption(e.target.value)} className="w-full p-2 border rounded" />
            <button type="button" onClick={handleAddOption} className="bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 text-sm">Добавить</button>
          </div>
        </div>
      )}
      
      {questionType === QUESTION_TYPES.TRUE_FALSE && (
        <div>
          <label className="block text-sm font-medium">Правильный ответ</label>
          {options.map(opt => (
            <label key={opt.text} className="flex items-center space-x-2">
              <input type="radio" name={`correct_answer_${order}`} value={opt.text} checked={correctAnswer === opt.text} onChange={() => setCorrectAnswer(opt.text)} />
              <span>{opt.text}</span>
            </label>
          ))}
        </div>
      )}

      {questionType === QUESTION_TYPES.SHORT_ANSWER && (
        <div>
          <label className="block text-sm font-medium">Правильный ответ</label>
          <input type="text" name="correct_answer" value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} className="w-full p-2 border rounded" placeholder="Введите правильный ответ..." />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium">Изображение (опционально)</label>
        <input type="file" accept="image/*" onChange={handleImageChange} ref={fileInputRef} className="w-full text-sm" />
      </div>
      
      <button type="submit" className="w-full bg-green-600 text-white p-2 rounded-lg hover:bg-green-700">
        {isEditing ? 'Обновить вопрос' : 'Добавить вопрос в тест'}
      </button>
      {isEditing && (
        <button type="button" onClick={() => onUpdate(null)} className="w-full bg-gray-500 text-white p-2 rounded-lg hover:bg-gray-600 mt-2">
          Отмена
        </button>
      )}
    </form>
  );
};

export default QuestionForm; 