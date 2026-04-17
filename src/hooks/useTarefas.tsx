import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Tarefa = Tables<"tarefas">;

export function useTarefas() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["tarefas", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas")
        .select("*")
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return data as Tarefa[];
    },
    enabled: !!user,
  });
}

export function useCreateTarefa() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: Omit<TablesInsert<"tarefas">, "user_id">) => {
      const { data, error } = await supabase
        .from("tarefas")
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tarefas"] }),
  });
}

export function useUpdateTarefa() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: TablesUpdate<"tarefas"> & { id: string }) => {
      const { data, error } = await supabase
        .from("tarefas")
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tarefas"] }),
  });
}

export function useDeleteTarefa() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tarefas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tarefas"] }),
  });
}
