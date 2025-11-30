import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

const colors = ['#fde047', '#86efac', '#93c5fd', '#fca5a5'];

const TeacherWritingEditorPage = () => {
  const { essayId, sessionId } = useParams();
  const navigate = useNavigate();
  const [essay, setEssay] = useState(null);
  const [secondEssay, setSecondEssay] = useState(null);
  const [activeTask, setActiveTask] = useState('task1');

  const [feedback, setFeedback] = useState({ 
    overall_feedback: '', 
    annotations: [],
    teacher_task_feedback: '',
    teacher_coherence_feedback: '',
    teacher_lexical_feedback: '',
    teacher_grammar_feedback: ''
  });
  const [teacherScores, setTeacherScores] = useState({
    teacher_task_score: '',
    teacher_coherence_score: '',
    teacher_lexical_score: '',
    teacher_grammar_score: ''
  });

  const [feedback2, setFeedback2] = useState({ 
    overall_feedback: '', 
    annotations: [],
    teacher_task_feedback: '',
    teacher_coherence_feedback: '',
    teacher_lexical_feedback: '',
    teacher_grammar_feedback: ''
  });
  const [teacherScores2, setTeacherScores2] = useState({
    teacher_task_score: '',
    teacher_coherence_score: '',
    teacher_lexical_score: '',
    teacher_grammar_score: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState(null);
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [currentComment, setCurrentComment] = useState('');
  const [hoveredAnnotation, setHoveredAnnotation] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      if (sessionId) {
        const res = await api.get(`/teacher/writing/sessions/${sessionId}/feedback/`);
        const items = res.data.items || [];
        // Expect up to two essays (task1, task2)
        const first = items[0] || {};
        const second = items[1] || null;
        setEssay(first.essay || null);
        setSecondEssay(second ? (second.essay || null) : null);
        const fb = first.feedback || { 
          overall_feedback: '', 
          annotations: [],
          teacher_task_feedback: '',
          teacher_coherence_feedback: '',
          teacher_lexical_feedback: '',
          teacher_grammar_feedback: ''
        };
        setFeedback(fb);
        setTeacherScores({
          teacher_task_score: fb.teacher_task_score || '',
          teacher_coherence_score: fb.teacher_coherence_score || '',
          teacher_lexical_score: fb.teacher_lexical_score || '',
          teacher_grammar_score: fb.teacher_grammar_score || ''
        });
        if (second && second.feedback) {
          const fb2 = second.feedback;
          setFeedback2({
            overall_feedback: fb2.overall_feedback || '',
            annotations: fb2.annotations || [],
            teacher_task_feedback: fb2.teacher_task_feedback || '',
            teacher_coherence_feedback: fb2.teacher_coherence_feedback || '',
            teacher_lexical_feedback: fb2.teacher_lexical_feedback || '',
            teacher_grammar_feedback: fb2.teacher_grammar_feedback || ''
          });
          setTeacherScores2({
            teacher_task_score: fb2.teacher_task_score || '',
            teacher_coherence_score: fb2.teacher_coherence_score || '',
            teacher_lexical_score: fb2.teacher_lexical_score || '',
            teacher_grammar_score: fb2.teacher_grammar_score || ''
          });
        } else {
          setFeedback2({ overall_feedback: '', annotations: [], teacher_task_feedback: '', teacher_coherence_feedback: '', teacher_lexical_feedback: '', teacher_grammar_feedback: '' });
          setTeacherScores2({ teacher_task_score: '', teacher_coherence_score: '', teacher_lexical_score: '', teacher_grammar_score: '' });
        }
      } else {
        const res = await api.get(`/teacher/writing/essays/${essayId}/`);
        setEssay(res.data.essay);
        const fb = res.data.feedback || { 
        overall_feedback: '', 
        annotations: [],
        teacher_task_feedback: '',
        teacher_coherence_feedback: '',
        teacher_lexical_feedback: '',
        teacher_grammar_feedback: ''
        };
        setFeedback(fb);
        setTeacherScores({
          teacher_task_score: fb.teacher_task_score || '',
          teacher_coherence_score: fb.teacher_coherence_score || '',
          teacher_lexical_score: fb.teacher_lexical_score || '',
          teacher_grammar_score: fb.teacher_grammar_score || ''
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [essayId]);

  const saveDraft = async () => {
    setSaving(true);
    try {
      // Очищаем пустые строки для числовых полей
      const cleanScores = {};
      Object.keys(teacherScores).forEach(key => {
        const value = teacherScores[key];
        cleanScores[key] = value === '' ? null : value;
      });
      
      if (sessionId) {
        const items = [];
        if (essay?.id) {
          items.push({ essay_id: essay.id, feedback: { ...feedback, ...cleanScores } });
        }
        if (secondEssay?.id) {
          const cleanScores2 = {
            teacher_task_score: teacherScores2.teacher_task_score === '' ? null : teacherScores2.teacher_task_score,
            teacher_coherence_score: teacherScores2.teacher_coherence_score === '' ? null : teacherScores2.teacher_coherence_score,
            teacher_lexical_score: teacherScores2.teacher_lexical_score === '' ? null : teacherScores2.teacher_lexical_score,
            teacher_grammar_score: teacherScores2.teacher_grammar_score === '' ? null : teacherScores2.teacher_grammar_score,
          };
          items.push({ essay_id: secondEssay.id, feedback: { ...feedback2, ...cleanScores2 } });
        }
        const payload = { items };
        await api.put(`/teacher/writing/sessions/${sessionId}/feedback/`, payload);
      } else {
        const payload = { ...feedback, ...cleanScores };
        await api.post(`/teacher/writing/essays/${essayId}/feedback/`, payload);
      }
      const confirmReturn = window.confirm('Feedback saved as draft! Do you want to return to the essays list?');
      if (confirmReturn) {
        navigate('/teacher/writing');
      }
    } catch (e) {
      console.error(e);
      if (e.response?.data) {
        // Показываем детальные ошибки валидации
        const errors = Object.entries(e.response.data)
          .map(([field, msgs]) => `${field}: ${msgs.join(', ')}`)
          .join('\n');
        alert(`Error saving feedback:\n${errors}`);
      } else {
        alert('Error saving feedback');
      }
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    setSaving(true);
    try {
      // Очищаем пустые строки для числовых полей
      const cleanScores = {};
      Object.keys(teacherScores).forEach(key => {
        const value = teacherScores[key];
        cleanScores[key] = value === '' ? null : value;
      });
      
      if (sessionId) {
        // Сохраняем оба таска перед публикацией
        const items = [];
        if (essay?.id) {
          items.push({ essay_id: essay.id, feedback: { ...feedback, ...cleanScores } });
        }
        if (secondEssay?.id) {
          const cleanScores2 = {
            teacher_task_score: teacherScores2.teacher_task_score === '' ? null : teacherScores2.teacher_task_score,
            teacher_coherence_score: teacherScores2.teacher_coherence_score === '' ? null : teacherScores2.teacher_coherence_score,
            teacher_lexical_score: teacherScores2.teacher_lexical_score === '' ? null : teacherScores2.teacher_lexical_score,
            teacher_grammar_score: teacherScores2.teacher_grammar_score === '' ? null : teacherScores2.teacher_grammar_score,
          };
          items.push({ essay_id: secondEssay.id, feedback: { ...feedback2, ...cleanScores2 } });
        }
        const savePayload = { items };
        await api.put(`/teacher/writing/sessions/${sessionId}/feedback/`, savePayload);
        await api.post(`/teacher/writing/sessions/${sessionId}/publish/`);
      } else {
        const payload = { ...feedback, ...cleanScores };
        await api.post(`/teacher/writing/essays/${essayId}/publish/`, payload);
      }
      await load();
      const confirmReturn = window.confirm('Feedback published successfully! Students can now see your feedback. Do you want to return to the essays list?');
      if (confirmReturn) {
        navigate('/teacher/writing');
      }
    } catch (e) {
      console.error(e);
      if (e.response?.data) {
        // Показываем детальные ошибки валидации
        const errors = Object.entries(e.response.data)
          .map(([field, msgs]) => `${field}: ${msgs.join(', ')}`)
          .join('\n');
        alert(`Error publishing feedback:\n${errors}`);
      } else {
        alert('Error publishing feedback');
      }
    } finally {
      setSaving(false);
    }
  };

  const addAnnotation = (type, extra = {}) => {
    if (!selection) return;
    const { start, end } = selection;
    if (start == null || end == null || end <= start) return;
    const a = {
      id: crypto.randomUUID(),
      type,
      start,
      end,
      color: extra.color || undefined,
      comment: extra.comment || undefined,
      suggestion: extra.suggestion || undefined,
    };
    setFeedback(prev => ({ ...prev, annotations: [...(prev.annotations || []), a] }));
    setSelection(null);
  };

  const openCommentDialog = () => {
    if (!selection) return;
    setCurrentComment('');
    setShowCommentDialog(true);
  };

  const saveComment = () => {
    if (currentComment.trim()) {
      addAnnotation('comment', { comment: currentComment.trim() });
    }
    setShowCommentDialog(false);
    setCurrentComment('');
  };

  const deleteAnnotation = (id) => {
    setFeedback(prev => ({ 
      ...prev, 
      annotations: prev.annotations.filter(a => a.id !== id) 
    }));
  };

  const activeIsFirst = activeTask === 'task1';
  const currentEssay = (sessionId ? (activeIsFirst ? essay : secondEssay) : essay);
  const currentFeedback = (sessionId ? (activeIsFirst ? feedback : feedback2) : feedback);
  const currentScores = (sessionId ? (activeIsFirst ? teacherScores : teacherScores2) : teacherScores);
  const setCurrentFeedback = (updater) => {
    if (!sessionId) return setFeedback(updater);
    if (activeIsFirst) return setFeedback(updater);
    return setFeedback2(updater);
  };
  const setCurrentScores = (updater) => {
    if (!sessionId) return setTeacherScores(updater);
    if (activeIsFirst) return setTeacherScores(updater);
    return setTeacherScores2(updater);
  };

  const text = currentEssay?.submitted_text || '';

  const spans = useMemo(() => {
    const anns = (feedback.annotations || []).slice().sort((a,b)=>a.start-b.start);
    const out = [];
    let i = 0;
    anns.forEach(a => {
      if (i < a.start) out.push({ t: text.slice(i, a.start) });
      const seg = text.slice(a.start, a.end);
      out.push({ t: seg, a });
      i = a.end;
    });
    if (i < text.length) out.push({ t: text.slice(i) });
    return out;
  }, [text, feedback.annotations]);

  const onMouseUp = (e) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return setSelection(null);
    const range = sel.getRangeAt(0);
    const container = document.getElementById('essay-text');
    if (!container || !container.contains(range.commonAncestorContainer)) return setSelection(null);
    const pre = container.textContent || '';
    const selectionText = sel.toString();
    if (!selectionText) return setSelection(null);
    const anchor = pre.indexOf(selectionText);
    if (anchor === -1) return setSelection(null);
    setSelection({ start: anchor, end: anchor + selectionText.length, selectionText });
  };

  // Calculate overall band score based on individual scores
  const calculateOverallScore = () => {
    const scores = [
      teacherScores.teacher_task_score,
      teacherScores.teacher_coherence_score,
      teacherScores.teacher_lexical_score,
      teacherScores.teacher_grammar_score
    ].filter(score => score !== '' && score !== null && score !== undefined);
    
    if (scores.length === 0) return null;
    
    const average = scores.reduce((sum, score) => sum + parseFloat(score), 0) / scores.length;
    
    // IELTS rounding: < 0.25 → down, ≥ 0.25 and < 0.75 → 0.5, ≥ 0.75 → up
    const decimal = average - Math.floor(average);
    let overallScore;
    
    if (decimal < 0.25) {
      overallScore = Math.floor(average);
    } else if (decimal < 0.75) {
      overallScore = Math.floor(average) + 0.5;
    } else {
      overallScore = Math.floor(average) + 1;
    }
    
    // Ensure score is within valid range (0-9)
    return Math.max(0, Math.min(9, overallScore));
  };

  const overallScore = calculateOverallScore();

  if (loading) return <LoadingSpinner fullScreen text="Loading..." />;
  if (!essay && !sessionId) return <div className="p-6">Not found</div>;

  return (
    <div className="p-3 sm:p-6 max-w-full lg:max-w-6xl mx-auto">
      {/* Back button */}
      <div className="mb-4">
        <button
          onClick={() => navigate('/teacher/writing')}
          className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-800 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Essays List
        </button>
      </div>

      <div className="flex flex-col gap-6">
        {sessionId && (
          <div className="bg-white rounded-lg shadow p-3 flex gap-2">
            <button
              className={`px-3 py-2 rounded border ${activeIsFirst ? 'bg-blue-600 text-white' : 'bg-white'}`}
              onClick={() => setActiveTask('task1')}
              disabled={!essay}
            >Task 1</button>
            <button
              className={`px-3 py-2 rounded border ${!activeIsFirst ? 'bg-blue-600 text-white' : 'bg-white'}`}
              onClick={() => setActiveTask('task2')}
              disabled={!secondEssay}
            >Task 2</button>
          </div>
        )}
        {/* Essay Section */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold">
              Essay — {currentEssay?.user?.first_name || 'Unknown'} {currentEssay?.user?.last_name || 'Student'} ({currentEssay?.user?.student_id || currentEssay?.student_id || 'No ID'})
            </h2>
            <div className="text-sm text-gray-500">Task: {currentEssay?.task_type?.toUpperCase()}</div>
          </div>
          
          {/* Task Question/Prompt */}
          {currentEssay?.question_text && (
            <div className="mb-4 p-3 bg-gray-50 rounded border-l-4 border-blue-500">
              <div className="text-sm font-semibold text-gray-700 mb-2">Task Question:</div>
              <div className="text-sm text-gray-800 whitespace-pre-wrap">{currentEssay.question_text}</div>
              {currentEssay.prompt?.image && (
                <div className="mt-3">
                  <img src={currentEssay.prompt.image} alt="Task" className="max-w-full h-auto rounded border" />
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2 mb-3 flex-wrap items-center p-2 bg-gray-50 rounded">
            <span className="text-sm font-medium text-gray-700">Tools:</span>
            
            {/* Highlight colors */}
            <div className="flex items-center gap-1 border-r pr-2">
              <span className="text-xs text-gray-600">Highlight:</span>
              {colors.map(c => (
                <button 
                  key={c} 
                  className="w-7 h-7 rounded border-2 border-white shadow-sm hover:scale-110 transition" 
                  style={{ backgroundColor: c }} 
                  onClick={() => addAnnotation('highlight', { color: c })}
                  disabled={!selection}
                  title="Highlight text"
                />
              ))}
            </div>
            
            {/* Text formatting */}
            <div className="flex gap-2 border-r pr-2">
              <button 
                className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50" 
                onClick={() => addAnnotation('strike')}
                disabled={!selection}
                title="Strikethrough"
              >
                <s>S</s>
              </button>
            </div>
            
            {/* Comments & suggestions */}
            <div className="flex gap-2 border-r pr-2">
              <button 
                className="px-3 py-1 border rounded hover:bg-blue-50 disabled:opacity-50" 
                onClick={openCommentDialog}
                disabled={!selection}
                title="Add comment"
              >
                💬 Comment
              </button>
              <button 
                className="px-3 py-1 border rounded hover:bg-green-50 disabled:opacity-50" 
                onClick={() => {
                  const suggestion = prompt('Suggested replacement:');
                  if (suggestion) addAnnotation('suggestion', { suggestion });
                }}
                disabled={!selection}
                title="Suggest replacement"
              >
                ✏️ Suggest
              </button>
            </div>
            
            {/* Selection info */}
            {selection && (
              <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                Selected: "{selection.selectionText?.slice(0, 30)}{selection.selectionText?.length > 30 ? '...' : ''}"
              </div>
            )}
            

          </div>
          <div className="mb-3">
            <div className="text-sm font-semibold text-gray-700">Student's Essay:</div>
          </div>
          <div id="essay-text" className="whitespace-pre-wrap leading-7 text-gray-800 min-h-[400px] border-t pt-3 relative" onMouseUp={onMouseUp}>
            {spans.map((s, idx) => {
              if (!s.a) return <span key={idx}>{s.t}</span>;
              
              const baseStyle = {};
              const classes = ['cursor-pointer', 'relative'];
              
              // Apply styling based on annotation type
              if (s.a.type === 'highlight') {
                baseStyle.backgroundColor = s.a.color || '#fde047';
                classes.push('px-1', 'rounded');
              }
              if (s.a.type === 'strike') {
                baseStyle.textDecoration = 'line-through';
                baseStyle.color = '#ef4444';
              }
              if (s.a.type === 'comment') {
                baseStyle.borderBottom = '2px solid #3b82f6';
                baseStyle.backgroundColor = '#dbeafe';
              }
              if (s.a.type === 'suggestion') {
                baseStyle.borderBottom = '2px solid #10b981';
                baseStyle.backgroundColor = '#d1fae5';
              }
              
              return (
                <span 
                  key={idx} 
                  className={classes.join(' ')}
                  style={baseStyle}
                  onMouseEnter={(e) => {
                    setHoveredAnnotation({...s.a, x: e.clientX, y: e.clientY});
                  }}
                  onMouseLeave={() => setHoveredAnnotation(null)}
                >
                  {s.t}
                  {s.a.type === 'comment' && <span className="text-blue-600 ml-1">💬</span>}
                  {s.a.type === 'suggestion' && <span className="text-green-600 ml-1">✏️</span>}
                </span>
              );
            })}
            
            {/* Hover tooltip */}
            {hoveredAnnotation && (hoveredAnnotation.comment || hoveredAnnotation.suggestion) && (
              <div 
                className="fixed bg-black text-white p-3 rounded-lg text-sm max-w-xs z-50 pointer-events-none shadow-lg"
                style={{ 
                  top: (hoveredAnnotation.y || 0) - 60, 
                  left: (hoveredAnnotation.x || 0) - 100,
                  transform: 'translateX(-50%)'
                }}
              >
                <div className="font-medium mb-1">
                  {hoveredAnnotation.type === 'comment' ? '💬 Comment' : '✏️ Suggestion'}
                </div>
                <div>{hoveredAnnotation.comment || hoveredAnnotation.suggestion}</div>
                {/* Arrow */}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black"></div>
              </div>
            )}
          </div>
        </div>

        {/* IELTS Assessment Section */}
        <div className="bg-white rounded-lg shadow p-4">
          
          
          {/* Overall Feedback */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Overall Feedback:</label>
            <textarea 
              value={feedback.overall_feedback}
              onChange={e => setFeedback(prev => ({ ...prev, overall_feedback: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg p-3 h-32 resize-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400" 
              placeholder="Write overall feedback here..."
            />
          </div>
          
          {/* IELTS Scores and Feedback */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Task Response */}
            <div className="bg-gradient-to-br from-purple-50 to-white rounded-lg border border-purple-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-gray-700">
                  {currentEssay?.task_type === 'task1' ? 'Task Achievement' : 'Task Response'}
                </label>
                <input
                  type="number"
                  min="0"
                  max="9"
                  step="0.5"
                  value={currentScores.teacher_task_score}
                  onChange={e => setCurrentScores(prev => ({ ...prev, teacher_task_score: e.target.value }))}
                  className="w-20 border border-purple-300 rounded-lg px-3 py-2 text-sm text-center font-medium focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
                  placeholder="0-9"
                />
              </div>
              <textarea
                value={currentFeedback.teacher_task_feedback}
                onChange={e => setCurrentFeedback(prev => ({ ...prev, teacher_task_feedback: e.target.value }))}
                className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
                placeholder="Feedback for Task Response/Achievement..."
                rows="4"
              />
            </div>

            {/* Coherence & Cohesion */}
            <div className="bg-gradient-to-br from-purple-50 to-white rounded-lg border border-purple-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-gray-700">Coherence & Cohesion</label>
                <input
                  type="number"
                  min="0"
                  max="9"
                  step="0.5"
                  value={currentScores.teacher_coherence_score}
                  onChange={e => setCurrentScores(prev => ({ ...prev, teacher_coherence_score: e.target.value }))}
                  className="w-20 border border-purple-300 rounded-lg px-3 py-2 text-sm text-center font-medium focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
                  placeholder="0-9"
                />
              </div>
              <textarea
                value={currentFeedback.teacher_coherence_feedback}
                onChange={e => setCurrentFeedback(prev => ({ ...prev, teacher_coherence_feedback: e.target.value }))}
                className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
                placeholder="Feedback for Coherence & Cohesion..."
                rows="4"
              />
            </div>

            {/* Lexical Resource */}
            <div className="bg-gradient-to-br from-purple-50 to-white rounded-lg border border-purple-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-gray-700">Lexical Resource</label>
                <input
                  type="number"
                  min="0"
                  max="9"
                  step="0.5"
                  value={currentScores.teacher_lexical_score}
                  onChange={e => setCurrentScores(prev => ({ ...prev, teacher_lexical_score: e.target.value }))}
                  className="w-20 border border-purple-300 rounded-lg px-3 py-2 text-sm text-center font-medium focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
                  placeholder="0-9"
                />
              </div>
              <textarea
                value={currentFeedback.teacher_lexical_feedback}
                onChange={e => setCurrentFeedback(prev => ({ ...prev, teacher_lexical_feedback: e.target.value }))}
                className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
                placeholder="Feedback for Lexical Resource..."
                rows="4"
              />
            </div>

            {/* Grammar & Accuracy */}
            <div className="bg-gradient-to-br from-purple-50 to-white rounded-lg border border-purple-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-gray-700">Grammar & Accuracy</label>
                <input
                  type="number"
                  min="0"
                  max="9"
                  step="0.5"
                  value={currentScores.teacher_grammar_score}
                  onChange={e => setCurrentScores(prev => ({ ...prev, teacher_grammar_score: e.target.value }))}
                  className="w-20 border border-purple-300 rounded-lg px-3 py-2 text-sm text-center font-medium focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
                  placeholder="0-9"
                />
              </div>
              <textarea
                value={currentFeedback.teacher_grammar_feedback}
                onChange={e => setCurrentFeedback(prev => ({ ...prev, teacher_grammar_feedback: e.target.value }))}
                className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
                placeholder="Feedback for Grammar & Accuracy..."
                rows="4"
              />
            </div>
          </div>
          
          {/* Overall Band Score */}
          <div className="mt-6 flex items-center justify-between pt-4 border-t border-purple-200 bg-purple-50 p-4 rounded-lg">
            <label className="text-sm font-semibold text-gray-700">Overall Band Score:</label>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-700">
                {overallScore !== null ? overallScore.toFixed(1) : '—'}
              </div>
              
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="mt-6 flex gap-3 justify-end">
            <button 
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" 
              onClick={saveDraft} 
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button 
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" 
              onClick={publish} 
              disabled={saving}
            >
              {saving ? 'Publishing...' : 'Publish'}
            </button>
          </div>
          
          {currentFeedback.annotations?.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-semibold mb-2 flex items-center justify-between">
                <span>Annotations ({currentFeedback.annotations.length})</span>
                <button 
                  className="text-xs text-red-600 hover:text-red-800"
                  onClick={() => setCurrentFeedback(prev => ({ ...prev, annotations: [] }))}
                >
                  Clear all
                </button>
              </div>
              <div className="max-h-48 overflow-auto space-y-2">
                {currentFeedback.annotations.map(a => {
                  const typeIcons = {
                    highlight: '🎨',
                    strike: '🚫',
                    comment: '💬',
                    suggestion: '✏️'
                  };
                  
                  return (
                    <div key={a.id} className="p-2 border rounded text-xs bg-gray-50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-700">
                          {typeIcons[a.type]} {a.type}
                        </span>
                        <button 
                          className="text-red-600 hover:text-red-800"
                          onClick={() => deleteAnnotation(a.id)}
                        >
                          ✕
                        </button>
                      </div>
                      <div className="text-gray-600 mb-1">
                        "{text.slice(a.start, a.end)}"
                      </div>
                      {(a.comment || a.suggestion) && (
                        <div className="text-blue-600 italic">
                          {a.comment || a.suggestion}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Comment Dialog */}
      {showCommentDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-3">Add Comment</h3>
            <div className="mb-3">
              <div className="text-sm text-gray-600 mb-2">Selected text:</div>
              <div className="p-2 bg-gray-100 rounded text-sm">
                "{selection?.selectionText}"
              </div>
            </div>
            <textarea
              value={currentComment}
              onChange={(e) => setCurrentComment(e.target.value)}
              placeholder="Write your comment here..."
              className="w-full border rounded p-2 h-24 resize-none"
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={saveComment}
              >
                Add Comment
              </button>
              <button
                className="px-4 py-2 border rounded hover:bg-gray-100"
                onClick={() => {
                  setShowCommentDialog(false);
                  setCurrentComment('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherWritingEditorPage;





