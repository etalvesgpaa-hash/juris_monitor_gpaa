import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { puxarMudancasDoGoogle } from "@/lib/googleCalendarApi";

/** Consulta se o usuário tem o Google Agenda conectado (e o e-mail da conta). */
export function useGoogleCalendarStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["google-calendar-status", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("google_calendar_tokens")
        .select("google_email, calendar_id, last_sync_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data || null;
    },
    enabled: !!user,
  });
}

/**
 * Roda em background enquanto o app está aberto: a cada intervalo (e quando a
 * aba ganha foco), busca eventos criados/editados/apagados direto no Google
 * Agenda e reflete isso nas tarefas locais.
 *
 * Mesmo esquema já usado para o envio automático de e-mail: só funciona com
 * o app aberto, sem depender de nenhum servidor/cron rodando 24h.
 */
export function useGoogleCalendarPull() {
  const { user } = useAuth();
  const { data: status } = useGoogleCalendarStatus();
  const qc = useQueryClient();
  const executando = useRef(false);

  const sincronizar = async () => {
    if (!user || !status || executando.current) return;
    executando.current = true;
    try {
      const eventos = await puxarMudancasDoGoogle();
      if (!eventos.length) return;

      const { data: tarefas } = await supabase
        .from("tarefas")
        .select("id, google_event_id")
        .eq("user_id", user.id);

      let houveMudanca = false;

      for (const ev of eventos) {
        const tarefaVinculada = (tarefas || []).find(t => t.google_event_id === ev.google_event_id);

        if (ev.status === "cancelled") {
          // Apagado direto no Google — não apagamos a tarefa automaticamente
          // (evita perda de dados por engano). Só desvincula, e ela volta a
          // criar um evento novo da próxima vez que for editada.
          if (tarefaVinculada) {
            await supabase.from("tarefas").update({ google_event_id: null }).eq("id", tarefaVinculada.id);
            houveMudanca = true;
          }
          continue;
        }

        if (tarefaVinculada) {
          // Evento já vinculado a uma tarefa nossa — atualiza os campos que
          // podem ter mudado direto no Google (título, data, descrição).
          await supabase
            .from("tarefas")
            .update({
              titulo: ev.titulo,
              data_vencimento: ev.data,
              descricao: ev.descricao,
              ...(ev.hora ? { hora_vencimento: ev.hora } : {}),
            } as any)
            .eq("id", tarefaVinculada.id);
          houveMudanca = true;
        } else if (ev.tarefa_id_vinculada) {
          // Tinha extendedProperty apontando pra uma tarefa que já não existe
          // mais aqui (foi apagada no app) — ignora, não recria.
          continue;
        } else {
          // Evento criado direto no Google Agenda, sem nenhuma origem no
          // JurisMonitor — vira uma tarefa nova.
          await supabase.from("tarefas").insert({
            user_id: user.id,
            titulo: ev.titulo,
            descricao: ev.descricao,
            data_vencimento: ev.data,
            ...(ev.hora ? { hora_vencimento: ev.hora } : {}),
            status: "triagem",
            prioridade: "media",
            google_event_id: ev.google_event_id,
          } as any);
          houveMudanca = true;
        }
      }

      if (houveMudanca) qc.invalidateQueries({ queryKey: ["tarefas"] });
    } catch (err) {
      console.warn("[useGoogleCalendarPull] erro ao sincronizar:", err);
    } finally {
      executando.current = false;
    }
  };

  useEffect(() => {
    if (!status) return;
    sincronizar(); // ao abrir o app / entrar na tela

    const aoFocar = () => sincronizar();
    window.addEventListener("focus", aoFocar);
    const intervalo = setInterval(sincronizar, 5 * 60 * 1000); // a cada 5 min, se o app ficar aberto

    return () => {
      window.removeEventListener("focus", aoFocar);
      clearInterval(intervalo);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.google_email]);
}
