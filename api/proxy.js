/**
 * /api/proxy — Vercel Serverless Function
 *
 * Usa fetch() nativo (Node 18+) em vez de https.request()
 * para garantir compatibilidade com qualquer runtime da Vercel.
 *
 * Uso: GET /api/proxy?url=https%3A%2F%2Fintimacaoapi.aasp.org.br%2F...
 */

const ALLOWED = [
  'intimacaoapi.aasp.org.br',
  'api-publica.datajud.cnj.jus.br',
  'datajud.cnj.jus.br',
  'api.escavador.com',
  'api.groq.com',
];

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extrai e decodifica a URL alvo
  let targetUrl = req.query?.url || new URL(req.url, 'http://localhost').searchParams.get('url');
  if (!targetUrl) {
    return res.status(400).json({ error: 'Parâmetro "url" obrigatório.' });
  }

  let decoded = targetUrl;
  try { decoded = decodeURIComponent(targetUrl); } catch (_) {}

  // Valida hostname sem usar new URL() (evita normalizar %2F em barras)
  const hostMatch = decoded.match(/^https?:\/\/([^/?#]+)/);
  if (!hostMatch) {
    return res.status(400).json({ error: 'URL inválida.', url: decoded.slice(0, 200) });
  }
  const hostname = hostMatch[1].split(':')[0];

  const isAllowed = ALLOWED.some(d => hostname === d || hostname.endsWith('.' + d));
  if (!isAllowed) {
    return res.status(403).json({ error: 'Domínio não autorizado.', hostname, allowed: ALLOWED });
  }

  // Remove cache-busting _t= da URL alvo
  const cleanUrl = decoded.replace(/([?&])_t=[^&]*/g, '').replace(/([?&])$/, '');

  console.log('[proxy] →', cleanUrl.replace(/chave=[^&]+/, 'chave=***'));

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 50000);

    const upstream = await fetch(cleanUrl, {
      method: req.method === 'POST' ? 'POST' : 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; JurisMonitor/2.0; +https://jurismonitoredson.vercel.app)',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        ...(req.headers['authorization'] ? { 'Authorization': req.headers['authorization'] } : {}),
      },
      signal: controller.signal,
      ...(req.method === 'POST' && req.body ? { body: JSON.stringify(req.body) } : {}),
    });

    clearTimeout(timer);

    const text = await upstream.text();
    const ct = upstream.headers.get('content-type') || 'application/json';

    res.setHeader('Content-Type', ct.includes('json') ? 'application/json' : ct);
    res.setHeader('X-Upstream-Status', String(upstream.status));
    res.setHeader('Access-Control-Expose-Headers', 'X-Upstream-Status');

    return res.status(upstream.status).send(text);

  } catch (err) {
    const isAbort = err.name === 'AbortError';
    console.error('[proxy] Erro:', err.message);
    return res.status(isAbort ? 504 : 502).json({
      error: isAbort ? 'Timeout — API não respondeu em 50s.' : 'Erro ao chamar API externa.',
      detail: err.message,
    });
  }
}
