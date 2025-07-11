from rest_framework import serializers
from .models import ReadingTest, ReadingQuestion, AnswerOption, AnswerKey, Essay, WritingPrompt, ReadingPassage, ReadingTestSession, User, ListeningTestSession, ListeningTest, ListeningPart, ListeningQuestion, ListeningAnswerOption, ListeningTestResult, ListeningTestClone, ListeningStudentAnswer
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

class AnswerOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnswerOption
        fields = ['label', 'text']


class ReadingQuestionSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    options = AnswerOptionSerializer(many=True, read_only=True)
    correct_answer = serializers.SerializerMethodField()

    class Meta:
        model = ReadingQuestion
        fields = ['id', 'order', 'question_type', 'question_text', 'paragraph_ref', 'options', 'image', 'correct_answer']

    def get_image(self, obj):
        request = self.context.get('request', None)
        if obj.image and hasattr(obj.image, 'url'):
            if request is not None:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

    def get_correct_answer(self, obj):
        try:
            return AnswerKey.objects.get(question=obj).correct_answer
        except AnswerKey.DoesNotExist:
            return None


class ReadingPassageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReadingPassage
        fields = ['text', 'created_at', 'updated_at']


class ReadingTestSessionSerializer(serializers.ModelSerializer):
    test_title = serializers.CharField(source='test.title', read_only=True)
    student_id = serializers.CharField(source='user.student_id', read_only=True)
    
    class Meta:
        model = ReadingTestSession
        fields = ['id', 'test', 'test_title', 'student_id', 'started_at', 'completed_at', 
                 'time_taken', 'band_score', 'raw_score', 'completed', 'answers']
        read_only_fields = ['user', 'started_at', 'completed_at', 'band_score', 'raw_score', 'completed']


class ReadingTestListSerializer(serializers.ModelSerializer):
    has_attempted = serializers.SerializerMethodField()
    is_active = serializers.BooleanField()

    class Meta:
        model = ReadingTest
        fields = ['id', 'title', 'description', 'has_attempted', 'is_active']

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
                        return ReadingTestSession.objects.filter(
                            test=obj,
                            user=user,
                            completed=True
                        ).exists()
                    except User.DoesNotExist:
                        pass
        return False


class ReadingTestDetailSerializer(serializers.ModelSerializer):
    questions = ReadingQuestionSerializer(many=True, read_only=True)
    passage = ReadingPassageSerializer(read_only=True)
    time_limit = serializers.IntegerField(default=60)   
    is_active = serializers.BooleanField()

    class Meta:
        model = ReadingTest
        fields = ['id', 'title', 'description', 'questions', 'passage', 'time_limit', 'is_active']

class WritingPromptSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(allow_null=True, required=False)
    class Meta:
        model = WritingPrompt
        fields = ['id', 'task_type', 'prompt_text', 'created_at', 'image', 'is_active']

class AnswerOptionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnswerOption
        fields = ['label', 'text']

class ReadingQuestionCreateSerializer(serializers.ModelSerializer):
    image = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    options = AnswerOptionCreateSerializer(many=True, required=False)
    correct_answer = serializers.CharField(allow_blank=True, required=False)

    class Meta:
        model = ReadingQuestion
        fields = ['question_type', 'question_text', 'order', 'options', 'image', 'correct_answer']

