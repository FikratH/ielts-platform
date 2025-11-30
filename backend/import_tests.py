#!/usr/bin/env python3
"""
Скрипт для импорта Listening и Reading тестов из архива.
Использование: python import_tests.py export_data.zip [--overwrite] [--dry-run]
"""

import os
import sys
import json
import shutil
import zipfile
import argparse
from datetime import datetime
from pathlib import Path

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ielts_platform.settings')

import django
django.setup()

from core.models import (
    ListeningTest, ListeningPart, ListeningQuestion, ListeningAnswerOption,
    ReadingTest, ReadingPart, ReadingQuestion, ReadingAnswerOption
)
from django.db import transaction
from django.core.files.storage import default_storage

class TestImporter:
    def __init__(self, archive_path, overwrite=False, dry_run=False):
        self.archive_path = Path(archive_path)
        self.overwrite = overwrite
        self.dry_run = dry_run
        self.temp_dir = Path("temp_import")
        self.import_data = None
        self.stats = {
            'listening_imported': 0,
            'reading_imported': 0,
            'listening_skipped': 0,
            'reading_skipped': 0,
            'media_copied': 0,
            'errors': []
        }
    
    def setup_temp_directory(self):
        """Создает временную директорию и извлекает архив"""
        if self.temp_dir.exists():
            shutil.rmtree(self.temp_dir)
        
        print(f"📦 Извлекаю архив: {self.archive_path}")
        
        with zipfile.ZipFile(self.archive_path, 'r') as zipf:
            zipf.extractall(self.temp_dir)
        
        # Читаем JSON с данными
        json_path = self.temp_dir / "test_data.json"
        if not json_path.exists():
            raise FileNotFoundError("test_data.json не найден в архиве!")
        
        with open(json_path, 'r', encoding='utf-8') as f:
            self.import_data = json.load(f)
        
        print(f"   ✅ Архив извлечен")
        print(f"   📊 Listening тестов: {len(self.import_data['listening_tests'])}")
        print(f"   📊 Reading тестов: {len(self.import_data['reading_tests'])}")
        print(f"   📊 Медиа файлов: {len(self.import_data['media_files'])}")
    
    def copy_media_files(self):
        """Копирует медиа файлы из архива в media директорию"""
        if self.dry_run:
            print("🔍 [DRY RUN] Пропускаю копирование медиа файлов")
            return
        
        print("📁 Копирую медиа файлы...")
        
        media_source = self.temp_dir / "media"
        media_dest = Path("media")
        
        if not media_source.exists():
            print("   ⚠️  Медиа файлы не найдены в архиве")
            return
        
        copied_count = 0
        for file_path in self.import_data['media_files']:
            source = media_source / file_path
            dest = media_dest / file_path
            
            if source.exists():
                # Создаем директорию если не существует
                dest.parent.mkdir(parents=True, exist_ok=True)
                
                if not dest.exists() or self.overwrite:
                    shutil.copy2(source, dest)
                    copied_count += 1
                    print(f"   📄 {file_path}")
                else:
                    print(f"   ⏭️  Пропущено (уже существует): {file_path}")
            else:
                print(f"   ❌ Не найден в архиве: {file_path}")
        
        self.stats['media_copied'] = copied_count
        print(f"   ✅ Скопировано файлов: {copied_count}")
    
    def import_listening_test(self, test_data):
        """Импортирует один Listening тест"""
        test_title = test_data['title']
        original_id = test_data['id']
        
        # Проверяем существует ли тест
        existing_test = ListeningTest.objects.filter(title=test_title).first()
        
        if existing_test and not self.overwrite:
            print(f"   ⏭️  Пропущен (уже существует): {test_title}")
            self.stats['listening_skipped'] += 1
            return
        
        if self.dry_run:
            print(f"   🔍 [DRY RUN] Будет импортирован: {test_title}")
            return
        
        try:
            with transaction.atomic():
                # Создаем или обновляем тест
                if existing_test and self.overwrite:
                    print(f"   🔄 Перезаписываю: {test_title}")
                    test = existing_test
                    # Удаляем существующие части (каскадно удалится все остальное)
                    test.parts.all().delete()
                else:
                    print(f"   ➕ Создаю новый: {test_title}")
                    test = ListeningTest()
                
                # Заполняем данные теста
                test.title = test_data['title']
                test.description = test_data['description']
                test.is_active = test_data['is_active']
                test.save()
                
                # Импортируем части теста
                for part_data in test_data['parts']:
                    part = ListeningPart.objects.create(
                        test=test,
                        part_number=part_data['part_number'],
                        audio=part_data.get('audio', ''),
                        audio_duration=part_data['audio_duration'],
                        instructions=part_data['instructions']
                    )
                    
                    # Импортируем вопросы
                    for question_data in part_data['questions']:
                        question = ListeningQuestion.objects.create(
                            part=part,
                            order=question_data['order'],
                            question_type=question_data.get('question_type'),
                            question_text=question_data.get('question_text'),
                            extra_data=question_data.get('extra_data', {}),
                            correct_answers=question_data.get('correct_answers', []),
                            header=question_data.get('header', ''),
                            instruction=question_data.get('instruction', ''),
                            image=question_data.get('image'),
                            points=question_data.get('points', 1),
                            scoring_mode=question_data.get('scoring_mode', 'total')
                        )
                        
                        # Импортируем варианты ответов
                        for option_data in question_data['options']:
                            ListeningAnswerOption.objects.create(
                                question=question,
                                label=option_data['label'],
                                text=option_data['text'],
                                points=option_data.get('points', 1)
                            )
                
                self.stats['listening_imported'] += 1
                print(f"   ✅ Импортирован: {test_title}")
                
        except Exception as e:
            error_msg = f"Ошибка импорта Listening теста '{test_title}': {str(e)}"
            print(f"   ❌ {error_msg}")
            self.stats['errors'].append(error_msg)
    
    def import_reading_test(self, test_data):
        """Импортирует один Reading тест"""
        test_title = test_data['title']
        original_id = test_data['id']
        
        # Проверяем существует ли тест
        existing_test = ReadingTest.objects.filter(title=test_title).first()
        
        if existing_test and not self.overwrite:
            print(f"   ⏭️  Пропущен (уже существует): {test_title}")
            self.stats['reading_skipped'] += 1
            return
        
        if self.dry_run:
            print(f"   🔍 [DRY RUN] Будет импортирован: {test_title}")
            return
        
        try:
            with transaction.atomic():
                # Создаем или обновляем тест
                if existing_test and self.overwrite:
                    print(f"   🔄 Перезаписываю: {test_title}")
                    test = existing_test
                    # Удаляем существующие части (каскадно удалится все остальное)
                    test.parts.all().delete()
                else:
                    print(f"   ➕ Создаю новый: {test_title}")
                    test = ReadingTest()
                
                # Заполняем данные теста
                test.title = test_data['title']
                test.description = test_data['description']
                test.time_limit = test_data['time_limit']
                test.total_points = test_data['total_points']
                test.is_active = test_data['is_active']
                test.save()
                
                # Импортируем части теста
                for part_data in test_data['parts']:
                    part = ReadingPart.objects.create(
                        test=test,
                        part_number=part_data['part_number'],
                        title=part_data['title'],
                        instructions=part_data['instructions'],
                        passage_text=part_data['passage_text'],
                        passage_image_url=part_data.get('passage_image_url'),
                        order=part_data['order']
                    )
                    
                    # Импортируем вопросы
                    for question_data in part_data['questions']:
                        question = ReadingQuestion.objects.create(
                            part=part,
                            order=question_data['order'],
                            question_type=question_data.get('question_type'),
                            header=question_data.get('header', ''),
                            instruction=question_data.get('instruction', ''),
                            image_url=question_data.get('image_url'),
                            question_text=question_data.get('question_text'),
                            points=question_data.get('points', 1),
                            correct_answers=question_data.get('correct_answers', []),
                            extra_data=question_data.get('extra_data', {}),
                            reading_scoring_type=question_data.get('reading_scoring_type', 'all_or_nothing')
                        )
                        
                        # Импортируем варианты ответов
                        for option_data in question_data['answer_options']:
                            ReadingAnswerOption.objects.create(
                                question=question,
                                label=option_data['label'],
                                text=option_data['text'],
                                image_url=option_data.get('image_url'),
                                is_correct=option_data.get('is_correct', False),
                                reading_points=option_data.get('reading_points', 1)
                            )
                
                self.stats['reading_imported'] += 1
                print(f"   ✅ Импортирован: {test_title}")
                
        except Exception as e:
            error_msg = f"Ошибка импорта Reading теста '{test_title}': {str(e)}"
            print(f"   ❌ {error_msg}")
            self.stats['errors'].append(error_msg)
    
    def import_listening_tests(self):
        """Импортирует все Listening тесты"""
        listening_tests = self.import_data['listening_tests']
        if not listening_tests:
            print("📻 Listening тестов не найдено")
            return
        
        print(f"📻 Импортирую {len(listening_tests)} Listening тестов...")
        
        for test_data in listening_tests:
            self.import_listening_test(test_data)
    
    def import_reading_tests(self):
        """Импортирует все Reading тесты"""
        reading_tests = self.import_data['reading_tests']
        if not reading_tests:
            print("📖 Reading тестов не найдено")
            return
        
        print(f"📖 Импортирую {len(reading_tests)} Reading тестов...")
        
        for test_data in reading_tests:
            self.import_reading_test(test_data)
    
    def cleanup(self):
        """Очищает временные файлы"""
        if self.temp_dir.exists():
            shutil.rmtree(self.temp_dir)
    
    def print_summary(self):
        """Выводит итоговую статистику"""
        print("=" * 50)
        if self.dry_run:
            print("🔍 РЕЗУЛЬТАТ DRY RUN:")
        else:
            print("✅ ИМПОРТ ЗАВЕРШЕН!")
        
        print(f"📊 Listening тестов импортировано: {self.stats['listening_imported']}")
        print(f"📊 Listening тестов пропущено: {self.stats['listening_skipped']}")
        print(f"📊 Reading тестов импортировано: {self.stats['reading_imported']}")
        print(f"📊 Reading тестов пропущено: {self.stats['reading_skipped']}")
        print(f"📊 Медиа файлов скопировано: {self.stats['media_copied']}")
        
        if self.stats['errors']:
            print(f"❌ Ошибок: {len(self.stats['errors'])}")
            for error in self.stats['errors']:
                print(f"   - {error}")
        else:
            print("✅ Без ошибок!")
    
    def import_all(self):
        """Основной метод импорта"""
        print("🚀 ИМПОРТ IELTS ТЕСТОВ")
        print("=" * 50)
        
        if not self.archive_path.exists():
            raise FileNotFoundError(f"Архив не найден: {self.archive_path}")
        
        try:
            self.setup_temp_directory()
            
            # Показываем информацию о экспорте
            metadata = self.import_data.get('metadata', {})
            export_date = metadata.get('export_date', 'неизвестно')
            print(f"📅 Дата экспорта: {export_date}")
            
            if metadata.get('missing_files'):
                print(f"⚠️  В экспорте отсутствовали файлы: {len(metadata['missing_files'])}")
            
            self.copy_media_files()
            self.import_listening_tests()
            self.import_reading_tests()
            
        finally:
            self.cleanup()
        
        self.print_summary()

def main():
    parser = argparse.ArgumentParser(description='Импорт IELTS тестов из архива')
    parser.add_argument('archive', help='Путь к ZIP архиву с тестами')
    parser.add_argument('--overwrite', action='store_true', 
                       help='Перезаписать существующие тесты с тем же названием')
    parser.add_argument('--dry-run', action='store_true',
                       help='Показать что будет импортировано без реального импорта')
    
    args = parser.parse_args()
    
    if args.dry_run:
        print("🔍 РЕЖИМ DRY RUN - реальный импорт не будет выполнен")
        print()
    
    importer = TestImporter(args.archive, args.overwrite, args.dry_run)
    importer.import_all()

if __name__ == "__main__":
    main()

