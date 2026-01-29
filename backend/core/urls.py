from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FirebaseLoginView,
    UserProfileView,
    EssaySubmissionView,
    EssayListView,
    EssayDetailView,

    StartWritingSessionView,
    SubmitTaskView,
    FinishWritingSessionView,
    WritingSessionSyncView,
    WritingPromptViewSet,
    WritingTestViewSet,
    WritingTaskViewSet,
    WritingTestSessionDetailView,
    WritingTestExportCSVView,
    AdminEssayListView,

    ListeningTestViewSet,
    ListeningPartViewSet,
    ListeningQuestionViewSet,
    ListeningTestSessionView,
    ListeningTestResultView,
    ListeningTestCloneViewSet,
    AdminCheckView,
    SecureAudioUploadView,
    AdminImageUploadView,
    ListeningTestSessionListView,
    ListeningTestSessionDetailView,
    ListeningTestExportCSVView,
    WritingTestExportCSVView,
    AdminCreateStudentView,
    AdminBulkImportStudentsView,
    AdminCreateTeacherView,
    AdminCreateCuratorView,
    AdminStudentListView,
    AdminStudentDetailView,
    
    # Reading Views
    ReadingTestViewSet,
    ReadingPartViewSet,
    ReadingQuestionViewSet,
    ReadingAnswerOptionViewSet,
    ReadingTestSessionViewSet,
    ReadingTestResultViewSet,
    ReadingTestSessionView,
    ReadingTestResultView,
    ReadingTestSessionListView,
    ReadingTestExportCSVView,
    GetEmailBySIDView,
    WritingPromptExportCSVView,
    
    # Admin Student Results Views
    AdminStudentResultsView,
    AdminReadingSessionListView,
    AdminReadingSessionResultView,
    AdminListeningSessionResultView,
    AdminListeningSessionListView,
    AdminListeningSessionDetailView,
    AdminEssayListView,
    AdminReadingSessionDetailView,
    # Teacher Writing Feedback Views
    TeacherEssayListView,
    TeacherEssayDetailView,
    TeacherFeedbackSaveView,
    TeacherFeedbackPublishView,
    StudentTeacherFeedbackView,
    TeachersListView,
    
    # Speaking Views
    TeacherSpeakingStudentsView,
    TeacherSpeakingSessionsView,
    TeacherSpeakingSessionDetailView,
    StudentSpeakingSessionsView,
    StudentSpeakingSessionDetailView,
    
    # Teacher Satisfaction Survey Views
    TeacherSatisfactionSurveyView,
    AdminTeacherSurveyResultsView,
    
    # Curator Views
    CuratorStudentsView,
    CuratorStudentDetailView,
    CuratorMissingTestsView,
    CuratorMissingSpeakingView,
    CuratorWritingOverviewView,
    CuratorListeningOverviewView,
    CuratorReadingOverviewView,
    CuratorSpeakingOverviewView,
    CuratorOverviewView,
    CuratorWeeklyOverviewView,
    CuratorGroupsRankingView,
    CuratorSpeakingExportCSVView,
    CuratorOverviewExportCSVView,
    CuratorWritingExportCSVView,
    CuratorTestComparisonView,
    CuratorTestComparisonExportCSVView,
    AdminCuratorsListView,
    GetEmailByCuratorIDView,
    CuratorActiveTestsView,
    DashboardSummaryView,
    DiagnosticSummaryView,
    CuratorDiagnosticResultsView,
    # New session-level writing feedback views
    TeacherSessionFeedbackView,
    TeacherSessionPublishView,
    StudentSessionFeedbackView,
    
    # Batch API (IELTS)
    BatchStudentProfilesView,
    BatchStudentsLatestTestDetailsView,
    BatchStudentsTestResultsView,
    BatchStudentsTestResultsWeekView,
    
    # Placement Test Views
    PlacementTestQuestionsView,
    PlacementTestSubmitView,
    AdminPlacementTestResultsView,
)

