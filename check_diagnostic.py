import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ielts_platform.settings')
django.setup()

from core.models import ListeningTest, ReadingTest, WritingTest

print("=== CHECK DIAGNOSTIC TEMPLATES ===")

listening_tests = ListeningTest.objects.filter(is_active=True)
print(f"\nAll active Listening tests ({listening_tests.count()}):")
for t in listening_tests:
    print(f"  ID: {t.id}, Title: {t.title}, is_diagnostic_template: {t.is_diagnostic_template}")

reading_tests = ReadingTest.objects.filter(is_active=True)
print(f"\nAll active Reading tests ({reading_tests.count()}):")
for t in reading_tests:
    print(f"  ID: {t.id}, Title: {t.title}, is_diagnostic_template: {t.is_diagnostic_template}")

writing_tests = WritingTest.objects.filter(is_active=True)
print(f"\nAll active Writing tests ({writing_tests.count()}):")
for t in writing_tests:
    print(f"  ID: {t.id}, Title: {t.title}, is_diagnostic_template: {t.is_diagnostic_template}")

print("\n=== Regular tests (without diagnostic) ===")
listening_regular = listening_tests.filter(is_diagnostic_template=False)
reading_regular = reading_tests.filter(is_diagnostic_template=False) 
writing_regular = writing_tests.filter(is_diagnostic_template=False)

print(f"Regular Listening: {listening_regular.count()}")
print(f"Regular Reading: {reading_regular.count()}")
print(f"Regular Writing: {writing_regular.count()}")


