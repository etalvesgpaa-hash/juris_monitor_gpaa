// proxy.js — Vercel Serverless Function
// Usa módulo nativo https/http do Node — compatível com Node 16, 18 e 20.

const https = require('https');
const http  = require('http');

const ALLOWED = [
  'intimacaoapi.aasp.org.br',
  'api-publica.datajud.cnj.jus.br',
  'datajud.cnj.jus.br',
  'api.escavador.com',
  'api.groq.com',
];

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  let targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Parâmetro "url" obrigatório.' });
  }

  // Decodifica o parâmetro url= uma única vez (ele vem encodado pelo frontend via encodeURIComponent)
  let decoded = targetUrl;
  try { decoded = decodeURIComponent(targetUrl); } catch (_) {}

  // ─── CRÍTICO: NÃO usar new URL() aqui ───────────────────────────────────────
  // new URL() normaliza %2F → "/" no search, quebrando datas DD/MM/YYYY passadas
  // como data=24%2F04%2F2026. Em vez disso, extraímos hostname e path com regex,
  // preservando o search string exatamente como veio.
  // ─────────────────────────────────────────────────────────────────────────────
  const urlMatch = decoded.match(/^(https?):\/\/([^\/]+)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/);
  if (!urlMatch) {
    return res.status(400).json({ error: 'URL inválida.', url: decoded.slice(0, 200) });
  }
  const protocol = urlMatch[1] + ':';
  const hostname  = urlMatch[2].split(':')[0]; // remove porta se houver
  const portStr   = urlMatch[2].includes(':') ? urlMatch[2].split(':')[1] : null;
  const pathname  = urlMatch[3] || '/';
  const rawSearch = urlMatch[4] || ''; // preservado EXATAMENTE — sem re-encode

  // Valida hostname
  const isAllowed = ALLOWED.some(function(d) {
    return hostname === d || hostname.endsWith('.' + d);
  });
  if (!isAllowed) {
    return res.status(403).json({ error: 'Domínio não autorizado: ' + hostname, allowed: ALLOWED });
  }

  // Remove _t (cache-busting) preservando o restante do search INTACTO
  const cleanSearch = rawSearch
    ? '?' + rawSearch.replace(/^\?/, '').split('&').filter(function(p) { return !p.startsWith('_t='); }).join('&')
    : '';
  // CRÍTICO: a AASP espera barras reais em parâmetros de data (ex: data=28/04/2026).
  // O frontend encoda a URL com encodeURIComponent, que transforma "/" em "%2F".
  // O rawSearch preserva esse %2F intacto. Aqui decodificamos APENAS o search string
  // (não o pathname) para que a AASP receba as barras reais e não retorne HTTP 500.
  const cleanSearchDecoded = cleanSearch.replace(/%2F/gi, '/');
  const cleanPath = pathname + cleanSearchDecoded;

  const isPost = req.method === 'POST';
  let bodyToSend = '';
  if (isPost) {
    if (typeof req.body === 'string') bodyToSend = req.body;
    else if (req.body && typeof req.body === 'object') bodyToSend = JSON.stringify(req.body);
  }

  const reqHeaders = {
    'Accept': 'application/json',
    'User-Agent': 'JurisMonitor/1.0',
  };
  if (req.headers['authorization']) reqHeaders['Authorization'] = req.headers['authorization'];
  if (isPost && bodyToSend) {
    reqHeaders['Content-Type']   = 'application/json';
    reqHeaders['Content-Length'] = Buffer.byteLength(bodyToSend);
  }

  const defaultPort = protocol === 'https:' ? 443 : 80;
  const port = portStr ? parseInt(portStr, 10) : defaultPort;

  const lib = protocol === 'https:' ? https : http;
  const options = {
    hostname,
    port,
    path: cleanPath,
    method: req.method,
    headers: reqHeaders,
    timeout: 50000,
  };

  // Log para depuração — mostra o path exato que será enviado à AASP
  console.log('[proxy] Chamando:', hostname + cleanPath);

  return new Promise(function(resolve) {
    const upstream = lib.request(options, function(upstreamRes) {
      let data = '';
      upstreamRes.on('data', function(chunk) { data += chunk; });
      upstreamRes.on('end', function() {
        const ct = upstreamRes.headers['content-type'] || 'application/json';
        res.setHeader('Content-Type', ct.includes('json') ? 'application/json' : ct);
        res.setHeader('X-Upstream-Status', String(upstreamRes.statusCode));
        res.setHeader('X-Upstream-Body-Preview', encodeURIComponent(data.slice(0, 300)));
        res.setHeader('Access-Control-Expose-Headers', 'X-Upstream-Status, X-Upstream-Body-Preview');
        res.status(upstreamRes.statusCode).send(data);
        resolve();
      });
    });

    upstream.on('timeout', function() {
      upstream.destroy();
      res.status(504).json({ error: 'Timeout', detail: 'API não respondeu em 50s.' });
      resolve();
    });

    upstream.on('error', function(err) {
      console.error('[proxy] Erro:', err.code, err.message);
      res.status(500).json({ error: 'Erro ao chamar API externa.', detail: err.message, code: err.code || '' });
      resolve();
    });

    if (isPost && bodyToSend) upstream.write(bodyToSend);
    upstream.end();
  });
};
