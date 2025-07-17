from rest_framework import serializers
from .models import (
    Essay, WritingPrompt, User, 
    ListeningTestSession, ListeningTest, ListeningPart, ListeningQuestion, 
    ListeningAnswerOption, ListeningTestResult, ListeningTestClone, ListeningStudentAnswer,
    ReadingTest, ReadingPart, ReadingQuestion, ReadingAnswerOption, 
    ReadingTestSession, ReadingTestResult
)
import re
import json

class EssaySerializer(serializers.ModelSerializer):
    student_id = serializers.CharField(source='user.student_id', read_only=True)
    class Meta:
        model = Essay
        fields = '__all__'
        read_only_fields = [
            'user', 'submitted_at',
            'score_task', 'score_coherence', 'score_lexical',
            'score_grammar', 'overall_band', 'feedback'
        ]
        extra_kwargs = {
            'question_text': {'required': False, 'allow_blank': True},
            'submitted_text': {'required': True},
        }

class WritingPromptSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(allow_null=True, required=False)
    class Meta:
        model = WritingPrompt
        fields = ['id', 'task_type', 'prompt_text', 'created_at', 'image', 'is_active']




class ListeningTestSessionSerializer(serializers.ModelSerializer):
    test_title = serializers.CharField(source='test.title', read_only=True)
    student_id = serializers.CharField(source='user.student_id', read_only=True)
    
    class Meta:
        model = ListeningTestSession
        fields = ['id', 'test', 'test_title', 'user', 'student_id', 'started_at', 'status', 'answers', 'flagged', 'time_left', 'submitted']
        read_only_fields = ['id', 'user', 'started_at', 'status', 'submitted']


class ListeningTestListSerializer(serializers.ModelSerializer):
    has_attempted = serializers.SerializerMethodField()
    is_active = serializers.BooleanField()
    parts_count = serializers.SerializerMethodField()
    time_limit = serializers.SerializerMethodField()

    class Meta:
        model = ListeningTest
        fields = ['id', 'title', 'description', 'has_attempted', 'is_active', 'parts_count', 'time_limit']

    def get_parts_count(self, obj):
        return obj.parts.count()

    def get_time_limit(self, obj):
        # Assuming time_limit is stored on the test model. If not, this needs adjustment.
        # Let's say we calculate it based on parts or have a default.
        # For now, let's look for a `time_limit` attribute, or default to 30.
        return getattr(obj, 'time_limit', 30)

    def get_has_attempted(self, obj):
        request = self.context.get('request')
        if request:
            
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if auth_header.startswith('Bearer '):
                from .firebase_config import verify_firebase_token
                
                id_token = auth_header.split(' ')[1]
                decoded = verify_firebase_token(id_token)
                if decoded:
                    uid = decoded['uid']
                    try:
                        user = User.objects.get(uid=uid)
                        return ListeningTestSession.objects.filter(
                            test=obj,
                            user=user,
                            completed=True
                        ).exists()
                    except User.DoesNotExist:
                        pass
        return False


class ListeningTestDetailSerializer(serializers.ModelSerializer):
    time_limit = serializers.IntegerField(default=30)  
    is_active = serializers.BooleanField()

    class Meta:
        model = ListeningTest
        fields = ['id', 'title', 'description', 'time_limit', 'is_active']


class ListeningQuestionCreateSerializer(serializers.ModelSerializer):
    image = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    options = serializers.ListField(child=serializers.DictField(), required=False, allow_null=True, default=list)
    correct_answer = serializers.CharField(allow_blank=True, required=False)
    question_text = serializers.CharField(required=False, allow_blank=True)
    points = serializers.IntegerField(required=False, default=1)
    class Meta:
        model = ListeningQuestion
        fields = ['question_type', 'question_text', 'options', 'image', 'correct_answer', 'header', 'instruction', 'points']


class ListeningTestCreateSerializer(serializers.ModelSerializer):
    questions = ListeningQuestionCreateSerializer(many=True)

    class Meta:
        model = ListeningTest
        fields = ['id', 'title', 'description', 'questions', 'time_limit']
        extra_kwargs = {
            'time_limit': {'required': False, 'default': 30}
        }

    def create(self, validated_data):
        parts_data = validated_data.pop('parts', [])
        test = ListeningTest.objects.create(**validated_data)
        for part_data in parts_data:
            questions_data = part_data.pop('questions', [])
            part = ListeningPart.objects.create(test=test, **part_data)
            for question_data in questions_data:
                options_data = question_data.pop('options', [])
                image = question_data.get('image', None)
                if not image:
                    question_data['image'] = None
                print('QUESTION DATA:', question_data)
                question = ListeningQuestion.objects.create(part=part, **question_data)
                for idx, option_data in enumerate(options_data):
                    label = chr(65 + idx)
                    option_data = dict(option_data)
                    # Удаляем все лишние поля перед созданием
                    option_data.pop('label', None)
                    option_data.pop('image', None)
                    option_data.pop('id', None)
                    option_data.pop('isCorrect', None)  # Убираем поле isCorrect, которого нет в модели
                    print(f"CLEANED OPTION DATA for label {label}:", option_data)
                    try:
                        ListeningAnswerOption.objects.create(question=question, label=label, **option_data)
                    except Exception as e:
                        print(f"ERROR creating option {label}:", e, "option_data:", option_data)
                        continue
        return test

    def update(self, instance, validated_data):
        parts_data = validated_data.pop('parts', [])
        instance.title = validated_data.get('title', instance.title)
        instance.description = validated_data.get('description', instance.description)
        instance.is_active = validated_data.get('is_active', instance.is_active)
        instance.save()

        existing_parts = {p.part_number: p for p in instance.parts.all()}
        sent_part_numbers = set()
        for part_data in parts_data:
            part_number = part_data.get('part_number')
            sent_part_numbers.add(part_number)
            questions_data = part_data.pop('questions', [])
            part, created = instance.parts.get_or_create(part_number=part_number, defaults={**part_data, 'test': instance})
            if not created:
                for attr, value in part_data.items():
                    setattr(part, attr, value)
                part.save()
            existing_questions = {q.order: q for q in part.questions.all()}
            sent_question_orders = set()
            for question_data in questions_data:
                order = question_data.get('order')
                sent_question_orders.add(order)
                options_data = question_data.pop('options', [])
                image = question_data.get('image', None)
                if not image:
                    question_data['image'] = None
                print('QUESTION DATA:', question_data)
                question, created = part.questions.get_or_create(order=order, defaults={**question_data, 'part': part})
                if not created:
                    for attr, value in question_data.items():
                        setattr(question, attr, value)
                    question.save()
                existing_options = {o.label: o for o in question.options.all()}
                sent_option_labels = set()
                for idx, option_data in enumerate(options_data):
                    label = chr(65 + idx)
                    sent_option_labels.add(label)
                    option_data = dict(option_data)
                    # Удаляем все лишние поля перед созданием
                    option_data.pop('label', None)
                    option_data.pop('image', None)
                    option_data.pop('id', None)
                    option_data.pop('isCorrect', None)  # Убираем поле isCorrect, которого нет в модели
                    print(f"CLEANED OPTION DATA for label {label}:", option_data)
                    try:
                        option, created = question.options.get_or_create(label=label, defaults={**option_data, 'question': question})
                        if not created:
                            for attr, value in option_data.items():
                                setattr(option, attr, value)
                            option.save()
                    except Exception as e:
                        print(f"ERROR creating option {label}:", e, "option_data:", option_data)
                        continue
                for label, option in existing_options.items():
                    if label not in sent_option_labels:
                        option.delete()
            for order, question in existing_questions.items():
                if order not in sent_question_orders:
                    question.delete()
        for part_number, part in existing_parts.items():
            if part_number not in sent_part_numbers:
                part.delete()
        return instance

