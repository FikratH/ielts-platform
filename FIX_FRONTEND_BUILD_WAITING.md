# Исправление проблемы frontend_build Waiting

## Проблема
`frontend_build` находится в состоянии "Waiting" бесконечно.

## Причины
1. `depends_on` с `condition: service_healthy` не срабатывает
2. Healthcheck для `web` не проходит
3. `nc` команда не доступна в node:20-alpine

## Решение 1: Запустить вручную (быстро)

```bash
# 1. Проверить что web запущен
docker compose ps web

# 2. Если web работает, запустить frontend_build вручную
docker compose up -d frontend_build

# 3. Следить за логами
docker compose logs -f frontend_build
```

## Решение 2: Убрать depends_on временно

В `docker-compose.yml` изменить:
```yaml
frontend_build:
  # depends_on:
  #   web:
  #     condition: service_started
```

Затем:
```bash
docker compose up -d frontend_build
```

## Решение 3: Использовать service_started вместо service_healthy

Уже исправлено в docker-compose.yml - использует `service_started`.

## Решение 4: Установить nc в контейнере

Уже добавлено в команду: `apk add --no-cache netcat-openbsd`

## Команды для проверки и исправления

```bash
# 1. Проверить статус web
docker compose ps web

# 2. Проверить логи web
docker compose logs web | tail -20

# 3. Проверить что web отвечает
docker compose exec web nc -z localhost 8000 && echo "Web port open" || echo "Web port closed"

# 4. Остановить frontend_build
docker compose stop frontend_build

# 5. Запустить заново
docker compose up -d frontend_build

# 6. Следить за логами
docker compose logs -f frontend_build
```

## Если ничего не помогает

```bash
# Полностью пересоздать frontend_build
docker compose stop frontend_build
docker compose rm -f frontend_build
docker compose up -d frontend_build
docker compose logs -f frontend_build
```



