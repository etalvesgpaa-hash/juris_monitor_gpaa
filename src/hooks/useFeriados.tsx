import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type Feriado = {
  id: string;
  data: string;
  descricao: string;
  tipo: 'nacional' | 'personalizado';
  user_id: string;
};

/**
 * Hook para buscar feriados do usuário
 */
export function useFeriados() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["feriados", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Usuário não autenticado");
      
      const { data, error } = await supabase
        .from("feriados")
        .select("*")
        .eq("user_id", user.id)
        .order("data", { ascending: true });
      
      if (error) throw error;
      return data as Feriado[];
    },
    enabled: !!user,
  });
}

/**
 * Hook para criar um novo feriado
 */
export function useCreateFeriado() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: Omit<Feriado, 'id' | 'user_id'>) => {
      if (!user) throw new Error("Usuário não autenticado");
      
      const { data, error } = await supabase
        .from("feriados")
        .insert({
          ...input,
          user_id: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as Feriado;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feriados"] });
    },
  });
}

/**
 * Hook para deletar um feriado
 */
export function useDeleteFeriado() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("feriados")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feriados"] });
    },
  });
}

/**
 * Retorna feriados nacionais brasileiros (2024-2025)
 */
export function getFeriadosNacionais() {
  return [
    { data: "2024-01-01", descricao: "Ano Novo" },
    { data: "2024-02-13", descricao: "Carnaval" },
    { data: "2024-03-29", descricao: "Sexta-feira Santa" },
    { data: "2024-04-21", descricao: "Tiradentes" },
    { data: "2024-05-01", descricao: "Dia do Trabalho" },
    { data: "2024-09-07", descricao: "Independência" },
    { data: "2024-10-12", descricao: "Nossa Senhora Aparecida" },
    { data: "2024-11-02", descricao: "Finados" },
    { data: "2024-11-20", descricao: "Consciência Negra" },
    { data: "2024-12-25", descricao: "Natal" },
    { data: "2025-01-01", descricao: "Ano Novo" },
    { data: "2025-03-04", descricao: "Carnaval" },
    { data: "2025-04-18", descricao: "Sexta-feira Santa" },
    { data: "2025-04-21", descricao: "Tiradentes" },
    { data: "2025-05-01", descricao: "Dia do Trabalho" },
    { data: "2025-09-07", descricao: "Independência" },
    { data: "2025-10-12", descricao: "Nossa Senhora Aparecida" },
    { data: "2025-11-02", descricao: "Finados" },
    { data: "2025-11-20", descricao: "Consciência Negra" },
    { data: "2025-12-25", descricao: "Natal" },
  ];
}

/**
 * Calcula dias úteis entre duas datas, excluindo fins de semana e feriados
 * @param dataInicio - Data inicial
 * @param dataFim - Data final
 * @param feriadosDatas - Array de datas em formato YYYY-MM-DD
 * @returns Número de dias úteis
 */
export function contarDiasUteis(
  dataInicio: Date,
  dataFim: Date,
  feriadosDatas: string[]
): number {
  let contador = 0;
  const feriadosSet = new Set(feriadosDatas);
  const datAtual = new Date(dataInicio);

  while (datAtual < dataFim) {
    const dow = datAtual.getDay();
    const dataStr = datAtual.toISOString().split("T")[0];

    // Contar se não for fim de semana (0=domingo, 6=sábado) e não for feriado
    if (dow !== 0 && dow !== 6 && !feriadosSet.has(dataStr)) {
      contador++;
    }

    datAtual.setDate(datAtual.getDate() + 1);
  }

  return contador;
}
