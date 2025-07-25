@echo off
echo ===== ДЕПЛОЙ НА СЕРВЕР =====

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
echo 2. Копируем backend файлы...
cd ..
scp -r backend/* mastereduadmin@compute-vm-2-2-20-ssd-1753102471641:~/ielts-platform/backend/

echo.
echo 3. Копируем собранный frontend...
scp -r frontend/build/* mastereduadmin@compute-vm-2-2-20-ssd-1753102471641:~/ielts-platform/frontend/build/

echo.
echo 4. Перезапускаем сервисы на сервере...
ssh mastereduadmin@compute-vm-2-2-20-ssd-1753102471641 "cd ~/ielts-platform && sudo systemctl restart gunicorn && sudo systemctl restart nginx"

echo.
echo ===== ДЕПЛОЙ ЗАВЕРШЕН! =====
pause 