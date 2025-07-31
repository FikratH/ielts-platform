import os
import csv
from dotenv import load_dotenv
load_dotenv()
from .utils import CsrfExemptAPIView
from django.http import HttpResponse
from .firebase_config import verify_firebase_token
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView, RetrieveAPIView, RetrieveUpdateDestroyAPIView
from .models import ListeningTest, ListeningTestSession
from .serializers import (
    EssaySerializer, WritingPromptSerializer,
    ListeningTestListSerializer, ListeningTestDetailSerializer, ListeningTestSessionSerializer, ListeningTestCreateSerializer, ListeningTestSessionResultSerializer,
    ListeningTestSessionHistorySerializer, ReadingTestSessionHistorySerializer
)
from .models import WritingTestSession
from rest_framework import serializers
from rest_framework import viewsets
from .models import WritingPrompt
from .serializers import WritingPromptSerializer
from rest_framework.generics import ListAPIView
from .models import Essay, User
from .serializers import EssaySerializer
from .permissions import IsAdmin
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
import re
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.utils import timezone
import json
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import render, get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.middleware.csrf import get_token
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from .models import (
    ListeningTest, ListeningPart, ListeningQuestion, ListeningAnswerOption,
    ListeningTestSession, ListeningStudentAnswer, ListeningTestResult, ListeningTestClone
)
from .serializers import (
    ListeningTestSerializer, ListeningPartSerializer, ListeningQuestionSerializer,
    ListeningTestSessionSerializer, ListeningTestResultSerializer, ListeningTestCloneSerializer
)
from .serializers import ListeningTestSessionSyncSerializer, ListeningTestSessionSubmitSerializer, ListeningTestResultSerializer
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import csv
from django.contrib.auth import get_user_model
from .serializers import UserSerializer
import firebase_admin
from firebase_admin import auth as firebase_auth
from .models import ReadingTest, ReadingPart, ReadingQuestion, ReadingAnswerOption, ReadingTestSession, ReadingTestResult
from .serializers import ReadingTestSerializer, ReadingPartSerializer, ReadingQuestionSerializer, ReadingAnswerOptionSerializer, ReadingTestSessionSerializer, ReadingTestResultSerializer, ReadingTestReadSerializer
from .utils import ai_score_essay

class FirebaseLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        # 1. Забираем токен из body — либо под ключом 'token', либо 'idToken'
        id_token = request.data.get('token') or request.data.get('idToken')
        if not id_token:
            return Response(
                {"detail": "ID token is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Верифицируем через Firebase Admin SDK
        try:
            decoded = verify_firebase_token(id_token)
        except ValueError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_401_UNAUTHORIZED
            )

        uid = decoded.get('uid')
        email = decoded.get('email')
        student_id = request.data.get('student_id')
        role = request.data.get('role', 'student')

        # 3. Ищем пользователя по uid
        try:
            user = User.objects.get(uid=uid)
            created = False
        except User.DoesNotExist:
            # 4. Если не нашли — ищем по email
            try:
                user = User.objects.get(email=email)
                user.uid = uid
                user.role = role
                if student_id and user.student_id != student_id:
                    user.student_id = student_id
                user.save()
                created = False
            except User.DoesNotExist:
                # 5. Если не нашли и по email — создаём нового
                user = User.objects.create(
                    uid=uid,
                    email=email,
                    role=role,
                    student_id=student_id,
                    username=email,
                )
                created = True

        # 6. Возвращаем ответ
        return Response({
            "message": "Login successful",
            "uid": uid,
            "role": user.role,
            "created": created,
        }, status=status.HTTP_200_OK)

class AdminEssayListView(ListAPIView):
    serializer_class = EssaySerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        auth_header = self.request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return Essay.objects.none()
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return Essay.objects.none()
        uid = decoded['uid']
        try:
            user = User.objects.get(uid=uid)
            if user.role != 'admin':
                return Essay.objects.none()
        except User.DoesNotExist:
            return Essay.objects.none()

        queryset = Essay.objects.select_related('user').order_by('-submitted_at')
        student_id = self.request.query_params.get('student_id')
        if student_id:
            queryset = queryset.filter(user__student_id=student_id)

        return queryset


class EssayListView(ListAPIView):
    serializer_class = EssaySerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        auth_header = self.request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return Essay.objects.none()
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return Essay.objects.none()
        uid = decoded['uid']
        try:
            user = User.objects.get(uid=uid)
            session_id = self.request.query_params.get("session_id")
            queryset = Essay.objects.filter(user=user)
            if session_id:
                queryset = queryset.filter(test_session_id=session_id)
            return queryset.order_by('task_type')
        except User.DoesNotExist:
            return Essay.objects.none()

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        essays = self.get_serializer(queryset, many=True).data
        
        # Рассчитываем общий overall_band для сессии
        session_id = request.query_params.get("session_id")
        if session_id and essays:
            band1 = band2 = None
            for essay in essays:
                if essay['task_type'] == 'task1':
                    band1 = essay['overall_band']
                elif essay['task_type'] == 'task2':
                    band2 = essay['overall_band']
            
            if band1 is not None and band2 is not None:
                # Правильная формула IELTS: простое среднее арифметическое
                raw_score = (band1 + band2) / 2
                # IELTS округление: < 0.25 → вниз, ≥ 0.25 и < 0.75 → 0.5, ≥ 0.75 → вверх
                decimal_part = raw_score - int(raw_score)
                if decimal_part < 0.25:
                    overall_band = int(raw_score)
                elif decimal_part < 0.75:
                    overall_band = int(raw_score) + 0.5
                else:
                    overall_band = int(raw_score) + 1.0
                
                return Response({
                    'essays': essays,
                    'overall_band': overall_band
                })
        
        return Response({
            'essays': essays,
            'overall_band': None
        })


class EssayDetailView(RetrieveAPIView):
    serializer_class = EssaySerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        auth_header = self.request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return Essay.objects.none()
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return Essay.objects.none()
        uid = decoded['uid']
        try:
            user = User.objects.get(uid=uid)
            session_id = self.request.GET.get("session_id")
            if session_id:
                return Essay.objects.filter(user=user, test_session_id=session_id).order_by('task_type')
            return Essay.objects.filter(user=user).order_by('-submitted_at')
        except User.DoesNotExist:
            return Essay.objects.none()





class StartWritingSessionView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return Response({'error': 'Authentication required'}, status=401)
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return Response({'error': 'Invalid token'}, status=401)
        uid = decoded['uid']
        try:
            user = User.objects.get(uid=uid)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=401)

        session = WritingTestSession.objects.create(user=user)
        task1_prompt = WritingPrompt.objects.filter(task_type="task1", is_active=True).order_by("?").first()
        task2_prompt = WritingPrompt.objects.filter(task_type="task2", is_active=True).order_by("?").first()

        return Response({
            'session_id': session.id,
            'task1_prompt_id': task1_prompt.id if task1_prompt else None,
            'task2_prompt_id': task2_prompt.id if task2_prompt else None,
            'task1_text': task1_prompt.prompt_text if task1_prompt else "No Task 1 available",
            'task2_text': task2_prompt.prompt_text if task2_prompt else "No Task 2 available"
        })


