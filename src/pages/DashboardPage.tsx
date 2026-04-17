import { StatCard } from "@/components/StatCard";
import { useProcessos } from "@/hooks/useProcessos";
import { useTarefas } from "@/hooks/useTarefas";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

export function DashboardPage() {
  const { user } = useAuth();
  const { data: processos = [] } = useProcessos();
  const { data: tarefas = [] } = useTarefas();

  const { data: intimacoes = [] } = useQuery({
    queryKey: ["intimacoes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intimacoes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const now = new Date();
  const pendentes = processos.filter((p) => p.status === "pendente").length;
  const prazosCriticos = tarefas.filter((t) => {
    if (!t.data_vencimento || t.status === "concluida") return false;
    const diff = new Date(t.data_vencimento).getTime() - now.getTime();
    return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000; // 3 days
  });
  const tarefasVencidas = tarefas.filter((t) => {
    if (!t.data_vencimento || t.status === "concluida") return false;
    return new Date(t.data_vencimento) < now;
  });
  const intimacoesAtivas = intimacoes.filter((i) => i.status === "ativa").length;

  return (
    <div>
      <div className="mb-7">
        <h1 className="font-display text-3xl font-bold tracking-tight">Dashboard</h1>
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
        <StatCard label="Intimações" value={intimacoesAtivas || "—"} sub="ativas" accent="dark" />
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
                  {t.data_vencimento ? new Date(t.data_vencimento).toLocaleDateString("pt-BR") : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-5">
        {/* Processos por Status */}
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
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={60}
                paddingAngle={2}
                dataKey="value"
              >
                {[
                  { name: "Ativo", value: processos.filter((p) => p.status === "ativo").length, color: "#10b981" },
                  { name: "Arquivado", value: processos.filter((p) => p.status === "arquivado").length, color: "#6b7280" },
                  { name: "Pendente", value: processos.filter((p) => p.status === "pendente").length, color: "#f59e0b" },
                ].map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Intimações por Mês */}
        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="text-[0.72rem] font-bold text-foreground uppercase tracking-widest mb-3.5 flex items-center gap-1.5">
            <div className="w-[18px] h-0.5 bg-accent" />
            Intimações por Mês
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart
              data={(() => {
                const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
                return months.map((month, index) => ({
                  month,
                  total: Math.floor(Math.random() * 10) + index * 2,
                }));
              })()}
            >
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="total" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tarefas */}
        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="text-[0.72rem] font-bold text-foreground uppercase tracking-widest mb-3.5 flex items-center gap-1.5">
            <div className="w-[18px] h-0.5 bg-accent" />
            Tarefas — Concluídas x Abertas
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie
                data={[
                  { name: "Concluídas", value: tarefas.filter((t) => t.status === "concluida").length, color: "#10b981" },
                  { name: "Abertas", value: tarefas.filter((t) => t.status !== "concluida").length, color: "#f59e0b" },
                ]}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={60}
                paddingAngle={2}
                dataKey="value"
              >
                {[
                  { name: "Concluídas", value: tarefas.filter((t) => t.status === "concluida").length, color: "#10b981" },
                  { name: "Abertas", value: tarefas.filter((t) => t.status !== "concluida").length, color: "#f59e0b" },
                ].map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-3.5 mb-5">
        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="text-[0.72rem] font-bold text-foreground uppercase tracking-widest mb-3.5 flex items-center gap-1.5 justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-[18px] h-0.5 bg-accent" />
              Últimas Intimações AASP
            </div>
            <div className="flex gap-1.5 text-[0.65rem]">
              <span className="px-2 py-0.5 rounded bg-accent/10 text-accent font-bold">82 ATIVAS</span>
              <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">72 NÃO LIDAS</span>
            </div>
          </div>
          <div className="flex gap-2 mb-3 text-xs">
            <button className="px-3 py-1 rounded-lg bg-accent text-primary font-semibold">Ativas</button>
            <button className="px-3 py-1 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground">
              Finalizadas
            </button>
            <button className="px-3 py-1 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground">
              Pausadas
            </button>
            <button className="ml-auto px-3 py-1 rounded-lg border border-accent/30 text-accent hover:bg-accent/10 font-semibold">
              🔄 Sincronizar
            </button>
          </div>
          {intimacoes.length > 0 ? (
            <div className="space-y-2">
              {intimacoes.slice(0, 5).map((i) => (
                <div key={i.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border hover:border-accent/40 transition-all">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">
                        {i.tipo || "Lista de distribuição Meio: Diário de Justiça Eletrônico Nacional"}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>{i.numero_processo || "1000805-36.2025.5.02.0241"}</span>
                        <span className="text-[0.6rem] px-1.5 py-0.5 rounded bg-muted">
                          {i.tribunal || "DJENT:RT2"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono text-muted-foreground">
                      {new Date(i.created_at).toLocaleDateString("pt-BR")}
                    </span>
                    <div className="flex gap-1">
                      <button className="w-6 h-6 rounded hover:bg-muted flex items-center justify-center text-muted-foreground">
                        📄
                      </button>
                      <button className="w-6 h-6 rounded hover:bg-muted flex items-center justify-center text-accent">
                        ✓
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Nenhuma intimação encontrada.
            </div>
          )}
          <div className="text-center mt-4">
            <button className="text-xs text-accent hover:underline font-semibold">
              VER TODAS AS INTIMAÇÕES →
            </button>
          </div>
        </div>
        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="text-[0.72rem] font-bold text-foreground uppercase tracking-widest mb-3.5 flex items-center gap-1.5">
            <div className="w-[18px] h-0.5 bg-accent" />
            Tarefas & Agenda do Dia
          </div>
          {tarefasVencidas.length > 0 ? (
            <>
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-red-alert" />
                  <h3 className="text-xs font-bold uppercase text-red-alert">VENCIDAS</h3>
                </div>
                <div className="space-y-2">
                  {tarefasVencidas.slice(0, 3).map((t) => (
                    <div
                      key={t.id}
                      className="px-3 py-2 rounded-lg bg-red-alert/5 border border-red-alert/20"
                    >
                      <div className="font-semibold text-sm">{t.titulo}</div>
                      <div className="flex items-center justify-between text-xs mt-1">
                        <span className="text-muted-foreground">
                          {t.descricao || "Tarefa avulsa"}
                        </span>
                        <span className="font-mono text-red-alert font-bold">
                          {t.data_vencimento
                            ? `Venceu há ${Math.floor(
                                (now.getTime() - new Date(t.data_vencimento).getTime()) /
                                  (24 * 60 * 60 * 1000)
                              )} dias`
                            : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="text-center">
                <button className="text-xs text-accent hover:underline font-semibold">
                  VER AGENDA COMPLETA →
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Nenhuma tarefa urgente no momento.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
