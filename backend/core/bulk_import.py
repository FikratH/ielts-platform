import pandas as pd
import io
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
import firebase_admin
from firebase_admin import auth as firebase_auth
from .models import User


def validate_student_row(row, row_num):
    """Валидация одной строки студента"""
    errors = []
    
    # Проверка обязательных полей
    required_fields = ['first_name', 'last_name', 'email', 'student_id', 'password']
    for field in required_fields:
        if pd.isna(row.get(field)) or str(row.get(field)).strip() == '':
            errors.append(f"Row {row_num}: Missing required field '{field}'")
    
    # Валидация email
    email = str(row.get('email', '')).strip()
    if email:
        try:
            validate_email(email)
        except ValidationError:
            errors.append(f"Row {row_num}: Invalid email format '{email}'")
    
    # Валидация пароля
    password = str(row.get('password', '')).strip()
    if password and len(password) < 6:
        errors.append(f"Row {row_num}: Password must be at least 6 characters")
    
    # Валидация student_id
    student_id = str(row.get('student_id', '')).strip()
    if student_id and User.objects.filter(student_id=student_id).exists():
        errors.append(f"Row {row_num}: Student ID '{student_id}' already exists")
    
    # Валидация уникальности email
    if email and User.objects.filter(email=email).exists():
        errors.append(f"Row {row_num}: Email '{email}' already exists")
    
    return errors


def process_students_file(file_content, file_type):
    """Обработка файла со студентами"""
    try:
        # Чтение файла
        if file_type == 'csv':
            df = pd.read_csv(io.StringIO(file_content))
        elif file_type in ['xlsx', 'xls']:
            df = pd.read_excel(io.BytesIO(file_content))
        else:
            return {'error': 'Unsupported file type. Use CSV or Excel files.'}
        
        # Проверка наличия обязательных колонок
        required_columns = ['first_name', 'last_name', 'email', 'student_id', 'password']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            return {'error': f'Missing required columns: {", ".join(missing_columns)}'}
        
        # Валидация всех строк
        all_errors = []
        valid_rows = []
        
        for idx, row in df.iterrows():
            row_num = idx + 2  # +2 потому что idx начинается с 0 и есть заголовок
            errors = validate_student_row(row, row_num)
            
            if errors:
                all_errors.extend(errors)
            else:
                # Подготовка данных для создания
                student_data = {
                    'first_name': str(row['first_name']).strip(),
                    'last_name': str(row['last_name']).strip(),
                    'email': str(row['email']).strip().lower(),
                    'student_id': str(row['student_id']).strip(),
                    'password': str(row['password']).strip(),
                    'group': str(row.get('group', '')).strip() if pd.notna(row.get('group')) else '',
                    'teacher': str(row.get('teacher', '')).strip() if pd.notna(row.get('teacher')) else '',
                }
                valid_rows.append(student_data)
        
        if all_errors:
            return {
                'error': 'Validation failed',
                'errors': all_errors,
                'valid_count': len(valid_rows),
                'total_count': len(df)
            }
        
        return {
            'success': True,
            'students': valid_rows,
            'count': len(valid_rows)
        }
        
    except Exception as e:
        return {'error': f'File processing error: {str(e)}'}


def create_students_batch(students_data):
    """Массовое создание студентов в Firebase и PostgreSQL"""
    created_students = []
    errors = []
    
    for i, student_data in enumerate(students_data):
        try:
            # Создание в Firebase
            firebase_user = firebase_auth.create_user(
                email=student_data['email'],
                password=student_data['password'],
                display_name=f"{student_data['first_name']} {student_data['last_name']}",
            )
            
            # Создание в PostgreSQL
            user = User.objects.create(
                uid=firebase_user.uid,
                role='student',
                student_id=student_data['student_id'],
                first_name=student_data['first_name'],
                last_name=student_data['last_name'],
                email=student_data['email'],
                group=student_data['group'],
                teacher=student_data['teacher'],
            )
            
            created_students.append({
                'student_id': user.student_id,
                'email': user.email,
                'name': f"{user.first_name} {user.last_name}",
                'group': user.group,
                'teacher': user.teacher,
            })
            
        except firebase_admin._auth_utils.EmailAlreadyExistsError:
            errors.append(f"Student {i+1}: Email '{student_data['email']}' already exists in Firebase")
        except Exception as e:
            errors.append(f"Student {i+1}: {str(e)}")
    
    return {
        'created_count': len(created_students),
        'error_count': len(errors),
        'created_students': created_students,
        'errors': errors
    }
