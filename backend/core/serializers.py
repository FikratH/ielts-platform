from rest_framework import serializers
from .models import (
    Essay, WritingPrompt, WritingTest, WritingTask, WritingTestSession, User,
    ListeningTestSession, ListeningTest, ListeningPart, ListeningQuestion,
    ListeningAnswerOption, ListeningTestResult, ListeningTestClone, ListeningStudentAnswer,
    ReadingTest, ReadingPart, ReadingQuestion, ReadingAnswerOption,
    ReadingTestSession, ReadingTestResult, TeacherFeedback, TeacherSatisfactionSurvey, SpeakingSession
)
import re
import json
import base64
import uuid
import binascii
from django.core.files.base import ContentFile


def decode_base64_file(data):
    if not data:
        return None
    if isinstance(data, ContentFile):
        return data
    if isinstance(data, bytes):
        return ContentFile(data, name=f"{uuid.uuid4().hex}")
    if not isinstance(data, str):
        return None
    data = data.strip()
    if not data:
        return None
    file_ext = 'png'
    if ';base64,' in data:
        header, data = data.split(';base64,', 1)
        if '/' in header:
            file_ext = header.split('/')[-1]
    elif data.startswith('data:'):
        _, rest = data.split(':', 1)
        if ';base64,' in rest:
            mime, data = rest.split(';base64,', 1)
            if '/' in mime:
                file_ext = mime.split('/')[-1]
    try:
        decoded = base64.b64decode(data)
    except (TypeError, ValueError, binascii.Error):
        return None
    return ContentFile(decoded, name=f"{uuid.uuid4().hex}.{file_ext}")

class WritingTestSerializer(serializers.ModelSerializer):
    tasks = serializers.SerializerMethodField()
    
    class Meta:
        model = WritingTest
        fields = ['id', 'title', 'description', 'is_active', 'is_diagnostic_template', 'explanation_url', 'created_at', 'updated_at', 'tasks']
    
    def get_tasks(self, obj):
        tasks = obj.tasks.all()
        return WritingTaskSerializer(tasks, many=True).data

class WritingTaskSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(allow_null=True, required=False)
    test = serializers.PrimaryKeyRelatedField(read_only=False, queryset=WritingTest.objects.all())
    
    class Meta:
        model = WritingTask
        fields = ['id', 'test', 'task_type', 'task_text', 'image', 'created_at', 'updated_at']
    
    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if instance.image:
            from django.core.files.storage import default_storage
            from django.conf import settings
            # If image path already contains MEDIA_URL, don't add it again
            if instance.image.name.startswith(settings.MEDIA_URL.lstrip('/')):
                representation['image'] = f"{settings.MEDIA_URL}{instance.image.name}"
            else:
                representation['image'] = default_storage.url(instance.image.name)
        return representation

class WritingTaskLightSerializer(serializers.ModelSerializer):
    """Lightweight serializer for WritingTask without test field to avoid circular imports"""
    image = serializers.ImageField(allow_null=True, required=False)
    
    class Meta:
        model = WritingTask
        fields = ['id', 'task_type', 'task_text', 'image', 'created_at', 'updated_at']
    
    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if instance.image:
            from django.core.files.storage import default_storage
            from django.conf import settings
            # If image path already contains MEDIA_URL, don't add it again
            if instance.image.name.startswith(settings.MEDIA_URL.lstrip('/')):
                representation['image'] = f"{settings.MEDIA_URL}{instance.image.name}"
            else:
                representation['image'] = default_storage.url(instance.image.name)
        return representation

class WritingTestSessionSerializer(serializers.ModelSerializer):
    test = WritingTestSerializer(read_only=True)
    
    class Meta:
        model = WritingTestSession
        fields = [
            'id',
            'user',
            'test',
            'started_at',
            'completed',
            'band_score',
            'time_left_seconds',
            'task1_draft',
            'task2_draft',
        ]

class WritingTestSessionLightSerializer(serializers.ModelSerializer):
    """Lightweight serializer for WritingTestSession without nested objects to avoid circular imports"""
    test_title = serializers.CharField(source='test.title', read_only=True)
    
    class Meta:
        model = WritingTestSession
        fields = ['id', 'test_title', 'started_at', 'completed', 'band_score', 'time_left_seconds']

class WritingPromptSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(allow_null=True, required=False)
    class Meta:
        model = WritingPrompt
        fields = ['id', 'task_type', 'prompt_text', 'created_at', 'image', 'is_active']

class EssaySerializer(serializers.ModelSerializer):
    student_id = serializers.CharField(source='user.student_id', read_only=True)
    user = serializers.SerializerMethodField()
    teacher_feedback_published = serializers.SerializerMethodField()
    teacher_feedback_id = serializers.SerializerMethodField()
    teacher_feedback = serializers.SerializerMethodField()
    prompt = WritingPromptSerializer(read_only=True)
    task = WritingTaskLightSerializer(read_only=True)
    test_session = WritingTestSessionLightSerializer(read_only=True)
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

    def get_teacher_feedback_published(self, obj):
        fb = getattr(obj, 'teacher_feedback', None)
        return bool(fb and fb.published)

    def get_user(self, obj):
        return {
            'id': obj.user.id,
            'student_id': obj.user.student_id,
            'first_name': obj.user.first_name,
            'last_name': obj.user.last_name,
            'email': obj.user.email,
            'teacher': obj.user.teacher
        }

    def get_teacher_feedback_id(self, obj):
        fb = getattr(obj, 'teacher_feedback', None)
        return fb.id if fb and fb.published else None
    
    def get_teacher_feedback(self, obj):
        fb = getattr(obj, 'teacher_feedback', None)
        if fb and fb.published:
            return {
                'teacher_task_score': fb.teacher_task_score,
                'teacher_coherence_score': fb.teacher_coherence_score,
                'teacher_lexical_score': fb.teacher_lexical_score,
                'teacher_grammar_score': fb.teacher_grammar_score,
                'teacher_overall_score': fb.teacher_overall_score,
                'overall_feedback': fb.overall_feedback,
                'teacher_task_feedback': fb.teacher_task_feedback,
                'teacher_coherence_feedback': fb.teacher_coherence_feedback,
                'teacher_lexical_feedback': fb.teacher_lexical_feedback,
                'teacher_grammar_feedback': fb.teacher_grammar_feedback
            }
        return None




class ListeningTestSessionSerializer(serializers.ModelSerializer):
    test_title = serializers.CharField(source='test.title', read_only=True)
    student_id = serializers.CharField(source='user.student_id', read_only=True)
    
    class Meta:
        model = ListeningTestSession
        fields = ['id', 'test', 'test_title', 'user', 'student_id', 'started_at', 'status', 'answers', 'flagged', 'time_left', 'submitted', 'is_diagnostic']
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
        # For now, let's look for a `time_limit` attribute, or default to 40.
        return getattr(obj, 'time_limit', 40)

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
    time_limit = serializers.IntegerField(default=40)  
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


