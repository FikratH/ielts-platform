import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import IELTSSpeakingDescriptors from '../components/IELTSSpeakingDescriptors';

const SpeakingSessionPage = () => {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Stopwatch state
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [timeMarkers, setTimeMarkers] = useState([]);
  const intervalRef = useRef(null);
  
  // Assessment form state
  const [scores, setScores] = useState({
    fluency_coherence_score: '',
    lexical_resource_score: '',
    grammatical_range_score: '',
    pronunciation_score: ''
  });
  
  const [feedbacks, setFeedbacks] = useState({
    fluency_coherence_feedback: '',
    lexical_resource_feedback: '',
    grammatical_range_feedback: '',
    pronunciation_feedback: '',
    overall_feedback: '',
    session_notes: ''
  });
  
  const [showDescriptors, setShowDescriptors] = useState(false);

  useEffect(() => {
    const loadSession = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/teacher/speaking/sessions/${sessionId}/`);
        const sessionData = response.data;
        setSession(sessionData);
        
        // Load existing data if session exists
        if (sessionData) {
          setScores({
            fluency_coherence_score: sessionData.fluency_coherence_score || '',
            lexical_resource_score: sessionData.lexical_resource_score || '',
            grammatical_range_score: sessionData.grammatical_range_score || '',
            pronunciation_score: sessionData.pronunciation_score || ''
          });
          
          setFeedbacks({
            fluency_coherence_feedback: sessionData.fluency_coherence_feedback || '',
            lexical_resource_feedback: sessionData.lexical_resource_feedback || '',
            grammatical_range_feedback: sessionData.grammatical_range_feedback || '',
            pronunciation_feedback: sessionData.pronunciation_feedback || '',
            overall_feedback: sessionData.overall_feedback || '',
            session_notes: sessionData.session_notes || ''
          });
          
          setTimeMarkers(sessionData.time_markers || []);
          setSeconds(sessionData.duration_seconds || 0);
        }
      } catch (error) {
        console.error('Error loading session:', error);
        alert('Error loading session');
        navigate('/teacher/speaking');
      } finally {
        setLoading(false);
      }
    };
    
    if (sessionId) {
      loadSession();
    }
  }, [sessionId, navigate]);

  // Stopwatch functions
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const toggleStopwatch = () => {
    setIsRunning(!isRunning);
  };

  const resetStopwatch = () => {
    setIsRunning(false);
    setSeconds(0);
    setTimeMarkers([]);
  };

  const addTimeMarker = () => {
    const marker = {
      time: seconds,
      timestamp: new Date().toISOString(),
      note: ''
    };
    setTimeMarkers(prev => [...prev, marker]);
  };

  const updateMarkerNote = (index, note) => {
    setTimeMarkers(prev => prev.map((marker, i) => 
      i === index ? { ...marker, note } : marker
    ));
  };

  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate overall band score
  const calculateOverallBand = () => {
    const scoreValues = Object.values(scores)
      .map(score => parseFloat(score))
      .filter(score => !isNaN(score));
    
    if (scoreValues.length === 0) return null;
    
    const average = scoreValues.reduce((a, b) => a + b) / scoreValues.length;
    
    // IELTS rounding: < 0.25 → down, ≥ 0.25 and < 0.75 → 0.5, ≥ 0.75 → up
    const decimal = average - Math.floor(average);
    if (decimal < 0.25) return Math.floor(average);
    if (decimal < 0.75) return Math.floor(average) + 0.5;
    return Math.floor(average) + 1;
  };

  const handleScoreChange = (field, value) => {
    const numValue = parseFloat(value);
    if (value === '' || (!isNaN(numValue) && numValue >= 0 && numValue <= 9)) {
      setScores(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleFeedbackChange = (field, value) => {
    setFeedbacks(prev => ({ ...prev, [field]: value }));
  };

  const saveSession = async (completed = false) => {
    setSaving(true);
    try {
      const data = {
        ...scores,
        ...feedbacks,
        duration_seconds: seconds,
        time_markers: timeMarkers,
        completed
      };

      // Clean up empty scores
      Object.keys(data).forEach(key => {
        if (key.includes('_score') && data[key] === '') {
          data[key] = null;
        }
      });

      if (completed) {
        await api.post(`/teacher/speaking/sessions/${sessionId}/`, data);
        alert('Speaking session completed successfully!');
        navigate('/teacher/speaking');
      } else {
        await api.put(`/teacher/speaking/sessions/${sessionId}/`, data);
        alert('Session saved as draft');
      }
    } catch (error) {
      console.error('Error saving session:', error);
      alert('Error saving session');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading..." />;
  }

  if (!session) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">Session not found</p>
      </div>
    );
  }

  const overallBand = calculateOverallBand();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/teacher/speaking')}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Speaking
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Speaking Assessment
                </h1>
                <p className="text-sm text-gray-600">
                  Student: {session.student_name}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm text-gray-600">Overall Band Score</div>
                <div className="text-2xl font-bold text-indigo-600">
                  {overallBand || '--'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Assessment Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Assessment Criteria */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-white to-gray-50 rounded-t-xl">
                <h3 className="text-lg font-semibold text-gray-900">IELTS Speaking Assessment</h3>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Fluency and Coherence */}
                <AssessmentCriterion
                  title="Fluency and Coherence"
                  score={scores.fluency_coherence_score}
                  feedback={feedbacks.fluency_coherence_feedback}
                  onScoreChange={(value) => handleScoreChange('fluency_coherence_score', value)}
                  onFeedbackChange={(value) => handleFeedbackChange('fluency_coherence_feedback', value)}
                />
                
                {/* Lexical Resource */}
                <AssessmentCriterion
                  title="Lexical Resource"
                  score={scores.lexical_resource_score}
                  feedback={feedbacks.lexical_resource_feedback}
                  onScoreChange={(value) => handleScoreChange('lexical_resource_score', value)}
                  onFeedbackChange={(value) => handleFeedbackChange('lexical_resource_feedback', value)}
                />
                
                {/* Grammatical Range and Accuracy */}
                <AssessmentCriterion
                  title="Grammatical Range and Accuracy"
                  score={scores.grammatical_range_score}
                  feedback={feedbacks.grammatical_range_feedback}
                  onScoreChange={(value) => handleScoreChange('grammatical_range_score', value)}
                  onFeedbackChange={(value) => handleFeedbackChange('grammatical_range_feedback', value)}
                />
                
                {/* Pronunciation */}
                <AssessmentCriterion
                  title="Pronunciation"
                  score={scores.pronunciation_score}
                  feedback={feedbacks.pronunciation_feedback}
                  onScoreChange={(value) => handleScoreChange('pronunciation_score', value)}
                  onFeedbackChange={(value) => handleFeedbackChange('pronunciation_feedback', value)}
                />
                
                {/* Overall Feedback */}
                <div className="border-t pt-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Overall Feedback
                  </label>
                  <textarea
                    value={feedbacks.overall_feedback}
                    onChange={(e) => handleFeedbackChange('overall_feedback', e.target.value)}
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                    placeholder="Provide overall feedback on the student's speaking performance..."
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between">
              <button
                onClick={() => saveSession(false)}
                disabled={saving}
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
              
              <button
                onClick={() => saveSession(true)}
                disabled={saving}
                className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50"
              >
                {saving ? 'Completing...' : 'Complete Session'}
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stopwatch */}
            <StopwatchWidget
              seconds={seconds}
              isRunning={isRunning}
              timeMarkers={timeMarkers}
              onToggle={toggleStopwatch}
              onReset={resetStopwatch}
              onAddMarker={addTimeMarker}
              onUpdateMarkerNote={updateMarkerNote}
              formatTime={formatTime}
            />

            {/* Session Notes */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-white to-gray-50 rounded-t-xl">
                <h4 className="text-sm font-semibold text-gray-700">Session Notes</h4>
              </div>
              <div className="p-4">
                <textarea
                  value={feedbacks.session_notes}
                  onChange={(e) => handleFeedbackChange('session_notes', e.target.value)}
                  className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-sm"
                  placeholder="Additional notes about the session..."
                />
              </div>
            </div>

            {/* IELTS Descriptors */}
            <IELTSSpeakingDescriptors 
              isExpanded={showDescriptors} 
              onToggle={() => setShowDescriptors(!showDescriptors)} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const AssessmentCriterion = ({ title, score, feedback, onScoreChange, onFeedbackChange }) => {
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-900">{title}</h4>
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-600">Score:</label>
          <input
            type="number"
            min="0"
            max="9"
            step="0.5"
            value={score}
            onChange={(e) => onScoreChange(e.target.value)}
            className="w-16 px-2 py-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="0-9"
          />
          <span className="text-xs text-gray-500">/ 9</span>
        </div>
      </div>
      <textarea
        value={feedback}
        onChange={(e) => onFeedbackChange(e.target.value)}
        className="w-full h-20 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-sm"
        placeholder={`Feedback for ${title.toLowerCase()}...`}
      />
    </div>
  );
};

const StopwatchWidget = ({ 
  seconds, 
  isRunning, 
  timeMarkers, 
  onToggle, 
  onReset, 
  onAddMarker, 
  onUpdateMarkerNote, 
  formatTime 
}) => {
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-white to-gray-50 rounded-t-xl">
        <h4 className="text-sm font-semibold text-gray-700">Session Timer</h4>
      </div>
      
      <div className="p-4">
        <div className="text-center mb-4">
          <div className="text-3xl font-mono font-bold text-gray-900 mb-2">
            {formatTime(seconds)}
          </div>
          <div className="flex justify-center space-x-2">
            <button
              onClick={onToggle}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isRunning 
                  ? 'bg-red-500 text-white hover:bg-red-600' 
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              {isRunning ? 'Pause' : 'Start'}
            </button>
            <button
              onClick={onReset}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
        
        <button
          onClick={onAddMarker}
          disabled={seconds === 0}
          className="w-full mb-4 px-4 py-2 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Mark Time
        </button>
        
        {timeMarkers.length > 0 && (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            <h5 className="text-xs font-semibold text-gray-600 mb-2">Time Markers:</h5>
            {timeMarkers.map((marker, index) => (
              <div key={index} className="text-xs border border-gray-200 rounded p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-medium">{formatTime(marker.time)}</span>
                  <span className="text-gray-500">#{index + 1}</span>
                </div>
                <input
                  type="text"
                  value={marker.note}
                  onChange={(e) => onUpdateMarkerNote(index, e.target.value)}
                  placeholder="Add note..."
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SpeakingSessionPage;
