import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

const SpeakingResultPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadSession = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/speaking/sessions/${sessionId}/`);
        setSession(response.data);
      } catch (err) {
        console.error('Error loading speaking session:', err);
        setError('Speaking feedback not available');
      } finally {
        setLoading(false);
      }
    };
    
    if (sessionId) {
      loadSession();
    }
  }, [sessionId]);

  const formatDate = (dateString) => {
    if (!dateString) return 'Date not available';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const getScoreColor = (score) => {
    if (!score) return 'text-gray-400';
    if (score >= 8) return 'text-green-600';
    if (score >= 7) return 'text-blue-600';
    if (score >= 6) return 'text-yellow-600';
    if (score >= 5) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBg = (score) => {
    if (!score) return 'bg-gray-100';
    if (score >= 8) return 'bg-green-100';
    if (score >= 7) return 'bg-blue-100';
    if (score >= 6) return 'bg-yellow-100';
    if (score >= 5) return 'bg-orange-100';
    return 'bg-red-100';
  };

  const getBandLevel = (score) => {
    if (!score) return 'Not assessed';
    if (score >= 8.5) return 'Excellent';
    if (score >= 7.5) return 'Very Good';
    if (score >= 6.5) return 'Good';
    if (score >= 5.5) return 'Modest';
    if (score >= 4.5) return 'Limited';
    return 'Extremely Limited';
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading..." />;
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Feedback Not Available</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-white to-indigo-50 border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 px-3 py-2 text-indigo-600 hover:text-indigo-800 transition mb-4"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </button>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-indigo-600 bg-clip-text text-transparent">
                Speaking Assessment Results
              </h1>
              <p className="text-gray-600 mt-2">
                Session conducted on {session.conducted_at ? formatDate(session.conducted_at) : 'Date not available'}
              </p>
              {session.duration_seconds && (
                <p className="text-sm text-gray-500">
                  Duration: {Math.floor(session.duration_seconds / 60)}:{(session.duration_seconds % 60).toString().padStart(2, '0')}
                </p>
              )}
              <p className="text-sm text-gray-500">
                Teacher: {session.teacher_name}
              </p>
            </div>
            
            {/* Overall Score */}
            <div className={`text-center p-6 rounded-xl ${getScoreBg(session.overall_band_score)} border-2 border-opacity-20`}>
              <div className="text-sm font-medium text-gray-700 mb-1">Overall Band Score</div>
              <div className={`text-4xl font-bold ${getScoreColor(session.overall_band_score)}`}>
                {session.overall_band_score || '--'}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {getBandLevel(session.overall_band_score)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Individual Scores */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-white to-gray-50 rounded-t-xl">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <div className="w-2 h-6 bg-gradient-to-b from-indigo-500 to-purple-600 rounded-full mr-3"></div>
                  Assessment Breakdown
                </h3>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Fluency and Coherence */}
                <ScoreCard
                  title="Fluency and Coherence"
                  score={session.fluency_coherence_score}
                  feedback={session.fluency_coherence_feedback}
                  description="Ability to speak at length without noticeable effort, with coherent ideas and appropriate use of discourse markers"
                />
                
                {/* Lexical Resource */}
                <ScoreCard
                  title="Lexical Resource"
                  score={session.lexical_resource_score}
                  feedback={session.lexical_resource_feedback}
                  description="Range and accuracy of vocabulary, including the ability to convey precise meaning and use idiomatic language"
                />
                
                {/* Grammatical Range and Accuracy */}
                <ScoreCard
                  title="Grammatical Range and Accuracy"
                  score={session.grammatical_range_score}
                  feedback={session.grammatical_range_feedback}
                  description="Variety and accuracy of grammatical structures, including complex sentences and error-free speech"
                />
                
                {/* Pronunciation */}
                <ScoreCard
                  title="Pronunciation"
                  score={session.pronunciation_score}
                  feedback={session.pronunciation_feedback}
                  description="Use of pronunciation features to convey meaning effectively, including stress, rhythm, and intonation"
                />
              </div>
            </div>
          </div>

          {/* Overall Feedback and Tips */}
          <div className="space-y-6">
            {/* Overall Feedback */}
            {session.overall_feedback && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-white to-gray-50 rounded-t-xl">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <div className="w-2 h-6 bg-gradient-to-b from-green-500 to-emerald-600 rounded-full mr-3"></div>
                    Teacher's Overall Feedback
                  </h3>
                </div>
                <div className="p-6">
                  <div className="prose prose-sm text-gray-700 whitespace-pre-wrap">
                    {session.overall_feedback}
                  </div>
                </div>
              </div>
            )}

            {/* Performance Summary */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-white to-gray-50 rounded-t-xl">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <div className="w-2 h-6 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full mr-3"></div>
                  Performance Summary
                </h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {/* Score Distribution */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Score Distribution</h4>
                    <div className="space-y-2">
                      {[
                        { label: 'Fluency', score: session.fluency_coherence_score },
                        { label: 'Lexical', score: session.lexical_resource_score },
                        { label: 'Grammar', score: session.grammatical_range_score },
                        { label: 'Pronunciation', score: session.pronunciation_score }
                      ].map((item, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">{item.label}</span>
                          <div className="flex items-center space-x-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all duration-500 ${
                                  item.score >= 7 ? 'bg-green-500' :
                                  item.score >= 6 ? 'bg-blue-500' :
                                  item.score >= 5 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${(item.score || 0) * 11.11}%` }}
                              ></div>
                            </div>
                            <span className={`text-sm font-medium ${getScoreColor(item.score)}`}>
                              {item.score || '--'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Next Steps */}
                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Recommendations</h4>
                    <div className="space-y-2 text-sm text-gray-600">
                      {session.overall_band_score >= 7 ? (
                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <p className="text-green-800 font-medium">Great performance! Continue practicing to maintain your level.</p>
                        </div>
                      ) : session.overall_band_score >= 6 ? (
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-blue-800 font-medium">Good foundation. Focus on expanding vocabulary and complex grammar.</p>
                        </div>
                      ) : (
                        <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                          <p className="text-yellow-800 font-medium">Keep practicing! Focus on fluency and basic grammar structures.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ScoreCard = ({ title, score, feedback, description }) => {
  const getScoreColor = (score) => {
    if (!score) return 'text-gray-400';
    if (score >= 8) return 'text-green-600';
    if (score >= 7) return 'text-blue-600';
    if (score >= 6) return 'text-yellow-600';
    if (score >= 5) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBg = (score) => {
    if (!score) return 'bg-gray-100';
    if (score >= 8) return 'bg-green-100';
    if (score >= 7) return 'bg-blue-100';
    if (score >= 6) return 'bg-yellow-100';
    if (score >= 5) return 'bg-orange-100';
    return 'bg-red-100';
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 mb-1">{title}</h4>
          <p className="text-xs text-gray-600">{description}</p>
        </div>
        <div className={`text-center px-4 py-2 rounded-lg ${getScoreBg(score)}`}>
          <div className={`text-2xl font-bold ${getScoreColor(score)}`}>
            {score || '--'}
          </div>
          <div className="text-xs text-gray-600">/ 9</div>
        </div>
      </div>
      
      {feedback && (
        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <h5 className="text-sm font-medium text-blue-900 mb-1">Teacher's Feedback:</h5>
          <p className="text-sm text-blue-800 whitespace-pre-wrap">{feedback}</p>
        </div>
      )}
    </div>
  );
};

export default SpeakingResultPage;
