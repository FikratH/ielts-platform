from openai import OpenAI
import os
from dotenv import load_dotenv
load_dotenv()
from .utils import CsrfExemptAPIView
from .firebase_config import verify_firebase_token
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView, RetrieveAPIView, RetrieveUpdateDestroyAPIView
from .models import ReadingTest, ReadingQuestion, AnswerKey, ReadingTestSession, AnswerOption, ReadingPassage, ListeningTest, ListeningTestSession
from .serializers import (
    ReadingTestListSerializer, ReadingTestDetailSerializer, EssaySerializer, WritingPromptSerializer,
    ReadingTestSessionSerializer, ReadingPassageSerializer, ReadingTestCreateSerializer, ReadingQuestionSerializer, ReadingQuestionUpdateSerializer, ReadingTestSessionResultSerializer,
    ListeningTestListSerializer, ListeningTestDetailSerializer, ListeningTestSessionSerializer, ListeningTestCreateSerializer, ListeningTestSessionResultSerializer,
    ListeningTestSessionHistorySerializer
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
from django.http import HttpResponse
from django.contrib.auth import get_user_model
from .serializers import UserSerializer
import firebase_admin
from firebase_admin import auth as firebase_auth

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class FirebaseLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        id_token = request.data.get('idToken')
        decoded_token = verify_firebase_token(id_token)
        if not decoded_token:
            return Response({'error': 'Invalid token'}, status=status.HTTP_401_UNAUTHORIZED)

        uid = decoded_token['uid']
        role = request.data.get('role')
        student_id = request.data.get('student_id')

        user, created = User.objects.get_or_create(
            uid=uid,
            defaults={'role': role, 'student_id': student_id}
        )
        if not user.student_id and student_id:
            user.student_id = student_id
            user.save()

        return Response({
            'message': 'Login successful',
            'uid': uid,
            'role': user.role,
            'student_id': user.student_id
        })


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

            prompt = f"""
                        You are an IELTS examiner. Evaluate the following essay using 4 IELTS Writing criteria.  
                        Score each from 0 to 9 and return the result in plain text format like:
                        
                        Task Response: 8.5
                        Coherence and Cohesion: 8
                        Lexical Resource: 8
                        Grammatical Range and Accuracy: 9
                        
                        Feedback: <full feedback here>
                        
                        Essay:
                        {essay.submitted_text}
                        """

            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are an IELTS writing examiner."},
                    {"role": "user", "content": prompt}
                ]
            )

            content = response.choices[0].message.content.strip()

            def extract_score(label):
                match = re.search(rf"{label}[:：]?\s*(\d+(\.\d+)?)", content, re.IGNORECASE)
                return float(match.group(1)) if match else 0

            def round_ielts_band(score):
                decimal = score - int(score)
                if decimal < 0.25:
                    return float(int(score))
                elif decimal < 0.75:
                    return float(int(score)) + 0.5
                else:
                    return float(int(score)) + 1.0

            essay.score_task = extract_score("Task Response")
            essay.score_coherence = extract_score("Coherence and Cohesion")
            essay.score_lexical = extract_score("Lexical Resource")
            essay.score_grammar = extract_score("Grammatical Range and Accuracy")
            essay.overall_band = round_ielts_band((
                essay.score_task + essay.score_coherence + essay.score_lexical + essay.score_grammar
            ) / 4)
            essay.feedback = content
            essay.save()

            return Response(EssaySerializer(essay).data)

        return Response(serializer.errors, status=400)

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
            return queryset.order_by('-submitted_at')
        except User.DoesNotExist:
            return Essay.objects.none()


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

class ReadingTestListView(ListAPIView):
    serializer_class = ReadingTestListSerializer
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
                        return ReadingTest.objects.all()
                except User.DoesNotExist:
                    pass
        return ReadingTest.objects.filter(is_active=True)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

class ReadingTestDetailView(RetrieveAPIView):
    serializer_class = ReadingTestDetailSerializer
    permission_classes = [AllowAny]
    queryset = ReadingTest.objects.all()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

