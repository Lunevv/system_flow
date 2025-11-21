#!/usr/bin/env node

import IncrementalDataManager from './incremental-data-manager.js';

const dataManager = new IncrementalDataManager();

console.log('🕐 Ежедневное обновление данных - запуск в 6:00 утра');
console.log('📅 Дата:', new Date().toLocaleString('ru-RU'));

async function dailyUpdate() {
  try {
    console.log('🔄 Начинаем ежедневное обновление данных...');
    
    // Загружаем данные за последние 2 дня (вчера + сегодня)
    const result = await dataManager.loadDataForPeriod(2);
    
    if (result.success) {
      console.log(`✅ Ежедневное обновление завершено!`);
      console.log(`📊 Добавлено новых записей: ${result.records}`);
      console.log(`📈 Всего записей в базе: ${result.total}`);
    } else {
      console.error(`❌ Ошибка ежедневного обновления: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Критическая ошибка ежедневного обновления:', error);
    process.exit(1);
  }
}

// Запускаем обновление
dailyUpdate();
