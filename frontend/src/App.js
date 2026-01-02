import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import LoginPage from './pages/LoginPage';
// import EssaySubmitPage from './pages/EssaySubmitPage';
import Dashboard from './pages/Dashboard';
import EssayDetail from './pages/EssayDetail';

import WritingStartPage from './pages/WritingStartPage';
import WritingTestListPage from './pages/WritingTestListPage';
import WritingTaskPage from './pages/WritingTaskPage';
import WritingResultPage from './pages/WritingResultPage';
import WritingPromptsAdminPage from './pages/WritingPromptsAdminPage';
import AdminWritingTestBuilder from './pages/AdminWritingTestBuilder';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import { SidebarProvider, useSidebar } from './contexts/SidebarContext';
import AdminDashboardPage from './pages/AdminDashboardPage';
import ListeningTestListPage from './pages/ListeningTestListPage';
import ListeningTestPlayerPage from './pages/ListeningTestPlayerPage';
import ListeningResultPage from './pages/ListeningResultPage';
import AdminListeningManagePage from './pages/AdminListeningManagePage';
import AdminListeningTestBuilderPage from './pages/AdminListeningTestBuilderPage';
import StudentSubmissionView from './components/StudentSubmissionView';
import AdminStudentsPage from './pages/AdminStudentsPage';
import AdminTeachersPage from './pages/AdminTeachersPage';
import AdminBulkImportPage from './pages/AdminBulkImportPage';
import AdminStudentResultsPage from './pages/AdminStudentResultsPage';
import AdminTeacherSurveyResultsPage from './pages/AdminTeacherSurveyResultsPage';


// Reading imports
import ReadingPage from './pages/ReadingPage';
import ReadingTestPlayerPage from './pages/ReadingTestPlayerPage';
import AdminReadingPage from './pages/AdminReadingPage';
import AdminReadingTestBuilderPage from './pages/AdminReadingTestBuilderPage';
import ReadingResultPage from './pages/ReadingResultPage';
// Teacher pages
import TeacherWritingListPage from './pages/TeacherWritingListPage';
import TeacherWritingEditorPage from './pages/TeacherWritingEditorPage';
// Student feedback view
import WritingTeacherFeedbackPage from './pages/WritingTeacherFeedbackPage';
import WritingTeacherFeedbackSessionPage from './pages/WritingTeacherFeedbackSessionPage';
// Speaking pages
import TeacherSpeakingPage from './pages/TeacherSpeakingPage';
import SpeakingSessionPage from './pages/SpeakingSessionPage';
import SpeakingResultPage from './pages/SpeakingResultPage';
import SpeakingSessionsListPage from './pages/SpeakingSessionsListPage';

import CuratorDashboard from './pages/CuratorDashboard';
import DiagnosticPage from './pages/DiagnosticPage';
import CuratorDiagnosticPage from './pages/CuratorDiagnosticPage';
import CuratorStudentsPage from './pages/CuratorStudentsPage';
import CuratorWritingPage from './pages/CuratorWritingPage';
import CuratorListeningPage from './pages/CuratorListeningPage';
import CuratorReadingPage from './pages/CuratorReadingPage';
import CuratorSpeakingPage from './pages/CuratorSpeakingPage';
import CuratorTestComparisonPage from './pages/CuratorTestComparisonPage';
import CuratorStudentDetailPage from './pages/CuratorStudentDetailPage';
import AdminCuratorsPage from './pages/AdminCuratorsPage';
import LoginSurveyModal from './components/LoginSurveyModal';
import PlacementTestPage from './pages/PlacementTestPage';
import AdminPlacementTestResultsPage from './pages/AdminPlacementTestResultsPage';


const MainLayout = ({ role, setRole, children }) => {
  const location = useLocation();
  const noNavRoutes = ['/login', '/Ptest'];

  if (noNavRoutes.includes(location.pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Mobile Navbar */}
      <div className="lg:hidden">
        <Navbar role={role} setRole={setRole} />
      </div>
      
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <SidebarProvider>
          <Sidebar role={role} setRole={setRole} />
          <SidebarContent>
            {children}
          </SidebarContent>
        </SidebarProvider>
      </div>
      
      {/* Mobile Content */}
      <div className="lg:hidden">
        <main className="pt-20 px-4">
          {children}
        </main>
      </div>
    </>
  );
};

