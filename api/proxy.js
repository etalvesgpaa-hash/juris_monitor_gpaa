const https = require('https');
const http = require('http');
const { URL } = require('url');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'Parâmetro "url" obrigatório.' });

  const allowed = [
    'intimacaoapi.aasp.org.br',
    'api-publica.datajud.cnj.jus.br',
    'datajud.cnj.jus.br',
    'api.escavador.com',
    'api.groq.com',
  ];

  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (e) {
    return res.status(400).json({ error: 'URL inválida.', url: targetUrl });
  }

  const isAllowed = allowed.some(function(d) {
    return parsedUrl.hostname === d || parsedUrl.hostname.endsWith('.' + d);
  });
  if (!isAllowed) {
    return res.status(403).json({
      error: 'Domínio não autorizado: ' + parsedUrl.hostname,
      allowed: allowed,
    });
  }

  // Remove cache-busting antes de repassar
  parsedUrl.searchParams.delete('_t');
  const cleanUrl = parsedUrl.toString();

  // Faz a requisição usando o módulo nativo https/http do Node
  // evita dependência de fetch e AbortSignal.timeout que pode não existir
  return new Promise(function(resolve) {
    const isPost = req.method === 'POST';
    let bodyToSend = '';

    if (isPost) {
      if (typeof req.body === 'string') {
        bodyToSend = req.body;
      } else if (req.body && typeof req.body === 'object') {
        bodyToSend = JSON.stringify(req.body);
      }
    }

    const reqHeaders = {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (compatible; JurisMonitor/2.0)',
      'Accept-Language': 'pt-BR,pt;q=0.9',
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

    const upstream = lib.request(options, function(upstreamRes) {
      let data = '';
      upstreamRes.on('data', function(chunk) { data += chunk; });
      upstreamRes.on('end', function() {
        const contentType = upstreamRes.headers['content-type'] || 'application/json';
        res.setHeader('Content-Type', contentType.includes('json') ? 'application/json' : contentType);
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
        error: 'Timeout ao chamar API externa.',
        detail: 'A API da AASP não respondeu em 50 segundos.',
        url: cleanUrl,
      });
      resolve();
    });

    upstream.on('error', function(err) {
      console.error('[proxy] Erro upstream:', cleanUrl, err.message);
      res.status(500).json({
        error: 'Erro ao chamar API externa.',
        detail: err.message,
        code: err.code || '',
        url: cleanUrl,
        tip: err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND'
          ? 'Servidor Vercel não conseguiu alcançar a AASP. Verifique se "regions": ["gru1"] está no vercel.json.'
          : 'Verifique se a chave AASP é válida em minha.aasp.org.br.',
      });
      resolve();
    });

    if (isPost && bodyToSend) {
      upstream.write(bodyToSend);
    }
    upstream.end();
  });
};
