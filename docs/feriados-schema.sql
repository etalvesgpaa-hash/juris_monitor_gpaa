-- ========== FERIADOS ==========
-- Tabela para armazenar feriados e suspensões de prazo
CREATE TABLE public.feriados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  descricao TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'feriado', -- 'feriado', 'suspensao', 'recesso'
  abrangencia TEXT NOT NULL DEFAULT 'local', -- 'nacional', 'estadual', 'municipal', 'local'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own feriados" 
  ON public.feriados 
  FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_feriados_user ON public.feriados(user_id);
CREATE INDEX idx_feriados_data ON public.feriados(data);

CREATE TRIGGER update_feriados_updated_at 
  BEFORE UPDATE ON public.feriados 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir feriados nacionais de 2025 e 2026
INSERT INTO public.feriados (user_id, data, descricao, tipo, abrangencia)
SELECT 
  auth.uid(),
  data::DATE,
  descricao,
  'feriado',
  'nacional'
FROM (VALUES
  -- 2025
  ('2025-01-01', 'Confraternização Universal'),
  ('2025-03-04', 'Carnaval'),
  ('2025-04-18', 'Paixão de Cristo'),
  ('2025-04-21', 'Tiradentes'),
  ('2025-05-01', 'Dia do Trabalho'),
  ('2025-06-19', 'Corpus Christi'),
  ('2025-09-07', 'Independência do Brasil'),
  ('2025-10-12', 'Nossa Senhora Aparecida'),
  ('2025-11-02', 'Finados'),
  ('2025-11-15', 'Proclamação da República'),
  ('2025-11-20', 'Consciência Negra'),
  ('2025-12-25', 'Natal'),
  -- 2026
  ('2026-01-01', 'Confraternização Universal'),
  ('2026-02-17', 'Carnaval'),
  ('2026-04-03', 'Paixão de Cristo'),
  ('2026-04-21', 'Tiradentes'),
  ('2026-05-01', 'Dia do Trabalho'),
  ('2026-06-04', 'Corpus Christi'),
  ('2026-09-07', 'Independência do Brasil'),
  ('2026-10-12', 'Nossa Senhora Aparecida'),
  ('2026-11-02', 'Finados'),
  ('2026-11-15', 'Proclamação da República'),
  ('2026-11-20', 'Consciência Negra'),
  ('2026-12-25', 'Natal')
) AS t(data, descricao)
WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid());
