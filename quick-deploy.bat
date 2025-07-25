@echo off
echo ===== БЫСТРЫЙ ДЕПЛОЙ =====

echo.
echo 1. Собираем frontend...
cd frontend
call npm run build
if %errorlevel% neq 0 (
    echo ОШИБКА: Не удалось собрать frontend
    pause
    exit /b 1
)

echo.
echo 2. Копируем только измененные backend файлы...
cd ..
scp backend/core/views.py mastereduadmin@compute-vm-2-2-20-ssd-1753102471641:~/ielts-platform/backend/core/
scp backend/core/utils.py mastereduadmin@compute-vm-2-2-20-ssd-1753102471641:~/ielts-platform/backend/core/
scp backend/ielts_platform/settings.py mastereduadmin@compute-vm-2-2-20-ssd-1753102471641:~/ielts-platform/backend/ielts_platform/

echo.
echo 3. Копируем собранный frontend...
scp -r frontend/build/* mastereduadmin@compute-vm-2-2-20-ssd-1753102471641:~/ielts-platform/frontend/build/

echo.
echo 4. Перезапускаем gunicorn...
ssh mastereduadmin@compute-vm-2-2-20-ssd-1753102471641 "sudo systemctl restart gunicorn"

echo.
echo ===== БЫСТРЫЙ ДЕПЛОЙ ЗАВЕРШЕН! =====
pause 