def create_detailed_breakdown(session, test_type='reading'):
    """
    Создает детальный breakdown для всех подвопросов в сессии.
    Может работать как с Reading, так и с Listening тестами.
    Эта версия полностью переработана для надежной обработки разных форматов ответов.
    """
    try:
        detailed_breakdown = []
        
        # Определяем модели на основе типа теста
        PartModel = ReadingPart if test_type == 'reading' else ListeningPart
        
        for part in session.test.parts.all().order_by('part_number'):
            part_data = {
                'part_number': part.part_number,
                'instructions': getattr(part, 'instructions', ''),
                'passage_text': getattr(part, 'passage_text', ''),
                'questions': []
            }

            questions_query = part.questions.all().order_by('order') if test_type == 'reading' else part.questions.all().order_by('order')

            for question in questions_query:
                try:
                    question_data = {
                        'question_id': question.id,
                        'question_text': question.question_text or '',
                        'question_type': question.question_type,
                        'header': getattr(question, 'header', ''),
                        'instruction': getattr(question, 'instruction', ''),
                        'image_url': getattr(question, 'image_url', getattr(question, 'image', None)),
                        'sub_questions': [],
                        'correct_sub_questions': 0,
                        'total_sub_questions': 0,
                        'points': getattr(question, 'points', 1),
                        'scoring_mode': getattr(question, 'reading_scoring_type', 'total') if test_type == 'reading' else getattr(question, 'scoring_mode', 'total')
                    }
                    
                    sub_questions_data = []
                    correct_sub_questions = 0
                    total_sub_questions = 0
                    all_user_answers = session.answers or {}

                    # --- Multiple Response (оценивается как единое целое) ---
                    if question.question_type in ['multiple_response', 'checkbox', 'multi_select', 'multipleresponse']:
                        # Проверяем, это Reading или Listening вопрос
                        if hasattr(question, 'answer_options'):  # Reading
                            # Используем новые функции для Reading multiple_response
                            breakdown = get_reading_multiple_response_breakdown(question, all_user_answers)
                            correct_sub_questions = breakdown['total_score']
                            total_sub_questions = breakdown['max_score']
                            
                            # Определяем общий статус для multiple_response вопроса
                            selected_options = set(breakdown['selected_options'])
                            correct_options = set(breakdown['correct_options'])
                            
                            if question.reading_scoring_type == 'all_or_nothing':
                                # Для all_or_nothing: выбранные опции должны точно совпадать с правильными
                                is_question_correct = (selected_options == correct_options)
                            else:  # per_correct_option
                                # Для per_correct_option: все правильные выбраны И никаких неправильных
                                is_question_correct = (correct_options.issubset(selected_options) and 
                                                     selected_options.issubset(correct_options))
                            
                            # Формируем опции для отображения
                            options_data = []
                            for option in question.answer_options.all():
                                option_detail = next((d for d in breakdown['option_details'] if d['label'] == option.label), None)
                                was_selected = option_detail['student_selected'] if option_detail else False
                                should_be_selected = option.is_correct
                                
                                options_data.append({
                                    'label': option.label,
                                    'text': option.text,
                                    'student_selected': was_selected,
                                    'is_correct_option': should_be_selected,
                                    'points': option.reading_points
                                })
                            
                            # Добавляем один элемент для всего multiple_response вопроса
                            sub_questions_data.append({
                                'type': 'multiple_response',
                                'is_correct': is_question_correct,
                                'scoring_mode': question.reading_scoring_type,
                                'selected_count': len(selected_options),
                                'correct_count': len(correct_options),
                                'options': options_data,
                                'user_answer': f"Selected {len(selected_options)} option(s)",
                                'correct_answer': f"Should select {len(correct_options)} option(s)"
                            })
                        else:  # Listening - старая логика
                            # Проверяем, что это действительно Listening вопрос
                            if hasattr(question, 'options'):
                                options = list(question.options.all())
                            else:
                                # Если это Reading вопрос без answer_options, это НЕ multiple_response вопрос!
                                # Пропускаем только если это действительно multiple_response вопрос
                                if question.question_type in ['multiple_response', 'checkbox', 'multi_select', 'multipleresponse']:
                                    continue
                                # Для других типов вопросов (true_false_not_given, multiple_choice) 
                                # не обрабатываем здесь, они обработаются в своих секциях
                                pass
                            correct_labels = set(q.strip() for q in (question.correct_answers or []))
                            
                            # Получаем режим подсчета баллов
                            scoring_mode = getattr(question, 'scoring_mode', 'total')
                            
                            user_selected_labels = set()

                            # Поддерживаем два формата ответов:
                            # 1. Listening формат: {question.id}__{option.label} = true/false
                            # 2. Reading формат: {question.id} = ['text1', 'text2']
                            
                            # Сначала проверяем Reading формат (массив выбранных текстов)
                            reading_format_answer = all_user_answers.get(str(question.id))
                            if isinstance(reading_format_answer, list):
                                # Reading формат: список выбранных текстов опций
                                for option in options:
                                    if option.text in reading_format_answer:
                                        user_selected_labels.add(option.label)
                            else:
                                # Listening формат: ищем ответы пользователя по ключам {question.id}__{option.label}
                                for option in options:
                                    key = f"{question.id}__{option.label}"
                                    option_value = all_user_answers.get(key)
                                    # Проверяем если опция выбрана (значение True, 'true', или равно label)
                                    if option_value is True or str(option_value).lower() == 'true' or option_value == option.label:
                                        user_selected_labels.add(option.label)
                            
                            # Подсчитываем баллы в зависимости от режима
                            if scoring_mode == 'total':
                                # Старая логика: 1 балл за весь вопрос
                                total_sub_questions = 1
                                is_question_correct = (user_selected_labels == correct_labels)
                                if is_question_correct:
                                    correct_sub_questions = 1
                            else:
                                # Новая логика: баллы за каждый правильный ответ
                                total_sub_questions = len(correct_labels)
                                correct_sub_questions = 0
                                for label in user_selected_labels:
                                    if label in correct_labels:
                                        # Получаем баллы за эту опцию
                                        option_points = getattr(next((opt for opt in options if opt.label == label), None), 'points', 1)
                                        correct_sub_questions += option_points

                            # Формируем sub_questions для отображения фронтенду
                            for option in options:
                                was_selected = option.label in user_selected_labels
                                should_be_selected = option.label in correct_labels
                                
                                # Правильность: (выбрано И должно быть выбрано) ИЛИ (не выбрано И не должно быть выбрано)
                                is_choice_correct = (was_selected and should_be_selected) or (not was_selected and not should_be_selected)

                                sub_questions_data.append({
                                    'sub_id': option.label,
                                    'label': option.text,
                                    'user_answer': 'Selected' if was_selected else '(not selected)',
                                    'correct_answer': 'Should be selected' if should_be_selected else 'Should not be selected',
                                    'is_correct': is_choice_correct,
                                    'points': getattr(option, 'points', 1)
                                })
                    
                    # --- Multiple Choice Group (несколько подпунктов) ---
                    elif question.question_type in ['multiple_choice_group']:
                        extra_data = getattr(question, 'extra_data', {}) or {}
                        group_items = extra_data.get('group_items') or []
                        total_sub_questions = 0
                        correct_sub_questions = 0

                        # Поддерживаем два формата ответов: словарь в answers[str(question.id)] и плоские ключи questionId__itemId
                        raw_group_answers = all_user_answers.get(str(question.id), {})
                        group_answers = {}
                        if isinstance(raw_group_answers, dict):
                            group_answers.update({str(k): v for k, v in raw_group_answers.items()})

                        for idx, item in enumerate(group_items):
                            item_id = str(item.get('id') or f'item_{idx}')
                            if item_id not in group_answers:
                                flat_key = f"{question.id}__{item_id}"
                                if flat_key in all_user_answers:
                                    group_answers[item_id] = all_user_answers.get(flat_key)

                        for idx, item in enumerate(group_items):
                            item_id = str(item.get('id') or f'item_{idx}')
                            prompt = item.get('prompt') or ''
                            options = item.get('options') or []
                            correct_label = str(item.get('correct_answer') or '').strip()
                            item_points = item.get('points', 1)
                            try:
                                item_points = float(item_points)
                            except (TypeError, ValueError):
                                item_points = 1

                            total_sub_questions += item_points

                            user_label = group_answers.get(item_id)
                            is_correct = check_alternative_answers(user_label, correct_label)
                            if is_correct:
                                correct_sub_questions += item_points

                            sub_questions_data.append({
                                'sub_id': item_id,
                                'label': prompt,
                                'user_answer': user_label or '(empty)',
                                'correct_answer': correct_label,
                                'is_correct': is_correct,
                                'points': item_points,
                                'options': options
                            })

                    # --- Multiple Choice (один ответ) / True-False ---
                    elif question.question_type in ['multiple_choice', 'single_choice', 'radio', 'true_false_not_given', 'true_false', 'yes_no_not_given']:
                        total_sub_questions = 1
                        
                        # Для Reading вопросов, получаем правильный ответ из extra_data или answer_options
                        if test_type == 'reading':
                            if question.question_type == 'multiple_choice':
                                # Для multiple_choice ищем правильную опцию в answer_options
                                correct_option = question.answer_options.filter(is_correct=True).first()
                                if correct_option:
                                    correct_answer_label = correct_option.label
                                else:
                                    correct_answer_label = ''
                            elif question.question_type == 'true_false_not_given':
                                # Для true_false_not_given обрабатываем каждое утверждение отдельно
                                extra_data = getattr(question, 'extra_data', {})
                                statements = extra_data.get('statements', [])
                                answers = extra_data.get('answers', [])
                                
                                # Каждое утверждение - это отдельный подвопрос
                                total_sub_questions = len(statements)
                                
                                # Обрабатываем каждое утверждение
                                for idx, statement in enumerate(statements):
                                    correct_answer = answers[idx] if idx < len(answers) else 'True'
                                    
                                    # Ищем ответ пользователя в правильном формате: {question.id: {stmt0: "True", stmt1: "False"}}
                                    question_answers = all_user_answers.get(str(question.id), {})
                                    user_answer = question_answers.get(f"stmt{idx}")
                                    
                                    is_correct = check_alternative_answers(user_answer, correct_answer)
                                    if is_correct:
                                        correct_sub_questions += 1
                                    
                                    sub_questions_data.append({
                                        'sub_id': f"statement_{idx}",
                                        'label': statement,
                                        'user_answer': user_answer or '(empty)',
                                        'correct_answer': correct_answer,
                                        'is_correct': is_correct
                                    })
                                
                                # Пропускаем обычную обработку для true_false_not_given
                                # НЕ используем continue - нужно добавить вопрос в breakdown
                            else:
                                # Fallback для других типов
                                correct_answer_label = str(question.correct_answers[0]).strip() if (isinstance(question.correct_answers, list) and question.correct_answers) else str(question.correct_answers).strip()
                        else:
                            # Для Listening вопросов используем старую логику
                            correct_answer_label = str(question.correct_answers[0]).strip() if (isinstance(question.correct_answers, list) and question.correct_answers) else str(question.correct_answers).strip()

                        # Для true_false_not_given вопросов уже все обработано выше
                        if question.question_type != 'true_false_not_given' or test_type != 'reading':
                            # Для Reading multiple_choice ответы сохраняются как {question.id: {text: "A"}}
                            if test_type == 'reading' and question.question_type == 'multiple_choice':
                                question_answer = all_user_answers.get(str(question.id), {})
                                user_answer_label = question_answer.get('text') if isinstance(question_answer, dict) else None
                            else:
                                user_answer_label = all_user_answers.get(str(question.id))
                            
                            if user_answer_label is None:
                                # Проверяем, что это Listening вопрос
                                if hasattr(question, 'options'):
                                    options = list(question.options.all())
                                    for option in options:
                                        key = f"{question.id}__{option.label}"
                                        option_value = all_user_answers.get(key)
                                        # Проверяем если опция выбрана (значение True или равно label)
                                        if option_value is True or option_value == option.label:
                                            user_answer_label = option.label
                                            break
                            
                            is_correct = check_alternative_answers(user_answer_label, correct_answer_label)
                            if is_correct:
                                correct_sub_questions = 1

                            sub_questions_data.append({
                                'sub_id': question.id,
                                'label': question.header or question.question_text,
                                'user_answer': user_answer_label or '(empty)',
                                'correct_answer': correct_answer_label,
                                'is_correct': is_correct
                            })

                    # --- Gap Fill и его варианты ---
                    elif question.question_type in ['gap_fill', 'gapfill', 'sentence_completion', 'summary_completion', 'note_completion', 'flow_chart', 'short_answer', 'shortanswer']:
                        # Нормализуем правильные ответы
                        correct_answers_list = normalize_correct_answers_for_gaps(question.correct_answers, question.question_type)
                        
                        if not correct_answers_list and question.question_type in ['short_answer', 'shortanswer']:
                             correct_answers_list = [{'number': 1, 'answer': str(question.correct_answers[0]) if question.correct_answers else ''}]
                        
                        # 🎯 СПЕЦИАЛЬНАЯ ЛОГИКА ДЛЯ LISTENING: извлекаем номера gap'ов из question_text
                        if test_type == 'listening' and question.question_text:
                            import re
                            gap_matches = re.findall(r'\[\[(\d+)\]\]', question.question_text)
                            if gap_matches and isinstance(question.correct_answers, list):
                                # Пересоздаем correct_answers_list с правильными номерами из текста
                                corrected_list = []
                                for idx, answer_text in enumerate(question.correct_answers):
                                    if idx < len(gap_matches):
                                        gap_number = int(gap_matches[idx])
                                        corrected_list.append({
                                            'number': gap_number,
                                            'answer': answer_text
                                        })
                                correct_answers_list = corrected_list
                        
                        # Убираем пустые ответы (элементы с answer: "" или пустые)
                        # И убираем элементы с number: '1' если они пустые (это артефакты создания)
                        correct_answers_list = [
                            item for item in correct_answers_list 
                            if item.get('answer', '').strip() and item.get('number', '') != '1'
                        ]
                        total_sub_questions = len(correct_answers_list)

                        # 🎯 УНИВЕРСАЛЬНАЯ ЛОГИКА СОПОСТАВЛЕНИЯ GAP-FILL ОТВЕТОВ
                        for idx, correct_answer_item in enumerate(correct_answers_list):
                            correct_val = correct_answer_item['answer']
                            user_val = None
                            
                            # Используем номер из текущего элемента (уже отфильтрованного)
                            original_gap_number = str(correct_answer_item.get('number', idx + 1))
                            
                            # Метод 1: Reading формат {question.id: {gap8: value, gap9: value}}
                            reading_format_answers = all_user_answers.get(str(question.id))
                            if isinstance(reading_format_answers, dict):
                                user_val = reading_format_answers.get(f"gap{original_gap_number}")
                            
                            # Метод 2: Listening формат {question.id__gap31: value}
                            if user_val is None:
                                listening_key = f"{question.id}__gap{original_gap_number}"
                                user_val = all_user_answers.get(listening_key)
                            
                            # Метод 3: Fallback для single answer questions
                            if user_val is None and total_sub_questions == 1:
                                user_val = all_user_answers.get(str(question.id))

                            is_sub_correct = check_alternative_answers(user_val, correct_val)
                            if is_sub_correct:
                                correct_sub_questions += 1
                            
                            sub_questions_data.append({
                                'sub_id': f"gap{original_gap_number}",
                                'label': f"Answer {original_gap_number}",
                                'user_answer': user_val or '(empty)',
                                'correct_answer': format_alternative_answers_display(correct_val),
                                'is_correct': is_sub_correct,
                            })

                    # --- Table & Form (каждая ячейка - отдельный балл) ---
                    elif question.question_type in ['table', 'table_completion', 'tablecompletion', 'form', 'form_completion']:
                        # Эта логика предполагает, что correct_answers хранит ответы в виде словаря
                        # e.g., {"r0c1": "answer1", "r2c3": "answer2"}
                        correct_answers_map = {}
                        if isinstance(question.correct_answers, list) and question.correct_answers and isinstance(question.correct_answers[0], dict):
                             correct_answers_map = {item['id']: item['answer'] for item in question.correct_answers}
                        
                        # Для table questions нужно перестроить correct_answers_map из extra_data,
                        # чтобы ключи были в формате r{row}c{col}__gap{number}, а не просто gap{number}
                        # Это важно для правильного поиска ответов пользователя
                        if question.extra_data and (question.question_type in ['table', 'table_completion', 'tablecompletion']):
                            import re
                            gap_regex = re.compile(r'\[\[(\d+)\]\]')
                            
                            if 'cells' in question.extra_data.get('table', {}):
                                correct_answers_map = {}
                                for r, row in enumerate(question.extra_data['table']['cells']):
                                    for c, cell in enumerate(row):
                                        cell_text = cell.get('text', '') if isinstance(cell, dict) else ''
                                        if cell_text:
                                            matches = list(gap_regex.finditer(cell_text))
                                            for match in matches:
                                                gap_number = match.group(1)
                                                gap_key = f"r{r}c{c}__gap{gap_number}"
                                                correct_gap = None
                                                if question.extra_data and 'gaps' in question.extra_data:
                                                    correct_gap = next((g for g in question.extra_data['gaps'] if str(g.get('number', '')) == gap_number), None)
                                                elif isinstance(question.correct_answers, list) and question.correct_answers:
                                                    correct_gap = next((g for g in question.correct_answers if str(g.get('number', '')) == gap_number), None)
                                                if correct_gap:
                                                    correct_answers_map[gap_key] = correct_gap.get('answer', '')
                        
                        # Если карта пуста, пытаемся построить из extra_data (для других типов вопросов)
                        if not correct_answers_map and question.extra_data:
                            import re
                            gap_regex = re.compile(r'\[\[(\d+)\]\]')
                            
                            if 'cells' in question.extra_data.get('table', {}): # Table (Listening)
                                for r, row in enumerate(question.extra_data['table']['cells']):
                                    for c, cell in enumerate(row):
                                        cell_text = cell.get('text', '') if isinstance(cell, dict) else ''
                                        if cell_text:
                                            matches = list(gap_regex.finditer(cell_text))
                                            for match in matches:
                                                gap_number = match.group(1)
                                                gap_key = f"r{r}c{c}__gap{gap_number}"
                                                correct_gap = None
                                                if question.gaps and isinstance(question.gaps, list):
                                                    correct_gap = next((g for g in question.gaps if str(g.get('number', '')) == gap_number), None)
                                                elif question.extra_data and 'gaps' in question.extra_data:
                                                    correct_gap = next((g for g in question.extra_data['gaps'] if str(g.get('number', '')) == gap_number), None)
                                                correct_answers_map[gap_key] = correct_gap.get('answer', '') if correct_gap else ''
                                        elif cell.get('isAnswer'):
                                            correct_answers_map[f"r{r}c{c}"] = cell.get('answer', '')
                            elif 'rows' in question.extra_data: # Table (Reading)
                                for r, row in enumerate(question.extra_data['rows']):
                                    for c, cell in enumerate(row):
                                        cell_text = ''
                                        if isinstance(cell, dict):
                                            cell_text = cell.get('text', cell.get('content', ''))
                                        elif isinstance(cell, str):
                                            cell_text = cell
                                        
                                        if cell_text:
                                            matches = list(gap_regex.finditer(cell_text))
                                            for match in matches:
                                                gap_number = match.group(1)
                                                gap_key = f"r{r}c{c}__gap{gap_number}"
                                                correct_val = ''
                                                if question.extra_data and 'answers' in question.extra_data:
                                                    correct_val = question.extra_data['answers'].get(gap_number, '')
                                                    if not isinstance(correct_val, str):
                                                        correct_val = ''
                                                if not correct_val and question.gaps and isinstance(question.gaps, list):
                                                    correct_gap = next((g for g in question.gaps if str(g.get('number', '')) == gap_number), None)
                                                    if correct_gap:
                                                        correct_val = correct_gap.get('answer', '')
                                                elif not correct_val and question.extra_data and 'gaps' in question.extra_data:
                                                    correct_gap = next((g for g in question.extra_data['gaps'] if str(g.get('number', '')) == gap_number), None)
                                                    if correct_gap:
                                                        correct_val = correct_gap.get('answer', '')
                                                correct_answers_map[gap_key] = correct_val
                                        elif isinstance(cell, dict) and cell.get('type') == 'gap':
                                            gap_key = f"r{r}c{c}"
                                            correct_answers_map[gap_key] = cell.get('answer', '')
                            elif 'fields' in question.extra_data: # Form
                                 for i, field in enumerate(question.extra_data['fields']):
                                     if field.get('isAnswer'):
                                         correct_answers_map[f"field{i}"] = field.get('answer', '')
                        
                        total_sub_questions = len(correct_answers_map)
                        
                        for sub_id, correct_val in correct_answers_map.items():
                            user_val = None
                            
                            if sub_id.startswith('r') and '__gap' in sub_id:
                                question_id_str = str(question.id)
                                
                                possible_keys = [
                                    f"{question_id_str}__{sub_id}",
                                    f"{question.id}__{sub_id}",
                                ]
                                
                                for key in possible_keys:
                                    if key in all_user_answers:
                                        user_val = all_user_answers.get(key)
                                        if user_val:
                                            break
                                
                                if not user_val:
                                    for key in all_user_answers.keys():
                                        if isinstance(key, str) and key.endswith(f"__{sub_id}"):
                                            user_val = all_user_answers.get(key)
                                            if user_val:
                                                break
                            else:
                                key_str = f"{question.id}__{sub_id}"
                                key_str_alt = f"{str(question.id)}__{sub_id}"
                                user_val = all_user_answers.get(key_str) or all_user_answers.get(key_str_alt)
                            
                            is_sub_correct = check_alternative_answers(user_val, correct_val)
                            if is_sub_correct:
                                correct_sub_questions += 1
                                
                            label = sub_id
                            if '__gap' in sub_id:
                                gap_num = sub_id.split('__gap')[-1]
                                label = f"Gap {gap_num}"
                            elif sub_id.startswith('gap'):
                                gap_num = sub_id.replace('gap', '')
                                label = f"Gap {gap_num}"
                            
                            sub_questions_data.append({
                                'sub_id': sub_id,
                                'label': label,
                                'user_answer': user_val or '(empty)',
                                'correct_answer': format_alternative_answers_display(correct_val),
                                'is_correct': is_sub_correct,
                            })

                    # --- Неизвестный тип вопроса (Fallback) ---
                    else:
                        sub_questions_data.append({
                            'sub_id': 'unknown', 'label': 'Unknown question type', 'user_answer': '',
                            'correct_answer': '', 'is_correct': False,
                            'error': f'Unsupported question type: {question.question_type}'
                        })

                    question_data['sub_questions'] = sub_questions_data
                    question_data['correct_sub_questions'] = correct_sub_questions
                    question_data['total_sub_questions'] = total_sub_questions
                    
                    part_data['questions'].append(question_data)

                except Exception as e:
                    print(f"❌ Error processing question {question.id}: {e}")
                    # Добавляем вопрос с ошибкой в breakdown
                    question_data = {
                        'question_id': question.id,
                        'question_text': question.question_text or '',
                        'question_type': question.question_type,
                        'header': getattr(question, 'header', ''),
                        'instruction': getattr(question, 'instruction', ''),
                        'sub_questions': [{
                            'sub_id': 'error',
                            'label': 'Error processing question',
                            'user_answer': 'Error',
                            'correct_answer': 'Error',
                            'is_correct': False,
                            'error': str(e)
                        }],
                        'correct_sub_questions': 0,
                        'total_sub_questions': 1,
                        'points': 0
                    }
                    part_data['questions'].append(question_data)
            
            detailed_breakdown.append(part_data)
        
        # Подсчитываем общие баллы
        total_raw_score = 0
        total_possible_score = 0
        
        for part in detailed_breakdown:
            for question in part['questions']:
                total_raw_score += question['correct_sub_questions']
                total_possible_score += question['total_sub_questions']
        
        return {
            'raw_score': total_raw_score,
            'total_score': total_possible_score,
            'breakdown': detailed_breakdown
        }
    except Exception as e:
        return {
            'raw_score': 0,
            'total_score': 0,
            'breakdown': []
        }

