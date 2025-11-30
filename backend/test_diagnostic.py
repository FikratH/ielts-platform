import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ielts_platform.settings')
django.setup()

from core.models import User, ListeningTest, ReadingTest, WritingTest

listening_diag = ListeningTest.objects.filter(is_diagnostic_template=True)
reading_diag = ReadingTest.objects.filter(is_diagnostic_template=True)
writing_diag = WritingTest.objects.filter(is_diagnostic_template=True)

print("=== Diagnostic Templates ===")
print(f"Listening: {listening_diag.count()} tests")
for t in listening_diag:
    print(f"  - {t.id}: {t.title}")

print(f"Reading: {reading_diag.count()} tests")
for t in reading_diag:
    print(f"  - {t.id}: {t.title}")

print(f"Writing: {writing_diag.count()} tests")
for t in writing_diag:
    print(f"  - {t.id}: {t.title}")

students = User.objects.filter(role='student')
print(f"\n=== Students ===")
print(f"Found {students.count()} students")
for s in students:
    print(f"  - {s.id}: {s.first_name} {s.last_name} ({s.email})")

if students.exists():
    student = students.first()
    print(f"\n=== Diagnostic check for {student.first_name} ===")
    
    from core.models import ListeningTestSession, ReadingTestSession, WritingTestSession
    
    l_diag = ListeningTestSession.objects.filter(user=student, is_diagnostic=True).exists()
    r_diag = ReadingTestSession.objects.filter(user=student, is_diagnostic=True).exists()
    w_diag = WritingTestSession.objects.filter(user=student, is_diagnostic=True).exists()
    
    print(f"Listening diagnostic: {l_diag}")
    print(f"Reading diagnostic: {r_diag}")
    print(f"Writing diagnostic: {w_diag}")
    
    l_regular = ListeningTestSession.objects.filter(user=student, submitted=True, is_diagnostic=False).exists()
    r_regular = ReadingTestSession.objects.filter(user=student, completed=True, is_diagnostic=False).exists()
    w_regular = WritingTestSession.objects.filter(user=student, completed=True, is_diagnostic=False).exists()
    
    locked = l_regular or r_regular or w_regular
    print(f"Diagnostic locked (has regular tests): {locked}")


