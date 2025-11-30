# Команды для правильного деплоя на сервере

## Полный пошаговый деплой

```bash
# 1. Подключиться к серверу
ssh user@server_ip
cd /path/to/ielts-platform

# 2. Получить изменения
git pull

# 3. Остановить все контейнеры
docker compose down

# 4. Пересобрать БЕЗ КЕША
docker compose build --no-cache

# 5. Запустить базу данных
docker compose up -d db

# 6. Дождаться готовности базы (проверить статус)
docker compose ps db
# Должен показать "healthy" в статусе
# Если не готов, подождать еще:
sleep 5
docker compose ps db

# 7. Запустить бэкенд (подождет готовности базы автоматически)
docker compose up -d web

# 8. Дождаться готовности бэкенда (проверить healthcheck)
echo "Ожидание готовности бэкенда..."
sleep 15
docker compose ps web
# Должен показать "healthy" в статусе
# Если не готов, проверить логи:
docker compose logs web | tail -20

# 9. Запустить сборку фронтенда (подождет готовности web автоматически)
docker compose up -d frontend_build

# 10. Дождаться завершения сборки (может занять 5-10 минут)
echo "Ожидание завершения сборки фронтенда..."
docker compose logs -f frontend_build
# После "Compiled successfully!" или "The build folder is ready" нажмите Ctrl+C

# 11. Проверить что сборка завершилась успешно
docker compose ps frontend_build
# Должен показать "Exited (0)" - успешно

# 12. Запустить фронтенд nginx (подождет готовности web и frontend_build автоматически)
docker compose up -d frontend

# 13. Проверить статус всех сервисов
docker compose ps

# 14. Проверить логи если что-то не так
docker compose logs frontend | tail -20
docker compose logs web | tail -20
```

## Быстрая версия (если уверены в healthcheck)

```bash
cd /path/to/ielts-platform && \
git pull && \
docker compose down && \
docker compose build --no-cache && \
docker compose up -d db && \
sleep 10 && \
docker compose up -d web && \
sleep 20 && \
docker compose up -d frontend_build && \
echo "Ждем сборку фронтенда..." && \
docker compose logs -f frontend_build
# После успешной сборки нажмите Ctrl+C и запустите:
docker compose up -d frontend
```

## Проверка после деплоя

```bash
# Проверить статус всех сервисов
docker compose ps

# Проверить что все healthy/работают:
# - db: healthy
# - web: healthy  
# - frontend_build: Exited (0)
# - frontend: Up

# Проверить логи на ошибки
docker compose logs | grep -i error

# Проверить что API работает
curl http://localhost:8000/api/ || echo "API не доступен"

# Проверить что фронтенд работает
curl http://localhost/ || echo "Frontend не доступен"
```

## Если что-то пошло не так

```bash
# Посмотреть логи конкретного сервиса
docker compose logs web
docker compose logs frontend_build
docker compose logs frontend

# Перезапустить конкретный сервис
docker compose restart web
docker compose restart frontend

# Если frontend не может найти web:
# 1. Проверить что web запущен и healthy
docker compose ps web

# 2. Проверить что frontend в сети default
docker compose exec frontend ping web

# 3. Если не работает, перезапустить frontend
docker compose restart frontend
```

## Важные моменты

1. **Порядок критичен**: db → web → frontend_build → frontend
2. **Healthcheck для web**: проверяет порт 8000, может занять 30-40 секунд
3. **Сборка фронтенда**: занимает 5-10 минут, нужно дождаться завершения
4. **Сети**: frontend должен быть в сетях `default` и `proxy` чтобы резолвить имя `web`



