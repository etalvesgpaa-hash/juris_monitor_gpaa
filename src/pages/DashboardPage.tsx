import { StatCard } from "@/components/StatCard";
import { useProcessos } from "@/hooks/useProcessos";
import { useTarefas, useCreateTarefa } from "@/hooks/useTarefas";
import { useClientes } from "@/hooks/useClientes";
import { useFeriados } from "@/hooks/useFeriados";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import type { PageId } from "@/types/navigation";
import { CreateTaskModal } from "@/components/CreateTaskModal";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, CalendarDays, CheckCircle2, CheckSquare2, ChevronRight, Clock3, FileText, GripVertical, LayoutGrid, MonitorUp, Plus, RotateCcw, Sparkles, TriangleAlert, Users, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Parseia YYYY-MM-DD como data local (evita deslocamento UTC no Brasil) */
function parseDateLocal(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

import {
  BarChart, Bar, PieChart, Pie, Cell, ComposedChart, Line,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

const STORE_KEY = "jm_aasp_intimacoes";
function loadIntimacoesCached(): any[] {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); } catch { return []; }
}
function fmtData(iso: string): string {
  const p = (iso || "").slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}
function dataLocalHoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

interface DashboardPageProps { onNavigate?: (page: PageId) => void; onOpenTv?: () => void; }

type DashboardCardId = "intimacoes" | "processos" | "clientes" | "tarefas" | "a-vencer" | "vencidas";
const DASHBOARD_ORDER_KEY = "jm_dashboard_card_order";
const DEFAULT_CARD_ORDER: DashboardCardId[] = ["intimacoes", "processos", "clientes", "tarefas", "a-vencer", "vencidas"];

function loadDashboardCardOrder(): DashboardCardId[] {
  try {
    const saved = JSON.parse(localStorage.getItem(DASHBOARD_ORDER_KEY) || "[]") as DashboardCardId[];
    return saved.length === DEFAULT_CARD_ORDER.length && DEFAULT_CARD_ORDER.every((id) => saved.includes(id))
      ? saved
      : DEFAULT_CARD_ORDER;
  } catch {
    return DEFAULT_CARD_ORDER;
  }
}

