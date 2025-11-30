import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const SpeakingSessionsListPage = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        const response = await api.get('/speaking/sessions/');
        setSessions(response.data.sessions || response.data || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching speaking sessions:', err);
        setError('Failed to load speaking sessions');
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading speaking sessions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️</div>
          <p className="text-gray-800 text-lg">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4">🎤</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">No Speaking Sessions Yet</h1>
          <p className="text-gray-600 mb-6">You haven't completed any speaking assessments yet.</p>
          <Link 
            to="/dashboard" 
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Speaking Assessment Results</h1>
          <p className="text-gray-600">View your speaking assessment history and feedback</p>
        </div>

        {/* Sessions Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <div key={session.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-semibold text-white">
                      Session #{session.id}
                    </h3>
                    {session.completed && (
                      <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full">
                        ✓ Completed
                      </span>
                    )}
                  </div>
                  <div className="text-white text-sm">
                    {session.conducted_at ? new Date(session.conducted_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    }) : 'Date not available'}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Teacher Info */}
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-1">Assessed by</p>
                  <p className="font-medium text-gray-900">
                    {session.teacher_name || 'Teacher'}
                  </p>
                </div>

                {/* Scores */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Fluency</p>
                    <p className="text-lg font-semibold text-blue-600">
                      {session.fluency_coherence_score || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Pronunciation</p>
                    <p className="text-lg font-semibold text-green-600">
                      {session.pronunciation_score || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Grammar</p>
                    <p className="text-lg font-semibold text-purple-600">
                      {session.grammatical_range_score || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Vocabulary</p>
                    <p className="text-lg font-semibold text-orange-600">
                      {session.lexical_resource_score || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Overall Score */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Overall Band Score</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {session.overall_band_score || 'N/A'}
                  </p>
                </div>

                {/* Overall Feedback Preview */}
                {session.overall_feedback && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-gray-500 mb-1">Teacher's Feedback</p>
                    <p className="text-sm text-gray-700 line-clamp-2">
                      {session.overall_feedback.length > 100 
                        ? `${session.overall_feedback.substring(0, 100)}...` 
                        : session.overall_feedback}
                    </p>
                  </div>
                )}

                {/* Duration */}
                {session.duration_seconds && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-500 mb-1">Duration</p>
                    <p className="font-medium text-gray-900">
                      {Math.floor(session.duration_seconds / 60)}:{(session.duration_seconds % 60).toString().padStart(2, '0')}
                    </p>
                  </div>
                )}

                {/* Action Button */}
                <Link
                  to={`/speaking/result/${session.id}`}
                  className="w-full bg-blue-600 text-white text-center py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors block"
                >
                  View Full Results
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Back Button */}
        <div className="mt-8 text-center">
          <Link 
            to="/dashboard" 
            className="inline-flex items-center px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SpeakingSessionsListPage;