class ListeningQuestionUpdateSerializer(serializers.ModelSerializer):
    image = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    options = serializers.ListField(child=serializers.DictField(), required=False, allow_null=True, default=list)
    correct_answer = serializers.CharField(allow_blank=True, required=False)
    question_text = serializers.CharField(required=False, allow_blank=True)
    points = serializers.IntegerField(required=False, default=1)
    class Meta:
        model = ListeningQuestion
        fields = ['question_type', 'question_text', 'options', 'image', 'correct_answer', 'header', 'instruction', 'points']

    def update(self, instance, validated_data):
        correct_answer = validated_data.pop('correct_answer', None)
        instance = super().update(instance, validated_data)
        if correct_answer is not None:
            instance.correct_answers = [correct_answer]
            instance.save()
        return instance


def create_detailed_breakdown(session):
    """
    Создает детальный breakdown для всех подвопросов в сессии
    """
    try:
        detailed_breakdown = []
        
        for part in session.test.parts.all():
            part_data = {
                'part_number': part.part_number,
                'instructions': part.instructions,
                'questions': []
            }
            
            for question in part.questions.all():
                try:
                    question_data = {
                        'question_id': question.id,
                        'question_text': question.question_text or '',
                        'question_type': question.question_type,
                        'header': question.header or '',
                        'instruction': question.instruction or '',
                        'sub_answers': []
                    }
                    
                    # Получаем options как список
                    options = list(question.options.all()) if hasattr(question, 'options') else []
                    
                    # Обрабатываем разные типы вопросов
                    if question.question_type in ['gap_fill', 'gapfill', 'sentence_completion', 'summary_completion', 'note_completion', 'flow_chart']:
                        # Gap fill вопросы
                        if question.extra_data and 'gaps' in question.extra_data:
                            gaps = question.extra_data['gaps']
                        else:
                            gaps = normalize_correct_answers_for_gaps(question.correct_answers, question.question_type)
                        
                        for gap in gaps:
                            gap_num = gap.get('number')
                            correct_val = gap.get('answer', '')
                            key = f"{question.id}__gap{gap_num}"
                            user_val = session.answers.get(key, '')
                            
                            question_data['sub_answers'].append({
                                'sub_id': f"gap{gap_num}",
                                'label': f"Пропуск {gap_num}",
                                'user_answer': user_val,
                                'correct_answer': correct_val,
                                'is_correct': normalize_answer(user_val) == normalize_answer(correct_val),
                                'is_answered': bool(user_val and user_val.strip())
                            })
                            
                    elif question.question_type in ['table', 'table_completion', 'tablecompletion', 'form', 'form_completion']:
                        # Table вопросы
                        cells = []
                        if question.extra_data and 'table' in question.extra_data and 'cells' in question.extra_data['table']:
                            cells = question.extra_data['table']['cells']
                        
                        for row_idx, row in enumerate(cells):
                            for col_idx, cell in enumerate(row):
                                if cell.get('isAnswer'):
                                    correct_val = cell.get('answer', '')
                                    key = f"{question.id}__r{row_idx}c{col_idx}"
                                    user_val = session.answers.get(key, '')
                                    
                                    question_data['sub_answers'].append({
                                        'sub_id': f"r{row_idx}c{col_idx}",
                                        'label': f"Ячейка {row_idx + 1}-{col_idx + 1}",
                                        'user_answer': user_val,
                                        'correct_answer': correct_val,
                                        'is_correct': normalize_answer(user_val) == normalize_answer(correct_val),
                                        'is_answered': bool(user_val and user_val.strip())
                                    })
                                    
                    elif question.question_type in ['multiple_response', 'checkbox', 'multi_select']:
                        # Multiple response вопросы
                        correct_labels = set()
                        if options:
                            for o in options:
                                label = getattr(o, 'label', None)
                                text = getattr(o, 'text', None)
                                # Проверяем, является ли эта опция правильной
                                if isinstance(question.correct_answers, list) and (text in question.correct_answers or label in question.correct_answers):
                                    correct_labels.add(normalize_answer(label))
                        elif isinstance(question.correct_answers, list):
                            for label in question.correct_answers:
                                correct_labels.add(normalize_answer(label))
                        
                        # Проверяем все возможные ответы
                        all_labels = set()
                        if options:
                            for o in options:
                                all_labels.add(normalize_answer(getattr(o, 'label', '')))
                        else:
                            all_labels = correct_labels
                        
                        for label in all_labels:
                            key = f"{question.id}__{label}"
                            user_val = session.answers.get(key, False)
                            is_selected = user_val is True or user_val == "true" or user_val == label
                            is_correct_option = label in correct_labels
                            
                            question_data['sub_answers'].append({
                                'sub_id': label,
                                'label': f"Опция {label}",
                                'user_answer': is_selected,
                                'correct_answer': is_correct_option,
                                'is_correct': (is_selected == is_correct_option),
                                'is_answered': is_selected
                            })
                            
                    elif question.question_type in ['multiple_choice', 'single_choice', 'radio', 'true_false', 'short_answer', 'TRUE_FALSE_NOT_GIVEN', 'shortanswer']:
                        # Single choice вопросы
                        correct_label = ''
                        if isinstance(question.correct_answers, list) and question.correct_answers:
                            correct_label = question.correct_answers[0]
                        elif isinstance(question.correct_answers, str):
                            correct_label = question.correct_answers
                        
                        key = f"{question.id}__{correct_label}"
                        user_val = session.answers.get(key, '')
                        is_correct = user_val is True or user_val == 'true' or user_val == correct_label
                        
                        question_data['sub_answers'].append({
                            'sub_id': 'answer',
                            'label': 'Ответ',
                            'user_answer': user_val if user_val else 'Нет ответа',
                            'correct_answer': correct_label,
                            'is_correct': is_correct,
                            'is_answered': bool(user_val)
                        })
                    
                    part_data['questions'].append(question_data)
                except Exception as e:
                    print(f"[ERROR] Processing question {question.id}: {str(e)}")
                    # Добавляем пустой вопрос с ошибкой
                    part_data['questions'].append({
                        'question_id': question.id,
                        'question_text': f"Ошибка обработки вопроса: {str(e)}",
                        'question_type': question.question_type,
                        'sub_answers': []
                    })
            
            detailed_breakdown.append(part_data)
        
        return detailed_breakdown
    except Exception as e:
        print(f"[ERROR] Creating detailed breakdown: {str(e)}")
        return []

