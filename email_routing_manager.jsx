import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, CheckCircle, Settings, X, Search, Edit3, Save, RotateCcw, Users, Mail, Server, Database } from 'lucide-react';

const EmailRoutingManager = () => {
  // Состояние для загруженных данных
  const [queueSettings, setQueueSettings] = useState([]);
  const [queueMappings, setQueueMappings] = useState([]);
  const [servers, setServers] = useState([]);
  const [masks, setMasks] = useState([]);
  const [reputations, setReputations] = useState([]);
  const [routing, setRouting] = useState({});
  const [individualClients, setIndividualClients] = useState([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [lastBIUpdate, setLastBIUpdate] = useState(null);
  const [lastStatsUpdate, setLastStatsUpdate] = useState(null);
  const [isUpdatingStats, setIsUpdatingStats] = useState(false);
  const [useBIData, setUseBIData] = useState(true);
  
  // Состояние активной вкладки
  const [activeTab, setActiveTab] = useState('reputation');
  
  // Состояния фильтров
  const [filters, setFilters] = useState({
    reputation: '',
    mask: '',
    server: '',
    status: ''
  });
  
  // Состояние модального окна
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState(null);
  
  // Состояние модального окна добавления сервера
  const [isAddServerModalOpen, setIsAddServerModalOpen] = useState(false);
  const [selectedReputation, setSelectedReputation] = useState('');
  const [selectedMask, setSelectedMask] = useState('');
  const [selectedServer, setSelectedServer] = useState('');
  const [serverConfig, setServerConfig] = useState({
    speed: 1000,
    limit: 50000,
    threads: 1
  });

  // Состояние для статистики Metabase
  const [statistics, setStatistics] = useState({});
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [metabaseApiKey, setMetabaseApiKey] = useState('');
  const [sendingStats, setSendingStats] = useState([]);
  
  // Фильтры для статистики - устанавливаем диапазон по умолчанию
  const [statsFilters, setStatsFilters] = useState(() => {
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - 7); // По умолчанию 7 дней
    
    const formatDateForInput = (date) => {
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    };
    
    return {
      dateFrom: formatDateForInput(startDate),
      dateTo: formatDateForInput(today),
      selectedServers: [], // Массив выбранных серверов
      selectedReputations: [], // Массив выбранных репутаций
      selectedQueues: [], // Массив выбранных очередей
      queue: '',
      sortBy: 'count',
      sortOrder: 'desc'
    };
  });

  // Период загрузки данных из Metabase
  const [metabasePeriod, setMetabasePeriod] = useState(7);

  // Состояние для выпадающих списков
  const [isServerDropdownOpen, setIsServerDropdownOpen] = useState(false);
  const [isReputationDropdownOpen, setIsReputationDropdownOpen] = useState(false);
  const [isQueueDropdownOpen, setIsQueueDropdownOpen] = useState(false);
  const [isColumnsDropdownOpen, setIsColumnsDropdownOpen] = useState(false);

  // Состояние для видимости столбцов
  const [visibleColumns, setVisibleColumns] = useState({
    date: true,
    reputation: true,
    queue: true,
    server: true,
    count: true
  });


  // Загрузка данных при монтировании компонента
  useEffect(() => {
    loadBIData();
    loadMetabaseApiKey();
    

    // Автоматическое обновление статистики 1 раз в день (в 6:00 утра)
    const now = new Date();
    const tomorrow6AM = new Date(now);
    tomorrow6AM.setDate(now.getDate() + 1);
    tomorrow6AM.setHours(6, 0, 0, 0);
    
    const timeUntil6AM = tomorrow6AM.getTime() - now.getTime();
    
    const statsInterval = setTimeout(() => {
      // Обновляем данные в 6:00 утра
      fetchMetabaseStatistics();
      
      // Обновляем BI кэш в 6:00 утра
      updateBICache();
      
      // Затем устанавливаем ежедневное обновление
      const dailyInterval = setInterval(() => {
        fetchMetabaseStatistics();
        
        // Обновляем BI кэш ежедневно
        updateBICache();
      }, 24 * 60 * 60 * 1000); // 24 часа
      
      // Очищаем интервал при размонтировании компонента
      return () => clearInterval(dailyInterval);
    }, timeUntil6AM);
    
    return () => {
      clearInterval(statsInterval);
    };
  }, []);


  // Загрузка статистики при переходе на вкладку "Статистика" - только из Metabase BI
  useEffect(() => {
    if (activeTab === 'statistics' && sendingStats.length === 0) {
      fetchMetabaseStatistics();
    }
  }, [activeTab]);

  // Функция для обновления диапазона дат на основе выбранного периода
  const updateDateRangeFromPeriod = (period) => {
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - period);
    
    const formatDateForInput = (date) => {
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    };
    
    setStatsFilters(prev => ({
      ...prev,
      dateFrom: formatDateForInput(startDate),
      dateTo: formatDateForInput(today)
    }));
  };

  // Автоматическое обновление диапазона дат при изменении периода
  useEffect(() => {
    updateDateRangeFromPeriod(metabasePeriod);
  }, [metabasePeriod]);

  // Закрытие выпадающих списков при клике вне их
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isServerDropdownOpen && !event.target.closest('.server-dropdown')) {
        setIsServerDropdownOpen(false);
      }
      if (isReputationDropdownOpen && !event.target.closest('.reputation-dropdown')) {
        setIsReputationDropdownOpen(false);
      }
      if (isQueueDropdownOpen && !event.target.closest('.queue-dropdown')) {
        setIsQueueDropdownOpen(false);
      }
      if (isColumnsDropdownOpen && !event.target.closest('.columns-dropdown')) {
        setIsColumnsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isServerDropdownOpen, isReputationDropdownOpen, isQueueDropdownOpen, isColumnsDropdownOpen]);

  // Функция для загрузки данных из BI кэша (как статистика)
  const loadBIData = async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      
      // Создаем уникальный параметр для обхода кэша
      const cacheBuster = forceRefresh ? Date.now() : Math.floor(Date.now() / 30000) * 30000;
      
      // Загружаем данные из BI кэша (как статистика из cached_stats.csv)
      const biResponse = await fetch(`/api/bi_cache.json?v=${cacheBuster}`);
      if (!biResponse.ok) {
        throw new Error(`HTTP error! status: ${biResponse.status}`);
      }
      const biData = await biResponse.json();
      console.log('Loaded BI data count:', biData.length);
      
      // Преобразуем данные BI в формат, совместимый с существующей логикой
      const settingsData = biData.map(item => ({
        id: item.ID,
        idQueue: item.IdQueue,
        nameMailSender: item.NameMailSender,
        status: item.Status,
        maximumCountSentMails: item.MaximumCountSentMails,
        timeoutSentMails: item.TimeoutSentMails,
        parallelSentMails: item.ParallelSentMails,
        targetMaximumCountSentMails: item.TargetMaximumCountSentMails,
        increaseMaximumCountSentMailsByPercent: item.IncreaseMaximumCountSentMailsByPercent,
        countSentMails: item.CountSentMails,
        dateCreate: item.DateCreate
      }));
      
      setQueueSettings(settingsData);

      // Загружаем маппинг очередей (оставляем как есть)
      const mappingsResponse = await fetch(`/config_queue.csv?v=${cacheBuster}`);
      if (!mappingsResponse.ok) {
        throw new Error(`HTTP error! status: ${mappingsResponse.status}`);
      }
      const mappingsText = await mappingsResponse.text();
      const mappingsData = parseCSV(mappingsText);
      setQueueMappings(mappingsData);

      // Обрабатываем данные
      console.log('About to process BI data...');
      processData(settingsData, mappingsData);
      console.log('BI data processing completed');
      
      // Обновляем время последнего обновления
      setLastUpdate(new Date());
      // Устанавливаем время последнего обновления BI кэша (берем время модификации файла)
      try {
        const response = await fetch(`/api/bi_cache.json?v=${cacheBuster}`);
        const lastModified = response.headers.get('last-modified');
        if (lastModified) {
          setLastBIUpdate(new Date(lastModified));
        }
      } catch (error) {
        console.log('Не удалось получить время модификации BI кэша');
      }
      setIsDataLoaded(true);
    } catch (error) {
      console.error('Ошибка загрузки данных из BI:', error);
      alert(`Ошибка загрузки данных из BI: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };


  // Функция для принудительного обновления данных
  const refreshData = () => {
    loadBIData(true);
  };

  // Функция для обновления BI кэша (через proxy сервер)
  const updateBICache = async () => {
    try {
      setIsLoading(true);
      console.log('🔄 Обновление BI кэша...');
      
      // Обновляем кэш через proxy сервер
      const response = await fetch('/api/update-bi-cache', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        console.log('✅ BI кэш обновлен, перезагружаем данные...');
        // Сохраняем время обновления BI кэша
        setLastBIUpdate(new Date());
        // После обновления кэша перезагружаем данные
        await loadBIData(true);
      } else {
        throw new Error('Ошибка обновления BI кэша');
      }
    } catch (error) {
      console.error('❌ Ошибка обновления BI кэша:', error);
      alert('Ошибка обновления BI кэша. Убедитесь, что proxy сервер запущен: npm run proxy');
    } finally {
      setIsLoading(false);
    }
  };

  // Загрузка API ключа Metabase
  const loadMetabaseApiKey = async () => {
    try {
      const response = await fetch('/api/metabase.txt');
      const apiKey = await response.text();
      setMetabaseApiKey(apiKey.trim());
    } catch (error) {
      console.error('Ошибка загрузки API ключа Metabase:', error);
    }
  };

  // Функция для загрузки статистики из CSV файла
  const loadSendingStats = async () => {
    setIsLoadingStats(true);
    try {
      // Загружаем файл статистики
      const statsResponse = await fetch('/sending_stats.csv');
      const statsText = await statsResponse.text();
      const statsData = parseSendingStatsCSV(statsText);
      
      // Загружаем маппинг очередей для получения имен масок
      const mappingsResponse = await fetch('/тмп - Лист71 (1).csv');
      const mappingsText = await mappingsResponse.text();
      const mappingsData = parseCSV(mappingsText);
      
      // Создаем маппинг idQueue -> имя маски и репутация
      const queueMap = {};
      mappingsData.forEach(mapping => {
        queueMap[mapping.idQueue] = {
          mask: mapping['имя маски'],
          reputation: mapping['репутация']
        };
      });
      
      console.log('Loaded queue mappings:', Object.keys(queueMap).length, 'entries');
      console.log('Sample queue mappings:', Object.entries(queueMap).slice(0, 3));
      
      // Обрабатываем данные статистики
      const processedStats = [];
      statsData.forEach(stat => {
        console.log('Processing stat:', stat); // Для отладки
        
        const queueInfo = queueMap[stat.IdQueue];
        const queueName = queueInfo ? queueInfo.mask : `Queue ${stat.IdQueue}`;
        const reputation = queueInfo ? queueInfo.reputation : 'unknown';
        
        // console.log(`Queue ${stat.IdQueue} -> queueName: "${queueName}", reputation: "${reputation}"`);
        
        // Используем правильные ключи из очищенных заголовков
        const dateValue = stat['DateResult День'] || stat.DateResult || '';
        const serverName = stat.NameMailSender || '';
        const countValue = stat.Количество || '0';
        
        processedStats.push({
          serverName: serverName,
          queueName: queueName,
          count: parseInt(countValue.replace(/\s/g, '')) || 0,
          date: dateValue,
          reputation: reputation
        });
      });
      
      setSendingStats(processedStats);
      console.log('Загружено статистики:', processedStats.length, 'записей');
      console.log('Первые 3 записи статистики:', processedStats.slice(0, 3));
      
      // Автоматически устанавливаем диапазон дат из данных
      // НЕ устанавливаем диапазон дат автоматически - используем выбранный период
      // if (processedStats.length > 0) {
      //   const dates = processedStats
      //     .map(stat => convertDateToISO(stat.date))
      //     .filter(date => date && date !== '');
      //   
      //   console.log('Found dates:', dates); // Для отладки
      //   
      //   if (dates.length > 0) {
      //     const uniqueDates = [...new Set(dates)];
      //     const sortedDates = uniqueDates.sort();
      //     const minDate = sortedDates[0];
      //     const maxDate = sortedDates[sortedDates.length - 1];
      //     
      //     console.log('Date range:', minDate, 'to', maxDate); // Для отладки
      //     
      //     setStatsFilters(prev => ({
      //       ...prev,
      //       dateFrom: minDate,
      //       dateTo: maxDate
      //     }));
      //   }
      // }
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
      alert('Ошибка загрузки файла статистики');
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Функция для парсинга CSV файла статистики
  const parseSendingStatsCSV = (csvText) => {
    const lines = csvText.split('\n');
    const headerLine = lines[0];
    
    // Очищаем заголовки от лишних символов
    const cleanHeaders = headerLine.split(',').map(header => {
      return header.trim().replace(/:/g, '').replace(/\./g, '');
    });
    
    console.log('CSV Headers:', cleanHeaders);
    
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        // Парсим CSV с учетом кавычек
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());
        
        if (values.length >= cleanHeaders.length) {
          const row = {};
          cleanHeaders.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          data.push(row);
          console.log('Parsed row:', row); // Для отладки
        }
      }
    }
    
    return data;
  };

  // Функция для получения статистики из кэшированных данных
  const fetchMetabaseStatistics = async () => {
    try {
      setIsLoadingStats(true);
      console.log('Загрузка кэшированных данных...');
      
      // Загружаем кэшированные данные через proxy, чтобы получить корректный Last-Modified
      const response = await fetch('/api/cached-stats', { method: 'GET' });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const csvText = await response.text();
      const data = parseCachedStatsCSV(csvText);
      
      console.log('Загружено кэшированных данных:', data.length, 'записей');
      
      // Загружаем маппинг очередей для получения имен масок и репутаций
      const mappingsResponse = await fetch('/config_queue.csv');
      const mappingsText = await mappingsResponse.text();
      const mappingsData = parseCSV(mappingsText);
      
      // Создаем маппинг idQueue -> имя маски и репутация
      const queueMap = {};
      mappingsData.forEach(mapping => {
        queueMap[mapping.idQueue] = {
          mask: mapping['имя маски'],
          reputation: mapping['репутация']
        };
      });
      
      console.log('Loaded queue mappings:', Object.keys(queueMap).length, 'entries');
      
      // Обрабатываем данные
      const processedStats = data.map(stat => {
        const queueInfo = queueMap[stat.IdQueue];
        const queueName = queueInfo ? queueInfo.mask : `Queue ${stat.IdQueue}`;
        const reputation = queueInfo ? queueInfo.reputation : 'unknown';
        
        // Форматируем дату из ISO формата в нужный формат
        const dateValue = formatMetabaseDate(stat['DateResult: Day']);
        
        return {
          serverName: stat.NameMailSender || '',
          queueName: queueName,
          count: parseInt(stat.Count) || 0,
          date: dateValue,
          reputation: reputation
        };
      });
      
      setSendingStats(processedStats);
      console.log('Обработано статистики:', processedStats.length, 'записей');
      
      // Устанавливаем время последнего обновления статистики из Last-Modified файла кэша
      const lastModified = response.headers.get('last-modified');
      if (lastModified) {
        setLastStatsUpdate(new Date(lastModified));
      } else {
        setLastStatsUpdate(new Date());
      }
      
      // Устанавливаем диапазон дат автоматически только если фильтры пустые
      if (processedStats.length > 0 && (!statsFilters.dateFrom || !statsFilters.dateTo)) {
        const dates = processedStats
          .map(stat => convertDateToISO(stat.date))
          .filter(date => date && date !== '');
        
        if (dates.length > 0) {
          const uniqueDates = [...new Set(dates)];
          const sortedDates = uniqueDates.sort();
          const minDate = sortedDates[0];
          const maxDate = sortedDates[sortedDates.length - 1];
          
          console.log('Date range from cached data:', minDate, 'to', maxDate);
          
          setStatsFilters(prev => ({
            ...prev,
            dateFrom: minDate,
            dateTo: maxDate
          }));
        }
      }
      
    } catch (error) {
      console.error('Ошибка загрузки кэшированных данных:', error);
      console.error('Детали ошибки:', {
        message: error.message,
        stack: error.stack
      });
      
      alert('Ошибка загрузки данных. Убедитесь, что выполнена первоначальная выгрузка: node manage-data.js init');
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Функция для парсинга кэшированных CSV данных
  const parseCachedStatsCSV = (csvText) => {
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
  };

  // Функции для работы с выбором серверов
  const getUniqueServers = () => {
    const uniqueServers = [...new Set(sendingStats.map(stat => stat.serverName))];
    return uniqueServers.sort();
  };

  const toggleServerSelection = (serverName) => {
    setStatsFilters(prev => {
      const isSelected = prev.selectedServers.includes(serverName);
      if (isSelected) {
        return {
          ...prev,
          selectedServers: prev.selectedServers.filter(s => s !== serverName)
        };
      } else {
        return {
          ...prev,
          selectedServers: [...prev.selectedServers, serverName]
        };
      }
    });
  };

  const selectAllServers = () => {
    setStatsFilters(prev => ({
      ...prev,
      selectedServers: getUniqueServers()
    }));
  };

  const clearServerSelection = () => {
    setStatsFilters(prev => ({
      ...prev,
      selectedServers: []
    }));
  };

  // Функции для работы с выбором репутаций
  const getUniqueReputations = () => {
    const uniqueReputations = [...new Set(sendingStats.map(stat => stat.reputation))];
    return uniqueReputations.sort();
  };

  const toggleReputationSelection = (reputation) => {
    setStatsFilters(prev => {
      const isSelected = prev.selectedReputations.includes(reputation);
      if (isSelected) {
        return {
          ...prev,
          selectedReputations: prev.selectedReputations.filter(r => r !== reputation)
        };
      } else {
        return {
          ...prev,
          selectedReputations: [...prev.selectedReputations, reputation]
        };
      }
    });
  };

  const selectAllReputations = () => {
    setStatsFilters(prev => ({
      ...prev,
      selectedReputations: getUniqueReputations()
    }));
  };

  const clearReputationSelection = () => {
    setStatsFilters(prev => ({
      ...prev,
      selectedReputations: []
    }));
  };

  // Функции для работы с выбором очередей
  const getUniqueQueues = () => {
    // Показываем только очереди, которые есть в маппинге (исключаем "Queue XXX")
    const uniqueQueues = [...new Set(sendingStats.map(stat => stat.queueName))];
    const realQueues = uniqueQueues.filter(queue => !queue.startsWith('Queue '));
    return realQueues.sort();
  };

  const toggleQueueSelection = (queue) => {
    setStatsFilters(prev => {
      const isSelected = prev.selectedQueues.includes(queue);
      if (isSelected) {
        return {
          ...prev,
          selectedQueues: prev.selectedQueues.filter(q => q !== queue)
        };
      } else {
        return {
          ...prev,
          selectedQueues: [...prev.selectedQueues, queue]
        };
      }
    });
  };

  const selectAllQueues = () => {
    setStatsFilters(prev => ({
      ...prev,
      selectedQueues: getUniqueQueues()
    }));
  };

  const clearQueueSelection = () => {
    setStatsFilters(prev => ({
      ...prev,
      selectedQueues: []
    }));
  };

  // Функции для управления видимостью столбцов
  const toggleColumnVisibility = (column) => {
    setVisibleColumns(prev => ({
      ...prev,
      [column]: !prev[column]
    }));
  };

  const showAllColumns = () => {
    setVisibleColumns({
      date: true,
      reputation: true,
      queue: true,
      server: true,
      count: true
    });
  };

  const hideAllColumns = () => {
    setVisibleColumns({
      date: false,
      reputation: false,
      queue: false,
      server: false,
      count: false
    });
  };

  // Функция для группировки и агрегации данных
  const getAggregatedStats = () => {
    const filtered = getFilteredSendingStats();
    
    // Определяем, какие столбцы видимы (кроме COUNT)
    const visibleNonCountColumns = Object.entries(visibleColumns)
      .filter(([key, visible]) => visible && key !== 'count')
      .map(([key]) => key);
    
    // Если COUNT не виден или нет других видимых столбцов, возвращаем исходные данные
    if (!visibleColumns.count || visibleNonCountColumns.length === 0) {
      return filtered;
    }
    
    // Группируем данные по видимым столбцам
    const grouped = {};
    
    filtered.forEach(stat => {
      // Создаем ключ для группировки на основе видимых столбцов
      const groupKey = visibleNonCountColumns
        .map(column => {
          switch (column) {
            case 'date':
              return formatDate(stat.date);
            case 'reputation':
              return stat.reputation;
            case 'queue':
              return stat.queueName;
            case 'server':
              return shortenServerName(stat.serverName);
            default:
              return '';
          }
        })
        .join(' | ');
      
      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          key: groupKey,
          count: 0,
          details: {}
        };
      }
      
      grouped[groupKey].count += stat.count;
      
      // Сохраняем детали для отображения
      visibleNonCountColumns.forEach(column => {
        switch (column) {
          case 'date':
            grouped[groupKey].details.date = formatDate(stat.date);
            break;
          case 'reputation':
            grouped[groupKey].details.reputation = stat.reputation;
            break;
          case 'queue':
            grouped[groupKey].details.queue = stat.queueName;
            break;
          case 'server':
            grouped[groupKey].details.server = stat.serverName;
            break;
        }
      });
    });
    
    // Преобразуем в массив и сортируем
    const aggregated = Object.values(grouped);
    
    // Применяем сортировку
    aggregated.sort((a, b) => {
      let aValue, bValue;
      
      switch (statsFilters.sortBy) {
        case 'date':
          // Для сортировки по дате используем ISO дату, а не отформатированную
          aValue = convertDateToISO(a.details.date) || '';
          bValue = convertDateToISO(b.details.date) || '';
          break;
        case 'reputation':
          aValue = a.details.reputation || '';
          bValue = b.details.reputation || '';
          break;
        case 'queue':
          aValue = a.details.queue || '';
          bValue = b.details.queue || '';
          break;
        case 'server':
          aValue = a.details.server || '';
          bValue = b.details.server || '';
          break;
        case 'count':
        default:
          aValue = a.count;
          bValue = b.count;
          break;
      }

      // Улучшенная логика сортировки
      if (statsFilters.sortOrder === 'asc') {
        if (statsFilters.sortBy === 'date') {
          // Для дат используем прямое сравнение ISO строк
          return aValue.localeCompare(bValue);
        } else if (statsFilters.sortBy === 'count') {
          return aValue - bValue;
        } else {
          return aValue.localeCompare(bValue);
        }
      } else {
        if (statsFilters.sortBy === 'date') {
          // Для дат используем обратное сравнение ISO строк
          return bValue.localeCompare(aValue);
        } else if (statsFilters.sortBy === 'count') {
          return bValue - aValue;
        } else {
          return bValue.localeCompare(aValue);
        }
      }
    });
    
    return aggregated;
  };

  // Функция для форматирования даты для отображения
  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    // Убираем кавычки если есть
    const cleanDate = dateString.replace(/"/g, '');
    
    // Парсим русскую дату "23 сент., 2025"
    const months = {
      'янв.': '01', 'фев.': '02', 'мар.': '03', 'апр.': '04',
      'мая': '05', 'июн.': '06', 'июл.': '07', 'авг.': '08',
      'сент.': '09', 'окт.': '10', 'нояб.': '11', 'дек.': '12',
      // Добавляем варианты с точкой и без
      'сентября': '09', 'октября': '10', 'ноября': '11', 'декабря': '12',
      'января': '01', 'февраля': '02', 'марта': '03', 'апреля': '04',
      'май': '05', 'июня': '06', 'июля': '07', 'августа': '08',
      // Добавляем варианты без точки
      'сент': '09', 'окт': '10', 'нояб': '11', 'дек': '12',
      'янв': '01', 'фев': '02', 'мар': '03', 'апр': '04'
    };
    
    const parts = cleanDate.split(' ');
    if (parts.length >= 3) {
      const day = parts[0].padStart(2, '0');
      // Убираем запятую из месяца, если есть
      const monthKey = parts[1].replace(',', '');
      const month = months[monthKey] || '01';
      const year = parts[2];
      const result = `${day}.${month}.${year}`;
      return result;
    }
    
    return cleanDate;
  };

  // Функция для конвертации даты в формат YYYY-MM-DD для сравнения
  const convertDateToISO = (dateString) => {
    if (!dateString) return '';
    
    // Убираем кавычки если есть
    const cleanDate = dateString.replace(/"/g, '');
    
    // Проверяем формат DD.MM.YYYY (например, "30.08.2025", "28.09.2025")
    if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(cleanDate)) {
      const [day, month, year] = cleanDate.split('.');
      const result = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      return result;
    }
    
    // Проверяем формат DD.MM (например, "31.08", "29.09") - без года
    if (/^\d{1,2}\.\d{1,2}$/.test(cleanDate)) {
      const [day, month] = cleanDate.split('.');
      // Предполагаем текущий год, если год не указан
      const currentYear = new Date().getFullYear();
      const result = `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      return result;
    }
    
    // Парсим русскую дату "23 сент., 2025"
    const months = {
      'янв.': '01', 'фев.': '02', 'мар.': '03', 'апр.': '04',
      'мая': '05', 'июн.': '06', 'июл.': '07', 'авг.': '08',
      'сент.': '09', 'окт.': '10', 'нояб.': '11', 'дек.': '12',
      // Добавляем варианты с точкой и без
      'сентября': '09', 'октября': '10', 'ноября': '11', 'декабря': '12',
      'января': '01', 'февраля': '02', 'марта': '03', 'апреля': '04',
      'май': '05', 'июня': '06', 'июля': '07', 'августа': '08',
      // Добавляем варианты без точки
      'сент': '09', 'окт': '10', 'нояб': '11', 'дек': '12',
      'янв': '01', 'фев': '02', 'мар': '03', 'апр': '04'
    };
    
    const parts = cleanDate.split(' ');
    
    if (parts.length >= 3) {
      const day = parts[0].padStart(2, '0');
      // Убираем запятую из месяца, если есть
      const monthKey = parts[1].replace(',', '');
      const month = months[monthKey] || '01';
      const year = parts[2];
      const result = `${year}-${month}-${day}`;
      return result;
    }
    
    return cleanDate;
  };

  // Функция для форматирования даты из Metabase (ISO формат в русский формат)
  const formatMetabaseDate = (isoDateString) => {
    if (!isoDateString) return '';
    
    try {
      // Парсим ISO дату "2025-09-28T00:00:00+03:00"
      const date = new Date(isoDateString);
      
      // Получаем компоненты даты
      const day = date.getDate().toString().padStart(2, '0');
      const month = date.getMonth() + 1; // getMonth() возвращает 0-11
      const year = date.getFullYear();
      
      // Маппинг месяцев на русские названия
      const monthNames = {
        1: 'янв.', 2: 'фев.', 3: 'мар.', 4: 'апр.',
        5: 'мая', 6: 'июн.', 7: 'июл.', 8: 'авг.',
        9: 'сент.', 10: 'окт.', 11: 'нояб.', 12: 'дек.'
      };
      
      const monthName = monthNames[month] || 'янв.';
      const result = `${day} ${monthName}, ${year}`;
      
      return result;
      
    } catch (error) {
      console.error('Ошибка форматирования даты Metabase:', error);
      return isoDateString;
    }
  };

  // Функция для открытия модального окна добавления сервера
  const openAddServerModal = (reputation) => {
    setSelectedReputation(reputation);
    setSelectedMask('');
    setSelectedServer('');
    setServerConfig({
      speed: 1000,
      limit: 50000,
      threads: 1
    });
    setIsAddServerModalOpen(true);
  };

  // Функция для добавления сервера к репутации
  const addServerToReputation = () => {
    if (!selectedReputation || !selectedMask || !selectedServer) {
      alert('Пожалуйста, выберите все параметры');
      return;
    }

    // Создаем новую конфигурацию сервера
    const newServerConfig = {
      status: 'enabled',
      speed: serverConfig.speed,
      limit: serverConfig.limit,
      threads: serverConfig.threads
    };

    // Обновляем состояние routing
    setRouting(prevRouting => {
      const newRouting = { ...prevRouting };
      
      // Инициализируем структуру если её нет
      if (!newRouting[selectedReputation]) {
        newRouting[selectedReputation] = {};
      }
      if (!newRouting[selectedReputation][selectedMask]) {
        newRouting[selectedReputation][selectedMask] = {};
      }
      
      // Добавляем новый сервер
      newRouting[selectedReputation][selectedMask][selectedServer] = newServerConfig;
      
      return newRouting;
    });

    // Показываем сообщение об успехе
    alert(`Сервер ${shortenServerName(selectedServer)} добавлен к репутации ${selectedReputation} для маски ${selectedMask}`);
    
    // Закрываем модальное окно
    setIsAddServerModalOpen(false);
  };

  // Получаем доступные серверы для выбора
  const getAvailableServers = () => {
    return servers.filter(server => {
      // Проверяем, что сервер еще не используется для данной репутации и маски
      if (!routing[selectedReputation] || !routing[selectedReputation][selectedMask]) {
        return true;
      }
      return !routing[selectedReputation][selectedMask][server];
    });
  };

  // Функция для удаления сервера
  const deleteServer = (reputation, mask, server) => {
    if (mask === 'all') {
      // Проверяем, не останется ли маска 'all' пустой
      const allServers = routing[reputation]?.[mask] || {};
      const remainingServers = Object.keys(allServers).filter(s => s !== server);
      
      if (remainingServers.length === 0) {
        alert('Нельзя удалить последний сервер из маски "all" - это нарушит отправку писем');
        return;
      }
    }

    if (confirm(`Удалить сервер ${shortenServerName(server)} из маски ${mask}?`)) {
      setRouting(prevRouting => {
        const newRouting = { ...prevRouting };
        
        if (newRouting[reputation] && newRouting[reputation][mask]) {
          delete newRouting[reputation][mask][server];
          
          // Если маска стала пустой, удаляем её (кроме 'all')
          if (Object.keys(newRouting[reputation][mask]).length === 0 && mask !== 'all') {
            delete newRouting[reputation][mask];
          }
        }
        
        return newRouting;
      });
    }
  };

  // Функция для редактирования сервера
  const editServer = (reputation, mask, server, currentConfig) => {
    setEditingServer({
      reputation,
      mask,
      server,
      config: currentConfig
    });
    setIsModalOpen(true);
  };

  // Функция для редактирования индивидуального клиента
  const editIndividualClient = (client) => {
    setEditingServer({
      reputation: client.reputation,
      mask: client.mask,
      server: client.server,
      config: {
        speed: client.speed,
        limit: client.limit,
        threads: client.threads,
        status: client.status
      },
      isIndividual: true,
      clientId: client.id
    });
    setIsModalOpen(true);
  };

  // Функция для удаления индивидуального клиента
  const deleteIndividualClient = (client) => {
    if (confirm(`Удалить клиента ${client.id}?`)) {
      setIndividualClients(prevClients => 
        prevClients.filter(c => c.id !== client.id)
      );
    }
  };

  // Функция для получения статистики сервера
  const getServerStatistics = (serverName) => {
    return statistics[serverName] || null;
  };

  // Функция для фильтрации и сортировки статистики отправок
  const getFilteredSendingStats = () => {
    let filtered = [...sendingStats];

    // Фильтруем только существующие idQueue из файла маппинга
    const existingQueueIds = new Set();
    if (routing && routing.queueMap) {
      Object.keys(routing.queueMap).forEach(queueId => {
        existingQueueIds.add(queueId);
      });
    }
    
    // Объединяем все фильтры в один проход для лучшей производительности
    filtered = filtered.filter(stat => {
      // 1. Фильтр по очереди (исключаем "Queue XXX" записи)
      if (stat.queueName.startsWith('Queue ')) {
        const queueNumber = stat.queueName.replace('Queue ', '');
        if (!existingQueueIds.has(queueNumber)) {
          return false;
        }
      }
      
      // 2. Фильтр по серверу
      if (statsFilters.selectedServers.length > 0 && 
          !statsFilters.selectedServers.includes(stat.serverName)) {
        return false;
      }
      
      // 3. Фильтр по репутации
      if (statsFilters.selectedReputations.length > 0 && 
          !statsFilters.selectedReputations.includes(stat.reputation)) {
        return false;
      }
      
      // 4. Фильтр по очереди (множественный выбор)
      if (statsFilters.selectedQueues.length > 0 && 
          !statsFilters.selectedQueues.includes(stat.queueName)) {
        return false;
      }
      
      return true;
    });

    // Фильтрация по дате
    if (statsFilters.dateFrom || statsFilters.dateTo) {
      
      filtered = filtered.filter(stat => {
        if (!stat.date) return true;
        
        // Конвертируем дату из CSV в формат YYYY-MM-DD
        const statDate = convertDateToISO(stat.date);
        
        // Если указана только начальная дата
        if (statsFilters.dateFrom && !statsFilters.dateTo) {
          const result = statDate >= statsFilters.dateFrom;
          return result;
        }
        
        // Если указана только конечная дата
        if (!statsFilters.dateFrom && statsFilters.dateTo) {
          const result = statDate <= statsFilters.dateTo;
          return result;
        }
        
        // Если указаны обе даты
        if (statsFilters.dateFrom && statsFilters.dateTo) {
          const result = statDate >= statsFilters.dateFrom && statDate <= statsFilters.dateTo;
          return result;
        }
        
        return true;
      });
      
    }

    // Сортировка
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (statsFilters.sortBy) {
        case 'server':
          aValue = a.serverName;
          bValue = b.serverName;
          break;
        case 'queue':
          aValue = a.queueName;
          bValue = b.queueName;
          break;
        case 'date':
          aValue = a.date;
          bValue = b.date;
          break;
        case 'reputation':
          aValue = a.reputation;
          bValue = b.reputation;
          break;
        case 'count':
        default:
          aValue = a.count;
          bValue = b.count;
          break;
      }

      if (statsFilters.sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  };

  const parseCSV = (csvText) => {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',');
    const data = [];
    
    // Находим индексы непустых заголовков и очищаем их
    const validHeaderIndices = [];
    const cleanHeaders = [];
    headers.forEach((header, index) => {
      if (header.trim() && header.trim() !== '') {
        validHeaderIndices.push(index);
        // Очищаем заголовок от лишних символов
        let cleanHeader = header.trim();
        // Убираем лишние символы в конце (например, 'г' в 'репутация г')
        cleanHeader = cleanHeader.replace(/[^\w\u0400-\u04FF]+$/, '');
        cleanHeaders.push(cleanHeader);
      }
    });
    
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const values = lines[i].split(',');
        const row = {}; // Создаем новый объект для каждой строки
        
        validHeaderIndices.forEach((index, headerIndex) => {
          const header = cleanHeaders[headerIndex];
          let value = values[index] ? values[index].trim() : '';
          // Убираем \r и другие управляющие символы
          value = value.replace(/[\r\n\t]/g, '');
          row[header] = value;
        });
        
        data.push({...row}); // Создаем копию объекта
      }
    }
    
    return data;
  };

  const processData = (settings, mappings) => {
    console.log('processData called with:', { settingsCount: settings.length, mappingsCount: mappings.length });
    
    // Создаем маппинг idQueue -> {имя маски, репутация}
    const queueMap = {};
    mappings.forEach(mapping => {
      if (mapping.idQueue && mapping['имя маски'] && mapping['репутация']) {
        queueMap[mapping.idQueue] = {
          mask: mapping['имя маски'],
          reputation: mapping['репутация']
        };
      }
    });
    
    console.log('Queue map created with', Object.keys(queueMap).length, 'entries');
    console.log('Individual entries in queueMap:', Object.entries(queueMap).filter(([id, info]) => info.reputation.includes('_id_')));
    
    // Проверим конкретно idQueue 2217
    console.log('Queue 2217 in queueMap:', queueMap['2217']);
    console.log('Queue 2217 in queueMap (number):', queueMap[2217]);
    
    // Проверим, есть ли в settings записи с idQueue 2217
    const setting2217 = settings.find(s => s.idQueue === 2217);
    console.log('Setting 2217 in settings:', setting2217);

    // Извлекаем уникальные серверы, маски и репутации
    const uniqueServers = [...new Set(settings.map(s => s.nameMailSender))].sort();
    const uniqueMasks = [...new Set(Object.values(queueMap).map(q => q.mask))].sort();
    
    // Разделяем основные репутации и индивидуальные подгруппы
    const allReputations = [...new Set(Object.values(queueMap).map(q => q.reputation))].sort();
    const mainReputations = allReputations.filter(rep => !rep.includes('_id_'));
    const individualReputations = allReputations.filter(rep => rep.includes('_id_'));
    
    const uniqueReputations = mainReputations;

    setServers(uniqueServers);
    setMasks(uniqueMasks);
    setReputations(uniqueReputations);

    // Создаем структуру роутинга
    const routingData = {};
    const individualClientsData = [];

    // Сначала обрабатываем все записи из settings (если есть серверы)
    settings.forEach(setting => {
      // Преобразуем idQueue в строку для поиска в queueMap
      const queueInfo = queueMap[String(setting.idQueue)];
      if (!queueInfo) {
        return; // Пропускаем технические очереди
      }

      const { mask, reputation } = queueInfo;
      
      // Проверяем, является ли это индивидуальной настройкой
      if (reputation.includes('_id_')) {
        console.log('Found individual setting:', { idQueue: setting.idQueue, reputation, mask, server: setting.nameMailSender });
        // Это индивидуальная настройка клиента
        const clientId = reputation.replace(/^(new|good|bad|warm1|isolated|test|Amazonly)_id_/, 'CLIENT_');
        // Используем статус напрямую из данных
        const clientStatus = setting.status;
        
        
        // Определяем тип репутации для отображения
        let reputationDisplay = 'Новая';
        if (reputation.includes('good')) reputationDisplay = 'Хорошая';
        else if (reputation.includes('bad')) reputationDisplay = 'Плохая';
        else if (reputation.includes('warm1')) reputationDisplay = 'Теплая';
        else if (reputation.includes('isolated')) reputationDisplay = 'Изолированная';
        else if (reputation.includes('test')) reputationDisplay = 'Тестовая';
        else if (reputation.includes('Amazonly')) reputationDisplay = 'Amazonly';
        
        individualClientsData.push({
          id: clientId,
          reputation: reputationDisplay,
          mask: mask,
          server: setting.nameMailSender,
          speed: setting.timeoutSentMails,
          limit: setting.maximumCountSentMails,
          threads: setting.parallelSentMails,
          status: clientStatus,
          description: `Индивидуальная настройка для клиента ${clientId} (${reputation})`
        });
      } else {
        // Обычная настройка
        if (!routingData[reputation]) {
          routingData[reputation] = {};
        }
        if (!routingData[reputation][mask]) {
          routingData[reputation][mask] = {};
        }
        
        // Используем статус напрямую из данных
        const status = setting.status;
        
        routingData[reputation][mask][setting.nameMailSender] = {
          speed: setting.timeoutSentMails,
          limit: setting.maximumCountSentMails,
          threads: setting.parallelSentMails,
          status: status
        };
      }
    });


    
    console.log('Individual clients data:', individualClientsData);
    console.log('Individual clients count:', individualClientsData.length);
    
    
    setRouting(routingData);
    setIndividualClients(individualClientsData);
    setIsDataLoaded(true);
  };

  // Функции для получения цветов
  const getReputationColor = (reputation) => {
    switch(reputation) {
      case 'Хорошая': return 'bg-green-50 border-green-200';
      case 'Новая': return 'bg-blue-50 border-blue-200';
      case 'Плохая': return 'bg-red-50 border-red-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getReputationTextColor = (reputation) => {
    switch(reputation) {
      case 'Хорошая': return 'text-green-700';
      case 'Новая': return 'text-blue-700';
      case 'Плохая': return 'text-red-700';
      default: return 'text-gray-700';
    }
  };

  const getMaskColor = (mask) => {
    return 'bg-cyan-50 border-cyan-200';
  };

  const getMaskTextColor = (mask) => {
    return 'text-cyan-700';
  };

  const getServerColor = (server) => {
    return 'bg-cyan-50 border-cyan-200';
  };

  const getServerTextColor = (server) => {
    return 'text-cyan-700';
  };

  const getServerStatusStyle = (status) => {
    switch(status) {
      case 'enabled':
        return {
          container: 'bg-green-100 border-green-300',
          text: 'text-green-800',
          badge: 'bg-green-200 text-green-900 text-xs px-2 py-1 rounded-full'
        };
      case 'disabled-by-limit':
        return {
          container: 'bg-gray-100 border-gray-300',
          text: 'text-gray-700',
          badge: 'bg-gray-200 text-gray-800 text-xs px-2 py-1 rounded-full'
        };
      case 'disabled':
        return {
          container: 'bg-gray-300 border-gray-400',
          text: 'text-gray-600',
          badge: 'bg-gray-400 text-gray-700 text-xs px-2 py-1 rounded-full'
        };
      default:
        return {
          container: 'bg-gray-100 border-gray-300',
          text: 'text-gray-700',
          badge: 'bg-gray-200 text-gray-800 text-xs px-2 py-1 rounded-full'
        };
    }
  };

  // Функция для сокращения названий серверов
  const shortenServerName = (name) => {
    if (name.includes('production-mail-sender-aws')) {
      const number = name.match(/(\d+)$/)?.[1] || '';
      // Если есть цифра, добавляем дефис, если нет - просто AWS
      return number ? `AWS-${number}` : 'AWS';
    } else if (name.includes('production100-mail-sender')) {
      const number = name.match(/(\d+)$/)?.[1] || '';
      // Для production100-mail-sender-1 возвращаем MS-100
      if (number === '1') {
        return 'MS-100';
      }
      // Для остальных production100-mail-sender-XXX возвращаем MS-XXX
      return `MS-${number}`;
    } else if (name.includes('production200-mail-sender')) {
      const number = name.match(/(\d+)$/)?.[1] || '';
      return `MS-${number}`;
    } else if (name.includes('production-mail-sender')) {
      const number = name.match(/(\d+)$/)?.[1] || '';
      return `MS-${number}`;
    }
    return name; // Возвращаем оригинальное название, если не удалось сократить
  };

  // Функция для сортировки серверов
  const sortServers = (serverEntries) => {
    return serverEntries.sort(([serverA, configA], [serverB, configB]) => {
      // Сначала сортируем по статусу: enabled -> disabled-by-limit -> disabled
      const statusOrder = { 'enabled': 0, 'disabled-by-limit': 1, 'disabled': 2 };
      const statusA = statusOrder[configA.status] ?? 3;
      const statusB = statusOrder[configB.status] ?? 3;
      
      if (statusA !== statusB) {
        return statusA - statusB;
      }
      
      // Если статусы одинаковые, сортируем по названию сервера
      const shortNameA = shortenServerName(serverA);
      const shortNameB = shortenServerName(serverB);
      
      // Извлекаем префикс и номер для сортировки
      const parseServerName = (name) => {
        if (name.startsWith('AWS')) {
          const match = name.match(/AWS-?(\d*)$/);
          return { prefix: 'AWS', number: match ? parseInt(match[1]) || 0 : 0 };
        } else if (name.startsWith('MS-')) {
          const match = name.match(/MS-(\d+)$/);
          return { prefix: 'MS', number: match ? parseInt(match[1]) : 0 };
        }
        return { prefix: name, number: 0 };
      };
      
      const parsedA = parseServerName(shortNameA);
      const parsedB = parseServerName(shortNameB);
      
      // AWS идет первым
      if (parsedA.prefix === 'AWS' && parsedB.prefix !== 'AWS') {
        return -1;
      }
      if (parsedB.prefix === 'AWS' && parsedA.prefix !== 'AWS') {
        return 1;
      }
      
      // Если оба AWS или оба MS, сортируем по номеру (по убыванию для больших чисел, по возрастанию для маленьких)
      if (parsedA.prefix === parsedB.prefix) {
        const numA = parsedA.number;
        const numB = parsedB.number;
        
        // Если оба числа больше 100, сортируем по убыванию (200, 199, 198, ...)
        if (numA >= 100 && numB >= 100) {
          return numB - numA;
        }
        // Если оба числа меньше 100, сортируем по убыванию (5, 4, 3, 2, 1)
        if (numA < 100 && numB < 100) {
          return numB - numA;
        }
        // Если одно больше 100, а другое меньше, то большее идет первым
        return numB - numA;
      }
      
      return shortNameA.localeCompare(shortNameB);
    });
  };

  const getStatusLabel = (status) => {
    switch(status) {
      case 'enabled': return 'Активна';
      case 'disabled-by-limit': return 'Лимит';
      case 'disabled': return 'Выключена';
      default: return null;
    }
  };

  // Функция для получения связок сервера
  const getServerConnections = (targetServer) => {
    const connections = [];
    reputations.forEach(reputation => {
      masks.forEach(mask => {
        if (routing[reputation] && routing[reputation][mask] && routing[reputation][mask][targetServer]) {
          connections.push({
            reputation,
            mask,
            config: routing[reputation][mask][targetServer]
          });
        }
      });
    });
    return connections;
  };

  // Функция для получения индивидуальных клиентов сервера
  const getServerIndividualClients = (targetServer) => {
    return individualClients.filter(client => client.server === targetServer);
  };

  // Фильтрация данных
  const getFilteredData = () => {
    if (!isDataLoaded) return {};
    
    let filtered = {};

    // Функция для проверки статуса
    const matchesStatus = (config) => {
      if (!filters.status) return true;
      return config.status === filters.status;
    };

    if (activeTab === 'reputation') {
      reputations.forEach(reputation => {
        if (!filters.reputation || reputation === filters.reputation) {
          filtered[reputation] = {};
          masks.forEach(mask => {
            if (!filters.mask || mask === filters.mask) {
              if (routing[reputation] && routing[reputation][mask]) {
                const filteredServers = {};
                Object.entries(routing[reputation][mask]).forEach(([server, config]) => {
                  // Применяем фильтры по серверу и статусу
                  if ((!filters.server || server === filters.server) && matchesStatus(config)) {
                    filteredServers[server] = config;
                  }
                });
                if (Object.keys(filteredServers).length > 0) {
                  filtered[reputation][mask] = filteredServers;
                }
              }
            }
          });
        }
      });
    } else if (activeTab === 'mask') {
      masks.forEach(mask => {
        if (!filters.mask || mask === filters.mask) {
          filtered[mask] = {};
          reputations.forEach(reputation => {
            if (!filters.reputation || reputation === filters.reputation) {
              if (routing[reputation] && routing[reputation][mask]) {
                const filteredServers = {};
                Object.entries(routing[reputation][mask]).forEach(([server, config]) => {
                  // Применяем фильтры по серверу и статусу
                  if ((!filters.server || server === filters.server) && matchesStatus(config)) {
                    filteredServers[server] = config;
                  }
                });
                if (Object.keys(filteredServers).length > 0) {
                  filtered[mask][reputation] = filteredServers;
                }
              }
            }
          });
        }
      });
    } else if (activeTab === 'server') {
      servers.forEach(server => {
        if (!filters.server || server === filters.server) {
          const connections = getServerConnections(server);
          let filteredConnections = connections;
          
          // Применяем фильтры по репутации и маске
          if (filters.reputation) {
            filteredConnections = filteredConnections.filter(conn => conn.reputation === filters.reputation);
          }
          if (filters.mask) {
            filteredConnections = filteredConnections.filter(conn => conn.mask === filters.mask);
          }
          
          // Применяем фильтр по статусу
          filteredConnections = filteredConnections.filter(conn => matchesStatus(conn.config));
          
          if (filteredConnections.length > 0) {
            filtered[server] = filteredConnections;
          }
        }
      });
    }

    return filtered;
  };

  const filteredData = getFilteredData();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Заголовок */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Система управления ESP серверами</h1>
              <p className="mt-2 text-gray-600">
                Управление распределением потоков между клиентами и серверами
              </p>
              {lastUpdate && (
                <p className="mt-1 text-sm text-gray-500">
                  Последнее обновление: {lastUpdate.toLocaleTimeString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Источник данных: BI (Metabase)</label>
              </div>
              <button
                onClick={refreshData}
                disabled={isLoading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  isLoading 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <RotateCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Обновление...' : 'Обновить данные'}
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={updateBICache}
                  disabled={isLoading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    isLoading 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-300' 
                      : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  <Database className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  {isLoading ? 'Обновление кэша...' : 'Обновить BI кэш'}
                </button>
                {lastBIUpdate && (
                  <div className="text-xs text-gray-500">
                    <div>BI кэш обновлен:</div>
                    <div className="font-mono">{lastBIUpdate.toLocaleString('ru-RU')}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Вкладки */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('reputation')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'reputation'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Users className="inline-block w-4 h-4 mr-2" />
                По репутации
              </button>
              <button
                onClick={() => setActiveTab('mask')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'mask'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Mail className="inline-block w-4 h-4 mr-2" />
                По маскам
              </button>
              <button
                onClick={() => setActiveTab('server')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'server'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Server className="inline-block w-4 h-4 mr-2" />
                По серверам
              </button>
              <button
                onClick={() => setActiveTab('individual')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'individual'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Settings className="inline-block w-4 h-4 mr-2" />
                Индивидуальные
              </button>
              <button
                onClick={() => setActiveTab('statistics')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'statistics'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Users className="inline-block w-4 h-4 mr-2" />
                Статистика
              </button>
            </nav>
          </div>
        </div>

        {/* Фильтры */}
        <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Репутация
              </label>
              <select
                value={filters.reputation}
                onChange={(e) => setFilters({...filters, reputation: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Все репутации</option>
                {reputations.map(reputation => (
                  <option key={reputation} value={reputation}>{reputation}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Маска
              </label>
              <select
                value={filters.mask}
                onChange={(e) => setFilters({...filters, mask: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Все маски</option>
                {masks.map(mask => (
                  <option key={mask} value={mask}>{mask}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Сервер
              </label>
              <select
                value={filters.server}
                onChange={(e) => setFilters({...filters, server: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Все серверы</option>
                {servers.map(server => (
                  <option key={server} value={server}>{server}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Статус
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Все статусы</option>
                <option value="enabled">Активные</option>
                <option value="disabled-by-limit">Лимит</option>
                <option value="disabled">Выключенные</option>
              </select>
            </div>
          </div>
        </div>

        {/* Контент вкладок */}
        {!isDataLoaded ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Загрузка данных...</p>
            </div>
          </div>
        ) : activeTab === 'reputation' ? (
          /* По репутации */
          <div className="space-y-6">
            {Object.keys(filteredData).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Нет данных, соответствующих выбранным фильтрам</p>
              </div>
            ) : (
              Object.entries(filteredData).map(([reputation, masks]) => (
              <div key={reputation} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className={`text-xl font-bold ${getReputationTextColor(reputation)}`}>
                    Репутация: {reputation}
                  </h2>
                  <button
                    onClick={() => openAddServerModal(reputation)}
                    className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                  >
                    <span className="text-lg">+</span>
                    Добавить сервер
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(masks).map(([mask, servers]) => {
                    const serverCount = Object.keys(servers).length;
                    return (
                      <div key={mask} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            {mask}
                            {mask === 'all' && (
                              <span className="text-red-500 text-xs bg-red-50 px-2 py-1 rounded-full" title="Основная маска - нельзя удалить">
                                ⭐
                              </span>
                            )}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">{serverCount} серв.</span>
                            <button className="text-gray-400 hover:text-gray-600 transition-colors">
                              <Settings size={16} />
                            </button>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {sortServers(Object.entries(servers)).map(([server, config]) => {
                            const statusStyle = getServerStatusStyle(config.status);
                            return (
                              <div key={server} className={`flex items-center justify-between p-3 rounded-lg border ${statusStyle.container}`}>
                                <div className="flex-1">
                                  <div className={`font-bold mb-1 ${statusStyle.text}`}>
                                    {shortenServerName(server)}
                                  </div>
                                  <div className={`text-sm ${statusStyle.text}`}>
                                    скорость: <span className={`font-bold ${statusStyle.text}`}>{config.speed}</span>{' '}
                                    лимит: <span className={`font-bold ${statusStyle.text}`}>{config.limit}</span>{' '}
                                    потоки: <span className={`font-bold ${statusStyle.text}`}>{config.threads}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                  <button 
                                    onClick={() => editServer(reputation, mask, server, config)}
                                    className="text-blue-600 hover:text-blue-800 transition-colors" 
                                    title="Редактировать"
                                  >
                                    <Edit3 size={16} />
                                  </button>
                                  <button 
                                    onClick={() => deleteServer(reputation, mask, server)}
                                    className="text-red-500 hover:text-red-700 transition-colors" 
                                    title="Удалить"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
            )}
          </div>
        ) : activeTab === 'mask' ? (
          /* По маскам */
          <div className="space-y-6">
            {Object.keys(filteredData).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Нет данных, соответствующих выбранным фильтрам</p>
              </div>
            ) : (
              Object.entries(filteredData).map(([mask, reputations]) => (
              <div key={mask} className="space-y-4">
                <h2 className="text-xl font-bold text-gray-800">
                  Маска: {mask}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(reputations).map(([reputation, servers]) => {
                    const serverCount = Object.keys(servers).length;
                    return (
                      <div key={reputation} className={`bg-white rounded-lg border-2 p-4 shadow-sm ${getReputationColor(reputation)}`}>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className={`text-lg font-semibold ${getReputationTextColor(reputation)}`}>{reputation}</h3>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">{serverCount} серв.</span>
                            <button className="text-gray-400 hover:text-gray-600 transition-colors">
                              <Settings size={16} />
                            </button>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {sortServers(Object.entries(servers)).map(([server, config]) => {
                            const statusStyle = getServerStatusStyle(config.status);
                            return (
                              <div key={server} className={`flex items-center justify-between p-3 rounded-lg border ${statusStyle.container}`}>
                                <div className="flex-1">
                                  <div className={`font-bold mb-1 ${statusStyle.text}`}>
                                    {shortenServerName(server)}
                                  </div>
                                  <div className={`text-sm ${statusStyle.text}`}>
                                    скорость: <span className={`font-bold ${statusStyle.text}`}>{config.speed}</span>{' '}
                                    лимит: <span className={`font-bold ${statusStyle.text}`}>{config.limit}</span>{' '}
                                    потоки: <span className={`font-bold ${statusStyle.text}`}>{config.threads}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                  <button 
                                    onClick={() => editServer(reputation, mask, server, config)}
                                    className="text-blue-600 hover:text-blue-800 transition-colors" 
                                    title="Редактировать"
                                  >
                                    <Edit3 size={16} />
                                  </button>
                                  <button 
                                    onClick={() => deleteServer(reputation, mask, server)}
                                    className="text-red-500 hover:text-red-700 transition-colors" 
                                    title="Удалить"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
            )}
          </div>
        ) : activeTab === 'server' ? (
          /* По серверам */
          <div className="space-y-6">
            {Object.keys(filteredData).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Нет данных, соответствующих выбранным фильтрам</p>
              </div>
            ) : (
              Object.entries(filteredData).map(([server, connections]) => {
              const allConnections = getServerConnections(server);
              const filteredConnections = connections;
              
              return (
                <div key={server} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-800">
                      Сервер: {server}
                    </h2>
                    <span className="text-sm text-gray-500">
                      {filteredConnections.length} связок{filteredConnections.length !== allConnections.length ? ` из ${allConnections.length}` : ''}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Группировка по репутации */}
                    {reputations.filter(reputation => {
                      // Проверяем, есть ли для этой репутации связки с текущим сервером
                      return filteredConnections.some(conn => conn.reputation === reputation);
                    }).map(reputation => {
                      const reputationConnections = filteredConnections.filter(conn => conn.reputation === reputation);
                      
                      return (
                        <div key={reputation} className={`bg-white rounded-lg border-2 p-4 shadow-sm ${getReputationColor(reputation)}`}>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className={`text-lg font-semibold ${getReputationTextColor(reputation)}`}>{reputation}</h3>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">{reputationConnections.length} связок</span>
                              <button className="text-gray-400 hover:text-gray-600 transition-colors">
                                <Settings size={16} />
                              </button>
                            </div>
                          </div>
                          <div className="space-y-3">
                            {reputationConnections.sort((connA, connB) => {
                              // Сначала сортируем по статусу
                              const statusOrder = { 'enabled': 0, 'disabled-by-limit': 1, 'disabled': 2 };
                              const statusA = statusOrder[connA.config.status] ?? 3;
                              const statusB = statusOrder[connB.config.status] ?? 3;
                              
                              if (statusA !== statusB) {
                                return statusA - statusB;
                              }
                              
                              // Затем сортируем по названию маски
                              return connA.mask.localeCompare(connB.mask);
                            }).map((connection, index) => {
                              const statusStyle = getServerStatusStyle(connection.config.status);
                              return (
                                <div key={index} className={`flex items-center justify-between p-3 rounded-lg border ${statusStyle.container}`}>
                                  <div className="flex-1">
                                    <div className={`font-bold mb-1 ${statusStyle.text}`}>{connection.mask}</div>
                                    <div className={`text-sm ${statusStyle.text}`}>
                                      скорость: <span className={`font-bold ${statusStyle.text}`}>{connection.config.speed}</span>{' '}
                                      лимит: <span className={`font-bold ${statusStyle.text}`}>{connection.config.limit}</span>{' '}
                                      потоки: <span className={`font-bold ${statusStyle.text}`}>{connection.config.threads}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 ml-4">
                                    <button 
                                      onClick={() => editServer(connection.reputation, connection.mask, server, connection.config)}
                                      className="text-blue-600 hover:text-blue-800 transition-colors" 
                                      title="Редактировать"
                                    >
                                      <Edit3 size={16} />
                                    </button>
                                    <button 
                                      onClick={() => deleteServer(connection.reputation, connection.mask, server)}
                                      className="text-red-500 hover:text-red-700 transition-colors" 
                                      title="Удалить"
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Индивидуальные клиенты сервера */}
                    {(() => {
                      const individualClientsForServer = getServerIndividualClients(server);
                      if (individualClientsForServer.length > 0) {
                        return (
                          <div className="bg-white rounded-lg border-2 border-purple-200 p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-lg font-semibold text-purple-700 flex items-center gap-2">
                                <Settings size={16} />
                                Индивидуальные клиенты
                              </h3>
                              <span className="text-sm text-gray-500">{individualClientsForServer.length} клиентов</span>
                            </div>
                            <div className="space-y-3">
                              {individualClientsForServer.map(client => (
                                <div key={client.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                                  <div className="flex-1">
                                    <div className="font-bold text-gray-800 mb-1">{client.id}</div>
                                    <div className="text-sm text-gray-600 mb-1">
                                      {client.mask} → {client.reputation}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                      скорость: <span className="font-bold text-gray-800">{client.speed}</span>{' '}
                                      лимит: <span className="font-bold text-gray-800">{client.limit}</span>{' '}
                                      потоки: <span className="font-bold text-gray-800">{client.threads}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 ml-4">
                                    <button className="text-blue-600 hover:text-blue-800 transition-colors" title="Редактировать">
                                      <Edit3 size={16} />
                                    </button>
                                    <button className="text-red-500 hover:text-red-700 transition-colors" title="Удалить">
                                      <X size={16} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              );
            })
            )}
          </div>
        ) : activeTab === 'individual' ? (
          /* Индивидуальные клиенты */
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Индивидуальные настройки клиентов
              </h3>
              <p className="text-gray-600 text-sm mb-6">
                Клиенты с персональными настройками серверов и параметров
              </p>

              <div className="space-y-6">
                {(() => {
                  // Группируем клиентов по маскам
                  const groupedByMask = individualClients.reduce((acc, client) => {
                    const maskKey = client.mask.includes('gmail') ? 'gmail' : 
                                   client.mask.includes('mail.ru') ? 'mail.ru' :
                                   client.mask.includes('yandex') ? 'yandex.ru' :
                                   client.mask.includes('yahoo') ? 'yahoo' :
                                   client.mask.includes('microsoft') ? 'microsoft' :
                                   client.mask.includes('all') ? 'all' : client.mask;
                    
                    if (!acc[maskKey]) {
                      acc[maskKey] = [];
                    }
                    acc[maskKey].push(client);
                    return acc;
                  }, {});

                  return Object.entries(groupedByMask).map(([mask, clients]) => (
                    <div key={mask} className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-gray-800">{mask}</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">{clients.length} клиент.</span>
                          <button className="text-gray-400 hover:text-gray-600 transition-colors">
                            <Settings size={16} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {clients.map((client, index) => {
                          const statusStyle = getServerStatusStyle(client.status);
                          
                          return (
                            <div key={`${client.id}-${index}`} className={`flex items-center justify-between p-3 rounded-lg border ${statusStyle.container}`}>
                              <div className="flex-1">
                                <div className={`font-bold mb-1 ${statusStyle.text}`}>
                                  {client.id}
                                </div>
                                <div className={`text-sm ${statusStyle.text}`}>
                                  скорость: <span className={`font-bold ${statusStyle.text}`}>{client.speed}</span>{' '}
                                  лимит: <span className={`font-bold ${statusStyle.text}`}>{client.limit}</span>{' '}
                                  потоки: <span className={`font-bold ${statusStyle.text}`}>{client.threads}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-4">
                                <button 
                                  onClick={() => editIndividualClient(client)}
                                  className="text-blue-600 hover:text-blue-800 transition-colors" 
                                  title="Редактировать"
                                >
                                  <Edit3 size={16} />
                                </button>
                                <button 
                                  onClick={() => deleteIndividualClient(client)}
                                  className="text-red-500 hover:text-red-700 transition-colors" 
                                  title="Удалить"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </div>

              {individualClients.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>Индивидуальные клиенты не найдены</p>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'statistics' ? (
          /* Статистика отправок */
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Статистика отправок
                  </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {(() => {
                    const aggregated = getAggregatedStats();
                    const isAggregated = aggregated !== getFilteredSendingStats();
                    if (isAggregated) {
                      return `Показано: ${aggregated.length} агрегированных групп из ${getFilteredSendingStats().length} записей`;
                    } else {
                      return `Показано: ${aggregated.length} из ${sendingStats.length} записей`;
                    }
                  })()}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  📊 Данные загружаются из локального кэша (автоматически обновляется из Metabase BI)
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  📅 Период: {metabasePeriod} дней ({statsFilters.dateFrom} - {statsFilters.dateTo})
                </p>
                {lastStatsUpdate && (
                  <p className="text-xs text-green-600 mt-1">
                    ✅ Статистика обновлена: {lastStatsUpdate.toLocaleString('ru-RU')}
                  </p>
                )}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => window.open('/cached_stats.csv', '_blank')}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    📁 Скачать CSV
                  </button>
                  <button
                    onClick={async () => {
                      if (isUpdatingStats) return; // Предотвращаем множественные нажатия
                      
                      try {
                        setIsUpdatingStats(true);
                        const response = await fetch('/api/update-stats', { method: 'POST' });
                        if (response.ok) {
                          // После успешного обновления статистики сразу перезагружаем данные
                          await fetchMetabaseStatistics();
                          alert('✅ Статистика отправок обновлена!');
                        } else {
                          const errorData = await response.json();
                          alert('❌ Ошибка обновления статистики: ' + (errorData.error || 'Неизвестная ошибка'));
                        }
                      } catch (error) {
                        alert('❌ Ошибка: ' + error.message);
                      } finally {
                        setIsUpdatingStats(false);
                      }
                    }}
                    disabled={isUpdatingStats}
                    className={`px-3 py-1 text-xs rounded transition-colors ${
                      isUpdatingStats 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    {isUpdatingStats ? '⏳ Обновление...' : '🔄 Обновить статистику'}
                  </button>
                </div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    value={statsFilters.dateFrom}
                    onChange={(e) => setStatsFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="От"
                  />
                  <input
                    type="date"
                    value={statsFilters.dateTo}
                    onChange={(e) => setStatsFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="До"
                  />
                  <button
                    onClick={() => setStatsFilters(prev => ({ ...prev, dateFrom: '', dateTo: '' }))}
                    className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
                    title="Очистить фильтр дат"
                  >
                    ✕
                  </button>
                  <button
                    onClick={() => {
                      console.log('Принудительная загрузка из Metabase...');
                      fetchMetabaseStatistics();
                    }}
                    disabled={isLoadingStats}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                      isLoadingStats
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100'
                    }`}
                  >
                    <Users className={`h-4 w-4 ${isLoadingStats ? 'animate-pulse' : ''}`} />
                    {isLoadingStats ? 'Загрузка...' : 'Обновить данные'}
                  </button>
                </div>
              </div>

              {/* Фильтры */}
              <div className="grid grid-cols-1 md:grid-cols-7 gap-4 mb-6">
                {/* Период загрузки из Metabase */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Период (дни)</label>
                  <select
                    value={metabasePeriod}
                    onChange={(e) => setMetabasePeriod(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={7}>7 дней</option>
                    <option value={14}>14 дней</option>
                    <option value={30}>30 дней</option>
                    <option value={60}>60 дней</option>
                    <option value={90}>90 дней</option>
                  </select>
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Сервер</label>
                  <div className="relative server-dropdown">
                    <button
                      onClick={() => setIsServerDropdownOpen(!isServerDropdownOpen)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-left bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between"
                    >
                      <span>
                        {statsFilters.selectedServers.length === 0 
                          ? 'Все серверы' 
                          : statsFilters.selectedServers.length === 1 
                            ? shortenServerName(statsFilters.selectedServers[0])
                            : `Выбрано: ${statsFilters.selectedServers.length}`
                        }
                      </span>
                      <svg className={`w-4 h-4 transition-transform ${isServerDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {isServerDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        <div className="p-2 border-b border-gray-200">
                          <button
                            onClick={selectAllServers}
                            className="text-xs text-blue-600 hover:text-blue-800 mr-2"
                          >
                            Выбрать все
                          </button>
                          <button
                            onClick={clearServerSelection}
                            className="text-xs text-gray-600 hover:text-gray-800"
                          >
                            Очистить
                          </button>
                        </div>
                        {getUniqueServers().map(server => (
                          <label key={server} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={statsFilters.selectedServers.includes(server)}
                              onChange={() => toggleServerSelection(server)}
                              className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm">{shortenServerName(server)}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Репутация</label>
                  <div className="relative reputation-dropdown">
                    <button
                      onClick={() => setIsReputationDropdownOpen(!isReputationDropdownOpen)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-left bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between"
                    >
                      <span>
                        {statsFilters.selectedReputations.length === 0 
                          ? 'Все репутации' 
                          : statsFilters.selectedReputations.length === 1 
                            ? statsFilters.selectedReputations[0]
                            : `Выбрано: ${statsFilters.selectedReputations.length}`
                        }
                      </span>
                      <svg className={`w-4 h-4 transition-transform ${isReputationDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {isReputationDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        <div className="p-2 border-b border-gray-200">
                          <button
                            onClick={selectAllReputations}
                            className="text-xs text-blue-600 hover:text-blue-800 mr-2"
                          >
                            Выбрать все
                          </button>
                          <button
                            onClick={clearReputationSelection}
                            className="text-xs text-gray-600 hover:text-gray-800"
                          >
                            Очистить
                          </button>
                        </div>
                        {getUniqueReputations().map(reputation => (
                          <label key={reputation} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={statsFilters.selectedReputations.includes(reputation)}
                              onChange={() => toggleReputationSelection(reputation)}
                              className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              reputation === 'good' ? 'bg-green-100 text-green-800' :
                              reputation === 'new' ? 'bg-blue-100 text-blue-800' :
                              reputation === 'bad' ? 'bg-red-100 text-red-800' :
                              reputation === 'warm1' ? 'bg-yellow-100 text-yellow-800' :
                              reputation === 'test' ? 'bg-purple-100 text-purple-800' :
                              reputation === 'isolated' ? 'bg-gray-100 text-gray-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {reputation}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Очередь</label>
                  <div className="relative queue-dropdown">
                    <button
                      onClick={() => setIsQueueDropdownOpen(!isQueueDropdownOpen)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-left bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between"
                    >
                      <span>
                        {statsFilters.selectedQueues.length === 0 
                          ? 'Все очереди' 
                          : statsFilters.selectedQueues.length === 1 
                            ? statsFilters.selectedQueues[0]
                            : `Выбрано: ${statsFilters.selectedQueues.length}`
                        }
                      </span>
                      <svg className={`w-4 h-4 transition-transform ${isQueueDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {isQueueDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        <div className="p-2 border-b border-gray-200">
                          <button
                            onClick={selectAllQueues}
                            className="text-xs text-blue-600 hover:text-blue-800 mr-2"
                          >
                            Выбрать все
                          </button>
                          <button
                            onClick={clearQueueSelection}
                            className="text-xs text-gray-600 hover:text-gray-800"
                          >
                            Очистить
                          </button>
                        </div>
                        {getUniqueQueues().map(queue => (
                          <label key={queue} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={statsFilters.selectedQueues.includes(queue)}
                              onChange={() => toggleQueueSelection(queue)}
                              className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm">{queue}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Сортировка</label>
                  <select
                    value={statsFilters.sortBy}
                    onChange={(e) => setStatsFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="count">По количеству</option>
                    <option value="server">По серверу</option>
                    <option value="queue">По очереди</option>
                    <option value="date">По дате</option>
                    <option value="reputation">По репутации</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Порядок</label>
                  <select
                    value={statsFilters.sortOrder}
                    onChange={(e) => setStatsFilters(prev => ({ ...prev, sortOrder: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="desc">По убыванию</option>
                    <option value="asc">По возрастанию</option>
                  </select>
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Столбцы</label>
                  <div className="relative columns-dropdown">
                    <button
                      onClick={() => setIsColumnsDropdownOpen(!isColumnsDropdownOpen)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-left bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between"
                    >
                      <span>
                        {Object.values(visibleColumns).filter(Boolean).length === 5 
                          ? 'Все столбцы' 
                          : `Показано: ${Object.values(visibleColumns).filter(Boolean).length}`
                        }
                      </span>
                      <svg className={`w-4 h-4 transition-transform ${isColumnsDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {isColumnsDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        <div className="p-2 border-b border-gray-200">
                          <button
                            onClick={showAllColumns}
                            className="text-xs text-blue-600 hover:text-blue-800 mr-2"
                          >
                            Показать все
                          </button>
                          <button
                            onClick={hideAllColumns}
                            className="text-xs text-gray-600 hover:text-gray-800"
                          >
                            Скрыть все
                          </button>
                        </div>
                        {[
                          { key: 'date', label: 'ДАТА' },
                          { key: 'reputation', label: 'РЕПУТАЦИЯ' },
                          { key: 'queue', label: 'QUEUE NAME' },
                          { key: 'server', label: 'NAME MAIL SENDER' },
                          { key: 'count', label: 'COUNT' }
                        ].map(column => (
                          <label key={column.key} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={visibleColumns[column.key]}
                              onChange={() => toggleColumnVisibility(column.key)}
                              className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm">{column.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Таблица статистики */}
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      {visibleColumns.date && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                          ДАТА
                        </th>
                      )}
                      {visibleColumns.reputation && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                          РЕПУТАЦИЯ
                        </th>
                      )}
                      {visibleColumns.queue && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                          QUEUE NAME
                        </th>
                      )}
                      {visibleColumns.server && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                          NAME MAIL SENDER
                        </th>
                      )}
                      {visibleColumns.count && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                          COUNT
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {getAggregatedStats().map((item, index) => {
                      // Определяем, является ли это агрегированными данными
                      const isAggregated = item.details !== undefined;
                      const stat = isAggregated ? item.details : item;
                      const count = isAggregated ? item.count : item.count;
                      
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          {visibleColumns.date && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {isAggregated ? stat.date : formatDate(stat.date)}
                            </td>
                          )}
                          {visibleColumns.reputation && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                stat.reputation === 'good' ? 'bg-green-100 text-green-800' :
                                stat.reputation === 'new' ? 'bg-blue-100 text-blue-800' :
                                stat.reputation === 'bad' ? 'bg-red-100 text-red-800' :
                                stat.reputation === 'warm1' ? 'bg-yellow-100 text-yellow-800' :
                                stat.reputation === 'test' ? 'bg-purple-100 text-purple-800' :
                                stat.reputation === 'isolated' ? 'bg-gray-100 text-gray-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {stat.reputation}
                              </span>
                            </td>
                          )}
                          {visibleColumns.queue && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {isAggregated ? stat.queue : stat.queueName}
                            </td>
                          )}
                          {visibleColumns.server && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {isAggregated ? shortenServerName(stat.server) : shortenServerName(stat.serverName)}
                            </td>
                          )}
                          {visibleColumns.count && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">
                              {count.toLocaleString()}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {getAggregatedStats().length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>Нет данных, соответствующих выбранным фильтрам</p>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Модальное окно добавления сервера */}
        {isAddServerModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Добавить сервер к репутации "{selectedReputation}"
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Выберите маску (очередь):
                  </label>
                  <select
                    value={selectedMask}
                    onChange={(e) => setSelectedMask(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Выберите маску</option>
                    {masks.map(mask => (
                      <option key={mask} value={mask}>{mask}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Выберите сервер:
                  </label>
                  <select
                    value={selectedServer}
                    onChange={(e) => setSelectedServer(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={!selectedMask}
                  >
                    <option value="">Выберите сервер</option>
                    {getAvailableServers().map(server => (
                      <option key={server} value={server}>{shortenServerName(server)}</option>
                    ))}
                  </select>
                </div>

                {selectedServer && (
                  <div className="space-y-3 pt-3 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700">Параметры сервера:</h4>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Скорость</label>
                        <input
                          type="number"
                          value={serverConfig.speed}
                          onChange={(e) => setServerConfig(prev => ({ ...prev, speed: parseInt(e.target.value) || 0 }))}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                          placeholder="1000"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Лимит</label>
                        <input
                          type="number"
                          value={serverConfig.limit}
                          onChange={(e) => setServerConfig(prev => ({ ...prev, limit: parseInt(e.target.value) || 0 }))}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                          placeholder="50000"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Потоки</label>
                        <input
                          type="number"
                          value={serverConfig.threads}
                          onChange={(e) => setServerConfig(prev => ({ ...prev, threads: parseInt(e.target.value) || 1 }))}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                          placeholder="1"
                          min="1"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setIsAddServerModalOpen(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={addServerToReputation}
                  disabled={!selectedMask || !selectedServer}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    selectedMask && selectedServer
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Добавить
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Модальное окно редактирования сервера */}
        {isModalOpen && editingServer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {editingServer.isIndividual ? 'Редактировать клиента' : 'Редактировать сервер'} {editingServer.isIndividual ? editingServer.clientId : shortenServerName(editingServer.server)}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Репутация: {editingServer.reputation} | Маска: {editingServer.mask}
                {editingServer.isIndividual && <><br />Клиент: {editingServer.clientId}</>}
              </p>
              
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Скорость</label>
                    <input
                      type="number"
                      value={editingServer.config.speed}
                      onChange={(e) => setEditingServer(prev => ({
                        ...prev,
                        config: { ...prev.config, speed: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Лимит</label>
                    <input
                      type="number"
                      value={editingServer.config.limit}
                      onChange={(e) => setEditingServer(prev => ({
                        ...prev,
                        config: { ...prev.config, limit: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Потоки</label>
                    <input
                      type="number"
                      value={editingServer.config.threads}
                      onChange={(e) => setEditingServer(prev => ({
                        ...prev,
                        config: { ...prev.config, threads: parseInt(e.target.value) || 1 }
                      }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      min="1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Статус</label>
                  <select
                    value={editingServer.config.status}
                    onChange={(e) => setEditingServer(prev => ({
                      ...prev,
                      config: { ...prev.config, status: e.target.value }
                    }))}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="enabled">Включен</option>
                    <option value="disabled">Выключен</option>
                    <option value="disabled-by-limit">Отключен по лимиту</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={() => {
                    if (editingServer.isIndividual) {
                      // Обновляем индивидуального клиента
                      setIndividualClients(prevClients => 
                        prevClients.map(client => 
                          client.id === editingServer.clientId 
                            ? { ...client, ...editingServer.config }
                            : client
                        )
                      );
                    } else {
                      // Обновляем конфигурацию сервера
                      setRouting(prevRouting => {
                        const newRouting = { ...prevRouting };
                        if (newRouting[editingServer.reputation] && 
                            newRouting[editingServer.reputation][editingServer.mask] &&
                            newRouting[editingServer.reputation][editingServer.mask][editingServer.server]) {
                          newRouting[editingServer.reputation][editingServer.mask][editingServer.server] = editingServer.config;
                        }
                        return newRouting;
                      });
                    }
                    setIsModalOpen(false);
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailRoutingManager;