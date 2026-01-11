import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { 
  Home, 
  Headphones, 
  BookOpen, 
  PenTool, 
  Mic, 
  LogOut,
  LayoutDashboard,
  Users,
  UserCheck,
  Target,
  BarChart3
} from 'lucide-react';

const BottomNavigation = ({ role, setRole }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('uid');
    localStorage.removeItem('role');
    setRole(null);
    navigate('/login');
  };

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
    if (path === '/speaking/sessions') {
      return location.pathname.startsWith('/speaking/');
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

  const studentNavItems = [
    { to: '/dashboard', label: 'Home', icon: Home },
    { to: '/listening', label: 'Listening', icon: Headphones },
    { to: '/reading', label: 'Reading', icon: BookOpen },
    { to: '/writing', label: 'Writing', icon: PenTool },
    { to: '/speaking/sessions', label: 'Speaking', icon: Mic },
  ];

  const teacherNavItems = [
    { to: '/curator/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/teacher/writing', label: 'Writing', icon: PenTool },
    { to: '/teacher/speaking', label: 'Speaking', icon: Mic },
    { to: '/curator/speaking', label: 'Students', icon: Users },
  ];

  const curatorNavItems = [
    { to: '/curator/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/curator/speaking', label: 'Speaking', icon: Mic },
    { to: '/curator/test-comparison', label: 'Compare', icon: BarChart3 },
    { to: '/curator/diagnostic', label: 'Diagnostic', icon: Target },
  ];

  const adminNavItems = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/students', label: 'Students', icon: Users },
    { to: '/admin/teachers', label: 'Teachers', icon: UserCheck },
    { to: '/admin/listening', label: 'Tests', icon: Headphones },
  ];

  const isTeacherRole = role === 'teacher' || role === 'speaking_mentor';

  const getNavItems = () => {
    if (role === 'admin') return adminNavItems;
    if (isTeacherRole) return teacherNavItems;
    if (role === 'curator') return curatorNavItems;
    return studentNavItems;
  };

  const navItems = getNavItems();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="flex items-center justify-around px-2 py-2 max-w-screen-xl mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = isActivePage(item.to);
          
          return (
            <button
              key={item.to}
              onClick={() => navigate(item.to)}
              className={`flex flex-col items-center justify-center px-3 py-2 rounded-xl transition-all duration-200 min-w-0 flex-1 ${
                isActive 
                  ? 'text-blue-600' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className={`${isActive ? 'w-6 h-6' : 'w-5 h-5'} transition-all duration-200`} />
              <span className={`text-[10px] mt-1 font-medium transition-all duration-200 ${
                isActive ? 'opacity-100' : 'opacity-70'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
        
        <button
          onClick={handleLogout}
          className="flex flex-col items-center justify-center px-3 py-2 rounded-xl transition-all duration-200 min-w-0 flex-1 text-red-500 hover:text-red-600 hover:bg-red-50"
        >
          <LogOut className="w-5 h-5 transition-all duration-200" />
          <span className="text-[10px] mt-1 font-medium opacity-90">
            Logout
          </span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNavigation;

