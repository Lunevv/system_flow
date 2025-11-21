import DataManager from './data-manager.js';
import cron from 'node-cron';

const dataManager = new DataManager();

// CLI команды
const command = process.argv[2];

switch (command) {
  case 'init':
    console.log('🚀 Инициализация системы данных...');
    dataManager.initialExport().then(result => {
      if (result.success) {
        console.log(`✅ Инициализация завершена! Загружено ${result.records} записей`);
      } else {
        console.error(`❌ Ошибка инициализации: ${result.error}`);
      }
      process.exit(result.success ? 0 : 1);
    });
    break;

  case 'update':
    console.log('🔄 Обновление данных...');
    dataManager.dailyUpdate().then(result => {
      if (result.success) {
        console.log(`✅ Обновление завершено! Обновлено ${result.records} записей`);
        if (result.total) {
          console.log(`📊 Всего записей в базе: ${result.total}`);
        }
      } else {
        console.error(`❌ Ошибка обновления: ${result.error}`);
      }
      process.exit(result.success ? 0 : 1);
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
    console.log('⏰ Запуск планировщика автоматических обновлений...');
    console.log('Обновления будут выполняться каждые 12 часов');
    
    // Обновление каждые 12 часов
    cron.schedule('0 */12 * * *', async () => {
      console.log(`\n🔄 Автоматическое обновление данных (${new Date().toLocaleString()})`);
      const result = await dataManager.dailyUpdate();
      if (result.success) {
        console.log(`✅ Автоматическое обновление завершено! Обновлено ${result.records} записей`);
      } else {
        console.error(`❌ Ошибка автоматического обновления: ${result.error}`);
      }
    });
    
    console.log('Планировщик запущен. Нажмите Ctrl+C для остановки.');
    break;

  default:
    console.log(`
📊 Менеджер данных для Metabase BI

Использование:
  node manage-data.js <команда>

Команды:
  init     - Первоначальная выгрузка данных за 30 дней
  update   - Ежедневное обновление (только новые данные)
  stats    - Показать статистику данных
  schedule - Запустить автоматические обновления каждые 12 часов

Примеры:
  node manage-data.js init     # Первая настройка
  node manage-data.js update   # Обновить данные
  node manage-data.js stats    # Посмотреть статистику
  node manage-data.js schedule # Запустить автоматические обновления
`);
    break;
}
