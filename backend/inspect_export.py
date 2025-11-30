#!/usr/bin/env python3
"""
Скрипт для инспекции содержимого экспортированного архива.
Использование: python inspect_export.py export_data.zip
"""

import os
import sys
import json
import zipfile
import argparse
from pathlib import Path

def inspect_archive(archive_path):
    """Инспектирует содержимое архива"""
    archive_path = Path(archive_path)
    
    if not archive_path.exists():
        print(f"❌ Архив не найден: {archive_path}")
        return
    
    print("🔍 ИНСПЕКЦИЯ АРХИВА IELTS ТЕСТОВ")
    print("=" * 50)
    print(f"📁 Файл: {archive_path}")
    print(f"📊 Размер: {archive_path.stat().st_size / 1024 / 1024:.2f} MB")
    print()
    
    try:
        with zipfile.ZipFile(archive_path, 'r') as zipf:
            # Показываем содержимое архива
            file_list = zipf.namelist()
            print(f"📦 Файлов в архиве: {len(file_list)}")
            print()
            
            # Читаем JSON с данными если есть
            if 'test_data.json' in file_list:
                with zipf.open('test_data.json') as json_file:
                    data = json.load(json_file)
                
                # Метаданные
                metadata = data.get('metadata', {})
                print("📋 МЕТАДАННЫЕ")
                print(f"   Дата экспорта: {metadata.get('export_date', 'не указано')}")
                print(f"   Django версия: {metadata.get('django_version', 'не указано')}")
                print(f"   Экспортировано: {metadata.get('exported_by', 'не указано')}")
                
                if metadata.get('missing_files'):
                    print(f"   ⚠️  Отсутствующих файлов: {len(metadata['missing_files'])}")
                    for missing in metadata['missing_files'][:5]:  # показываем первые 5
                        print(f"      - {missing}")
                    if len(metadata['missing_files']) > 5:
                        print(f"      ... и еще {len(metadata['missing_files']) - 5}")
                print()
                
                # Listening тесты
                listening_tests = data.get('listening_tests', [])
                print(f"📻 LISTENING ТЕСТОВ: {len(listening_tests)}")
                for i, test in enumerate(listening_tests):
                    parts_count = len(test.get('parts', []))
                    total_questions = sum(len(part.get('questions', [])) for part in test.get('parts', []))
                    status = "🟢 Активен" if test.get('is_active') else "🔴 Неактивен"
                    
                    print(f"   {i+1}. {test.get('title', 'Без названия')} (ID: {test.get('id')})")
                    print(f"      {status} | Частей: {parts_count} | Вопросов: {total_questions}")
                    
                    # Показываем первые несколько частей
                    for j, part in enumerate(test.get('parts', [])[:2]):
                        audio_info = f" | Аудио: {part['audio']}" if part.get('audio') else ""
                        print(f"      └─ Часть {part['part_number']}: {len(part.get('questions', []))} вопросов{audio_info}")
                    
                    if len(test.get('parts', [])) > 2:
                        print(f"      └─ ... и еще {len(test.get('parts', [])) - 2} частей")
                print()
                
                # Reading тесты
                reading_tests = data.get('reading_tests', [])
                print(f"📖 READING ТЕСТОВ: {len(reading_tests)}")
                for i, test in enumerate(reading_tests):
                    parts_count = len(test.get('parts', []))
                    total_questions = sum(len(part.get('questions', [])) for part in test.get('parts', []))
                    status = "🟢 Активен" if test.get('is_active') else "🔴 Неактивен"
                    
                    print(f"   {i+1}. {test.get('title', 'Без названия')} (ID: {test.get('id')})")
                    print(f"      {status} | Частей: {parts_count} | Вопросов: {total_questions}")
                    print(f"      Лимит времени: {test.get('time_limit', 60)} мин | Баллов: {test.get('total_points', 0)}")
                    
                    # Показываем первые несколько частей  
                    for j, part in enumerate(test.get('parts', [])[:2]):
                        passage_length = len(part.get('passage_text', ''))
                        image_info = f" | Изображение: {part['passage_image_url']}" if part.get('passage_image_url') else ""
                        print(f"      └─ Часть {part['part_number']}: {len(part.get('questions', []))} вопросов | Текст: {passage_length} символов{image_info}")
                    
                    if len(test.get('parts', [])) > 2:
                        print(f"      └─ ... и еще {len(test.get('parts', [])) - 2} частей")
                print()
                
                # Медиа файлы
                media_files = data.get('media_files', [])
                print(f"📁 МЕДИА ФАЙЛОВ: {len(media_files)}")
                
                # Группируем по типам
                media_types = {}
                for file_path in media_files:
                    if '/' in file_path:
                        folder = file_path.split('/')[0]
                        if folder not in media_types:
                            media_types[folder] = []
                        media_types[folder].append(file_path)
                    else:
                        if 'root' not in media_types:
                            media_types['root'] = []
                        media_types['root'].append(file_path)
                
                for folder, files in media_types.items():
                    print(f"   📂 {folder}: {len(files)} файлов")
                    for file_path in files[:3]:  # показываем первые 3
                        file_name = file_path.split('/')[-1]
                        print(f"      - {file_name}")
                    if len(files) > 3:
                        print(f"      ... и еще {len(files) - 3}")
                print()
                
                # Структура архива
                print("📂 СТРУКТУРА АРХИВА")
                folders = {}
                for file_path in file_list:
                    if '/' in file_path:
                        folder = file_path.split('/')[0]
                        if folder not in folders:
                            folders[folder] = []
                        folders[folder].append(file_path)
                    else:
                        if 'root' not in folders:
                            folders['root'] = []
                        folders['root'].append(file_path)
                
                for folder, files in folders.items():
                    print(f"   📂 {folder}/ ({len(files)} файлов)")
                
            else:
                print("❌ test_data.json не найден в архиве")
                print("📂 Содержимое архива:")
                for file_path in file_list:
                    print(f"   - {file_path}")
    
    except zipfile.BadZipFile:
        print("❌ Неверный формат ZIP архива")
    except Exception as e:
        print(f"❌ Ошибка при чтении архива: {e}")

def main():
    parser = argparse.ArgumentParser(description='Инспекция архива IELTS тестов')
    parser.add_argument('archive', help='Путь к ZIP архиву с тестами')
    
    args = parser.parse_args()
    
    inspect_archive(args.archive)

if __name__ == "__main__":
    main()

