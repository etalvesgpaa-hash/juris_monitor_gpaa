import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { pushTarefaParaGoogle, removerEventoDoGoogle } from "@/lib/googleCalendarApi";

export type Tarefa = Tables<"tarefas">;

export function useTarefas() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["tarefas", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas")
        .select(`
          *,
          processo:processos(
            id,
            numero_cnj,
            status,
            classe,
            assunto,
            cliente_id,
            cliente:clientes(id, nome)
          )
        `)
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return data as any[];
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
    onSuccess: async (tarefa) => {
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      // Sincroniza com o Google Agenda (se conectado) — não bloqueia a UI
      const googleEventId = await pushTarefaParaGoogle(tarefa);
      if (googleEventId) {
        await supabase.from("tarefas").update({ google_event_id: googleEventId }).eq("id", tarefa.id);
        qc.invalidateQueries({ queryKey: ["tarefas"] });
      }
    },
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
    onSuccess: async (tarefa) => {
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      if (tarefa) {
        const googleEventId = await pushTarefaParaGoogle(tarefa);
        if (googleEventId && googleEventId !== tarefa.google_event_id) {
          await supabase.from("tarefas").update({ google_event_id: googleEventId }).eq("id", tarefa.id);
          qc.invalidateQueries({ queryKey: ["tarefas"] });
        }
      }
    },
  });
}

export function useDeleteTarefa() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Busca o evento vinculado antes de apagar, pra também remover do Google
      const { data: tarefa } = await supabase.from("tarefas").select("google_event_id").eq("id", id).maybeSingle();
      const { error } = await supabase.from("tarefas").delete().eq("id", id);
      if (error) throw error;
      return tarefa?.google_event_id || null;
    },
    onSuccess: async (googleEventId) => {
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      await removerEventoDoGoogle(googleEventId);
    },
  });
}
