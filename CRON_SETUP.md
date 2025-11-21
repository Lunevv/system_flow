# 🕐 Настройка ежедневного обновления данных

## 📋 Инструкция по настройке cron

### **1. Откройте crontab для редактирования:**
```bash
crontab -e
```

### **2. Добавьте строку для ежедневного обновления в 6:00 утра:**
```bash
0 6 * * * cd /Users/lv/Downloads/system-flow && npm run data:daily-update >> /Users/lv/Downloads/system-flow/daily-update.log 2>&1
```

### **3. Сохраните и выйдите** (в nano: Ctrl+X, затем Y, затем Enter)

### **4. Проверьте, что cron настроен:**
```bash
crontab -l
```

## 🔧 **Альтернативный способ (через systemd на Linux):**

### **1. Создайте файл сервиса:**
```bash
sudo nano /etc/systemd/system/email-stats-update.service
```

### **2. Добавьте содержимое:**
```ini
[Unit]
Description=Email Statistics Daily Update
After=network.target

[Service]
Type=oneshot
User=lv
WorkingDirectory=/Users/lv/Downloads/system-flow
ExecStart=/usr/bin/npm run data:daily-update
StandardOutput=append:/Users/lv/Downloads/system-flow/daily-update.log
StandardError=append:/Users/lv/Downloads/system-flow/daily-update.log
```

### **3. Создайте таймер:**
```bash
sudo nano /etc/systemd/system/email-stats-update.timer
```

### **4. Добавьте содержимое:**
```ini
[Unit]
Description=Run email stats update daily at 6:00 AM
Requires=email-stats-update.service

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
```

### **5. Активируйте сервис:**
```bash
sudo systemctl enable email-stats-update.timer
sudo systemctl start email-stats-update.timer
```

## 📊 **Мониторинг:**

### **Просмотр логов:**
```bash
tail -f /Users/lv/Downloads/system-flow/daily-update.log
```

### **Проверка статуса cron:**
```bash
sudo systemctl status cron  # Linux
brew services list | grep cron  # macOS
```

## 🎯 **Что происходит при обновлении:**

1. **🕐 6:00 утра** - запускается скрипт обновления
2. **📥 Загрузка данных** за последние 2 дня из Metabase BI
3. **🔄 Обновление кэша** - добавление новых данных в `cached_stats.csv`
4. **📝 Логирование** - запись результатов в `daily-update.log`
5. **✅ Готово** - данные обновлены для использования в интерфейсе

## 🚨 **Устранение неполадок:**

### **Если обновление не работает:**
1. Проверьте логи: `tail -f daily-update.log`
2. Убедитесь, что прокси сервер запущен
3. Проверьте права доступа к файлам
4. Проверьте подключение к Metabase BI

### **Ручной запуск обновления:**
```bash
npm run data:daily-update
```