def create_listening_detailed_breakdown(session):
    """
    Обертка для create_detailed_breakdown специально для Listening тестов.
    Возвращает полный объект с результатами.
    """

    # Конвертация в IELTS Band
    def convert_to_band(score, total):
        # Эта шкала примерная и должна быть уточнена
        if score >= 39: return 9.0
        if score >= 37: return 8.5
        if score >= 35: return 8.0
        if score >= 32: return 7.5
        if score >= 30: return 7.0
        if score >= 27: return 6.5
        if score >= 23: return 6.0
        if score >= 19: return 5.5
        if score >= 15: return 5.0
        if score >= 12: return 4.5
        if score >= 10: return 4.0
        if score >= 8: return 3.5
        if score >= 6: return 3.0
        return 2.5

    # 1. Считаем детальный breakdown
    breakdown_result = create_detailed_breakdown(session, test_type='listening')
    breakdown_data = breakdown_result.get('breakdown', [])
    raw_score = breakdown_result.get('raw_score', 0)
    total_score = breakdown_result.get('total_score', 0)

    # 2. Считаем баллы на основе breakdown (если не посчитано)
    if raw_score == 0 and total_score == 0:
        for part in breakdown_data:
            for question in part['questions']:
                question_id = question.get('question_id')
                question_type = question.get('question_type')
                correct_sub = question.get('correct_sub_questions', 0)
                total_sub = question.get('total_sub_questions', 0)
                points_per_sub = question.get('points', 1)
            
                # Для multiple response в режиме per_correct не умножаем на points вопроса
                if question_type == 'multiple_response' and question.get('scoring_mode', 'total') == 'per_correct':
                    question_score = correct_sub  # Уже посчитано правильно
                    question_total = total_sub
                elif question_type == 'multiple_choice_group':
                    # Для multiple_choice_group баллы уже учтены в correct_sub_questions и total_sub_questions
                    # (каждый item имеет свои points), поэтому не умножаем на points вопроса
                    question_score = correct_sub
                    question_total = total_sub
                else:
                    question_score = correct_sub * points_per_sub
                    question_total = total_sub * points_per_sub
                
                raw_score += question_score
                total_score += question_total
            
    # 3. Конвертируем в band
    band_score = convert_to_band(raw_score, 40) # В IELTS Listening всегда 40 вопросов
    
    # 4. Возвращаем все данные
    result = {
        'detailed_breakdown': breakdown_data,
        'raw_score': raw_score,
        'total_score': total_score,
        'band_score': band_score,
    }
    
    return result

