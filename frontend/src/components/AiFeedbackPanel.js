import React from 'react';

const parseFeedback = (text) => {
  if (!text || typeof text !== 'string') return null;
  try {
    const data = JSON.parse(text);
    if (data && typeof data === 'object') return data;
  } catch (err) {
    return null;
  }
  return null;
};

const safeList = (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string' && item.trim().length > 0);
};

const toneStyles = {
  sky: {
    card: 'border-sky-100 bg-gradient-to-br from-sky-50 to-white',
    dot: 'bg-sky-500',
    title: 'text-sky-700',
  },
  emerald: {
    card: 'border-emerald-100 bg-gradient-to-br from-emerald-50 to-white',
    dot: 'bg-emerald-500',
    title: 'text-emerald-700',
  },
  rose: {
    card: 'border-rose-100 bg-gradient-to-br from-rose-50 to-white',
    dot: 'bg-rose-500',
    title: 'text-rose-700',
  },
  indigo: {
    card: 'border-indigo-100 bg-gradient-to-br from-indigo-50 to-white',
    dot: 'bg-indigo-500',
    title: 'text-indigo-700',
  },
  amber: {
    card: 'border-amber-100 bg-gradient-to-br from-amber-50 to-white',
    dot: 'bg-amber-500',
    title: 'text-amber-700',
  },
  slate: {
    card: 'border-slate-200 bg-gradient-to-br from-slate-50 to-white',
    dot: 'bg-slate-500',
    title: 'text-slate-700',
  },
};

const SectionCard = ({ title, items, tone = 'sky', mono = false }) => {
  const style = toneStyles[tone] || toneStyles.sky;
  const list = safeList(items);

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${style.card}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className={`text-sm sm:text-base font-semibold ${style.title}`}>{title}</h4>
      </div>
      {list.length === 0 ? (
        <p className="text-xs sm:text-sm text-gray-500">No data available.</p>
      ) : (
        <ul className={`space-y-2 ${mono ? 'font-mono text-xs sm:text-sm' : 'text-sm'}`}>
          {list.map((item, idx) => (
            <li key={`${title}-${idx}`} className="flex items-start gap-2 text-gray-700">
              <span className={`mt-2 h-1.5 w-1.5 rounded-full ${style.dot}`} />
              <span className="flex-1 leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const AiFeedbackPanel = ({ feedback }) => {
  const data = parseFeedback(feedback);

  if (!data) {
    return (
      <div className="text-sm sm:text-base text-gray-800 whitespace-pre-wrap leading-relaxed">
        {feedback || 'AI feedback is not available yet.'}
      </div>
    );
  }

  const summary = typeof data.summary === 'string' ? data.summary : '';
  const comparison = typeof data.comparison === 'string' ? data.comparison : '';

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-blue-600">Overall</p>
            <p className="text-sm sm:text-base font-semibold text-blue-900 leading-relaxed">
              {summary || 'Summary not available.'}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-blue-100 bg-white/70 px-3 py-1 text-xs text-blue-600">
            AI
          </div>
        </div>
        {comparison ? (
          <p className="mt-2 text-xs sm:text-sm text-gray-600 leading-relaxed">{comparison}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="Sections / Parts" items={data.sections} tone="sky" />
        <SectionCard title="Question Types" items={data.question_types} tone="emerald" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="Error Patterns" items={data.error_patterns} tone="rose" />
        <SectionCard title="Recommendations" items={data.recommendations} tone="indigo" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="Error Examples" items={data.error_examples} tone="slate" mono />
        <SectionCard title="Two-Week Plan" items={data.two_week_plan} tone="amber" />
      </div>
    </div>
  );
};

export default AiFeedbackPanel;