import React, { useState } from 'react';
import ListeningTestPlayer from './ListeningTestPlayer';

const ListeningTestPreview = ({ test, onClose }) => {
  const [currentPart, setCurrentPart] = useState(0);

  if (!test) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">No test data available for preview</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-7xl h-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-100 px-6 py-4 border-b flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Test Preview: {test.title}</h2>
            <p className="text-sm text-gray-600">Preview mode - no timer, no submission</p>
          </div>
          <button
            onClick={onClose}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
          >
            Close Preview
          </button>
        </div>

        {/* Preview Content */}
        <div className="flex h-full">
          {/* Audio Player Sidebar */}
          <div className="w-1/3 bg-gray-50 p-6 overflow-y-auto">
            <h3 className="font-bold mb-4">Audio Player (Preview)</h3>
            
            {test.parts?.map((part, index) => (
              <div key={part.id} className="mb-6 p-4 bg-white rounded-lg shadow">
                <h4 className="font-medium mb-2">Part {index + 1}</h4>
                {part.instructions && (
                  <p className="text-sm text-gray-600 mb-3">{part.instructions}</p>
                )}
                
                {part.audio && (
                  <audio
                    controls
                    className="w-full mb-3"
                    src={part.audio}
                  >
                    Your browser does not support the audio element.
                  </audio>
                )}
                
                <div className="text-sm text-gray-500">
                  {part.questions?.length || 0} questions
                </div>
              </div>
            ))}
          </div>

          {/* Questions */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-4">Questions Preview</h3>
              
              {/* Part Navigation */}
              <div className="flex space-x-2 mb-6">
                {test.parts?.map((part, index) => (
                  <button
                    key={part.id}
                    onClick={() => setCurrentPart(index)}
                    className={`px-4 py-2 rounded ${
                      currentPart === index
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Part {index + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Current Part Questions */}
            {test.parts?.[currentPart] && (
              <div>
                <h4 className="text-lg font-medium mb-4">
                  Part {currentPart + 1} Questions
                </h4>
                
                <div className="space-y-6">
                  {test.parts[currentPart].questions?.map((question, qIndex) => (
                    <div key={question.id} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-blue-600">Q{qIndex + 1}.</span>
                        <span className="text-sm text-gray-500 bg-gray-200 px-2 py-1 rounded">
                          {question.question_type}
                        </span>
                      </div>
                      
                      <p className="font-medium mb-3">{question.question_text}</p>
                      
                      {/* Question Type Specific Preview */}
                      {question.question_type === 'MULTIPLE_CHOICE' && question.options && (
                        <div className="space-y-2">
                          {question.options.map((option) => (
                            <div key={option.id} className="flex items-center space-x-2">
                              <span className="font-medium">{option.label}.</span>
                              <span>{option.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {question.question_type === 'MATCHING' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h5 className="font-medium mb-2">Items:</h5>
                            {question.extra_data?.items?.map((item, index) => (
                              <div key={index} className="mb-1">
                                <span className="font-medium">{index + 1}.</span> {item}
                              </div>
                            ))}
                          </div>
                          <div>
                            <h5 className="font-medium mb-2">Options:</h5>
                            {question.options?.map((option) => (
                              <div key={option.id} className="mb-1">
                                <span className="font-medium">{option.label}.</span> {option.text}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Correct Answers */}
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                        <h5 className="font-medium text-green-800 mb-1">Correct Answer(s):</h5>
                        <p className="text-green-700">
                          {question.correct_answers?.join(', ') || 'Not specified'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListeningTestPreview; 