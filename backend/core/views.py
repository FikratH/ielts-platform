from openai import OpenAI
import os
from dotenv import load_dotenv
load_dotenv()
from .utils import CsrfExemptAPIView
from .firebase_config import verify_firebase_token
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView, RetrieveAPIView, RetrieveUpdateDestroyAPIView
from .models import ReadingTest, ReadingQuestion, AnswerKey, ReadingTestSession, AnswerOption, ReadingPassage, ListeningTest, ListeningQuestion, ListeningAnswerKey, ListeningTestSession, ListeningAnswerOption, ListeningAudio
from .serializers import (
    ReadingTestListSerializer, ReadingTestDetailSerializer, EssaySerializer, WritingPromptSerializer,
    ReadingTestSessionSerializer, ReadingPassageSerializer, ReadingTestCreateSerializer, ReadingQuestionSerializer, ReadingQuestionUpdateSerializer, ReadingTestSessionResultSerializer,
    ListeningTestListSerializer, ListeningTestDetailSerializer, ListeningTestSessionSerializer, ListeningTestCreateSerializer, ListeningQuestionUpdateSerializer, ListeningTestSessionResultSerializer
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
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.middleware.csrf import get_token
from rest_framework.parsers import JSONParser

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
                        return ListeningTest.objects.all()
                except User.DoesNotExist:
                    pass
        return ListeningTest.objects.filter(is_active=True)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class ListeningTestDetailView(RetrieveAPIView):
    serializer_class = ListeningTestDetailSerializer
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

        from .serializers import ListeningTestDetailSerializer
        test_data = ListeningTestDetailSerializer(test).data

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
        from .serializers import ListeningTestSessionResultSerializer
        serializer = ListeningTestSessionResultSerializer(session, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class ListeningTestSessionListView(ListAPIView):
    serializer_class = ListeningTestSessionSerializer
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
                completed=True
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


class ListeningTestCreateView(APIView):
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
            'audio_file': request.FILES.get('audio_file')
        }
        test = ListeningTest.objects.create(
            title=test_data['title'],
            description=test_data['description']
        )
        if test_data['audio_file']:
            ListeningAudio.objects.create(
                test=test,
                audio_file=test_data['audio_file']
            )
        return Response({
            'id': test.id, 
            'message': 'Test created successfully. Now you can add questions.',
            'test_id': test.id
        }, status=201)


class ListeningQuestionAddView(APIView):
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
            test = ListeningTest.objects.get(id=test_id)
        except ListeningTest.DoesNotExist:
            return Response({'error': 'Test not found'}, status=404)

        question_data = {
            'question_type': request.data.get('question_type'),
            'question_text': request.data.get('question_text'),
            'order': request.data.get('order'),
            'image': request.FILES.get('image'),
            'test': test
        }
        question = ListeningQuestion.objects.create(**question_data)
        options_json = request.data.get('options', '[]')
        options_data = json.loads(options_json)
        for opt_data in options_data:
            ListeningAnswerOption.objects.create(
                question=question,
                label=opt_data.get('label'),
                text=opt_data.get('text')
            )
        correct_answer = request.data.get('correct_answer')
        if correct_answer:
            ListeningAnswerKey.objects.create(
                question=question,
                correct_answer=correct_answer
            )
        return Response({
            'message': 'Question added successfully',
            'question_id': question.id
        }, status=201)


class ActivateListeningTestView(APIView):
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

        ListeningTest.objects.all().update(is_active=False)
        test = ListeningTest.objects.get(pk=pk)
        test.is_active = True
        test.save()
        return Response({'message': 'Test activated', 'id': test.id})


class ListeningTestUpdateDeleteView(RetrieveUpdateDestroyAPIView):
    queryset = ListeningTest.objects.all()
    serializer_class = ListeningTestCreateSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        auth_header = self.request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return ListeningTest.objects.none()
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return ListeningTest.objects.none()
        uid = decoded['uid']
        try:
            user = User.objects.get(uid=uid)
            if user.role != 'admin':
                return ListeningTest.objects.none()
        except User.DoesNotExist:
            return ListeningTest.objects.none()

        return ListeningTest.objects.all()


class ListeningQuestionUpdateDeleteView(RetrieveUpdateDestroyAPIView):
    queryset = ListeningQuestion.objects.all()
    serializer_class = ListeningQuestionUpdateSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        auth_header = self.request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return ListeningQuestion.objects.none()
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return ListeningQuestion.objects.none()
        uid = decoded['uid']
        try:
            user = User.objects.get(uid=uid)
            if user.role != 'admin':
                return ListeningQuestion.objects.none()
        except User.DoesNotExist:
            return ListeningQuestion.objects.none()

        return ListeningQuestion.objects.all()


class AdminListeningSessionListView(ListAPIView):
    serializer_class = ListeningTestSessionSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        auth_header = self.request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return ListeningTestSession.objects.none()
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return ListeningTestSession.objects.none()
        try:
            user = User.objects.get(uid=decoded['uid'])
            if user.role != 'admin':
                return ListeningTestSession.objects.none()
        except User.DoesNotExist:
            return ListeningTestSession.objects.none()
        queryset = ListeningTestSession.objects.filter(completed=True).select_related('user', 'test').order_by('-completed_at')
        student_id = self.request.query_params.get('student_id')
        if student_id:
            queryset = queryset.filter(user__student_id=student_id)
        return queryset


class AdminListeningSessionDetailView(RetrieveAPIView):
    serializer_class = ListeningTestSessionResultSerializer
    permission_classes = [AllowAny]
    queryset = ListeningTestSession.objects.all()

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