def normalize_correct_answers_for_gaps(correct_answers, question_type):
    """
    Нормализует correct_answers для gap_fill типов вопросов.
    Всегда возвращает список словарей вида [{'number': 1, 'answer': 'text'}, ...]
    
    Args:
        correct_answers: может быть списком строк ['text1', 'text2'] или списком словарей [{'number': 1, 'answer': 'text1'}]
        question_type: тип вопроса
    
    Returns:
        list: список словарей с ключами 'number' и 'answer'
    """
    if question_type not in ['gap_fill', 'gapfill', 'sentence_completion', 'summary_completion', 'note_completion', 'flow_chart']:
        return correct_answers
    
    if not isinstance(correct_answers, list):
        return []
    
    # Если уже правильный формат (список словарей с нужными ключами)
    if correct_answers and all(isinstance(item, dict) and 'number' in item and 'answer' in item for item in correct_answers):
        return correct_answers
    
    # Если список строк или список словарей без нужной структуры - конвертируем
    normalized = []
    for idx, item in enumerate(correct_answers):
        if isinstance(item, str):
            # Простая строка - делаем словарь
            normalized.append({
                'number': idx + 1,
                'answer': item
            })
        elif isinstance(item, dict):
            # Словарь, но возможно в неправильном формате
            if 'number' in item and 'answer' in item:
                normalized.append(item)
            elif 'answer' in item:
                # Есть answer, но нет number
                normalized.append({
                    'number': item.get('number', idx + 1),
                    'answer': item['answer']
                })
            else:
                # Неизвестный формат - пытаемся извлечь как строку
                answer_text = str(item) if item else ''
                normalized.append({
                    'number': idx + 1,
                    'answer': answer_text
                })
        else:
            # Не строка и не словарь - конвертируем в строку
            normalized.append({
                'number': idx + 1,
                'answer': str(item) if item is not None else ''
            })
    
    return normalized

