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

def convert_multiple_choice_to_group(questions_list):
    """
    Преобразует последовательные multiple_choice вопросы в multiple_choice_group.
    Ищет паттерн: первый вопрос с header "Questions X–Y" или "Questions X and Y",
    за которым следуют вопросы с header "Question N".
    """
    if not questions_list:
        return questions_list
    
    result = []
    i = 0
    
    while i < len(questions_list):
        q = questions_list[i]
        if not isinstance(q, dict):
            result.append(q)
            i += 1
            continue
        
        if q.get('question_type') != 'multiple_choice':
            result.append(q)
            i += 1
            continue
        
        header = q.get('header', '')
        if not header:
            result.append(q)
            i += 1
            continue
        
        import re
        range_match = re.match(r'Questions?\s+(\d+)[–-](\d+)', header)
        pair_match = re.match(r'Questions?\s+(\d+)\s+and\s+(\d+)', header)
        
        if range_match or pair_match:
            if range_match:
                start_num = int(range_match.group(1))
                end_num = int(range_match.group(2))
            else:
                start_num = int(pair_match.group(1))
                end_num = int(pair_match.group(2))
            
            group_items = []
            group_header = header
            group_instruction = q.get('instruction', '')
            group_question_text = ''
            
            first_q_options = q.get('options', []) or q.get('extra_data', {}).get('options', [])
            first_q_correct = q.get('correct_answers', [])
            if not first_q_correct:
                answer = q.get('extra_data', {}).get('answer', '')
                if answer:
                    first_q_correct = [answer]
            
            if not first_q_options or not first_q_correct or not first_q_correct[0]:
                print(f"      WARNING: First question in group '{header}' missing options or correct_answer, skipping group creation")
                result.append(q)
                i += 1
                continue
            
            first_item = {
                'id': f'item-{start_num}',
                'prompt': q.get('question_text', '') or '',
                'correct_answer': str(first_q_correct[0]) if first_q_correct else 'A',
                'points': q.get('points', 1),
                'options': []
            }
            for opt in first_q_options:
                if isinstance(opt, dict):
                    first_item['options'].append({
                        'label': str(opt.get('label', '')),
                        'text': str(opt.get('text', ''))
                    })
            if first_item['options']:
                group_items.append(first_item)
            
            i += 1
            current_num = start_num + 1
            
            while i < len(questions_list) and current_num <= end_num:
                next_q = questions_list[i]
                if not isinstance(next_q, dict):
                    break
                
                if next_q.get('question_type') != 'multiple_choice':
                    break
                
                next_header = next_q.get('header', '')
                num_match = re.match(r'Question\s+(\d+)', next_header)
                
                if num_match and int(num_match.group(1)) == current_num:
                    options = next_q.get('options', []) or next_q.get('extra_data', {}).get('options', [])
                    correct = next_q.get('correct_answers', [])
                    if not correct:
                        answer = next_q.get('extra_data', {}).get('answer', '')
                        if answer:
                            correct = [answer]
                    
                    if options and correct and correct[0]:
                        item = {
                            'id': f'item-{current_num}',
                            'prompt': next_q.get('question_text', '') or '',
                            'correct_answer': str(correct[0]) if correct else 'A',
                            'points': next_q.get('points', 1),
                            'options': []
                        }
                        for opt in options:
                            if isinstance(opt, dict):
                                item['options'].append({
                                    'label': str(opt.get('label', '')),
                                    'text': str(opt.get('text', ''))
                                })
                        if item['options']:
                            group_items.append(item)
                    i += 1
                    current_num += 1
                else:
                    break
            
            if len(group_items) >= 2:
                group_question = {
                    'question_type': 'multiple_choice_group',
                    'header': group_header,
                    'instruction': group_instruction,
                    'question_text': group_question_text or '',
                    'points': sum(item.get('points', 1) for item in group_items),
                    'scoring_mode': 'total',
                    'correct_answers': [],
                    'extra_data': {
                        'group_items': group_items
                    },
                    'options': []
                }
                result.append(group_question)
                print(f"      Converted {len(group_items)} multiple_choice questions to multiple_choice_group")
                # i уже увеличен внутри while цикла, цикл продолжается автоматически
            else:
                result.append(q)
                i += 1
        else:
            result.append(q)
            i += 1
    
    return result

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
        
        parts_list = test_data.get('parts', [])
        parts_list = sorted(parts_list, key=lambda x: x.get('part_number', 999) if isinstance(x, dict) else 999)
        
        for part_data in parts_list:
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
            
            questions_list = part_data.get('questions', [])
            questions_list = convert_multiple_choice_to_group(questions_list)
            
            orders = []
            for q in questions_list:
                if isinstance(q, dict):
                    order = q.get('order')
                    if order is not None:
                        try:
                            orders.append(int(order))
                        except (ValueError, TypeError):
                            pass
            
            use_index_order = len(set(orders)) <= 1 if orders else True
            
            for idx, question_data in enumerate(questions_list, start=1):
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
                    
                    if use_index_order:
                        order_val = idx
                    else:
                        order_val = question_data.get('order')
                        if order_val is None:
                            order_val = idx
                        else:
                            try:
                                order_val = int(order_val)
                                if order_val <= 0:
                                    order_val = idx
                            except (ValueError, TypeError):
                                order_val = idx
                    
                    question_type = question_data.get('question_type') or None
                    
                    if question_type == 'multiple_choice_group':
                        group_items = extra_data.get('group_items', [])
                        if not group_items:
                            print(f"      WARNING: multiple_choice_group has no group_items, skipping...")
                            continue
                        
                        question = ListeningQuestion.objects.create(
                            part=part,
                            order=order_val,
                            question_type=question_type,
                            question_text=question_data.get('question_text') or None,
                            task_prompt=question_data.get('task_prompt', ''),
                            extra_data=extra_data,
                            correct_answers=[],
                            header=question_data.get('header', ''),
                            instruction=question_data.get('instruction', ''),
                            image=question_data.get('image') or None,
                            points=points_val,
                            scoring_mode=question_data.get('scoring_mode', 'total')
                        )
                    else:
                        question = ListeningQuestion.objects.create(
                            part=part,
                            order=order_val,
                            question_type=question_type,
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
                        
                        for option_data in question_data.get('options', []):
                            if not isinstance(option_data, dict):
                                continue
                            label = option_data.get('label', '')
                            text = option_data.get('text', '')
                            if not label and not text:
                                continue
                            try:
                                opt_points = option_data.get('points', 1)
                                if opt_points is None:
                                    opt_points = 1
                                else:
                                    opt_points = int(opt_points)
                                
                                ListeningAnswerOption.objects.create(
                                    question=question,
                                    label=str(label) or '',
                                    text=str(text) or '',
                                    points=opt_points
                                )
                            except (ValueError, TypeError) as e:
                                print(f"        ERROR creating option: {e}")
                                continue
                except (ValueError, TypeError) as e:
                    print(f"      ERROR creating question: {e}")
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
        
        parts_list = test_data.get('parts', [])
        parts_list = sorted(parts_list, key=lambda x: x.get('part_number', 999) if isinstance(x, dict) else 999)
        
        for idx, part_data in enumerate(parts_list, start=1):
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
                    order_val = idx
                else:
                    try:
                        order_val = int(order_val)
                        if order_val <= 0:
                            order_val = idx
                    except (ValueError, TypeError):
                        order_val = idx
                
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
            
            questions_list = part_data.get('questions', [])
            questions_list = convert_multiple_choice_to_group(questions_list)
            
            orders = []
            for q in questions_list:
                if isinstance(q, dict):
                    order = q.get('order')
                    if order is not None:
                        try:
                            orders.append(int(order))
                        except (ValueError, TypeError):
                            pass
            
            use_index_order = len(set(orders)) <= 1 if orders else True
            
            for idx, question_data in enumerate(questions_list, start=1):
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
                    
                    if use_index_order:
                        order_val = idx
                    else:
                        order_val = question_data.get('order')
                        if order_val is None:
                            order_val = idx
                        else:
                            try:
                                order_val = int(order_val)
                                if order_val <= 0:
                                    order_val = idx
                            except (ValueError, TypeError):
                                order_val = idx
                    
                    question_type = question_data.get('question_type') or None
                    
                    if question_type == 'multiple_choice_group':
                        group_items = extra_data.get('group_items', [])
                        if not group_items:
                            print(f"      WARNING: multiple_choice_group has no group_items, skipping...")
                            continue
                        
                        question = ReadingQuestion.objects.create(
                            part=part,
                            order=order_val,
                            question_type=question_type,
                            header=question_data.get('header', ''),
                            instruction=question_data.get('instruction', ''),
                            task_prompt=question_data.get('task_prompt', ''),
                            image_url=question_data.get('image_url') or None,
                            question_text=question_data.get('question_text') or None,
                            points=points_val,
                            correct_answers=[],
                            extra_data=extra_data,
                            reading_scoring_type=question_data.get('reading_scoring_type', 'all_or_nothing')
                        )
                    else:
                        question = ReadingQuestion.objects.create(
                            part=part,
                            order=order_val,
                            question_type=question_type,
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
                except (ValueError, TypeError) as e:
                    print(f"      ERROR creating question: {e}")
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

