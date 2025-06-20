import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import AdminEssayListPage from './pages/AdminEssayListPage';
import AdminReadingManagePage from './pages/AdminReadingManagePage';
import AdminAssignmentsPage from './pages/AdminAssignmentsPage';

function App() {
  const [role, setRole] = useState(null);

  useEffect(() => {
    setRole(localStorage.getItem('role'));
  }, []);

  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/essay" element={<EssaySubmitPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/essays/:id" element={<EssayDetail />} />
        <Route path="/reading" element={<ReadingTestListPage />} />
        <Route path="/reading-test/:id" element={<ReadingTestPage />} />
        <Route path="/reading-result/:id" element={<ReadingResultPage />} />
        <Route path="/writing/start" element={<WritingStartPage />} />
        <Route path="/writing/task1/:sessionId" element={<WritingTaskPage />} />
        <Route path="/writing/task2/:sessionId" element={<WritingTaskPage />} />
        <Route path="/writing/result/:sessionId" element={<WritingResultPage />} />
        <Route path="/admin/prompts" element={<WritingPromptsAdminPage />} />
        <Route path="/admin/essays" element={<AdminEssayListPage />} />
        {role === 'admin' && <Route path="/admin/reading" element={<AdminReadingManagePage />} />}
        {role === 'admin' && <Route path="/admin/assignments" element={<AdminAssignmentsPage />} />}
      </Routes>
    </Router>
  );
}

export default App;
