-- Migration: Add per-user email sending configuration
-- Date: 2026-08-20
-- Description: Allows each user to configure their own Gmail/Resend
-- credentials for automatic email notifications, directly through the
-- app UI, instead of relying on Vercel environment variables.

ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS email_provider TEXT
    CHECK (email_provider IS NULL OR email_provider IN ('gmail', 'resend')),
  ADD COLUMN IF NOT EXISTS email_gmail_user TEXT,
  ADD COLUMN IF NOT EXISTS email_gmail_app_password TEXT,
  ADD COLUMN IF NOT EXISTS email_resend_api_key TEXT,
  ADD COLUMN IF NOT EXISTS email_remetente_nome TEXT,
  ADD COLUMN IF NOT EXISTS email_portal_url TEXT;

-- Importante: email_provider fica NULL por padrão (sem DEFAULT 'gmail').
-- Isso é proposital: usuários que já têm uma linha em api_keys (para
-- DataJud/AASP/Groq/WhatsApp) e hoje enviam e-mail via Resend configurado
-- só na Vercel não podem ser "migrados" silenciosamente para Gmail.
-- Enquanto o usuário não salvar nada na aba E-mail, o backend continua
-- usando 100% as variáveis de ambiente da Vercel (comportamento antigo).

COMMENT ON COLUMN public.api_keys.email_provider IS 'Provedor usado para envio automatico: gmail ou resend';
COMMENT ON COLUMN public.api_keys.email_gmail_user IS 'E-mail do Gmail usado para enviar notificacoes (SMTP)';
COMMENT ON COLUMN public.api_keys.email_gmail_app_password IS 'Senha de app do Gmail (16 caracteres) - nunca exibida de volta ao navegador apos salva';
COMMENT ON COLUMN public.api_keys.email_resend_api_key IS 'API Key do Resend (alternativa ao Gmail)';
COMMENT ON COLUMN public.api_keys.email_remetente_nome IS 'Nome exibido como remetente nos e-mails (ex: nome do escritorio)';
COMMENT ON COLUMN public.api_keys.email_portal_url IS 'URL do portal do cliente, usada nos links dos e-mails';
