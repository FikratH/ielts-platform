import os
import csv
from dotenv import load_dotenv
load_dotenv()
from django_ratelimit.decorators import ratelimit
from django.utils.decorators import method_decorator
import logging
import magic

security_logger = logging.getLogger('security')

def ielts_round_score(score):
    if score is None:
        return None
    try:
        score = float(score)
        decimal = score - int(score)
        if decimal < 0.25:
            return int(score)
        elif decimal < 0.75:
            return int(score) + 0.5
        else:
            return int(score) + 1.0
    except (ValueError, TypeError):
        return None

def compute_ielts_average(values):
    nums = [v for v in values if v is not None]
    if not nums:
        return None
    avg = sum(nums) / len(nums)
    return ielts_round_score(avg)
from .utils import CsrfExemptAPIView
from django.http import HttpResponse
from .firebase_config import verify_firebase_token
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView, RetrieveAPIView, RetrieveUpdateDestroyAPIView
from .models import ListeningTest, ListeningTestSession
from .serializers import (
    EssaySerializer, WritingPromptSerializer, WritingTestSerializer, WritingTaskSerializer, WritingTestSessionSerializer,
    ListeningTestListSerializer, ListeningTestDetailSerializer, ListeningTestSessionSerializer, ListeningTestSessionResultSerializer,
    ListeningTestSessionHistorySerializer, ReadingTestSessionHistorySerializer
)
from .models import WritingTestSession, WritingTest, WritingTask
from rest_framework import serializers
from rest_framework import viewsets
from .models import WritingPrompt
from .serializers import WritingPromptSerializer
from rest_framework.generics import ListAPIView
from .models import Essay, User, TeacherFeedback, SpeakingSession, PlacementTestQuestion, PlacementTestSubmission
from .serializers import EssaySerializer
from .permissions import IsAdmin, IsTeacher, IsTeacherOrCurator
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
import re
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.utils import timezone
from datetime import timedelta, datetime
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
from .serializers import create_listening_detailed_breakdown
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
from .ai_feedback import (
    build_feedback_payload,
    generate_ai_feedback,
    cache_feedback,
    AI_FEEDBACK_PROMPT_VERSION,
)
from .models import TeacherSatisfactionSurvey
from .serializers import TeacherSatisfactionSurveySerializer
from django.db import models, transaction
from .permissions import IsCurator, IsTeacherOrCurator
from django.utils import timezone
from datetime import timedelta
from .email_utils import send_writing_feedback_published_email
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .auth import verify_firebase_token
from .models import (
    ListeningTestSession, ListeningTestResult,
    ReadingTestSession, ReadingTestResult,
    Essay, TeacherFeedback, User, SpeakingSession
)


def _parse_date_param(value):
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except (TypeError, ValueError):
        return None

def _parse_date_body(value):
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except (TypeError, ValueError):
        return None


def apply_date_range_filter(queryset, request, field_name):
    date_from = _parse_date_param(request.query_params.get('date_from'))
    date_to = _parse_date_param(request.query_params.get('date_to'))
    if date_from:
        queryset = queryset.filter(**{f'{field_name}__date__gte': date_from})
    if date_to:
        queryset = queryset.filter(**{f'{field_name}__date__lte': date_to})
    return queryset

def _require_roles(request, allowed_roles=('admin', 'curator')):
    """Bearer Firebase auth + role check; returns (user, error_response_or_none)."""
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if not auth_header.startswith('Bearer '):
        return None, Response({'error': 'Authentication required'}, status=401)
    id_token = auth_header.split(' ')[1]
    decoded = verify_firebase_token(id_token)
    if not decoded:
        return None, Response({'error': 'Invalid token'}, status=401)
    uid = decoded.get('uid')
    try:
        user = User.objects.get(uid=uid)
    except User.DoesNotExist:
        return None, Response({'error': 'User not found'}, status=401)
    if allowed_roles and user.role not in allowed_roles:
        return None, Response({'error': 'Access forbidden'}, status=403)
    return user, None

def _normalize_emails(emails):
    seen = set()
    result = []
    for e in emails or []:
        if not e:
            continue
        lowered = e.strip().lower()
        if lowered and lowered not in seen:
            seen.add(lowered)
            result.append(lowered)
    return result

# ------------------------------
# User Profile Views
# ------------------------------
class UserProfileView(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request):
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
            return Response({
                'first_name': user.first_name,
                'last_name': user.last_name,
                'email': user.email,
                'role': user.role,
                'student_id': user.student_id,
                'group': user.group,
                'teacher': user.teacher,
                'uid': user.uid
            })
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)

# ------------------------------
# Student Dashboard Summary View
# ------------------------------
class DashboardSummaryView(APIView):
    permission_classes = [AllowAny]

    def _get_current_user(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return None
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return None
        uid = decoded.get('uid')
        try:
            return User.objects.get(uid=uid)
        except User.DoesNotExist:
            return None

    def get(self, request):
        user = self._get_current_user(request)
        if not user:
            return Response({'detail': 'Authentication required'}, status=401)

        now = timezone.now()
        since_30d = now - timedelta(days=30)

        # Listening aggregates
        listen_qs = ListeningTestSession.objects.filter(user=user)
        listen_30_qs = listen_qs.filter(models.Q(completed_at__gte=since_30d) | models.Q(started_at__gte=since_30d))

        listening_completed_all = listen_qs.filter(submitted=True).count()
        listening_completed_30d = listen_30_qs.filter(submitted=True).count()

        listen_results = ListeningTestResult.objects.filter(session__in=listen_qs)
        listen_band_all = listen_results.aggregate(avg=models.Avg('band_score'))['avg']
        listen_results_30 = ListeningTestResult.objects.filter(session__in=listen_30_qs)
        listen_band_30d = listen_results_30.aggregate(avg=models.Avg('band_score'))['avg']

        last_listen = listen_qs.order_by(models.F('completed_at').desc(nulls_last=True), models.F('started_at').desc()).first()
        last_listen_band = None
        last_listen_date = None
        last_listen_accuracy = None
        if last_listen:
            last_listen_date = last_listen.completed_at or last_listen.started_at
            lr = ListeningTestResult.objects.filter(session=last_listen).first()
            last_listen_band = (lr.band_score if lr else None)
            if last_listen.total_questions_count:
                last_listen_accuracy = round(100.0 * (last_listen.correct_answers_count or 0) / max(1, last_listen.total_questions_count), 1)

        # Compute average accuracy over 30 days if possible
        accuracy_samples = []
        for row in listen_30_qs.values('correct_answers_count', 'total_questions_count'):
            total = row.get('total_questions_count') or 0
            correct = row.get('correct_answers_count') or 0
            if total > 0:
                accuracy_samples.append(100.0 * correct / total)
        # Fallback: derive accuracy from ListeningTestResult.raw_score when session counters are empty
        if not accuracy_samples:
            for row in ListeningTestResult.objects.filter(session__in=listen_30_qs).values('raw_score', 'session__total_questions_count'):
                total = row.get('session__total_questions_count') or 0
                raw = row.get('raw_score') or 0
                if total > 0:
                    accuracy_samples.append(100.0 * raw / total)
        listen_accuracy_avg_30d = round(sum(accuracy_samples) / len(accuracy_samples), 1) if accuracy_samples else None

        listening = {
            'totals': {
                'completed_all': listening_completed_all,
                'completed_30d': listening_completed_30d,
            },
            'avg': {
                'band_all': listen_band_all,
                'band_30d': listen_band_30d,
            },
            'last_result': {
                'band': last_listen_band,
                'date': last_listen_date,
            },
            'accuracy': {
                'last_test_percent': last_listen_accuracy,
                'avg_30d_percent': listen_accuracy_avg_30d,
            }
        }

        # Reading aggregates
        reading_qs = ReadingTestSession.objects.filter(user=user)
        reading_30_qs = reading_qs.filter(models.Q(end_time__gte=since_30d) | models.Q(start_time__gte=since_30d))

        reading_completed_all = reading_qs.filter(completed=True).count()
        reading_completed_30d = reading_30_qs.filter(completed=True).count()

        read_results = ReadingTestResult.objects.filter(session__in=reading_qs)
        read_band_all = read_results.aggregate(avg=models.Avg('band_score'))['avg']
        read_score_all = read_results.aggregate(avg=models.Avg('total_score'))['avg']
        read_results_30 = ReadingTestResult.objects.filter(session__in=reading_30_qs)
        read_band_30d = read_results_30.aggregate(avg=models.Avg('band_score'))['avg']
        read_score_30d = read_results_30.aggregate(avg=models.Avg('total_score'))['avg']

        last_reading = reading_qs.order_by(models.F('end_time').desc(nulls_last=True), models.F('start_time').desc()).first()
        last_read_band = None
        last_read_score = None
        last_read_date = None
        last_read_accuracy = None
        if last_reading:
            last_read_date = last_reading.end_time or last_reading.start_time
            rr = ReadingTestResult.objects.filter(session=last_reading).first()
            if rr:
                last_read_band = rr.band_score
                last_read_score = rr.total_score
                if getattr(rr, 'raw_score', None) is not None and rr.total_score:
                    last_read_accuracy = round(100.0 * rr.raw_score / max(1.0, rr.total_score), 1)

        reading = {
            'totals': {
                'completed_all': reading_completed_all,
                'completed_30d': reading_completed_30d,
            },
            'avg': {
                'band_all': read_band_all,
                'score_all': read_score_all,
                'band_30d': read_band_30d,
                'score_30d': read_score_30d,
            },
            'last_result': {
                'band': last_read_band,
                'score': last_read_score,
                'date': last_read_date,
            },
            'accuracy': {
                'last_test_percent': last_read_accuracy,
            }
        }

        # Writing aggregates
        essays_qs = Essay.objects.filter(user=user)
        essays_30_qs = essays_qs.filter(submitted_at__gte=since_30d)
        essays_count_all = essays_qs.count()
        essays_count_30d = essays_30_qs.count()
        sessions_30d = essays_30_qs.exclude(test_session__isnull=True).values('test_session').distinct().count()

        write_avg_all = essays_qs.aggregate(avg=models.Avg('overall_band'))['avg']
        write_avg_30d = essays_30_qs.aggregate(avg=models.Avg('overall_band'))['avg']

        last_essay = essays_qs.order_by('-submitted_at').first()
        last_feedback = None
        if last_essay:
            tf = TeacherFeedback.objects.filter(essay=last_essay).first()
            if tf:
                last_feedback = {
                    'published': tf.published,
                    'teacher_overall_score': tf.teacher_overall_score,
                }
            else:
                last_feedback = {
                    'published': None,
                    'teacher_overall_score': None,
                }

        writing = {
            'totals': {
                'essays_all': essays_count_all,
                'essays_30d': essays_count_30d,
                'sessions_30d': sessions_30d,
            },
            'avg': {
                'overall_band_all': write_avg_all,
                'overall_band_30d': write_avg_30d,
            },
            'last_feedback': last_feedback,
        }

        # Diagnostic quick summary
        diag_locked = (
            ListeningTestSession.objects.filter(user=user, submitted=True, is_diagnostic=False).exists() or
            ReadingTestSession.objects.filter(user=user, completed=True, is_diagnostic=False).exists() or
            WritingTestSession.objects.filter(user=user, completed=True, is_diagnostic=False).exists()
        )
        # Diagnostic details
        diag_l_session = ListeningTestSession.objects.filter(user=user, submitted=True, is_diagnostic=True).first()
        diag_r_session = ReadingTestSession.objects.filter(user=user, completed=True, is_diagnostic=True).first()
        
        diag_w_session = WritingTestSession.objects.filter(user=user, completed=True, is_diagnostic=True).first()
        diag_w_band = None
        if diag_w_session:
            essays = Essay.objects.filter(test_session=diag_w_session)
            bands = [e.overall_band for e in essays if e.overall_band is not None]
            if bands:
                avg = sum(bands) / len(bands)
                dec = avg - int(avg)
                if dec < 0.25:
                    diag_w_band = float(int(avg))
                elif dec < 0.75:
                    diag_w_band = float(int(avg)) + 0.5
                else:
                    diag_w_band = float(int(avg)) + 1.0

        def ielts_round(score):
            if score is None:
                return None
            whole = int(score)
            dec = score - whole
            if dec < 0.25:
                return float(whole)
            if dec < 0.75:
                return float(whole) + 0.5
            return float(whole) + 1.0

        diagnostic = {
            'locked': diag_locked,
            'listening_done': diag_l_session is not None,
            'reading_done': diag_r_session is not None,
            'writing_done': diag_w_session is not None,
            'listening': {
                'band': ListeningTestResult.objects.filter(session=diag_l_session).first().band_score if diag_l_session else None,
                'date': diag_l_session.completed_at if diag_l_session else None,
                'session_id': diag_l_session.id if diag_l_session else None,
            } if diag_l_session else None,
            'reading': {
                'band': ReadingTestResult.objects.filter(session=diag_r_session).first().band_score if diag_r_session else None,
                'date': diag_r_session.end_time if diag_r_session else None,
                'session_id': diag_r_session.id if diag_r_session else None,
            } if diag_r_session else None,
            'writing': {
                'band': diag_w_band,
                'date': essays.order_by('-submitted_at').first().submitted_at if diag_w_session and essays.exists() else None,
                'session_id': diag_w_session.id if diag_w_session else None,
            } if diag_w_session else None,
        }
        
        # Add completion count
        diagnostic['completed_count'] = (
            int( diagnostic['listening_done']) + 
            int( diagnostic['reading_done']) + 
            int( diagnostic['writing_done'])
        )

        bands = [
            diagnostic['listening']['band'] if diagnostic.get('listening') else None,
            diagnostic['reading']['band'] if diagnostic.get('reading') else None,
            diagnostic['writing']['band'] if diagnostic.get('writing') else None,
        ]
        filled = [b for b in bands if b is not None]
        diagnostic['overall_band'] = ielts_round(sum(filled)/len(filled)) if len(filled) == 3 else None

        return Response({
            'listening': listening,
            'reading': reading,
            'writing': writing,
            'diagnostic': diagnostic,
        })


# ------------------------------
# Diagnostic Summary Endpoints
# ------------------------------
class DiagnosticSummaryView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
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
            return Response({'error': 'User not found'}, status=404)

        locked = (
            ListeningTestSession.objects.filter(user=user, submitted=True, is_diagnostic=False).exists() or
            ReadingTestSession.objects.filter(user=user, completed=True, is_diagnostic=False).exists() or
            WritingTestSession.objects.filter(user=user, completed=True, is_diagnostic=False).exists()
        )

        # Listening
        l_session = ListeningTestSession.objects.filter(user=user, submitted=True, is_diagnostic=True).order_by('-completed_at').first()
        l_band = None
        l_date = None
        l_sid = None
        if l_session:
            l_res = ListeningTestResult.objects.filter(session=l_session).first()
            l_band = l_res.band_score if l_res else None
            l_date = l_session.completed_at or l_session.started_at
            l_sid = l_session.id

        # Reading
        r_session = ReadingTestSession.objects.filter(user=user, completed=True, is_diagnostic=True).order_by('-end_time').first()
        r_band = None
        r_date = None
        r_sid = None
        if r_session:
            r_res = ReadingTestResult.objects.filter(session=r_session).first()
            r_band = r_res.band_score if r_res else None
            r_date = r_session.end_time or r_session.start_time
            r_sid = r_session.id

        # Writing
        w_session = WritingTestSession.objects.filter(user=user, completed=True, is_diagnostic=True).order_by('-started_at').first()
        w_band = None
        w_date = None
        w_sid = None
        if w_session:
            # Average overall band across essays in this session
            essays = Essay.objects.filter(test_session=w_session)
            bands = [e.overall_band for e in essays if e.overall_band is not None]
            if bands:
                avg = sum(bands) / len(bands)
                dec = avg - int(avg)
                if dec < 0.25:
                    w_band = float(int(avg))
                elif dec < 0.75:
                    w_band = float(int(avg)) + 0.5
                else:
                    w_band = float(int(avg)) + 1.0
            w_date = essays.order_by('-submitted_at').first().submitted_at if essays.exists() else None
            w_sid = w_session.id

        completed_count = int(l_band is not None) + int(r_band is not None) + int(w_band is not None)

        overall_band = None
        if completed_count == 3:
            avg = (l_band + r_band + w_band) / 3.0
            dec = avg - int(avg)
            if dec < 0.25:
                overall_band = float(int(avg))
            elif dec < 0.75:
                overall_band = float(int(avg)) + 0.5
            else:
                overall_band = float(int(avg)) + 1.0

        return Response({
            'locked': locked,
            'listening': {'band': l_band, 'date': l_date, 'session_id': l_sid},
            'reading': {'band': r_band, 'date': r_date, 'session_id': r_sid},
            'writing': {'band': w_band, 'date': w_date, 'session_id': w_sid},
            'completed_count': completed_count,
            'overall_band': overall_band,
        })


class CuratorDiagnosticResultsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
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
            if user.role not in ['teacher', 'curator']:
                return Response({'error': 'Access denied'}, status=403)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)

        group = request.query_params.get('group')
        teacher = request.query_params.get('teacher')
        search = request.query_params.get('search')

        students_with_diagnostics = []

        listening_diag_qs = ListeningTestSession.objects.filter(submitted=True, is_diagnostic=True)
        listening_diag_qs = apply_date_range_filter(listening_diag_qs, request, 'completed_at')

        reading_diag_qs = ReadingTestSession.objects.filter(completed=True, is_diagnostic=True)
        reading_diag_qs = apply_date_range_filter(reading_diag_qs, request, 'end_time')

        writing_diag_qs = WritingTestSession.objects.filter(completed=True, is_diagnostic=True)
        writing_diag_qs = apply_date_range_filter(writing_diag_qs, request, 'started_at')

        students_qs = User.objects.filter(role='student', is_active=True)
        if group:
            students_qs = students_qs.filter(group=group)
        if teacher:
            students_qs = students_qs.filter(teacher=teacher)
        if search:
            search = search.strip()
            if search:
                students_qs = students_qs.filter(
                    models.Q(first_name__icontains=search) |
                    models.Q(last_name__icontains=search) |
                    models.Q(student_id__icontains=search) |
                    models.Q(email__icontains=search)
                )

        diagnostic_students = set()
        diagnostic_students.update(listening_diag_qs.filter(user__in=students_qs).values_list('user_id', flat=True))
        diagnostic_students.update(reading_diag_qs.filter(user__in=students_qs).values_list('user_id', flat=True))
        diagnostic_students.update(writing_diag_qs.filter(user__in=students_qs).values_list('user_id', flat=True))

        students_qs = students_qs.filter(id__in=diagnostic_students)

        for student in students_qs:
            try:
                l_session = listening_diag_qs.filter(user=student).order_by('-completed_at').first()
                r_session = reading_diag_qs.filter(user=student).order_by('-end_time').first()
                w_session = writing_diag_qs.filter(user=student).order_by('-started_at').first()

                l_band = None
                l_date = None
                if l_session:
                    l_res = ListeningTestResult.objects.filter(session=l_session).first()
                    l_band = l_res.band_score if l_res else None
                    l_date = l_session.completed_at or l_session.started_at

                r_band = None
                r_date = None
                if r_session:
                    r_res = ReadingTestResult.objects.filter(session=r_session).first()
                    r_band = r_res.band_score if r_res else None
                    r_date = r_session.end_time or r_session.start_time

                w_band = None
                w_date = None
                if w_session:
                    essays = Essay.objects.filter(test_session=w_session)
                    bands = [e.overall_band for e in essays if e.overall_band is not None]
                    if bands:
                        avg = sum(bands) / len(bands)
                        dec = avg - int(avg)
                        if dec < 0.25:
                            w_band = float(int(avg))
                        elif dec < 0.75:
                            w_band = float(int(avg)) + 0.5
                        else:
                            w_band = float(int(avg)) + 1.0
                    w_date = essays.order_by('-submitted_at').first().submitted_at if essays.exists() else None

                completed_count = int(l_band is not None) + int(r_band is not None) + int(w_band is not None)
                
                overall_band = None
                if completed_count == 3:
                    avg = (l_band + r_band + w_band) / 3.0
                    dec = avg - int(avg)
                    if dec < 0.25:
                        overall_band = float(int(avg))
                    elif dec < 0.75:
                        overall_band = float(int(avg)) + 0.5
                    else:
                        overall_band = float(int(avg)) + 1.0

                students_with_diagnostics.append({
                    'student_id': student.id,
                    'student_name': f"{student.first_name} {student.last_name}".strip() or student.email,
                    'email': student.email,
                    'listening': {'band': l_band, 'date': l_date},
                    'reading': {'band': r_band, 'date': r_date},
                    'writing': {'band': w_band, 'date': w_date},
                    'completed_count': completed_count,
                    'overall_band': overall_band,
                })
            except User.DoesNotExist:
                continue

        # Sort by overall band score (completed students first)
        students_with_diagnostics.sort(key=lambda x: (
            -1 if x['overall_band'] is not None else 1,  # Completed first
            -(x['overall_band'] or 0)  # Then by band score descending
        ))

        # Calculate summary statistics
        completed_students = [s for s in students_with_diagnostics if s['completed_count'] == 3]
        total_diagnostic_students = len(students_with_diagnostics)
        avg_overall = None
        if completed_students:
            overall_bands = [s['overall_band'] for s in completed_students if s['overall_band'] is not None]
            avg_overall = sum(overall_bands) / len(overall_bands) if overall_bands else None

        return Response({
            'students': students_with_diagnostics,
            'summary': {
                'total_diagnostic_students': total_diagnostic_students,
                'completed_diagnostic_students': len(completed_students),
                'average_overall_band': avg_overall,
            }
        })


# ------------------------------
# Teacher Writing Feedback Views
# ------------------------------
from .serializers import TeacherFeedbackSerializer, TeacherFeedbackUpsertSerializer, TeacherEssayListItemSerializer

def get_teacher_from_request(request, allowed_roles=None):
    """Helper function to extract and validate teacher from request"""
    allowed_roles = allowed_roles or ('teacher',)
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if not auth_header.startswith('Bearer '):
        return None, Response({'error': 'Authentication required'}, status=401)
    id_token = auth_header.split(' ')[1]
    decoded = verify_firebase_token(id_token)
    if not decoded:
        return None, Response({'error': 'Invalid token'}, status=401)
    uid = decoded['uid']
    try:
        teacher = User.objects.get(uid=uid)
        if teacher.role not in allowed_roles:
            return None, Response({'error': 'Teacher access required'}, status=403)
        request.user = teacher
        return teacher, None
    except User.DoesNotExist:
        return None, Response({'error': 'User not found'}, status=404)



class TeacherEssayListView(ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = TeacherEssayListItemSerializer

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
            teacher = User.objects.get(uid=uid)
            if teacher.role != 'teacher':
                return Essay.objects.none()
        except User.DoesNotExist:
            return Essay.objects.none()
        qs = Essay.objects.select_related('user', 'prompt', 'test_session')
        
        # Связываем студентов с учителем через поле teacher (по имени)
        # Ищем студентов, у которых в поле teacher указано имя текущего учителя
        teacher_name = teacher.first_name
        if not teacher_name:
            # Если у учителя нет first_name, попробуем использовать student_id или полное имя
            teacher_name = teacher.student_id or f"{teacher.first_name} {teacher.last_name}".strip()
        
        if teacher_name:
            qs = qs.filter(user__teacher=teacher_name)
        else:
            # Если у учителя нет никакого идентификатора, возвращаем пустой queryset
            return qs.none()
        prompt_id = self.request.query_params.get('prompt_id')
        task_type = self.request.query_params.get('task_type')
        student_id = self.request.query_params.get('student_id')
        group = self.request.query_params.get('group')
        published = self.request.query_params.get('published')
        search = self.request.query_params.get('search')
        feedback_status = self.request.query_params.get('feedback_status')
        if prompt_id:
            qs = qs.filter(prompt_id=prompt_id)
        if task_type:
            t = str(task_type).strip().lower()
            if t in ['1', 'task1', 'task 1', 't1']:
                t = 'task1'
            elif t in ['2', 'task2', 'task 2', 't2']:
                t = 'task2'
            qs = qs.filter(task_type=t)
        if student_id:
            qs = qs.filter(user__student_id=student_id)
        if group:
            qs = qs.filter(user__group__icontains=group.strip())
        if published is not None:
            p = str(published).lower()
            if p in ['1', 'true', 'yes']:
                qs = qs.filter(teacher_feedback__published=True)
            elif p in ['0', 'false', 'no']:
                qs = qs.exclude(teacher_feedback__published=True)
        if feedback_status:
            fs = str(feedback_status).strip().lower()
            if fs in ['with', 'has', 'done', 'true', '1', 'yes']:
                qs = qs.filter(teacher_feedback__isnull=False)
            elif fs in ['without', 'none', 'missing', 'pending', 'false', '0', 'no']:
                qs = qs.filter(teacher_feedback__isnull=True)
        if search:
            s = search.strip()
            if s:
                qs = qs.filter(
                    models.Q(user__first_name__icontains=s) |
                    models.Q(user__last_name__icontains=s) |
                    models.Q(user__student_id__icontains=s) |
                    models.Q(user__email__icontains=s)
                )
        return qs.order_by('-submitted_at')

class TeacherEssayDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, essay_id):
        teacher, error_response = get_teacher_from_request(request)
        if error_response:
            return error_response
            
        essay = get_object_or_404(Essay.objects.select_related('user', 'prompt'), pk=essay_id)
        # Проверяем, что студент принадлежит этому учителю (по имени)
        teacher_name = teacher.first_name or teacher.student_id
        if essay.user.teacher != teacher_name:
            return Response({'error': 'Not allowed'}, status=403)
        feedback = getattr(essay, 'teacher_feedback', None)
        return Response({
            'essay': EssaySerializer(essay).data,
            'feedback': TeacherFeedbackSerializer(feedback).data if feedback else None
        })

class TeacherFeedbackSaveView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, essay_id):
        teacher, error_response = get_teacher_from_request(request)
        if error_response:
            return error_response
            
        essay = get_object_or_404(Essay.objects.select_related('user'), pk=essay_id)
        # Проверяем, что студент принадлежит этому учителю (по имени)
        teacher_name = teacher.first_name or teacher.student_id
        if essay.user.teacher != teacher_name:
            return Response({'error': 'Not allowed'}, status=403)
        upsert = TeacherFeedbackUpsertSerializer(data=request.data)
        upsert.is_valid(raise_exception=True)
        data = upsert.validated_data
        # Обрабатываем пустые строки как None для числовых полей
        def clean_score(score):
            if score == '' or score is None:
                return None
            try:
                return float(score)
            except (ValueError, TypeError):
                return None
        
        feedback, _ = TeacherFeedback.objects.update_or_create(
            essay=essay,
            defaults={
                'teacher': teacher,
                'overall_feedback': data.get('overall_feedback', ''),
                'annotations': data.get('annotations', []),
                'teacher_task_score': clean_score(data.get('teacher_task_score')),
                'teacher_coherence_score': clean_score(data.get('teacher_coherence_score')),
                'teacher_lexical_score': clean_score(data.get('teacher_lexical_score')),
                'teacher_grammar_score': clean_score(data.get('teacher_grammar_score')),
                'teacher_task_feedback': data.get('teacher_task_feedback', ''),
                'teacher_coherence_feedback': data.get('teacher_coherence_feedback', ''),
                'teacher_lexical_feedback': data.get('teacher_lexical_feedback', ''),
                'teacher_grammar_feedback': data.get('teacher_grammar_feedback', ''),
            }
        )
        return Response(TeacherFeedbackSerializer(feedback).data)

class TeacherFeedbackPublishView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, essay_id):
        teacher, error_response = get_teacher_from_request(request)
        if error_response:
            return error_response
            
        essay = get_object_or_404(Essay.objects.select_related('user'), pk=essay_id)
        # Проверяем, что студент принадлежит этому учителю (по имени)
        teacher_name = teacher.first_name or teacher.student_id
        if essay.user.teacher != teacher_name:
            return Response({'error': 'Not allowed'}, status=403)
        upsert = TeacherFeedbackUpsertSerializer(data=request.data)
        upsert.is_valid(raise_exception=True)
        data = upsert.validated_data
        from django.utils import timezone as dj_tz
        existing_feedback = TeacherFeedback.objects.filter(essay=essay).first()
        was_published = bool(existing_feedback and existing_feedback.published)
        # Обрабатываем пустые строки как None для числовых полей
        def clean_score(score):
            if score == '' or score is None:
                return None
            try:
                return float(score)
            except (ValueError, TypeError):
                return None
        
        feedback, _ = TeacherFeedback.objects.update_or_create(
            essay=essay,
            defaults={
                'teacher': teacher,
                'overall_feedback': data.get('overall_feedback', ''),
                'annotations': data.get('annotations', []),
                'teacher_task_score': clean_score(data.get('teacher_task_score')),
                'teacher_coherence_score': clean_score(data.get('teacher_coherence_score')),
                'teacher_lexical_score': clean_score(data.get('teacher_lexical_score')),
                'teacher_grammar_score': clean_score(data.get('teacher_grammar_score')),
                'teacher_task_feedback': data.get('teacher_task_feedback', ''),
                'teacher_coherence_feedback': data.get('teacher_coherence_feedback', ''),
                'teacher_lexical_feedback': data.get('teacher_lexical_feedback', ''),
                'teacher_grammar_feedback': data.get('teacher_grammar_feedback', ''),
                'published': True,
                'published_at': dj_tz.now(),
            }
        )
        if not was_published:
            try:
                send_writing_feedback_published_email(
                    student=essay.user,
                    teacher=teacher,
                    essay=essay,
                    session=essay.test_session,
                    task_type=essay.task_type
                )
            except Exception:
                pass
        return Response(TeacherFeedbackSerializer(feedback).data)

