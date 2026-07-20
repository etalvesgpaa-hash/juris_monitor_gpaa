/**
 * useDelegacao.ts
 *
 * Hook para criação e gestão de tarefas delegadas pelo admin.
 *
 * - Admin cria tarefa com delegado_para = userId do destinatário
 * - Destinatário vê na TarefasPage com badge "Delegada por Admin"
 * - Admin vê todas na AdminPage com filtros
 * - Notificação in-app + e-mail ao destinatário
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface TarefaDelegada {
  id: string;
  titulo: string;
  descricao: string | null;
  numero_processo: string | null;
  status: string;
  prioridade: string;
  data_vencimento: string | null;
  processo_id: string | null;
  user_id: string;
  criado_por: string | null;
  delegado_para: string | null;
  lida_pelo_destinatario: boolean;
  created_at: string;
  // joins
  destinatario?: { id: string; full_name: string } | null;
  criador?: { id: string; full_name: string } | null;
  processo?: { numero_cnj: string } | null;
}

export interface DelegacaoInput {
  titulo: string;
  descricao?: string;
  numero_processo?: string;
  status: string;
  prioridade: string;
  data_vencimento?: string;
  processo_id?: string;
  delegado_para: string;   // userId do destinatário
}

// ── Admin: busca todas as tarefas delegadas ───────────────────────────────────

export function useAdminTarefasDelegadas() {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ["admin", "tarefas-delegadas"],
    queryFn: async () => {
      // Busca sem joins de FK para evitar erro 400 (FKs podem não estar registradas no PostgREST)
      const { data, error } = await supabase
        .from("tarefas")
        .select("*, processo:processos(numero_cnj)")
        .not("delegado_para", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const tarefas = data || [];

      // Busca profiles dos criadores e destinatários separadamente
      const allUserIds = [...new Set([
        ...tarefas.map((t: any) => t.criado_por),
        ...tarefas.map((t: any) => t.delegado_para),
      ].filter(Boolean))];

      let profiles: any[] = [];
      if (allUserIds.length > 0) {
        const { data: p } = await supabase
          .from("profiles")
          .select("id, user_id, full_name")
          .in("user_id", allUserIds);
        profiles = p || [];
      }

      return tarefas.map((t: any) => ({
        ...t,
        criador:      profiles.find(p => p.user_id === t.criado_por)      || null,
        destinatario: profiles.find(p => p.user_id === t.delegado_para)   || null,
      })) as TarefaDelegada[];
    },
    enabled: isAdmin,
  });
}

// ── Usuário: busca tarefas delegadas PARA ele ─────────────────────────────────

export function useTarefasDelegadasParaMim() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["tarefas-delegadas-para-mim", user?.id],
    queryFn: async () => {
      // Busca tarefas delegadas sem join de FK (criado_por pode não ter constraint registrada)
      const { data, error } = await supabase
        .from("tarefas")
        .select("*, processo:processos(numero_cnj)")
        .eq("delegado_para", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const tarefas = data || [];

      // Busca nomes dos criadores separadamente
      const criadorIds = [...new Set(tarefas.map((t: any) => t.criado_por).filter(Boolean))];
      let profiles: any[] = [];
      if (criadorIds.length > 0) {
        const { data: p } = await supabase
          .from("profiles")
          .select("id, full_name, user_id")
          .in("user_id", criadorIds);
        profiles = p || [];
      }

      return tarefas.map((t: any) => ({
        ...t,
        criador: profiles.find(p => p.user_id === t.criado_por) || null,
      })) as TarefaDelegada[];
    },
    enabled: !!user,
  });
}

// ── Contagem de tarefas delegadas não lidas (para badge) ─────────────────────

export function useTarefasDelegadasNaoLidas() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["tarefas-delegadas-nao-lidas", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("tarefas")
        .select("id", { count: "exact", head: true })
        .eq("delegado_para", user!.id)
        .eq("lida_pelo_destinatario", false);

      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 30_000, // atualiza a cada 30s
  });
}

// ── Admin: cria tarefa delegada ───────────────────────────────────────────────

export function useCrearTarefaDelegada() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: DelegacaoInput) => {
      // 1. Cria a tarefa no banco com user_id = destinatário e criado_por = admin
      // input.delegado_para = profiles.user_id = auth.users.id
      // A FK tarefas_user_id_fkey referencia auth.users.id
      // Então usamos diretamente
      console.log("[Delegacao] Inserindo — delegado_para:", input.delegado_para, "admin:", user!.id);

      const { data, error } = await supabase
        .from("tarefas")
        .insert({
          titulo:                  input.titulo,
          descricao:               input.descricao || null,
          numero_processo:         input.numero_processo || null,
          status:                  input.status,
          prioridade:              input.prioridade,
          data_vencimento:         input.data_vencimento || null,
          processo_id:             input.processo_id || null,
          user_id:                 input.delegado_para,
          criado_por:              user!.id,
          delegado_para:           input.delegado_para,
          lida_pelo_destinatario:  false,
        })
        .select("*")
        .single();

      if (error) {
        console.error("[Delegacao] Erro:", JSON.stringify(error));
        throw new Error(error.message);
      }

      return data;
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "tarefas-delegadas"] });
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      qc.invalidateQueries({ queryKey: ["tarefas-delegadas-para-mim"] });
      qc.invalidateQueries({ queryKey: ["tarefas-delegadas-nao-lidas"] });
      toast.success("Tarefa delegada com sucesso!");
    },

    onError: (err: any) => {
      toast.error("Erro ao delegar tarefa: " + err.message);
    },
  });
}

// ── Admin: atualiza tarefa delegada ──────────────────────────────────────────

export function useUpdateTarefaDelegada() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...fields }: Partial<TarefaDelegada> & { id: string }) => {
      const { data, error } = await supabase
        .from("tarefas")
        .update(fields)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "tarefas-delegadas"] });
      qc.invalidateQueries({ queryKey: ["tarefas"] });
    },
  });
}

// ── Admin: exclui tarefa delegada ─────────────────────────────────────────────

export function useDeleteTarefaDelegada() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tarefas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "tarefas-delegadas"] });
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      toast.success("Tarefa excluída.");
    },
  });
}

// ── Destinatário: marca tarefa como lida ──────────────────────────────────────

export function useMarcarTarefaLida() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tarefas")
        .update({ lida_pelo_destinatario: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tarefas-delegadas-nao-lidas"] });
      qc.invalidateQueries({ queryKey: ["tarefas"] });
    },
  });
}
