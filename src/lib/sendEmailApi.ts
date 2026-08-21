import { supabase } from "@/integrations/supabase/client";

export interface EnviarEmailPayload {
  to_email?: string;
  titulo?: string;
  resumo?: string;
  portal_url?: string;
  destinatario?: string;
  nomeCliente?: string;
  numeroProcesso?: string;
  dataPublicacao?: string;
  assunto?: string;
  resumoIA?: string | null;
  textoCompleto?: string;
  nomeAdvogado?: string;
}

/**
 * Chama /api/send-email anexando o token da sessão atual, para que a
 * function serverless consiga buscar a configuração de e-mail (Gmail/Resend)
 * salva pelo próprio usuário em Configurações > E-mail — sem depender de
 * variáveis de ambiente na Vercel.
 */
export async function enviarEmailNotificacao(payload: EnviarEmailPayload) {
  const { data: { session } } = await supabase.auth.getSession();

  const res = await fetch("/api/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // resposta sem corpo JSON
  }

  return { ok: res.ok, status: res.status, data };
}
