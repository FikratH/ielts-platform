import React, { useRef, useState } from 'react';

const AudioPlayer = ({ src }) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  return (
    <div className="mb-6 flex items-center space-x-4">
      <button
        onClick={togglePlay}
        className={`px-4 py-2 rounded ${playing ? 'bg-red-500' : 'bg-green-600'} text-white font-bold`}
      >
        {playing ? 'Пауза' : 'Воспроизвести'}
      </button>
      <audio ref={audioRef} src={src} controls className="w-full" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
    </div>
  );
};

export default AudioPlayer; 