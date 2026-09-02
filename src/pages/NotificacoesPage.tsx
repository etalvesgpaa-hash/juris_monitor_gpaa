import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertCircle, Clock, CheckCircle, Calendar, DollarSign } from "lucide-react";
import { format, differenceInDays, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
;
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Parseia YYYY-MM-DD como data local (evita deslocamento UTC no Brasil) */
function parseDateLocal(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}


interface Notificacao {
  id: string;
  tipo: "prazo" | "intimacao" | "tarefa" | "honorario" | "movimentacao";
  titulo: string;
  descricao: string;
  data: string;
  prioridade: "baixa" | "media" | "alta" | "urgente";
  lida: boolean;
  link?: string;
  metadata?: any;
}

export function NotificacoesPage() {
  const { user } = useAuth();

  // Buscar tarefas com prazos próximos
  const { data: tarefas = [] } = useQuery({
    queryKey: ["tarefas", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas")
        .select("*")
        .neq("status", "concluida")
        .not("data_vencimento", "is", null)
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Buscar intimações ativas
  const { data: intimacoes = [] } = useQuery({
    queryKey: ["intimacoes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intimacoes")
        .select("*")
        .eq("status", "ativa")
        .not("prazo", "is", null)
        .order("prazo", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Buscar honorários pendentes
  const { data: honorarios = [] } = useQuery({
    queryKey: ["honorarios", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("honorarios")
        .select(`
          *,
          clientes(nome)
        `)
        .eq("status", "pendente")
        .not("data_vencimento", "is", null)
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Processar notificações
  const notificacoes: Notificacao[] = [];

  // Notificações de Tarefas
  tarefas.forEach((tarefa) => {
    if (!tarefa.data_vencimento) return;
    const dias = differenceInDays(parseDateLocal(tarefa.data_vencimento), new Date());
    
    let prioridade: Notificacao["prioridade"] = "baixa";
    if (dias < 0) prioridade = "urgente";
    else if (dias === 0) prioridade = "urgente";
    else if (dias === 1) prioridade = "alta";
    else if (dias <= 3) prioridade = "media";

    if (dias <= 7 || dias < 0) {
      notificacoes.push({
        id: `tarefa-${tarefa.id}`,
        tipo: "tarefa",
        titulo: dias < 0 ? "Tarefa Vencida" : "Tarefa Próxima do Vencimento",
        descricao: tarefa.titulo,
        data: tarefa.data_vencimento,
        prioridade,
        lida: false,
        metadata: { dias },
      });
    }
  });

  // Notificações de Intimações
  intimacoes.forEach((intimacao) => {
    if (!intimacao.prazo) return;
    const dias = differenceInDays(parseDateLocal(intimacao.prazo), new Date());
    
    let prioridade: Notificacao["prioridade"] = "baixa";
    if (dias < 0) prioridade = "urgente";
    else if (dias <= 3) prioridade = "urgente";
    else if (dias <= 7) prioridade = "alta";
    else if (dias <= 15) prioridade = "media";

    if (dias <= 15 || dias < 0) {
      notificacoes.push({
        id: `intimacao-${intimacao.id}`,
        tipo: "intimacao",
        titulo: dias < 0 ? "Intimação Vencida" : "Intimação com Prazo Próximo",
        descricao: `${intimacao.tipo || "Intimação"} - ${intimacao.numero_processo || "Sem nº"}`,
        data: intimacao.prazo,
        prioridade,
        lida: false,
        metadata: { dias },
      });
    }
  });

  // Notificações de Honorários
  honorarios.forEach((honorario) => {
    if (!honorario.data_vencimento) return;
    const dias = differenceInDays(parseDateLocal(honorario.data_vencimento), new Date());
    
    let prioridade: Notificacao["prioridade"] = "baixa";
    if (dias < 0) prioridade = "alta";
    else if (dias <= 3) prioridade = "media";
    else if (dias <= 7) prioridade = "media";

    if (dias <= 7 || dias < 0) {
      notificacoes.push({
        id: `honorario-${honorario.id}`,
        tipo: "honorario",
        titulo: dias < 0 ? "Honorário Vencido" : "Honorário a Receber",
        descricao: honorario.descricao,
        data: honorario.data_vencimento,
        prioridade,
        lida: false,
        metadata: { 
          dias,
          valor: honorario.valor,
          cliente: honorario.clientes?.nome 
        },
      });
    }
  });

  // Ordenar por prioridade e data
  const prioridadeOrdem = { urgente: 0, alta: 1, media: 2, baixa: 3 };
  notificacoes.sort((a, b) => {
    const prioDiff = prioridadeOrdem[a.prioridade] - prioridadeOrdem[b.prioridade];
    if (prioDiff !== 0) return prioDiff;
    return parseDateLocal(a.data).getTime() - parseDateLocal(b.data).getTime();
  });

  // Filtrar por tipo
  const urgentes = notificacoes.filter((n) => n.prioridade === "urgente");
  const hoje = notificacoes.filter((n) => isToday(parseDateLocal(n.data)));
  const proximos7Dias = notificacoes.filter((n) => {
    const dias = differenceInDays(parseDateLocal(n.data), new Date());
    return dias >= 0 && dias <= 7;
  });

  // Componente de ícone por tipo
  const getIcon = (tipo: Notificacao["tipo"]) => {
    switch (tipo) {
      case "tarefa":
        return <CheckCircle className="h-5 w-5" />;
      case "intimacao":
        return <Bell className="h-5 w-5" />;
      case "prazo":
        return <Clock className="h-5 w-5" />;
      case "honorario":
        return <DollarSign className="h-5 w-5" />;
      case "movimentacao":
        return <AlertCircle className="h-5 w-5" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  // Componente de badge de prioridade
  const getPrioridadeBadge = (prioridade: Notificacao["prioridade"]) => {
    switch (prioridade) {
      case "urgente":
        return <Badge className="bg-red-alert/10 text-red-alert">Urgente</Badge>;
      case "alta":
        return <Badge className="bg-orange-500/10 text-orange-600">Alta</Badge>;
      case "media":
        return <Badge className="bg-yellow-500/10 text-yellow-600">Média</Badge>;
      case "baixa":
        return <Badge variant="outline">Baixa</Badge>;
    }
  };

  // Componente de data amigável
  const getDataAmigavel = (data: string, dias?: number) => {
    const dataObj = parseDateLocal(data);
    
    if (dias !== undefined) {
      if (dias < 0) {
        return (
          <span className="text-red-alert font-semibold">
            Venceu há {Math.abs(dias)} {Math.abs(dias) === 1 ? "dia" : "dias"}
          </span>
        );
      }
      if (dias === 0) {
        return <span className="text-red-alert font-semibold">Vence hoje</span>;
      }
      if (dias === 1) {
        return <span className="text-orange-600 font-semibold">Vence amanhã</span>;
      }
      return (
        <span className="text-muted-foreground">
          Vence em {dias} {dias === 1 ? "dia" : "dias"}
        </span>
      );
    }

    return format(dataObj, "dd/MM/yyyy", { locale: ptBR });
  };

  // Renderizar notificação
  const renderNotificacao = (notificacao: Notificacao) => (
    <div
      key={notificacao.id}
      className="bg-card rounded-xl p-5 border border-border hover:border-accent/50 transition-colors"
    >
      <div className="flex items-start gap-4">
        <div
          className={`p-3 rounded-lg ${
            notificacao.prioridade === "urgente"
              ? "bg-red-alert/10 text-red-alert"
              : notificacao.prioridade === "alta"
              ? "bg-orange-500/10 text-orange-600"
              : "bg-accent/10 text-accent"
          }`}
        >
          {getIcon(notificacao.tipo)}
        </div>

        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-semibold text-lg mb-1">{notificacao.titulo}</h3>
              <p className="text-sm text-muted-foreground">{notificacao.descricao}</p>
            </div>
            {getPrioridadeBadge(notificacao.prioridade)}
          </div>

          <div className="flex items-center gap-4 text-sm mt-3">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {getDataAmigavel(notificacao.data, notificacao.metadata?.dias)}
            </div>

            {notificacao.metadata?.valor && (
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(notificacao.metadata.valor)}
                </span>
              </div>
            )}

            {notificacao.metadata?.cliente && (
              <div className="text-muted-foreground">
                Cliente: <span className="text-foreground">{notificacao.metadata.cliente}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-7">
        <h1 className="font-display text-3xl font-bold tracking-tight">Notificações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Alertas e lembretes importantes sobre seus processos
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-card rounded-xl p-4 border border-red-alert/30">
          <div className="text-2xl font-bold text-red-alert">{urgentes.length}</div>
          <div className="text-sm text-muted-foreground">Urgentes</div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="text-2xl font-bold">{hoje.length}</div>
          <div className="text-sm text-muted-foreground">Hoje</div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="text-2xl font-bold">{proximos7Dias.length}</div>
          <div className="text-sm text-muted-foreground">Próximos 7 dias</div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="todas" className="space-y-5">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="todas">
            Todas
            {notificacoes.length > 0 && (
              <Badge className="ml-2" variant="secondary">
                {notificacoes.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="urgentes">
            Urgentes
            {urgentes.length > 0 && (
              <Badge className="ml-2 bg-red-alert/10 text-red-alert">
                {urgentes.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="proximos">Próximos</TabsTrigger>
        </TabsList>

        <TabsContent value="todas" className="space-y-3">
          {notificacoes.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma notificação no momento.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Você está em dia com seus prazos!
              </p>
            </div>
          ) : (
            notificacoes.map(renderNotificacao)
          )}
        </TabsContent>

        <TabsContent value="urgentes" className="space-y-3">
          {urgentes.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 mx-auto text-green-ok mb-4" />
              <p className="text-muted-foreground">Nenhuma notificação urgente!</p>
            </div>
          ) : (
            urgentes.map(renderNotificacao)
          )}
        </TabsContent>

        <TabsContent value="hoje" className="space-y-3">
          {hoje.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum prazo para hoje.</p>
            </div>
          ) : (
            hoje.map(renderNotificacao)
          )}
        </TabsContent>

        <TabsContent value="proximos" className="space-y-3">
          {proximos7Dias.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Nenhum prazo nos próximos 7 dias.
              </p>
            </div>
          ) : (
            proximos7Dias.map(renderNotificacao)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
