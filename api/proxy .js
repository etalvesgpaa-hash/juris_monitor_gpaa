/**
 * API Proxy - Vercel Serverless Function
 * Faz requisições para APIs externas respeitando CORS
 * 
 * Modificações:
 * - Timeout reduzido de 55s para 15s
 * - User-Agent melhorado
 * - Headers otimizados para AASP
 * - Melhor tratamento de erros com logging
 */

module.exports = async function handler(req, res) {
  // Headers CORS - permiter requisições cross-origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');

  // Responder a requisições OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extrair URL alvo do query parameter
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ 
      error: 'Parâmetro "url" obrigatório.',
      example: '/api/proxy?url=https://example.com/api'
    });
  }

  // Lista de domínios permitidos (whitelist)
  const allowed = [
    'intimacaoapi.aasp.org.br',           // AASP Intimações
    'api-publica.datajud.cnj.jus.br',     // DataJud
    'datajud.cnj.jus.br',                  // DataJud
    'api.escavador.com',                   // Escavador
    'api.groq.com',                        // Groq AI
  ];

  // Validar URL
  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (e) {
    return res.status(400).json({ 
      error: 'URL inválida.',
      url: targetUrl,
      detail: e.message
    });
  }

  // Verificar se domínio está na whitelist
  const isAllowed = allowed.some(d =>
    parsedUrl.hostname === d || parsedUrl.hostname.endsWith('.' + d)
  );
  
  if (!isAllowed) {
    return res.status(403).json({
      error: `Domínio não autorizado: ${parsedUrl.hostname}`,
      allowed: allowed,
      message: 'Para adicionar um novo domínio, edite a lista "allowed" em /api/proxy.js'
    });
  }

  try {
    const isPost = req.method === 'POST';
    let bodyToSend = undefined;

    // Preparar body para requisições POST
    if (isPost) {
      if (typeof req.body === 'string') {
        bodyToSend = req.body;
      } else if (req.body && typeof req.body === 'object') {
        bodyToSend = JSON.stringify(req.body);
      }
    }

    // ✨ Headers otimizados para AASP
    // A AASP é sensível a certos headers e rejeita Content-Type em GET
    const upstreamHeaders = {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      ...(req.headers['authorization']
        ? { 'Authorization': req.headers['authorization'] }
        : {}),
    };
    
    // Apenas POST recebe Content-Type: application/json
    if (isPost) {
      upstreamHeaders['Content-Type'] = 'application/json';
    }

    // ⏱️ Fazer requisição com timeout reduzido
    // Original era 55000ms (55s) - causa problemas em Vercel
    // Novo: 15000ms (15s) - mais apropriado
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: upstreamHeaders,
      ...(bodyToSend ? { body: bodyToSend } : {}),
      signal: AbortSignal.timeout(15000), // ← Reduzido
    });

    // Ler resposta
    const contentType = upstream.headers.get('content-type') || 'application/json';
    const body = await upstream.text();

    // Headers de diagnóstico (expostos ao frontend)
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Upstream-Status', String(upstream.status));
    res.setHeader('X-Upstream-Body-Preview', encodeURIComponent(body.slice(0, 500)));
    res.setHeader('Access-Control-Expose-Headers', 'X-Upstream-Status, X-Upstream-Body-Preview');

    // Retornar resposta da API externa
    return res.status(upstream.status).send(body);

  } catch (err) {
    // Melhor logging para diagnóstico
    const errorInfo = {
      timestamp: new Date().toISOString(),
      url: targetUrl,
      method: req.method,
      errorName: err.name,
      errorMessage: err.message,
      errorCode: err.code,
    };

    console.error('[proxy.js] Erro ao processar requisição:', errorInfo);

    return res.status(500).json({
      error: 'Erro ao chamar API externa.',
      detail: err.message,
      errorType: err.name,
      timestamp: errorInfo.timestamp,
      suggestions: [
        'Verifique se a URL alvo está acessível',
        'Confirme que as credenciais (Authorization header) estão corretas',
        'Se for AASP, valide a chave em minha.aasp.org.br',
        'Tente novamente em alguns minutos',
        'Verifique os logs do servidor para mais detalhes'
      ]
    });
  }
};
