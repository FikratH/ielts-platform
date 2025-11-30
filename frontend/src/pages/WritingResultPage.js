import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
// removed unused TestResultLayout import
import LoadingSpinner from '../components/LoadingSpinner';

// IELTS-style band score rounding
const roundToIELTSBand = (score) => {
  if (score === null || score === undefined) return null;
  
  // Round to nearest 0.25, then convert to IELTS scale
  const rounded = Math.round(score * 4) / 4;
  
  // IELTS rounding rules:
  // .25 rounds to .5
  // .75 rounds to next whole number
  // .5 stays .5
  const decimal = rounded % 1;
  const whole = Math.floor(rounded);
  
  if (decimal === 0.25) {
    return whole + 0.5;
  } else if (decimal === 0.75) {
    return whole + 1;
  } else {
    return rounded;
  }
};

const WritingResultPage = () => {
  const { sessionId, essayId } = useParams();
  const [essays, setEssays] = useState([]);
  const [overallBand, setOverallBand] = useState(null);
  const [session, setSession] = useState(null);
  const [explanationUrl, setExplanationUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
  const fetchResults = async () => {
    try {
      setLoading(true);
      
      if (essayId) {
        // Загружаем конкретное эссе
        const res = await api.get(`/essays/${essayId}/`);
        setEssays([res.data]);
        setOverallBand(roundToIELTSBand(res.data.overall_band));
      } else if (sessionId) {
        // Get session with test info first
        const sessionRes = await api.get(`/writing-test-sessions/${sessionId}/`);
        const session = sessionRes.data;
        if (session && session.test && session.test.explanation_url) {
          setExplanationUrl(session.test.explanation_url);
        }
        
        // Then get essays for this session
        const essaysRes = await api.get(`/essays/?session_id=${sessionId}`);
        const essaysData = essaysRes.data.essays || essaysRes.data;
        
        setEssays(essaysData);
        setOverallBand(roundToIELTSBand(essaysRes.data.overall_band));
        
        // Store session for test title
        setSession(session);
      }
    } catch (err) {
      console.error(err);
      setError("Error loading results");
    } finally {
      setLoading(false);
    }
  };

    fetchResults();
  }, [sessionId, essayId]);

  if (loading) return <LoadingSpinner fullScreen text="Loading..." />;
  if (error) return <div className="p-6 text-center text-red-600 bg-red-50 rounded-lg">{error}</div>;
  if (essays.length === 0) return <div className="p-6 text-center">No data to display.</div>;


  const sessionData = {
    test_title: session && session.test && session.test.title 
      ? session.test.title 
      : (essayId && essays.length === 1 
          ? `IELTS Writing Task ${essays[0].task_type.toUpperCase()}`
          : "IELTS Writing Test"),
    raw_score: essays.length,
    total_questions: essayId ? 1 : 2,
    band_score: overallBand !== null ? overallBand : 'N/A',
    question_feedback: essays.map((essay, index) => ({
      question_id: essay.id,
      question_text: `Task ${essay.task_type.toUpperCase()}: ${essay.question_text.substring(0, 100)}...`,
      user_answer: essay.submitted_text.substring(0, 200) + "...",
      correct_answer: `Band Score: ${roundToIELTSBand(essay.overall_band)}`,
      is_correct: true, 
      detailed_feedback: essay.feedback,
      scores: {
        task_response: essay.score_task,
        coherence: essay.score_coherence,
        lexical: essay.score_lexical,
        grammar: essay.score_grammar
      },
      teacher_feedback: essay.teacher_feedback
    }))
  };

  return (
    <div className="p-3 sm:p-6 max-w-full md:max-w-4xl mx-auto bg-gray-50 min-h-screen">
      <div className="bg-white p-4 sm:p-8 rounded-lg shadow-md">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-3xl font-bold mb-1 sm:mb-2 text-gray-800">IELTS Writing Results</h2>
            <p className="text-base sm:text-lg text-gray-600">Test: <span className="font-semibold">{sessionData.test_title}</span></p>
          </div>
          {explanationUrl && (
            <a
              href={explanationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex px-4 py-2 bg-white text-purple-700 border border-purple-200 hover:border-purple-300 hover:bg-purple-50 font-semibold rounded-xl shadow-sm transition-all duration-300 text-sm"
            >
              Test explanation
            </a>
          )}
        </div>

        <div className="mt-4 sm:mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-center">
          <div className="p-3 sm:p-4 bg-blue-100 rounded-lg">
            <p className="text-xs sm:text-sm text-blue-800">Tasks completed</p>
            <p className="text-lg sm:text-2xl font-bold text-blue-900">{sessionData.raw_score} / {sessionData.total_questions}</p>
          </div>
          <div className="p-3 sm:p-4 bg-purple-100 rounded-lg">
            <p className="text-xs sm:text-sm text-purple-800">Average Band Score</p>
            <p className="text-lg sm:text-2xl font-bold text-purple-900">{sessionData.band_score}</p>
          </div>
        </div>

        <h3 className="mt-6 sm:mt-8 text-lg sm:text-2xl font-bold border-b pb-2 mb-3 sm:mb-4 text-gray-700">Detailed breakdown</h3>
        <div className="space-y-4 sm:space-y-6">
          {essays.map((essay, index) => (
            <div key={essay.id} className="border p-3 sm:p-6 rounded-lg bg-gray-50">
              <h4 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-4 text-gray-800">
                Task {essay.task_type.toUpperCase()}
              </h4>
              
              <div className="mb-2 sm:mb-4">
                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Task:</p>
                <p className="text-xs sm:text-sm text-gray-600 italic">{essay.question_text}</p>
              </div>

              <div className="mb-2 sm:mb-4">
                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Your answer:</p>
                <div className="bg-white p-2 sm:p-3 rounded border text-xs sm:text-sm text-gray-800 whitespace-pre-line max-h-32 sm:max-h-40 overflow-y-auto">
                  {essay.submitted_text}
                </div>
              </div>

              {/* AI Scores */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div className="text-center p-2 bg-green-50 rounded border border-green-200">
                  <p className="text-xs text-green-700 font-medium mb-1">Task Response</p>
                  <p className="text-sm font-bold text-green-800">{essay.score_task || 'Not scored'}</p>
                </div>
                <div className="text-center p-2 bg-blue-50 rounded border border-blue-200">
                  <p className="text-xs text-blue-700 font-medium mb-1">Coherence</p>
                  <p className="text-sm font-bold text-blue-800">{essay.score_coherence || 'Not scored'}</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded border border-purple-200">
                  <p className="text-xs text-purple-700 font-medium mb-1">Lexical</p>
                  <p className="text-sm font-bold text-purple-800">{essay.score_lexical || 'Not scored'}</p>
                </div>
                <div className="text-center p-2 bg-orange-50 rounded border border-orange-200">
                  <p className="text-xs text-orange-700 font-medium mb-1">Grammar</p>
                  <p className="text-sm font-bold text-orange-800">{essay.score_grammar}</p>
                </div>
              </div>

              {/* AI Overall Score */}
              <div className="text-center p-3 bg-indigo-50 rounded border border-indigo-200">
                <p className="text-sm text-indigo-700 font-medium mb-1">AI Overall Band Score</p>
                <p className="text-lg font-bold text-indigo-800">{roundToIELTSBand(essay.overall_band)}</p>
              </div>

              <div className="mt-2 sm:mt-4">
                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Feedback:</p>
                <div className="bg-white p-2 sm:p-3 rounded border text-xs sm:text-sm text-gray-800 whitespace-pre-wrap">
                  {essay.feedback}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            className="w-full bg-blue-600 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg hover:bg-blue-700 transition-colors duration-300 text-sm sm:text-base"
            onClick={() => navigate('/writing')}
          >
            To Writing tests list
          </button>
          {explanationUrl && (
            <a
              href={explanationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-white text-purple-700 border border-purple-200 hover:border-purple-300 hover:bg-purple-50 px-3 sm:px-4 py-2 sm:py-3 rounded-lg transition-colors duration-300 text-sm sm:text-base text-center"
            >
              Test explanation
            </a>
          )}
          {essays.some(e => e.teacher_feedback_published && e.id) && (
            <button
              className="w-full bg-indigo-600 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg hover:bg-indigo-700 transition-colors duration-300 text-sm sm:text-base"
              onClick={() => {
                // Предпочитаем сессионный просмотр объединенного фидбэка, если есть sessionId
                if (sessionId) {
                  navigate(`/writing/teacher-feedback/session/${sessionId}`);
                  return;
                }
                // Иначе — старый роут по эссе
                const targetEssay = essayId
                  ? essays.find(e => e.id.toString() === essayId && e.teacher_feedback_published)
                  : essays.find(e => e.teacher_feedback_published && e.id);
                if (targetEssay) navigate(`/writing/feedback/${targetEssay.id}`);
              }}
            >
              Teacher's feedback
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WritingResultPage;
