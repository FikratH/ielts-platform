#!/usr/bin/env python3
import json
import requests
import sys

def restore_reading_tests(backup_file):
    """Восстанавливает Reading-тесты на локальном сервере"""
    
    # Читаем бэкап
    try:
        with open(backup_file, 'r', encoding='utf-8') as f:
            tests = json.load(f)
    except FileNotFoundError:
        print(f"❌ Файл {backup_file} не найден!")
        print("📁 Доступные файлы:")
        import os
        for file in os.listdir('.'):
            if file.endswith('.json'):
                print(f"   • {file}")
        return
    
    print(f"📤 Восстанавливаю {len(tests)} тестов...")
    
    # ... остальной код без изменений ...

if __name__ == "__main__":
    # Берем имя файла из аргумента командной строки
    if len(sys.argv) > 1:
        backup_file = sys.argv[1]
    else:
        # Показываем доступные файлы
        import os
        json_files = [f for f in os.listdir('.') if f.endswith('.json')]
        if json_files:
            print("�� Доступные файлы бэкапа:")
            for i, file in enumerate(json_files, 1):
                print(f"   {i}. {file}")
            choice = input(f"Выберите номер файла (1-{len(json_files)}): ")
            try:
                backup_file = json_files[int(choice) - 1]
            except:
                print("❌ Неверный выбор")
                sys.exit(1)
        else:
            print("❌ Файлы .json не найдены в текущей папке")
            sys.exit(1)
    
    print(f"�� Используется файл: {backup_file}")
    restore_reading_tests(backup_file)
    print("✨ Восстановление завершено!")