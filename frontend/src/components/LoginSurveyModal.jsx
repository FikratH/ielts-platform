import React, { useState, useEffect } from 'react';
import api from '../api';

const LoginSurveyModal = ({ isOpen, onClose, onSurveySubmitted }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);
  const [isSatisfied, setIsSatisfied] = useState(true);
  const [reason, setReason] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [hasMadeChoice, setHasMadeChoice] = useState(false);
  const [showSurveyForm, setShowSurveyForm] = useState(false);

  const submittedThisWeek = !!status?.submittedThisWeek;
  const readOnly = submittedThisWeek;
  const existing_survey = status?.submission;

  useEffect(() => {
    if (isOpen) {
      setHasMadeChoice(false);
      setError('');
      setSuccessMessage('');
      setShowSurveyForm(false);
      loadSurveyStatus();
    }
  }, [isOpen]);

  const loadSurveyStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get('/teacher-survey/');
      setStatus(response.data);
      if (response.data?.submission) {
        const sub = response.data.submission;
        setIsSatisfied(sub.is_satisfied);
        setReason(sub.reason || '');
      }
    } catch (err) {
      console.error('Failed to load survey status:', err);
      setError('Failed to load survey status.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemindLater = () => {
    localStorage.setItem('surveyRemindLater', 'true');
    onClose();
  };

  const handleDontRemindThisWeek = () => {
    const now = new Date();
    // Неделя заканчивается в воскресенье
    const daysUntilSunday = 7 - now.getDay();
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + daysUntilSunday);
    weekEnd.setHours(23, 59, 59, 999);
    
    localStorage.setItem('surveyDontRemindUntil', weekEnd.getTime().toString());
    onClose();
  };

  const handleCompleteNow = () => {
    if (submittedThisWeek) {
      onClose();
      return;
    }
    setShowSurveyForm(true);
  };

  const handleYesClick = async () => {
    if (readOnly || saving) return;
    
    setIsSatisfied(true);
    setReason('');
    setHasMadeChoice(true);
    setError('');
    setSuccessMessage('');
  };

  const handleSubmitYes = async () => {
    if (readOnly || saving) return;
    try {
      setSaving(true);
      await api.post('/teacher-survey/', {
        is_satisfied: true,
        reason: ''
      });
      await loadSurveyStatus();
      
      if (onSurveySubmitted) {
        onSurveySubmitted();
      }
      
      setError('');
      setSuccessMessage('Thanks! Your feedback helps us improve');
      setSaving(false);
      
      setTimeout(() => {
        onClose();
        setSuccessMessage('');
      }, 3000);
      
    } catch (err) {
      if (err?.response?.status === 409) {
        setError("You already submitted this week's survey.");
        await loadSurveyStatus();
      } else {
        setError(err?.response?.data?.error || 'Failed to submit survey.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleNoClick = async () => {
    if (readOnly || saving) return;
    setIsSatisfied(false);
    setHasMadeChoice(true);
    setError('');
    setSuccessMessage('');
  };

  const handleSubmitNo = async () => {
    if (readOnly || saving) return;
    try {
      setSaving(true);
      await api.post('/teacher-survey/', {
        is_satisfied: false,
        reason: (reason || '').trim()
      });
      await loadSurveyStatus();
      if (onSurveySubmitted) {
        onSurveySubmitted();
      }
      setError('');
      setSuccessMessage('Thanks! Your feedback helps us improve 🌟');
      setSaving(false);
      setTimeout(() => {
        onClose();
        setSuccessMessage('');
      }, 3000);
    } catch (err) {
      if (err?.response?.status === 409) {
        setError("You already submitted this week's survey.");
        await loadSurveyStatus();
      } else {
        setError(err?.response?.data?.error || 'Failed to submit survey.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
        <div className="bg-gray-50 rounded-2xl shadow-2xl max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-4 sm:p-6 md:p-8 lg:p-10">
            <div className="text-center mb-4 sm:mb-6 md:mb-8">
              <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-700 mb-2 sm:mb-3">Weekly Teacher Survey</h2>
            </div>

            {loading ? (
              <div className="text-center py-16">
                <div className="text-gray-500 text-xl">Loading...</div>
              </div>
            ) : (
              <div>
                {!showSurveyForm ? (
                  <>
                    <div className="mb-4 sm:mb-6 md:mb-8 text-center">
                      <p className="text-sm sm:text-base md:text-lg text-gray-600 mb-4 sm:mb-6 px-2">
                        Please take 20 seconds to complete this week's survey about your teacher.
                      </p>
                    </div>

                    {submittedThisWeek && (
                      <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-xl text-center">
                        <p className="text-blue-800 text-lg mb-2">
                          Thank you!
                        </p>
                        <div className="p-4 bg-white rounded-lg">
                          <p className="text-blue-700 font-medium">
                            Your answer: <span className={existing_survey?.is_satisfied ? 'text-green-600' : 'text-red-600'}>
                              {existing_survey?.is_satisfied ? '👍 Satisfied' : '👎 Not Satisfied'}
                            </span>
                          </p>
                          {existing_survey?.reason && (
                            <p className="text-blue-600 mt-2 text-sm">
                              Reason: "{existing_survey.reason}"
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                     <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4 justify-center">
                       <button
                         onClick={handleRemindLater}
                         className="px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 text-blue-600 text-xs sm:text-sm md:text-base font-medium hover:bg-blue-50 rounded-lg transition-colors"
                       >
                         REMIND ME LATER
                       </button>
                       <button
                         onClick={handleDontRemindThisWeek}
                         className="px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 text-blue-600 text-xs sm:text-sm md:text-base font-medium hover:bg-blue-50 rounded-lg transition-colors whitespace-nowrap"
                       >
                         DON'T REMIND THIS WEEK
                       </button>
                       <button
                         onClick={handleCompleteNow}
                         className="px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 bg-blue-600 text-white text-xs sm:text-sm md:text-base font-medium hover:bg-blue-700 rounded-lg transition-colors"
                       >
                         COMPLETE NOW
                       </button>
                     </div>
                  </>
                ) : (
                  <>
                    {readOnly && (
                      <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-xl text-center">
                        <p className="text-blue-800 text-lg">
                          Thank you!
                        </p>
                        <div className="mt-4 p-4 bg-white rounded-lg">
                          <p className="text-blue-700 font-medium">
                            Your answer: <span className={existing_survey?.is_satisfied ? 'text-green-600' : 'text-red-600'}>
                              {existing_survey?.is_satisfied ? '👍 Satisfied' : '👎 Not Satisfied'}
                            </span>
                          </p>
                          {existing_survey?.reason && (
                            <p className="text-blue-600 mt-2 text-sm">
                              Reason: "{existing_survey.reason}"
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {!readOnly && (
                      <>
                        <div className="mb-6 sm:mb-8 md:mb-12 text-center">
                          <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 sm:mb-6 md:mb-8 px-2">
                            Are you satisfied with your teacher?
                          </h3>
                          
                          <div className="flex gap-3 sm:gap-5 md:gap-8 justify-center px-2">
                            <button
                              type="button"
                              onClick={handleYesClick}
                              disabled={saving}
                              className={`group relative p-4 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl border-2 sm:border-4 transition-all transform hover:scale-105 hover:shadow-xl ${
                                isSatisfied 
                                  ? 'border-green-400 bg-green-100 shadow-lg' 
                                  : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50'
                              } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <div className="text-4xl sm:text-5xl md:text-6xl mb-2 sm:mb-3">👍</div>
                              <div className={`text-lg sm:text-xl md:text-2xl font-bold ${
                                isSatisfied ? 'text-green-700' : 'text-gray-600 group-hover:text-green-600'
                              }`}>
                                {saving ? 'Sending...' : 'Yes'}
                              </div>
                              {isSatisfied && (
                                <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 w-5 h-5 sm:w-6 sm:h-6 bg-green-500 rounded-full flex items-center justify-center">
                                  <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={handleNoClick}
                              disabled={saving}
                              className={`group relative p-4 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl border-2 sm:border-4 transition-all transform hover:scale-105 hover:shadow-xl ${
                                !isSatisfied 
                                  ? 'border-red-400 bg-red-100 shadow-lg' 
                                  : 'border-gray-200 bg-white hover:border-red-300 hover:bg-red-50'
                              } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <div className="text-4xl sm:text-5xl md:text-6xl mb-2 sm:mb-3">👎</div>
                              <div className={`text-lg sm:text-xl md:text-2xl font-bold ${
                                !isSatisfied ? 'text-red-700' : 'text-gray-600 group-hover:text-red-600'
                              }`}>
                                {saving ? 'Sending...' : 'No'}
                              </div>
                              {!isSatisfied && (
                                <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 w-5 h-5 sm:w-6 sm:h-6 bg-red-500 rounded-full flex items-center justify-center">
                                  <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </button>
                          </div>
                        </div>

                        {hasMadeChoice && !isSatisfied && (
                          <div className="mb-4 sm:mb-6 md:mb-8 px-2">
                            <label className="block text-sm sm:text-base md:text-lg font-semibold text-gray-700 mb-2 sm:mb-3">
                              Please tell us why you're not satisfied:
                            </label>
                            <textarea
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              placeholder="Your feedback helps us improve..."
                              className="w-full p-3 sm:p-4 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                              rows="4"
                              disabled={saving}
                            />
                          </div>
                        )}

                        {hasMadeChoice && (
                          <div className="flex gap-2 sm:gap-4 justify-center px-2">
                            <button
                              onClick={isSatisfied ? handleSubmitYes : handleSubmitNo}
                              disabled={saving || (!isSatisfied && !reason.trim())}
                              className={`px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold text-sm sm:text-base md:text-lg transition-all ${
                                saving || (!isSatisfied && !reason.trim())
                                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                  : 'bg-blue-600 text-white hover:bg-blue-700 transform hover:scale-105 shadow-lg'
                              }`}
                            >
                              {saving ? 'Submitting...' : 'Submit Feedback'}
                            </button>
                          </div>
                        )}

                        <div className="flex justify-center mt-6">
                          <button
                            onClick={() => setShowSurveyForm(false)}
                            className="text-gray-500 hover:text-gray-700 text-sm"
                          >
                            ← Back to options
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}

                {error && (
                  <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-center">
                    <p className="text-red-700">{error}</p>
                  </div>
                )}

                {successMessage && (
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl text-center">
                    <p className="text-green-700 text-lg font-medium">{successMessage}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginSurveyModal;
