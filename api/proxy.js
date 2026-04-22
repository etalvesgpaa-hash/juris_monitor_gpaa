module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Validar URL
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ 
      error: 'Parâmetro "url" obrigatório.',
      code: '400'
    });
  }

  // Domínios permitidos
  const allowed = [
    'intimacaoapi.aasp.org.br',
    'api-publica.datajud.cnj.jus.br',
    'datajud.cnj.jus.br',
    'api.escavador.com',
    'api.groq.com',
  ];

  // Parse e validação da URL
  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (err) {
    return res.status(400).json({ 
      error: 'URL inválida.',
      url: targetUrl,
      code: '400'
    });
  }

  // Verificar se o domínio é permitido
  const isAllowed = allowed.some(d =>
    parsedUrl.hostname === d || parsedUrl.hostname.endsWith('.' + d)
  );
  
  if (!isAllowed) {
    return res.status(403).json({
      error: `Domínio não autorizado: ${parsedUrl.hostname}`,
      allowed,
      code: '403'
    });
  }

  try {
    const isPost = req.method === 'POST';
    let bodyToSend = undefined;

    // Processar body se for POST
    if (isPost) {
      if (typeof req.body === 'string') {
        bodyToSend = req.body;
      } else if (req.body && typeof req.body === 'object') {
        bodyToSend = JSON.stringify(req.body);
      }
    }

    // Preparar headers para a requisição upstream
    const upstreamHeaders = {
      'Accept': 'application/json',
      'User-Agent': 'JurisMonitor/1.0',
    };

    // Adicionar Authorization se presente
    if (req.headers['authorization']) {
      upstreamHeaders['Authorization'] = req.headers['authorization'];
    }

    // Content-Type apenas para POST (AASP rejeita com 500 se enviar em GET)
    if (isPost) {
      upstreamHeaders['Content-Type'] = 'application/json';
    }

    // Log para debug (remover em produção)
    console.log('Proxy Request:', {
      method: req.method,
      url: targetUrl,
      headers: upstreamHeaders,
      hasBody: !!bodyToSend
    });

    // Fazer requisição upstream
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: upstreamHeaders,
      ...(bodyToSend ? { body: bodyToSend } : {}),
      signal: AbortSignal.timeout(55000),
    });

    // Obter resposta
    const contentType = upstream.headers.get('content-type') || 'application/json';
    const body = await upstream.text();

    // Log da resposta
    console.log('Upstream Response:', {
      status: upstream.status,
      contentType,
      bodyPreview: body.slice(0, 200)
    });

    // Headers de diagnóstico
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Upstream-Status', String(upstream.status));
    res.setHeader('X-Upstream-Body-Preview', encodeURIComponent(body.slice(0, 500)));
    res.setHeader('Access-Control-Expose-Headers', 'X-Upstream-Status, X-Upstream-Body-Preview');

    // Retornar resposta
    return res.status(upstream.status).send(body);

  } catch (err) {
    console.error('Proxy Error:', err);
    
    return res.status(500).json({
      error: 'Erro ao chamar API externa.',
      message: err.message,
      detail: err.stack,
      code: '500'
    });
  }
};
