#!/bin/bash

# Скрипт для восстановления из бекапа
# Использование: ./restore-backup.sh backup-YYYY-MM-DD-HH-MM-SS

if [ -z "$1" ]; then
  echo "❌ Укажите имя бекапа"
  echo "Использование: ./restore-backup.sh backup-YYYY-MM-DD-HH-MM-SS"
  echo ""
  echo "Доступные бекапы:"
  ls -1 ~/system_flow/backups/*.tar.gz 2>/dev/null | sed 's/.*\//  /' | sed 's/\.tar\.gz$//'
  exit 1
fi

PROJECT_DIR="$HOME/system_flow"
BACKUP_DIR="$PROJECT_DIR/backups"
BACKUP_NAME="$1"
BACKUP_FILE="$BACKUP_DIR/$BACKUP_NAME.tar.gz"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Бекап не найден: $BACKUP_FILE"
  exit 1
fi

echo "🔄 Восстановление из бекапа: $BACKUP_NAME"
echo "⚠️  Это перезапишет текущие файлы!"
read -p "Продолжить? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Отменено."
  exit 1
fi

# Останавливаем сервер
echo "🛑 Останавливаем сервер..."
cd "$PROJECT_DIR"
./stop-server.sh 2>/dev/null

# Создаем бекап текущего состояния (на всякий случай)
echo "💾 Создаем бекап текущего состояния..."
./backup-server.sh > /dev/null 2>&1

# Распаковываем бекап
echo "📦 Распаковываем бекап..."
TEMP_DIR=$(mktemp -d)
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Восстанавливаем файлы
echo "📁 Восстанавливаем файлы..."
BACKUP_CONTENT="$TEMP_DIR/$BACKUP_NAME"

# Конфигурационные файлы
[ -f "$BACKUP_CONTENT/package.json" ] && cp "$BACKUP_CONTENT/package.json" "$PROJECT_DIR/"
[ -f "$BACKUP_CONTENT/package-lock.json" ] && cp "$BACKUP_CONTENT/package-lock.json" "$PROJECT_DIR/"
[ -f "$BACKUP_CONTENT/proxy-server.js" ] && cp "$BACKUP_CONTENT/proxy-server.js" "$PROJECT_DIR/"
[ -f "$BACKUP_CONTENT/ecosystem.config.js" ] && cp "$BACKUP_CONTENT/ecosystem.config.js" "$PROJECT_DIR/"
[ -f "$BACKUP_CONTENT/start-server.sh" ] && cp "$BACKUP_CONTENT/start-server.sh" "$PROJECT_DIR/"
[ -f "$BACKUP_CONTENT/stop-server.sh" ] && cp "$BACKUP_CONTENT/stop-server.sh" "$PROJECT_DIR/"

# Данные
[ -f "$BACKUP_CONTENT/cached_stats.csv" ] && cp "$BACKUP_CONTENT/cached_stats.csv" "$PROJECT_DIR/"
[ -f "$BACKUP_CONTENT/bi_cache.json" ] && cp "$BACKUP_CONTENT/bi_cache.json" "$PROJECT_DIR/"
[ -f "$BACKUP_CONTENT/config_queue.csv" ] && cp "$BACKUP_CONTENT/config_queue.csv" "$PROJECT_DIR/"

# Frontend
if [ -d "$BACKUP_CONTENT/dist" ]; then
  rm -rf "$PROJECT_DIR/dist"
  cp -r "$BACKUP_CONTENT/dist" "$PROJECT_DIR/"
fi

# Устанавливаем зависимости если нужно
if [ -f "$PROJECT_DIR/package.json" ]; then
  echo "📦 Устанавливаем зависимости..."
  npm install
fi

# Пересобираем проект
echo "🔨 Пересобираем проект..."
npm run build

# Очищаем временную директорию
rm -rf "$TEMP_DIR"

echo ""
echo "✅ Восстановление завершено!"
echo ""
echo "📝 Информация о восстановленной версии:"
if [ -f "$BACKUP_CONTENT/git-info.txt" ]; then
  cat "$BACKUP_CONTENT/git-info.txt"
fi
echo ""
echo "🚀 Запустите сервер:"
echo "   ./start-server.sh"

