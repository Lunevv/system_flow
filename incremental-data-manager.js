import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

class IncrementalDataManager {
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
      const defaultConfig = {
        lastUpdate: null,
        lastFullExport: null,
        totalRecords: 0,
        dataRange: null,
        lastProcessedDate: null
      };
      await this.saveConfig(defaultConfig);
      return defaultConfig;
    }
  }

  // Сохраняем конфигурацию
  async saveConfig(config) {
    await fs.writeFile(this.configFile, JSON.stringify(config, null, 2));
  }

  // Получаем данные из Metabase через прокси (без параметров дат)
  async fetchFromMetabase() {
    const proxyUrl = `http://localhost:3001/api/metabase/public/question/a54f3d40-cf5b-47ca-948d-0ac02b502c01.json`;
    
    console.log('Загружаем данные из Metabase...');
    
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

  // Получаем дату из записи
  getDateFromRecord(record) {
    const dateField = record['DateResult: Day'] || record['DateResult'] || record['date'];
    if (!dateField) return null;
    
    try {
      const date = new Date(dateField);
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    } catch (error) {
      console.error('Ошибка парсинга даты:', dateField, error);
      return null;
    }
  }

  // Загружаем данные за определенный период (по дням)
  async loadDataForPeriod(days = 1) {
    console.log(`🔄 Загружаем данные за последние ${days} дней...`);
    
    try {
      const config = await this.loadConfig();
      
      // Загружаем данные из Metabase (без параметров дат)
      const newData = await this.fetchFromMetabase();
      
      if (newData.length === 0) {
        console.log('Нет новых данных для загрузки');
        return { success: true, records: 0 };
      }
      
      // Фильтруем данные по дате (берем только последние N дней)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const filteredData = newData.filter(record => {
        const recordDate = this.getDateFromRecord(record);
        if (!recordDate) return false;
        
        const date = new Date(recordDate);
        return date >= cutoffDate;
      });
      
      console.log(`Отфильтровано ${filteredData.length} записей за последние ${days} дней`);
      
      // Загружаем существующие данные
      let existingData = [];
      try {
        const existingCSV = await fs.readFile(this.dataFile, 'utf8');
        existingData = this.parseCSV(existingCSV);
      } catch (error) {
        console.log('Файл данных не найден, создаем новый');
      }
      
      // Объединяем данные
      const allData = [...existingData, ...filteredData];
      
      // Удаляем дубликаты (по дате + IdQueue + NameMailSender)
      const uniqueData = this.removeDuplicates(allData);
      
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
      
      console.log(`✅ Загрузка завершена! Добавлено ${filteredData.length} записей, всего ${uniqueData.length} записей`);
      return { success: true, records: filteredData.length, total: uniqueData.length };
      
    } catch (error) {
      console.error('❌ Ошибка при загрузке данных:', error);
      return { success: false, error: error.message };
    }
  }

  // Удаляем дубликаты
  removeDuplicates(data) {
    const seen = new Set();
    return data.filter(item => {
      const key = `${item['DateResult: Day']}-${item.IdQueue}-${item.NameMailSender}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
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

export default IncrementalDataManager;
