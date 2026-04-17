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
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["processos"] }),
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
