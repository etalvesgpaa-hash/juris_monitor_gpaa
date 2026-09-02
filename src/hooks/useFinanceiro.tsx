import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Lancamento = Tables<"financeiro">;
export type NovoLancamento = Omit<TablesInsert<"financeiro">, "user_id">;

export function useFinanceiro() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["financeiro", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro")
        .select("*")
        .order("data_vencimento", { ascending: false });
      if (error) throw error;
      return (data || []) as Lancamento[];
    },
    enabled: !!user,
  });
}

/** Cria um lançamento único, ou, se parcelaTotal > 1, gera N lançamentos
 *  mensais vinculados pelo mesmo grupo_parcelamento, com valor dividido. */
export function useCreateLancamento() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      lancamento,
      parcelaTotal = 1,
    }: {
      lancamento: NovoLancamento;
      parcelaTotal?: number;
    }) => {
      if (parcelaTotal <= 1) {
        const { error } = await supabase
          .from("financeiro")
          .insert({ ...lancamento, user_id: user!.id });
        if (error) throw error;
        return;
      }

      const grupoId = crypto.randomUUID();
      const valorTotal = Number(lancamento.valor) || 0;
      const valorParcela = Math.round((valorTotal / parcelaTotal) * 100) / 100;
      const baseVenc = new Date(`${lancamento.data_vencimento}T00:00:00`);

      const linhas = Array.from({ length: parcelaTotal }, (_, i) => {
        const venc = new Date(baseVenc);
        venc.setMonth(venc.getMonth() + i);
        // ajusta a última parcela para absorver eventual resto de arredondamento
        const isUltima = i === parcelaTotal - 1;
        const valor = isUltima
          ? Math.round((valorTotal - valorParcela * (parcelaTotal - 1)) * 100) / 100
          : valorParcela;
        return {
          ...lancamento,
          user_id: user!.id,
          valor,
          data_vencimento: venc.toISOString().slice(0, 10),
          grupo_parcelamento: grupoId,
          parcela_numero: i + 1,
          parcela_total: parcelaTotal,
          descricao: lancamento.descricao
            ? `${lancamento.descricao} (${i + 1}/${parcelaTotal})`
            : `Parcela ${i + 1}/${parcelaTotal}`,
        };
      });

      const { error } = await supabase.from("financeiro").insert(linhas);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financeiro"] }),
  });
}

export function useUpdateLancamento() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: TablesUpdate<"financeiro"> & { id: string }) => {
      const { error } = await supabase.from("financeiro").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financeiro"] }),
  });
}

export function useDeleteLancamento() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financeiro").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financeiro"] }),
  });
}

/** Exclui todas as parcelas de um mesmo grupo de parcelamento. */
export function useDeleteGrupoParcelamento() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (grupoId: string) => {
      const { error } = await supabase.from("financeiro").delete().eq("grupo_parcelamento", grupoId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financeiro"] }),
  });
}
