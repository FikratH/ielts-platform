import React, { useState, useEffect } from 'react';

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

const QuestionForm = ({ onSubmit, initialOrder = 1 }) => {
  const [question, setQuestion] = useState({
    question_type: QUESTION_TYPES.MULTIPLE_CHOICE,
    question_text: '',
    order: initialOrder,
    options: [],
    image: null,
    correct_answer: ''
  });
  const [newOptionText, setNewOptionText] = useState('');
  const fileInputRef = React.useRef();

  useEffect(() => {
    setQuestion(prev => ({ ...prev, order: initialOrder }));
  }, [initialOrder]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setQuestion(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'question_type') {
        updated.options = value === QUESTION_TYPES.TRUE_FALSE_NOT_GIVEN ? TRUE_FALSE_OPTIONS : [];
        updated.correct_answer = '';
      }
      return updated;
    });
  };
  
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) setQuestion(prev => ({ ...prev, image: file }));
  };

  const addOption = () => {
    if (newOptionText) {
      const nextLabel = String.fromCharCode(65 + question.options.length);
      const newOpt = { label: nextLabel, text: newOptionText };
      setQuestion(prev => ({ ...prev, options: [...prev.options, newOpt] }));
      setNewOptionText('');
    }
  };
  
  const removeOption = (idx) => {
    const removedOption = question.options[idx];
    const updatedOptions = question.options.filter((_, i) => i !== idx).map((opt, i) => ({
      ...opt,
      label: String.fromCharCode(65 + i)
    }));
    setQuestion(prev => ({
      ...prev,
      options: updatedOptions,
      correct_answer: prev.correct_answer === removedOption.text ? '' : prev.correct_answer
    }));
  };
  
  const handleCorrectAnswerChange = (optionText) => {
    setQuestion(prev => ({ ...prev, correct_answer: optionText }));
  };

  const handleAddQuestion = () => {
    if (!question.question_text) {
        alert("Текст вопроса не может быть пустым.");
        return;
    }
    if (question.question_type !== QUESTION_TYPES.FILL_IN_THE_BLANK && !question.correct_answer) {
        alert("Выберите или укажите правильный ответ.");
        return;
    }
    onSubmit(question);
    // Reset form for the next question
    setQuestion({
      question_type: QUESTION_TYPES.MULTIPLE_CHOICE,
      question_text: '',
      order: initialOrder + 1, // Assume order increments
      options: [],
      image: null,
      correct_answer: ''
    });
    setNewOptionText('');
    if (fileInputRef.current) fileInputRef.current.value = null;
  };

  return (
    <div className="border p-4 rounded bg-gray-50">
      <h4 className="font-semibold mb-2">Добавить вопрос</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
            <label className="block text-sm font-medium">Тип вопроса</label>
            <select name="question_type" value={question.question_type} onChange={handleChange} className="w-full p-2 border rounded">
              <option value={QUESTION_TYPES.MULTIPLE_CHOICE}>Multiple Choice</option>
              <option value={QUESTION_TYPES.FILL_IN_THE_BLANK}>Fill in the Blank</option>
              <option value={QUESTION_TYPES.TRUE_FALSE_NOT_GIVEN}>True/False/Not Given</option>
            </select>
        </div>
        <div>
            <label className="block text-sm font-medium">Номер вопроса (Order)</label>
            <input type="number" name="order" value={question.order} onChange={handleChange} className="w-full p-2 border rounded" />
        </div>
      </div>
      <div className="mt-2">
        <label className="block text-sm font-medium">Текст вопроса</label>
        <input type="text" name="question_text" value={question.question_text} onChange={handleChange} className="w-full p-2 border rounded" />
      </div>

      {question.question_type === QUESTION_TYPES.MULTIPLE_CHOICE && (
        <div className="mt-2">
          <label className="block text-sm font-medium">Варианты ответа (Отметьте правильный)</label>
          <div className="space-y-1 mt-1">
            {question.options.map((opt, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <input type="radio" name={`correct_answer_${question.order}`} checked={question.correct_answer === opt.text} onChange={() => handleCorrectAnswerChange(opt.text)} />
                <span>{opt.label}. {opt.text}</span>
                <button type="button" onClick={() => removeOption(idx)} className="text-red-500 text-xs">Удалить</button>
              </div>
            ))}
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <input type="text" placeholder="Новый вариант ответа" value={newOptionText} onChange={(e) => setNewOptionText(e.target.value)} className="w-full p-2 border rounded" />
            <button type="button" onClick={addOption} className="bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 text-sm">Добавить</button>
          </div>
        </div>
      )}

      {question.question_type === QUESTION_TYPES.TRUE_FALSE_NOT_GIVEN && (
         <div className="mt-2">
            <label className="block text-sm font-medium">Правильный ответ</label>
            {TRUE_FALSE_OPTIONS.map(opt => (
                 <label key={opt.text} className="flex items-center space-x-2">
                    <input type="radio" name={`correct_answer_tf_${question.order}`} value={opt.text} checked={question.correct_answer === opt.text} onChange={() => handleCorrectAnswerChange(opt.text)} />
                    <span>{opt.text}</span>
                </label>
            ))}
         </div>
      )}
      {question.question_type === QUESTION_TYPES.FILL_IN_THE_BLANK && (
        <div className="mt-2">
          <label className="block text-sm font-medium">Правильный ответ</label>
          <input type="text" name="correct_answer" value={question.correct_answer} onChange={handleChange} className="w-full p-2 border rounded" />
        </div>
      )}
      
      <div className="mt-2">
          <label className="block text-sm font-medium">Изображение (опционально)</label>
          <input type="file" accept="image/*" onChange={handleImageChange} ref={fileInputRef} className="w-full text-sm" />
      </div>
      
      <button type="button" onClick={handleAddQuestion} className="w-full mt-4 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
        Добавить вопрос в тест
      </button>
    </div>
  );
};

export default QuestionForm; 