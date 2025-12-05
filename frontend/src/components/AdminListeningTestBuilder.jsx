import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Button, Paper, Typography, Box, IconButton, TextField, 
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel,
  Grid, Card, CardContent, Chip, Divider, Alert, Snackbar, CircularProgress, Radio
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
import { auth } from '../firebase';
import api from '../api';

// IELTS Listening question types
const QUESTION_TYPES = [
  { value: 'gap_fill', label: 'Fill in the blanks' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'multiple_choice_group', label: 'Multiple Choice (Group)' },
  { value: 'matching', label: 'Matching' },
  { value: 'map_diagram', label: 'Map/Diagram' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'table', label: 'Table Completion' },
  { value: 'form', label: 'Form Completion' },
  { value: 'true_false', label: 'True/False' },
  { value: 'multiple_response', label: 'Multiple Response' },
];

const convertFileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const createGroupItem = (seed = '') => {
  const id = `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}${seed}`;
  return {
    id,
    prompt: '',
    options: [
      { label: 'A', text: '' },
      { label: 'B', text: '' },
      { label: 'C', text: '' },
      { label: 'D', text: '' },
    ],
    correct_answer: 'A',
    points: 1,
  };
};

const initialTest = {
  title: 'New Listening Test',
  is_active: false,
  explanation_url: '',
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
            { text: '', label: 'A' },
            { text: '', label: 'B' },
            { text: '', label: 'C' },
            { text: '', label: 'D' }
          ],
          answer: 0,
          correct_answers: ['C'],
          image: '',
          audio_start: 0,
          audio_end: 30
        },
      ],
    },
  ],
};

// Helper function to get image URL
const getImageUrl = (img) => {
  if (!img) return null;
  if (img.startsWith('http://') || img.startsWith('https://') || img.startsWith('data:')) {
    return img;
  }
  if (img.startsWith('/media/')) {
    return img;
  }
  if (img.startsWith('/')) {
    return img;
  }
  return `/media/${img}`;
};