class StudentTeacherFeedbackView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, essay_id):
        essay = get_object_or_404(Essay, pk=essay_id, user=request.user)
        feedback = getattr(essay, 'teacher_feedback', None)
        if not feedback or not feedback.published:
            return Response({'error': 'Feedback not available'}, status=404)
        return Response({
            'essay': EssaySerializer(essay).data,
            'feedback': TeacherFeedbackSerializer(feedback).data
        })

# ------------------------------
# Session-level Writing Feedback (Teacher + Student)
# ------------------------------

class TeacherSessionFeedbackView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, session_id):
        teacher, error_response = get_teacher_from_request(request)
        if error_response:
            return error_response
        session = get_object_or_404(WritingTestSession.objects.select_related('user', 'test'), pk=session_id)
        teacher_name = teacher.first_name or teacher.student_id
        if session.user.teacher != teacher_name:
            return Response({'error': 'Not allowed'}, status=403)

        essays = Essay.objects.filter(test_session=session).select_related('prompt').order_by('task_type')
        items = []
        for e in essays:
            fb = getattr(e, 'teacher_feedback', None)
            items.append({
                'essay': EssaySerializer(e).data,
                'feedback': TeacherFeedbackSerializer(fb).data if fb else None
            })
        return Response({'session': {'id': session.id, 'user_id': session.user_id, 'test_id': session.test_id, 'completed': session.completed}, 'items': items})

    def put(self, request, session_id):
        teacher, error_response = get_teacher_from_request(request)
        if error_response:
            return error_response
        session = get_object_or_404(WritingTestSession.objects.select_related('user'), pk=session_id)
        teacher_name = teacher.first_name or teacher.student_id
        if session.user.teacher != teacher_name:
            return Response({'error': 'Not allowed'}, status=403)

        payload = request.data if isinstance(request.data, dict) else {}
        items = payload.get('items', [])
        updated = []

        for item in items:
            essay_id = item.get('essay_id')
            if not essay_id:
                continue
            essay = get_object_or_404(Essay.objects.select_related('user'), pk=essay_id)
            if essay.test_session_id != session.id:
                return Response({'error': 'Essay does not belong to session'}, status=400)
            if essay.user.teacher != teacher_name:
                return Response({'error': 'Not allowed'}, status=403)

            upsert = TeacherFeedbackUpsertSerializer(data=item.get('feedback', {}))
            upsert.is_valid(raise_exception=True)
            data = upsert.validated_data

            def clean_score(score):
                if score == '' or score is None:
                    return None
                try:
                    return float(score)
                except (ValueError, TypeError):
                    return None

            fb, _ = TeacherFeedback.objects.update_or_create(
                essay=essay,
                defaults={
                    'teacher': teacher,
                    'overall_feedback': data.get('overall_feedback', ''),
                    'annotations': data.get('annotations', []),
                    'teacher_task_score': clean_score(data.get('teacher_task_score')),
                    'teacher_coherence_score': clean_score(data.get('teacher_coherence_score')),
                    'teacher_lexical_score': clean_score(data.get('teacher_lexical_score')),
                    'teacher_grammar_score': clean_score(data.get('teacher_grammar_score')),
                    'teacher_task_feedback': data.get('teacher_task_feedback', ''),
                    'teacher_coherence_feedback': data.get('teacher_coherence_feedback', ''),
                    'teacher_lexical_feedback': data.get('teacher_lexical_feedback', ''),
                    'teacher_grammar_feedback': data.get('teacher_grammar_feedback', ''),
                }
            )
            updated.append(TeacherFeedbackSerializer(fb).data)

        return Response({'updated': updated})


class TeacherSessionPublishView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, session_id):
        teacher, error_response = get_teacher_from_request(request)
        if error_response:
            return error_response
        session = get_object_or_404(WritingTestSession.objects.select_related('user'), pk=session_id)
        teacher_name = teacher.first_name or teacher.student_id
        if session.user.teacher != teacher_name:
            return Response({'error': 'Not allowed'}, status=403)

        from django.utils import timezone as dj_tz
        essays = Essay.objects.filter(test_session=session)
        published_ids = []
        should_notify = False
        for essay in essays:
            existing_feedback = TeacherFeedback.objects.filter(essay=essay).first()
            was_published = bool(existing_feedback and existing_feedback.published)
            fb, _ = TeacherFeedback.objects.get_or_create(essay=essay, defaults={'teacher': teacher})
            # Если пришли данные в теле запроса (могут быть обновления), применяем их перед публикацией
            payload = request.data if isinstance(request.data, dict) else {}
            items = payload.get('items', []) if payload else []
            for item in items:
                if item.get('essay_id') == essay.id:
                    data = item.get('feedback', {}) or {}
                    # Обновляем поля фидбэка
                    fb.overall_feedback = data.get('overall_feedback', fb.overall_feedback)
                    fb.annotations = data.get('annotations', fb.annotations) or []
                    for field in ['teacher_task_score','teacher_coherence_score','teacher_lexical_score','teacher_grammar_score','teacher_task_feedback','teacher_coherence_feedback','teacher_lexical_feedback','teacher_grammar_feedback']:
                        if field in data:
                            setattr(fb, field, data.get(field))
            fb.teacher = teacher
            fb.published = True
            fb.published_at = dj_tz.now()
            fb.save()
            published_ids.append(essay.id)
            if not was_published:
                should_notify = True
        if should_notify:
            try:
                send_writing_feedback_published_email(
                    student=session.user,
                    teacher=teacher,
                    session=session
                )
            except Exception:
                pass
        return Response({'published_essays': published_ids})


class StudentSessionFeedbackView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        session = get_object_or_404(WritingTestSession, pk=session_id, user=request.user)
        essays = Essay.objects.filter(test_session=session).order_by('task_type')
        items = []
        for e in essays:
            fb = getattr(e, 'teacher_feedback', None)
            if fb and fb.published:
                items.append({'essay': EssaySerializer(e).data, 'feedback': TeacherFeedbackSerializer(fb).data})
            else:
                # Отдаём карточку без содержимого, чтобы фронт мог показать Draft
                items.append({'essay': EssaySerializer(e).data, 'feedback': None})
        # Если нет вообще эссе в сессии — 404
        if not items:
            return Response({'error': 'Feedback not available'}, status=404)
        return Response({'session': {'id': session.id, 'test_id': session.test_id, 'completed': session.completed}, 'items': items})


# ------------------------------
# Teacher Speaking Assessment Views
# ------------------------------
from .serializers import (
    SpeakingSessionSerializer, SpeakingSessionCreateSerializer, 
    SpeakingSessionUpdateSerializer, SpeakingSessionStudentSerializer,
    SpeakingSessionHistorySerializer
)

class TeacherSpeakingStudentsView(APIView):
    """Get list of students assigned to the teacher for speaking assessment"""
    permission_classes = [AllowAny]
    
    def get(self, request):
        teacher, error_response = get_teacher_from_request(request, allowed_roles=('teacher', 'speaking_mentor'))
        if error_response:
            return error_response
        
        search = request.query_params.get('search')
        group = request.query_params.get('group')
        has_session = request.query_params.get('has_session')
        last_days = request.query_params.get('last_days')
        last_from = _parse_date_param(request.query_params.get('last_from'))
        last_to = _parse_date_param(request.query_params.get('last_to'))
        
        if teacher.role == 'speaking_mentor':
            students = User.objects.filter(role='student').order_by('first_name', 'last_name')
        else:
            teacher_name = teacher.first_name
            if not teacher_name:
                teacher_name = teacher.student_id or f"{teacher.first_name} {teacher.last_name}".strip()
            if not teacher_name:
                return Response({'students': []})
            students = User.objects.filter(role='student', teacher=teacher_name).order_by('first_name', 'last_name')

        if search:
            s = search.strip()
            if s:
                students = students.filter(
                    models.Q(first_name__icontains=s) |
                    models.Q(last_name__icontains=s) |
                    models.Q(student_id__icontains=s) |
                    models.Q(email__icontains=s)
                )
        if group:
            students = students.filter(group__icontains=group.strip())

        # Annotate latest completed speaking session date (teacher-scoped for teachers)
        session_filter = models.Q(speaking_sessions__completed=True)
        if teacher.role != 'speaking_mentor':
            session_filter &= models.Q(speaking_sessions__teacher=teacher)
        students = students.annotate(latest_session_date=models.Max('speaking_sessions__conducted_at', filter=session_filter))

        if has_session:
            hs = str(has_session).strip().lower()
            if hs in ['1', 'true', 'yes']:
                students = students.filter(latest_session_date__isnull=False)
            elif hs in ['0', 'false', 'no']:
                students = students.filter(latest_session_date__isnull=True)

        if last_days:
            try:
                days = int(last_days)
                if days > 0:
                    cutoff = timezone.now() - timedelta(days=days)
                    students = students.filter(latest_session_date__gte=cutoff)
            except (TypeError, ValueError):
                pass
        if last_from:
            students = students.filter(latest_session_date__date__gte=last_from)
        if last_to:
            students = students.filter(latest_session_date__date__lte=last_to)
        
        students_data = []
        for student in students:
            if teacher.role == 'speaking_mentor':
                sessions = SpeakingSession.objects.filter(student=student)
            else:
                sessions = SpeakingSession.objects.filter(student=student, teacher=teacher)
            completed_sessions = sessions.filter(completed=True)
            latest_session = completed_sessions.order_by('-conducted_at').first()
            
            students_data.append({
                'id': student.id,
                'student_id': student.student_id,
                'first_name': student.first_name,
                'last_name': student.last_name,
                'email': student.email,
                'group': student.group,
                'total_sessions': sessions.count(),
                'completed_sessions': completed_sessions.count(),
                'latest_score': latest_session.overall_band_score if latest_session else None,
                'latest_date': latest_session.conducted_at if latest_session else None
            })
        
        return Response({'students': students_data})


class TeacherSpeakingSessionsView(APIView):
    """Get speaking sessions history for teacher"""
    permission_classes = [AllowAny]
    
    def get(self, request):
        teacher, error_response = get_teacher_from_request(request, allowed_roles=('teacher', 'speaking_mentor'))
        if error_response:
            return error_response
        
        # Filter parameters
        student_id = request.query_params.get('student_id')
        completed_only = request.query_params.get('completed', 'true').lower() == 'true'
        search = request.query_params.get('search')
        group = request.query_params.get('group')
        last_days = request.query_params.get('last_days')
        
        if teacher.role == 'speaking_mentor':
            sessions = SpeakingSession.objects.all()
        else:
            sessions = SpeakingSession.objects.filter(teacher=teacher)
        sessions = sessions.select_related('student', 'teacher')
        
        if student_id:
            sessions = sessions.filter(student__student_id=student_id)
        
        if completed_only:
            sessions = sessions.filter(completed=True)

        if search:
            s = search.strip()
            if s:
                sessions = sessions.filter(
                    models.Q(student__first_name__icontains=s) |
                    models.Q(student__last_name__icontains=s) |
                    models.Q(student__student_id__icontains=s) |
                    models.Q(student__email__icontains=s)
                )
        if group:
            sessions = sessions.filter(student__group__icontains=group.strip())
        if last_days:
            try:
                days = int(last_days)
                if days > 0:
                    cutoff = timezone.now() - timedelta(days=days)
                    sessions = sessions.filter(conducted_at__gte=cutoff)
            except (TypeError, ValueError):
                pass

        sessions = apply_date_range_filter(sessions, request, 'conducted_at')
        
        sessions = sessions.order_by('-conducted_at')
        serializer = SpeakingSessionHistorySerializer(sessions, many=True)
        return Response({'sessions': serializer.data})
    
    def post(self, request):
        """Create new speaking session"""
        teacher, error_response = get_teacher_from_request(request, allowed_roles=('teacher', 'speaking_mentor'))
        if error_response:
            return error_response
        
        data = request.data.copy()
        
        # Get student and validate they belong to this teacher
        student_id = data.get('student_id')
        if not student_id:
            return Response({'error': 'Student ID is required'}, status=400)
        
        try:
            student = User.objects.get(student_id=student_id, role='student')
        except User.DoesNotExist:
            return Response({'error': 'Student not found'}, status=404)
        
        # Check if student belongs to this teacher
        if teacher.role != 'speaking_mentor':
            teacher_name = teacher.first_name or teacher.student_id
            if student.teacher != teacher_name:
                return Response({'error': 'Student does not belong to this teacher'}, status=403)
        
        # Set student and teacher
        data['student'] = student.id
        data['teacher'] = teacher.id
        
        serializer = SpeakingSessionCreateSerializer(data=data, context={'request': request})
        if serializer.is_valid():
            session = serializer.save(teacher=teacher, student=student)
            return Response(SpeakingSessionSerializer(session).data, status=201)
        return Response(serializer.errors, status=400)


class TeacherSpeakingSessionDetailView(APIView):
    """Get, update, or complete a specific speaking session"""
    permission_classes = [AllowAny]
    
    def get(self, request, session_id):
        teacher, error_response = get_teacher_from_request(request, allowed_roles=('teacher', 'speaking_mentor'))
        if error_response:
            return error_response
        
        try:
            if teacher.role == 'speaking_mentor':
                session = SpeakingSession.objects.get(id=session_id)
            else:
                session = SpeakingSession.objects.get(id=session_id, teacher=teacher)
        except SpeakingSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=404)
        
        serializer = SpeakingSessionSerializer(session)
        return Response(serializer.data)
    
    def put(self, request, session_id):
        """Update speaking session"""
        teacher, error_response = get_teacher_from_request(request, allowed_roles=('teacher', 'speaking_mentor'))
        if error_response:
            return error_response
        
        try:
            if teacher.role == 'speaking_mentor':
                session = SpeakingSession.objects.get(id=session_id)
            else:
                session = SpeakingSession.objects.get(id=session_id, teacher=teacher)
        except SpeakingSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=404)
        
        serializer = SpeakingSessionUpdateSerializer(session, data=request.data, partial=True)
        if serializer.is_valid():
            session = serializer.save()
            return Response(SpeakingSessionSerializer(session).data)
        return Response(serializer.errors, status=400)
    
    def post(self, request, session_id):
        """Complete/submit speaking session"""
        teacher, error_response = get_teacher_from_request(request, allowed_roles=('teacher', 'speaking_mentor'))
        if error_response:
            return error_response
        
        try:
            if teacher.role == 'speaking_mentor':
                session = SpeakingSession.objects.get(id=session_id)
            else:
                session = SpeakingSession.objects.get(id=session_id, teacher=teacher)
        except SpeakingSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=404)
        
        # Update session data and mark as completed
        serializer = SpeakingSessionUpdateSerializer(session, data=request.data, partial=True)
        if serializer.is_valid():
            session = serializer.save(completed=True)
            return Response(SpeakingSessionSerializer(session).data)
        return Response(serializer.errors, status=400)


# ------------------------------
# Student Speaking Views
# ------------------------------

class StudentSpeakingSessionsView(APIView):
    """Get speaking sessions for student (only completed ones)"""
    permission_classes = [AllowAny]
    
    def get(self, request):
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
            return Response({'error': 'User not found'}, status=404)
        
        # Only return completed sessions
        sessions = SpeakingSession.objects.filter(student=user, completed=True).order_by('-conducted_at')
        serializer = SpeakingSessionStudentSerializer(sessions, many=True)
        return Response({'sessions': serializer.data})


class StudentSpeakingSessionDetailView(APIView):
    """Get specific speaking session details for student"""
    permission_classes = [AllowAny]
    
    def get(self, request, session_id):
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
            return Response({'error': 'User not found'}, status=404)
        
        try:
            # Only allow access to completed sessions by the student
            session = SpeakingSession.objects.get(id=session_id, student=user, completed=True)
        except SpeakingSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=404)
        
        serializer = SpeakingSessionStudentSerializer(session)
        return Response(serializer.data)


class TeachersListView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get_queryset(self):
        return User.objects.filter(role='teacher').order_by('first_name', 'last_name')

