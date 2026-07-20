import { useMemo } from "react";
import { useTarefas } from "./useTarefas";

export interface TarefaVencendo {
  id: string;
  titulo: string;
  prioridade: string;
  data_vencimento: string;
  venceHoje: boolean;
  venceAmanha: boolean;
  vencida: boolean; // venceu antes de hoje e não foi concluída
  processo?: {
    numero_cnj: string;
    classe?: string;
  } | null;
}

/** Extrai YYYY-MM-DD de qualquer string de data do Supabase,
 *  sem usar new Date() para evitar deslocamento de fuso (UTC → local).
 *  Ex: "2026-06-11T00:00:00+00:00" → "2026-06-11" */
function toLocalDateStr(iso: string): string {
  return iso.slice(0, 10);
}

function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
}

export function useTarefasVencendo() {
  const { data: tarefas = [], isLoading } = useTarefas();

  const tarefasVencendo = useMemo(() => {
    // Data de hoje no fuso local — YYYY-MM-DD
    const now    = new Date();
    const hoje   = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;

    const amanhaDt = new Date(now);
    amanhaDt.setDate(amanhaDt.getDate() + 1);
    const amanha = `${amanhaDt.getFullYear()}-${String(amanhaDt.getMonth()+1).padStart(2,"0")}-${String(amanhaDt.getDate()).padStart(2,"0")}`;

    return tarefas
      .filter(t => {
        // Ignora concluídas e arquivadas
        if (t.status === "concluida" || t.status === "arquivada") return false;
        if (!t.data_vencimento) return false;

        const venc = toLocalDateStr(t.data_vencimento).slice(0, 10);

        // Inclui: vencidas (antes de hoje), hoje e amanhã
        return venc <= amanha;
      })
      .map(t => {
        const venc     = toLocalDateStr(t.data_vencimento!).slice(0, 10);
        const venceHoje   = venc === hoje;
        const venceAmanha = venc === amanha;
        const vencida     = venc < hoje; // venceu antes de hoje

        return {
          id: t.id,
          titulo: t.titulo,
          prioridade: t.prioridade,
          data_vencimento: t.data_vencimento!,
          venceHoje,
          venceAmanha,
          vencida,
          processo: t.processo ?? null,
        } as TarefaVencendo;
      })
      // Ordem: vencidas primeiro, hoje, amanhã — dentro de cada grupo por prioridade
      .sort((a, b) => {
        const peso = (t: TarefaVencendo) => t.vencida ? 0 : t.venceHoje ? 1 : 2;
        if (peso(a) !== peso(b)) return peso(a) - peso(b);
        const ordem: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
        return (ordem[a.prioridade] ?? 1) - (ordem[b.prioridade] ?? 1);
      });
  }, [tarefas]);

  return { tarefasVencendo, isLoading };
}
