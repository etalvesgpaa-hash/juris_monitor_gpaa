const https = require('https');
const { URL } = require('url');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const chave = req.query.chave;
  if (!chave) {
    return res.status(400).json({ error: 'Parâmetro "chave" obrigatório. Ex: /api/diag-aasp?chave=SUA_CHAVE' });
  }

  const hoje = new Date().toISOString().split('T')[0];
  const params = new URLSearchParams({ chave: chave.trim(), data: hoje });
  const endpoint = 'https://intimacaoapi.aasp.org.br/api/Associado/intimacao/json?' + params.toString();
  const parsedUrl = new URL(endpoint);

  const resultado = {
    timestamp: new Date().toISOString(),
    vercel_region: process.env.VERCEL_REGION || process.env.AWS_REGION || 'desconhecida',
    endpoint_testado: endpoint.replace(chave.trim(), '***'),
    data_testada: hoje,
  };

  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'GET',
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (compatible; JurisMonitor/2.0)',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
    timeout: 25000,
  };

  const start = Date.now();

  const upstream = https.request(options, function(upstreamRes) {
    let data = '';
    upstreamRes.on('data', function(chunk) { data += chunk; });
    upstreamRes.on('end', function() {
      resultado.status_http = upstreamRes.statusCode;
      resultado.tempo_ms = Date.now() - start;
      resultado.content_type = upstreamRes.headers['content-type'] || '';
      resultado.body_preview = data.slice(0, 800);

      let parsed = null;
      try { parsed = JSON.parse(data); } catch (e) {}

      const lista = parsed
        ? (Array.isArray(parsed) ? parsed
          : (parsed.Intimacoes || parsed.intimacoes || parsed.Data || null))
        : null;

      resultado.intimacoes_encontradas = Array.isArray(lista) ? lista.length : null;
      resultado.diagnostico = upstreamRes.statusCode === 200
        ? (Array.isArray(lista) && lista.length > 0
            ? '✅ Sucesso! ' + lista.length + ' intimação(ões) para hoje.'
            : '⚠️ API respondeu 200 mas sem intimações. Pode ser normal (sem publicações hoje).')
        : '❌ API retornou HTTP ' + upstreamRes.statusCode + '. Verifique a chave AASP.';

      res.status(200).json(resultado);
    });
  });

  upstream.on('timeout', function() {
    upstream.destroy();
    resultado.erro = 'Timeout (25s)';
    resultado.diagnostico = '❌ Timeout — a AASP não respondeu em 25s.';
    res.status(200).json(resultado);
  });

  upstream.on('error', function(err) {
    resultado.erro = err.message;
    resultado.code = err.code || '';
    resultado.diagnostico = '❌ Erro de conexão: ' + err.message;
    resultado.sugestao = 'Certifique-se que vercel.json tem "regions": ["gru1"] (São Paulo).';
    res.status(200).json(resultado);
  });

  upstream.end();
};
