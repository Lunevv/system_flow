// Vercel Serverless Function для проксирования Metabase API
export default async function handler(req, res) {
  // Включаем CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const { id } = req.query;
    const days = parseInt(req.query.days) || 30;
    
    // Вычисляем даты
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - days);
    
    const formatDate = (date) => date.toISOString().split('T')[0];
    const dateFrom = formatDate(startDate);
    const dateTo = formatDate(today);
    
    // URL Metabase
    let metabaseUrl = `https://ucoz.metabaseapp.com/public/question/${id}.json?parameters={"DateResult":"${dateFrom}~${dateTo}"}`;
    
    console.log('Fetching from Metabase:', metabaseUrl);
    
    let response = await fetch(metabaseUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible)'
      }
    });
    
    // Fallback без параметров
    if (!response.ok && response.status === 400) {
      const fallbackUrl = `https://ucoz.metabaseapp.com/public/question/${id}.json`;
      response = await fetch(fallbackUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible)'
        }
      });
    }
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Received data:', data.length, 'records');
    
    return res.status(200).json(data);
    
  } catch (error) {
    console.error('Metabase proxy error:', error);
    return res.status(500).json({ error: error.message });
  }
}



