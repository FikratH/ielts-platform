#!/usr/bin/env python3
"""
Тест сериализаторов
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ielts_platform.settings')
django.setup()

from core.models import ListeningTest, ReadingTest
from core.serializers import ListeningTestReadSerializer, ReadingTestReadSerializer

def test_serializers():
    print("=== ТЕСТ СЕРИАЛИЗАТОРОВ ===")
    
    # Проверяем Listening тесты
    listening_tests = ListeningTest.objects.filter(is_active=True)
    print(f"Listening тестов: {listening_tests.count()}")
    
    for test in listening_tests:
        print(f"\n--- Listening Test ID: {test.id} ---")
        print(f"Title: {test.title}")
        print(f"Diagnostic: {test.is_diagnostic_template}")
        print(f"Parts: {test.parts.count()}")
        
        try:
            serializer = ListeningTestReadSerializer(test)
            data = serializer.data
            print(f"OK Сериализация OK - Parts в ответе: {len(data.get('parts', []))}")
        except Exception as e:
            print(f"ERROR ОШИБКА сериализации: {e}")
    
    # Проверяем Reading тесты
    reading_tests = ReadingTest.objects.filter(is_active=True)
    print(f"\nReading тестов: {reading_tests.count()}")
    
    for test in reading_tests:
        print(f"\n--- Reading Test ID: {test.id} ---")
        print(f"Title: {test.title}")
        print(f"Diagnostic: {test.is_diagnostic_template}")
        print(f"Parts: {test.parts.count()}")
        
        try:
            serializer = ReadingTestReadSerializer(test)
            data = serializer.data
            print(f"OK Сериализация OK - Parts в ответе: {len(data.get('parts', []))}")
        except Exception as e:
            print(f"ERROR ОШИБКА сериализации: {e}")
    
    # Проверяем диагностические тесты
    print(f"\n=== ДИАГНОСТИЧЕСКИЕ ТЕСТЫ ===")
    
    diagnostic_listening = ListeningTest.objects.filter(is_diagnostic_template=True)
    print(f"Диагностических Listening: {diagnostic_listening.count()}")
    for test in diagnostic_listening:
        print(f"  ID: {test.id}, Title: {test.title}")
    
    diagnostic_reading = ReadingTest.objects.filter(is_diagnostic_template=True)
    print(f"Диагностических Reading: {diagnostic_reading.count()}")
    for test in diagnostic_reading:
        print(f"  ID: {test.id}, Title: {test.title}")

if __name__ == "__main__":
    test_serializers()
