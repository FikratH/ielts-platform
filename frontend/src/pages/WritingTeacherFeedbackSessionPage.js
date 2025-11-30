import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

function FeedbackPanel({ title, essay, feedback, hoveredAnnotation, setHoveredAnnotation }) {
  const text = essay?.submitted_text || '';
  const anns = (feedback?.annotations || []).slice().sort((a,b)=>a.start-b.start);
  const spans = (() => {
    const out = []; let i = 0;
    anns.forEach(a => { if (i < a.start) out.push({ t: text.slice(i,a.start) }); out.push({ t: text.slice(a.start,a.end), a }); i = a.end; });
    if (i < text.length) out.push({ t: text.slice(i) });
    return out;
  })();

  return (
    <div className="flex flex-col gap-6">
      {/* Header card */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div className="text-xl font-bold text-gray-800">{title}</div>
          <div className={`text-xs px-2 py-1 rounded border ${feedback ? (feedback.published ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700') : 'bg-gray-50 text-gray-600'}`}>
            {feedback ? (feedback.published ? 'Published' : 'Draft') : 'No feedback'}
          </div>
        </div>
        {essay?.question_text && (
          <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-l-4 border-blue-500">
            <div className="text-sm font-semibold text-gray-700 mb-1">Task Question</div>
            <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{essay.question_text}</div>
          </div>
        )}
      </div>

      {/* Main two-column layout (mirrors old page) */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-3/5 bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-bold mb-3 text-gray-800">Student Text</h2>
          <div className="whitespace-pre-wrap break-words leading-7 text-gray-800 relative max-h-[60vh] overflow-auto">
            {spans.map((s, idx) => s.a ? (
              <span
                key={idx}
                className={`cursor-pointer relative ${s.a.type==='highlight'?'px-1 rounded':''}`}
                style={{
                  backgroundColor: s.a.type==='highlight' ? (s.a.color || '#fde047') : (s.a.type==='comment' ? '#dbeafe' : (s.a.type==='suggestion' ? '#d1fae5' : undefined)),
                  borderBottom: s.a.type==='comment' ? '2px solid #3b82f6' : (s.a.type==='suggestion' ? '2px solid #10b981' : undefined),
                  textDecoration: s.a.type==='strike' ? 'line-through' : undefined,
                  color: s.a.type==='strike' ? '#ef4444' : undefined
                }}
                onMouseEnter={(e) => setHoveredAnnotation({ ...s.a, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHoveredAnnotation(null)}
              >
                {s.t}
                {s.a.type === 'comment' && <span className="text-blue-600 ml-1">💬</span>}
                {s.a.type === 'suggestion' && <span className="text-green-600 ml-1">✏️</span>}
              </span>
            ) : (
              <span key={idx}>{s.t}</span>
            ))}
          </div>
        </div>

        <div className="lg:w-2/5 bg-white rounded-lg shadow p-6 h-max">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Teacher's IELTS Writing Assessment</h3>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Overall Feedback:</label>
            <div className="border border-gray-300 rounded-lg p-4 whitespace-pre-wrap break-words min-h-[120px] max-h-[40vh] overflow-auto text-gray-800 leading-relaxed bg-gray-50">
              {feedback?.overall_feedback || 'No feedback provided yet.'}
            </div>
          </div>

          {(feedback?.teacher_task_score || feedback?.teacher_coherence_score || feedback?.teacher_lexical_score || feedback?.teacher_grammar_score || feedback?.teacher_overall_score) && (
            <div className="mb-6 p-4 border rounded-lg bg-gradient-to-br from-purple-50 to-white shadow-sm">
              <h4 className="text-sm font-semibold mb-4 text-purple-700 flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                IELTS Band Scores
              </h4>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {feedback.teacher_task_score && (
                  <div className="text-center p-3 bg-white rounded-lg border border-purple-100 shadow-sm">
                    <p className="text-xs text-purple-600 font-medium">{essay?.task_type === 'task1' ? 'Task Achievement' : 'Task Response'}</p>
                    <p className="text-lg font-bold text-purple-700">{feedback.teacher_task_score}</p>
                  </div>
                )}
                {feedback.teacher_coherence_score && (
                  <div className="text-center p-3 bg-white rounded-lg border border-purple-100 shadow-sm">
                    <p className="text-xs text-purple-600 font-medium">Coherence</p>
                    <p className="text-lg font-bold text-purple-700">{feedback.teacher_coherence_score}</p>
                  </div>
                )}
                {feedback.teacher_lexical_score && (
                  <div className="text-center p-3 bg-white rounded-lg border border-purple-100 shadow-sm">
                    <p className="text-xs text-purple-600 font-medium">Lexical</p>
                    <p className="text-lg font-bold text-purple-700">{feedback.teacher_lexical_score}</p>
                  </div>
                )}
                {feedback.teacher_grammar_score && (
                  <div className="text-center p-3 bg-white rounded-lg border border-purple-100 shadow-sm">
                    <p className="text-xs text-purple-600 font-medium">Grammar</p>
                    <p className="text-lg font-bold text-purple-700">{feedback.teacher_grammar_score}</p>
                  </div>
                )}
              </div>
              {feedback.teacher_overall_score && (
                <div className="text-center p-3 bg-purple-100 rounded-lg border border-purple-200">
                  <p className="text-xs text-purple-700 font-medium">Overall Band Score</p>
                  <p className="text-xl font-bold text-purple-800">{feedback.teacher_overall_score}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {(feedback?.teacher_task_feedback || feedback?.teacher_coherence_feedback || feedback?.teacher_lexical_feedback || feedback?.teacher_grammar_feedback) && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {feedback.teacher_task_feedback && (
              <div className="bg-gradient-to-br from-green-50 to-white p-5 rounded-lg border border-green-200 shadow-sm">
                <h6 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2"><span className="w-3 h-3 bg-green-500 rounded-full"></span>Task Response</h6>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">{feedback.teacher_task_feedback}</div>
              </div>
            )}
            {feedback.teacher_coherence_feedback && (
              <div className="bg-gradient-to-br from-blue-50 to-white p-5 rounded-lg border border-blue-200 shadow-sm">
                <h6 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-2"><span className="w-3 h-3 bg-blue-500 rounded-full"></span>Coherence & Cohesion</h6>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">{feedback.teacher_coherence_feedback}</div>
              </div>
            )}
            {feedback.teacher_lexical_feedback && (
              <div className="bg-gradient-to-br from-purple-50 to-white p-5 rounded-lg border border-purple-200 shadow-sm">
                <h6 className="text-sm font-semibold text-purple-700 mb-3 flex items-center gap-2"><span className="w-3 h-3 bg-purple-500 rounded-full"></span>Lexical Resource</h6>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">{feedback.teacher_lexical_feedback}</div>
              </div>
            )}
            {feedback.teacher_grammar_feedback && (
              <div className="bg-gradient-to-br from-orange-50 to-white p-5 rounded-lg border border-orange-200 shadow-sm">
                <h6 className="text-sm font-semibold text-orange-700 mb-3 flex items-center gap-2"><span className="w-3 h-3 bg-orange-500 rounded-full"></span>Grammar & Accuracy</h6>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">{feedback.teacher_grammar_feedback}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function WritingTeacherFeedbackSessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoveredAnnotation, setHoveredAnnotation] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/writing/sessions/${sessionId}/teacher-feedback/`);
        setData(res.data);
      } catch (e) {
        setError('Feedback not available');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId]);

  const items = data?.items || [];

  const buildSpans = (text, annotations) => {
    const anns = (annotations || []).slice().sort((a,b)=>a.start-b.start);
    const out = []; let i = 0;
    anns.forEach(a => { if (i < a.start) out.push({ t: text.slice(i,a.start) }); out.push({ t: text.slice(a.start,a.end), a }); i = a.end; });
    if (i < text.length) out.push({ t: text.slice(i) });
    return out;
  };

  if (loading) return <LoadingSpinner fullScreen text="Loading..." />;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!data) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Teacher Feedback (Session #{data.session?.id})</h1>
        <button className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 text-sm" onClick={() => navigate(-1)}>Back</button>
      </div>

      <div className="space-y-6">
        {items.map((it) => (
          <FeedbackPanel
            key={it.essay.id}
            title={`Task ${it.essay.task_type?.toUpperCase()}`}
            essay={it.essay}
            feedback={it.feedback}
            hoveredAnnotation={hoveredAnnotation}
            setHoveredAnnotation={setHoveredAnnotation}
          />
        ))}
      </div>
    </div>
  );
}


