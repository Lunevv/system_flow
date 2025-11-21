#!/usr/bin/env node

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const METABASE_URL = 'https://ucoz.metabaseapp.com/public/question/4daf7d64-23fa-4fec-b479-229472be2a50.json';
const CACHE_FILE = 'bi_cache.json';

/**
 * Выгружает данные из Metabase BI и сохраняет в локальный кэш
 */
async function fetchBIData() {
  try {
    console.log('🔄 Загрузка данных из Metabase BI...');
    
    const response = await fetch(METABASE_URL);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`✅ Загружено ${data.length} записей из BI`);
    
    // Сохраняем в кэш-файл
    const cachePath = path.join(process.cwd(), CACHE_FILE);
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
    
    console.log(`💾 Данные сохранены в ${CACHE_FILE}`);
    
    // Выводим статистику
    const stats = {
      totalRecords: data.length,
      enabledRecords: data.filter(item => item.Status === 'enabled').length,
      disabledRecords: data.filter(item => item.Status === 'disabled').length,
      uniqueQueues: [...new Set(data.map(item => item.IdQueue))].length,
      uniqueServers: [...new Set(data.map(item => item.NameMailSender))].length
    };
    
    console.log('📊 Статистика:');
    console.log(`   Всего записей: ${stats.totalRecords}`);
    console.log(`   Активных: ${stats.enabledRecords}`);
    console.log(`   Отключенных: ${stats.disabledRecords}`);
    console.log(`   Уникальных очередей: ${stats.uniqueQueues}`);
    console.log(`   Уникальных серверов: ${stats.uniqueServers}`);
    
    return data;
    
  } catch (error) {
    console.error('❌ Ошибка загрузки данных из BI:', error.message);
    process.exit(1);
  }
}

/**
 * Проверяет, нужно ли обновлять кэш
 */
function shouldUpdateCache() {
  const cachePath = path.join(process.cwd(), CACHE_FILE);
  
  if (!fs.existsSync(cachePath)) {
    return true;
  }
  
  const stats = fs.statSync(cachePath);
  const hoursSinceUpdate = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
  
  // Обновляем кэш если он старше 6 часов
  return hoursSinceUpdate > 6;
}

// Основная логика
async function main() {
  const forceUpdate = process.argv.includes('--force');
  
  if (forceUpdate || shouldUpdateCache()) {
    await fetchBIData();
  } else {
    console.log('✅ Кэш актуален, обновление не требуется');
    console.log('💡 Для принудительного обновления используйте: node fetch-bi-data.js --force');
  }
}

// Запуск скрипта
main();

export { fetchBIData, shouldUpdateCache };
