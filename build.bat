python manage.py shell

# Импортируем модель User
from core.models import User

# Создаем админа (замените UID на настоящий из Firebase)
admin_user = User.objects.create(
    uid='vyr6Jb6ZXUb4hVEeVSDSFi7U9tv2',  # Замените на реальный UID
    email='admin@ielts.local',      # Или какой email у вас в Firebase
    student_id='admin',
    first_name='Admin',
    last_name='Admin',
    role='admin'
)

print(f"✅ Admin создан успешно!")
print(f"Email: {admin_user.email}")
print(f"Role: {admin_user.role}")
print(f"Student ID: {admin_user.student_id}")
print(f"UID: {admin_user.uid}")