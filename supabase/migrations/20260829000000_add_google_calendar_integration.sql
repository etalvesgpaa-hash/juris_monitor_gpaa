-- Integração com Google Agenda: cada usuário conecta a própria conta Google.
-- Os tokens ficam guardados por usuário (RLS: só o dono lê/escreve a própria linha).

CREATE TABLE IF NOT EXISTS public.google_calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  google_email TEXT,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own google_calendar_tokens"
  ON public.google_calendar_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.google_calendar_tokens IS 'Tokens OAuth do Google Calendar, um por usuário (conexão pessoal, não compartilhada).';
COMMENT ON COLUMN public.google_calendar_tokens.calendar_id IS 'Qual agenda do Google usar (primary = agenda principal do usuário)';
COMMENT ON COLUMN public.google_calendar_tokens.last_sync_at IS 'Última vez que buscamos mudanças vindas do Google (sync incremental)';

-- Vínculo tarefa <-> evento do Google, para saber qual editar/apagar depois
-- e evitar duplicar eventos.
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS google_event_id TEXT;

COMMENT ON COLUMN public.tarefas.google_event_id IS 'ID do evento correspondente no Google Calendar (preenchido após o primeiro sync)';
