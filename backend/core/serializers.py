from rest_framework import serializers
from .models import ReadingTest, ReadingQuestion, AnswerOption, AnswerKey, Essay, WritingPrompt, ReadingPassage, ReadingTestSession, User, ListeningTestSession, ListeningTest, ListeningPart, ListeningQuestion, ListeningAnswerOption, ListeningTestResult, ListeningTestClone, ListeningStudentAnswer
import re

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
            user_answer = obj.answers.get(str(q.id), '').strip().upper()
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
        for question in obj.test.questions.all().order_by('order'):
            user_answer_text = obj.answers.get(str(question.id), 'No Answer')
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
    class Meta:
        model = ListeningQuestion
        fields = ['question_type', 'question_text', 'order', 'options', 'image', 'correct_answer', 'header', 'instruction']


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
                    option_data.pop('label', None)
                    ListeningAnswerOption.objects.create(question=question, label=label, **option_data)
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
                    option_data.pop('label', None)
                    option, created = question.options.get_or_create(label=label, defaults={**option_data, 'question': question})
                    if not created:
                        for attr, value in option_data.items():
                            setattr(option, attr, value)
                        option.save()
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
    class Meta:
        model = ListeningQuestion
        fields = ['question_type', 'question_text', 'order', 'options', 'image', 'correct_answer', 'header', 'instruction']

    def update(self, instance, validated_data):
        correct_answer = validated_data.pop('correct_answer', None)
        instance = super().update(instance, validated_data)
        if correct_answer is not None:
            instance.correct_answers = [correct_answer]
            instance.save()
        return instance


class ListeningTestSessionResultSerializer(serializers.ModelSerializer):
    test_title = serializers.CharField(source='test.title', read_only=True)
    student_id = serializers.CharField(source='user.student_id', read_only=True)
    correct_answers = serializers.SerializerMethodField()
    total_questions = serializers.SerializerMethodField()
    question_feedback = serializers.SerializerMethodField()

    class Meta:
        model = ListeningTestSession
        fields = [
            'id', 'test', 'test_title', 'student_id', 'started_at', 'completed_at',
            'time_taken', 'band_score', 'raw_score', 'completed', 'answers',
            'correct_answers', 'total_questions', 'question_feedback'
        ]
        read_only_fields = ['user', 'started_at', 'completed_at', 'band_score', 'raw_score', 'completed']

    def get_correct_answers(self, obj):
        correct = 0
        for q in obj.test.questions.all():
            user_answer = obj.answers.get(str(q.id), '')
            if isinstance(user_answer, list):
                if q.question_type == 'gap_fill':
                    for idx, gap_user_answer in enumerate(user_answer):
                        try:
                            correct_gap = q.correct_answers[idx] if idx < len(q.correct_answers) else None
                            if correct_gap:
                                if isinstance(correct_gap, dict):
                                    correct_answer_val = correct_gap.get('answer', '')
                                else:
                                    correct_answer_val = correct_gap
                                if isinstance(gap_user_answer, dict):
                                    user_answer_val = gap_user_answer.get('answer', '')
                                else:
                                    user_answer_val = gap_user_answer
                                if normalize_answer(user_answer_val) == normalize_answer(correct_answer_val):
                                    correct += 1
                        except (IndexError, TypeError, AttributeError):
                            continue
                    continue
                else:
                    user_answer = user_answer[0] if user_answer else ''
            user_answer = user_answer.strip().upper()
            try:
                if q.correct_answers:
                    for correct_answer in q.correct_answers:
                        if isinstance(correct_answer, dict):
                            correct_answer_val = correct_answer.get('answer', '')
                        else:
                            correct_answer_val = correct_answer
                        if normalize_answer(user_answer) == normalize_answer(correct_answer_val):
                            correct += 1
                            break
            except (IndexError, TypeError):
                continue
        return correct

    def get_total_questions(self, obj):
        return obj.test.questions.count()

    def get_question_feedback(self, obj):
        feedback = []
        for question in obj.test.questions.all().order_by('order'):
            user_answer_text = obj.answers.get(str(question.id), 'No Answer')
            correct_answer_text = 'N/A'
            is_correct = False
            
            try:
                correct_answer_key = question.correct_answers[0] if question.correct_answers else 'N/A'
                correct_answer_text = correct_answer_key.strip().upper()
                
                if user_answer_text.strip().lower() == correct_answer_text.strip().lower():
                    is_correct = True

            except (IndexError, TypeError):
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

