#!/usr/bin/env python
import os
import sys
import django

# Настройка Django
sys.path.append('/home/mastereduadmin/ielts-platform/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ielts_platform.settings')
django.setup()

from core.models import ReadingTestSession, ReadingTest
from core.serializers import create_detailed_breakdown

print("=== DEBUGGING READING TEST ANSWERS ===")

# Найдем тест 7
try:
    test = ReadingTest.objects.get(id=7)
    print(f"✅ Found test: {test.title}")
except ReadingTest.DoesNotExist:
    print("❌ Test 7 not found")
    exit(1)

# Найдем последнюю сессию для этого теста
sessions = ReadingTestSession.objects.filter(test=test).order_by('-start_time')
if not sessions.exists():
    print("❌ No sessions found for test 7")
    exit(1)

session = sessions.first()
print(f"✅ Found session: {session.id}")
print(f"✅ Session completed: {session.completed}")
print(f"✅ Session answers: {session.answers}")
print(f"✅ Answers type: {type(session.answers)}")

if session.answers:
    print(f"✅ Answers keys: {list(session.answers.keys())}")
    for key, value in session.answers.items():
        print(f"  - {key}: {value} (type: {type(value)})")
else:
    print("❌ No answers in session")

print("\n=== TESTING create_detailed_breakdown ===")
try:
    result = create_detailed_breakdown(session, 'reading')
    print(f"✅ Breakdown created successfully")
    print(f"✅ Raw score: {result['raw_score']}")
    print(f"✅ Total score: {result['total_score']}")
    print(f"✅ Breakdown parts: {len(result['breakdown'])}")
    
    # Проверим первый вопрос
    if result['breakdown']:
        first_part = result['breakdown'][0]
        print(f"✅ First part: {first_part['part_number']}")
        if first_part['questions']:
            first_question = first_part['questions'][0]
            print(f"✅ First question: {first_question['question_id']} ({first_question['question_type']})")
            print(f"✅ First question sub_questions: {len(first_question['sub_questions'])}")
            if first_question['sub_questions']:
                first_sub = first_question['sub_questions'][0]
                print(f"✅ First sub-question:")
                print(f"  - sub_id: {first_sub['sub_id']}")
                print(f"  - label: {first_sub['label']}")
                print(f"  - user_answer: {first_sub['user_answer']}")
                print(f"  - correct_answer: {first_sub['correct_answer']}")
                print(f"  - is_correct: {first_sub['is_correct']}")
    
except Exception as e:
    print(f"❌ Error in create_detailed_breakdown: {e}")
    import traceback
    traceback.print_exc()

print("\n=== DEBUGGING COMPLETE ===")
