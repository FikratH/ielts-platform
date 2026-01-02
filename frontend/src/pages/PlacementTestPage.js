import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import api from '../api';

const PlacementTestPage = () => {
  const [step, setStep] = useState('form'); // 'form', 'test', 'result'
  const [loading, setLoading] = useState(false);
  
  // Form data
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [plannedExamDate, setPlannedExamDate] = useState('');
  
  // Test data
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
  // Result data
  const [result, setResult] = useState(null);

  // Fetch questions when moving to test step
  useEffect(() => {
    if (step === 'test' && questions.length === 0) {
      fetchQuestions();
    }
  }, [step]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const response = await api.get('/placement-test/questions/');
      setQuestions(response.data);
    } catch (error) {
      console.error('Error fetching questions:', error);
      alert('Failed to load questions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      alert('Please enter your full name');
      return;
    }
    if (!email.trim()) {
      alert('Please enter your email');
      return;
    }
    if (!plannedExamDate) {
      alert('Please select when you plan to take the IELTS exam');
      return;
    }
    setStep('test');
  };

  const handleAnswerSelect = (questionOrder, option) => {
    setAnswers({
      ...answers,
      [questionOrder]: option
    });
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmitTest = async () => {
    // Check if all questions are answered
    const unansweredCount = questions.filter(q => !answers[q.order]).length;
    if (unansweredCount > 0) {
      if (!window.confirm(`You have ${unansweredCount} unanswered question(s). Submit anyway?`)) {
        return;
      }
    }

    setLoading(true);
    try {
      const response = await api.post('/placement-test/submit/', {
        full_name: fullName,
        email: email,
        planned_exam_date: plannedExamDate,
        answers: answers
      });
      setResult(response.data);
      setStep('result');
    } catch (error) {
      console.error('Error submitting test:', error);
      alert('Failed to submit test. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Form Step
  if (step === 'form') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-blue-600 px-4 py-8">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-10 text-center drop-shadow-lg">
          Master Education Placement Test
        </h1>
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 md:p-10">
          <h2 className="text-xl md:text-2xl font-bold text-blue-700 mb-6 text-center">
            Before You Start
          </h2>
          <form onSubmit={handleFormSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <label htmlFor="full-name" className="font-semibold text-blue-700 text-sm md:text-base">
                Your Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="full-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-base transition"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="font-semibold text-blue-700 text-sm md:text-base">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-base transition"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="planned-date" className="font-semibold text-blue-700 text-sm md:text-base">
                When do you plan to take the IELTS exam? <span className="text-red-500">*</span>
              </label>
              <select
                id="planned-date"
                value={plannedExamDate}
                onChange={(e) => setPlannedExamDate(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-base transition"
                required
              >
                <option value="">Select an option</option>
                <option value="Ближайшие 3 месяца">Ближайшие 3 месяца</option>
                <option value="Ближайшие полгода">Ближайшие полгода</option>
                <option value="Ближайший год">Ближайший год</option>
                <option value="Позже">Позже</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg text-lg shadow-md hover:bg-blue-700 transition-colors duration-200 mt-2"
            >
              Start Test
            </button>
          </form>

          <p className="text-gray-500 text-sm text-center mt-6">
            This test contains 20 questions and will take approximately 15-20 minutes to complete.
          </p>
        </div>
      </div>
    );
  }

  // Test Step
  if (step === 'test') {
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-blue-600">
          <div className="text-white text-xl">Loading questions...</div>
        </div>
      );
    }

    if (questions.length === 0) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-blue-600">
          <div className="text-white text-xl">No questions available</div>
        </div>
      );
    }

    const currentQuestion = questions[currentQuestionIndex];
    const answeredCount = Object.keys(answers).length;

    return (
      <div className="min-h-screen bg-blue-600 px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Progress */}
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-blue-700 font-semibold">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
              <span className="text-blue-600 text-sm">
                Answered: {answeredCount}/{questions.length}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Question Card */}
          <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-10 mb-4">
            <p className="text-lg md:text-xl text-gray-800 mb-6 leading-relaxed">
              {currentQuestion.question_text}
            </p>

            <div className="space-y-3">
              {['A', 'B', 'C', 'D'].map((option) => (
                <label
                  key={option}
                  className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                    answers[currentQuestion.order] === option
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion.order}`}
                    value={option}
                    checked={answers[currentQuestion.order] === option}
                    onChange={() => handleAnswerSelect(currentQuestion.order, option)}
                    className="w-5 h-5 text-blue-600 focus:ring-2 focus:ring-blue-600"
                  />
                  <span className="ml-3 text-base md:text-lg text-gray-700">
                    <strong>{option}.</strong> {currentQuestion.options[option]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center">
            <button
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
              className="px-6 py-3 bg-white text-blue-700 font-semibold rounded-lg shadow-md hover:bg-gray-100 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            {currentQuestionIndex === questions.length - 1 ? (
              <button
                onClick={handleSubmitTest}
                disabled={loading}
                className="px-8 py-3 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 transition-colors duration-200 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Test'}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-6 py-3 bg-white text-blue-700 font-semibold rounded-lg shadow-md hover:bg-gray-100 transition-colors duration-200"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Result Step
  if (step === 'result' && result) {
    const recommendationText = result.recommendation === 'ielts'
      ? 'You are ready to take the IELTS course'
      : 'We recommend starting with the Pre-IELTS course';

    const recommendationColor = result.recommendation === 'ielts'
      ? 'text-green-700'
      : 'text-orange-700';

    return (
      <div className="min-h-screen bg-blue-600 px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-10">
            <h1 className="text-3xl md:text-4xl font-extrabold text-blue-700 mb-6 text-center">
              Test Results
            </h1>

            {/* Score Summary */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-8">
              <div className="text-center">
                <p className="text-lg text-gray-700 mb-2">Your Score</p>
                <p className="text-5xl font-extrabold text-blue-700 mb-4">
                  {result.score}/{result.total}
                </p>
                <p className={`text-xl font-semibold ${recommendationColor}`}>
                  {recommendationText}
                </p>
              </div>
            </div>

            {/* Detailed Results */}
            <h2 className="text-2xl font-bold text-blue-700 mb-4">Detailed Results</h2>
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {result.results.map((item, index) => (
                <div
                  key={index}
                  className={`border-2 rounded-lg p-4 ${
                    item.is_correct
                      ? 'border-green-300 bg-green-50'
                      : 'border-red-300 bg-red-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {item.is_correct ? (
                      <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800 mb-2">
                        Question {item.order}: {item.question_text}
                      </p>
                      <div className="text-sm">
                        <p className="text-gray-700">
                          <strong>Your answer:</strong>{' '}
                          <span className={item.is_correct ? 'text-green-700' : 'text-red-700'}>
                            {item.user_answer || 'Not answered'} -{' '}
                            {item.options[item.user_answer] || 'N/A'}
                          </span>
                        </p>
                        {!item.is_correct && (
                          <p className="text-gray-700 mt-1">
                            <strong>Correct answer:</strong>{' '}
                            <span className="text-green-700">
                              {item.correct_answer} - {item.options[item.correct_answer]}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Contact Info */}
            <div className="mt-8 text-center bg-blue-50 rounded-lg p-6">
              <p className="text-gray-700 mb-2">
                Thank you for taking the Master Education Placement Test!
              </p>
              <p className="text-gray-600 text-sm">
                We will contact you at <strong>{email}</strong> with more information about our courses.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default PlacementTestPage;

