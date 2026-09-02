// Lista única de fases/status do processo judicial, usada tanto na tela de
// Clientes ("Status do Processo") quanto na tela de Processos ("Fase do
// Processo"). Centralizado aqui para as duas telas nunca ficarem divergentes.

export const FASE_PROCESSO_OPTIONS = [
  "Novo Caso",
  "Documentação Pendente",
  "Petição Inicial",
  "Protocolado",
  "Distribuído",
  "Citado",
  "Contestação",
  "Audiência Designada",
  "Audiência Realizada",
  "Produção de Provas",
  "Sentença",
  "Recurso",
  "Trânsito em Julgado",
  "Cumprimento de Sentença",
  "Arquivado",
] as const;

// Status "operacional" do processo (se está sendo monitorado/ativo no escritório).
// Independente da fase judicial acima — este é só o controle interno de
// acompanhamento do escritório.
export const STATUS_PROCESSO_OPTIONS = ["Ativo", "Pausado", "Inativo", "Finalizado"] as const;

// Cores fortes por fase do processo, agrupadas por etapa (inicial → final),
// sempre com texto preto em negrito para máximo contraste/leitura rápida.
// Usado tanto no Dashboard (chips clicáveis) quanto na tela de Processos
// (coluna Fase + painel de detalhes) — para nunca ficarem divergentes.
export const CORES_FASE: Record<string, string> = {
  // Etapa inicial
  "Novo Caso":               "bg-sky-400 text-black",
  "Documentação Pendente":   "bg-amber-400 text-black",
  "Petição Inicial":         "bg-indigo-400 text-black",
  // Protocolo/tramitação
  "Protocolado":             "bg-violet-400 text-black",
  "Distribuído":             "bg-purple-400 text-black",
  "Citado":                  "bg-fuchsia-400 text-black",
  "Contestação":             "bg-pink-400 text-black",
  // Instrução/audiências
  "Audiência Designada":     "bg-orange-400 text-black",
  "Audiência Realizada":     "bg-orange-500 text-black",
  "Produção de Provas":      "bg-yellow-400 text-black",
  // Decisão/recursos
  "Sentença":                "bg-red-400 text-black",
  "Recurso":                 "bg-rose-500 text-black",
  "Trânsito em Julgado":     "bg-emerald-400 text-black",
  // Final
  "Cumprimento de Sentença": "bg-teal-400 text-black",
  "Arquivado":               "bg-slate-400 text-black",
  _default:                  "bg-accent text-black",
};
