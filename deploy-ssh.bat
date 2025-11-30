@echo off
set /p SERVER_IP="Введите IP сервера: "
set /p USERNAME="Введите имя пользователя: "
set /p REMOTE_PATH="Введите путь на сервере (например: /home/user/ielts-platform): "

echo.
echo ===== ДЕПЛОЙ ЧЕРЕЗ SSH =====

echo.
echo 1. Сборка проекта...
call build.bat
if %errorlevel% neq 0 (
    echo ОШИБКА: Сборка не удалась
    pause
    exit /b 1
)

echo.
echo 2. Создание архива...
powershell -Command "Compress-Archive -Path 'frontend\build\*' -DestinationPath 'frontend-build.zip' -Force"
powershell -Command "Compress-Archive -Path 'backend\*' -DestinationPath 'backend.zip' -Force"

echo.
echo 3. Загрузка файлов на сервер...
scp frontend-build.zip %USERNAME%@%SERVER_IP%:%REMOTE_PATH%/
scp backend.zip %USERNAME%@%SERVER_IP%:%REMOTE_PATH%/

echo.
echo 4. Выполнение команд на сервере...
ssh %USERNAME%@%SERVER_IP% "cd %REMOTE_PATH% && unzip -o frontend-build.zip -d frontend/build/ && unzip -o backend.zip -d backend/ && rm frontend-build.zip backend.zip && cd backend && python manage.py migrate && python manage.py collectstatic --noinput && sudo systemctl restart gunicorn && sudo systemctl restart nginx"

echo.
echo 5. Очистка локальных архивов...
del frontend-build.zip
del backend.zip

echo.
echo ===== ДЕПЛОЙ ЗАВЕРШЕН! =====
echo Проверьте сайт: http://%SERVER_IP%
pause 