def get_test_render_structure(serializer_instance, obj):
    """
    Универсальная функция для рендера теста (Listening/Reading).
    Для Reading сортирует вопросы по order, для Listening — по id.
    """
    result = []
    session = obj
    answers = session.answers or {}
    test = session.test
    module = 'listening' if hasattr(test, 'listeningpart_set') or test.__class__.__name__ == 'ListeningTest' else 'reading'
    parts_query = test.parts.all().order_by('part_number')
    for part in parts_query:
        part_data = {
            'part_number': part.part_number,
            'title': getattr(part, 'title', ''),
            'passage_text': getattr(part, 'passage_text', ''),
            'instructions': part.instructions if module == 'listening' else getattr(part, 'instructions', ''),
            'questions': []
        }
        if module == 'reading':
            questions = part.questions.all().order_by('order')
        else:
            questions = part.questions.all().order_by('id')
        for q in questions:
            q_data = {
                'id': q.id,
                'type': q.question_type,
                'header': q.header,
                'instruction': q.instruction,
                'image': getattr(q, 'image_url', None) or getattr(q, 'image', None),
                'question_text': q.question_text,
                'sub_questions': []
            }
            
            # --- Multiple Choice ---
            if q.question_type in ['multiple_choice', 'multiplechoice']:
                # Multiple choice может приходить в разных форматах
                user_answer = ''
                question_answers = answers.get(str(q.id))
                if isinstance(question_answers, dict) and 'text' in question_answers:
                    # Формат: answers[questionId] = { text: "value" }
                    user_answer = question_answers['text']
                elif isinstance(question_answers, str):
                    # Старый формат: answers[questionId] = "value"
                    user_answer = question_answers
                
                correct_option = None
                options = []

                # Reading has answer_options, Listening has options  
                if hasattr(q, 'answer_options'):
                    options_qs = q.answer_options.all()
                else:
                    options_qs = q.options.all()

                for opt in options_qs:
                    # Reading has is_correct field, Listening determines from correct_answers
                    if hasattr(opt, 'is_correct'):
                        is_correct = opt.is_correct
                    else:
                        # For Listening: check if this option label or text is in correct_answers
                        is_correct = (q.correct_answers and (opt.label in q.correct_answers or opt.text in q.correct_answers))
                    
                    if is_correct:
                        correct_option = opt.label
                    options.append({
                        'label': opt.label,
                        'text': opt.text
                    })
                
                is_answered_correctly = (user_answer == correct_option)

                q_data['sub_questions'].append({
                    'type': 'mcq_single',
                    'student_answer': user_answer,
                    'correct_answer': correct_option,
                    'is_correct': is_answered_correctly,
                    'options': options,
                })
            
            # --- Multiple Response ---
            elif q.question_type == 'multiple_response':
                user_answers_raw = answers.get(str(q.id), {})
                # Ensure user_answers is a dictionary, handle cases where it might be a list
                if isinstance(user_answers_raw, list):
                    # Convert list to dict if needed (fallback)
                    user_answers = {}
                    for item in user_answers_raw:
                        if isinstance(item, str):
                            user_answers[item] = True
                elif isinstance(user_answers_raw, dict):
                    user_answers = user_answers_raw
                else:
                    user_answers = {}
                    
                sub_questions = []
                
                # Reading has answer_options, Listening has options
                if hasattr(q, 'answer_options'):
                    options_qs = q.answer_options.all()
                else:
                    options_qs = q.options.all()
                all_correct = True
                
                for opt in options_qs:
                    # Reading has is_correct field, Listening determines from correct_answers
                    if hasattr(opt, 'is_correct'):
                        is_correct_option = opt.is_correct
                    else:
                        # For Listening: check if this option is in correct_answers
                        is_correct_option = (q.correct_answers and opt.label in q.correct_answers) or (q.correct_answers and opt.text in q.correct_answers)
                    
                    was_selected_by_user = user_answers.get(opt.label, False)
                    
                    if is_correct_option != was_selected_by_user:
                        all_correct = False

                    sub_questions.append({
                        'label': opt.label,
                        'text': opt.text,
                        'student_selected': was_selected_by_user,
                        'is_correct_option': is_correct_option,
                    })

                q_data['sub_questions'].append({
                    'type': 'multiple_response',
                    'is_correct': all_correct, # The whole group is correct only if all choices are right
                    'options': sub_questions
                })

            # --- Gap Fill ---
            elif q.question_type in ['gap_fill', 'gapfill', 'summary_completion', 'sentence_completion']:
                text = q.question_text or ''
                gap_matches = list(re.finditer(r'\[\[(\d+)\]\]', text))
                
                # Нормализуем correct_answers для gap_fill
                normalized_correct_answers = normalize_correct_answers_for_gaps(q.correct_answers, q.question_type)
                
                for match in gap_matches:
                    gap_num = match.group(1)
                    
                    # Проверяем разные возможные форматы ключей
                    user_val = ''
                    question_answers = answers.get(str(q.id), {})
                    if isinstance(question_answers, dict):
                        # Формат: answers[questionId] = { "gap1": "value", "gap2": "value" }
                        user_val = question_answers.get(f"gap{gap_num}", '')
                    else:
                        # Старый формат: answers["questionId__gap1"] = "value" 
                        answer_key = f"{q.id}__gap{gap_num}"
                        user_val = answers.get(answer_key, '')

                    correct_val = ''
                    # Ищем в нормализованном списке словарей [{number: '1', answer: '...'}, ...]
                    correct_entry = next((item for item in normalized_correct_answers if str(item.get('number')) == str(gap_num)), None)
                    if correct_entry:
                        correct_val = correct_entry.get('answer', '')

                    is_correct = (normalize_answer(user_val) == normalize_answer(correct_val))
                    
                    q_data['sub_questions'].append({
                        'type': 'gap',
                        'number': gap_num,
                        'student_answer': user_val,
                        'correct_answer': correct_val,
                        'is_correct': is_correct
                    })

            # --- Table Completion ---
            elif q.question_type == 'table':
                if q.extra_data and 'rows' in q.extra_data:
                    for r_idx, row in enumerate(q.extra_data['rows']):
                        for c_idx, cell in enumerate(row):
                            if isinstance(cell, dict) and cell.get('type') == 'gap':
                                # Проверяем разные возможные форматы ключей
                                user_val = ''
                                question_answers = answers.get(str(q.id), {})
                                if isinstance(question_answers, dict):
                                    # Формат: answers[questionId] = { "r0c1": "value" }
                                    user_val = question_answers.get(f"r{r_idx}c{c_idx}", '')
                                else:
                                    # Старый формат: answers["questionId__gap0-1"] = "value"
                                    answer_key = f"{q.id}__gap{r_idx}-{c_idx}"
                                    user_val = answers.get(answer_key, '')
                                
                                correct_val = cell.get('answer', '')
                                is_correct = (normalize_answer(user_val) == normalize_answer(correct_val))

                                q_data['sub_questions'].append({
                                    'type': 'gap',
                                    'number': f'R{r_idx+1}, C{c_idx+1}',
                                    'student_answer': user_val,
                                    'correct_answer': correct_val,
                                    'is_correct': is_correct
                                })
            
            # --- True/False/Not Given ---
            elif q.question_type in ['true_false', 'TRUE_FALSE', 'TRUE_FALSE_NOT_GIVEN', 'true_false_not_given', 'yes_no_not_given']:
                # True/False questions can have multiple statements
                statements = []
                correct_answers_list = []
                
                # Try to get statements from extra_data
                if q.extra_data and 'statements' in q.extra_data:
                    statements = q.extra_data['statements']
                
                # Get correct answers
                if q.correct_answers:
                    correct_answers_list = q.correct_answers
                
                # If we have statements, create one sub-question per statement
                if statements and correct_answers_list:
                    for idx, statement in enumerate(statements):
                        correct_answer = correct_answers_list[idx] if idx < len(correct_answers_list) else ''
                        
                        # Проверяем разные возможные форматы ключей для ответов
                        user_answer = ''
                        question_answers = answers.get(str(q.id), {})
                        if isinstance(question_answers, dict):
                            # Формат: answers[questionId] = { "stmt0": "True", "stmt1": "False" }
                            user_answer = question_answers.get(f"stmt{idx}", '')
                        else:
                            # Старый формат: answers["questionId__idx"] = "True"
                            user_answer = answers.get(f"{q.id}__{idx}", '')
                        
                        is_correct = normalize_answer(user_answer) == normalize_answer(correct_answer)
                        
                        q_data['sub_questions'].append({
                            'type': 'true_false',
                            'statement': statement,
                            'student_answer': user_answer,
                            'correct_answer': correct_answer,
                            'is_correct': is_correct,
                        })
                else:
                    # Fallback: single true/false question
                    user_answer = answers.get(str(q.id), '')
                    correct_answer = correct_answers_list[0] if correct_answers_list else ''
                    
                    is_correct = normalize_answer(user_answer) == normalize_answer(correct_answer)
                    
                    q_data['sub_questions'].append({
                        'type': 'true_false',
                        'student_answer': user_answer,
                        'correct_answer': correct_answer,
                        'is_correct': is_correct,
                    })
            
            # --- Matching ---
            elif q.question_type in ['matching', 'match']:
                # For matching questions, get items from extra_data
                items = []
                if q.extra_data and 'items' in q.extra_data:
                    items = q.extra_data['items']
                elif q.extra_data and 'questions' in q.extra_data:
                    # Alternative: use questions as items to match
                    items = [{'text': qtext} for qtext in q.extra_data['questions']]
                
                # Get correct answers (can be dict or list)
                correct_answers_dict = {}
                if q.correct_answers:
                    if isinstance(q.correct_answers, dict):
                        correct_answers_dict = q.correct_answers
                    elif isinstance(q.correct_answers, list):
                        # Convert list to dict if needed
                        for idx, ans in enumerate(q.correct_answers):
                            if isinstance(ans, dict) and 'label' in ans:
                                correct_answers_dict[ans['label']] = ans.get('answer', '')
                            else:
                                correct_answers_dict[str(idx)] = ans
                
                # Create sub-questions for each item to match
                for idx, item in enumerate(items):
                    item_text = item.get('text', item) if isinstance(item, dict) else str(item)
                    item_key = str(idx)
                    
                    # Try different possible keys for the correct answer
                    correct_answer = ''
                    for possible_key in [item_key, item_text, f"Item {idx+1}", f"New Item {idx+1}"]:
                        if possible_key in correct_answers_dict:
                            correct_answer = correct_answers_dict[possible_key]
                            break
                    
                    # Проверяем разные возможные форматы ключей для ответов
                    user_answer = ''
                    question_answers = answers.get(str(q.id), {})
                    if isinstance(question_answers, dict):
                        # Формат: answers[questionId] = { "Item 1": "option", "Item 2": "option" }
                        user_answer = question_answers.get(item_text, '')
                    else:
                        # Старый формат: answers["questionId__item"] = "option"
                        user_answer = answers.get(f"{q.id}__{item_key}", '') or answers.get(f"{q.id}__{item_text}", '')
                    
                    is_correct = normalize_answer(user_answer) == normalize_answer(correct_answer)
                    
                    q_data['sub_questions'].append({
                        'type': 'matching',
                        'item': item_text,
                        'student_answer': user_answer,
                        'correct_answer': correct_answer,
                        'is_correct': is_correct,
                    })
            
            # --- Short Answer ---
            elif q.question_type in ['short_answer', 'shortanswer', 'short_response']:
                # Short answer может приходить в разных форматах
                user_answer = ''
                question_answers = answers.get(str(q.id))
                if isinstance(question_answers, dict):
                    # Может быть в subKey или в основном ключе
                    user_answer = question_answers.get('answer', '') or list(question_answers.values())[0] if question_answers else ''
                elif isinstance(question_answers, str):
                    user_answer = question_answers
                else:
                    user_answer = str(question_answers) if question_answers else ''
                
                correct_answer = ''
                if q.correct_answers and len(q.correct_answers) > 0:
                    correct_answer = q.correct_answers[0]
                
                is_correct = normalize_answer(user_answer) == normalize_answer(correct_answer)
                
                q_data['sub_questions'].append({
                    'type': 'short_answer',
                    'student_answer': user_answer,
                    'correct_answer': correct_answer,
                    'is_correct': is_correct,
                })
            
            # --- Неизвестный тип вопроса ---
            else:
                print(f"⚠️  UNKNOWN QUESTION TYPE: {q.question_type} for question {q.id}")
                print(f"⚠️  Available answers for Q{q.id}: {answers.get(str(q.id))}")
                
                # Пытаемся универсально обработать любой неизвестный тип
                user_answer = ''
                question_answers = answers.get(str(q.id))
                if isinstance(question_answers, dict):
                    # Берем первое значение из словаря или все значения
                    values = list(question_answers.values())
                    user_answer = ', '.join(str(v) for v in values if v) if values else ''
                elif isinstance(question_answers, list):
                    user_answer = ', '.join(str(v) for v in question_answers if v)
                else:
                    user_answer = str(question_answers) if question_answers else ''
                
                correct_answer = ''
                if q.correct_answers:
                    if isinstance(q.correct_answers, list):
                        correct_answer = ', '.join(str(a) for a in q.correct_answers)
                    else:
                        correct_answer = str(q.correct_answers)
                
                q_data['sub_questions'].append({
                    'type': 'unknown',
                    'student_answer': user_answer,
                    'correct_answer': correct_answer,
                    'is_correct': False,  # По умолчанию неправильно для неизвестных типов
                    'error': f'Unsupported question type: {q.question_type}'
                })

            part_data['questions'].append(q_data)
        result.append(part_data)

    return result


