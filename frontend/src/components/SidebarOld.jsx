import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useSidebar } from '../contexts/SidebarContext';
import api from '../api';
import { 
  LayoutDashboard, 
  Headphones, 
  BookOpen, 
  PenTool, 
  Mic, 
  Users, 
  Settings, 
  BarChart3,
  FileText,
  UserCheck,
  MessageSquare,
  Calendar,
  Clock,
  Award,
  Target,
  Plus,
  MoreHorizontal
} from 'lucide-react';

export default function Sidebar({ role, setRole }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isExpanded, setIsExpanded } = useSidebar();
  const [userInfo, setUserInfo] = useState(null);

  // Улучшенная функция для определения активной страницы
  const isActivePage = (path) => {
    // Dashboard - специальный случай
    if (path === '/dashboard') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    
    // Для остальных страниц - точное совпадение или начало пути
    if (path === '/listening') {
      return location.pathname === '/listening' || location.pathname.startsWith('/listening/');
    }
    
    if (path === '/reading') {
      return location.pathname === '/reading' || location.pathname.startsWith('/reading/');
    }
    
    if (path === '/writing') {
      return location.pathname === '/writing' || location.pathname.startsWith('/writing/');
    }
    
    // Для админских страниц
    if (path.startsWith('/admin/')) {
      return location.pathname === path || location.pathname.startsWith(path + '/');
    }
    
    // Для учительских страниц
    if (path.startsWith('/teacher/')) {
      return location.pathname === path || location.pathname.startsWith(path + '/');
    }
    
    // По умолчанию - точное совпадение
    return location.pathname === path;
  };

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        // Используем API endpoint для получения профиля пользователя
        const userRes = await api.get('/user/profile/');
        setUserInfo(userRes.data);
      } catch (err) {
        console.error('Error loading user profile:', err);
        // Fallback: используем данные из localStorage
        const uid = localStorage.getItem('uid');
        const studentId = localStorage.getItem('student_id');
        const userRole = localStorage.getItem('role');
        const firstName = localStorage.getItem('first_name');
        const lastName = localStorage.getItem('last_name');
        const group = localStorage.getItem('group');
        
        if (uid && studentId) {
          setUserInfo({
            first_name: firstName || (studentId ? `Student ${studentId}` : 'Student'),
            last_name: lastName || '',
            uid: uid,
            student_id: studentId,
            role: userRole,
            group: group
          });
        } else {
          setUserInfo({ first_name: 'Student', role: 'student' });
        }
      }
    };

    if (role) {
      fetchUserProfile();
    }
  }, [role]);

  const handleMouseEnter = () => {
    if (location.pathname !== '/dashboard' && location.pathname !== '/') {
      setIsExpanded(true);
    }
  };

  const handleMouseLeave = () => {
    if (location.pathname !== '/dashboard' && location.pathname !== '/') {
      setIsExpanded(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('uid');
    localStorage.removeItem('role');
    setRole(null);
    navigate('/login');
  };

  const studentLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h2a2 2 0 002 2v6H8V5z" />
      </svg>
    )},
    { to: '/listening', label: 'Listening', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 9H4a1 1 0 00-1 1v4a1 1 0 001 1h1.586l4.707 4.707C10.923 20.337 12 19.907 12 19V5c0-.907-1.077-1.337-1.707-.707L5.586 9z" />
      </svg>
    )},
    { to: '/reading', label: 'Reading', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    )},
    { to: '/writing', label: 'Writing', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    )},
    { to: '/speaking/sessions', label: 'Speaking Results', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    )}
  ];

  const teacherLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: () => <LayoutDashboard className="w-6 h-6" /> },
    { to: '/listening', label: 'Listening', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 9H4a1 1 0 00-1 1v4a1 1 0 001 1h1.586l4.707 4.707C10.923 20.337 12 19.907 12 19V5c0-.907-1.077-1.337-1.707-.707L5.586 9z" />
      </svg>
    )},
    { to: '/reading', label: 'Reading', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    )},
    { to: '/writing', label: 'Writing', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    )},
    { to: '/teacher/writing', label: 'Writing Tasks', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )},
    { to: '/teacher/speaking', label: 'Speaking Assessment', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    )}
  ];

  const curatorLinks = [
    { to: '/curator/dashboard', label: 'Curator', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
      </svg>
    )},
    { to: '/curator/students', label: 'Students', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5V4H2v16h5m10 0V10m0 10H7m10 0l-3-3m3 3l3-3" />
      </svg>
    )},
    { to: '/curator/writing', label: 'Writing', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    )},
    { to: '/curator/listening', label: 'Listening', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 9H4a1 1 0 00-1 1v4a1 1 0 001 1h1.586l4.707 4.707C10.923 20.337 12 19.907 12 19V5c0-.907-1.077-1.337-1.707-.707L5.586 9z" />
      </svg>
    )},
    { to: '/curator/reading', label: 'Reading', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    )},
    { to: '/curator/speaking', label: 'Speaking', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    )},
    { to: '/curator/test-comparison', label: 'Test Comparison', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )}
  ];

  const adminLinks = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h2a2 2 0 012 2v6H8V5z" />
      </svg>
    )},
    { to: '/admin/users', label: 'Users', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
      </svg>
    )},
    { to: '/admin/students', label: 'Students', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5V4H2v16h5m10 0V10m0 10H7m10 0l-3-3m3 3l3-3" />
      </svg>
    )},
    { to: '/admin/teachers', label: 'Teachers', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )},
    { to: '/admin/curators', label: 'Curators', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )},
    { to: '/admin/bulk-import', label: 'Bulk Import', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
      </svg>
    )},
    { to: '/admin/student-results', label: 'Student Results', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )},
    { to: '/admin/teacher-survey-results', label: 'Teacher Surveys', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )},
    { to: '/admin/writing-tests', label: 'Writing', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    )},
    { to: '/admin/listening', label: 'Listening', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 9H4a1 1 0 00-1 1v4a1 1 0 001 1h1.586l4.707 4.707C10.923 20.337 12 19.907 12 19V5c0-.907-1.077-1.337-1.707-.707L5.586 9z" />
      </svg>
    )},
    { to: '/admin/reading', label: 'Reading', icon: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    )}
  ];

  const isTeacherRole = role === 'teacher' || role === 'speaking_mentor';

  const getCurrentLinks = () => {
    if (role === 'admin') return adminLinks;
    if (isTeacherRole) return teacherLinks;
    if (role === 'curator') return curatorLinks;
    return studentLinks;
  };

  const getInitials = () => {
    if (!userInfo) return 'S';
    const firstName = userInfo.first_name || '';
    
    // Если имя содержит Student + число, берем S + число
    if (firstName.startsWith('Student ')) {
      const number = firstName.split(' ')[1];
      return number ? `S${number.charAt(0)}` : 'S';
    }
    
    // Иначе берем первую букву имени
    return firstName.charAt(0)?.toUpperCase() || 'S';
  };

  const getFullName = () => {
    if (!userInfo) return 'Student';
    const first = userInfo.first_name || userInfo.firstName || '';
    const last = userInfo.last_name || userInfo.lastName || '';
    const name = `${first} ${last}`.trim();
    return name || userInfo.username || userInfo.email || 'Student';
  };

  const getRoleLabel = () => {
    if (!role) return 'Student';
    return role.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  };

  return (
    <aside 
      className={`hidden lg:flex h-screen fixed top-0 left-0 bg-white border-r transition-all duration-500 ease-in-out w-64`}
      // Temporarily disabled mouse hover handlers
      // onMouseEnter={handleMouseEnter}
      // onMouseLeave={handleMouseLeave}
    >
      <div className="flex flex-col w-full overflow-hidden">
        {/* Logo Section */}
        <div className="flex-shrink-0 p-6">
          <div className="flex items-center min-w-0">
            <img src="/masteredlogo-ico.ico" alt="Master Education" className="w-8 h-8 rounded flex-shrink-0" />
            <div className="ml-3 leading-tight select-none transition-all duration-500 opacity-100 w-auto">
              <div className="text-[15px] font-semibold text-gray-900 whitespace-nowrap">Master Education</div>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
          <nav className="flex flex-col flex-1 overflow-y-auto scrollbar-hide px-6">
          <div className="space-y-2 pb-4">
            {getCurrentLinks().map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => {
                  const isCurrentPage = isActivePage(to);
                  
                  return `flex items-center px-3 py-3 rounded-lg transition-all duration-200 min-w-0 h-12 ${
                    isCurrentPage
                      ? 'bg-blue-100 text-blue-700 border-l-4 border-blue-600 shadow-sm' 
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`;
                }}
              >
                <span className={`${isActivePage(to) ? 'w-7 h-7' : 'w-6 h-6'} flex-shrink-0 flex items-center justify-center mr-3`}>
                  <div className="flex items-center justify-center">
                    {icon()}
                  </div>
                </span>
                <span className="transition-all duration-500 whitespace-nowrap opacity-100 w-auto">
                  {label}
                </span>
              </NavLink>
            ))}
          </div>
        </nav>
        
        {/* User Profile */}
        <div className="border-t flex-shrink-0 p-6">
          <div className="flex items-center min-w-0">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
              {getInitials()}
            </div>
            <div className="ml-3 transition-all duration-500 opacity-100 w-auto">
              <div className="text-sm font-medium text-gray-900 whitespace-nowrap">
                {userInfo?.first_name || 'Student'}
              </div>
              <div className="text-xs text-gray-500 whitespace-nowrap">
                {getRoleLabel()}
              </div>
              {userInfo?.group && (
                <div className="text-xs text-gray-500 whitespace-nowrap">Group {userInfo.group}</div>
              )}
            </div>
          </div>
          
          {/* Logout Button */}
          <div className="transition-all duration-500 opacity-100 h-auto mt-3">
            <button 
              onClick={handleLogout}
              className="w-full bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function SidebarDesktop() {
  return <Sidebar />;
}

export function SidebarMobile({ open, onClose, role, setRole }) {
  if (!open) return null;
  
  return (
    <div className="lg:hidden fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute top-0 left-0 w-64 h-full bg-white border-r p-6">
        <Sidebar role={role} setRole={setRole} />
      </div>
    </div>
  );
}
