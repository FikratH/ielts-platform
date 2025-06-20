import React, { useEffect, useState } from 'react';

export default function WritingTimer({ onSubmitTask1, onSubmitTask2, onFinishSession }) {
  const [timeLeft, setTimeLeft] = useState(() => {
    const saved = localStorage.getItem('writing_timer');
    return saved ? parseInt(saved) : 60 * 60;
  });
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    if (timeLeft <= 0 && !hasSubmitted) {
      setHasSubmitted(true);
      handleFinalSubmission();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        const updated = prev - 1;
        localStorage.setItem('writing_timer', updated);
        return updated;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, hasSubmitted]);

  const handleFinalSubmission = async () => {
    try {
      await onSubmitTask1();
      await onSubmitTask2();
      await onFinishSession();
    } catch (err) {
      console.error('Ошибка при автосабмите по таймеру:', err);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, background: '#003366', color: 'white', padding: '10px', textAlign: 'center', fontSize: '18px', zIndex: 1000 }}>
      Осталось времени: {formatTime(timeLeft)}
    </div>
  );
}
