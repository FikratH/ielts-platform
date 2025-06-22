import React, { useEffect, useState } from 'react';

const ListeningTimer = ({ onTimeUp, initialSeconds = 1800 }) => {
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
    <div className="text-xl font-bold mb-4 text-black-600">Timer: {formatted}</div>
  );
};

export default ListeningTimer; 