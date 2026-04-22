/**
 * /api/diag-aasp?chave=SUA_CHAVE
 * Testa a conectividade com a API da AASP diretamente do servidor Vercel.
 * Use para diagnóstico: abre no browser ou via fetch no console.
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const chave = req.query.chave;
  if (!chave) {
    return res.status(400).json({ error: 'Parâmetro "chave" obrigatório. Ex: /api/diag-aasp?chave=SUA_CHAVE' });
  }

  const hoje = new Date().toISOString().split('T')[0];
  const params = new URLSearchParams({ chave: chave.trim(), data: hoje });
  const endpoint = `https://intimacaoapi.aasp.org.br/api/Associado/intimacao/json?${params}`;

  const resultado = {
    timestamp: new Date().toISOString(),
    vercel_region: process.env.VERCEL_REGION || process.env.AWS_REGION || 'desconhecida',
    endpoint_testado: endpoint.replace(chave, '***'),
    data_testada: hoje,
  };

  try {
    const start = Date.now();
    const resp = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (compatible; JurisMonitor/2.0)',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      signal: AbortSignal.timeout(30000),
    });

    const elapsed = Date.now() - start;
    const body = await resp.text();

    let parsed = null;
    try { parsed = JSON.parse(body); } catch {}

    const lista = parsed
      ? (Array.isArray(parsed) ? parsed
        : parsed?.Intimacoes ?? parsed?.intimacoes ?? parsed?.Data ?? null)
      : null;

    resultado.status_http = resp.status;
    resultado.tempo_ms = elapsed;
    resultado.content_type = resp.headers.get('content-type');
    resultado.body_preview = body.slice(0, 800);
    resultado.intimacoes_encontradas = Array.isArray(lista) ? lista.length : null;
    resultado.diagnostico = resp.ok
      ? (Array.isArray(lista) && lista.length > 0
          ? `✅ Sucesso! ${lista.length} intimação(ões) encontrada(s) para hoje.`
          : `⚠️ API respondeu OK (${resp.status}) mas sem intimações para hoje. Isso pode ser normal (sem publicações).`)
      : `❌ API retornou HTTP ${resp.status}. Verifique a chave AASP.`;

  } catch (err) {
    const detail = err.cause
      ? `${err.message} — ${err.cause?.message || String(err.cause)}`
      : err.message;

    resultado.erro = detail;
    resultado.diagnostico = `❌ Falha de conexão: ${detail}. O servidor Vercel não conseguiu alcançar a API da AASP.`;
    resultado.sugestao = 'Certifique-se que vercel.json tem "regions": ["gru1"] para usar o datacenter de São Paulo.';
  }

  return res.status(200).json(resultado);
};