class StartReadingTestView(APIView):
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
            test = ReadingTest.objects.get(pk=pk)
        except ReadingTest.DoesNotExist:
            return Response({"error": "Test not found"}, status=404)

        existing_session = ReadingTestSession.objects.filter(
            user=user,
            test=test,
            completed=False
        ).first()

        from .serializers import ReadingTestDetailSerializer
        test_data = ReadingTestDetailSerializer(test).data

        if existing_session:
            return Response({
                "session_id": existing_session.id,
                "test": test_data,
                "message": "Resuming existing session"
            })

        session = ReadingTestSession.objects.create(
            user=user,
            test=test
        )

        return Response({
            "session_id": session.id,
            "test": test_data,
            "message": "New session started"
        })

class SubmitReadingTestView(APIView):
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
            session = ReadingTestSession.objects.get(id=session_id, user=user)
        except ReadingTestSession.DoesNotExist:
            return Response({"error": "Session not found or doesn't belong to the user."}, status=status.HTTP_404_NOT_FOUND)

        session.answers = request.data.get("answers", {})
        session.completed = True
        session.completed_at = timezone.now()
        raw_score = session.calculate_score()
        band_score = session.convert_to_band(raw_score)
        session.raw_score = raw_score
        session.band_score = band_score
        session.save()
        serializer = ReadingTestSessionResultSerializer(session, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

class ReadingTestSessionListView(ListAPIView):
    serializer_class = ReadingTestSessionSerializer  # Исправлено: правильный сериализатор
    permission_classes = [AllowAny]

    def get_queryset(self):
        auth_header = self.request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return ReadingTestSession.objects.none()
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return ReadingTestSession.objects.none()
        uid = decoded['uid']
        try:
            user = User.objects.get(uid=uid)
            return ReadingTestSession.objects.filter(
                user=user,
                completed=True
            ).select_related('test')
        except User.DoesNotExist:
            return ReadingTestSession.objects.none()

class ReadingTestSessionDetailView(RetrieveAPIView):
    serializer_class = ReadingTestSessionResultSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        auth_header = self.request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return ReadingTestSession.objects.none()
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return ReadingTestSession.objects.none()
        uid = decoded['uid']
        try:
            user = User.objects.get(uid=uid)
            return ReadingTestSession.objects.filter(
                user=user
            ).select_related('test')
        except User.DoesNotExist:
            return ReadingTestSession.objects.none()

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
        prompt_text = request.data.get('question_text')
        submitted_text = request.data.get('submitted_text')

        try:
            session = WritingTestSession.objects.get(id=session_id, user=user)
        except WritingTestSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=404)

        prompt = WritingPrompt.objects.filter(task_type=task_type, prompt_text=prompt_text).first()

        essay = Essay.objects.create(
            user=user,
            test_session=session,
            task_type=task_type,
            question_text=prompt_text,
            submitted_text=submitted_text,
            prompt=prompt
        )

        prompt_str = f"""
You are an IELTS examiner. Evaluate the following essay using 4 IELTS Writing criteria.  
Score each from 0 to 9 and return the result in plain text format like:

Task Response: 8.5
Coherence and Cohesion: 8
Lexical Resource: 8
Grammatical Range and Accuracy: 9

Feedback: <full feedback here>

Essay:
{essay.submitted_text}
"""

        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are an IELTS writing examiner."},
                {"role": "user", "content": prompt_str}
            ]
        )

        content = response.choices[0].message.content.strip()

        def extract_score(label):
            match = re.search(rf"{label}[:：]?\\s*(\\d+(\\.\\d+)?)", content, re.IGNORECASE)
            return float(match.group(1)) if match else 0

        def round_ielts_band(score):
            decimal = score - int(score)
            if decimal < 0.25:
                return float(int(score))
            elif decimal < 0.75:
                return float(int(score)) + 0.5
            else:
                return float(int(score)) + 1.0

        essay.score_task = extract_score("Task Response")
        essay.score_coherence = extract_score("Coherence and Cohesion")
        essay.score_lexical = extract_score("Lexical Resource")
        essay.score_grammar = extract_score("Grammatical Range and Accuracy")
        essay.overall_band = round_ielts_band((
            essay.score_task + essay.score_coherence + essay.score_lexical + essay.score_grammar
        ) / 4)
        essay.feedback = content
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

        total_score = 0
        essay_count = 0

        for essay in essays:
            if essay.overall_band:
                total_score += essay.overall_band
                essay_count += 1

        if essay_count > 0:
            overall_band = total_score / essay_count
        else:
            overall_band = 0

        return Response({
            'session_id': session.id,
            'overall_band': round(overall_band, 1),
            'essays_count': essay_count,
            'message': 'Session completed successfully'
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

class ReadingTestCreateView(APIView):
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
            if user.role != 'admin':
                return Response({'error': 'Admin access required'}, status=403)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=401)

        test_data = {
            'title': request.data.get('title'),
            'description': request.data.get('description', ''),
            'passage': request.data.get('passage')
        }
        test = ReadingTest.objects.create(
            title=test_data['title'],
            description=test_data['description']
        )
        if test_data['passage']:
            ReadingPassage.objects.create(
                test=test,
                text=test_data['passage']
            )
        return Response({
            'id': test.id, 
            'message': 'Test created successfully. Now you can add questions.',
            'test_id': test.id
        }, status=201)

class ReadingQuestionAddView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, test_id):
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

        try:
            test = ReadingTest.objects.get(id=test_id)
        except ReadingTest.DoesNotExist:
            return Response({'error': 'Test not found'}, status=404)

        question_data = {
            'question_type': request.data.get('question_type'),
            'question_text': request.data.get('question_text'),
            'order': request.data.get('order'),
            'paragraph_ref': request.data.get('paragraph_ref'),
            'image': request.FILES.get('image'),
            'test': test
        }
        question = ReadingQuestion.objects.create(**question_data)
        options_json = request.data.get('options', '[]')
        options_data = json.loads(options_json)
        for opt_data in options_data:
            AnswerOption.objects.create(
                question=question,
                label=opt_data.get('label'),
                text=opt_data.get('text')
            )
        correct_answer = request.data.get('correct_answer')
        if correct_answer:
            AnswerKey.objects.create(
                question=question,
                correct_answer=correct_answer
            )
        return Response({
            'message': 'Question added successfully',
            'question_id': question.id
        }, status=201)

