import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const Navbar = ({ role, setRole }) => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({});
    const isTeacherRole = role === 'teacher' || role === 'speaking_mentor';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('uid');
    localStorage.removeItem('role');
    setRole(null);
    navigate('/login');
  };

  const studentLinks = (
    <>
      <Link to="/listening" className="text-blue-800 font-medium hover:underline underline-offset-4 transition font-sans" onClick={() => setMenuOpen(false)}>Listening</Link>
      <Link to="/reading" className="text-blue-800 font-medium hover:underline underline-offset-4 transition font-sans" onClick={() => setMenuOpen(false)}>Reading</Link>
      <Link to="/writing/start" className="text-blue-800 font-medium hover:underline underline-offset-4 transition font-sans" onClick={() => setMenuOpen(false)}>Writing</Link>
      <Link to="/dashboard" className="text-blue-800 font-medium hover:underline underline-offset-4 transition font-sans" onClick={() => setMenuOpen(false)}>Dashboard</Link>
    </>
  );

  const toggleGroup = (groupName) => {
    setOpenGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const teacherLinks = (
    <>
      <div className="border-b pb-2 mb-2">
        <div 
          onClick={() => toggleGroup('mockTests')}
          className="flex items-center justify-between text-blue-800 font-semibold cursor-pointer py-2"
        >
          <span>Mock Tests</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${openGroups['mockTests'] ? 'rotate-180' : ''}`} />
        </div>
        {openGroups['mockTests'] && (
          <div className="ml-4 flex flex-col gap-2 mt-2">
            <Link to="/listening" className="text-blue-700 font-medium hover:underline" onClick={() => setMenuOpen(false)}>Listening</Link>
            <Link to="/reading" className="text-blue-700 font-medium hover:underline" onClick={() => setMenuOpen(false)}>Reading</Link>
            <Link to="/writing" className="text-blue-700 font-medium hover:underline" onClick={() => setMenuOpen(false)}>Writing</Link>
          </div>
        )}
      </div>

      <div className="border-b pb-2 mb-2">
        <div 
          onClick={() => toggleGroup('assessment')}
          className="flex items-center justify-between text-blue-800 font-semibold cursor-pointer py-2"
        >
          <span>Assessment</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${openGroups['assessment'] ? 'rotate-180' : ''}`} />
        </div>
        {openGroups['assessment'] && (
          <div className="ml-4 flex flex-col gap-2 mt-2">
            <Link to="/teacher/writing" className="text-blue-700 font-medium hover:underline" onClick={() => setMenuOpen(false)}>Writing Tasks</Link>
            <Link to="/teacher/speaking" className="text-blue-700 font-medium hover:underline" onClick={() => setMenuOpen(false)}>Speaking Assessment</Link>
          </div>
        )}
      </div>

      <div className="border-b pb-2 mb-2">
        <div 
          onClick={() => toggleGroup('studentOverview')}
          className="flex items-center justify-between text-blue-800 font-semibold cursor-pointer py-2"
        >
          <span>Student Overview</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${openGroups['studentOverview'] ? 'rotate-180' : ''}`} />
        </div>
        {openGroups['studentOverview'] && (
          <div className="ml-4 flex flex-col gap-2 mt-2">
            <Link to="/curator/dashboard" className="text-blue-700 font-medium hover:underline" onClick={() => setMenuOpen(false)}>Dashboard</Link>
            <Link to="/curator/speaking" className="text-blue-700 font-medium hover:underline" onClick={() => setMenuOpen(false)}>Speaking</Link>
            <Link to="/curator/test-comparison" className="text-blue-700 font-medium hover:underline" onClick={() => setMenuOpen(false)}>Comparison</Link>
            <Link to="/curator/diagnostic" className="text-blue-700 font-medium hover:underline" onClick={() => setMenuOpen(false)}>Diagnostic</Link>
          </div>
        )}
      </div>
    </>
  );

  const adminLinks = (
    <>
      <Link to="/admin/students" className="text-blue-800 font-medium hover:underline underline-offset-4 transition font-sans" onClick={() => setMenuOpen(false)}>Students</Link>
      <Link to="/admin/teachers" className="text-blue-800 font-medium hover:underline underline-offset-4 transition font-sans" onClick={() => setMenuOpen(false)}>Teachers</Link>
      <Link to="/admin/bulk-import" className="text-blue-800 font-medium hover:underline underline-offset-4 transition font-sans" onClick={() => setMenuOpen(false)}>Bulk Import</Link>
      <Link to="/admin/dashboard" className="text-blue-800 font-medium hover:underline underline-offset-4 transition font-sans" onClick={() => setMenuOpen(false)}>Dashboard</Link>
      <Link to="/admin/student-results" className="text-blue-800 font-medium hover:underline underline-offset-4 transition font-sans" onClick={() => setMenuOpen(false)}>Student Results</Link>
      <Link to="/admin/teacher-survey-results" className="text-blue-800 font-medium hover:underline underline-offset-4 transition font-sans" onClick={() => setMenuOpen(false)}>Teacher Surveys</Link>
      <Link to="/admin/prompts" className="text-blue-800 font-medium hover:underline underline-offset-4 transition font-sans" onClick={() => setMenuOpen(false)}>Writing</Link>
      <Link to="/admin/listening" className="text-blue-800 font-medium hover:underline underline-offset-4 transition font-sans" onClick={() => setMenuOpen(false)}>Listening</Link>
      <Link to="/admin/reading" className="text-blue-800 font-medium hover:underline underline-offset-4 transition font-sans" onClick={() => setMenuOpen(false)}>Reading</Link>
    </>
  );

  return (
    <nav className="bg-white shadow-md border-b sticky top-0 z-50 font-sans">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-3 flex justify-between items-center">
        <Link to={!role ? '/login' : (role === 'admin' ? '/admin/dashboard' : role === 'teacher' ? '/curator/dashboard' : role === 'speaking_mentor' ? '/teacher/speaking' : role === 'curator' ? '/curator/dashboard' : '/dashboard')} className="flex items-center gap-2 sm:gap-3">
          <img src="/logo.png" alt="Logo" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full shadow bg-white object-cover" />
          <span className="hidden sm:inline text-base sm:text-xl font-semibold text-blue-800 tracking-wide font-sans">Master Education</span>
        </Link>
        {/* Desktop menu */}
        <div className="hidden sm:flex items-center gap-6">
          {role === 'student' && studentLinks}
          {isTeacherRole && teacherLinks}
          {role === 'admin' && adminLinks}
          {role && (
            <button onClick={handleLogout} className="ml-4 bg-red-500 hover:bg-red-600 text-white font-bold px-5 py-2 rounded-xl shadow transition font-sans flex items-center gap-2">
              
              <span className="hidden sm:inline">Logout</span>
            </button>
          )}
        </div>
        {/* Mobile hamburger */}
        <div className="sm:hidden flex items-center">
          <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7 text-blue-800">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
      {/* Mobile menu dropdown */}
      {menuOpen && (
        <div className="sm:hidden bg-white border-t shadow-md px-4 py-3 flex flex-col gap-3 animate-fade-in-down">
          {role === 'student' && studentLinks}
          {isTeacherRole && teacherLinks}
          {role === 'admin' && adminLinks}
          {role && (
            <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white font-bold px-4 py-2 rounded-xl shadow transition font-sans flex items-center gap-2 w-full justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6A2.25 2.25 0 002.25 18.75V15M18 12l-3-3m3 3l-3 3m3-3H9" /></svg>
              Logout
            </button>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
