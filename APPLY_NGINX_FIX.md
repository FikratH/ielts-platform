# Применение исправления nginx

## Что изменено:
- ✅ `nginx-frontend.conf` - добавлен resolver для динамического резолвинга `web:8000`
- ❌ `docker-compose.yml` - НЕ ТРОГАЕМ (остается как было)

## Команды на сервере:

```bash
# 1. Получить обновленный nginx-frontend.conf
git pull

# 2. Перезапустить frontend (nginx перечитает конфиг)
docker compose restart frontend

# 3. Проверить что nginx запустился
docker compose ps frontend

# 4. Проверить логи nginx (должно быть без ошибок)
docker compose logs frontend
```

## Если нужно пересобрать frontend_build:

```bash
# Остановить и удалить frontend_build
docker compose stop frontend_build
docker compose rm -f frontend_build

# Запустить заново
docker compose up -d frontend_build

# Следить за сборкой
docker compose logs -f frontend_build
```

## Что исправлено в nginx-frontend.conf:

1. Добавлен `resolver 127.0.0.11` - Docker DNS
2. `proxy_pass` через переменную `$backend` - резолвится при запросе, а не при старте
3. Добавлен `proxy_next_upstream` - nginx не падает если upstream недоступен

Теперь nginx стартует даже если `web` еще не готов!