export function DashboardPage({ onNavigate, onOpenTv }: DashboardPageProps) {
  const { user } = useAuth();
  const { data: processos = [] } = useProcessos();
  const { data: tarefas = [] } = useTarefas();
  const { data: clientes = [] } = useClientes();
  const { data: feriados = [] } = useFeriados();
  const createTarefa = useCreateTarefa();
  const { toast } = useToast();
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [taskModalInitialData, setTaskModalInitialData] = useState<any>(null);
  const [organizingCards, setOrganizingCards] = useState(false);
  const [draggedCard, setDraggedCard] = useState<DashboardCardId | null>(null);
  const [cardOrder, setCardOrder] = useState<DashboardCardId[]>(loadDashboardCardOrder);

  const saveCardOrder = (nextOrder: DashboardCardId[]) => {
    setCardOrder(nextOrder);
    localStorage.setItem(DASHBOARD_ORDER_KEY, JSON.stringify(nextOrder));
  };

  const moveCard = (id: DashboardCardId, direction: -1 | 1) => {
    const currentIndex = cardOrder.indexOf(id);
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= cardOrder.length) return;
    const nextOrder = [...cardOrder];
    [nextOrder[currentIndex], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[currentIndex]];
    saveCardOrder(nextOrder);
  };

  const dropCard = (targetId: DashboardCardId) => {
    if (!draggedCard || draggedCard === targetId) return setDraggedCard(null);
    const nextOrder = cardOrder.filter((id) => id !== draggedCard);
    nextOrder.splice(nextOrder.indexOf(targetId), 0, draggedCard);
    saveCardOrder(nextOrder);
    setDraggedCard(null);
  };

  const cardContainerProps = (id: DashboardCardId) => ({
    style: { order: cardOrder.indexOf(id) },
    onDragOver: (event: React.DragEvent<HTMLDivElement>) => organizingCards && event.preventDefault(),
    onDrop: () => dropCard(id),
  });

  const CardOrganizer = ({ id }: { id: DashboardCardId }) => organizingCards ? (
    <div className="absolute inset-x-3 top-3 z-10 flex items-center justify-between rounded-lg border border-border bg-background/95 p-1 shadow-sm backdrop-blur" onClick={(event) => event.stopPropagation()}>
      <button type="button" onClick={() => moveCard(id, -1)} disabled={cardOrder.indexOf(id) === 0} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-25" aria-label="Mover card para trás"><ArrowLeft className="h-3.5 w-3.5" /></button>
      <button type="button" draggable onDragStart={() => setDraggedCard(id)} onDragEnd={() => setDraggedCard(null)} className="flex cursor-grab items-center gap-1 rounded-md px-2 py-1 text-[0.65rem] font-semibold text-muted-foreground hover:bg-muted active:cursor-grabbing" aria-label="Arrastar card"><GripVertical className="h-3.5 w-3.5" /> Arraste</button>
      <button type="button" onClick={() => moveCard(id, 1)} disabled={cardOrder.indexOf(id) === cardOrder.length - 1} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-25" aria-label="Mover card para frente"><ArrowRight className="h-3.5 w-3.5" /></button>
    </div>
  ) : null;

  // ── Intimações: inicia com localStorage (imediato) e sincroniza com Supabase ─
  const [intimacoes, setIntimacoes] = useState<any[]>(() => loadIntimacoesCached());
  const [erroSync, setErroSync] = useState<string | null>(null);

  // Captura erros de sincronização do hook (visível no mobile sem console)
  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent<string>).detail;
      setErroSync(msg);
      console.error("[Dashboard] Erro de sync recebido:", msg);
    };
    window.addEventListener("supabase-sync-erro", handler);
    return () => window.removeEventListener("supabase-sync-erro", handler);
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("intimacoes")
      .select("id, data_publicacao, status, resumo_ia, tipo, numero_processo, partes, orgao_julgador, dados_raw")
      .eq("user_id", user.id)
      .eq("origem", "aasp")
      .order("data_publicacao", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (!data?.length) return;
        const fromDB: any[] = data.map((row: any) => {
          const raw = (row.dados_raw as any) || {};
          return {
            ...raw,
            _id:            row.id,
            _data:          ((row.data_publicacao ?? raw._data ?? "") as string).slice(0, 10),
            _lida:          raw._lida ?? false,
            // ?? preserva resumo_ia mesmo quando raw tem null
            _status:        row.status ?? "ativa",
            _resumoIA:      row.resumo_ia ?? raw._resumoIA ?? null,
            _titulo:        row.tipo ?? raw._titulo ?? "Publicação AASP",
            _numProc:       row.numero_processo ?? raw._numProc ?? "",
            _partes:        row.partes ?? raw._partes ?? "",
            _orgaoJulgador: row.orgao_julgador ?? raw._orgaoJulgador ?? "",
          };
        });
        // Mescla: Supabase tem prioridade, mantém locais não enviados
        const cached = loadIntimacoesCached();
        const dbIds = new Set(fromDB.map((i: any) => i._id));
        const apenasLocal = cached.filter((i: any) => !dbIds.has(i._id));
        const merged = [...fromDB, ...apenasLocal];
        // Atualiza localStorage e estado
        try { localStorage.setItem(STORE_KEY, JSON.stringify(merged.slice(0, 1000))); } catch {}
        setIntimacoes(merged);
      })
      .catch(() => {});
  }, [user]);

  // Clientes que receberam notificação hoje
  const [clientesNotificadosHoje, setClientesNotificadosHoje] = useState(0);

  useEffect(() => {
    if (!user) return;
    const hoje = dataLocalHoje();
    supabase
      .from("notificacoes_enviadas" as any)
      .select("cliente_id")
      .eq("user_id", user.id)
      .eq("status", "enviado")
      .gte("created_at", `${hoje}T00:00:00`)
      .lte("created_at", `${hoje}T23:59:59`)
      .then(({ data }) => {
        if (!data) return;
        // Conta clientes únicos
        const uniq = new Set((data as any[]).map((n: any) => n.cliente_id));
        setClientesNotificadosHoje(uniq.size);
      });
  }, [user]);

  const hoje             = dataLocalHoje();
  const intimacoesAtivas = intimacoes.filter((i: any) => (i._status || "ativa") === "ativa");
  const intimacoesHoje   = intimacoesAtivas.filter((i: any) => (i._data || "").slice(0,10) === hoje);
  const intimacoesNaoLidas = intimacoesAtivas.filter((i: any) => !i._lida);
  const ultimasIntimacoes  = intimacoesAtivas.slice(0, 5);

  // Calcula clientes únicos que receberam publicações (intimações ativas)
  const clientesComPublicacoes = (() => {
    const clienteIds = new Set<string>();
    
    intimacoesAtivas.forEach((intimacao: any) => {
      const numProc = intimacao._numProc || "";
      // Encontra o processo correspondente
      const processo = processos.find(p => 
        p.numero_cnj && numProc.includes(p.numero_cnj.replace(/\D/g, ""))
      );
      
      if (processo && processo.cliente_id) {
        clienteIds.add(processo.cliente_id);
      }
    });
    
    return clienteIds.size;
  })();

  const now = new Date();
  const tarefasPendentes  = tarefas.filter(t => t.status !== "concluida");
  const tarefasVencidas   = tarefas.filter(t => {
    if (!t.data_vencimento || t.status === "concluida") return false;
    return parseDateLocal(t.data_vencimento) < now;
  });
  const tarefasAVencer = tarefas.filter(t => {
    if (!t.data_vencimento || t.status === "concluida") return false;
    const diff = parseDateLocal(t.data_vencimento).getTime() - now.getTime();
    return diff > 0 && diff <= 3 * 24 * 60 * 60 * 1000;
  });

  // Gráficos
  
  // Intimações nos últimos 7 dias úteis (como na IntimacoesPage)
  const intimacoesUltimos7Dias = (() => {
    const dias: string[] = [];
    const d = new Date();
    // Gera os últimos 7 dias ÚTEIS (seg-sex)
    while (dias.length < 7) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) {
        const diaStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        dias.push(diaStr);
      }
      d.setDate(d.getDate() - 1);
    }
    
    // Conta intimações por dia — normaliza _data para YYYY-MM-DD (remove horário se houver)
    const contagemPorDia = intimacoes.reduce<Record<string, number>>((acc, it: any) => {
      const dataKey = (it._data || "").slice(0, 10);
      if (dataKey) acc[dataKey] = (acc[dataKey] || 0) + 1;
      return acc;
    }, {});
    
    // Formata para o gráfico (ordem crescente de data)
    return dias.reverse().map(dia => {
      const [ano, mes, d] = dia.split("-");
      const dow = new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
      return {
        day: `${dow} ${d}/${mes}`,
        total: contagemPorDia[dia] || 0
      };
    });
  })();

  const tarefasPorMes = (() => {
    const meses: Record<string, { concluidas: number; abertas: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      meses[key] = { concluidas: 0, abertas: 0 };
    }
    tarefas.forEach(t => {
      const key = (t.data_vencimento || t.created_at || "").slice(0, 7);
      if (meses[key]) {
        if (t.status === "concluida") meses[key].concluidas++;
        else meses[key].abertas++;
      }
    });
    return Object.entries(meses).sort(([a],[b]) => a.localeCompare(b)).map(([key, v]) => {
      const [, m] = key.split("-");
      const nomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
      return { month: nomes[parseInt(m)-1], Concluídas: v.concluidas, Abertas: v.abertas };
    });
  })();

  const processosStatusData = [
    { name: "Ativos", value: processos.filter(p => p.status === "ativo").length, color: "#0f766e" },
    { name: "Arquivados", value: processos.filter(p => p.status === "arquivado").length, color: "#94a3b8" },
    { name: "Pendentes", value: processos.filter(p => p.status === "pendente").length, color: "#c59a32" },
  ];
  const processosAtivosPercentual = processos.length
    ? Math.round((processosStatusData[0].value / processos.length) * 100)
    : 0;
  const mediaIntimacoes = intimacoesUltimos7Dias.length
    ? intimacoesUltimos7Dias.reduce((total, item) => total + item.total, 0) / intimacoesUltimos7Dias.length
    : 0;
  const intimacoesComMedia = intimacoesUltimos7Dias.map((item) => ({ ...item, media: Number(mediaIntimacoes.toFixed(1)) }));
  const tarefasConcluidasTotal = tarefas.filter(t => t.status === "concluida").length;
  const taxaConclusao = tarefas.length ? Math.round((tarefasConcluidasTotal / tarefas.length) * 100) : 0;

  const handleOpenTaskModal = (intimacao: any) => {
    setTaskModalInitialData({
      titulo: `Análise: ${intimacao._titulo || "Intimação AASP"}`,
      descricao: `Processo: ${intimacao._numProc || "Não informado"}\nData: ${fmtData(intimacao._data)}\n\n${intimacao._resumoIA || ""}`,
      prioridade: "alta",
    });
    setShowCreateTaskModal(true);
  };

  const handleCreateTask = async (data: any) => {
    try {
      await createTarefa.mutateAsync({
        titulo: data.titulo, descricao: data.descricao || null,
        data_vencimento: data.data_vencimento || null, prioridade: data.prioridade,
        processo_id: data.processo_id || null, status: data.status || "pendente",
      });
      toast({ title: "✅ Tarefa criada!" });
      setShowCreateTaskModal(false);
      setTaskModalInitialData(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const aaspConectada = intimacoes.length > 0;
  const firstName = user?.user_metadata?.full_name?.trim().split(/\s+/)[0] || "Doutor(a)";
  const todayLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());

  return (
    <div className="page-stack">
      <header className="relative mb-6 overflow-hidden rounded-[1.5rem] bg-primary px-5 py-6 text-primary-foreground shadow-xl shadow-primary/10 sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-white/5 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.68rem] font-semibold text-primary-foreground/70">
            <Sparkles className="h-3.5 w-3.5 text-accent" /> Centro de comando do escritório
          </div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground/50 first-letter:uppercase">
            {todayLabel}
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Olá, {firstName}.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-primary-foreground/60">
            Veja primeiro o que exige atenção e acompanhe a operação sem perder prazos.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold"><TriangleAlert className="h-3.5 w-3.5 text-red-300" /> {tarefasVencidas.length} vencida(s)</span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold"><Clock3 className="h-3.5 w-3.5 text-amber-300" /> {tarefasAVencer.length} tarefa(s) vencendo em até 3 dias</span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold"><FileText className="h-3.5 w-3.5 text-accent" /> {intimacoesHoje.length} intimação(ões) hoje</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onOpenTv} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-white/10">
            <MonitorUp className="h-4 w-4" /> Painel TV
          </button>
          <button type="button" onClick={() => setOrganizingCards((current) => !current)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-white/10">
            {organizingCards ? <X className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            {organizingCards ? "Concluir organização" : "Organizar painel"}
          </button>
          <button
            type="button"
            onClick={() => setShowCreateTaskModal(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground shadow-lg shadow-black/10 transition-all hover:-translate-y-0.5 hover:bg-accent/90"
          >
            <Plus className="h-4 w-4" /> Nova tarefa
          </button>
        </div>
        </div>
      </header>

      {organizingCards && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-accent/25 bg-accent/5 px-4 py-3 text-sm text-foreground sm:flex-row sm:items-center">
          <GripVertical className="h-4 w-4 shrink-0 text-accent" />
          <span className="flex-1">Arraste os cards pelo indicador ou use as setas. A ordem fica salva somente neste navegador.</span>
          <button type="button" onClick={() => saveCardOrder(DEFAULT_CARD_ORDER)} className="inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-background hover:text-foreground sm:self-auto"><RotateCcw className="h-3.5 w-3.5" /> Restaurar ordem</button>
        </div>
      )}

      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">Indicadores</p>
          <h2 className="mt-0.5 font-display text-lg font-semibold">Visão geral do escritório</h2>
        </div>
        {!organizingCards && <p className="hidden text-xs text-muted-foreground sm:block">Use “Organizar painel” para personalizar a ordem</p>}
      </div>

      {/* Banner de erro de sincronização — visível no mobile */}
      {erroSync && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-400/40 rounded-xl text-sm text-red-600 flex items-start gap-2">
          <span className="font-bold shrink-0">⚠ Erro de sincronização:</span>
          <span className="break-all">{erroSync}</span>
          <button onClick={() => setErroSync(null)} className="ml-auto shrink-0 text-red-400 hover:text-red-600 font-bold">✕</button>
        </div>
      )}
      {/* ── Cards de estatísticas — linha 1 ── */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
        {/* Intimações de HOJE */}
        <div
          {...cardContainerProps("intimacoes")}
          onClick={() => onNavigate?.("intimacoes")}
          className={`group relative cursor-pointer overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-panel transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-panel-hover xl:col-span-2 ${organizingCards ? "pt-16 ring-1 ring-accent/20" : ""}`}
        >
          <CardOrganizer id="intimacoes" />
          <div className="absolute right-4 top-4 rounded-xl bg-accent/10 p-2.5 text-accent"><FileText className="h-5 w-5" /></div>
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Intimações hoje</div>
          <div className="font-display text-4xl font-semibold text-foreground transition-transform">
            {intimacoesHoje.length}
          </div>
          <div className="text-[0.65rem] text-muted-foreground mt-0.5">publicações do dia</div>
          {intimacoesNaoLidas.length > 0 && (
            <div className="mt-3 inline-flex rounded-full bg-accent/10 px-2.5 py-1 text-[0.68rem] font-bold text-accent">
              {intimacoesNaoLidas.length} não lida(s)
            </div>
          )}
        </div>

        {/* Processos */}
        <div
          {...cardContainerProps("processos")}
          onClick={() => onNavigate?.("processos")}
          className={`group relative cursor-pointer overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-panel transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-panel-hover xl:col-span-2 ${organizingCards ? "pt-16 ring-1 ring-accent/20" : ""}`}
        >
          <CardOrganizer id="processos" />
          <div className="absolute right-4 top-4 rounded-xl bg-primary/7 p-2.5 text-primary"><BriefcaseBusiness className="h-5 w-5" /></div>
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Processos</div>
          <div className="font-display text-4xl font-semibold text-foreground">{processos.length}</div>
          <div className="text-[0.65rem] text-muted-foreground mt-0.5">cadastrados</div>
          <div className="mt-1.5 text-[0.6rem] bg-blue-500/20 text-blue-700 px-1.5 py-0.5 rounded font-bold inline-block">
            {processos.filter(p => p.status === "ativo").length} ativos
          </div>
        </div>

        {/* Clientes */}
        <div
          {...cardContainerProps("clientes")}
          onClick={() => onNavigate?.("clientes")}
          className={`group relative cursor-pointer overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-panel transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-panel-hover xl:col-span-2 ${organizingCards ? "pt-16 ring-1 ring-accent/20" : ""}`}
        >
          <CardOrganizer id="clientes" />
          <div className="absolute right-4 top-4 rounded-xl bg-primary/7 p-2.5 text-primary"><Users className="h-5 w-5" /></div>
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Clientes</div>
          <div className="font-display text-4xl font-semibold text-foreground">{clientes.length}</div>
          <div className="text-[0.65rem] text-muted-foreground mt-0.5">cadastrados</div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {clientesComPublicacoes > 0 && (
              <div className="text-[0.6rem] bg-amber-500/20 text-amber-700 px-1.5 py-0.5 rounded font-bold inline-block">
                {clientesComPublicacoes} com publicações
              </div>
            )}
            {clientesNotificadosHoje > 0 && (
              <div className="text-[0.6rem] bg-green-500/20 text-green-700 px-1.5 py-0.5 rounded font-bold inline-block">
                {clientesNotificadosHoje} notificado(s) hoje
              </div>
            )}
          </div>
        </div>

        {/* Tarefas pendentes */}
        <div
          {...cardContainerProps("tarefas")}
          onClick={() => onNavigate?.("tarefas")}
          className={`group relative cursor-pointer overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-panel transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-panel-hover xl:col-span-2 ${organizingCards ? "pt-16 ring-1 ring-accent/20" : ""}`}
        >
          <CardOrganizer id="tarefas" />
          <div className="absolute right-4 top-4 rounded-xl bg-primary/7 p-2.5 text-primary"><CheckSquare2 className="h-5 w-5" /></div>
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Tarefas</div>
          <div className="font-display text-4xl font-semibold text-foreground">{tarefasPendentes.length}</div>
          <div className="text-[0.65rem] text-muted-foreground mt-0.5">pendentes</div>
          <div className="mt-1.5 text-[0.6rem] bg-cyan-500/20 text-cyan-700 px-1.5 py-0.5 rounded font-bold inline-block">
            {tarefas.filter(t => t.status === "concluida").length} concluídas
          </div>
        </div>

        {/* A vencer (3 dias) */}
        <div
          {...cardContainerProps("a-vencer")}
          onClick={() => onNavigate?.("tarefas")}
          className={`relative cursor-pointer overflow-hidden rounded-2xl border p-5 shadow-panel transition-all hover:-translate-y-0.5 hover:shadow-panel-hover xl:col-span-2 ${organizingCards ? "pt-16 ring-1 ring-accent/20" : ""} ${
            tarefasAVencer.length > 0
              ? "border-amber-500/25 bg-amber-500/5 hover:border-amber-500/40"
              : "border-border bg-card hover:border-accent/40"
          }`}
        >
          <CardOrganizer id="a-vencer" />
          <div className="absolute right-5 top-5 rounded-xl bg-amber-500/10 p-2.5 text-amber-600"><Clock3 className="h-5 w-5" /></div>
          <div className={`text-[0.65rem] font-bold uppercase tracking-widest mb-1 ${tarefasAVencer.length > 0 ? "text-orange-600" : "text-muted-foreground"}`}>Vencem em até 3 dias</div>
          <div className={`font-display text-3xl font-black ${tarefasAVencer.length > 0 ? "text-orange-600" : ""}`}>
            {tarefasAVencer.length}
          </div>
          <div className="text-[0.65rem] text-muted-foreground mt-0.5">tarefas pendentes</div>
        </div>

        {/* Vencidas */}
        <div
          {...cardContainerProps("vencidas")}
          onClick={() => onNavigate?.("tarefas")}
          className={`relative cursor-pointer overflow-hidden rounded-2xl border p-5 shadow-panel transition-all hover:-translate-y-0.5 hover:shadow-panel-hover xl:col-span-2 ${organizingCards ? "pt-16 ring-1 ring-accent/20" : ""} ${
            tarefasVencidas.length > 0
              ? "border-red-500/30 bg-red-500/5 hover:border-red-500/45"
              : "border-border bg-card hover:border-accent/40"
          }`}
        >
          <CardOrganizer id="vencidas" />
          <div className="absolute right-5 top-5 rounded-xl bg-red-500/10 p-2.5 text-red-600"><TriangleAlert className="h-5 w-5" /></div>
          <div className={`text-[0.65rem] font-bold uppercase tracking-widest mb-1 ${tarefasVencidas.length > 0 ? "text-red-600" : "text-muted-foreground"}`}>Vencidas</div>
          <div className={`font-display text-3xl font-black ${tarefasVencidas.length > 0 ? "text-red-600" : ""}`}>
            {tarefasVencidas.length}
          </div>
          <div className="text-[0.65rem] text-muted-foreground mt-0.5">prazo expirado</div>
        </div>
      </div>

      {/* ── Card extra: Clientes notificados hoje (se houver) ── */}
      {clientesNotificadosHoje > 0 && (
        <div className="flex items-center gap-3 bg-green-ok/5 border border-green-ok/20 rounded-xl px-4 py-3 mb-4 text-sm">
          <span className="text-xl">📧</span>
          <div>
            <span className="font-bold text-green-ok">{clientesNotificadosHoje} cliente(s)</span>
            <span className="text-muted-foreground"> receberam notificação automática de nova publicação hoje.</span>
          </div>
          <button onClick={() => onNavigate?.("clientes")} className="ml-auto text-xs text-green-ok underline font-semibold whitespace-nowrap">
            Ver clientes →
          </button>
        </div>
      )}

      {/* ── Inteligência visual ── */}
      <section className="mb-6">
        <div className="mb-3">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">Análise visual</p>
          <h2 className="mt-0.5 font-display text-lg font-semibold">Desempenho em um olhar</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <InsightChartCard eyebrow="Carteira" title="Distribuição dos processos" metric={`${processosAtivosPercentual}%`} caption="dos processos estão ativos">
            <div className="grid min-h-[235px] grid-cols-[1fr_0.8fr] items-center gap-2">
              <div className="relative h-[210px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={processosStatusData} cx="50%" cy="50%" innerRadius="66%" outerRadius="88%" paddingAngle={4} cornerRadius={7} dataKey="value" stroke="none">
                      {processosStatusData.map((item) => <Cell key={item.name} fill={item.color} />)}
                    </Pie>
                    <Tooltip content={<ModernTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-3xl font-semibold text-foreground">{processos.length}</span>
                  <span className="text-[0.62rem] font-semibold uppercase tracking-wider text-muted-foreground">processos</span>
                </div>
              </div>
              <div className="space-y-3">
                {processosStatusData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.68rem] text-muted-foreground">{item.name}</p>
                      <p className="text-sm font-bold text-foreground">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </InsightChartCard>

          <InsightChartCard eyebrow="Publicações" title="Fluxo de intimações" metric={mediaIntimacoes.toFixed(1)} caption="média por dia útil">
            <div className="h-[235px] pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={intimacoesComMedia.length ? intimacoesComMedia : [{ day: "—", total: 0, media: 0 }]} margin={{ top: 10, right: 4, left: -22, bottom: 12 }}>
                  <defs>
                    <linearGradient id="intimacoesBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c59a32" stopOpacity={1} />
                      <stop offset="100%" stopColor="#c59a32" stopOpacity={0.35} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.65} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip content={<ModernTooltip />} />
                  <Bar dataKey="total" name="Intimações" fill="url(#intimacoesBar)" radius={[6, 6, 2, 2]} maxBarSize={28} />
                  <Line type="monotone" dataKey="media" name="Média" stroke="#0f766e" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </InsightChartCard>

          <InsightChartCard eyebrow="Produtividade" title="Evolução das tarefas" metric={`${taxaConclusao}%`} caption="de conclusão geral">
            <div className="h-[235px] pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tarefasPorMes.length ? tarefasPorMes : [{ month: "—", Concluídas: 0, Abertas: 0 }]} margin={{ top: 10, right: 4, left: -22, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.65} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip content={<ModernTooltip />} />
                  <Bar dataKey="Concluídas" name="Concluídas" stackId="tarefas" fill="#0f766e" radius={[0, 0, 3, 3]} maxBarSize={32} />
                  <Bar dataKey="Abertas" name="Abertas" stackId="tarefas" fill="#c59a32" radius={[6, 6, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex items-center gap-4 text-[0.65rem] font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#0f766e]" /> Concluídas</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#c59a32]" /> Abertas</span>
            </div>
          </InsightChartCard>
        </div>
      </section>

      {/* ── Últimas Intimações + Agenda ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-3.5 mb-5">
        <div className="content-panel p-5">
          <div className="text-[0.72rem] font-bold text-foreground uppercase tracking-widest mb-3.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-[18px] h-0.5 bg-accent" />
              Últimas Intimações AASP
            </div>
            <div className="flex gap-1.5 text-[0.65rem]">
              <span className="px-2 py-0.5 rounded bg-accent/10 text-accent font-bold">{intimacoesAtivas.length} TOTAL</span>
              <span className="px-2 py-0.5 rounded bg-accent/20 text-accent font-bold">{intimacoesHoje.length} HOJE</span>
            </div>
          </div>

          {ultimasIntimacoes.length > 0 ? (
            <div className="space-y-2">
              {ultimasIntimacoes.map((i: any) => (
                <div key={i._id} className="flex items-start justify-between px-3 py-2.5 rounded-lg border border-border hover:border-accent/40 transition-all gap-2">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${(i._data||"").slice(0,10) === hoje ? "bg-accent" : "bg-muted-foreground/40"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm line-clamp-1">{i._titulo || "Publicação AASP"}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{i._numProc || "—"}</div>
                      {i._resumoIA && (
                        <div className="text-xs text-purple-600 mt-0.5 line-clamp-1 italic">✦ {i._resumoIA}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">{fmtData(i._data)}</span>
                    <button
                      onClick={() => handleOpenTaskModal(i)}
                      className="px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide rounded bg-accent hover:bg-accent/80 text-white transition-colors"
                    >
                      + Tarefa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Nenhuma intimação. Acesse Intimações e clique em Atualizar.
            </div>
          )}

          <div className="text-center mt-4">
            <button onClick={() => onNavigate?.("intimacoes")} className="text-xs text-accent hover:underline font-semibold">
              VER TODAS AS INTIMAÇÕES →
            </button>
          </div>
        </div>

        <div>
          <AgendaCalendario tarefas={tarefas} onNavigate={onNavigate} />
        </div>
      </div>

      {/* ── Prazos críticos ── */}
      {tarefasAVencer.length > 0 && (
        <div className="content-panel mb-5 border-accent/25 p-5">
          <div className="text-[0.72rem] font-bold text-accent uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <div className="w-[18px] h-0.5 bg-accent" />
            ⚠️ Prazos Próximos — Próximos 3 dias
          </div>
          <div className="space-y-2">
            {tarefasAVencer.map(t => (
              <div key={t.id} className="flex items-center justify-between bg-accent/5 rounded-lg px-4 py-3 border border-accent/10">
                <div>
                  <div className="font-semibold text-sm">{t.titulo}</div>
                  <div className="text-xs text-muted-foreground">{t.descricao || "Sem descrição"}</div>
                </div>
                <div className="text-xs font-mono text-accent font-bold whitespace-nowrap">
                  {t.data_vencimento?.slice(0,10).split("-").reverse().join("/") || "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tarefasVencidas.length > 0 && (
        <div className="content-panel mb-5 border-red-alert/25 p-5">
          <div className="text-[0.72rem] font-bold text-red-alert uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <div className="w-[18px] h-0.5 bg-red-alert" />
            🔴 Tarefas Vencidas — Atenção Imediata
          </div>
          <div className="space-y-2">
            {tarefasVencidas.slice(0, 5).map(t => (
              <div key={t.id} className="flex items-center justify-between bg-red-alert/5 rounded-lg px-4 py-3 border border-red-alert/10">
                <div>
                  <div className="font-semibold text-sm">{t.titulo}</div>
                  <div className="text-xs text-muted-foreground">{t.descricao || "Sem descrição"}</div>
                </div>
                <div className="text-xs font-mono text-red-alert font-bold whitespace-nowrap">
                  {t.data_vencimento?.slice(0,10).split("-").reverse().join("/") || "—"}
                </div>
              </div>
            ))}
            {tarefasVencidas.length > 5 && (
              <button onClick={() => onNavigate?.("tarefas")} className="text-xs text-red-alert underline font-semibold">
                + {tarefasVencidas.length - 5} vencida(s) a mais → ver todas
              </button>
            )}
          </div>
        </div>
      )}

      <CreateTaskModal
        open={showCreateTaskModal}
        onClose={() => { setShowCreateTaskModal(false); setTaskModalInitialData(null); }}
        onSubmit={handleCreateTask}
        initialData={taskModalInitialData}
        processos={processos}
        feriados={feriados}
      />
    </div>
  );
}

// ── Helpers de UI ──────────────────────────────────────────────────────────────
function PriorityRow({ icon: Icon, tone, active, badge, title, description, action, onNavigate }: {
  icon: LucideIcon;
  tone: "danger" | "warning" | "accent";
  active: boolean;
  badge: string;
  title: string;
  description: string;
  action: PageId;
  onNavigate?: (page: PageId) => void;
}) {
  const styles = {
    danger: { icon: "bg-red-500/12 text-red-600", row: "bg-red-500/[0.055] hover:bg-red-500/[0.085]", badge: "bg-red-500/10 text-red-700" },
    warning: { icon: "bg-amber-500/12 text-amber-600", row: "bg-amber-500/[0.055] hover:bg-amber-500/[0.085]", badge: "bg-amber-500/12 text-amber-700" },
    accent: { icon: "bg-accent/12 text-accent", row: "bg-accent/[0.055] hover:bg-accent/[0.085]", badge: "bg-accent/12 text-accent" },
  };
  const visual = styles[tone];

  return (
    <button type="button" onClick={() => onNavigate?.(action)} className={`group relative flex w-full items-center gap-3 px-5 py-4 text-left transition-colors ${active ? visual.row : "hover:bg-muted/45"}`}>
      {active && <span className={`absolute inset-y-0 left-0 w-1 ${tone === "danger" ? "bg-red-500" : tone === "warning" ? "bg-amber-500" : "bg-accent"}`} />}
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? visual.icon : "bg-muted text-muted-foreground"}`}><Icon className="h-[18px] w-[18px]" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">{title}{active && <span className={`rounded-full px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-wider ${visual.badge}`}>{badge}</span>}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{description}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </button>
  );
}

function OperationalMetric({ icon: Icon, value, label, tone }: { icon: LucideIcon; value: number; label: string; tone: "navy" | "success" | "accent" | "warning" }) {
  const tones = {
    navy: "border-primary/10 bg-primary/[0.035] text-primary",
    success: "border-emerald-500/15 bg-emerald-500/[0.055] text-emerald-700",
    accent: "border-accent/15 bg-accent/[0.055] text-accent",
    warning: "border-amber-500/15 bg-amber-500/[0.055] text-amber-700",
  };
  return (
    <div className={`rounded-xl border p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-sm ${tones[tone]}`}>
      <Icon className="mb-3 h-4 w-4" />
      <p className="font-display text-2xl font-semibold leading-none text-foreground">{value}</p>
      <p className="mt-1.5 text-[0.68rem] font-medium leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
      ok ? "bg-green-ok/[0.08] border border-green-ok/20 text-green-ok"
         : "bg-muted border border-border text-muted-foreground"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${ok ? "bg-green-ok animate-pulse" : "bg-muted-foreground"}`} />
      {label}
    </div>
  );
}

function InsightChartCard({ eyebrow, title, metric, caption, children }: {
  eyebrow: string;
  title: string;
  metric: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <article className="content-panel relative overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:shadow-panel-hover">
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-accent/5 blur-2xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.15em] text-accent">{eyebrow}</p>
          <h3 className="mt-1 text-sm font-semibold text-foreground">{title}</h3>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-semibold leading-none text-foreground">{metric}</p>
          <p className="mt-1 text-[0.62rem] text-muted-foreground">{caption}</p>
        </div>
      </div>
      <div className="relative">{children}</div>
    </article>
  );
}

function ModernTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[130px] rounded-xl border border-border bg-popover/95 p-3 text-xs shadow-xl backdrop-blur">
      {label && <p className="mb-2 font-semibold text-foreground">{label}</p>}
      <div className="space-y-1.5">
        {payload.map((item: any) => (
          <div key={item.dataKey || item.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color || item.fill }} />{item.name}</span>
            <span className="font-bold text-foreground">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Agenda / Calendário Completo (igual ao da TarefasPage) ────────────────────
function AgendaCalendario({ tarefas, onNavigate }: { tarefas: any[]; onNavigate?: (page: string) => void }) {
  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;

  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());

  const nomesMeses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const diasSemana = ["SEG","TER","QUA","QUI","SEX","SÁB","DOM"];

  const irParaHoje = () => { setMes(hoje.getMonth()); setAno(hoje.getFullYear()); };
  const mesAnterior = () => { if (mes === 0) { setMes(11); setAno(a => a - 1); } else setMes(m => m - 1); };
  const proximoMes  = () => { if (mes === 11) { setMes(0); setAno(a => a + 1); } else setMes(m => m + 1); };

  // Monta grid do calendário (segunda = index 0)
  const primeiroDia = new Date(ano, mes, 1);
  const ultimoDia   = new Date(ano, mes + 1, 0);
  const offsetInicio = (primeiroDia.getDay() + 6) % 7;
  const totalCelulas = Math.ceil((offsetInicio + ultimoDia.getDate()) / 7) * 7;

  // Index de tarefas por data "YYYY-MM-DD"
  const tarefasPorDia = tarefas.reduce<Record<string, any[]>>((acc, t) => {
    if (!t.data_vencimento) return acc;
    const d = t.data_vencimento.slice(0, 10);
    (acc[d] = acc[d] || []).push(t);
    return acc;
  }, {});

  const corTarefa = (t: any) => {
    if (t.status === "concluida") return "bg-[#1e40af] text-white";           // azul — concluída
    const d = t.data_vencimento?.slice(0, 10) || "";
    if (d < hojeStr) return "bg-[#dc2626] text-white";                        // vermelho — vencida
    if (d === hojeStr) return "bg-[#d97706] text-white";                      // amarelo — hoje
    return "bg-[#16a34a] text-white";                                         // verde — próximos dias
  };

  const cells = Array.from({ length: totalCelulas }, (_, i) => {
    const diaNum = i - offsetInicio + 1;
    if (diaNum < 1 || diaNum > ultimoDia.getDate()) return null;
    const diaStr = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(diaNum).padStart(2, "0")}`;
    return { diaNum, diaStr };
  });

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header do calendário */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={mesAnterior}
            className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors text-sm font-bold"
          >‹</button>
          <h2 className="font-display text-lg font-bold tracking-tight">
            {nomesMeses[mes]} · {ano}
          </h2>
          <button
            onClick={proximoMes}
            className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors text-sm font-bold"
          >›</button>
          <button
            onClick={irParaHoje}
            className="px-3 py-1 rounded-lg border border-border text-xs font-semibold hover:bg-muted transition-colors"
          >Hoje</button>
        </div>
        {/* Legenda */}
        <div className="hidden sm:flex items-center gap-4 text-[0.65rem] font-semibold">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#dc2626]" /> Vencida</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#d97706]" /> Hoje</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#16a34a]" /> Próximos dias</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#1e40af]" /> Concluída</span>
        </div>
      </div>

      {/* Dias da semana */}
      <div className="grid grid-cols-7 border-b border-border">
        {diasSemana.map(d => (
          <div key={d} className="py-2 text-center text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Células */}
      <div className="grid grid-cols-7">
        {cells.map((cell, idx) => {
          if (!cell) {
            return (
              <div
                key={`empty-${idx}`}
                className="min-h-[100px] border-b border-r border-border bg-muted/20 last:border-r-0"
              />
            );
          }
          const { diaNum, diaStr } = cell;
          const isHoje = diaStr === hojeStr;
          const isWeekend = ((idx % 7) === 5 || (idx % 7) === 6);
          const tarefasDia = tarefasPorDia[diaStr] || [];

          return (
            <div
              key={diaStr}
              className={`min-h-[100px] border-b border-r border-border p-1.5 last:border-r-0 relative transition-colors
                ${isWeekend ? "bg-muted/30" : "bg-card"}
                ${isHoje ? "ring-2 ring-inset ring-accent" : ""}
              `}
            >
              <div className="flex items-center gap-1 mb-1">
                <span className={`text-xs font-semibold leading-none
                  ${isHoje ? "bg-accent text-white rounded-full w-5 h-5 flex items-center justify-center text-[0.65rem] font-bold" : isWeekend ? "text-muted-foreground" : "text-foreground"}
                `}>
                  {diaNum}
                </span>
                {isHoje && <span className="text-[0.55rem] font-bold uppercase tracking-wide text-accent">Hoje</span>}
              </div>
              <div className="space-y-0.5">
                {tarefasDia.slice(0, 3).map((t: any) => (
                  <div
                    key={t.id}
                    title={t.titulo}
                    onClick={() => onNavigate?.("tarefas")}
                    className={`text-[0.62rem] font-semibold px-1.5 py-0.5 rounded truncate leading-snug cursor-pointer hover:opacity-80 transition-opacity ${corTarefa(t)}`}
                  >
                    {t.titulo}
                  </div>
                ))}
                {tarefasDia.length > 3 && (
                  <div className="text-[0.6rem] text-muted-foreground font-semibold px-1">
                    +{tarefasDia.length - 3} mais
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
