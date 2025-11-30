#!/usr/bin/env python3
"""
Скрипт для экспорта Listening и Reading тестов с медиа файлами.
Использование: python export_tests.py [--listening] [--reading] [--test-ids 1,2,3] [--output export_data.zip]
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
from django.core.serializers import serialize
from django.core.files.storage import default_storage

class TestExporter:
    def __init__(self, output_path="test_export.zip"):
        self.output_path = output_path
        self.temp_dir = Path("temp_export")
        self.media_files = set()  # Уникальные медиа файлы
        self.export_data = {
            'metadata': {
                'export_date': datetime.now().isoformat(),
                'django_version': django.VERSION,
                'exported_by': 'test_export_script'
            },
            'listening_tests': [],
            'reading_tests': [],
            'media_files': []
        }
    
    def setup_temp_directory(self):
        """Создает временную директорию для экспорта"""
        if self.temp_dir.exists():
            shutil.rmtree(self.temp_dir)
        self.temp_dir.mkdir(parents=True)
        (self.temp_dir / "media").mkdir()
        (self.temp_dir / "media" / "listening_audio").mkdir()
        (self.temp_dir / "media" / "listening_images").mkdir()
        (self.temp_dir / "media" / "reading_images").mkdir()
        (self.temp_dir / "media" / "secure_audio").mkdir()
    
    def collect_media_file(self, file_path):
        """Добавляет медиа файл в список для копирования"""
        if file_path and file_path.strip():
            # Убираем /media/ из начала пути если есть
            clean_path = file_path.replace('/media/', '').strip()
            if clean_path:
                self.media_files.add(clean_path)
                return clean_path
        return None
    
    def export_listening_tests(self, test_ids=None):
        """Экспортирует Listening тесты"""
        print("📻 Экспортирую Listening тесты...")
        
        if test_ids:
            listening_tests = ListeningTest.objects.filter(id__in=test_ids)
        else:
            listening_tests = ListeningTest.objects.filter(is_active=True)
        
        for test in listening_tests:
            print(f"   📝 {test.title} (ID: {test.id})")
            
            test_data = {
                'id': test.id,
                'title': test.title,
                'description': test.description,
                'is_active': test.is_active,
                'created_at': test.created_at.isoformat(),
                'updated_at': test.updated_at.isoformat(),
                'parts': []
            }
            
            # Экспортируем части теста
            for part in test.parts.all().order_by('part_number'):
                # Собираем медиа файлы
                audio_file = self.collect_media_file(part.audio)
                
                part_data = {
                    'part_number': part.part_number,
                    'audio': audio_file,
                    'audio_duration': part.audio_duration,
                    'instructions': part.instructions,
                    'created_at': part.created_at.isoformat(),
                    'updated_at': part.updated_at.isoformat(),
                    'questions': []
                }
                
                # Экспортируем вопросы
                for question in part.questions.all().order_by('order'):
                    # Собираем медиа файлы
                    image_file = self.collect_media_file(question.image)
                    
                    question_data = {
                        'order': question.order,
                        'question_type': question.question_type,
                        'question_text': question.question_text,
                        'extra_data': question.extra_data,
                        'correct_answers': question.correct_answers,
                        'header': question.header,
                        'instruction': question.instruction,
                        'image': image_file,
                        'points': question.points,
                        'scoring_mode': question.scoring_mode,
                        'created_at': question.created_at.isoformat(),
                        'updated_at': question.updated_at.isoformat(),
                        'options': []
                    }
                    
                    # Экспортируем варианты ответов
                    for option in question.options.all():
                        option_data = {
                            'label': option.label,
                            'text': option.text,
                            'points': option.points
                        }
                        question_data['options'].append(option_data)
                    
                    part_data['questions'].append(question_data)
                
                test_data['parts'].append(part_data)
            
            self.export_data['listening_tests'].append(test_data)
        
        print(f"   ✅ Экспортировано {len(listening_tests)} Listening тестов")
    
    def export_reading_tests(self, test_ids=None):
        """Экспортирует Reading тесты"""
        print("📖 Экспортирую Reading тесты...")
        
        if test_ids:
            reading_tests = ReadingTest.objects.filter(id__in=test_ids)
        else:
            reading_tests = ReadingTest.objects.filter(is_active=True)
        
        for test in reading_tests:
            print(f"   📝 {test.title} (ID: {test.id})")
            
            test_data = {
                'id': test.id,
                'title': test.title,
                'description': test.description,
                'time_limit': test.time_limit,
                'total_points': test.total_points,
                'is_active': test.is_active,
                'created_at': test.created_at.isoformat(),
                'updated_at': test.updated_at.isoformat(),
                'parts': []
            }
            
            # Экспортируем части теста
            for part in test.parts.all().order_by('order'):
                # Собираем медиа файлы
                image_file = self.collect_media_file(part.passage_image_url)
                
                part_data = {
                    'part_number': part.part_number,
                    'title': part.title,
                    'instructions': part.instructions,
                    'passage_text': part.passage_text,
                    'passage_image_url': image_file,
                    'order': part.order,
                    'created_at': part.created_at.isoformat(),
                    'updated_at': part.updated_at.isoformat(),
                    'questions': []
                }
                
                # Экспортируем вопросы
                for question in part.questions.all().order_by('order'):
                    # Собираем медиа файлы
                    image_file = self.collect_media_file(question.image_url)
                    
                    question_data = {
                        'order': question.order,
                        'question_type': question.question_type,
                        'header': question.header,
                        'instruction': question.instruction,
                        'image_url': image_file,
                        'question_text': question.question_text,
                        'points': question.points,
                        'correct_answers': question.correct_answers,
                        'extra_data': question.extra_data,
                        'reading_scoring_type': question.reading_scoring_type,
                        'created_at': question.created_at.isoformat(),
                        'updated_at': question.updated_at.isoformat(),
                        'answer_options': []
                    }
                    
                    # Экспортируем варианты ответов
                    for option in question.answer_options.all():
                        # Собираем медиа файлы
                        option_image = self.collect_media_file(option.image_url)
                        
                        option_data = {
                            'label': option.label,
                            'text': option.text,
                            'image_url': option_image,
                            'is_correct': option.is_correct,
                            'reading_points': option.reading_points
                        }
                        question_data['answer_options'].append(option_data)
                    
                    part_data['questions'].append(question_data)
                
                test_data['parts'].append(part_data)
            
            self.export_data['reading_tests'].append(test_data)
        
        print(f"   ✅ Экспортировано {len(reading_tests)} Reading тестов")
    
    def copy_media_files(self):
        """Копирует медиа файлы во временную директорию"""
        print(f"📁 Копирую {len(self.media_files)} медиа файлов...")
        
        media_root = Path("media")
        copied_files = []
        missing_files = []
        
        for file_path in self.media_files:
            source = media_root / file_path
            dest = self.temp_dir / "media" / file_path
            
            if source.exists():
                # Создаем директорию если не существует
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, dest)
                copied_files.append(file_path)
                print(f"   📄 {file_path}")
            else:
                missing_files.append(file_path)
                print(f"   ⚠️  ОТСУТСТВУЕТ: {file_path}")
        
        self.export_data['media_files'] = copied_files
        self.export_data['metadata']['missing_files'] = missing_files
        
        print(f"   ✅ Скопировано: {len(copied_files)}")
        if missing_files:
            print(f"   ⚠️  Отсутствует: {len(missing_files)}")
    
    def create_export_json(self):
        """Создает JSON файл с данными"""
        json_path = self.temp_dir / "test_data.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(self.export_data, f, ensure_ascii=False, indent=2)
        
        print(f"💾 Создан JSON файл: {json_path}")
    
    def create_zip_archive(self):
        """Создает ZIP архив с экспортированными данными"""
        print(f"📦 Создаю архив: {self.output_path}")
        
        with zipfile.ZipFile(self.output_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(self.temp_dir):
                for file in files:
                    file_path = Path(root) / file
                    arcname = file_path.relative_to(self.temp_dir)
                    zipf.write(file_path, arcname)
        
        # Очищаем временную директорию
        shutil.rmtree(self.temp_dir)
        
        print(f"   ✅ Архив создан: {self.output_path}")
        print(f"   📊 Размер: {Path(self.output_path).stat().st_size / 1024 / 1024:.2f} MB")
    
    def export(self, listening=True, reading=True, test_ids=None):
        """Основной метод экспорта"""
        print("🚀 ЭКСПОРТ IELTS ТЕСТОВ")
        print("=" * 50)
        
        self.setup_temp_directory()
        
        if listening:
            listening_ids = test_ids.get('listening') if test_ids else None
            self.export_listening_tests(listening_ids)
        
        if reading:
            reading_ids = test_ids.get('reading') if test_ids else None
            self.export_reading_tests(reading_ids)
        
        self.copy_media_files()
        self.create_export_json()
        self.create_zip_archive()
        
        print("=" * 50)
        print("✅ ЭКСПОРТ ЗАВЕРШЕН!")
        print(f"📁 Файл: {self.output_path}")
        print(f"📊 Listening тестов: {len(self.export_data['listening_tests'])}")
        print(f"📊 Reading тестов: {len(self.export_data['reading_tests'])}")
        print(f"📊 Медиа файлов: {len(self.export_data['media_files'])}")

def main():
    parser = argparse.ArgumentParser(description='Экспорт IELTS тестов')
    parser.add_argument('--listening', action='store_true', help='Экспортировать Listening тесты')
    parser.add_argument('--reading', action='store_true', help='Экспортировать Reading тесты')
    parser.add_argument('--all', action='store_true', help='Экспортировать все типы тестов')
    parser.add_argument('--listening-ids', type=str, help='ID Listening тестов через запятую')
    parser.add_argument('--reading-ids', type=str, help='ID Reading тестов через запятую')
    parser.add_argument('--output', '-o', default='ielts_tests_export.zip', help='Имя выходного файла')
    
    args = parser.parse_args()
    
    # По умолчанию экспортируем все если не указаны флаги
    if not any([args.listening, args.reading, args.all]):
        args.all = True
    
    if args.all:
        args.listening = True
        args.reading = True
    
    # Парсим ID тестов
    test_ids = {}
    if args.listening_ids:
        test_ids['listening'] = [int(x.strip()) for x in args.listening_ids.split(',')]
    if args.reading_ids:
        test_ids['reading'] = [int(x.strip()) for x in args.reading_ids.split(',')]
    
    exporter = TestExporter(args.output)
    exporter.export(
        listening=args.listening,
        reading=args.reading,
        test_ids=test_ids if test_ids else None
    )

if __name__ == "__main__":
    main()