def normalize_correct_answers_for_gaps(correct_answers, question_type):
    """
    Нормализует correct_answers для gap_fill типов вопросов.
    Для reading СОХРАНЯЕТ оригинальные номера gap'ов.
    Для listening нормализует к последовательности 1,2,3...
    
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
    
    normalized = []
    for idx, item in enumerate(correct_answers):
        if isinstance(item, str):
            # Простая строка - делаем словарь с последовательным номером
            normalized.append({
                'number': idx + 1,
                'answer': item
            })
        elif isinstance(item, dict):
            # Словарь - СОХРАНЯЕМ оригинальный номер для reading
            if 'answer' in item:
                original_number = item.get('number', idx + 1)
                # Конвертируем строковые номера в числа
                if isinstance(original_number, str):
                    try:
                        original_number = int(original_number)
                    except:
                        original_number = idx + 1
                normalized.append({
                    'number': original_number,  # СОХРАНЯЕМ оригинальный номер!
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
    Для Reading сортирует парты по order и part_number, вопросы по order.
    Для Listening сортирует парты по part_number, вопросы по order.
    """
    result = []
    session = obj
    answers = session.answers or {}
    test = session.test
    module = 'listening' if hasattr(test, 'listeningpart_set') or test.__class__.__name__ == 'ListeningTest' else 'reading'
    if module == 'reading':
        parts_query = test.parts.all().order_by('order', 'part_number')
    else:
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
            questions = part.questions.all().order_by('order')
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
                        correct_option = opt.label  # Use label for Reading (matches frontend)
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

                # Подсчитываем правильные ответы для multiple response
                correct_count = sum(1 for opt in sub_questions if opt['is_correct_option'])
                selected_correct = sum(1 for opt in sub_questions if opt['student_selected'] and opt['is_correct_option'])
                selected_incorrect = sum(1 for opt in sub_questions if opt['student_selected'] and not opt['is_correct_option'])
                
                # Получаем режим подсчета баллов
                scoring_mode = getattr(q, 'scoring_mode', 'total')
                
                # Финальный балл в зависимости от режима
                if scoring_mode == 'total':
                    final_score = 1 if all_correct else 0
                else:
                    # Режим per_correct: баллы за каждый правильный ответ
                    final_score = selected_correct
                
                q_data['sub_questions'].append({
                    'type': 'multiple_response',
                    'is_correct': all_correct, # The whole group is correct only if all choices are right
                    'options': sub_questions,
                    'scoring_mode': scoring_mode,
                    'final_score': final_score
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

                    is_correct = (check_alternative_answers(user_val, correct_val))
                    
                    q_data['sub_questions'].append({
                        'type': 'gap',
                        'number': gap_num,
                        'student_answer': user_val,
                        'correct_answer': format_alternative_answers_display(correct_val),
                        'is_correct': is_correct
                    })

            # --- Table Completion ---
            elif q.question_type == 'table':
                table_data = None
                is_listening_format = False
                
                if q.extra_data and 'rows' in q.extra_data:
                    table_data = q.extra_data['rows']
                elif q.extra_data and 'table' in q.extra_data and 'cells' in q.extra_data['table']:
                    table_data = q.extra_data['table']['cells']
                    is_listening_format = True
                
                if table_data:
                    import re
                    gap_regex = re.compile(r'\[\[(\d+)\]\]')
                    
                    for r_idx, row in enumerate(table_data):
                        for c_idx, cell in enumerate(row):
                            cell_text = ''
                            if isinstance(cell, dict):
                                cell_text = cell.get('text', cell.get('content', ''))
                            elif isinstance(cell, str):
                                cell_text = cell
                            
                            if not cell_text:
                                continue
                            
                            matches = list(gap_regex.finditer(cell_text))
                            
                            if matches:
                                for match in matches:
                                    gap_number = match.group(1)
                                    if is_listening_format:
                                        listening_key = f"{q.id}__r{r_idx}c{c_idx}__gap{gap_number}"
                                        user_val = answers.get(listening_key, '')
                                    else:
                                        question_answers = answers.get(str(q.id), {})
                                        if not isinstance(question_answers, dict):
                                            question_answers = {}
                                        gap_key = f"r{r_idx}c{c_idx}__gap{gap_number}"
                                        user_val = question_answers.get(gap_key, '')
                                    
                                    correct_gap = None
                                    if q.gaps and isinstance(q.gaps, list):
                                        correct_gap = next((g for g in q.gaps if str(g.get('number', '')) == gap_number), None)
                                    elif q.extra_data and 'gaps' in q.extra_data:
                                        correct_gap = next((g for g in q.extra_data['gaps'] if str(g.get('number', '')) == gap_number), None)
                                    
                                    correct_val = correct_gap.get('answer', '') if correct_gap else ''
                                    is_correct = (check_alternative_answers(user_val, correct_val))
                                    
                                    q_data['sub_questions'].append({
                                        'type': 'gap',
                                        'number': f'R{r_idx+1}, C{c_idx+1} (gap {gap_number})',
                                        'student_answer': user_val,
                                        'correct_answer': format_alternative_answers_display(correct_val),
                                        'is_correct': is_correct
                                    })
                            elif isinstance(cell, dict) and cell.get('isAnswer'):
                                if is_listening_format:
                                    listening_key = f"{q.id}__r{r_idx}c{c_idx}"
                                    user_val = answers.get(listening_key, '')
                                else:
                                    question_answers = answers.get(str(q.id), {})
                                    if not isinstance(question_answers, dict):
                                        question_answers = {}
                                    gap_key = f"r{r_idx}c{c_idx}"
                                    user_val = question_answers.get(gap_key, '')
                                
                                correct_val = cell.get('answer', '')
                                is_correct = (check_alternative_answers(user_val, correct_val))
                                
                                q_data['sub_questions'].append({
                                    'type': 'gap',
                                    'number': f'R{r_idx+1}, C{c_idx+1}',
                                    'student_answer': user_val,
                                    'correct_answer': format_alternative_answers_display(correct_val),
                                    'is_correct': is_correct
                                })
                            elif isinstance(cell, dict) and cell.get('type') == 'gap':
                                question_answers = answers.get(str(q.id), {})
                                if not isinstance(question_answers, dict):
                                    question_answers = {}
                                gap_key = f"r{r_idx}c{c_idx}"
                                user_val = question_answers.get(gap_key, '')
                                correct_val = cell.get('answer', '')
                                is_correct = (check_alternative_answers(user_val, correct_val))

                                q_data['sub_questions'].append({
                                    'type': 'gap',
                                    'number': f'R{r_idx+1}, C{c_idx+1}',
                                    'student_answer': user_val,
                                    'correct_answer': format_alternative_answers_display(correct_val),
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
                        
                        is_correct = check_alternative_answers(user_answer, correct_answer)
                        
                        q_data['sub_questions'].append({
                            'type': 'true_false',
                            'statement': statement,
                            'student_answer': user_answer,
                            'correct_answer': format_alternative_answers_display(correct_answer),
                            'is_correct': is_correct,
                        })
                else:
                    # Fallback: single true/false question
                    user_answer = answers.get(str(q.id), '')
                    correct_answer = correct_answers_list[0] if correct_answers_list else ''
                    
                    is_correct = check_alternative_answers(user_answer, correct_answer)
                    
                    q_data['sub_questions'].append({
                        'type': 'true_false',
                        'student_answer': user_answer,
                        'correct_answer': format_alternative_answers_display(correct_answer),
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
                    
                    is_correct = check_alternative_answers(user_answer, correct_answer)
                    
                    q_data['sub_questions'].append({
                        'type': 'matching',
                        'item': item_text,
                        'student_answer': user_answer,
                        'correct_answer': format_alternative_answers_display(correct_answer),
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
                
                is_correct = check_alternative_answers(user_answer, correct_answer)
                
                q_data['sub_questions'].append({
                    'type': 'short_answer',
                    'student_answer': user_answer,
                    'correct_answer': format_alternative_answers_display(correct_answer),
                    'is_correct': is_correct,
                })
            
            # --- Неизвестный тип вопроса ---
            else:
                pass
                
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
    explanation_url = serializers.CharField(source='test.explanation_url', read_only=True)
    student_id = serializers.CharField(source='user.student_id', read_only=True)
    time_taken = serializers.SerializerMethodField()
    
    # Новые поля, которые будут заполняться из to_representation
    band_score = serializers.FloatField(read_only=True)
    raw_score = serializers.IntegerField(read_only=True)
    total_score = serializers.IntegerField(read_only=True)
    detailed_breakdown = serializers.JSONField(read_only=True)

    class Meta:
        model = ListeningTestSession
        fields = [
            'id', 'test', 'test_title', 'explanation_url', 'student_id', 'started_at', 'completed_at',
            'time_taken', 'band_score', 'raw_score', 'total_score', 'submitted', 'answers',
            'detailed_breakdown', 'is_diagnostic'
        ]
        read_only_fields = fields

    def get_time_taken(self, obj):
        if obj.completed_at and obj.started_at:
            return (obj.completed_at - obj.started_at).total_seconds()
        return getattr(obj, 'time_taken', 0) or 0

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        
        try:
            result = getattr(instance, 'listeningtestresult', None)
            if result:
                representation['raw_score'] = result.raw_score
                representation['total_score'] = instance.total_questions_count or 0
                representation['band_score'] = result.band_score
                breakdown = result.breakdown
                if isinstance(breakdown, list):
                    representation['detailed_breakdown'] = breakdown
                elif isinstance(breakdown, dict) and breakdown:
                    representation['detailed_breakdown'] = breakdown
                else:
                    representation['detailed_breakdown'] = []
            else:
                if 'listening_results' in self.context:
                    results = self.context['listening_results']
                else:
                    results = create_listening_detailed_breakdown(instance)
                    self.context['listening_results'] = results
                representation['raw_score'] = results.get('raw_score', 0)
                representation['total_score'] = results.get('total_score', 0)
                representation['band_score'] = results.get('band_score', 0)
                representation['detailed_breakdown'] = results.get('detailed_breakdown', [])
        except Exception:
            if 'listening_results' in self.context:
                results = self.context['listening_results']
            else:
                results = create_listening_detailed_breakdown(instance)
                self.context['listening_results'] = results
            representation['raw_score'] = results.get('raw_score', 0)
            representation['total_score'] = results.get('total_score', 0)
            representation['band_score'] = results.get('band_score', 0)
            representation['detailed_breakdown'] = results.get('detailed_breakdown', [])

        return representation


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

def check_alternative_answers(user_answer, correct_answer_text):
    """
    Проверяет ответ пользователя против правильного ответа с поддержкой альтернатив.
    Если в correct_answer_text есть |, то проверяются все альтернативы.
    
    Args:
        user_answer: ответ пользователя
        correct_answer_text: правильный ответ, может содержать альтернативы через |
        
    Returns:
        bool: True если ответ правильный
    """
    if not isinstance(correct_answer_text, str):
        correct_answer_text = str(correct_answer_text) if correct_answer_text else ''
    
    if '|' in correct_answer_text:
        alternatives = [alt.strip() for alt in correct_answer_text.split('|')]  # Убрали if alt.strip() чтобы поддерживать пустые ответы
        user_normalized = normalize_answer(user_answer)
        return any(user_normalized == normalize_answer(alt) for alt in alternatives)
    else:
        return normalize_answer(user_answer) == normalize_answer(correct_answer_text)

def format_alternative_answers_display(correct_answer_text):
    """
    Форматирует альтернативные ответы для отображения в UI.
    Если есть альтернативы через |, показывает их через " / ".
    
    Args:
        correct_answer_text: правильный ответ, может содержать альтернативы через |
        
    Returns:
        str: отформатированная строка для отображения
    """
    if not isinstance(correct_answer_text, str):
        return str(correct_answer_text) if correct_answer_text else ''
    
    if '|' in correct_answer_text:
        alternatives = [alt.strip() for alt in correct_answer_text.split('|')]
        # Заменяем пустые альтернативы на "(empty)" для отображения
        formatted_alternatives = [alt if alt else "(empty)" for alt in alternatives]
        return ' / '.join(formatted_alternatives)
    else:
        return correct_answer_text

# --- Универсальная схема ключей для answers ---
# Везде, где ищутся user_answer/all_user_answers, теперь ищем по ключу f"{question_id}__{subId}" для саб-ответов.
# Для table: subId = r{row}c{col}
# Для gap_fill: subId = gap{N}
# Для multiple_response: subId = {label}
# Для matching: subId = left{N}
# Для form: subId = {idx}
# Все сравнения и подсчёты теперь по этим ключам.

def count_correct_subanswers(user_answer, correct_answers, question_type, extra_data=None, all_user_answers=None, question_id=None, options=None, points=1):
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
        
        # 🎯 УНИВЕРСАЛЬНАЯ ЛОГИКА для count_correct_subanswers
        # Найдем минимальный gap номер для этого вопроса
        min_gap_number = None
        try:
            question = ListeningQuestion.objects.get(id=question_id)
            if question.question_text:
                import re
                gap_matches = re.findall(r'\[\[(\d+)\]\]', question.question_text)
                if gap_matches:
                    min_gap_number = min(int(m) for m in gap_matches)
        except:
            pass
        
        # УНИВЕРСАЛЬНОЕ СОПОСТАВЛЕНИЕ по правильным позициям
        for idx, gap in enumerate(gaps):
            correct_val = gap.get('answer', '')
            user_val = ''
            
            if all_user_answers:
                # Сначала Reading формат: {question_id: {gap1: value, gap2: value}}
                reading_format_answers = all_user_answers.get(str(question_id))
                if isinstance(reading_format_answers, dict):
                    gap_num = gap.get('number', idx + 1)
                    user_val = reading_format_answers.get(f"gap{gap_num}", '')
                
                # Затем Listening формат: рассчитываем правильный gap номер
                if not user_val and min_gap_number is not None:
                    actual_gap_number = min_gap_number + idx
                    gap_key = f"{question_id}__gap{actual_gap_number}"
                    user_val = all_user_answers.get(gap_key, '')
            
            if check_alternative_answers(user_val, correct_val):
                num_correct += 1
        return num_correct, num_total
    # TABLE
    if question_type in ['table', 'table_completion', 'tablecompletion', 'form', 'form_completion']:
        import re
        gap_regex = re.compile(r'\[\[(\d+)\]\]')
        cells = []
        is_listening_format = False
        
        if extra_data and 'table' in extra_data and 'cells' in extra_data['table']:
            cells = extra_data['table']['cells']
            is_listening_format = True
        elif extra_data and 'rows' in extra_data:
            cells = extra_data['rows']
        
        num_total = 0
        for row_idx, row in enumerate(cells):
            for col_idx, cell in enumerate(row):
                cell_text = ''
                if isinstance(cell, dict):
                    cell_text = cell.get('text', cell.get('content', ''))
                elif isinstance(cell, str):
                    cell_text = cell
                
                if cell_text:
                    matches = list(gap_regex.finditer(cell_text))
                    for match in matches:
                        num_total += 1
                        gap_number = match.group(1)
                        gap_key = f"r{row_idx}c{col_idx}__gap{gap_number}"
                        listening_key = f"{question_id}__r{row_idx}c{col_idx}__gap{gap_number}"
                        
                        correct_val = ''
                        if extra_data and 'answers' in extra_data:
                            correct_val = extra_data['answers'].get(gap_number, '')
                            if not isinstance(correct_val, str):
                                correct_val = ''
                        if not correct_val:
                            try:
                                if question_id:
                                    from .models import ListeningQuestion, ReadingQuestion
                                    try:
                                        question = ListeningQuestion.objects.get(id=question_id)
                                    except:
                                        try:
                                            question = ReadingQuestion.objects.get(id=question_id)
                                        except:
                                            question = None
                                    
                                    if question and question.gaps and isinstance(question.gaps, list):
                                        correct_gap = next((g for g in question.gaps if str(g.get('number', '')) == gap_number), None)
                                        if correct_gap:
                                            correct_val = correct_gap.get('answer', '')
                                    elif question and question.extra_data and 'gaps' in question.extra_data:
                                        correct_gap = next((g for g in question.extra_data['gaps'] if str(g.get('number', '')) == gap_number), None)
                                        if correct_gap:
                                            correct_val = correct_gap.get('answer', '')
                            except:
                                pass
                        
                        user_val = ''
                        if is_listening_format:
                            question_id_str = str(question_id)
                            possible_keys = [
                                listening_key,
                                f"{question_id_str}__r{row_idx}c{col_idx}__gap{gap_number}",
                                f"{question_id}__r{row_idx}c{col_idx}__gap{gap_number}",
                            ]
                            for key in possible_keys:
                                if all_user_answers and key in all_user_answers:
                                    user_val = all_user_answers.get(key, '')
                                    if user_val:
                                        break
                            if not user_val and all_user_answers:
                                for key in all_user_answers.keys():
                                    if isinstance(key, str) and key.endswith(f"__r{row_idx}c{col_idx}__gap{gap_number}"):
                                        user_val = all_user_answers.get(key, '')
                                        if user_val:
                                            break
                        else:
                            question_answers = all_user_answers.get(str(question_id), {}) if all_user_answers else {}
                            if isinstance(question_answers, dict):
                                user_val = question_answers.get(gap_key, '')
                        
                        if check_alternative_answers(user_val, correct_val):
                            num_correct += 1
                elif isinstance(cell, dict) and cell.get('isAnswer'):
                    num_total += 1
                    correct_val = cell.get('answer', '')
                    key = f"{question_id}__r{row_idx}c{col_idx}"
                    user_val = all_user_answers.get(key, '') if all_user_answers else ''
                    if check_alternative_answers(user_val, correct_val):
                        num_correct += 1
                elif isinstance(cell, dict) and cell.get('type') == 'gap':
                    num_total += 1
                    correct_val = cell.get('answer', '')
                    key = f"{question_id}__r{row_idx}c{col_idx}"
                    question_answers = all_user_answers.get(str(question_id), {}) if all_user_answers else {}
                    if isinstance(question_answers, dict):
                        user_val = question_answers.get(f"r{row_idx}c{col_idx}", '')
                    else:
                        user_val = all_user_answers.get(key, '') if all_user_answers else ''
                    if check_alternative_answers(user_val, correct_val):
                        num_correct += 1
        return num_correct, num_total
    # MULTIPLE RESPONSE
    if question_type in ['multiple_response', 'checkbox', 'multi_select']:
        correct_labels = set()
        option_points = {}
        
        # Получаем информацию о режиме подсчета и баллах за опции
        scoring_mode = extra_data.get('scoring_mode', 'total') if extra_data else 'total'
        
        if options and all(hasattr(o, 'label') for o in options):
            for o in options:
                label = getattr(o, 'label', None)
                text = getattr(o, 'text', None)
                points = getattr(o, 'points', 1)
                # Проверяем, является ли эта опция правильной
                if isinstance(correct_answers, list) and (text in correct_answers or label in correct_answers):
                    correct_labels.add(normalize_answer(label))
                    option_points[normalize_answer(label)] = points
        elif isinstance(correct_answers, list):
            for label in correct_answers:
                correct_labels.add(normalize_answer(label))
                option_points[normalize_answer(label)] = 1  # По умолчанию 1 балл
        
        user_selected = set()
        extra_selected = set()
        
        # Поддерживаем два формата ответов:
        # 1. Listening формат: {question_id}__{option.label} = true/false
        # 2. Reading формат: {question_id} = ['text1', 'text2']
        
        reading_format_answer = all_user_answers.get(str(question_id))
        if isinstance(reading_format_answer, list):
            # Reading формат: список выбранных текстов опций
            for o in (options or []):
                label = getattr(o, 'label', None)
                text = getattr(o, 'text', None)
                if text in reading_format_answer:
                    if label and label in [lbl.strip() for lbl in correct_answers]:
                        user_selected.add(normalize_answer(label))
                    elif label:
                        extra_selected.add(normalize_answer(label))
        else:
            # Listening формат: ищем по ключам {question_id}__{label}
            for label in correct_labels:
                key = f"{question_id}__{label}"
                user_val = all_user_answers.get(key, False)
                if user_val is True or user_val == "true" or user_val == label:
                    user_selected.add(normalize_answer(label))
        
        for k, v in (all_user_answers or {}).items():
            if k.startswith(f"{question_id}__") and v:
                sub = k.split("__", 1)[1]
                if sub not in correct_labels:
                    extra_selected.add(sub)
        
        # Новая логика подсчета баллов
        if scoring_mode == 'total':
            # Старая логика: 1 балл за весь вопрос
            num_total = 1
            num_correct = 1 if user_selected == correct_labels and not extra_selected else 0
        else:
            # Новая логика: баллы за каждый правильный ответ
            num_total = len(correct_labels)
            num_correct = 0
            for answer in user_selected:
                if answer in correct_labels:
                    points_for_answer = option_points.get(answer, 1)
                    num_correct += points_for_answer
        
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
        
        if user_val is True or user_val == 'true' or user_val == correct_label:
            return 1, 1
        return 0, 1
    # MATCHING (если потребуется)
    # ... аналогично ...
    return 0, 0

class ListeningTestSessionHistorySerializer(serializers.ModelSerializer):
    test_title = serializers.CharField(source='test.title', read_only=True)
    time_taken = serializers.SerializerMethodField()

    # Поля, которые будут заполняться централизованно
    raw_score = serializers.IntegerField(read_only=True)
    total_score = serializers.IntegerField(read_only=True)
    band_score = serializers.FloatField(read_only=True)

    class Meta:
        model = ListeningTestSession
        fields = [
            'id', 'test_title', 'band_score', 'raw_score', 'total_score',
            'submitted', 'completed_at', 'time_taken', 'is_diagnostic'
        ]

    def get_time_taken(self, obj):
        if obj.completed_at and obj.started_at:
            return (obj.completed_at - obj.started_at).total_seconds()
        return getattr(obj, 'time_taken', 0) or 0

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        
        try:
            result = getattr(instance, 'listeningtestresult', None)
            if result:
                representation['raw_score'] = result.raw_score
                representation['total_score'] = instance.total_questions_count or 0
                representation['band_score'] = result.band_score
            else:
                results = create_listening_detailed_breakdown(instance)
                representation['raw_score'] = results.get('raw_score', 0)
                representation['total_score'] = results.get('total_score', 0)
                representation['band_score'] = results.get('band_score', 0)
        except Exception:
            results = create_listening_detailed_breakdown(instance)
            representation['raw_score'] = results.get('raw_score', 0)
            representation['total_score'] = results.get('total_score', 0)
            representation['band_score'] = results.get('band_score', 0)
        
        return representation


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
        fields = ['id', 'label', 'text', 'points']

class ListeningQuestionSerializer(serializers.ModelSerializer):
    options = ListeningAnswerOptionSerializer(many=True, required=False, allow_null=True, read_only=True)
    question_type = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    question_text = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    extra_data = serializers.JSONField(required=False, allow_null=True)
    correct_answers = serializers.ListField(required=False, allow_null=True)
    header = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    instruction = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    image = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    image_file = serializers.ImageField(write_only=True, required=False, allow_null=True)
    image_base64 = serializers.CharField(write_only=True, required=False, allow_blank=True)
    points = serializers.IntegerField(required=False, allow_null=True)
    scoring_mode = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = ListeningQuestion
        fields = [
            'id', 'question_type', 'question_text', 'extra_data', 'correct_answers',
            'header', 'instruction', 'task_prompt', 'image', 'image_file', 'image_base64', 'points', 'scoring_mode', 'options'
        ]

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if instance.image_file:
            try:
                from django.core.files.storage import default_storage
                from django.conf import settings
                url = instance.image_file.url
                if not url:
                    representation['image'] = instance.image or None
                elif url.startswith('http://') or url.startswith('https://'):
                    representation['image'] = url
                elif url.startswith(settings.MEDIA_URL):
                    representation['image'] = url
                elif url.startswith('/'):
                    representation['image'] = url
                else:
                    representation['image'] = default_storage.url(instance.image_file.name)
            except (ValueError, AttributeError) as e:
                representation['image'] = instance.image or None
        else:
            representation['image'] = instance.image or None
        return representation

    def update(self, instance, validated_data):
        image_file = validated_data.pop('image_file', None)
        image_base64 = validated_data.pop('image_base64', None)
        should_update_image = False
        new_image_file = None
        
        if image_base64 not in [None, '', 'null']:
            decoded = decode_base64_file(image_base64)
            if decoded:
                new_image_file = decoded
                should_update_image = True
        elif image_base64 in ['', 'null']:
            new_image_file = None
            should_update_image = True
        elif image_file is not None:
            new_image_file = image_file
            should_update_image = True
        elif 'image' in validated_data and validated_data['image'] in [None, '', 'null']:
            new_image_file = None
            should_update_image = True
        
        if should_update_image:
            # Удаляем старый файл перед присваиванием нового
            if instance.image_file:
                try:
                    instance.image_file.delete(save=False)
                except Exception:
                    pass
            instance.image_file = new_image_file
            if 'image' in validated_data and not validated_data['image']:
                validated_data.pop('image', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

class ListeningPartSerializer(serializers.ModelSerializer):
    questions = ListeningQuestionSerializer(many=True, read_only=True)
    audio = serializers.SerializerMethodField()
    
    class Meta:
        model = ListeningPart
        fields = [
            'id', 'part_number', 'audio', 'audio_duration', 'instructions', 'questions'
        ]
    
    def get_audio(self, obj):
        if obj.audio:
            from django.core.files.storage import default_storage
            from django.conf import settings
            # If audio path already contains MEDIA_URL, don't add it again
            if obj.audio.startswith(settings.MEDIA_URL):
                return obj.audio
            return default_storage.url(obj.audio)
        return None
    
    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if 'questions' in representation and representation['questions']:
            representation['questions'] = sorted(
                representation['questions'],
                key=lambda x: x.get('order', 0)
            )
        return representation

# --- Вложенные сериализаторы для записи ListeningTest ---
class ListeningQuestionWriteSerializer(serializers.ModelSerializer):
    options = serializers.ListField(child=serializers.DictField(), required=False, allow_null=True, default=list)
    image_file = serializers.ImageField(write_only=True, required=False, allow_null=True)
    image_base64 = serializers.CharField(write_only=True, required=False, allow_blank=True)
    class Meta:
        model = ListeningQuestion
        fields = [
            'id', 'order', 'question_type', 'question_text', 'extra_data', 'correct_answers',
            'header', 'instruction', 'task_prompt', 'image', 'image_file', 'image_base64', 'points', 'scoring_mode', 'options'
        ]

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if instance.image_file:
            try:
                from django.core.files.storage import default_storage
                from django.conf import settings
                url = instance.image_file.url
                if not url:
                    representation['image'] = instance.image or None
                elif url.startswith('http://') or url.startswith('https://'):
                    representation['image'] = url
                elif url.startswith(settings.MEDIA_URL):
                    representation['image'] = url
                elif url.startswith('/'):
                    representation['image'] = url
                else:
                    representation['image'] = default_storage.url(instance.image_file.name)
            except (ValueError, AttributeError) as e:
                representation['image'] = instance.image or None
        else:
            representation['image'] = instance.image or None
        if hasattr(instance, 'options'):
            options_qs = instance.options.all()
            representation['options'] = [
                {
                    'id': opt.id,
                    'label': opt.label,
                    'text': opt.text,
                    'points': opt.points
                }
                for opt in options_qs
            ]
        return representation

class ListeningPartWriteSerializer(serializers.ModelSerializer):
    questions = ListeningQuestionWriteSerializer(many=True, required=False)
    class Meta:
        model = ListeningPart
        fields = [
            'id', 'part_number', 'audio', 'audio_duration', 'instructions', 'questions'
        ]

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if 'questions' in representation and representation['questions']:
            representation['questions'] = sorted(
                representation['questions'],
                key=lambda x: x.get('order', 0)
            )
        return representation

# --- Сериализатор для чтения ListeningTest (GET) ---
class ListeningTestReadSerializer(serializers.ModelSerializer):
    parts = ListeningPartSerializer(many=True, read_only=True)
    class Meta:
        model = ListeningTest
        fields = [
            'id', 'title', 'description', 'is_active', 'is_diagnostic_template', 'explanation_url', 'parts', 'created_at', 'updated_at'
        ]
    
    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if 'parts' in representation and representation['parts']:
            representation['parts'] = sorted(
                representation['parts'],
                key=lambda x: x.get('part_number', 0)
            )
        return representation

# --- Основной сериализатор ListeningTest (POST/PUT) ---
class ListeningTestSerializer(serializers.ModelSerializer):
    parts = ListeningPartWriteSerializer(many=True, required=False)
    class Meta:
        model = ListeningTest
        fields = [
            'id', 'title', 'description', 'is_active', 'is_diagnostic_template', 'explanation_url', 'parts', 'created_at', 'updated_at'
        ]

    def _filter_and_validate_options(self, options_data):
        filtered = []
        for opt in options_data:
            text = opt.get('text')
            if not text or (isinstance(text, str) and not text.strip()):
                continue
            if isinstance(text, list):
                raise serializers.ValidationError({'options': 'Option text must be a string, not a list.'})
            filtered.append(opt)
        return filtered

    def _filter_and_validate_questions(self, questions_data):
        filtered = []
        for q in questions_data:
            if not isinstance(q, dict):
                continue
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
            questions_data = part_data.pop('questions', [])
            part = ListeningPart.objects.create(test=test, **part_data)
            for question_data in questions_data:
                options_data = question_data.pop('options', [])
                image_file = question_data.pop('image_file', serializers.empty)
                image_base64 = question_data.pop('image_base64', None)
                new_image_file = serializers.empty
                if image_base64 not in [None, '', 'null']:
                    decoded = decode_base64_file(image_base64)
                    if decoded:
                        new_image_file = decoded
                elif image_base64 in ['', 'null']:
                    new_image_file = None
                elif image_file is not serializers.empty:
                    new_image_file = image_file
                image = question_data.get('image', None)
                if not image:
                    question_data['image'] = None
                question = ListeningQuestion.objects.create(part=part, **question_data)
                if new_image_file is not serializers.empty:
                    question.image_file = new_image_file
                    question.save()
                for idx, option_data in enumerate(options_data):
                    label = option_data.get('label') or chr(65 + idx)
                    text = option_data.get('text', '')
                    points = option_data.get('points', 1)
                    try:
                        ListeningAnswerOption.objects.create(question=question, label=label, text=text, points=points)
                    except Exception as e:
                        continue
        return test

    def update(self, instance, validated_data):
        parts_data = validated_data.pop('parts', [])
        instance.title = validated_data.get('title', instance.title)
        instance.description = validated_data.get('description', instance.description)
        instance.is_active = validated_data.get('is_active', instance.is_active)
        instance.is_diagnostic_template = validated_data.get('is_diagnostic_template', instance.is_diagnostic_template)
        instance.explanation_url = validated_data.get('explanation_url', instance.explanation_url)
        instance.save()

        existing_parts = {p.id: p for p in instance.parts.all()}
        sent_part_ids = set()
        for part_data in parts_data:
            part_id = part_data.get('id')
            part_number = part_data.get('part_number')
            questions_data = part_data.pop('questions', [])
            part_data_copy = {k: v for k, v in part_data.items() if k not in ['questions', 'test', 'id']}
            part = None
            if part_id:
                part = existing_parts.get(part_id)
            if part:
                sent_part_ids.add(part.id)
                for attr, value in part_data_copy.items():
                    setattr(part, attr, value)
                part.save()
            else:
                part = ListeningPart.objects.create(test=instance, **part_data_copy)
                sent_part_ids.add(part.id)
            existing_questions = {q.id: q for q in part.questions.all()}
            sent_question_ids = set()
            for question_data in questions_data:
                order = question_data.get('order')
                options_data = question_data.pop('options', [])
                image_file = question_data.pop('image_file', serializers.empty)
                image_base64 = question_data.pop('image_base64', None)
                should_update_image = False
                new_image_file = serializers.empty
                if image_base64 not in [None, '', 'null']:
                    decoded = decode_base64_file(image_base64)
                    if decoded:
                        new_image_file = decoded
                        should_update_image = True
                elif image_base64 in ['', 'null']:
                    new_image_file = None
                    should_update_image = True
                elif image_file is not serializers.empty:
                    new_image_file = image_file
                    should_update_image = True
                image = question_data.get('image', None)
                if not image:
                    question_data['image'] = None
                question_id = question_data.pop('id', None)
                question = None
                if question_id is not None:
                    question = existing_questions.get(question_id)
                if question:
                    sent_question_ids.add(question.id)
                    for attr, value in question_data.items():
                        setattr(question, attr, value)
                    if should_update_image:
                        # Удаляем старый файл перед присваиванием нового
                        if question.image_file:
                            try:
                                question.image_file.delete(save=False)
                            except Exception:
                                pass
                        question.image_file = new_image_file if new_image_file is not serializers.empty else None
                    question.save()
                else:
                    question = ListeningQuestion.objects.create(part=part, **question_data)
                    sent_question_ids.add(question.id)
                    if should_update_image:
                        question.image_file = new_image_file if new_image_file is not serializers.empty else None
                        question.save()
                existing_options = {o.label: o for o in question.options.all()}
                sent_option_labels = set()
                for idx, option_data in enumerate(options_data):
                    label = option_data.get('label') or chr(65 + idx)
                    sent_option_labels.add(label)
                    option_data = dict(option_data)
                    option_data.pop('label', None)
                    option_data.pop('id', None)
                    option_data.pop('isCorrect', None)
                    try:
                        option, created = question.options.get_or_create(label=label, defaults={**option_data, 'question': question})
                        if not created:
                            for attr, value in option_data.items():
                                setattr(option, attr, value)
                            option.save()
                    except Exception as e:
                        continue
                for label, option in existing_options.items():
                    if label not in sent_option_labels:
                        option.delete()
            for question_id, question in existing_questions.items():
                if question_id not in sent_question_ids:
                    question.delete()
        for part_id, part in existing_parts.items():
            if part_id not in sent_part_ids:
                part.delete()
        return instance

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if 'parts' in representation and representation['parts']:
            representation['parts'] = sorted(
                representation['parts'],
                key=lambda x: x.get('part_number', 0)
            )
        return representation


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
    assigned_teacher = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role='teacher'), allow_null=True, required=False
    )
    class Meta:
        model = User
        fields = [
            'id', 'uid', 'role', 'student_id', 'curator_id', 'first_name', 'last_name', 'email', 'group', 'teacher', 'assigned_teacher',
            'is_active', 'is_staff', 'is_superuser'
        ]
        read_only_fields = ['id', 'uid', 'is_active', 'is_staff', 'is_superuser']

# --- READING SERIALIZERS ---

class ReadingAnswerOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReadingAnswerOption
        fields = ['id', 'text', 'is_correct', 'label', 'reading_points']

# --- READ-ONLY (for GET requests) ---

class ReadingQuestionSerializer(serializers.ModelSerializer):
    answer_options = ReadingAnswerOptionSerializer(many=True, read_only=True)
    image_file = serializers.ImageField(write_only=True, required=False, allow_null=True)
    image_base64 = serializers.CharField(write_only=True, required=False, allow_blank=True)
    class Meta:
        model = ReadingQuestion
        fields = [
            'id', 'order', 'question_type', 'header', 'instruction', 'task_prompt',
            'image_url', 'image_file', 'image_base64', 'question_text', 'points', 'correct_answers', 'extra_data', 'answer_options',
            'reading_scoring_type'
        ]

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if instance.image_file:
            try:
                representation['image_url'] = instance.image_file.url
            except ValueError:
                representation['image_url'] = instance.image_url or None
        else:
            representation['image_url'] = instance.image_url or None
        return representation

    def update(self, instance, validated_data):
        image_file = validated_data.pop('image_file', None)
        image_base64 = validated_data.pop('image_base64', None)
        if image_base64 not in [None, '', 'null']:
            decoded = decode_base64_file(image_base64)
            if decoded:
                instance.image_file = decoded
        elif image_base64 in ['', 'null']:
            instance.image_file = None
        if image_file is not None:
            instance.image_file = image_file
            if 'image_url' in validated_data and not validated_data['image_url']:
                validated_data.pop('image_url', None)
        elif 'image_url' in validated_data and validated_data['image_url'] in [None, '', 'null']:
            instance.image_file = None
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

class ReadingPartSerializer(serializers.ModelSerializer):
    questions = ReadingQuestionSerializer(many=True, read_only=True)
    class Meta:
        model = ReadingPart
        fields = [
            'id', 'part_number', 'title', 'instructions', 'passage_text', 
            'passage_heading', 'passage_image_url', 'order', 'questions'
        ]

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation['passage_image_url'] = instance.passage_image_url or None
        return representation

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

class ReadingTestReadSerializer(serializers.ModelSerializer):
    parts = ReadingPartSerializer(many=True, read_only=True)
    
    class Meta:
        model = ReadingTest
        fields = [
            'id', 'title', 'description', 'time_limit', 
            'total_points', 'is_active', 'is_diagnostic_template', 'explanation_url', 'created_at', 'parts'
        ]
    
    def to_representation(self, instance):
        representation = super().to_representation(instance)
        # Ensure parts are ordered by part_number as fallback when order values are the same
        if 'parts' in representation and representation['parts']:
            representation['parts'] = sorted(
                representation['parts'], 
                key=lambda x: (x.get('order', 0), x.get('part_number', 0))
            )
        return representation

# --- WRITE-ONLY (for POST/PUT/PATCH requests) ---

class ReadingQuestionWriteSerializer(serializers.ModelSerializer):
    answer_options = serializers.ListField(child=serializers.DictField(), required=False, allow_null=True, default=list)
    image_file = serializers.ImageField(write_only=True, required=False, allow_null=True)
    image_base64 = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    class Meta:
        model = ReadingQuestion
        fields = [
            'id', 'order', 'question_type', 'header', 'instruction', 'task_prompt',
            'image_url', 'image_file', 'image_base64', 'question_text', 'points', 'correct_answers', 'extra_data', 'answer_options',
            'reading_scoring_type'
        ]
        extra_kwargs = {
            'id': {'read_only': False, 'required': False},
        }

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if instance.image_file:
            try:
                representation['image_url'] = instance.image_file.url
            except ValueError:
                representation['image_url'] = instance.image_url or None
        else:
            representation['image_url'] = instance.image_url or None
        return representation

class ReadingPartWriteSerializer(serializers.ModelSerializer):
    questions = ReadingQuestionWriteSerializer(many=True, required=False)
    class Meta:
        model = ReadingPart
        fields = [
            'id', 'part_number', 'title', 'instructions', 'passage_text', 
            'passage_heading', 'passage_image_url', 'order', 'questions'
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
            'is_active', 'is_diagnostic_template', 'explanation_url', 'parts'
        ]
    
    def create(self, validated_data):
        parts_data = validated_data.pop('parts', [])
        test = ReadingTest.objects.create(**validated_data)
        for part_data in parts_data:
            if not isinstance(part_data, dict):
                continue
            questions_data = part_data.pop('questions', []) if 'questions' in part_data else []
            part = ReadingPart.objects.create(test=test, **part_data)
            for question_data in questions_data:
                answer_options_data = question_data.pop('answer_options', []) if 'answer_options' in question_data else []
                image_file = question_data.pop('image_file', serializers.empty)
                image_base64 = question_data.pop('image_base64', None)
                if image_base64 not in [None, '', 'null']:
                    decoded_question = decode_base64_file(image_base64)
                    if decoded_question:
                        image_file = decoded_question
                elif image_base64 in ['', 'null']:
                    image_file = None
                try:
                    question = ReadingQuestion.objects.create(part=part, **question_data)
                    if image_file is not serializers.empty:
                        question.image_file = image_file or None
                        question.save()
                except Exception:
                    continue
                for option_data in answer_options_data:
                    option_data.pop('image_file', None)
                    option_data.pop('image_base64', None)
                    try:
                        ReadingAnswerOption.objects.create(question=question, **option_data)
                    except Exception:
                        continue
        return test
 
    def update(self, instance, validated_data):
        parts_data = validated_data.pop('parts', None)
        instance.title = validated_data.get('title', instance.title)
        instance.description = validated_data.get('description', instance.description)
        instance.time_limit = validated_data.get('time_limit', instance.time_limit)
        instance.is_active = validated_data.get('is_active', instance.is_active)
        instance.is_diagnostic_template = validated_data.get('is_diagnostic_template', instance.is_diagnostic_template)
        instance.explanation_url = validated_data.get('explanation_url', instance.explanation_url)
        instance.save()
 
        if parts_data is not None:
            existing_parts = {p.part_number: p for p in instance.parts.all()}
            sent_part_numbers = set()
            for part_data in parts_data:
                if not isinstance(part_data, dict):
                    continue
                part_number = part_data.get('part_number')
                sent_part_numbers.add(part_number)
                questions_data = part_data.get('questions', []) if 'questions' in part_data else []
                part_data_copy = {k: v for k, v in part_data.items() if k not in ['questions', 'test']}
                part, created = instance.parts.get_or_create(part_number=part_number, defaults={**part_data_copy, 'test': instance})
                if not created:
                    for attr, value in part_data_copy.items():
                        if attr != 'part_number':
                            setattr(part, attr, value)
                    part.save()
                else:
                    part.save()
                existing_questions = {str(q.id): q for q in part.questions.all()}
                sent_question_ids = set()
                for question_data in questions_data:
                    if not isinstance(question_data, dict):
                        continue
                    q_id = str(question_data.get('id')) if question_data.get('id') else None
                    answer_options_data = question_data.pop('answer_options', []) if 'answer_options' in question_data else []
                    image_file = question_data.pop('image_file', serializers.empty)
                    image_base64 = question_data.pop('image_base64', None)
                    if image_base64 not in [None, '', 'null']:
                        decoded_question = decode_base64_file(image_base64)
                        if decoded_question:
                            image_file = decoded_question
                    elif image_base64 in ['', 'null']:
                        image_file = None
                    if q_id and q_id in existing_questions:
                        question = existing_questions[q_id]
                        sent_question_ids.add(q_id)
                        for attr, value in question_data.items():
                            setattr(question, attr, value)
                        if image_file is not serializers.empty:
                            question.image_file = image_file or None
                        question.save()
                        existing_options = {str(opt.id): opt for opt in question.answer_options.all()}
                        sent_option_ids = set()
                        for option_data in answer_options_data:
                            opt_id = str(option_data.get('id')) if option_data.get('id') else None
                            option_data.pop('image_file', None)
                            option_data.pop('image_base64', None)
                            if opt_id and opt_id in existing_options:
                                option = existing_options[opt_id]
                                sent_option_ids.add(opt_id)
                                for attr, value in option_data.items():
                                    setattr(option, attr, value)
                                option.save()
                            else:
                                new_option = ReadingAnswerOption.objects.create(question=question, **option_data)
                                sent_option_ids.add(str(new_option.id))
                        for opt_id, opt in existing_options.items():
                            if opt_id not in sent_option_ids:
                                opt.delete()
                    else:
                        question = ReadingQuestion.objects.create(part=part, **question_data)
                        if image_file is not serializers.empty:
                            question.image_file = image_file or None
                            question.save()
                        sent_question_ids.add(str(question.id))
                        for option_data in answer_options_data:
                            option_data.pop('image_file', None)
                            option_data.pop('image_base64', None)
                            ReadingAnswerOption.objects.create(question=question, **option_data)
                for q_id, question in existing_questions.items():
                    if q_id not in sent_question_ids:
                        question.delete()
            for part_number, part in existing_parts.items():
                if part_number not in sent_part_numbers:
                    part.delete()
 
        return instance

class ReadingTestSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReadingTestSession
        fields = [
            'id', 'user', 'test', 'start_time', 'end_time', 
            'completed', 'answers', 'time_left_seconds', 'is_diagnostic'
        ]


def count_correct_subanswers(user_answer, correct_answers, question_type, extra_data=None, all_user_answers=None, question_id=None, options=None, points=1):
    """Helper function to count correct subanswers"""
    pass  # Implementation here if needed

class ReadingTestResultSerializer(serializers.ModelSerializer):
    correct_answers_text = serializers.SerializerMethodField()
    test_render_structure = serializers.SerializerMethodField()
    explanation_url = serializers.CharField(source='session.test.explanation_url', read_only=True)
    
    class Meta:
        model = ReadingTestResult
        fields = [
            'id', 'session', 'raw_score', 'total_score', 'band_score', 
            'breakdown', 'calculated_at', 'correct_answers_text', 'test_render_structure', 'explanation_url'
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

    def get_test_render_structure(self, instance):
        """Возвращает структуру для отображения в frontend"""
        try:
            return get_test_render_structure(None, instance.session)
        except Exception as e:
            return []

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        return representation

# --- Reading Test Result ---
# Removed duplicate ReadingTestResultSerializer - using the one above with correct_answers_text

# --- Teacher Feedback (Writing) ---

class TeacherFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeacherFeedback
        fields = [
            'id', 'essay', 'teacher', 'overall_feedback', 'annotations',
            'teacher_task_score', 'teacher_coherence_score', 'teacher_lexical_score', 
            'teacher_grammar_score', 'teacher_overall_score',
            'teacher_task_feedback', 'teacher_coherence_feedback', 'teacher_lexical_feedback', 'teacher_grammar_feedback',
            'published', 'created_at', 'updated_at', 'published_at'
        ]
        read_only_fields = ['id', 'teacher', 'created_at', 'updated_at', 'published_at']

class TeacherFeedbackUpsertSerializer(serializers.Serializer):
    overall_feedback = serializers.CharField(allow_blank=True, required=False, default='')
    annotations = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    
    # Teacher's IELTS scores - все поля необязательные
    teacher_task_score = serializers.FloatField(required=False, allow_null=True, min_value=0, max_value=9)
    teacher_coherence_score = serializers.FloatField(required=False, allow_null=True, min_value=0, max_value=9)
    teacher_lexical_score = serializers.FloatField(required=False, allow_null=True, min_value=0, max_value=9)
    teacher_grammar_score = serializers.FloatField(required=False, allow_null=True, min_value=0, max_value=9)
    
    # Feedback fields for each criterion
    teacher_task_feedback = serializers.CharField(allow_blank=True, required=False, default='')
    teacher_coherence_feedback = serializers.CharField(allow_blank=True, required=False, default='')
    teacher_lexical_feedback = serializers.CharField(allow_blank=True, required=False, default='')
    teacher_grammar_feedback = serializers.CharField(allow_blank=True, required=False, default='')

class TeacherEssayListItemSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    teacher_feedback = TeacherFeedbackSerializer(read_only=True)

    class Meta:
        model = Essay
        fields = [
            'id', 'task_type', 'question_text', 'submitted_text', 'submitted_at',
            'user', 'teacher_feedback'
        ]

class TeacherSatisfactionSurveySerializer(serializers.ModelSerializer):
    student_email = serializers.CharField(source='student.email', read_only=True)
    student_name = serializers.SerializerMethodField()
    
    class Meta:
        model = TeacherSatisfactionSurvey
        fields = ['id', 'student', 'student_email', 'student_name', 'is_satisfied', 'reason', 'submitted_at']
        read_only_fields = ['id', 'student', 'submitted_at']
    
    def get_student_name(self, obj):
        if obj.student.first_name and obj.student.last_name:
            return f"{obj.student.first_name} {obj.student.last_name}"
        return obj.student.email or obj.student.uid


# --- SPEAKING SERIALIZERS ---

class SpeakingSessionSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    teacher_name = serializers.SerializerMethodField()
    
    class Meta:
        model = SpeakingSession
        fields = [
            'id', 'student', 'teacher', 'student_name', 'student_id', 'teacher_name',
            'fluency_coherence_score', 'lexical_resource_score', 
            'grammatical_range_score', 'pronunciation_score', 'overall_band_score',
            'fluency_coherence_feedback', 'lexical_resource_feedback',
            'grammatical_range_feedback', 'pronunciation_feedback', 'overall_feedback',
            'duration_seconds', 'time_markers', 'session_notes',
            'completed', 'conducted_at', 'updated_at'
        ]
        read_only_fields = ['id', 'conducted_at', 'updated_at', 'overall_band_score']
    
    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}".strip()
    
    def get_teacher_name(self, obj):
        return f"{obj.teacher.first_name} {obj.teacher.last_name}".strip()
    
    def validate_fluency_coherence_score(self, value):
        if value is not None and (value < 0 or value > 9):
            raise serializers.ValidationError("Score must be between 0 and 9")
        return value
    
    def validate_lexical_resource_score(self, value):
        if value is not None and (value < 0 or value > 9):
            raise serializers.ValidationError("Score must be between 0 and 9")
        return value
    
    def validate_grammatical_range_score(self, value):
        if value is not None and (value < 0 or value > 9):
            raise serializers.ValidationError("Score must be between 0 and 9")
        return value
    
    def validate_pronunciation_score(self, value):
        if value is not None and (value < 0 or value > 9):
            raise serializers.ValidationError("Score must be between 0 and 9")
        return value


class SpeakingSessionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new speaking sessions"""
    
    class Meta:
        model = SpeakingSession
        fields = [
            'student', 'fluency_coherence_score', 'lexical_resource_score',
            'grammatical_range_score', 'pronunciation_score',
            'fluency_coherence_feedback', 'lexical_resource_feedback',
            'grammatical_range_feedback', 'pronunciation_feedback', 'overall_feedback',
            'duration_seconds', 'time_markers', 'session_notes', 'completed'
        ]
    
    def validate_student(self, value):
        """Ensure the student belongs to the requesting teacher"""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            teacher = request.user
            if teacher.role not in ['teacher', 'speaking_mentor']:
                raise serializers.ValidationError("Only teachers can create speaking sessions")
            
            if teacher.role == 'teacher':
                teacher_name = teacher.first_name or teacher.student_id
                if value.teacher != teacher_name:
                    raise serializers.ValidationError("Student does not belong to this teacher")
        
        return value


class SpeakingSessionUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating speaking sessions"""
    
    class Meta:
        model = SpeakingSession
        fields = [
            'fluency_coherence_score', 'lexical_resource_score',
            'grammatical_range_score', 'pronunciation_score',
            'fluency_coherence_feedback', 'lexical_resource_feedback',
            'grammatical_range_feedback', 'pronunciation_feedback', 'overall_feedback',
            'duration_seconds', 'time_markers', 'session_notes', 'completed'
        ]


class SpeakingSessionStudentSerializer(serializers.ModelSerializer):
    """Serializer for students viewing their speaking results"""
    teacher_name = serializers.SerializerMethodField()
    
    class Meta:
        model = SpeakingSession
        fields = [
            'id', 'teacher_name', 'fluency_coherence_score', 'lexical_resource_score',
            'grammatical_range_score', 'pronunciation_score', 'overall_band_score',
            'fluency_coherence_feedback', 'lexical_resource_feedback',
            'grammatical_range_feedback', 'pronunciation_feedback', 'overall_feedback',
            'conducted_at'
        ]
    
    def get_teacher_name(self, obj):
        return f"{obj.teacher.first_name} {obj.teacher.last_name}".strip()


class SpeakingSessionHistorySerializer(serializers.ModelSerializer):
    """Serializer for speaking session history (dashboard view)"""
    student_name = serializers.SerializerMethodField()
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    teacher_name = serializers.SerializerMethodField()
    
    class Meta:
        model = SpeakingSession
        fields = [
            'id', 'student_name', 'student_id', 'teacher_name', 'overall_band_score', 
            'conducted_at', 'completed'
        ]
    
    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}".strip()
    
    def get_teacher_name(self, obj):
        return f"{obj.teacher.first_name} {obj.teacher.last_name}".strip()


# === READING MULTIPLE RESPONSE SCORING FUNCTIONS ===

def get_reading_selected_options(question, user_answers):
    """Получить выбранные опции для Reading multiple_response из ответов пользователя"""
    reading_format_answer = user_answers.get(str(question.id))
    if isinstance(reading_format_answer, list):
        # Reading формат: список выбранных текстов опций
        selected_labels = set()
        for option in question.answer_options.all():
            if option.text in reading_format_answer:
                selected_labels.add(option.label)
        return selected_labels
    return set()


def calculate_reading_multiple_response_score(question, user_answers):
    """Главная функция для подсчета баллов Reading multiple_response"""
    if question.reading_scoring_type == 'all_or_nothing':
        return calculate_reading_all_or_nothing_score(question, user_answers)
    else:  # per_correct_option
        return calculate_reading_per_correct_option_score(question, user_answers)


def calculate_reading_all_or_nothing_score(question, user_answers):
    """Режим 'all_or_nothing': 1 балл только если выбраны ВСЕ правильные и НИ ОДНА неправильная"""
    correct_options = set(opt.label for opt in question.answer_options.filter(is_correct=True))
    selected_options = get_reading_selected_options(question, user_answers)
    
    # Проверяем, что выбраны ВСЕ правильные опции и НИ ОДНА неправильная
    if selected_options == correct_options:
        return question.points
    else:
        return 0


def calculate_reading_per_correct_option_score(question, user_answers):
    """Режим 'per_correct_option': баллы за каждую правильно выбранную опцию"""
    selected_options = get_reading_selected_options(question, user_answers)
    total_score = 0
    
    for option in question.answer_options.all():
        if option.label in selected_options and option.is_correct:
            total_score += option.reading_points
    
    return total_score


def get_reading_multiple_response_breakdown(question, user_answers):
    """Получить детальную информацию о баллах для Reading multiple_response"""
    selected_options = get_reading_selected_options(question, user_answers)
    correct_options = set(opt.label for opt in question.answer_options.filter(is_correct=True))
    
    breakdown = {
        'selected_options': list(selected_options),
        'correct_options': list(correct_options),
        'scoring_mode': question.reading_scoring_type,
        'total_score': 0,
        'max_score': 0,
        'option_details': []
    }
    
    if question.reading_scoring_type == 'all_or_nothing':
        breakdown['max_score'] = question.points
        if selected_options == correct_options:
            breakdown['total_score'] = question.points
        
        # Создаем option_details для режима all_or_nothing
        for option in question.answer_options.all():
            is_selected = option.label in selected_options
            is_correct = option.is_correct
            
            breakdown['option_details'].append({
                'label': option.label,
                'text': option.text,
                'is_correct_option': is_correct,
                'student_selected': is_selected,
                'points': question.points,  # В режиме all_or_nothing все опции имеют одинаковые баллы
                'points_earned': 0  # Баллы начисляются только за весь вопрос целиком
            })
    else:  # per_correct_option
        # Сначала считаем max_score (сумма всех правильных опций)
        for option in question.answer_options.all():
            if option.is_correct:
                breakdown['max_score'] += option.reading_points
        
        # Затем создаем option_details
        for option in question.answer_options.all():
            is_selected = option.label in selected_options
            is_correct = option.is_correct
            points_earned = 0
            
            if is_selected and is_correct:
                points_earned = option.reading_points
            
            breakdown['option_details'].append({
                'label': option.label,
                'text': option.text,
                'is_correct_option': is_correct,
                'student_selected': is_selected,
                'points': option.reading_points,
                'points_earned': points_earned
            })
        
        breakdown['total_score'] = sum(detail['points_earned'] for detail in breakdown['option_details'])
    
    return breakdown
