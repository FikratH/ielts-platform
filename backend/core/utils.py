from rest_framework.views import APIView
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

class CsrfExemptAPIView(APIView):
    @method_decorator(csrf_exempt)
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)


def validate_reading_test(test):
    """
    Проверяет целостность Reading теста перед активацией
    Возвращает (is_valid, errors_list)
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
        # Проверяем вопросы в части
        questions = part.questions.all()
        if not questions.exists():
            errors.append(f"Part {part.part_number} has no questions")
            continue
            
        total_questions += questions.count()
        
        for q in questions:
            # Проверяем базовые поля вопроса
            if not q.question_type:
                errors.append(f"Question {q.id} has no type")
                continue
                
            # Подсчитываем sub-questions и проверяем данные
            if q.question_type == 'gap_fill':
                import re
                gaps = re.findall(r'\[\[(\d+)\]\]', q.question_text or '')
                if not gaps:
                    errors.append(f"Gap-fill question {q.id} has no gaps in question_text")
                elif not q.correct_answers:
                    errors.append(f"Gap-fill question {q.id} has no correct_answers")
                else:
                    # Проверяем соответствие gaps и answers
                    answer_numbers = {str(ans.get('number')) for ans in q.correct_answers if isinstance(ans, dict)}
                    gap_numbers = set(gaps)
                    if gap_numbers != answer_numbers:
                        errors.append(f"Question {q.id}: gaps {gap_numbers} don't match answer numbers {answer_numbers}")
                total_sub_questions += len(gaps)
                
            elif q.question_type == 'true_false_not_given':
                if not q.extra_data or 'statements' not in q.extra_data:
                    errors.append(f"True/False question {q.id} has no statements in extra_data")
                elif not q.correct_answers:
                    errors.append(f"True/False question {q.id} has no correct_answers")
                else:
                    statements_count = len(q.extra_data['statements'])
                    answers_count = len(q.correct_answers)
                    if statements_count != answers_count:
                        errors.append(f"Question {q.id}: {statements_count} statements but {answers_count} answers")
                    total_sub_questions += statements_count
                    
            elif q.question_type == 'matching':
                if not q.extra_data or 'items' not in q.extra_data:
                    errors.append(f"Matching question {q.id} has no items in extra_data")
                elif not q.correct_answers:
                    errors.append(f"Matching question {q.id} has no correct_answers")
                else:
                    items_count = len(q.extra_data['items'])
                    total_sub_questions += items_count
                    
            elif q.question_type == 'table':
                if not q.extra_data or 'rows' not in q.extra_data:
                    errors.append(f"Table question {q.id} has no rows in extra_data")
                else:
                    gaps = 0
                    for row in q.extra_data['rows']:
                        for cell in row:
                            if isinstance(cell, dict) and cell.get('type') == 'gap':
                                gaps += 1
                    if gaps == 0:
                        errors.append(f"Table question {q.id} has no gaps")
                    total_sub_questions += gaps
                    
            elif q.question_type in ['multiple_choice', 'multiple_response']:
                options = q.answer_options.all() if hasattr(q, 'answer_options') else []
                if not options.exists():
                    errors.append(f"Multiple choice question {q.id} has no options")
                else:
                    correct_options = [opt for opt in options if getattr(opt, 'is_correct', False)]
                    if not correct_options:
                        errors.append(f"Multiple choice question {q.id} has no correct options")
                    if q.question_type == 'multiple_choice' and len(correct_options) > 1:
                        errors.append(f"Multiple choice question {q.id} has {len(correct_options)} correct options (should be 1)")
                total_sub_questions += 1
                
            elif q.question_type in ['short_answer', 'shortanswer', 'short_response']:
                if not q.correct_answers:
                    errors.append(f"Short answer question {q.id} has no correct_answers")
                total_sub_questions += 1
                
            else:
                errors.append(f"Question {q.id} has unsupported type: {q.question_type}")
    
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
    Автоматически исправляет некоторые проблемы в Reading тесте
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
    
    # Добавляем недостающие базовые поля
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
