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
    role = models.CharField(max_length=20, choices=[('student', 'Student'), ('admin', 'Admin')])
    student_id = models.CharField(max_length=64, null=True, blank=True)
    first_name = models.CharField(max_length=64, null=True, blank=True)
    last_name = models.CharField(max_length=64, null=True, blank=True)
    email = models.EmailField(max_length=255, unique=True, null=True, blank=True)
    group = models.CharField(max_length=128, null=True, blank=True)
    teacher = models.CharField(max_length=128, null=True, blank=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    objects = UserManager()

    USERNAME_FIELD = 'uid'

    def has_perm(self, perm, obj=None):
        return self.is_superuser

    def has_module_perms(self, app_label):
        return self.is_superuser

class WritingTestSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    started_at = models.DateTimeField(auto_now_add=True)
    completed = models.BooleanField(default=False)
    band_score = models.FloatField(null=True, blank=True)

    def __str__(self):
        return f"TestSession #{self.id} for {self.user.uid}"

class WritingPrompt(models.Model):
    task_type = models.CharField(max_length=10, choices=[('task1', 'Task 1'), ('task2', 'Task 2')])
    prompt_text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    image = models.ImageField(upload_to="writing_images/", null=True, blank=True)
    is_active = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        print(">>> WritingPrompt.save() called")
        if self.is_active:
            WritingPrompt.objects.filter(
                task_type=self.task_type,
                is_active=True
            ).exclude(pk=self.pk).update(is_active=False)
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
    prompt = models.ForeignKey(WritingPrompt, null=True, blank=True, on_delete=models.SET_NULL)


class ReadingTest(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=False)

    def __str__(self):
        return self.title


class ReadingQuestion(models.Model):
    QUESTION_TYPES = [
        ('MULTIPLE_CHOICE', 'Multiple Choice'),
        ('TRUE_FALSE_NOT_GIVEN', 'True / False / Not Given'),
        ('MATCHING_HEADINGS', 'Matching Headings'),
    ]
    test = models.ForeignKey(ReadingTest, related_name='questions', on_delete=models.CASCADE)
    question_type = models.CharField(max_length=50, choices=QUESTION_TYPES)
    question_text = models.TextField()
    paragraph_ref = models.TextField(blank=True)
    order = models.PositiveIntegerField()
    image = models.ImageField(upload_to="reading_images/", null=True, blank=True)

    def __str__(self):
        return f"Q{self.order} ({self.get_question_type_display()})"


class AnswerOption(models.Model):
    question = models.ForeignKey(ReadingQuestion, related_name='options', on_delete=models.CASCADE)
    text = models.CharField(max_length=255)
    label = models.CharField(max_length=5)

    def __str__(self):
        return f"{self.label}: {self.text}"


class AnswerKey(models.Model):
    question = models.OneToOneField(ReadingQuestion, on_delete=models.CASCADE)
    correct_answer = models.CharField(max_length=255)

    def __str__(self):
        return f"Answer to Q{self.question.id}: {self.correct_answer}"


class ReadingPassage(models.Model):
    test = models.OneToOneField(ReadingTest, on_delete=models.CASCADE, related_name='passage')
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Passage for {self.test.title}"


class ReadingTestSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    test = models.ForeignKey(ReadingTest, on_delete=models.CASCADE)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    time_taken = models.IntegerField(null=True, blank=True)
    band_score = models.FloatField(null=True, blank=True)
    raw_score = models.IntegerField(null=True, blank=True)
    answers = models.JSONField(default=dict)
    completed = models.BooleanField(default=False)

    class Meta:
        ordering = ['-started_at']

    def __str__(self):
        return f"Reading Test Session #{self.id} - {self.user.student_id}"

    def calculate_score(self):
        """
        Calculates the number of correct answers.
        This method does NOT save the instance.
        """
        correct_answers_count = 0
        questions = self.test.questions.all().select_related('answerkey')


        correct_answers_map = {
            str(q.id): q.answerkey.correct_answer.strip().lower()
            for q in questions if hasattr(q, 'answerkey')
        }

        for question_id, user_answer in self.answers.items():
            correct_answer = correct_answers_map.get(question_id)
            if correct_answer and user_answer.strip().lower() == correct_answer:
                correct_answers_count += 1

        return correct_answers_count

    def convert_to_band(self, raw_score):
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



class ListeningTest(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=False)
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
    question_type = models.CharField(max_length=32, blank=True, null=True, default=None)
    question_text = models.TextField(blank=True, null=True, default=None)
    extra_data = JSONField(default=dict, blank=True, null=True)
    correct_answers = JSONField(default=list, blank=True, null=True)
    header = models.TextField(blank=True, default='', null=True)
    instruction = models.TextField(blank=True, default='', null=True)
    image = models.CharField(max_length=500, blank=True, null=True, default=None)
    points = models.PositiveIntegerField(default=1, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class ListeningAnswerOption(models.Model):
    question = models.ForeignKey(ListeningQuestion, related_name='options', on_delete=models.CASCADE)
    label = models.CharField(max_length=8)
    text = models.CharField(max_length=255)

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
    time_left = models.IntegerField(default=1800)  # Time remaining in seconds
    score = models.FloatField(null=True, blank=True)  # Auto-graded score
    correct_answers_count = models.IntegerField(default=0)
    total_questions_count = models.IntegerField(default=0)
    # TODO: Enforce one sitting, no pause, etc.

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

class ListeningTestClone(models.Model):
    source_test = models.ForeignKey(ListeningTest, related_name='clones', on_delete=models.CASCADE)
    cloned_test = models.OneToOneField(ListeningTest, related_name='clone_of', on_delete=models.CASCADE)
    cloned_at = models.DateTimeField(auto_now_add=True)
    # TODO: Add admin, notes, etc.


