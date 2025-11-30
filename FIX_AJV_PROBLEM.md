# Исправление проблемы с ajv

## Проблема
```
Error: Cannot find module 'ajv/dist/compile/codegen'
```

## Причина
1. В `package-lock.json` смешаны версии `ajv` (6.x и 8.x)
2. `ajv-keywords@5.1.0` требует `ajv@8.x`, но устанавливается `ajv@6.x`
3. Команда в docker-compose.yml не удаляла `node_modules`, поэтому оставались старые версии

## Решение
Добавлено в команду `frontend_build`:
1. `rm -rf node_modules` - удалить старые зависимости
2. `npm install ajv@^8.12.0` - установить правильную версию ajv после основной установки

## Команды на сервере

```bash
# 1. Получить обновленный docker-compose.yml
git pull

# 2. Остановить и удалить frontend_build
docker compose stop frontend_build
docker compose rm -f frontend_build

# 3. Запустить заново (теперь удалит node_modules и установит правильную версию ajv)
docker compose up -d frontend_build

# 4. Следить за сборкой
docker compose logs -f frontend_build
```

## Что изменено в docker-compose.yml

Было:
```yaml
command: sh -c "npm install --legacy-peer-deps && chmod +x node_modules/.bin/* && npm run build"
```

Стало:
```yaml
command: sh -c "rm -rf node_modules && npm install --legacy-peer-deps && npm install ajv@^8.12.0 --legacy-peer-deps && chmod +x node_modules/.bin/* && npm run build"
```

Теперь каждый раз при сборке:
1. Удаляются старые `node_modules`
2. Устанавливаются зависимости заново
3. Устанавливается правильная версия `ajv@8.12.0` (совместимая с `ajv-keywords@5.1.0`)



