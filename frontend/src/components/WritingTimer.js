import React, { useEffect, useRef, useState } from 'react';

const WritingTimer = ({ onTimeUp, onTick, initialSeconds = 60, sessionId, seed }) => {
  const storageKey = sessionId ? `writing_deadline_${sessionId}` : null;
  const [seconds, setSeconds] = useState(initialSeconds);
  const deadlineRef = useRef(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (storageKey) {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const ts = parseInt(stored, 10);
        if (!Number.isNaN(ts)) {
          deadlineRef.current = ts;
        }
      }
    }
    if (!deadlineRef.current) {
      deadlineRef.current = Date.now() + initialSeconds * 1000;
    }
    if (storageKey) {
      localStorage.setItem(storageKey, `${deadlineRef.current}`);
    }
    setSeconds(Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000)));
  }, [initialSeconds, storageKey, seed]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!deadlineRef.current) return;
      const remaining = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
      setSeconds(remaining);
      if (onTick) onTick(remaining);
      if (remaining <= 0 && !firedRef.current) {
        firedRef.current = true;
        if (onTimeUp) onTimeUp();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [onTimeUp]);

  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  const formatted = `${min}:${sec.toString().padStart(2, '0')}`;

  return (
    <div className="flex flex-col items-center">
      <div className="bg-gradient-to-br from-purple-50 to-violet-100 rounded-2xl p-4 border border-purple-200 shadow-sm hidden md:block">
        <div className="text-center">
          <div className="text-3xl font-bold text-purple-700 font-mono tracking-wider">{formatted}</div>
          <div className="text-xs text-purple-600 font-medium mt-1">Time Remaining</div>
        </div>
      </div>
      <div className="md:hidden text-gray-700 font-mono font-bold text-base">{formatted}</div>
    </div>
  );
};

export default WritingTimer;
