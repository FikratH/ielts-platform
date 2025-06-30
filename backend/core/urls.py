from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FirebaseLoginView,
    EssaySubmissionView,
    EssayListView,
    EssayDetailView,
    ReadingTestListView,
    ReadingTestDetailView,
    StartWritingSessionView,
    SubmitTaskView,
    FinishWritingSessionView,
    WritingPromptViewSet,
    AdminEssayListView,
    StartReadingTestView,
    SubmitReadingTestView,
    ReadingTestSessionListView,
    ReadingTestSessionDetailView,
    ReadingTestCreateView,
    ActivateReadingTestView,
    ReadingTestUpdateDeleteView,
    AdminReadingSessionListView,
    AdminReadingSessionDetailView,
    ListeningTestViewSet,
    ListeningPartViewSet,
    ListeningQuestionViewSet,
    ListeningTestSessionView,
    ListeningTestResultView,
    ListeningTestCloneViewSet,
    AdminCheckView,
    SecureAudioUploadView
)

router = DefaultRouter()
router.register(r'prompts', WritingPromptViewSet, basename='prompt')
router.register(r'listening-tests', ListeningTestViewSet, basename='listening-test')
router.register(r'listening-parts', ListeningPartViewSet, basename='listening-part')
router.register(r'listening-questions', ListeningQuestionViewSet, basename='listening-question')
router.register(r'listening-clones', ListeningTestCloneViewSet, basename='listening-clone')

urlpatterns = router.urls + [
    # Firebase Authentication
    path('login/', FirebaseLoginView.as_view(), name='firebase-login'),
    
    # Essay endpoints
    path('essay/', EssaySubmissionView.as_view(), name='essay-submit'),
    path('essays/', EssayListView.as_view(), name='essay-list'),
    path('essays/<int:pk>/', EssayDetailView.as_view(), name='essay-detail'),
    
    # Reading test endpoints
    path('reading/tests/', ReadingTestListView.as_view(), name='reading-test-list'),
    path('reading/tests/create/', ReadingTestCreateView.as_view(), name='reading-test-create'),
    path('reading/tests/<int:pk>/', ReadingTestDetailView.as_view(), name='reading-test-detail'),
    path('reading/tests/<int:pk>/start/', StartReadingTestView.as_view(), name='reading-test-start'),
    path('reading/tests/<int:pk>/activate/', ActivateReadingTestView.as_view(), name='reading-test-activate'),
    path('reading/tests/<int:pk>/update/', ReadingTestUpdateDeleteView.as_view(), name='reading-test-update-delete'),
    path('reading/sessions/<int:session_id>/submit/', SubmitReadingTestView.as_view(), name='reading-test-submit'),
    path('reading/sessions/', ReadingTestSessionListView.as_view(), name='reading-session-list'),
    path('reading/sessions/<int:pk>/', ReadingTestSessionDetailView.as_view(), name='reading-session-detail'),
    
    # Writing session endpoints
    path('start-writing-session/', StartWritingSessionView.as_view(), name='start-writing-session'),
    path('submit-task/', SubmitTaskView.as_view(), name='submit-task'),
    path('finish-writing-session/', FinishWritingSessionView.as_view(), name='finish-writing-session'),
    
    # Admin endpoints
    path('admin/essays/', AdminEssayListView.as_view(), name='admin-essay-list'),
    path('admin/reading-sessions/', AdminReadingSessionListView.as_view(), name='admin-reading-session-list'),
    path('admin/reading-sessions/<int:pk>/', AdminReadingSessionDetailView.as_view(), name='admin-reading-session-detail'),
    path('admin/check/', AdminCheckView.as_view(), name='admin-check'),
    path('admin/audio/upload/', SecureAudioUploadView.as_view(), name='secure-audio-upload'),
    
    # Listening test session endpoints
    path('listening-tests/<int:test_id>/start/', ListeningTestSessionView.as_view(), name='listening-session-start'),
    path('listening-sessions/<int:session_id>/sync/', ListeningTestSessionView.as_view(), name='listening-session-sync'),
    path('listening-sessions/<int:session_id>/submit/', ListeningTestSessionView.as_view(), name='listening-session-submit'),
    path('listening-sessions/<int:session_id>/result/', ListeningTestResultView.as_view(), name='listening-session-result'),
]
