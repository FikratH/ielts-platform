import React, { useState } from 'react';
import axios from 'axios';
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
    const token = localStorage.getItem('token');
    try {
      const response = await axios.post(
        'http://127.0.0.1:8000/api/essay/',
        {
          task_type: taskType,
          question_text: '',
          submitted_text: essays[taskType],
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setResult(response.data);
      alert(`Essay for ${taskType.toUpperCase()} submitted successfully.`);
      navigate('/dashboard');
    } catch (error) {
      console.error('Submission error:', error);
      alert('Error submitting essay.');
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: '50px auto', textAlign: 'center' }}>
      <h2>Submit Essay</h2>
      <select
        value={taskType}
        onChange={(e) => {
          setTaskType(e.target.value);
          setWordCount(essays[e.target.value].trim().split(/\s+/).filter(Boolean).length);
          setResult(null);
        }}
        style={{ padding: 10, marginBottom: 10, fontSize: '16px' }}
      >
        <option value="task1">Task 1</option>
        <option value="task2">Task 2</option>
      </select>

      <textarea
        value={essays[taskType]}
        onChange={handleEssayChange}
        placeholder="Write your essay here..."
        style={{
          width: '100%',
          height: '200px',
          resize: 'none',
          fontSize: '16px',
          padding: 10,
          marginBottom: 10,
        }}
      />

      <div style={{ textAlign: 'left', marginBottom: 10 }}>
        <strong>Word count:</strong> {wordCount}
      </div>

      <button
        onClick={handleSubmit}
        style={{ padding: 10, width: '100%', fontSize: '16px' }}
      >
        Submit {taskType.toUpperCase()}
      </button>

      {result && (
        <div style={{ textAlign: 'left', marginTop: 30 }}>
          <h3>Feedback</h3>
          <p><strong>Task Response:</strong> {result.score_task}</p>
          <p><strong>Coherence and Cohesion:</strong> {result.score_coherence}</p>
          <p><strong>Lexical Resource:</strong> {result.score_lexical}</p>
          <p><strong>Grammatical Range and Accuracy:</strong> {result.score_grammar}</p>
          <p><strong>Overall Band:</strong> {result.overall_band}</p>
          <div style={{ whiteSpace: 'pre-wrap', marginTop: 10 }}>
            <strong>Full Feedback:</strong>
            <br />
            {result.feedback}
          </div>
        </div>
      )}
    </div>
  );
};

export default EssaySubmitPage;
