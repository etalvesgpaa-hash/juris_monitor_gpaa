-- ========================================================================
-- UPGRADE FINANCEIRO
-- Consolida a tabela `financeiro` (usada hoje pelo front-end mas ausente
-- do schema versionado) e a evolui para:
--   1) Contas a pagar E a receber (não só recebíveis)
--   2) Vínculo real com clientes e processos já cadastrados (FK), mantendo
--      os campos de texto livre antigos como fallback/legado
--   3) Parcelamento (grupo de parcelas com numero/total)
--   4) Categorização e forma de pagamento, para relatórios gerenciais
-- Idempotente: pode ser aplicada tanto em bancos onde `financeiro` já
-- existe (ad-hoc) quanto em bancos novos.
-- ========================================================================

CREATE TABLE IF NOT EXISTS public.financeiro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_nome TEXT NOT NULL DEFAULT '',
  processo TEXT,
  tipo TEXT NOT NULL DEFAULT 'Honorários',
  descricao TEXT,
  valor NUMERIC NOT NULL DEFAULT 0,
  data_vencimento DATE NOT NULL DEFAULT CURRENT_DATE,
  data_recebimento DATE,
  status TEXT NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Novas colunas (contas a pagar/receber, vínculo real, parcelamento) ──

ALTER TABLE public.financeiro
  ADD COLUMN IF NOT EXISTS tipo_lancamento TEXT NOT NULL DEFAULT 'receita';

ALTER TABLE public.financeiro
  ADD COLUMN IF NOT EXISTS categoria TEXT;

ALTER TABLE public.financeiro
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;

ALTER TABLE public.financeiro
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL;

ALTER TABLE public.financeiro
  ADD COLUMN IF NOT EXISTS processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL;

ALTER TABLE public.financeiro
  ADD COLUMN IF NOT EXISTS grupo_parcelamento UUID;

ALTER TABLE public.financeiro
  ADD COLUMN IF NOT EXISTS parcela_numero INTEGER;

ALTER TABLE public.financeiro
  ADD COLUMN IF NOT EXISTS parcela_total INTEGER;

-- Garante que tipo_lancamento só assume os dois valores esperados
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'financeiro_tipo_lancamento_check'
  ) THEN
    ALTER TABLE public.financeiro
      ADD CONSTRAINT financeiro_tipo_lancamento_check
      CHECK (tipo_lancamento IN ('receita', 'despesa'));
  END IF;
END $$;

-- ── RLS ──────────────────────────────────────────────────────────────

ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own financeiro" ON public.financeiro;
CREATE POLICY "Users manage own financeiro" ON public.financeiro
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Índices ──────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_financeiro_user ON public.financeiro(user_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_cliente_id ON public.financeiro(cliente_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_processo_id ON public.financeiro(processo_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_status ON public.financeiro(status);
CREATE INDEX IF NOT EXISTS idx_financeiro_tipo_lancamento ON public.financeiro(tipo_lancamento);
CREATE INDEX IF NOT EXISTS idx_financeiro_vencimento ON public.financeiro(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_financeiro_grupo_parcelamento ON public.financeiro(grupo_parcelamento);

-- ── updated_at automático (reaproveita a função já usada no projeto) ──

DROP TRIGGER IF EXISTS update_financeiro_updated_at ON public.financeiro;
CREATE TRIGGER update_financeiro_updated_at
  BEFORE UPDATE ON public.financeiro
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
