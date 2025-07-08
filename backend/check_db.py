#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ielts_platform.settings')
django.setup()

from django.conf import settings

print("Database settings:")
print(f"DB_NAME: {settings.DATABASES['default']['NAME']}")
print(f"DB_USER: {settings.DATABASES['default']['USER']}")
print(f"DB_HOST: {settings.DATABASES['default']['HOST']}")
print(f"DB_PORT: {settings.DATABASES['default']['PORT']}")
print(f"DB_ENGINE: {settings.DATABASES['default']['ENGINE']}")

# Check if .env is loaded
print("\nEnvironment variables:")
print(f"DB_NAME from env: {os.getenv('DB_NAME', 'NOT SET')}")
print(f"DB_USER from env: {os.getenv('DB_USER', 'NOT SET')}")
print(f"DB_PASSWORD from env: {'SET' if os.getenv('DB_PASSWORD') else 'NOT SET'}") 