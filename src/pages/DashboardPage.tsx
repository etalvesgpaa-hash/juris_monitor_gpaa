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

  // ── Intimações: inicia com localStorage (imediato) e sincroniza com Supabase ─
  const [intimacoes, setIntimacoes] = useState<any[]>(() => loadIntimacoesCached());

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
            _data:          row.data_publicacao ?? raw._data ?? "",
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
    return new Date(t.data_vencimento) < now;
  });
  const tarefasAVencer = tarefas.filter(t => {
    if (!t.data_vencimento || t.status === "concluida") return false;
    const diff = new Date(t.data_vencimento).getTime() - now.getTime();
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
    
    // Conta intimações por dia
    const contagemPorDia = intimacoes.reduce<Record<string, number>>((acc, it: any) => {
      acc[it._data] = (acc[it._data] || 0) + 1;
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
      {/* ── Cards de estatísticas — linha 1 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
        {/* Intimações de HOJE */}
        <div
          onClick={() => onNavigate?.("intimacoes")}
          className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-2 border-amber-500/40 rounded-xl p-4 cursor-pointer hover:border-amber-500 hover:shadow-lg hover:shadow-amber-500/20 transition-all group"
        >
          <div className="text-[0.65rem] font-bold uppercase tracking-widest text-amber-600 mb-1">Intimações Hoje</div>
          <div className="font-display text-3xl font-black text-amber-600 group-hover:scale-105 transition-transform">
            {intimacoesHoje.length}
          </div>
          <div className="text-[0.65rem] text-muted-foreground mt-0.5">publicações do dia</div>
          {intimacoesNaoLidas.length > 0 && (
            <div className="mt-1.5 text-[0.6rem] bg-amber-500/20 text-amber-700 px-1.5 py-0.5 rounded font-bold inline-block">
              {intimacoesNaoLidas.length} não lida(s)
            </div>
          )}
        </div>

        {/* Processos */}
        <div
          onClick={() => onNavigate?.("processos")}
          className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-2 border-blue-500/40 rounded-xl p-4 cursor-pointer hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/20 transition-all"
        >
          <div className="text-[0.65rem] font-bold uppercase tracking-widest text-blue-600 mb-1">Processos</div>
          <div className="font-display text-3xl font-black text-blue-600">{processos.length}</div>
          <div className="text-[0.65rem] text-muted-foreground mt-0.5">cadastrados</div>
          <div className="mt-1.5 text-[0.6rem] bg-blue-500/20 text-blue-700 px-1.5 py-0.5 rounded font-bold inline-block">
            {processos.filter(p => p.status === "ativo").length} ativos
          </div>
        </div>

        {/* Clientes */}
        <div
          onClick={() => onNavigate?.("clientes")}
          className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-2 border-purple-500/40 rounded-xl p-4 cursor-pointer hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/20 transition-all"
        >
          <div className="text-[0.65rem] font-bold uppercase tracking-widest text-purple-600 mb-1">Clientes</div>
          <div className="font-display text-3xl font-black text-purple-600">{clientes.length}</div>
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
          onClick={() => onNavigate?.("tarefas")}
          className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-2 border-cyan-500/40 rounded-xl p-4 cursor-pointer hover:border-cyan-500 hover:shadow-lg hover:shadow-cyan-500/20 transition-all"
        >
          <div className="text-[0.65rem] font-bold uppercase tracking-widest text-cyan-600 mb-1">Tarefas</div>
          <div className="font-display text-3xl font-black text-cyan-600">{tarefasPendentes.length}</div>
          <div className="text-[0.65rem] text-muted-foreground mt-0.5">pendentes</div>
          <div className="mt-1.5 text-[0.6rem] bg-cyan-500/20 text-cyan-700 px-1.5 py-0.5 rounded font-bold inline-block">
            {tarefas.filter(t => t.status === "concluida").length} concluídas
          </div>
        </div>

        {/* A vencer (3 dias) */}
        <div
          onClick={() => onNavigate?.("tarefas")}
          className={`rounded-xl p-4 border-2 cursor-pointer transition-all ${
            tarefasAVencer.length > 0
              ? "bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/40 hover:border-orange-500 hover:shadow-lg hover:shadow-orange-500/20"
              : "bg-card border-border hover:border-accent/40"
          }`}
        >
          <div className={`text-[0.65rem] font-bold uppercase tracking-widest mb-1 ${tarefasAVencer.length > 0 ? "text-orange-600" : "text-muted-foreground"}`}>A Vencer</div>
          <div className={`font-display text-3xl font-black ${tarefasAVencer.length > 0 ? "text-orange-600" : ""}`}>
            {tarefasAVencer.length}
          </div>
          <div className="text-[0.65rem] text-muted-foreground mt-0.5">próximos 3 dias</div>
        </div>

        {/* Vencidas */}
        <div
          onClick={() => onNavigate?.("tarefas")}
          className={`rounded-xl p-4 border-2 cursor-pointer transition-all ${
            tarefasVencidas.length > 0
              ? "bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/40 hover:border-red-500 hover:shadow-lg hover:shadow-red-500/20"
              : "bg-card border-border hover:border-accent/40"
          }`}
        >
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

        <ChartCard title="Intimações — Últimos 7 Dias Úteis">
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={intimacoesUltimos7Dias.length ? intimacoesUltimos7Dias : [{ day: "—", total: 0 }]}>
              <XAxis dataKey="day" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="total" fill="#d97706" radius={[4,4,0,0]} />
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
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-3.5 mb-5">
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

        <div>
          <AgendaCalendario tarefas={tarefas} onNavigate={onNavigate} />
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
    if (t.status === "concluida") return "bg-[#d6cfc4] text-[#6b6358]";
    const d = t.data_vencimento?.slice(0, 10) || "";
    if (d < hojeStr) return "bg-[#8b2020] text-white";
    if (d === hojeStr) return "bg-[#c9a84c] text-white";
    return "bg-[#a08a50] text-white"; // próximos dias
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
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#8b2020]" /> Vencida</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#c9a84c]" /> Hoje</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#a08a50]" /> Próximos dias</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#d6cfc4]" /> Concluída</span>
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