class SubmitTaskView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return Response({'error': 'Authentication required'}, status=401)
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return Response({'error': 'Invalid token'}, status=401)
        uid = decoded['uid']
        try:
            user = User.objects.get(uid=uid)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=401)

        session_id = request.data.get('session_id')
        task_type = request.data.get('task_type')
        question_text = request.data.get('question_text')
        submitted_text = request.data.get('submitted_text')

        try:
            session = WritingTestSession.objects.get(id=session_id, user=user)
        except WritingTestSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=404)

        prompt_id = request.data.get('prompt_id')
        prompt = None
        if prompt_id:
            prompt = WritingPrompt.objects.filter(id=prompt_id).first()
        print('SubmitTaskView:', 'task_type:', task_type, 'question_text:', question_text, 'prompt:', prompt)
        if prompt and getattr(prompt, 'image', None):
            print('Prompt image url:', prompt.image.url)
        # SubmitTaskView: только сохраняем эссе, никаких AI, никаких image_url
        essay = Essay.objects.create(
            user=user,
            test_session=session,
            task_type=task_type,
            question_text=question_text,
            submitted_text=submitted_text,
            prompt=prompt
        )
        essay.submitted_at = timezone.now()
        essay.save()

        return Response(EssaySerializer(essay).data)


class FinishWritingSessionView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return Response({'error': 'Authentication required'}, status=401)
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return Response({'error': 'Invalid token'}, status=401)
        uid = decoded['uid']
        try:
            user = User.objects.get(uid=uid)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=401)

        session_id = request.data.get("session_id")
        if not session_id:
            return Response({'error': 'Session ID required'}, status=400)

        try:
            session = WritingTestSession.objects.get(id=session_id, user=user)
        except WritingTestSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=404)

        essays = Essay.objects.filter(user=user, test_session=session)
        if not essays.exists():
            return Response({'error': 'No essays found for this session'}, status=400)

        # AI-оценка для всех эссе, если ещё не оценены
        from .utils import ai_score_essay
        for essay in essays:
            if essay.overall_band is None or essay.feedback is None:
                prompt = essay.prompt
                image_url = None
                if prompt and getattr(prompt, 'image', None):
                    try:
                        image_url = request.build_absolute_uri(prompt.image.url)
                        if not image_url.startswith('http'):  # safety check
                            image_url = None
                    except Exception as e:
                        image_url = None
                print('AI image_url:', image_url)
                try:
                    ai_result = ai_score_essay(essay.question_text, essay.submitted_text, essay.task_type, image_url)
                    
                    # Обрабатываем разные поля для Task 1 и Task 2
                    if essay.task_type == 'task1':
                        essay.score_task = ai_result.get('task_achievement')  # Task 1 использует task_achievement
                    else:
                        essay.score_task = ai_result.get('task_response')     # Task 2 использует task_response
                    
                    essay.score_coherence = ai_result.get('coherence')
                    essay.score_lexical = ai_result.get('lexical')
                    essay.score_grammar = ai_result.get('grammar')
                    # НЕ сохраняем overall_band от AI - будем рассчитывать сами
                    essay.feedback = ai_result.get('feedback')
                    
                    # Рассчитываем individual band для этого эссе с правильным IELTS округлением
                    individual_scores = [essay.score_task, essay.score_coherence, essay.score_lexical, essay.score_grammar]
                    if all(score is not None for score in individual_scores):
                        raw_individual = sum(individual_scores) / len(individual_scores)
                        # IELTS округление: < 0.25 → вниз, ≥ 0.25 и < 0.75 → 0.5, ≥ 0.75 → вверх
                        decimal_part = raw_individual - int(raw_individual)
                        if decimal_part < 0.25:
                            essay.overall_band = int(raw_individual)
                        elif decimal_part < 0.75:
                            essay.overall_band = int(raw_individual) + 0.5
                        else:
                            essay.overall_band = int(raw_individual) + 1.0
                    
                    essay.save()
                except Exception as e:
                    essay.feedback = f"AI scoring failed: {str(e)}"
                    essay.save()
                    return Response({'error': 'AI scoring failed', 'detail': str(e)}, status=500)

        # Считаем общий band по формуле IELTS (простое среднее арифметическое)
        band1 = band2 = None
        for essay in essays:
            if essay.task_type == 'task1':
                band1 = essay.overall_band
                print(f'DEBUG: Task 1 band = {band1}')
            elif essay.task_type == 'task2':
                band2 = essay.overall_band
                print(f'DEBUG: Task 2 band = {band2}')
        
        print(f'DEBUG: band1 = {band1}, band2 = {band2}')
        
        if band1 is not None and band2 is not None:
            # Правильная формула IELTS: простое среднее арифметическое
            raw_score = (band1 + band2) / 2
            print(f'DEBUG: raw_score = ({band1} + {band2}) / 2 = {raw_score}')
            
            # IELTS округление: < 0.25 → вниз, ≥ 0.25 и < 0.75 → 0.5, ≥ 0.75 → вверх
            decimal_part = raw_score - int(raw_score)
            print(f'DEBUG: decimal_part = {decimal_part}')
            
            if decimal_part < 0.25:
                overall_band = int(raw_score)
                print(f'DEBUG: decimal_part < 0.25, overall_band = {overall_band}')
            elif decimal_part < 0.75:
                overall_band = int(raw_score) + 0.5
                print(f'DEBUG: 0.25 <= decimal_part < 0.75, overall_band = {overall_band}')
            else:
                overall_band = int(raw_score) + 1.0
                print(f'DEBUG: decimal_part >= 0.75, overall_band = {overall_band}')
        else:
            overall_band = None
            print(f'DEBUG: One of bands is None, overall_band = None')

        return Response({
            'session_id': session.id,
            'overall_band': overall_band,
            'essays': EssaySerializer(essays, many=True).data,
            'message': 'Session completed and AI scored successfully'
        })


