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
  MoreHorizontal,
  ChevronDown
} from 'lucide-react';

export default function Sidebar({ role, setRole }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isExpanded, setIsExpanded } = useSidebar();
  const [userInfo, setUserInfo] = useState(null);
  const [openGroups, setOpenGroups] = useState({});

  const isActivePage = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    
    if (path === '/listening') {
      return location.pathname === '/listening' || location.pathname.startsWith('/listening/');
    }
    
    if (path === '/reading') {
      return location.pathname === '/reading' || location.pathname.startsWith('/reading/');
    }
    
    if (path === '/writing') {
      return location.pathname === '/writing' || location.pathname.startsWith('/writing/');
    }
    
    if (path.startsWith('/admin/')) {
      return location.pathname === path || location.pathname.startsWith(path + '/');
    }
    
    if (path.startsWith('/teacher/')) {
      return location.pathname === path || location.pathname.startsWith(path + '/');
    }
    
    if (path.startsWith('/curator/')) {
      return location.pathname === path || location.pathname.startsWith(path + '/');
    }
    
    return location.pathname === path;
  };

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await api.get('/user/profile/');
        setUserInfo(response.data);
      } catch (error) {
        console.error('Error fetching user info:', error);
      }
    };

    if (role) {
      fetchUserInfo();
    }
  }, [role]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('uid');
    localStorage.removeItem('role');
    setRole(null);
    navigate('/login');
  };

  const studentLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: () => <LayoutDashboard className="w-6 h-6" /> },
    { to: '/listening', label: 'Listening', icon: () => <Headphones className="w-6 h-6" /> },
    { to: '/reading', label: 'Reading', icon: () => <BookOpen className="w-6 h-6" /> },
    { to: '/writing', label: 'Writing', icon: () => <PenTool className="w-6 h-6" /> },
    { to: '/speaking/sessions', label: 'Speaking Results', icon: () => <Mic className="w-6 h-6" /> }
  ];

  const teacherLinks = [
    {
      type: 'group',
      label: 'Mock Tests',
      items: [
        { to: '/listening', label: 'Listening', icon: () => <Headphones className="w-6 h-6" /> },
        { to: '/reading', label: 'Reading', icon: () => <BookOpen className="w-6 h-6" /> },
        { to: '/writing', label: 'Writing', icon: () => <PenTool className="w-6 h-6" /> }
      ]
    },
    {
      type: 'group',
      label: 'Assessment',
      items: [
        { to: '/teacher/writing', label: 'Writing Tasks', icon: () => <PenTool className="w-6 h-6" /> },
        { to: '/teacher/speaking', label: 'Speaking Assessment', icon: () => <Mic className="w-6 h-6" /> }
      ]
    },
    {
      type: 'group',
      label: 'Student Overview',
      items: [
        { to: '/curator/dashboard', label: 'Dashboard', icon: () => <LayoutDashboard className="w-6 h-6" /> },
        { to: '/curator/speaking', label: 'Speaking', icon: () => <Mic className="w-6 h-6" /> },
        { to: '/curator/diagnostic', label: 'Diagnostic', icon: () => <Target className="w-6 h-6" /> }
      ]
    }
  ];

  const adminLinks = [
    { to: '/admin/students', label: 'Students', icon: () => <Users className="w-6 h-6" /> },
    { to: '/admin/teachers', label: 'Teachers', icon: () => <UserCheck className="w-6 h-6" /> },
    { to: '/admin/curators', label: 'Curators', icon: () => <UserCheck className="w-6 h-6" /> },
    { to: '/admin/writing-tests', label: 'Writing Tests', icon: () => <FileText className="w-6 h-6" /> },
    { to: '/admin/listening', label: 'Listening Tests', icon: () => <Headphones className="w-6 h-6" /> },
    { to: '/admin/reading', label: 'Reading Tests', icon: () => <BookOpen className="w-6 h-6" /> },
    { to: '/admin/placement-test-results', label: 'Placement Test', icon: () => <Target className="w-6 h-6" /> },
    { to: '/admin/teacher-survey-results', label: 'Surveys', icon: () => <MessageSquare className="w-6 h-6" /> },
    { to: '/admin/bulk-import', label: 'Import', icon: () => <Plus className="w-6 h-6" /> }
  ];

  const curatorLinks = [
    { to: '/curator/dashboard', label: 'Dashboard', icon: () => <LayoutDashboard className="w-6 h-6" /> },
    { to: '/curator/speaking', label: 'Speaking', icon: () => <Mic className="w-6 h-6" /> },
    { to: '/curator/test-comparison', label: 'Comparison', icon: () => <BarChart3 className="w-6 h-6" /> },
    { to: '/curator/diagnostic', label: 'Diagnostic', icon: () => <Target className="w-6 h-6" /> }
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
      className="hidden lg:flex h-screen fixed top-0 left-0 bg-white border-r transition-all duration-500 ease-in-out w-64"
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
            {getCurrentLinks().map((item, index) => {
              if (item.type === 'group') {
                const groupKey = item.label;
                const hasActiveItem = item.items.some(subItem => isActivePage(subItem.to));
                
                return (
                  <div key={groupKey} className="space-y-1">
                    <div 
                      onClick={() => setOpenGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                      className={`flex items-center px-3 py-3 rounded-lg cursor-pointer transition-all duration-200 ${
                        hasActiveItem ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center mr-3">
                        <FileText className="w-6 h-6" />
                      </span>
                      <span className="flex-1 whitespace-nowrap">{item.label}</span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${openGroups[groupKey] ? 'rotate-180' : ''}`} />
                    </div>
                    
                    {openGroups[groupKey] && (
                      <div className="ml-4 space-y-1 animate-fade-in">
                        {item.items.map(subItem => (
                          <NavLink
                            key={subItem.to}
                            to={subItem.to}
                            className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                              isActivePage(subItem.to)
                                ? 'bg-blue-100 text-blue-700 border-l-4 border-blue-600'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                          >
                            <span className="w-5 h-5 flex-shrink-0 mr-3">
                              {subItem.icon()}
                            </span>
                            <span className="text-sm whitespace-nowrap">{subItem.label}</span>
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => {
                    const isCurrentPage = isActivePage(item.to);
                    
                    return `flex items-center px-3 py-3 rounded-lg transition-all duration-200 min-w-0 h-12 ${
                      isCurrentPage
                        ? 'bg-blue-100 text-blue-700 border-l-4 border-blue-600 shadow-sm' 
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }`;
                  }}
                >
                  <span className={`${isActivePage(item.to) ? 'w-7 h-7' : 'w-6 h-6'} flex-shrink-0 flex items-center justify-center mr-3`}>
                    <div className="flex items-center justify-center">
                      {item.icon()}
                    </div>
                  </span>
                  <span className="transition-all duration-500 whitespace-nowrap opacity-100 w-auto">
                    {item.label}
                  </span>
                </NavLink>
              );
            })}
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
