import React from 'react';

const LoadingSpinner = ({ 
  text = "Loading...", 
  fullScreen = false,
  overlay = false,
  size = "md" 
}) => {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12", 
    lg: "w-16 h-16"
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center">
      <div className={`border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4 ${sizeClasses[size]}`}></div>
      <div className="text-blue-700 font-semibold text-lg">{text}</div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/20 backdrop-blur-sm">
        <div className="bg-white/95 rounded-2xl p-8 shadow-2xl border border-gray-200">
          {spinner}
        </div>
      </div>
    );
  }

  if (overlay) {
    return (
      <div className="absolute inset-0 bg-white bg-opacity-70 flex flex-col items-center justify-center rounded-2xl z-10">
        {spinner}
      </div>
    );
  }

  return spinner;
};

export default LoadingSpinner; 