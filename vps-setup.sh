#!/bin/bash
# Скрипт первоначальной настройки VPS для habbits
# Запускать от root или с sudo

set -e

echo "🔧 Настройка VPS для habbits..."

# Обновляем систему
echo "📦 Обновляем пакеты..."
apt-get update
apt-get upgrade -y

# Устанавливаем Docker если не установлен
if ! command -v docker &> /dev/null; then
    echo "🐳 Устанавливаем Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    usermod -aG docker gleb
fi

# Устанавливаем docker compose plugin если не установлен
if ! docker compose version &> /dev/null; then
    echo "🐳 Устанавливаем Docker Compose plugin..."
    apt-get install -y docker-compose-plugin
fi

# Устанавливаем nginx если не установлен
if ! command -v nginx &> /dev/null; then
    echo "🌐 Устанавливаем Nginx..."
    apt-get install -y nginx
fi

# Устанавливаем certbot для SSL
if ! command -v certbot &> /dev/null; then
    echo "🔒 Устанавливаем Certbot..."
    apt-get install -y certbot python3-certbot-nginx
fi

# Создаём директорию для приложения
echo "📁 Создаём директории..."
mkdir -p /opt/habbits
chown gleb:gleb /opt/habbits

# Клонируем репозиторий
if [ ! -d "/opt/habbits/.git" ]; then
    echo "📥 Клонируем репозиторий..."
    sudo -u gleb git clone https://github.com/hlebgleb/habbits.git /opt/habbits
fi

# Создаём systemd сервис для webhook
echo "⚙️ Настраиваем systemd сервисы..."
cat > /etc/systemd/system/habbits-webhook.service << 'EOF'
[Unit]
Description=Habbits Deploy Webhook Server
After=network.target

[Service]
Type=simple
User=gleb
WorkingDirectory=/opt/habbits
Environment=WEBHOOK_SECRET=habbits-deploy-secret-2026
ExecStart=/usr/bin/python3 /opt/habbits/webhook-server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Включаем и запускаем сервисы
systemctl daemon-reload
systemctl enable habbits-webhook
systemctl start habbits-webhook

echo "✅ Базовая настройка завершена!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Создайте файл /opt/habbits/.env с переменными окружения"
echo "2. Запустите: cd /opt/habbits && docker compose up -d"
echo "3. Настройте nginx (см. nginx-habbits.conf)"
echo "4. Добавьте webhook в GitHub: http://YOUR_IP:9000/deploy"
