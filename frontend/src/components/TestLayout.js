import React from 'react';

const TestLayout = ({
  title,
  timer,
  leftPanel,
  rightPanel,
  onSubmit,
  isSubmitting,
  submitLabel
}) => {
  return (
    <div className="flex flex-col h-screen">
      <header className="bg-white shadow-md p-4 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-bold">{title}</h1>
        {timer}
      </header>

      <main className="flex-grow flex flex-col md:flex-row overflow-hidden">
        {/* Левая панель - основной контент */}
        <div className="w-full md:w-1/2 h-full overflow-y-auto p-6 border-r">
          {leftPanel}
        </div>

        {/* Правая панель - вопросы */}
        <div className="w-full md:w-1/2 h-full overflow-y-auto p-6">
          {rightPanel}
        </div>
      </main>

      <footer className="p-4 bg-white border-t sticky bottom-0">
        <button
          onClick={onSubmit}
          className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors duration-300"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Отправка..." : (submitLabel || "Завершить и посмотреть результат")}
        </button>
      </footer>
    </div>
  );
};

export default TestLayout; 