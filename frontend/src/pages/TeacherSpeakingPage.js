import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

const TeacherSpeakingPage = () => {
  const navigate = useNavigate();
  const role = localStorage.getItem('role');
  const isMentor = role === 'speaking_mentor';
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const loadStudents = async () => {
    setStudentsLoading(true);
    try {
      const response = await api.get('/teacher/speaking/students/');
      setStudents(response.data.students || []);
    } catch (error) {
      console.error('Error loading students:', error);
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedStudentId) {
        params.append('student_id', selectedStudentId);
      }
      params.append('completed', 'true');
      
      const response = await api.get(`/teacher/speaking/sessions/?${params.toString()}`);
      setSessions(response.data.sessions || []);
    } catch (error) {
      console.error('Error loading sessions:', error);
      setSessions([]);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadStudents(), loadSessions()]);
      setLoading(false);
    };
    
    loadData();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadSessions();
    }
  }, [selectedStudentId]);

  const filteredStudents = students.filter(student => 
    !searchTerm || 
    `${student.first_name} ${student.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.student_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStartNewSession = async (student) => {
    try {
      const response = await api.post('/teacher/speaking/sessions/', {
        student_id: student.student_id,
        completed: false
      });
      
      if (response.data.id) {
        navigate(`/teacher/speaking/session/${response.data.id}`);
      }
    } catch (error) {
      console.error('Error starting session:', error);
      alert('Error starting speaking session');
    }
  };

  const handleViewSession = (sessionId) => {
    navigate(`/teacher/speaking/session/${sessionId}`);
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-white to-indigo-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-indigo-600 bg-clip-text text-transparent">
                Speaking Assessment
              </h1>
            
            </div>
            <div className="mt-6 sm:mt-0 flex items-center space-x-4">
              <div className="bg-white px-4 py-2 rounded-lg shadow-sm border">
                <div className="text-sm text-gray-600">Total Students</div>
                <div className="text-2xl font-bold text-indigo-600">{students.length}</div>
              </div>
              <div className="bg-white px-4 py-2 rounded-lg shadow-sm border">
                <div className="text-sm text-gray-600">Completed Sessions</div>
                <div className="text-2xl font-bold text-green-600">{sessions.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Students Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 shadow-lg">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-white to-gray-50 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <div className="w-2 h-6 bg-gradient-to-b from-indigo-500 to-purple-600 rounded-full mr-3"></div>
                    {isMentor ? 'All Students' : 'My Students'}
                  </h3>
                  <div className="flex items-center space-x-4">
                    <input
                      type="text"
                      placeholder="Search students..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                {studentsLoading ? (
                  <LoadingSpinner text="Loading students..." />
                ) : filteredStudents.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredStudents.map((student) => (
                      <StudentCard
                        key={student.id}
                        student={student}
                        onStartNewSession={handleStartNewSession}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-500">
                      {searchTerm ? 'No students match your search' : 'No students assigned to you'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sessions History */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-lg">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-white to-gray-50 rounded-t-xl">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <div className="w-2 h-6 bg-gradient-to-b from-green-500 to-emerald-600 rounded-full mr-3"></div>
                  Recent Sessions
                </h3>
                <div className="mt-4">
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">All Students</option>
                    {students.map(student => (
                      <option key={student.id} value={student.student_id}>
                        {student.first_name} {student.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="p-6">
                {sessions.length > 0 ? (
                  <div className="space-y-3">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => handleViewSession(session.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">
                              {session.student_name}
                            </div>
                            {isMentor && (
                              <div className="text-xs text-gray-500">
                                Teacher: {session.teacher_name}
                              </div>
                            )}
                            <div className="text-sm text-gray-500">
                              {new Date(session.conducted_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-indigo-600">
                              {session.overall_band_score || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-500">Band Score</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 text-sm">No sessions yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StudentCard = ({ student, onStartNewSession }) => {
  return (
    <div className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 text-lg">
            {student.first_name} {student.last_name}
          </h4>
          <p className="text-sm text-gray-600 mt-1">
            ID: {student.student_id} | {student.group}
          </p>
          
        </div>
        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
          {student.first_name?.[0]}{student.last_name?.[0]}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-xl font-bold text-blue-600">{student.completed_sessions}</div>
          <div className="text-xs text-blue-700 font-medium">Completed</div>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-xl font-bold text-green-600">
            {student.latest_score || 'N/A'}
          </div>
          <div className="text-xs text-green-700 font-medium">Latest Score</div>
        </div>
      </div>
      
      {student.latest_date && (
        <p className="text-xs text-gray-500 mb-4">
          Last session: {new Date(student.latest_date).toLocaleDateString()}
        </p>
      )}
      
      <button
        onClick={() => onStartNewSession(student)}
        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        <span>New Speaking Session</span>
      </button>
    </div>
  );
};

export default TeacherSpeakingPage;
