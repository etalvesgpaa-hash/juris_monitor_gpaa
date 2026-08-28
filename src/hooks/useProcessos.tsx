import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Processo = Tables<"processos">;

export function useProcessos() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["processos", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Processo[];
    },
    enabled: !!user,
  });

  return query;
}

export function useProcesso(id: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["processo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Processo;
    },
    enabled: !!user && !!id,
  });
}

export function useMovimentacoes(processoId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["movimentacoes", processoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*")
        .eq("processo_id", processoId!)
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!processoId,
  });
}

/** Recalcula processos.ultima_movimentacao(_titulo/_descricao) a partir da movimentação mais recente. */
async function recalcularUltimaMovimentacao(processoId: string) {
  const { data: ultima } = await supabase
    .from("movimentacoes")
    .select("data, titulo, descricao")
    .eq("processo_id", processoId)
    .order("data", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase
    .from("processos")
    .update({
      ultima_movimentacao: ultima?.data || null,
      ultima_movimentacao_titulo: ultima?.titulo || null,
      ultima_movimentacao_descricao: ultima?.descricao || null,
    })
    .eq("id", processoId);
}

export function useCreateMovimentacao() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: { processo_id: string; titulo: string; descricao?: string | null; data: string }) => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      // Mantém a coluna "Última Mov." da lista de processos sempre em dia
      await recalcularUltimaMovimentacao(input.processo_id);
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["movimentacoes", vars.processo_id] });
      qc.invalidateQueries({ queryKey: ["processos"] });
    },
  });
}

export function useDeleteMovimentacao() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, processo_id }: { id: string; processo_id: string }) => {
      const { error } = await supabase.from("movimentacoes").delete().eq("id", id);
      if (error) throw error;
      // Recalcula "Última Mov." caso a movimentação removida fosse a mais recente
      await recalcularUltimaMovimentacao(processo_id);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["movimentacoes", vars.processo_id] });
      qc.invalidateQueries({ queryKey: ["processos"] });
    },
  });
}

/**
 * Cria um processo vinculado a um cliente, ou — se já existir um processo com
 * esse número CNJ — apenas vincula o cliente a ele (evita duplicar).
 * Usado na integração Clientes ⇄ Processos (cadastro conjunto).
 */
export function useCriarOuVincularProcesso() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      cliente_id: string;
      numero_cnj: string;
      tribunal?: string | null;
      partes?: string | null;
      assunto?: string | null;
      vara?: string | null;
    }) => {
      // Já existe um processo com esse número? Só vincula ao cliente.
      const { data: existente } = await supabase
        .from("processos")
        .select("id, cliente_id, partes, assunto, vara")
        .eq("numero_cnj", input.numero_cnj)
        .eq("user_id", user!.id)
        .maybeSingle();

      if (existente) {
        const { error } = await supabase
          .from("processos")
          .update({
            cliente_id: input.cliente_id,
            // Só preenche o que ainda estiver vazio — não sobrescreve dado já existente
            partes:  existente.partes  || input.partes  || null,
            assunto: existente.assunto || input.assunto || null,
            vara:    existente.vara    || input.vara    || null,
          })
          .eq("id", existente.id);
        if (error) throw error;
        return existente.id;
      }

      const { data: criado, error } = await supabase
        .from("processos")
        .insert({
          numero_cnj: input.numero_cnj,
          tribunal: input.tribunal || null,
          status: "ativo",
          cliente_id: input.cliente_id,
          partes: input.partes || null,
          assunto: input.assunto || null,
          vara: input.vara || null,
          user_id: user!.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      return criado.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["processos"] });
    },
  });
}

export function useCreateProcesso() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: Omit<TablesInsert<"processos">, "user_id">) => {
      const { data, error } = await supabase
        .from("processos")
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["processos"] }),
  });
}

export function useUpdateProcesso() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: TablesUpdate<"processos"> & { id: string }) => {
      const { data, error } = await supabase
        .from("processos")
        .update(input as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["processos"] });
      qc.invalidateQueries({ queryKey: ["processo", vars.id] });
      qc.invalidateQueries({ queryKey: ["movimentacoes"] });
    },
  });
}

export function useDeleteProcesso() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("processos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["processos"] }),
  });
}
