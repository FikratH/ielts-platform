import os
import sys
import json
import shutil
import zipfile
from pathlib import Path
from django.db import transaction
from django.core.files import File

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ielts_platform.settings')
import django
django.setup()

from core.models import (
    ListeningTest, ListeningPart, ListeningQuestion, ListeningAnswerOption,
    ReadingTest, ReadingPart, ReadingQuestion, ReadingAnswerOption
)

SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent
ZIP_FILE = SCRIPT_DIR / 'my_tests_export.zip'
MEDIA_DEST = SCRIPT_DIR / 'media' / 'secure_audio'

def extract_from_zip():
    print("Extracting files from zip archive...")
    
    if not ZIP_FILE.exists():
        print(f"Error: Zip file not found at {ZIP_FILE}")
        return None, None
    
    try:
        with zipfile.ZipFile(ZIP_FILE, 'r') as zip_ref:
            print(f"  Opened zip file: {ZIP_FILE.name}")
            
            json_data = None
            if 'test_data.json' in zip_ref.namelist():
                print("  Reading test_data.json from zip...")
                json_data = json.loads(zip_ref.read('test_data.json').decode('utf-8'))
                print("  ✓ JSON loaded successfully")
            else:
                print("  ERROR: test_data.json not found in zip archive")
                return None, None
            
            MEDIA_DEST.mkdir(parents=True, exist_ok=True)
            copied = 0
            skipped = 0
            
            audio_files = [f for f in zip_ref.namelist() if f.startswith('media123/secure_audio/') and f.endswith('.mp3')]
            
            print(f"  Found {len(audio_files)} audio files in zip")
            
            for audio_path in audio_files:
                filename = os.path.basename(audio_path)
                dest_file = MEDIA_DEST / filename
                
                if dest_file.exists():
                    print(f"  Skipping {filename} (already exists)")
                    skipped += 1
                else:
                    print(f"  Extracting {filename}...")
                    with zip_ref.open(audio_path) as source:
                        with open(dest_file, 'wb') as target:
                            shutil.copyfileobj(source, target)
                    copied += 1
            
            print(f"Audio files: {copied} copied, {skipped} skipped")
            return json_data, True
            
    except zipfile.BadZipFile:
        print(f"  ERROR: {ZIP_FILE.name} is not a valid zip file")
        return None, None
    except Exception as e:
        print(f"  ERROR extracting from zip: {e}")
        import traceback
        traceback.print_exc()
        return None, None

