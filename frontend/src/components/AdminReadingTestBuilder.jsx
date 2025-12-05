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
import UploadIcon from '@mui/icons-material/Upload';
import { auth } from '../firebase';
import api from '../api';

// IELTS Reading question types
const QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'multiple_choice_group', label: 'Multiple Choice (Group)' },
  { value: 'multiple_response', label: 'Multiple Response' },
  { value: 'gap_fill', label: 'Gap Fill (Summary, etc.)' },
  { value: 'table', label: 'Table Completion' },
  { value: 'matching', label: 'Matching' },
  { value: 'true_false_not_given', label: 'True/False/Not Given' },
];

const convertFileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
});

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
        case 'multiple_choice_group':
            return { group_items: [createGroupItem()] };
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
                questions: part.questions.map((q, qIdx) => {
                    const normalizedQuestion = { ...q };
                    const defaultExtra = getDefaultExtraData(normalizedQuestion.question_type) || {};
                    let extraData = {};

                    if (normalizedQuestion.extra_data && typeof normalizedQuestion.extra_data === 'object') {
                        // Deep clone to avoid accidental state mutations
                        extraData = JSON.parse(JSON.stringify(normalizedQuestion.extra_data));
                    }

                    const isChoiceQuestion = ['multiple_choice', 'multiple_response'].includes(normalizedQuestion.question_type);

                    if (isChoiceQuestion) {
                        const answerOptions = Array.isArray(normalizedQuestion.answer_options) ? normalizedQuestion.answer_options : [];
                        const seenKeys = new Set();
                        const optionsFromAnswer = answerOptions.reduce((acc, option, idx) => {
                            const key = option.id ?? `${option.label ?? option.text ?? idx}`;
                            if (seenKeys.has(key)) {
                                return acc;
                            }
                            seenKeys.add(key);
                            const label = option.label || String.fromCharCode(65 + acc.length);
                            const optionPayload = {
                                id: option.id,
                                label,
                                text: option.text || '',
                                is_correct: !!option.is_correct,
                            };
                            if (normalizedQuestion.question_type === 'multiple_response') {
                                optionPayload.reading_points = option.reading_points != null ? option.reading_points : 1;
                            }
                            acc.push(optionPayload);
                            return acc;
                        }, []);

                        const currentOptions = Array.isArray(extraData.options) && extraData.options.length > 0
                            ? extraData.options
                            : defaultExtra.options || [];

                        const normalizedOptions = (optionsFromAnswer.length > 0 ? optionsFromAnswer : currentOptions).map((opt, idx) => ({
                            id: opt.id,
                            label: opt.label || String.fromCharCode(65 + idx),
                            text: opt.text || '',
                            is_correct: !!opt.is_correct,
                            ...(normalizedQuestion.question_type === 'multiple_response'
                                ? { reading_points: opt.reading_points != null ? opt.reading_points : 1 }
                                : {}),
                        }));

                        extraData = {
                            ...defaultExtra,
                            ...extraData,
                            options: normalizedOptions,
                        };
                    } else {
                        extraData = {
                            ...defaultExtra,
                            ...extraData,
                        };
                    }

                    normalizedQuestion.extra_data = extraData;
                    normalizedQuestion.reading_scoring_type = normalizedQuestion.reading_scoring_type || 'all_or_nothing';
                    normalizedQuestion.image_base64 = null;
                    normalizedQuestion.image_remove = false;
                    normalizedQuestion.image_original = normalizedQuestion.image_url || '';
                    normalizedQuestion.task_prompt = normalizedQuestion.task_prompt || (extraData.task_prompt || '');
                    normalizedQuestion.group_items = Array.isArray(extraData.group_items)
                        ? extraData.group_items.map((item, itemIdx) => {
                            const itemId = item.id || `item-${normalizedQuestion.id || qIdx}-${itemIdx}`;
                            const options = Array.isArray(item.options) ? item.options : [];
                            return {
                                id: itemId,
                                prompt: item.prompt || '',
                                points: item.points ?? 1,
                                correct_answer: item.correct_answer || (options[0]?.label || 'A'),
                                options: options.map((opt, optIdx) => ({
                                    label: opt.label || String.fromCharCode(65 + optIdx),
                                    text: opt.text || ''
                                }))
                            };
                        })
                        : [];
                    normalizedQuestion.image_url = normalizedQuestion.image_url || '';
                    normalizedQuestion.image = normalizedQuestion.image_url || '';

                    return normalizedQuestion;
                })
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
            task_prompt: '',
            points: 1,
            reading_scoring_type: 'all_or_nothing',
             extra_data: getDefaultExtraData('multiple_choice'),
             image: '',
             image_url: '',
             image_base64: null,
             image_remove: false,
            image_original: '',
            group_items: []
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
            if (newType === 'multiple_choice_group') {
                newQuestion.group_items = [createGroupItem()];
            }

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
        questionCopy.image_url = questionCopy.image_url || '';
        questionCopy.image_original = questionCopy.image_original || questionCopy.image_url || '';
        questionCopy.image = questionCopy.image || questionCopy.image_url || '';
        questionCopy.image_base64 = null;
        questionCopy.image_remove = false;
        questionCopy.task_prompt = questionCopy.task_prompt || '';
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

                newQ.task_prompt = newQ.task_prompt || '';

                let questionImageUrl = newQ.image || newQ.image_url || newQ.image_original || '';
                let questionImageBase64 = newQ.image_base64 ?? null;
                if (questionImageUrl && questionImageUrl.startsWith('data:')) {
                    if (questionImageBase64 == null) {
                        questionImageBase64 = questionImageUrl;
                    }
                    questionImageUrl = '';
                }
                if (newQ.image_remove) {
                    questionImageBase64 = 'null';
                    questionImageUrl = '';
                }
                if (questionImageBase64 === null) {
                    delete newQ.image_base64;
                    newQ.image_url = questionImageUrl;
                } else {
                    newQ.image_base64 = questionImageBase64;
                    newQ.image_url = '';
                }
                if (!newQ.extra_data || typeof newQ.extra_data !== 'object') {
                    newQ.extra_data = {};
                }
                newQ.extra_data.task_prompt = newQ.task_prompt || '';

                if (newQ.question_type === 'multiple_choice_group') {
                    const itemsPayload = (newQ.group_items || []).map((item, itemIdx) => {
                        const options = Array.isArray(item.options) ? item.options : [];
                        return {
                            id: item.id || `item-${newQ.id || itemIdx}`,
                            prompt: item.prompt || '',
                            points: Number(item.points) || 1,
                            correct_answer: item.correct_answer || (options[0]?.label || 'A'),
                            options: options.map((opt, optIdx) => ({
                                label: opt.label || String.fromCharCode(65 + optIdx),
                                text: opt.text || ''
                            }))
                        };
                    });
                    newQ.extra_data = { ...(newQ.extra_data || {}), group_items: itemsPayload };
                    newQ.points = itemsPayload.reduce((sum, item) => sum + (Number(item.points) || 1), 0);
                    delete newQ.group_items;
                }

                // Special handling for multiple_choice to create answer_options
                if (newQ.question_type === 'multiple_choice' && newQ.extra_data.options) {
                    newQ.answer_options = newQ.extra_data.options.map((opt, idx) => {
                        const label = opt.label || String.fromCharCode(65 + idx);
                        const optionPayload = {
                            label,
                            text: opt.text || '',
                            is_correct: Boolean(opt.is_correct),
                        };
                        if (opt.id) {
                            optionPayload.id = opt.id;
                        }
                        return optionPayload;
                    });
                    // The raw 'options' might not be needed in the final payload
                    // depending on backend implementation, but we send it inside extra_data
                }
                
                if (newQ.question_type === 'multiple_response' && newQ.extra_data.options) {
                     newQ.answer_options = newQ.extra_data.options.map((opt, idx) => {
                        const label = opt.label || String.fromCharCode(65 + idx);
                        const optionPayload = {
                            label,
                            text: opt.text || '',
                            is_correct: Boolean(opt.is_correct),
                            reading_points: opt.reading_points != null ? opt.reading_points : 1,
                        };
                        if (opt.id) {
                            optionPayload.id = opt.id;
                        }
                        return optionPayload;
                    });
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
                    const gapRegex = /\[\[(\d+)\]\]/g;
                    const answers = [];
                    newQ.extra_data.rows.forEach((row, rIdx) => {
                        row.forEach((cell, cIdx) => {
                            const cellText = typeof cell === 'object' 
                                ? (cell.text || cell.content || '')
                                : (cell || '');
                            const matches = [...(cellText.matchAll(gapRegex) || [])];
                            matches.forEach(match => {
                                const gapNum = parseInt(match[1], 10);
                                const answerText = newQ.extra_data?.answers?.[gapNum] || '';
                                answers.push({
                                    id: `r${rIdx}c${cIdx}__gap${gapNum}`,
                                    answer: answerText
                                });
                            });
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
            delete newPart.passage_image_base64;
            delete newPart.passage_image_remove;
            delete newPart.passage_image_original;
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

        const imagePreview = (() => {
            if (question.image && (question.image.startsWith('data:') || question.image.startsWith('http') || question.image.startsWith('/'))) {
                return question.image;
            }
            if (!question.image_remove && question.image && question.image.includes('/')) {
                return question.image;
            }
            if (!question.image_remove && question.image_original) {
                return question.image_original;
            }
            if (!question.image_remove && question.image_url) {
                return question.image_url;
            }
            return null;
        })();

        const handleQuestionImageUpload = async (file) => {
            if (!file) return;
            const base64 = await convertFileToBase64(file);
            setEditingQuestion(prev => ({
                ...prev,
                question: {
                    ...prev.question,
                    image: base64,
                    image_base64: base64,
                    image_remove: false,
                    image_original: '',
                    image_url: ''
                }
            }));
        };

        const handleQuestionImageRemove = () => {
            setEditingQuestion(prev => ({
                ...prev,
                question: {
                    ...prev.question,
                    image: '',
                    image_base64: 'null',
                    image_remove: true,
                    image_original: '',
                    image_url: ''
                }
            }));
        };

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

        const renderMCGroupEditor = () => {
            const groupItems = Array.isArray(question.group_items) ? question.group_items : [];

            const updateGroupItems = (items) => {
                setEditingQuestion(prev => ({
                    ...prev,
                    question: {
                        ...prev.question,
                        group_items: items
                    }
                }));
            };

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

            const addItem = () => updateGroupItems([...(groupItems || []), createGroupItem()]);
            const removeItem = (idx) => updateGroupItems(groupItems.filter((_, i) => i !== idx));

            return (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {groupItems.map((item, itemIdx) => (
                        <Card key={item.id || itemIdx} variant="outlined">
                            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="subtitle1">Question {itemIdx + 1}</Typography>
                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
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
                                    placeholder="Sub-question text shown to students"
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
            );
        };

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
                const cellValue = typeof newRows[rowIdx][cellIdx] === 'object' 
                    ? (newRows[rowIdx][cellIdx].text || newRows[rowIdx][cellIdx].content || '')
                    : (newRows[rowIdx][cellIdx] || '');
                newRows[rowIdx][cellIdx] = value;
                handleEditingExtraDataChange('rows', newRows);
            };

            const parseGapsFromCell = (cellText) => {
                const gapRegex = /\[\[(\d+)\]\]/g;
                const matches = [...(cellText?.matchAll(gapRegex) || [])];
                return matches.map(m => parseInt(m[1], 10));
            };

            const getAllGapsFromTable = () => {
                const allGaps = new Set();
                extra_data.rows.forEach(row => {
                    row.forEach(cell => {
                        const cellText = typeof cell === 'object' 
                            ? (cell.text || cell.content || '')
                            : (cell || '');
                        const gaps = parseGapsFromCell(cellText);
                        gaps.forEach(gapNum => allGaps.add(gapNum));
                    });
                });
                return Array.from(allGaps).sort((a, b) => a - b);
            };

            const addColumn = () => {
                 const newHeaders = [...extra_data.headers, `Header ${extra_data.headers.length + 1}`];
                 const newRows = extra_data.rows.map(row => [...row, '']);
                 handleEditingExtraDataChange('headers', newHeaders);
                 handleEditingExtraDataChange('rows', newRows);
            };

            const addRow = () => {
                const newRow = Array(extra_data.headers.length).fill('');
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
                                    {row.map((cell, cellIdx) => {
                                        const cellText = typeof cell === 'object' 
                                            ? (cell.text || cell.content || '')
                                            : (cell || '');
                                        const gapsInCell = parseGapsFromCell(cellText);
                                        return (
                                            <td key={cellIdx} style={{ border: '1px solid #ddd', padding: '8px', minWidth: 200 }}>
                                                <Box display="flex" flexDirection="column" gap={1}>
                                                    <TextField
                                                        fullWidth
                                                        variant="standard"
                                                        value={cellText}
                                                        onChange={(e) => handleCellChange(rowIdx, cellIdx, e.target.value)}
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
                                                                const gapNumStr = String(gapNum);
                                                                let gapAnswer = '';
                                                                if (question.extra_data?.answers && typeof question.extra_data.answers === 'object') {
                                                                    gapAnswer = question.extra_data.answers[gapNumStr] || question.extra_data.answers[gapNum] || '';
                                                                }
                                                                if (!gapAnswer && question.gaps && Array.isArray(question.gaps)) {
                                                                    const gapObj = question.gaps.find(g => String(g.number) === gapNumStr || g.number === gapNum);
                                                                    if (gapObj) {
                                                                        gapAnswer = gapObj.answer || '';
                                                                    }
                                                                }
                                                                return (
                                                                    <TextField
                                                                        key={gapNum}
                                                                        size="small"
                                                                        label={`Gap [[${gapNum}]]`}
                                                                        value={gapAnswer}
                                                                        onChange={e => {
                                                                            const currentAnswers = question.extra_data?.answers || {};
                                                                            handleEditingExtraDataChange('answers', {
                                                                                ...currentAnswers,
                                                                                [gapNumStr]: e.target.value
                                                                            });
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
                                label="Task Prompt"
                                fullWidth
                                multiline
                                rows={2}
                                variant="outlined"
                                margin="normal"
                                value={question.task_prompt || ''}
                                onChange={(e) => handleEditingQuestionChange('task_prompt', e.target.value)}
                                placeholder="Text students see as task description before answering."
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

                        <Grid item xs={12}>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>Question Image</Typography>
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
                                            await handleQuestionImageUpload(file);
                                            e.target.value = '';
                                        }}
                                    />
                                </Button>
                                {imagePreview && (
                                    <Button
                                        variant="text"
                                        color="error"
                                        onClick={handleQuestionImageRemove}
                                    >
                                        Remove image
                                    </Button>
                                )}
                            </Box>
                            {imagePreview && (
                                <Box sx={{ mt: 2 }}>
                                    <img
                                        src={imagePreview}
                                        alt="Question"
                                        style={{ width: '100%', maxWidth: 320, height: 'auto', borderRadius: 8, border: '1px solid #e5e7eb' }}
                                    />
                                </Box>
                            )}
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
                            {question_type === 'multiple_choice_group' && renderMCGroupEditor()}
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