#!/bin/bash
# Скрипт автоматического деплоя для habbits
# Запускается при пуше в main ветку

set -e

DEPLOY_DIR="/opt/habbits"
REPO_URL="https://github.com/hlebgleb/habbits.git"
BRANCH="main"

echo "🚀 Начинаем деплой habbits..."
echo "📅 $(date)"

cd "$DEPLOY_DIR"

# Получаем последние изменения
echo "📥 Получаем изменения из git..."
git fetch origin
git reset --hard origin/$BRANCH

# Пересобираем и перезапускаем контейнер
echo "🔨 Пересобираем Docker-образ..."
docker compose build --no-cache

echo "🔄 Перезапускаем контейнер..."
docker compose up -d

# Проверяем здоровье
echo "🏥 Проверяем статус..."
sleep 5
if docker compose ps | grep -q "Up"; then
    echo "✅ Деплой завершён успешно!"
    docker compose ps
else
    echo "❌ Ошибка деплоя!"
    docker compose logs --tail=50
    exit 1
fi
