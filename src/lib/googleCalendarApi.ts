import { supabase } from "@/integrations/supabase/client";

async function chamarSync(body: Record<string, unknown>) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null; // sem sessão, não tem como sincronizar

    const res = await fetch("/api/google-calendar-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      // Falha de sync não deve travar o fluxo principal (criar/editar tarefa
      // continua funcionando mesmo se o Google estiver indisponível/desconectado).
      console.warn("[googleCalendarApi] sync falhou:", data?.error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn("[googleCalendarApi] erro de rede:", err);
    return null;
  }
}

/** Envia (cria ou atualiza) o evento correspondente a uma tarefa no Google Agenda. */
export async function pushTarefaParaGoogle(tarefa: {
  id: string;
  titulo: string;
  descricao?: string | null;
  data_vencimento?: string | null;
  hora_vencimento?: string | null;
  numero_processo?: string | null;
  google_event_id?: string | null;
}) {
  const data = await chamarSync({ action: "push", tarefa });
  return data?.google_event_id as string | undefined;
}

/** Remove o evento correspondente a uma tarefa apagada. */
export async function removerEventoDoGoogle(googleEventId: string | null | undefined) {
  if (!googleEventId) return;
  await chamarSync({ action: "delete", google_event_id: googleEventId });
}

/** Busca mudanças feitas direto no Google Agenda (chamado só com o app aberto). */
export async function puxarMudancasDoGoogle(): Promise<
  { google_event_id: string; status: string; titulo: string; descricao: string | null; data: string | null; hora: string | null; tarefa_id_vinculada: string | null }[]
> {
  const data = await chamarSync({ action: "pull" });
  return data?.eventos || [];
}
