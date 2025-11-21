#!/bin/bash

# Скрипт для запуска проекта без PM2

cd "$(dirname "$0")"

# Создаем директорию для логов
mkdir -p logs

# Функция для запуска процесса в фоне
start_process() {
    local name=$1
    local command=$2
    local log_file="logs/${name}.log"
    
    echo "Запускаем $name..."
    nohup $command > "$log_file" 2>&1 &
    echo $! > "logs/${name}.pid"
    echo "✅ $name запущен (PID: $(cat logs/${name}.pid))"
}

# Останавливаем старые процессы если есть
if [ -f logs/frontend.pid ]; then
    kill $(cat logs/frontend.pid) 2>/dev/null || true
    rm logs/frontend.pid
fi

if [ -f logs/proxy.pid ]; then
    kill $(cat logs/proxy.pid) 2>/dev/null || true
    rm logs/proxy.pid
fi

# Запускаем Frontend
start_process "frontend" "npm run preview -- --port 3000 --host 0.0.0.0"

# Ждем немного
sleep 2

# Запускаем Proxy
start_process "proxy" "npm run proxy"

echo ""
echo "✅ Проект запущен!"
echo "📊 Frontend: http://localhost:3000"
echo "📊 Backend: http://localhost:3001"
echo ""
echo "Логи:"
echo "  - Frontend: tail -f logs/frontend.log"
echo "  - Proxy: tail -f logs/proxy.log"
echo ""
echo "Остановка: ./stop-server.sh"

