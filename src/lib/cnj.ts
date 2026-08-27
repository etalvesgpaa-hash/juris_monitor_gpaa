// Funções compartilhadas para trabalhar com números de processo no padrão CNJ.
// Extraído de ProcessosPage.tsx para reuso em ClientesPage e IntimacoesPage
// (criação automática de processo ao cadastrar cliente).

// ── Mapa completo de tribunais (igual ao HTML de referência) ──────────────────
const TRIBUNAIS_MAP: Record<number, Record<number, { nome: string; alias: string }>> = {
  1: { 0: { nome: "Supremo Tribunal Federal", alias: "api_publica_stf" } },
  2: { 0: { nome: "Conselho Nacional de Justiça", alias: "api_publica_cnj" } },
  3: { 0: { nome: "Superior Tribunal de Justiça", alias: "api_publica_stj" } },
  4: {
    1: { nome: "TRF 1ª Região", alias: "api_publica_trf1" },
    2: { nome: "TRF 2ª Região", alias: "api_publica_trf2" },
    3: { nome: "TRF 3ª Região", alias: "api_publica_trf3" },
    4: { nome: "TRF 4ª Região", alias: "api_publica_trf4" },
    5: { nome: "TRF 5ª Região", alias: "api_publica_trf5" },
    6: { nome: "TRF 6ª Região", alias: "api_publica_trf6" },
  },
  5: {
    0:  { nome: "Tribunal Superior do Trabalho", alias: "api_publica_tst" },
    1:  { nome: "TRT 1ª Região (RJ)", alias: "api_publica_trt1" },
    2:  { nome: "TRT 2ª Região (SP)", alias: "api_publica_trt2" },
    3:  { nome: "TRT 3ª Região (MG)", alias: "api_publica_trt3" },
    4:  { nome: "TRT 4ª Região (RS)", alias: "api_publica_trt4" },
    5:  { nome: "TRT 5ª Região (BA)", alias: "api_publica_trt5" },
    6:  { nome: "TRT 6ª Região (PE)", alias: "api_publica_trt6" },
    7:  { nome: "TRT 7ª Região (CE)", alias: "api_publica_trt7" },
    8:  { nome: "TRT 8ª Região (PA/AP)", alias: "api_publica_trt8" },
    9:  { nome: "TRT 9ª Região (PR)", alias: "api_publica_trt9" },
    10: { nome: "TRT 10ª Região (DF/TO)", alias: "api_publica_trt10" },
    11: { nome: "TRT 11ª Região (AM/RR)", alias: "api_publica_trt11" },
    12: { nome: "TRT 12ª Região (SC)", alias: "api_publica_trt12" },
    13: { nome: "TRT 13ª Região (PB)", alias: "api_publica_trt13" },
    14: { nome: "TRT 14ª Região (RO/AC)", alias: "api_publica_trt14" },
    15: { nome: "TRT 15ª Região (Campinas)", alias: "api_publica_trt15" },
    16: { nome: "TRT 16ª Região (MA)", alias: "api_publica_trt16" },
    17: { nome: "TRT 17ª Região (ES)", alias: "api_publica_trt17" },
    18: { nome: "TRT 18ª Região (GO)", alias: "api_publica_trt18" },
    19: { nome: "TRT 19ª Região (AL)", alias: "api_publica_trt19" },
    20: { nome: "TRT 20ª Região (SE)", alias: "api_publica_trt20" },
    21: { nome: "TRT 21ª Região (RN)", alias: "api_publica_trt21" },
    22: { nome: "TRT 22ª Região (PI)", alias: "api_publica_trt22" },
    23: { nome: "TRT 23ª Região (MT)", alias: "api_publica_trt23" },
    24: { nome: "TRT 24ª Região (MS)", alias: "api_publica_trt24" },
  },
  8: {
    1:  { nome: "TJAC", alias: "api_publica_tjac" },
    2:  { nome: "TJAL", alias: "api_publica_tjal" },
    3:  { nome: "TJAM", alias: "api_publica_tjam" },
    4:  { nome: "TJAP", alias: "api_publica_tjap" },
    5:  { nome: "TJBA", alias: "api_publica_tjba" },
    6:  { nome: "TJCE", alias: "api_publica_tjce" },
    7:  { nome: "TJDF", alias: "api_publica_tjdft" },
    8:  { nome: "TJES", alias: "api_publica_tjes" },
    9:  { nome: "TJGO", alias: "api_publica_tjgo" },
    10: { nome: "TJMA", alias: "api_publica_tjma" },
    11: { nome: "TJMT", alias: "api_publica_tjmt" },
    12: { nome: "TJMS", alias: "api_publica_tjms" },
    13: { nome: "TJMG", alias: "api_publica_tjmg" },
    14: { nome: "TJPA", alias: "api_publica_tjpa" },
    15: { nome: "TJPB", alias: "api_publica_tjpb" },
    16: { nome: "TJPE", alias: "api_publica_tjpe" },
    17: { nome: "TJPI", alias: "api_publica_tjpi" },
    18: { nome: "TJPR", alias: "api_publica_tjpr" },
    19: { nome: "TJRJ", alias: "api_publica_tjrj" },
    20: { nome: "TJRN", alias: "api_publica_tjrn" },
    21: { nome: "TJRO", alias: "api_publica_tjro" },
    22: { nome: "TJRR", alias: "api_publica_tjrr" },
    23: { nome: "TJRS", alias: "api_publica_tjrs" },
    24: { nome: "TJSC", alias: "api_publica_tjsc" },
    25: { nome: "TJSE", alias: "api_publica_tjse" },
    26: { nome: "TJSP", alias: "api_publica_tjsp" },
    27: { nome: "TJTO", alias: "api_publica_tjto" },
  },
};

export function detectarTribunalCNJ(numero: string): { nome: string; alias: string } | null {
  const limpo = numero.replace(/\D/g, "");
  if (limpo.length < 15) return null;
  const J  = parseInt(limpo[13], 10);
  const TR = parseInt(limpo.slice(14, 16), 10);
  return TRIBUNAIS_MAP[J]?.[TR] || TRIBUNAIS_MAP[J]?.[0] || null;
}

export function maskCNJ(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 20);
  if (d.length <= 7)  return d;
  if (d.length <= 9)  return `${d.slice(0,7)}-${d.slice(7)}`;
  if (d.length <= 13) return `${d.slice(0,7)}-${d.slice(7,9)}.${d.slice(9)}`;
  if (d.length <= 14) return `${d.slice(0,7)}-${d.slice(7,9)}.${d.slice(9,13)}.${d.slice(13)}`;
  if (d.length <= 16) return `${d.slice(0,7)}-${d.slice(7,9)}.${d.slice(9,13)}.${d.slice(13,14)}.${d.slice(14)}`;
  if (d.length <= 20) return `${d.slice(0,7)}-${d.slice(7,9)}.${d.slice(9,13)}.${d.slice(13,14)}.${d.slice(14,16)}.${d.slice(16)}`;
  return v;
}

// ── Status badges ──────────────────────────────────────────────────────────────
