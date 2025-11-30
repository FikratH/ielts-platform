#!/usr/bin/env python3
"""
Script to mark specific tests as diagnostic templates.
Run this script to set up diagnostic test templates.
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ielts_platform.settings')
django.setup()

from core.models import ListeningTest, ReadingTest, WritingTest

def mark_diagnostic_templates():
    """Mark tests as diagnostic templates"""
    
    print("=== Marking Diagnostic Templates ===")
    
    # Listening
    listening_tests = ListeningTest.objects.filter(is_active=True).exclude(is_diagnostic_template=True)
    if listening_tests.exists():
        print(f"Found {listening_tests.count()} active listening tests:")
        for i, test in enumerate(listening_tests):
            print(f"  {i+1}. ID: {test.id}, Title: {test.title}")
        
        choice = input(f"\nWhich listening test ID do you want to mark as diagnostic template? (1-{listening_tests.count()}): ")
        try:
            selected_idx = int(choice) - 1
            if 0 <= selected_idx < len(listening_tests):
                selected_test = listening_tests[selected_idx]
                selected_test.is_diagnostic_template = True
                selected_test.save()
                print(f"✅ Marked listening test '{selected_test.title}' (ID: {selected_test.id}) as diagnostic template")
            else:
                print("❌ Invalid choice")
        except ValueError:
            print("❌ Invalid input")
    else:
        print("ℹ️ No active listening tests found")
    
    print()
    
    # Reading
    reading_tests = ReadingTest.objects.filter(is_active=True).exclude(is_diagnostic_template=True)
    if reading_tests.exists():
        print(f"Found {reading_tests.count()} active reading tests:")
        for i, test in enumerate(reading_tests):
            print(f"  {i+1}. ID: {test.id}, Title: {test.title}")
        
        choice = input(f"\nWhich reading test ID do you want to mark as diagnostic template? (1-{reading_tests.count()}): ")
        try:
            selected_idx = int(choice) - 1
            if 0 <= selected_idx < len(reading_tests):
                selected_test = reading_tests[selected_idx]
                selected_test.is_diagnostic_template = True
                selected_test.save()
                print(f"✅ Marked reading test '{selected_test.title}' (ID: {selected_test.id}) as diagnostic template")
            else:
                print("❌ Invalid choice")
        except ValueError:
            print("❌ Invalid input")
    else:
        print("ℹ️ No active reading tests found")
    
    print()
    
    # Writing
    writing_tests = WritingTest.objects.filter(is_active=True).exclude(is_diagnostic_template=True)
    if writing_tests.exists():
        print(f"Found {writing_tests.count()} active writing tests:")
        for i, test in enumerate(writing_tests):
            print(f"  {i+1}. ID: {test.id}, Title: {test.title}")
        
        choice = input(f"\nWhich writing test ID do you want to mark as diagnostic template? (1-{writing_tests.count()}): ")
        try:
            selected_idx = int(choice) - 1
            if 0 <= selected_idx < len(writing_tests):
                selected_test = writing_tests[selected_idx]
                selected_test.is_diagnostic_template = True
                selected_test.save()
                print(f"✅ Marked writing test '{selected_test.title}' (ID: {selected_test.id}) as diagnostic template")
            else:
                print("❌ Invalid choice")
        except ValueError:
            print("❌ Invalid input!")
    else:
        print("ℹ️ No active writing tests found")
    
    print("\n=== Summary ===")
    diagnostic_listening = ListeningTest.objects.filter(is_diagnostic_template=True).count()
    diagnostic_reading = ReadingTest.objects.filter(is_diagnostic_template=True).count()
    diagnostic_writing = WritingTest.objects.filter(is_diagnostic_template=True).count()
    
    print(f"Diagnostic Templates:")
    print(f"  Listening: {diagnostic_listening}")
    print(f"  Reading: {diagnostic_reading}")
    print(f"  Writing: {diagnostic_writing}")
    
    if diagnostic_listening and diagnostic_reading and diagnostic_writing:
        print("\n🎯 All diagnostic templates are set up! Students can now take diagnostic tests.")
    else:
        print("\n⚠️ Please mark tests as diagnostic templates for all modules.")

if __name__ == "__main__":
    mark_diagnostic_templates()

