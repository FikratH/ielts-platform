import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Button, Paper, Typography, Box, IconButton, TextField, 
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel,
  Grid, Card, CardContent, Chip, Divider, Alert, Snackbar, CircularProgress,
  RadioGroup, Radio, Checkbox
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { auth } from '../firebase';
import api from '../api';

// IELTS Reading question types
const QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'multiple_response', label: 'Multiple Response' },
  { value: 'gap_fill', label: 'Gap Fill (Summary, etc.)' },
  { value: 'table', label: 'Table Completion' },
  { value: 'matching', label: 'Matching' },
  { value: 'true_false_not_given', label: 'True/False/Not Given' },
];

const initialTest = {
  title: 'New Reading Test',
  description: '',
  is_active: false,
  time_limit: 60, // Default time limit in minutes
  parts: [],
};

const getDefaultExtraData = (type) => {
    switch (type) {
        case 'multiple_choice':
            return { options: [{ text: 'Option 1', is_correct: false }] };
        case 'multiple_response':
            return { 
                options: [
                    { text: 'Option 1', is_correct: false, reading_points: 1 }, 
                    { text: 'Option 2', is_correct: false, reading_points: 1 }
                ] 
            };
        case 'gap_fill':
            return { answers: { '1': '' } };
        case 'table':
            return {
                headers: ['Header 1', 'Header 2'],
                rows: [
                    ['Cell 1.1', 'Cell 1.2'],
                    ['Cell 2.1', 'Cell 2.2'],
                ],
            };
        case 'matching':
            return {
                items: [{ text: 'Item 1' }],
                options: [{ text: 'Option A' }],
                answers: {} // Format: { "Item 1 text": "Option A text" }
            };
        case 'true_false_not_given':
            return {
                statements: ['Statement 1'],
                answers: ['True']
            };
        default:
            return {};
    }
};


