-- ROLLBACK da migration 20260820000000_add_email_config.sql
-- Use este script SOMENTE se quiser reverter completamente a alteração
-- no banco (remove as colunas de configuração de e-mail por usuário).
--
-- Rode manualmente no SQL Editor do Supabase, não é aplicado automaticamente.

ALTER TABLE public.api_keys
  DROP COLUMN IF EXISTS email_provider,
  DROP COLUMN IF EXISTS email_gmail_user,
  DROP COLUMN IF EXISTS email_gmail_app_password,
  DROP COLUMN IF EXISTS email_resend_api_key,
  DROP COLUMN IF EXISTS email_remetente_nome,
  DROP COLUMN IF EXISTS email_portal_url;
