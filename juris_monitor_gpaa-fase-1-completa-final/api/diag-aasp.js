/**
 * /api/diag-aasp?chave=SUA_CHAVE
 * Testa a conectividade com a API AASP diretamente do servidor Vercel.
 * Usa fetch() nativo (Node 18+).
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const chave = req.query?.chave;
  if (!chave) {
    return res.status(400).json({ error: 'Parâmetro "chave" obrigatório.' });
  }

  // Data de hoje no horário de Brasília
  const now = new Date();
  const brt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const d  = String(brt.getDate()).padStart(2, '0');
  const m  = String(brt.getMonth() + 1).padStart(2, '0');
  const a  = brt.getFullYear();
  const hojeBR  = `${d}/${m}/${a}`;
  const hojeISO = `${a}-${m}-${d}`;

  const BASE = 'https://intimacaoapi.aasp.org.br/api/Associado/intimacao/json';

  async function testar(dataParam) {
    const url = `${BASE}?chave=${encodeURIComponent(chave.trim())}&data=${dataParam}`;
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const r = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; JurisMonitor/2.0)',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      const body = await r.text();
      const tempo_ms = Date.now() - start;

      let parsed = null;
      try { parsed = JSON.parse(body); } catch (_) {}

      let lista = [];
      if (parsed) {
        if (Array.isArray(parsed)) lista = parsed;
        else for (const v of Object.values(parsed)) { if (Array.isArray(v)) { lista = v; break; } }
      }

      return {
        dataEnviada: dataParam,
        httpStatus: r.status,
        tempo_ms,
        bodyLength: body.length,
        bodyPreview: body.slice(0, 400),
        quantidadeIntimacoes: lista.length,
        ok: r.ok,
      };
    } catch (err) {
      return {
        dataEnviada: dataParam,
        httpStatus: 0,
        tempo_ms: Date.now() - start,
        erro: err.message,
        ok: false,
      };
    }
  }

  const [resBR, resISO] = await Promise.all([testar(hojeBR), testar(hojeISO)]);

  return res.status(200).json({
    timestamp: new Date().toISOString(),
    vercel_region: process.env.VERCEL_REGION || process.env.AWS_REGION || 'desconhecida',
    hojeBR,
    hojeISO,
    formatoRecomendado: resBR.quantidadeIntimacoes >= resISO.quantidadeIntimacoes ? 'BR' : 'ISO',
    resultados: { BR: resBR, ISO: resISO },
  });
}
