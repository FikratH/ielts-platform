import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

const WritingTeacherFeedbackPage = () => {
  const { essayId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoveredAnnotation, setHoveredAnnotation] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/writing/essays/${essayId}/teacher-feedback/`);
        setData(res.data);
      } catch (e) {
        console.error(e);
        setError('Feedback not available');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [essayId]);

  const text = data?.essay?.submitted_text || '';
  const anns = (data?.feedback?.annotations || []).slice().sort((a,b)=>a.start-b.start);
  const spans = useMemo(() => {
    const out = []; let i = 0;
    anns.forEach(a => { if (i < a.start) out.push({ t: text.slice(i,a.start) }); out.push({ t: text.slice(a.start,a.end), a }); i = a.end; });
    if (i < text.length) out.push({ t: text.slice(i) });
    return out;
  }, [text, anns]);

  if (loading) return <LoadingSpinner fullScreen text="Loading..." />;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!data) return null;

  return (
    <div className="p-3 sm:p-6 max-w-full lg:max-w-6xl mx-auto">
      <div className="mb-4">
        <button 
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-800 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>
      </div>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-4">
          <h1 className="text-2xl font-bold mb-2 text-gray-800">IELTS Writing Feedback</h1>
          <p className="text-gray-600">Task: {data.essay?.task_type?.toUpperCase() || 'Unknown'}</p>
        </div>
        
        {/* Task Question/Prompt */}
        {data.essay?.question_text && (
          <div className="bg-white rounded-lg shadow p-4">
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-l-4 border-blue-500">
              <div className="text-sm font-semibold text-gray-700 mb-3">Task Question:</div>
              <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{data.essay.question_text}</div>
              {data.essay?.prompt?.image && (
                <div className="mt-4">
                  <img src={data.essay.prompt.image} alt="Task" className="max-w-full h-auto rounded-lg border shadow-sm" />
                </div>
              )}
            </div>
          </div>
        )}
        
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-3/5 bg-white rounded-lg shadow p-4">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Your Essay</h2>
            <div className="whitespace-pre-wrap leading-7 text-gray-800 relative">
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
                      if (s.a.comment || s.a.suggestion) {
                        setHoveredAnnotation({...s.a, x: e.clientX, y: e.clientY});
                      }
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
                    {hoveredAnnotation.type === 'comment' ? '💬 Teacher Comment' : '✏️ Teacher Suggestion'}
                  </div>
                  <div>{hoveredAnnotation.comment || hoveredAnnotation.suggestion}</div>
                  {/* Arrow */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black"></div>
                </div>
              )}
            </div>
          </div>
          <div className="lg:w-2/5 bg-white rounded-lg shadow p-6 h-max">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Teacher's IELTS Writing Assessment</h3>
            
            {/* Overall Feedback */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Overall Feedback:</label>
              <div className="border border-gray-300 rounded-lg p-4 whitespace-pre-wrap min-h-[120px] text-gray-800 leading-relaxed bg-gray-50">
                {data.feedback?.overall_feedback || 'No feedback provided yet.'}
              </div>
            </div>
            
            {/* Teacher's IELTS Scores */}
            {(data.feedback?.teacher_task_score || data.feedback?.teacher_coherence_score || 
              data.feedback?.teacher_lexical_score || data.feedback?.teacher_grammar_score || 
              data.feedback?.teacher_overall_score) && (
              <div className="mb-6 p-4 border rounded-lg bg-gradient-to-br from-purple-50 to-white shadow-sm">
                <h4 className="text-sm font-semibold mb-4 text-purple-700 flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  IELTS Band Scores
                </h4>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {data.feedback.teacher_task_score && (
                    <div className="text-center p-3 bg-white rounded-lg border border-purple-100 shadow-sm">
                      <p className="text-xs text-purple-600 font-medium">
                        {data.essay?.task_type === 'task1' ? 'Task Achievement' : 'Task Response'}
                      </p>
                      <p className="text-lg font-bold text-purple-700">{data.feedback.teacher_task_score}</p>
                    </div>
                  )}
                  {data.feedback.teacher_coherence_score && (
                    <div className="text-center p-3 bg-white rounded-lg border border-purple-100 shadow-sm">
                      <p className="text-xs text-purple-600 font-medium">Coherence</p>
                      <p className="text-lg font-bold text-purple-700">{data.feedback.teacher_coherence_score}</p>
                    </div>
                  )}
                  {data.feedback.teacher_lexical_score && (
                    <div className="text-center p-3 bg-white rounded-lg border border-purple-100 shadow-sm">
                      <p className="text-xs text-purple-600 font-medium">Lexical</p>
                      <p className="text-lg font-bold text-purple-700">{data.feedback.teacher_lexical_score}</p>
                    </div>
                  )}
                  {data.feedback.teacher_grammar_score && (
                    <div className="text-center p-3 bg-white rounded-lg border border-purple-100 shadow-sm">
                      <p className="text-xs text-purple-600 font-medium">Grammar</p>
                      <p className="text-lg font-bold text-purple-700">{data.feedback.teacher_grammar_score}</p>
                    </div>
                  )}
                </div>
                {data.feedback.teacher_overall_score && (
                  <div className="text-center p-3 bg-purple-100 rounded-lg border border-purple-200">
                    <p className="text-xs text-purple-700 font-medium">Overall Band Score</p>
                    <p className="text-xl font-bold text-purple-800">{data.feedback.teacher_overall_score}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Detailed Feedback for Each Criterion - теперь под эссе */}
        {(data.feedback?.teacher_task_feedback || data.feedback?.teacher_coherence_feedback || 
          data.feedback?.teacher_lexical_feedback || data.feedback?.teacher_grammar_feedback) && (
          <div className="bg-white rounded-lg shadow p-6">
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {data.feedback.teacher_task_feedback && (
                <div className="bg-gradient-to-br from-green-50 to-white p-5 rounded-lg border border-green-200 shadow-sm">
                  <h6 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2">
                    <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                    Task Response
                  </h6>
                  <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                    {data.feedback.teacher_task_feedback}
                  </div>
                </div>
              )}
              
              {data.feedback.teacher_coherence_feedback && (
                <div className="bg-gradient-to-br from-blue-50 to-white p-5 rounded-lg border border-blue-200 shadow-sm">
                  <h6 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-2">
                    <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                    Coherence & Cohesion
                  </h6>
                  <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                    {data.feedback.teacher_coherence_feedback}
                  </div>
                </div>
              )}
              
              {data.feedback.teacher_lexical_feedback && (
                <div className="bg-gradient-to-br from-purple-50 to-white p-5 rounded-lg border border-purple-200 shadow-sm">
                  <h6 className="text-sm font-semibold text-purple-700 mb-3 flex items-center gap-2">
                    <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
                    Lexical Resource
                  </h6>
                  <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                    {data.feedback.teacher_lexical_feedback}
                  </div>
                </div>
              )}
              
              {data.feedback.teacher_grammar_feedback && (
                <div className="bg-gradient-to-br from-orange-50 to-white p-5 rounded-lg border border-orange-200 shadow-sm">
                  <h6 className="text-sm font-semibold text-orange-700 mb-3 flex items-center gap-2">
                    <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
                    Grammar & Accuracy
                  </h6>
                  <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                    {data.feedback.teacher_grammar_feedback}
                  </div>
                </div>
              )}
              
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WritingTeacherFeedbackPage;



