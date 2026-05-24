import { useMemo } from "react";
import { useTarefas } from "./useTarefas";

export interface TarefaVencendo {
  id: string;
  titulo: string;
  prioridade: string;
  data_vencimento: string;
  venceHoje: boolean;
  venceAmanha: boolean;
  processo?: {
    numero_cnj: string;
    classe?: string;
  } | null;
}

export function useTarefasVencendo() {
  const { data: tarefas = [], isLoading } = useTarefas();

  const tarefasVencendo = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);

    const depoisDeAmanha = new Date(hoje);
    depoisDeAmanha.setDate(depoisDeAmanha.getDate() + 2);

    return tarefas
      .filter(t => {
        // Ignora tarefas já concluídas ou arquivadas
        if (t.status === "concluida" || t.status === "arquivada") return false;
        if (!t.data_vencimento) return false;

        const venc = new Date(t.data_vencimento);
        venc.setHours(0, 0, 0, 0);

        return venc >= hoje && venc < depoisDeAmanha;
      })
      .map(t => {
        const venc = new Date(t.data_vencimento!);
        venc.setHours(0, 0, 0, 0);
        const venceHoje   = venc.getTime() === hoje.getTime();
        const venceAmanha = venc.getTime() === amanha.getTime();
        return {
          id: t.id,
          titulo: t.titulo,
          prioridade: t.prioridade,
          data_vencimento: t.data_vencimento!,
          venceHoje,
          venceAmanha,
          processo: t.processo ?? null,
        } as TarefaVencendo;
      })
      // Hoje primeiro, depois amanhã; dentro de cada grupo por prioridade
      .sort((a, b) => {
        if (a.venceHoje && !b.venceHoje) return -1;
        if (!a.venceHoje && b.venceHoje)  return 1;
        const ordem: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
        return (ordem[a.prioridade] ?? 1) - (ordem[b.prioridade] ?? 1);
      });
  }, [tarefas]);

  return { tarefasVencendo, isLoading };
}