class WritingPromptSerializer(serializers.ModelSerializer):
    class Meta:
        model = WritingPrompt
        fields = ['id', 'task_type', 'prompt_text', 'created_at', 'image', 'is_active']



class WritingPromptViewSet(viewsets.ModelViewSet):
    queryset = WritingPrompt.objects.all().order_by('-created_at')
    serializer_class = WritingPromptSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        auth_header = self.request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return WritingPrompt.objects.none()
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return WritingPrompt.objects.none()
        uid = decoded['uid']
        try:
            user = User.objects.get(uid=uid)
            if user.role != 'admin':
                return WritingPrompt.objects.none()
        except User.DoesNotExist:
            return WritingPrompt.objects.none()

        return WritingPrompt.objects.all().order_by('-created_at')

    @action(detail=False, methods=['get'], url_path='active', permission_classes=[AllowAny])
    def get_active_prompt(self, request):
        task_type = request.query_params.get('task_type', 'task1')
        prompt = WritingPrompt.objects.filter(task_type=task_type, is_active=True).first()
        if prompt:
            return Response(WritingPromptSerializer(prompt).data)
        else:
            return Response({'error': 'No active prompt found'}, status=404)

    def update(self, request, *args, **kwargs):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return Response({'error': 'Authentication required'}, status=401)
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return Response({'error': 'Invalid token'}, status=401)
        uid = decoded['uid']
        try:
            user = User.objects.get(uid=uid)
            if user.role != 'admin':
                return Response({'error': 'Admin access required'}, status=403)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=401)

        return super().update(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='set_active', permission_classes=[AllowAny])
    def set_active(self, request, pk=None):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return Response({'error': 'Authentication required'}, status=401)
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return Response({'error': 'Invalid token'}, status=401)
        uid = decoded['uid']
        try:
            user = User.objects.get(uid=uid)
            if user.role != 'admin':
                return Response({'error': 'Admin access required'}, status=403)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=401)

        prompt = self.get_object()
        prompt.is_active = True
        prompt.save()
        return Response({'message': 'Prompt activated', 'id': prompt.id})



class ListeningTestListView(ListAPIView):
    serializer_class = ListeningTestListSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        auth_header = self.request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Bearer '):
            id_token = auth_header.split(' ')[1]
            decoded = verify_firebase_token(id_token)
            if decoded:
                uid = decoded['uid']
                try:
                    user = User.objects.get(uid=uid)
                    if user.role == 'admin':
                        return ListeningTest.objects.all().order_by('-created_at')
                except User.DoesNotExist:
                    pass
        return ListeningTest.objects.filter(is_active=True).order_by('-created_at')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class ListeningTestDetailView(RetrieveAPIView):
    serializer_class = ListeningTestSerializer
    permission_classes = [AllowAny]
    queryset = ListeningTest.objects.all()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class StartListeningTestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, pk):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return Response({'error': 'Authentication required'}, status=401)
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return Response({'error': 'Invalid token'}, status=401)
        uid = decoded['uid']
        try:
            user = User.objects.get(uid=uid)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=401)

        try:
            test = ListeningTest.objects.get(pk=pk)
        except ListeningTest.DoesNotExist:
            return Response({"error": "Test not found"}, status=404)

        existing_session = ListeningTestSession.objects.filter(
            user=user,
            test=test,
            completed=False
        ).first()

        from .serializers import ListeningTestFullSerializer
        test_data = ListeningTestFullSerializer(test).data

        if existing_session:
            return Response({
                "session_id": existing_session.id,
                "test": test_data,
                "message": "Resuming existing session"
            })

        session = ListeningTestSession.objects.create(
            user=user,
            test=test
        )

        return Response({
            "session_id": session.id,
            "test": test_data,
            "message": "New session started"
        })


class SubmitListeningTestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, session_id):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return Response({'error': 'Authentication required'}, status=401)
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return Response({'error': 'Invalid token'}, status=401)
        uid = decoded['uid']
        try:
            user = User.objects.get(uid=uid)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=401)

        try:
            session = ListeningTestSession.objects.get(id=session_id, user=user)
        except ListeningTestSession.DoesNotExist:
            return Response({"error": "Session not found or doesn't belong to the user."}, status=status.HTTP_404_NOT_FOUND)

        session.answers = request.data.get("answers", {})
        session.completed = True
        session.completed_at = timezone.now()
        raw_score = session.calculate_score()
        band_score = session.convert_to_band(raw_score)
        session.raw_score = raw_score
        session.band_score = band_score
        session.save()
        session.score = raw_score
        session.correct_answers_count = raw_score
        session.total_questions_count = session.total_questions_count
        session.save()
        from .models import ListeningTestResult
        ListeningTestResult.objects.update_or_create(
            session=session,
            defaults={
                'raw_score': raw_score,
                'band_score': band_score,
                'breakdown': session.breakdown
            }
        )
        from .serializers import ListeningTestSessionResultSerializer
        result_serializer = ListeningTestSessionResultSerializer(session)
        return Response(result_serializer.data, status=status.HTTP_200_OK)


