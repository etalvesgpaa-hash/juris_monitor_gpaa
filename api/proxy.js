/**
 * /api/proxy — Vercel Serverless Function
 *
 * Suporta GET e POST. Para POST, lê o body do stream manualmente
 * (necessário em ES Modules no Vercel — req.body pode ser undefined).
 *
 * Uso:
 *   GET  /api/proxy?url=https%3A%2F%2F...
 *   POST /api/proxy?url=https%3A%2F%2F...  (body JSON no request)
 */

const ALLOWED = [
  'intimacaoapi.aasp.org.br',
  'api-publica.datajud.cnj.jus.br',
  'datajud.cnj.jus.br',
  'api.escavador.com',
  'api.groq.com',
  'api.resend.com',
];

// Lê o body inteiro de um IncomingMessage como string
function lerBody(req) {
  return new Promise((resolve, reject) => {
    // Se o Vercel já parseou (body é objeto), serializa de volta
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === 'string') return resolve(req.body);
      try { return resolve(JSON.stringify(req.body)); } catch (_) { return resolve(''); }
    }
    // Lê do stream bruto
    const chunks = [];
    req.on('data', chunk => chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8')));
    req.on('end',  () => resolve(chunks.join('')));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Extrai URL alvo
  let targetUrl = req.query?.url;
  if (!targetUrl) {
    try {
      targetUrl = new URL(req.url, 'http://localhost').searchParams.get('url');
    } catch (_) {}
  }
  if (!targetUrl) {
    return res.status(400).json({ error: 'Parâmetro "url" obrigatório.' });
  }

  // Decodifica
  let decoded = targetUrl;
  try { decoded = decodeURIComponent(targetUrl); } catch (_) {}

  // Valida hostname
  const hostMatch = decoded.match(/^https?:\/\/([^/?#]+)/);
  if (!hostMatch) {
    return res.status(400).json({ error: 'URL inválida.', url: decoded.slice(0, 200) });
  }
  const hostname = hostMatch[1].split(':')[0];
  const isAllowed = ALLOWED.some(d => hostname === d || hostname.endsWith('.' + d));
  if (!isAllowed) {
    return res.status(403).json({ error: 'Domínio não autorizado.', hostname, allowed: ALLOWED });
  }

  // Remove cache-busting
  const cleanUrl = decoded.replace(/([?&])_t=[^&]*/g, '').replace(/[?&]$/, '');

  // Lê body se for POST
  let bodyText = '';
  if (req.method === 'POST') {
    try { bodyText = await lerBody(req); } catch (_) { bodyText = ''; }
  }

  const isPost = req.method === 'POST';
  console.log(`[proxy] ${req.method} → ${cleanUrl.replace(/chave=[^&]+/g, 'chave=***')} | body: ${bodyText.length} bytes`);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55000);

    const headers = {
      'Accept':          'application/json',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      'User-Agent':      'Mozilla/5.0 (compatible; JurisMonitor/2.0)',
    };

    // Repassa Authorization do request original
    if (req.headers['authorization']) {
      headers['Authorization'] = req.headers['authorization'];
    }

    // Content-Type apenas para POST com body
    if (isPost && bodyText) {
      headers['Content-Type'] = 'application/json';
    }

    const upstreamOpts = {
      method:  isPost ? 'POST' : 'GET',
      headers,
      signal:  controller.signal,
    };

    if (isPost && bodyText) {
      upstreamOpts.body = bodyText;
    }

    const upstream = await fetch(cleanUrl, upstreamOpts);
    clearTimeout(timer);

    const text = await upstream.text();
    const ct   = upstream.headers.get('content-type') || 'application/json';

    res.setHeader('Content-Type', ct.includes('json') ? 'application/json; charset=utf-8' : ct);
    res.setHeader('X-Upstream-Status', String(upstream.status));
    res.setHeader('X-Proxy-Url', cleanUrl.replace(/chave=[^&]+/g, 'chave=***').slice(0, 200));
    res.setHeader('Access-Control-Expose-Headers', 'X-Upstream-Status, X-Proxy-Url');

    return res.status(upstream.status).send(text);

  } catch (err) {
    const isAbort = err.name === 'AbortError';
    console.error('[proxy] Erro:', err.message);
    return res.status(isAbort ? 504 : 502).json({
      error:  isAbort ? 'Timeout — upstream não respondeu em 55s.' : 'Erro ao conectar à API externa.',
      detail: err.message,
      url:    cleanUrl.slice(0, 200),
    });
  }
}
