import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface IntimacaoResumo {
  id: string;
  processo_id: string | null;
  numero_processo: string;
}

export function useIntimacoes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["intimacoes-resumo", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intimacoes")
        .select("id, processo_id, numero_processo")
        .not("numero_processo", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // deduplica por numero_processo, mantendo a que tem processo_id se houver
      const seen = new Map<string, IntimacaoResumo>();
      for (const row of (data ?? []) as IntimacaoResumo[]) {
        if (!row.numero_processo) continue;
        const existing = seen.get(row.numero_processo);
        // prefere a entrada que tem processo_id preenchido
        if (!existing || (!existing.processo_id && row.processo_id)) {
          seen.set(row.numero_processo, row);
        }
      }
      return Array.from(seen.values());
    },
    enabled: !!user,
  });
}