class FirebaseLoginView(APIView):
    permission_classes = [AllowAny]  # Public endpoint for login
    
    @method_decorator(ratelimit(key='ip', rate='5/m', method='POST'))
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
            security_logger.warning(f"Failed login attempt - Invalid token from IP {request.META.get('REMOTE_ADDR')}")
            return Response(
                {"detail": "Authentication failed"},  # Generic message to prevent information disclosure
                status=status.HTTP_401_UNAUTHORIZED
            )
        except Exception as e:
            security_logger.error(f"Login error from IP {request.META.get('REMOTE_ADDR')}: {str(e)}")
            return Response(
                {"detail": "Authentication failed"},  # Generic message
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not decoded:
            return Response(
                {"detail": "Invalid Firebase token"},
                status=status.HTTP_401_UNAUTHORIZED
            )

        uid = decoded.get('uid')
        email = decoded.get('email')
        student_id = request.data.get('student_id')
        role = request.data.get('role', 'student')
        first_name = request.data.get('first_name')
        last_name = request.data.get('last_name')
        group = request.data.get('group')

        # 3. Ищем пользователя по uid
        try:
            user = User.objects.get(uid=uid)
            # Обновляем данные если они переданы
            if first_name and user.first_name != first_name:
                user.first_name = first_name
            if last_name and user.last_name != last_name:
                user.last_name = last_name
            if group and user.group != group:
                user.group = group
            if student_id and user.student_id != student_id:
                user.student_id = student_id
            user.save()
            created = False
        except User.DoesNotExist:
            # 4. Если не нашли — ищем по email
            try:
                user = User.objects.get(email=email)
                user.uid = uid
                user.role = role
                if student_id and user.student_id != student_id:
                    user.student_id = student_id
                if first_name and user.first_name != first_name:
                    user.first_name = first_name
                if last_name and user.last_name != last_name:
                    user.last_name = last_name
                if group and user.group != group:
                    user.group = group
                user.save()
                created = False
            except User.DoesNotExist:
                # 5. Если не нашли и по email — создаём нового
                user = User.objects.create(
                    uid=uid,
                    email=email,
                    role=role,
                    student_id=student_id,
                    first_name=first_name,
                    last_name=last_name,
                    group=group,
                    username=email,
                )
                created = True

        # 6. Возвращаем ответ
        return Response({
            "message": "Login successful",
            "uid": uid,
            "role": user.role,
            "student_id": user.student_id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "group": user.group,
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
            queryset = Essay.objects.filter(user=user).select_related('test_session__test', 'task', 'prompt')
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

    def post(self, request, test_id=None):
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

        # Get test_id from URL parameter or request data
        if not test_id:
            test_id = request.data.get('test_id')
        
        if not test_id:
            return Response({'error': 'test_id is required'}, status=400)

        try:
            test = WritingTest.objects.get(id=test_id, is_active=True)
        except WritingTest.DoesNotExist:
            return Response({'error': 'Test not found or not active'}, status=404)

        # Diagnostic flag
        diagnostic_flag = False
        try:
            diagnostic_flag = str(request.query_params.get('diagnostic', request.data.get('diagnostic', ''))).lower() in ['1','true','yes']
        except Exception:
            diagnostic_flag = False

        if diagnostic_flag:
            # Lock if any regular completed test exists in any module
            if (
                ListeningTestSession.objects.filter(user=user, submitted=True, is_diagnostic=False).exists() or
                ReadingTestSession.objects.filter(user=user, completed=True, is_diagnostic=False).exists() or
                WritingTestSession.objects.filter(user=user, completed=True, is_diagnostic=False).exists()
            ):
                return Response({'detail': 'Diagnostic flow is locked because regular tests already exist.'}, status=status.HTTP_403_FORBIDDEN)
            if not getattr(test, 'is_diagnostic_template', False):
                return Response({'detail': 'Selected test is not configured as a diagnostic template.'}, status=status.HTTP_400_BAD_REQUEST)
            if WritingTestSession.objects.filter(user=user, completed=True, is_diagnostic=True).exists():
                return Response({'detail': 'Diagnostic writing already completed.'}, status=status.HTTP_409_CONFLICT)

        # Create session with test reference
        session = WritingTestSession.objects.create(user=user, test=test, is_diagnostic=diagnostic_flag)

        # Get tasks for this test
        task1 = test.tasks.filter(task_type="task1").first()
        task2 = test.tasks.filter(task_type="task2").first()

        if not task1 or not task2:
            return Response({'error': 'Test must have both Task 1 and Task 2'}, status=400)

        return Response({
            'session_id': session.id,
            'test_title': test.title,
            'task1_id': task1.id,
            'task2_id': task2.id,
            'task1_text': task1.task_text,
            'task2_text': task2.task_text,
            'task1_image': task1.image.url if task1.image else None,
            'task2_image': task2.image.url if task2.image else None
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
        question_text = (request.data.get('question_text') or '').strip()
        submitted_text = (request.data.get('submitted_text') or '').strip()
        if not submitted_text:
            return Response({'error': 'Submitted text is empty'}, status=400)

        try:
            session = WritingTestSession.objects.get(id=session_id, user=user)
        except WritingTestSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=404)

        # Get WritingTask for this session's test
        task_id = request.data.get('task_id')
        task = None
        if task_id:
            task = WritingTask.objects.filter(id=task_id, test=session.test).first()
        
        # If task not found by ID, try to find by type in the test
        if not task and session.test:
            task = session.test.tasks.filter(task_type=task_type).first()

        essay = Essay.objects.filter(test_session=session, task_type=task_type).first()
        if essay:
            essay.submitted_text = submitted_text
            essay.question_text = question_text
            essay.task = task
            essay.submitted_at = timezone.now()
            essay.save()
        else:
            essay = Essay.objects.create(
                user=user,
                test_session=session,
                task_type=task_type,
                question_text=question_text,
                submitted_text=submitted_text,
                task=task,
                submitted_at=timezone.now()
            )

        # Check if all required essays are submitted and mark session as completed
        essays_in_session = Essay.objects.filter(test_session=session)
        has_task1 = any(e.task_type == 'task1' and e.submitted_text and e.submitted_text.strip() for e in essays_in_session)
        has_task2 = any(e.task_type == 'task2' and e.submitted_text and e.submitted_text.strip() for e in essays_in_session)
        if has_task1 and has_task2 and not session.completed:
            session.completed = True
            session.save()

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

        with transaction.atomic():
            try:
                session = WritingTestSession.objects.select_for_update().get(id=session_id, user=user)
            except WritingTestSession.DoesNotExist:
                return Response({'error': 'Session not found'}, status=404)

        essays = Essay.objects.filter(user=user, test_session=session)
        if not essays.exists():
            return Response({'error': 'No essays found for this session'}, status=400)
        has_task1 = any(e.task_type == 'task1' and e.submitted_text and e.submitted_text.strip() for e in essays)
        has_task2 = any(e.task_type == 'task2' and e.submitted_text and e.submitted_text.strip() for e in essays)
        if not (has_task1 and has_task2):
            return Response({'error': 'Both tasks must be submitted with text'}, status=400)

        # AI-оценка для всех эссе, если ещё не оценены
        from .utils import ai_score_essay
        for essay in essays:
            if essay.overall_band is None or essay.feedback is None:
                # Use WritingTask instead of WritingPrompt
                task = essay.task
                image_url = None
                if task and getattr(task, 'image', None):
                    try:
                        # Формируем полный URL
                        if task.image.url.startswith('http'):
                            image_url = task.image.url
                        else:
                            # Убираем лишние слэши и корректно формируем URL
                            base_url = "https://ielts.mastereducation.kz"
                            clean_path = task.image.url.lstrip('/')
                            image_url = f"{base_url}/{clean_path}"
                    except Exception as e:
                        image_url = None
                try:
                    ai_result = ai_score_essay(essay.question_text, essay.submitted_text, essay.task_type, image_url)
                    
                    # AI функция всегда возвращает task_response (даже для Task 1)
                    essay.score_task = ai_result.get('task_response')
                    
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
            elif essay.task_type == 'task2':
                band2 = essay.overall_band
        
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
        else:
            overall_band = None

        return Response({
            'session_id': session.id,
            'overall_band': overall_band,
            'essays': EssaySerializer(essays, many=True).data,
            'message': 'Session completed and AI scored successfully'
        })


class WritingSessionSyncView(APIView):
    permission_classes = [AllowAny]

    def patch(self, request, session_id):
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
            session = WritingTestSession.objects.get(id=session_id, user=user)
        except WritingTestSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=404)

        task1_text = request.data.get('task1_text')
        task2_text = request.data.get('task2_text')
        time_left = request.data.get('time_left')

        if task1_text is not None:
            session.task1_draft = task1_text
        if task2_text is not None:
            session.task2_draft = task2_text
        if time_left is not None:
            try:
                tl = max(0, int(float(time_left)))
                session.time_left_seconds = tl
            except (TypeError, ValueError):
                return Response({'error': 'Invalid time_left'}, status=400)

        session.save(update_fields=['task1_draft', 'task2_draft', 'time_left_seconds'])

        return Response({
            'task1_text': session.task1_draft,
            'task2_text': session.task2_draft,
            'time_left_seconds': session.time_left_seconds
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


class WritingTestViewSet(viewsets.ModelViewSet):
    serializer_class = WritingTestSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        auth_header = self.request.META.get('HTTP_AUTHORIZATION', '')
        
        # For students, show only active tests
        if not auth_header.startswith('Bearer '):
            return WritingTest.objects.filter(is_active=True).order_by('-created_at')
            
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return WritingTest.objects.filter(is_active=True).order_by('-created_at')
            
        uid = decoded['uid']
        try:
            user = User.objects.get(uid=uid)
            if user.role == 'admin':
                # Admins see all tests
                return WritingTest.objects.all().order_by('-created_at')
            else:
                # Students see only active tests
                return WritingTest.objects.filter(is_active=True).order_by('-created_at')
        except User.DoesNotExist:
            return WritingTest.objects.filter(is_active=True).order_by('-created_at')

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        # Enrich with user_completed if user is authenticated
        try:
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if auth_header.startswith('Bearer '):
                decoded = verify_firebase_token(auth_header.split(' ')[1])
                if decoded:
                    uid = decoded['uid']
                    user = User.objects.get(uid=uid)
                    test_ids = [item['id'] for item in response.data]
                    completed_sessions = set(
                        WritingTestSession.objects.filter(user=user, test_id__in=test_ids, completed=True).values_list('test_id', flat=True)
                    )
                    for item in response.data:
                        item['user_completed'] = item['id'] in completed_sessions
                else:
                    for item in response.data:
                        item['user_completed'] = False
            else:
                for item in response.data:
                    item['user_completed'] = False
        except Exception:
            for item in response.data:
                item['user_completed'] = False
        return response

    def create(self, request):
        # Only admins can create tests
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

        return super().create(request)

    @action(detail=True, methods=['post'], url_path='toggle-active', permission_classes=[IsAdmin])
    def toggle_active(self, request, pk=None):
        test = self.get_object()
        test.is_active = not test.is_active
        test.save()
        return Response({'message': f'Test {"activated" if test.is_active else "deactivated"}', 'is_active': test.is_active})


class WritingTaskViewSet(viewsets.ModelViewSet):
    queryset = WritingTask.objects.all()
    serializer_class = WritingTaskSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        # Filter by test if specified
        test_id = self.request.query_params.get('test_id')
        if test_id:
            return WritingTask.objects.filter(test_id=test_id).order_by('task_type')
        return WritingTask.objects.all().order_by('-created_at')

    def create(self, request, *args, **kwargs):
        # Only admins can create tasks
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

        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        # Only admins can update tasks
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


class WritingTestSessionDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, session_id):
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
            session = WritingTestSession.objects.get(id=session_id, user=user)
            serializer = WritingTestSessionSerializer(session)
            return Response(serializer.data)
        except WritingTestSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=404)


class WritingTestExportCSVView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, test_id):
        # Check admin access
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
            test = WritingTest.objects.get(id=test_id)
        except WritingTest.DoesNotExist:
            return Response({'error': 'Test not found'}, status=404)

        # Get all essays for this test
        essays = Essay.objects.filter(
            test_session__test=test
        ).select_related('user', 'test_session', 'task').order_by('user__student_id', '-submitted_at')

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="writing_test_{test.id}_{test.title.replace(" ", "_")}_results.csv"'
        response.write('\ufeff'.encode('utf8'))  # UTF-8 BOM
        
        writer = csv.writer(response)

        header = [
            'Student ID', 'First Name', 'Last Name', 'Group', 'Teacher',
            'Test Title', 'Task Type', 'Essay Text', 'Task Text', 'Word Count',
            'Task Response Score', 'Coherence Score', 'Lexical Score', 'Grammar Score',
            'Overall Band', 'AI Feedback', 'Date Submitted'
        ]
        writer.writerow(header)

        for essay in essays:
            user = essay.user
            word_count = len(essay.submitted_text.split()) if essay.submitted_text else 0
            
            writer.writerow([
                user.student_id or '',
                user.first_name or '',
                user.last_name or '',
                user.group or '',
                user.teacher or '',
                test.title,
                essay.task.task_type.upper() if essay.task else essay.task_type or '',
                essay.submitted_text or '',
                essay.task.task_text if essay.task else essay.question_text or '',
                word_count,
                essay.score_task or '',
                essay.score_coherence or '',
                essay.score_lexical or '',
                essay.score_grammar or '',
                essay.overall_band or '',
                essay.feedback or '',
                essay.submitted_at.strftime('%Y-%m-%d %H:%M:%S') if essay.submitted_at else ''
            ])

        return response



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

        from .serializers import ListeningTestReadSerializer
        test_data = ListeningTestReadSerializer(test).data

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

        # КРИТИЧНО: Мержим финальные ответы с существующими, чтобы не потерять данные
        answers_data = request.data.get("answers", {})
        
        if not isinstance(session.answers, dict):
            session.answers = {}
        
        if isinstance(answers_data, dict):
            # Мержим данные так же как в sync endpoint
            for question_id, answer_value in answers_data.items():
                if isinstance(answer_value, dict) and question_id in session.answers and isinstance(session.answers[question_id], dict):
                    session.answers[question_id].update(answer_value)
                else:
                    session.answers[question_id] = answer_value
        else:
            # Если клиент отправил полный словарь, используем его
            session.answers = answers_data if isinstance(answers_data, dict) else {}
        
        session.completed = True
        session.completed_at = timezone.now()
        
        # Используем функцию из serializers для правильного расчета результатов
        from .serializers import create_listening_detailed_breakdown
        results = create_listening_detailed_breakdown(session)
        
        session.score = results['raw_score']
        session.correct_answers_count = results['raw_score']
        session.total_questions_count = results['total_score']
        session.save()
        
        from .models import ListeningTestResult
        ListeningTestResult.objects.update_or_create(
            session=session,
            defaults={
                'raw_score': results['raw_score'],
                'band_score': results['band_score'],
                'breakdown': results['detailed_breakdown']
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
            ).select_related('test').prefetch_related('listeningtestresult')
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
            ).select_related('test').prefetch_related('listeningtestresult')
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

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        try:
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if auth_header.startswith('Bearer '):
                decoded = verify_firebase_token(auth_header.split(' ')[1])
                if decoded:
                    uid = decoded['uid']
                    user = User.objects.get(uid=uid)
                    test_ids = [item['id'] for item in response.data]
                    completed = set(
                        ListeningTestSession.objects.filter(user=user, test_id__in=test_ids, submitted=True).values_list('test_id', flat=True)
                    )
                    for item in response.data:
                        item['user_completed'] = item['id'] in completed
                else:
                    for item in response.data:
                        item['user_completed'] = False
            else:
                for item in response.data:
                    item['user_completed'] = False
        except Exception:
            for item in response.data:
                item['user_completed'] = False
        return response

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def activate(self, request, pk=None):
        test = self.get_object()
        test.is_active = True
        test.save()
        return Response({'message': 'Test activated successfully'})

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def deactivate(self, request, pk=None):
        test = self.get_object()
        test.is_active = False
        test.save()
        return Response({'message': 'Test deactivated successfully'})

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def clone(self, request, pk=None):
        source_test = self.get_object()
        
        # Create new test with cloned data
        cloned_test = ListeningTest.objects.create(
            title=f"{source_test.title} (Copy)",
            description=source_test.description,
            is_active=False  # Cloned tests start as inactive
        )
        
        # Clone all parts and their questions
        for part in source_test.parts.all().order_by('part_number'):
            cloned_part = ListeningPart.objects.create(
                test=cloned_test,
                part_number=part.part_number,
                audio=part.audio,  # Reference to same audio file
                audio_duration=part.audio_duration,
                instructions=part.instructions
            )
            
            # Clone questions for this part
            for question in part.questions.all().order_by('order'):
                cloned_question = ListeningQuestion.objects.create(
                    part=cloned_part,
                    question_type=question.question_type,
                    question_text=question.question_text,
                    order=question.order,
                    extra_data=question.extra_data,
                    correct_answers=question.correct_answers,
                    header=question.header,
                    instruction=question.instruction,
                    task_prompt=question.task_prompt,
                    image=question.image,
                    image_file=question.image_file,  # Reference to same image file
                    points=question.points,
                    scoring_mode=question.scoring_mode
                )
                
                # Clone answer options
                for option in question.options.all():
                    ListeningAnswerOption.objects.create(
                        question=cloned_question,
                        label=option.label,
                        text=option.text,
                        points=option.points
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
    queryset = ListeningQuestion.objects.all().order_by('part', 'order')
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
            # Diagnostic flag from query/body
            diagnostic_flag = False
            try:
                diagnostic_flag = str(request.query_params.get('diagnostic', request.data.get('diagnostic', ''))).lower() in ['1','true','yes']
            except Exception:
                diagnostic_flag = False

            if diagnostic_flag:
                # Block if user has ANY completed non-diagnostic session in any module
                has_regular = (
                    ListeningTestSession.objects.filter(user=request.user, submitted=True, is_diagnostic=False).exists() or
                    ReadingTestSession.objects.filter(user=request.user, completed=True, is_diagnostic=False).exists() or
                    WritingTestSession.objects.filter(user=request.user, completed=True, is_diagnostic=False).exists()
                )
                if has_regular:
                    return Response({'detail': 'Diagnostic flow is locked because regular tests already exist.'}, status=status.HTTP_403_FORBIDDEN)
                # Ensure diagnostic template
                if not getattr(test, 'is_diagnostic_template', False):
                    return Response({'detail': 'Selected test is not configured as a diagnostic template.'}, status=status.HTTP_400_BAD_REQUEST)
                # Only one diagnostic per module
                if ListeningTestSession.objects.filter(user=request.user, submitted=True, is_diagnostic=True).exists():
                    return Response({'detail': 'Diagnostic listening already completed.'}, status=status.HTTP_409_CONFLICT)
            
            # Ищем последние незавершенные сессии
            sessions = ListeningTestSession.objects.filter(
                user=request.user,
                test=test,
                submitted=False
            ).order_by('-started_at')

            if sessions.exists():
                # Берем самую последнюю сессию
                last_session = sessions.first()
                # If diagnostic requested but last session is not diagnostic, start a fresh diagnostic session
                if diagnostic_flag and not last_session.is_diagnostic:
                    session = ListeningTestSession.objects.create(
                        user=request.user,
                        test=test,
                        time_left=2400,
                        is_diagnostic=True
                    )
                    created = True
                else:
                    session = last_session
                    # If diagnostic requested and session is diagnostic but flag not set, set it
                    if diagnostic_flag and not session.is_diagnostic:
                        session.is_diagnostic = True
                        session.save(update_fields=['is_diagnostic'])
                created = False
            else:
                # Если нет - создаем новую
                session = ListeningTestSession.objects.create(
                    user=request.user,
                    test=test,
                    time_left=2400, # 40 минут по стандарту IELTS
                    is_diagnostic=diagnostic_flag
                )
                created = True

            serializer = ListeningTestSessionSerializer(session)
            return Response(serializer.data, status=status.HTTP_200_OK if not created else status.HTTP_201_CREATED)

        # Если session_id есть - это сабмит.
        if session_id:
            with transaction.atomic():
                session = ListeningTestSession.objects.select_for_update().get(pk=session_id, user=request.user)
                if session.submitted:
                    return Response({'detail': 'Session has already been submitted.'}, status=status.HTTP_400_BAD_REQUEST)

                submit_serializer = ListeningTestSessionSubmitSerializer(session, data=request.data, partial=True)
                submit_serializer.is_valid(raise_exception=True)

                answers_data = submit_serializer.validated_data.get('answers', None)
                if not isinstance(session.answers, dict):
                    session.answers = {}
                if isinstance(answers_data, dict):
                    for question_id, answer_value in answers_data.items():
                        if (
                            isinstance(answer_value, dict)
                            and question_id in session.answers
                            and isinstance(session.answers.get(question_id), dict)
                        ):
                            session.answers[question_id].update(answer_value)
                        else:
                            session.answers[question_id] = answer_value

                time_left_value = submit_serializer.validated_data.get('time_left', None)
                if time_left_value is not None:
                    session.time_left = time_left_value

                session.submitted = True
                session.completed_at = timezone.now()
                if session.started_at:
                    session.time_taken = (session.completed_at - session.started_at).total_seconds()

                try:
                    results = create_listening_detailed_breakdown(session)
                    raw_score = results.get('raw_score') or 0
                    total_score = results.get('total_score') or 0
                    band_score = results.get('band_score')
                    breakdown = results.get('detailed_breakdown') or []

                    session.correct_answers_count = raw_score
                    session.total_questions_count = total_score
                    session.score = raw_score
                    session.save(update_fields=['answers', 'time_left', 'submitted', 'completed_at', 'time_taken', 'correct_answers_count', 'total_questions_count', 'score', 'last_updated'])

                    from .models import ListeningTestResult
                    ListeningTestResult.objects.update_or_create(
                        session=session,
                        defaults={
                            'raw_score': raw_score,
                            'band_score': band_score if band_score is not None else 0,
                            'breakdown': breakdown,
                        }
                    )
                except Exception:
                    session.save(update_fields=['answers', 'time_left', 'submitted', 'completed_at', 'time_taken', 'last_updated'])

            context = {'request': request}
            result_serializer = ListeningTestSessionResultSerializer(session, context=context)
            return Response(result_serializer.data, status=status.HTTP_200_OK)

        return Response({'detail': 'Invalid request. Provide test_id to start or session_id to submit.'}, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, session_id=None):
        # Sync answers (save progress)
        session = get_object_or_404(ListeningTestSession, pk=session_id, user=request.user)
        
        if session.submitted:
            return Response({'error': 'Cannot sync a submitted session.'}, status=status.HTTP_400_BAD_REQUEST)
        
        answers_data = request.data.get('answers', {})
        flagged_data = request.data.get('flagged', {})
        time_left = request.data.get('time_left')
        
        # КРИТИЧНО: Мержим данные правильно для listening, как в reading
        if not isinstance(session.answers, dict):
            session.answers = {}
        
        if isinstance(answers_data, dict):
            # Для вложенных структур (gap_fill, matching) мержим правильно
            for question_id, answer_value in answers_data.items():
                if isinstance(answer_value, dict) and question_id in session.answers and isinstance(session.answers[question_id], dict):
                    # Мержим вложенные ответы
                    session.answers[question_id].update(answer_value)
                else:
                    # Для плоских структур или новых вопросов просто обновляем
                    session.answers[question_id] = answer_value
        
        if isinstance(flagged_data, dict):
            if not isinstance(session.flagged, dict):
                session.flagged = {}
            session.flagged.update(flagged_data)
        
        if time_left is not None:
            try:
                session.time_left = max(0, int(time_left))
            except (TypeError, ValueError):
                pass
        
        session.save(update_fields=['answers', 'flagged', 'time_left', 'last_updated'])
        
        return Response({'detail': 'Progress saved'}, status=status.HTTP_200_OK)

# --- ListeningTestResult: student/admin view ---
class ListeningTestResultView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, session_id):
        session = get_object_or_404(ListeningTestSession, pk=session_id, user=request.user)
        
        if not session.submitted:
            return Response({'detail': 'Session not submitted yet'}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = ListeningTestSessionResultSerializer(session)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ListeningAIFeedbackView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        session = get_object_or_404(ListeningTestSession, pk=session_id, user=request.user)

        if not session.submitted:
            return Response({'error': 'Session not submitted yet'}, status=status.HTTP_400_BAD_REQUEST)

        refresh = request.query_params.get('refresh') == '1'
        result = ListeningTestResult.objects.filter(session=session).first()
        if result and result.ai_feedback and result.ai_feedback_version == AI_FEEDBACK_PROMPT_VERSION and not refresh:
            return Response({
                'feedback': result.ai_feedback,
                'cached': True,
                'prompt_version': AI_FEEDBACK_PROMPT_VERSION,
                'updated_at': result.ai_feedback_updated_at.isoformat() if result.ai_feedback_updated_at else None
            })

        try:
            payload = build_feedback_payload(session, 'listening')
            feedback_text = generate_ai_feedback('listening', payload)
            cache_feedback(result, feedback_text)
            return Response({
                'feedback': feedback_text,
                'cached': False,
                'prompt_version': AI_FEEDBACK_PROMPT_VERSION,
                'updated_at': result.ai_feedback_updated_at.isoformat() if result and result.ai_feedback_updated_at else None
            })
        except Exception as e:
            return Response({'error': 'AI feedback failed', 'details': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
        for part in source_test.parts.all().order_by('part_number'):
            cloned_part = ListeningPart.objects.create(
                test=cloned_test,
                part_number=part.part_number,
                audio=part.audio,  # Reference to same audio file
                audio_duration=part.audio_duration,
                instructions=part.instructions
            )
            
            # Clone questions for this part
            for question in part.questions.all().order_by('order'):
                cloned_question = ListeningQuestion.objects.create(
                    part=cloned_part,
                    question_type=question.question_type,
                    question_text=question.question_text,
                    order=question.order,
                    extra_data=question.extra_data,
                    correct_answers=question.correct_answers,
                    header=question.header,
                    instruction=question.instruction,
                    task_prompt=question.task_prompt,
                    image=question.image,
                    image_file=question.image_file,  # Reference to same image file
                    points=question.points,
                    scoring_mode=question.scoring_mode
                )
                
                # Clone answer options
                for option in question.options.all():
                    ListeningAnswerOption.objects.create(
                        question=cloned_question,
                        label=option.label,
                        text=option.text,
                        points=option.points
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
    
    @method_decorator(ratelimit(key='user', rate='10/h', method='POST'))
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
        
        # CRITICAL: Validate actual file content using magic numbers (MIME type validation)
        try:
            file_content = audio_file.read(2048)  # Read first 2KB for magic number detection
            audio_file.seek(0)  # Reset file pointer
            detected_mime = magic.from_buffer(file_content, mime=True)
            
            allowed_mimes = ['audio/mpeg', 'audio/mp3', 'audio/x-wav', 'audio/wav', 'audio/ogg', 'audio/x-m4a']
            if detected_mime not in allowed_mimes:
                security_logger.warning(f"File upload rejected - invalid MIME type {detected_mime} from user {user.uid}")
                return Response({'error': 'Invalid file type detected. Only audio files allowed.'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            security_logger.error(f"File validation error: {str(e)}")
            return Response({'error': 'File validation failed'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Additional check: verify content-type header matches detected MIME
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

    @method_decorator(ratelimit(key='user', rate='20/h', method='POST'))
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

        # CRITICAL: Validate actual file content using magic numbers
        try:
            file_content = image_file.read(2048)
            image_file.seek(0)
            detected_mime = magic.from_buffer(file_content, mime=True)

            allowed_mimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
            if detected_mime not in allowed_mimes:
                security_logger.warning(f"Image upload rejected - invalid MIME type {detected_mime}")
                return Response({'error': 'Invalid image type detected'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            security_logger.error(f"Image validation error: {str(e)}")
            return Response({'error': 'File validation failed'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate file type (secondary check)
        allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        if image_file.content_type not in allowed_types:
            return Response({'error': 'Invalid file type. Allowed: JPEG, PNG, GIF, WEBP'}, status=status.HTTP_400_BAD_REQUEST)

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
            if user.role not in ['admin', 'curator']:
                return Response({'error': 'Admin or Curator access required'}, status=status.HTTP_403_FORBIDDEN)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        # Get filter parameters
        group = request.query_params.get('group')
        teacher = request.query_params.get('teacher')
        
        # Base queryset
        students = User.objects.filter(role='student', is_active=True)
        if group:
            students = students.filter(group=group)
        if teacher:
            students = students.filter(teacher=teacher)

        test = get_object_or_404(ListeningTest, pk=test_id)
        sessions = ListeningTestSession.objects.filter(
            test=test, 
            submitted=True, 
            user__in=students
        ).select_related('user').order_by('user__student_id')

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
        # Проверяем права админа или куратора
        try:
            user = User.objects.get(uid=request.user.uid)
            if user.role not in ['admin', 'curator']:
                return Response({'error': 'Admin or Curator access required'}, status=403)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)

        # Get filter parameters
        group = request.query_params.get('group')
        teacher = request.query_params.get('teacher')
        
        # Base queryset
        students = User.objects.filter(role='student', is_active=True)
        if group:
            students = students.filter(group=group)
        if teacher:
            students = students.filter(teacher=teacher)

        try:
            test = ReadingTest.objects.get(id=test_id)
        except ReadingTest.DoesNotExist:
            return Response({'error': 'Test not found'}, status=404)

        # Получаем все завершенные сессии по этому тесту с фильтрами
        sessions = ReadingTestSession.objects.filter(
            test=test, 
            completed=True,
            user__in=students
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


class AdminBulkImportStudentsView(APIView):
    permission_classes = [IsAdmin]
    
    def post(self, request):
        if 'file' not in request.FILES:
            return Response({'error': 'No file provided'}, status=400)
        
        uploaded_file = request.FILES['file']
        file_name = uploaded_file.name.lower()
        
        # Определение типа файла
        if file_name.endswith('.csv'):
            file_type = 'csv'
            file_content = uploaded_file.read().decode('utf-8')
        elif file_name.endswith(('.xlsx', '.xls')):
            file_type = 'xlsx' if file_name.endswith('.xlsx') else 'xls'
            file_content = uploaded_file.read()
        else:
            return Response({'error': 'Unsupported file type. Please use CSV or Excel files.'}, status=400)
        
        # Проверка размера файла (максимум 5MB)
        if len(file_content) > 5 * 1024 * 1024:
            return Response({'error': 'File too large. Maximum size is 5MB.'}, status=400)
        
        from .bulk_import import process_students_file, create_students_batch
        
        # Обработка файла
        result = process_students_file(file_content, file_type)
        
        if 'error' in result:
            return Response(result, status=400)
        
        # Если mode=validate, только валидация без создания
        mode = request.data.get('mode', 'create')
        if mode == 'validate':
            return Response({
                'success': True,
                'message': f'File validated successfully. {result["count"]} students ready to import.',
                'count': result['count'],
                'preview': result['students'][:5]  # Показать первые 5 для предварительного просмотра
            })
        
        # Создание студентов
        creation_result = create_students_batch(result['students'])
        
        return Response({
            'success': True,
            'message': f'Bulk import completed. Created {creation_result["created_count"]} students.',
            'created_count': creation_result['created_count'],
            'error_count': creation_result['error_count'],
            'created_students': creation_result['created_students'],
            'errors': creation_result['errors']
        })

class AdminCreateTeacherView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        data = request.data.copy()
        
        # Принудительно устанавливаем роль teacher
        data['role'] = 'teacher'
        
        # Валидация входных данных
        serializer = UserSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        password = data.get('password')
        
        if not password or len(password) < 6:
            return Response({'error': 'Password must be at least 6 characters.'}, status=400)
        
        # Проверка уникальности email и teacher_id (используем student_id как универсальный ID)
        if User.objects.filter(email=email).exists():
            return Response({'error': 'Email already exists.'}, status=400)
        
        teacher_id = serializer.validated_data.get('student_id')  # Используем student_id как teacher_id
        if teacher_id and User.objects.filter(student_id=teacher_id).exists():
            return Response({'error': 'Teacher ID already exists.'}, status=400)
        
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
        
        # Создание учителя в Django
        teacher = User.objects.create(
            uid=firebase_user.uid,
            role='teacher',
            student_id=teacher_id,  # Используем как teacher_id
            first_name=serializer.validated_data.get('first_name'),
            last_name=serializer.validated_data.get('last_name'),
            email=email,
            group=serializer.validated_data.get('group'),  # Может содержать группы которые ведет
            teacher=serializer.validated_data.get('teacher'),  # Может содержать предметы которые ведет
        )
        
        return Response(UserSerializer(teacher).data, status=201)

class AdminCreateCuratorView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        data = request.data.copy()
        data['role'] = 'curator'
        serializer = UserSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        password = data.get('password')
        curator_id = serializer.validated_data.get('curator_id')
        
        if not password or len(password) < 6:
            return Response({'error': 'Password must be at least 6 characters.'}, status=400)
        if User.objects.filter(email=email).exists():
            return Response({'error': 'Email already exists.'}, status=400)
        if curator_id and User.objects.filter(curator_id=curator_id).exists():
            return Response({'error': 'Curator ID already exists.'}, status=400)
            
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
        curator = User.objects.create(
            uid=firebase_user.uid,
            role='curator',
            curator_id=curator_id,
            first_name=serializer.validated_data.get('first_name'),
            last_name=serializer.validated_data.get('last_name'),
            email=email,
        )
        return Response(UserSerializer(curator).data, status=201)


class AdminCuratorsListView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        curators = User.objects.filter(role='curator').order_by('curator_id', 'first_name', 'last_name')
        serializer = UserSerializer(curators, many=True)
        return Response(serializer.data)

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

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        try:
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if auth_header.startswith('Bearer '):
                decoded = verify_firebase_token(auth_header.split(' ')[1])
                if decoded:
                    uid = decoded['uid']
                    user = User.objects.get(uid=uid)
                    test_ids = [item['id'] for item in response.data]
                    completed = set(
                        ReadingTestSession.objects.filter(user=user, test_id__in=test_ids, completed=True).values_list('test_id', flat=True)
                    )
                    for item in response.data:
                        item['user_completed'] = item['id'] in completed
                else:
                    for item in response.data:
                        item['user_completed'] = False
            else:
                for item in response.data:
                    item['user_completed'] = False
        except Exception:
            for item in response.data:
                item['user_completed'] = False
        return response

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def activate(self, request, pk=None):
        test = self.get_object()
        test.is_active = True
        test.save()
        return Response({'message': 'Test activated successfully'})

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
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
        Start (or resume) a test session.
        """
        test = get_object_or_404(ReadingTest, pk=test_id)
        
        # Diagnostic flag
        diagnostic_flag = False
        try:
            diagnostic_flag = str(request.query_params.get('diagnostic', request.data.get('diagnostic', ''))).lower() in ['1','true','yes']
        except Exception:
            diagnostic_flag = False

        if diagnostic_flag:
            # Lock if any regular completed test exists in any module
            if (
                ListeningTestSession.objects.filter(user=request.user, submitted=True, is_diagnostic=False).exists() or
                ReadingTestSession.objects.filter(user=request.user, completed=True, is_diagnostic=False).exists() or
                WritingTestSession.objects.filter(user=request.user, completed=True, is_diagnostic=False).exists()
            ):
                return Response({'detail': 'Diagnostic flow is locked because regular tests already exist.'}, status=status.HTTP_403_FORBIDDEN)
            # Ensure template
            if not getattr(test, 'is_diagnostic_template', False):
                return Response({'detail': 'Selected test is not configured as a diagnostic template.'}, status=status.HTTP_400_BAD_REQUEST)
            # Only one diagnostic reading per user
            if ReadingTestSession.objects.filter(user=request.user, completed=True, is_diagnostic=True).exists():
                return Response({'detail': 'Diagnostic reading already completed.'}, status=status.HTTP_409_CONFLICT)
        
        # Resume existing unfinished session for this user/test/diagnostic flag
        existing_session = (
            ReadingTestSession.objects
            .filter(user=request.user, test=test, completed=False, is_diagnostic=diagnostic_flag)
            .order_by('-start_time')
            .first()
        )

        if existing_session:
            serializer = ReadingTestSessionSerializer(existing_session)
            return Response(serializer.data, status=status.HTTP_200_OK)

        # Create a new session if nothing to resume
        session = ReadingTestSession.objects.create(user=request.user, test=test, is_diagnostic=diagnostic_flag)
            
        serializer = ReadingTestSessionSerializer(session)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, session_id):
        """
        Submit answers for a session (finish test).
        """
        with transaction.atomic():
            session = ReadingTestSession.objects.select_for_update().get(pk=session_id, user=request.user)
            if session.completed:
                return Response({'error': 'This session has already been completed.'}, status=status.HTTP_400_BAD_REQUEST)

            answers_data = request.data.get('answers', None)
            time_left = request.data.get('time_left')

            if not isinstance(session.answers, dict):
                session.answers = {}
            if isinstance(answers_data, dict):
                for question_id, answer_value in answers_data.items():
                    if (
                        isinstance(answer_value, dict)
                        and question_id in session.answers
                        and isinstance(session.answers.get(question_id), dict)
                    ):
                        session.answers[question_id].update(answer_value)
                    else:
                        session.answers[question_id] = answer_value

            if time_left is not None:
                try:
                    session.time_left_seconds = max(0, int(time_left))
                except (TypeError, ValueError):
                    pass
            session.end_time = timezone.now()
            session.completed = True
            session.save(update_fields=['answers', 'time_left_seconds', 'end_time', 'completed', 'last_updated'])
        
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
        time_left = request.data.get('time_left')
        
        if not isinstance(session.answers, dict):
            session.answers = {}
        
        # КРИТИЧНО: Мержим данные правильно, чтобы не потерять существующие ответы
        # Если клиент отправляет неполные данные (например, только последние изменения),
        # мы должны сохранить старые данные и обновить только новые
        if isinstance(answers_data, dict):
            # Для вложенных структур (gap_fill, matching) мержим правильно
            for question_id, answer_value in answers_data.items():
                if isinstance(answer_value, dict) and question_id in session.answers and isinstance(session.answers[question_id], dict):
                    # Мержим вложенные ответы (например, gap_fill: {gap8: value, gap9: value})
                    session.answers[question_id].update(answer_value)
                else:
                    # Для плоских структур или новых вопросов просто обновляем
                    session.answers[question_id] = answer_value
        else:
            # Fallback для некорректных данных
            session.answers = answers_data if isinstance(answers_data, dict) else {}

        if time_left is not None:
            try:
                session.time_left_seconds = max(0, int(time_left))
            except (TypeError, ValueError):
                pass

        session.save(update_fields=['answers', 'time_left_seconds', 'last_updated'])

        return Response({'message': 'Progress saved'}, status=status.HTTP_200_OK)

    def _calculate_and_save_results(self, session):
        # Используем новую функцию create_detailed_breakdown для правильного подсчета баллов
        from .serializers import create_detailed_breakdown
        
        # Используем create_detailed_breakdown для правильного подсчета
        breakdown_result = create_detailed_breakdown(session, 'reading')
        
        raw_score = breakdown_result['raw_score']
        total_possible_score = breakdown_result['total_score']
        
        # Преобразуем массив частей в объект с вопросами для фронтенда
        full_breakdown = {}
        for part in breakdown_result['breakdown']:
            for question in part['questions']:
                question_id = str(question['question_id'])
                
                # Для multiple_response вопросов создаем специальную структуру
                if question['question_type'] == 'multiple_response':
                    # Обрабатываем новую структуру multiple_response (один элемент с опциями)
                    multiple_response_data = None
                    for sub_question in question['sub_questions']:
                        if sub_question.get('type') == 'multiple_response':
                            multiple_response_data = sub_question
                            break
                    
                    if multiple_response_data:
                        # Используем данные из нового формата
                        full_breakdown[question_id] = {
                            'question_text': question['question_text'],
                            'question_type': question['question_type'],
                            'header': question['header'],
                            'instruction': question['instruction'],
                            'part_number': part.get('part_number'),
                            'sub_questions': [{
                                'id': question_id,
                                'question_text': question['question_text'],
                                'type': 'multiple_response',
                                'options': multiple_response_data.get('options', []),
                                'scoring_mode': multiple_response_data.get('scoring_mode', 'total'),
                                'final_score': question['correct_sub_questions'],
                                'max_score': question['total_sub_questions'],
                                'is_correct': multiple_response_data.get('is_correct', False)
                            }]
                        }
                    else:
                        # Fallback для старой структуры (если она еще используется)
                        full_breakdown[question_id] = {
                            'question_text': question['question_text'],
                            'question_type': question['question_type'],
                            'header': question['header'],
                            'instruction': question['instruction'],
                            'part_number': part.get('part_number'),
                            'sub_questions': [{
                                'id': question_id,
                                'question_text': question['question_text'],
                                'type': 'multiple_response',
                                'options': [],
                                'scoring_mode': question.get('scoring_mode', 'total'),
                                'final_score': question['correct_sub_questions'],
                                'max_score': question['total_sub_questions']
                            }]
                        }
                        
                        # Добавляем опции из старой структуры
                        for sub_question in question['sub_questions']:
                            if 'sub_id' in sub_question:  # Проверяем что это старая структура
                                full_breakdown[question_id]['sub_questions'][0]['options'].append({
                                    'label': sub_question['sub_id'],
                                    'text': sub_question['label'],
                                    'is_correct_option': sub_question['correct_answer'] == 'Should be selected',
                                    'student_selected': sub_question['user_answer'] == 'Selected',
                                    'points': sub_question.get('points', 1)
                                })
                else:
                    # Для обычных вопросов используем стандартную структуру
                    full_breakdown[question_id] = {
                        'question_text': question['question_text'],
                        'question_type': question['question_type'],
                        'header': question['header'],
                        'instruction': question['instruction'],
                        'part_number': part.get('part_number'),
                        'sub_questions': question['sub_questions']
                    }

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


class ReadingAIFeedbackView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        session = get_object_or_404(ReadingTestSession, pk=session_id, user=request.user)

        if not session.completed:
            return Response({'error': 'Session not completed yet'}, status=status.HTTP_400_BAD_REQUEST)

        refresh = request.query_params.get('refresh') == '1'
        result = ReadingTestResult.objects.filter(session=session).first()
        if result and result.ai_feedback and result.ai_feedback_version == AI_FEEDBACK_PROMPT_VERSION and not refresh:
            return Response({
                'feedback': result.ai_feedback,
                'cached': True,
                'prompt_version': AI_FEEDBACK_PROMPT_VERSION,
                'updated_at': result.ai_feedback_updated_at.isoformat() if result.ai_feedback_updated_at else None
            })

        try:
            payload = build_feedback_payload(session, 'reading')
            feedback_text = generate_ai_feedback('reading', payload)
            cache_feedback(result, feedback_text)
            return Response({
                'feedback': feedback_text,
                'cached': False,
                'prompt_version': AI_FEEDBACK_PROMPT_VERSION,
                'updated_at': result.ai_feedback_updated_at.isoformat() if result and result.ai_feedback_updated_at else None
            })
        except Exception as e:
            return Response({'error': 'AI feedback failed', 'details': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class GetEmailBySIDView(APIView):
    permission_classes = [IsAuthenticated]  # Security: Protect PII endpoint

    def get(self, request):
        sid = request.query_params.get('student_id')
        if not sid:
            return Response({'error': 'student_id required'}, status=400)
        try:
            user = User.objects.get(student_id=sid)
            if not user.email:
                return Response({'error': 'Email not set for this user'}, status=404)
            return Response({
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'group': user.group,
                'role': user.role
            })
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)


class GetEmailByCuratorIDView(APIView):
    permission_classes = [IsAuthenticated]  # Security: Protect PII endpoint

    def get(self, request):
        curator_id = request.query_params.get('curator_id')
        if not curator_id:
            return Response({'error': 'curator_id required'}, status=400)
        try:
            user = User.objects.get(curator_id=curator_id, role='curator')
            if not user.email:
                return Response({'error': 'Email not set for this user'}, status=404)
            return Response({
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role
            })
        except User.DoesNotExist:
            return Response({'error': 'Curator not found'}, status=404)

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

class AdminStudentResultsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return Response({'error': 'Authentication required'}, status=401)
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return Response({'error': 'Invalid token'}, status=401)
        uid = decoded['uid']
        try:
            admin_user = User.objects.get(uid=uid)
            if admin_user.role != 'admin':
                return Response({'error': 'Admin access required'}, status=403)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=401)

        student_id = request.query_params.get('student_id')
        if not student_id:
            return Response({'error': 'student_id parameter required'}, status=400)

        try:
            student = User.objects.get(student_id=student_id)
        except User.DoesNotExist:
            return Response({'error': 'Student not found'}, status=404)

        # Получаем все тесты студента
        essays = Essay.objects.filter(user=student).order_by('-submitted_at')
        listening_sessions = ListeningTestSession.objects.filter(
            user=student, 
            submitted=True
        ).select_related('test').order_by('-completed_at')
        reading_sessions = ReadingTestSession.objects.filter(
            user=student, 
            completed=True
        ).select_related('test').order_by('-end_time')

        # Формируем ответ в том же формате что и Dashboard студента
        all_sessions = []

        # Writing essays
        for essay in essays:
            all_sessions.append({
                'type': 'Writing',
                'item': {
                    'id': essay.id,
                    'test_session': essay.test_session.id if essay.test_session else None,
                    'task_type': essay.task_type,
                    'overall_band': essay.overall_band,
                    'submitted_at': essay.submitted_at,
                    'question_text': essay.question_text,
                    'submitted_text': essay.submitted_text,
                    'feedback': essay.feedback,
                    'score_task': essay.score_task,
                    'score_coherence': essay.score_coherence,
                    'score_lexical': essay.score_lexical,
                    'score_grammar': essay.score_grammar
                },
                'date': essay.submitted_at,
                'band_score': essay.overall_band,
                'test_title': f"Writing Task {essay.task_type.upper()}"
            })

        # Listening sessions
        for session in listening_sessions:
            # Получаем band_score из связанной модели ListeningTestResult
            # У ListeningTestResult нет related_name, поэтому используем listeningtestresult
            result = getattr(session, 'listeningtestresult', None)
            band_score = result.band_score if result else None
            
            # Используем completed_at если есть, иначе started_at
            session_date = session.completed_at or session.started_at
            
            all_sessions.append({
                'type': 'Listening',
                'item': {
                    'id': session.id,
                    'test_title': session.test.title,
                    'correct_answers_count': session.correct_answers_count,
                    'total_questions_count': session.total_questions_count,
                    'band_score': band_score,
                    'completed_at': session.completed_at,
                    'raw_score': getattr(session, 'raw_score', session.correct_answers_count)
                },
                'date': session_date,
                'band_score': band_score,
                'test_title': session.test.title
            })

        # Reading sessions
        for session in reading_sessions:
            result = getattr(session, 'result', None)
            all_sessions.append({
                'type': 'Reading',
                'item': {
                    'id': session.id,
                    'test_title': session.test.title,
                    'band_score': result.band_score if result else None,
                    'raw_score': result.raw_score if result else None,
                    'total_score': result.total_score if result else None,
                    'end_time': session.end_time
                },
                'date': session.end_time,
                'band_score': result.band_score if result else None,
                'test_title': session.test.title
            })

        # Сортируем по дате (новые сначала)
        all_sessions.sort(key=lambda x: x['date'] or timezone.now(), reverse=True)

        return Response({
            'student': {
                'student_id': student.student_id,
                'first_name': student.first_name,
                'last_name': student.last_name,
                'email': student.email
            },
            'sessions': all_sessions
        })


class AdminReadingSessionListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return Response({'error': 'Authentication required'}, status=401)
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return Response({'error': 'Invalid token'}, status=401)
        uid = decoded['uid']
        try:
            admin_user = User.objects.get(uid=uid)
            if admin_user.role != 'admin':
                return Response({'error': 'Admin access required'}, status=403)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=401)

        student_id = request.query_params.get('student_id')
        if not student_id:
            return Response({'error': 'student_id parameter required'}, status=400)

        try:
            student = User.objects.get(student_id=student_id)
        except User.DoesNotExist:
            return Response({'error': 'Student not found'}, status=404)

        sessions = ReadingTestSession.objects.filter(
            user=student, 
            completed=True
        ).select_related('test', 'result').order_by('-end_time')

        data = []
        for session in sessions:
            result = getattr(session, 'result', None)
            data.append({
                'id': session.id,
                'test_title': session.test.title,
                'band_score': result.band_score if result else None,
                'raw_score': result.raw_score if result else None,
                'total_score': result.total_score if result else None,
                'end_time': session.end_time,
                'completed': session.completed
            })

        return Response(data)


class AdminReadingSessionResultView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, session_id):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return Response({'error': 'Authentication required'}, status=401)
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return Response({'error': 'Invalid token'}, status=401)
        uid = decoded['uid']
        try:
            admin_user = User.objects.get(uid=uid)
            if admin_user.role != 'admin':
                return Response({'error': 'Admin access required'}, status=403)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=401)

        try:
            session = ReadingTestSession.objects.get(id=session_id, completed=True)
        except ReadingTestSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=404)

        if hasattr(session, 'result'):
            serializer = ReadingTestResultSerializer(session.result)
            return Response(serializer.data)
        else:
            return Response({'error': 'Result not found'}, status=404)


class AdminListeningSessionResultView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, session_id):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return Response({'error': 'Authentication required'}, status=401)
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return Response({'error': 'Invalid token'}, status=401)
        uid = decoded['uid']
        try:
            admin_user = User.objects.get(uid=uid)
            if admin_user.role != 'admin':
                return Response({'error': 'Admin access required'}, status=403)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=401)

        try:
            session = ListeningTestSession.objects.get(id=session_id)
        except ListeningTestSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=404)

        # Получаем связанный результат
        result = getattr(session, 'listeningtestresult', None)
        
        # Форматируем данные как в Dashboard
        session_data = {
            'id': session.id,
            'test_title': session.test.title,
            'correct_answers_count': session.correct_answers_count,
            'total_questions_count': session.total_questions_count,
            'band_score': result.band_score if result else None,
            'completed_at': session.completed_at,
            'started_at': session.started_at,
            'score': session.score,
            'answers': session.answers
        }

        return Response(session_data)


class AdminListeningSessionListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return Response({'error': 'Authentication required'}, status=401)
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return Response({'error': 'Invalid token'}, status=401)
        uid = decoded['uid']
        try:
            admin_user = User.objects.get(uid=uid)
            if admin_user.role != 'admin':
                return Response({'error': 'Admin access required'}, status=403)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=401)

        student_id = request.GET.get('student_id')
        if not student_id:
            return Response({'error': 'student_id parameter is required'}, status=400)

        try:
            student = User.objects.get(student_id=student_id, role='student')
        except User.DoesNotExist:
            return Response({'error': 'Student not found'}, status=404)

        sessions = ListeningTestSession.objects.filter(
            user=student
        ).select_related('test', 'listeningtestresult').order_by('-completed_at')

        # Форматируем данные как в Dashboard
        sessions_data = []
        for session in sessions:
            result = getattr(session, 'listeningtestresult', None)
            sessions_data.append({
                'id': session.id,
                'test_title': session.test.title,
                'correct_answers_count': session.correct_answers_count,
                'total_questions_count': session.total_questions_count,
                'band_score': result.band_score if result else None,
                'completed_at': session.completed_at,
                'started_at': session.started_at,
                'score': session.score
            })

        return Response(sessions_data)


class AdminEssayListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return Response({'error': 'Authentication required'}, status=401)
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return Response({'error': 'Invalid token'}, status=401)
        uid = decoded['uid']
        try:
            admin_user = User.objects.get(uid=uid)
            if admin_user.role != 'admin':
                return Response({'error': 'Admin access required'}, status=403)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=401)

        student_id = request.GET.get('student_id')
        if not student_id:
            return Response({'error': 'student_id parameter is required'}, status=400)

        try:
            student = User.objects.get(student_id=student_id, role='student')
        except User.DoesNotExist:
            return Response({'error': 'Student not found'}, status=404)

        essays = Essay.objects.filter(
            user=student
        ).order_by('-submitted_at')

        # Форматируем данные как в Dashboard
        essays_data = []
        for essay in essays:
            essays_data.append({
                'id': essay.id,
                'task_type': essay.task_type,
                'question_text': essay.question_text,
                'submitted_text': essay.submitted_text,
                'overall_band': essay.overall_band,
                'score_task': essay.score_task,
                'score_coherence': essay.score_coherence,
                'score_lexical': essay.score_lexical,
                'score_grammar': essay.score_grammar,
                'feedback': essay.feedback,
                'submitted_at': essay.submitted_at,
                'test_session': essay.test_session.id if essay.test_session else None
            })

        return Response(essays_data)


class AdminListeningSessionDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, session_id):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return Response({'error': 'Authentication required'}, status=401)
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return Response({'error': 'Invalid token'}, status=401)
        uid = decoded['uid']
        try:
            admin_user = User.objects.get(uid=uid)
            if admin_user.role != 'admin':
                return Response({'error': 'Admin access required'}, status=403)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=401)

        try:
            session = ListeningTestSession.objects.get(id=session_id)
        except ListeningTestSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=404)

        # Получаем связанный результат
        result = getattr(session, 'listeningtestresult', None)
        
        # Форматируем данные как в Dashboard
        session_data = {
            'id': session.id,
            'test_title': session.test.title,
            'correct_answers_count': session.correct_answers_count,
            'total_questions_count': session.total_questions_count,
            'band_score': result.band_score if result else None,
            'completed_at': session.completed_at,
            'started_at': session.started_at,
            'score': session.score,
            'answers': session.answers
        }

        return Response(session_data)


class AdminReadingSessionDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, session_id):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return Response({'error': 'Authentication required'}, status=401)
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return Response({'error': 'Invalid token'}, status=401)
        uid = decoded['uid']
        try:
            admin_user = User.objects.get(uid=uid)
            if admin_user.role != 'admin':
                return Response({'error': 'Admin access required'}, status=403)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=401)

        try:
            session = ReadingTestSession.objects.get(id=session_id)
        except ReadingTestSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=404)

        result = getattr(session, 'readingtestresult', None)
        
        session_data = {
            'id': session.id,
            'test_title': session.test.title,
            'correct_answers_count': session.correct_answers_count,
            'total_questions_count': session.total_questions_count,
            'band_score': result.band_score if result else None,
            'completed_at': session.completed_at,
            'started_at': session.started_at,
            'score': session.score,
            'answers': session.answers
        }

        return Response(session_data)

# ------------------------------
# Teacher Satisfaction Survey Views
# ------------------------------

class TeacherSatisfactionSurveyView(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request):
        """Get survey status for current student"""
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return Response({'error': 'Authentication required'}, status=401)
        
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return Response({'error': 'Invalid token'}, status=401)
        
        uid = decoded['uid']
        try:
            student = User.objects.get(uid=uid)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)
        
        # Check if student already submitted this week
        from django.utils import timezone
        now = timezone.now()
        
        # Правильное определение начала недели (понедельник = 0, воскресенье = 6)
        # Если сегодня понедельник (weekday=0), то week_start = сегодня
        # Если сегодня среда (weekday=2), то week_start = понедельник этой недели
        week_start = now - timedelta(days=now.weekday())
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        
        try:
            existing_survey = TeacherSatisfactionSurvey.objects.get(
                student=student,
                submitted_at__gte=week_start
            )
            return Response({
                'submittedThisWeek': True,
                'submission': {
                    'is_satisfied': existing_survey.is_satisfied,
                    'reason': existing_survey.reason
                },
                'weekStart': week_start.isoformat()
            })
        except TeacherSatisfactionSurvey.DoesNotExist:
            return Response({
                'submittedThisWeek': False,
                'weekStart': week_start.isoformat()
            })
    
    def post(self, request):
        """Submit survey"""
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return Response({'error': 'Authentication required'}, status=401)
        
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return Response({'error': 'Invalid token'}, status=401)
        
        uid = decoded['uid']
        try:
            student = User.objects.get(uid=uid)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)
        
        # Check if already submitted this week
        from django.utils import timezone
        now = timezone.now()
        
        # Правильное определение начала недели (понедельник = 0, воскресенье = 6)
        # Если сегодня понедельник (weekday=0), то week_start = сегодня
        # Если сегодня среда (weekday=2), то week_start = понедельник этой недели
        week_start = now - timedelta(days=now.weekday())
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        
        try:
            existing_survey = TeacherSatisfactionSurvey.objects.get(
                student=student,
                submitted_at__gte=week_start
            )
            return Response({
                'error': "You already submitted this week's survey"
            }, status=409)
        except TeacherSatisfactionSurvey.DoesNotExist:
            pass
        
        # Create new survey
        is_satisfied = request.data.get('is_satisfied')
        reason = request.data.get('reason', '')
        
        if is_satisfied is None:
            return Response({'error': 'is_satisfied field is required'}, status=400)
        
        if not is_satisfied and not reason.strip():
            return Response({'error': 'Reason is required when not satisfied'}, status=400)
        
        survey = TeacherSatisfactionSurvey.objects.create(
            student=student,
            is_satisfied=is_satisfied,
            reason=reason if not is_satisfied else None
        )
        
        serializer = TeacherSatisfactionSurveySerializer(survey)
        return Response(serializer.data, status=201)


class AdminTeacherSurveyResultsView(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request):
        """Get all survey results for admin"""
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return Response({'error': 'Authentication required'}, status=401)
        
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return Response({'error': 'Invalid token'}, status=401)
        
        uid = decoded['uid']
        try:
            admin_user = User.objects.get(uid=uid)
            if admin_user.role != 'admin':
                return Response({'error': 'Admin access required'}, status=403)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=401)
        
        # Get all surveys with student info
        surveys = TeacherSatisfactionSurvey.objects.select_related('student').all()
        serializer = TeacherSatisfactionSurveySerializer(surveys, many=True)
        
        # Calculate statistics
        total_surveys = surveys.count()
        satisfied_count = surveys.filter(is_satisfied=True).count()
        satisfaction_rate = (satisfied_count / total_surveys * 100) if total_surveys > 0 else 0
        
        return Response({
            'surveys': serializer.data,
            'statistics': {
                'total_surveys': total_surveys,
                'satisfied_count': satisfied_count,
                'not_satisfied_count': total_surveys - satisfied_count,
                'satisfaction_rate': round(satisfaction_rate, 1)
            }
        })


# ==================== BATCH API (IELTS) ====================
class BatchStudentProfilesView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        _, error = _require_roles(request, allowed_roles=('admin', 'curator'))
        if error:
            return error

        emails = request.data.get('emails')
        if not isinstance(emails, list) or len(emails) == 0:
            return Response({'error': 'Emails array is required and cannot be empty'}, status=400)

        try:
            limit = int(request.data.get('limit', 50))
        except (TypeError, ValueError):
            return Response({'error': 'Limit must be an integer'}, status=400)
        if limit < 1:
            return Response({'error': 'Limit must be greater than 0'}, status=400)

        normalized = _normalize_emails(emails)
        total = len(normalized)
        limited = normalized[:limit]

        users = User.objects.filter(email__in=limited)
        user_map = {u.email.lower(): u for u in users}

        results = []
        for email in limited:
            user = user_map.get(email)
            if not user:
                results.append({'email': email, 'error': 'Student not found'})
                continue
            full_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or None
            results.append({
                'email': user.email,
                'data': {
                    'fullName': full_name,
                    'firstName': user.first_name,
                    'lastName': user.last_name,
                    'studentId': user.student_id,
                    'email': user.email,
                    'group': user.group,
                    'teacher': user.teacher,
                    'curatorId': user.curator_id,
                    'status': 'Active' if user.is_active else 'Inactive'
                }
            })

        return Response({
            'total': total,
            'processed': len(limited),
            'limit': limit,
            'results': results
        })


class BatchStudentsLatestTestDetailsView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        _, error = _require_roles(request, allowed_roles=('admin', 'curator'))
        if error:
            return error

        emails = request.data.get('emails')
        if not isinstance(emails, list) or len(emails) == 0:
            return Response({'error': 'Emails array is required and cannot be empty'}, status=400)

        try:
            limit = int(request.data.get('limit', 50))
        except (TypeError, ValueError):
            return Response({'error': 'Limit must be an integer'}, status=400)
        if limit < 1:
            return Response({'error': 'Limit must be greater than 0'}, status=400)

        include_diagnostics = bool(request.data.get('includeDiagnostics', False))
        include_answers = bool(request.data.get('includeAnswers', False))

        normalized = _normalize_emails(emails)
        total = len(normalized)
        limited = normalized[:limit]

        users = User.objects.filter(email__in=limited)
        user_map = {u.email.lower(): u for u in users}

        def latest_listening(student):
            qs = ListeningTestSession.objects.filter(user=student, submitted=True)
            if not include_diagnostics:
                qs = qs.filter(is_diagnostic=False)
            session = qs.select_related('test').order_by('-completed_at', '-started_at').first()
            if not session:
                return None
            result = getattr(session, 'listeningtestresult', None)
            answers = None
            if include_answers:
                answers = list(
                    ListeningStudentAnswer.objects.filter(session=session)
                    .values('question_id', 'answer', 'flagged', 'submitted_at')
                )
            return {
                'sessionId': session.id,
                'testId': session.test.id if session.test else None,
                'testTitle': session.test.title if session.test else None,
                'completedAt': session.completed_at,
                'correctAnswersCount': session.correct_answers_count,
                'totalQuestionsCount': session.total_questions_count,
                'rawScore': getattr(session, 'raw_score', session.correct_answers_count),
                'bandScore': result.band_score if result else None,
                'submitted': session.submitted,
                'answers': answers
            }

        def latest_reading(student):
            qs = ReadingTestSession.objects.filter(user=student, completed=True)
            if not include_diagnostics:
                qs = qs.filter(is_diagnostic=False)
            session = qs.select_related('test', 'result').order_by('-end_time', '-start_time').first()
            if not session:
                return None
            result = getattr(session, 'result', None)
            return {
                'sessionId': session.id,
                'testId': session.test.id if session.test else None,
                'testTitle': session.test.title if session.test else None,
                'endTime': session.end_time,
                'rawScore': result.raw_score if result else None,
                'totalScore': result.total_score if result else None,
                'bandScore': result.band_score if result else None,
                'completed': session.completed,
                'answers': session.answers if include_answers else None
            }

        def latest_writing(student):
            qs = Essay.objects.filter(user=student)
            if not include_diagnostics:
                qs = qs.filter(models.Q(test_session__isnull=True) | models.Q(test_session__is_diagnostic=False))
            essay = qs.order_by('-submitted_at').first()
            if not essay:
                return None
            feedback = getattr(essay, 'teacher_feedback', None)
            return {
                'essayId': essay.id,
                'taskType': essay.task_type,
                'questionText': essay.question_text,
                'submittedText': essay.submitted_text,
                'submittedAt': essay.submitted_at,
                'overallBand': essay.overall_band,
                'scoreTask': essay.score_task,
                'scoreCoherence': essay.score_coherence,
                'scoreLexical': essay.score_lexical,
                'scoreGrammar': essay.score_grammar,
                'taskId': essay.task_id,
                'promptId': essay.prompt_id,
                'teacherFeedback': {
                    'published': feedback.published if feedback else False,
                    'publishedAt': feedback.published_at if feedback else None,
                    'teacherOverallScore': feedback.teacher_overall_score if feedback else None
                } if feedback else None
            }

        def latest_speaking(student):
            session = SpeakingSession.objects.filter(student=student).order_by('-conducted_at').first()
            if not session:
                return None
            return {
                'sessionId': session.id,
                'conductedAt': session.conducted_at,
                'overallBandScore': session.overall_band_score,
                'fluencyCoherenceScore': session.fluency_coherence_score,
                'lexicalResourceScore': session.lexical_resource_score,
                'grammaticalRangeScore': session.grammatical_range_score,
                'pronunciationScore': session.pronunciation_score,
                'completed': session.completed
            }

        results = []
        for email in limited:
            user = user_map.get(email)
            if not user:
                results.append({'email': email, 'error': 'Student not found'})
                continue

            listening_data = latest_listening(user)
            reading_data = latest_reading(user)
            writing_data = latest_writing(user)
            speaking_data = latest_speaking(user)

            bands = []
            if listening_data and listening_data.get('bandScore') is not None:
                bands.append(listening_data['bandScore'])
            if reading_data and reading_data.get('bandScore') is not None:
                bands.append(reading_data['bandScore'])
            if writing_data and writing_data.get('overallBand') is not None:
                bands.append(writing_data['overallBand'])
            if speaking_data and speaking_data.get('overallBandScore') is not None:
                bands.append(speaking_data['overallBandScore'])
            overall_band = compute_ielts_average(bands)

            full_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or None
            results.append({
                'email': user.email,
                'data': {
                    'studentId': user.student_id,
                    'fullName': full_name,
                    'email': user.email,
                    'listeningTest': listening_data,
                    'readingTest': reading_data,
                    'writing': writing_data,
                    'speaking': speaking_data,
                    'overallBandApprox': overall_band
                }
            })

        return Response({
            'total': total,
            'processed': len(limited),
            'limit': limit,
            'results': results
        })


class BatchStudentsTestResultsView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        _, error = _require_roles(request, allowed_roles=('admin', 'curator'))
        if error:
            return error

        emails = request.data.get('emails')
        if not isinstance(emails, list) or len(emails) == 0:
            return Response({'error': 'Emails array is required and cannot be empty'}, status=400)

        try:
            limit = int(request.data.get('limit', 50))
        except (TypeError, ValueError):
            return Response({'error': 'Limit must be an integer'}, status=400)
        if limit < 1:
            return Response({'error': 'Limit must be greater than 0'}, status=400)

        try:
            per_module_limit = int(request.data.get('perModuleLimit', 10))
        except (TypeError, ValueError):
            return Response({'error': 'perModuleLimit must be an integer'}, status=400)
        if per_module_limit < 1:
            return Response({'error': 'perModuleLimit must be greater than 0'}, status=400)

        include_diagnostics = bool(request.data.get('includeDiagnostics', False))
        include_answers = bool(request.data.get('includeAnswers', False))

        normalized = _normalize_emails(emails)
        total = len(normalized)
        limited = normalized[:limit]

        users = User.objects.filter(email__in=limited)
        user_map = {u.email.lower(): u for u in users}

        results = []
        for email in limited:
            user = user_map.get(email)
            if not user:
                results.append({'email': email, 'error': 'Student not found'})
                continue

            listening_qs = ListeningTestSession.objects.filter(user=user, submitted=True)
            if not include_diagnostics:
                listening_qs = listening_qs.filter(is_diagnostic=False)
            listening_sessions = listening_qs.select_related('test').order_by('-completed_at', '-started_at')[:per_module_limit]
            listening_data = []
            for sess in listening_sessions:
                result_obj = getattr(sess, 'listeningtestresult', None)
                listening_data.append({
                    'sessionId': sess.id,
                    'testId': sess.test.id if sess.test else None,
                    'testTitle': sess.test.title if sess.test else None,
                    'completedAt': sess.completed_at,
                    'correctAnswersCount': sess.correct_answers_count,
                    'totalQuestionsCount': sess.total_questions_count,
                    'rawScore': getattr(sess, 'raw_score', sess.correct_answers_count),
                    'bandScore': result_obj.band_score if result_obj else None,
                    'submitted': sess.submitted,
                    'answers': list(
                        ListeningStudentAnswer.objects.filter(session=sess)
                        .values('question_id', 'answer', 'flagged', 'submitted_at')
                    ) if include_answers else None
                })

            reading_qs = ReadingTestSession.objects.filter(user=user, completed=True)
            if not include_diagnostics:
                reading_qs = reading_qs.filter(is_diagnostic=False)
            reading_sessions = reading_qs.select_related('test', 'result').order_by('-end_time', '-start_time')[:per_module_limit]
            reading_data = []
            for sess in reading_sessions:
                result_obj = getattr(sess, 'result', None)
                reading_data.append({
                    'sessionId': sess.id,
                    'testId': sess.test.id if sess.test else None,
                    'testTitle': sess.test.title if sess.test else None,
                    'endTime': sess.end_time,
                    'rawScore': result_obj.raw_score if result_obj else None,
                    'totalScore': result_obj.total_score if result_obj else None,
                    'bandScore': result_obj.band_score if result_obj else None,
                    'completed': sess.completed,
                    'answers': sess.answers if include_answers else None
                })

            essays_qs = Essay.objects.filter(user=user)
            if not include_diagnostics:
                essays_qs = essays_qs.filter(models.Q(test_session__isnull=True) | models.Q(test_session__is_diagnostic=False))
            essays = essays_qs.order_by('-submitted_at')[:per_module_limit]
            essays_data = []
            for essay in essays:
                feedback = getattr(essay, 'teacher_feedback', None)
                essays_data.append({
                    'essayId': essay.id,
                    'taskType': essay.task_type,
                    'questionText': essay.question_text,
                    'submittedText': essay.submitted_text,
                    'submittedAt': essay.submitted_at,
                    'overallBand': essay.overall_band,
                    'scoreTask': essay.score_task,
                    'scoreCoherence': essay.score_coherence,
                    'scoreLexical': essay.score_lexical,
                    'scoreGrammar': essay.score_grammar,
                    'taskId': essay.task_id,
                    'promptId': essay.prompt_id,
                    'teacherFeedbackPublished': feedback.published if feedback else False,
                    'teacherOverallScore': feedback.teacher_overall_score if feedback else None
                })

            speaking_qs = SpeakingSession.objects.filter(student=user).order_by('-conducted_at')[:per_module_limit]
            speaking_data = []
            for session in speaking_qs:
                speaking_data.append({
                    'sessionId': session.id,
                    'conductedAt': session.conducted_at,
                    'overallBandScore': session.overall_band_score,
                    'fluencyCoherenceScore': session.fluency_coherence_score,
                    'lexicalResourceScore': session.lexical_resource_score,
                    'grammaticalRangeScore': session.grammatical_range_score,
                    'pronunciationScore': session.pronunciation_score,
                    'completed': session.completed
                })

            full_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or None
            results.append({
                'email': user.email,
                'data': {
                    'studentId': user.student_id,
                    'fullName': full_name,
                    'email': user.email,
                    'listeningSessions': listening_data,
                    'readingSessions': reading_data,
                    'essays': essays_data,
                    'speakingSessions': speaking_data
                }
            })

        return Response({
            'total': total,
            'processed': len(limited),
            'limit': limit,
            'results': results
        })


class BatchStudentsTestResultsWeekView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        _, error = _require_roles(request, allowed_roles=('admin', 'curator'))
        if error:
            return error

        emails = request.data.get('emails')
        if not isinstance(emails, list) or len(emails) == 0:
            return Response({'error': 'Emails array is required and cannot be empty'}, status=400)

        try:
            limit = int(request.data.get('limit', 50))
        except (TypeError, ValueError):
            return Response({'error': 'Limit must be an integer'}, status=400)
        if limit < 1:
            return Response({'error': 'Limit must be greater than 0'}, status=400)

        try:
            per_module_limit = int(request.data.get('perModuleLimit', 10))
        except (TypeError, ValueError):
            return Response({'error': 'perModuleLimit must be an integer'}, status=400)
        if per_module_limit < 1:
            return Response({'error': 'perModuleLimit must be greater than 0'}, status=400)

        include_diagnostics = bool(request.data.get('includeDiagnostics', False))
        include_answers = bool(request.data.get('includeAnswers', False))

        week_start = _parse_date_body(request.data.get('weekStart'))
        week_end = _parse_date_body(request.data.get('weekEnd'))
        if not week_start:
            return Response({'error': 'weekStart is required in YYYY-MM-DD format'}, status=400)
        if week_end and week_end < week_start:
            return Response({'error': 'weekEnd must be >= weekStart'}, status=400)
        if not week_end:
            week_end = week_start + timedelta(days=6)

        normalized = _normalize_emails(emails)
        total = len(normalized)
        limited = normalized[:limit]

        users = User.objects.filter(email__in=limited)
        user_map = {u.email.lower(): u for u in users}

        results = []
        for email in limited:
            user = user_map.get(email)
            if not user:
                results.append({'email': email, 'error': 'Student not found'})
                continue

            listening_qs = ListeningTestSession.objects.filter(
                user=user, submitted=True,
                completed_at__date__gte=week_start,
                completed_at__date__lte=week_end
            )
            if not include_diagnostics:
                listening_qs = listening_qs.filter(is_diagnostic=False)
            listening_sessions = listening_qs.select_related('test').order_by('-completed_at', '-started_at')[:per_module_limit]
            listening_data = []
            for sess in listening_sessions:
                result_obj = getattr(sess, 'listeningtestresult', None)
                listening_data.append({
                    'sessionId': sess.id,
                    'testId': sess.test.id if sess.test else None,
                    'testTitle': sess.test.title if sess.test else None,
                    'completedAt': sess.completed_at,
                    'correctAnswersCount': sess.correct_answers_count,
                    'totalQuestionsCount': sess.total_questions_count,
                    'rawScore': getattr(sess, 'raw_score', sess.correct_answers_count),
                    'bandScore': result_obj.band_score if result_obj else None,
                    'submitted': sess.submitted,
                    'answers': list(
                        ListeningStudentAnswer.objects.filter(session=sess)
                        .values('question_id', 'answer', 'flagged', 'submitted_at')
                    ) if include_answers else None
                })

            reading_qs = ReadingTestSession.objects.filter(
                user=user, completed=True,
                end_time__date__gte=week_start,
                end_time__date__lte=week_end
            )
            if not include_diagnostics:
                reading_qs = reading_qs.filter(is_diagnostic=False)
            reading_sessions = reading_qs.select_related('test', 'result').order_by('-end_time', '-start_time')[:per_module_limit]
            reading_data = []
            for sess in reading_sessions:
                result_obj = getattr(sess, 'result', None)
                reading_data.append({
                    'sessionId': sess.id,
                    'testId': sess.test.id if sess.test else None,
                    'testTitle': sess.test.title if sess.test else None,
                    'endTime': sess.end_time,
                    'rawScore': result_obj.raw_score if result_obj else None,
                    'totalScore': result_obj.total_score if result_obj else None,
                    'bandScore': result_obj.band_score if result_obj else None,
                    'completed': sess.completed,
                    'answers': sess.answers if include_answers else None
                })

            essays_qs = Essay.objects.filter(
                user=user,
                submitted_at__date__gte=week_start,
                submitted_at__date__lte=week_end
            )
            if not include_diagnostics:
                essays_qs = essays_qs.filter(models.Q(test_session__isnull=True) | models.Q(test_session__is_diagnostic=False))
            essays = essays_qs.order_by('-submitted_at')[:per_module_limit]
            essays_data = []
            for essay in essays:
                feedback = getattr(essay, 'teacher_feedback', None)
                essays_data.append({
                    'essayId': essay.id,
                    'taskType': essay.task_type,
                    'questionText': essay.question_text,
                    'submittedText': essay.submitted_text,
                    'submittedAt': essay.submitted_at,
                    'overallBand': essay.overall_band,
                    'scoreTask': essay.score_task,
                    'scoreCoherence': essay.score_coherence,
                    'scoreLexical': essay.score_lexical,
                    'scoreGrammar': essay.score_grammar,
                    'taskId': essay.task_id,
                    'promptId': essay.prompt_id,
                    'teacherFeedbackPublished': feedback.published if feedback else False,
                    'teacherOverallScore': feedback.teacher_overall_score if feedback else None
                })

            speaking_qs = SpeakingSession.objects.filter(
                student=user,
                conducted_at__date__gte=week_start,
                conducted_at__date__lte=week_end
            ).order_by('-conducted_at')[:per_module_limit]
            speaking_data = []
            for session in speaking_qs:
                speaking_data.append({
                    'sessionId': session.id,
                    'conductedAt': session.conducted_at,
                    'overallBandScore': session.overall_band_score,
                    'fluencyCoherenceScore': session.fluency_coherence_score,
                    'lexicalResourceScore': session.lexical_resource_score,
                    'grammaticalRangeScore': session.grammatical_range_score,
                    'pronunciationScore': session.pronunciation_score,
                    'completed': session.completed
                })

            full_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or None
            results.append({
                'email': user.email,
                'data': {
                    'studentId': user.student_id,
                    'fullName': full_name,
                    'email': user.email,
                    'weekStart': week_start.isoformat(),
                    'weekEnd': week_end.isoformat(),
                    'listeningSessions': listening_data,
                    'readingSessions': reading_data,
                    'essays': essays_data,
                    'speakingSessions': speaking_data
                }
            })

        return Response({
            'total': total,
            'processed': len(limited),
            'limit': limit,
            'results': results
        })


# ==================== CURATOR VIEWS ====================

class CuratorStudentsView(APIView):
    permission_classes = [IsTeacherOrCurator]
    
    def get(self, request):
        """Get all students with filtering options for curator"""
        # Get filter parameters
        group = request.query_params.get('group')
        teacher = request.query_params.get('teacher')
        search = request.query_params.get('search')
        writing_prompt_id = request.query_params.get('writing')
        writing_test_id = request.query_params.get('writing_test')
        writing_test_id = request.query_params.get('writing_test')
        listening_test_id = request.query_params.get('listening')
        reading_test_id = request.query_params.get('reading')
        
        # Base queryset
        students = User.objects.filter(role='student', is_active=True)
        
        # Apply filters
        if group:
            students = students.filter(group=group)
        if teacher:
            students = students.filter(teacher=teacher)
        if search:
            students = students.filter(
                models.Q(first_name__icontains=search) |
                models.Q(last_name__icontains=search) |
                models.Q(student_id__icontains=search) |
                models.Q(email__icontains=search)
            )
        
        # Get unique groups and teachers for filter options
        groups = User.objects.filter(role='student').values_list('group', flat=True).distinct().exclude(group__isnull=True).exclude(group='')
        teachers = User.objects.filter(role='student').values_list('teacher', flat=True).distinct().exclude(teacher__isnull=True).exclude(teacher='')
        
        # Get active tests for filtering
        active_writing_prompts = WritingPrompt.objects.filter(is_active=True)
        active_listening_tests = ListeningTest.objects.filter(is_active=True)
        active_reading_tests = ReadingTest.objects.filter(is_active=True)
        
        # Apply specific test filters if provided
        if writing_prompt_id:
            active_writing_prompts = active_writing_prompts.filter(id=writing_prompt_id)
        if listening_test_id:
            active_listening_tests = active_listening_tests.filter(id=listening_test_id)
        if reading_test_id:
            active_reading_tests = active_reading_tests.filter(id=reading_test_id)
        
        # Get basic student info with last activity
        students_data = []
        for student in students:
            writing_qs = apply_date_range_filter(
                Essay.objects.filter(user=student, prompt__in=active_writing_prompts),
                request,
                'submitted_at'
            )
            listening_qs = apply_date_range_filter(
                ListeningTestSession.objects.filter(user=student, test__in=active_listening_tests, submitted=True),
                request,
                'completed_at'
            )
            reading_qs = apply_date_range_filter(
                ReadingTestSession.objects.filter(user=student, test__in=active_reading_tests, completed=True),
                request,
                'end_time'
            )
            writing_count = writing_qs.count()
            listening_count = listening_qs.count()
            reading_count = reading_qs.count()
            
            last_writing = writing_qs.order_by('-submitted_at').first()
            last_listening = listening_qs.order_by('-completed_at').first()
            last_reading = reading_qs.order_by('-end_time').first()
            
            # Find the most recent activity
            last_activities = []
            if last_writing:
                last_activities.append(('writing', last_writing.submitted_at))
            if last_listening:
                last_activities.append(('listening', last_listening.completed_at))
            if last_reading:
                last_activities.append(('reading', last_reading.end_time))
            
            last_activity = None
            if last_activities:
                last_activity = max(last_activities, key=lambda x: x[1])
            
            students_data.append({
                'id': student.id,
                'student_id': student.student_id,
                'first_name': student.first_name,
                'last_name': student.last_name,
                'email': student.email,
                'group': student.group,
                'teacher': student.teacher,
                'test_counts': {
                    'writing': writing_count,
                    'listening': listening_count,
                    'reading': reading_count
                },
                'last_activity': {
                    'type': last_activity[0] if last_activity else None,
                    'date': last_activity[1] if last_activity else None
                }
            })
        
        return Response({
            'students': students_data,
            'filter_options': {
                'groups': list(groups),
                'teachers': list(teachers)
            }
        })


class CuratorMissingTestsView(APIView):
    permission_classes = [IsTeacherOrCurator]

    def get(self, request):
        group = request.query_params.get('group')
        teacher = request.query_params.get('teacher')
        search = request.query_params.get('search')
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 10))
        
        students = User.objects.filter(role='student', is_active=True)
        if group:
            students = students.filter(group=group)
        if teacher:
            students = students.filter(teacher=teacher)
        if search:
            search = search.strip()
            if search:
                students = students.filter(
                    models.Q(first_name__icontains=search) |
                    models.Q(last_name__icontains=search) |
                    models.Q(student_id__icontains=search) |
                    models.Q(email__icontains=search)
                )

        missing_list = []
        for student in students:
            writing_qs = apply_date_range_filter(
                Essay.objects.filter(user=student, test_session__is_diagnostic=False),
                request,
                'submitted_at'
            )
            listening_qs = apply_date_range_filter(
                ListeningTestSession.objects.filter(user=student, submitted=True, is_diagnostic=False),
                request,
                'completed_at'
            )
            reading_qs = apply_date_range_filter(
                ReadingTestSession.objects.filter(user=student, completed=True, is_diagnostic=False),
                request,
                'end_time'
            )

            missing = []
            if writing_qs.count() == 0:
                missing.append('writing')
            if listening_qs.count() == 0:
                missing.append('listening')
            if reading_qs.count() == 0:
                missing.append('reading')

            if missing:
                last_activity = self._last_activity(student)
                first_name = student.first_name or ''
                last_name = student.last_name or ''
                name = f"{first_name} {last_name}".strip() or f"Student {student.student_id or student.id}"
                missing_list.append({
                    'id': student.id,
                    'student_id': student.student_id or '',
                    'name': name,
                    'group': student.group or '',
                    'teacher': student.teacher or '',
                    'missing_modules': missing,
                    'last_activity': last_activity
                })

        total_count = len(missing_list)
        start = (page - 1) * page_size
        end = start + page_size
        paginated_list = missing_list[start:end]

        return Response({
            'students': paginated_list,
            'count': total_count,
            'page': page,
            'page_size': page_size,
            'total_pages': (total_count + page_size - 1) // page_size if page_size > 0 else 1
        })

    def _last_activity(self, student):
        activity_times = []
        essays = Essay.objects.filter(user=student, test_session__is_diagnostic=False).order_by('-submitted_at').first()
        if essays and essays.submitted_at:
            activity_times.append(essays.submitted_at)
        listen = ListeningTestSession.objects.filter(user=student, is_diagnostic=False).order_by('-completed_at').first()
        if listen and listen.completed_at:
            activity_times.append(listen.completed_at)
        read = ReadingTestSession.objects.filter(user=student, is_diagnostic=False).order_by('-end_time').first()
        if read and read.end_time:
            activity_times.append(read.end_time)
        speak = SpeakingSession.objects.filter(student=student).order_by('-conducted_at').first()
        if speak and speak.conducted_at:
            activity_times.append(speak.conducted_at)
        if not activity_times:
            return None
        latest = max(activity_times)
        return timezone.localtime(latest).isoformat()


class CuratorMissingSpeakingView(APIView):
    permission_classes = [IsTeacherOrCurator]

    def get(self, request):
        group = request.query_params.get('group')
        teacher = request.query_params.get('teacher')
        search = request.query_params.get('search')
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 10))
        
        students = User.objects.filter(role='student', is_active=True)
        if group:
            students = students.filter(group=group)
        if teacher:
            students = students.filter(teacher=teacher)
        if search:
            search = search.strip()
            if search:
                students = students.filter(
                    models.Q(first_name__icontains=search) |
                    models.Q(last_name__icontains=search) |
                    models.Q(student_id__icontains=search) |
                    models.Q(email__icontains=search)
                )

        missing_list = []
        for student in students:
            speaking_qs = apply_date_range_filter(
                SpeakingSession.objects.filter(student=student, completed=True),
                request,
                'conducted_at'
            )
            if speaking_qs.count() == 0:
                last_activity = self._last_activity(student)
                first_name = student.first_name or ''
                last_name = student.last_name or ''
                name = f"{first_name} {last_name}".strip() or f"Student {student.student_id or student.id}"
                missing_list.append({
                    'id': student.id,
                    'student_id': student.student_id or '',
                    'name': name,
                    'group': student.group or '',
                    'teacher': student.teacher or '',
                    'last_activity': last_activity
                })

        total_count = len(missing_list)
        start = (page - 1) * page_size
        end = start + page_size
        paginated_list = missing_list[start:end]

        return Response({
            'students': paginated_list,
            'count': total_count,
            'page': page,
            'page_size': page_size,
            'total_pages': (total_count + page_size - 1) // page_size if page_size > 0 else 1
        })

    def _last_activity(self, student):
        activity_times = []
        essays = Essay.objects.filter(user=student, test_session__is_diagnostic=False).order_by('-submitted_at').first()
        if essays and essays.submitted_at:
            activity_times.append(essays.submitted_at)
        listen = ListeningTestSession.objects.filter(user=student, is_diagnostic=False).order_by('-completed_at').first()
        if listen and listen.completed_at:
            activity_times.append(listen.completed_at)
        read = ReadingTestSession.objects.filter(user=student, is_diagnostic=False).order_by('-end_time').first()
        if read and read.end_time:
            activity_times.append(read.end_time)
        speak = SpeakingSession.objects.filter(student=student).order_by('-conducted_at').first()
        if speak and speak.conducted_at:
            activity_times.append(speak.conducted_at)
        if not activity_times:
            return None
        latest = max(activity_times)
        return timezone.localtime(latest).isoformat()


class CuratorStudentDetailView(APIView):
    permission_classes = [IsTeacherOrCurator]

    def get(self, request, student_id):
        student = get_object_or_404(User, id=student_id, role='student', is_active=True)
        time_range = {
            'date_from': request.query_params.get('date_from'),
            'date_to': request.query_params.get('date_to')
        }

        def wrap_queryset(qs, field):
            return apply_date_range_filter(qs, request, field)

        writing_qs = wrap_queryset(Essay.objects.filter(user=student), 'submitted_at')
        listening_qs = wrap_queryset(ListeningTestSession.objects.filter(user=student, submitted=True), 'completed_at')
        reading_qs = wrap_queryset(ReadingTestSession.objects.filter(user=student, completed=True), 'end_time')
        speaking_qs = wrap_queryset(SpeakingSession.objects.filter(student=student), 'conducted_at')

        def latest_result(qs, result_model, attr):
            session = qs.order_by(f'-{attr}').first()
            if not session:
                return None
            return result_model.objects.filter(session=session).first()

        detail = {
            'student': {
                'id': student.id,
                'student_id': student.student_id,
                'first_name': student.first_name,
                'last_name': student.last_name,
                'email': student.email,
                'group': student.group,
                'teacher': student.teacher,
            },
            'modules': {
                'writing': {
                    'essays': writing_qs.count(),
                    'latest': writing_qs.order_by('-submitted_at').values('task_type', 'score_task', 'overall_band', 'submitted_at').first(),
                    'with_feedback': writing_qs.filter(teacher_feedback__isnull=False).exists()
                },
                'listening': {
                    'sessions': listening_qs.count(),
                    'latest': {
                        'score': latest_result(listening_qs, ListeningTestResult, 'completed_at').score if latest_result(listening_qs, ListeningTestResult, 'completed_at') else None,
                        'band': latest_result(listening_qs, ListeningTestResult, 'completed_at').band_score if latest_result(listening_qs, ListeningTestResult, 'completed_at') else None,
                        'completed_at': listening_qs.order_by('-completed_at').values_list('completed_at', flat=True).first()
                    }
                },
                'reading': {
                    'sessions': reading_qs.count(),
                    'latest': {
                        'raw_score': latest_result(reading_qs, ReadingTestResult, 'end_time').raw_score if latest_result(reading_qs, ReadingTestResult, 'end_time') else None,
                        'band_score': latest_result(reading_qs, ReadingTestResult, 'end_time').band_score if latest_result(reading_qs, ReadingTestResult, 'end_time') else None,
                        'end_time': reading_qs.order_by('-end_time').values_list('end_time', flat=True).first()
                    }
                },
                'speaking': {
                    'sessions': speaking_qs.count(),
                    'latest': speaking_qs.order_by('-conducted_at').values(
                        'overall_band_score',
                        'fluency_coherence_score',
                        'lexical_resource_score',
                        'grammatical_range_score',
                        'pronunciation_score',
                        'conducted_at'
                    ).first()
                }
            },
            'missing_tests': []
        }

        # Determine modules without data
        for module in ['writing', 'listening', 'reading', 'speaking']:
            if module == 'writing' and writing_qs.count() == 0:
                detail['missing_tests'].append('writing')
            if module == 'listening' and listening_qs.count() == 0:
                detail['missing_tests'].append('listening')
            if module == 'reading' and reading_qs.count() == 0:
                detail['missing_tests'].append('reading')
            if module == 'speaking' and speaking_qs.count() == 0:
                detail['missing_tests'].append('speaking')

        return Response(detail)


class CuratorWritingOverviewView(APIView):
    permission_classes = [IsTeacherOrCurator]
    
    def get(self, request):
        """Get Writing test overview for curator"""
        # Get filter parameters
        group = request.query_params.get('group')
        teacher = request.query_params.get('teacher')
        writing_test_id = request.query_params.get('writing_test')
        
        # Base queryset
        students = User.objects.filter(role='student', is_active=True)
        if group:
            students = students.filter(group=group)
        if teacher:
            students = students.filter(teacher=teacher)
        
        total_students = students.count()
        # Новый режим: отталкиваемся от WritingTestSession
        sessions = WritingTestSession.objects.filter(user__in=students)
        if writing_test_id:
            sessions = sessions.filter(test_id=writing_test_id)
        sessions = apply_date_range_filter(sessions, request, 'started_at')
        # Собираем связанные эссе по сессиям
        essays = Essay.objects.filter(user__in=students, test_session__in=sessions)
        essays = apply_date_range_filter(essays, request, 'submitted_at')
        
        # Calculate meaningful statistics
        submitted_essays = essays.count()
        task1_count = essays.filter(task_type='task1').count()
        task2_count = essays.filter(task_type='task2').count()
        
        # Teacher feedback statistics
        essays_with_feedback = essays.filter(teacher_feedback__isnull=False).count()
        essays_published = essays.filter(teacher_feedback__published=True).count()
        essays_draft = essays.filter(teacher_feedback__published=False).count()
        essays_pending_feedback = essays.filter(teacher_feedback__isnull=True).count()
        
        # Calculate average scores
        avg_task_score = essays.aggregate(avg=models.Avg('score_task'))['avg'] or 0
        avg_coherence_score = essays.aggregate(avg=models.Avg('score_coherence'))['avg'] or 0
        avg_lexical_score = essays.aggregate(avg=models.Avg('score_lexical'))['avg'] or 0
        avg_grammar_score = essays.aggregate(avg=models.Avg('score_grammar'))['avg'] or 0
        avg_overall_score = essays.aggregate(avg=models.Avg('overall_band'))['avg'] or 0
        
        # Score distribution analysis
        high_scores = essays.filter(overall_band__gte=7.0).count()
        medium_scores = essays.filter(overall_band__gte=5.0, overall_band__lt=7.0).count()
        low_scores = essays.filter(overall_band__lt=5.0).count()
        
        # Students with multiple attempts
        students_with_essays = essays.values('user').distinct().count()
        avg_essays_per_student = round(submitted_essays / students_with_essays, 1) if students_with_essays > 0 else 0
        
        # Get recent essays with feedback info (paginated) — агрегируем по сессии
        recent_sessions_qs = sessions.select_related('user', 'test').order_by('-started_at')
        try:
            page = int(request.query_params.get('page', '1'))
            page_size = int(request.query_params.get('page_size', '30'))
        except ValueError:
            page, page_size = 1, 30
        if page_size <= 0: page_size = 30
        if page <= 0: page = 1
        total = recent_sessions_qs.count()
        start = (page - 1) * page_size
        end = start + page_size
        recent_sessions = recent_sessions_qs[start:end]
        recent_data = []
        # Для каждой сессии берём два эссе (task1/task2) если они есть
        essays_by_session = {}
        for es in essays.select_related('prompt', 'user'):
            essays_by_session.setdefault(es.test_session_id, []).append(es)
        for sess in recent_sessions:
            pair = essays_by_session.get(sess.id, [])
            # Найдём task1/task2
            task1 = next((e for e in pair if e.task_type == 'task1'), None)
            task2 = next((e for e in pair if e.task_type == 'task2'), None)
            def fb_info(e):
                if not e: return None
                fb = getattr(e, 'teacher_feedback', None)
                # Если эссе сдано, но нет учительского фидбека - это Draft
                # Published только если есть фидбек И он опубликован
                return {
                    'published': bool(fb and fb.published),
                    'overall': fb.teacher_overall_score if fb else None,
                    'has_feedback': bool(fb)  # Есть ли вообще фидбек от учителя
                }
            recent_data.append({
                'session_id': sess.id,
                'student_name': f"{sess.user.first_name} {sess.user.last_name}",
                'student_id': sess.user.student_id,
                'group': sess.user.group,
                'teacher': sess.user.teacher,
                'test_title': sess.test.title if sess.test else '-',
                'task1': {
                    'exists': task1 is not None,
                    'overall_band': task1.overall_band if task1 else None,
                    'feedback': fb_info(task1)
                },
                'task2': {
                    'exists': task2 is not None,
                    'overall_band': task2.overall_band if task2 else None,
                    'feedback': fb_info(task2)
                },
                'submitted_at': max([e.submitted_at for e in pair]) if pair else None
            })
        
        # Teacher performance analytics
        teacher_analytics = []
        # Get unique teachers from students (not from User table with role='teacher')
        teacher_names = students.values('teacher').distinct().exclude(teacher__isnull=True).exclude(teacher='')
        
        for teacher_data in teacher_names:
            teacher_name = teacher_data['teacher']
            teacher_students = students.filter(teacher=teacher_name)
            teacher_essays = essays.filter(user__in=teacher_students)
            teacher_feedbacks = TeacherFeedback.objects.filter(essay__in=teacher_essays)
            
            teacher_analytics.append({
                'teacher_name': teacher_name,
                'students_count': teacher_students.count(),
                'essays_count': teacher_essays.count(),
                'feedbacks_given': teacher_feedbacks.count(),
                'feedbacks_published': teacher_feedbacks.filter(published=True).count(),
                'avg_score': ielts_round_score(teacher_feedbacks.aggregate(avg=models.Avg('teacher_overall_score'))['avg']),
                'feedback_rate': round((teacher_feedbacks.count() / teacher_essays.count() * 100), 1) if teacher_essays.count() > 0 else 0,
                'publish_rate': round((teacher_feedbacks.filter(published=True).count() / teacher_essays.count() * 100), 1) if teacher_essays.count() > 0 else 0
            })
        
        # Group performance analytics
        group_analytics = []
        groups = students.values('group').distinct().exclude(group__isnull=True).exclude(group='')
        for group_data in groups:
            group_name = group_data['group']
            group_students = students.filter(group=group_name)
            group_essays = essays.filter(user__in=group_students)
            group_feedbacks = TeacherFeedback.objects.filter(essay__in=group_essays)
            
            group_analytics.append({
                'group_name': group_name,
                'students_count': group_students.count(),
                'essays_count': group_essays.count(),
                'feedbacks_given': group_feedbacks.count(),
                'feedbacks_published': group_feedbacks.filter(published=True).count(),
                'avg_score': ielts_round_score(group_feedbacks.aggregate(avg=models.Avg('teacher_overall_score'))['avg']),
                'feedback_rate': round((group_feedbacks.count() / group_essays.count() * 100), 1) if group_essays.count() > 0 else 0,
                'publish_rate': round((group_feedbacks.filter(published=True).count() / group_essays.count() * 100), 1) if group_essays.count() > 0 else 0
            })
        
        return Response({
            'statistics': {
                'total_students': total_students,
                'submitted_essays': submitted_essays,
                'task1_count': task1_count,
                'task2_count': task2_count,
                'students_with_essays': students_with_essays,
                'avg_essays_per_student': avg_essays_per_student,
                'teacher_feedback': {
                    'essays_with_feedback': essays_with_feedback,
                    'essays_published': essays_published,
                    'essays_draft': essays_draft,
                    'essays_pending_feedback': essays_pending_feedback,
                    'feedback_rate': round((essays_with_feedback / submitted_essays * 100), 1) if submitted_essays > 0 else 0,
                    'publish_rate': round((essays_published / submitted_essays * 100), 1) if submitted_essays > 0 else 0
                },
                'score_distribution': {
                    'high_scores': high_scores,
                    'medium_scores': medium_scores,
                    'low_scores': low_scores
                },
                'average_scores': {
                    'task': ielts_round_score(avg_task_score),
                    'coherence': ielts_round_score(avg_coherence_score),
                    'lexical': ielts_round_score(avg_lexical_score),
                    'grammar': ielts_round_score(avg_grammar_score),
                    'overall': ielts_round_score(avg_overall_score)
                }
            },
            'teacher_analytics': teacher_analytics,
            'group_analytics': group_analytics,
            'recent_sessions': recent_data,
            'recent_pagination': {
                'page': page,
                'page_size': page_size,
                'total': total,
                'total_pages': (total + page_size - 1) // page_size
            }
        })


class CuratorListeningOverviewView(APIView):
    permission_classes = [IsTeacherOrCurator]
    
    def get(self, request):
        """Get Listening test overview for curator"""
        # Get filter parameters
        group = request.query_params.get('group')
        teacher = request.query_params.get('teacher')
        listening_test_id = request.query_params.get('listening')
        
        # Base queryset
        students = User.objects.filter(role='student', is_active=True)
        if group:
            students = students.filter(group=group)
        if teacher:
            students = students.filter(teacher=teacher)
        
        # Get Listening statistics
        total_students = students.count()
        # Get only sessions from active tests
        active_tests = ListeningTest.objects.filter(is_active=True)
        if listening_test_id:
            active_tests = active_tests.filter(id=listening_test_id)
        sessions = ListeningTestSession.objects.filter(user__in=students, test__in=active_tests, submitted=True)
        sessions = apply_date_range_filter(sessions, request, 'completed_at')
        
        # Calculate meaningful statistics
        completed_sessions = sessions.count()
        total_questions = sessions.aggregate(total=models.Sum('total_questions_count'))['total'] or 0
        correct_answers = sessions.aggregate(total=models.Sum('correct_answers_count'))['total'] or 0
        
        # Student engagement
        students_with_sessions = sessions.values('user').distinct().count()
        avg_sessions_per_student = round(completed_sessions / students_with_sessions, 1) if students_with_sessions > 0 else 0
        
        # Calculate average scores
        avg_score = sessions.aggregate(avg=models.Avg('score'))['avg'] or 0
        avg_correct_answers = sessions.aggregate(avg=models.Avg('correct_answers_count'))['avg'] or 0
        # Average band from results
        listen_results = ListeningTestResult.objects.filter(session__in=sessions)
        avg_band_score = listen_results.aggregate(avg=models.Avg('band_score'))['avg'] or 0
        
        # Performance analysis
        high_performers = sessions.filter(score__gte=30).count()  # Assuming 30+ is high
        medium_performers = sessions.filter(score__gte=20, score__lt=30).count()
        low_performers = sessions.filter(score__lt=20).count()
        
        # Accuracy analysis
        high_accuracy = sessions.filter(
            models.Q(correct_answers_count__gte=models.F('total_questions_count') * 0.8)
        ).count()
        medium_accuracy = sessions.filter(
            models.Q(correct_answers_count__gte=models.F('total_questions_count') * 0.6) &
            models.Q(correct_answers_count__lt=models.F('total_questions_count') * 0.8)
        ).count()
        low_accuracy = sessions.filter(
            models.Q(correct_answers_count__lt=models.F('total_questions_count') * 0.6)
        ).count()
        
        # Overall accuracy rate
        overall_accuracy = round((correct_answers / total_questions * 100), 1) if total_questions > 0 else 0
        
        # Get recent sessions (paginated)
        recent_qs = sessions.select_related('test').order_by('-completed_at')
        try:
            page = int(request.query_params.get('page', '1'))
            page_size = int(request.query_params.get('page_size', '30'))
        except ValueError:
            page, page_size = 1, 30
        if page_size <= 0: page_size = 30
        if page <= 0: page = 1
        total = recent_qs.count()
        start = (page - 1) * page_size
        end = start + page_size
        recent_sessions = recent_qs[start:end]
        recent_data = []
        for session in recent_sessions:
            # try to fetch result band
            res = ListeningTestResult.objects.filter(session=session).first()
            band = res.band_score if res else None
            # accuracy percent
            acc = None
            if session.total_questions_count:
                acc = round(100.0 * (session.correct_answers_count or 0) / max(1, session.total_questions_count), 1)
            recent_data.append({
                'id': session.id,
                'student_name': f"{session.user.first_name} {session.user.last_name}",
                'student_id': session.user.student_id,
                'group': session.user.group,
                'teacher': session.user.teacher,
                'test_title': session.test.title,
                'score': session.score,
                'band_score': band,
                'correct_answers': session.correct_answers_count,
                'total_questions': session.total_questions_count,
                'accuracy_percent': acc,
                'completed_at': session.completed_at
            })
        
        return Response({
            'statistics': {
                'total_students': total_students,
                'completed_sessions': completed_sessions,
                'students_with_sessions': students_with_sessions,
                'avg_sessions_per_student': avg_sessions_per_student,
                'total_questions': total_questions,
                'correct_answers': correct_answers,
                'overall_accuracy': overall_accuracy,
                'performance_distribution': {
                    'high_performers': high_performers,
                    'medium_performers': medium_performers,
                    'low_performers': low_performers
                },
                'accuracy_distribution': {
                    'high_accuracy': high_accuracy,
                    'medium_accuracy': medium_accuracy,
                    'low_accuracy': low_accuracy
                },
                'average_scores': {
                    'score': round(avg_score, 1),
                    'correct_answers': round(avg_correct_answers, 1),
                    'band': ielts_round_score(avg_band_score)
                }
            },
            'recent_sessions': recent_data,
            'recent_pagination': {
                'page': page,
                'page_size': page_size,
                'total': total,
                'total_pages': (total + page_size - 1) // page_size
            }
        })


class CuratorReadingOverviewView(APIView):
    permission_classes = [IsTeacherOrCurator]
    
    def get(self, request):
        """Get Reading test overview for curator"""
        # Get filter parameters
        group = request.query_params.get('group')
        teacher = request.query_params.get('teacher')
        reading_test_id = request.query_params.get('reading')
        
        # Base queryset
        students = User.objects.filter(role='student', is_active=True)
        if group:
            students = students.filter(group=group)
        if teacher:
            students = students.filter(teacher=teacher)
        
        # Get Reading statistics
        total_students = students.count()
        # Get only sessions from active tests
        active_tests = ReadingTest.objects.filter(is_active=True)
        if reading_test_id:
            active_tests = active_tests.filter(id=reading_test_id)
        sessions = ReadingTestSession.objects.filter(user__in=students, test__in=active_tests, completed=True)
        sessions = apply_date_range_filter(sessions, request, 'end_time')
        
        # Calculate meaningful statistics
        completed_sessions = sessions.count()
        
        # Student engagement
        students_with_sessions = sessions.values('user').distinct().count()
        avg_sessions_per_student = round(completed_sessions / students_with_sessions, 1) if students_with_sessions > 0 else 0
        
        # Get results
        results = ReadingTestResult.objects.filter(session__in=sessions)
        total_score = results.aggregate(total=models.Sum('total_score'))['total'] or 0
        raw_score = results.aggregate(total=models.Sum('raw_score'))['total'] or 0
        
        # Calculate average scores
        avg_raw_score = results.aggregate(avg=models.Avg('raw_score'))['avg'] or 0
        avg_total_score = results.aggregate(avg=models.Avg('total_score'))['avg'] or 0
        avg_band_score = results.aggregate(avg=models.Avg('band_score'))['avg'] or 0
        
        # Performance analysis
        high_performers = results.filter(band_score__gte=7.0).count()
        medium_performers = results.filter(band_score__gte=5.0, band_score__lt=7.0).count()
        low_performers = results.filter(band_score__lt=5.0).count()
        
        # Score distribution analysis
        high_scores = results.filter(raw_score__gte=models.F('total_score') * 0.8).count()
        medium_scores = results.filter(
            models.Q(raw_score__gte=models.F('total_score') * 0.6) &
            models.Q(raw_score__lt=models.F('total_score') * 0.8)
        ).count()
        low_scores = results.filter(raw_score__lt=models.F('total_score') * 0.6).count()
        
        # Overall accuracy rate
        overall_accuracy = round((raw_score / total_score * 100), 1) if total_score > 0 else 0
        
        # Get recent sessions (paginated)
        recent_qs = sessions.select_related('test').order_by('-end_time')
        try:
            page = int(request.query_params.get('page', '1'))
            page_size = int(request.query_params.get('page_size', '30'))
        except ValueError:
            page, page_size = 1, 30
        if page_size <= 0: page_size = 30
        if page <= 0: page = 1
        total = recent_qs.count()
        start = (page - 1) * page_size
        end = start + page_size
        recent_sessions = recent_qs[start:end]
        recent_data = []
        for session in recent_sessions:
            result = getattr(session, 'result', None)
            recent_data.append({
                'id': session.id,
                'student_name': f"{session.user.first_name} {session.user.last_name}",
                'student_id': session.user.student_id,
                'group': session.user.group,
                'teacher': session.user.teacher,
                'test_title': session.test.title,
                'raw_score': result.raw_score if result else None,
                'total_score': result.total_score if result else None,
                'band_score': result.band_score if result else None,
                'completed_at': session.end_time
            })
        
        return Response({
            'statistics': {
                'total_students': total_students,
                'completed_sessions': completed_sessions,
                'students_with_sessions': students_with_sessions,
                'avg_sessions_per_student': avg_sessions_per_student,
                'total_score': total_score,
                'raw_score': raw_score,
                'overall_accuracy': overall_accuracy,
                'performance_distribution': {
                    'high_performers': high_performers,
                    'medium_performers': medium_performers,
                    'low_performers': low_performers
                },
                'score_distribution': {
                    'high_scores': high_scores,
                    'medium_scores': medium_scores,
                    'low_scores': low_scores
                },
                'average_scores': {
                    'raw_score': round(avg_raw_score, 1),
                    'total_score': round(avg_total_score, 1),
                    'band_score': ielts_round_score(avg_band_score)
                }
            },
            'recent_sessions': recent_data,
            'recent_pagination': {
                'page': page,
                'page_size': page_size,
                'total': total,
                'total_pages': (total + page_size - 1) // page_size
            }
        })


class CuratorOverviewView(APIView):
    permission_classes = [IsTeacherOrCurator]
    
    def get(self, request):
        """Get overall overview for curator with meaningful KPIs"""
        # Get filter parameters
        group = request.query_params.get('group')
        teacher = request.query_params.get('teacher')
        writing_test_id = request.query_params.get('writing')
        listening_test_id = request.query_params.get('listening')
        reading_test_id = request.query_params.get('reading')
        
        # Base queryset
        students = User.objects.filter(role='student', is_active=True)
        if group:
            students = students.filter(group=group)
        if teacher:
            students = students.filter(teacher=teacher)
        
        total_students = students.count()
        
        # Get active tests
        active_writing_tests = WritingTest.objects.filter(is_active=True)
        active_listening_tests = ListeningTest.objects.filter(is_active=True)
        active_reading_tests = ReadingTest.objects.filter(is_active=True)
        
        # Apply specific test filters if provided
        if writing_test_id:
            active_writing_tests = active_writing_tests.filter(id=writing_test_id)
        if listening_test_id:
            active_listening_tests = active_listening_tests.filter(id=listening_test_id)
        if reading_test_id:
            active_reading_tests = active_reading_tests.filter(id=reading_test_id)
        
        # Get test sessions
        writing_sessions = WritingTestSession.objects.filter(user__in=students, test__in=active_writing_tests)
        writing_sessions = apply_date_range_filter(writing_sessions, request, 'started_at')
        listening_sessions = ListeningTestSession.objects.filter(user__in=students, test__in=active_listening_tests, submitted=True)
        listening_sessions = apply_date_range_filter(listening_sessions, request, 'completed_at')
        reading_sessions = ReadingTestSession.objects.filter(user__in=students, test__in=active_reading_tests, completed=True)
        reading_sessions = apply_date_range_filter(reading_sessions, request, 'end_time')
        
        # Get essays from writing sessions
        essays = Essay.objects.filter(test_session__in=writing_sessions)
        
        # Calculate meaningful KPIs
        from django.utils import timezone
        from datetime import timedelta
        
        # Student engagement KPIs
        students_with_any_activity = User.objects.filter(
            id__in=writing_sessions.values('user').union(
                listening_sessions.values('user'),
                reading_sessions.values('user')
            )
        ).count()
        
        # Recent activity (last 7 days)
        week_ago = timezone.now() - timedelta(days=7)
        recent_writing = writing_sessions.filter(started_at__gte=week_ago).count()
        recent_listening = listening_sessions.filter(completed_at__gte=week_ago).count()
        recent_reading = reading_sessions.filter(end_time__gte=week_ago).count()
        
        # Teacher performance KPIs
        teachers_with_students = User.objects.filter(role='teacher').filter(
            teacher__in=students.values('teacher')
        ).count()
        
        # Writing feedback KPIs
        essays_with_feedback = essays.filter(teacher_feedback__isnull=False).count()
        essays_published = essays.filter(teacher_feedback__published=True).count()
        
        # Speaking assessment KPIs
        speaking_sessions = SpeakingSession.objects.filter(student__in=students)
        speaking_sessions = apply_date_range_filter(speaking_sessions, request, 'conducted_at')
        speaking_completed = speaking_sessions.filter(completed=True).count()
        speaking_pending = speaking_sessions.filter(completed=False).count()
        
        # Average scores
        avg_writing_score = essays.aggregate(avg=models.Avg('overall_band'))['avg'] or 0
        # Use band_score from ListeningTestResult instead of raw score from session
        listening_results = ListeningTestResult.objects.filter(session__in=listening_sessions)
        avg_listening_score = listening_results.aggregate(avg=models.Avg('band_score'))['avg'] or 0
        avg_reading_score = ReadingTestResult.objects.filter(session__in=reading_sessions).aggregate(avg=models.Avg('band_score'))['avg'] or 0
        avg_speaking_score = speaking_sessions.aggregate(avg=models.Avg('overall_band_score'))['avg'] or 0
        
        # Submission statistics by test
        writing_submissions = writing_sessions.count()
        listening_submissions = listening_sessions.count()
        reading_submissions = reading_sessions.count()
        speaking_submissions = speaking_sessions.filter(completed=True).count()
        
        # Teacher performance details
        teachers_with_writing_feedback = User.objects.filter(role='teacher').filter(
            id__in=essays.filter(teacher_feedback__isnull=False).values('teacher_feedback__teacher')
        ).count()
        
        teachers_with_speaking_sessions = User.objects.filter(role='teacher').filter(
            id__in=speaking_sessions.values('teacher')
        ).count()
        
        # Score distributions
        writing_score_distribution = {
            'high': essays.filter(overall_band__gte=7.0).count(),
            'medium': essays.filter(overall_band__gte=5.0, overall_band__lt=7.0).count(),
            'low': essays.filter(overall_band__lt=5.0).count()
        }
        
        listening_score_distribution = {
            'high': listening_sessions.filter(score__gte=30).count(),
            'medium': listening_sessions.filter(score__gte=20, score__lt=30).count(),
            'low': listening_sessions.filter(score__lt=20).count()
        }
        
        reading_score_distribution = {
            'high': ReadingTestResult.objects.filter(session__in=reading_sessions, band_score__gte=7.0).count(),
            'medium': ReadingTestResult.objects.filter(session__in=reading_sessions, band_score__gte=5.0, band_score__lt=7.0).count(),
            'low': ReadingTestResult.objects.filter(session__in=reading_sessions, band_score__lt=5.0).count()
        }
        
        speaking_score_distribution = {
            'high': speaking_sessions.filter(completed=True, overall_band_score__gte=7.0).count(),
            'medium': speaking_sessions.filter(completed=True, overall_band_score__gte=5.0, overall_band_score__lt=7.0).count(),
            'low': speaking_sessions.filter(completed=True, overall_band_score__lt=5.0).count()
        }
        
        # Completion rates - count unique students who completed each test
        writing_completed_students = students.filter(
            id__in=essays.filter(overall_band__isnull=False).values('user')
        ).count()
        listening_completed_students = students.filter(
            id__in=listening_sessions.filter(submitted=True).values('user')
        ).count()
        reading_completed_students = students.filter(
            id__in=reading_sessions.filter(completed=True).values('user')
        ).count()
        speaking_completed_students = students.filter(
            id__in=speaking_sessions.filter(completed=True).values('student')
        ).count()
        
        writing_rate = round((writing_completed_students / total_students * 100), 1) if total_students > 0 else 0
        listening_rate = round((listening_completed_students / total_students * 100), 1) if total_students > 0 else 0
        reading_rate = round((reading_completed_students / total_students * 100), 1) if total_students > 0 else 0
        speaking_rate = round((speaking_completed_students / total_students * 100), 1) if total_students > 0 else 0
        
        # Detailed test information
        detailed_tests = {}
        
        # Writing test details
        if writing_test_id:
            try:
                selected_writing_test = WritingTest.objects.get(id=writing_test_id)
                test_writing_sessions = writing_sessions.filter(test=selected_writing_test)
                test_essays = essays.filter(test_session__test=selected_writing_test)
            except WritingTest.DoesNotExist:
                selected_writing_test = None
            
            if selected_writing_test:
                detailed_tests['writing'] = {
                    'test_id': selected_writing_test.id,
                    'test_title': selected_writing_test.title,
                    'total_sessions': test_writing_sessions.count(),
                    'completed_sessions': test_essays.filter(overall_band__isnull=False).count(),
                    'total_essays': test_essays.count(),
                    'essays_with_feedback': test_essays.filter(teacher_feedback__isnull=False).count(),
                    'essays_published': test_essays.filter(teacher_feedback__published=True).count(),
                    'average_score': ielts_round_score(test_essays.aggregate(avg=models.Avg('overall_band'))['avg']),
                    'students': []
                }
            
                # Get student details for this writing test
                for student in students:
                    student_sessions = test_writing_sessions.filter(user=student)
                    student_essays = test_essays.filter(user=student)
                    if student_sessions.exists():
                        latest_session = student_sessions.order_by('-started_at').first()
                        latest_essay = student_essays.order_by('-submitted_at').first()
                        
                        # Check if essay has feedback safely
                        has_feedback = False
                        published = False
                        if latest_essay:
                            try:
                                has_feedback = latest_essay.teacher_feedback is not None
                                if has_feedback:
                                    published = latest_essay.teacher_feedback.published
                            except:
                                has_feedback = False
                                published = False
                        
                        # Check if student has completed essays (has scores)
                        has_completed_essays = student_essays.filter(overall_band__isnull=False).exists()
                        
                        detailed_tests['writing']['students'].append({
                            'student_id': student.student_id,
                            'name': f"{student.first_name} {student.last_name}",
                            'group': student.group,
                            'teacher': student.teacher,
                            'sessions_count': student_sessions.count(),
                            'completed': has_completed_essays,
                            'essays_count': student_essays.count(),
                            'has_feedback': has_feedback,
                            'published': published,
                            'score': ielts_round_score(latest_essay.overall_band) if latest_essay else None,
                            'last_activity': latest_session.started_at.strftime('%Y-%m-%d %H:%M:%S') if latest_session else None
                        })
        
        # Listening test details
        if listening_test_id:
            try:
                selected_listening_test = ListeningTest.objects.get(id=listening_test_id)
                test_listening_sessions = listening_sessions.filter(test=selected_listening_test)
            except ListeningTest.DoesNotExist:
                selected_listening_test = None
            
            if selected_listening_test:
                detailed_tests['listening'] = {
                    'test_id': selected_listening_test.id,
                    'test_title': selected_listening_test.title,
                    'total_sessions': test_listening_sessions.count(),
                    'submitted_sessions': test_listening_sessions.filter(submitted=True).count(),
                    'average_score': round(test_listening_sessions.aggregate(avg=models.Avg('score'))['avg'] or 0, 1),
                    'average_band': ielts_round_score(
                        ListeningTestResult.objects.filter(session__in=test_listening_sessions).aggregate(avg=models.Avg('band_score'))['avg'] or 0
                    ),
                    'students': []
                }
            
                # Get student details for this listening test
                for student in students:
                    student_sessions = test_listening_sessions.filter(user=student)
                    if student_sessions.exists():
                        latest_session = student_sessions.order_by('-completed_at').first()
                        latest_result = ListeningTestResult.objects.filter(session=latest_session).first()
                        
                        detailed_tests['listening']['students'].append({
                            'student_id': student.student_id,
                            'name': f"{student.first_name} {student.last_name}",
                            'group': student.group,
                            'teacher': student.teacher,
                            'sessions_count': student_sessions.count(),
                            'submitted': latest_session.submitted if latest_session else False,
                            'score': latest_session.score if latest_session else None,
                            'band_score': ielts_round_score(latest_result.band_score) if latest_result else None,
                            'last_activity': latest_session.completed_at.strftime('%Y-%m-%d %H:%M:%S') if latest_session and latest_session.completed_at else None
                        })
        
        # Reading test details
        if reading_test_id:
            try:
                selected_reading_test = ReadingTest.objects.get(id=reading_test_id)
                test_reading_sessions = reading_sessions.filter(test=selected_reading_test)
            except ReadingTest.DoesNotExist:
                selected_reading_test = None
            
            if selected_reading_test:
                detailed_tests['reading'] = {
                    'test_id': selected_reading_test.id,
                    'test_title': selected_reading_test.title,
                    'total_sessions': test_reading_sessions.count(),
                    'completed_sessions': test_reading_sessions.filter(completed=True).count(),
                    'average_raw_score': round(
                        ReadingTestResult.objects.filter(session__in=test_reading_sessions).aggregate(avg=models.Avg('raw_score'))['avg'] or 0, 1
                    ),
                    'average_band': ielts_round_score(
                        ReadingTestResult.objects.filter(session__in=test_reading_sessions).aggregate(avg=models.Avg('band_score'))['avg'] or 0
                    ),
                    'students': []
                }
            
                # Get student details for this reading test
                for student in students:
                    student_sessions = test_reading_sessions.filter(user=student)
                    if student_sessions.exists():
                        latest_session = student_sessions.order_by('-end_time').first()
                        latest_result = ReadingTestResult.objects.filter(session=latest_session).first()
                        
                        detailed_tests['reading']['students'].append({
                            'student_id': student.student_id,
                            'name': f"{student.first_name} {student.last_name}",
                            'group': student.group,
                            'teacher': student.teacher,
                            'sessions_count': student_sessions.count(),
                            'completed': latest_session.completed if latest_session else False,
                            'raw_score': latest_result.raw_score if latest_result else None,
                            'band_score': ielts_round_score(latest_result.band_score) if latest_result else None,
                            'last_activity': latest_session.end_time.strftime('%Y-%m-%d %H:%M:%S') if latest_session and latest_session.end_time else None
                        })

        # Group statistics
        group_stats = []
        for group_name in students.values_list('group', flat=True).distinct():
            if group_name:
                group_students = students.filter(group=group_name)
                # Count unique students who completed each test type
                group_writing_students = group_students.filter(
                    id__in=essays.filter(overall_band__isnull=False).values('user')
                ).count()
                group_listening_students = group_students.filter(
                    id__in=listening_sessions.filter(submitted=True).values('user')
                ).count()
                group_reading_students = group_students.filter(
                    id__in=reading_sessions.filter(completed=True).values('user')
                ).count()
                group_speaking_students = group_students.filter(
                    id__in=speaking_sessions.filter(completed=True).values('student')
                ).count()
                
                group_stats.append({
                    'group': group_name,
                    'total_students': group_students.count(),
                    'writing_completed': group_writing_students,
                    'listening_completed': group_listening_students,
                    'reading_completed': group_reading_students,
                    'speaking_completed': group_speaking_students,
                    'writing_rate': round((group_writing_students / group_students.count() * 100), 1) if group_students.count() > 0 else 0,
                    'listening_rate': round((group_listening_students / group_students.count() * 100), 1) if group_students.count() > 0 else 0,
                    'reading_rate': round((group_reading_students / group_students.count() * 100), 1) if group_students.count() > 0 else 0,
                    'speaking_rate': round((group_speaking_students / group_students.count() * 100), 1) if group_students.count() > 0 else 0
                })
        
        # Teacher statistics
        teacher_stats = []
        for teacher_name in students.values_list('teacher', flat=True).distinct():
            if teacher_name:
                teacher_students = students.filter(teacher=teacher_name)
                # Count unique students who completed each test type
                teacher_writing_students = teacher_students.filter(
                    id__in=essays.filter(overall_band__isnull=False).values('user')
                ).count()
                teacher_listening_students = teacher_students.filter(
                    id__in=listening_sessions.filter(submitted=True).values('user')
                ).count()
                teacher_reading_students = teacher_students.filter(
                    id__in=reading_sessions.filter(completed=True).values('user')
                ).count()
                teacher_speaking_students = teacher_students.filter(
                    id__in=speaking_sessions.filter(completed=True).values('student')
                ).count()
                
                teacher_stats.append({
                    'teacher': teacher_name,
                    'total_students': teacher_students.count(),
                    'writing_completed': teacher_writing_students,
                    'listening_completed': teacher_listening_students,
                    'reading_completed': teacher_reading_students,
                    'speaking_completed': teacher_speaking_students,
                    'writing_rate': round((teacher_writing_students / teacher_students.count() * 100), 1) if teacher_students.count() > 0 else 0,
                    'listening_rate': round((teacher_listening_students / teacher_students.count() * 100), 1) if teacher_students.count() > 0 else 0,
                    'reading_rate': round((teacher_reading_students / teacher_students.count() * 100), 1) if teacher_students.count() > 0 else 0,
                    'speaking_rate': round((teacher_speaking_students / teacher_students.count() * 100), 1) if teacher_students.count() > 0 else 0
                })
        
        return Response({
            'overview': {
                'total_students': total_students,
                'completion_rates': {
                    'writing': writing_rate,
                    'listening': listening_rate,
                    'reading': reading_rate,
                    'speaking': speaking_rate
                },
                'average_scores': {
                    'writing': ielts_round_score(avg_writing_score) if avg_writing_score > 0 else 0,
                    'listening': ielts_round_score(avg_listening_score) if avg_listening_score > 0 else 0,
                    'reading': ielts_round_score(avg_reading_score) if avg_reading_score > 0 else 0,
                    'speaking': ielts_round_score(avg_speaking_score) if avg_speaking_score > 0 else 0
                },
                'score_distributions': {
                    'writing': writing_score_distribution,
                    'listening': listening_score_distribution,
                    'reading': reading_score_distribution,
                    'speaking': speaking_score_distribution
                }
            },
            'group_statistics': group_stats,
            'teacher_statistics': teacher_stats,
            'detailed_tests': detailed_tests
        })


class CuratorWeeklyOverviewView(APIView):
    permission_classes = [IsTeacherOrCurator]

    def get(self, request):
        group = request.query_params.get('group')
        teacher = request.query_params.get('teacher')
        search = request.query_params.get('search')
        mode = request.query_params.get('mode') or 'group'
        writing_test_id = request.query_params.get('writing_test') or request.query_params.get('writing')
        listening_test_id = request.query_params.get('listening_test') or request.query_params.get('listening')
        reading_test_id = request.query_params.get('reading_test') or request.query_params.get('reading')
        has_date_filter = bool(request.query_params.get('date_from') or request.query_params.get('date_to'))
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 30))

        students = User.objects.filter(role='student', is_active=True)
        if group:
            students = students.filter(group=group)
        if teacher:
            students = students.filter(teacher=teacher)
        if search:
            students = students.filter(
                models.Q(first_name__icontains=search) |
                models.Q(last_name__icontains=search) |
                models.Q(student_id__icontains=search) |
                models.Q(email__icontains=search)
            )

        students = students.order_by('group', 'teacher', 'first_name', 'last_name')

        writing_sessions = WritingTestSession.objects.filter(user__in=students, is_diagnostic=False)
        if writing_test_id:
            writing_sessions = writing_sessions.filter(test_id=writing_test_id)
        writing_sessions = apply_date_range_filter(writing_sessions, request, 'started_at')

        listening_sessions = ListeningTestSession.objects.filter(user__in=students, submitted=True, is_diagnostic=False)
        if listening_test_id:
            listening_sessions = listening_sessions.filter(test_id=listening_test_id)
        listening_sessions = apply_date_range_filter(listening_sessions, request, 'completed_at')

        reading_sessions = ReadingTestSession.objects.filter(user__in=students, completed=True, is_diagnostic=False)
        if reading_test_id:
            reading_sessions = reading_sessions.filter(test_id=reading_test_id)
        reading_sessions = apply_date_range_filter(reading_sessions, request, 'end_time')

        essays = Essay.objects.filter(test_session__in=writing_sessions)

        listening_results = ListeningTestResult.objects.filter(session__in=listening_sessions)
        reading_results = ReadingTestResult.objects.filter(session__in=reading_sessions)
        teacher_feedbacks = TeacherFeedback.objects.filter(essay__in=essays)

        active_student_ids = set()
        active_student_ids.update(writing_sessions.values_list('user_id', flat=True))
        active_student_ids.update(listening_sessions.values_list('user_id', flat=True))
        active_student_ids.update(reading_sessions.values_list('user_id', flat=True))

        student_map = {}
        total_students = 0
        for s in students:
            if has_date_filter and s.id not in active_student_ids:
                continue
            total_students += 1
            student_map[s.id] = {
                'id': s.id,
                'student_id': s.student_id,
                'first_name': s.first_name,
                'last_name': s.last_name,
                'group': s.group,
                'teacher': s.teacher,
                'listening_bands': [],
                'reading_bands': [],
                'writing_teacher_scores': [],
                'has_listening_attempt': False,
                'has_reading_attempt': False,
                'has_writing_attempt': False,
                'has_writing_feedback': False,
                'latest_writing_session_id': None,
                'latest_writing_essay_id': None,
            }

        latest_writing_session = {}
        for sess in writing_sessions.only('id', 'user_id', 'started_at'):
            cur = latest_writing_session.get(sess.user_id)
            if not cur or (sess.started_at and cur.started_at and sess.started_at > cur.started_at) or (sess.started_at and not cur):
                latest_writing_session[sess.user_id] = sess

        latest_writing_essay = {}
        for es in essays.only('id', 'user_id', 'submitted_at'):
            cur = latest_writing_essay.get(es.user_id)
            if not cur or (es.submitted_at and cur.submitted_at and es.submitted_at > cur.submitted_at) or (es.submitted_at and not cur):
                latest_writing_essay[es.user_id] = es

        for sess in listening_sessions.only('id', 'user_id'):
            data = student_map.get(sess.user_id)
            if data:
                data['has_listening_attempt'] = True

        for sess in reading_sessions.only('id', 'user_id'):
            data = student_map.get(sess.user_id)
            if data:
                data['has_reading_attempt'] = True

        for es in essays.only('id', 'user_id'):
            data = student_map.get(es.user_id)
            if data:
                data['has_writing_attempt'] = True

        for res in listening_results.select_related('session__user'):
            user_id = res.session.user_id
            data = student_map.get(user_id)
            if data and res.band_score is not None:
                data['listening_bands'].append(res.band_score)

        for res in reading_results.select_related('session__user'):
            user_id = res.session.user_id
            data = student_map.get(user_id)
            if data and res.band_score is not None:
                data['reading_bands'].append(res.band_score)

        for fb in teacher_feedbacks.select_related('essay__user'):
            user_id = fb.essay.user_id
            data = student_map.get(user_id)
            if not data:
                continue
            data['has_writing_feedback'] = True
            if fb.teacher_overall_score is not None:
                data['writing_teacher_scores'].append(fb.teacher_overall_score)

        def module_status(has_attempt, band):
            if band is not None:
                return 'completed'
            if has_attempt:
                return 'pending'
            return 'not_started'

        all_listening_avgs = []
        all_reading_avgs = []
        all_writing_avgs = []
        all_overall_avgs = []

        for student_id, data in student_map.items():
            listening_band = compute_ielts_average(data['listening_bands'])
            reading_band = compute_ielts_average(data['reading_bands'])
            writing_teacher_band = compute_ielts_average(data['writing_teacher_scores'])

            scores = [v for v in [listening_band, reading_band, writing_teacher_band] if v is not None]
            overall_band = compute_ielts_average(scores) if scores else None

            listening_status = module_status(data['has_listening_attempt'], listening_band)
            reading_status = module_status(data['has_reading_attempt'], reading_band)
            writing_status = module_status(data['has_writing_attempt'] or data['has_writing_feedback'], writing_teacher_band)

            data['listening_band'] = listening_band
            data['reading_band'] = reading_band
            data['writing_teacher_band'] = writing_teacher_band
            data['overall_band'] = overall_band
            data['statuses'] = {
                'listening': listening_status,
                'reading': reading_status,
                'writing': writing_status,
            }

            latest_session = latest_writing_session.get(student_id)
            latest_essay = latest_writing_essay.get(student_id)
            if latest_session:
                data['latest_writing_session_id'] = latest_session.id
            if latest_essay:
                data['latest_writing_essay_id'] = latest_essay.id

            if listening_band is not None:
                all_listening_avgs.append(listening_band)
            if reading_band is not None:
                all_reading_avgs.append(reading_band)
            if writing_teacher_band is not None:
                all_writing_avgs.append(writing_teacher_band)
            if overall_band is not None:
                all_overall_avgs.append(overall_band)

        summary = {
            'students_count': total_students,
            'avg_listening_band': compute_ielts_average(all_listening_avgs),
            'avg_reading_band': compute_ielts_average(all_reading_avgs),
            'avg_writing_teacher_band': compute_ielts_average(all_writing_avgs),
            'avg_overall_band': compute_ielts_average(all_overall_avgs),
        }

        buckets = {}
        if mode == 'teacher':
            for data in student_map.values():
                key = data['teacher'] or ''
                if not key:
                    continue
                bucket = buckets.setdefault(key, {
                    'teacher': key,
                    'students_count': 0,
                    'completed_all_three': 0,
                    'listening_bands': [],
                    'reading_bands': [],
                    'writing_teacher_bands': [],
                    'overall_bands': [],
                    'students': [],
                })
                bucket['students_count'] += 1
                if all(data['statuses'][m] == 'completed' for m in ['listening', 'reading', 'writing']):
                    bucket['completed_all_three'] += 1
                if data['listening_band'] is not None:
                    bucket['listening_bands'].append(data['listening_band'])
                if data['reading_band'] is not None:
                    bucket['reading_bands'].append(data['reading_band'])
                if data['writing_teacher_band'] is not None:
                    bucket['writing_teacher_bands'].append(data['writing_teacher_band'])
                if data['overall_band'] is not None:
                    bucket['overall_bands'].append(data['overall_band'])
                bucket['students'].append({
                    'id': data['id'],
                    'student_id': data['student_id'],
                    'name': (f"{data['first_name'] or ''} {data['last_name'] or ''}".strip() or 
                             data['student_id'] or 
                             data.get('email', '') or 
                             f"Student {data['id']}"),
                    'group': data['group'],
                    'teacher': data['teacher'],
                    'listening': {
                        'band': data['listening_band'],
                        'status': data['statuses']['listening'],
                    },
                    'reading': {
                        'band': data['reading_band'],
                        'status': data['statuses']['reading'],
                    },
                    'writing': {
                        'teacher_band': data['writing_teacher_band'],
                        'status': data['statuses']['writing'],
                    },
                    'overall_band': data['overall_band'],
                    'latest_writing_session_id': data['latest_writing_session_id'],
                    'latest_writing_essay_id': data['latest_writing_essay_id'],
                })

            teachers = []
            for key, b in buckets.items():
                teachers.append({
                    'teacher': b['teacher'],
                    'students_count': b['students_count'],
                    'completed_all_three': b['completed_all_three'],
                    'avg_listening_band': compute_ielts_average(b['listening_bands']),
                    'avg_reading_band': compute_ielts_average(b['reading_bands']),
                    'avg_writing_teacher_band': compute_ielts_average(b['writing_teacher_bands']),
                    'avg_overall_band': compute_ielts_average(b['overall_bands']),
                    'students': b['students'],
                })
            teachers.sort(key=lambda x: (x['teacher'] is None, x['teacher']))
            return Response({
                'mode': 'teacher',
                'summary': summary,
                'teachers': teachers,
            })

        for data in student_map.values():
            key = data['group'] or ''
            if not key:
                continue
            bucket = buckets.setdefault(key, {
                'group': key,
                'students_count': 0,
                'completed_all_three': 0,
                'listening_bands': [],
                'reading_bands': [],
                'writing_teacher_bands': [],
                'overall_bands': [],
                'students': [],
            })
            bucket['students_count'] += 1
            if all(data['statuses'][m] == 'completed' for m in ['listening', 'reading', 'writing']):
                bucket['completed_all_three'] += 1
            if data['listening_band'] is not None:
                bucket['listening_bands'].append(data['listening_band'])
            if data['reading_band'] is not None:
                bucket['reading_bands'].append(data['reading_band'])
            if data['writing_teacher_band'] is not None:
                bucket['writing_teacher_bands'].append(data['writing_teacher_band'])
            if data['overall_band'] is not None:
                bucket['overall_bands'].append(data['overall_band'])
            bucket['students'].append({
                'id': data['id'],
                'student_id': data['student_id'],
                'name': f"{data['first_name']} {data['last_name']}".strip(),
                'group': data['group'],
                'teacher': data['teacher'],
                'listening': {
                    'band': data['listening_band'],
                    'status': data['statuses']['listening'],
                },
                'reading': {
                    'band': data['reading_band'],
                    'status': data['statuses']['reading'],
                },
                'writing': {
                    'teacher_band': data['writing_teacher_band'],
                    'status': data['statuses']['writing'],
                },
                'overall_band': data['overall_band'],
                'latest_writing_session_id': data['latest_writing_session_id'],
                'latest_writing_essay_id': data['latest_writing_essay_id'],
            })

        groups = []
        for key, b in buckets.items():
            groups.append({
                'group': b['group'],
                'students_count': b['students_count'],
                'completed_all_three': b['completed_all_three'],
                'avg_listening_band': compute_ielts_average(b['listening_bands']),
                'avg_reading_band': compute_ielts_average(b['reading_bands']),
                'avg_writing_teacher_band': compute_ielts_average(b['writing_teacher_bands']),
                'avg_overall_band': compute_ielts_average(b['overall_bands']),
                'students': b['students'],
            })
        groups.sort(key=lambda x: (x['group'] is None, x['group']))

        students_list = []
        for data in student_map.values():
            students_list.append({
                'id': data['id'],
                'student_id': data['student_id'],
                'name': f"{data['first_name']} {data['last_name']}".strip(),
                'group': data['group'],
                'teacher': data['teacher'],
                'listening': {
                    'band': data['listening_band'],
                    'status': data['statuses']['listening'],
                },
                'reading': {
                    'band': data['reading_band'],
                    'status': data['statuses']['reading'],
                },
                'writing': {
                    'teacher_band': data['writing_teacher_band'],
                    'status': data['statuses']['writing'],
                },
                'overall_band': data['overall_band'],
                'latest_writing_session_id': data['latest_writing_session_id'],
                'latest_writing_essay_id': data['latest_writing_essay_id'],
            })

        total_students = len(students_list)
        start = (page - 1) * page_size
        end = start + page_size
        paginated_students = students_list[start:end]

        return Response({
            'mode': 'group',
            'summary': summary,
            'groups': groups,
            'students': paginated_students,
            'students_pagination': {
                'count': total_students,
                'page': page,
                'page_size': page_size,
                'total_pages': (total_students + page_size - 1) // page_size if page_size > 0 else 1
            }
        })


class CuratorActiveTestsView(APIView):
    permission_classes = [IsTeacherOrCurator]
    
    def get(self, request):
        """Get list of active tests for curator (excluding diagnostic tests)"""
        active_writing_tests = WritingTest.objects.filter(is_active=True, is_diagnostic_template=False).values('id', 'title', 'description')
        active_listening_tests = ListeningTest.objects.filter(is_active=True, is_diagnostic_template=False).values('id', 'title', 'description')
        active_reading_tests = ReadingTest.objects.filter(is_active=True, is_diagnostic_template=False).values('id', 'title', 'description')
        
        return Response({
            'writing_tests': list(active_writing_tests),
            'listening_tests': list(active_listening_tests),
            'reading_tests': list(active_reading_tests)
        })


class CuratorGroupsRankingView(APIView):
    permission_classes = [IsTeacherOrCurator]

    def get(self, request):
        group_filter = request.query_params.get('group')
        teacher_filter = request.query_params.get('teacher')
        search = request.query_params.get('search')
        writing_test_id = request.query_params.get('writing_test') or request.query_params.get('writing')
        listening_test_id = request.query_params.get('listening_test') or request.query_params.get('listening')
        reading_test_id = request.query_params.get('reading_test') or request.query_params.get('reading')

        students = User.objects.filter(role='student', is_active=True)
        if group_filter:
            students = students.filter(group=group_filter)
        if teacher_filter:
            students = students.filter(teacher=teacher_filter)
        if search:
            search = search.strip()
            if search:
                students = students.filter(
                    models.Q(first_name__icontains=search) |
                    models.Q(last_name__icontains=search) |
                    models.Q(student_id__icontains=search) |
                    models.Q(email__icontains=search)
                )

        students = students.order_by('group', 'teacher', 'first_name', 'last_name')

        writing_sessions = WritingTestSession.objects.filter(user__in=students, is_diagnostic=False)
        if writing_test_id:
            writing_sessions = writing_sessions.filter(test_id=writing_test_id)
        writing_sessions = apply_date_range_filter(writing_sessions, request, 'started_at')

        listening_sessions = ListeningTestSession.objects.filter(user__in=students, submitted=True, is_diagnostic=False)
        if listening_test_id:
            listening_sessions = listening_sessions.filter(test_id=listening_test_id)
        listening_sessions = apply_date_range_filter(listening_sessions, request, 'completed_at')

        reading_sessions = ReadingTestSession.objects.filter(user__in=students, completed=True, is_diagnostic=False)
        if reading_test_id:
            reading_sessions = reading_sessions.filter(test_id=reading_test_id)
        reading_sessions = apply_date_range_filter(reading_sessions, request, 'end_time')

        essays = Essay.objects.filter(test_session__in=writing_sessions)
        listening_results = ListeningTestResult.objects.filter(session__in=listening_sessions)
        reading_results = ReadingTestResult.objects.filter(session__in=reading_sessions)
        teacher_feedbacks = TeacherFeedback.objects.filter(essay__in=essays)

        student_map = {}
        for s in students:
            student_map[s.id] = {
                'id': s.id,
                'group': s.group or '',
                'listening_bands': [],
                'reading_bands': [],
                'writing_teacher_scores': [],
            }

        for res in listening_results.select_related('session__user'):
            user_id = res.session.user_id
            data = student_map.get(user_id)
            if data and res.band_score is not None:
                data['listening_bands'].append(res.band_score)

        for res in reading_results.select_related('session__user'):
            user_id = res.session.user_id
            data = student_map.get(user_id)
            if data and res.band_score is not None:
                data['reading_bands'].append(res.band_score)

        for fb in teacher_feedbacks.select_related('essay__user'):
            user_id = fb.essay.user_id
            data = student_map.get(user_id)
            if data and fb.teacher_overall_score is not None:
                data['writing_teacher_scores'].append(fb.teacher_overall_score)

        groups_buckets = {}
        for student_id, data in student_map.items():
            group = data['group'] or 'No group'
            if not group or group == 'No group':
                group = 'No group'

            listening_band = compute_ielts_average(data['listening_bands'])
            reading_band = compute_ielts_average(data['reading_bands'])
            writing_teacher_band = compute_ielts_average(data['writing_teacher_scores'])

            scores = [v for v in [listening_band, reading_band, writing_teacher_band] if v is not None]
            overall_band = compute_ielts_average(scores) if scores else None

            bucket = groups_buckets.setdefault(group, {
                'group': group,
                'students_count': 0,
                'listening_bands': [],
                'reading_bands': [],
                'writing_teacher_bands': [],
                'overall_bands': [],
            })

            bucket['students_count'] += 1
            if listening_band is not None:
                bucket['listening_bands'].append(listening_band)
            if reading_band is not None:
                bucket['reading_bands'].append(reading_band)
            if writing_teacher_band is not None:
                bucket['writing_teacher_bands'].append(writing_teacher_band)
            if overall_band is not None:
                bucket['overall_bands'].append(overall_band)

        groups = []
        for key, b in groups_buckets.items():
            groups.append({
                'group': b['group'],
                'students_count': b['students_count'],
                'avg_listening_band': compute_ielts_average(b['listening_bands']),
                'avg_reading_band': compute_ielts_average(b['reading_bands']),
                'avg_writing_teacher_band': compute_ielts_average(b['writing_teacher_bands']),
                'avg_overall_band': compute_ielts_average(b['overall_bands']),
            })

        groups.sort(key=lambda x: (x['avg_overall_band'] is None, -(x['avg_overall_band'] or 0)), reverse=False)

        return Response({
            'groups': groups
        })


class CuratorSpeakingOverviewView(APIView):
    permission_classes = [IsTeacherOrCurator]
    
    def get(self, request):
        """Get Speaking sessions overview for curator"""
        group = request.query_params.get('group')
        teacher = request.query_params.get('teacher')
        search = request.query_params.get('search')
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 30))
        
        students = User.objects.filter(role='student', is_active=True).exclude(teacher__isnull=True).exclude(teacher='')
        if group:
            students = students.filter(group=group)
        if teacher:
            students = students.filter(teacher__icontains=teacher)
        if search:
            students = students.filter(
                models.Q(first_name__icontains=search) |
                models.Q(last_name__icontains=search) |
                models.Q(student_id__icontains=search) |
                models.Q(email__icontains=search)
            )

        base_sessions = SpeakingSession.objects.filter(student__in=students)
        all_sessions = apply_date_range_filter(base_sessions, request, 'conducted_at')
        completed_sessions_qs = all_sessions.filter(completed=True).order_by('-conducted_at')

        student_ids_with_completed = completed_sessions_qs.values_list('student_id', flat=True).distinct()
        students = students.filter(id__in=student_ids_with_completed)
        total_students = students.count()

        total_sessions = all_sessions.count()
        completed_sessions = completed_sessions_qs.count()
        pending_sessions = all_sessions.filter(completed=False).count()
        
        # Teacher assessment performance
        teachers_with_sessions = all_sessions.values('teacher').distinct().count()
        avg_sessions_per_teacher = round(total_sessions / teachers_with_sessions, 1) if teachers_with_sessions > 0 else 0
        
        # Average scores
        avg_overall = all_sessions.filter(completed=True, overall_band_score__isnull=False).aggregate(avg=models.Avg('overall_band_score'))['avg']
        avg_fluency = all_sessions.filter(completed=True, fluency_coherence_score__isnull=False).aggregate(avg=models.Avg('fluency_coherence_score'))['avg']
        avg_lexical = all_sessions.filter(completed=True, lexical_resource_score__isnull=False).aggregate(avg=models.Avg('lexical_resource_score'))['avg']
        avg_grammar = all_sessions.filter(completed=True, grammatical_range_score__isnull=False).aggregate(avg=models.Avg('grammatical_range_score'))['avg']
        avg_pronunciation = all_sessions.filter(completed=True, pronunciation_score__isnull=False).aggregate(avg=models.Avg('pronunciation_score'))['avg']
        
        # Performance distribution
        high_performers = all_sessions.filter(completed=True, overall_band_score__gte=7.0).count()
        medium_performers = all_sessions.filter(completed=True, overall_band_score__gte=5.0, overall_band_score__lt=7.0).count()
        low_performers = all_sessions.filter(completed=True, overall_band_score__lt=5.0).count()
        
        # Students with multiple completed sessions
        students_with_sessions = completed_sessions_qs.values('student').distinct().count()
        avg_sessions_per_student = round(completed_sessions / students_with_sessions, 1) if students_with_sessions > 0 else 0
        
        # Paginate only completed sessions, each completed submission is a separate row
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paged_sessions = completed_sessions_qs.select_related('student', 'teacher')[start_idx:end_idx]

        sessions_data = []
        for session in paged_sessions:
            student = session.student
            teacher_obj = session.teacher or student.teacher
            if isinstance(teacher_obj, User):
                teacher_display = f"{teacher_obj.first_name} {teacher_obj.last_name}".strip() or teacher_obj.email
            else:
                teacher_display = teacher_obj
            sessions_data.append({
                'session_id': session.id,
                'student_id': student.student_id,
                'student_name': f"{student.first_name} {student.last_name}",
                'group': student.group,
                'teacher': teacher_display,
                'overall_band': session.overall_band_score,
                'fluency_score': session.fluency_coherence_score,
                'lexical_score': session.lexical_resource_score,
                'grammar_score': session.grammatical_range_score,
                'pronunciation_score': session.pronunciation_score,
                'completed': session.completed,
                'conducted_at': session.conducted_at,
            })
        
        total_pages = (completed_sessions + page_size - 1) // page_size
        
        return Response({
            'statistics': {
                'total_students': total_students,
                'total_sessions': total_sessions,
                'completed_sessions': completed_sessions,
                'pending_sessions': pending_sessions,
                'students_with_sessions': students_with_sessions,
                'avg_sessions_per_student': avg_sessions_per_student,
                'teachers_with_sessions': teachers_with_sessions,
                'avg_sessions_per_teacher': avg_sessions_per_teacher,
                'performance_distribution': {
                    'high_performers': high_performers,
                    'medium_performers': medium_performers,
                    'low_performers': low_performers
                },
                'average_scores': {
                    'overall': ielts_round_score(avg_overall),
                    'fluency': ielts_round_score(avg_fluency),
                    'lexical': ielts_round_score(avg_lexical),
                    'grammar': ielts_round_score(avg_grammar),
                    'pronunciation': ielts_round_score(avg_pronunciation)
                }
            },
            'sessions': sessions_data,
            'recent_pagination': {
                'current_page': page,
                'total_pages': total_pages,
                'page_size': page_size,
                'total_count': completed_sessions
            }
        })


class CuratorSpeakingExportCSVView(APIView):
    permission_classes = [IsTeacherOrCurator]
    
    def get(self, request):
        """Export Speaking sessions data to CSV"""
        group = request.query_params.get('group')
        teacher = request.query_params.get('teacher')
        search = request.query_params.get('search')
        
        # Base students queryset - only students with assigned teachers
        students = User.objects.filter(role='student', is_active=True).exclude(teacher__isnull=True).exclude(teacher='')
        if group:
            students = students.filter(group=group)
        if teacher:
            students = students.filter(teacher__icontains=teacher)
        if search:
            students = students.filter(
                models.Q(first_name__icontains=search) |
                models.Q(last_name__icontains=search) |
                models.Q(student_id__icontains=search) |
                models.Q(email__icontains=search)
            )
        
        sessions = SpeakingSession.objects.filter(student__in=students).select_related('student', 'teacher')
        sessions = apply_date_range_filter(sessions, request, 'conducted_at').order_by('-conducted_at')
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="speaking_sessions_export.csv"'
        response.write('\ufeff'.encode('utf8'))  # UTF-8 BOM
        
        writer = csv.writer(response)
        
        header = [
            'Student ID', 'Student Name', 'Group', 'Teacher',
            'Session ID', 'Completed', 'Overall Band', 'Fluency Score', 'Lexical Score', 
            'Grammar Score', 'Pronunciation Score', 'Duration (seconds)', 'Conducted At'
        ]
        writer.writerow(header)
        
        for session in sessions:
            writer.writerow([
                session.student.student_id or '',
                f"{session.student.first_name} {session.student.last_name}",
                session.student.group or '',
                session.student.teacher or '',
                session.id,
                'Yes' if session.completed else 'No',
                ielts_round_score(session.overall_band_score) or '',
                ielts_round_score(session.fluency_coherence_score) or '',
                ielts_round_score(session.lexical_resource_score) or '',
                ielts_round_score(session.grammatical_range_score) or '',
                ielts_round_score(session.pronunciation_score) or '',
                session.duration_seconds or '',
                session.conducted_at.strftime('%Y-%m-%d %H:%M:%S') if session.conducted_at else ''
            ])
        
        return response


class CuratorOverviewExportCSVView(APIView):
    permission_classes = [IsTeacherOrCurator]
    
    def get(self, request):
        """Export comprehensive overview data to CSV"""
        # Get filter parameters
        group = request.query_params.get('group')
        teacher = request.query_params.get('teacher')
        writing_test_id = request.query_params.get('writing')
        listening_test_id = request.query_params.get('listening')
        reading_test_id = request.query_params.get('reading')
        
        # Base queryset
        students = User.objects.filter(role='student', is_active=True)
        if group:
            students = students.filter(group=group)
        if teacher:
            students = students.filter(teacher=teacher)
        
        # Get active tests
        active_writing_tests = WritingTest.objects.filter(is_active=True)
        active_listening_tests = ListeningTest.objects.filter(is_active=True)
        active_reading_tests = ReadingTest.objects.filter(is_active=True)
        
        # Apply specific test filters if provided
        if writing_test_id:
            active_writing_tests = active_writing_tests.filter(id=writing_test_id)
        if listening_test_id:
            active_listening_tests = active_listening_tests.filter(id=listening_test_id)
        if reading_test_id:
            active_reading_tests = active_reading_tests.filter(id=reading_test_id)
        
        # Get test sessions
        writing_sessions = WritingTestSession.objects.filter(user__in=students, test__in=active_writing_tests)
        listening_sessions = ListeningTestSession.objects.filter(user__in=students, test__in=active_listening_tests, submitted=True)
        reading_sessions = ReadingTestSession.objects.filter(user__in=students, test__in=active_reading_tests, completed=True)
        speaking_sessions = SpeakingSession.objects.filter(student__in=students)
        
        # Get essays from writing sessions
        essays = Essay.objects.filter(test_session__in=writing_sessions)
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="curator_overview_export.csv"'
        response.write('\ufeff'.encode('utf8'))  # UTF-8 BOM
        
        writer = csv.writer(response)
        
        header = [
            'Student ID', 'Student Name', 'Group', 'Teacher',
            'Writing Sessions', 'Writing Completed', 'Writing Avg Score',
            'Listening Sessions', 'Listening Submitted', 'Listening Avg Score', 'Listening Avg Band',
            'Reading Sessions', 'Reading Completed', 'Reading Avg Score', 'Reading Avg Band',
            'Speaking Sessions', 'Speaking Completed', 'Speaking Avg Score',
            'Last Activity Date', 'Last Activity Type'
        ]
        writer.writerow(header)
        
        for student in students:
            # Writing data
            student_writing_sessions = writing_sessions.filter(user=student)
            student_essays = essays.filter(user=student)
            writing_completed = student_essays.filter(overall_band__isnull=False).count()
            writing_avg = ielts_round_score(student_essays.aggregate(avg=models.Avg('overall_band'))['avg'])
            
            # Listening data
            student_listening_sessions = listening_sessions.filter(user=student)
            listening_submitted = student_listening_sessions.filter(submitted=True).count()
            listening_avg_score = student_listening_sessions.aggregate(avg=models.Avg('score'))['avg'] or 0
            listening_results = ListeningTestResult.objects.filter(session__in=student_listening_sessions)
            listening_avg_band = ielts_round_score(listening_results.aggregate(avg=models.Avg('band_score'))['avg'] or 0)
            
            # Reading data
            student_reading_sessions = reading_sessions.filter(user=student)
            reading_completed = student_reading_sessions.filter(completed=True).count()
            reading_results = ReadingTestResult.objects.filter(session__in=student_reading_sessions)
            reading_avg_score = reading_results.aggregate(avg=models.Avg('raw_score'))['avg'] or 0
            reading_avg_band = ielts_round_score(reading_results.aggregate(avg=models.Avg('band_score'))['avg'] or 0)
            
            # Speaking data
            student_speaking_sessions = speaking_sessions.filter(student=student)
            speaking_completed = student_speaking_sessions.filter(completed=True).count()
            speaking_avg = ielts_round_score(student_speaking_sessions.aggregate(avg=models.Avg('overall_band_score'))['avg'] or 0)
            
            # Last activity
            last_activities = []
            if student_writing_sessions.exists():
                last_writing = student_writing_sessions.order_by('-started_at').first()
                last_activities.append(('Writing', last_writing.started_at))
            if student_listening_sessions.exists():
                last_listening = student_listening_sessions.order_by('-completed_at').first()
                if last_listening and last_listening.completed_at:
                    last_activities.append(('Listening', last_listening.completed_at))
            if student_reading_sessions.exists():
                last_reading = student_reading_sessions.order_by('-end_time').first()
                if last_reading and last_reading.end_time:
                    last_activities.append(('Reading', last_reading.end_time))
            if student_speaking_sessions.exists():
                last_speaking = student_speaking_sessions.order_by('-conducted_at').first()
                if last_speaking and last_speaking.conducted_at:
                    last_activities.append(('Speaking', last_speaking.conducted_at))
            
            last_activity = max(last_activities, key=lambda x: x[1]) if last_activities else (None, None)
            
            writer.writerow([
                student.student_id or '',
                f"{student.first_name} {student.last_name}",
                student.group or '',
                student.teacher or '',
                student_writing_sessions.count(),
                writing_completed,
                writing_avg or 0,
                student_listening_sessions.count(),
                listening_submitted,
                round(listening_avg_score, 1),
                listening_avg_band or 0,
                student_reading_sessions.count(),
                reading_completed,
                round(reading_avg_score, 1),
                reading_avg_band or 0,
                student_speaking_sessions.count(),
                speaking_completed,
                speaking_avg or 0,
                last_activity[1].strftime('%Y-%m-%d %H:%M:%S') if last_activity[1] else '',
                last_activity[0] or ''
            ])
        
        return response


class CuratorWritingExportCSVView(APIView):
    permission_classes = [IsTeacherOrCurator]
    
    def get(self, request):
        """Export Writing data with student submissions and feedback for curator"""
        # Get filter parameters
        group = request.query_params.get('group')
        teacher = request.query_params.get('teacher')
        writing_test_id = request.query_params.get('writing_test')
        
        # Base queryset
        students = User.objects.filter(role='student', is_active=True)
        if group:
            students = students.filter(group=group)
        if teacher:
            students = students.filter(teacher=teacher)
        
        # Get writing sessions
        sessions = WritingTestSession.objects.filter(user__in=students)
        if writing_test_id:
            sessions = sessions.filter(test_id=writing_test_id)
        
        # Get essays from writing sessions
        essays = Essay.objects.filter(test_session__in=sessions).select_related('user', 'test_session', 'teacher_feedback')
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="curator_writing_export.csv"'
        response.write('\ufeff'.encode('utf8'))  # UTF-8 BOM
        
        writer = csv.writer(response)
        
        header = [
            'Student ID', 'Student Name', 'Group', 'Teacher',
            'Test Title', 'Task Type', 'Submitted At', 'Word Count',
            'AI Task Score', 'AI Coherence Score', 'AI Lexical Score', 'AI Grammar Score', 'AI Overall Band',
            'Teacher Task Score', 'Teacher Coherence Score', 'Teacher Lexical Score', 'Teacher Grammar Score', 'Teacher Overall Score',
            'Feedback Status', 'Feedback Published', 'Teacher Name', 'Feedback Created At', 'Feedback Published At'
        ]
        writer.writerow(header)
        
        for essay in essays:
            user = essay.user
            word_count = len(essay.submitted_text.split()) if essay.submitted_text else 0
            feedback = getattr(essay, 'teacher_feedback', None)
            
            writer.writerow([
                user.student_id or '',
                f"{user.first_name} {user.last_name}",
                user.group or '',
                user.teacher or '',
                essay.test_session.test.title if essay.test_session and essay.test_session.test else '',
                essay.task_type.upper(),
                essay.submitted_at.strftime('%Y-%m-%d %H:%M:%S') if essay.submitted_at else '',
                word_count,
                ielts_round_score(essay.score_task) or '',
                ielts_round_score(essay.score_coherence) or '',
                ielts_round_score(essay.score_lexical) or '',
                ielts_round_score(essay.score_grammar) or '',
                ielts_round_score(essay.overall_band) or '',
                ielts_round_score(feedback.teacher_task_score) if feedback else '',
                ielts_round_score(feedback.teacher_coherence_score) if feedback else '',
                ielts_round_score(feedback.teacher_lexical_score) if feedback else '',
                ielts_round_score(feedback.teacher_grammar_score) if feedback else '',
                ielts_round_score(feedback.teacher_overall_score) if feedback else '',
                'Published' if feedback and feedback.published else ('Draft' if feedback else 'No Feedback'),
                'Yes' if feedback and feedback.published else 'No',
                f"{feedback.teacher.first_name} {feedback.teacher.last_name}" if feedback and feedback.teacher else '',
                feedback.created_at.strftime('%Y-%m-%d %H:%M:%S') if feedback and feedback.created_at else '',
                feedback.published_at.strftime('%Y-%m-%d %H:%M:%S') if feedback and feedback.published_at else ''
            ])
        
        return response


class ReadingTestResultView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, session_id):
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
            session = ReadingTestSession.objects.get(
                id=session_id, 
                user=user
            )
            
            # Debug info
            print(f"Reading session found: completed={session.completed}")
            has_result = hasattr(session, 'result')
            print(f"Session has result: {has_result}")
            
            if not session.completed:
                return Response({'error': 'Session not completed yet.'}, status=400)
                
            if not has_result or not session.result:
                return Response({'error': 'Session result not found.'}, status=404)
                
            serializer = ReadingTestResultSerializer(session.result)
            return Response(serializer.data)
        except ReadingTestSession.DoesNotExist:
            return Response({'error': 'Session not found.'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class CuratorTestComparisonView(APIView):
    permission_classes = [IsTeacherOrCurator]
    
    def get(self, request):
        """Compare multiple tests within the same category"""
        # Get parameters
        category = request.GET.get('category', 'writing')
        test_ids = request.GET.getlist('test_ids')
        group = request.GET.get('group')
        teacher = request.GET.get('teacher')
        date_from = request.GET.get('date_from')
        date_to = request.GET.get('date_to')
        
        # Validate parameters
        if not test_ids:
            return Response({'error': 'At least one test_id is required'}, status=400)
        
        if len(test_ids) < 2:
            return Response({'error': 'At least 2 tests are required for comparison'}, status=400)
        
        if category not in ['writing', 'listening', 'reading']:
            return Response({'error': 'Invalid category. Must be writing, listening, or reading'}, status=400)
        
        # Base queryset for students
        students = User.objects.filter(role='student', is_active=True)
        if group:
            students = students.filter(group=group)
        if teacher:
            students = students.filter(teacher=teacher)
        
        # Get test data for each test
        tests_data = []
        for test_id in test_ids:
            try:
                test_data = self.get_test_comparison_data(category, test_id, students, date_from, date_to)
                tests_data.append(test_data)
            except Exception as e:
                return Response({'error': f'Error processing test {test_id}: {str(e)}'}, status=400)
        
        # Calculate comparison metrics
        comparison = self.calculate_test_comparison(tests_data)
        
        return Response({
            'category': category,
            'tests': tests_data,
            'comparison': comparison,
            'filters': {
                'group': group,
                'teacher': teacher,
                'date_from': date_from,
                'date_to': date_to
            }
        })
    
    def get_test_comparison_data(self, category, test_id, students, date_from=None, date_to=None):
        """Get detailed data for a specific test"""
        from django.db import models
        from django.utils import timezone
        from datetime import datetime
        
        # Date filtering
        date_filter = {}
        if date_from:
            try:
                date_filter['gte'] = datetime.strptime(date_from, '%Y-%m-%d').date()
            except ValueError:
                pass
        if date_to:
            try:
                date_filter['lte'] = datetime.strptime(date_to, '%Y-%m-%d').date()
            except ValueError:
                pass
        
        if category == 'writing':
            return self.get_writing_test_data(test_id, students, date_filter)
        elif category == 'listening':
            return self.get_listening_test_data(test_id, students, date_filter)
        elif category == 'reading':
            return self.get_reading_test_data(test_id, students, date_filter)
    
    def get_writing_test_data(self, test_id, students, date_filter):
        """Get writing test comparison data"""
        from django.db import models
        
        try:
            test = WritingTest.objects.get(id=test_id)
        except WritingTest.DoesNotExist:
            raise ValueError(f"Writing test {test_id} not found")
        
        # Get writing sessions for this test
        writing_sessions = WritingTestSession.objects.filter(
            user__in=students,
            test=test
        )
        
        if date_filter:
            if 'gte' in date_filter:
                writing_sessions = writing_sessions.filter(started_at__date__gte=date_filter['gte'])
            if 'lte' in date_filter:
                writing_sessions = writing_sessions.filter(started_at__date__lte=date_filter['lte'])
        
        # Get essays from these sessions
        essays = Essay.objects.filter(test_session__in=writing_sessions)
        
        # Calculate metrics - count unique students who completed the test
        total_students = students.count()
        completed_students = students.filter(
            id__in=essays.filter(overall_band__isnull=False).values('user')
        ).count()
        completion_rate = round((completed_students / total_students * 100), 1) if total_students > 0 else 0
        
        # Average scores
        avg_overall = essays.aggregate(avg=models.Avg('overall_band'))['avg'] or 0
        avg_task_response = essays.aggregate(avg=models.Avg('score_task'))['avg'] or 0
        avg_coherence = essays.aggregate(avg=models.Avg('score_coherence'))['avg'] or 0
        avg_lexical = essays.aggregate(avg=models.Avg('score_lexical'))['avg'] or 0
        avg_grammar = essays.aggregate(avg=models.Avg('score_grammar'))['avg'] or 0
        
        # Score distribution
        score_distribution = {
            'high': essays.filter(overall_band__gte=7.0).count(),
            'medium': essays.filter(overall_band__gte=5.0, overall_band__lt=7.0).count(),
            'low': essays.filter(overall_band__lt=5.0).count()
        }
        
        # Group statistics
        group_stats = []
        for group_name in students.values_list('group', flat=True).distinct():
            if group_name:
                group_students = students.filter(group=group_name)
                group_sessions = writing_sessions.filter(user__in=group_students)
                group_essays = essays.filter(test_session__in=group_sessions)
                group_completed = group_essays.filter(overall_band__isnull=False).count()
                group_completion_rate = round((group_completed / group_sessions.count() * 100), 1) if group_sessions.count() > 0 else 0
                group_avg_score = group_essays.aggregate(avg=models.Avg('overall_band'))['avg'] or 0
                
                group_stats.append({
                    'group': group_name,
                    'total_students': group_sessions.count(),
                    'completed': group_completed,
                    'completion_rate': group_completion_rate,
                    'avg_score': ielts_round_score(group_avg_score) if group_avg_score > 0 else 0
                })
        
        # Teacher statistics
        teacher_stats = []
        for teacher_name in students.values_list('teacher', flat=True).distinct():
            if teacher_name:
                teacher_students = students.filter(teacher=teacher_name)
                teacher_sessions = writing_sessions.filter(user__in=teacher_students)
                teacher_essays = essays.filter(test_session__in=teacher_sessions)
                teacher_completed = teacher_essays.filter(overall_band__isnull=False).count()
                teacher_completion_rate = round((teacher_completed / teacher_sessions.count() * 100), 1) if teacher_sessions.count() > 0 else 0
                teacher_avg_score = teacher_essays.aggregate(avg=models.Avg('overall_band'))['avg'] or 0
                
                teacher_stats.append({
                    'teacher': teacher_name,
                    'total_students': teacher_sessions.count(),
                    'completed': teacher_completed,
                    'completion_rate': teacher_completion_rate,
                    'avg_score': ielts_round_score(teacher_avg_score) if teacher_avg_score > 0 else 0
                })
        
        return {
            'id': test.id,
            'title': test.title,
            'description': test.description,
            'total_students': total_students,
            'completed_students': completed_students,
            'completion_rate': completion_rate,
            'average_scores': {
                'overall': ielts_round_score(avg_overall) if avg_overall > 0 else 0,
                'task_response': ielts_round_score(avg_task_response) if avg_task_response > 0 else 0,
                'coherence': ielts_round_score(avg_coherence) if avg_coherence > 0 else 0,
                'lexical': ielts_round_score(avg_lexical) if avg_lexical > 0 else 0,
                'grammar': ielts_round_score(avg_grammar) if avg_grammar > 0 else 0
            },
            'score_distribution': score_distribution,
            'group_statistics': group_stats,
            'teacher_statistics': teacher_stats
        }
    
    def get_listening_test_data(self, test_id, students, date_filter):
        """Get listening test comparison data"""
        from django.db import models
        
        try:
            test = ListeningTest.objects.get(id=test_id)
        except ListeningTest.DoesNotExist:
            raise ValueError(f"Listening test {test_id} not found")
        
        # Get listening sessions for this test
        listening_sessions = ListeningTestSession.objects.filter(
            user__in=students,
            test=test,
            submitted=True
        )
        
        if date_filter:
            if 'gte' in date_filter:
                listening_sessions = listening_sessions.filter(completed_at__date__gte=date_filter['gte'])
            if 'lte' in date_filter:
                listening_sessions = listening_sessions.filter(completed_at__date__lte=date_filter['lte'])
        
        # Get results
        listening_results = ListeningTestResult.objects.filter(session__in=listening_sessions)
        
        # Calculate metrics - count unique students who completed the test
        total_students = students.count()
        completed_students = students.filter(
            id__in=listening_sessions.filter(submitted=True).values('user')
        ).count()
        completion_rate = round((completed_students / total_students * 100), 1) if total_students > 0 else 0
        
        # Average scores
        avg_raw_score = listening_results.aggregate(avg=models.Avg('raw_score'))['avg'] or 0
        avg_band_score = listening_results.aggregate(avg=models.Avg('band_score'))['avg'] or 0
        
        # Score distribution
        score_distribution = {
            'high': listening_results.filter(band_score__gte=7.0).count(),
            'medium': listening_results.filter(band_score__gte=5.0, band_score__lt=7.0).count(),
            'low': listening_results.filter(band_score__lt=5.0).count()
        }
        
        # Group statistics
        group_stats = []
        for group_name in students.values_list('group', flat=True).distinct():
            if group_name:
                group_students = students.filter(group=group_name)
                group_sessions = listening_sessions.filter(user__in=group_students)
                group_results = listening_results.filter(session__in=group_sessions)
                group_completed = group_results.count()
                group_completion_rate = round((group_completed / group_sessions.count() * 100), 1) if group_sessions.count() > 0 else 0
                group_avg_score = group_results.aggregate(avg=models.Avg('band_score'))['avg'] or 0
                
                group_stats.append({
                    'group': group_name,
                    'total_students': group_sessions.count(),
                    'completed': group_completed,
                    'completion_rate': group_completion_rate,
                    'avg_score': ielts_round_score(group_avg_score) if group_avg_score > 0 else 0
                })
        
        # Teacher statistics
        teacher_stats = []
        for teacher_name in students.values_list('teacher', flat=True).distinct():
            if teacher_name:
                teacher_students = students.filter(teacher=teacher_name)
                teacher_sessions = listening_sessions.filter(user__in=teacher_students)
                teacher_results = listening_results.filter(session__in=teacher_sessions)
                teacher_completed = teacher_results.count()
                teacher_completion_rate = round((teacher_completed / teacher_sessions.count() * 100), 1) if teacher_sessions.count() > 0 else 0
                teacher_avg_score = teacher_results.aggregate(avg=models.Avg('band_score'))['avg'] or 0
                
                teacher_stats.append({
                    'teacher': teacher_name,
                    'total_students': teacher_sessions.count(),
                    'completed': teacher_completed,
                    'completion_rate': teacher_completion_rate,
                    'avg_score': ielts_round_score(teacher_avg_score) if teacher_avg_score > 0 else 0
                })
        
        return {
            'id': test.id,
            'title': test.title,
            'description': test.description,
            'total_students': total_students,
            'completed_students': completed_students,
            'completion_rate': completion_rate,
            'average_scores': {
                'raw_score': round(avg_raw_score, 1),
                'band_score': ielts_round_score(avg_band_score) if avg_band_score > 0 else 0
            },
            'score_distribution': score_distribution,
            'group_statistics': group_stats,
            'teacher_statistics': teacher_stats
        }
    
    def get_reading_test_data(self, test_id, students, date_filter):
        """Get reading test comparison data"""
        from django.db import models
        
        try:
            test = ReadingTest.objects.get(id=test_id)
        except ReadingTest.DoesNotExist:
            raise ValueError(f"Reading test {test_id} not found")
        
        # Get reading sessions for this test
        reading_sessions = ReadingTestSession.objects.filter(
            user__in=students,
            test=test,
            completed=True
        )
        
        if date_filter:
            if 'gte' in date_filter:
                reading_sessions = reading_sessions.filter(end_time__date__gte=date_filter['gte'])
            if 'lte' in date_filter:
                reading_sessions = reading_sessions.filter(end_time__date__lte=date_filter['lte'])
        
        # Get results
        reading_results = ReadingTestResult.objects.filter(session__in=reading_sessions)
        
        # Calculate metrics - count unique students who completed the test
        total_students = students.count()
        completed_students = students.filter(
            id__in=reading_sessions.filter(completed=True).values('user')
        ).count()
        completion_rate = round((completed_students / total_students * 100), 1) if total_students > 0 else 0
        
        # Average scores
        avg_raw_score = reading_results.aggregate(avg=models.Avg('raw_score'))['avg'] or 0
        avg_band_score = reading_results.aggregate(avg=models.Avg('band_score'))['avg'] or 0
        
        # Score distribution
        score_distribution = {
            'high': reading_results.filter(band_score__gte=7.0).count(),
            'medium': reading_results.filter(band_score__gte=5.0, band_score__lt=7.0).count(),
            'low': reading_results.filter(band_score__lt=5.0).count()
        }
        
        # Group statistics
        group_stats = []
        for group_name in students.values_list('group', flat=True).distinct():
            if group_name:
                group_students = students.filter(group=group_name)
                group_sessions = reading_sessions.filter(user__in=group_students)
                group_results = reading_results.filter(session__in=group_sessions)
                group_completed = group_results.count()
                group_completion_rate = round((group_completed / group_sessions.count() * 100), 1) if group_sessions.count() > 0 else 0
                group_avg_score = group_results.aggregate(avg=models.Avg('band_score'))['avg'] or 0
                
                group_stats.append({
                    'group': group_name,
                    'total_students': group_sessions.count(),
                    'completed': group_completed,
                    'completion_rate': group_completion_rate,
                    'avg_score': ielts_round_score(group_avg_score) if group_avg_score > 0 else 0
                })
        
        # Teacher statistics
        teacher_stats = []
        for teacher_name in students.values_list('teacher', flat=True).distinct():
            if teacher_name:
                teacher_students = students.filter(teacher=teacher_name)
                teacher_sessions = reading_sessions.filter(user__in=teacher_students)
                teacher_results = reading_results.filter(session__in=teacher_sessions)
                teacher_completed = teacher_results.count()
                teacher_completion_rate = round((teacher_completed / teacher_sessions.count() * 100), 1) if teacher_sessions.count() > 0 else 0
                teacher_avg_score = teacher_results.aggregate(avg=models.Avg('band_score'))['avg'] or 0
                
                teacher_stats.append({
                    'teacher': teacher_name,
                    'total_students': teacher_sessions.count(),
                    'completed': teacher_completed,
                    'completion_rate': teacher_completion_rate,
                    'avg_score': ielts_round_score(teacher_avg_score) if teacher_avg_score > 0 else 0
                })
        
        return {
            'id': test.id,
            'title': test.title,
            'description': test.description,
            'total_students': total_students,
            'completed_students': completed_students,
            'completion_rate': completion_rate,
            'average_scores': {
                'raw_score': round(avg_raw_score, 1),
                'band_score': ielts_round_score(avg_band_score) if avg_band_score > 0 else 0
            },
            'score_distribution': score_distribution,
            'group_statistics': group_stats,
            'teacher_statistics': teacher_stats
        }
    
    def calculate_test_comparison(self, tests_data):
        """Calculate comparison metrics between tests"""
        if len(tests_data) < 2:
            return {}
        
        # Find best and worst performing tests
        best_test = max(tests_data, key=lambda x: x['average_scores'].get('overall', x['average_scores'].get('band_score', 0)))
        worst_test = min(tests_data, key=lambda x: x['average_scores'].get('overall', x['average_scores'].get('band_score', 0)))
        
        # Calculate score differences
        score_differences = []
        for i, test1 in enumerate(tests_data):
            for j, test2 in enumerate(tests_data[i+1:], i+1):
                score1 = test1['average_scores'].get('overall', test1['average_scores'].get('band_score', 0))
                score2 = test2['average_scores'].get('overall', test2['average_scores'].get('band_score', 0))
                difference = score1 - score2
                
                score_differences.append({
                    'test1': test1['title'],
                    'test2': test2['title'],
                    'difference': round(difference, 1),
                    'better_test': test1['title'] if difference > 0 else test2['title']
                })
        
        # Calculate completion rate differences
        completion_differences = []
        for i, test1 in enumerate(tests_data):
            for j, test2 in enumerate(tests_data[i+1:], i+1):
                rate1 = test1['completion_rate']
                rate2 = test2['completion_rate']
                difference = rate1 - rate2
                
                completion_differences.append({
                    'test1': test1['title'],
                    'test2': test2['title'],
                    'difference': round(difference, 1),
                    'better_test': test1['title'] if difference > 0 else test2['title']
                })
        
        return {
            'best_performing_test': {
                'id': best_test['id'],
                'title': best_test['title'],
                'score': best_test['average_scores'].get('overall', best_test['average_scores'].get('band_score', 0))
            },
            'worst_performing_test': {
                'id': worst_test['id'],
                'title': worst_test['title'],
                'score': worst_test['average_scores'].get('overall', worst_test['average_scores'].get('band_score', 0))
            },
            'score_differences': score_differences,
            'completion_differences': completion_differences,
            'total_tests_compared': len(tests_data)
        }


class CuratorTestComparisonExportCSVView(APIView):
    permission_classes = [IsTeacherOrCurator]
    
    def get(self, request):
        """Export test comparison data as CSV"""
        import csv
        from django.http import HttpResponse
        
        # Get parameters
        category = request.GET.get('category', 'writing')
        test_ids = request.GET.getlist('test_ids')
        group = request.GET.get('group')
        teacher = request.GET.get('teacher')
        date_from = request.GET.get('date_from')
        date_to = request.GET.get('date_to')
        
        # Validate parameters
        if not test_ids or len(test_ids) < 2:
            return Response({'error': 'At least 2 tests are required for comparison'}, status=400)
        
        if category not in ['writing', 'listening', 'reading']:
            return Response({'error': 'Invalid category'}, status=400)
        
        # Base queryset for students
        students = User.objects.filter(role='student', is_active=True)
        if group:
            students = students.filter(group=group)
        if teacher:
            students = students.filter(teacher=teacher)
        
        # Get comparison data
        comparison_view = CuratorTestComparisonView()
        tests_data = []
        for test_id in test_ids:
            try:
                test_data = comparison_view.get_test_comparison_data(category, test_id, students, date_from, date_to)
                tests_data.append(test_data)
            except Exception as e:
                return Response({'error': f'Error processing test {test_id}: {str(e)}'}, status=400)
        
        # Create CSV response
        response = HttpResponse(content_type='text/csv')
        from datetime import datetime
        response['Content-Disposition'] = f'attachment; filename="test_comparison_{category}_{datetime.now().strftime("%Y-%m-%d")}.csv"'
        response.write('\ufeff'.encode('utf8'))  # UTF-8 BOM
        
        writer = csv.writer(response)
        
        # Write header
        if category == 'writing':
            header = [
                'Test ID', 'Test Title', 'Total Students', 'Completed Students', 'Completion Rate (%)',
                'Avg Overall Score', 'Avg Task', 'Avg Coherence', 'Avg Lexical', 'Avg Grammar',
                'High Scores (≥7.0)', 'Medium Scores (5.0-7.0)', 'Low Scores (<5.0)'
            ]
        else:  # listening or reading
            header = [
                'Test ID', 'Test Title', 'Total Students', 'Completed Students', 'Completion Rate (%)',
                'Avg Raw Score', 'Avg Band Score',
                'High Scores (≥7.0)', 'Medium Scores (5.0-7.0)', 'Low Scores (<5.0)'
            ]
        writer.writerow(header)
        
        # Write test data
        for test in tests_data:
            if category == 'writing':
                row = [
                    test['id'],
                    test['title'],
                    test['total_students'],
                    test['completed_students'],
                    test['completion_rate'],
                    test['average_scores']['overall'],
                    test['average_scores']['task_response'],
                    test['average_scores']['coherence'],
                    test['average_scores']['lexical'],
                    test['average_scores']['grammar'],
                    test['score_distribution']['high'],
                    test['score_distribution']['medium'],
                    test['score_distribution']['low']
                ]
            else:  # listening or reading
                row = [
                    test['id'],
                    test['title'],
                    test['total_students'],
                    test['completed_students'],
                    test['completion_rate'],
                    test['average_scores']['raw_score'],
                    test['average_scores']['band_score'],
                    test['score_distribution']['high'],
                    test['score_distribution']['medium'],
                    test['score_distribution']['low']
                ]
            writer.writerow(row)
        
        # Add comparison summary
        writer.writerow([])  # Empty row
        writer.writerow(['COMPARISON SUMMARY'])
        
        if len(tests_data) >= 2:
            # Find best and worst performing tests
            best_test = max(tests_data, key=lambda x: x['average_scores'].get('overall', x['average_scores'].get('band_score', 0)))
            worst_test = min(tests_data, key=lambda x: x['average_scores'].get('overall', x['average_scores'].get('band_score', 0)))
            
            writer.writerow(['Best Performing Test', best_test['title'], f"Score: {best_test['average_scores'].get('overall', best_test['average_scores'].get('band_score', 0))}"])
            writer.writerow(['Worst Performing Test', worst_test['title'], f"Score: {worst_test['average_scores'].get('overall', worst_test['average_scores'].get('band_score', 0))}"])
            
            # Score differences
            writer.writerow([])
            writer.writerow(['SCORE DIFFERENCES'])
            writer.writerow(['Test 1', 'Test 2', 'Difference', 'Better Test'])
            
            for i, test1 in enumerate(tests_data):
                for j, test2 in enumerate(tests_data[i+1:], i+1):
                    score1 = test1['average_scores'].get('overall', test1['average_scores'].get('band_score', 0))
                    score2 = test2['average_scores'].get('overall', test2['average_scores'].get('band_score', 0))
                    difference = score1 - score2
                    better_test = test1['title'] if difference > 0 else test2['title']
                    
                    writer.writerow([
                        test1['title'],
                        test2['title'],
                        round(difference, 1),
                        better_test
                    ])
        
        return response


# ===== Placement Test Views =====

class PlacementTestQuestionsView(APIView):
    """
    GET /api/placement-test/questions/
    Получить 20 активных вопросов placement теста (без правильных ответов)
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        questions = PlacementTestQuestion.objects.filter(is_active=True).order_by('order')
        
        data = []
        for q in questions:
            data.append({
                'id': q.id,
                'order': q.order,
                'question_text': q.question_text,
                'options': {
                    'A': q.option_a,
                    'B': q.option_b,
                    'C': q.option_c,
                    'D': q.option_d,
                }
                # Не отправляем correct_answer
            })
        
        return Response(data, status=status.HTTP_200_OK)


class PlacementTestSubmitView(APIView):
    """
    POST /api/placement-test/submit/
    Принять ответы, посчитать результат, сохранить submission, вернуть результат
    
    Request body:
    {
        "full_name": "Иванов Иван",
        "email": "ivan@example.com",
        "planned_exam_date": "Ближайшие 3 месяца",
        "answers": {1: "A", 2: "B", 3: "C", ...}
    }
    
    Response:
    {
        "score": 15,
        "total": 20,
        "recommendation": "ielts",
        "results": [
            {
                "order": 1,
                "question_text": "...",
                "user_answer": "A",
                "correct_answer": "B",
                "is_correct": false
            },
            ...
        ]
    }
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        full_name = request.data.get('full_name', '').strip()
        grade = request.data.get('grade', '').strip()
        phone_number = request.data.get('phone_number', '').strip()
        email = request.data.get('email', '').strip()
        planned_exam_date = request.data.get('planned_exam_date', '').strip()
        answers = request.data.get('answers', {})
        
        # Валидация
        if not full_name:
            return Response({'error': 'Full name is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not planned_exam_date:
            return Response({'error': 'Planned exam date is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not answers:
            return Response({'error': 'Answers are required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Получаем все вопросы
        questions = PlacementTestQuestion.objects.filter(is_active=True).order_by('order')
        
        # Подсчитываем баллы и формируем результаты
        score = 0
        results = []
        
        for q in questions:
            # answers может прийти как {1: "A", 2: "B"} или {"1": "A", "2": "B"}
            user_answer = answers.get(str(q.order)) or answers.get(q.order)
            is_correct = user_answer == q.correct_answer if user_answer else False
            
            if is_correct:
                score += 1
            
            results.append({
                'order': q.order,
                'question_text': q.question_text,
                'options': {
                    'A': q.option_a,
                    'B': q.option_b,
                    'C': q.option_c,
                    'D': q.option_d,
                },
                'user_answer': user_answer,
                'correct_answer': q.correct_answer,
                'is_correct': is_correct
            })
        
        # Определяем рекомендацию
        recommendation = 'ielts' if score >= 11 else 'pre-ielts'
        
        # Сохраняем submission
        submission = PlacementTestSubmission.objects.create(
            full_name=full_name,
            grade=grade,
            phone_number=phone_number,
            email=email,
            planned_exam_date=planned_exam_date,
            answers=answers,
            score=score,
            recommendation=recommendation
        )
        
        return Response({
            'submission_id': submission.id,
            'score': score,
            'total': len(questions),
            'recommendation': recommendation,
            'results': results
        }, status=status.HTTP_201_CREATED)


class AdminPlacementTestResultsView(APIView):
    """
    GET /api/admin/placement-test-results/
    Получить список всех результатов Placement Test для админов
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Проверка что пользователь - админ
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        id_token = auth_header.split(' ')[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return Response({'error': 'Invalid token'}, status=status.HTTP_401_UNAUTHORIZED)
        
        uid = decoded.get('uid')
        try:
            user = User.objects.get(uid=uid)
            if user.role not in ['admin', 'placement_viewer']:
                return Response({'error': 'Admin or Placement Viewer access required'}, status=status.HTTP_403_FORBIDDEN)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_401_UNAUTHORIZED)
        
        # Получаем все submissions
        submissions = PlacementTestSubmission.objects.all().order_by('-submitted_at')
        
        # Применяем фильтры если есть
        recommendation_filter = request.query_params.get('recommendation')
        if recommendation_filter:
            submissions = submissions.filter(recommendation=recommendation_filter)
        
        date_from = request.query_params.get('date_from')
        if date_from:
            try:
                date_from_parsed = datetime.strptime(date_from, '%Y-%m-%d').date()
                submissions = submissions.filter(submitted_at__date__gte=date_from_parsed)
            except ValueError:
                pass
        
        date_to = request.query_params.get('date_to')
        if date_to:
            try:
                date_to_parsed = datetime.strptime(date_to, '%Y-%m-%d').date()
                submissions = submissions.filter(submitted_at__date__lte=date_to_parsed)
            except ValueError:
                pass
        
        search = request.query_params.get('search', '').strip()
        if search:
            submissions = submissions.filter(
                models.Q(full_name__icontains=search) |
                models.Q(email__icontains=search)
            )
        
        # Формируем результат
        data = []
        for submission in submissions:
            data.append({
                'id': submission.id,
                'full_name': submission.full_name,
                'grade': getattr(submission, 'grade', '') or '',
                'phone_number': getattr(submission, 'phone_number', '') or '',
                'email': submission.email,
                'planned_exam_date': submission.planned_exam_date,
                'score': submission.score,
                'total': 20,
                'recommendation': submission.recommendation,
                'submitted_at': submission.submitted_at.isoformat(),
            })
        
        return Response(data, status=status.HTTP_200_OK)