class ActivateReadingTestView(APIView):
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
            if user.role != 'admin':
                return Response({'error': 'Admin access required'}, status=403)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=401)

        ReadingTest.objects.all().update(is_active=False)
        test = ReadingTest.objects.get(pk=pk)
        test.is_active = True
        test.save()
        return Response({'message': 'Test activated', 'id': test.id})

class ReadingTestUpdateDeleteView(RetrieveUpdateDestroyAPIView):
    queryset = ReadingTest.objects.all()
    serializer_class = ReadingTestCreateSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        auth_header = self.request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return ReadingTest.objects.none()
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return ReadingTest.objects.none()
        uid = decoded['uid']
        try:
            user = User.objects.get(uid=uid)
            if user.role != 'admin':
                return ReadingTest.objects.none()
        except User.DoesNotExist:
            return ReadingTest.objects.none()

        return ReadingTest.objects.all()

class ReadingQuestionUpdateDeleteView(RetrieveUpdateDestroyAPIView):
    queryset = ReadingQuestion.objects.all()
    serializer_class = ReadingQuestionUpdateSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        auth_header = self.request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return ReadingQuestion.objects.none()
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return ReadingQuestion.objects.none()
        uid = decoded['uid']
        try:
            user = User.objects.get(uid=uid)
            if user.role != 'admin':
                return ReadingQuestion.objects.none()
        except User.DoesNotExist:
            return ReadingQuestion.objects.none()

        return ReadingQuestion.objects.all()

class AdminReadingSessionListView(ListAPIView):
    serializer_class = ReadingTestSessionSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        auth_header = self.request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return ReadingTestSession.objects.none()
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return ReadingTestSession.objects.none()
        try:
            user = User.objects.get(uid=decoded['uid'])
            if user.role != 'admin':
                return ReadingTestSession.objects.none()
        except User.DoesNotExist:
            return ReadingTestSession.objects.none()
        queryset = ReadingTestSession.objects.filter(completed=True).select_related('user', 'test').order_by('-completed_at')
        student_id = self.request.query_params.get('student_id')
        if student_id:
            queryset = queryset.filter(user__student_id=student_id)
        return queryset

