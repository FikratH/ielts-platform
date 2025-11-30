# Инструкция по обновлению на сервере

## Правильный порядок обновления

### 1. Подключиться к серверу
```bash
ssh user@server_ip
cd /path/to/ielts-platform
```

### 2. Получить последние изменения
```bash
git pull origin main
# или
git pull origin master
```

### 3. Остановить текущие контейнеры
```bash
docker compose down
```

### 4. Очистить старые образы и кеш (опционально, для полной пересборки)
```bash
# Удалить старые образы
docker compose down --rmi all

# Очистить build cache
docker builder prune -f
```

### 5. Пересобрать и запустить БЕЗ КЕША

**ВАЖНО:** Используйте пошаговый запуск, чтобы гарантировать правильный порядок!

```bash
# Пересобрать все сервисы без кеша
docker compose build --no-cache

# Пошаговый запуск (РЕКОМЕНДУЕТСЯ):
# 1. Запустить базу данных
docker compose up -d db

# 2. Дождаться готовности базы и запустить бэкенд
docker compose up -d web

# 3. Дождаться готовности бэкенда (проверить healthcheck)
# Проверить что web здоров:
docker compose ps web
# Должен показать "healthy" в статусе

# 4. Запустить сборку фронтенда (теперь web точно готов)
docker compose up -d frontend_build

# 5. Дождаться завершения сборки (может занять 5-10 минут)
docker compose logs -f frontend_build
# Нажмите Ctrl+C когда увидите "Compiled successfully!"

# 6. Запустить фронтенд nginx
docker compose up -d frontend
```

**Альтернатива (если уверены в healthcheck):**
```bash
# Если healthcheck работает правильно, можно запустить все сразу
# Но лучше использовать пошаговый метод выше
docker compose up -d
```

### 6. Проверить статус
```bash
# Проверить что все сервисы запущены
docker compose ps

# Проверить логи бэкенда
docker compose logs web

# Проверить логи сборки фронтенда
docker compose logs frontend_build

# Проверить логи фронтенда
docker compose logs frontend
```

### 7. Если нужно пересобрать только один сервис
```bash
# Только бэкенд без кеша
docker compose build --no-cache web
docker compose up -d web

# Только фронтенд без кеша
docker compose build --no-cache frontend_build
docker compose up -d frontend_build frontend
```

## Альтернативный способ (пошаговый запуск)

Если нужно гарантировать правильный порядок запуска:

```bash
# 1. Запустить базу данных
docker compose up -d db

# 2. Дождаться готовности базы (проверить healthcheck)
docker compose ps db

# 3. Запустить бэкенд
docker compose up -d web

# 4. Дождаться запуска бэкенда
sleep 10
docker compose ps web

# 5. Запустить сборку фронтенда
docker compose up -d frontend_build

# 6. Дождаться завершения сборки (может занять несколько минут)
docker compose logs -f frontend_build

# 7. Запустить фронтенд nginx
docker compose up -d frontend
```

## Проверка после деплоя

1. **Проверить API:**
   ```bash
   curl https://ieltsapi.mastereducation.kz/api/health/
   ```

2. **Проверить фронтенд:**
   - Открыть https://ielts.mastereducation.kz
   - Проверить что страница загружается
   - Проверить консоль браузера (F12) на ошибки

3. **Проверить логи:**
   ```bash
   # Все логи
   docker compose logs --tail=100

   # Только ошибки
   docker compose logs | grep -i error
   ```

## Откат изменений (если что-то пошло не так)

```bash
# Остановить все
docker compose down

# Вернуться к предыдущей версии
git checkout HEAD~1

# Пересобрать и запустить
docker compose build --no-cache
docker compose up -d
```

## Важные замечания

1. **Порядок запуска:**
   - `db` → `web` → `frontend_build` → `frontend`
   - Это обеспечивается через `depends_on` в docker-compose.yml

2. **Кеш:**
   - `--no-cache` гарантирует полную пересборку
   - `npm cache clean --force` очищает npm кеш в frontend_build

3. **Время сборки:**
   - Бэкенд: ~2-5 минут
   - Фронтенд: ~5-10 минут (зависит от размера проекта)

4. **Объемы данных:**
   - `media` и `staticfiles` volumes сохраняются между пересборками
   - `frontend_build` volume очищается при пересборке

## Автоматический скрипт деплоя

Используйте готовый скрипт `deploy.sh` для автоматического деплоя:

```bash
chmod +x deploy.sh
./deploy.sh
```

Скрипт автоматически:
1. Получает изменения из git
2. Останавливает контейнеры
3. Пересобирает образы (с опцией --no-cache)
4. Запускает сервисы в правильном порядке
5. Ждет готовности каждого сервиса
6. Проверяет статус всех сервисов

## Быстрая команда для обновления (ручной способ)

```bash
# Пошаговый запуск (РЕКОМЕНДУЕТСЯ):
cd /path/to/ielts-platform && \
git pull && \
docker compose down && \
docker compose build --no-cache && \
docker compose up -d db && \
sleep 5 && \
docker compose up -d web && \
sleep 15 && \
docker compose up -d frontend_build && \
echo "Ждем сборку фронтенда..." && \
docker compose logs -f frontend_build
# После "Compiled successfully!" нажмите Ctrl+C и запустите:
docker compose up -d frontend
```

