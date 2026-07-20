-- Migration: Fix api_keys table structure
-- Date: 2026-04-17
-- Description: Create or update api_keys table with proper ID column and constraints

-- Drop existing table if exists (careful in production!)
-- DROP TABLE IF EXISTS api_keys CASCADE;

-- Create api_keys table with proper structure
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  datajud_token TEXT,
  aasp_chave TEXT,
  groq_api_key TEXT,
  whatsapp_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys(user_id);

-- Enable RLS (Row Level Security)
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: Users can only access their own API keys
CREATE POLICY IF NOT EXISTS "Users can only access their own api_keys"
  ON api_keys
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_api_keys_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS api_keys_update_timestamp ON api_keys;

CREATE TRIGGER api_keys_update_timestamp
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_api_keys_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON api_keys TO authenticated;

COMMENT ON TABLE api_keys IS 'Armazena chaves de API dos usuários de forma segura';
COMMENT ON COLUMN api_keys.id IS 'ID único da chave de API';
COMMENT ON COLUMN api_keys.user_id IS 'ID do usuário proprietário (único)';
COMMENT ON COLUMN api_keys.datajud_token IS 'Token de acesso DataJud CNJ';
COMMENT ON COLUMN api_keys.aasp_chave IS 'Chave de acesso AASP';
COMMENT ON COLUMN api_keys.groq_api_key IS 'Chave de API Groq';
COMMENT ON COLUMN api_keys.whatsapp_token IS 'Token WhatsApp Business';
