-- =====================================================
-- JurisMonitor — Script de criação de tabelas Supabase
-- Execute no SQL Editor do Supabase Dashboard
-- =====================================================

-- ========== PROFILES ==========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  escritorio TEXT,
  telefone TEXT,
  oab TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== CLIENTES ==========
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cpf_cnpj TEXT,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own clientes" ON public.clientes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_clientes_user ON public.clientes(user_id);

-- ========== PROCESSOS ==========
CREATE TABLE public.processos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero_cnj TEXT NOT NULL,
  classe TEXT,
  assunto TEXT,
  tribunal TEXT,
  vara TEXT,
  comarca TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  valor_causa NUMERIC,
  partes TEXT,
  advogados TEXT,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  resumo_ia TEXT,
  ultima_movimentacao TIMESTAMPTZ,
  dados_datajud JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own processos" ON public.processos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_processos_user ON public.processos(user_id);
CREATE INDEX idx_processos_numero ON public.processos(numero_cnj);
CREATE INDEX idx_processos_cliente ON public.processos(cliente_id);

-- ========== MOVIMENTACOES ==========
CREATE TABLE public.movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  data TIMESTAMPTZ NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  analise_ia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own movimentacoes" ON public.movimentacoes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_movimentacoes_processo ON public.movimentacoes(processo_id);

-- ========== TAREFAS ==========
CREATE TABLE public.tarefas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  prioridade TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'pendente',
  data_vencimento TIMESTAMPTZ,
  concluida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tarefas" ON public.tarefas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_tarefas_user ON public.tarefas(user_id);
CREATE INDEX idx_tarefas_processo ON public.tarefas(processo_id);

-- ========== INTIMACOES ==========
CREATE TABLE public.intimacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  numero_processo TEXT,
  origem TEXT NOT NULL DEFAULT 'aasp',
  tipo TEXT,
  conteudo TEXT,
  data_publicacao TIMESTAMPTZ,
  prazo TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'ativa',
  dados_raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.intimacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own intimacoes" ON public.intimacoes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_intimacoes_user ON public.intimacoes(user_id);
CREATE INDEX idx_intimacoes_processo ON public.intimacoes(processo_id);

-- ========== UPDATED_AT TRIGGER ==========
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_processos_updated_at BEFORE UPDATE ON public.processos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tarefas_updated_at BEFORE UPDATE ON public.tarefas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_intimacoes_updated_at BEFORE UPDATE ON public.intimacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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
CREATE POLICY "Users manage own honorarios" ON public.honorarios FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_honorarios_user ON public.honorarios(user_id);
CREATE INDEX idx_honorarios_cliente ON public.honorarios(cliente_id);
CREATE INDEX idx_honorarios_processo ON public.honorarios(processo_id);
CREATE INDEX idx_honorarios_status ON public.honorarios(status);

CREATE TRIGGER update_honorarios_updated_at BEFORE UPDATE ON public.honorarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