class AdminReadingSessionDetailView(RetrieveAPIView):
    serializer_class = ReadingTestSessionResultSerializer
    permission_classes = [AllowAny]
    queryset = ReadingTestSession.objects.all()

    def get_object(self):
        auth_header = self.request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            raise PermissionDenied("No auth token provided.")
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            raise PermissionDenied("Invalid token.")
        try:
            user = User.objects.get(uid=decoded['uid'])
            if user.role != 'admin':
                raise PermissionDenied("You must be an admin to view this.")
        except User.DoesNotExist:
            raise PermissionDenied("User not found.")
        return super().get_object()

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
        print(f"[DEBUG] SUBMIT: raw_score={raw_score}, total_questions={session.total_questions_count}, band_score={band_score}")
        print(f"[DEBUG] SUBMIT: answers={session.answers}")
        session.score = raw_score
        session.correct_answers_count = raw_score
        session.total_questions_count = session.total_questions_count
        session.save()
        print(f"[DEBUG] SESSION SAVED: id={session.id}, score={session.score}, correct_answers_count={session.correct_answers_count}, total_questions_count={session.total_questions_count}, submitted={session.submitted}")
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
    permission_classes = [AllowAny]  # TODO: restrict to admin for write operations

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
    permission_classes = [AllowAny]  # TODO: restrict to admin for write

# --- ListeningQuestion CRUD ---
class ListeningQuestionViewSet(viewsets.ModelViewSet):
    queryset = ListeningQuestion.objects.all().order_by('part', 'order')
    serializer_class = ListeningQuestionSerializer
    permission_classes = [AllowAny]  # TODO: restrict to admin for write

