from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FirebaseLoginView,
    EssaySubmissionView,
    EssayListView,
    EssayDetailView,

    StartWritingSessionView,
    SubmitTaskView,
    FinishWritingSessionView,
    WritingPromptViewSet,
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
    GetEmailBySIDView
)

router = DefaultRouter()
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
    
    # Essay endpoints
    path('essay/', EssaySubmissionView.as_view(), name='essay-submit'),
    path('essays/', EssayListView.as_view(), name='essay-list'),
    path('essays/<int:pk>/', EssayDetailView.as_view(), name='essay-detail'),
    

    
    # Writing session endpoints
    path('start-writing-session/', StartWritingSessionView.as_view(), name='start-writing-session'),
    path('submit-task/', SubmitTaskView.as_view(), name='submit-task'),
    path('finish-writing-session/', FinishWritingSessionView.as_view(), name='finish-writing-session'),
    
    # Admin endpoints
    path('admin/essays/', AdminEssayListView.as_view(), name='admin-essay-list'),

    path('admin/check/', AdminCheckView.as_view(), name='admin-check'),
    path('admin/audio/upload/', SecureAudioUploadView.as_view(), name='secure-audio-upload'),
    path('admin/image/upload/', AdminImageUploadView.as_view(), name='admin-image-upload'),
    path('admin/create-student/', AdminCreateStudentView.as_view(), name='admin-create-student'),
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
    path('admin/writing/export-csv/', WritingTestExportCSVView.as_view(), name='writing-export-csv'),
    
    # Reading test session endpoints
    path('reading-tests/<int:test_id>/start/', ReadingTestSessionView.as_view(), name='reading-session-start'),
    path('reading-sessions/<int:session_id>/sync/', ReadingTestSessionView.as_view(), name='reading-session-sync'),
    path('reading-sessions/<int:session_id>/submit/', ReadingTestSessionView.as_view(), name='reading-session-submit'),
    path('reading-sessions/<int:session_id>/result/', ReadingTestResultView.as_view(), name='reading-session-result'),
    path('reading/sessions/', ReadingTestSessionListView.as_view(), name='reading-session-list'),
    path('get-email-by-sid/', GetEmailBySIDView.as_view(), name='get-email-by-sid'),
]
