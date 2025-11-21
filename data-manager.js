import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

class DataManager {
  constructor() {
    this.dataFile = './cached_stats.csv';
    this.configFile = './data_config.json';
    this.maxDays = 7;
  }

  // Загружаем конфигурацию
  async loadConfig() {
    try {
      const configData = await fs.readFile(this.configFile, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      // Создаем конфигурацию по умолчанию
      const defaultConfig = {
        lastUpdate: null,
        lastFullExport: null,
        totalRecords: 0,
        dataRange: null
      };
      await this.saveConfig(defaultConfig);
      return defaultConfig;
    }
  }

  // Сохраняем конфигурацию
  async saveConfig(config) {
    await fs.writeFile(this.configFile, JSON.stringify(config, null, 2));
  }

  // Получаем данные из Metabase через прокси
  async fetchFromMetabase(days = 1) {
    const proxyUrl = `http://localhost:3001/api/metabase/public/question/a54f3d40-cf5b-47ca-948d-0ac02b502c01.json?days=${days}`;
    
    console.log(`Загружаем данные из Metabase за последние ${days} дней...`);
    
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Получено ${data.length} записей из Metabase`);
    return data;
  }

  // Конвертируем данные в CSV формат
  convertToCSV(data) {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => 
      Object.values(row).map(value => 
        typeof value === 'string' && value.includes(',') ? `"${value}"` : value
      ).join(',')
    );
    
    return [headers, ...rows].join('\n');
  }

  // Парсим CSV данные
  parseCSV(csvText) {
    const lines = csvText.split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        data.push(row);
      }
    }
    
    return data;
  }

  // Первоначальная выгрузка всех данных (30 дней)
  async initialExport() {
    console.log('🚀 Начинаем первоначальную выгрузку данных за 30 дней...');
    
    try {
      // Загружаем данные за 30 дней
      const data = await this.fetchFromMetabase(30);
      
      // Конвертируем в CSV
      const csvData = this.convertToCSV(data);
      
      // Сохраняем в файл
      await fs.writeFile(this.dataFile, csvData);
      
      // Обновляем конфигурацию
      const config = await this.loadConfig();
      config.lastFullExport = new Date().toISOString();
      config.lastUpdate = new Date().toISOString();
      config.totalRecords = data.length;
      config.dataRange = {
        from: this.getDateFromDaysAgo(30),
        to: this.getCurrentDate()
      };
      
      await this.saveConfig(config);
      
      console.log(`✅ Первоначальная выгрузка завершена! Сохранено ${data.length} записей`);
      return { success: true, records: data.length };
      
    } catch (error) {
      console.error('❌ Ошибка при первоначальной выгрузке:', error);
      return { success: false, error: error.message };
    }
  }

  // Ежедневное обновление (только новые данные)
  async dailyUpdate() {
    console.log('🔄 Начинаем ежедневное обновление данных...');
    
    try {
      const config = await this.loadConfig();
      
      // Если это первая выгрузка
      if (!config.lastUpdate) {
        console.log('Первая выгрузка - выполняем полную выгрузку за 30 дней');
        return await this.initialExport();
      }
      
      // Загружаем только данные за последние 2 дня (вчера + сегодня)
      const newData = await this.fetchFromMetabase(2);
      
      if (newData.length === 0) {
        console.log('Нет новых данных для обновления');
        return { success: true, records: 0 };
      }
      
      // Загружаем существующие данные
      let existingData = [];
      try {
        const existingCSV = await fs.readFile(this.dataFile, 'utf8');
        existingData = this.parseCSV(existingCSV);
      } catch (error) {
        console.log('Файл данных не найден, создаем новый');
      }
      
      // Объединяем данные (новые данные в конце, чтобы они заменяли старые)
      const allData = [...existingData, ...newData];
      
      // Удаляем дубликаты (по дате + IdQueue + NameMailSender)
      const uniqueData = this.removeDuplicates(allData);
      
      // НЕ удаляем старые данные - сохраняем всю историю
      // const cleanedData = this.removeOldData(uniqueData);
      
      // Сохраняем обновленные данные
      const csvData = this.convertToCSV(uniqueData);
      await fs.writeFile(this.dataFile, csvData);
      
      // Обновляем конфигурацию
      config.lastUpdate = new Date().toISOString();
      config.totalRecords = uniqueData.length;
      config.dataRange = {
        from: this.getDateFromDaysAgo(30),
        to: this.getCurrentDate()
      };
      
      await this.saveConfig(config);
      
      console.log(`✅ Ежедневное обновление завершено! Обновлено ${newData.length} записей, всего ${uniqueData.length} записей`);
      return { success: true, records: newData.length, total: uniqueData.length };
      
    } catch (error) {
      console.error('❌ Ошибка при ежедневном обновлении:', error);
      return { success: false, error: error.message };
    }
  }

  // Удаляем дубликаты (новые данные заменяют старые)
  removeDuplicates(data) {
    const map = new Map();
    
    // Проходим по всем данным и сохраняем последнее вхождение каждого ключа
    data.forEach(item => {
      const key = `${item['DateResult: Day']}-${item.IdQueue}-${item.NameMailSender}`;
      map.set(key, item);
    });
    
    // Возвращаем только уникальные записи (новые данные заменяют старые)
    return Array.from(map.values());
  }

  // Удаляем старые данные (старше 30 дней)
  removeOldData(data) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.maxDays);
    
    return data.filter(item => {
      const itemDate = new Date(item['DateResult: Day']);
      return itemDate >= cutoffDate;
    });
  }

  // Получаем данные для чтения
  async getData() {
    try {
      const csvData = await fs.readFile(this.dataFile, 'utf8');
      return this.parseCSV(csvData);
    } catch (error) {
      console.error('Ошибка чтения файла данных:', error);
      return [];
    }
  }

  // Получаем статистику
  async getStats() {
    const config = await this.loadConfig();
    const data = await this.getData();
    
    return {
      totalRecords: data.length,
      lastUpdate: config.lastUpdate,
      lastFullExport: config.lastFullExport,
      dataRange: config.dataRange,
      fileSize: await this.getFileSize()
    };
  }

  // Получаем размер файла
  async getFileSize() {
    try {
      const stats = await fs.stat(this.dataFile);
      return Math.round(stats.size / 1024); // KB
    } catch (error) {
      return 0;
    }
  }

  // Вспомогательные функции для работы с датами
  getCurrentDate() {
    return new Date().toISOString().split('T')[0];
  }

  getDateFromDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }
}

export default DataManager;
