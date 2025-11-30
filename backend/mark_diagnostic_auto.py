#!/usr/bin/env python3
"""
Автоматический скрипт для пометки тестов как диагностические шаблоны
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ielts_platform.settings')
django.setup()

from core.models import ListeningTest, ReadingTest, WritingTest

def mark_diagnostic_auto():
    """Автоматически помечает первый доступный тест каждого типа как диагностический"""
    
    print("=== Автоматическая пометка диагностических шаблонов ===")
    
    # Listening
    listening_tests = ListeningTest.objects.filter(is_active=True).exclude(is_diagnostic_template=True)
    if listening_tests.exists():
        test = listening_tests.first()
        test.is_diagnostic_template = True
        test.save()
        print(f"✅ Listening: '{test.title}' (ID: {test.id})")
    else:
        print("ℹ️ Listening: нет доступных тестов")
    
    # Reading
    reading_tests = ReadingTest.objects.filter(is_active=True).exclude(is_diagnostic_template=True)
    if reading_tests.exists():
        test = reading_tests.first()
        test.is_diagnostic_template = True
        test.save()
        print(f"✅ Reading: '{test.title}' (ID: {test.id})")
    else:
        print("ℹ️ Reading: нет доступных тестов")
    
    # Writing
    writing_tests = WritingTest.objects.filter(is_active=True).exclude(is_diagnostic_template=True)
    if writing_tests.exists():
        test = writing_tests.first()
        test.is_diagnostic_template = True
        test.save()
        print(f"✅ Writing: '{test.title}' (ID: {test.id})")
    else:
        print("ℹ️ Writing: нет доступных тестов")
    
    print("\n=== Итоги ===")
    diagnostic_listening = ListeningTest.objects.filter(is_diagnostic_template=True).count()
    diagnostic_reading = ReadingTest.objects.filter(is_diagnostic_template=True).count()
    diagnostic_writing = WritingTest.objects.filter(is_diagnostic_template=True).count()
    
    print(f"Диагностические шаблоны:")
    print(f"  Listening: {diagnostic_listening}")
    print(f"  Reading: {diagnostic_reading}")
    print(f"  Writing: {diagnostic_writing}")
    
    if diagnostic_listening and diagnostic_reading and diagnostic_writing:
        print("\n🎯 Все диагностические шаблоны настроены!")
    else:
        print("\n⚠️ Нужно больше тестов для диагностики")

if __name__ == "__main__":
    mark_diagnostic_auto()