const AdminReadingTestBuilder = () => {
    const { testId } = useParams();
    const navigate = useNavigate();
    const [test, setTest] = useState(initialTest);
    const [loading, setLoading] = useState(false);
    const [isNewTest, setIsNewTest] = useState(!testId);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [editingQuestion, setEditingQuestion] = useState(null); // {partIdx, qIdx, question}
    const addQuestionDebounce = useRef(0);


    const loadExistingTest = useCallback(async () => {
        if (!testId || testId === 'new') {
            setIsNewTest(true);
            setTest(initialTest);
            return;
        }
        
        setIsNewTest(false);
        setLoading(true);
        try {
            const response = await api.get(`/reading-tests/${testId}/`);
            const data = response.data;
            const normalizedParts = data.parts.map(part => ({
                ...part,
                questions: part.questions.map(q => ({
                    ...q,
                    // Ensure extra_data exists and has a default structure if not
                    extra_data: q.extra_data || getDefaultExtraData(q.question_type),
                    // Ensure reading_scoring_type exists for multiple_response
                    reading_scoring_type: q.reading_scoring_type || 'all_or_nothing'
                }))
            }));
            setTest({ ...data, parts: normalizedParts });
        } catch (error) {
            console.error('Error loading test:', error);
            setSnackbar({ open: true, message: 'An error occurred while loading the test.', severity: 'error' });
        } finally {
            setLoading(false);
        }
    }, [testId]);

    useEffect(() => {
        loadExistingTest();
    }, [loadExistingTest]);
    
    const handleTestChange = (field, value) => {
        setTest(prev => ({ ...prev, [field]: value }));
    };

    const handlePartChange = (partIdx, field, value) => {
        setTest(prev => {
            const newParts = [...prev.parts];
            newParts[partIdx] = { ...newParts[partIdx], [field]: value };
            return { ...prev, parts: newParts };
        });
    };

    const addPart = () => {
        setTest(prev => ({
            ...prev,
            parts: [...prev.parts, { 
                part_number: prev.parts.length + 1, 
                title: `Part ${prev.parts.length + 1}`,
                passage_text: '',
                questions: [] 
            }]
        }));
    };
    
    const removePart = (partIdx) => {
        setTest(prev => ({
            ...prev,
            parts: prev.parts.filter((_, index) => index !== partIdx)
        }));
    };

    const addQuestion = (partIdx) => {
        const newQuestionData = {
            id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            question_type: 'multiple_choice',
            header: '',
            instruction: '',
            question_text: 'New Question',
            points: 1,
            reading_scoring_type: 'all_or_nothing',
            extra_data: getDefaultExtraData('multiple_choice')
        };

        setTest(prev => {
            const newParts = [...prev.parts];
            const originalPart = newParts[partIdx];

            const newQuestion = {
                ...newQuestionData,
                order: originalPart.questions.length + 1
            };

            const newPart = {
                ...originalPart,
                questions: [...originalPart.questions, newQuestion]
            };
    
            newParts[partIdx] = newPart;
            
            return { ...prev, parts: newParts };
        });
    };
    
    const removeQuestion = (partIdx, questionId) => {
        setTest(prev => {
            const newParts = [...prev.parts];
            newParts[partIdx].questions = newParts[partIdx].questions.filter(q => q.id !== questionId);
            // Re-order remaining questions
            newParts[partIdx].questions.forEach((q, index) => {
                q.order = index + 1;
            });
            return { ...prev, parts: newParts };
        });
    };

    const handleQuestionExtraDataChange = (partIdx, qIdx, field, value) => {
         setTest(prev => {
            const newParts = [...prev.parts];
            const newQuestions = [...newParts[partIdx].questions];
            const newQuestion = { ...newQuestions[qIdx] };
            newQuestion.extra_data = { ...newQuestion.extra_data, [field]: value };
            newQuestions[qIdx] = newQuestion;
            newParts[partIdx].questions = newQuestions;
            return { ...prev, parts: newParts };
        });
    };

    const handleOptionChange = (partIdx, qIdx, optIdx, value) => {
        setTest(prev => {
            const newParts = [...prev.parts];
            const newQuestions = [...newParts[partIdx].questions];
            const newQuestion = { ...newQuestions[qIdx] };
            const newOptions = [...newQuestion.extra_data.options];
            newOptions[optIdx] = value;
            newQuestion.extra_data = { ...newQuestion.extra_data, options: newOptions };
            newQuestions[qIdx] = newQuestion;
            newParts[partIdx].questions = newQuestions;
            return { ...prev, parts: newParts };
        });
    };
    
    const addOption = (partIdx, qIdx) => {
        setTest(prev => {
            const newParts = [...prev.parts];
            const newQuestions = [...newParts[partIdx].questions];
            const newQuestion = { ...newQuestions[qIdx] };
            const newOptions = [...(newQuestion.extra_data.options || [])];
            newOptions.push(`New Option ${newOptions.length + 1}`);
            newQuestion.extra_data = { ...newQuestion.extra_data, options: newOptions };
            newQuestions[qIdx] = newQuestion;
            newParts[partIdx].questions = newQuestions;
            return { ...prev, parts: newParts };
        });
    };
    
    const removeOption = (partIdx, qIdx, optIdx) => {
        setTest(prev => {
            const newParts = [...prev.parts];
            const newQuestions = [...newParts[partIdx].questions];
            const newQuestion = { ...newQuestions[qIdx] };
            const newOptions = newQuestion.extra_data.options.filter((_, index) => index !== optIdx);
            newQuestion.extra_data = { ...newQuestion.extra_data, options: newOptions };
            newQuestions[qIdx] = newQuestion;
            newParts[partIdx].questions = newQuestions;
            return { ...prev, parts: newParts };
        });
    };

    const handleQuestionTypeChange = (partIdx, qIdx, newType) => {
        setTest(prev => {
            const newParts = [...prev.parts];
            const newQuestions = [...newParts[partIdx].questions];
            const oldQuestion = newQuestions[qIdx];
            
            const newQuestion = { 
                ...oldQuestion, 
                question_type: newType,
                extra_data: getDefaultExtraData(newType)
            };

            newQuestions[qIdx] = newQuestion;
            newParts[partIdx].questions = newQuestions;
            return { ...prev, parts: newParts };
        });
    };


    const openQuestionEditor = (partIdx, questionId) => {
        const questionToEdit = test.parts[partIdx].questions.find(q => q.id === questionId);
        if (!questionToEdit) {
            console.error("Could not find question with ID:", questionId);
            setSnackbar({ open: true, message: 'Error: Could not find the question to edit.', severity: 'error' });
            return;
        }
        // Deep copy to prevent direct state mutation
        const questionCopy = JSON.parse(JSON.stringify(questionToEdit));
        setEditingQuestion({ partIdx, qIdx: -1, question: questionCopy }); // qIdx is not reliable here
    };

    const closeQuestionEditor = () => {
        setEditingQuestion(null);
    };

    const saveQuestion = () => {
        if (!editingQuestion) return;
        const { partIdx, question } = editingQuestion;

        setTest(prev => {
            const newParts = [...prev.parts];
            const questions = newParts[partIdx].questions;
            const questionIndex = questions.findIndex(q => q.id === question.id);
            
            if (questionIndex !== -1) {
                questions[questionIndex] = question;
            } else {
                // This case should ideally not happen if we're always editing existing questions
                questions.push(question); 
            }
            
            newParts[partIdx].questions = questions;
            return { ...prev, parts: newParts };
        });
        closeQuestionEditor();
    };

    const handleEditingQuestionChange = (field, value) => {
        console.log(`🔍 Updating question field: ${field} = ${value}`);
        setEditingQuestion(prev => ({
            ...prev,
            question: { ...prev.question, [field]: value }
        }));
    };
    
    const handleEditingExtraDataChange = (field, value) => {
        setEditingQuestion(prev => ({
            ...prev,
            question: {
                ...prev.question,
                extra_data: { ...prev.question.extra_data, [field]: value }
            }
        }));
    };

    const handleEditingOptionChange = (optIdx, field, value) => {
        setEditingQuestion(prev => {
            const newOptions = [...prev.question.extra_data.options];
            newOptions[optIdx] = { ...newOptions[optIdx], [field]: value };
            return {
                ...prev,
                question: {
                    ...prev.question,
                    extra_data: { ...prev.question.extra_data, options: newOptions }
                }
            };
        });
    };

     const handleEditingMCRCorrectAnswerChange = (correctOptIdx) => {
        setEditingQuestion(prev => {
            const newOptions = prev.question.extra_data.options.map((opt, idx) => ({
                ...opt,
                is_correct: idx === correctOptIdx
            }));
             return {
                ...prev,
                question: {
                    ...prev.question,
                    extra_data: { ...prev.question.extra_data, options: newOptions }
                }
            };
        });
    };

    const addEditingOption = () => {
        setEditingQuestion(prev => {
            const newOptions = [...(prev.question.extra_data.options || [])];
            newOptions.push({ text: `New Option`, is_correct: false });
             return {
                ...prev,
                question: {
                    ...prev.question,
                    extra_data: { ...prev.question.extra_data, options: newOptions }
                }
            };
        });
    };

    const removeEditingOption = (optIdx) => {
         setEditingQuestion(prev => {
            const newOptions = prev.question.extra_data.options.filter((_, index) => index !== optIdx);
             return {
                ...prev,
                question: {
                    ...prev.question,
                    extra_data: { ...prev.question.extra_data, options: newOptions }
                }
            };
        });
    };


    const handleEditingQuestionTypeChange = (newType) => {
        setEditingQuestion(prev => ({
            ...prev,
            question: {
                ...prev.question,
                question_type: newType,
                extra_data: getDefaultExtraData(newType)
            }
        }));
    };

    const transformTestForAPI = (testData) => {
        const payload = { ...testData };
        // Ensure explanation_url is included explicitly
        payload.explanation_url = testData.explanation_url || '';
        
        // Ensure parts and questions have IDs for the backend to update them
        payload.parts = payload.parts.map(part => {
            const newPart = { ...part };
            if (typeof newPart.id === 'string' && newPart.id.startsWith('new-')) {
                delete newPart.id; // Let backend assign ID for new parts
            }

            newPart.questions = newPart.questions.map(q => {
                const newQ = { ...q };
                if (typeof newQ.id === 'string' && newQ.id.startsWith('new-')) {
                    delete newQ.id; // Let backend assign ID for new questions
                }

                // Special handling for multiple_choice to create answer_options
                if (newQ.question_type === 'multiple_choice' && newQ.extra_data.options) {
                    newQ.answer_options = newQ.extra_data.options.map((opt, idx) => ({
                        // id will be handled by backend
                        label: String.fromCharCode(65 + idx),
                        text: opt.text,
                        is_correct: opt.is_correct || false,
                    }));
                    // The raw 'options' might not be needed in the final payload
                    // depending on backend implementation, but we send it inside extra_data
                }
                
                if (newQ.question_type === 'multiple_response' && newQ.extra_data.options) {
                     newQ.answer_options = newQ.extra_data.options.map((opt, idx) => ({
                        label: String.fromCharCode(65 + idx),
                        text: opt.text,
                        is_correct: opt.is_correct || false,
                        reading_points: opt.reading_points || 1,
                    }));
                    // Убеждаемся, что reading_scoring_type передается на бэкенд
                    if (newQ.reading_scoring_type) {
                        // Поле уже есть в newQ, ничего дополнительно делать не нужно
                    }
                }
                
                // For GapFill, structure correct_answers from extra_data
                if (newQ.question_type === 'gap_fill' && newQ.extra_data.answers) {
                    newQ.correct_answers = Object.entries(newQ.extra_data.answers).map(([key, value]) => ({
                        number: key,
                        answer: value
                    }));
                }
                
                // For Table, structure correct_answers from extra_data
                if (newQ.question_type === 'table' && newQ.extra_data.rows) {
                    const answers = [];
                    newQ.extra_data.rows.forEach((row, rIdx) => {
                        row.forEach((cell, cIdx) => {
                            if (typeof cell === 'object' && cell.type === 'gap') {
                                answers.push({
                                    row: rIdx,
                                    col: cIdx,
                                    answer: cell.answer
                                });
                            }
                        });
                    });
                    newQ.correct_answers = answers;
                }

                if (newQ.question_type === 'matching' && newQ.extra_data.answers) {
                    newQ.correct_answers = newQ.extra_data.answers;
                }

                if (newQ.question_type === 'true_false_not_given' && newQ.extra_data.answers) {
                    newQ.correct_answers = newQ.extra_data.answers;
                }
                
                return newQ;
            });
            return newPart;
        });

        return payload;
    };
    
    const saveTest = async () => {
        setLoading(true);
        const apiPayload = transformTestForAPI(test);
        console.log('🔍 Saving test with payload:', JSON.stringify(apiPayload, null, 2));
        const url = isNewTest ? `/reading-tests/` : `/reading-tests/${testId}/`;
        const method = isNewTest ? 'POST' : 'PUT';

        try {
             const user = auth.currentUser;
            if (!user) {
                setSnackbar({ open: true, message: 'Authentication required.', severity: 'error' });
                setLoading(false);
                return;
            }
            const token = await user.getIdToken();

            const response = await api.request({
                url: url,
                method: method,
                data: apiPayload,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
            });

            const savedTest = response.data;
            setSnackbar({ open: true, message: 'Test saved successfully!', severity: 'success' });
            if (isNewTest) {
                navigate(`/admin/reading/edit/${savedTest.id}`);
            } else {
                // Reload the test to get fresh data from the backend (with correct IDs)
                loadExistingTest();
            }
        } catch (error) {
            console.error('Failed to save the test:', error);
            setSnackbar({ open: true, message: 'An unexpected error occurred.', severity: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const renderQuestionEditor = () => {
        if (!editingQuestion) return null;

        const { question } = editingQuestion;
        const { question_type, header, instruction, question_text, points, extra_data } = question;

        const renderMCQEditor = () => {
            const correctOptionIndex = extra_data.options.findIndex(opt => opt.is_correct);
            return (
                <Box>
                    <Typography gutterBottom>Options</Typography>
                     <FormControl component="fieldset">
                        <RadioGroup
                            value={correctOptionIndex === -1 ? '' : correctOptionIndex.toString()}
                            onChange={(e) => handleEditingMCRCorrectAnswerChange(parseInt(e.target.value, 10))}
                        >
                            {(extra_data.options || []).map((option, optIdx) => (
                                <Box key={optIdx} display="flex" alignItems="center" mb={1}>
                                    <FormControlLabel 
                                        value={optIdx.toString()} 
                                        control={<Radio />} 
                                        label={`Option ${optIdx + 1}`} 
                                    />
                                    <TextField
                                        fullWidth
                                        variant="outlined"
                                        size="small"
                                        value={option.text}
                                        onChange={(e) => handleEditingOptionChange(optIdx, 'text', e.target.value)}
                                    />
                                    <IconButton onClick={() => removeEditingOption(optIdx)} size="small">
                                        <DeleteIcon />
                                    </IconButton>
                                </Box>
                            ))}
                        </RadioGroup>
                    </FormControl>
                    <Button onClick={addEditingOption} startIcon={<AddIcon />}>Add Option</Button>
                </Box>
            );
        };

        const renderMultipleResponseEditor = () => {
            
            const handleCorrectChange = (optIdx, checked) => {
                setEditingQuestion(prev => {
                    const newOptions = [...prev.question.extra_data.options];
                    newOptions[optIdx] = { ...newOptions[optIdx], is_correct: checked };
                    return {
                        ...prev,
                        question: {
                            ...prev.question,
                            extra_data: { ...prev.question.extra_data, options: newOptions }
                        }
                    };
                });
            }

            const handleReadingPointsChange = (optIdx, value) => {
                setEditingQuestion(prev => {
                    const newOptions = [...prev.question.extra_data.options];
                    newOptions[optIdx] = { ...newOptions[optIdx], reading_points: parseInt(value) || 1 };
                    return {
                        ...prev,
                        question: {
                            ...prev.question,
                            extra_data: { ...prev.question.extra_data, options: newOptions }
                        }
                    };
                });
            }

            return (
                <Box>
                    <Typography gutterBottom variant="h6" sx={{ mb: 2 }}>
                        Reading Multiple Response Settings
                    </Typography>
                    
                    <FormControl fullWidth sx={{ mb: 3 }}>
                        <InputLabel>Reading Scoring Type</InputLabel>
                        <Select
                            value={editingQuestion.question.reading_scoring_type || 'all_or_nothing'}
                            label="Reading Scoring Type"
                            onChange={(e) => handleEditingQuestionChange('reading_scoring_type', e.target.value)}
                        >
                            <MenuItem value="all_or_nothing">All or Nothing (1 балл за весь вопрос)</MenuItem>
                            <MenuItem value="per_correct_option">Per Correct Option (баллы за каждый правильный)</MenuItem>
                        </Select>
                    </FormControl>

                    {editingQuestion.question.reading_scoring_type === 'all_or_nothing' ? (
                        <TextField
                            fullWidth
                            type="number"
                            label="Total Points for Question"
                            value={points}
                            onChange={(e) => handleEditingQuestionChange('points', parseFloat(e.target.value) || 1)}
                            sx={{ mb: 3 }}
                            inputProps={{ min: 1, max: 10 }}
                            helperText="Баллы за правильный ответ на весь вопрос"
                        />
                    ) : (
                        <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
                            Баллы за каждый правильный ответ настраиваются в опциях ниже
                        </Typography>
                    )}

                    <Typography gutterBottom>Options (select all correct answers)</Typography>
                     <FormControl component="fieldset">
                        {(extra_data.options || []).map((option, optIdx) => (
                            <Box key={optIdx} display="flex" alignItems="center" mb={1} gap={1}>
                                <FormControlLabel 
                                    control={
                                        <Checkbox 
                                            checked={option.is_correct || false}
                                            onChange={(e) => handleCorrectChange(optIdx, e.target.checked)}
                                        />
                                    } 
                                    label={`Option ${optIdx + 1}`} 
                                />
                                <TextField
                                    fullWidth
                                    variant="outlined"
                                    size="small"
                                    value={option.text}
                                    onChange={(e) => handleEditingOptionChange(optIdx, 'text', e.target.value)}
                                />
                                {editingQuestion.question.reading_scoring_type === 'per_correct_option' && (
                                    <TextField
                                        type="number"
                                        label="Points"
                                        size="small"
                                        value={option.reading_points || 1}
                                        onChange={(e) => handleReadingPointsChange(optIdx, e.target.value)}
                                        sx={{ minWidth: 100 }}
                                        inputProps={{ min: 1, max: 10 }}
                                    />
                                )}
                                <IconButton onClick={() => removeEditingOption(optIdx)} size="small">
                                    <DeleteIcon />
                                </IconButton>
                            </Box>
                        ))}
                    </FormControl>
                    <Button onClick={addEditingOption} startIcon={<AddIcon />}>Add Option</Button>
                </Box>
            )
        }

        const renderGapFillEditor = () => {
            const gaps = question_text.match(/\[\[\d+\]\]/g) || [];
            
            const handleAnswerChange = (gapNumber, value) => {
                handleEditingExtraDataChange('answers', {
                    ...extra_data.answers,
                    [gapNumber]: value
                });
            };

            return (
                <Box>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                        Use [[1]], [[2]], etc. to mark gaps. The answer fields below will update automatically.
                    </Typography>
                    {gaps.map((gap, index) => {
                        const gapNumber = gap.replace(/\[|\]/g, '');
                        return (
                            <TextField
                                key={index}
                                fullWidth
                                variant="outlined"
                                size="small"
                                margin="normal"
                                label={`Answer for gap ${gapNumber}`}
                                value={extra_data.answers[gapNumber] || ''}
                                onChange={(e) => handleAnswerChange(gapNumber, e.target.value)}
                                helperText="Use | for alternatives (e.g., '1 | one year')"
                            />
                        );
                    })}
                    {gaps.length === 0 && <Typography color="error">No gaps found in the question text.</Typography>}
                </Box>
            );
        };

        const renderTableEditor = () => {
            
            const handleHeaderChange = (idx, value) => {
                const newHeaders = [...extra_data.headers];
                newHeaders[idx] = value;
                handleEditingExtraDataChange('headers', newHeaders);
            };

            const handleCellChange = (rowIdx, cellIdx, value) => {
                const newRows = JSON.parse(JSON.stringify(extra_data.rows));
                if (typeof newRows[rowIdx][cellIdx] === 'object' && newRows[rowIdx][cellIdx].type === 'gap') {
                     newRows[rowIdx][cellIdx].answer = value;
                } else {
                    newRows[rowIdx][cellIdx] = value;
                }
                handleEditingExtraDataChange('rows', newRows);
            };

            const toggleCellType = (rowIdx, cellIdx) => {
                const newRows = JSON.parse(JSON.stringify(extra_data.rows));
                const currentCell = newRows[rowIdx][cellIdx];
                if (typeof currentCell === 'object' && currentCell.type === 'gap') {
                    newRows[rowIdx][cellIdx] = currentCell.answer || ''; // Revert to text
                } else {
                    newRows[rowIdx][cellIdx] = { type: 'gap', answer: currentCell }; // Convert to gap
                }
                handleEditingExtraDataChange('rows', newRows);
            };

            const addColumn = () => {
                 const newHeaders = [...extra_data.headers, `Header ${extra_data.headers.length + 1}`];
                 const newRows = extra_data.rows.map(row => [...row, 'New Cell']);
                 handleEditingExtraDataChange('headers', newHeaders);
                 handleEditingExtraDataChange('rows', newRows);
            };

            const addRow = () => {
                const newRow = Array(extra_data.headers.length).fill('New Cell');
                const newRows = [...extra_data.rows, newRow];
                handleEditingExtraDataChange('rows', newRows);
            };
            
            const removeColumn = (idx) => {
                if (extra_data.headers.length <= 1) return;
                const newHeaders = extra_data.headers.filter((_, i) => i !== idx);
                const newRows = extra_data.rows.map(row => row.filter((_, i) => i !== idx));
                handleEditingExtraDataChange('headers', newHeaders);
                handleEditingExtraDataChange('rows', newRows);
            };

            const removeRow = (idx) => {
                 if (extra_data.rows.length <= 1) return;
                 const newRows = extra_data.rows.filter((_, i) => i !== idx);
                 handleEditingExtraDataChange('rows', newRows);
            };

            return (
                <Box>
                    <Box display="flex" justifyContent="space-between" mb={2}>
                        <Typography variant="h6">Table Structure</Typography>
                        <Box>
                            <Button onClick={addRow}>Add Row</Button>
                            <Button onClick={addColumn}>Add Column</Button>
                        </Box>
                    </Box>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                {extra_data.headers.map((header, idx) => (
                                    <th key={idx} style={{ border: '1px solid #ddd', padding: '8px' }}>
                                        <TextField
                                            fullWidth
                                            variant="standard"
                                            value={header}
                                            onChange={(e) => handleHeaderChange(idx, e.target.value)}
                                        />
                                         <IconButton onClick={() => removeColumn(idx)} size="small"><DeleteIcon fontSize="small"/></IconButton>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {extra_data.rows.map((row, rowIdx) => (
                                <tr key={rowIdx}>
                                    {row.map((cell, cellIdx) => (
                                        <td key={cellIdx} style={{ border: '1px solid #ddd', padding: '8px' }}>
                                            {typeof cell === 'object' && cell.type === 'gap' ? (
                                                <TextField
                                                    fullWidth
                                                    variant="outlined"
                                                    label="Gap Answer"
                                                    value={cell.answer}
                                                    onChange={(e) => handleCellChange(rowIdx, cellIdx, e.target.value)}
                                                />
                                            ) : (
                                                <TextField
                                                    fullWidth
                                                    variant="standard"
                                                    value={cell}
                                                    onChange={(e) => handleCellChange(rowIdx, cellIdx, e.target.value)}
                                                />
                                            )}
                                            <Button size="small" onClick={() => toggleCellType(rowIdx, cellIdx)}>
                                                {typeof cell === 'object' && cell.type === 'gap' ? 'Set as Text' : 'Set as Gap'}
                                            </Button>
                                        </td>
                                    ))}
                                    <td>
                                         <IconButton onClick={() => removeRow(rowIdx)} size="small"><DeleteIcon fontSize="small"/></IconButton>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Box>
            );
        };

        const renderMatchingEditor = () => {
            const data = question.extra_data;
            const items = data.items || [];
            const options = data.options || [];
            const answers = data.answers || {};

            const handleItemChange = (listType, index, value) => {
                const newList = [...(listType === 'items' ? items : options)];
                newList[index] = { ...newList[index], text: value };
                handleEditingExtraDataChange(listType, newList);
            };

             const handleAnswerChange = (itemText, value) => {
                const newAnswers = {...answers};
                newAnswers[itemText] = value;
                handleEditingExtraDataChange('answers', newAnswers);
            };

            const addItem = (listType) => {
                const list = listType === 'items' ? items : options;
                const newItem = { text: `New ${listType === 'items' ? 'Item' : 'Option'} ${list.length + 1}` };
                handleEditingExtraDataChange(listType, [...list, newItem]);
            };
            
            const removeItem = (listType, index) => {
                const list = listType === 'items' ? items : options;
                const itemToRemove = list[index];
                const newList = list.filter((_, i) => i !== index);
                handleEditingExtraDataChange(listType, newList);
                
                if (listType === 'items') {
                    const newAnswers = {...answers};
                    delete newAnswers[itemToRemove.text];
                    handleEditingExtraDataChange('answers', newAnswers);
                }
            };

            return (
                <Grid container spacing={2}>
                    <Grid item xs={6}>
                        <Typography variant="h6">Items to Match</Typography>
                        {items.map((item, idx) => (
                            <Box key={idx} display="flex" gap={1} mb={1}>
                                <TextField fullWidth value={item.text} onChange={(e) => handleItemChange('items', idx, e.target.value)} size="small" />
                                <IconButton onClick={() => removeItem('items', idx)} size="small"><DeleteIcon /></IconButton>
                            </Box>
                        ))}
                        <Button onClick={() => addItem('items')}>Add Item</Button>
                    </Grid>
                    <Grid item xs={6}>
                        <Typography variant="h6">Options</Typography>
                        {options.map((opt, idx) => (
                            <Box key={idx} display="flex" gap={1} mb={1}>
                                <TextField fullWidth value={opt.text} onChange={(e) => handleItemChange('options', idx, e.target.value)} size="small" />
                                 <IconButton onClick={() => removeItem('options', idx)} size="small"><DeleteIcon /></IconButton>
                            </Box>
                        ))}
                         <Button onClick={() => addItem('options')}>Add Option</Button>
                    </Grid>
                     <Grid item xs={12}>
                        <Divider sx={{my: 2}} />
                        <Typography variant="h6">Correct Answers</Typography>
                        {items.map((item, idx) => (
                             <Box key={idx} display="flex" gap={2} alignItems="center" mb={1}>
                                <Typography sx={{flexShrink: 0, width: '40%'}}>{item.text}</Typography>
                                 <FormControl fullWidth size="small">
                                     <InputLabel>Matches with...</InputLabel>
                                     <Select value={answers[item.text] || ''} onChange={(e) => handleAnswerChange(item.text, e.target.value)} label="Matches with...">
                                         {options.map((opt, optIdx) => (
                                             <MenuItem key={optIdx} value={opt.text}>{opt.text}</MenuItem>
                                         ))}
                                     </Select>
                                 </FormControl>
                             </Box>
                        ))}
                     </Grid>
                </Grid>
            )
        };

        const renderTFNEditor = () => {
            const data = question.extra_data;
            const statements = data.statements || [];
            const answers = data.answers || [];

            const handleStatementChange = (idx, value) => {
                const newStatements = [...statements];
                newStatements[idx] = value;
                handleEditingExtraDataChange('statements', newStatements);
            };

            const handleAnswerChange = (idx, value) => {
                const newAnswers = [...answers];
                newAnswers[idx] = value;
                handleEditingExtraDataChange('answers', newAnswers);
            };

            const addStatement = () => {
                handleEditingExtraDataChange('statements', [...statements, `New Statement ${statements.length + 1}`]);
                handleEditingExtraDataChange('answers', [...answers, 'True']);
            };

            const removeStatement = (idx) => {
                handleEditingExtraDataChange('statements', statements.filter((_, i) => i !== idx));
                handleEditingExtraDataChange('answers', answers.filter((_, i) => i !== idx));
            };

            return (
                <Box>
                    {statements.map((stmt, idx) => (
                        <Box key={idx} display="flex" gap={2} alignItems="center" mb={2}>
                            <TextField
                                fullWidth
                                multiline
                                label={`Statement ${idx + 1}`}
                                value={stmt}
                                onChange={(e) => handleStatementChange(idx, e.target.value)}
                                helperText="Enter the statement that students will evaluate as True/False/Not Given"
                                sx={{
                                    '& .MuiInputBase-input': {
                                        lineHeight: '1.4'
                                    }
                                }}
                            />
                            <FormControl>
                                <RadioGroup
                                    row
                                    value={answers[idx] || 'True'}
                                    onChange={(e) => handleAnswerChange(idx, e.target.value)}
                                >
                                    <FormControlLabel value="True" control={<Radio size="small"/>} label="True" />
                                    <FormControlLabel value="False" control={<Radio size="small"/>} label="False" />
                                    <FormControlLabel value="Not Given" control={<Radio size="small"/>} label="Not Given" />
                                </RadioGroup>
                            </FormControl>
                            <IconButton onClick={() => removeStatement(idx)}><DeleteIcon /></IconButton>
                        </Box>
                    ))}
                    <Button onClick={addStatement} variant="outlined" size="small">
                        + Add Statement
                    </Button>
                </Box>
            );
        };

        return (
            <Dialog open={true} onClose={closeQuestionEditor} fullWidth maxWidth="md">
                <DialogTitle>Edit Question</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                             <FormControl fullWidth margin="normal">
                                <InputLabel>Question Type</InputLabel>
                                <Select
                                    value={question_type}
                                    onChange={(e) => handleEditingQuestionTypeChange(e.target.value)}
                                    label="Question Type"
                                >
                                    {QUESTION_TYPES.map(qt => (
                                        <MenuItem key={qt.value} value={qt.value}>{qt.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        
                        <Grid item xs={12}>
                             <TextField
                                label="Header"
                                fullWidth
                                multiline
                                rows={2}
                                variant="outlined"
                                margin="normal"
                                value={header}
                                onChange={(e) => handleEditingQuestionChange('header', e.target.value)}
                                placeholder="e.g., Choose the correct letter, A, B, or C."
                            />
                        </Grid>

                        <Grid item xs={12}>
                             <TextField
                                label="Instruction"
                                fullWidth
                                multiline
                                rows={2}
                                variant="outlined"
                                margin="normal"
                                value={instruction}
                                onChange={(e) => handleEditingQuestionChange('instruction', e.target.value)}
                                placeholder="e.g., Write the correct letter in boxes 1-5 on your answer sheet."
                            />
                        </Grid>



                        <Grid item xs={12}>
                            <TextField
                                label="Question Text / Content"
                                fullWidth
                                multiline
                                rows={4}
                                variant="outlined"
                                margin="normal"
                                value={question_text}
                                onChange={(e) => handleEditingQuestionChange('question_text', e.target.value)}
                                helperText={
                                    question_type === 'gap_fill' 
                                    ? "Use [[1]], [[2]], [[3]] etc. to mark gaps. Students will see these as blank spaces to fill."
                                    : question_type === 'table'
                                    ? "Main instructions for the table completion task."
                                    : question_type === 'matching'
                                    ? "Instructions for matching questions. This text will be shown to students before the matching items."
                                    : "Main question text or instructions for this question type."
                                }
                                sx={{
                                    '& .MuiInputBase-input': {
                                        lineHeight: '1.6',
                                        whiteSpace: 'pre-wrap'
                                    }
                                }}
                            />
                        </Grid>
                        
                         {question_type === 'multiple_response' && (
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Points"
                                    type="number"
                                    fullWidth
                                    variant="outlined"
                                    margin="normal"
                                    value={points}
                                    onChange={(e) => handleEditingQuestionChange('points', parseFloat(e.target.value) || 1)}
                                    helperText="Total points for correctly answering this entire question."
                                />
                            </Grid>
                         )}

                        <Grid item xs={12}>
                            <Divider sx={{ my: 2 }} />
                            {question_type === 'multiple_choice' && renderMCQEditor()}
                            {question_type === 'multiple_response' && renderMultipleResponseEditor()}
                            {question_type === 'gap_fill' && renderGapFillEditor()}
                            {question_type === 'table' && renderTableEditor()}
                            {question_type === 'matching' && renderMatchingEditor()}
                            {question_type === 'true_false_not_given' && renderTFNEditor()}

                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeQuestionEditor}>Cancel</Button>
                    <Button onClick={saveQuestion} variant="contained" color="primary">Save</Button>
                </DialogActions>
            </Dialog>
        );
    };


    if (loading && isNewTest) return <CircularProgress />;

    return (
        <Box sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="items-center" mb={2}>
                <Button variant="outlined" onClick={() => navigate('/admin/reading')} startIcon={<ArrowBackIcon />}>
                    Back to Tests
                </Button>
                <Typography variant="h4" component="h1">
                    {isNewTest ? 'Create New Reading Test' : 'Edit Reading Test'}
                </Typography>
                <Box>
                    <FormControlLabel
                        control={<Switch checked={test.is_active} onChange={e => handleTestChange('is_active', e.target.checked)} />}
                        label="Active"
                    />
                    <Button 
                        variant="contained" 
                        color="primary" 
                        onClick={saveTest}
                        disabled={loading}
                        startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                    >
                        {loading ? 'Saving...' : 'Save Test'}
                    </Button>
                </Box>
            </Box>
            <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2}>
                    <Grid item xs={12} md={8}>
                        <Typography variant="h6" gutterBottom>Test Details</Typography>
                        <TextField
                            fullWidth
                            label="Test Title"
                            value={test.title}
                            onChange={e => handleTestChange('title', e.target.value)}
                            margin="normal"
                        />
                         <TextField
                            fullWidth
                            label="Time Limit (minutes)"
                            type="number"
                            value={test.time_limit}
                            onChange={e => handleTestChange('time_limit', parseInt(e.target.value, 10))}
                            margin="normal"
                        />
                        <TextField
                            fullWidth
                            label="Description"
                            value={test.description}
                            onChange={e => handleTestChange('description', e.target.value)}
                            multiline
                            rows={3}
                            margin="normal"
                        />
                        <TextField
                            fullWidth
                            label="Explanation URL (YouTube)"
                            placeholder="https://www.youtube.com/watch?v=..."
                            value={test.explanation_url || ''}
                            onChange={e => handleTestChange('explanation_url', e.target.value)}
                            margin="normal"
                        />
                    </Grid>
                </Grid>
            </Paper>

            {test.parts.map((part, partIdx) => (
                <Paper key={part.id || partIdx} elevation={2} sx={{ p: 2, mb: 3 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="h5">Part {part.part_number}</Typography>
                        <IconButton onClick={() => removePart(partIdx)}>
                            <DeleteIcon />
                        </IconButton>
                    </Box>
                    <TextField
                        fullWidth
                        label="Part Title"
                        value={part.title}
                        onChange={e => handlePartChange(partIdx, 'title', e.target.value)}
                        margin="normal"
                        variant="standard"
                    />
                    <TextField
                        fullWidth
                        label="Passage Heading"
                        value={part.passage_heading || ''}
                        onChange={e => handlePartChange(partIdx, 'passage_heading', e.target.value)}
                        margin="normal"
                        variant="standard"
                        
                        
                    />
                    <TextField
                        fullWidth
                        label="Passage Text"
                        value={part.passage_text}
                        onChange={e => handlePartChange(partIdx, 'passage_text', e.target.value)}
                        multiline
                        rows={10}
                        margin="normal"
                        variant="outlined"
                        helperText="You can use HTML tags for formatting: <b>bold</b>, <i>italic</i>, <u>underline</u>, <br> for line breaks"
                    />
                    
                    <Divider sx={{ my: 2 }}><Chip label="Questions" /></Divider>

                    {part.questions.map((q, qIdx) => (
                        <Card key={q.id || qIdx} variant="outlined" sx={{ mb: 2 }}>
                            <CardContent>
                                <Box display="flex" justifyContent="space-between" alignItems="center">
                                    <Typography>
                                        Q{q.order}: ({q.question_type}) {q.question_text.substring(0, 50)}...
                                    </Typography>
                                    <Box>
                                        <IconButton onClick={() => openQuestionEditor(partIdx, q.id)}>
                                            <EditIcon />
                                        </IconButton>
                                        <IconButton onClick={() => removeQuestion(partIdx, q.id)}>
                                            <DeleteIcon />
                                        </IconButton>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    ))}
                    <Button startIcon={<AddIcon />} onClick={() => addQuestion(partIdx)}>
                        Add Question
                    </Button>
                </Paper>
            ))}

            <Button variant="contained" onClick={addPart} startIcon={<AddIcon />}>
                Add Part
            </Button>
            
            {renderQuestionEditor()}

            <Snackbar 
                open={snackbar.open} 
                autoHideDuration={6000} 
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default AdminReadingTestBuilder; 