-- ========== HONORARIOS ==========
CREATE TABLE public.honorarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'fixo',
  status TEXT NOT NULL DEFAULT 'pendente',
  data_vencimento TIMESTAMPTZ,
  data_pagamento TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.honorarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own honorarios" ON public.honorarios 
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_honorarios_user ON public.honorarios(user_id);
CREATE INDEX idx_honorarios_cliente ON public.honorarios(cliente_id);
CREATE INDEX idx_honorarios_processo ON public.honorarios(processo_id);
CREATE INDEX idx_honorarios_status ON public.honorarios(status);

CREATE TRIGGER update_honorarios_updated_at 
  BEFORE UPDATE ON public.honorarios 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
