# Проверка статуса сборки фронтенда

## Команды для проверки

```bash
# 1. Проверить логи сборки фронтенда
docker compose logs frontend_build

# 2. Следить за логами в реальном времени
docker compose logs -f frontend_build

# 3. Проверить статус всех сервисов
docker compose ps

# 4. Если сборка зависла, проверить процессы внутри контейнера
docker compose exec frontend_build ps aux

# 5. Проверить что npm установился
docker compose exec frontend_build ls -la node_modules/ | head -20
```

## Что должно быть в логах

Нормальный процесс сборки:
1. `npm cache clean --force` - очистка кеша
2. `npm install --legacy-peer-deps` - установка зависимостей (может занять 2-5 минут)
3. `npm run build` - сборка проекта (может занять 3-7 минут)
4. `Compiled successfully!` - успешная сборка

## Если сборка зависла

```bash
# Перезапустить сборку
docker compose restart frontend_build

# Или пересоздать контейнер
docker compose up -d --force-recreate frontend_build

# Следить за логами
docker compose logs -f frontend_build
```