class ListeningTestSessionResultSerializer(serializers.ModelSerializer):
    test_title = serializers.CharField(source='test.title', read_only=True)
    student_id = serializers.CharField(source='user.student_id', read_only=True)
    time_taken = serializers.SerializerMethodField()
    band_score = serializers.SerializerMethodField()
    raw_score = serializers.SerializerMethodField()
    question_feedback = serializers.SerializerMethodField()
    detailed_breakdown = serializers.SerializerMethodField()
    total_questions = serializers.SerializerMethodField()
    submitted = serializers.BooleanField(read_only=True)
    score = serializers.IntegerField(read_only=True)
    correct_answers_count = serializers.IntegerField(read_only=True)
    total_questions_count = serializers.IntegerField(read_only=True)
    test_render_structure = serializers.SerializerMethodField()

    class Meta:
        model = ListeningTestSession
        fields = [
            'id', 'test', 'test_title', 'student_id', 'started_at', 'completed_at',
            'time_taken', 'band_score', 'score', 'raw_score', 'submitted', 'answers',
            'total_questions', 'total_questions_count', 'correct_answers_count', 
            'question_feedback', 'detailed_breakdown', 'test_render_structure'
        ]
        read_only_fields = ['user', 'started_at', 'completed_at', 'band_score', 'raw_score', 'submitted', 'question_feedback', 'detailed_breakdown']

    def get_time_taken(self, obj):
        return getattr(obj, 'time_taken', 0) or 0

    def get_band_score(self, obj):
        if getattr(obj, 'band_score', None) is not None:
            return obj.band_score
        result = getattr(obj, 'listeningtestresult', None)
        if result and getattr(result, 'band_score', None) is not None:
            return result.band_score
        return None

    def get_raw_score(self, obj):
        if getattr(obj, 'raw_score', None) is not None:
            return obj.raw_score
        result = getattr(obj, 'listeningtestresult', None)
        if result and getattr(result, 'raw_score', None) is not None:
            return result.raw_score
        return None

    def get_total_questions(self, obj):
        if getattr(obj, 'total_questions_count', None) is not None:
            return obj.total_questions_count
        result = getattr(obj, 'listeningtestresult', None)
        if result and result.breakdown:
            return len(result.breakdown)
        return 0

    def get_question_feedback(self, obj):
        result = getattr(obj, 'listeningtestresult', None)
        return result.breakdown if result and result.breakdown else {}

    def get_detailed_breakdown(self, obj):
        # Эта функция теперь проксирует к универсальной
        return get_test_render_structure(self, obj)
        
    def get_test_render_structure(self, obj):
        return get_test_render_structure(self, obj)

class ListeningTestCloneSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListeningTestClone
        fields = ['id', 'source_test', 'cloned_test', 'cloned_at']

def normalize_answer(ans):
    if not isinstance(ans, str):
        return ''
    ans = re.sub(r'[^A-Za-z0-9 \n]', '', ans)
    ans = re.sub(r'\s+', ' ', ans.replace('\n', ' '))
    return ans.strip().upper()

# --- Универсальная схема ключей для answers ---
# Везде, где ищутся user_answer/all_user_answers, теперь ищем по ключу f"{question_id}__{subId}" для саб-ответов.
# Для table: subId = r{row}c{col}
# Для gap_fill: subId = gap{N}
# Для multiple_response: subId = {label}
# Для matching: subId = left{N}
# Для form: subId = {idx}
# Все сравнения и подсчёты теперь по этим ключам.