class ListeningTestSessionListView(ListAPIView):
    serializer_class = ListeningTestSessionHistorySerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        auth_header = self.request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return ListeningTestSession.objects.none()
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return ListeningTestSession.objects.none()
        uid = decoded['uid']
        try:
            user = User.objects.get(uid=uid)
            return ListeningTestSession.objects.filter(
                user=user,
                submitted=True
            ).select_related('test')
        except User.DoesNotExist:
            return ListeningTestSession.objects.none()


class ListeningTestSessionDetailView(RetrieveAPIView):
    serializer_class = ListeningTestSessionResultSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        auth_header = self.request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return ListeningTestSession.objects.none()
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return ListeningTestSession.objects.none()
        uid = decoded['uid']
        try:
            user = User.objects.get(uid=uid)
            return ListeningTestSession.objects.filter(
                user=user
            ).select_related('test')
        except User.DoesNotExist:
            return ListeningTestSession.objects.none()


# --- ListeningTest CRUD ---
class ListeningTestViewSet(viewsets.ModelViewSet):
    queryset = ListeningTest.objects.all().order_by('-created_at')
    serializer_class = ListeningTestSerializer
    permission_classes = [AllowAny]

    def get_serializer_class(self):
        if self.action in ['list', 'retrieve']:
            from .serializers import ListeningTestReadSerializer
            return ListeningTestReadSerializer
        return ListeningTestSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        from .serializers import ListeningTestReadSerializer
        read_serializer = ListeningTestReadSerializer(self.get_object())
        return Response(read_serializer.data, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        from .serializers import ListeningTestReadSerializer
        read_serializer = ListeningTestReadSerializer(instance)
        return Response(read_serializer.data, status=status.HTTP_201_CREATED)

    def get_queryset(self):
        return ListeningTest.objects.all().order_by('-created_at')

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        test = self.get_object()
        test.is_active = True
        test.save()
        return Response({'message': 'Test activated successfully'})

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        test = self.get_object()
        test.is_active = False
        test.save()
        return Response({'message': 'Test deactivated successfully'})

    @action(detail=True, methods=['post'])
    def clone(self, request, pk=None):
        source_test = self.get_object()
        
        # Create new test with cloned data
        cloned_test = ListeningTest.objects.create(
            title=f"{source_test.title} (Copy)",
            description=source_test.description,
            is_active=False  # Cloned tests start as inactive
        )
        
        # Clone all parts and their questions
        for part in source_test.parts.all():
            cloned_part = ListeningPart.objects.create(
                test=cloned_test,
                part_number=part.part_number,
                audio=part.audio,  # Reference to same audio file
                audio_duration=part.audio_duration,
                instructions=part.instructions
            )
            
            # Clone questions for this part
            for question in part.questions.all():
                cloned_question = ListeningQuestion.objects.create(
                    part=cloned_part,
                    question_type=question.question_type,
                    question_text=question.question_text,
                    order=question.order,
                    extra_data=question.extra_data,
                    correct_answers=question.correct_answers
                )
                
                # Clone answer options
                for option in question.options.all():
                    ListeningAnswerOption.objects.create(
                        question=cloned_question,
                        label=option.label,
                        text=option.text
                    )
        
        # Create clone record
        clone_record = ListeningTestClone.objects.create(
            source_test=source_test,
            cloned_test=cloned_test
        )
        
        return Response({
            'message': 'Test cloned successfully',
            'cloned_test_id': cloned_test.id,
            'clone_record_id': clone_record.id
        }, status=status.HTTP_201_CREATED)

# --- ListeningPart CRUD ---
class ListeningPartViewSet(viewsets.ModelViewSet):
    queryset = ListeningPart.objects.all().order_by('test', 'part_number')
    serializer_class = ListeningPartSerializer
    permission_classes = [AllowAny]

# --- ListeningQuestion CRUD ---
class ListeningQuestionViewSet(viewsets.ModelViewSet):
    queryset = ListeningQuestion.objects.all().order_by('part')
    serializer_class = ListeningQuestionSerializer
    permission_classes = [AllowAny]

# --- ListeningTestSession: start, sync, submit ---
class ListeningTestSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, test_id=None, session_id=None):
        # Этот метод обрабатывает и старт, и сабмит сессии.
        # Если test_id есть - это старт.
        if test_id:
            test = get_object_or_404(ListeningTest, pk=test_id)
            
            # Ищем последние незавершенные сессии
            sessions = ListeningTestSession.objects.filter(
                user=request.user,
                test=test,
                submitted=False
            ).order_by('-started_at')

            if sessions.exists():
                # Берем самую последнюю сессию
                session = sessions.first()
                created = False
            else:
                # Если нет - создаем новую
                session = ListeningTestSession.objects.create(
                    user=request.user,
                    test=test,
                    time_left=2400 # 40 минут по стандарту
                )
                created = True

            serializer = ListeningTestSessionSerializer(session)
            return Response(serializer.data, status=status.HTTP_200_OK if not created else status.HTTP_201_CREATED)

        # Если session_id есть - это сабмит.
        if session_id:
            session = get_object_or_404(ListeningTestSession, pk=session_id, user=request.user)
            if session.submitted:
                return Response({'detail': 'Session has already been submitted.'}, status=status.HTTP_400_BAD_REQUEST)

            # Используем сериализатор для валидации и сохранения данных
            submit_serializer = ListeningTestSessionSubmitSerializer(session, data=request.data, partial=True)
            submit_serializer.is_valid(raise_exception=True)
            
            # Сохраняем ответы и время
            session.answers = submit_serializer.validated_data.get('answers', session.answers)
            session.time_left = submit_serializer.validated_data.get('time_left', session.time_left)
            
            # Помечаем сессию как завершенную
            session.submitted = True
            session.completed_at = timezone.now()
            if session.started_at:
                session.time_taken = (session.completed_at - session.started_at).total_seconds()
            
            session.save()
            
            # Всю логику подсчета и формирования результата доверяем новому сериализатору
            # Создаем контекст, чтобы сериализатор не пересчитывал данные, если они уже есть
            context = {'request': request}
            result_serializer = ListeningTestSessionResultSerializer(session, context=context)
            
            return Response(result_serializer.data, status=status.HTTP_200_OK)

        return Response({'detail': 'Invalid request. Provide test_id to start or session_id to submit.'}, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, session_id=None):
        # Sync answers (save progress)
        session = get_object_or_404(ListeningTestSession, pk=session_id, user=request.user)
        serializer = ListeningTestSessionSyncSerializer(session, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'detail': 'Progress saved'}, status=status.HTTP_200_OK)

