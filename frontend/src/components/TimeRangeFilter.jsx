import React, { useMemo } from 'react';

const PRESETS = [
  { key: 'last_2_weeks', label: 'Last 2 weeks' },
  { key: 'last_month', label: 'Last month' },
  { key: 'last_3_months', label: 'Last 3 months' },
  { key: 'custom', label: 'Custom range' }
];

const toDateString = (date) => {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 10);
};

const computePresetRange = (key) => {
  const now = new Date();
  const end = toDateString(now);
  const start = new Date(now);
  if (key === 'last_month') {
    start.setMonth(start.getMonth() - 1);
  } else if (key === 'last_3_months') {
    start.setMonth(start.getMonth() - 3);
  } else {
    start.setDate(start.getDate() - 14);
  }
  return {
    date_from: toDateString(start),
    date_to: end
  };
};

const TimeRangeFilter = ({ value = {}, onChange }) => {
  const selectedKey = value.label || 'last_2_weeks';
  const presetRange = useMemo(() => computePresetRange(selectedKey), [selectedKey]);

  const handlePresetChange = (event) => {
    const newKey = event.target.value;
    const payload =
      newKey === 'custom'
        ? { label: 'custom', date_from: value.date_from || '', date_to: value.date_to || '' }
        : { ...computePresetRange(newKey), label: newKey };
    onChange(payload);
  };

  const handleDateChange = (field) => (event) => {
    onChange({
      label: 'custom',
      date_from: field === 'date_from' ? event.target.value : (value.date_from || ''),
      date_to: field === 'date_to' ? event.target.value : (value.date_to || '')
    });
  };

  const showCustom = selectedKey === 'custom';

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-gray-500 uppercase">Period</label>
      <div className="flex gap-2 flex-wrap">
        <select
          value={selectedKey}
          onChange={handlePresetChange}
          className="border rounded px-2 py-1 text-sm bg-white"
        >
          {PRESETS.map((preset) => (
            <option key={preset.key} value={preset.key}>
              {preset.label}
            </option>
          ))}
        </select>
        {showCustom && (
          <div className="flex gap-2">
            <input
              type="date"
              value={value.date_from || presetRange.date_from}
              onChange={handleDateChange('date_from')}
              className="border rounded px-2 py-1 text-sm"
            />
            <input
              type="date"
              value={value.date_to || presetRange.date_to}
              onChange={handleDateChange('date_to')}
              className="border rounded px-2 py-1 text-sm"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default TimeRangeFilter;