const SidebarContent = ({ children }) => {
  const { isExpanded } = useSidebar();
  
  return (
    <main 
      className={`transition-all duration-700 ease-in-out ${
        isExpanded ? 'lg:ml-64' : 'lg:ml-20'
      }`}
    >
      {children}
    </main>
  );
};

function App() {
  const [role, setRole] = useState(localStorage.getItem('role'));
  const [showLoginSurvey, setShowLoginSurvey] = useState(false);


  useEffect(() => {
    const handleStorageChange = () => {
      const newRole = localStorage.getItem('role');
      setRole(newRole);
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-storage', handleStorageChange); 
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage', handleStorageChange);
    }
  }, []);

  useEffect(() => {
    const checkLoginSurvey = async () => {
      const userRole = localStorage.getItem('role');
      if (userRole === 'student') {
        const remindLater = localStorage.getItem('surveyRemindLater');
        const dontRemindUntil = localStorage.getItem('surveyDontRemindUntil');
        
        {/* Teacher Writing session editor uses same component, session-aware */}
        <Route path="/teacher/writing/session/:sessionId" element={<TeacherWritingEditorPage />} />
        // Сначала проверяем, заполнен ли уже опрос на этой неделе
        try {
          // Получаем свежий токен из Firebase
          const token = localStorage.getItem('token');
          if (!token) {
            return;
          }
          
          const response = await fetch('/api/teacher-survey/', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const surveyData = await response.json();
            if (surveyData.submittedThisWeek) {
              return; // Полностью убираем показ модального окна если опрос уже заполнен
            }
          }
        } catch (err) {
          // Если не удалось проверить статус, показываем модальное окно
        }
        
        if (dontRemindUntil) {
          const now = new Date();
          const dontRemindDate = new Date(parseInt(dontRemindUntil));
          
          if (now < dontRemindDate) {
            return;
          } else {
            localStorage.removeItem('surveyDontRemindUntil');
          }
        }
        
        if (remindLater) {
          localStorage.removeItem('surveyRemindLater');
          setShowLoginSurvey(true);
        } else if (!dontRemindUntil) {
          setShowLoginSurvey(true);
        }
      }
    };

    if (role === 'student') {
      // Добавляем небольшую задержку для инициализации аутентификации
      setTimeout(() => {
        checkLoginSurvey();
      }, 1000);
    }
  }, [role]);

  return (
    <Router>
      <MainLayout role={role} setRole={setRole}>
      <Routes>
          <Route path="/login" element={<LoginPage setRole={setRole} />} />
          <Route path="/Ptest" element={<PlacementTestPage />} />
          <Route path="/" element={
            !role ? <Navigate to="/login" /> : 
            (role === 'admin' ? <Navigate to="/admin/dashboard" /> : 
             role === 'teacher' ? <Navigate to="/curator/dashboard" /> :
             role === 'speaking_mentor' ? <Navigate to="/teacher/speaking" /> :
             role === 'curator' ? <Navigate to="/curator/dashboard" /> :
             <Navigate to="/dashboard" />)
          } />
          
          
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/diagnostic" element={<DiagnosticPage />} />
        <Route path="/essays/:id" element={<EssayDetail />} />

        <Route path="/writing" element={<WritingTestListPage />} />
        <Route path="/writing/start" element={<WritingStartPage />} />
        <Route path="/writing/task/:sessionId" element={<WritingTaskPage />} />
        <Route path="/writing/task1/:sessionId" element={<WritingTaskPage />} />
        <Route path="/writing/task2/:sessionId" element={<WritingTaskPage />} />
        <Route path="/writing/result/:sessionId" element={<WritingResultPage />} />
        <Route path="/writing-result/:sessionId" element={<WritingResultPage />} />
        <Route path="/writing/essay/:essayId" element={<WritingResultPage />} />
        <Route path="/writing/teacher-feedback/session/:sessionId" element={<WritingTeacherFeedbackSessionPage />} />
          
          
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        <Route path="/admin/writing-tests" element={<AdminWritingTestBuilder />} />
        <Route path="/admin/prompts" element={<WritingPromptsAdminPage />} />
          <Route path="/admin/students" element={<AdminStudentsPage />} />
                      <Route path="/admin/teachers" element={<AdminTeachersPage />} />
            <Route path="/admin/bulk-import" element={<AdminBulkImportPage />} />
          <Route path="/admin/student-results" element={<AdminStudentResultsPage />} />
          <Route path="/admin/placement-test-results" element={<AdminPlacementTestResultsPage />} />
          <Route path="/admin/teacher-survey-results" element={<AdminTeacherSurveyResultsPage />} />
          
          <Route path="/listening" element={<ListeningTestListPage />} />
          <Route path="/listening-test/:id" element={<ListeningTestPlayerPage />} />
          <Route path="/listening-result/:sessionId" element={<ListeningResultPage />} />
          <Route path="/admin/listening" element={<AdminListeningManagePage />} />
          <Route path="/admin/listening/builder/new" element={<AdminListeningTestBuilderPage />} />
          <Route path="/admin/listening/builder/:testId" element={<AdminListeningTestBuilderPage />} />

          <Route path="/reading" element={<ReadingPage />} />
          <Route path="/reading-test/:id" element={<ReadingTestPlayerPage />} />
          <Route path="/reading-result/:sessionId" element={<ReadingResultPage />} />
          <Route path="/admin/reading" element={<AdminReadingPage />} />
          <Route path="/admin/reading/builder/new" element={<AdminReadingTestBuilderPage />} />
          <Route path="/admin/reading/builder/:testId" element={<AdminReadingTestBuilderPage />} />
          <Route path="/admin/reading/edit/:testId" element={<AdminReadingTestBuilderPage />} />
          {/* Admin Create Curator */}
          <Route path="/admin/curators" element={<AdminCuratorsPage />} />
          {/* Teacher */}
          <Route path="/teacher/writing" element={<TeacherWritingListPage />} />
          <Route path="/teacher/writing/:essayId" element={<TeacherWritingEditorPage />} />
          <Route path="/teacher/speaking" element={<TeacherSpeakingPage />} />
          <Route path="/teacher/speaking/session/:sessionId" element={<SpeakingSessionPage />} />

          {/* Student: teacher feedback and speaking results */}
          <Route path="/writing/feedback/:essayId" element={<WritingTeacherFeedbackPage />} />
          <Route path="/speaking/sessions" element={<SpeakingSessionsListPage />} />
          <Route path="/speaking/result/:sessionId" element={<SpeakingResultPage />} />
          
          {/* Curator */}
          <Route path="/curator/dashboard" element={<CuratorDashboard />} />
          <Route path="/curator/students" element={<CuratorStudentsPage />} />
          <Route path="/curator/writing" element={<CuratorWritingPage />} />
          <Route path="/curator/listening" element={<CuratorListeningPage />} />
          <Route path="/curator/reading" element={<CuratorReadingPage />} />
          <Route path="/curator/speaking" element={<CuratorSpeakingPage />} />
          <Route path="/curator/test-comparison" element={<CuratorTestComparisonPage />} />
          <Route path="/curator/student-detail/:studentId" element={<CuratorStudentDetailPage />} />
          <Route path="/curator/diagnostic" element={<CuratorDiagnosticPage />} />
          
          {/* Admin result pages */}
          <Route path="/admin/listening-result/:sessionId" element={<ListeningResultPage />} />
          <Route path="/admin/reading-result/:sessionId" element={<ReadingResultPage />} />
          <Route path="/admin/writing-result/:sessionId" element={<WritingResultPage />} />
        </Routes>
      </MainLayout>
      
      {/* Login Survey Modal */}
      <LoginSurveyModal
        isOpen={showLoginSurvey}
        onClose={() => setShowLoginSurvey(false)}
        onSurveySubmitted={() => {
          setShowLoginSurvey(false);
          // Обновляем статус опроса в дашборде
          window.dispatchEvent(new Event('surveySubmitted'));
        }}
      />
    </Router>
  );
}

export default App;
