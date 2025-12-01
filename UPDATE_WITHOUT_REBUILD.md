# Обновление без полной пересборки (код в volumes)

## Когда НЕ нужна пересборка с --no-cache:

1. ✅ Изменения в Python коде (serializers.py, views.py, models.py)
2. ✅ Изменения в JavaScript/React коде (frontend/src/)
3. ✅ Изменения в docker-compose.yml (только структура)
4. ✅ Изменения в nginx конфигах

## Когда НУЖНА пересборка:

1. ❌ Изменения в Dockerfile
2. ❌ Изменения в requirements.txt (нужна пересборка web)
3. ❌ Изменения в package.json (нужна пересборка frontend_build)
4. ❌ Изменения в системных зависимостях

## Команды для обновления (только код изменился):

### Вариант 1: Быстрое обновление (только код)

```bash
# 1. Получить изменения
git pull

# 2. Пересоздать контейнеры с новым docker-compose.yml (если он изменился)
docker compose up -d --force-recreate

# 3. Перезапустить web (применит изменения в Python коде)
docker compose restart web

# 4. Пересобрать frontend_build (применит изменения в JS коде)
docker compose up -d --build frontend_build

# 5. Дождаться завершения сборки
docker compose logs -f frontend_build
# После "Compiled successfully!" нажмите Ctrl+C

# 6. Перезапустить frontend
docker compose restart frontend
```

### Вариант 2: Только изменения в коде (docker-compose.yml не менялся)

```bash
# 1. Получить изменения
git pull

# 2. Перезапустить web (Python код уже в volume, применится сразу)
docker compose restart web

# 3. Пересобрать frontend_build (JS код в volume, но нужна пересборка)
docker compose up -d --build frontend_build

# 4. Дождаться сборки
docker compose logs -f frontend_build

# 5. Перезапустить frontend
docker compose restart frontend
```

### Вариант 3: Только бэкенд изменился

```bash
git pull
docker compose restart web
# Готово! Код уже в volume, изменения применятся сразу
```

### Вариант 4: Только фронтенд изменился

```bash
git pull
docker compose up -d --build frontend_build
docker compose logs -f frontend_build
# После сборки:
docker compose restart frontend
```

## Команды для обновления (docker-compose.yml изменился):

```bash
# 1. Получить изменения
git pull

# 2. Пересоздать контейнеры с новым конфигом
docker compose up -d --force-recreate

# 3. Если нужно пересобрать только измененные сервисы
docker compose up -d --build
```

## Команды для обновления (requirements.txt или package.json изменились):

```bash
# 1. Получить изменения
git pull

# 2. Пересобрать только нужный сервис
# Если requirements.txt изменился:
docker compose build web
docker compose up -d web

# Если package.json изменился:
docker compose build frontend_build
docker compose up -d frontend_build
docker compose logs -f frontend_build
# После сборки:
docker compose restart frontend
```

## Полная пересборка БЕЗ --no-cache (быстрее):

```bash
git pull
docker compose down
docker compose build
docker compose up -d
```

## Проверка после обновления:

```bash
# Статус всех сервисов
docker compose ps

# Логи на ошибки
docker compose logs | grep -i error

# Проверить что web работает
curl http://localhost:8000/api/ || docker compose logs web | tail -20
```





