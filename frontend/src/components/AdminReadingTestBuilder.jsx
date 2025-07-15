import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Paper, Typography, Box, IconButton, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel,
  Grid, Card, CardContent, Divider, Snackbar, CircularProgress
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { auth } from '../firebase-config';

// Типы вопросов для Reading (синхронизированы с backend)
const QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'multiple_response', label: 'Multiple Response' },
  { value: 'gap_fill', label: 'Gap Fill / Fill in the blanks' },
  { value: 'table', label: 'Table Completion' },
  { value: 'matching', label: 'Matching' },
  { value: 'true_false', label: 'True/False/Not Given' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'form', label: 'Form Completion' },
];

const initialTest = {
  title: '',
  is_active: true,
  parts: [],
};

const AdminReadingTestBuilder = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(initialTest);
  const [selectedPartIndex, setSelectedPartIndex] = useState(null); // Выбранная часть
  const [editingPart, setEditingPart] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPart, setPreviewPart] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [loading, setLoading] = useState(false);
  const [isNewTest, setIsNewTest] = useState(!testId || testId === 'new');

  // Загрузка теста
  useEffect(() => {
    if (testId && testId !== 'new') {
      loadExistingTest();
    }
  }, [testId]);

  // Выбираем первую часть автоматически при загрузке
  useEffect(() => {
    if (test.parts.length > 0 && selectedPartIndex === null) {
      setSelectedPartIndex(0);
    }
  }, [test.parts, selectedPartIndex]);

  const loadExistingTest = async () => {
    setLoading(true);
    try {
      let idToken = null;
      if (auth.currentUser) {
        idToken = await auth.currentUser.getIdToken();
      }
      const response = await fetch(`/api/reading-tests/${testId}/`, {
        headers: { 'Authorization': `Bearer ${idToken}` },
      });
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

  // CRUD частей
  const addPart = () => {
    const newPart = {
      id: `part-${Date.now()}`,
      title: `Part ${test.parts.length + 1}`,
      part_number: test.parts.length + 1,
      passage_text: '', // Правильное поле для backend
      passage_image_url: '',
      instructions: '',
      questions: [],
    };
    setTest({
      ...test,
      parts: [...test.parts, newPart],
    });
    setSelectedPartIndex(test.parts.length); // Выбираем новую часть
  };

  const removePart = (idx) => {
    const parts = test.parts.filter((_, i) => i !== idx);
    setTest({ ...test, parts });
    // Корректируем выбранную часть
    if (selectedPartIndex >= parts.length) {
      setSelectedPartIndex(parts.length > 0 ? parts.length - 1 : null);
    }
  };

  const updatePart = (idx, updates) => {
    const parts = [...test.parts];
    parts[idx] = { ...parts[idx], ...updates };
    setTest({ ...test, parts });
  };

  // CRUD вопросов
  const addQuestion = (partIdx) => {
    const part = test.parts[partIdx];
    const newQuestion = {
      id: `q-${Date.now()}`,
      question_type: 'multiple_choice',
      question_text: '',
      order: part.questions.length + 1,
      points: 1,
      image_url: '',
      correct_answers: [],
      extra_data: {},
      ...getDefaultQuestionFields('multiple_choice'),
    };
    const parts = [...test.parts];
    parts[partIdx].questions = [...part.questions, newQuestion];
    setTest({ ...test, parts });
    setEditingQuestion({ partIdx, qIdx: parts[partIdx].questions.length - 1 });
  };

  const removeQuestion = (partIdx, qIdx) => {
    const parts = [...test.parts];
    parts[partIdx].questions = parts[partIdx].questions.filter((_, i) => i !== qIdx);
    setTest({ ...test, parts });
  };

  const updateQuestion = (partIdx, qIdx, updates) => {
    const parts = [...test.parts];
    parts[partIdx].questions[qIdx] = { ...parts[partIdx].questions[qIdx], ...updates };
    setTest({ ...test, parts });
  };

  // Перемещение вопросов
  const moveQuestionUp = (partIdx, qIdx) => {
    if (qIdx === 0) return;
    const parts = [...test.parts];
    const questions = [...parts[partIdx].questions];
    [questions[qIdx - 1], questions[qIdx]] = [questions[qIdx], questions[qIdx - 1]];
    parts[partIdx].questions = questions;
    setTest({ ...test, parts });
  };

  const moveQuestionDown = (partIdx, qIdx) => {
    const parts = [...test.parts];
    const questions = [...parts[partIdx].questions];
    if (qIdx === questions.length - 1) return;
    [questions[qIdx + 1], questions[qIdx]] = [questions[qIdx], questions[qIdx + 1]];
    parts[partIdx].questions = questions;
    setTest({ ...test, parts });
  };

  const moveQuestionToPart = (fromPartIdx, qIdx, toPartIdx) => {
    if (fromPartIdx === toPartIdx) return;
    const parts = [...test.parts];
    const [question] = parts[fromPartIdx].questions.splice(qIdx, 1);
    parts[toPartIdx].questions.push({ ...question });
    setTest({ ...test, parts });
  };

  // Сохранение теста
  const saveTest = async () => {
    setLoading(true);
    try {
      let idToken = null;
      if (auth.currentUser) {
        idToken = await auth.currentUser.getIdToken();
      }
      const method = isNewTest ? 'POST' : 'PUT';
      const url = isNewTest ? '/api/reading-tests/' : `/api/reading-tests/${testId}/`;
      const apiTest = transformTestForAPI(test);
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(apiTest),
      });
      if (response.ok) {
        const savedTest = await response.json();
        setTest(normalizeTestFromAPI(savedTest));
        setIsNewTest(false);
        setSnackbar({ open: true, message: 'Test saved', severity: 'success' });
        setTimeout(() => navigate('/admin/reading'), 800);
      } else {
        const errorText = await response.text();
        console.error('Save error:', response.status, errorText);
        setSnackbar({ open: true, message: 'Failed to save test', severity: 'error' });
      }
    } catch (error) {
      console.error('Network error:', error);
      setSnackbar({ open: true, message: 'Network error', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // --- Render ---
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const selectedPart = selectedPartIndex !== null ? test.parts[selectedPartIndex] : null;

  return (
    <Box sx={{ p: 3 }}>
      {/* Заголовок */}
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton onClick={() => navigate('/admin/reading')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4">
            {isNewTest ? 'Create New Reading Test' : `Edit: ${test.title}`}
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

      {/* Название теста */}
      <TextField
        fullWidth
        label="Test Title"
        value={test.title}
        onChange={(e) => setTest({ ...test, title: e.target.value })}
        sx={{ mb: 2 }}
      />

      {/* Кнопка добавления части */}
      <Button variant="contained" startIcon={<AddIcon />} onClick={addPart} sx={{ mb: 2 }}>
        Add Part
      </Button>

      {/* Основной layout: левая панель (части) + правая панель (вопросы) */}
      <Grid container spacing={2}>
        {/* Левая панель: список частей */}
        <Grid item xs={4}>
          <Typography variant="h6" sx={{ mb: 2 }}>Parts</Typography>
          {test.parts.map((part, partIdx) => (
            <Card 
              key={part.id} 
              sx={{ 
                mb: 2, 
                bgcolor: selectedPartIndex === partIdx ? '#e3f2fd' : '#fff',
                border: selectedPartIndex === partIdx ? '2px solid #1976d2' : '1px solid #e0e0e0',
                cursor: 'pointer'
              }}
              onClick={() => setSelectedPartIndex(partIdx)}
            >
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Typography variant="h6">{part.title}</Typography>
                  <Box>
                    <IconButton onClick={(e) => { e.stopPropagation(); setEditingPart(partIdx); }}>
                      <EditIcon />
                    </IconButton>
                    <IconButton onClick={(e) => { e.stopPropagation(); removePart(partIdx); }}>
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {part.passage_text?.slice(0, 80) || 'No passage'}...
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {part.questions?.length || 0} questions
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Grid>

        {/* Правая панель: вопросы выбранной части */}
        <Grid item xs={8}>
          {selectedPart ? (
            <Box>
              <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Typography variant="h6">{selectedPart.title} - Questions</Typography>
                <Button 
                  onClick={() => addQuestion(selectedPartIndex)} 
                  startIcon={<AddIcon />}
                  variant="contained"
                >
                  Add Question
                </Button>
              </Box>
              
              {selectedPart.questions && selectedPart.questions.length > 0 ? (
                selectedPart.questions.map((question, qIdx) => (
                  <Paper key={question.id} sx={{ p: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1">Q{qIdx + 1} - {question.question_type}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {question.question_text?.slice(0, 80) || 'No text'}...
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Points: {question.points || 1}
                      </Typography>
                    </Box>
                    <Button onClick={() => moveQuestionUp(selectedPartIndex, qIdx)} disabled={qIdx === 0} size="small">↑</Button>
                    <Button onClick={() => moveQuestionDown(selectedPartIndex, qIdx)} disabled={qIdx === selectedPart.questions.length - 1} size="small">↓</Button>
                    <FormControl size="small" style={{ minWidth: 120, marginLeft: 8 }}>
                      <InputLabel>Part</InputLabel>
                      <Select
                        value={selectedPartIndex}
                        label="Part"
                        onChange={e => moveQuestionToPart(selectedPartIndex, qIdx, e.target.value)}
                      >
                        {test.parts.map((p, idx) => (
                          <MenuItem key={p.id} value={idx}>{p.title || `Part ${idx + 1}`}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <IconButton onClick={() => setEditingQuestion({ partIdx: selectedPartIndex, qIdx })}>
                      <EditIcon />
                    </IconButton>
                    <IconButton onClick={() => removeQuestion(selectedPartIndex, qIdx)}>
                      <DeleteIcon />
                    </IconButton>
                  </Paper>
                ))
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    No questions in this part yet.
                  </Typography>
                  <Button 
                    onClick={() => addQuestion(selectedPartIndex)} 
                    startIcon={<AddIcon />}
                    variant="outlined"
                    sx={{ mt: 2 }}
                  >
                    Add First Question
                  </Button>
                </Box>
              )}
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                Select a part from the left panel to view and edit its questions.
              </Typography>
            </Box>
          )}
        </Grid>
      </Grid>

      {/* Модальные окна для редактирования части и вопроса */}
      {editingPart !== null && (
        <PartEditor
          part={test.parts[editingPart]}
          onSave={updates => { updatePart(editingPart, updates); setEditingPart(null); }}
          onClose={() => setEditingPart(null)}
        />
      )}
      {editingQuestion && (
        <QuestionEditor
          question={test.parts[editingQuestion.partIdx].questions[editingQuestion.qIdx]}
          onSave={updates => { updateQuestion(editingQuestion.partIdx, editingQuestion.qIdx, updates); setEditingQuestion(null); }}
          onClose={() => setEditingQuestion(null)}
        />
      )}
      {showPreview && <PreviewDialog test={test} partIdx={previewPart} setPartIdx={setPreviewPart} onClose={() => setShowPreview(false)} />}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={3000} 
        onClose={() => setSnackbar({ ...snackbar, open: false })} 
        message={snackbar.message} 
      />
    </Box>
  );
};

// --- Вспомогательный редактор части (passage) ---
const PartEditor = ({ part, onSave, onClose }) => {
  const [form, setForm] = useState({ ...part });
  useEffect(() => { setForm({ ...part }); }, [part]);
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit Part</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label="Part Title"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          sx={{ mb: 2, mt: 1 }}
        />
        <TextField
          fullWidth
          multiline
          minRows={6}
          label="Passage Text"
          value={form.passage_text || ''}
          onChange={e => setForm(f => ({ ...f, passage_text: e.target.value }))}
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth
          label="Image URL (optional)"
          value={form.passage_image_url || ''}
          onChange={e => setForm(f => ({ ...f, passage_image_url: e.target.value }))}
          sx={{ mb: 2 }}
        />
        {form.passage_image_url && (
          <Box sx={{ mb: 2 }}>
            <img src={form.passage_image_url} alt="Passage" style={{ maxWidth: 400, maxHeight: 200, borderRadius: 8 }} />
          </Box>
        )}
        <TextField
          fullWidth
          multiline
          minRows={2}
          label="Instructions (optional)"
          value={form.instructions || ''}
          onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
          sx={{ mb: 2 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(form)} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
};

// --- Универсальный редактор вопроса ---
const QuestionEditor = ({ question, onSave, onClose }) => {
  const [form, setForm] = useState({ ...question });
  useEffect(() => { setForm({ ...question }); }, [question]);

  // Функция для извлечения пропусков из текста
  const extractGapsFromText = (text) => {
    const gapPattern = /\[\[(\d+)\]\]/g;
    const gaps = [];
    let match;
    while ((match = gapPattern.exec(text)) !== null) {
      const gapNumber = parseInt(match[1]);
      if (!gaps.find(g => g.number === gapNumber)) {
        gaps.push({ number: gapNumber, answer: '' });
      }
    }
    return gaps.sort((a, b) => a.number - b.number);
  };

  // Обработчик изменения текста для gap_fill
  const handleGapFillTextChange = (text) => {
    setForm(f => ({ ...f, question_text: text }));
    if (form.question_type === 'gap_fill') {
      const extractedGaps = extractGapsFromText(text);
      const currentAnswers = Array.isArray(form.correct_answers) ? form.correct_answers : [];
      
      // Обновляем массив ответов согласно найденным пропускам
      const newAnswers = extractedGaps.map((gap, index) => {
        return currentAnswers[index] || '';
      });
      
      setForm(f => ({ ...f, correct_answers: newAnswers }));
    }
  };

  // Универсальные поля
  const universalFields = (
    <>
      <TextField
        fullWidth
        label="Question Text"
        value={form.question_text || ''}
        onChange={e => form.question_type === 'gap_fill' ? handleGapFillTextChange(e.target.value) : setForm(f => ({ ...f, question_text: e.target.value }))}
        sx={{ mb: 2 }}
        multiline
        minRows={2}
        helperText={form.question_type === 'gap_fill' ? "Use [[1]], [[2]], ... for gaps. Gaps will be extracted automatically." : ""}
      />
      <TextField
        fullWidth
        label="Image URL (optional)"
        value={form.image_url || ''}
        onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
        sx={{ mb: 2 }}
      />
      {form.image_url && (
        <Box sx={{ mb: 2 }}>
          <img src={form.image_url} alt="Question" style={{ maxWidth: 400, maxHeight: 200, borderRadius: 8 }} />
        </Box>
      )}
      <TextField
        fullWidth
        label="Points"
        type="number"
        value={form.points || 1}
        onChange={e => setForm(f => ({ ...f, points: Number(e.target.value) }))}
        sx={{ mb: 2 }}
        inputProps={{ min: 1, max: 10 }}
      />
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Question Type</InputLabel>
        <Select
          value={form.question_type}
          label="Question Type"
          onChange={e => {
            const newType = e.target.value;
            setForm(f => ({ ...f, question_type: newType, ...getDefaultQuestionFields(newType) }));
          }}
        >
          {QUESTION_TYPES.map(type => (
            <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </>
  );

  // --- Рендер специфичных полей для каждого типа ---
  let typeFields = null;
  if (form.question_type === 'multiple_choice' || form.question_type === 'multiple_response') {
    const options = form.answer_options || [];
    typeFields = (
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Options:</Typography>
        {options.map((opt, idx) => (
          <Box key={idx} display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
            <TextField
              label={`Option ${idx + 1}`}
              value={opt.text || ''}
              onChange={e => {
                const newOptions = [...options];
                newOptions[idx] = { ...newOptions[idx], text: e.target.value };
                setForm(f => ({ ...f, answer_options: newOptions }));
              }}
              size="small"
              sx={{ flex: 2 }}
            />
            <FormControlLabel
              control={
                <input
                  type={form.question_type === 'multiple_choice' ? 'radio' : 'checkbox'}
                  checked={!!opt.is_correct}
                  onChange={e => {
                    const newOptions = [...options];
                    if (form.question_type === 'multiple_choice') {
                      // Для multiple choice - только один правильный
                      newOptions.forEach((option, i) => {
                        option.is_correct = i === idx && e.target.checked;
                      });
                    } else {
                      // Для multiple response - можно несколько
                      newOptions[idx].is_correct = e.target.checked;
                    }
                    setForm(f => ({ ...f, answer_options: newOptions }));
                  }}
                />
              }
              label="Correct"
              sx={{ ml: 1 }}
            />
            <IconButton onClick={() => {
              const newOptions = options.filter((_, i) => i !== idx);
              setForm(f => ({ ...f, answer_options: newOptions }));
            }}><DeleteIcon /></IconButton>
          </Box>
        ))}
        <Button onClick={() => {
          const newOptions = [...options, { text: '', is_correct: false }];
          setForm(f => ({ ...f, answer_options: newOptions }));
        }} size="small">+ Option</Button>
      </Box>
    );
  } else if (form.question_type === 'gap_fill') {
    const gaps = Array.isArray(form.correct_answers) ? form.correct_answers : [];
    const extractedGaps = extractGapsFromText(form.question_text || '');
    
    typeFields = (
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Found {extractedGaps.length} gaps in text. Enter correct answers:
        </Typography>
        {extractedGaps.map((gap, idx) => (
          <TextField
            key={gap.number}
            label={`Gap [[${gap.number}]]`}
            value={gaps[idx] || ''}
            onChange={e => {
              const newGaps = [...gaps];
              newGaps[idx] = e.target.value;
              setForm(f => ({ ...f, correct_answers: newGaps }));
            }}
            sx={{ mb: 1, mr: 1 }}
            size="small"
          />
        ))}
        {extractedGaps.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Add gaps like [[1]], [[2]] to your question text above to see answer fields here.
          </Typography>
        )}
      </Box>
    );
  } else if (form.question_type === 'table') {
    const tableData = form.extra_data?.table || { rows: 2, cols: 2, cells: [] };
    
    // Инициализируем таблицу если пустая
    if (!tableData.cells || tableData.cells.length === 0) {
      tableData.cells = Array(tableData.rows).fill(0).map(() => 
        Array(tableData.cols).fill(0).map(() => ({ text: '', isAnswer: false, answer: '' }))
      );
    }
    
    const updateTable = (newTableData) => {
      setForm(f => ({ 
        ...f, 
        extra_data: { 
          ...f.extra_data, 
          table: newTableData 
        }
      }));
    };

    typeFields = (
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Table (mark answer cells and enter correct answers):</Typography>
        <table style={{ borderCollapse: 'collapse', marginTop: 6, border: '1px solid #ccc' }}>
          <tbody>
            {tableData.cells.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} style={{ border: '1px solid #ccc', padding: 6, minWidth: 120, position: 'relative' }}>
                    <TextField
                      value={cell.text || ''}
                      onChange={e => {
                        const newCells = tableData.cells.map((rowArr, rIdx) =>
                          rowArr.map((cellObj, cIdx) =>
                            rIdx === r && cIdx === c ? { ...cellObj, text: e.target.value } : cellObj
                          )
                        );
                        updateTable({ ...tableData, cells: newCells });
                      }}
                      size="small"
                      placeholder="Cell text"
                      sx={{ mb: 1, width: '100%' }}
                    />
                    <FormControlLabel
                      control={
                        <input
                          type="checkbox"
                          checked={!!cell.isAnswer}
                          onChange={e => {
                            const newCells = tableData.cells.map((rowArr, rIdx) =>
                              rowArr.map((cellObj, cIdx) =>
                                rIdx === r && cIdx === c ? { ...cellObj, isAnswer: e.target.checked } : cellObj
                              )
                            );
                            updateTable({ ...tableData, cells: newCells });
                          }}
                        />
                      }
                      label="Answer cell"
                      sx={{ fontSize: '12px' }}
                    />
                    {cell.isAnswer && (
                      <TextField
                        value={cell.answer || ''}
                        onChange={e => {
                          const newCells = tableData.cells.map((rowArr, rIdx) =>
                            rowArr.map((cellObj, cIdx) =>
                              rIdx === r && cIdx === c ? { ...cellObj, answer: e.target.value } : cellObj
                            )
                          );
                          updateTable({ ...tableData, cells: newCells });
                        }}
                        size="small"
                        placeholder="Correct answer"
                        sx={{ mt: 1, width: '100%' }}
                      />
                    )}
                  </td>
                ))}
                <td style={{ padding: 4 }}>
                  <IconButton onClick={() => {
                    const newCells = tableData.cells.map(rowArr => [...rowArr, { text: '', isAnswer: false, answer: '' }]);
                    updateTable({ ...tableData, cols: tableData.cols + 1, cells: newCells });
                  }} size="small">+</IconButton>
                  {tableData.cols > 1 && (
                    <IconButton onClick={() => {
                      const newCells = tableData.cells.map(rowArr => rowArr.filter((_, cIdx) => cIdx !== tableData.cols - 1));
                      updateTable({ ...tableData, cols: tableData.cols - 1, cells: newCells });
                    }} size="small">-</IconButton>
                  )}
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={tableData.cols + 1} style={{ padding: 4, textAlign: 'center' }}>
                <IconButton onClick={() => {
                  const newRow = Array(tableData.cols).fill(0).map(() => ({ text: '', isAnswer: false, answer: '' }));
                  updateTable({ ...tableData, rows: tableData.rows + 1, cells: [...tableData.cells, newRow] });
                }} size="small">+ Row</IconButton>
                {tableData.rows > 1 && (
                  <IconButton onClick={() => {
                    const newCells = tableData.cells.slice(0, -1);
                    updateTable({ ...tableData, rows: tableData.rows - 1, cells: newCells });
                  }} size="small">- Row</IconButton>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </Box>
    );
  } else if (form.question_type === 'matching') {
    const left = form.extra_data?.left || [''];
    const right = form.extra_data?.right || [''];
    const answers = form.extra_data?.answers || [];
    
    const updateMatching = (field, value) => {
      setForm(f => ({ 
        ...f, 
        extra_data: { 
          ...f.extra_data, 
          [field]: value 
        }
      }));
    };

    typeFields = (
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Left column (statements):</Typography>
        {left.map((item, idx) => (
          <Box key={idx} display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
            <TextField
              label={`Left ${idx + 1}`}
              value={item}
              onChange={e => {
                const newLeft = [...left];
                newLeft[idx] = e.target.value;
                updateMatching('left', newLeft);
              }}
              size="small"
              sx={{ flex: 1 }}
            />
            <IconButton onClick={() => {
              const newLeft = left.filter((_, i) => i !== idx);
              updateMatching('left', newLeft);
            }}><DeleteIcon /></IconButton>
          </Box>
        ))}
        <Button onClick={() => updateMatching('left', [...left, ''])} size="small">+ Left Item</Button>
        
        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Right column (options):</Typography>
        {right.map((item, idx) => (
          <Box key={idx} display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
            <TextField
              label={`Right ${idx + 1}`}
              value={item}
              onChange={e => {
                const newRight = [...right];
                newRight[idx] = e.target.value;
                updateMatching('right', newRight);
              }}
              size="small"
              sx={{ flex: 1 }}
            />
            <IconButton onClick={() => {
              const newRight = right.filter((_, i) => i !== idx);
              updateMatching('right', newRight);
            }}><DeleteIcon /></IconButton>
          </Box>
        ))}
        <Button onClick={() => updateMatching('right', [...right, ''])} size="small">+ Right Item</Button>
        
        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Correct matches (left → right index):</Typography>
        {left.map((_, idx) => (
          <Box key={idx} display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
            <Typography variant="body2" sx={{ minWidth: 100 }}>Left {idx + 1} →</Typography>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Right item</InputLabel>
              <Select
                value={answers[idx] || ''}
                label="Right item"
                onChange={e => {
                  const newAnswers = [...answers];
                  newAnswers[idx] = e.target.value;
                  updateMatching('answers', newAnswers);
                }}
              >
                {right.map((rightItem, rightIdx) => (
                  <MenuItem key={rightIdx} value={rightIdx}>{rightIdx + 1}: {rightItem.slice(0, 30)}...</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        ))}
      </Box>
    );
  } else if (form.question_type === 'true_false') {
    typeFields = (
      <Box sx={{ mb: 2 }}>
        <FormControl fullWidth>
          <InputLabel>Answer</InputLabel>
          <Select
            value={Array.isArray(form.correct_answers) && form.correct_answers.length > 0 ? form.correct_answers[0] : ''}
            label="Answer"
            onChange={e => setForm(f => ({ ...f, correct_answers: [e.target.value] }))}
          >
            <MenuItem value="true">True</MenuItem>
            <MenuItem value="false">False</MenuItem>
            <MenuItem value="not_given">Not Given</MenuItem>
          </Select>
        </FormControl>
      </Box>
    );
  } else if (form.question_type === 'short_answer') {
    typeFields = (
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          label="Correct Answer"
          value={Array.isArray(form.correct_answers) && form.correct_answers.length > 0 ? form.correct_answers[0] : ''}
          onChange={e => setForm(f => ({ ...f, correct_answers: [e.target.value] }))}
          sx={{ mb: 2 }}
        />
      </Box>
    );
  } else if (form.question_type === 'form') {
    const fields = form.extra_data?.fields || [{ label: '', answer: '' }];
    
    const updateFields = (newFields) => {
      setForm(f => ({ 
        ...f, 
        extra_data: { 
          ...f.extra_data, 
          fields: newFields 
        }
      }));
    };

    typeFields = (
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Form fields:</Typography>
        {fields.map((field, idx) => (
          <Box key={idx} display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
            <TextField
              label="Field label"
              value={field.label || ''}
              onChange={e => {
                const newFields = [...fields];
                newFields[idx] = { ...newFields[idx], label: e.target.value };
                updateFields(newFields);
              }}
              size="small"
              sx={{ flex: 1 }}
            />
            <TextField
              label="Correct answer"
              value={field.answer || ''}
              onChange={e => {
                const newFields = [...fields];
                newFields[idx] = { ...newFields[idx], answer: e.target.value };
                updateFields(newFields);
              }}
              size="small"
              sx={{ flex: 1 }}
            />
            <IconButton onClick={() => {
              const newFields = fields.filter((_, i) => i !== idx);
              updateFields(newFields);
            }}><DeleteIcon /></IconButton>
          </Box>
        ))}
        <Button onClick={() => updateFields([...fields, { label: '', answer: '' }])} size="small">+ Field</Button>
      </Box>
    );
  }

  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Edit Question</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          {universalFields}
          {typeFields}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(form)} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
};

// --- PreviewDialog ---
const PreviewDialog = ({ test, partIdx, setPartIdx, onClose }) => {
  const currentPart = test.parts[partIdx];
  if (!currentPart) return null;
  
  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h5">Preview: {test.title}</Typography>
          <Box display="flex" alignItems="center" gap={1}>
            {test.parts.length > 1 && (
              <>
                <IconButton onClick={() => setPartIdx(p => Math.max(0, p - 1))} disabled={partIdx === 0}>
                  <span>&lt;</span>
                </IconButton>
                <Typography variant="subtitle1" sx={{ minWidth: 80, textAlign: 'center' }}>{test.parts[partIdx].title}</Typography>
                <IconButton onClick={() => setPartIdx(p => Math.min(test.parts.length - 1, p + 1))} disabled={partIdx === test.parts.length - 1}>
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
          {currentPart.passage_image_url && (
            <Box sx={{ mb: 2 }}>
              <img src={currentPart.passage_image_url} alt="Section" style={{ maxWidth: '100%', maxHeight: '400px', width: 'auto', height: 'auto', display: 'block', margin: '16px 0', borderRadius: 8, boxShadow: '0 2px 8px #0001' }} />
            </Box>
          )}
          <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>{currentPart.passage_text}</Typography>
        </Box>
        <Divider sx={{ mb: 3 }} />
        {currentPart.questions && currentPart.questions.map((question, qIdx) => (
          <Box key={question.id} sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>Q{qIdx + 1}: {question.question_text}</Typography>
            {question.image_url && (
              <Box sx={{ mb: 2 }}>
                <img src={question.image_url} alt="Question" style={{ maxWidth: '100%', maxHeight: '400px', width: 'auto', height: 'auto', display: 'block', margin: '16px 0', borderRadius: 8, boxShadow: '0 2px 8px #0001' }} />
              </Box>
            )}
          </Box>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close Preview</Button>
      </DialogActions>
    </Dialog>
  );
};

// --- Вспомогательные функции ---
function getDefaultQuestionFields(type) {
  switch (type) {
    case 'multiple_choice':
      return { answer_options: [{ text: '', is_correct: false }, { text: '', is_correct: false }] };
    case 'multiple_response':
      return { answer_options: [{ text: '', is_correct: false }, { text: '', is_correct: false }] };
    case 'gap_fill':
      return { correct_answers: [] };
    case 'table':
      return { 
        extra_data: { 
          table: { 
            rows: 2, 
            cols: 2, 
            cells: [
              [{ text: '', isAnswer: false, answer: '' }, { text: '', isAnswer: false, answer: '' }],
              [{ text: '', isAnswer: false, answer: '' }, { text: '', isAnswer: false, answer: '' }]
            ]
          } 
        } 
      };
    case 'matching':
      return { 
        extra_data: { 
          left: [''], 
          right: [''], 
          answers: [] 
        } 
      };
    case 'true_false':
      return { correct_answers: [''] };
    case 'short_answer':
      return { correct_answers: [''] };
    case 'form':
      return { 
        extra_data: { 
          fields: [{ label: '', answer: '' }] 
        } 
      };
    default:
      return {};
  }
}

function normalizeTestFromAPI(apiTest) {
  // Нормализуем данные от API под нашу структуру
  return {
    ...apiTest,
    parts: (apiTest.parts || []).map(part => ({
      ...part,
      questions: part.questions || []
    }))
  };
}

function transformTestForAPI(test) {
  // Трансформируем данные для API
  return {
    ...test,
    parts: test.parts.map(part => ({
      ...part,
      questions: part.questions.map(question => ({
        ...question,
        // Убираем временные ID для новых элементов
        id: question.id?.toString().startsWith('q-') ? undefined : question.id
      }))
    }))
  };
}

export default AdminReadingTestBuilder; 