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

# --- READING SECTION MODELS ---
class ReadingTest(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    time_limit = models.PositiveIntegerField(default=60)  # В минутах
    total_points = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class ReadingPart(models.Model):
    test = models.ForeignKey(ReadingTest, related_name='parts', on_delete=models.CASCADE)
    part_number = models.PositiveIntegerField()
    title = models.CharField(max_length=255, blank=True, default='')
    instructions = models.TextField(blank=True, default='')
    passage_text = models.TextField(blank=True, default='')  # основной текст для чтения
    passage_image_url = models.CharField(max_length=500, blank=True, null=True)  # если нужна картинка
    order = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class ReadingQuestion(models.Model):
    part = models.ForeignKey(ReadingPart, related_name='questions', on_delete=models.CASCADE)
    order = models.PositiveIntegerField()
    group_number = models.CharField(max_length=32, blank=True, default='')  # Например, '1-4', '5-8', ''
    question_type = models.CharField(max_length=32, blank=True, null=True, default=None)
    header = models.CharField(max_length=255, blank=True, default='')
    instruction = models.TextField(blank=True, default='')
    image_url = models.CharField(max_length=500, blank=True, null=True)
    question_text = models.TextField(blank=True, null=True, default=None)
    points = models.FloatField(default=1)
    correct_answers = models.JSONField(default=list, blank=True, null=True)
    extra_data = models.JSONField(default=dict, blank=True, null=True)  # Для таблиц, matching и т.д.
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class ReadingAnswerOption(models.Model):
    question = models.ForeignKey(ReadingQuestion, related_name='answer_options', on_delete=models.CASCADE)
    label = models.CharField(max_length=16)
    text = models.TextField(blank=True, default='')
    image_url = models.CharField(max_length=500, blank=True, null=True)
    is_correct = models.BooleanField(default=False)

class ReadingTestSession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    test = models.ForeignKey(ReadingTest, on_delete=models.CASCADE)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=32, default='in_progress')
    answers = models.JSONField(default=dict, blank=True)  # {question_id: answer, ...}
    flagged = models.JSONField(default=dict, blank=True)
    time_left = models.IntegerField(default=3600)  # 60 минут
    score = models.FloatField(null=True, blank=True)
    correct_answers_count = models.IntegerField(default=0)
    total_questions_count = models.IntegerField(default=0)
    band_score = models.FloatField(null=True, blank=True)
    submitted = models.BooleanField(default=False)

class ReadingTestResult(models.Model):
    session = models.OneToOneField(ReadingTestSession, on_delete=models.CASCADE)
    raw_score = models.IntegerField(default=0)
    band_score = models.FloatField(default=0)
    breakdown = models.JSONField(default=dict, blank=True)  # Per-question feedback
    calculated_at = models.DateTimeField(auto_now_add=True)


