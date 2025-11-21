# 🌐 Настройка публичного доступа к проекту

## Вариант 1: Через Nginx (рекомендуется)

### 1. Установите Nginx на сервере:

```bash
sudo apt update
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 2. Создайте конфигурацию Nginx:

```bash
sudo nano /etc/nginx/sites-available/esp-server-manager
```

Вставьте следующую конфигурацию:

```nginx
server {
    listen 80;
    server_name ваш-домен.com;  # Или IP адрес сервера

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
```

### 3. Активируйте конфигурацию:

```bash
sudo ln -s /etc/nginx/sites-available/esp-server-manager /etc/nginx/sites-enabled/
sudo nginx -t  # Проверка конфигурации
sudo systemctl reload nginx
```

### 4. Откройте порты в firewall:

```bash
# Если используете UFW
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp  # Для HTTPS в будущем
sudo ufw status
```

### 5. Доступ к проекту:

- **По IP**: `http://ваш-ip-адрес`
- **По домену**: `http://ваш-домен.com`

---

## Вариант 2: Прямой доступ через порты (проще, но менее безопасно)

### 1. Убедитесь что проект слушает на всех интерфейсах:

Проверьте что в `start-server.sh` используется `--host 0.0.0.0` (уже должно быть).

### 2. Откройте порты в firewall:

```bash
# Если используете UFW
sudo ufw allow 3000/tcp
sudo ufw allow 3001/tcp
sudo ufw status
```

### 3. Доступ к проекту:

- **Frontend**: `http://ваш-ip-адрес:3000`
- **Backend API**: `http://ваш-ip-адрес:3001`

⚠️ **Внимание**: Этот способ менее безопасен, так как порты открыты напрямую.

---

## Вариант 3: Настройка домена (для профессионального использования)

### 1. Настройте DNS записи:

В панели управления доменом добавьте A-запись:
- **Имя**: `@` или `www`
- **Тип**: `A`
- **Значение**: IP адрес вашего сервера
- **TTL**: `3600`

### 2. Установите SSL сертификат (Let's Encrypt):

```bash
# Установите Certbot
sudo apt install certbot python3-certbot-nginx -y

# Получите сертификат
sudo certbot --nginx -d ваш-домен.com -d www.ваш-домен.com

# Автоматическое обновление
sudo certbot renew --dry-run
```

### 3. Обновите конфигурацию Nginx для HTTPS:

Certbot автоматически обновит конфигурацию, или добавьте:

```nginx
server {
    listen 443 ssl http2;
    server_name ваш-домен.com;

    ssl_certificate /etc/letsencrypt/live/ваш-домен.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ваш-домен.com/privkey.pem;

    # ... остальная конфигурация как выше
}

# Редирект с HTTP на HTTPS
server {
    listen 80;
    server_name ваш-домен.com;
    return 301 https://$server_name$request_uri;
}
```

---

## 🔍 Проверка доступа

### Локально на сервере:

```bash
curl http://localhost:3000
curl http://localhost:3001/api/cached-stats
```

### Извне:

```bash
# С вашего компьютера
curl http://ваш-ip-адрес:3000
curl http://ваш-ip-адрес:3001/api/cached-stats
```

### В браузере:

Откройте `http://ваш-ip-адрес` или `http://ваш-домен.com`

---

## 🛡️ Безопасность

### Рекомендации:

1. **Используйте HTTPS** (через Let's Encrypt)
2. **Настройте firewall** (откройте только нужные порты)
3. **Используйте сильные пароли** для SSH
4. **Регулярно обновляйте систему**: `sudo apt update && sudo apt upgrade`
5. **Ограничьте доступ к API** (если нужно, добавьте авторизацию)

### Ограничение доступа по IP (опционально):

В Nginx можно ограничить доступ:

```nginx
location /api/update-stats {
    allow 192.168.1.0/24;  # Ваша локальная сеть
    allow 1.2.3.4;         # Конкретный IP
    deny all;
    proxy_pass http://localhost:3001;
}
```

---

## 📝 Быстрая настройка (скрипт)

Создайте файл `setup-nginx.sh`:

```bash
#!/bin/bash

DOMAIN=$1
if [ -z "$DOMAIN" ]; then
    echo "Использование: ./setup-nginx.sh ваш-домен.com"
    echo "Или для IP: ./setup-nginx.sh IP"
    exit 1
fi

# Создаем конфигурацию
sudo tee /etc/nginx/sites-available/esp-server-manager > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

# Активируем
sudo ln -sf /etc/nginx/sites-available/esp-server-manager /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

echo "✅ Nginx настроен для $DOMAIN"
echo "🌐 Откройте: http://$DOMAIN"
```

Использование:
```bash
chmod +x setup-nginx.sh
./setup-nginx.sh ваш-домен.com
# или
./setup-nginx.sh 192.168.1.100
```

