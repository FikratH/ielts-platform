import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ielts_platform.settings')
django.setup()

from core.models import ListeningTest, ReadingTest, WritingTest

print("=== LISTENING TESTS ===")
tests = ListeningTest.objects.filter(is_active=True).order_by('id')
for test in tests:
    print(f"ID: {test.id} | Title: {test.title} | Diagnostic: {test.is_diagnostic_template}")

print("\n=== READING TESTS ===")
tests = ReadingTest.objects.filter(is_active=True).order_by('id')
for test in tests:
    print(f"ID: {test.id} | Title: {test.title} | Diagnostic: {test.is_diagnostic_template}")

print("\n=== WRITING TESTS ===")
tests = WritingTest.objects.filter(is_active=True).order_by('id')
for test in tests:
    print(f"ID: {test.id} | Title: {test.title} | Diagnostic: {test.is_diagnostic_template}")

# Проверим что API возвращает
print("\n=== API SIMULATION ===")
listening_regular = [t for t in ListeningTest.objects.filter(is_active=True) if not t.is_diagnostic_template]
reading_regular = [t for t in ReadingTest.objects.filter(is_active=True) if not t.is_diagnostic_template]
writing_regular = [t for t in WritingTest.objects.filter(is_active=True) if not t.is_diagnostic_template]

print(f"Listening regular tests ({len(listening_regular)}):")
for t in listening_regular:
    print(f"  - {t.title}")
    
print(f"Reading regular tests ({len(reading_regular)}):")
for t in reading_regular:
    print(f"  - {t.title}")