class ReadingTestCreateSerializer(serializers.ModelSerializer):
    questions = ReadingQuestionCreateSerializer(many=True)
    passage = serializers.CharField(write_only=True, required=False)
    passage_text = serializers.CharField(source='passage.text', read_only=True)

    class Meta:
        model = ReadingTest
        fields = ['id', 'title', 'description', 'questions', 'passage', 'passage_text', 'time_limit']
        extra_kwargs = {
            'time_limit': {'required': False, 'default': 60}
        }

    def create(self, validated_data):
        questions_data = validated_data.pop('questions')
        passage_text = validated_data.pop('passage')
        test = ReadingTest.objects.create(**validated_data)
        ReadingPassage.objects.create(test=test, text=passage_text)
        for q_data in questions_data:
            options_data = q_data.pop('options', [])
            image = q_data.pop('image', None)
            correct_answer = q_data.pop('correct_answer', None)
            question = ReadingQuestion.objects.create(test=test, image=image, **q_data)
            for opt_data in options_data:
                AnswerOption.objects.create(question=question, **opt_data)
            if correct_answer:
                AnswerKey.objects.create(question=question, correct_answer=correct_answer)
        return test

    def update(self, instance, validated_data):
    
        instance.title = validated_data.get('title', instance.title)
        instance.description = validated_data.get('description', instance.description)
        instance.time_limit = validated_data.get('time_limit', instance.time_limit)
        
       
        passage_text = validated_data.get('passage')
        if passage_text:
            if hasattr(instance, 'passage'):
                instance.passage.text = passage_text
                instance.passage.save()
            else:
                ReadingPassage.objects.create(test=instance, text=passage_text)

        instance.save()

       
        questions_data = validated_data.get('questions', [])
        question_ids = [q_data.get('id') for q_data in questions_data if q_data.get('id')]

        
        for question in instance.questions.all():
            if question.id not in question_ids:
                question.delete()

        for q_data in questions_data:
            question_id = q_data.get('id')
            options_data = q_data.pop('options', [])
            correct_answer = q_data.pop('correct_answer', None)

            if question_id:
                
                question = ReadingQuestion.objects.get(id=question_id, test=instance)
                question.question_type = q_data.get('question_type', question.question_type)
                question.question_text = q_data.get('question_text', question.question_text)
                question.order = q_data.get('order', question.order)
                question.save()
            else:
                
                question = ReadingQuestion.objects.create(test=instance, **q_data)

            
            if correct_answer is not None:
                AnswerKey.objects.update_or_create(question=question, defaults={'correct_answer': correct_answer})

            
            option_ids = [opt.get('id') for opt in options_data if opt.get('id')]
            for option in question.options.all():
                if option.id not in option_ids:
                    option.delete()
            
            for opt_data in options_data:
                option_id = opt_data.get('id')
                if option_id:
                    option = AnswerOption.objects.get(id=option_id, question=question)
                    option.label = opt_data.get('label', option.label)
                    option.text = opt_data.get('text', option.text)
                    option.save()

        return instance

class ReadingQuestionUpdateSerializer(serializers.ModelSerializer):
    image = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    options = AnswerOptionCreateSerializer(many=True, required=False)
    correct_answer = serializers.CharField(allow_blank=True, required=False)

    class Meta:
        model = ReadingQuestion
        fields = ['question_type', 'question_text', 'order', 'options', 'image', 'correct_answer']

    def update(self, instance, validated_data):
        correct_answer = validated_data.pop('correct_answer', None)
        instance = super().update(instance, validated_data)
        if correct_answer is not None:
            AnswerKey.objects.update_or_create(question=instance, defaults={'correct_answer': correct_answer})
        return instance

