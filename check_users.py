#!/usr/bin/env python3
"""
Simple script to check user data in the database
"""
import os
import sys
import django

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ielts_platform.settings')
django.setup()

from core.models import User

def check_users():
    print("=== User Data in Database ===")
    users = User.objects.all()
    
    if not users.exists():
        print("No users found in database")
        return
    
    for user in users:
        print(f"\nUser ID: {user.id}")
        print(f"UID: {user.uid}")
        print(f"Student ID: {user.student_id}")
        print(f"First Name: {user.first_name}")
        print(f"Last Name: {user.last_name}")
        print(f"Email: {user.email}")
        print(f"Role: {user.role}")
        print(f"Group: {user.group}")
        print(f"Teacher: {user.teacher}")
        print("-" * 40)

if __name__ == "__main__":
    check_users()