router = DefaultRouter()
router.register(r'writing-tests', WritingTestViewSet, basename='writing-test')
router.register(r'writing-tasks', WritingTaskViewSet, basename='writing-task')
router.register(r'prompts', WritingPromptViewSet, basename='prompt')
router.register(r'listening-tests', ListeningTestViewSet, basename='listening-test')
router.register(r'listening-parts', ListeningPartViewSet, basename='listening-part')
router.register(r'listening-questions', ListeningQuestionViewSet, basename='listening-question')
router.register(r'listening-clones', ListeningTestCloneViewSet, basename='listening-clone')

# Reading URLs
router.register(r'reading-tests', ReadingTestViewSet, basename='reading-test')
router.register(r'reading-parts', ReadingPartViewSet, basename='reading-part')
router.register(r'reading-questions', ReadingQuestionViewSet, basename='reading-question')
router.register(r'reading-answer-options', ReadingAnswerOptionViewSet, basename='reading-answer-option')
router.register(r'reading-test-sessions', ReadingTestSessionViewSet, basename='reading-test-session')
router.register(r'reading-test-results', ReadingTestResultViewSet, basename='reading-test-result')

urlpatterns = router.urls + [
    # Firebase Authentication
    path('login/', FirebaseLoginView.as_view(), name='firebase-login'),
    path('user/profile/', UserProfileView.as_view(), name='user-profile'),
    
    # Essay endpoints
    path('essay/', EssaySubmissionView.as_view(), name='essay-submit'),
    path('essays/', EssayListView.as_view(), name='essay-list'),
    path('essays/<int:pk>/', EssayDetailView.as_view(), name='essay-detail'),
    
    # Dashboard summary (student)
    path('dashboard/summary/', DashboardSummaryView.as_view(), name='dashboard-summary'),
    path('diagnostic/summary/', DiagnosticSummaryView.as_view(), name='diagnostic-summary'),
    path('diagnostic/curator/', CuratorDiagnosticResultsView.as_view(), name='diagnostic-curator'),
    
    # Batch endpoints (IELTS)
    path('batch/students/profiles/', BatchStudentProfilesView.as_view(), name='batch-students-profiles'),
    path('batch/students/latest-test-details/', BatchStudentsLatestTestDetailsView.as_view(), name='batch-students-latest-tests'),
    path('batch/students/test-results/', BatchStudentsTestResultsView.as_view(), name='batch-students-test-results'),
    path('batch/students/test-results-week/', BatchStudentsTestResultsWeekView.as_view(), name='batch-students-test-results-week'),


    
    # Writing session endpoints
    path('writing-tests/<int:test_id>/start/', StartWritingSessionView.as_view(), name='start-writing-test'),
    path('writing-test-sessions/<int:session_id>/', WritingTestSessionDetailView.as_view(), name='writing-test-session-detail'),
    path('start-writing-session/', StartWritingSessionView.as_view(), name='start-writing-session'),
    path('submit-task/', SubmitTaskView.as_view(), name='submit-task'),
    path('finish-writing-session/', FinishWritingSessionView.as_view(), name='finish-writing-session'),
    path('writing-sessions/<int:session_id>/sync/', WritingSessionSyncView.as_view(), name='writing-session-sync'),
    
    # Admin endpoints
    path('admin/essays/', AdminEssayListView.as_view(), name='admin-essay-list'),

    path('admin/check/', AdminCheckView.as_view(), name='admin-check'),
    path('admin/audio/upload/', SecureAudioUploadView.as_view(), name='secure-audio-upload'),
    path('admin/image/upload/', AdminImageUploadView.as_view(), name='admin-image-upload'),
    path('admin/create-student/', AdminCreateStudentView.as_view(), name='admin-create-student'),
    path('admin/bulk-import-students/', AdminBulkImportStudentsView.as_view(), name='admin-bulk-import-students'),
    path('admin/create-teacher/', AdminCreateTeacherView.as_view(), name='admin-create-teacher'),
    path('admin/create-curator/', AdminCreateCuratorView.as_view(), name='admin-create-curator'),
    path('admin/students/', AdminStudentListView.as_view(), name='admin-student-list'),
    path('admin/students/<int:id>/', AdminStudentDetailView.as_view(), name='admin-student-detail'),
    
    # Listening test session endpoints
    path('listening-tests/<int:test_id>/start/', ListeningTestSessionView.as_view(), name='listening-session-start'),
    path('listening-sessions/<int:session_id>/sync/', ListeningTestSessionView.as_view(), name='listening-session-sync'),
    path('listening-sessions/<int:session_id>/submit/', ListeningTestSessionView.as_view(), name='listening-session-submit'),
    path('listening-sessions/<int:session_id>/result/', ListeningTestResultView.as_view(), name='listening-session-result'),
    path('listening/sessions/', ListeningTestSessionListView.as_view(), name='listening-session-list'),
    path('listening/sessions/<int:pk>/', ListeningTestSessionDetailView.as_view(), name='listening-session-detail'),
]