def count_correct_subanswers(user_answer, correct_answers, question_type, extra_data=None, all_user_answers=None, question_id=None, options=None, points=1):
    print(f"[DEBUG] Checking question_type={question_type}")
    print(f"[DEBUG] all_user_answers={all_user_answers}")
    num_correct = 0
    num_total = 0
    # GAP FILL
    if question_type in ['gap_fill', 'gapfill', 'sentence_completion', 'summary_completion', 'note_completion', 'flow_chart']:
        # Используем новую функцию нормализации
        if extra_data and 'gaps' in extra_data:
            gaps = extra_data['gaps']
        else:
            gaps = normalize_correct_answers_for_gaps(correct_answers, question_type)
        
        num_total = len(gaps)
        for gap in gaps:
            gap_num = gap.get('number')
            correct_val = gap.get('answer', '')
            key = f"{question_id}__gap{gap_num}"
            user_val = all_user_answers.get(key, '') if all_user_answers else ''
            print(f"[DEBUG] gap: key={key}, user_val='{user_val}' vs correct_val='{correct_val}'")
            if normalize_answer(user_val) == normalize_answer(correct_val):
                num_correct += 1
        return num_correct, num_total
    # TABLE
    if question_type in ['table', 'table_completion', 'tablecompletion', 'form', 'form_completion']:
        cells = []
        if extra_data and 'table' in extra_data and 'cells' in extra_data['table']:
            cells = extra_data['table']['cells']
        num_total = 0
        for row_idx, row in enumerate(cells):
            for col_idx, cell in enumerate(row):
                if cell.get('isAnswer'):
                    num_total += 1
                    correct_val = cell.get('answer', '')
                    key = f"{question_id}__r{row_idx}c{col_idx}"
                    user_val = all_user_answers.get(key, '') if all_user_answers else ''
                    print(f"[DEBUG] table: key={key}, user_val='{user_val}' vs correct_val='{correct_val}'")
                    if normalize_answer(user_val) == normalize_answer(correct_val):
                        num_correct += 1
        return num_correct, num_total
    # MULTIPLE RESPONSE
    if question_type in ['multiple_response', 'checkbox', 'multi_select']:
        correct_labels = set()
        if options and all(hasattr(o, 'label') for o in options):
            for o in options:
                label = getattr(o, 'label', None)
                text = getattr(o, 'text', None)
                # Проверяем, является ли эта опция правильной
                if isinstance(correct_answers, list) and (text in correct_answers or label in correct_answers):
                    correct_labels.add(normalize_answer(label))
        elif isinstance(correct_answers, list):
            for label in correct_answers:
                correct_labels.add(normalize_answer(label))
        user_selected = set()
        for label in correct_labels:
            key = f"{question_id}__{label}"
            user_val = all_user_answers.get(key, False)
            if user_val is True or user_val == "true" or user_val == label:
                user_selected.add(normalize_answer(label))
        extra_selected = set()
        for k, v in (all_user_answers or {}).items():
            if k.startswith(f"{question_id}__") and v:
                sub = k.split("__", 1)[1]
                if sub not in correct_labels:
                    extra_selected.add(sub)
        print(f"[DEBUG] multiple_response: user_selected={user_selected}, correct_labels={correct_labels}, extra_selected={extra_selected}, points={points}")
        # ПРИНУДИТЕЛЬНО: Multiple Response всегда считается как один вопрос = один балл
        num_total = 1
        num_correct = 1 if user_selected == correct_labels and not extra_selected else 0
        return num_correct, num_total
    # MULTIPLE CHOICE / SINGLE CHOICE
    if question_type in ['multiple_choice', 'single_choice', 'radio', 'true_false', 'short_answer', 'TRUE_FALSE_NOT_GIVEN', 'shortanswer']:
        correct_label = ''
        if isinstance(correct_answers, list) and correct_answers:
            correct_label = correct_answers[0]
        elif isinstance(correct_answers, str):
            correct_label = correct_answers
        key = f"{question_id}__{correct_label}"
        user_val = all_user_answers.get(key, '') if all_user_answers else ''
        print(f"[DEBUG] single_choice: key={key}, user_val='{user_val}' vs correct_label='{correct_label}'")
        if user_val is True or user_val == 'true' or user_val == correct_label:
            return 1, 1
        return 0, 1
    # MATCHING (если потребуется)
    # ... аналогично ...
    return 0, 0

class ListeningTestSessionHistorySerializer(serializers.ModelSerializer):
    test_title = serializers.CharField(source='test.title', read_only=True)
    correct_answers_count = serializers.SerializerMethodField()
    total_questions_count = serializers.SerializerMethodField()
    time_taken = serializers.SerializerMethodField()
    band_score = serializers.SerializerMethodField()

    class Meta:
        model = ListeningTestSession
        fields = [
            'id', 'test_title', 'score', 'band_score', 'correct_answers_count', 'total_questions_count',
            'submitted', 'started_at', 'time_taken'
        ]

    def get_correct_answers_count(self, obj):
        return getattr(obj, 'correct_answers_count', 0) or 0

    def get_total_questions_count(self, obj):
        return getattr(obj, 'total_questions_count', 0) or 0

    def get_time_taken(self, obj):
        return getattr(obj, 'time_taken', 0) or 0

    def get_band_score(self, obj):
        if getattr(obj, 'band_score', None) is not None:
            return obj.band_score
        result = getattr(obj, 'listeningtestresult', None)
        if result and getattr(result, 'band_score', None) is not None:
            return result.band_score
        return None

# --- Reading Session History Serializer для Dashboard ---
class ReadingTestSessionHistorySerializer(serializers.ModelSerializer):
    test_title = serializers.CharField(source='test.title', read_only=True)
    correct_answers_count = serializers.SerializerMethodField()
    total_questions_count = serializers.SerializerMethodField()
    band_score = serializers.SerializerMethodField()
    submitted_at = serializers.SerializerMethodField()

    class Meta:
        model = ReadingTestSession
        fields = [
            'id', 'test_title', 'band_score', 'correct_answers_count', 'total_questions_count',
            'completed', 'submitted_at'
        ]

    def get_correct_answers_count(self, obj):
        result = getattr(obj, 'result', None)
        return result.raw_score if result else 0

    def get_total_questions_count(self, obj):
        result = getattr(obj, 'result', None)
        return result.total_score if result else 0



    def get_band_score(self, obj):
        result = getattr(obj, 'result', None)
        return result.band_score if result else None

    def get_submitted_at(self, obj):
        # Используем end_time как дату сабмита
        return obj.end_time.isoformat() if obj.end_time else obj.start_time.isoformat()

# --- Вложенные сериализаторы для ListeningTest ---
class ListeningAnswerOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListeningAnswerOption
        fields = ['id', 'label', 'text']

class ListeningQuestionSerializer(serializers.ModelSerializer):
    options = ListeningAnswerOptionSerializer(many=True, required=False, allow_null=True)
    question_type = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    question_text = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    extra_data = serializers.JSONField(required=False, allow_null=True)
    correct_answers = serializers.ListField(required=False, allow_null=True)
    header = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    instruction = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    image = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    points = serializers.IntegerField(required=False, allow_null=True)
    class Meta:
        model = ListeningQuestion
        fields = [
            'id', 'question_type', 'question_text', 'extra_data', 'correct_answers',
            'header', 'instruction', 'image', 'points', 'options'
        ]

class ListeningPartSerializer(serializers.ModelSerializer):
    questions = serializers.SerializerMethodField()
    audio = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    class Meta:
        model = ListeningPart
        fields = [
            'id', 'part_number', 'audio', 'audio_duration', 'instructions', 'questions'
        ]

    def get_questions(self, obj):
        # Возвращаем все вопросы без сортировки по questions_order
        return ListeningQuestionSerializer(obj.questions.all().order_by('id'), many=True).data

