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
