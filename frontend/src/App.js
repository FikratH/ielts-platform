import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Sidebar from './components/Sidebar';
import BottomNavigation from './components/BottomNavigation';
import { SidebarProvider, useSidebar } from './contexts/SidebarContext';
import LoginSurveyModal from './components/LoginSurveyModal';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const EssayDetail = lazy(() => import('./pages/EssayDetail'));
const WritingStartPage = lazy(() => import('./pages/WritingStartPage'));
const WritingTestListPage = lazy(() => import('./pages/WritingTestListPage'));
const WritingTaskPage = lazy(() => import('./pages/WritingTaskPage'));
const WritingResultPage = lazy(() => import('./pages/WritingResultPage'));
const WritingPromptsAdminPage = lazy(() => import('./pages/WritingPromptsAdminPage'));
const AdminWritingTestBuilder = lazy(() => import('./pages/AdminWritingTestBuilder'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const ListeningTestListPage = lazy(() => import('./pages/ListeningTestListPage'));
const ListeningTestPlayerPage = lazy(() => import('./pages/ListeningTestPlayerPage'));
const ListeningResultPage = lazy(() => import('./pages/ListeningResultPage'));
const AdminListeningManagePage = lazy(() => import('./pages/AdminListeningManagePage'));
const AdminListeningTestBuilderPage = lazy(() => import('./pages/AdminListeningTestBuilderPage'));
const AdminStudentsPage = lazy(() => import('./pages/AdminStudentsPage'));
const AdminTeachersPage = lazy(() => import('./pages/AdminTeachersPage'));
const AdminBulkImportPage = lazy(() => import('./pages/AdminBulkImportPage'));
const AdminStudentResultsPage = lazy(() => import('./pages/AdminStudentResultsPage'));
const AdminTeacherSurveyResultsPage = lazy(() => import('./pages/AdminTeacherSurveyResultsPage'));
const ReadingPage = lazy(() => import('./pages/ReadingPage'));
const ReadingTestPlayerPage = lazy(() => import('./pages/ReadingTestPlayerPage'));
const AdminReadingPage = lazy(() => import('./pages/AdminReadingPage'));
const AdminReadingTestBuilderPage = lazy(() => import('./pages/AdminReadingTestBuilderPage'));
const ReadingResultPage = lazy(() => import('./pages/ReadingResultPage'));
const TeacherWritingListPage = lazy(() => import('./pages/TeacherWritingListPage'));
const TeacherWritingEditorPage = lazy(() => import('./pages/TeacherWritingEditorPage'));
const WritingTeacherFeedbackPage = lazy(() => import('./pages/WritingTeacherFeedbackPage'));
const WritingTeacherFeedbackSessionPage = lazy(() => import('./pages/WritingTeacherFeedbackSessionPage'));
const TeacherSpeakingPage = lazy(() => import('./pages/TeacherSpeakingPage'));
const SpeakingSessionPage = lazy(() => import('./pages/SpeakingSessionPage'));
const SpeakingResultPage = lazy(() => import('./pages/SpeakingResultPage'));
const SpeakingSessionsListPage = lazy(() => import('./pages/SpeakingSessionsListPage'));
const CuratorDashboard = lazy(() => import('./pages/CuratorDashboard'));
const DiagnosticPage = lazy(() => import('./pages/DiagnosticPage'));
const CuratorDiagnosticPage = lazy(() => import('./pages/CuratorDiagnosticPage'));
const CuratorStudentsPage = lazy(() => import('./pages/CuratorStudentsPage'));
const CuratorWritingPage = lazy(() => import('./pages/CuratorWritingPage'));
const CuratorListeningPage = lazy(() => import('./pages/CuratorListeningPage'));
const CuratorReadingPage = lazy(() => import('./pages/CuratorReadingPage'));
const CuratorSpeakingPage = lazy(() => import('./pages/CuratorSpeakingPage'));
const CuratorTestComparisonPage = lazy(() => import('./pages/CuratorTestComparisonPage'));
const CuratorStudentDetailPage = lazy(() => import('./pages/CuratorStudentDetailPage'));
const AdminCuratorsPage = lazy(() => import('./pages/AdminCuratorsPage'));
const PlacementTestPage = lazy(() => import('./pages/PlacementTestPage'));
const AdminPlacementTestResultsPage = lazy(() => import('./pages/AdminPlacementTestResultsPage'));

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-blue-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-blue-600">Loading...</p>
    </div>
  </div>
);


const MainLayout = ({ role, setRole, children }) => {
  const location = useLocation();
  const noNavRoutes = ['/login', '/Ptest'];

  if (noNavRoutes.includes(location.pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <SidebarProvider>
          <Sidebar role={role} setRole={setRole} />
          <SidebarContent>
            {children}
          </SidebarContent>
        </SidebarProvider>
      </div>
      
      {/* Mobile Content with Bottom Navigation */}
      <div className="lg:hidden">
        <main className="pb-20">
          {children}
        </main>
        <BottomNavigation role={role} setRole={setRole} />
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
      if (window.location.pathname === '/Ptest') {
        return;
      }
      
      const userRole = localStorage.getItem('role');
      if (userRole === 'student') {
        const remindLater = localStorage.getItem('surveyRemindLater');
        const dontRemindUntil = localStorage.getItem('surveyDontRemindUntil');
        
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
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage setRole={setRole} />} />
          <Route path="/Ptest" element={<PlacementTestPage />} />
          <Route path="/" element={
            !role ? <Navigate to="/login" /> : 
            (role === 'admin' ? <Navigate to="/admin/students" /> : 
             role === 'teacher' ? <Navigate to="/curator/dashboard" /> :
             role === 'speaking_mentor' ? <Navigate to="/teacher/speaking" /> :
             role === 'curator' ? <Navigate to="/curator/dashboard" /> :
             role === 'placement_viewer' ? <Navigate to="/admin/placement-test-results" /> :
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
      </Suspense>
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
