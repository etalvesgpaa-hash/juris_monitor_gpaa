import { StatCard } from "@/components/StatCard";
import { useProcessos } from "@/hooks/useProcessos";
import { useTarefas, useCreateTarefa } from "@/hooks/useTarefas";
import { useClientes } from "@/hooks/useClientes";
import { useFeriados } from "@/hooks/useFeriados";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import type { PageId } from "@/components/AppLayout";
import { CreateTaskModal } from "@/components/CreateTaskModal";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  ResponsiveContainer, XAxis, YAxis, Tooltip, Legend,
} from "recharts";

const STORE_KEY = "jm_aasp_intimacoes";
function loadIntimacoes() {
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

interface DashboardPageProps { onNavigate?: (page: PageId) => void; }

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { user } = useAuth();
  const { data: processos = [] } = useProcessos();
  const { data: tarefas = [] } = useTarefas();
  const { data: clientes = [] } = useClientes();
  const { data: feriados = [] } = useFeriados();
  const createTarefa = useCreateTarefa();
  const { toast } = useToast();
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [taskModalInitialData, setTaskModalInitialData] = useState<any>(null);

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

  const intimacoes       = loadIntimacoes();
  const hoje             = dataLocalHoje();
  const intimacoesAtivas = intimacoes.filter((i: any) => (i._status || "ativa") === "ativa");
  const intimacoesHoje   = intimacoesAtivas.filter((i: any) => (i._data || "").slice(0,10) === hoje);
  const intimacoesNaoLidas = intimacoesAtivas.filter((i: any) => !i._lida);
  const ultimasIntimacoes  = intimacoesAtivas.slice(0, 5);

  const now = new Date();
  const tarefasPendentes  = tarefas.filter(t => t.status !== "concluida");
  const tarefasVencidas   = tarefas.filter(t => {
    if (!t.data_vencimento || t.status === "concluida") return false;
    return new Date(t.data_vencimento) < now;
  });
  const tarefasAVencer = tarefas.filter(t => {
    if (!t.data_vencimento || t.status === "concluida") return false;
    const diff = new Date(t.data_vencimento).getTime() - now.getTime();
    return diff > 0 && diff <= 3 * 24 * 60 * 60 * 1000;
  });

  // Gráficos
  const intimacoesPorMes = (() => {
    const meses: Record<string, number> = {};
    intimacoes.forEach((i: any) => {
      if (!i._data) return;
      const key = i._data.slice(0, 7);
      meses[key] = (meses[key] || 0) + 1;
    });
    return Object.entries(meses)
      .sort(([a], [b]) => a.localeCompare(b)).slice(-6)
      .map(([key]) => {
        const [, m] = key.split("-");
        const nomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
        return { month: nomes[parseInt(m)-1], total: meses[key] };
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

  return (
    <div>
      {/* ── Banners de status ── */}
      <div className="flex flex-wrap gap-2 mb-5">
        <StatusBadge ok label="Datajud CNJ — conectado e operacional" />
        <StatusBadge ok={aaspConectada}
          label={aaspConectada ? `AASP — ${intimacoes.length} intimação(ões) carregada(s)` : "AASP — aguardando sincronização"} />
      </div>

      {/* ── Cards de estatísticas — linha 1 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
        {/* Intimações de HOJE */}
        <div
          onClick={() => onNavigate?.("intimacoes")}
          className="bg-card border border-accent/40 rounded-xl p-4 cursor-pointer hover:border-accent transition-colors group"
        >
          <div className="text-[0.65rem] font-bold uppercase tracking-widest text-accent mb-1">Intimações Hoje</div>
          <div className="font-display text-3xl font-black text-accent group-hover:scale-105 transition-transform">
            {intimacoesHoje.length}
          </div>
          <div className="text-[0.65rem] text-muted-foreground mt-0.5">publicações do dia</div>
          {intimacoesNaoLidas.length > 0 && (
            <div className="mt-1.5 text-[0.6rem] bg-accent/10 text-accent px-1.5 py-0.5 rounded font-bold inline-block">
              {intimacoesNaoLidas.length} não lida(s)
            </div>
          )}
        </div>

        {/* Processos */}
        <div
          onClick={() => onNavigate?.("processos")}
          className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-accent/40 transition-colors"
        >
          <div className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground mb-1">Processos</div>
          <div className="font-display text-3xl font-black">{processos.length}</div>
          <div className="text-[0.65rem] text-muted-foreground mt-0.5">cadastrados</div>
          <div className="mt-1.5 text-[0.6rem] text-muted-foreground">
            {processos.filter(p => p.status === "ativo").length} ativos
          </div>
        </div>

        {/* Clientes */}
        <div
          onClick={() => onNavigate?.("clientes")}
          className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-accent/40 transition-colors"
        >
          <div className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground mb-1">Clientes</div>
          <div className="font-display text-3xl font-black">{clientes.length}</div>
          <div className="text-[0.65rem] text-muted-foreground mt-0.5">cadastrados</div>
          {clientesNotificadosHoje > 0 && (
            <div className="mt-1.5 text-[0.6rem] bg-green-ok/10 text-green-ok px-1.5 py-0.5 rounded font-bold inline-block">
              {clientesNotificadosHoje} notificado(s) hoje
            </div>
          )}
        </div>

        {/* Tarefas pendentes */}
        <div
          onClick={() => onNavigate?.("tarefas")}
          className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-accent/40 transition-colors"
        >
          <div className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground mb-1">Tarefas</div>
          <div className="font-display text-3xl font-black">{tarefasPendentes.length}</div>
          <div className="text-[0.65rem] text-muted-foreground mt-0.5">pendentes</div>
          <div className="mt-1.5 text-[0.6rem] text-muted-foreground">
            {tarefas.filter(t => t.status === "concluida").length} concluídas
          </div>
        </div>

        {/* A vencer (3 dias) */}
        <div
          onClick={() => onNavigate?.("tarefas")}
          className={`rounded-xl p-4 border cursor-pointer transition-colors ${
            tarefasAVencer.length > 0
              ? "bg-accent/5 border-accent/40 hover:border-accent"
              : "bg-card border-border hover:border-accent/40"
          }`}
        >
          <div className="text-[0.65rem] font-bold uppercase tracking-widest text-accent mb-1">A Vencer</div>
          <div className={`font-display text-3xl font-black ${tarefasAVencer.length > 0 ? "text-accent" : ""}`}>
            {tarefasAVencer.length}
          </div>
          <div className="text-[0.65rem] text-muted-foreground mt-0.5">próximos 3 dias</div>
        </div>

        {/* Vencidas */}
        <div
          onClick={() => onNavigate?.("tarefas")}
          className={`rounded-xl p-4 border cursor-pointer transition-colors ${
            tarefasVencidas.length > 0
              ? "bg-red-alert/5 border-red-alert/40 hover:border-red-alert"
              : "bg-card border-border hover:border-accent/40"
          }`}
        >
          <div className="text-[0.65rem] font-bold uppercase tracking-widest text-red-alert mb-1">Vencidas</div>
          <div className={`font-display text-3xl font-black ${tarefasVencidas.length > 0 ? "text-red-alert" : ""}`}>
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

      {/* ── Gráficos ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-5">
        <ChartCard title="Processos por Status">
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie
                data={[
                  { name: "Ativo",     value: processos.filter(p => p.status === "ativo").length,     color: "#10b981" },
                  { name: "Arquivado", value: processos.filter(p => p.status === "arquivado").length, color: "#6b7280" },
                  { name: "Pendente",  value: processos.filter(p => p.status === "pendente").length,  color: "#f59e0b" },
                ]}
                cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={2} dataKey="value"
              >
                {["#10b981","#6b7280","#f59e0b"].map((color, i) => <Cell key={i} fill={color} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Intimações por Mês">
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={intimacoesPorMes.length ? intimacoesPorMes : [{ month: "—", total: 0 }]}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="total" fill="#c9a84c" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Tarefas — Concluídas x Abertas">
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={tarefasPorMes.length ? tarefasPorMes : [{ month: "—", Concluídas: 0, Abertas: 0 }]}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line type="monotone" dataKey="Concluídas" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981", r: 4 }} />
              <Line type="monotone" dataKey="Abertas"    stroke="#f59e0b" strokeWidth={2} dot={{ fill: "#f59e0b", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Últimas Intimações + Agenda ── */}
      <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-3.5 mb-5">
        <div className="bg-card rounded-xl p-5 border border-border">
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

        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="text-[0.72rem] font-bold text-foreground uppercase tracking-widest mb-3.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-[18px] h-0.5 bg-accent" />
              Agenda de Tarefas
            </div>
            <button onClick={() => onNavigate?.("tarefas")} className="text-[0.65rem] text-accent hover:underline font-semibold">
              VER COMPLETO →
            </button>
          </div>
          <MiniCalendario tarefas={tarefas} />
        </div>
      </div>

      {/* ── Prazos críticos ── */}
      {tarefasAVencer.length > 0 && (
        <div className="bg-card rounded-xl p-5 border border-accent/30 mb-5">
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
        <div className="bg-card rounded-xl p-5 border border-red-alert/30 mb-5">
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

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl p-5 border border-border">
      <div className="text-[0.72rem] font-bold text-foreground uppercase tracking-widest mb-3.5 flex items-center gap-1.5">
        <div className="w-[18px] h-0.5 bg-accent" />
        {title}
      </div>
      {children}
    </div>
  );
}

// ── Mini Calendário ────────────────────────────────────────────────────────────
function MiniCalendario({ tarefas }: { tarefas: any[] }) {
  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}-${String(hoje.getDate()).padStart(2,"0")}`;
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const nomesMeses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const diasSemana = ["S","T","Q","Q","S","S","D"];
  const primeiroDia = new Date(ano, mes, 1);
  const ultimoDia   = new Date(ano, mes + 1, 0);
  const offsetInicio = (primeiroDia.getDay() + 6) % 7;
  const totalCelulas = Math.ceil((offsetInicio + ultimoDia.getDate()) / 7) * 7;
  const tarefasPorDia = tarefas.reduce<Record<string, any[]>>((acc, t) => {
    if (!t.data_vencimento) return acc;
    const d = t.data_vencimento.slice(0, 10);
    (acc[d] = acc[d] || []).push(t);
    return acc;
  }, {});
  const cells = Array.from({ length: totalCelulas }, (_, i) => {
    const diaNum = i - offsetInicio + 1;
    if (diaNum < 1 || diaNum > ultimoDia.getDate()) return null;
    const diaStr = `${ano}-${String(mes+1).padStart(2,"0")}-${String(diaNum).padStart(2,"0")}`;
    return { diaNum, diaStr };
  });
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => { if (mes===0){setMes(11);setAno(a=>a-1);}else setMes(m=>m-1); }} className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted font-bold">‹</button>
        <span className="text-xs font-bold">{nomesMeses[mes].slice(0,3)} · {ano}</span>
        <button onClick={() => { if (mes===11){setMes(0);setAno(a=>a+1);}else setMes(m=>m+1); }} className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted font-bold">›</button>
      </div>
      <div className="grid grid-cols-7 mb-1">{diasSemana.map((d,i) => <div key={i} className="text-center text-[0.6rem] font-bold text-muted-foreground">{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-px">
        {cells.map((cell, idx) => {
          if (!cell) return <div key={`e-${idx}`} className="h-9" />;
          const { diaNum, diaStr } = cell;
          const isHoje = diaStr === hojeStr;
          const ts = tarefasPorDia[diaStr] || [];
          const temVencida = ts.some((t:any) => t.status !== "concluida" && diaStr < hojeStr);
          const temHoje    = ts.some((t:any) => t.status !== "concluida" && diaStr === hojeStr);
          const temFutura  = ts.some((t:any) => t.status !== "concluida" && diaStr > hojeStr);
          const temConc    = ts.length > 0 && ts.every((t:any) => t.status === "concluida");
          const dotColor   = temVencida ? "bg-[#8b2020]" : temHoje ? "bg-[#c9a84c]" : temFutura ? "bg-[#a08a50]" : temConc ? "bg-[#d6cfc4]" : "";
          return (
            <div key={diaStr} title={ts.map((t:any) => t.titulo).join(", ")}
              className={`h-9 rounded flex flex-col items-center justify-center relative cursor-default ${isHoje ? "ring-2 ring-accent ring-offset-1 ring-offset-card" : ""} ${idx%7>=5 ? "bg-muted/30" : ""}`}>
              <span className={`text-[0.68rem] font-semibold leading-none ${isHoje ? "text-accent font-bold" : "text-foreground"}`}>{diaNum}</span>
              {dotColor && <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${dotColor}`} />}
              {ts.length > 1 && <span className="absolute top-0.5 right-1 text-[0.5rem] font-bold text-muted-foreground">{ts.length}</span>}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 mt-3 justify-center">
        {[{cor:"bg-[#8b2020]",label:"Vencida"},{cor:"bg-[#c9a84c]",label:"Hoje"},{cor:"bg-[#a08a50]",label:"Próximos"},{cor:"bg-[#d6cfc4]",label:"Concluída"}].map(({cor,label}) => (
          <span key={label} className="flex items-center gap-1 text-[0.6rem] text-muted-foreground">
            <span className={`w-2 h-2 rounded-full ${cor}`} /> {label}
          </span>
        ))}
      </div>
    </div>
  );
}
