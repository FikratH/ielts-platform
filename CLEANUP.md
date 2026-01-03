# Docker Cleanup Instructions

## Удаление старых контейнеров и образов

Если старый `frontend_build` контейнер все еще запущен, выполните:

```bash
# Остановить все контейнеры
docker compose down

# Удалить старые контейнеры
docker compose rm -f frontend_build

# Удалить неиспользуемые образы
docker image prune -a -f

# Удалить неиспользуемые volumes (осторожно!)
docker volume prune -f

# Пересобрать и запустить
docker compose build --no-cache
docker compose up -d
```

## Проверка запущенных контейнеров

```bash
# Показать все контейнеры
docker ps -a

# Показать только контейнеры этого проекта
docker compose ps
```

## Если проблемы с памятью при сборке

```bash
# Увеличить лимит памяти для Docker (если возможно)
# Или использовать swap файл на сервере

# Проверить использование памяти
docker stats
```