# --- NEW LISTENING STRUCTURE SERIALIZERS ---

class ListeningAnswerOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListeningAnswerOption
        fields = ['id', 'label', 'text']

class ListeningQuestionSerializer(serializers.ModelSerializer):
    image = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    options = ListeningAnswerOptionSerializer(many=True, required=False)
    class Meta:
        model = ListeningQuestion
        fields = [
            'id', 'question_type', 'question_text', 'order', 'extra_data', 'correct_answers', 'options', 'header', 'instruction', 'image', 'created_at', 'updated_at'
        ]
    
    def get_image(self, obj):
        request = self.context.get('request', None)
        if obj.image:
            if hasattr(obj.image, 'url'):
                url = obj.image.url
            else:
                url = f"/media/{obj.image}"
            if request is not None:
                return request.build_absolute_uri(url)
            return url
        return None

class ListeningPartSerializer(serializers.ModelSerializer):
    audio = serializers.CharField(allow_blank=True, required=False)
    questions = ListeningQuestionSerializer(many=True, required=False)
    class Meta:
        model = ListeningPart
        fields = [
            'id', 'part_number', 'audio', 'audio_duration', 'instructions', 'questions', 'created_at', 'updated_at'
        ]

class ListeningTestSerializer(serializers.ModelSerializer):
    parts = ListeningPartSerializer(many=True, required=False)

    class Meta:
        model = ListeningTest
        fields = [
            'id', 'title', 'description', 'is_active', 'parts', 'created_at', 'updated_at'
        ]

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
                    option_data.pop('label', None)
                    ListeningAnswerOption.objects.create(question=question, label=label, **option_data)
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
                    option_data.pop('label', None)
                    option, created = question.options.get_or_create(label=label, defaults={**option_data, 'question': question})
                    if not created:
                        for attr, value in option_data.items():
                            setattr(option, attr, value)
                        option.save()
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

class ListeningStudentAnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListeningStudentAnswer
        fields = ['id', 'question', 'answer', 'flagged', 'submitted_at']

class ListeningTestSessionSyncSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListeningTestSession
        fields = ['id', 'answers', 'flagged', 'time_left', 'status']
        read_only_fields = ['id', 'status']

class ListeningTestSessionSubmitSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListeningTestSession
        fields = ['id', 'answers', 'flagged', 'time_left']
        read_only_fields = ['id']

    def update(self, instance, validated_data):
        # Save answers and mark as submitted
        instance.answers = validated_data.get('answers', instance.answers)
        instance.time_left = validated_data.get('time_left', instance.time_left)
        instance.submitted = True
        instance.status = 'submitted'
        
        # Auto-grade the test
        correct_answers = 0
        total_questions = 0
        
        # Get all questions from all parts of the test
        for part in instance.test.parts.all():
            for question in part.questions.all():
                total_questions += 1
                user_answer = instance.answers.get(str(question.id), '')
                if isinstance(user_answer, list):
                    if question.question_type == 'gap_fill':
                        for idx, gap_user_answer in enumerate(user_answer):
                            try:
                                correct_gap = question.correct_answers[idx] if idx < len(question.correct_answers) else None
                                if correct_gap:
                                    if isinstance(correct_gap, dict):
                                        correct_answer_val = correct_gap.get('answer', '')
                                    else:
                                        correct_answer_val = correct_gap
                                    if isinstance(gap_user_answer, dict):
                                        user_answer_val = gap_user_answer.get('answer', '')
                                    else:
                                        user_answer_val = gap_user_answer
                                    if normalize_answer(user_answer_val) == normalize_answer(correct_answer_val):
                                        correct_answers += 1
                            except (IndexError, TypeError, AttributeError):
                                continue
                        continue
                    else:
                        user_answer = user_answer[0] if user_answer else ''
                user_answer = user_answer.strip().upper()
                try:
                    if question.correct_answers:
                        for correct_answer in question.correct_answers:
                            if isinstance(correct_answer, dict):
                                correct_answer_val = correct_answer.get('answer', '')
                            else:
                                correct_answer_val = correct_answer
                            if normalize_answer(user_answer) == normalize_answer(correct_answer_val):
                                correct_answers += 1
                                break
                except (IndexError, TypeError):
                    continue
        
        # Calculate IELTS band score (0-9)
        if total_questions > 0:
            percentage = (correct_answers / total_questions) * 100
            # IELTS Listening band score conversion (approximate)
            if percentage >= 90: band_score = 9.0
            elif percentage >= 85: band_score = 8.5
            elif percentage >= 80: band_score = 8.0
            elif percentage >= 75: band_score = 7.5
            elif percentage >= 70: band_score = 7.0
            elif percentage >= 65: band_score = 6.5
            elif percentage >= 60: band_score = 6.0
            elif percentage >= 55: band_score = 5.5
            elif percentage >= 50: band_score = 5.0
            elif percentage >= 45: band_score = 4.5
            elif percentage >= 40: band_score = 4.0
            elif percentage >= 35: band_score = 3.5
            elif percentage >= 30: band_score = 3.0
            else: band_score = 0.0
        else:
            band_score = 0.0
        
        instance.score = band_score
        instance.save()
        return instance

class ListeningTestResultSerializer(serializers.ModelSerializer):
    score = serializers.SerializerMethodField()
    correct_answers_count = serializers.SerializerMethodField()
    total_questions_count = serializers.SerializerMethodField()
    time_taken = serializers.SerializerMethodField()
    test_title = serializers.CharField(source='test.title', read_only=True)
    
    class Meta:
        model = ListeningTestSession
        fields = ['id', 'test', 'test_title', 'user', 'submitted', 'score', 'answers', 'status', 
                 'correct_answers_count', 'total_questions_count', 'time_taken', 'started_at']

    def get_score(self, obj):
        return obj.score if hasattr(obj, 'score') and obj.score is not None else 0.0
    
    def get_correct_answers_count(self, obj):
        correct = 0
        for part in obj.test.parts.all():
            for question in part.questions.all():
                user_answer = obj.answers.get(str(question.id), '')
                if isinstance(user_answer, list):
                    if question.question_type == 'gap_fill':
                        for idx, gap_user_answer in enumerate(user_answer):
                            try:
                                correct_gap = question.correct_answers[idx] if idx < len(question.correct_answers) else None
                                if correct_gap:
                                    if isinstance(correct_gap, dict):
                                        correct_answer_val = correct_gap.get('answer', '')
                                    else:
                                        correct_answer_val = correct_gap
                                    if isinstance(gap_user_answer, dict):
                                        user_answer_val = gap_user_answer.get('answer', '')
                                    else:
                                        user_answer_val = gap_user_answer
                                    if normalize_answer(user_answer_val) == normalize_answer(correct_answer_val):
                                        correct += 1
                            except (IndexError, TypeError, AttributeError):
                                continue
                        continue
                    else:
                        user_answer = user_answer[0] if user_answer else ''
                user_answer = user_answer.strip().upper()
                try:
                    if question.correct_answers:
                        for correct_answer in question.correct_answers:
                            if isinstance(correct_answer, dict):
                                correct_answer_val = correct_answer.get('answer', '')
                            else:
                                correct_answer_val = correct_answer
                            if normalize_answer(user_answer) == normalize_answer(correct_answer_val):
                                correct += 1
                                break
                except (IndexError, TypeError):
                    continue
        return correct
    
    def get_total_questions_count(self, obj):
        total = 0
        for part in obj.test.parts.all():
            total += part.questions.count()
        return total
    
    def get_time_taken(self, obj):
        if obj.started_at and obj.submitted:
            from django.utils import timezone
            return (timezone.now() - obj.started_at).total_seconds()
        return 0

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
