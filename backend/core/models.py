from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.conf import settings
from django.db.models import JSONField

class UserManager(BaseUserManager):
    def create_user(self, uid, role, password=None, **extra_fields):
        user = self.model(uid=uid, role=role, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, uid, role='admin', password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        return self.create_user(uid, role, password, **extra_fields)

class User(AbstractBaseUser):
    uid = models.CharField(max_length=128, unique=True)
    role = models.CharField(
        max_length=20,
        choices=[
            ('student', 'Student'),
            ('teacher', 'Teacher'),
            ('speaking_mentor', 'Speaking Mentor'),
            ('admin', 'Admin'),
            ('curator', 'Curator'),
            ('placement_viewer', 'Placement Viewer'),
        ]
    )
    student_id = models.CharField(max_length=64, null=True, blank=True)
    curator_id = models.CharField(max_length=64, null=True, blank=True)
    first_name = models.CharField(max_length=64, null=True, blank=True)
    last_name = models.CharField(max_length=64, null=True, blank=True)
    email = models.EmailField(max_length=255, unique=True, null=True, blank=True)
    group = models.CharField(max_length=128, null=True, blank=True)
    teacher = models.CharField(max_length=128, null=True, blank=True)
    assigned_teacher = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='students_assigned'
    )
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    objects = UserManager()

    USERNAME_FIELD = 'uid'

    def has_perm(self, perm, obj=None):
        return self.is_superuser

    def has_module_perms(self, app_label):
        return self.is_superuser

class WritingTest(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=False)
    explanation_url = models.URLField(null=True, blank=True)
    # Marks this test as a diagnostic template; used only from Diagnostic flow
    is_diagnostic_template = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

class WritingTestSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    test = models.ForeignKey(WritingTest, on_delete=models.CASCADE, null=True, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    completed = models.BooleanField(default=False)
    band_score = models.FloatField(null=True, blank=True)
    time_left_seconds = models.PositiveIntegerField(default=3600)
    task1_draft = models.TextField(blank=True, default='')
    task2_draft = models.TextField(blank=True, default='')
    # True when this session is a part of the diagnostic flow
    is_diagnostic = models.BooleanField(default=False)

    def __str__(self):
        return f"TestSession #{self.id} for {self.user.uid}"

class WritingTask(models.Model):
    test = models.ForeignKey(WritingTest, related_name='tasks', on_delete=models.CASCADE)
    task_type = models.CharField(max_length=10, choices=[('task1', 'Task 1'), ('task2', 'Task 2')])
    task_text = models.TextField()
    image = models.ImageField(upload_to="writing_images/", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['test', 'task_type']

    def __str__(self):
        return f"{self.test.title} - {self.task_type.upper()}"

class WritingPrompt(models.Model):
    task_type = models.CharField(max_length=10, choices=[('task1', 'Task 1'), ('task2', 'Task 2')])
    prompt_text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    image = models.ImageField(upload_to="writing_images/", null=True, blank=True)
    is_active = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.task_type.upper()} - {self.prompt_text[:50]}"


class Essay(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    task_type = models.CharField(max_length=10, choices=[('task1', 'Task 1'), ('task2', 'Task 2')])
    question_text = models.TextField()
    submitted_text = models.TextField()
    score_task = models.FloatField(null=True)
    score_coherence = models.FloatField(null=True)
    score_lexical = models.FloatField(null=True)
    score_grammar = models.FloatField(null=True)
    overall_band = models.FloatField(null=True)
    feedback = models.TextField(null=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    test_session = models.ForeignKey(WritingTestSession, on_delete=models.CASCADE, null=True, blank=True)
    task = models.ForeignKey(WritingTask, null=True, blank=True, on_delete=models.SET_NULL)
    prompt = models.ForeignKey(WritingPrompt, null=True, blank=True, on_delete=models.SET_NULL)





class TeacherFeedback(models.Model):
    essay = models.OneToOneField(Essay, on_delete=models.CASCADE, related_name='teacher_feedback')
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name='given_feedbacks')
    overall_feedback = models.TextField(blank=True, default='')
    annotations = models.JSONField(default=list, blank=True)
    
    # Teacher's IELTS scores
    teacher_task_score = models.FloatField(null=True, blank=True, help_text="Task Response/Achievement (0-9)")
    teacher_coherence_score = models.FloatField(null=True, blank=True, help_text="Coherence & Cohesion (0-9)")
    teacher_lexical_score = models.FloatField(null=True, blank=True, help_text="Lexical Resource (0-9)")
    teacher_grammar_score = models.FloatField(null=True, blank=True, help_text="Grammatical Range & Accuracy (0-9)")
    teacher_overall_score = models.FloatField(null=True, blank=True, help_text="Overall Band Score (calculated)")
    
    # Feedback fields for each criterion (like in Speaking Assessment)
    teacher_task_feedback = models.TextField(blank=True, default='', help_text="Feedback for Task Response/Achievement")
    teacher_coherence_feedback = models.TextField(blank=True, default='', help_text="Feedback for Coherence & Cohesion")
    teacher_lexical_feedback = models.TextField(blank=True, default='', help_text="Feedback for Lexical Resource")
    teacher_grammar_feedback = models.TextField(blank=True, default='', help_text="Feedback for Grammatical Range & Accuracy")
    
    published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(null=True, blank=True)
    
    def save(self, *args, **kwargs):
        # Auto-calculate overall band score if individual scores are provided
        if self.teacher_task_score or self.teacher_coherence_score or self.teacher_lexical_score or self.teacher_grammar_score:
            scores = [
                score for score in [
                    self.teacher_task_score,
                    self.teacher_coherence_score, 
                    self.teacher_lexical_score,
                    self.teacher_grammar_score
                ] if score is not None
            ]
            
            if scores:
                average = sum(scores) / len(scores)
                # IELTS rounding: < 0.25 → down, ≥ 0.25 and < 0.75 → 0.5, ≥ 0.75 → up
                decimal = average - int(average)
                if decimal < 0.25:
                    self.teacher_overall_score = int(average)
                elif decimal < 0.75:
                    self.teacher_overall_score = int(average) + 0.5
                else:
                    self.teacher_overall_score = int(average) + 1
                    
                # Ensure score is within valid range (0-9)
                self.teacher_overall_score = max(0, min(9, self.teacher_overall_score))
        
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Feedback for Essay #{self.essay_id} by {self.teacher_id} ({'published' if self.published else 'draft'})"


class ListeningTest(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=False)
    explanation_url = models.URLField(null=True, blank=True)
    # Diagnostic template flag
    is_diagnostic_template = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # TODO: Add fields for admin, clone, etc.

class ListeningPart(models.Model):
    test = models.ForeignKey(ListeningTest, related_name='parts', on_delete=models.CASCADE)
    part_number = models.PositiveIntegerField()
    audio = models.CharField(max_length=500, blank=True, null=True)
    audio_duration = models.FloatField(default=0)
    instructions = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class ListeningQuestion(models.Model):
    part = models.ForeignKey(ListeningPart, related_name='questions', on_delete=models.CASCADE)
    order = models.PositiveIntegerField(default=1)
    question_type = models.CharField(max_length=32, blank=True, null=True, default=None)
    question_text = models.TextField(blank=True, null=True, default=None)
    task_prompt = models.TextField(blank=True, default='')
    extra_data = JSONField(default=dict, blank=True, null=True)
    correct_answers = JSONField(default=list, blank=True, null=True)
    header = models.CharField(max_length=255, blank=True, default='')
    instruction = models.TextField(blank=True, default='', null=True)
    image = models.CharField(max_length=500, blank=True, null=True, default=None)
    image_file = models.ImageField(upload_to='listening/questions/', null=True, blank=True)
    points = models.PositiveIntegerField(default=1, blank=True, null=True)
    scoring_mode = models.CharField(
        max_length=20, 
        choices=[('total', 'Total Points'), ('per_correct', 'Per Correct Answer')],
        default='total'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order']

class ListeningAnswerOption(models.Model):
    question = models.ForeignKey(ListeningQuestion, related_name='options', on_delete=models.CASCADE)
    label = models.CharField(max_length=8)
    text = models.CharField(max_length=255)
    points = models.PositiveIntegerField(default=1)

class ListeningTestSession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    test = models.ForeignKey(ListeningTest, on_delete=models.CASCADE)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    timer_seconds = models.IntegerField(default=0)
    audio_position = models.FloatField(default=0)
    status = models.CharField(max_length=32, default='in_progress')
    state = JSONField(default=dict, blank=True)  # For additional session state
    submitted = models.BooleanField(default=False)
    answers = JSONField(default=dict, blank=True)  # Store user answers
    flagged = JSONField(default=dict, blank=True)  # Store flagged questions
    time_left = models.IntegerField(default=2400)  # Time remaining in seconds (40 minutes)
    time_taken = models.FloatField(null=True, blank=True)
    score = models.FloatField(null=True, blank=True)  # Auto-graded score
    correct_answers_count = models.IntegerField(default=0)
    total_questions_count = models.IntegerField(default=0)
    # TODO: Enforce one sitting, no pause, etc.
    # Diagnostic marker for this session
    is_diagnostic = models.BooleanField(default=False)
    last_updated = models.DateTimeField(auto_now=True)

class ListeningStudentAnswer(models.Model):
    session = models.ForeignKey(ListeningTestSession, related_name='student_answers', on_delete=models.CASCADE)
    question = models.ForeignKey(ListeningQuestion, on_delete=models.CASCADE)
    answer = models.TextField()
    flagged = models.BooleanField(default=False)
    submitted_at = models.DateTimeField(auto_now_add=True)

class ListeningTestResult(models.Model):
    session = models.OneToOneField(ListeningTestSession, on_delete=models.CASCADE)
    raw_score = models.IntegerField(default=0)
    band_score = models.FloatField(default=0)
    breakdown = JSONField(default=dict, blank=True)  # Per-question feedback
    calculated_at = models.DateTimeField(auto_now_add=True)
    ai_feedback = models.TextField(null=True, blank=True)
    ai_feedback_version = models.CharField(max_length=32, null=True, blank=True)
    ai_feedback_updated_at = models.DateTimeField(null=True, blank=True)

class ListeningTestClone(models.Model):
    source_test = models.ForeignKey(ListeningTest, related_name='clones', on_delete=models.CASCADE)
    cloned_test = models.OneToOneField(ListeningTest, related_name='clone_of', on_delete=models.CASCADE)
    cloned_at = models.DateTimeField(auto_now_add=True)
    # TODO: Add admin, notes, etc.

# --- READING SECTION MODELS ---
class ReadingTest(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    time_limit = models.PositiveIntegerField(default=60)  # В минутах
    total_points = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=False)
    explanation_url = models.URLField(null=True, blank=True)
    # Diagnostic template flag
    is_diagnostic_template = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class ReadingPart(models.Model):
    test = models.ForeignKey(ReadingTest, related_name='parts', on_delete=models.CASCADE)
    part_number = models.PositiveIntegerField()
    title = models.CharField(max_length=255, blank=True, default='')
    instructions = models.TextField(blank=True, default='')
    passage_text = models.TextField(blank=True, default='')  # основной текст для чтения
    passage_heading = models.CharField(max_length=255, blank=True, null=True)  # кастомный заголовок для текста
    passage_image_url = models.CharField(max_length=500, blank=True, null=True)  # если нужна картинка
    order = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order']

class ReadingQuestion(models.Model):
    part = models.ForeignKey(ReadingPart, related_name='questions', on_delete=models.CASCADE)
    order = models.PositiveIntegerField()
    question_type = models.CharField(max_length=32, blank=True, null=True, default=None)
    header = models.CharField(max_length=255, blank=True, default='')
    instruction = models.TextField(blank=True, default='')
    task_prompt = models.TextField(blank=True, default='')
    image_url = models.CharField(max_length=500, blank=True, null=True)
    image_file = models.ImageField(upload_to='reading/questions/', null=True, blank=True)
    question_text = models.TextField(blank=True, null=True, default=None)
    points = models.FloatField(default=1)
    correct_answers = models.JSONField(default=list, blank=True, null=True)
    extra_data = models.JSONField(default=dict, blank=True, null=True)  # Для таблиц, matching и т.д.
    reading_scoring_type = models.CharField(
        max_length=20,
        choices=[
            ('all_or_nothing', 'All or Nothing (1 балл за весь вопрос)'),
            ('per_correct_option', 'Per Correct Option (баллы за каждый правильный)')
        ],
        default='all_or_nothing',
        help_text="Режим подсчета баллов для Reading multiple_response"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order']

class ReadingAnswerOption(models.Model):
    question = models.ForeignKey(ReadingQuestion, related_name='answer_options', on_delete=models.CASCADE)
    label = models.CharField(max_length=16)
    text = models.TextField(blank=True, default='')
    image_url = models.CharField(max_length=500, blank=True, null=True)
    is_correct = models.BooleanField(default=False)
    reading_points = models.PositiveIntegerField(
        default=1,
        help_text="Баллы за эту опцию в режиме per_correct_option"
    )

class ReadingTestSession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    test = models.ForeignKey(ReadingTest, on_delete=models.CASCADE)
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    completed = models.BooleanField(default=False)
    answers = models.JSONField(default=dict, blank=True)  # {question_id: answer, ...}
    time_left_seconds = models.IntegerField(default=3600)  # 60 минут
    # Diagnostic marker for this session
    is_diagnostic = models.BooleanField(default=False)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Reading Session for {self.user.email} on {self.test.title}"

class ReadingTestResult(models.Model):
    session = models.OneToOneField(ReadingTestSession, on_delete=models.CASCADE, related_name='result')
    raw_score = models.FloatField(default=0)
    total_score = models.FloatField(default=0)
    band_score = models.FloatField(default=0)
    breakdown = models.JSONField(default=dict, blank=True)
    calculated_at = models.DateTimeField(auto_now_add=True)
    time_taken = models.DurationField(null=True, blank=True)
    ai_feedback = models.TextField(null=True, blank=True)
    ai_feedback_version = models.CharField(max_length=32, null=True, blank=True)
    ai_feedback_updated_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Result for session {self.session.id} - Score: {self.raw_score}/{self.total_score}"


class TeacherSatisfactionSurvey(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='teacher_surveys')
    is_satisfied = models.BooleanField(help_text="Student satisfaction with teacher")
    reason = models.TextField(blank=True, null=True, help_text="Reason if not satisfied")
    submitted_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['student', 'submitted_at']
        ordering = ['-submitted_at']
    
    def __str__(self):
        from django.utils import timezone
        status = "Satisfied" if self.is_satisfied else "Not Satisfied"
        local_time = timezone.localtime(self.submitted_at)
        return f"{self.student.email} - {status} ({local_time.strftime('%Y-%m-%d %H:%M')})"


# --- SPEAKING SECTION MODELS ---
class SpeakingSession(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='speaking_sessions')
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name='conducted_speaking_sessions')
    
    # IELTS Speaking criteria scores (0-9, step 0.5)
    fluency_coherence_score = models.FloatField(null=True, blank=True, help_text="Fluency and Coherence (0-9)")
    lexical_resource_score = models.FloatField(null=True, blank=True, help_text="Lexical Resource (0-9)")
    grammatical_range_score = models.FloatField(null=True, blank=True, help_text="Grammatical Range and Accuracy (0-9)")
    pronunciation_score = models.FloatField(null=True, blank=True, help_text="Pronunciation (0-9)")
    overall_band_score = models.FloatField(null=True, blank=True, help_text="Overall Band Score (calculated)")
    
    # Feedback fields for each criterion
    fluency_coherence_feedback = models.TextField(blank=True, default='')
    lexical_resource_feedback = models.TextField(blank=True, default='')
    grammatical_range_feedback = models.TextField(blank=True, default='')
    pronunciation_feedback = models.TextField(blank=True, default='')
    overall_feedback = models.TextField(blank=True, default='')
    
    # Session timing and notes
    duration_seconds = models.IntegerField(null=True, blank=True, help_text="Total session duration")
    time_markers = models.JSONField(default=list, blank=True, help_text="Time markers with notes")
    session_notes = models.TextField(blank=True, default='', help_text="Additional session notes")
    
    # Session status
    completed = models.BooleanField(default=False, help_text="Session completed by teacher")
    conducted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-conducted_at']
    
    def save(self, *args, **kwargs):
        # Auto-calculate overall band score if individual scores are provided
        if self.fluency_coherence_score or self.lexical_resource_score or self.grammatical_range_score or self.pronunciation_score:
            scores = [
                score for score in [
                    self.fluency_coherence_score,
                    self.lexical_resource_score, 
                    self.grammatical_range_score,
                    self.pronunciation_score
                ] if score is not None
            ]
            
            if scores:
                average = sum(scores) / len(scores)
                # IELTS rounding: < 0.25 → down, ≥ 0.25 and < 0.75 → 0.5, ≥ 0.75 → up
                decimal = average - int(average)
                if decimal < 0.25:
                    self.overall_band_score = int(average)
                elif decimal < 0.75:
                    self.overall_band_score = int(average) + 0.5
                else:
                    self.overall_band_score = int(average) + 1
                    
                # Ensure score is within valid range (0-9)
                self.overall_band_score = max(0, min(9, self.overall_band_score))
        
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Speaking Session: {self.student.first_name} {self.student.last_name} ({self.conducted_at.strftime('%Y-%m-%d')})"


# Placement Test Models
class PlacementTestQuestion(models.Model):
    order = models.PositiveIntegerField(unique=True)  # 1-20
    question_text = models.TextField()
    option_a = models.CharField(max_length=255)
    option_b = models.CharField(max_length=255)
    option_c = models.CharField(max_length=255)
    option_d = models.CharField(max_length=255)
    correct_answer = models.CharField(max_length=1, choices=[('A', 'A'), ('B', 'B'), ('C', 'C'), ('D', 'D')])
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['order']
    
    def __str__(self):
        return f"Q{self.order}: {self.question_text[:50]}..."


class PlacementTestSubmission(models.Model):
    full_name = models.CharField(max_length=255)  # Имя Фамилия
    grade = models.CharField(max_length=20, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    email = models.EmailField()
    planned_exam_date = models.CharField(max_length=50)  # "Ближайшие 3 месяца", "Ближайшие полгода", и т.д.
    answers = models.JSONField(default=dict)  # {1: 'A', 2: 'B', ...}
    score = models.IntegerField(default=0)  # 0-20
    recommendation = models.CharField(max_length=50)  # 'pre-ielts' or 'ielts'
    submitted_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-submitted_at']
    
    def __str__(self):
        return f"{self.full_name} - {self.score}/20 ({self.submitted_at.strftime('%Y-%m-%d')})"
