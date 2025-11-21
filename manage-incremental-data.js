import IncrementalDataManager from './incremental-data-manager.js';
import cron from 'node-cron';

const dataManager = new IncrementalDataManager();

// CLI команды
const command = process.argv[2];
const days = parseInt(process.argv[3]) || 1;

switch (command) {
  case 'load':
    console.log(`🔄 Загрузка данных за последние ${days} дней...`);
    dataManager.loadDataForPeriod(days).then(result => {
      if (result.success) {
        console.log(`✅ Загрузка завершена! Добавлено ${result.records} записей`);
        if (result.total) {
          console.log(`📊 Всего записей в базе: ${result.total}`);
        }
      } else {
        console.error(`❌ Ошибка загрузки: ${result.error}`);
      }
      process.exit(result.success ? 0 : 1);
    });
    break;

  case 'load-multiple':
    console.log('🔄 Загрузка данных по дням...');
    loadMultipleDays(parseInt(days) || 7).then(() => {
      console.log('✅ Загрузка по дням завершена!');
      process.exit(0);
    });
    break;

  case 'stats':
    console.log('📊 Статистика данных...');
    dataManager.getStats().then(stats => {
      console.log('\n📈 Статистика данных:');
      console.log(`   Всего записей: ${stats.totalRecords}`);
      console.log(`   Размер файла: ${stats.fileSize} KB`);
      console.log(`   Последнее обновление: ${stats.lastUpdate || 'Никогда'}`);
      console.log(`   Последняя полная выгрузка: ${stats.lastFullExport || 'Никогда'}`);
      if (stats.dataRange) {
        console.log(`   Диапазон данных: ${stats.dataRange.from} - ${stats.dataRange.to}`);
      }
      console.log('');
    });
    break;

  case 'schedule':
    console.log('⏰ Запуск планировщика инкрементальных обновлений...');
    console.log('Обновления будут выполняться каждые 6 часов');
    
    // Обновление каждые 6 часов
    cron.schedule('0 */6 * * *', async () => {
      console.log(`\n🔄 Автоматическое обновление данных (${new Date().toLocaleString()})`);
      const result = await dataManager.loadDataForPeriod(2); // Загружаем за последние 2 дня
      if (result.success) {
        console.log(`✅ Автоматическое обновление завершено! Добавлено ${result.records} записей`);
      } else {
        console.error(`❌ Ошибка автоматического обновления: ${result.error}`);
      }
    });
    
    console.log('Планировщик запущен. Нажмите Ctrl+C для остановки.');
    break;

  default:
    console.log(`
📊 Инкрементальный менеджер данных для Metabase BI

Использование:
  node manage-incremental-data.js <команда> [дни]

Команды:
  load [дни]        - Загрузить данные за последние N дней (по умолчанию 1)
  load-multiple [дни] - Загрузить данные по дням за последние N дней
  stats             - Показать статистику данных
  schedule          - Запустить автоматические обновления каждые 6 часов

Примеры:
  node manage-incremental-data.js load 1     # Загрузить за вчера
  node manage-incremental-data.js load 3     # Загрузить за последние 3 дня
  node manage-incremental-data.js load-multiple 7  # Загрузить по дням за неделю
  node manage-incremental-data.js stats      # Посмотреть статистику
  node manage-incremental-data.js schedule   # Автоматические обновления

Стратегия:
  1. Установите в BI фильтр на 1-2 дня
  2. Запустите load-multiple 30 для первоначальной загрузки
  3. Настройте schedule для автоматических обновлений
`);
    break;
}

// Функция для загрузки данных по дням
async function loadMultipleDays(totalDays) {
  console.log(`🔄 Загрузка данных за последние ${totalDays} дней по дням...`);
  
  for (let i = 1; i <= totalDays; i++) {
    console.log(`\n📅 Загружаем данные за ${i} день(дней) назад...`);
    
    try {
      const result = await dataManager.loadDataForPeriod(i);
      if (result.success) {
        console.log(`✅ День ${i}: добавлено ${result.records} записей`);
      } else {
        console.error(`❌ День ${i}: ошибка - ${result.error}`);
      }
      
      // Небольшая пауза между запросами
      if (i < totalDays) {
        console.log('⏳ Пауза 2 секунды...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`❌ День ${i}: критическая ошибка - ${error.message}`);
    }
  }
  
  console.log('\n✅ Загрузка по дням завершена!');
}
