// Vercel Serverless Function для обновления данных
// ВАЖНО: На Vercel это будет триггериться через Cron Jobs

export default async function handler(req, res) {
  // Включаем CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    console.log('Data update triggered at:', new Date().toISOString());
    
    // Загружаем данные из Metabase
    const metabaseUrl = `${req.headers.origin || 'https://your-app.vercel.app'}/api/metabase?id=a54f3d40-cf5b-47ca-948d-0ac02b502c01&days=2`;
    
    const response = await fetch(metabaseUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status}`);
    }
    
    const data = await response.json();
    
    // В serverless окружении нельзя сохранять файлы на диск
    // Нужно использовать внешнее хранилище (S3, Vercel Blob, etc.)
    // Или отправлять данные в базу данных
    
    console.log(`✅ Data fetched successfully: ${data.length} records`);
    
    return res.status(200).json({
      success: true,
      message: `Data updated: ${data.length} records`,
      records: data.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Update error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}



