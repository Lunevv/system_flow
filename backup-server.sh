#!/bin/bash

# Скрипт для создания бекапа сервера
# Использование: ./backup-server.sh

PROJECT_DIR="$HOME/system_flow"
BACKUP_DIR="$PROJECT_DIR/backups"
TIMESTAMP=$(date +"%Y-%m-%d-%H-%M-%S")
BACKUP_NAME="backup-$TIMESTAMP"

echo "💾 Создание бекапа сервера..."

# Создаем директорию для бекапов
mkdir -p "$BACKUP_DIR"

# Создаем директорию для текущего бекапа
CURRENT_BACKUP="$BACKUP_DIR/$BACKUP_NAME"
mkdir -p "$CURRENT_BACKUP"

# Копируем важные файлы
echo "📁 Копируем файлы..."

# Конфигурационные файлы
cp "$PROJECT_DIR/package.json" "$CURRENT_BACKUP/" 2>/dev/null
cp "$PROJECT_DIR/package-lock.json" "$CURRENT_BACKUP/" 2>/dev/null
cp "$PROJECT_DIR/proxy-server.js" "$CURRENT_BACKUP/" 2>/dev/null
cp "$PROJECT_DIR/ecosystem.config.js" "$CURRENT_BACKUP/" 2>/dev/null
cp "$PROJECT_DIR/start-server.sh" "$CURRENT_BACKUP/" 2>/dev/null
cp "$PROJECT_DIR/stop-server.sh" "$CURRENT_BACKUP/" 2>/dev/null

# Данные
if [ -f "$PROJECT_DIR/cached_stats.csv" ]; then
  cp "$PROJECT_DIR/cached_stats.csv" "$CURRENT_BACKUP/" 2>/dev/null
  echo "  ✅ cached_stats.csv"
fi

if [ -f "$PROJECT_DIR/bi_cache.json" ]; then
  cp "$PROJECT_DIR/bi_cache.json" "$CURRENT_BACKUP/" 2>/dev/null
  echo "  ✅ bi_cache.json"
fi

if [ -f "$PROJECT_DIR/config_queue.csv" ]; then
  cp "$PROJECT_DIR/config_queue.csv" "$CURRENT_BACKUP/" 2>/dev/null
  echo "  ✅ config_queue.csv"
fi

# Frontend файлы (если есть dist)
if [ -d "$PROJECT_DIR/dist" ]; then
  cp -r "$PROJECT_DIR/dist" "$CURRENT_BACKUP/" 2>/dev/null
  echo "  ✅ dist/"
fi

# Сохраняем текущий Git commit
cd "$PROJECT_DIR"
git rev-parse HEAD > "$CURRENT_BACKUP/git-commit.txt" 2>/dev/null
git log -1 --pretty=format:"%H %s" > "$CURRENT_BACKUP/git-info.txt" 2>/dev/null

# Создаем архив
cd "$BACKUP_DIR"
tar -czf "$BACKUP_NAME.tar.gz" "$BACKUP_NAME" 2>/dev/null
rm -rf "$BACKUP_NAME"

echo ""
echo "✅ Бекап создан: $BACKUP_DIR/$BACKUP_NAME.tar.gz"
echo ""
echo "📊 Информация о бекапе:"
if [ -f "$CURRENT_BACKUP/git-info.txt" ]; then
  cat "$CURRENT_BACKUP/git-info.txt"
fi
echo ""
echo "💡 Для восстановления используйте:"
echo "   ./restore-backup.sh $BACKUP_NAME"

