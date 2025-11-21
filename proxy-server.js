import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = 3001;

// Включаем CORS для всех запросов
app.use(cors());

// Статическая раздача файлов
app.use(express.static('.'));

// Прокси для Metabase
app.get('/api/metabase/public/question/:id.json', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Получаем параметры периода из query string или используем по умолчанию 30 дней
    const days = parseInt(req.query.days) || 30;
    
    // Вычисляем даты для указанного периода
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - days);
    
    // Форматируем даты в нужном формате для Metabase
    const formatDate = (date) => {
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    };
    
    const dateFrom = formatDate(startDate);
    const dateTo = formatDate(today);
    
    // Добавляем параметры даты к URL (пробуем разные форматы)
    // Формат 1: JSON параметры
    let metabaseUrl = `https://ucoz.metabaseapp.com/public/question/${id}.json?parameters={"DateResult":"${dateFrom}~${dateTo}"}`;
    
    // Если это не работает, попробуем без параметров (возможно, фильтр встроен в запрос)
    console.log('Попробуем URL с параметрами:', metabaseUrl);
    
    console.log('Проксируем запрос к:', metabaseUrl);
    console.log(`Период: последние ${days} дней (${dateFrom} до ${dateTo})`);
    
    let response = await fetch(metabaseUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    // Если параметры не работают, попробуем без них
    if (!response.ok && response.status === 400) {
      console.log('Параметры не работают, пробуем без них...');
      const fallbackUrl = `https://ucoz.metabaseapp.com/public/question/${id}.json`;
      console.log('Fallback URL:', fallbackUrl);
      
      response = await fetch(fallbackUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });
    }
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Получены данные:', data.length, 'записей');
    
    res.json(data);
  } catch (error) {
    console.error('Ошибка прокси:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint для обновления данных
app.post('/api/update-data', async (req, res) => {
  try {
    console.log('Получен запрос на обновление данных...');
    
    // Импортируем DataManager
    const { default: DataManager } = await import('./data-manager.js');
    const dataManager = new DataManager();
    
    // Выполняем обновление
    const result = await dataManager.dailyUpdate();
    
    if (result.success) {
      console.log(`✅ Данные обновлены: ${result.records} записей, всего ${result.total} записей`);
      res.json({ 
        success: true, 
        message: `Данные обновлены: ${result.records} записей, всего ${result.total} записей`,
        records: result.records,
        total: result.total
      });
    } else {
      console.error(`❌ Ошибка обновления: ${result.error}`);
      res.status(500).json({ 
        success: false, 
        error: result.error 
      });
    }
  } catch (error) {
    console.error('Ошибка API обновления данных:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// API для обновления BI кэша (конфигурация серверов, очереди, маски)
app.post('/api/update-bi-cache', async (req, res) => {
  try {
    console.log('🔄 Запуск обновления BI кэша (конфигурация серверов)...');
    
    // Запускаем обновление конфигурации серверов через fetch-bi-data
    const { spawn } = await import('child_process');
    
    const child = spawn('node', ['fetch-bi-data.js', '--force'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
      console.log('BI Cache Update:', data.toString().trim());
    });
    
    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('BI Cache Update Error:', data.toString().trim());
    });
    
    // Ждем завершения процесса с таймаутом
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Таймаут обновления BI кэша (30 сек)'));
      }, 30000);
      
      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Процесс завершился с кодом ${code}: ${errorOutput}`));
        }
      });
    });
    
    console.log('✅ BI кэш успешно обновлен');
    res.json({ 
      success: true, 
      message: 'BI кэш (конфигурация серверов) успешно обновлен',
      output: result
    });
  } catch (error) {
    console.error('❌ Ошибка обновления BI кэша:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// API для обновления статистики отправок
app.post('/api/update-stats', async (req, res) => {
  try {
    console.log('🔄 Запуск обновления статистики отправок из Metabase...');
    
    // Запускаем обновление статистики отправок через data-manager
    const { spawn } = await import('child_process');
    
    const child = spawn('node', ['manage-data.js', 'update'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
      console.log('Stats Update:', data.toString().trim());
    });
    
    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('Stats Update Error:', data.toString().trim());
    });
    
    // Ждем завершения процесса с таймаутом
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Таймаут обновления статистики (30 сек)'));
      }, 30000);
      
      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Процесс завершился с кодом ${code}: ${errorOutput}`));
        }
      });
    });
    
    console.log('✅ Статистика отправок успешно обновлена');
    res.json({ 
      success: true, 
      message: 'Статистика отправок успешно обновлена из Metabase',
      output: result
    });
  } catch (error) {
    console.error('❌ Ошибка обновления статистики:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// API для обновления конфигурации серверов (старый endpoint)
app.post('/api/update-server-config', async (req, res) => {
  try {
    console.log('🔄 Запуск обновления конфигурации серверов...');
    
    // Запускаем обновление через spawn для избежания блокировки
    const { spawn } = await import('child_process');
    
    const child = spawn('node', ['fetch-bi-data.js', '--force'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
      console.log('Server Config Update:', data.toString().trim());
    });
    
    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('Server Config Update Error:', data.toString().trim());
    });
    
    // Ждем завершения процесса с таймаутом
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Таймаут обновления конфигурации серверов (30 сек)'));
      }, 30000);
      
      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Процесс завершился с кодом ${code}: ${errorOutput}`));
        }
      });
    });
    
    console.log('✅ Конфигурация серверов успешно обновлена');
    res.json({ 
      success: true, 
      message: 'Конфигурация серверов успешно обновлена',
      output: result
    });
  } catch (error) {
    console.error('❌ Ошибка обновления конфигурации серверов:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Endpoint для получения BI кэша
app.get('/api/bi_cache.json', async (req, res) => {
  try {
    console.log('📊 Получение BI кэша...');
    
    const fs = await import('fs');
    const path = await import('path');
    
    const biCachePath = path.join(process.cwd(), 'bi_cache.json');
    
    if (!fs.existsSync(biCachePath)) {
      return res.status(404).json({ 
        success: false, 
        error: 'Файл bi_cache.json не найден' 
      });
    }
    
    const biCacheContent = fs.readFileSync(biCachePath, 'utf8');
    const biData = JSON.parse(biCacheContent);
    
    console.log(`✅ Загружено ${Array.isArray(biData) ? biData.length : 'данные'} из BI кэша`);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.json(biData);
    
  } catch (error) {
    console.error('❌ Ошибка чтения BI кэша:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Endpoint для получения metabase.txt
app.get('/api/metabase.txt', async (req, res) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    
    const metabasePath = path.join(process.cwd(), 'metabase.txt');
    
    if (!fs.existsSync(metabasePath)) {
      return res.status(404).send('Файл metabase.txt не найден');
    }
    
    const content = fs.readFileSync(metabasePath, 'utf8');
    res.setHeader('Content-Type', 'text/plain');
    res.send(content);
    
  } catch (error) {
    console.error('❌ Ошибка чтения metabase.txt:', error);
    res.status(500).send('Ошибка чтения файла');
  }
});

// Endpoint для получения config_queue.csv
app.get('/api/config_queue.csv', async (req, res) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    
    const configQueuePath = path.join(process.cwd(), 'config_queue.csv');
    
    if (!fs.existsSync(configQueuePath)) {
      return res.status(404).json({ 
        success: false, 
        error: 'Файл config_queue.csv не найден' 
      });
    }
    
    const content = fs.readFileSync(configQueuePath, 'utf8');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(content);
    
  } catch (error) {
    console.error('❌ Ошибка чтения config_queue.csv:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Endpoint для получения кэшированной статистики
app.get('/api/cached-stats', async (req, res) => {
  try {
    console.log('📊 Получение кэшированной статистики...');
    
    const fs = await import('fs');
    const path = await import('path');
    
    const statsPath = path.join(process.cwd(), 'cached_stats.csv');
    
    if (!fs.existsSync(statsPath)) {
      return res.status(404).json({ 
        success: false, 
        error: 'Файл cached_stats.csv не найден' 
      });
    }
    
    const csvContent = fs.readFileSync(statsPath, 'utf8');
    
    // Возвращаем CSV напрямую (как ожидает frontend)
    const lines = csvContent.trim().split('\n');
    console.log(`✅ Загружено ${lines.length - 1} записей из кэша`);
    
    // Устанавливаем заголовки для CSV
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    
    // Устанавливаем Last-Modified из времени модификации файла
    const stats = fs.statSync(statsPath);
    res.setHeader('Last-Modified', stats.mtime.toUTCString());
    
    res.send(csvContent);
    
  } catch (error) {
    console.error('❌ Ошибка чтения кэшированной статистики:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Прокси сервер запущен на http://localhost:${PORT}`);
  console.log('Используйте: http://localhost:3001/api/metabase/public/question/a54f3d40-cf5b-47ca-948d-0ac02b502c01.json');
  console.log('API обновления: POST http://localhost:3001/api/update-data');
  console.log('API BI кэша: POST http://localhost:3001/api/update-bi-cache');
});
