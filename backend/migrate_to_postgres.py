#!/usr/bin/env python
"""
Script to migrate data from SQLite to PostgreSQL
"""
import os
import sys
import django
from django.core.management import execute_from_command_line

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ielts_platform.settings')
django.setup()

def migrate_to_postgres():
    """Migrate from SQLite to PostgreSQL"""
    print("Starting migration to PostgreSQL...")
    
    # First, make sure all migrations are applied to the new PostgreSQL database
    print("Applying migrations to PostgreSQL...")
    execute_from_command_line(['manage.py', 'migrate'])
    
    # If you have existing data in SQLite that you want to migrate, you can use:
    # python manage.py dumpdata --exclude auth.permission --exclude contenttypes > data_backup.json
    # python manage.py loaddata data_backup.json
    
    print("Migration completed successfully!")

if __name__ == '__main__':
    migrate_to_postgres() 