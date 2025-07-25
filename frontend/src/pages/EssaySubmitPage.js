import React, { useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

const EssaySubmitPage = () => {
  const [taskType, setTaskType] = useState('task1');
  const [essays, setEssays] = useState({ task1: '', task2: '' });
  const [wordCount, setWordCount] = useState(0);
  const [result, setResult] = useState(null);
  const navigate = useNavigate();

  const handleEssayChange = (e) => {
    const newEssays = { ...essays, [taskType]: e.target.value };
    setEssays(newEssays);
    setWordCount(e.target.value.trim().split(/\s+/).filter(Boolean).length);
  };

  const handleSubmit = async () => {
    try {
      const response = await api.post(
        '/essay/',
        {
          task_type: taskType,
          question_text: '',
          submitted_text: essays[taskType],
        }
      );
      setResult(response.data);
      alert(`Essay for ${taskType.toUpperCase()} submitted successfully.`