# --- ListeningTestSession: start, sync, submit ---
class ListeningTestSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, test_id=None, session_id=None):
        # Start or submit session
        if test_id is not None:
            # Start new session
            test = get_object_or_404(ListeningTest, pk=test_id, is_active=True)
            
            # Check if user already has an active session for this test (IELTS rule: one sitting)
            # existing_session = ListeningTestSession.objects.filter(
            #     user=request.user, 
            #     test=test, 
            #     submitted=False
            # ).first()
            #
            # if existing_session:
            #     return Response({
            #         'detail': 'You already have an active session for this test. Complete it first.',
            #         'session_id': existing_session.id
            #     }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create new session with IELTS rules
            session = ListeningTestSession.objects.create(
                user=request.user, 
                test=test,
                time_left=1800,  # 30 minutes for IELTS Listening
                status='in_progress'
            )
            serializer = ListeningTestSessionSerializer(session)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        elif session_id is not None:
            # Submit session
            session = get_object_or_404(ListeningTestSession, pk=session_id, user=request.user)
            if session.submitted:
                return Response({'detail': 'Session already submitted'}, status=status.HTTP_400_BAD_REQUEST)
            serializer = ListeningTestSessionSubmitSerializer(session, data=request.data)
            serializer.is_valid(raise_exception=True)
            session = serializer.save(submitted=True)

            # --- Автопроверка и создание ListeningTestResult ---
            from .serializers import count_correct_subanswers
            raw_score = 0
            total_questions = 0
            breakdown = []
            for part in session.test.parts.all():
                for question in part.questions.all():
                    correct_answers = question.correct_answers or []
                    options = list(question.options.all()) if hasattr(question, 'options') else None
                    qc, qt = count_correct_subanswers(
                        '', correct_answers, question.question_type, getattr(question, 'extra_data', None),
                        all_user_answers=session.answers, question_id=str(question.id), options=options, points=getattr(question, 'points', 1)
                    )
                    raw_score += qc
                    total_questions += qt
                    q_text = question.question_text or ''
                    if isinstance(correct_answers, list) and len(correct_answers) == 1:
                        c_answer = correct_answers[0]
                    else:
                        c_answer = correct_answers
                    user_answer = session.answers.get(f"{question.id}", '')
                    breakdown.append({
                        'question_id': question.id,
                        'question_text': q_text,
                        'user_answer': user_answer,
                        'correct_answer': c_answer,
                        'is_correct': qc == qt if qt > 0 else False,
                        'question_type': question.question_type,
                    })
            # IELTS band conversion (примерная шкала)
            def convert_to_band(raw_score):
                if raw_score >= 39: return 9.0
                if raw_score >= 37: return 8.5
                if raw_score >= 35: return 8.0
                if raw_score >= 33: return 7.5
                if raw_score >= 30: return 7.0
                if raw_score >= 27: return 6.5
                if raw_score >= 23: return 6.0
                if raw_score >= 19: return 5.5
                if raw_score >= 15: return 5.0
                if raw_score >= 12: return 4.5
                if raw_score <= 11: return 4.0
                return 0.0
            band_score = convert_to_band(raw_score)
            # Сохраняем баллы в сессию
            session.score = raw_score
            session.correct_answers_count = raw_score
            session.total_questions_count = total_questions
            session.save()
            print(f"[DEBUG] SUBMIT: raw_score={raw_score}, total_questions={total_questions}, band_score={band_score}")
            print(f"[DEBUG] SUBMIT: answers={session.answers}")
            session.score = raw_score
            session.correct_answers_count = raw_score
            session.total_questions_count = total_questions
            session.save()
            print(f"[DEBUG] SESSION SAVED: id={session.id}, score={session.score}, correct_answers_count={session.correct_answers_count}, total_questions_count={session.total_questions_count}, submitted={session.submitted}")
            from .models import ListeningTestResult
            ListeningTestResult.objects.update_or_create(
                session=session,
                defaults={
                    'raw_score': raw_score,
                    'band_score': band_score,
                    'breakdown': breakdown
                }
            )
            from .serializers import ListeningTestSessionResultSerializer
            result_serializer = ListeningTestSessionResultSerializer(session)
            return Response(result_serializer.data, status=status.HTTP_200_OK)
        return Response({'detail': 'Invalid request'}, status=status.HTTP_400_BAD_REQUEST)

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
    permission_classes = [AllowAny]  # TODO: restrict to admin

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
        user = request.user
        if not hasattr(user, 'role') or user.role != 'admin':
            return Response({'detail': 'Only admin can export CSV'}, status=403)
        try:
            test = ListeningTest.objects.get(id=test_id)
        except ListeningTest.DoesNotExist:
            return Response({'detail': 'Test not found'}, status=404)
        sessions = ListeningTestSession.objects.filter(test=test, submitted=True).select_related('user').order_by('user__uid', 'started_at')
        # Формируем CSV
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="listening_test_{test_id}_results.csv"'
        writer = csv.writer(response)
        # Заголовки
        writer.writerow([
            'test_id', 'test_title', 'student_uid', 'attempt_id', 'attempt_datetime',
            'correct_count', 'incorrect_count', 'correct_questions', 'incorrect_questions'
        ])
        from .serializers import create_detailed_breakdown
        for session in sessions:
            user = session.user
            attempt_id = session.id
            attempt_datetime = session.started_at.strftime('%Y-%m-%d %H:%M:%S') if session.started_at else ''
            breakdown = create_detailed_breakdown(session)
            correct_count = 0
            incorrect_count = 0
            correct_questions = []
            incorrect_questions = []
            question_number = 1
            for part in breakdown:
                for q in part['questions']:
                    # Вопрос считается правильным, если все sub_answers правильные
                    sub_answers = q.get('sub_answers', [])
                    if not sub_answers:
                        continue
                    all_correct = all(sa.get('is_correct') for sa in sub_answers)
                    if all_correct:
                        correct_count += 1
                        correct_questions.append(str(question_number))
                    else:
                        incorrect_count += 1
                        incorrect_questions.append(str(question_number))
                    question_number += 1
            writer.writerow([
                test.id,
                test.title,
                user.uid,
                attempt_id,
                attempt_datetime,
                correct_count,
                incorrect_count,
                ';'.join(correct_questions),
                ';'.join(incorrect_questions)
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
