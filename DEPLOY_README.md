# Руководство по деплою IELTS Platform

## Подготовка к деплою

### 1. Сборка Frontend
```bash
cd frontend
npm install
npm run build
```

### 2. Подготовка Backend
```bash
cd backend
pip install -r requirements.txt
python manage.py collectstatic
python manage.py migrate
```

## Варианты деплоя

### Вариант A: VPS/Cloud Server (SSH доступ)

#### Подключение к серверу:
```bash
ssh username@your-server-ip
```

#### Установка на сервере:
```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Python, Node.js, PostgreSQL
sudo apt install python3 python3-pip python3-venv nodejs npm postgresql postgresql-contrib nginx

# Создание пользователя для приложения
sudo adduser ielts
sudo usermod -aG sudo ielts

# Переключение на пользователя
su - ielts

# Клонирование проекта
git clone https://github.com/your-repo/ielts-platform.git
cd ielts-platform

# Настройка Python окружения
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt

# Настройка базы данных
sudo -u postgres psql
CREATE DATABASE ielts_db;
CREATE USER ielts_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE ielts_db TO ielts_user;
\q

# Настройка Django
cd backend
python manage.py migrate
python manage.py collectstatic
python manage.py createsuperuser

# Сборка frontend
cd ../frontend
npm install
npm run build
```

#### Настройка Gunicorn:
```bash
# Создание файла сервиса
sudo nano /etc/systemd/system/ielts-gunicorn.service
```

Содержимое файла:
```ini
[Unit]
Description=IELTS Platform Gunicorn
After=network.target

[Service]
User=ielts
Group=www-data
WorkingDirectory=/home/ielts/ielts-platform/backend
Environment="PATH=/home/ielts/ielts-platform/venv/bin"
ExecStart=/home/ielts/ielts-platform/venv/bin/gunicorn --workers 3 --bind unix:/home/ielts/ielts-platform/backend/ielts.sock ielts_platform.wsgi:application

[Install]
WantedBy=multi-user.target
```

#### Настройка Nginx:
```bash
sudo nano /etc/nginx/sites-available/ielts
```

Содержимое файла:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /static/ {
        alias /home/ielts/ielts-platform/backend/staticfiles/;
    }

    location /media/ {
        alias /home/ielts/ielts-platform/backend/media/;
    }

    location / {
        proxy_pass http://unix:/home/ielts/ielts-platform/backend/ielts.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### Запуск сервисов:
```bash
sudo systemctl enable ielts-gunicorn
sudo systemctl start ielts-gunicorn
sudo ln -s /etc/nginx/sites-available/ielts /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

### Вариант B: Shared Hosting (cPanel/Plesk)

#### Загрузка файлов через FTP:
1. Соберите frontend: `npm run build`
2. Загрузите папку `frontend/build` в `public_html`
3. Загрузите папку `backend` в корень домена
4. Создайте файл `.htaccess` в корне:

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ /backend/ielts_platform/wsgi.py/$1 [QSA,L]
```

### Вариант C: Docker (универсальный)

#### Создание Dockerfile:
```dockerfile
FROM python:3.9

WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt

COPY backend/ .
COPY frontend/build/ /app/static/

EXPOSE 8000
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "ielts_platform.wsgi:application"]
```

#### Создание docker-compose.yml:
```yaml
version: '3.8'
services:
  web:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:password@db:5432/ielts_db
    depends_on:
      - db
  db:
    image: postgres:13
    environment:
      - POSTGRES_DB=ielts_db
      - POSTGRES_USER=ielts_user
      - POSTGRES_PASSWORD=your_password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Обновление приложения

### Для SSH доступа:
```bash
# На сервере
cd /home/ielts/ielts-platform
git pull origin main
source venv/bin/activate
pip install -r backend/requirements.txt
cd backend
python manage.py migrate
python manage.py collectstatic
cd ../frontend
npm install
npm run build
sudo systemctl restart ielts-gunicorn
```

### Для Docker:
```bash
docker-compose down
docker-compose up --build -d
```

## Проверка деплоя

1. Откройте сайт в браузере
2. Проверьте логи: `sudo journalctl -u ielts-gunicorn`
3. Проверьте статус сервисов: `sudo systemctl status ielts-gunicorn nginx`

## Устранение проблем

### Частые ошибки:
- **502 Bad Gateway**: Проверьте статус Gunicorn
- **404 Not Found**: Проверьте настройки Nginx
- **Database errors**: Проверьте подключение к БД
- **Static files not found**: Проверьте collectstatic и настройки Nginx 