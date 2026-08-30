import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGoogleCalendarStatus } from "@/hooks/useGoogleCalendarSync";
import { CalendarDays, CheckCircle, Loader2, Unlink } from "lucide-react";

export function GoogleAgendaTab() {
  const { user } = useAuth();
  const { data: status, isLoading } = useGoogleCalendarStatus();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Trata o retorno do OAuth (?google_calendar=conectado|erro&msg=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resultado = params.get("google_calendar");
    if (!resultado) return;

    if (resultado === "conectado") {
      toast({ title: "✅ Google Agenda conectado com sucesso!" });
      qc.invalidateQueries({ queryKey: ["google-calendar-status"] });
    } else if (resultado === "erro") {
      toast({ title: "Erro ao conectar Google Agenda", description: params.get("msg") || undefined, variant: "destructive" });
    }
    // Limpa a URL pra não mostrar o toast de novo se a pessoa recarregar
    const url = new URL(window.location.href);
    url.searchParams.delete("google_calendar");
    url.searchParams.delete("msg");
    window.history.replaceState({}, "", url.toString());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const conectar = async () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      toast({
        title: "Integração ainda não configurada",
        description: "Falta configurar VITE_GOOGLE_CLIENT_ID na Vercel. Fale com quem administra o sistema.",
        variant: "destructive",
      });
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({ title: "Sessão expirada", description: "Faça login novamente.", variant: "destructive" });
      return;
    }

    const redirectUri = `${window.location.origin}/api/google-calendar-callback`;
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/calendar");
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent"); // garante que o Google sempre devolve refresh_token
    authUrl.searchParams.set("state", session.access_token);

    window.location.href = authUrl.toString();
  };

  const desconectar = async () => {
    if (!user) return;
    const { error } = await supabase.from("google_calendar_tokens").delete().eq("user_id", user.id);
    if (error) {
      toast({ title: "Erro ao desconectar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Google Agenda desconectado." });
    qc.invalidateQueries({ queryKey: ["google-calendar-status"] });
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
      <h2 className="font-display text-xl font-bold mb-1 flex items-center gap-2">
        <CalendarDays className="h-6 w-6" />
        Google Agenda
      </h2>
      <p className="text-sm text-muted-foreground mb-5">
        Conecte sua conta Google para sincronizar automaticamente os prazos e tarefas com sua agenda —
        nos dois sentidos: o que você cria aqui aparece lá, e o que você mexe lá volta pra cá (enquanto o
        JurisMonitor estiver aberto no navegador).
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : status ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-green-ok/5 border border-green-ok/20 rounded-xl p-4">
            <CheckCircle className="h-5 w-5 text-green-ok shrink-0" />
            <div>
              <div className="text-sm font-bold">Conectado</div>
              <div className="text-xs text-muted-foreground">{status.google_email || "Conta Google vinculada"}</div>
              {status.last_sync_at && (
                <div className="text-[0.68rem] text-muted-foreground mt-0.5">
                  Última sincronização: {new Date(status.last_sync_at).toLocaleString("pt-BR")}
                </div>
              )}
            </div>
          </div>
          <Button variant="outline" onClick={desconectar} className="text-red-alert border-red-alert/30 hover:bg-red-alert/10">
            <Unlink className="h-4 w-4 mr-2" />
            Desconectar Google Agenda
          </Button>
        </div>
      ) : (
        <Button variant="gold" onClick={conectar}>
          <CalendarDays className="h-4 w-4 mr-2" />
          Conectar com Google
        </Button>
      )}
    </div>
  );
}
