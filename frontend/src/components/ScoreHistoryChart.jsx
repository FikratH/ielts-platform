import React, { useState, useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { Headphones, BookOpen, PenTool } from 'lucide-react';

const ScoreHistoryChart = ({ data }) => {
  const [filters, setFilters] = useState({
    listening: false,
    reading: false,
    writing: false
  });

  // Process data for the chart
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Group by date and type
    const groupedByDate = {};
    
    data.forEach(item => {
      const date = new Date(item.date).toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short',
        year: '2-digit'
      });
      
      if (!groupedByDate[date]) {
        groupedByDate[date] = {
          date,
          fullDate: item.date
        };
      }
      
      groupedByDate[date][item.type] = item.band_score;
    });

    // Convert to array and sort by date
    const chartArray = Object.values(groupedByDate).sort((a, b) => 
      new Date(a.fullDate) - new Date(b.fullDate)
    );

    // Calculate average for each point if no filters selected
    const anyFilterActive = filters.listening || filters.reading || filters.writing;
    
    if (!anyFilterActive) {
      chartArray.forEach(point => {
        const scores = [];
        if (point.listening) scores.push(point.listening);
        if (point.reading) scores.push(point.reading);
        if (point.writing) scores.push(point.writing);
        
        if (scores.length > 0) {
          point.average = scores.reduce((a, b) => a + b, 0) / scores.length;
        }
      });
    }

    return chartArray;
  }, [data, filters]);

  // Check if user has tests of each type
  const hasTestType = useMemo(() => {
    return {
      listening: data?.some(item => item.type === 'listening'),
      reading: data?.some(item => item.type === 'reading'),
      writing: data?.some(item => item.type === 'writing')
    };
  }, [data]);

  const toggleFilter = (type) => {
    setFilters(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const anyFilterActive = filters.listening || filters.reading || filters.writing;

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-sm font-medium">
              {entry.name}: {entry.value?.toFixed(1)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (!data || data.length === 0) {
    return (
      <div className="p-3 sm:p-4 md:p-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg sm:rounded-xl">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Score Progress Over Time</h3>
        <div className="text-center py-8 sm:py-12 text-gray-500">
          <p className="text-sm sm:text-base">No test history available yet.</p>
          <p className="text-xs sm:text-sm mt-2">Complete some tests to see your progress!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg sm:rounded-xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 gap-3">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900">Score Progress Over Time</h3>
        
        {/* Filter checkboxes */}
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <label className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg cursor-pointer transition-all ${
            hasTestType.listening 
              ? 'bg-white hover:bg-blue-50 border border-blue-200' 
              : 'bg-gray-100 border border-gray-200 opacity-50 cursor-not-allowed'
          }`}>
            <input
              type="checkbox"
              checked={filters.listening}
              onChange={() => toggleFilter('listening')}
              disabled={!hasTestType.listening}
              className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <Headphones className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
            <span className="text-xs sm:text-sm font-medium text-gray-700">Listening</span>
          </label>

          <label className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg cursor-pointer transition-all ${
            hasTestType.reading 
              ? 'bg-white hover:bg-emerald-50 border border-emerald-200' 
              : 'bg-gray-100 border border-gray-200 opacity-50 cursor-not-allowed'
          }`}>
            <input
              type="checkbox"
              checked={filters.reading}
              onChange={() => toggleFilter('reading')}
              disabled={!hasTestType.reading}
              className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-600 rounded focus:ring-emerald-500"
            />
            <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-600" />
            <span className="text-xs sm:text-sm font-medium text-gray-700">Reading</span>
          </label>

          <label className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg cursor-pointer transition-all ${
            hasTestType.writing 
              ? 'bg-white hover:bg-purple-50 border border-purple-200' 
              : 'bg-gray-100 border border-gray-200 opacity-50 cursor-not-allowed'
          }`}>
            <input
              type="checkbox"
              checked={filters.writing}
              onChange={() => toggleFilter('writing')}
              disabled={!hasTestType.writing}
              className="w-3 h-3 sm:w-4 sm:h-4 text-purple-600 rounded focus:ring-purple-500"
            />
            <PenTool className="w-3 h-3 sm:w-4 sm:h-4 text-purple-600" />
            <span className="text-xs sm:text-sm font-medium text-gray-700">Writing</span>
          </label>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200} className="sm:h-[240px] md:h-[280px]">
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 10 }}
            stroke="#666"
            interval="preserveStartEnd"
          />
          <YAxis 
            domain={[0, 9]} 
            ticks={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]}
            tick={{ fontSize: 10 }}
            stroke="#666"
            label={{ value: 'Band Score', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
            iconType="line"
          />
          
          {!anyFilterActive && (
            <Line 
              type="monotone" 
              dataKey="average" 
              stroke="#059669" 
              strokeWidth={3}
              name="Score"
              dot={{ fill: '#059669', r: 4 }}
              activeDot={{ r: 6 }}
            />
          )}
          
          {(anyFilterActive && filters.listening) && (
            <Line 
              type="monotone" 
              dataKey="listening" 
              stroke="#2563EB" 
              strokeWidth={2.5}
              name="Listening"
              dot={{ fill: '#2563EB', r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          )}
          
          {(anyFilterActive && filters.reading) && (
            <Line 
              type="monotone" 
              dataKey="reading" 
              stroke="#059669" 
              strokeWidth={2.5}
              name="Reading"
              dot={{ fill: '#059669', r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          )}
          
          {(anyFilterActive && filters.writing) && (
            <Line 
              type="monotone" 
              dataKey="writing" 
              stroke="#7C3AED" 
              strokeWidth={2.5}
              name="Writing"
              dot={{ fill: '#7C3AED', r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* Info text */}
      <p className="text-[10px] sm:text-xs text-gray-600 mt-2 sm:mt-3 text-center">
        {anyFilterActive 
          ? 'Showing selected test types over time' 
          : 'Showing average score across all test types'}
      </p>
    </div>
  );
};

export default ScoreHistoryChart;

