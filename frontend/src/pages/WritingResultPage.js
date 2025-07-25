import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import TestResultLayout from '../components/TestResultLayout';

const WritingResultPage = () => {
  const { sessionId } = useParams();
  const [essays, setEssays] = useState([]);
  const [overallBand, setOverallBand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/essays/?session_id=${sessionId}`);
        setEssays(res.data.essays || res.data);
        setOverallBand(res.data.overall_band);
      } catch (err) {
        console.error(err);
        setError("Error loading results");
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [sessionId]);

  if (loading) return <div className="p-6 text-center">Loading results...</div>;
  if (error) return <div className="p-6 text-center text-red-600 bg-red-50 rounded-lg">{error}</div>;
  if (essays.length === 0) return <div className="p-6 text-center">No data to display.</div>;


  const sessionData = {
    test_title: "IELTS Writing Test",
    raw_score: essays.length,
    total_questions: 2,
    band_score: overallBand !== null ? overallBand.toFixed(1) : 'N/A',
    question_feedback: essays.map((essay, index) => ({
      question_id: essay.id,
      question_text: `Task ${essay.task_type.toUpperCase()}: ${essay.question_text.substring(0, 100)}...`,
      user_answer: essay.submitted_text.substring(0, 200) + "...",
      correct_answer: `Band Score: ${essay.overall_band}`,
      is_correct: true, 
      detailed_feedback: essay.feedback,
      scores: {
        task_response: essay.score_task,
        coherence: essay.score_coherence,
        lexical: essay.score_lexical,
        grammar: essay.score_grammar
      }
    }))
  };

  return (
    <div className="p-3 sm:p-6 max-w-full md:max-w-4xl mx-auto bg-gray-50 min-h-screen">
      <div className="bg-white p-4 sm:p-8 rounded-lg shadow-md">
        <h2 className="text-xl sm:text-3xl font-bold mb-2 sm:mb-4 text-gray-800">IELTS Writing Results</h2>
        <p className="text-base sm:text-lg text-gray-600">Test: <span className="font-semibold">{sessionData.test_title}</span></p>

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

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-2 sm:mb-4">
                <div className="text-center p-2 bg-green-100 rounded">
                  <p className="text-xs sm:text-sm text-green-800">Task Response</p>
                  <p className="font-bold text-green-900">{essay.score_task}</p>
                </div>
                <div className="text-center p-2 bg-blue-100 rounded">
                  <p className="text-xs sm:text-sm text-blue-800">Coherence</p>
                  <p className="font-bold text-blue-900">{essay.score_coherence}</p>
                </div>
                <div className="text-center p-2 bg-purple-100 rounded">
                  <p className="text-xs sm:text-sm text-purple-800">Lexical</p>
                  <p className="font-bold text-purple-900">{essay.score_lexical}</p>
                </div>
                <div className="text-center p-2 bg-orange-100 rounded">
                  <p className="text-xs sm:text-sm text-orange-800">Grammar</p>
                  <p className="font-bold text-orange-900">{essay.score_grammar}</p>
                </div>
              </div>

              <div className="text-center p-2 sm:p-3 bg-indigo-100 rounded-lg">
                <p className="text-xs sm:text-sm text-indigo-800">Overall Band Score</p>
                <p className="text-lg sm:text-2xl font-bold text-indigo-900">{essay.overall_band}</p>
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

        <button
          className="mt-6 sm:mt-8 w-full bg-blue-600 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg hover:bg-blue-700 transition-colors duration-300 text-sm sm:text-base"
          onClick={() => navigate('/writing')}
        >
          To Writing tests list
        </button>
      </div>
    </div>
  );
};

export default WritingResultPage;
