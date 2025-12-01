import React, { useEffect, useState } from 'react';
import api from '../api';
import TimeRangeFilter from './TimeRangeFilter';

const GroupsRankingWidget = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState({ label: 'all_time', date_from: '', date_to: '' });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const params = {};
        if (timeRange?.date_from) params.date_from = timeRange.date_from;
        if (timeRange?.date_to) params.date_to = timeRange.date_to;
        const res = await api.get('/curator/groups-ranking/', { params });
        setData(res.data.groups || []);
      } catch (e) {
        setError('Failed to load groups ranking');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [timeRange?.date_from, timeRange?.date_to]);

  const formatBand = (band) => {
    if (band === null || band === undefined) return '-';
    return band.toFixed(1);
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Groups Ranking</h3>
          <p className="text-sm text-gray-500">Ranking by overall results</p>
        </div>
        <div className="w-48">
          <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
        </div>
      </div>

      {loading && <div className="text-sm text-gray-500">Loading...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {!loading && !error && data.length === 0 && (
        <div className="text-sm text-gray-500">No groups found.</div>
      )}
      
      {!loading && !error && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 font-semibold">Rank</th>
                <th className="text-left py-2 px-3 font-semibold">Group</th>
                <th className="text-right py-2 px-3 font-semibold">Students</th>
                <th className="text-right py-2 px-3 font-semibold">Avg Listening</th>
                <th className="text-right py-2 px-3 font-semibold">Avg Reading</th>
                <th className="text-right py-2 px-3 font-semibold">Avg Writing</th>
                <th className="text-right py-2 px-3 font-semibold">Avg Overall</th>
              </tr>
            </thead>
            <tbody>
              {data.map((group, index) => (
                <tr key={group.group} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3">
                    <span className="font-medium text-gray-700">#{index + 1}</span>
                  </td>
                  <td className="py-2 px-3 font-medium">{group.group}</td>
                  <td className="py-2 px-3 text-right text-gray-600">{group.students_count}</td>
                  <td className="py-2 px-3 text-right">
                    <span className={group.avg_listening_band ? 'font-medium' : 'text-gray-400'}>
                      {formatBand(group.avg_listening_band)}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className={group.avg_reading_band ? 'font-medium' : 'text-gray-400'}>
                      {formatBand(group.avg_reading_band)}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className={group.avg_writing_teacher_band ? 'font-medium' : 'text-gray-400'}>
                      {formatBand(group.avg_writing_teacher_band)}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className={group.avg_overall_band ? 'font-bold text-blue-600' : 'text-gray-400'}>
                      {formatBand(group.avg_overall_band)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default GroupsRankingWidget;

