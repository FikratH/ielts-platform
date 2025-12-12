import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase-config';
import { useAuthState } from 'react-firebase-hooks/auth';
import api from '../api';


const ReadingTimer = ({ timeLeft, color = 'text-green-600' }) => {
    const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const secs = (timeLeft % 60).toString().padStart(2, '0');
    return (
        <div className="flex flex-col items-center">
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-4 border border-green-200 shadow-sm">
                <div className="text-center">
                    <div className="text-3xl font-bold text-green-700 font-mono tracking-wider">{mins}:{secs}</div>
                    <div className="text-xs text-green-600 font-medium mt-1">Time Remaining</div>
                </div>
            </div>
        </div>
    );
};

const PassageContent = React.memo(({ passageHtml, onMouseUp }) => {
    return (
        <div 
            className="prose prose-base lg:prose-lg max-w-none text-black leading-relaxed text-sm sm:text-base lg:text-lg whitespace-pre-wrap" 
            style={{ lineHeight: '1.6' }}
            onMouseUp={onMouseUp}
            suppressContentEditableWarning={true}
            dangerouslySetInnerHTML={{ __html: passageHtml }}
        />
    );
}, (prevProps, nextProps) => {
    return prevProps.passageHtml === nextProps.passageHtml;
});


const ReadingTestPlayer = ({ testId: propTestId, onComplete }) => {
    const { id: paramTestId } = useParams();
    const testId = propTestId || paramTestId;
    const navigate = useNavigate();
    const location = useLocation();
    const [user, loading] = useAuthState(auth);

    // Test state
    const [test, setTest] = useState(null);
    const [session, setSession] = useState(null);
    const [currentPartIndex, setCurrentPartIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [timeLeft, setTimeLeft] = useState(3600); // 60 minutes for reading
    const deadlineRef = useRef(null);
    const autoSubmitRef = useRef(false);

    // UI state
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    
    // Highlighting state
    const [highlights, setHighlights] = useState({});
    const [isHighlightMode, setIsHighlightMode] = useState(false);
    const passageRef = useRef(null);
    const highlightModeRef = useRef(false);

    // Effect to start session and load test
    useEffect(() => {
        if (user && testId) {
            startSessionAndLoadTest();
        }
    }, [user, testId]);

    const sortedParts = test?.parts?.sort((a, b) => a.part_number - b.part_number) || [];
    const currentPart = sortedParts[currentPartIndex];

    // Timer effect
    useEffect(() => {
        if (!session || session.completed) return;
        const timer = setInterval(() => {
            if (!deadlineRef.current) return;
            const remaining = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
            setTimeLeft(remaining);
            if (remaining <= 0 && !autoSubmitRef.current) {
                autoSubmitRef.current = true;
                submitTest();
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [session]);

    const startSessionAndLoadTest = async () => {
        setIsLoading(true);
        setError(null);
        if (!user) {
            setError('Please login to start the test.');
            setIsLoading(false);
            return;
        }
        try {
      const isDiagnostic = location.pathname.includes('/dashboard') ? false : 
                          new URLSearchParams(location.search).get('diagnostic');
      const url = isDiagnostic ? 
        `/reading-tests/${testId}/start/?diagnostic=true` : 
        `/reading-tests/${testId}/start/`;
      const sessionResponse = await api.post(url);
      const newSession = sessionResponse.data;
      setSession(newSession);
      const initial = newSession.time_left_seconds || 3600;
      deadlineRef.current = Date.now() + initial * 1000;
      setTimeLeft(Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000)));
            
            // Загружаем ответы для всех сессий (включая завершенные для отображения результатов)
            setAnswers(newSession.answers || {});

            const testResponse = await api.get(`/reading-tests/${testId}/`);
            const testData = testResponse.data;
            
            // Сортируем части по part_number для правильного порядка
            if (testData.parts) {
                testData.parts.sort((a, b) => a.part_number - b.part_number);
            }
            
            setTest(testData);

        } catch (err) {
            if (err.response?.status === 409) {
                setError('You have already completed the diagnostic test for Reading.');
            } else if (err.response?.status === 403) {
                setError('Diagnostic tests are not available if you have completed any regular tests.');
            } else if (err.response?.status === 400) {
                setError('This test is not marked as a diagnostic template.');
            } else if (err.response && (err.response.status === 401 || err.response.status === 403)) {
                setError('Session expired, please login again.');
                setTimeout(() => navigate('/login'), 1500);
            } else {
                setError('Failed to load or start the test. Please try again.');
            }
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnswerChange = (questionId, subKey, value, type = 'text') => {
        const qIdStr = questionId.toString();
        
        setAnswers(prev => {
            const newAnswers = { ...prev };

            if (type === 'multiple_choice') {
                newAnswers[qIdStr] = { text: value };
            } else if (type === 'multiple_response') {
                const currentSelection = Array.isArray(newAnswers[qIdStr]) ? newAnswers[qIdStr] : [];
                if (value.checked) {
                    newAnswers[qIdStr] = [...currentSelection, value.text];
                } else {
                    newAnswers[qIdStr] = currentSelection.filter(item => item !== value.text);
                }
            } else if (type === 'multiple_choice_group') {
                const currentGroupAnswers = (newAnswers[qIdStr] && typeof newAnswers[qIdStr] === 'object' && !Array.isArray(newAnswers[qIdStr]))
                    ? { ...newAnswers[qIdStr] }
                    : {};
                if (subKey) {
                    currentGroupAnswers[subKey] = value;
                    newAnswers[qIdStr] = currentGroupAnswers;
                    newAnswers[`${qIdStr}__${subKey}`] = value;
                }
            } else { // For gap_fill, matching, table... which use a subKey
                const currentSubAnswers = newAnswers[qIdStr] || {};
                newAnswers[qIdStr] = { ...currentSubAnswers, [subKey]: value };
            }

            return newAnswers;
        });
        
        // Auto-sync after a delay
        setTimeout(syncAnswers, 1000);
    };

    const syncAnswers = async () => {
        if (!session) return;
        try {
            const remaining = deadlineRef.current ? Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000)) : timeLeft;
            await api.patch(`/reading-sessions/${session.id}/sync/`, { answers, time_left: remaining });
        } catch (err) {
            // Silent error for sync
        }
    };

    const submitTest = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        if (!user) {
            setError('Please login to submit the test.');
            setIsSubmitting(false);
            return;
        }
        try {
            const remaining = deadlineRef.current ? Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000)) : timeLeft;
            const response = await api.put(`/reading-sessions/${session.id}/submit/`, { answers, time_left: remaining });
            if (onComplete) {
                onComplete(session.id);
            } else {
                navigate(`/reading-result/${session.id}`);
            }
        } catch (err) {
            if (err.response && (err.response.status === 401 || err.response.status === 403)) {
                setError('Session expired, please login again.');
                setTimeout(() => navigate('/login'), 1500);
            } else {
                console.error('🔥 ERROR submitting test:', err.response?.data || err);
                alert('Failed to submit test. Please try again.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleHighlightMode = useCallback(() => {
        setIsHighlightMode(prev => {
            const newMode = !prev;
            highlightModeRef.current = newMode;
            return newMode;
        });
    }, []);

    const removeHighlight = useCallback((partId, highlightId) => {
        setHighlights(prev => ({
            ...prev,
            [partId]: (prev[partId] || []).filter(h => h.id !== highlightId)
        }));

        if (!passageRef.current) return;

        const markElement = passageRef.current.querySelector(`[data-highlight-id="${highlightId}"]`);
        if (markElement) {
            const parent = markElement.parentNode;
            if (parent) {
                while (markElement.firstChild) {
                    parent.insertBefore(markElement.firstChild, markElement);
                }
                parent.removeChild(markElement);
                parent.normalize();
            }
        }
    }, []);

    const isSelectionInsidePassage = useCallback((range) => {
        if (!passageRef.current || !range) return false;
        
        try {
            const container = range.commonAncestorContainer;
            if (!container) return false;
            
            const nodeType = container.nodeType;
            
            if (nodeType === Node.TEXT_NODE) {
                return container.parentNode && passageRef.current.contains(container.parentNode);
            } else if (nodeType === Node.ELEMENT_NODE) {
                return passageRef.current.contains(container);
            }
        } catch (e) {
            return false;
        }
        
        return false;
    }, []);

    const checkHighlightOverlap = useCallback((range) => {
        if (!passageRef.current || !range) return false;
        
        const existingHighlights = passageRef.current.querySelectorAll('[data-highlight-id]');
        for (const highlight of existingHighlights) {
            const highlightRange = document.createRange();
            try {
                highlightRange.selectNodeContents(highlight);
                if (range.intersectsNode(highlight) || 
                    highlightRange.intersectsNode(range.startContainer) ||
                    highlightRange.intersectsNode(range.endContainer)) {
                    return true;
                }
            } catch (e) {
                continue;
            }
        }
        return false;
    }, []);

    const handleTextSelection = useCallback(() => {
        const currentMode = highlightModeRef.current;
        
        if (!currentMode) {
            return;
        }
        
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        
        const selectedText = selection.toString().trim();
        if (selectedText.length === 0) return;
        
        try {
            const range = selection.getRangeAt(0);
            const partId = currentPart?.id;
            
            if (!partId || !passageRef.current) return;
            
            if (!isSelectionInsidePassage(range)) return;
            
            if (checkHighlightOverlap(range)) {
                selection.removeAllRanges();
                return;
            }

            const highlightId = `highlight-${Date.now()}-${Math.random()}`;
            
            const newHighlight = {
                id: highlightId,
                text: selectedText
            };

            setHighlights(prev => ({
                ...prev,
                [partId]: [...(prev[partId] || []), newHighlight]
            }));

            try {
                const mark = document.createElement('mark');
                mark.style.backgroundColor = '#fef08a';
                mark.style.padding = '2px 0';
                mark.style.borderRadius = '2px';
                mark.dataset.highlightId = highlightId;
                
                try {
                    range.surroundContents(mark);
                } catch (e) {
                    const documentFragment = range.extractContents();
                    mark.appendChild(documentFragment);
                    range.insertNode(mark);
                }
                
                selection.removeAllRanges();
            } catch (e) {
                console.error('Ошибка хайлайтинга:', e);
                selection.removeAllRanges();
            }
        } catch (e) {
            console.error('Ошибка обработки выделения:', e);
            if (selection) {
                selection.removeAllRanges();
            }
        }
    }, [currentPart, isSelectionInsidePassage, checkHighlightOverlap, removeHighlight]);

    const restoreHighlights = useCallback((partId) => {
        if (!partId || !passageRef.current) return;
        
        const partHighlights = highlights[partId] || [];
        if (partHighlights.length === 0) return;

        const passageElement = passageRef.current.querySelector('div[class*="prose"]');
        if (!passageElement) return;

        const passageText = passageElement.textContent || '';
        
        partHighlights.forEach(highlight => {
            const existingMark = passageElement.querySelector(`[data-highlight-id="${highlight.id}"]`);
            if (existingMark) return;

            const highlightText = highlight.text.trim();
            if (!highlightText) return;

            const textIndex = passageText.indexOf(highlightText);
            if (textIndex === -1) return;

            try {
                const walker = document.createTreeWalker(
                    passageElement,
                    NodeFilter.SHOW_TEXT,
                    null
                );

                let charCount = 0;
                let startNode = null;
                let startOffset = 0;
                let endNode = null;
                let endOffset = 0;

                let node;
                while (node = walker.nextNode()) {
                    const nodeLength = node.textContent.length;
                    
                    if (startNode === null && charCount + nodeLength > textIndex) {
                        startNode = node;
                        startOffset = textIndex - charCount;
                    }
                    
                    if (charCount + nodeLength >= textIndex + highlightText.length) {
                        endNode = node;
                        endOffset = textIndex + highlightText.length - charCount;
                        break;
                    }
                    
                    charCount += nodeLength;
                }

                if (startNode && endNode) {
                    const range = document.createRange();
                    range.setStart(startNode, startOffset);
                    range.setEnd(endNode, endOffset);

                    const mark = document.createElement('mark');
                    mark.style.backgroundColor = '#fef08a';
                    mark.style.padding = '2px 0';
                    mark.style.borderRadius = '2px';
                    mark.dataset.highlightId = highlight.id;

                    try {
                        range.surroundContents(mark);
                    } catch (e) {
                        const documentFragment = range.extractContents();
                        mark.appendChild(documentFragment);
                        range.insertNode(mark);
                    }
                }
            } catch (e) {
                console.error('Ошибка восстановления highlight:', e);
            }
        });
    }, [highlights, removeHighlight]);

    const clearAllHighlights = useCallback(() => {
        const partId = currentPart?.id;
        if (!partId || !passageRef.current) return;

        const currentHighlights = highlights[partId] || [];
        currentHighlights.forEach(highlight => {
            const markElement = passageRef.current.querySelector(`[data-highlight-id="${highlight.id}"]`);
            if (markElement) {
                const parent = markElement.parentNode;
                if (parent) {
                    while (markElement.firstChild) {
                        parent.insertBefore(markElement.firstChild, markElement);
                    }
                    parent.removeChild(markElement);
                }
            }
        });

        setHighlights(prev => ({
            ...prev,
            [partId]: []
        }));
    }, [currentPart, highlights]);

    useEffect(() => {
        if (currentPart?.id && passageRef.current) {
            const timer = setTimeout(() => {
                restoreHighlights(currentPart.id);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [currentPart?.id, restoreHighlights]);


    const renderQuestion = (question) => {
        const type = question.question_type?.toLowerCase();

        // Header block for all questions
        const headerBlock = (
            <div className="mb-4">
                {question.header && (
                    <h3 className="text-lg lg:text-xl font-bold text-green-700 mb-2">
                        {question.header}
                    </h3>
                )}
                {question.instruction && (
                    <div className="text-gray-600 italic mt-1 bg-green-50/30 p-3 rounded-lg text-sm lg:text-base" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                        {question.instruction}
                    </div>
                )}
                {question.task_prompt && (
                    <div className="font-semibold text-xl text-black text-center mb-3 whitespace-pre-wrap">
                        {question.task_prompt}
                    </div>
                )}
                {question.image_url && (
                    <div className="my-4 flex justify-center">
                        <img
                            src={question.image_url}
                            alt="Question Illustration"
                            className="rounded-xl shadow-md border border-green-100 max-w-full h-auto"
                            style={{ maxWidth: '400px', maxHeight: '250px' }}
                        />
                    </div>
                )}
            </div>
        );
        
        // --- Multiple Choice ---
        if (["multiple_choice", "multiplechoice"].includes(type) && Array.isArray(question.answer_options)) {
            const selectedAnswer = answers[question.id.toString()]?.text;
            return (
                <div key={question.id} className="mb-6 lg:mb-8 p-4 lg:p-6 border border-green-100 rounded-2xl shadow-md bg-gradient-to-br from-green-50/30 to-white">
                    {headerBlock}
                    <p className="font-semibold text-gray-800 mb-3 lg:mb-4 text-base lg:text-lg whitespace-pre-wrap">{question.question_text}</p>
                    <div className="space-y-2 lg:space-y-3">
                        {question.answer_options.map((option) => {
                            const isSelected = selectedAnswer === option.label;
                            return (
                                <label key={option.id} className={`flex items-center space-x-3 lg:space-x-4 cursor-pointer p-2 lg:p-3 rounded-xl transition-colors duration-200 ${
                                    isSelected 
                                        ? 'bg-green-100 border-2 border-green-300 shadow-sm' 
                                        : 'hover:bg-green-50 border-2 border-transparent'
                                }`}>
                                    <input
                                        type="radio"
                                        name={`question-${question.id}`}
                                        value={option.label}
                                        checked={isSelected}
                                        onChange={(e) => handleAnswerChange(question.id, null, e.target.value, 'multiple_choice')}
                                        className="h-4 w-4 lg:h-5 lg:w-5 text-green-600 border-gray-300 focus:ring-green-500 accent-green-600 flex-shrink-0"
                                    />
                                    <span className={`font-medium text-sm lg:text-lg ${
                                        isSelected ? 'text-green-700 font-semibold' : 'text-gray-700'
                                    }`}>{option.label}. {option.text}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            );
        }

        // --- Multiple Choice Group ---
        if (type === 'multiple_choice_group') {
            const groupItems = Array.isArray(question.extra_data?.group_items) && question.extra_data.group_items.length
                ? question.extra_data.group_items
                : (Array.isArray(question.group_items) ? question.group_items : []);
            const groupedAnswers = (answers[question.id.toString()] && typeof answers[question.id.toString()] === 'object')
                ? answers[question.id.toString()]
                : {};

            return (
                <div key={question.id} className="mb-6 lg:mb-8 p-4 lg:p-6 border border-green-100 rounded-2xl shadow-md bg-gradient-to-br from-green-50/30 to-white">
                    {headerBlock}
                    {question.question_text && (
                        <p className="font-semibold text-gray-800 mb-3 lg:mb-4 text-base lg:text-lg whitespace-pre-wrap">{question.question_text}</p>
                    )}
                    <div className="space-y-4">
                        {groupItems.map((item, idx) => {
                            const itemId = item.id || `item-${idx}`;
                            const options = Array.isArray(item.options) ? item.options : [];
                            const selectedLabel = groupedAnswers[itemId] ?? answers[`${question.id}__${itemId}`];

                            return (
                                <div key={itemId} className="p-3 lg:p-4 border border-green-100 rounded-xl bg-white/70 shadow-sm">
                                    <div className="font-medium text-gray-800 mb-2 text-sm lg:text-base">
                                        {item.prompt || `Question ${idx + 1}`}
                                    </div>
                                    <div className="space-y-2 lg:space-y-3">
                                        {options.map((option, optIdx) => {
                                            const label = option.label || String.fromCharCode(65 + optIdx);
                                            const isSelected = selectedLabel === label;
                                            return (
                                                <label
                                                    key={label}
                                                    className={`flex items-center space-x-3 lg:space-x-4 cursor-pointer p-2 lg:p-3 rounded-xl transition ${
                                                        isSelected ? 'bg-green-100 border-2 border-green-300 shadow-sm' : 'hover:bg-green-50 border-2 border-transparent'
                                                    }`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name={`question-${question.id}-${itemId}`}
                                                        value={label}
                                                        checked={isSelected}
                                                        onChange={(e) => handleAnswerChange(question.id, itemId, e.target.value, 'multiple_choice_group')}
                                                        className="h-4 w-4 lg:h-5 lg:w-5 text-green-600 border-gray-300 focus:ring-green-500 accent-green-600 flex-shrink-0"
                                                    />
                                                    <span className={`font-medium text-sm lg:text-lg ${
                                                        isSelected ? 'text-green-700 font-semibold' : 'text-gray-700'
                                                    }`}>{label}. {option.text}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }

        // --- Multiple Response ---
        if (type === 'multiple_response' && Array.isArray(question.answer_options)) {
            const selectedAnswers = answers[question.id.toString()] || [];
            return (
                <div key={question.id} className="mb-6 lg:mb-8 p-4 lg:p-6 border border-green-100 rounded-2xl shadow-md bg-gradient-to-br from-green-50/30 to-white">
                    {headerBlock}
                    <p className="font-semibold text-gray-800 mb-3 lg:mb-4 text-base lg:text-lg whitespace-pre-wrap">{question.question_text}</p>
                    <div className="space-y-2 lg:space-y-3">
                        {question.answer_options.map((option) => {
                            const isSelected = selectedAnswers.includes(option.text);
                            return (
                                <label key={option.id} className={`flex items-center space-x-3 lg:space-x-4 cursor-pointer p-2 lg:p-3 rounded-xl transition-colors duration-200 ${
                                    isSelected 
                                        ? 'bg-green-100 border-2 border-green-300 shadow-sm' 
                                        : 'hover:bg-green-50 border-2 border-transparent'
                                }`}>
                                    <input
                                        type="checkbox"
                                        name={`question-${question.id}`}
                                        checked={isSelected}
                                        onChange={(e) => handleAnswerChange(question.id, null, { text: option.text, checked: e.target.checked }, 'multiple_response')}
                                        className="h-4 w-4 lg:h-5 lg:w-5 rounded text-green-600 border-gray-300 focus:ring-green-500 accent-green-600 flex-shrink-0"
                                    />
                                    <span className={`font-medium text-sm lg:text-lg ${
                                        isSelected ? 'text-green-700 font-semibold' : 'text-gray-700'
                                    }`}>{option.label}. {option.text}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            );
        }

        // --- Gap Fill ---
        if (["gap_fill", "gapfill", "summary_completion", "sentence_completion"].includes(type) && question.question_text) {
            const gapRegex = /\[\[(\d+)\]\]/g;
            const text = question.question_text;
            let lastIndex = 0;
            const parts = [];

            let match;
            while ((match = gapRegex.exec(text)) !== null) {
                const before = text.slice(lastIndex, match.index);
                if (before) {
                    parts.push(
                        <span
                            key={`t${parts.length}`}
                            dangerouslySetInnerHTML={{ __html: before }}
                        />
                    );
                }
                const gapNumber = match[1];
                const subKey = `gap${gapNumber}`;
                parts.push(
                    <span key={subKey} className="inline-block mx-1">
                        <input
                            type="text"
                            value={answers[question.id.toString()]?.[subKey] || ''}
                            onChange={e => handleAnswerChange(question.id, subKey, e.target.value, 'gap_fill')}
                            className="border-b-2 border-green-400 focus:border-green-600 outline-none text-center bg-transparent w-32 lg:w-40 rounded-t-lg transition-colors duration-200 text-sm lg:text-base"
                            autoComplete="off"
                        />
                         <span className="text-green-600 font-bold ml-1 text-sm lg:text-base">{gapNumber}</span>
                    </span>
                );
                lastIndex = gapRegex.lastIndex;
            }
            const remaining = text.slice(lastIndex);
            if (remaining) {
                parts.push(
                    <span
                        key="end"
                        dangerouslySetInnerHTML={{ __html: remaining }}
                    />
                );
            }

            return (
                <div key={question.id} className="mb-6 lg:mb-8 p-4 lg:p-6 border border-green-100 rounded-2xl shadow-md bg-gradient-to-br from-green-50/30 to-white">
                    {headerBlock}
                    <div className="text-gray-800 leading-relaxed text-base lg:text-lg gap-fill-html whitespace-pre-line">
                        {parts}
                    </div>
                </div>
            );
        }

        // --- Table Completion ---
        if (['table', 'table_completion'].includes(type) && question.extra_data && question.extra_data.headers && question.extra_data.rows) {
            const { headers, rows } = question.extra_data;
            
            const renderCell = (cell, rIdx, cIdx) => {
                const cellText = typeof cell === 'object' 
                    ? (cell.text || cell.content || (cell.parts && Array.isArray(cell.parts) ? cell.parts.map(p => p.content || p.text || '').join('') : ''))
                    : (cell || '');
                
                if (!cellText && typeof cell !== 'object') {
                    return <span></span>;
                }

                const gapRegex = /\[\[(\d+)\]\]/g;
                const parts = [];
                let lastIndex = 0;
                let match;

                while ((match = gapRegex.exec(cellText)) !== null) {
                    const before = cellText.slice(lastIndex, match.index);
                    if (before) {
                        parts.push(
                            <span
                                key={`t${parts.length}`}
                                dangerouslySetInnerHTML={{ __html: before }}
                            />
                        );
                    }
                    const gapNumber = match[1];
                    const gapKey = `r${rIdx}c${cIdx}__gap${gapNumber}`;
                    parts.push(
                        <input
                            key={`gap${gapNumber}`}
                            type="text"
                            value={answers[question.id.toString()]?.[gapKey] || ''}
                            onChange={e => handleAnswerChange(question.id, gapKey, e.target.value, 'table')}
                            className="inline-block min-w-[60px] lg:min-w-[80px] p-1 lg:p-2 border-2 border-blue-200 rounded-lg outline-none bg-white focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 text-sm lg:text-base mx-1"
                            placeholder="..."
                            autoComplete="off"
                        />
                    );
                    lastIndex = gapRegex.lastIndex;
                }

                const remaining = cellText.slice(lastIndex);
                if (remaining) {
                    parts.push(
                        <span
                            key="end"
                            dangerouslySetInnerHTML={{ __html: remaining }}
                        />
                    );
                }

                if (parts.length === 0) {
                    if (typeof cell === 'object' && cell.type === 'gap') {
                        return (
                            <input
                                type="text"
                                value={answers[question.id.toString()]?.[`r${rIdx}c${cIdx}`] || ''}
                                onChange={e => handleAnswerChange(question.id, `r${rIdx}c${cIdx}`, e.target.value, 'table')}
                                className="w-full border-2 border-blue-200 rounded-lg p-2 outline-none bg-white focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 text-sm lg:text-base"
                                placeholder="..."
                                autoComplete="off"
                            />
                        );
                    }
                    return <span className="text-sm lg:text-base" dangerouslySetInnerHTML={{ __html: cellText }} />;
                }

                return <span className="flex items-center gap-1 flex-wrap text-sm lg:text-base">{parts}</span>;
            };
            
            return (
                 <div key={question.id} className="mb-6 lg:mb-8 p-4 lg:p-6 border border-green-100 rounded-2xl shadow-md bg-gradient-to-br from-green-50/30 to-white">
                    {headerBlock}
                    <div className="overflow-x-auto">
                        <table className="min-w-full border border-green-200 rounded-xl overflow-hidden shadow-sm">
                            <thead>
                                <tr className="bg-gradient-to-r from-green-100 to-green-50">
                                    {headers.map((h, idx) => <th key={idx} className="p-3 lg:p-4 border-b border-green-200 text-left font-semibold text-green-700 text-sm lg:text-base">{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, rIdx) => (
                                    <tr key={rIdx} className="hover:bg-blue-50/50 transition-colors duration-200">
                                        {row.map((cell, cIdx) => (
                                            <td key={cIdx} className="p-3 lg:p-4 border border-blue-100">
                                                {renderCell(cell, rIdx, cIdx)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )
        }

        // --- Matching ---
        if (type === 'matching' && question.extra_data && Array.isArray(question.extra_data.items)) {
            const { items, options } = question.extra_data;
            const userAnswers = answers[question.id.toString()] || {};

            return (
                <div key={question.id} className="mb-6 lg:mb-8 p-4 lg:p-6 border border-green-100 rounded-2xl shadow-md bg-gradient-to-br from-green-50/30 to-white">
                    {headerBlock}
                    <div className="flex flex-col gap-6 lg:gap-8">
                        {/* Items to be matched */}
                        <div className="flex-1">
                            <ul className="space-y-3 lg:space-y-4">
                                {items.map((item, idx) => (
                                    <li key={idx} className="flex flex-col lg:flex-row lg:items-center lg:justify-between p-3 lg:p-4 bg-white rounded-xl border border-green-100 shadow-sm gap-3 lg:gap-0">
                                        <span className="text-gray-800 font-medium text-sm lg:text-base">{item.text}</span>
                                        <select
                                            value={userAnswers[item.text] || ''}
                                            onChange={(e) => handleAnswerChange(question.id, item.text, e.target.value, 'matching')}
                                            className="lg:ml-4 p-2 lg:p-3 border-2 border-green-200 rounded-xl shadow-sm focus:ring-2 focus:ring-green-400 focus:border-green-400 transition-all duration-200 text-sm lg:text-base"
                                        >
                                            <option value="" disabled>Select...</option>
                                            {(options || []).map((opt, optIdx) => (
                                                <option key={optIdx} value={opt.text}>{opt.text}</option>
                                            ))}
                                        </select>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            );
        }

        // --- True/False/Not Given ---
        if (type === 'true_false_not_given' && question.extra_data && Array.isArray(question.extra_data.statements)) {
            const { statements } = question.extra_data;
            const choices = ["True", "False", "Not Given"];
            return (
                <div key={question.id} className="mb-6 lg:mb-8 p-4 lg:p-6 border border-green-100 rounded-2xl shadow-md bg-gradient-to-br from-green-50/30 to-white">
                    {headerBlock}
                    <p className="font-semibold text-gray-800 mb-3 lg:mb-4 text-base lg:text-lg whitespace-pre-wrap">{question.question_text}</p>
                    <div className="space-y-3 lg:space-y-4">
                        {statements.map((stmt, sIdx) => (
                            <div key={sIdx} className="p-3 lg:p-4 rounded-xl border border-green-100 bg-white shadow-sm">
                                <p className="mb-2 lg:mb-3 text-gray-800 font-medium text-sm lg:text-base">{sIdx + 1}. {stmt}</p>
                                <div className="flex flex-wrap gap-4 lg:gap-6">
                                    {choices.map(choice => (
                                        <label key={choice} className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name={`question-${question.id}-stmt-${sIdx}`}
                                                value={choice}
                                                checked={answers[question.id.toString()]?.[`stmt${sIdx}`] === choice}
                                                onChange={(e) => handleAnswerChange(question.id, `stmt${sIdx}`, e.target.value, 'true_false_not_given')}
                                                className="h-4 w-4 lg:h-5 lg:w-5 text-green-600 border-gray-300 focus:ring-green-500 accent-green-600 flex-shrink-0"
                                            />
                                            <span className="font-medium text-sm lg:text-base">{choice}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        
        // --- Fallback for unknown question types ---
        return <div key={question.id} className="p-4 bg-yellow-100 rounded-md">Unsupported question type: {question.question_type}</div>;
    };


    if (isLoading) return <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-green-50 to-white"><div className="text-lg font-semibold text-gray-600">Loading test session...</div></div>;
    if (error) return <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-green-50 to-white"><div className="p-8 bg-red-100 text-red-700 rounded-lg shadow-md">Error: {error}</div></div>;

    return (
        <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
            {/* Elegant Header with Logo and Timer */}
            <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                        {/* Left Side - Logo and Test Info */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3">
                                <img src="/logo.png" alt="Master Education" className="w-8 h-8 rounded-full" />
                                <div className="text-gray-900">
                                    <h2 className="text-sm font-medium">Master Education</h2>
                                    
                                </div>
                            </div>
                            <div className="hidden sm:block w-px h-8 bg-gray-300"></div>
                            <div>
                                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">{test?.title || 'Reading Test'}</h1>
                                <p className="text-sm text-gray-600">Part {currentPartIndex + 1} of {sortedParts.length || 0}</p>
                            </div>
                        </div>
                        
                        {/* Right Side - Timer */}
                        <div className="flex items-center gap-3">
                            <ReadingTimer timeLeft={timeLeft} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full px-1 sm:px-2 py-4 sm:py-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6 lg:gap-8 justify-center items-start">
                    {/* Left Panel: Passage + Navigation */}
                    <div className="lg:col-span-1 order-2 lg:order-1">
                        <div className="bg-white rounded-2xl shadow-xl p-3 sm:p-6 lg:p-8 lg:sticky lg:top-24 border border-green-100">
                            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-700 mb-3 sm:mb-4">
                                {currentPart?.passage_heading || 'Passage'}
                            </h1>
                            
                            {/* Highlighting Toolbar */}
                            {currentPart && (
                            <div className="flex items-center gap-3 mb-4 p-3 bg-green-50/50 rounded-xl border border-green-200">
                                <button
                                    onClick={toggleHighlightMode}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                                        isHighlightMode 
                                            ? 'bg-yellow-200 border-2 border-yellow-400 shadow-sm' 
                                            : 'bg-white border-2 border-gray-200 hover:bg-gray-50'
                                    }`}
                                    title={isHighlightMode ? "Highlighting enabled" : "Enable highlighting"}
                                >
                                    <svg 
                                        xmlns="http://www.w3.org/2000/svg" 
                                        className="h-5 w-5" 
                                        fill="none" 
                                        viewBox="0 0 24 24" 
                                        stroke="currentColor"
                                    >
                                        <path 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round" 
                                            strokeWidth={2} 
                                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" 
                                        />
                                    </svg>
                                </button>
                                <span className="text-sm text-gray-700 font-medium">
                                    {isHighlightMode ? 'Select text to highlight' : 'Highlight keywords'}
                                </span>
                                {highlights[currentPart?.id]?.length > 0 && (
                                    <button
                                        onClick={clearAllHighlights}
                                        className="ml-auto px-3 py-1.5 text-sm bg-red-50 text-red-600 hover:bg-red-100 rounded-lg border border-red-200 transition-colors duration-200"
                                    >
                                        Clear all
                                    </button>
                                )}
                            </div>
                            )}

                            {/* Passage content */}
                            <div 
                                ref={passageRef}
                                className="max-h-[300px] sm:max-h-[500px] lg:max-h-[1000px] overflow-y-auto mb-4 sm:mb-6"
                                style={{ userSelect: isHighlightMode ? 'text' : 'auto' }}
                            >
                                {currentPart ? (
                                    <PassageContent 
                                        key={`passage-${currentPart.id}`}
                                        passageHtml={currentPart.passage_text}
                                        onMouseUp={handleTextSelection}
                                    />
                                ) : (
                                    <div className="text-gray-400 text-center">Loading passage...</div>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* Right Panel: Questions */}
                    <div className="lg:col-span-1 order-1 lg:order-2 flex justify-center">
                        <div className="bg-white rounded-2xl shadow-xl p-3 sm:p-6 lg:p-8 border border-green-100 w-full">
                            {currentPart ? (
                                <>
                                    <div className="mb-4 sm:mb-6">
                                        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-green-700 mb-2 sm:mb-4">Part {currentPartIndex + 1}</h2>
                                        {/* Part Navigation */}
                                        <div className="mb-3 sm:mb-4">
                                            <div className="flex flex-wrap gap-2">
                                                {sortedParts.map((part, index) => (
                                                    <button
                                                        key={part.id}
                                                        onClick={() => setCurrentPartIndex(index)}
                                                        className={`px-2 sm:px-3 py-1 sm:py-2 rounded-lg font-semibold transition text-xs sm:text-sm ${
                                                            currentPartIndex === index
                                                                ? 'bg-green-100 text-green-700 shadow border border-green-200'
                                                                : 'hover:bg-green-50 text-gray-700 border border-gray-200'
                                                        }`}
                                                    >
                                                        Part {part.part_number || index + 1}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        {currentPart.instructions && (
                                            <p className="text-xs sm:text-sm lg:text-base text-gray-500 mb-2 sm:mb-4 bg-green-50/30 p-2 sm:p-3 lg:p-4 rounded-lg whitespace-pre-wrap">{currentPart.instructions}</p>
                                        )}
                                    </div>
                                    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
                                        {currentPart.questions?.map(renderQuestion)}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center p-8 w-full">Loading test data...</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Submit Button */}
            <div className="max-w-3xl mx-auto px-2 sm:px-4 lg:px-2 pb-8 sm:pb-16 lg:pb-[60px]">
                <button
                    onClick={() => setShowConfirm(true)}
                    disabled={isSubmitting}
                    className="w-full mt-6 sm:mt-8 lg:mt-10 bg-gradient-to-r from-green-100 to-green-200 text-green-700 font-bold text-base sm:text-lg lg:text-xl py-3 sm:py-4 rounded-2xl shadow-lg hover:from-green-200 hover:to-green-300 transition-all duration-300 disabled:opacity-50 border border-green-200"
                >
                    {isSubmitting ? 'Submitting...' : 'Submit Test'}
                </button>
            </div>
            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-green-100">
                        <h3 className="text-xl font-bold text-green-800 mb-3">Submit Reading test?</h3>
                        <p className="text-sm text-gray-700 mb-6">Review your answers. You won’t be able to edit them after submit.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition"
                            >
                                Continue editing
                            </button>
                            <button
                                onClick={() => { setShowConfirm(false); submitTest(); }}
                                className="flex-1 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 transition shadow"
                            >
                                Submit now
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReadingTestPlayer; 