# --- ListeningTestResult: student/admin view ---
class ListeningTestResultView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, session_id):
        session = get_object_or_404(ListeningTestSession, pk=session_id, user=request.user)
        
        if not session.submitted:
            return Response({'detail': 'Session not submitted yet'}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = ListeningTestResultSerializer(session)
        return Response(serializer.data, status=status.HTTP_200_OK)

# --- ListeningTestClone: admin view ---
class ListeningTestCloneViewSet(viewsets.ModelViewSet):
    queryset = ListeningTestClone.objects.all().order_by('-cloned_at')
    serializer_class = ListeningTestCloneSerializer
    permission_classes = [AllowAny]

    @action(detail=True, methods=['post'])
    def clone(self, request, pk=None):
        # Get source test
        source_test = self.get_object()
        
        # Create new test with cloned data
        cloned_test = ListeningTest.objects.create(
            title=f"{source_test.title} (Copy)",
            description=source_test.description,
            is_active=False  # Cloned tests start as inactive
        )
        
        # Clone all parts and their questions
        for part in source_test.parts.all():
            cloned_part = ListeningPart.objects.create(
                test=cloned_test,
                part_number=part.part_number,
                audio=part.audio,  # Reference to same audio file
                audio_duration=part.audio_duration,
                instructions=part.instructions
            )
            
            # Clone questions for this part
            for question in part.questions.all():
                cloned_question = ListeningQuestion.objects.create(
                    part=cloned_part,
                    question_type=question.question_type,
                    question_text=question.question_text,
                    order=question.order,
                    extra_data=question.extra_data,
                    correct_answers=question.correct_answers
                )
                
                # Clone answer options
                for option in question.options.all():
                    ListeningAnswerOption.objects.create(
                        question=cloned_question,
                        label=option.label,
                        text=option.text
                    )
        
        # Create clone record
        clone_record = ListeningTestClone.objects.create(
            source_test=source_test,
            cloned_test=cloned_test
        )
        
        return Response({
            'message': 'Test cloned successfully',
            'cloned_test_id': cloned_test.id,
            'clone_record_id': clone_record.id
        }, status=status.HTTP_201_CREATED)

# --- Admin Check ---
class AdminCheckView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            user = User.objects.get(uid=request.user.uid)
            return Response({
                'is_admin': user.role == 'admin',
                'user_id': user.uid,
                'role': user.role
            })
        except User.DoesNotExist:
            return Response({'is_admin': False}, status=status.HTTP_404_NOT_FOUND)

# --- Secure Audio Upload ---
class SecureAudioUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def post(self, request):
        # Check admin permissions
        try:
            user = User.objects.get(uid=request.user.uid)
            if user.role != 'admin':
                return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Validate file
        audio_file = request.FILES.get('audio')
        if not audio_file:
            return Response({'error': 'No audio file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check file size (max 50MB for IELTS audio)
        if audio_file.size > 50 * 1024 * 1024:
            return Response({'error': 'File too large. Maximum size is 50MB'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check file type
        allowed_types = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a']
        if audio_file.content_type not in allowed_types:
            return Response({'error': 'Invalid file type. Allowed: MP3, WAV, OGG, M4A'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Generate secure filename
            import uuid
            import hashlib
            file_hash = hashlib.md5(audio_file.read()).hexdigest()
            audio_file.seek(0)  # Reset file pointer
            
            file_extension = os.path.splitext(audio_file.name)[1]
            secure_filename = f"secure_audio/{file_hash}{file_extension}"
            
            # Save file
            path = default_storage.save(secure_filename, ContentFile(audio_file.read()))
            
            # Get file duration (optional, requires additional processing)
            duration = 0  # TODO: implement audio duration extraction
            
            return Response({
                'success': True,
                'file_url': default_storage.url(path),
                'file_path': path,
                'duration': duration,
                'size': audio_file.size
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({'error': f'Failed to upload file: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# --- Admin Image Upload ---
class AdminImageUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        # Check admin permissions
        try:
            user = User.objects.get(uid=request.user.uid)
            if user.role != 'admin':
                return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        image_file = request.FILES.get('image')
        if not image_file:
            return Response({'error': 'No image file provided'}, status=status.HTTP_400_BAD_REQUEST)

        # Check file size (max 10MB)
        if image_file.size > 10 * 1024 * 1024:
            return Response({'error': 'File too large. Maximum size is 10MB'}, status=status.HTTP_400_BAD_REQUEST)

        # Check file type
        allowed_types = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        if image_file.content_type not in allowed_types:
            return Response({'error': 'Invalid file type. Allowed: JPEG, PNG, WEBP, GIF'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            import uuid
            import hashlib
            file_hash = hashlib.md5(image_file.read()).hexdigest()
            image_file.seek(0)
            file_extension = os.path.splitext(image_file.name)[1]
            secure_filename = f"listening_images/{file_hash}{file_extension}"
            path = default_storage.save(secure_filename, ContentFile(image_file.read()))
            return Response({
                'success': True,
                'file_url': default_storage.url(path),
                'file_path': path,
                'size': image_file.size
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': f'Failed to upload file: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# --- TODO: Secure audio upload/serve, admin submission review, etc. ---

class ListeningTestExportCSVView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, test_id):
        try:
            user = User.objects.get(uid=request.user.uid)
            if user.role != 'admin':
                return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        test = get_object_or_404(ListeningTest, pk=test_id)
        sessions = ListeningTestSession.objects.filter(test=test, submitted=True).select_related('user').order_by('user__student_id')

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="listening_test_{test_id}_results.csv"'
        response.write(u'\ufeff'.encode('utf8'))
        
        writer = csv.writer(response)

        header = [
            'Student ID', 'First Name', 'Last Name', 'Group', 'Teacher',
            'Raw Score', 'Total Score', 'Band Score',
            'Correct Questions', 'Incorrect Questions', 'Date Submitted'
        ]
        writer.writerow(header)

        for session in sessions:
            user = session.user
            
            # Получаем breakdown через ту же функцию что используется в результатах
            from .serializers import create_listening_detailed_breakdown
            results = create_listening_detailed_breakdown(session)
            
            raw_score = results.get('raw_score', 0)
            total_score = results.get('total_score', 0)
            band_score = results.get('band_score', 0)
            detailed_breakdown = results.get('detailed_breakdown', [])
            
            # Извлекаем правильные и неправильные вопросы из breakdown
            correct_questions = []
            incorrect_questions = []
            
            # Используем смешанную логику: total_sub_questions для multiple_response, иначе sub_questions
            question_counter = 1
            
            if detailed_breakdown:
                for part in detailed_breakdown:
                    for question in part.get('questions', []):
                        question_type = question.get('question_type', '')
                        
                        if question_type in ['multiple_response', 'checkbox', 'multi_select', 'multipleresponse']:
                            # Для multiple response: используем total_sub_questions (всегда 1)
                            total_sub_questions = question.get('total_sub_questions', 1)
                            correct_sub_questions = question.get('correct_sub_questions', 0)
                            
                            for i in range(total_sub_questions):
                                if correct_sub_questions > 0:
                                    correct_questions.append(str(question_counter))
                                else:
                                    incorrect_questions.append(str(question_counter))
                                question_counter += 1
                        else:
                            # Для остальных типов: используем sub_questions
                            sub_questions = question.get('sub_questions', [])
                            
                            for sub_question in sub_questions:
                                if sub_question.get('is_correct', False):
                                    correct_questions.append(str(question_counter))
                                else:
                                    incorrect_questions.append(str(question_counter))
                                question_counter += 1
            
            writer.writerow([
                user.student_id or '',
                user.first_name or '',
                user.last_name or '',
                user.group or '',
                user.teacher or '',
                raw_score,
                total_score,
                band_score,
                ';'.join(correct_questions),
                ';'.join(incorrect_questions),
                session.completed_at.strftime('%Y-%m-%d %H:%M:%S') if session.completed_at else ''
            ])

        return response


class ReadingTestExportCSVView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, test_id):
        # Проверяем права админа
        try:
            user = User.objects.get(uid=request.user.uid)
            if user.role != 'admin':
                return Response({'error': 'Admin access required'}, status=403)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)

        try:
            test = ReadingTest.objects.get(id=test_id)
        except ReadingTest.DoesNotExist:
            return Response({'error': 'Test not found'}, status=404)

        # Получаем все завершенные сессии по этому тесту
        sessions = ReadingTestSession.objects.filter(
            test=test, 
            completed=True
        ).select_related('user', 'result').order_by('-end_time')

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="reading_test_{test_id}_results.csv"'

        writer = csv.writer(response)
        writer.writerow([
            'Student ID', 'First Name', 'Last Name', 'Group', 'Teacher',
            'Raw Score', 'Total Score', 'Band Score', 
            'Correct Questions', 'Incorrect Questions', 'Date Submitted'
        ])

        for session in sessions:
            result = getattr(session, 'result', None)
            if not result:
                continue
                
            user = session.user
            
            # Извлекаем правильные и неправильные вопросы из breakdown
            correct_questions = []
            incorrect_questions = []
            
            # Упрощенная логика: просто нумеруем подвопросы по порядку
            question_counter = 1
            
            if result.breakdown:
                for question_id, data in result.breakdown.items():
                    sub_questions = data.get('sub_questions', [])
                    if sub_questions:
                        # Для вопросов с подвопросами - нумеруем каждый отдельно
                        for sub in sub_questions:
                            if sub.get('is_correct'):
                                correct_questions.append(str(question_counter))
                            else:
                                incorrect_questions.append(str(question_counter))
                            question_counter += 1
                    else:
                        # Для простых вопросов - один номер на вопрос
                        if data.get('is_correct'):
                            correct_questions.append(str(question_counter))
                        else:
                            incorrect_questions.append(str(question_counter))
                        question_counter += 1
            
            writer.writerow([
                user.student_id or '',
                user.first_name or '',
                user.last_name or '',
                user.group or '',
                user.teacher or '',
                result.raw_score,
                result.total_score,
                result.band_score,
                ';'.join(correct_questions),
                ';'.join(incorrect_questions),
                session.end_time.strftime('%Y-%m-%d %H:%M:%S') if session.end_time else ''
            ])

        return response

class AdminCreateStudentView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        data = request.data
        # Валидация входных данных
        serializer = UserSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        password = data.get('password')
        if not password or len(password) < 6:
            return Response({'error': 'Password must be at least 6 characters.'}, status=400)
        # Проверка уникальности email и student_id
        if User.objects.filter(email=email).exists():
            return Response({'error': 'Email already exists.'}, status=400)
        if 'student_id' in serializer.validated_data and User.objects.filter(student_id=serializer.validated_data['student_id']).exists():
            return Response({'error': 'Student ID already exists.'}, status=400)
        # Создание пользователя в Firebase
        try:
            firebase_user = firebase_auth.create_user(
                email=email,
                password=password,
                display_name=f"{serializer.validated_data.get('first_name', '')} {serializer.validated_data.get('last_name', '')}",
            )
        except firebase_admin._auth_utils.EmailAlreadyExistsError:
            return Response({'error': 'Email already exists in Firebase.'}, status=400)
        except Exception as e:
            return Response({'error': f'Firebase error: {str(e)}'}, status=400)
        # Создание пользователя в Django
        user = User.objects.create(
            uid=firebase_user.uid,
            role='student',
            student_id=serializer.validated_data.get('student_id'),
            first_name=serializer.validated_data.get('first_name'),
            last_name=serializer.validated_data.get('last_name'),
            email=email,
            group=serializer.validated_data.get('group'),
            teacher=serializer.validated_data.get('teacher'),
        )
        return Response(UserSerializer(user).data, status=201)

class AdminStudentListView(ListAPIView):
    permission_classes = [IsAdmin]
    serializer_class = UserSerializer
    queryset = User.objects.filter(role='student').order_by('-id')

class AdminStudentDetailView(RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdmin]
    serializer_class = UserSerializer
    queryset = User.objects.filter(role='student')
    lookup_field = 'id'

# Reading Views - обновлённые для совместимости с фронтендом
class ReadingTestViewSet(viewsets.ModelViewSet):
    queryset = ReadingTest.objects.all().order_by('-created_at')
    serializer_class = ReadingTestSerializer
    permission_classes = [AllowAny]

    def get_serializer_class(self):
        if self.action in ['list', 'retrieve']:
            return ReadingTestReadSerializer
        return ReadingTestSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        from .serializers import ReadingTestReadSerializer
        read_serializer = ReadingTestReadSerializer(self.get_object())
        return Response(read_serializer.data, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        from .serializers import ReadingTestReadSerializer
        read_serializer = ReadingTestReadSerializer(instance)
        return Response(read_serializer.data, status=status.HTTP_201_CREATED)

    def get_queryset(self):
        return ReadingTest.objects.all().order_by('-created_at')

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        test = self.get_object()
        test.is_active = True
        test.save()
        return Response({'message': 'Test activated successfully'})

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        test = self.get_object()
        test.is_active = False
        test.save()
        return Response({'message': 'Test deactivated successfully'})


class ReadingPartViewSet(viewsets.ModelViewSet):
    queryset = ReadingPart.objects.all()
    serializer_class = ReadingPartSerializer
    permission_classes = [AllowAny]


class ReadingQuestionViewSet(viewsets.ModelViewSet):
    queryset = ReadingQuestion.objects.all()
    serializer_class = ReadingQuestionSerializer
    permission_classes = [AllowAny]


class ReadingAnswerOptionViewSet(viewsets.ModelViewSet):
    queryset = ReadingAnswerOption.objects.all()
    serializer_class = ReadingAnswerOptionSerializer
    permission_classes = [AllowAny]


class ReadingTestSessionViewSet(viewsets.ModelViewSet):
    queryset = ReadingTestSession.objects.all()
    serializer_class = ReadingTestSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_staff:
            return ReadingTestSession.objects.all()
        return ReadingTestSession.objects.filter(student=self.request.user)

    def perform_create(self, serializer):
        serializer.save(student=self.request.user)


class ReadingTestResultViewSet(viewsets.ModelViewSet):
    queryset = ReadingTestResult.objects.all()
    serializer_class = ReadingTestResultSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ReadingTestResult.objects.filter(session__user=self.request.user)

class ReadingTestSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, test_id):
        """
        Start a new test session.
        """
        test = get_object_or_404(ReadingTest, pk=test_id)
        
        # Всегда создаем новую сессию для IELTS (каждый тест - отдельная попытка)
        session = ReadingTestSession.objects.create(user=request.user, test=test)
            
        serializer = ReadingTestSessionSerializer(session)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, session_id):
        """
        Submit answers for a session (finish test).
        """
        session = get_object_or_404(ReadingTestSession, pk=session_id, user=request.user)
        if session.completed:
            return Response({'error': 'This session has already been completed.'}, status=status.HTTP_400_BAD_REQUEST)

        answers_data = request.data.get('answers', {})
        session.answers = answers_data
        session.end_time = timezone.now()
        session.completed = True
        session.save()
        
        # Trigger result calculation
        result = self._calculate_and_save_results(session)

        return Response(ReadingTestResultSerializer(result).data, status=status.HTTP_200_OK)

    def patch(self, request, session_id):
        """
        Sync answers periodically.
        """
        session = get_object_or_404(ReadingTestSession, pk=session_id, user=request.user)
        if session.completed:
            return Response({'error': 'Cannot sync a completed session.'}, status=status.HTTP_400_BAD_REQUEST)

        answers_data = request.data.get('answers', {})
        
        if not isinstance(session.answers, dict):
            session.answers = {}
            
        session.answers.update(answers_data)
        session.save()

        return Response({'message': 'Progress saved'}, status=status.HTTP_200_OK)

    def _calculate_and_save_results(self, session):
        # Используем новую универсальную функцию формирования breakdown
        from .serializers import get_test_render_structure, count_correct_subanswers
        
        # Получаем структуру теста с правильными типами и опциями
        test_structure = get_test_render_structure(None, session)
        
        raw_score = 0
        full_breakdown = {}
        
        # Преобразуем структуру в breakdown формат и считаем очки
        for part in test_structure:
            for question_data in part['questions']:
                question_id = question_data['id']
                sub_questions = question_data['sub_questions']
                
                # Считаем правильные ответы для этого вопроса
                correct_count = sum(1 for sub in sub_questions if sub.get('is_correct', False))
                raw_score += correct_count
                
                full_breakdown[question_id] = {
                    'question_text': question_data['question_text'],
                    'question_type': question_data['type'], 
                    'header': question_data['header'],
                    'instruction': question_data['instruction'],
                    'sub_questions': sub_questions,
                }

        # Подсчитываем total_possible_score как общее количество подвопросов
        total_possible_score = sum(len(data['sub_questions']) for data in full_breakdown.values())

        def get_reading_band_score(raw_score, total_score=40):
            # Официальная таблица IELTS Reading band score
            # Приводим к стандартной шкале из 40 вопросов
            if total_score != 40 and total_score > 0:
                normalized_score = (raw_score / total_score) * 40
            else:
                normalized_score = raw_score
            
            # Официальная таблица IELTS Reading
            if normalized_score >= 39: return 9.0
            if normalized_score >= 37: return 8.5
            if normalized_score >= 35: return 8.0
            if normalized_score >= 33: return 7.5
            if normalized_score >= 30: return 7.0
            if normalized_score >= 27: return 6.5
            if normalized_score >= 23: return 6.0
            if normalized_score >= 19: return 5.5
            if normalized_score >= 15: return 5.0
            if normalized_score >= 13: return 4.5
            if normalized_score >= 10: return 4.0
            if normalized_score >= 8: return 3.5
            if normalized_score >= 6: return 3.0
            if normalized_score >= 4: return 2.5
            return 2.0  # Минимальный band score

        result, created = ReadingTestResult.objects.update_or_create(
            session=session,
            defaults={
                'raw_score': raw_score,
                'total_score': total_possible_score,
                'band_score': get_reading_band_score(raw_score, total_possible_score),
                'breakdown': full_breakdown
            }
        )
        return result


class ReadingTestResultView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        try:
            session = ReadingTestSession.objects.get(
                id=session_id, 
                user=request.user,
                completed=True
            )
            if hasattr(session, 'result'):
                pass
            serializer = ReadingTestResultSerializer(session.result)
            return Response(serializer.data)
        except ReadingTestSession.DoesNotExist:
            return Response({'error': 'Result not found or test not completed.'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

class GetEmailBySIDView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        sid = request.query_params.get('student_id')
        if not sid:
            return Response({'error': 'student_id required'}, status=400)
        try:
            user = User.objects.get(student_id=sid)
            if not user.email:
                return Response({'error': 'Email not set for this user'}, status=404)
            return Response({'email': user.email})
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)

# --- Reading Test Session List для Dashboard ---
class ReadingTestSessionListView(ListAPIView):
    serializer_class = ReadingTestSessionHistorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        try:
            user = User.objects.get(uid=self.request.user.uid)
            return ReadingTestSession.objects.filter(
                user=user, 
                completed=True
            ).select_related('test', 'result').order_by('-end_time')
        except User.DoesNotExist:
            return ReadingTestSession.objects.none()

# Добавляем в конец файла

class WritingTestExportCSVView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            user = User.objects.get(uid=request.user.uid)
            if user.role != 'admin':
                return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        # Получаем все эссе
        essays = Essay.objects.all().select_related('user', 'test_session').order_by('user__student_id', '-submitted_at')

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="writing_essays.csv"'
        response.write(u'\ufeff'.encode('utf8'))
        
        writer = csv.writer(response)

        header = [
            'Student ID', 'First Name', 'Last Name', 'Group', 'Teacher',
            'Task Type', 'Essay Text', 'Question Text', 'Word Count',
            'Task Response Score', 'Coherence Score', 'Lexical Score', 'Grammar Score',
            'Overall Band', 'AI Feedback', 'Date Submitted'
        ]
        writer.writerow(header)

        for essay in essays:
            user = essay.user
            
            # Подсчитываем слова в эссе
            word_count = len(essay.submitted_text.split()) if essay.submitted_text else 0
            
            writer.writerow([
                user.student_id or '',
                user.first_name or '',
                user.last_name or '',
                user.group or '',
                user.teacher or '',
                essay.task_type.upper() if essay.task_type else '',
                essay.submitted_text or '',
                essay.question_text or '',
                word_count,
                essay.score_task or 'Not scored',
                essay.score_coherence or 'Not scored',
                essay.score_lexical or 'Not scored',
                essay.score_grammar or 'Not scored',
                essay.overall_band or 'Not scored',
                essay.feedback or 'No feedback available',
                essay.submitted_at.strftime('%Y-%m-%d %H:%M:%S') if essay.submitted_at else ''
            ])

        return response

class WritingPromptExportCSVView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, prompt_id):
        try:
            user = User.objects.get(uid=request.user.uid)
            if user.role != 'admin':
                return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        essays = Essay.objects.filter(prompt_id=prompt_id).select_related('user', 'prompt').order_by('user__student_id', '-submitted_at')

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="writing_prompt_{prompt_id}_essays.csv"'
        response.write(u'\ufeff'.encode('utf8'))
        writer = csv.writer(response)
        header = [
            'Student ID', 'First Name', 'Last Name', 'Email', 'Group', 'Teacher',
            'Task Type', 'Prompt Text', 'Essay Text',
            'Task Response Score', 'Coherence Score', 'Lexical Score', 'Grammar Score',
            'Overall Band', 'AI Feedback', 'Date Submitted'
        ]
        writer.writerow(header)
        for essay in essays:
            user = essay.user
            writer.writerow([
                user.student_id or '',
                user.first_name or '',
                user.last_name or '',
                user.email or '',
                user.group or '',
                user.teacher or '',
                essay.task_type.upper() if essay.task_type else '',
                essay.prompt.prompt_text if essay.prompt else '',
                essay.submitted_text or '',
                essay.score_task or 'Not scored',
                essay.score_coherence or 'Not scored',
                essay.score_lexical or 'Not scored',
                essay.score_grammar or 'Not scored',
                essay.overall_band or 'Not scored',
                essay.feedback or 'No feedback available',
                essay.submitted_at.strftime('%Y-%m-%d %H:%M:%S') if essay.submitted_at else ''
            ])
        return response

class EssaySubmissionView(CsrfExemptAPIView):
    permission_classes = [AllowAny]

    def post(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return Response({'error': 'Authentication required'}, status=401)

        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return Response({'error': 'Invalid token'}, status=401)

        uid = decoded['uid']
        try:
            user = User.objects.get(uid=uid)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=401)

        serializer = EssaySerializer(data=request.data)
        if serializer.is_valid():
            essay = serializer.save(user=user)
            essay.submitted_at = timezone.now()
            essay.save()
            return Response({'message': 'Essay submitted successfully.'})
        else:
            return Response(serializer.errors, status=400)