def restore_listening_test(test_data):
    title = test_data.get('title')
    if not title:
        print(f"  ERROR: Test data missing title, skipping...")
        return None
    
    if ListeningTest.objects.filter(title=title).exists():
        print(f"  SKIPPING test '{title}' (already exists, not touching existing data)")
        return None
    
    with transaction.atomic():
        test = ListeningTest.objects.create(
            title=title,
            description=test_data.get('description', ''),
            is_active=test_data.get('is_active', False),
            explanation_url=test_data.get('explanation_url') or None,
            is_diagnostic_template=test_data.get('is_diagnostic_template', False),
        )
        
        print(f"  Creating test: {test.title}")
        
        for part_data in test_data.get('parts', []):
            if not isinstance(part_data, dict):
                continue
            if 'part_number' not in part_data:
                print(f"    WARNING: Part missing part_number, skipping...")
                continue
            
            try:
                part_number_val = part_data['part_number']
                if part_number_val is None:
                    print(f"    WARNING: Part part_number is None, skipping...")
                    continue
                part_number_val = int(part_number_val)
                
                part = ListeningPart.objects.create(
                    test=test,
                    part_number=part_number_val,
                    audio=part_data.get('audio', '') or '',
                    audio_duration=float(part_data.get('audio_duration', 0.0)),
                    instructions=part_data.get('instructions', '')
                )
            except (ValueError, TypeError) as e:
                print(f"    ERROR creating part {part_data.get('part_number', '?')}: {e}")
                continue
            
            for question_data in part_data.get('questions', []):
                if not isinstance(question_data, dict):
                    continue
                
                extra_data = question_data.get('extra_data')
                if extra_data is None:
                    extra_data = {}
                elif not isinstance(extra_data, dict):
                    extra_data = {}
                
                correct_answers = question_data.get('correct_answers')
                if correct_answers is None:
                    correct_answers = []
                elif not isinstance(correct_answers, list):
                    correct_answers = []
                
                try:
                    points_val = question_data.get('points', 1)
                    if points_val is None:
                        points_val = 1
                    else:
                        points_val = int(points_val)
                    
                    order_val = question_data.get('order', 1)
                    if order_val is None:
                        order_val = 1
                    else:
                        order_val = int(order_val)
                    
                    question = ListeningQuestion.objects.create(
                        part=part,
                        order=order_val,
                        question_type=question_data.get('question_type') or None,
                        question_text=question_data.get('question_text') or None,
                        task_prompt=question_data.get('task_prompt', ''),
                        extra_data=extra_data,
                        correct_answers=correct_answers,
                        header=question_data.get('header', ''),
                        instruction=question_data.get('instruction', ''),
                        image=question_data.get('image') or None,
                        points=points_val,
                        scoring_mode=question_data.get('scoring_mode', 'total')
                    )
                except (ValueError, TypeError) as e:
                    print(f"      ERROR creating question: {e}")
                    continue
                
                for option_data in question_data.get('options', []):
                    if not isinstance(option_data, dict):
                        continue
                    label = option_data.get('label', '')
                    text = option_data.get('text', '')
                    if not label and not text:
                        continue
                    try:
                        points_val = option_data.get('points', 1)
                        if points_val is None:
                            points_val = 1
                        else:
                            points_val = int(points_val)
                        
                        ListeningAnswerOption.objects.create(
                            question=question,
                            label=str(label) or '',
                            text=str(text) or '',
                            points=points_val
                        )
                    except (ValueError, TypeError) as e:
                        print(f"        ERROR creating option: {e}")
                        continue
        
        return test

