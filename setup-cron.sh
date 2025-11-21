#!/bin/bash

# Скрипт для настройки cron на сервере
# Запускайте на сервере: ./setup-cron.sh

PROJECT_DIR="$HOME/system_flow"
NODE_PATH=$(which node)

echo "🕐 Настройка cron для автообновления данных..."

# Проверяем что мы в правильной директории
if [ ! -f "$PROJECT_DIR/manage-data.js" ]; then
    echo "❌ Ошибка: Файл manage-data.js не найден в $PROJECT_DIR"
    echo "Убедитесь что вы находитесь в директории проекта"
    exit 1
fi

# Создаем временный файл с cron задачами
CRON_FILE=$(mktemp)

# Получаем текущие cron задачи (если есть)
crontab -l > "$CRON_FILE" 2>/dev/null || true

# Удаляем старые задачи для этого проекта (если есть)
sed -i.bak "\|$PROJECT_DIR|d" "$CRON_FILE" 2>/dev/null || true

# Добавляем новые задачи
echo "" >> "$CRON_FILE"
echo "# ESP Server Manager - Автообновление данных" >> "$CRON_FILE"
echo "# Обновление статистики каждый день в 6:00 МСК" >> "$CRON_FILE"
echo "0 3 * * * cd $PROJECT_DIR && $NODE_PATH manage-data.js update >> $PROJECT_DIR/daily-update.log 2>&1" >> "$CRON_FILE"
echo "" >> "$CRON_FILE"
echo "# Обновление BI кэша (конфигурация серверов) каждый день в 7:00 МСК" >> "$CRON_FILE"
echo "0 4 * * * cd $PROJECT_DIR && $NODE_PATH fetch-bi-data.js --force >> $PROJECT_DIR/bi-update.log 2>&1" >> "$CRON_FILE"

# Устанавливаем новые cron задачи
crontab "$CRON_FILE"

# Удаляем временный файл
rm -f "$CRON_FILE" "$CRON_FILE.bak"

echo "✅ Cron задачи настроены!"
echo ""
echo "📋 Установленные задачи:"
crontab -l | grep -A 2 "ESP Server Manager"
echo ""
echo "📝 Проверка cron задач:"
echo "  crontab -l"
echo ""
echo "📊 Просмотр логов:"
echo "  tail -f $PROJECT_DIR/daily-update.log"
echo "  tail -f $PROJECT_DIR/bi-update.log"
echo ""
echo "🧪 Ручной запуск обновления:"
echo "  cd $PROJECT_DIR && $NODE_PATH manage-data.js update"
echo "  cd $PROJECT_DIR && $NODE_PATH fetch-bi-data.js --force"