class ReadingTestSessionResultSerializer(serializers.ModelSerializer):
    test_title = serializers.CharField(source='test.title', read_only=True)
    student_id = serializers.CharField(source='user.student_id', read_only=True)
    correct_answers = serializers.SerializerMethodField()
    total_questions = serializers.SerializerMethodField()
    question_feedback = serializers.SerializerMethodField()
    time_taken = serializers.SerializerMethodField()

    class Meta:
        model = ReadingTestSession
        fields = [
            'id', 'test', 'test_title', 'student_id', 'started_at', 'completed_at',
            'time_taken', 'band_score', 'raw_score', 'completed', 'answers',
            'correct_answers', 'total_questions', 'question_feedback'
        ]
        read_only_fields = ['user', 'started_at', 'completed_at', 'band_score', 'raw_score', 'completed']

    def get_correct_answers(self, obj):
        correct = 0
        for q in obj.test.questions.all():
            user_answer = obj.answers.get(f"{q.id}__", '').strip().upper()
            try:
                correct_answer = AnswerKey.objects.get(question=q).correct_answer.strip().upper()
                if user_answer == correct_answer:
                    correct += 1
            except AnswerKey.DoesNotExist:
                continue
        return correct

    def get_total_questions(self, obj):
        return obj.test.questions.count()

    def get_question_feedback(self, obj):
        feedback = []
        for question in obj.test.questions.all():
            user_answer_text = obj.answers.get(f"{question.id}__", 'No Answer')
            correct_answer_text = 'N/A'
            is_correct = False
            
            try:
                correct_answer_key = AnswerKey.objects.get(question=question)
                correct_answer_text = correct_answer_key.correct_answer
                
                if user_answer_text.strip().lower() == correct_answer_text.strip().lower():
                    is_correct = True

            except AnswerKey.DoesNotExist:
                
                pass

            feedback.append({
                'question_id': question.id,
                'question_text': question.question_text,
                'user_answer': user_answer_text,
                'correct_answer': correct_answer_text,
                'is_correct': is_correct,
                'question_type': question.question_type,
            })
        return feedback

    def get_time_taken(self, obj):
        return getattr(obj, 'time_taken', 0) or 0



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

    class Meta:
        model = ListeningTest
        fields = ['id', 'title', 'description', 'has_attempted', 'is_active']

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


class ListeningAnswerOptionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListeningAnswerOption
        fields = ['id', 'label', 'text']


class ListeningQuestionCreateSerializer(serializers.ModelSerializer):
    image = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    options = ListeningAnswerOptionCreateSerializer(many=True, required=False)
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
    options = ListeningAnswerOptionCreateSerializer(many=True, required=False)
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
                        gaps = []
                        if question.extra_data and 'gaps' in question.extra_data:
                            gaps = question.extra_data['gaps']
                        elif isinstance(question.correct_answers, list) and all(isinstance(x, dict) and 'number' in x for x in question.correct_answers):
                            gaps = question.correct_answers
                        else:
                            gaps = [{'number': i+1, 'answer': ca} for i, ca in enumerate(question.correct_answers)]
                        
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

