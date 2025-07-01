import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Button, Paper, Typography, Box, IconButton, TextField, 
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel,
  Grid, Card, CardContent, Chip, Divider, Alert, Snackbar, CircularProgress
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import ImageIcon from '@mui/icons-material/Image';
import SaveIcon from '@mui/icons-material/Save';
import UploadIcon from '@mui/icons-material/Upload';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { auth } from '../firebase-config';

// IELTS Listening question types
const QUESTION_TYPES = [
  { value: 'gap_fill', label: 'Fill in the blanks' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'matching', label: 'Matching' },
  { value: 'map_diagram', label: 'Map/Diagram' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'table', label: 'Table Completion' },
  { value: 'form', label: 'Form Completion' },
  { value: 'true_false', label: 'True/False' },
  { value: 'multiple_response', label: 'Multiple Response' },
];

const initialTest = {
  title: 'New Listening Test',
  is_active: false,
  parts: [
    {
      id: 'part-1',
      title: 'Section 1',
      audio: '',
      image: '',
      questions: [
        { 
          id: 'q-1', 
          type: 'multiple_choice', 
          text: 'What is the main topic of the conversation?', 
          options: [
            { text: 'Weather', image: '' },
            { text: 'Transportation', image: '' },
            { text: 'Shopping', image: '' },
            { text: 'Entertainment', image: '' }
          ],
          answer: 2,
          image: '',
          audio_start: 0,
          audio_end: 30
        },
      ],
    },
  ],
};

function normalizeTestFromAPI(apiTest) {
  return {
    ...apiTest,
    parts: (apiTest.parts || []).map((part, idx) => ({
      ...part,
      id: part.id && typeof part.id === 'string' ? part.id : `part-${part.part_number || Math.random()}`,
      title: part.title || `Part ${part.part_number || idx + 1}`,
      questions: Array.isArray(part.questions) ? part.questions.map(q => {
        const normalizedType = q.type || q.question_type || '';
        return {
          ...q,
          id: q.id && typeof q.id === 'string' ? q.id : `q-${q.order || Math.random()}`,
          type: normalizedType,
          text: q.text || q.question_text || '',
          options: Array.isArray(q.options)
            ? q.options.map(opt => typeof opt === 'string' ? { text: opt, image: '' } : opt)
            : [],
          correct_answers: q.correct_answers || (q.extra_data && q.extra_data.correct_answers) || [],
          extra_data: q.extra_data || {},
          table: q.table || (normalizedType === 'table' && q.extra_data && q.extra_data.table) || undefined,
          fields: q.fields || (q.extra_data && q.extra_data.fields) || undefined,
          gaps: Array.isArray(q.gaps) ? q.gaps : (q.extra_data && Array.isArray(q.extra_data.gaps) ? q.extra_data.gaps : []),
          left: q.left || (q.extra_data && q.extra_data.left) || undefined,
          right: q.right || (q.extra_data && q.extra_data.right) || undefined,
          answers: q.answers || (q.extra_data && q.extra_data.answers) || undefined,
          points: q.points || (q.extra_data && q.extra_data.points) || undefined,
          answer: q.answer !== undefined ? q.answer : (q.extra_data && q.extra_data.answer) || '',
        };
      }) : [],
    }))
  };
}

