# Исправление ошибки сборки npm

## Проблема
```
Error: Cannot find module 'ajv/dist/compile/codegen'
```

## Причина
Удаление `package-lock.json` приводит к установке несовместимых версий зависимостей.

## Решение
Не удалять `package-lock.json`, использовать `npm ci` вместо `npm install` (если package-lock.json есть) или оставить package-lock.json.

## Исправление в docker-compose.yml

Изменено:
- Было: `rm -rf node_modules package-lock.json && npm install`
- Стало: `rm -rf node_modules && (npm ci --legacy-peer-deps || npm install --legacy-peer-deps)`

## Команды для исправления на сервере

```bash
# 1. Остановить frontend_build
docker compose stop frontend_build

# 2. Удалить контейнер
docker compose rm -f frontend_build

# 3. Получить обновленный docker-compose.yml
git pull

# 4. Запустить заново
docker compose up -d frontend_build

# 5. Следить за логами
docker compose logs -f frontend_build
```

## Альтернативное решение (если package-lock.json отсутствует)

Если package-lock.json нет в репозитории, можно установить правильную версию ajv:

```bash
# В docker-compose.yml изменить команду на:
command: sh -c "npm cache clean --force && rm -rf node_modules && npm install --legacy-peer-deps && npm install ajv@^8.0.0 --legacy-peer-deps && chmod +x node_modules/.bin/* && npm run build"
```

Но лучше добавить package-lock.json в репозиторий для стабильности.



