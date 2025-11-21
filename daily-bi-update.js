#!/usr/bin/env node

import cron from 'node-cron';
import { fetchBIData } from './fetch-bi-data.js';

/**
 * Ежедневное обновление BI кэша
 * Запускается каждый день в 6:00 утра
 */
const scheduleBIUpdate = () => {
  console.log('🕐 Настройка ежедневного обновления BI кэша...');
  
  // Запускаем обновление каждый день в 6:00 утра
  cron.schedule('0 6 * * *', async () => {
    console.log('🌅 Запуск ежедневного обновления BI кэша...');
    try {
      await fetchBIData();
      console.log('✅ Ежедневное обновление BI кэша завершено');
    } catch (error) {
      console.error('❌ Ошибка ежедневного обновления BI кэша:', error);
    }
  }, {
    scheduled: true,
    timezone: "Europe/Moscow"
  });
  
  console.log('✅ Ежедневное обновление BI кэша настроено (6:00 МСК)');
};

/**
 * Немедленное обновление BI кэша
 */
const updateBINow = async () => {
  console.log('🔄 Немедленное обновление BI кэша...');
  try {
    await fetchBIData();
    console.log('✅ Немедленное обновление BI кэша завершено');
  } catch (error) {
    console.error('❌ Ошибка немедленного обновления BI кэша:', error);
    process.exit(1);
  }
};

// Основная логика
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'now':
      await updateBINow();
      break;
    case 'schedule':
      scheduleBIUpdate();
      // Держим процесс живым
      process.stdin.resume();
      break;
    default:
      console.log('Использование:');
      console.log('  node daily-bi-update.js now      - Немедленное обновление');
      console.log('  node daily-bi-update.js schedule - Настройка ежедневного обновления');
      break;
  }
}

// Запуск скрипта
main();

