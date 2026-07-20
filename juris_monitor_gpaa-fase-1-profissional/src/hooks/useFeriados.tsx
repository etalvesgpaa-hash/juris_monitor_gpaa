import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Feriado {
  id: string;
  user_id: string;
  data: string;
  descricao: string;
  tipo: "feriado" | "suspensao" | "recesso";
  abrangencia: "nacional" | "estadual" | "municipal" | "local";
  created_at: string;
  updated_at: string;
}

export function useFeriados() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["feriados", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feriados")
        .select("*")
        .order("data", { ascending: true });
      if (error) throw error;
      return data as Feriado[];
    },
    enabled: !!user,
  });
}

export function useCreateFeriado() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: Omit<Feriado, "id" | "user_id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("feriados")
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feriados"] }),
  });
}

export function useUpdateFeriado() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<Feriado> & { id: string }) => {
      const { data, error } = await supabase
        .from("feriados")
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feriados"] }),
  });
}

export function useDeleteFeriado() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("feriados").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feriados"] }),
  });
}

/**
 * Calcula dias úteis considerando feriados
 */
export function calcularDiasUteis(dataInicio: Date, diasUteis: number, feriados: Feriado[]): Date {
  const dataFinal = new Date(dataInicio);
  const feriadosSet = new Set(feriados.map(f => f.data));
  
  let diasContados = 0;
  
  while (diasContados < diasUteis) {
    dataFinal.setDate(dataFinal.getDate() + 1);
    
    const diaSemana = dataFinal.getDay();
    const dataStr = dataFinal.toISOString().split('T')[0];
    
    // Conta apenas se não for fim de semana e não for feriado
    if (diaSemana !== 0 && diaSemana !== 6 && !feriadosSet.has(dataStr)) {
      diasContados++;
    }
  }
  
  return dataFinal;
}

/**
 * Conta quantos dias úteis existem entre duas datas
 */
export function contarDiasUteis(dataInicio: Date, dataFim: Date, feriados: Feriado[]): number {
  const feriadosSet = new Set(feriados.map(f => f.data));
  let contador = 0;
  const atual = new Date(dataInicio);
  
  while (atual <= dataFim) {
    const diaSemana = atual.getDay();
    const dataStr = atual.toISOString().split('T')[0];
    
    if (diaSemana !== 0 && diaSemana !== 6 && !feriadosSet.has(dataStr)) {
      contador++;
    }
    
    atual.setDate(atual.getDate() + 1);
  }
  
  return contador;
}
