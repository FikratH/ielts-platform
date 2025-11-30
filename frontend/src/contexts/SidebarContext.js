import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SidebarContext = createContext();

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

export const SidebarProvider = ({ children }) => {
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(true); // Always expanded

  useEffect(() => {
    // Temporarily disabled auto-expand/collapse
    // const isDashboard = location.pathname === '/dashboard' || location.pathname === '/';
    // setIsExpanded(isDashboard);
    setIsExpanded(true); // Always keep expanded
  }, [location.pathname]);

  const value = {
    isExpanded,
    setIsExpanded
  };

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
};
