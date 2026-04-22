export default async function handler(req, res) {
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
  } catch {
    return res.status(400).json({ error: 'URL inválida.', url: targetUrl });
  }

  const isAllowed = allowed.some(d =>
    parsedUrl.hostname === d || parsedUrl.hostname.endsWith('.' + d)
  );
  if (!isAllowed) {
    return res.status(403).json({
      error: `Domínio não autorizado: ${parsedUrl.hostname}`,
      allowed,
    });
  }

  try {
    const isPost = req.method === 'POST';
    let bodyToSend = undefined;

    if (isPost) {
      if (typeof req.body === 'string') {
        bodyToSend = req.body;
      } else if (req.body && typeof req.body === 'object') {
        bodyToSend = JSON.stringify(req.body);
      }
    }

    // Sem Content-Type em GET — AASP rejeita com 500 quando recebe Content-Type em GET
    const upstreamHeaders = {
      'Accept': 'application/json',
      'User-Agent': 'JurisMonitor/1.0',
      ...(req.headers['authorization']
        ? { 'Authorization': req.headers['authorization'] }
        : {}),
    };
    if (isPost) {
      upstreamHeaders['Content-Type'] = 'application/json';
    }

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: upstreamHeaders,
      ...(bodyToSend ? { body: bodyToSend } : {}),
      signal: AbortSignal.timeout(55000),
    });

    const contentType = upstream.headers.get('content-type') || 'application/json';
    const body = await upstream.text();

    // Expõe status e primeiros 500 chars do body para diagnóstico no frontend
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Upstream-Status', String(upstream.status));
    res.setHeader('X-Upstream-Body-Preview', encodeURIComponent(body.slice(0, 500)));
    res.setHeader('Access-Control-Expose-Headers', 'X-Upstream-Status, X-Upstream-Body-Preview');

    return res.status(upstream.status).send(body);

  } catch (err) {
    return res.status(500).json({
      error: 'Erro ao chamar API externa.',
      detail: err.message,
    });
  }
};
