#!/bin/bash

# Скрипт для остановки проекта

cd "$(dirname "$0")"

echo "🛑 Останавливаем процессы..."

if [ -f logs/frontend.pid ]; then
    PID=$(cat logs/frontend.pid)
    if kill $PID 2>/dev/null; then
        echo "✅ Frontend остановлен (PID: $PID)"
    fi
    rm logs/frontend.pid
fi

if [ -f logs/proxy.pid ]; then
    PID=$(cat logs/proxy.pid)
    if kill $PID 2>/dev/null; then
        echo "✅ Proxy остановлен (PID: $PID)"
    fi
    rm logs/proxy.pid
fi

# Также убиваем процессы по имени на всякий случай
pkill -f "vite preview" 2>/dev/null || true
pkill -f "proxy-server.js" 2>/dev/null || true

echo "✅ Все процессы остановлены"

