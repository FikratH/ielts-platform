import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import api from '../api';

const StudentSubmissionView = () => {
  const { sessionId } = useParams();
  const [user, loading] = useAuthState(auth);
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user && sessionId) {
      loadResult();
    }
  }, [user, sessionId]);

  const loadResult = async () => {
    try {
      setIsLoading(true);
      const idToken = await user.getIdToken();
      const response = await api.get(`/listening-sessions/${sessionId}/result/`);
      
      if (response.ok) {
        const resultData = await response.json();
        setResult(resultData);
      } else {
        setError('Failed to load result');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getBandScoreColor = (score) => {
    if (score >= 7.0) return 'text-green-600';
    if (score >= 6.0) return 'text-blue-600';
    if (score >= 5.0) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getBandScoreLabel = (score) => {
    if (score >= 8.5) return 'Excellent';
    if (score >= 7.0) return 'Good';
    if (score >= 6.0) return 'Competent';
    if (score >= 5.0) return 'Modest';
    return 'Limited';
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading result...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600 text-xl">{error}</div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Result not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h1 className="text-3xl font-bold text-center mb-4">Test Results</h1>
          <h2 className="text-xl text-center text-gray-600 mb-6">{result.test_title}</h2>
          
          {/* Score Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="text-center p-6 bg-blue-50 rounded-lg">
              <div className={`text-4xl font-bold ${getBandScoreColor(result.score)}`}>
                {result.score}
              </div>
              <div className="text-sm text-gray-600">Band Score</div>
              <div className="text-xs text-gray-500 mt-1">
                {getBandScoreLabel(result.score)}
              </div>
            </div>
            
            <div className="text-center p-6 bg-green-50 rounded-lg">
              <div className="text-4xl font-bold text-green-600">
                {result.correct_answers_count}/{result.total_questions_count}
              </div>
              <div className="text-sm text-gray-600">Correct Answers</div>
              <div className="text-xs text-gray-500 mt-1">
                {Math.round((result.correct_answers_count / result.total_questions_count) * 100)}% accuracy
              </div>
            </div>
            
            <div className="text-center p-6 bg-purple-50 rounded-lg">
              <div className="text-4xl font-bold text-purple-600">
                {formatTime(result.time_taken)}
              </div>
              <div className="text-sm text-gray-600">Time Taken</div>
              <div className="text-xs text-gray-500 mt-1">
                {result.time_taken < 1800 ? 'Under time limit' : 'Over time limit'}
              </div>
            </div>
            
            <div className="text-center p-6 bg-orange-50 rounded-lg">
              <div className="text-4xl font-bold text-orange-600">
                {result.total_questions_count - result.correct_answers_count}
              </div>
              <div className="text-sm text-gray-600">Incorrect</div>
              <div className="text-xs text-gray-500 mt-1">
                {result.total_questions_count - result.correct_answers_count} mistakes
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Analysis */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold mb-6">Detailed Analysis</h3>
          
          {/* IELTS Band Score Explanation */}
          <div className="mb-8 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">IELTS Band Score Guide:</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div>9.0: Expert user</div>
              <div>8.0-8.5: Very good user</div>
              <div>7.0-7.5: Good user</div>
              <div>6.0-6.5: Competent user</div>
              <div>5.0-5.5: Modest user</div>
              <div>4.0-4.5: Limited user</div>
              <div>3.0-3.5: Extremely limited</div>
              <div>0.0-2.5: Non-user</div>
            </div>
          </div>

          {/* Answer Breakdown */}
          <div className="space-y-6">
            <h4 className="font-medium text-lg">Answer Breakdown</h4>
            
            {/* This would show detailed answers if available in the API response */}
            <div className="text-gray-600 text-center py-8">
              <p>Detailed answer analysis will be shown here when available.</p>
              <p className="text-sm mt-2">
                Your answers and the correct answers for each question will be displayed.
              </p>
            </div>
          </div>
        </div>

        {/* Test Information */}
        <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
          <h3 className="text-lg font-bold mb-4">Test Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Test ID:</span> {result.test}
            </div>
            <div>
              <span className="font-medium">Session ID:</span> {result.id}
            </div>
            <div>
              <span className="font-medium">Started:</span> {new Date(result.started_at).toLocaleString()}
            </div>
            <div>
              <span className="font-medium">Status:</span> 
              <span className={`ml-2 px-2 py-1 rounded text-xs ${
                result.submitted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {result.submitted ? 'Completed' : 'In Progress'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentSubmissionView; 