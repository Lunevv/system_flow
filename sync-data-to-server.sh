#!/bin/bash

# Скрипт для синхронизации данных с сервером
# Использование: ./sync-data-to-server.sh user@server-ip

if [ -z "$1" ]; then
    echo "❌ Укажите адрес сервера"
    echo "Использование: ./sync-data-to-server.sh user@server-ip"
    echo "Пример: ./sync-data-to-server.sh root@192.168.1.100"
    exit 1
fi

SERVER=$1
REMOTE_DIR="~/system_flow"

echo "🔄 Синхронизация данных с сервером $SERVER..."

# Основные файлы данных
echo "📊 Копируем файлы данных..."
scp cached_stats.csv $SERVER:$REMOTE_DIR/ 2>/dev/null && echo "  ✅ cached_stats.csv" || echo "  ⚠️  cached_stats.csv (не найден, будет создан на сервере)"
scp bi_cache.json $SERVER:$REMOTE_DIR/ 2>/dev/null && echo "  ✅ bi_cache.json" || echo "  ⚠️  bi_cache.json (не найден, будет создан на сервере)"

# Конфигурационные файлы
echo "⚙️  Копируем конфигурационные файлы..."
scp config_queue.csv $SERVER:$REMOTE_DIR/ && echo "  ✅ config_queue.csv"
scp queuesettings.txt $SERVER:$REMOTE_DIR/ && echo "  ✅ queuesettings.txt"
scp data_config.json $SERVER:$REMOTE_DIR/ && echo "  ✅ data_config.json"

# Файлы из public
echo "📁 Копируем файлы из public..."
ssh $SERVER "mkdir -p $REMOTE_DIR/public" 2>/dev/null
scp public/queuesettings.txt $SERVER:$REMOTE_DIR/public/ 2>/dev/null && echo "  ✅ public/queuesettings.txt" || echo "  ⚠️  public/queuesettings.txt (не найден)"

# CSV файлы из public если есть
if [ -f "public/тмп - Лист71 (1).csv" ]; then
    scp "public/тмп - Лист71 (1).csv" $SERVER:$REMOTE_DIR/public/ && echo "  ✅ public/тмп - Лист71 (1).csv"
fi

echo ""
echo "✅ Синхронизация завершена!"
echo ""
echo "📝 Следующие шаги на сервере:"
echo "  1. Проверьте файлы: ls -lh ~/system_flow/*.csv ~/system_flow/*.json"
echo "  2. Перезапустите проект: cd ~/system_flow && ./stop-server.sh && ./start-server.sh"
echo "  3. Проверьте API: curl http://localhost:3001/api/cached-stats"

