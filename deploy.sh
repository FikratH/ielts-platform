#!/bin/bash
set -e

echo "===== ДЕПЛОЙ IELTS PLATFORM ====="
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Функция для проверки статуса
check_service() {
    local service=$1
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}Ожидание готовности сервиса: $service${NC}"
    while [ $attempt -le $max_attempts ]; do
        if docker compose ps $service | grep -q "healthy\|Up"; then
            echo -e "${GREEN}✓ Сервис $service готов${NC}"
            return 0
        fi
        echo "Попытка $attempt/$max_attempts..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}✗ Сервис $service не готов после $max_attempts попыток${NC}"
    return 1
}

# 1. Получить изменения
echo "1. Получение изменений из git..."
git pull || echo "Предупреждение: не удалось получить изменения из git"

# 2. Остановить контейнеры
echo ""
echo "2. Остановка текущих контейнеров..."
docker compose down

# 3. Пересобрать без кеша
echo ""
echo "3. Пересборка образов без кеша..."
read -p "Пересобрать без кеша? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker compose build --no-cache
else
    docker compose build
fi

# 4. Запустить базу данных
echo ""
echo "4. Запуск базы данных..."
docker compose up -d db
check_service db || exit 1

# 5. Запустить бэкенд
echo ""
echo "5. Запуск бэкенда..."
docker compose up -d web
check_service web || exit 1

# 6. Запустить сборку фронтенда
echo ""
echo "6. Запуск сборки фронтенда..."
docker compose up -d frontend_build

# 7. Дождаться завершения сборки
echo ""
echo "7. Ожидание завершения сборки фронтенда..."
echo "Это может занять 5-10 минут..."
docker compose logs -f frontend_build &
LOGS_PID=$!

# Проверяем каждые 10 секунд, завершилась ли сборка
while true; do
    if docker compose ps frontend_build | grep -q "Exited (0)"; then
        echo -e "${GREEN}✓ Сборка фронтенда завершена успешно${NC}"
        kill $LOGS_PID 2>/dev/null || true
        break
    fi
    if docker compose ps frontend_build | grep -q "Exited ([1-9])"; then
        echo -e "${RED}✗ Сборка фронтенда завершилась с ошибкой${NC}"
        kill $LOGS_PID 2>/dev/null || true
        docker compose logs frontend_build
        exit 1
    fi
    sleep 10
done

# 8. Запустить фронтенд (web уже готов и в той же сети)
echo ""
echo "8. Запуск фронтенда nginx..."
docker compose up -d frontend
sleep 3
check_service frontend || echo "Предупреждение: frontend может быть еще не готов"

# 9. Финальная проверка
echo ""
echo "9. Проверка статуса всех сервисов..."
docker compose ps

echo ""
echo -e "${GREEN}===== ДЕПЛОЙ ЗАВЕРШЕН! =====${NC}"
echo ""
echo "Проверьте логи:"
echo "  docker compose logs web"
echo "  docker compose logs frontend"
echo ""
echo "Проверьте сайт:"
echo "  https://ielts.mastereducation.kz"