urlpatterns += [
    path('admin/listening-test/<int:test_id>/export-csv/', ListeningTestExportCSVView.as_view(), name='listening-test-export-csv'),
    path('admin/reading-test/<int:test_id>/export-csv/', ReadingTestExportCSVView.as_view(), name='reading-test-export-csv'),
    path('admin/writing-test/<int:test_id>/export-csv/', WritingTestExportCSVView.as_view(), name='writing-test-export-csv'),
    path('admin/writing/export-csv/', WritingTestExportCSVView.as_view(), name='writing-export-csv'),
    
    # Reading test session endpoints
    path('reading-tests/<int:test_id>/start/', ReadingTestSessionView.as_view(), name='reading-session-start'),
    path('reading-sessions/<int:session_id>/sync/', ReadingTestSessionView.as_view(), name='reading-session-sync'),
    path('reading-sessions/<int:session_id>/submit/', ReadingTestSessionView.as_view(), name='reading-session-submit'),
    path('reading-sessions/<int:session_id>/result/', ReadingTestResultView.as_view(), name='reading-session-result'),
    path('reading/sessions/', ReadingTestSessionListView.as_view(), name='reading-session-list'),
    path('get-email-by-sid/', GetEmailBySIDView.as_view(), name='get-email-by-sid'),
    path('get-email-by-curator-id/', GetEmailByCuratorIDView.as_view(), name='get-email-by-curator-id'),
    path('admin/writing-prompt/<int:prompt_id>/export-csv/', WritingPromptExportCSVView.as_view(), name='writing-prompt-export-csv'),
    # Teacher Writing feedback (session-level)
    path('teacher/writing/sessions/<int:session_id>/feedback/', TeacherSessionFeedbackView.as_view(), name='teacher-session-feedback'),
    path('teacher/writing/sessions/<int:session_id>/publish/', TeacherSessionPublishView.as_view(), name='teacher-session-publish'),
    # Student session feedback (combined Task1+Task2)
    path('writing/sessions/<int:session_id>/teacher-feedback/', StudentSessionFeedbackView.as_view(), name='student-session-feedback'),
    
    # Admin Student Results endpoints
    path('admin/student-results/', AdminStudentResultsView.as_view(), name='admin-student-results'),
    path('admin/reading-sessions/', AdminReadingSessionListView.as_view(), name='admin-reading-sessions'),
    path('admin/reading-sessions/<int:session_id>/result/', AdminReadingSessionResultView.as_view(), name='admin-reading-session-result'),
    path('admin/listening-sessions/<int:session_id>/result/', AdminListeningSessionResultView.as_view(), name='admin-listening-session-result'),
    path('admin/listening-sessions/', AdminListeningSessionListView.as_view(), name='admin-listening-sessions'),
    path('admin/listening-sessions/<int:session_id>/', AdminListeningSessionDetailView.as_view(), name='admin-listening-session-detail'),
    path('admin/essays/', AdminEssayListView.as_view(), name='admin-essays'),
    path('admin/reading-sessions/<int:session_id>/', AdminReadingSessionDetailView.as_view(), name='admin-reading-session-detail'),
    # Teacher Writing Feedback
    path('teacher/writing/essays/', TeacherEssayListView.as_view(), name='teacher-essay-list'),
    path('teacher/writing/essays/<int:essay_id>/', TeacherEssayDetailView.as_view(), name='teacher-essay-detail'),
    path('teacher/writing/essays/<int:essay_id>/feedback/', TeacherFeedbackSaveView.as_view(), name='teacher-feedback-save'),
    path('teacher/writing/essays/<int:essay_id>/publish/', TeacherFeedbackPublishView.as_view(), name='teacher-feedback-publish'),
    path('writing/essays/<int:essay_id>/teacher-feedback/', StudentTeacherFeedbackView.as_view(), name='student-teacher-feedback'),
    path('teachers/', TeachersListView.as_view(), name='teachers-list'),
    
    # Teacher Satisfaction Survey
    path('teacher-survey/', TeacherSatisfactionSurveyView.as_view(), name='teacher-survey'),
    path('admin/teacher-survey-results/', AdminTeacherSurveyResultsView.as_view(), name='admin-teacher-survey-results'),
    
    # Speaking Assessment
    path('teacher/speaking/students/', TeacherSpeakingStudentsView.as_view(), name='teacher-speaking-students'),
    path('teacher/speaking/sessions/', TeacherSpeakingSessionsView.as_view(), name='teacher-speaking-sessions'),
    path('teacher/speaking/sessions/<int:session_id>/', TeacherSpeakingSessionDetailView.as_view(), name='teacher-speaking-session-detail'),
    path('speaking/sessions/', StudentSpeakingSessionsView.as_view(), name='student-speaking-sessions'),
    path('speaking/sessions/<int:session_id>/', StudentSpeakingSessionDetailView.as_view(), name='student-speaking-session-detail'),
    
    # Curator Views
    path('curator/students/', CuratorStudentsView.as_view(), name='curator-students'),
    path('curator/writing-overview/', CuratorWritingOverviewView.as_view(), name='curator-writing-overview'),
    path('curator/listening-overview/', CuratorListeningOverviewView.as_view(), name='curator-listening-overview'),
    path('curator/reading-overview/', CuratorReadingOverviewView.as_view(), name='curator-reading-overview'),
    path('curator/speaking-overview/', CuratorSpeakingOverviewView.as_view(), name='curator-speaking-overview'),
    path('curator/overview/', CuratorOverviewView.as_view(), name='curator-overview'),
    path('curator/weekly-overview/', CuratorWeeklyOverviewView.as_view(), name='curator-weekly-overview'),
    path('curator/active-tests/', CuratorActiveTestsView.as_view(), name='curator-active-tests'),
    path('curator/groups-ranking/', CuratorGroupsRankingView.as_view(), name='curator-groups-ranking'),
    path('curator/test-comparison/', CuratorTestComparisonView.as_view(), name='curator-test-comparison'),
    path('curator/test-comparison-export-csv/', CuratorTestComparisonExportCSVView.as_view(), name='curator-test-comparison-export-csv'),
    # Curator CSV Exports
    path('curator/speaking-export-csv/', CuratorSpeakingExportCSVView.as_view(), name='curator-speaking-export-csv'),
    path('curator/overview-export-csv/', CuratorOverviewExportCSVView.as_view(), name='curator-overview-export-csv'),
    path('curator/writing-export-csv/', CuratorWritingExportCSVView.as_view(), name='curator-writing-export-csv'),
    path('curator/student-detail/<int:student_id>/', CuratorStudentDetailView.as_view(), name='curator-student-detail'),
    path('curator/missing-tests/', CuratorMissingTestsView.as_view(), name='curator-missing-tests'),
    path('curator/missing-speaking/', CuratorMissingSpeakingView.as_view(), name='curator-missing-speaking'),
    path('admin/curators/', AdminCuratorsListView.as_view(), name='admin-curators-list'),
    
    # Placement Test
    path('placement-test/questions/', PlacementTestQuestionsView.as_view(), name='placement-test-questions'),
    path('placement-test/submit/', PlacementTestSubmitView.as_view(), name='placement-test-submit'),
    path('admin/placement-test-results/', AdminPlacementTestResultsView.as_view(), name='admin-placement-test-results'),
]