def get_test_render_structure(self, obj):
    """
    Возвращает структуру для рендера теста (как на тесте) для вкладки "Подробнее"
    """
    result = []
    session = obj
    answers = session.answers or {}
    test = session.test
    for part in test.parts.all():
        part_data = {
            'part_number': part.part_number,
            'instructions': part.instructions,
            'questions': []
        }
        for q in part.questions.all():
            q_data = {
                'id': q.id,
                'type': q.question_type,
                'header': q.header,
                'instruction': q.instruction,
                'image': q.image,
            }
            # GAP FILL
            if q.question_type in ['gap_fill', 'gapfill', 'sentence_completion', 'summary_completion', 'note_completion', 'flow_chart']:
                text = q.question_text or ''
                gaps = []
                if q.extra_data and 'gaps' in q.extra_data:
                    gaps = q.extra_data['gaps']
                elif isinstance(q.correct_answers, list) and all(isinstance(x, dict) and 'number' in x for x in q.correct_answers):
                    gaps = q.correct_answers
                else:
                    gaps = [{'number': i+1, 'answer': ca} for i, ca in enumerate(q.correct_answers)]
                gaps_render = []
                for gap in gaps:
                    gap_num = gap.get('number')
                    correct_val = gap.get('answer', '')
                    key = f"{q.id}__gap{gap_num}"
                    user_val = answers.get(key, '')
                    gaps_render.append({
                        'number': gap_num,
                        'student_answer': user_val,
                        'correct_answer': correct_val,
                        'is_correct': normalize_answer(user_val) == normalize_answer(correct_val),
                        'is_answered': bool(user_val and user_val.strip())
                    })
                q_data.update({
                    'text': text,
                    'gaps': gaps_render
                })
            # TABLE
            elif q.question_type in ['table', 'table_completion', 'tablecompletion', 'form', 'form_completion']:
                table = q.extra_data.get('table', {}) if q.extra_data else {}
                cells = table.get('cells', [])
                table_render = []
                for row_idx, row in enumerate(cells):
                    row_render = []
                    for col_idx, cell in enumerate(row):
                        if cell.get('isAnswer'):
                            correct_val = cell.get('answer', '')
                            key = f"{q.id}__r{row_idx}c{col_idx}"
                            user_val = answers.get(key, '')
                            row_render.append({
                                'isAnswer': True,
                                'student_answer': user_val,
                                'correct_answer': correct_val,
                                'is_correct': normalize_answer(user_val) == normalize_answer(correct_val),
                                'is_answered': bool(user_val and user_val.strip()),
                                'text': cell.get('text', '')
                            })
                        else:
                            row_render.append({
                                'isAnswer': False,
                                'text': cell.get('text', '')
                            })
                    table_render.append(row_render)
                q_data['table'] = {
                    'cols': table.get('cols', 0),
                    'rows': table.get('rows', 0),
                    'cells': table_render
                }
            # MULTIPLE RESPONSE
            elif q.question_type in ['multiple_response', 'checkbox', 'multi_select']:
                options = list(q.options.all())
                correct_labels = set()
                if q.extra_data and 'options' in q.extra_data:
                    for opt in q.extra_data['options']:
                        if opt.get('isCorrect') or (isinstance(q.correct_answers, list) and (opt.get('label') in q.correct_answers or opt.get('text') in q.correct_answers)):
                            correct_labels.add(opt.get('label'))
                elif isinstance(q.correct_answers, list):
                    for label in q.correct_answers:
                        correct_labels.add(label)
                opts_render = []
                for o in options:
                    label = o.label
                    text = o.text
                    key = f"{q.id}__{label}"
                    user_val = answers.get(key, False)
                    is_selected = user_val is True or user_val == "true" or user_val == label
                    should_be_selected = label in correct_labels
                    opts_render.append({
                        'label': label,
                        'text': text,
                        'student_selected': is_selected,
                        'should_be_selected': should_be_selected,
                        'is_correct': is_selected == should_be_selected
                    })
                q_data['options'] = opts_render
            # MULTIPLE CHOICE
            elif q.question_type in ['multiple_choice', 'single_choice', 'radio', 'true_false', 'short_answer', 'TRUE_FALSE_NOT_GIVEN', 'shortanswer']:
                options = list(q.options.all())
                correct_label = ''
                if isinstance(q.correct_answers, list) and q.correct_answers:
                    correct_label = q.correct_answers[0]
                elif isinstance(q.correct_answers, str):
                    correct_label = q.correct_answers
                opts_render = []
                for o in options:
                    label = o.label
                    text = o.text
                    key = f"{q.id}__{label}"
                    user_val = answers.get(key, False)
                    is_selected = user_val is True or user_val == "true" or user_val == label
                    is_correct = (label == correct_label and is_selected)
                    opts_render.append({
                        'label': label,
                        'text': text,
                        'student_selected': is_selected,
                        'is_correct': is_correct,
                        'should_be_selected': label == correct_label
                    })
                q_data['options'] = opts_render
            # Если что-то другое — просто текст
            else:
                q_data['text'] = q.question_text
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
        try:
            return create_detailed_breakdown(obj)
        except Exception as e:
            print(f"[ERROR] get_detailed_breakdown: {str(e)}")
            return []

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
        gaps = []
        if extra_data and 'gaps' in extra_data:
            gaps = extra_data['gaps']
        elif isinstance(correct_answers, list) and all(isinstance(x, dict) and 'number' in x for x in correct_answers):
            gaps = correct_answers
        else:
            gaps = [{'number': i+1, 'answer': ca} for i, ca in enumerate(correct_answers)]
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
        if points == 1:
            num_total = 1
            num_correct = 1 if user_selected == correct_labels and not extra_selected else 0
        else:
            num_total = len(correct_labels)
            num_correct = len(user_selected & correct_labels)
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
