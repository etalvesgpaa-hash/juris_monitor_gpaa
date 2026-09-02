-- Adiciona "Fase do Processo" (campo livre/dropdown de fase processual) e
-- guarda de forma denormalizada o título/descrição da última movimentação,
-- para exibir na listagem sem precisar de uma consulta extra por processo.
--
-- Os dois campos de "última movimentação" são mantidos em dia pela aplicação
-- (função recalcularUltimaMovimentacao em useProcessos.tsx) toda vez que uma
-- movimentação é adicionada ou removida.

ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS fase TEXT,
  ADD COLUMN IF NOT EXISTS ultima_movimentacao_titulo TEXT,
  ADD COLUMN IF NOT EXISTS ultima_movimentacao_descricao TEXT;

COMMENT ON COLUMN public.processos.fase IS 'Fase processual atual (ex: Conhecimento, Recursal, Execução) — informado manualmente pelo usuário';
COMMENT ON COLUMN public.processos.ultima_movimentacao_titulo IS 'Título/tipo da movimentação mais recente (denormalizado a partir de movimentacoes, mantido pela aplicação)';
COMMENT ON COLUMN public.processos.ultima_movimentacao_descricao IS 'Descrição da movimentação mais recente (denormalizado a partir de movimentacoes, mantido pela aplicação)';
