import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/** Busca todos os perfis (admin only — RLS garante isso no banco) */
export function useAdminProfiles() {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ["admin", "profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });
}

/** Busca todos os processos de todos os usuários (admin only) */
export function useAdminProcessos() {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ["admin", "processos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });
}

/** Busca todas as intimações de todos os usuários (admin only) */
export function useAdminIntimacoes() {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ["admin", "intimacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intimacoes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });
}

/** Busca todos os clientes de todos os usuários (admin only) */
export function useAdminClientes() {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ["admin", "clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });
}

/** Busca todas as tarefas de todos os usuários (admin only) */
export function useAdminTarefas() {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ["admin", "tarefas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });
}