const AdminListeningTestBuilder = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(initialTest);
  const [editingPart, setEditingPart] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPart, setPreviewPart] = useState(0);
  const [previewAnswers, setPreviewAnswers] = useState({});
  const [previewAudioPlaying, setPreviewAudioPlaying] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [loading, setLoading] = useState(false);
  const [isNewTest, setIsNewTest] = useState(!testId);

  // Load existing test if testId is provided
  useEffect(() => {
    if (testId && testId !== 'new') {
      loadExistingTest();
    }
  }, [testId]);

  const loadExistingTest = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/listening-tests/${testId}/`);
      if (response.ok) {
        const loadedTest = await response.json();
        setTest(normalizeTestFromAPI(loadedTest));
        setIsNewTest(false);
      } else {
        setSnackbar({ open: true, message: 'Failed to load test', severity: 'error' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Network error', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Add section
  const addSection = () => {
    setTest({
      ...test,
      parts: [
        ...test.parts,
        {
          id: `part-${Date.now()}`,
          title: `Section ${test.parts.length + 1}`,
          audio: '',
          image: '',
          questions: [],
        },
      ],
    });
  };

  // Remove section
  const removeSection = (idx) => {
    const parts = test.parts.filter((_, i) => i !== idx);
    setTest({ ...test, parts });
  };

  // Add question
  const addQuestion = (partIdx) => {
    const parts = [...test.parts];
    parts[partIdx].questions.push({
      id: `q-${Date.now()}`,
      type: 'multiple_choice',
      text: '',
      options: [
        { text: '', image: '' },
        { text: '', image: '' },
        { text: '', image: '' },
        { text: '', image: '' }
      ],
      answer: 0,
      image: '',
      audio_start: 0,
      audio_end: 30
    });
    setTest({ ...test, parts });
  };

  // Remove question
  const removeQuestion = (partIdx, qIdx) => {
    const parts = [...test.parts];
    parts[partIdx].questions = parts[partIdx].questions.filter((_, i) => i !== qIdx);
    setTest({ ...test, parts });
  };

  // Update part
  const updatePart = (partIdx, updates) => {
    const parts = [...test.parts];
    parts[partIdx] = { ...parts[partIdx], ...updates };
    setTest({ ...test, parts });
  };

  // Update question
  const updateQuestion = (partIdx, qIdx, updates) => {
    const parts = [...test.parts];
    parts[partIdx].questions[qIdx] = { ...parts[partIdx].questions[qIdx], ...updates };
    setTest({ ...test, parts });
  };

  // Handle file upload
  const handleFileUpload = async (file, type, partIdx, qIdx = null) => {
    if (type === 'audio') {
      // Upload audio file to backend
      const formData = new FormData();
      formData.append('audio', file);
      try {
        // Get Firebase token for Authorization
        let idToken = null;
        if (auth.currentUser) {
          idToken = await auth.currentUser.getIdToken();
        }
        if (!idToken) {
          alert('Вы не авторизованы как админ. Перезайдите в систему.');
          return;
        }
        const response = await fetch('/api/admin/audio/upload/', {
          method: 'POST',
          body: formData,
          headers: {
            'Authorization': `Bearer ${idToken}`
          },
        });
        const data = await response.json();
        if (data.success && data.file_url) {
          updatePart(partIdx, { audio: data.file_url });
        } else {
          alert('Ошибка загрузки аудио: ' + (data.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Ошибка загрузки аудио: ' + err.message);
      }
    } else {
      // Старое поведение для изображений и др.
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileData = e.target.result;
        if (qIdx !== null) {
          updateQuestion(partIdx, qIdx, { [type]: fileData });
        } else {
          updatePart(partIdx, { [type]: fileData });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Render question editor
  const renderQuestionEditor = (question, partIdx, qIdx) => {
    const updateQ = (updates) => updateQuestion(partIdx, qIdx, updates);
    const handleTypeChange = (e) => {
      const newType = e.target.value;
      // Сброс специфичных полей при смене типа
      const base = { type: newType, text: '', image: '', audio_start: 0, audio_end: 30 };
      if (newType === 'multiple_choice') {
        base.options = [{ text: '', image: '' }, { text: '', image: '' }];
        base.answer = 0;
      }
      if (newType === 'matching') {
        base.left = [''];
        base.right = [''];
        base.answers = [];
      }
      if (newType === 'map_diagram') {
        base.image = '';
        base.points = [];
      }
      if (newType === 'table') {
        base.table = {
          rows: 2,
          cols: 2,
          cells: [
            [ { text: '', isAnswer: false, answer: '' }, { text: '', isAnswer: false, answer: '' } ],
            [ { text: '', isAnswer: false, answer: '' }, { text: '', isAnswer: false, answer: '' } ]
          ]
        };
      }
      if (newType === 'form') {
        base.fields = [{ label: '', answer: '' }];
      }
      if (newType === 'sentence_completion') {
        base.text = '';
        base.gaps = [];
      }
      if ([
        'summary_completion',
        'note_completion',
        'flow_chart'
      ].includes(newType)) {
        base.text = '';
        base.gaps = [];
      }
      if (newType === 'short_answer') {
        base.text = '';
        base.answer = '';
      }
      if (newType === 'true_false') {
        base.text = '';
        base.answer = '';
      }
      updateQ(base);
    };

    // Универсальный блок для всех типов вопросов
    const universalFields = <>
      <TextField
        fullWidth
        label="Header (optional)"
        value={question.header || ''}
        onChange={e => updateQ({ header: e.target.value })}
        sx={{ mb: 2 }}
      />
      <TextField
        fullWidth
        label="Instruction (optional)"
        value={question.instruction || ''}
        onChange={e => updateQ({ instruction: e.target.value })}
        sx={{ mb: 2 }}
      />
      <TextField
        fullWidth
        multiline
        rows={question.type === 'gap_fill' ? 4 : 2}
        label={question.type === 'gap_fill' ? 'Text with gaps' : 'Question Text'}
        value={question.text || ''}
        onChange={e => updateQ({ text: e.target.value })}
        sx={{ mb: 2 }}
      />
    </>;

    // Далее — только специфичные для типа поля (варианты, таблицы и т.д.)
    if (question.type === 'multiple_choice') {
      const safeOptions = Array.isArray(question.options) ? question.options : [];
      return (
        <Dialog open={!!editingQuestion} onClose={() => setEditingQuestion(null)} maxWidth="md" fullWidth>
          <DialogTitle>Edit Multiple Choice Question</DialogTitle>
          <DialogContent>
            {universalFields}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Question Type</InputLabel>
              <Select value={question.type} label="Question Type" onChange={handleTypeChange}>
                {QUESTION_TYPES.map(type => (
                  <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={5}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Question Text"
                  value={question.text}
                  onChange={e => updateQ({ text: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={7}>
                <Typography variant="subtitle2" gutterBottom>Options:</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {safeOptions.length > 0 ? safeOptions.map((option, idx) => (
                    <Box display="flex" alignItems="center" gap={1}>
                      <TextField
                        label="Label"
                        value={option.label || String.fromCharCode(65 + idx)}
                        onChange={e => {
                          const newOptions = [...safeOptions];
                          newOptions[idx].label = e.target.value;
                          updateQ({ options: newOptions });
                        }}
                        size="small"
                        sx={{ width: 60 }}
                      />
                      <TextField
                        label={`Option ${idx + 1}`}
                        value={option.text}
                        onChange={e => {
                          const newOptions = [...safeOptions];
                          newOptions[idx].text = e.target.value;
                          updateQ({ options: newOptions });
                        }}
                        size="small"
                        sx={{ flex: 2 }}
                      />
                      {option.image && (
                        <img src={option.image} alt="option" style={{ maxWidth: 40, maxHeight: 40, marginLeft: 4, borderRadius: 4, border: '1px solid #ccc' }} />
                      )}
                      <Button
                        variant={question.answer === idx ? 'contained' : 'outlined'}
                        color="success"
                        size="small"
                        onClick={() => updateQ({ answer: idx })}
                        sx={{ minWidth: 90 }}
                      >
                        Correct
                      </Button>
                      <IconButton onClick={() => {
                        const newOptions = safeOptions.filter((_, i) => i !== idx);
                        updateQ({ options: newOptions });
                      }} size="small"><DeleteIcon /></IconButton>
                    </Box>
                  )) : <Typography color="text.secondary">No options yet</Typography>}
                </Box>
                <Button size="small" onClick={() => updateQ({ options: [...safeOptions, { text: '', image: '' }] })} startIcon={<AddIcon />} sx={{ mt: 2 }}>Add Option</Button>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditingQuestion(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      );
    }

    if (question.type === 'matching') {
      return (
        <Dialog open={!!editingQuestion} onClose={() => setEditingQuestion(null)} maxWidth="md" fullWidth>
          <DialogTitle>Edit Matching Question</DialogTitle>
          <DialogContent>
            {universalFields}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Question Type</InputLabel>
              <Select value={question.type} label="Question Type" onChange={handleTypeChange}>
                {QUESTION_TYPES.map(type => (
                  <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Instruction (optional)"
                  value={question.text}
                  onChange={e => updateQ({ text: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" gutterBottom>Questions (left):</Typography>
                {Array.isArray(question.left) && question.left.length > 0 ? question.left.map((item, idx) => (
                  <Box key={idx} display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
                    <TextField
                      label={`Q${idx + 1}`}
                      value={item}
                      onChange={e => {
                        const newLeft = [...question.left];
                        newLeft[idx] = e.target.value;
                        updateQ({ left: newLeft });
                      }}
                      size="small"
                      sx={{ flex: 2 }}
                    />
                    <IconButton onClick={() => {
                      const newLeft = question.left.filter((_, i) => i !== idx);
                      // Удаляем и соответствующую пару в answers
                      const newAnswers = (question.answers || []).filter((_, i) => i !== idx);
                      updateQ({ left: newLeft, answers: newAnswers });
                    }} size="small"><DeleteIcon /></IconButton>
                  </Box>
                )) : <Typography color="text.secondary">No questions yet</Typography>}
                <Button size="small" onClick={() => updateQ({ left: [...(question.left || []), ''] })} startIcon={<AddIcon />}>Add Question</Button>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" gutterBottom>Options (right):</Typography>
                {Array.isArray(question.right) && question.right.length > 0 ? question.right.map((item, idx) => (
                  <Box key={idx} display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
                    <TextField
                      label={`Option ${idx + 1}`}
                      value={item}
                      onChange={e => {
                        const newRight = [...question.right];
                        newRight[idx] = e.target.value;
                        updateQ({ right: newRight });
                      }}
                      size="small"
                      sx={{ flex: 2 }}
                    />
                    <IconButton onClick={() => {
                      const newRight = question.right.filter((_, i) => i !== idx);
                      updateQ({ right: newRight });
                    }} size="small"><DeleteIcon /></IconButton>
                  </Box>
                )) : <Typography color="text.secondary">No options yet</Typography>}
                <Button size="small" onClick={() => updateQ({ right: [...(question.right || []), ''] })} startIcon={<AddIcon />}>Add Option</Button>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>Correct Matching (drag to set pairs):</Typography>
                {Array.isArray(question.left) && Array.isArray(question.right) && question.left.length > 0 && question.right.length > 0 ? (
                  question.left.map((q, idx) => (
                    <Box key={idx} display="flex" alignItems="center" gap={2} sx={{ mb: 1 }}>
                      <Typography sx={{ minWidth: 80 }}>{q || `Q${idx + 1}`}</Typography>
                      <Select
                        value={question.answers && question.answers[idx] !== undefined ? question.answers[idx] : ''}
                        onChange={e => {
                          const newAnswers = [...(question.answers || [])];
                          newAnswers[idx] = e.target.value;
                          updateQ({ answers: newAnswers });
                        }}
                        size="small"
                        sx={{ minWidth: 120 }}
                      >
                        <MenuItem value=""><em>None</em></MenuItem>
                        {question.right.map((opt, oidx) => (
                          <MenuItem key={oidx} value={oidx}>{opt}</MenuItem>
                        ))}
                      </Select>
                    </Box>
                  ))
                ) : <Typography color="text.secondary">Add questions and options to set pairs</Typography>}
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditingQuestion(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      );
    }

    if (question.type === 'map_diagram') {
      // Инициализация массива точек, если его нет
      if (!Array.isArray(question.points)) {
        updateQ({ points: [] });
      }
      const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            updateQ({ image: ev.target.result });
          };
          reader.readAsDataURL(file);
        }
      };
      const handleImageClick = (e) => {
        const rect = e.target.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        const newPoints = [...(question.points || []), { x, y, label: '', answer: '' }];
        updateQ({ points: newPoints });
      };
      return (
        <Dialog open={!!editingQuestion} onClose={() => setEditingQuestion(null)} maxWidth="md" fullWidth>
          <DialogTitle>Edit Map/Diagram Labelling Question</DialogTitle>
          <DialogContent>
            {universalFields}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Question Type</InputLabel>
              <Select value={question.type} label="Question Type" onChange={handleTypeChange}>
                {QUESTION_TYPES.map(type => (
                  <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Instruction (optional)"
                  value={question.text}
                  onChange={e => updateQ({ text: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>Upload Map/Diagram Image:</Typography>
                <input type="file" accept="image/*" onChange={handleImageUpload} />
                {question.image && (
                  <Box sx={{ mt: 2, position: 'relative', width: '100%', maxWidth: 500 }}>
                    <img
                      src={question.image}
                      alt="Map/Diagram"
                      style={{ width: '100%', height: 'auto', border: '1px solid #ccc', borderRadius: 4 }}
                      onClick={handleImageClick}
                    />
                    {/* Отображение точек */}
                    {Array.isArray(question.points) && question.points.map((pt, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          position: 'absolute',
                          left: `${pt.x}%`,
                          top: `${pt.y}%`,
                          transform: 'translate(-50%, -50%)',
                          width: 18,
                          height: 18,
                          bgcolor: 'primary.main',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontWeight: 'bold',
                          fontSize: 12,
                          cursor: 'pointer',
                          zIndex: 2
                        }}
                      >
                        {idx + 1}
                      </Box>
                    ))}
                  </Box>
                )}
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>Labels & Answers for Points:</Typography>
                {Array.isArray(question.points) && question.points.length > 0 ? question.points.map((pt, idx) => (
                  <Box key={idx} display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
                    <Typography sx={{ minWidth: 24 }}>{idx + 1}</Typography>
                    <TextField
                      label="Label"
                      value={pt.label}
                      onChange={e => {
                        const newPoints = [...question.points];
                        newPoints[idx].label = e.target.value;
                        updateQ({ points: newPoints });
                      }}
                      size="small"
                      sx={{ flex: 2 }}
                    />
                    <TextField
                      label="Correct Answer"
                      value={pt.answer}
                      onChange={e => {
                        const newPoints = [...question.points];
                        newPoints[idx].answer = e.target.value;
                        updateQ({ points: newPoints });
                      }}
                      size="small"
                      sx={{ flex: 2 }}
                    />
                    <IconButton onClick={() => {
                      const newPoints = question.points.filter((_, i) => i !== idx);
                      updateQ({ points: newPoints });
                    }} size="small"><DeleteIcon /></IconButton>
                  </Box>
                )) : <Typography color="text.secondary">Click on the image to add points</Typography>}
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditingQuestion(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      );
    }

    if (question.type === 'table') {
      const table = question.table || { rows: 2, cols: 2, cells: [[{ text: '', isAnswer: false, answer: '' }]] };
      const setTable = (newTable) => updateQ({ table: newTable });
      // Добавляю функцию для обновления ячеек таблицы
      const handleCellChange = (r, c, field, value) => {
        const newTable = { ...table };
        newTable.cells = newTable.cells.map((row, rowIdx) =>
          rowIdx === r
            ? row.map((cell, colIdx) =>
                colIdx === c ? { ...cell, [field]: value } : cell
              )
            : row
        );
        setTable(newTable);
      };
      const addRow = () => {
        const newRow = Array(table.cols).fill(0).map(() => ({ text: '', isAnswer: false, answer: '' }));
        setTable({ ...table, rows: table.rows + 1, cells: [...table.cells, newRow] });
      };
      const addCol = () => {
        const newCells = table.cells.map(row => [...row, { text: '', isAnswer: false, answer: '' }]);
        setTable({ ...table, cols: table.cols + 1, cells: newCells });
      };
      const removeRow = (r) => {
        if (table.rows <= 1) return;
        const newCells = table.cells.filter((_, idx) => idx !== r);
        setTable({ ...table, rows: table.rows - 1, cells: newCells });
      };
      const removeCol = (c) => {
        if (table.cols <= 1) return;
        const newCells = table.cells.map(row => row.filter((_, idx) => idx !== c));
        setTable({ ...table, cols: table.cols - 1, cells: newCells });
      };
      return (
        <Dialog open={!!editingQuestion} onClose={() => setEditingQuestion(null)} maxWidth="lg" fullWidth>
          <DialogTitle>Edit Table Completion Question</DialogTitle>
          <DialogContent>
            {universalFields}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Question Type</InputLabel>
              <Select value={question.type} label="Question Type" onChange={handleTypeChange}>
                {QUESTION_TYPES.map(type => (
                  <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Instruction (optional)"
                  value={question.text}
                  onChange={e => updateQ({ text: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ overflowX: 'auto', mb: 2 }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr>
                        {Array.from({ length: table.cols }).map((_, c) => (
                          <th key={c} style={{ minWidth: 120, position: 'relative' }}>
                            <IconButton size="small" onClick={() => removeCol(c)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </th>
                        ))}
                        <th style={{ border: 'none', padding: 0 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.cells.map((row, r) => (
                        <tr key={r}>
                          {row.map((cell, c) => (
                            <td key={c} style={{ border: '1px solid #ccc', padding: 6, minWidth: 120, position: 'relative' }}>
                              <Box display="flex" flexDirection="column" alignItems="start" gap={1}>
                                <Box display="flex" alignItems="center" gap={1}>
                                  <input
                                    type="checkbox"
                                    checked={cell.isAnswer}
                                    onChange={e => handleCellChange(r, c, 'isAnswer', e.target.checked)}
                                    style={{ marginRight: 6 }}
                                  />
                                  <span style={{ fontSize: 12, color: '#888' }}>Answer cell</span>
                                </Box>
                                {cell.isAnswer ? (
                                  <Box display="flex" alignItems="center" gap={1}>
                                    <Box sx={{ bgcolor: 'primary.main', color: '#fff', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 16 }}>{cell.label || (r * table.cols + c + 1)}</Box>
                                    <TextField
                                      value={cell.answer || ''}
                                      onChange={e => handleCellChange(r, c, 'answer', e.target.value)}
                                      size="small"
                                      placeholder="Correct answer"
                                    />
                                  </Box>
                                ) : (
                                  <TextField
                                    value={cell.text || ''}
                                    onChange={e => handleCellChange(r, c, 'text', e.target.value)}
                                    size="small"
                                    placeholder="Cell text"
                                  />
                                )}
                              </Box>
                            </td>
                          ))}
                          {table.rows > 1 && (
                            <td style={{ border: 'none', padding: 0 }}>
                              <IconButton size="small" onClick={() => removeRow(r)}><DeleteIcon fontSize="small" /></IconButton>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
                <Button size="small" onClick={addRow} startIcon={<AddIcon />}>Add Row</Button>
                <Button size="small" onClick={addCol} startIcon={<AddIcon />} sx={{ ml: 1 }}>Add Column</Button>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditingQuestion(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      );
    }

    if ([
      'summary_completion',
      'note_completion',
      'flow_chart',
      'sentence_completion'
    ].includes(question.type)) {
      // Автоматически определяем количество пропусков ([[answer]])
      const gapRegex = /\[\[answer\]\]/g;
      const gapCount = (question.text?.match(gapRegex) || []).length;
      const safeGaps = Array.isArray(question.gaps) ? question.gaps : [];
      const gaps = Array(gapCount).fill('').map((_, i) => {
        const g = safeGaps[i];
        return typeof g === 'object' && g !== null ? g : { answer: '' };
      });
      const handleTextChange = (e) => {
        const newText = e.target.value;
        const newGapCount = (newText.match(gapRegex) || []).length;
        let newGaps = gaps.slice(0, newGapCount);
        while (newGaps.length < newGapCount) newGaps.push({ answer: '' });
        updateQ({ text: newText, gaps: newGaps });
      };
      const handleGapChange = (idx, value) => {
        const newGaps = Array.isArray(question.gaps) ? [...question.gaps] : [];
        newGaps[idx] = value;
        updateQ({ gaps: newGaps });
      };
      return (
        <Dialog open={!!editingQuestion} onClose={() => setEditingQuestion(null)} maxWidth="md" fullWidth>
          <DialogTitle>Edit {(question.type ? question.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown')} Question</DialogTitle>
          <DialogContent>
            {universalFields}
            <Typography variant="subtitle2" gutterBottom>
              Use <b>[[answer]]</b> to mark each gap in the text.
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Text with gaps"
              value={question.text || ''}
              onChange={handleTextChange}
            />
            {gaps.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>Correct Answers for Gaps:</Typography>
                {gaps.map((gap, idx) => (
                  <Box key={idx} display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
                    <Box sx={{ bgcolor: 'primary.main', color: '#fff', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 16 }}>{gap.label || (idx + 1)}</Box>
                    <TextField
                      label="Correct Answer"
                      value={gap.answer}
                      onChange={e => {
                        const newGaps = Array.isArray(question.gaps) ? [...question.gaps] : [];
                        if (!newGaps[idx] || typeof newGaps[idx] !== 'object') newGaps[idx] = { answer: '' };
                        newGaps[idx].answer = e.target.value;
                        updateQ({ gaps: newGaps });
                      }}
                      size="small"
                      sx={{ flex: 2 }}
                    />
                    <IconButton onClick={() => {
                      const newGaps = Array.isArray(question.gaps) ? [...question.gaps] : [];
                      newGaps.splice(idx, 1);
                      updateQ({ gaps: newGaps });
                    }} size="small"><DeleteIcon /></IconButton>
                  </Box>
                ))}
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditingQuestion(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      );
    }

    if (question.type === 'short_answer') {
      return (
        <Dialog open={!!editingQuestion} onClose={() => setEditingQuestion(null)} maxWidth="sm" fullWidth>
          <DialogTitle>Edit Short Answer Question</DialogTitle>
          <DialogContent>
            {universalFields}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Question Type</InputLabel>
              <Select value={question.type} label="Question Type" onChange={handleTypeChange}>
                {QUESTION_TYPES.map(type => (
                  <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Question Text"
                  value={question.text || ''}
                  onChange={e => updateQ({ text: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Correct Answer"
                  value={question.answer || ''}
                  onChange={e => updateQ({ answer: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditingQuestion(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      );
    }

    if (question.type === 'true_false') {
      return (
        <Dialog open={!!editingQuestion} onClose={() => setEditingQuestion(null)} maxWidth="sm" fullWidth>
          <DialogTitle>Edit True/False/Not Given Question</DialogTitle>
          <DialogContent>
            {universalFields}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Question Type</InputLabel>
              <Select value={question.type} label="Question Type" onChange={handleTypeChange}>
                {QUESTION_TYPES.map(type => (
                  <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Question Text"
                  value={question.text || ''}
                  onChange={e => updateQ({ text: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>Correct Answer:</Typography>
                <FormControl>
                  <Select
                    value={question.answer || ''}
                    onChange={e => updateQ({ answer: e.target.value })}
                    size="small"
                    sx={{ minWidth: 160 }}
                  >
                    <MenuItem value="true">True</MenuItem>
                    <MenuItem value="false">False</MenuItem>
                    <MenuItem value="not_given">Not Given</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditingQuestion(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      );
    }

    if (question.type === 'multiple_response') {
      const answerArr = Array.isArray(question.answer) ? question.answer : [];
      return (
        <Dialog open={!!editingQuestion} onClose={() => setEditingQuestion(null)} maxWidth="md" fullWidth>
          <DialogTitle>Edit Multiple Response Question</DialogTitle>
          <DialogContent>
            {universalFields}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Question Type</InputLabel>
              <Select value={question.type} label="Question Type" onChange={handleTypeChange}>
                {QUESTION_TYPES.map(type => (
                  <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Instruction (optional)"
                  value={question.text}
                  onChange={e => updateQ({ text: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>Options:</Typography>
                {Array.isArray(question.options) && question.options.length > 0 ? question.options.map((option, idx) => (
                  <Box display="flex" alignItems="center" gap={1}>
                    <TextField
                      label="Label"
                      value={option.label || String.fromCharCode(65 + idx)}
                      onChange={e => {
                        const newOptions = [...question.options];
                        newOptions[idx].label = e.target.value;
                        updateQ({ options: newOptions });
                      }}
                      size="small"
                      sx={{ width: 60 }}
                    />
                    <TextField
                      label={`Option ${idx + 1}`}
                      value={option.text}
                      onChange={e => {
                        const newOptions = [...question.options];
                        if (e.target.value) {
                          newOptions[idx].text = e.target.value;
                        } else {
                          newOptions.splice(idx, 1);
                        }
                        updateQ({ options: newOptions });
                      }}
                      size="small"
                      sx={{ flex: 2 }}
                    />
                    {option.image && (
                      <img src={option.image} alt="option" style={{ maxWidth: 40, maxHeight: 40, marginLeft: 4, borderRadius: 4, border: '1px solid #ccc' }} />
                    )}
                    <Button
                      variant={answerArr.includes(option.text) ? 'contained' : 'outlined'}
                      color="success"
                      size="small"
                      onClick={() => {
                        const newAnswer = answerArr.includes(option.text)
                          ? answerArr.filter(a => a !== option.text)
                          : [...answerArr, option.text];
                        updateQ({ answer: newAnswer });
                      }}
                      sx={{ minWidth: 90 }}
                    >
                      {answerArr.includes(option.text) ? 'Selected' : 'Select'}
                    </Button>
                    <IconButton onClick={() => {
                      const newOptions = question.options.filter((_, i) => i !== idx);
                      updateQ({ options: newOptions });
                    }} size="small"><DeleteIcon /></IconButton>
                  </Box>
                )) : <Typography color="text.secondary">No options yet</Typography>}
              </Grid>
            </Grid>
            <Button size="small" onClick={() => updateQ({ options: [...(question.options || []), { text: '', image: '' }] })} startIcon={<AddIcon />}>Add Option</Button>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditingQuestion(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      );
    }

    if (question.type === 'gap_fill') {
      // Парсим все [[номер]] из question.text (универсальное поле)
      const gapRegex = /\[\[(\d+)\]\]/g;
      const matches = [...(question.text?.matchAll(gapRegex) || [])];
      let gaps = Array.isArray(question.gaps) ? [...question.gaps] : [];
      matches.forEach((m, idx) => {
        const num = parseInt(m[1], 10);
        if (!gaps[idx] || typeof gaps[idx] !== 'object') gaps[idx] = { number: num, answer: '' };
        else gaps[idx].number = num;
      });
      gaps = gaps.slice(0, matches.length);
      const numbers = gaps.map(g => g.number);
      const hasDuplicates = new Set(numbers).size !== numbers.length;
      // handleTextChange теперь просто updateQ({ text, gaps })
      const handleTextChange = (e) => {
        const newText = e.target.value;
        const newMatches = [...(newText.matchAll(gapRegex) || [])];
        let newGaps = gaps.slice(0, newMatches.length);
        newMatches.forEach((m, idx) => {
          const num = parseInt(m[1], 10);
          if (!newGaps[idx] || typeof newGaps[idx] !== 'object') newGaps[idx] = { number: num, answer: '' };
          else newGaps[idx].number = num;
        });
        updateQ({ text: newText, gaps: newGaps });
      };
      return (
        <Dialog open={!!editingQuestion} onClose={() => setEditingQuestion(null)} maxWidth="md" fullWidth>
          <DialogTitle>Edit Fill in the blanks Question</DialogTitle>
          <DialogContent>
            {/* Универсальный блок, но поле text теперь с кастомным onChange */}
            <TextField
              fullWidth
              label="Header (optional)"
              value={question.header || ''}
              onChange={e => updateQ({ header: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Instruction (optional)"
              value={question.instruction || ''}
              onChange={e => updateQ({ instruction: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Text with gaps (use [[7]], [[8]], ...)"
              value={question.text || ''}
              onChange={handleTextChange}
              sx={{ mb: 2 }}
            />
            {hasDuplicates && (
              <Alert severity="error" sx={{ mt: 2 }}>Gap numbers must be unique!</Alert>
            )}
            {gaps.length > 0 && (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>Gaps:</Typography>
                  {gaps.map((gap, idx) => (
                    <Box key={idx} display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
                      <TextField
                        label="Number"
                        type="number"
                        value={gap.number}
                        onChange={e => {
                          const newGaps = [...gaps];
                          newGaps[idx].number = parseInt(e.target.value, 10) || '';
                          updateQ({ gaps: newGaps });
                        }}
                        size="small"
                        sx={{ width: 80 }}
                      />
                      <TextField
                        label="Correct Answer"
                        value={gap.answer}
                        onChange={e => {
                          const newGaps = [...gaps];
                          newGaps[idx].answer = e.target.value;
                          updateQ({ gaps: newGaps });
                        }}
                        size="small"
                        sx={{ flex: 2 }}
                      />
                      <IconButton onClick={() => {
                        const newGaps = [...gaps];
                        newGaps.splice(idx, 1);
                        updateQ({ gaps: newGaps });
                      }} size="small"><DeleteIcon /></IconButton>
                    </Box>
                  ))}
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditingQuestion(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      );
    }

    return (
      <Dialog open={!!editingQuestion} onClose={() => setEditingQuestion(null)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Question {qIdx + 1}</DialogTitle>
        <DialogContent>
          {universalFields}
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Question Type</InputLabel>
            <Select value={question.type} label="Question Type" onChange={handleTypeChange}>
              {QUESTION_TYPES.map(type => (
                <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Question Text"
                value={question.text}
                onChange={(e) => updateQ({ text: e.target.value })}
              />
            </Grid>

            {['multiple_choice', 'matching'].includes(question.type) && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>Options:</Typography>
                {question.options.map((option, idx) => (
                  <Box display="flex" alignItems="center" gap={1}>
                    <TextField
                      label="Label"
                      value={option.label || String.fromCharCode(65 + idx)}
                      onChange={e => {
                        const newOptions = [...question.options];
                        newOptions[idx].label = e.target.value;
                        updateQ({ options: newOptions });
                      }}
                      size="small"
                      sx={{ width: 60 }}
                    />
                    <TextField
                      label={`Option ${idx + 1}`}
                      value={option.text}
                      onChange={e => {
                        const newOptions = [...question.options];
                        newOptions[idx].text = e.target.value;
                        updateQ({ options: newOptions });
                      }}
                      size="small"
                      sx={{ flex: 2 }}
                    />
                    {option.image && (
                      <img src={option.image} alt="option" style={{ maxWidth: 40, maxHeight: 40, marginLeft: 4, borderRadius: 4, border: '1px solid #ccc' }} />
                    )}
                    <Button
                      variant={question.answer === idx ? 'contained' : 'outlined'}
                      color="success"
                      size="small"
                      onClick={() => updateQ({ answer: idx })}
                      sx={{ minWidth: 90 }}
                    >
                      Correct
                    </Button>
                    <IconButton onClick={() => {
                      const newOptions = question.options.filter((_, i) => i !== idx);
                      updateQ({ options: newOptions });
                    }} size="small"><DeleteIcon /></IconButton>
                  </Box>
                ))}
              </Grid>
            )}

            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Correct Answer"
                value={question.answer}
                onChange={(e) => updateQ({ answer: e.target.value })}
              />
            </Grid>

            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Audio Start (seconds)"
                type="number"
                value={question.audio_start}
                onChange={(e) => updateQ({ audio_start: parseInt(e.target.value) || 0 })}
              />
            </Grid>

            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Audio End (seconds)"
                type="number"
                value={question.audio_end}
                onChange={(e) => updateQ({ audio_end: parseInt(e.target.value) || 30 })}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>Question Image:</Typography>
              <input
                type="file"
                accept="image/*"
                onChange={e => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => updateQ({ image: ev.target.result });
                    reader.readAsDataURL(file);
                  }
                }}
                style={{ marginBottom: 8 }}
              />
              {question.image && (
                <img src={question.image} alt="Question" style={{ maxWidth: 200, maxHeight: 120, marginBottom: 8 }} />
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingQuestion(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  };

  // Render part editor
  const renderPartEditor = (part, partIdx) => {
    return (
      <Dialog open={!!editingPart} onClose={() => setEditingPart(null)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Section {partIdx + 1}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Section Title"
                value={part.title}
                onChange={(e) => updatePart(partIdx, { title: e.target.value })}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>Audio File:</Typography>
              <Box sx={{ mt: 1, mb: 2 }}>
                {part.audio ? (
                  <>
                    <audio controls style={{ width: '100%' }}>
                      <source src={part.audio} />
                    </audio>
                    <Button
                      variant="outlined"
                      component="label"
                      size="small"
                      sx={{ mt: 1 }}
                    >
                      Заменить аудио
                      <input
                        type="file"
                        accept="audio/*"
                        hidden
                        onChange={e => e.target.files[0] && handleFileUpload(e.target.files[0], 'audio', partIdx)}
                      />
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="contained"
                    component="label"
                    size="small"
                    sx={{ mt: 1 }}
                  >
                    Добавить аудио
                    <input
                      type="file"
                      accept="audio/*"
                      hidden
                      onChange={e => e.target.files[0] && handleFileUpload(e.target.files[0], 'audio', partIdx)}
                    />
                  </Button>
                )}
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>Section Image:</Typography>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0], 'image', partIdx)}
              />
              {part.image && (
                <Box sx={{ mt: 1 }}>
                  <img src={part.image} alt="Section" style={{ maxWidth: '300px', maxHeight: '200px' }} />
                </Box>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingPart(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  };

  // Универсальный преобразователь структуры теста для API
  const transformTestForAPI = (test) => {
    return {
      title: test.title,
      is_active: test.is_active,
      parts: test.parts.map((part, partIdx) => ({
        part_number: partIdx + 1,
        title: part.title,
        audio: part.audio || '',
        image: part.image || '',
        questions: part.questions.map((q, qIdx) => {
          // Всегда включаем header и instruction для любого типа
          const base = {
            order: qIdx + 1,
            question_type: q.type || q.question_type,
            question_text: q.text || q.question_text,
            image: q.image || '',
            audio_start: q.audio_start || 0,
            audio_end: q.audio_end || 30,
            header: q.header || '',
            instruction: q.instruction || '',
          };
          // Multiple Choice
          if (q.type === 'multiple_choice') {
            base.options = (q.options || []).map((opt, i) => ({
              id: String.fromCharCode(65 + i),
              label: String.fromCharCode(65 + i),
              text: opt.text || opt,
              image: opt.image || ''
            }));
            base.correct_answers = [base.options[q.answer]?.label || 'A'];
            base.extra_data = {
              ...(q.extra_data || {}),
              options: base.options,
              answer: q.answer,
            };
          }
          // Matching
          else if (q.type === 'matching') {
            base.items = q.left || [];
            base.options = (q.right || []).map((opt, i) => ({
              id: String.fromCharCode(65 + i),
              label: String.fromCharCode(65 + i),
              text: opt
            }));
            base.correct_pairs = (q.answers || []).map(idx => Number(idx));
            base.extra_data = {
              ...(q.extra_data || {}),
              left: q.left,
              right: q.right,
              answers: q.answers,
            };
          }
          // Map/Diagram
          else if (q.type === 'map_diagram') {
            base.image = q.image || '';
            base.items = (q.points || []).map((pt, i) => pt.label || `Label ${i+1}`);
            base.options = (q.points || []).map((pt, i) => ({
              id: String(i+1),
              label: String(i+1),
              text: pt.answer || ''
            }));
            base.correct_pairs = (q.points || []).map((_, i) => i);
            base.extra_data = {
              ...(q.extra_data || {}),
              points: q.points,
            };
          }
          // Table Completion
          else if (q.type === 'table') {
            base.table = q.table || {};
            base.extra_data = {
              ...(q.extra_data || {}),
              table: q.table,
            };
          }
          // Form Completion
          else if (q.type === 'form') {
            base.fields = (q.fields || []).map(f => ({
              label: f.label,
              correct_answers: [f.answer]
            }));
            base.extra_data = {
              ...(q.extra_data || {}),
              fields: q.fields,
            };
          }
          // Sentence/Summary/Note/Flow Chart Completion
          else if ([
            'sentence_completion',
            'summary_completion',
            'note_completion',
            'flow_chart'
          ].includes(q.type)) {
            base.gaps = q.gaps || [];
            base.extra_data = {
              ...(q.extra_data || {}),
              gaps: q.gaps,
            };
          }
          // Short Answer
          else if (q.type === 'short_answer') {
            base.correct_answers = [q.answer];
            if (q.word_limit) base.extra_data = { word_limit: q.word_limit };
            base.extra_data = {
              ...(base.extra_data || {}),
              answer: q.answer,
            };
          }
          // True/False/Not Given
          else if (q.type === 'true_false') {
            base.correct_answers = [
              q.answer === 'true' ? 'True' : q.answer === 'false' ? 'False' : 'Not Given'
            ];
            base.extra_data = {
              ...(q.extra_data || {}),
              answer: q.answer,
            };
          }
          // Multiple Response
          else if (q.type === 'multiple_response') {
            base.options = (q.options || []).map((opt, i) => ({
              id: String.fromCharCode(65 + i),
              label: String.fromCharCode(65 + i),
              text: opt.text || opt,
              image: opt.image || ''
            }));
            base.answer = Array.isArray(q.answer) ? q.answer : [];
            base.extra_data = {
              ...(q.extra_data || {}),
              options: base.options,
              answer: base.answer,
            };
          }
          // Gap Fill (универсальный)
          if (q.type === 'gap_fill') {
            base.gaps = q.gaps || [];
            base.correct_answers = q.gaps || [];
            base.extra_data = {
              ...(q.extra_data || {}),
              gaps: q.gaps,
            };
          }
          return base;
        })
      }))
    };
  };

  // Save test to API
  const saveTest = async () => {
    setLoading(true);
    try {
      const method = isNewTest ? 'POST' : 'PUT';
      const url = isNewTest ? '/api/listening-tests/' : `/api/listening-tests/${testId}/`;
      const apiTest = transformTestForAPI(test);
      console.log('SAVING TEST TO API:', apiTest);
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiTest),
      });
      if (response.ok) {
        const savedTest = await response.json();
        if (isNewTest) {
          setTest(normalizeTestFromAPI({ ...test, id: savedTest.id }));
          setIsNewTest(false);
          setSnackbar({ open: true, message: 'Test saved', severity: 'success' });
          setTimeout(() => navigate('/admin/listening'), 800);
        } else {
          setTest(normalizeTestFromAPI(savedTest));
          setSnackbar({ open: true, message: 'Test saved', severity: 'success' });
          setTimeout(() => navigate('/admin/listening'), 800);
        }
      } else {
        const errorText = await response.text();
        console.log('SAVE ERROR:', response, errorText);
        setSnackbar({ open: true, message: 'Failed to save test', severity: 'error' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Network error', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Preview dialog component
  const PreviewDialog = () => {
    const currentPart = test.parts[previewPart];
    
    const handleAnswerChange = (questionId, value) => {
      setPreviewAnswers(prev => ({
        ...prev,
        [questionId]: value
      }));
    };

    const renderQuestion = (question, qIdx) => {
      switch (question.type) {
        case 'multiple_choice':
          return (
            <Box key={question.id} sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Question {qIdx + 1}: {question.text}
              </Typography>
              {question.image && (
                <Box sx={{ mb: 2 }}>
                  <img src={question.image} alt="Question" style={{ maxWidth: '100%', maxHeight: '200px' }} />
                </Box>
              )}
              <FormControl component="fieldset">
                {question.options.map((option, idx) => (
                  <FormControlLabel
                    key={idx}
                    control={
                      <input
                        type="radio"
                        name={question.id}
                        value={option.text}
                        checked={previewAnswers[question.id] === option.text}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      />
                    }
                    label={option.text}
                  />
                ))}
              </FormControl>
            </Box>
          );

        case 'short_answer':
          return (
            <Box key={question.id} sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Question {qIdx + 1}: {question.text}
              </Typography>
              {question.image && (
                <Box sx={{ mb: 2 }}>
                  <img src={question.image} alt="Question" style={{ maxWidth: '100%', maxHeight: '200px' }} />
                </Box>
              )}
              <TextField
                fullWidth
                label="Your answer"
                value={previewAnswers[question.id] || ''}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              />
            </Box>
          );

        case 'true_false':
          return (
            <Box key={question.id} sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Question {qIdx + 1}: {question.text}
              </Typography>
              {question.image && (
                <Box sx={{ mb: 2 }}>
                  <img src={question.image} alt="Question" style={{ maxWidth: '100%', maxHeight: '200px' }} />
                </Box>
              )}
              <FormControl component="fieldset">
                <FormControlLabel
                  control={
                    <input
                      type="radio"
                      name={question.id}
                      value="true"
                      checked={previewAnswers[question.id] === 'true'}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    />
                  }
                  label="True"
                />
                <FormControlLabel
                  control={
                    <input
                      type="radio"
                      name={question.id}
                      value="false"
                      checked={previewAnswers[question.id] === 'false'}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    />
                  }
                  label="False"
                />
              </FormControl>
            </Box>
          );

        case 'table':
          const table = question.table;
          if (!table || !Array.isArray(table.cells) || !table.cells.length) {
            return (
              <Box sx={{ mb: 3, color: 'red' }}>
                <Typography variant="h6" gutterBottom>{question.text}</Typography>
                <Typography>⚠️ Table data is missing for this question.</Typography>
              </Box>
            );
          }
          return (
            <Box sx={{ mb: 3, overflowX: 'auto' }}>
              <Typography variant="h6" gutterBottom>{question.text}</Typography>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <tbody>
                  {table.cells.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => (
                        <td key={c} style={{ border: '1px solid #ccc', padding: 8, minWidth: 120, background: cell.isAnswer ? '#e3f2fd' : '#fff' }}>
                          {cell.isAnswer ? (
                            <Box display="flex" alignItems="center" gap={1}>
                              <Box sx={{ bgcolor: 'primary.main', color: '#fff', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 16 }}>{cell.label || (r * table.cols + c + 1)}</Box>
                              <TextField
                                value={cell.answer || ''}
                                size="small"
                                placeholder="Correct answer"
                                InputProps={{ readOnly: true }}
                              />
                            </Box>
                          ) : (
                            <TextField
                              value={cell.text || ''}
                              size="small"
                              placeholder="Cell text"
                              InputProps={{ readOnly: true }}
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          );

        case 'multiple_response':
          const answerArr = Array.isArray(question.answer) ? question.answer : [];
          return (
            <Box key={question.id} sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Question {qIdx + 1}: {question.text}
              </Typography>
              {question.image && (
                <Box sx={{ mb: 2 }}>
                  <img src={question.image} alt="Question" style={{ maxWidth: '100%', maxHeight: '200px' }} />
                </Box>
              )}
              <FormControl component="fieldset">
                {question.options.map((option, idx) => (
                  <FormControlLabel
                    key={idx}
                    control={
                      <input
                        type="checkbox"
                        name={question.id}
                        value={option.text}
                        checked={answerArr.includes(option.text)}
                        onChange={(e) => {
                          const newAnswer = answerArr.includes(option.text) ? answerArr.filter(a => a !== option.text) : [...answerArr, option.text];
                          handleAnswerChange(question.id, newAnswer);
                        }}
                      />
                    }
                    label={option.text}
                  />
                ))}
              </FormControl>
            </Box>
          );

        default:
          return (
            <Box key={question.id} sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Question {qIdx + 1}: {question.text}
              </Typography>
              {question.image && (
                <Box sx={{ mb: 2 }}>
                  <img src={question.image} alt="Question" style={{ maxWidth: '100%', maxHeight: '200px' }} />
                </Box>
              )}
              <TextField
                fullWidth
                label="Your answer"
                value={previewAnswers[question.id] || ''}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              />
            </Box>
          );
      }
    };

    return (
      <Dialog open={showPreview} onClose={() => setShowPreview(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h5">Preview: {test.title}</Typography>
            <Box display="flex" alignItems="center" gap={1}>
              {test.parts.length > 1 && (
                <>
                  <IconButton onClick={() => setPreviewPart(p => Math.max(0, p - 1))} disabled={previewPart === 0}>
                    <span>&lt;</span>
                  </IconButton>
                  <Typography variant="subtitle1" sx={{ minWidth: 80, textAlign: 'center' }}>{test.parts[previewPart].title}</Typography>
                  <IconButton onClick={() => setPreviewPart(p => Math.min(test.parts.length - 1, p + 1))} disabled={previewPart === test.parts.length - 1}>
                    <span>&gt;</span>
                  </IconButton>
                </>
              )}
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>{currentPart.title}</Typography>
            {currentPart.image && (
              <Box sx={{ mb: 2 }}>
                <img src={currentPart.image} alt="Section" style={{ maxWidth: '100%', maxHeight: '300px' }} />
              </Box>
            )}
            {currentPart.audio && (
              <Box sx={{ mb: 2 }}>
                <audio controls style={{ width: '100%' }}>
                  <source src={currentPart.audio} />
                </audio>
              </Box>
            )}
          </Box>
          
          <Divider sx={{ mb: 3 }} />
          
          {currentPart.questions.map((question, qIdx) => renderQuestion(question, qIdx))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreview(false)}>Close Preview</Button>
        </DialogActions>
      </Dialog>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton onClick={() => navigate('/admin/listening')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4">
            {isNewTest ? 'Create New Listening Test' : `Edit: ${test.title}`}
          </Typography>
        </Box>
        <Box>
          <FormControlLabel
            control={
              <Switch
                checked={test.is_active}
                onChange={(e) => setTest({ ...test, is_active: e.target.checked })}
              />
            }
            label="Active"
          />
          <Button 
            variant="outlined" 
            startIcon={<SaveIcon />} 
            onClick={saveTest}
            disabled={loading}
            sx={{ ml: 2 }}
          >
            {loading ? 'Saving...' : 'Save'}
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<VisibilityIcon />} 
            onClick={() => setShowPreview(true)}
            sx={{ ml: 2 }}
          >
            Preview
          </Button>
        </Box>
      </Box>

      <TextField
        fullWidth
        label="Test Title"
        value={test.title}
        onChange={(e) => setTest({ ...test, title: e.target.value })}
        sx={{ mb: 2 }}
      />

      <Button variant="contained" startIcon={<AddIcon />} onClick={addSection} sx={{ mb: 2 }}>
        Add Section
      </Button>

      {test.parts.map((part, partIdx) => (
        <Card key={part.id} sx={{ mb: 2 }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Box display="flex" alignItems="center">
                <Typography variant="h6">{part.title}</Typography>
                {part.audio && <AudioFileIcon sx={{ ml: 1, color: 'primary.main' }} />}
                {part.image && <ImageIcon sx={{ ml: 1, color: 'primary.main' }} />}
              </Box>
              <Box>
                <IconButton onClick={() => setEditingPart(part)} size="small">
                  <EditIcon />
                </IconButton>
                <IconButton onClick={() => removeSection(partIdx)} size="small">
                  <DeleteIcon />
                </IconButton>
              </Box>
            </Box>

            <Box sx={{ mt: 1, mb: 2 }}>
              {part.audio ? (
                <>
                  <audio controls style={{ width: '100%' }}>
                    <source src={part.audio} />
                  </audio>
                  <Button
                    variant="outlined"
                    component="label"
                    size="small"
                    sx={{ mt: 1 }}
                  >
                    Заменить аудио
                    <input
                      type="file"
                      accept="audio/*"
                      hidden
                      onChange={e => e.target.files[0] && handleFileUpload(e.target.files[0], 'audio', partIdx)}
                    />
                  </Button>
                </>
              ) : (
                <Button
                  variant="contained"
                  component="label"
                  size="small"
                  sx={{ mt: 1 }}
                >
                  Добавить аудио
                  <input
                    type="file"
                    accept="audio/*"
                    hidden
                    onChange={e => e.target.files[0] && handleFileUpload(e.target.files[0], 'audio', partIdx)}
                  />
                </Button>
              )}
            </Box>

            <Button size="small" onClick={() => addQuestion(partIdx)} startIcon={<AddIcon />} sx={{ mb: 2 }}>
              Add Question
            </Button>

            {part.questions.map((q, qIdx) => (
              <Paper key={q.id} sx={{ my: 1, p: 2 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box display="flex" alignItems="center">
                    <Chip label={`Q${qIdx + 1}`} size="small" sx={{ mr: 1 }} />
                  </Box>
                  <Box>
                    <IconButton onClick={() => setEditingQuestion({ partIdx, qIdx })} size="small"><EditIcon /></IconButton>
                    <IconButton onClick={() => removeQuestion(partIdx, qIdx)} size="small"><DeleteIcon /></IconButton>
                  </Box>
                </Box>
              </Paper>
            ))}
          </CardContent>
        </Card>
      ))}

      {editingQuestion && renderQuestionEditor(
        test.parts[editingQuestion.partIdx].questions[editingQuestion.qIdx],
        editingQuestion.partIdx,
        editingQuestion.qIdx
      )}
      {showPreview && <PreviewDialog />}
    </Box>
  );
};

export default AdminListeningTestBuilder;