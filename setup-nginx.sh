#!/bin/bash

# Скрипт для быстрой настройки Nginx
# Использование: ./setup-nginx.sh ваш-домен.com или IP-адрес

DOMAIN=$1
if [ -z "$DOMAIN" ]; then
    echo "❌ Укажите домен или IP адрес"
    echo "Использование: ./setup-nginx.sh ваш-домен.com"
    echo "Или: ./setup-nginx.sh 192.168.1.100"
    exit 1
fi

echo "🌐 Настройка Nginx для $DOMAIN..."

# Проверяем что Nginx установлен
if ! command -v nginx &> /dev/null; then
    echo "📦 Устанавливаем Nginx..."
    sudo apt update
    sudo apt install nginx -y
    sudo systemctl start nginx
    sudo systemctl enable nginx
fi

# Создаем конфигурацию
echo "📝 Создаем конфигурацию..."
sudo tee /etc/nginx/sites-available/esp-server-manager > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
EOF

# Активируем конфигурацию
echo "🔗 Активируем конфигурацию..."
sudo ln -sf /etc/nginx/sites-available/esp-server-manager /etc/nginx/sites-enabled/

# Удаляем дефолтную конфигурацию если есть
sudo rm -f /etc/nginx/sites-enabled/default

# Проверяем конфигурацию
echo "✔ Проверяем конфигурацию..."
if sudo nginx -t; then
    sudo systemctl reload nginx
    echo ""
    echo "✅ Nginx успешно настроен!"
    echo ""
    echo "🌐 Доступ к проекту:"
    echo "   http://$DOMAIN"
    echo ""
    echo "🔍 Проверка:"
    echo "   curl http://$DOMAIN"
    echo ""
    echo "🛡️  Не забудьте открыть порт 80 в firewall:"
    echo "   sudo ufw allow 80/tcp"
else
    echo "❌ Ошибка в конфигурации Nginx"
    exit 1
fi

