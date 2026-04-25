// proxy.js — Vercel Serverless Function
// Baseado no padrão do projeto de referência que funciona em produção.
// Usa módulo nativo https/http do Node — sem fetch, sem AbortSignal.timeout
// (compatível com Node 16, 18 e 20).

const https = require('https');
const http  = require('http');
const { URL } = require('url');

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

  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Parâmetro "url" obrigatório.' });
  }

  // Decodifica a targetUrl antes de parsear — evita double-encoding
  // quando o frontend manda encodeURIComponent(encodeURIComponent(data))
  let decodedUrl = targetUrl;
  try {
    // Decodifica apenas uma vez se detectar double-encoding (%25 = %)
    if (targetUrl.includes('%25')) {
      decodedUrl = decodeURIComponent(targetUrl);
    }
  } catch (_) { decodedUrl = targetUrl; }

  let parsedUrl;
  try {
    parsedUrl = new URL(decodedUrl);
  } catch (e) {
    return res.status(400).json({ error: 'URL inválida.', url: targetUrl });
  }

  const isAllowed = ALLOWED.some(function(d) {
    return parsedUrl.hostname === d || parsedUrl.hostname.endsWith('.' + d);
  });
  if (!isAllowed) {
    return res.status(403).json({
      error: 'Domínio não autorizado: ' + parsedUrl.hostname,
      allowed: ALLOWED,
    });
  }

  // Remove parâmetro cache-busting _t antes de repassar para a AASP
  parsedUrl.searchParams.delete('_t');
  const cleanUrl = parsedUrl.toString();

  const isPost = req.method === 'POST';
  let bodyToSend = '';
  if (isPost) {
    if (typeof req.body === 'string') bodyToSend = req.body;
    else if (req.body && typeof req.body === 'object') bodyToSend = JSON.stringify(req.body);
  }

  // AASP rejeita requisições GET com Content-Type — enviamos apenas em POST
  const reqHeaders = {
    'Accept': 'application/json',
    'User-Agent': 'JurisMonitor/1.0',
  };
  if (req.headers['authorization']) {
    reqHeaders['Authorization'] = req.headers['authorization'];
  }
  if (isPost && bodyToSend) {
    reqHeaders['Content-Type'] = 'application/json';
    reqHeaders['Content-Length'] = Buffer.byteLength(bodyToSend);
  }

  const lib = parsedUrl.protocol === 'https:' ? https : http;
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    method: req.method,
    headers: reqHeaders,
    timeout: 50000,
  };

  return new Promise(function(resolve) {
    const upstream = lib.request(options, function(upstreamRes) {
      let data = '';
      upstreamRes.on('data', function(chunk) { data += chunk; });
      upstreamRes.on('end', function() {
        const ct = upstreamRes.headers['content-type'] || 'application/json';
        res.setHeader('Content-Type', ct);
        res.setHeader('X-Upstream-Status', String(upstreamRes.statusCode));
        res.setHeader('X-Upstream-Body-Preview', encodeURIComponent(data.slice(0, 500)));
        res.setHeader('Access-Control-Expose-Headers', 'X-Upstream-Status, X-Upstream-Body-Preview');
        res.status(upstreamRes.statusCode).send(data);
        resolve();
      });
    });

    upstream.on('timeout', function() {
      upstream.destroy();
      res.status(504).json({
        error: 'Timeout',
        detail: 'A API externa não respondeu em 50 segundos.',
        url: cleanUrl,
      });
      resolve();
    });

    upstream.on('error', function(err) {
      console.error('[proxy] erro upstream:', err.code, err.message, cleanUrl);
      res.status(500).json({
        error: 'Erro ao chamar API externa.',
        detail: err.message,
        code: err.code || '',
        url: cleanUrl,
      });
      resolve();
    });

    if (isPost && bodyToSend) upstream.write(bodyToSend);
    upstream.end();
  });
};
