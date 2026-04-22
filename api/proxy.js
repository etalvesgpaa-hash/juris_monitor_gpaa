/**
 * Proxy AASP - Versão Corrigida v2
 * Faz requisição DIRETA à API AASP sem intermediários
 */

module.exports = async function handler(req, res) {
  // ═══════════════════════════════════════════════════════════════
  // 1. CORS HEADERS
  // ═══════════════════════════════════════════════════════════════
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-Requested-With, Cache-Control, Pragma');
  res.setHeader('Access-Control-Expose-Headers', 'X-Upstream-Status, X-Upstream-Body-Preview, X-Error-Detail');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. VALIDAÇÃO DE PARÂMETROS
  // ═══════════════════════════════════════════════════════════════
  const targetUrl = req.query.url;
  
  if (!targetUrl) {
    return res.status(400).json({ 
      error: {
        code: '400',
        message: 'URL de destino é obrigatória. Use: ?url=...'
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. WHITELIST DE DOMÍNIOS
  // ═══════════════════════════════════════════════════════════════
  const allowedDomains = [
    'intimacaoapi.aasp.org.br',
    'api-publica.datajud.cnj.jus.br',
    'datajud.cnj.jus.br',
    'api.escavador.com',
    'api.groq.com',
  ];

  let parsedUrl;
  try {
    parsedUrl = new URL(decodeURIComponent(targetUrl));
  } catch (err) {
    return res.status(400).json({ 
      error: {
        code: '400',
        message: 'URL inválida ou malformada',
        url: targetUrl
      }
    });
  }

  const isAllowed = allowedDomains.some(domain =>
    parsedUrl.hostname === domain || parsedUrl.hostname.endsWith('.' + domain)
  );

  if (!isAllowed) {
    return res.status(403).json({
      error: {
        code: '403',
        message: `Domínio não autorizado: ${parsedUrl.hostname}`,
        allowedDomains
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. PREPARAR REQUISIÇÃO
  // ═══════════════════════════════════════════════════════════════
  const isPost = req.method === 'POST';
  const isPut = req.method === 'PUT';
  const isDelete = req.method === 'DELETE';
  const hasBody = isPost || isPut;

  let bodyToSend = undefined;

  if (hasBody && req.body) {
    if (typeof req.body === 'string') {
      bodyToSend = req.body;
    } else if (typeof req.body === 'object') {
      bodyToSend = JSON.stringify(req.body);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. HEADERS PARA API UPSTREAM
  // ═══════════════════════════════════════════════════════════════
  const upstreamHeaders = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Origin': 'https://minha.aasp.org.br',
    'Referer': 'https://minha.aasp.org.br/',
  };

  // CRÍTICO: Não enviar Content-Type em GET
  // A API AASP rejeita com HTTP 500 se receber Content-Type em GET
  if (hasBody) {
    upstreamHeaders['Content-Type'] = 'application/json';
  }

  // Passar Authorization se presente
  if (req.headers['authorization']) {
    upstreamHeaders['Authorization'] = req.headers['authorization'];
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. FAZER REQUISIÇÃO À API
  // ═══════════════════════════════════════════════════════════════
  
  console.log('═══════════════════════════════════════════════════');
  console.log('[PROXY] Nova requisição:', {
    method: req.method,
    url: parsedUrl.hostname + parsedUrl.pathname,
    timestamp: new Date().toISOString()
  });
  console.log('[PROXY] Headers enviados:', upstreamHeaders);
  if (bodyToSend) {
    console.log('[PROXY] Body:', bodyToSend.slice(0, 200));
  }

  try {
    const fetchOptions = {
      method: req.method,
      headers: upstreamHeaders,
      signal: AbortSignal.timeout(30000), // 30 segundos
    };

    if (bodyToSend) {
      fetchOptions.body = bodyToSend;
    }

    const upstream = await fetch(targetUrl, fetchOptions);

    console.log('[PROXY] Status da resposta:', upstream.status, upstream.statusText);

    // Ler resposta
    const contentType = upstream.headers.get('content-type') || 'application/json';
    const responseText = await upstream.text();

    console.log('[PROXY] Content-Type:', contentType);
    console.log('[PROXY] Body (preview):', responseText.slice(0, 300));

    // Adicionar headers de diagnóstico
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Upstream-Status', String(upstream.status));
    res.setHeader('X-Upstream-Body-Preview', encodeURIComponent(responseText.slice(0, 500)));

    // Se a resposta não é OK, adicionar detalhes do erro
    if (!upstream.ok) {
      res.setHeader('X-Error-Detail', encodeURIComponent(responseText.slice(0, 200)));
      
      console.error('[PROXY] Erro da API upstream:', {
        status: upstream.status,
        body: responseText.slice(0, 500)
      });

      // Retornar erro estruturado
      return res.status(upstream.status).json({
        error: {
          code: String(upstream.status),
          message: `Erro na API de destino: ${upstream.statusText}`,
          upstreamResponse: responseText.slice(0, 1000)
        }
      });
    }

    // Sucesso - retornar resposta
    console.log('[PROXY] ✅ Requisição bem-sucedida');
    console.log('═══════════════════════════════════════════════════');
    
    return res.status(upstream.status).send(responseText);

  } catch (err) {
    // ═══════════════════════════════════════════════════════════════
    // 7. TRATAMENTO DE ERROS
    // ═══════════════════════════════════════════════════════════════
    
    console.error('═══════════════════════════════════════════════════');
    console.error('[PROXY] ❌ Erro ao fazer requisição:', err);
    console.error('[PROXY] Stack:', err.stack);
    console.error('═══════════════════════════════════════════════════');

    const errorDetails = {
      message: err.message,
      name: err.name,
      code: err.code || '500',
    };

    // Adicionar header de erro
    res.setHeader('X-Error-Detail', encodeURIComponent(JSON.stringify(errorDetails)));

    // Tipos de erro específicos
    if (err.name === 'AbortError' || err.message.includes('timeout')) {
      return res.status(504).json({
        error: {
          code: '504',
          message: 'Timeout: A API de destino demorou muito para responder (>30s)',
          detail: 'Tente novamente ou verifique se o serviço está disponível'
        }
      });
    }

    if (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED')) {
      return res.status(503).json({
        error: {
          code: '503',
          message: 'Serviço indisponível: Não foi possível conectar à API de destino',
          detail: 'O servidor pode estar fora do ar ou bloqueando a conexão'
        }
      });
    }

    // Erro genérico
    return res.status(500).json({
      error: {
        code: '500',
        message: 'Erro interno do servidor proxy',
        detail: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      }
    });
  }
};
