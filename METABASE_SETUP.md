# Настройка интеграции с Metabase

## 1. Получение API ключа

1. Войдите в ваш экземпляр Metabase
2. Перейдите в **Settings** → **API Keys**
3. Создайте новый API ключ с правами на чтение данных
4. Скопируйте ключ в файл `metabase.txt`

## 2. Настройка URL Metabase

В файле `email_routing_manager.jsx` найдите строку:
```javascript
const METABASE_URL = 'https://your-metabase-instance.com';
```

Замените на ваш реальный URL Metabase.

## 3. Создание дашборда в Metabase

### SQL запрос для статистики отправок:

```sql
SELECT 
    server_name,
    COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as sent_today,
    COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as sent_this_week,
    ROUND(
        (COUNT(CASE WHEN status = 'delivered' THEN 1 END) * 100.0 / COUNT(*)), 2
    ) as success_rate
FROM email_logs 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY server_name
ORDER BY sent_today DESC;
```

### Настройка карточки:

1. Создайте новую карточку в Metabase
2. Выберите **Native Query**
3. Вставьте SQL запрос выше
4. Сохраните карточку
5. Запомните ID карточки (из URL: `/card/123` → ID = 123)

## 4. Обновление кода

В файле `email_routing_manager.jsx` замените:
```javascript
const response = await fetch(`${METABASE_URL}/api/card/123/query`, {
```

На ваш реальный ID карточки:
```javascript
const response = await fetch(`${METABASE_URL}/api/card/YOUR_CARD_ID/query`, {
```

## 5. Структура данных

Ожидаемая структура ответа от Metabase:
```json
{
  "data": {
    "rows": [
      ["production-mail-sender-1", 1250, 8750, 98.5],
      ["production-mail-sender-2", 890, 6230, 97.2],
      ["production-mail-sender-aws-2", 2100, 14700, 99.1]
    ]
  }
}
```

Где каждый массив содержит:
- [0] - имя сервера
- [1] - отправлено сегодня
- [2] - отправлено за неделю  
- [3] - процент успешности

## 6. Тестирование

1. Нажмите кнопку **"Статистика Metabase"** в интерфейсе
2. Проверьте консоль браузера на ошибки
3. Если есть ошибки - проверьте URL и API ключ
4. При успешном подключении статистика появится в карточках серверов

## 7. Автоматическое обновление

Для автоматического обновления статистики добавьте в `useEffect`:
```javascript
// Обновление статистики каждые 10 минут
const statsInterval = setInterval(() => {
  if (metabaseApiKey) {
    fetchMetabaseStatistics();
  }
}, 10 * 60 * 1000);

return () => clearInterval(statsInterval);
```

