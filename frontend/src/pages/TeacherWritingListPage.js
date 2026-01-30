import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

const TeacherWritingListPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    prompt_id: '',
    task_type: '',
    group: '',
    student_id: '',
    published: '',
    search: '',
    feedback_status: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
      const res = await api.get(`/teacher/writing/essays/?${params.toString()}`);
      setItems(res.data);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, []);

  const onFilterChange = (e) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const applyFilters = () => loadData();

  // Group by test_session for session-centric view
  const sessionsMap = new Map();
  items.forEach(item => {
    const sid = item.test_session?.id || item.test_session_id || `essay-${item.id}`;
    if (!sessionsMap.has(sid)) sessionsMap.set(sid, []);
    sessionsMap.get(sid).push(item);
  });
  const sessions = Array.from(sessionsMap.entries()).map(([sid, essays]) => ({ sid, essays }));

  // Statistics based on sessions
  const totalEssays = items.length;
  const publishedCount = items.filter(item => item.teacher_feedback && item.teacher_feedback.published).length;
  const draftCount = totalEssays - publishedCount;
  const uniqueStudents = new Set(items.map(item => item.user?.student_id)).size;

  if (loading) return <LoadingSpinner fullScreen text="Loading..." />;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-white to-purple-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-purple-600 bg-clip-text text-transparent">
                Writing Tasks
              </h1>
             
            </div>
            <div className="mt-6 sm:mt-0 flex items-center space-x-4">
              <div className="bg-white px-4 py-2 rounded-lg shadow-sm border">
                <div className="text-sm text-gray-600">Total Essays</div>
                <div className="text-2xl font-bold text-purple-600">{totalEssays}</div>
              </div>
              <div className="bg-white px-4 py-2 rounded-lg shadow-sm border">
                <div className="text-sm text-gray-600">Students</div>
                <div className="text-2xl font-bold text-blue-600">{uniqueStudents}</div>
              </div>
              <div className="bg-white px-4 py-2 rounded-lg shadow-sm border">
                <div className="text-sm text-gray-600">Published</div>
                <div className="text-2xl font-bold text-green-600">{publishedCount}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-lg mb-8">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-white to-gray-50 rounded-t-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <div className="w-2 h-6 bg-gradient-to-b from-purple-500 to-indigo-600 rounded-full mr-3"></div>
                Filters
              </h3>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg 
                  className={`w-5 h-5 transition-transform ${showFilters ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
          
          {showFilters && (
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-4">
                <input 
                  name="search" 
                  value={filters.search} 
                  onChange={onFilterChange} 
                  placeholder="Name / ID / Email" 
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <input 
                  name="prompt_id" 
                  value={filters.prompt_id} 
                  onChange={onFilterChange} 
                  placeholder="Task  ID" 
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <select 
                  name="task_type" 
                  value={filters.task_type} 
                  onChange={onFilterChange} 
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">All Task Types</option>
          <option value="task1">Task 1</option>
          <option value="task2">Task 2</option>
        </select>
                <input 
                  name="group" 
                  value={filters.group} 
                  onChange={onFilterChange} 
                  placeholder="Group" 
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <input 
                  name="student_id" 
                  value={filters.student_id} 
                  onChange={onFilterChange} 
                  placeholder="Student ID" 
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <select 
                  name="published" 
                  value={filters.published} 
                  onChange={onFilterChange} 
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">All Status</option>
          <option value="true">Published</option>
          <option value="false">Draft</option>
        </select>
                <select 
                  name="feedback_status" 
                  value={filters.feedback_status} 
                  onChange={onFilterChange} 
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">All Feedback</option>
                  <option value="with">With Feedback</option>
                  <option value="without">No Feedback</option>
                </select>
              </div>
              <div className="flex justify-end">
                <button 
                  onClick={applyFilters} 
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Apply Filters
                </button>
        </div>
            </div>
          )}
        </div>

        {/* Essays List */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-lg">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-white to-gray-50 rounded-t-xl">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <div className="w-2 h-6 bg-gradient-to-b from-purple-500 to-indigo-600 rounded-full mr-3"></div>
              Student Essays
            </h3>
      </div>

          <div className="p-6">
            {sessions.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {sessions.map(({ sid, essays }) => (
                  <SessionCard
                    key={sid}
                    sid={sid}
                    essays={essays}
                    onOpen={() => {
                      const sessionId = essays[0]?.test_session?.id || essays[0]?.test_session_id;
                      if (sessionId && !String(sid).startsWith('essay-')) navigate(`/teacher/writing/session/${sessionId}`);
                      else navigate(`/teacher/writing/${essays[0].id}`);
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-500">No essays found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const SessionCard = ({ sid, essays, onOpen }) => {
  const [task1] = essays.filter(e => e.task_type === 'task1');
  const [task2] = essays.filter(e => e.task_type === 'task2');
  const first = task1 || task2 || essays[0];
  const publishedFlags = essays.map(e => Boolean(e.teacher_feedback && e.teacher_feedback.published));
  const publishedCount = publishedFlags.filter(Boolean).length;
  const isPublished = publishedCount === essays.length && essays.length > 0;
  const isPartial = publishedCount > 0 && publishedCount < essays.length;
  
  return (
    <div className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 text-lg">
            {first.user?.first_name} {first.user?.last_name}
          </h4>
          <p className="text-sm text-gray-600 mt-1">
            ID: {first.user?.student_id} | Group: {first.user?.group || 'N/A'}
          </p>

        </div>
        <div className="flex items-center space-x-3">
          {task1 && (
            <div className={'px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 flex items-center gap-2'}>
              <span>TASK 1</span>
              <span className={`px-2 py-0.5 rounded ${task1.teacher_feedback?.published ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>
                {task1.teacher_feedback?.published ? 'Published' : 'Draft'}
              </span>
            </div>
          )}
          {task2 && (
            <div className={'px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 flex items-center gap-2'}>
              <span>TASK 2</span>
              <span className={`px-2 py-0.5 rounded ${task2.teacher_feedback?.published ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>
                {task2.teacher_feedback?.published ? 'Published' : 'Draft'}
              </span>
            </div>
          )}
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
            {first.user?.first_name?.[0]}{first.user?.last_name?.[0]}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-sm text-blue-700 font-medium">Submitted</div>
          <div className="text-xs text-blue-600 mt-1">
            {first.submitted_at ? new Date(first.submitted_at).toLocaleDateString() : 'Not submitted'}
          </div>
        </div>
        <div className={`text-center p-3 rounded-lg ${
          isPublished ? 'bg-green-50' : (isPartial ? 'bg-blue-50' : 'bg-yellow-50')
        }`}>
          <div className={`text-sm font-medium ${
            isPublished ? 'text-green-700' : (isPartial ? 'text-blue-700' : 'text-yellow-700')
          }`}>
            Status
          </div>
          <div className={`text-xs mt-1 ${
            isPublished ? 'text-green-600' : (isPartial ? 'text-blue-600' : 'text-yellow-600')
          }`}>
            {isPublished ? 'Published' : (isPartial ? `Partial (${publishedCount}/${essays.length})` : 'Draft')}
          </div>
        </div>
        {first.overall_band && (
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-sm text-purple-700 font-medium">Band Score</div>
            <div className="text-lg font-bold text-purple-600">{first.overall_band}</div>
          </div>
        )}
      </div>
      
      <button
        onClick={onOpen}
        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        <span>Review Session</span>
      </button>
    </div>
  );
};

export default TeacherWritingListPage;