function normalizeTestFromAPI(apiTest) {
  return {
    ...apiTest,
    explanation_url: apiTest.explanation_url || '',
    parts: (apiTest.parts || []).map((part, idx) => ({
      ...part,
      id: part.id && typeof part.id === 'string' ? part.id : `part-${part.part_number || Math.random()}`,
      title: part.title || `Part ${part.part_number || idx + 1}`,
      questions: Array.isArray(part.questions) ? part.questions.map((q, qIdx) => {
        const normalizedType = q.type || q.question_type || '';
        let gaps = Array.isArray(q.gaps) ? q.gaps : (q.extra_data && Array.isArray(q.extra_data.gaps) ? q.extra_data.gaps : []);
        if (normalizedType === 'gap_fill') {
          if ((!gaps || gaps.length === 0) && Array.isArray(q.correct_answers) && q.correct_answers.length > 0) {
            const gapRegex = /\[\[(\d+)\]\]/g;
            const matches = [...(q.text || q.question_text || '').matchAll(gapRegex)];
            gaps = matches.map((m, idx) => ({ number: parseInt(m[1], 10), answer: q.correct_answers[idx] || '' }));
          }
        } else if ([
          'sentence_completion',
          'summary_completion',
          'note_completion',
          'flow_chart'
        ].includes(normalizedType) && (!gaps || gaps.length === 0)) {
          const ca = q.correct_answers || (q.extra_data && q.extra_data.correct_answers) || q.answers || [];
          if (Array.isArray(ca) && ca.length > 0) {
            gaps = ca.map(a => typeof a === 'object' && a !== null ? a : { answer: a });
          }
        }
        return {
          ...q,
          id: q.id || `q-${Math.random()}`,
          type: normalizedType,
          text: q.text || q.question_text || '',
          task_prompt: q.task_prompt || (q.extra_data?.task_prompt ?? ''),
          image_remove: false,
          image_base64: null,
          image_original: (q.image && !q.image.startsWith('data:')) ? q.image : '',
          group_items: Array.isArray(q.extra_data?.group_items)
            ? q.extra_data.group_items.map((item, itemIdx) => {
                const itemId = item.id || `item-${q.id || qIdx}-${itemIdx}`;
                const optionsArray = Array.isArray(item.options) ? item.options : [];
                return {
                  id: itemId,
                  prompt: item.prompt || '',
                  points: item.points ?? 1,
                  correct_answer: item.correct_answer || (optionsArray[0]?.label || 'A'),
                  options: optionsArray.map((opt, optIdx) => ({
                    label: opt.label || String.fromCharCode(65 + optIdx),
                    text: opt.text || ''
                  }))
                };
              })
            : [],
          options: Array.isArray(q.options)
            ? q.options.map((opt, idx) => {
                if (typeof opt === 'string') {
                  return {
                    text: opt,
                    label: String.fromCharCode(65 + idx),
                  };
                }
                return {
                  ...opt,
                  label: opt.label || String.fromCharCode(65 + idx),
                };
              })
            : [],
          correct_answers: q.correct_answers || (q.extra_data && q.extra_data.correct_answers) || [],
          extra_data: q.extra_data || {},
          table: q.table || (normalizedType === 'table' && q.extra_data && q.extra_data.table) || undefined,
          fields: q.fields || (q.extra_data && q.extra_data.fields) || undefined,
          gaps,
          left: q.left || (q.extra_data && q.extra_data.left) || undefined,
          right: q.right || (q.extra_data && q.extra_data.right) || undefined,
          answers: q.answers || (q.extra_data && q.extra_data.answers) || undefined,
          points: q.points || (q.extra_data && q.extra_data.points) || undefined,
          scoring_mode: q.scoring_mode || (q.extra_data && q.extra_data.scoring_mode) || 'total',
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
    } else if (testId === 'new') {
      setTest(initialTest);
      setIsNewTest(true);
    }
  }, [testId]);

  const loadExistingTest = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/listening-tests/${testId}/`);
      setTest(normalizeTestFromAPI(response.data));
      setIsNewTest(false);
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to load test', severity: 'error' });
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
    const questions = parts[partIdx].questions || [];
    questions.push({
      id: `q-${Date.now()}`,
      type: 'multiple_choice',
      text: '',
      task_prompt: '',
      options: [
        { text: '', label: 'A' },
        { text: '', label: 'B' },
        { text: '', label: 'C' },
        { text: '', label: 'D' }
      ],
      answer: 0,
      image: '',
      image_base64: null,
      image_remove: false,
      image_original: '',
      audio_start: 0,
      audio_end: 30,
    });
    parts[partIdx].questions = questions;
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
        const response = await api.post('/admin/audio/upload/', formData, {
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'multipart/form-data',
          },
        });
        const data = response.data;
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
      const base = { type: newType, text: '', task_prompt: '', image: '', image_base64: null, image_remove: false, audio_start: 0, audio_end: 30 };
      if (newType === 'multiple_choice') {
        base.options = [
          { text: '', label: 'A' },
          { text: '', label: 'B' },
        ];
        base.answer = 'A';
        base.correct_answers = ['A'];
      }
      if (newType === 'multiple_choice_group') {
        const firstItem = createGroupItem();
        base.group_items = [firstItem];
      }
      if (newType === 'multiple_response') {
        base.options = [
          { text: '', label: 'A', points: 1, isCorrect: false },
          { text: '', label: 'B', points: 1, isCorrect: false },
        ];
        base.answer = [];
        base.correct_answers = [];
        base.scoring_mode = 'total';
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
        multiline
        minRows={2}
        label="Header (optional)"
        value={question.header || ''}
        onChange={e => updateQ({ header: e.target.value })}
        sx={{ mb: 2 }}
        placeholder="Введите заголовок, можно с абзацами и переносами строк"
      />
      <TextField
        fullWidth
        multiline
        minRows={2}
        label="Instruction (optional)"
        value={question.instruction || ''}
        onChange={e => updateQ({ instruction: e.target.value })}
        sx={{ mb: 2 }}
        placeholder="Введите инструкцию, можно с абзацами и переносами строк"
      />
      <TextField
        fullWidth
        multiline
        minRows={2}
        label="Task Prompt (optional)"
        value={question.task_prompt || ''}
        onChange={e => updateQ({ task_prompt: e.target.value })}
        sx={{ mb: 2 }}
        placeholder="Введите текст задания, который увидит студент перед вопросом"
      />
      {/* Новый блок для ввода URL картинки */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Question Image (optional)</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            component="label"
            startIcon={<UploadIcon />}
          >
            Upload image
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const base64 = await convertFileToBase64(file);
                  updateQ({ image: base64, image_base64: base64, image_remove: false });
                } catch (error) {
                  console.error('Failed to read image file', error);
                  alert('Failed to read image file');
                } finally {
                  e.target.value = '';
                }
              }}
            />
          </Button>
          {(question.image || question.image_original) && !question.image_remove && (
            <Button
              variant="text"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => updateQ({ image: '', image_base64: 'null', image_remove: true })}
            >
              Remove image
            </Button>
          )}
        </Box>
        {(() => {
          const previewSrc = question.image
            ? getImageUrl(question.image)
            : (!question.image_remove && question.image_original
                ? getImageUrl(question.image_original)
                : null);
          if (!previewSrc) return null;
          return (
            <Box sx={{ mt: 1 }}>
              <img
                src={previewSrc}
                alt="Question"
                style={{ width: '100%', maxWidth: 320, height: 'auto', display: 'block', border: '1px solid #ccc', borderRadius: 6 }}
              />
            </Box>
          );
        })()}
      </Box>
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
                    <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, border: '1px solid #e5e7eb', borderRadius: 2 }}>
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
                      <Button
                        variant={question.answer === (option.label || String.fromCharCode(65 + idx)) ? 'contained' : 'outlined'}
                        color="success"
                        size="small"
                        onClick={() => updateQ({
                          answer: option.label || String.fromCharCode(65 + idx),
                          correct_answers: [option.label || String.fromCharCode(65 + idx)],
                          extra_data: {
                            ...(question.extra_data || {}),
                            answer: option.label || String.fromCharCode(65 + idx)
                          }
                        })}
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
                <Button
                  size="small"
                  onClick={() => updateQ({
                    options: [
                      ...safeOptions,
                      {
                        text: '',
                        label: String.fromCharCode(65 + safeOptions.length),
                      },
                    ],
                  })}
                  startIcon={<AddIcon />}
                  sx={{ mt: 2 }}
                >
                  Add Option
                </Button>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditingQuestion(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      );
    }

    if (question.type === 'multiple_choice_group') {
      const groupItems = Array.isArray(question.group_items) ? question.group_items : [];
      const updateGroupItems = (items) => updateQ({ group_items: items });

      const updateItem = (idx, updates) => {
        const items = [...groupItems];
        items[idx] = { ...items[idx], ...updates };
        updateGroupItems(items);
      };

      const updateOption = (itemIdx, optIdx, value) => {
        const items = [...groupItems];
        const item = items[itemIdx];
        const options = [...(item.options || [])];
        options[optIdx] = { ...options[optIdx], text: value };
        items[itemIdx] = { ...item, options };
        updateGroupItems(items);
      };

      const addOption = (itemIdx) => {
        const items = [...groupItems];
        const item = items[itemIdx];
        const options = [...(item.options || [])];
        const label = String.fromCharCode(65 + options.length);
        options.push({ label, text: '' });
        const correct = item.correct_answer || 'A';
        items[itemIdx] = {
          ...item,
          options,
          correct_answer: correct && options.find(opt => opt.label === correct) ? correct : 'A'
        };
        updateGroupItems(items);
      };

      const removeOption = (itemIdx, optIdx) => {
        const items = [...groupItems];
        const item = items[itemIdx];
        let options = [...(item.options || [])];
        if (options.length <= 2) return;
        const removedLabel = options[optIdx].label;
        options = options.filter((_, i) => i !== optIdx).map((opt, index) => ({
          ...opt,
          label: String.fromCharCode(65 + index)
        }));
        let correctAnswer = item.correct_answer;
        if (correctAnswer === removedLabel) {
          correctAnswer = options[0]?.label || '';
        }
        items[itemIdx] = { ...item, options, correct_answer: correctAnswer };
        updateGroupItems(items);
      };

      const addItem = () => {
        updateGroupItems([...(groupItems || []), createGroupItem()]);
      };

      const removeItem = (idx) => {
        const items = groupItems.filter((_, i) => i !== idx);
        updateGroupItems(items);
      };

      return (
        <Dialog open={!!editingQuestion} onClose={() => setEditingQuestion(null)} maxWidth="md" fullWidth>
          <DialogTitle>Edit Multiple Choice Group</DialogTitle>
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

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {groupItems.map((item, itemIdx) => (
                <Card key={item.id || itemIdx} variant="outlined">
                  <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="subtitle1">Question {itemIdx + 1}</Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                          label="Points"
                          type="number"
                          size="small"
                          sx={{ width: 100 }}
                          value={item.points ?? 1}
                          onChange={(e) => updateItem(itemIdx, { points: Number(e.target.value) || 1 })}
                          inputProps={{ min: 0.5, step: 0.5 }}
                        />
                        <IconButton onClick={() => removeItem(itemIdx)} size="small" disabled={groupItems.length <= 1}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>

                    <TextField
                      label="Prompt"
                      multiline
                      minRows={2}
                      value={item.prompt || ''}
                      onChange={e => updateItem(itemIdx, { prompt: e.target.value })}
                      placeholder="Enter the sub-question text shown to students"
                    />

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Typography variant="subtitle2">Options:</Typography>
                      {Array.isArray(item.options) && item.options.map((opt, optIdx) => (
                        <Box key={opt.label || optIdx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TextField
                            label={`Option ${opt.label || String.fromCharCode(65 + optIdx)}`}
                            value={opt.text || ''}
                            onChange={e => updateOption(itemIdx, optIdx, e.target.value)}
                            size="small"
                            sx={{ flex: 1 }}
                          />
                          <FormControlLabel
                            control={
                              <Radio
                                checked={(item.correct_answer || 'A') === (opt.label || String.fromCharCode(65 + optIdx))}
                                onChange={() => updateItem(itemIdx, { correct_answer: opt.label || String.fromCharCode(65 + optIdx) })}
                              />
                            }
                            label="Correct"
                          />
                          <IconButton onClick={() => removeOption(itemIdx, optIdx)} size="small" disabled={(item.options || []).length <= 2}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ))}
                      <Button size="small" startIcon={<AddIcon />} onClick={() => addOption(itemIdx)}>
                        Add Option
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              ))}
              <Button variant="outlined" startIcon={<AddIcon />} onClick={addItem}>
                Add Sub-question
              </Button>
            </Box>
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
                      src={getImageUrl(question.image)}
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
                      helperText="Use | for alternatives"
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
      let table = question.table || { rows: 2, cols: 2, cells: [[{ text: '' }]] };
      
      if (table.cells) {
        table = {
          ...table,
          cells: table.cells.map(row => 
            row.map(cell => {
              if (cell.parts && Array.isArray(cell.parts)) {
                const textParts = cell.parts.map(part => {
                  if (part.type === 'gap') {
                    return `[[${part.number || part.answer || ''}]]`;
                  } else {
                    return part.content || part.text || '';
                  }
                });
                return { text: textParts.join('') };
              } else if (cell.isAnswer) {
                return { text: `[[${cell.label || '1'}]]` };
              } else {
                return { text: cell.text || '' };
              }
            })
          )
        };
      }
      
      const setTable = (newTable) => updateQ({ table: newTable });
      // Добавляю функцию для обновления ячеек таблицы
      const handleCellChange = (r, c, value) => {
        const newTable = { ...table };
        newTable.cells = newTable.cells.map((row, rowIdx) =>
          rowIdx === r
            ? row.map((cell, colIdx) => {
                if (colIdx === c) {
                  return { text: value || '' };
                }
                return cell;
              })
            : row
        );
        setTable(newTable);
      };

      const parseGapsFromCell = (cellText) => {
        const gapRegex = /\[\[(\d+)\]\]/g;
        const matches = [...(cellText?.matchAll(gapRegex) || [])];
        return matches.map(m => parseInt(m[1], 10));
      };
      const addRow = () => {
        const newRow = Array(table.cols).fill(0).map(() => ({ text: '' }));
        setTable({ ...table, rows: table.rows + 1, cells: [...table.cells, newRow] });
      };
      const addCol = () => {
        const newCells = table.cells.map(row => [...row, { text: '' }]);
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
                          {row.map((cell, c) => {
                            const cellText = cell.text || '';
                            const gapsInCell = parseGapsFromCell(cellText);
                            return (
                              <td key={c} style={{ border: '1px solid #ccc', padding: 6, minWidth: 200, position: 'relative' }}>
                                <Box display="flex" flexDirection="column" gap={1}>
                                  <TextField
                                    fullWidth
                                    value={cellText}
                                    onChange={e => handleCellChange(r, c, e.target.value)}
                                    size="small"
                                    placeholder="Cell text (use [[14]], [[25]] for gaps)"
                                    helperText={gapsInCell.length > 0 ? `Gaps found: ${gapsInCell.join(', ')}` : 'Use [[number]] syntax for gaps, HTML tags supported'}
                                    multiline
                                    rows={3}
                                  />
                                  {gapsInCell.length > 0 && (
                                    <Box sx={{ mt: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                                      <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 'bold' }}>
                                        Answers for gaps in this cell:
                                      </Typography>
                                      {gapsInCell.map(gapNum => {
                                        const gapObj = (question.gaps || []).find(g => g.number === gapNum) || { number: gapNum, answer: '' };
                                        return (
                                          <TextField
                                            key={gapNum}
                                            size="small"
                                            label={`Gap [[${gapNum}]]`}
                                            value={gapObj.answer || ''}
                                            onChange={e => {
                                              const currentGaps = question.gaps || [];
                                              const existingIdx = currentGaps.findIndex(g => g.number === gapNum);
                                              let newGaps;
                                              if (existingIdx >= 0) {
                                                newGaps = [...currentGaps];
                                                newGaps[existingIdx] = { ...newGaps[existingIdx], answer: e.target.value };
                                              } else {
                                                newGaps = [...currentGaps, { number: gapNum, answer: e.target.value }];
                                              }
                                              updateQ({ gaps: newGaps });
                                            }}
                                            sx={{ mb: 1, width: '100%' }}
                                            helperText="Use | for alternatives (e.g., '7 | seven')"
                                          />
                                        );
                                      })}
                                    </Box>
                                  )}
                                </Box>
                              </td>
                            );
                          })}
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
          <DialogTitle>Edit Gap Fill Question</DialogTitle>
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
            <Typography variant="subtitle2" gutterBottom>
              Use <b>[[7]], [[8]], ...</b> to mark each gap in the text.
            </Typography>
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
                      helperText="Use | for alternatives (e.g., '1 | one year')"
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
                  helperText="Use | for alternatives (e.g., '1 | one year')"
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
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Scoring Mode</InputLabel>
                  <Select
                    value={question.scoring_mode || 'total'}
                    label="Scoring Mode"
                    onChange={e => updateQ({ scoring_mode: e.target.value })}
                  >
                    <MenuItem value="total">Total Points (1 балл за весь вопрос)</MenuItem>
                    <MenuItem value="per_correct">Per Correct Answer (баллы за каждый правильный)</MenuItem>
                  </Select>
                </FormControl>
                
                {question.scoring_mode === 'total' ? (
                  <TextField
                    fullWidth
                    type="number"
                    label="Баллы за весь вопрос"
                    value={question.points || 1}
                    onChange={e => updateQ({ points: Number(e.target.value) })}
                    sx={{ mb: 2 }}
                    inputProps={{ min: 1, max: 10 }}
                  />
                ) : (
                  <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
                    Баллы за каждый правильный ответ настраиваются в опциях ниже
                  </Typography>
                )}
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>Options:</Typography>
                {Array.isArray(question.options) && question.options.length > 0 ? question.options.map((option, idx) => {
                  const isSelected = answerArr.includes(option.label || String.fromCharCode(65 + idx));
                  return (
                    <Box display="flex" alignItems="center" gap={1} key={idx}>
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
                    {question.scoring_mode === 'per_correct' && (
                      <TextField
                        label="Points"
                        type="number"
                        value={option.points || 1}
                        onChange={e => {
                          const newOptions = [...question.options];
                          newOptions[idx].points = Number(e.target.value);
                          updateQ({ options: newOptions });
                        }}
                        size="small"
                        sx={{ width: 80 }}
                        inputProps={{ min: 1, max: 10 }}
                      />
                    )}
                    <Button
                        variant={isSelected ? 'contained' : 'outlined'}
                      color="success"
                      size="small"
                      onClick={() => {
                          const label = option.label || String.fromCharCode(65 + idx);
                          let newAnswer;
                          if (isSelected) {
                            newAnswer = answerArr.filter(a => a !== label);
                          } else {
                            newAnswer = [...answerArr, label];
                          }
                          const newOptions = question.options.map((opt, i) =>
                            i === idx ? { ...opt, isCorrect: !isSelected } : opt
                          );
                          updateQ({
                            answer: newAnswer,
                            correct_answers: newAnswer,
                            options: newOptions.map(opt => ({
                              ...opt,
                              isCorrect: newAnswer.includes(opt.label || String.fromCharCode(65 + question.options.indexOf(opt)))
                            }))
                          });
                      }}
                      sx={{ minWidth: 90 }}
                    >
                        {isSelected ? 'Selected' : 'Select'}
                    </Button>
                    <IconButton onClick={() => {
                      const newOptions = question.options.filter((_, i) => i !== idx);
                      updateQ({ options: newOptions });
                    }} size="small"><DeleteIcon /></IconButton>
                  </Box>
                  );
                }) : <Typography color="text.secondary">No options yet</Typography>}
              </Grid>
            </Grid>
            <Button size="small" onClick={() => updateQ({ options: [...(question.options || []), { text: '', label: String.fromCharCode(65 + (question.options?.length || 0)), points: 1, isCorrect: false }] })} startIcon={<AddIcon />}>Add Option</Button>
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
                    {question.image && (
                      <Box sx={{ width: '100%', mb: 2, display: 'flex', justifyContent: 'center' }}>
                        <img
                          src={getImageUrl(question.image)}
                          alt="Question"
                          style={{ width: '100%', maxWidth: 700, height: 'auto', display: 'block', margin: '16px auto', borderRadius: 12, boxShadow: '0 2px 12px #0002' }}
                        />
                      </Box>
                    )}
                    <Button
                      variant={question.answer === (option.label || String.fromCharCode(65 + idx)) ? 'contained' : 'outlined'}
                      color="success"
                      size="small"
                      onClick={() => updateQ({
                        answer: option.label || String.fromCharCode(65 + idx),
                        correct_answers: [option.label || String.fromCharCode(65 + idx)],
                        extra_data: {
                          ...(question.extra_data || {}),
                          answer: option.label || String.fromCharCode(65 + idx)
                        }
                      })}
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
                helperText="Use | for alternatives (e.g., '1 | one year')"
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
                <Box sx={{ minWidth: 500, width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <img
                    src={getImageUrl(question.image)}
                    alt="Question"
                    style={{ width: '100%', maxWidth: 700, height: 'auto', display: 'block', margin: '16px auto', borderRadius: 12, boxShadow: '0 2px 12px #0002' }}
                  />
                </Box>
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
                      Replace audio
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
                    Add audio
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
                  <img
                    src={getImageUrl(part.image)}
                    alt="Section"
                    style={{ width: '100%', maxWidth: 700, height: 'auto', display: 'block', margin: '16px auto', borderRadius: 12, boxShadow: '0 2px 12px #0002' }}
                  />
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
        ...(part.id ? { id: part.id } : {}),
        part_number: partIdx + 1,
        title: part.title,
        audio: typeof part.audio === 'string' ? part.audio : (Array.isArray(part.audio) ? part.audio[0] || '' : ''),
        image: part.image || '',
        questions: (part.questions || [])
          .filter(q => {
            if (!q) return false;
            // Для типов, где text обязателен
            if ([
              'multiple_choice',
              'short_answer',
              'true_false'
            ].includes(q.type)) {
              return q.text && q.text.trim() !== '';
            }
            // Для multiple_response и остальных типов — не обязательно
            return true;
          })
          .map((q, qIdx) => {
          // Всегда включаем header и instruction для любого типа
          let imageValue = q.image || '';
          let imageBase64 = q.image_base64 != null ? q.image_base64 : null;
          if (imageValue && imageValue.startsWith('data:')) {
            if (imageBase64 == null) {
              imageBase64 = imageValue;
            }
            imageValue = '';
          }
          if (q.image_remove) {
            imageBase64 = 'null';
            imageValue = '';
          }
          const base = {
            order: qIdx + 1,
            question_type: q.type || q.question_type,
            question_text: q.text || q.question_text,
            task_prompt: q.task_prompt || '',
            image: imageValue,
            audio_start: q.audio_start || 0,
            audio_end: q.audio_end || 30,
            header: q.header || '',
            instruction: q.instruction || '',
          };
          if (q.id) {
            base.id = q.id;
          }
          if (imageBase64) {
            base.image_base64 = imageBase64;
          }
          if (!base.extra_data || typeof base.extra_data !== 'object') {
            base.extra_data = {};
          }
          base.extra_data.task_prompt = base.task_prompt || '';

          if (q.type === 'multiple_choice_group') {
            const itemsPayload = (q.group_items || []).map((item, itemIdx) => {
              const options = Array.isArray(item.options) ? item.options : [];
              return {
                id: item.id || `item-${q.id || qIdx}-${itemIdx}`,
                prompt: item.prompt || '',
                points: Number(item.points) || 1,
                correct_answer: item.correct_answer || (options[0]?.label || 'A'),
                options: options.map((opt, optIdx) => ({
                  label: opt.label || String.fromCharCode(65 + optIdx),
                  text: opt.text || ''
                }))
              };
            });
            base.extra_data = { ...(base.extra_data || {}), group_items: itemsPayload };
            base.points = itemsPayload.reduce((sum, item) => sum + (Number(item.points) || 1), 0);
          }
          // Multiple Choice
          if (q.type === 'multiple_choice') {
            const optionSource = Array.isArray(q.options) && q.options.length
              ? q.options
              : (Array.isArray(q.extra_data?.options) ? q.extra_data.options : []);
            base.options = optionSource.map((opt, i) => {
              const optObj = typeof opt === 'string' ? { text: opt } : opt || {};
              const label = optObj.label || String.fromCharCode(65 + i);
              const optionPayload = {
                id: optObj.id || label,
                label,
                text: optObj.text || '',
              };
              return optionPayload;
            });
            let answerLabel = 'A';
            if (typeof q.answer === 'number') {
              answerLabel = String.fromCharCode(65 + q.answer);
            } else if (typeof q.answer === 'string' && q.answer.trim() !== '') {
              answerLabel = q.answer;
            } else if (Array.isArray(q.correct_answers) && q.correct_answers.length > 0) {
              answerLabel = q.correct_answers[0];
            }
            base.correct_answers = [answerLabel];
            base.extra_data = {
              ...(q.extra_data || {}),
              options: base.options.map(({ id, label, text }) => ({ id, label, text })),
              answer: answerLabel,
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
            const gapRegex = /\[\[(\d+)\]\]/g;
            const allGaps = new Set();
            if (q.table && q.table.cells) {
              q.table.cells.forEach(row => {
                row.forEach(cell => {
                  const cellText = cell.text || '';
                  const matches = [...(cellText.matchAll(gapRegex) || [])];
                  matches.forEach(m => allGaps.add(parseInt(m[1], 10)));
                });
              });
            }
            const gapsArray = Array.from(allGaps).sort((a, b) => a - b).map(gapNum => {
              const existingGap = (q.gaps || []).find(g => g.number === gapNum);
              return existingGap || { number: gapNum, answer: '' };
            });
            base.gaps = gapsArray;
            base.extra_data = {
              ...(q.extra_data || {}),
              table: q.table,
              gaps: gapsArray,
            };
            base.correct_answers = gapsArray.map(g => ({
              id: `gap${g.number}`,
              answer: g.answer || ''
            }));
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
            const optionSource = Array.isArray(q.options) && q.options.length
              ? q.options
              : (Array.isArray(q.extra_data?.options) ? q.extra_data.options : []);
            base.options = optionSource.map((opt, i) => {
              const optObj = typeof opt === 'string' ? { text: opt } : opt || {};
              const label = optObj.label || String.fromCharCode(65 + i);
              const isCorrect = optObj.is_correct ?? optObj.isCorrect ?? (Array.isArray(q.correct_answers) && q.correct_answers.includes(label));
              const optionPayload = {
                id: optObj.id || label,
                label,
                text: optObj.text || '',
                points: optObj.points != null ? optObj.points : 1,
                isCorrect,
              };
              return optionPayload;
            });
            base.correct_answers = Array.isArray(q.correct_answers) && q.correct_answers.length > 0
              ? q.correct_answers
              : base.options.filter(opt => opt.isCorrect).map(opt => opt.label);
            base.answer = Array.isArray(q.answer) ? q.answer : [];
            base.points = q.points || 1;
            base.scoring_mode = q.scoring_mode || 'total';
            base.extra_data = {
              ...(q.extra_data || {}),
              options: base.options.map(({ id, label, text, points, isCorrect }) => ({ id, label, text, points, is_correct: isCorrect })),
              answer: base.answer,
              scoring_mode: base.scoring_mode,
            };
          }
          // Gap Fill (универсальный)
          if (q.type === 'gap_fill') {
            base.gaps = q.gaps || [];
              // Дублируем gaps в correct_answers для обратной совместимости
              base.correct_answers = (q.gaps || []).map(g => g.answer !== undefined ? g.answer : g);
            base.extra_data = {
              ...(q.extra_data || {}),
              gaps: q.gaps,
            };
          }
          if (q.group_items) {
            delete base.group_items;
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
      const method = isNewTest ? 'post' : 'put';
      const url = isNewTest ? '/listening-tests/' : `/listening-tests/${testId}/`;
      const apiTest = {
        ...transformTestForAPI(test),
        explanation_url: test.explanation_url || ''
      };
      let response;
      if (isNewTest) {
        response = await api.post(url, apiTest);
      } else {
        response = await api.put(url, apiTest);
      }
      setTest(normalizeTestFromAPI(response.data));
      setSnackbar({ open: true, message: 'Test saved', severity: 'success' });
      setTimeout(() => navigate('/admin/listening'), 800);
      setIsNewTest(false);
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to save test', severity: 'error' });
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
                  <img
                    src={getImageUrl(question.image)}
                    alt="Question"
                    style={{ width: '100%', maxWidth: 700, height: 'auto', display: 'block', margin: '16px auto', borderRadius: 12, boxShadow: '0 2px 12px #0002' }}
                  />
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
                        checked={previewAnswers[`${question.id}__${idx}`] === option.text}
                        onChange={(e) => handleAnswerChange(`${question.id}__${idx}`, e.target.value)}
                      />
                    }
                    label={option.text}
                  />
                ))}
              </FormControl>
            </Box>
          );

        case 'multiple_choice_group':
          return (
            <Box key={question.id} sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Question {qIdx + 1}
              </Typography>
              {Array.isArray(question.group_items) && question.group_items.map((item, idx) => (
                <Box key={item.id || idx} sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    {item.prompt || `Item ${idx + 1}`}
                  </Typography>
                  {(item.options || []).map((option, optIdx) => (
                    <FormControlLabel
                      key={optIdx}
                      control={<Radio disabled size="small" />}
                      label={`${option.label}. ${option.text}`}
                    />
                  ))}
                  <Typography variant="caption" color="text.secondary">
                    Correct: {item.correct_answer}
                  </Typography>
                </Box>
              ))}
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
                  <img
                    src={getImageUrl(question.image)}
                    alt="Question"
                    style={{ width: '100%', maxWidth: 700, height: 'auto', display: 'block', margin: '16px auto', borderRadius: 12, boxShadow: '0 2px 12px #0002' }}
                  />
                </Box>
              )}
              <TextField
                fullWidth
                label="Your answer"
                value={previewAnswers[`${question.id}__${qIdx}`] || ''}
                onChange={(e) => handleAnswerChange(`${question.id}__${qIdx}`, e.target.value)}
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
                  <img
                    src={getImageUrl(question.image)}
                    alt="Question"
                    style={{ width: '100%', maxWidth: 700, height: 'auto', display: 'block', margin: '16px auto', borderRadius: 12, boxShadow: '0 2px 12px #0002' }}
                  />
                </Box>
              )}
              <FormControl component="fieldset">
                <FormControlLabel
                  control={
                    <input
                      type="radio"
                      name={question.id}
                      value="true"
                      checked={previewAnswers[`${question.id}__true`] === 'true'}
                      onChange={(e) => handleAnswerChange(`${question.id}__true`, e.target.value)}
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
                      checked={previewAnswers[`${question.id}__false`] === 'false'}
                      onChange={(e) => handleAnswerChange(`${question.id}__false`, e.target.value)}
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
                  <img
                    src={getImageUrl(question.image)}
                    alt="Question"
                    style={{ width: '100%', maxWidth: 700, height: 'auto', display: 'block', margin: '16px auto', borderRadius: 12, boxShadow: '0 2px 12px #0002' }}
                  />
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
                          handleAnswerChange(`${question.id}__${option.text}`, newAnswer);
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
                  <img
                    src={getImageUrl(question.image)}
                    alt="Question"
                    style={{ width: '100%', maxWidth: 700, height: 'auto', display: 'block', margin: '16px auto', borderRadius: 12, boxShadow: '0 2px 12px #0002' }}
                  />
                </Box>
              )}
              <TextField
                fullWidth
                label="Your answer"
                value={previewAnswers[`${question.id}__${qIdx}`] || ''}
                onChange={(e) => handleAnswerChange(`${question.id}__${qIdx}`, e.target.value)}
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
                <img
                  src={getImageUrl(currentPart.image)}
                  alt="Section"
                  style={{ width: '100%', maxWidth: 700, height: 'auto', display: 'block', margin: '16px auto', borderRadius: 12, boxShadow: '0 2px 12px #0002' }}
                />
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

      <TextField
        fullWidth
        label="Explanation URL (YouTube)"
        placeholder="https://www.youtube.com/watch?v=..."
        value={test.explanation_url || ''}
        onChange={(e) => setTest({ ...test, explanation_url: e.target.value })}
        sx={{ mb: 2 }}
      />

      <Button variant="contained" startIcon={<AddIcon />} onClick={addSection} sx={{ mb: 2 }}>
        Add Section
      </Button>

      {test.parts.map((part, partIdx) => (
        <Card key={part.id} sx={{ mb: 2 }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="h6">{part.title}</Typography>
              <Box>
                <IconButton onClick={() => setEditingPart(partIdx)}>
                  <EditIcon />
                </IconButton>
              </Box>
            </Box>
            {/* --- ДОБАВЛЯЕМ ЗАГРУЗКУ АУДИО --- */}
            <Box sx={{ mt: 2 }}>
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
                    Replace audio
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
                  Add audio
                  <input
                    type="file"
                    accept="audio/*"
                    hidden
                    onChange={e => e.target.files[0] && handleFileUpload(e.target.files[0], 'audio', partIdx)}
                  />
                </Button>
              )}
            </Box>
            {/* --- КОНЕЦ ДОБАВЛЕНИЯ --- */}
          {part.questions.map((question, qIdx) => (
            <Paper key={question.id} sx={{ p: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1">Q{qIdx + 1}</Typography>
                <Typography variant="body2" color="text.secondary">{question.text?.slice(0, 80) || 'Без текста'}</Typography>
              </Box>
              <IconButton onClick={() => setEditingQuestion({ partIdx, qIdx })}><EditIcon /></IconButton>
              <IconButton onClick={() => removeQuestion(partIdx, qIdx)}><DeleteIcon /></IconButton>
              </Paper>
            ))}
          <Button onClick={() => addQuestion(partIdx)} startIcon={<AddIcon />}>Add Question</Button>
          </CardContent>
        </Card>
      ))}

      {editingQuestion && renderQuestionEditor(
        test.parts[editingQuestion.partIdx].questions[editingQuestion.qIdx],
        editingQuestion.partIdx,
        editingQuestion.qIdx
      )}
      {editingPart !== null && renderPartEditor(test.parts[editingPart], editingPart)}
      {showPreview && <PreviewDialog />}
    </Box>
  );
};

export default AdminListeningTestBuilder;