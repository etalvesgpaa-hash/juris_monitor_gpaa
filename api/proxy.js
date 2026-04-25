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

  // Pega a URL alvo — decodifica uma vez para evitar double-encoding
  let targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Parâmetro "url" obrigatório.' });
  }

  // Decodifica o parâmetro url= uma única vez (ele vem encodado pelo frontend)
  let decoded = targetUrl;
  try {
    decoded = decodeURIComponent(targetUrl);
  } catch (_) { decoded = targetUrl; }

  // Valida hostname
  let hostname, pathname, search, protocol;
  try {
    const u = new URL(decoded);
    hostname = u.hostname;
    pathname = u.pathname;
    search   = u.search;
    protocol = u.protocol;
  } catch (_) {
    return res.status(400).json({ error: 'URL inválida após decodificação.', url: decoded.slice(0, 200) });
  }

  const isAllowed = ALLOWED.some(function(d) {
    return hostname === d || hostname.endsWith('.' + d);
  });
  if (!isAllowed) {
    return res.status(403).json({ error: 'Domínio não autorizado: ' + hostname, allowed: ALLOWED });
  }

  // Remove _t (cache-busting)
  const sp = new URLSearchParams(search.replace(/^\?/, ''));
  sp.delete('_t');
  const cleanSearch = sp.toString() ? '?' + sp.toString() : '';
  const cleanPath   = pathname + cleanSearch;

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

  const lib = protocol === 'https:' ? https : http;
  const options = {
    hostname,
    port: protocol === 'https:' ? 443 : 80,
    path: cleanPath,
    method: req.method,
    headers: reqHeaders,
    timeout: 50000,
  };

  // Log para depuração
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
