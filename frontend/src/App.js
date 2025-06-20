import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import EssaySubmitPage from './pages/EssaySubmitPage';
import Dashboard from './pages/Dashboard';
import EssayDetail from './pages/EssayDetail';
import ReadingTestListPage from './pages/ReadingTestListPage';
import ReadingTestPage from './pages/ReadingTestPage';
import ReadingResultPage from './pages/ReadingResultPage';
import WritingStartPage from './pages/WritingStartPage';
import WritingTaskPage from './pages/WritingTaskPage';
import WritingResultPage from './pages/WritingResultPage';
import WritingPromptsAdminPage from './pages/WritingPromptsAdminPage';
import Navbar from './components/Navbar';
import AdminAllAssignmentsPage from './pages/AdminAllAssignmentsPage';
import AdminReadingManagePage from './pages/AdminReadingManagePage';
import AdminAssignmentsPage from './pages/AdminAssignmentsPage';
import AdminDashboardPage from './pages/AdminDashboardPage';

// Компонент-обертка для страниц, требующих навигационной панели
const MainLayout = ({ role, setRole, children }) => {
  const location = useLocation();
  const noNavRoutes = ['/login'];

  if (noNavRoutes.includes(location.pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar role={role} setRole={setRole} />
      <main style={{ paddingTop: '80px', paddingLeft: '20px', paddingRight: '20px' }}>
        {children}
      </main>
    </>
  );
};

function App() {
  const [role, setRole] = useState(localStorage.getItem('role'));

  useEffect(() => {
    const handleStorageChange = () => {
      setRole(localStorage.getItem('role'));
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-storage', handleStorageChange); // For custom events
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage', handleStorageChange);
    }
  }, []);

  return (
    <Router>
      <MainLayout role={role} setRole={setRole}>
        <Routes>
          <Route path="/login" element={<LoginPage setRole={setRole} />} />
          <Route path="/" element={
            !role ? <Navigate to="/login" /> : 
            (role === 'admin' ? <Navigate to="/admin/dashboard" /> : <Navigate to="/dashboard" />)
          } />
          
          {/* Student Routes */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/essays/:id" element={<EssayDetail />} />
          <Route path="/reading" element={<ReadingTestListPage />} />
          <Route path="/reading-test/:id" element={<ReadingTestPage />} />
          <Route path="/reading-result/:sessionId" element={<ReadingResultPage />} />
          <Route path="/writing/start" element={<WritingStartPage />} />
          <Route path="/writing/task1/:sessionId" element={<WritingTaskPage />} />
          <Route path="/writing/task2/:sessionId" element={<WritingTaskPage />} />
          <Route path="/writing/result/:sessionId" element={<WritingResultPage />} />
          
          {/* Admin Routes */}
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/prompts" element={<WritingPromptsAdminPage />} />
          <Route path="/admin/assignments" element={<AdminAllAssignmentsPage />} />
          <Route path="/admin/reading" element={<AdminReadingManagePage />} />
          
        </Routes>
      </MainLayout>
    </Router>
  );
}

export default App;
