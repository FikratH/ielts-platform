# Исправление проблемы с nginx и запуском бэкенда

## Проблема

**Nginx падает при старте, если `web` (бэкенд) еще не запущен.**

### Почему это происходит:

1. В `nginx-frontend.conf` на строке 14: `proxy_pass http://web:8000;`
2. Nginx пытается **резолвить** `web:8000` **при старте контейнера**
3. Если `web` еще не запущен или не в сети, nginx не может резолвить имя и **падает**
4. Даже если в `docker-compose.yml` есть `depends_on: web: condition: service_healthy`, nginx все равно проверяет upstream при старте

## Решение

Использовать **динамический резолвинг** через переменную:

```nginx
resolver 127.0.0.11 valid=30s;  # Docker DNS
set $backend http://web:8000;
proxy_pass $backend;
```

### Как это работает:

1. `resolver 127.0.0.11` - использует Docker встроенный DNS
2. `set $backend` - создает переменную (не резолвится при старте)
3. `proxy_pass $backend` - резолвится **только когда приходит запрос**, а не при старте
4. `proxy_next_upstream` - если upstream недоступен, nginx не падает, а ждет

## Результат

Теперь:
- ✅ Nginx стартует **даже если `web` еще не готов**
- ✅ Когда приходит запрос к `/api/`, nginx резолвит `web:8000` **в этот момент**
- ✅ Если `web` еще не готов, nginx просто ждет (по `proxy_connect_timeout`)
- ✅ Бэкенд может стартовать **после** фронтенда без проблем

## Команды для применения

```bash
# 1. Получить обновленный nginx-frontend.conf
git pull

# 2. Перезапустить frontend
docker compose restart frontend

# Или полный перезапуск:
docker compose down
docker compose up -d
```