def restore_reading_test(test_data):
    title = test_data.get('title')
    if not title:
        print(f"  ERROR: Test data missing title, skipping...")
        return None
    
    if ReadingTest.objects.filter(title=title).exists():
        print(f"  SKIPPING test '{title}' (already exists, not touching existing data)")
        return None
    
    with transaction.atomic():
        test = ReadingTest.objects.create(
            title=title,
            description=test_data.get('description', ''),
            time_limit=test_data.get('time_limit', 60),
            total_points=test_data.get('total_points', 0),
            is_active=test_data.get('is_active', False),
            explanation_url=test_data.get('explanation_url') or None,
            is_diagnostic_template=test_data.get('is_diagnostic_template', False),
        )
        
        print(f"  Creating test: {test.title}")
        
        for part_data in test_data.get('parts', []):
            if not isinstance(part_data, dict):
                continue
            if 'part_number' not in part_data:
                print(f"    WARNING: Part missing part_number, skipping...")
                continue
            
            try:
                part_number_val = part_data['part_number']
                if part_number_val is None:
                    print(f"    WARNING: Part part_number is None, skipping...")
                    continue
                part_number_val = int(part_number_val)
                
                order_val = part_data.get('order')
                if order_val is None:
                    order_val = part_number_val
                else:
                    order_val = int(order_val)
                
                part = ReadingPart.objects.create(
                    test=test,
                    part_number=part_number_val,
                    title=part_data.get('title', ''),
                    instructions=part_data.get('instructions', ''),
                    passage_text=part_data.get('passage_text', ''),
                    passage_heading=part_data.get('passage_heading') or None,
                    passage_image_url=part_data.get('passage_image_url') or None,
                    order=order_val
                )
            except (ValueError, TypeError) as e:
                print(f"    ERROR creating part {part_data.get('part_number', '?')}: {e}")
                continue
            
            for question_data in part_data.get('questions', []):
                if not isinstance(question_data, dict):
                    continue
                
                extra_data = question_data.get('extra_data')
                if extra_data is None:
                    extra_data = {}
                elif not isinstance(extra_data, dict):
                    extra_data = {}
                
                correct_answers = question_data.get('correct_answers')
                if correct_answers is None:
                    correct_answers = []
                elif not isinstance(correct_answers, list):
                    correct_answers = []
                
                try:
                    points_val = question_data.get('points', 1.0)
                    if points_val is None:
                        points_val = 1.0
                    else:
                        points_val = float(points_val)
                    
                    order_val = question_data.get('order', 1)
                    if order_val is None:
                        order_val = 1
                    else:
                        order_val = int(order_val)
                    
                    question = ReadingQuestion.objects.create(
                        part=part,
                        order=order_val,
                        question_type=question_data.get('question_type') or None,
                        header=question_data.get('header', ''),
                        instruction=question_data.get('instruction', ''),
                        task_prompt=question_data.get('task_prompt', ''),
                        image_url=question_data.get('image_url') or None,
                        question_text=question_data.get('question_text') or None,
                        points=points_val,
                        correct_answers=correct_answers,
                        extra_data=extra_data,
                        reading_scoring_type=question_data.get('reading_scoring_type', 'all_or_nothing')
                    )
                except (ValueError, TypeError) as e:
                    print(f"      ERROR creating question: {e}")
                    continue
                
                for option_data in question_data.get('answer_options', []):
                    if not isinstance(option_data, dict):
                        continue
                    label = option_data.get('label', '')
                    text = option_data.get('text', '')
                    if not label and not text:
                        continue
                    try:
                        reading_points_val = option_data.get('reading_points', 1)
                        if reading_points_val is None:
                            reading_points_val = 1
                        else:
                            reading_points_val = int(reading_points_val)
                        
                        is_correct_val = option_data.get('is_correct', False)
                        if not isinstance(is_correct_val, bool):
                            is_correct_val = bool(is_correct_val)
                        
                        ReadingAnswerOption.objects.create(
                            question=question,
                            label=str(label) or '',
                            text=str(text) or '',
                            image_url=option_data.get('image_url') or None,
                            is_correct=is_correct_val,
                            reading_points=reading_points_val
                        )
                    except (ValueError, TypeError) as e:
                        print(f"        ERROR creating option: {e}")
                        continue
        
        return test

def main():
    print("=" * 60)
    print("Restoring Reading and Listening Tests")
    print("=" * 60)
    
    data, success = extract_from_zip()
    if not success or data is None:
        print("\nERROR: Failed to extract data from zip archive")
        sys.exit(1)
    
    print("\n" + "=" * 60)
    print("Restoring Listening Tests")
    print("=" * 60)
    
    listening_count = 0
    listening_skipped = 0
    for test_data in data.get('listening_tests', []):
        try:
            result = restore_listening_test(test_data)
            if result is not None:
                listening_count += 1
            else:
                listening_skipped += 1
        except Exception as e:
            print(f"  ERROR restoring listening test '{test_data.get('title', 'Unknown')}': {e}")
            import traceback
            traceback.print_exc()
    
    print(f"\nListening tests: {listening_count} created, {listening_skipped} skipped (already exist)")
    
    print("\n" + "=" * 60)
    print("Restoring Reading Tests")
    print("=" * 60)
    
    reading_count = 0
    reading_skipped = 0
    for test_data in data.get('reading_tests', []):
        try:
            result = restore_reading_test(test_data)
            if result is not None:
                reading_count += 1
            else:
                reading_skipped += 1
        except Exception as e:
            print(f"  ERROR restoring reading test '{test_data.get('title', 'Unknown')}': {e}")
            import traceback
            traceback.print_exc()
    
    print(f"\nReading tests: {reading_count} created, {reading_skipped} skipped (already exist)")
    
    print("\n" + "=" * 60)
    print("Restore Complete!")
    print("=" * 60)
    print(f"Listening tests: {listening_count} created, {listening_skipped} skipped")
    print(f"Reading tests: {reading_count} created, {reading_skipped} skipped")
    print("\nNote: Existing tests were NOT modified to preserve your data.")

if __name__ == '__main__':
    main()

