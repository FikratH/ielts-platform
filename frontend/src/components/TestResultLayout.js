import React from 'react';

const SubQuestionFeedback = ({ sq, index }) => {
    const isCorrect = sq.is_correct;
    const bgColor = isCorrect ? 'bg-green-50' : 'bg-red-50';
    const borderColor = isCorrect ? 'border-green-500' : 'border-red-500';

    if (sq.type === 'gap') {
        return (
            <div className={`p-3 border-l-4 rounded-r-md ${bgColor} ${borderColor}`}>
                <p className="text-sm text-gray-600">Gap {sq.number}</p>
                <div className="text-sm">
                    <p>Your answer: <span className={`font-semibold ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>{sq.student_answer || "No answer"}</span></p>
                    {!isCorrect && <p>Correct answer: <span className="font-semibold text-blue-700">{sq.correct_answer}</span></p>}
                </div>
            </div>
        );
    }
    
    if (sq.type === 'mcq_single') {
         return (
             <div className="space-y-2">
                 {sq.options.map(opt => (
                     <div key={opt.label}
                          className={`p-2 border rounded-md text-sm
                              ${opt.label === sq.correct_answer ? 'border-green-400 bg-green-50' : ''}
                              ${opt.label === sq.student_answer && !sq.is_correct ? 'border-red-400 bg-red-50' : ''}
                          `}>
                         <span className={`font-bold mr-2 ${opt.label === sq.correct_answer ? 'text-green-700' : ''}`}>{opt.label}.</span>
                         <span>{opt.text}</span>
                         {opt.label === sq.correct_answer && <span className="text-green-600 font-semibold ml-2">(Correct)</span>}
                         {opt.label === sq.student_answer && !sq.is_correct && <span className="text-red-600 font-semibold ml-2">(Your Answer)</span>}
                     </div>
                 ))}
             </div>
         )
    }

    if (sq.type === 'multiple_response') {
        return (
            <div className="space-y-2">
                {sq.options.map(opt => {
                    let style = 'border-gray-300'; // Default
                    if (opt.is_correct_option) {
                        style = 'border-green-400 bg-green-50'; // Correct option
                    }
                    if (opt.student_selected && !opt.is_correct_option) {
                        style = 'border-red-400 bg-red-50'; // Incorrectly selected
                    }
                     if (!opt.student_selected && opt.is_correct_option) {
                        style = 'border-green-400 bg-green-50 opacity-60'; // Correct but missed
                    }

                    return (
                        <div key={opt.label} className={`p-2 border rounded-md text-sm transition-all ${style}`}>
                             <div className="flex items-center">
                                <input type="checkbox" readOnly checked={opt.student_selected} className="h-4 w-4 mr-3 rounded" />
                                <span className={`font-bold mr-2`}>{opt.label}.</span>
                                <span>{opt.text}</span>

                                {opt.is_correct_option && <span className="ml-auto text-xs font-semibold text-green-700">CORRECT</span>}
                             </div>
                        </div>
                    )
                })}
                 {!sq.is_correct && <p className="text-xs text-red-600 mt-2">Your selection did not perfectly match the correct answers.</p>}
            </div>
        )
    }

    return null;
}


const TestResultLayout = ({ title, session, onBackToList, moduleName }) => {
  const breakdown = session.breakdown || session.test_render_structure || [];

  return (
    <div className="p-6 max-w-4xl mx-auto bg-gray-50 min-h-screen">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-3xl font-bold mb-4 text-gray-800">{title}</h2>
        <p className="text-lg text-gray-600">Test: <span className="font-semibold">{session.test_title}</span></p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
          <div className="p-4 bg-blue-100 rounded-lg">
            <p className="text-sm text-blue-800">Correct answers</p>
            <p className="text-2xl font-bold text-blue-900">{session.raw_score} / {session.total_questions}</p>
          </div>
          <div className="p-4 bg-purple-100 rounded-lg">
            <p className="text-sm text-purple-800">Band Score</p>
            <p className="text-2xl font-bold text-purple-900">{session.band_score}</p>
          </div>
        </div>

        <h3 className="mt-8 text-2xl font-bold border-b pb-2 mb-4 text-gray-700">Detailed breakdown</h3>
        <div className="space-y-6">
          {breakdown && breakdown.length > 0 ? (
            breakdown.map((part) => (
              <div key={part.part_number} className="p-4 border rounded-lg bg-gray-50">
                <h4 className="text-xl font-bold text-gray-800 mb-3">Part {part.part_number}</h4>
                <div className="space-y-4">
                  {part.questions.map((q, qIndex) => (
                    <div key={q.id} className="p-4 bg-white rounded-md shadow-sm border">
                        <div className="mb-3">
                           <p className="font-semibold text-gray-700">Question {qIndex + 1}:</p>
                           {q.header && <p className="text-sm text-gray-600" style={{whiteSpace: 'pre-wrap'}}>{q.header}</p>}
                           {q.instruction && <p className="text-xs italic text-gray-500" style={{whiteSpace: 'pre-wrap'}}>{q.instruction}</p>}
                           {q.question_text && <p className="mt-1 text-sm text-gray-800" style={{whiteSpace: 'pre-wrap'}}>{q.question_text}</p>}
                        </div>
                        <div className="space-y-2">
                            {q.sub_questions.map((sq, sqIndex) => (
                                <SubQuestionFeedback key={sqIndex} sq={sq} index={sqIndex} />
                            ))}
                        </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-4">Detailed breakdown is not available.</p>
          )}
        </div>

        <button
           className="mt-8 w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-300"
           onClick={onBackToList}
        >
           Back to test list {moduleName}
        </button>
      </div>
    </div>
  );
};

export default TestResultLayout; 