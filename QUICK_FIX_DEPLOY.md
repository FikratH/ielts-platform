# Быстрое исправление проблемы с frontend_build Waiting

## Проблема
`frontend_build` находится в состоянии "Waiting" бесконечно, потому что healthcheck для `web` не проходит.

## Решение 1: Проверить статус web и запустить вручную

```bash
# 1. Проверить статус web
docker compose ps web

# 2. Проверить логи web
docker compose logs web | tail -30

# 3. Если web работает но не healthy, запустить frontend_build вручную
docker compose up -d frontend_build

# 4. Следить за логами сборки
docker compose logs -f frontend_build
```

## Решение 2: Временно убрать depends_on

Если healthcheck не работает, можно временно изменить `depends_on` на `service_started`:

В `docker-compose.yml` изменить:
```yaml
frontend_build:
  depends_on:
    web:
      condition: service_started  # вместо service_healthy
```

Затем:
```bash
docker compose up -d frontend_build
```

## Решение 3: Запустить frontend_build вручную после проверки web

```bash
# 1. Проверить что web запущен
docker compose ps web

# 2. Проверить что web отвечает на порт 8000
docker compose exec web nc -z localhost 8000 && echo "Web port is open" || echo "Web port is closed"

# 3. Если web работает, запустить frontend_build
docker compose up -d frontend_build

# 4. Следить за сборкой
docker compose logs -f frontend_build
```

## Решение 4: Исправить healthcheck для web

Если healthcheck не работает, можно использовать более простую проверку:

В `docker-compose.yml` изменить healthcheck:
```yaml
web:
  healthcheck:
    test: ["CMD-SHELL", "ps aux | grep gunicorn | grep -v grep || exit 1"]
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 60s
```

Или использовать curl если доступен:
```yaml
healthcheck:
  test: ["CMD-SHELL", "curl -f http://localhost:8000/api/ || exit 1"]
```

## Рекомендуемое решение (прямо сейчас)

```bash
# На сервере выполнить:

# 1. Проверить статус
docker compose ps

# 2. Если web показывает "healthy", но frontend_build все еще Waiting,
#    значит проблема в depends_on. Запустить вручную:
docker compose up -d frontend_build

# 3. Если web НЕ healthy, проверить логи:
docker compose logs web

# 4. Если web не запускается, проверить базу:
docker compose logs db
docker compose ps db
```





