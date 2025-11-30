import React, { useEffect, useState } from 'react';

const WritingTimer = ({ onTimeUp, initialSeconds = 60 }) => {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    if (seconds === 0) {
      clearInterval(timer);
      if (onTimeUp) onTimeUp();
    }

    return () => clearInterval(timer);
  }, [seconds, onTimeUp]);

  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  const formatted = `${min}:${sec.toString().padStart(2, '0')}`;

  return (
    <div className="flex flex-col items-center">
      <div className="bg-gradient-to-br from-purple-50 to-violet-100 rounded-2xl p-4 border border-purple-200 shadow-sm">
        <div className="text-center">
          <div className="text-3xl font-bold text-purple-700 font-mono tracking-wider">{formatted}</div>
          <div className="text-xs text-purple-600 font-medium mt-1">Time Remaining</div>
        </div>
      </div>
    </div>
  );
};

export default WritingTimer;
