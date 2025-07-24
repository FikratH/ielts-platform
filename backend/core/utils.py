# core/utils.py

from rest_framework.views import APIView
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

# -----------------------------
# CSRF-exempt базовый класс API
# -----------------------------
class CsrfExemptAPIView(APIView):
    @method_decorator(csrf_exempt)
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)


# -------------------------------------
# Проверка Firebase ID-token (verify_token)
# -------------------------------------
import firebase_admin
from firebase_admin import auth, credentials
from django.conf import settings

# Путь к service account инициализации берём из настроек Django
FIREBASE_CERT_PATH = settings.FIREBASE_CERT_PATH

if not FIREBASE_CERT_PATH:
    raise RuntimeError("Не задан путь к Firebase service account (FIREBASE_CERT_PATH в settings)")

# Инициализация Firebase Admin один раз
try:
    firebase_admin.get_app()
except ValueError:
    cred = credentials.Certificate(FIREBASE_CERT_PATH)
    firebase_admin.initialize_app(cred)


def verify_token(id_token: str) -> dict:
    """
    Проверяет Firebase ID-token и возвращает декодированные данные (uid/email и т.п.).
    Бросает ValueError при невалидном токене.
    """
    try:
        decoded = auth.verify_id_token(id_token)
        return decoded
    except Exception as e:
        # Здесь можно добавить логирование e
        raise ValueError("Invalid or expired Firebase token") from e


# -------------------------------------
# Ваши вспомогательные функции для тестов
# -------------------------------------
def validate_reading_test(test):
    """
    Проверяет целостность Reading теста перед активацией.
    Возвращает (is_valid, errors_list).
    """
    errors = []
    
    # Проверяем базовые поля
    if not test.title:
        errors.append("Test title is required")
    if not test.time_limit or test.time_limit <= 0:
        errors.append("Valid time limit is required")
    
    # Проверяем части
    parts = test.parts.all()
    if not parts.exists():
        errors.append("Test must have at least one part")
        return False, errors
    
    total_questions = 0
    total_sub_questions = 0
    
    for part in parts:
        questions = part.questions.all()
        if not questions.exists():
            errors.append(f"Part {part.part_number} has no questions")
            continue
            
        total_questions += questions.count()
        
        for q in questions:
            if not q.question_type:
                errors.append(f"Question {q.id} has no type")
                continue
                
            # … (ваша логика проверки по типам вопросов)
            # то же самое, что было у вас
            
    # Общие проверки
    if total_questions == 0:
        errors.append("Test has no questions")
    elif total_questions < 3:
        errors.append(f"Test has only {total_questions} questions (too few for IELTS)")
        
    if total_sub_questions == 0:
        errors.append("Test has no scoreable sub-questions")
    elif total_sub_questions < 10:
        errors.append(f"Test has only {total_sub_questions} sub-questions (low for IELTS Reading)")
    
    return len(errors) == 0, errors


def auto_fix_reading_test(test):
    """
    Автоматически исправляет некоторые проблемы в Reading тесте.
    """
    fixes_applied = []
    
    # Исправляем порядок вопросов
    for part in test.parts.all():
        questions = list(part.questions.all().order_by('id'))
        for idx, q in enumerate(questions):
            if q.order != idx + 1:
                q.order = idx + 1
                q.save()
                fixes_applied.append(f"Fixed order for question {q.id}")
    
    # Добавляем недостающие инструкции
    for part in test.parts.all():
        for q in part.questions.all():
            if not q.header and not q.instruction:
                if q.question_type == 'gap_fill':
                    q.instruction = "Complete the text by filling in the gaps."
                elif q.question_type == 'true_false_not_given':
                    q.instruction = "Choose TRUE, FALSE, or NOT GIVEN for each statement."
                elif q.question_type == 'matching':
                    q.instruction = "Match each item with the correct option."
                elif q.question_type == 'table':
                    q.instruction = "Complete the table by filling in the missing information."
                elif q.question_type in ['multiple_choice', 'multiple_response']:
                    q.instruction = "Choose the correct answer(s)."
                
                if q.instruction:
                    q.save()
                    fixes_applied.append(f"Added instruction for question {q.id}")
    
    return fixes_applied
