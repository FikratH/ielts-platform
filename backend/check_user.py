import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ielts_platform.settings')
django.setup()

from core.models import User, ListeningTestSession, ReadingTestSession, WritingTestSession

# Найти студента dgn
user = User.objects.filter(email='dgn@ielts.local1').first()
if not user:
    user = User.objects.filter(first_name='dgn').first()

if user:
    print(f"Found user: {user.first_name} {user.last_name} ({user.email})")
    
    # Проверим его тесты
    l_regular = ListeningTestSession.objects.filter(user=user, submitted=True, is_diagnostic=False).exists()
    r_regular = ReadingTestSession.objects.filter(user=user, completed=True, is_diagnostic=False).exists()
    w_regular = WritingTestSession.objects.filter(user=user, completed=True, is_diagnostic=False).exists()
    
    l_diag = ListeningTestSession.objects.filter(user=user, submitted=True, is_diagnostic=True).exists()
    r_diag = ReadingTestSession.objects.filter(user=user, completed=True, is_diagnostic=True).exists()
    w_diag = WritingTestSession.objects.filter(user=user, completed=True, is_diagnostic=True).exists()
    
    print(f"Has regular Listening: {l_regular}")
    print(f"Has regular Reading: {r_regular}")
    print(f"Has regular Writing: {w_regular}")
    print(f"Has diagnostic Listening: {l_diag}")
    print(f"Has diagnostic Reading: {r_diag}")
    print(f"Has diagnostic Writing: {w_diag}")
    
    locked = l_regular or r_regular or w_regular
    print(f"Diagnostic should be locked: {locked}")
    
    # Проверим диагностические шаблоны
    from core.models import ListeningTest, ReadingTest, WritingTest
    l_diag_template = ListeningTest.objects.filter(is_diagnostic_template=True, is_active=True).exists()
    r_diag_template = ReadingTest.objects.filter(is_diagnostic_template=True, is_active=True).exists()
    w_diag_template = WritingTest.objects.filter(is_diagnostic_template=True, is_active=True).exists()
    
    print(f"Diagnostic templates available:")
    print(f"  Listening: {l_diag_template}")
    print(f"  Reading: {r_diag_template}")
    print(f"  Writing: {w_diag_template}")
else:
    print("User dgn not found")
    users = User.objects.filter(role='student')
    print(f"Available students: {users.count()}")
    for u in users:
        print(f"  - {u.id}: {u.first_name} {u.last_name} ({u.email})")


