import { StatCard } from "@/components/StatCard";
import { useProcessos } from "@/hooks/useProcessos";
import { useTarefas, useCreateTarefa } from "@/hooks/useTarefas";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import type { PageId } from "@/components/AppLayout";
import { CreateTaskModal } from "@/components/CreateTaskModal";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  ResponsiveContainer, XAxis, YAxis, Tooltip, Legend,
} from "recharts";

// Lê intimações do localStorage (mesma chave da IntimacoesPage)
const STORE_KEY = "jm_aasp_intimacoes";
function loadIntimacoes() {
  try {
    const s = localStorage.getItem(STORE_KEY);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}
function fmtData(iso: string): string {
  const p = (iso || "").slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

interface DashboardPageProps {
  onNavigate?: (page: PageId) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { user } = useAuth();
  const { data: processos = [] } = useProcessos();
  const { data: tarefas = [] } = useTarefas();
  const createTarefa = useCreateTarefa();
  const { toast } = useToast();
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [taskModalInitialData, setTaskModalInitialData] = useState<any>(null);

  const intimacoes = loadIntimacoes();
  const intimacoesAtivas = intimacoes.filter((i: any) => (i._status || "ativa") === "ativa");
  const intimacoesNaoLidas = intimacoesAtivas.filter((i: any) => !i._lida);
  const ultimasIntimacoes = intimacoesAtivas.slice(0, 5);

  const now = new Date();
  const pendentes = processos.filter((p) => p.status === "pendente").length;
  const prazosCriticos = tarefas.filter((t) => {
    if (!t.data_vencimento || t.status === "concluida") return false;
    const diff = new Date(t.data_vencimento).getTime() - now.getTime();
    return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
  });
  const tarefasVencidas = tarefas.filter((t) => {
    if (!t.data_vencimento || t.status === "concluida") return false;
    return new Date(t.data_vencimento) < now;
  });

  // Intimações por mês (últimos 6 meses a partir do localStorage)
  const intimacoesPorMes = (() => {
    const meses: Record<string, number> = {};
    intimacoes.forEach((i: any) => {
      if (!i._data) return;
      const key = i._data.slice(0, 7); // YYYY-MM
      meses[key] = (meses[key] || 0) + 1;
    });
    return Object.entries(meses)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, total]) => {
        const [y, m] = key.split("-");
        const nomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
        return { month: nomes[parseInt(m) - 1], total };
      });
  })();

  // Dados para gráfico de linhas de tarefas (últimos 6 meses)
  const tarefasPorMes = (() => {
    const meses: Record<string, { concluidas: number; abertas: number }> = {};
    const hoje = new Date();
    
    // Inicializa os últimos 6 meses
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      meses[key] = { concluidas: 0, abertas: 0 };
    }
    
    tarefas.forEach((t) => {
      const dataRef = t.data_vencimento || t.created_at;
      if (!dataRef) return;
      const key = dataRef.slice(0, 7);
      if (meses[key]) {
        if (t.status === "concluida") {
          meses[key].concluidas++;
        } else {
          meses[key].abertas++;
        }
      }
    });
    
    return Object.entries(meses)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, values]) => {
        const [y, m] = key.split("-");
        const nomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
        return { 
          month: nomes[parseInt(m) - 1], 
          Concluídas: values.concluidas,
          Abertas: values.abertas 
        };
      });
  })();

  // Função para criar tarefa a partir de intimação
  const handleOpenTaskModal = (intimacao: any) => {
    setTaskModalInitialData({
      titulo: `Análise: ${intimacao._titulo || 'Intimação AASP'}`,
      descricao: `Processo: ${intimacao._numProc || 'Não informado'}\nData da intimação: ${fmtData(intimacao._data)}\n\nTrecho: ${intimacao._trecho?.substring(0, 200) || 'Sem detalhes'}`,
      prioridade: "alta",
    });
    setShowCreateTaskModal(true);
  };

  const handleCreateTask = async (data: any) => {
    try {
      await createTarefa.mutateAsync({
        titulo: data.titulo,
        descricao: data.descricao || null,
        data_vencimento: data.data_vencimento || null,
        prioridade: data.prioridade,
        processo_id: data.processo_id || null,
        status: data.status || "pendente",
      });
      toast({ 
        title: "✅ Tarefa criada com sucesso!", 
        description: "A tarefa foi adicionada à sua lista de tarefas." 
      });
      setShowCreateTaskModal(false);
      setTaskModalInitialData(null);
    } catch (err: any) {
      toast({ 
        title: "❌ Erro ao criar tarefa", 
        description: err.message, 
        variant: "destructive" 
      });
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral dos seus processos e prazos</p>
      </div>

      {/* Status Banner */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold mb-5 bg-green-ok/[0.08] border border-green-ok/20 text-green-ok">
        <span>✅</span> API Datajud conectada e operacional
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <StatCard label="Processos" value={processos.length} sub="cadastrados" accent="gold" />
        <StatCard label="Pendentes" value={pendentes} sub="revisão humana" accent="green" />
        <StatCard label="Prazos Críticos" value={prazosCriticos.length} sub="urgência alta" accent="red" />
        <StatCard label="Intimações" value={intimacoesAtivas.length || "—"} sub="ativas" accent="dark" />
        <StatCard label="Tarefas Vencidas" value={tarefasVencidas.length} sub="prazo expirado" accent="red" />
      </div>

      {/* Prazos Críticos */}
      {prazosCriticos.length > 0 && (
        <div className="bg-card rounded-xl p-5 border border-red-alert/30 mb-5">
          <div className="text-[0.72rem] font-bold text-red-alert uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <div className="w-[18px] h-0.5 bg-red-alert" />
            ⚠️ Prazos Críticos — Atenção Imediata
          </div>
          <div className="space-y-2">
            {prazosCriticos.map((t) => (
              <div key={t.id} className="flex items-center justify-between bg-red-alert/5 rounded-lg px-4 py-3 border border-red-alert/10">
                <div>
                  <div className="font-semibold text-sm">{t.titulo}</div>
                  <div className="text-xs text-muted-foreground">{t.descricao || "Sem descrição"}</div>
                </div>
                <div className="text-xs font-mono text-red-alert font-bold">
                  {t.data_vencimento ? t.data_vencimento.slice(0,10).split("-").reverse().join("/") : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-5">
        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="text-[0.72rem] font-bold text-foreground uppercase tracking-widest mb-3.5 flex items-center gap-1.5">
            <div className="w-[18px] h-0.5 bg-accent" />
            Processos por Status
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie
                data={[
                  { name: "Ativo", value: processos.filter((p) => p.status === "ativo").length, color: "#10b981" },
                  { name: "Arquivado", value: processos.filter((p) => p.status === "arquivado").length, color: "#6b7280" },
                  { name: "Pendente", value: processos.filter((p) => p.status === "pendente").length, color: "#f59e0b" },
                ]}
                cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={2} dataKey="value"
              >
                {[
                  { color: "#10b981" }, { color: "#6b7280" }, { color: "#f59e0b" },
                ].map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="text-[0.72rem] font-bold text-foreground uppercase tracking-widest mb-3.5 flex items-center gap-1.5">
            <div className="w-[18px] h-0.5 bg-accent" />
            Intimações por Mês
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={intimacoesPorMes.length > 0 ? intimacoesPorMes : [{ month: "—", total: 0 }]}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="total" fill="#c9a84c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="text-[0.72rem] font-bold text-foreground uppercase tracking-widest mb-3.5 flex items-center gap-1.5">
            <div className="w-[18px] h-0.5 bg-accent" />
            Tarefas — Concluídas x Abertas
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={tarefasPorMes.length > 0 ? tarefasPorMes : [{ month: "—", Concluídas: 0, Abertas: 0 }]}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line 
                type="monotone" 
                dataKey="Concluídas" 
                stroke="#10b981" 
                strokeWidth={2}
                dot={{ fill: "#10b981", r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line 
                type="monotone" 
                dataKey="Abertas" 
                stroke="#f59e0b" 
                strokeWidth={2}
                dot={{ fill: "#f59e0b", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-3.5 mb-5">
        {/* Últimas Intimações */}
        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="text-[0.72rem] font-bold text-foreground uppercase tracking-widest mb-3.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-[18px] h-0.5 bg-accent" />
              Últimas Intimações AASP
            </div>
            <div className="flex gap-1.5 text-[0.65rem]">
              <span className="px-2 py-0.5 rounded bg-accent/10 text-accent font-bold">{intimacoesAtivas.length} ATIVAS</span>
              <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">{intimacoesNaoLidas.length} NÃO LIDAS</span>
            </div>
          </div>

          {ultimasIntimacoes.length > 0 ? (
            <div className="space-y-2">
              {ultimasIntimacoes.map((i: any) => (
                <div key={i._id} className="flex items-start justify-between px-3 py-2.5 rounded-lg border border-border hover:border-accent/40 transition-all gap-2">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1.5" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm line-clamp-1">
                        {i._titulo || "Publicação AASP"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 break-all">
                        {i._numProc || "—"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono text-muted-foreground whitespace-nowrap pt-0.5">
                      {fmtData(i._data)}
                    </span>
                    <button
                      onClick={() => handleOpenTaskModal(i)}
                      className="px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide rounded bg-accent hover:bg-accent/80 text-white transition-colors whitespace-nowrap"
                      title="Criar tarefa a partir desta intimação"
                    >
                      + Tarefa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Nenhuma intimação encontrada. Acesse Intimações e clique em Atualizar.
            </div>
          )}

          <div className="text-center mt-4">
            <button
              onClick={() => onNavigate?.("intimacoes")}
              className="text-xs text-accent hover:underline font-semibold"
            >
              VER TODAS AS INTIMAÇÕES →
            </button>
          </div>
        </div>

        {/* Mini Calendário de Tarefas */}
        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="text-[0.72rem] font-bold text-foreground uppercase tracking-widest mb-3.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-[18px] h-0.5 bg-accent" />
              Agenda de Tarefas
            </div>
            <button
              onClick={() => onNavigate?.("tarefas")}
              className="text-[0.65rem] text-accent hover:underline font-semibold"
            >
              VER COMPLETO →
            </button>
          </div>
          <MiniCalendario tarefas={tarefas} />
        </div>
      </div>

      {/* Modal de Criação de Tarefas */}
      <CreateTaskModal
        open={showCreateTaskModal}
        onClose={() => {
          setShowCreateTaskModal(false);
          setTaskModalInitialData(null);
        }}
        onSubmit={handleCreateTask}
        initialData={taskModalInitialData}
        processos={processos}
      />
    </div>
  );
}

// ── Mini Calendário para o Dashboard ─────────────────────────────────────────
function MiniCalendario({ tarefas }: { tarefas: any[] }) {
  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;

  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());

  const nomesMeses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const diasSemana = ["S","T","Q","Q","S","S","D"];

  const mesAnterior = () => { if (mes === 0) { setMes(11); setAno(a => a - 1); } else setMes(m => m - 1); };
  const proximoMes  = () => { if (mes === 11) { setMes(0); setAno(a => a + 1); } else setMes(m => m + 1); };

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
    const diaStr = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(diaNum).padStart(2, "0")}`;
    return { diaNum, diaStr };
  });

  return (
    <div>
      {/* Controles */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={mesAnterior} className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted text-sm font-bold">‹</button>
        <span className="text-xs font-bold">{nomesMeses[mes].slice(0,3)} · {ano}</span>
        <button onClick={proximoMes} className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted text-sm font-bold">›</button>
      </div>

      {/* Header dias semana */}
      <div className="grid grid-cols-7 mb-1">
        {diasSemana.map((d, i) => (
          <div key={i} className="text-center text-[0.6rem] font-bold text-muted-foreground">{d}</div>
        ))}
      </div>

      {/* Células */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map((cell, idx) => {
          if (!cell) return <div key={`e-${idx}`} className="h-9" />;
          const { diaNum, diaStr } = cell;
          const isHoje = diaStr === hojeStr;
          const ts = tarefasPorDia[diaStr] || [];
          const temVencida = ts.some((t: any) => t.status !== "concluida" && diaStr < hojeStr);
          const temHoje    = ts.some((t: any) => t.status !== "concluida" && diaStr === hojeStr);
          const temFutura  = ts.some((t: any) => t.status !== "concluida" && diaStr > hojeStr);
          const temConc    = ts.length > 0 && ts.every((t: any) => t.status === "concluida");

          const dotColor = temVencida ? "bg-[#8b2020]" : temHoje ? "bg-[#c9a84c]" : temFutura ? "bg-[#a08a50]" : temConc ? "bg-[#d6cfc4]" : "";

          return (
            <div
              key={diaStr}
              title={ts.map((t: any) => t.titulo).join(", ")}
              className={`h-9 rounded flex flex-col items-center justify-center relative cursor-default
                ${isHoje ? "ring-2 ring-accent ring-offset-1 ring-offset-card" : ""}
                ${(idx % 7 >= 5) ? "bg-muted/30" : ""}
              `}
            >
              <span className={`text-[0.68rem] font-semibold leading-none
                ${isHoje ? "text-accent font-bold" : "text-foreground"}
              `}>{diaNum}</span>
              {dotColor && (
                <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${dotColor}`} />
              )}
              {ts.length > 1 && (
                <span className="absolute top-0.5 right-1 text-[0.5rem] font-bold text-muted-foreground">{ts.length}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 mt-3 justify-center">
        {[
          { cor: "bg-[#8b2020]", label: "Vencida" },
          { cor: "bg-[#c9a84c]", label: "Hoje" },
          { cor: "bg-[#a08a50]", label: "Próximos" },
          { cor: "bg-[#d6cfc4]", label: "Concluída" },
        ].map(({ cor, label }) => (
          <span key={label} className="flex items-center gap-1 text-[0.6rem] text-muted-foreground">
            <span className={`w-2 h-2 rounded-full ${cor}`} /> {label}
          </span>
        ))}
      </div>
    </div>
  );
}
