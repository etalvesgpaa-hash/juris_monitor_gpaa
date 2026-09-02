/**
 * /api/aasp-test?chave=SUA_CHAVE&data=24/04/2026
 * /api/aasp-test?chave=SUA_CHAVE&data=2026-04-24
 * 
 * Testa AMBOS os formatos de data e retorna o raw bruto da API AASP.
 * Abra no browser após deploy para ver exatamente o que a API retorna.
 */
const https = require('https');
const { URL } = require('url');

function httpGet(url) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; JurisMonitor/2.0)',
      },
      timeout: 25000,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.status || res.statusCode, body: data, ok: true }));
    });
    req.on('error', (e) => resolve({ status: 0, body: '', error: e.message, ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: '', error: 'Timeout', ok: false }); });
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const chave = req.query.chave;
  if (!chave) {
    return res.status(400).json({ erro: 'Parâmetro ?chave= obrigatório' });
  }

  // Hoje em ambos os formatos
  const agora = new Date();
  // Usa horário de Brasília (UTC-3)
  const brasiliaOffset = -3 * 60;
  const localTime = new Date(agora.getTime() + (brasiliaOffset - agora.getTimezoneOffset()) * 60000);
  const d = String(localTime.getDate()).padStart(2, '0');
  const m = String(localTime.getMonth() + 1).padStart(2, '0');
  const a = localTime.getFullYear();

  const fmtISO = `${a}-${m}-${d}`;   // 2026-04-24
  const fmtBR  = `${d}/${m}/${a}`;   // 24/04/2026

  // Data customizada se informada
  const dataCustom = req.query.data || null;

  const BASE = 'https://intimacaoapi.aasp.org.br/api/Associado/intimacao/json';

  async function testar(dataParam, label) {
    const qs = new URLSearchParams({ chave: chave.trim(), data: dataParam }).toString();
    const url = `${BASE}?${qs}`;
    const r = await httpGet(url);

    let parsed = null;
    let parseErr = null;
    try { parsed = JSON.parse(r.body); } catch (e) { parseErr = e.message; }

    let lista = [];
    if (parsed) {
      if (Array.isArray(parsed)) lista = parsed;
      else if (Array.isArray(parsed?.Intimacoes)) lista = parsed.Intimacoes;
      else if (Array.isArray(parsed?.Data)) lista = parsed.Data;
      else if (Array.isArray(parsed?.intimacoes)) lista = parsed.intimacoes;
      else {
        for (const v of Object.values(parsed)) {
          if (Array.isArray(v)) { lista = v; break; }
        }
      }
    }

    return {
      label,
      dataEnviada: dataParam,
      urlCompleta: url.replace(chave.trim(), '***'),
      httpStatus: r.status,
      httpOk: r.ok,
      httpErro: r.error || null,
      bodyLength: r.body.length,
      bodyPreview: r.body.slice(0, 600),
      parseOk: !!parsed,
      parseErro: parseErr,
      tipoRetorno: Array.isArray(parsed) ? 'array_direto' : (parsed ? `objeto_com_chaves: [${Object.keys(parsed).join(', ')}]` : 'nulo'),
      quantidadeIntimacoes: lista.length,
      primeiroItem: lista[0] ? JSON.stringify(lista[0]).slice(0, 800) : null,
    };
  }

  const resultados = {};

  if (dataCustom) {
    resultados['custom'] = await testar(dataCustom, `Data customizada: ${dataCustom}`);
  } else {
    // Testa ambos os formatos para hoje
    const [resISO, resBR] = await Promise.all([
      testar(fmtISO, `Hoje formato ISO: ${fmtISO}`),
      testar(fmtBR,  `Hoje formato BR: ${fmtBR}`),
    ]);
    resultados['ISO'] = resISO;
    resultados['BR']  = resBR;
  }

  const recomendacao = resultados['BR']?.quantidadeIntimacoes >= resultados['ISO']?.quantidadeIntimacoes
    ? 'BR (DD/MM/YYYY)'
    : 'ISO (YYYY-MM-DD)';

  return res.status(200).json({
    timestamp: new Date().toISOString(),
    hojeISO: fmtISO,
    hojeBR: fmtBR,
    vercelRegion: process.env.VERCEL_REGION || process.env.AWS_REGION || 'desconhecida',
    recomendacao: dataCustom ? 'N/A (data customizada)' : recomendacao,
    resultados,
    instrucoes: {
      testarISO: `/api/aasp-test?chave=SUA_CHAVE&data=${fmtISO}`,
      testarBR:  `/api/aasp-test?chave=SUA_CHAVE&data=${fmtBR}`,
      ontem:     `/api/aasp-test?chave=SUA_CHAVE&data=${String(Number(d)-1).padStart(2,'0')}/${m}/${a}`,
    }
  });
};
