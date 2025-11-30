# Простой деплой без проблем

## Проблема была:
1. Слишком сложная команда с проверками web
2. Удаление package-lock.json приводило к несовместимым версиям
3. ajv и ajv-keywords несовместимы

## Исправлено:
1. Упрощена команда - убраны лишние проверки
2. Не удаляется package-lock.json (если есть)
3. Добавлена установка правильной версии ajv@^8.12.0

## Команды для деплоя:

```bash
# 1. Получить изменения
git pull

# 2. Остановить все
docker compose down

# 3. Пересобрать (БЕЗ --no-cache, быстрее)
docker compose build

# 4. Запустить по порядку:
docker compose up -d db
sleep 5
docker compose up -d web
sleep 15
docker compose up -d frontend_build

# 5. Следить за сборкой
docker compose logs -f frontend_build
# После "Compiled successfully!" нажмите Ctrl+C

# 6. Запустить фронтенд
docker compose up -d frontend
```

## Если сборка все еще падает с ajv:

```bash
# Войти в контейнер и исправить вручную
docker compose exec frontend_build sh

# Внутри контейнера:
npm install ajv@^8.12.0 ajv-keywords@^5.1.0 --legacy-peer-deps
npm run build
exit

# Затем перезапустить frontend
docker compose restart frontend
```



