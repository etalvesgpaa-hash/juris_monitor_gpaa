module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (compatible; JurisMonitor/1.0)',
      },
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || '';

    // Log no Vercel para debug
    console.log('[proxy]', upstream.status, contentType, 'len=', text.length);

    // Repassa o status real da AASP em vez de transformar tudo em 500
    res.status(upstream.status);

    if (contentType.includes('application/json')) {
      try {
        return res.json(JSON.parse(text));
      } catch {
        return res.json({ raw: text });
      }
    }

    // AASP devolveu HTML/texto (erro de chave, data inválida, etc.)
    res.setHeader('Content-Type', 'application/json');
    return res.json({
      upstreamStatus: upstream.status,
      upstreamContentType: contentType,
      message: 'A AASP não retornou JSON',
      body: text.slice(0, 500),
    });
  } catch (error) {
    console.error('[proxy] erro:', error);
    return res.status(500).json({
      error: 'Proxy request failed',
      message: error.message,
      stack: error.stack,
    });
  }
};
