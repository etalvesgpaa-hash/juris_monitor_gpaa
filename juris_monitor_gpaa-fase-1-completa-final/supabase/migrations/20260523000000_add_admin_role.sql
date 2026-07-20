-- =====================================================
-- JurisMonitor — Migração: Suporte a Usuário Admin
-- Execute no SQL Editor do Supabase Dashboard
-- =====================================================

-- 1. Adicionar coluna is_admin na tabela profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- =====================================================
-- 2. POLICIES PARA ADMIN VER DADOS DE TODOS OS USUÁRIOS
-- =====================================================

-- PROFILES: admin pode ver todos os perfis
CREATE POLICY "Admin can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = TRUE
    )
  );

-- PROCESSOS: admin pode ver todos os processos (somente leitura)
CREATE POLICY "Admin can view all processos"
  ON public.processos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = TRUE
    )
  );

-- INTIMACOES: admin pode ver todas as intimações (somente leitura)
CREATE POLICY "Admin can view all intimacoes"
  ON public.intimacoes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = TRUE
    )
  );

-- CLIENTES: admin pode ver todos os clientes (somente leitura)
CREATE POLICY "Admin can view all clientes"
  ON public.clientes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = TRUE
    )
  );

-- TAREFAS: admin pode ver todas as tarefas (somente leitura)
CREATE POLICY "Admin can view all tarefas"
  ON public.tarefas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = TRUE
    )
  );

-- HONORARIOS: admin pode ver todos os honorários (somente leitura)
CREATE POLICY "Admin can view all honorarios"
  ON public.honorarios FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = TRUE
    )
  );

-- MOVIMENTACOES: admin pode ver todas as movimentações (somente leitura)
CREATE POLICY "Admin can view all movimentacoes"
  ON public.movimentacoes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = TRUE
    )
  );

-- =====================================================
-- 3. FUNÇÃO AUXILIAR: verificar se usuário é admin
-- (Opcional — útil para queries internas)
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND is_admin = TRUE
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- 4. COMO DEFINIR UM ADMIN
-- Execute o comando abaixo substituindo o email real:
-- =====================================================
-- UPDATE public.profiles
--   SET is_admin = TRUE
--   WHERE user_id = (
--     SELECT id FROM auth.users WHERE email = 'seu_email_admin@exemplo.com'
--   );