# --- Вложенные сериализаторы для записи ListeningTest ---
class ListeningQuestionWriteSerializer(serializers.ModelSerializer):
    options = serializers.ListField(child=serializers.DictField(), required=False, allow_null=True, default=list)
    class Meta:
        model = ListeningQuestion
        fields = [
            'id', 'question_type', 'question_text', 'extra_data', 'correct_answers',
            'header', 'instruction', 'image', 'points', 'options'
        ]

class ListeningPartWriteSerializer(serializers.ModelSerializer):
    questions = ListeningQuestionWriteSerializer(many=True, required=False)
    class Meta:
        model = ListeningPart
        fields = [
            'id', 'part_number', 'audio', 'audio_duration', 'instructions', 'questions'
        ]

# --- Сериализатор для чтения ListeningTest (GET) ---
class ListeningTestReadSerializer(serializers.ModelSerializer):
    parts = ListeningPartSerializer(many=True, read_only=True)
    class Meta:
        model = ListeningTest
        fields = [
            'id', 'title', 'description', 'is_active', 'parts', 'created_at', 'updated_at'
        ]

# --- Основной сериализатор ListeningTest (POST/PUT) ---
class ListeningTestSerializer(serializers.ModelSerializer):
    parts = ListeningPartWriteSerializer(many=True, required=False)
    class Meta:
        model = ListeningTest
        fields = [
            'id', 'title', 'description', 'is_active', 'parts', 'created_at', 'updated_at'
        ]

    def _filter_and_validate_options(self, options_data):
        filtered = []
        for opt in options_data:
            text = opt.get('text')
            if not text or (isinstance(text, str) and not text.strip()):
                continue  # пропускаем пустые
            if isinstance(text, list):
                raise serializers.ValidationError({'options': 'Option text must be a string, not a list.'})
            filtered.append(opt)
        return filtered

    def _filter_and_validate_questions(self, questions_data):
        filtered = []
        for q in questions_data:
            if isinstance(q.get('question_text'), list):
                raise serializers.ValidationError({'questions': 'Question text must be a string, not a list.'})
            if 'options' in q:
                q['options'] = self._filter_and_validate_options(q.get('options', []))
            filtered.append(q)
        return filtered

    def create(self, validated_data):
        parts_data = validated_data.pop('parts', [])
        test = ListeningTest.objects.create(**validated_data)
        for part_data in parts_data:
            questions_data = part_data.pop('questions', []) if 'questions' in part_data else []
            questions_data = self._filter_and_validate_questions(questions_data)
            part = ListeningPart.objects.create(test=test, **part_data)
            for question_data in questions_data:
                options_data = question_data.pop('options', []) if 'options' in question_data else []
                options_data = self._filter_and_validate_options(options_data)
                question_data.pop('order', None)
                question_data.pop('title', None)
                try:
                    print("CREATING QUESTION:", question_data)
                    question = ListeningQuestion.objects.create(part=part, **question_data)
                except Exception as e:
                    print("ERROR CREATING QUESTION:", e, question_data)
                    continue
                for idx, option_data in enumerate(options_data):
                    label = chr(65 + idx)
                    option_data = dict(option_data)
                    # Удаляем все лишние поля перед созданием
                    option_data.pop('label', None)
                    option_data.pop('image', None)
                    option_data.pop('id', None)
                    option_data.pop('isCorrect', None)  # Убираем поле isCorrect, которого нет в модели
                    print(f"CLEANED OPTION DATA for label {label}:", option_data)
                    try:
                        ListeningAnswerOption.objects.create(question=question, label=label, **option_data)
                    except Exception as e:
                        print(f"ERROR creating option {label}:", e, "option_data:", option_data)
                        continue
        return test

    def update(self, instance, validated_data):
        parts_data = validated_data.pop('parts', [])
        instance.title = validated_data.get('title', instance.title)
        instance.description = validated_data.get('description', instance.description)
        instance.is_active = validated_data.get('is_active', instance.is_active)
        instance.save()

        existing_parts = {p.part_number: p for p in instance.parts.all()}
        sent_part_numbers = set()
        for part_data in parts_data:
            part_number = part_data.get('part_number')
            sent_part_numbers.add(part_number)
            questions_data = part_data.pop('questions', []) if 'questions' in part_data else []
            questions_data = self._filter_and_validate_questions(questions_data)
            part, created = instance.parts.get_or_create(part_number=part_number, defaults={**part_data, 'test': instance})
            if not created:
                for attr, value in part_data.items():
                    setattr(part, attr, value)
                part.save()
            existing_questions = {str(q.id): q for q in part.questions.all()}
            sent_question_ids = set()
            for question_data in questions_data:
                q_id = str(question_data.get('id')) if question_data.get('id') else None
                options_data = question_data.pop('options', []) if 'options' in question_data else []
                options_data = self._filter_and_validate_options(options_data)
                question_data.pop('order', None)
                question_data.pop('title', None)
                try:
                    if q_id and q_id in existing_questions:
                        question = existing_questions[q_id]
                        for attr, value in question_data.items():
                            setattr(question, attr, value)
                        question.save()
                    else:
                        print("CREATING QUESTION:", question_data)
                        question = ListeningQuestion.objects.create(part=part, **question_data)
                except Exception as e:
                    print("ERROR CREATING QUESTION:", e, question_data)
                    continue
                sent_question_ids.add(str(question.id))
                # --- Обработка опций ---
                existing_options = {o.label: o for o in question.options.all()}
                sent_option_labels = set()
                for opt_idx, option_data in enumerate(options_data):
                    label = chr(65 + opt_idx)
                    sent_option_labels.add(label)
                    option_data = dict(option_data)
                    # Удаляем все лишние поля перед созданием
                    option_data.pop('label', None)
                    option_data.pop('image', None)
                    option_data.pop('id', None)
                    option_data.pop('isCorrect', None)  # Убираем поле isCorrect, которого нет в модели
                    print(f"CLEANED OPTION DATA for label {label}:", option_data)
                    try:
                        option, created = question.options.get_or_create(label=label, defaults={**option_data, 'question': question})
                        if not created:
                            for attr, value in option_data.items():
                                setattr(option, attr, value)
                            option.save()
                    except Exception as e:
                        print(f"ERROR creating option {label}:", e, "option_data:", option_data)
                        continue
                for label, option in existing_options.items():
                    if label not in sent_option_labels:
                        option.delete()
            # --- Удаляем вопросы, которых нет в новом списке ---
            if questions_data:
                for qid, question in existing_questions.items():
                    if qid not in sent_question_ids:
                        question.delete()
        for part_number, part in existing_parts.items():
            if part_number not in sent_part_numbers:
                part.delete()
        return instance

class ListeningTestResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListeningTestResult
        fields = ['id', 'session', 'raw_score', 'band_score', 'breakdown', 'calculated_at']

class ListeningTestSessionSyncSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListeningTestSession
        fields = '__all__'

class ListeningTestSessionSubmitSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListeningTestSession
        fields = ['answers', 'flagged', 'time_left', 'submitted']
        read_only_fields = ['submitted']

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id', 'uid', 'role', 'student_id', 'first_name', 'last_name', 'email', 'group', 'teacher',
            'is_active', 'is_staff', 'is_superuser'
        ]
        read_only_fields = ['id', 'uid', 'is_active', 'is_staff', 'is_superuser']

# --- READING SERIALIZERS ---

class ReadingAnswerOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReadingAnswerOption
        fields = ['id', 'text', 'is_correct', 'label']

# --- READ-ONLY (for GET requests) ---

class ReadingQuestionSerializer(serializers.ModelSerializer):
    answer_options = ReadingAnswerOptionSerializer(many=True, read_only=True)
    class Meta:
        model = ReadingQuestion
        fields = [
            'id', 'order', 'question_type', 'header', 'instruction',
            'image_url', 'question_text', 'points', 'correct_answers', 'extra_data', 'answer_options'
        ]

class ReadingPartSerializer(serializers.ModelSerializer):
    questions = ReadingQuestionSerializer(many=True, read_only=True)
    class Meta:
        model = ReadingPart
        fields = [
            'id', 'part_number', 'title', 'instructions', 'passage_text', 
            'passage_image_url', 'order', 'questions'
        ]

class ReadingTestReadSerializer(serializers.ModelSerializer):
    parts = ReadingPartSerializer(many=True, read_only=True)
    
    class Meta:
        model = ReadingTest
        fields = [
            'id', 'title', 'description', 'time_limit', 
            'total_points', 'is_active', 'created_at', 'parts'
        ]

# --- WRITE-ONLY (for POST/PUT/PATCH requests) ---

class ReadingQuestionWriteSerializer(serializers.ModelSerializer):
    answer_options = serializers.ListField(child=serializers.DictField(), required=False, allow_null=True, default=list)
    
    class Meta:
        model = ReadingQuestion
        fields = [
            'id', 'order', 'question_type', 'header', 'instruction',
            'image_url', 'question_text', 'points', 'correct_answers', 'extra_data', 'answer_options'
        ]
        extra_kwargs = {
            'id': {'read_only': False, 'required': False},
        }

class ReadingPartWriteSerializer(serializers.ModelSerializer):
    questions = ReadingQuestionWriteSerializer(many=True, required=False)

    class Meta:
        model = ReadingPart
        fields = [
            'id', 'part_number', 'title', 'instructions', 'passage_text', 
            'passage_image_url', 'order', 'questions'
        ]
        extra_kwargs = {
            'id': {'read_only': False, 'required': False},
        }


class ReadingTestSerializer(serializers.ModelSerializer):
    parts = ReadingPartWriteSerializer(many=True, required=False)

    class Meta:
        model = ReadingTest
        fields = [
            'id', 'title', 'description', 'time_limit', 
            'is_active', 'parts'
        ]

    def create(self, validated_data):
        parts_data = validated_data.pop('parts', [])
        test = ReadingTest.objects.create(**validated_data)

        for part_data in parts_data:
            questions_data = part_data.pop('questions', [])
            part_data.pop('id', None) # Remove id for creation
            part = ReadingPart.objects.create(test=test, **part_data)

            for question_data in questions_data:
                answer_options_data = question_data.pop('answer_options', [])
                question_data.pop('id', None) # Remove id for creation
                question = ReadingQuestion.objects.create(part=part, **question_data)

                for option_data in answer_options_data:
                    ReadingAnswerOption.objects.create(question=question, **option_data)
        
        return test

    def update(self, instance, validated_data):
        instance.title = validated_data.get('title', instance.title)
        instance.description = validated_data.get('description', instance.description)
        instance.time_limit = validated_data.get('time_limit', instance.time_limit)
        instance.is_active = validated_data.get('is_active', instance.is_active)
        instance.save()

        parts_data = validated_data.get('parts', [])
        
        # --- Parts ---
        existing_parts = {part.id: part for part in instance.parts.all()}
        incoming_part_ids = {item.get('id') for item in parts_data if item.get('id')}
        
        # Delete parts that are not in the incoming data
        for part_id, part in existing_parts.items():
            if part_id not in incoming_part_ids:
                part.delete()

        for part_data in parts_data:
            part_id = part_data.get('id')
            questions_data = part_data.pop('questions', [])
            
            if part_id and part_id in existing_parts:
                # Update existing part
                part = existing_parts[part_id]
                for key, value in part_data.items():
                    setattr(part, key, value)
                part.save()
            else:
                # Create new part
                part_data.pop('id', None)
                part = ReadingPart.objects.create(test=instance, **part_data)

            # --- Questions ---
            existing_questions = {q.id: q for q in part.questions.all()}
            incoming_question_ids = {item.get('id') for item in questions_data if item.get('id')}

            # Delete questions
            for q_id, q in existing_questions.items():
                if q_id not in incoming_question_ids:
                    q.delete()
            
            for question_data in questions_data:
                q_id = question_data.get('id')
                answer_options_data = question_data.pop('answer_options', [])
                
                if q_id and q_id in existing_questions:
                    # Update question
                    question = existing_questions[q_id]
                    for key, value in question_data.items():
                        setattr(question, key, value)
                    question.save()
                else:
                    # Create question
                    question_data.pop('id', None)
                    question = ReadingQuestion.objects.create(part=part, **question_data)
                
                # --- Answer Options ---
                # Simple approach: delete all and recreate
                question.answer_options.all().delete()
                for option_data in answer_options_data:
                    option_data.pop('id', None)
                    ReadingAnswerOption.objects.create(question=question, **option_data)

        return instance


class ReadingTestSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReadingTestSession
        fields = [
            'id', 'user', 'test', 'start_time', 'end_time', 
            'completed', 'answers', 'time_left_seconds'
        ]
        read_only_fields = ['user', 'test', 'start_time', 'end_time', 'completed']

class ReadingTestResultSerializer(serializers.ModelSerializer):
    correct_answers_text = serializers.SerializerMethodField()
    
    class Meta:
        model = ReadingTestResult
        fields = [
            'id', 'session', 'raw_score', 'total_score', 'band_score', 
            'breakdown', 'calculated_at', 'correct_answers_text'
        ]
        extra_kwargs = {
            'session': {'read_only': True},
            'raw_score': {'read_only': True},
            'total_score': {'read_only': True},
            'band_score': {'read_only': True},
            'breakdown': {'read_only': True},
            'calculated_at': {'read_only': True},
        }

    def get_correct_answers_text(self, instance):
        """Возвращает текст типа '1 / 12'"""
        return f"{int(instance.raw_score)} / {int(instance.total_score)}"

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        return representation
