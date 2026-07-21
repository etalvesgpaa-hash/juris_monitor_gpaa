import { useEffect, useMemo, useRef, useState } from "react";
import { useClientes } from "@/hooks/useClientes";
import { useProcessos } from "@/hooks/useProcessos";
import { useTarefas } from "@/hooks/useTarefas";
import { useAdminProfiles, useAdminTarefas } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity, BriefcaseBusiness, CheckCircle2, Eye, EyeOff, FileText, Maximize2, Pause, Play, Users, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const INTIMACOES_KEY = "jm_aasp_intimacoes";

function todayLocal() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function loadIntimacoes() {
  try { return JSON.parse(localStorage.getItem(INTIMACOES_KEY) || "[]") as any[]; } catch { return []; }
}

export function TvDashboard({ onClose }: { onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { user, isAdmin } = useAuth();
  const { data: tarefas = [] } = useTarefas();
  const { data: adminTarefas = [] } = useAdminTarefas();
  const { data: profiles = [] } = useAdminProfiles();
  const { data: processos = [] } = useProcessos();
  const { data: clientes = [] } = useClientes();
  const [intimacoes, setIntimacoes] = useState<any[]>(loadIntimacoes);
  const [slide, setSlide] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [privacy, setPrivacy] = useState(true);
  const [clock, setClock] = useState(new Date());
  const { data: notificacoesHoje = [] } = useQuery({
    queryKey: ["tv", "notificacoes-hoje", user?.id],
    queryFn: async () => {
      const start = `${todayLocal()}T00:00:00`;
      const end = `${todayLocal()}T23:59:59`;
      const { data, error } = await supabase.from("notificacoes_enviadas" as any).select("cliente_id").eq("status", "enviado").gte("created_at", start).lte("created_at", end);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(new Date());
      setIntimacoes(loadIntimacoes());
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setSlide(current => (current + 1) % 4), 20_000);
    return () => window.clearInterval(timer);
  }, [playing]);

  const today = todayLocal();
  const abertas = tarefas.filter(t => t.status !== "concluida" && t.status !== "cancelada");
  const concluidas = tarefas.filter(t => t.status === "concluida");
  const vencidas = abertas.filter(t => t.data_vencimento && t.data_vencimento.slice(0, 10) < today);
  const taxaConclusao = tarefas.length ? Math.round((concluidas.length / tarefas.length) * 100) : 0;
  const saudeOperacional = Math.max(0, Math.min(100, Math.round(100 - (vencidas.length / Math.max(abertas.length, 1)) * 100)));
  const intimacoesAtivas = intimacoes.filter(item => (item._status || "ativa") === "ativa");
  const intimacoesHoje = intimacoesAtivas.filter(item => (item._data || "").slice(0, 10) === today);
  const naoLidas = intimacoesAtivas.filter(item => !item._lida);
  const teamTasks = isAdmin && adminTarefas.length ? adminTarefas : tarefas;
  const normalizeProcess = (value: string) => String(value || "").replace(/\D/g, "");
  const clientProcessMap = clientes.flatMap((client: any) => (client.numeros_processo || []).map((number: string) => ({ clientId: client.id, number: normalizeProcess(number) })).filter((item: any) => item.number));
  const matchedIntimations = intimacoesAtivas.filter(item => {
    const number = normalizeProcess(item._numProc || item.numero_processo || "");
    return number && clientProcessMap.some((entry: any) => number.includes(entry.number) || entry.number.includes(number));
  });
  const clientsWithIntimations = new Set(matchedIntimations.flatMap(item => {
    const number = normalizeProcess(item._numProc || item.numero_processo || "");
    return clientProcessMap.filter((entry: any) => number.includes(entry.number) || entry.number.includes(number)).map((entry: any) => entry.clientId);
  })).size;
  const notifiedClientsToday = new Set((notificacoesHoje as any[]).map(item => item.cliente_id)).size;
  const linkedPercent = intimacoesAtivas.length ? Math.round((matchedIntimations.length / intimacoesAtivas.length) * 100) : 0;
  const tasksByUser = useMemo(() => {
    const grouped = new Map<string, { id: string; name: string; total: number; abertas: number; concluidas: number; vencidas: number }>();
    teamTasks.forEach((task: any) => {
      const id = task.delegado_para || task.user_id || "sem-responsavel";
      const profile: any = profiles.find((item: any) => item.user_id === id);
      const current = grouped.get(id) || { id, name: profile?.full_name || (id === user?.id ? (user?.user_metadata?.full_name || "Minha carteira") : "Usuário"), total: 0, abertas: 0, concluidas: 0, vencidas: 0 };
      current.total += 1;
      if (task.status === "concluida") current.concluidas += 1;
      else if (task.status !== "cancelada") {
        current.abertas += 1;
        if (task.data_vencimento && task.data_vencimento.slice(0, 10) < today) current.vencidas += 1;
      }
      grouped.set(id, current);
    });
    return Array.from(grouped.values()).sort((a, b) => b.abertas - a.abertas).slice(0, 8);
  }, [teamTasks, profiles, user?.id, user?.user_metadata?.full_name, today]);

  const statusTarefas = [
    { name: "Triagem", value: tarefas.filter(t => t.status === "triagem" || t.status === "pendente").length, color: "#94a3b8" },
    { name: "Elaboração", value: tarefas.filter(t => t.status === "elaboracao").length, color: "#a78bfa" },
    { name: "Andamento", value: tarefas.filter(t => t.status === "andamento").length, color: "#38bdf8" },
    { name: "Concluídas", value: concluidas.length, color: "#34d399" },
  ];
  const statusProcessos = [
    { name: "Ativos", value: processos.filter(p => p.status === "ativo").length, color: "#34d399" },
    { name: "Pendentes", value: processos.filter(p => p.status === "pendente").length, color: "#fbbf24" },
    { name: "Arquivados", value: processos.filter(p => p.status === "arquivado").length, color: "#64748b" },
  ];

  const intimacoesSemana = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(); date.setDate(date.getDate() - (6 - index));
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      return { key, day: date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""), total: 0 };
    });
    intimacoesAtivas.forEach(item => { const found = days.find(day => day.key === (item._data || "").slice(0, 10)); if (found) found.total += 1; });
    return days;
  }, [intimacoesAtivas]);

  const cargaSemana = useMemo(() => Array.from({ length: 14 }, (_, index) => {
    const date = new Date(); date.setDate(date.getDate() + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { key, label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), total: abertas.filter(t => t.data_vencimento?.slice(0, 10) === key).length };
  }), [abertas]);

  const requestFullscreen = () => rootRef.current?.requestFullscreen?.();

  return (
    <div ref={rootRef} className="fixed inset-0 z-[200] overflow-hidden bg-[#07101f] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(197,154,50,0.12),transparent_34%),radial-gradient(circle_at_100%_100%,rgba(14,116,144,0.13),transparent_38%)]" />
      <div className="relative flex h-full flex-col px-[clamp(18px,2.2vw,42px)] py-[clamp(16px,2vh,28px)]">
        <header className="flex items-center gap-4 border-b border-white/10 pb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#c59a32] font-display font-bold text-[#07101f]">JM</div>
          <div><p className="text-[0.62rem] font-bold uppercase tracking-[0.24em] text-[#c59a32]">Painel TV</p><h1 className="font-display text-xl font-semibold">JurisMonitor · Visão do escritório</h1></div>
          <div className="ml-auto text-right"><p className="font-display text-2xl font-semibold tabular-nums">{clock.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p><p className="text-[0.62rem] text-slate-400">Atualização automática · 30s</p></div>
          <div className="flex gap-1.5">
            <TvControl onClick={() => setPrivacy(value => !value)} label={privacy ? "Desativar privacidade" : "Ativar privacidade"}>{privacy ? <EyeOff /> : <Eye />}</TvControl>
            <TvControl onClick={() => setPlaying(value => !value)} label={playing ? "Pausar rotação" : "Continuar rotação"}>{playing ? <Pause /> : <Play />}</TvControl>
            <TvControl onClick={requestFullscreen} label="Tela cheia"><Maximize2 /></TvControl>
            <TvControl onClick={onClose} label="Fechar"><X /></TvControl>
          </div>
        </header>

        <main className="min-h-0 flex-1 py-5">
          {slide === 0 && <ClientsIntimationsSlide clientes={clientes.length} clientsWithIntimations={clientsWithIntimations} notifiedToday={notifiedClientsToday} linked={matchedIntimations.length} unlinked={Math.max(0, intimacoesAtivas.length - matchedIntimations.length)} linkedPercent={linkedPercent} intimacoesHoje={intimacoesHoje.length} naoLidas={naoLidas.length} intimacoesData={intimacoesSemana} />}
          {slide === 1 && <TeamTasksSlide data={tasksByUser} privacy={privacy} isAdmin={isAdmin} total={teamTasks.length} />}
          {slide === 2 && <IntimationsProductivitySlide intimacoesHoje={intimacoesHoje.length} naoLidas={naoLidas.length} clientsWithIntimations={clientsWithIntimations} linkedPercent={linkedPercent} notifiedToday={notifiedClientsToday} intimacoesData={intimacoesSemana} taxa={taxaConclusao} />}
          {slide === 3 && <OperationalSlide abertas={abertas.length} vencidas={vencidas.length} concluidas={concluidas.length} taxa={taxaConclusao} saude={saudeOperacional} processosAtivos={statusProcessos[0].value} processData={statusProcessos} heatData={cargaSemana} />}
        </main>

        <footer className="flex items-center justify-between border-t border-white/10 pt-3 text-[0.65rem] text-slate-400">
          <span>{privacy ? "Modo privacidade ativo · dados sensíveis ocultos" : "Modo interno · exibição autorizada"}</span>
          <div className="flex gap-2">{[0, 1, 2, 3].map(index => <button key={index} onClick={() => setSlide(index)} className={`h-1.5 rounded-full transition-all ${slide === index ? "w-9 bg-[#c59a32]" : "w-4 bg-white/20"}`} aria-label={`Abrir painel ${index + 1}`} />)}</div>
          <span>Painel {slide + 1} de 4 · troca a cada 20s</span>
        </footer>
      </div>
    </div>
  );
}

function ClientsIntimationsSlide({ clientes, clientsWithIntimations, notifiedToday, linked, unlinked, linkedPercent, intimacoesHoje, naoLidas, intimacoesData }: any) {
  const relationData = [{ name: "Vinculadas", value: linked, color: "#34d399" }, { name: "Sem cliente", value: unlinked, color: "#fbbf24" }];
  return <div className="grid h-full grid-cols-12 grid-rows-[auto_1fr] gap-4">
    <div className="col-span-12 grid grid-cols-6 gap-3"><TvKpi icon={Users} label="Clientes cadastrados" value={clientes} /><TvKpi icon={Users} label="Clientes com intimações" value={clientsWithIntimations} /><TvKpi icon={CheckCircle2} label="Clientes notificados hoje" value={notifiedToday} /><TvKpi icon={FileText} label="Intimações vinculadas" value={linked} /><TvKpi icon={Activity} label="Intimações hoje" value={intimacoesHoje} /><TvKpi icon={EyeOff} label="Não lidas" value={naoLidas} danger={naoLidas > 0} /></div>
    <TvPanel className="col-span-3"><Gauge value={linkedPercent} label="Vinculação com clientes" color="#34d399" /><p className="text-center text-xs text-slate-400">Intimações reconhecidas pelos processos cadastrados</p></TvPanel>
    <TvPanel className="col-span-4" title="Intimações vinculadas x pendentes"><Donut data={relationData} center={`${linkedPercent}%`} large /></TvPanel>
    <TvPanel className="col-span-5" title="Entrada de intimações · últimos 7 dias"><ResponsiveContainer width="100%" height="88%"><LineChart data={intimacoesData}><CartesianGrid stroke="#ffffff12" vertical={false} /><XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip content={<DarkTooltip />} /><Line type="monotone" dataKey="total" name="Intimações" stroke="#c59a32" strokeWidth={4} dot={{ fill: "#c59a32", r: 5 }} /></LineChart></ResponsiveContainer></TvPanel>
  </div>;
}

function TeamTasksSlide({ data, privacy, isAdmin, total }: any) {
  const displayData = data.map((item: any, index: number) => ({ ...item, displayName: privacy ? `Usuário ${index + 1}` : item.name.split(" ").slice(0, 2).join(" ") }));
  const overloaded = data.filter((item: any) => item.vencidas > 0).length;
  return <div className="grid h-full grid-cols-12 gap-4">
    <TvPanel className="col-span-8" title={isAdmin ? "Carga de tarefas por usuário" : "Carga de tarefas visível para este usuário"}>
      <ResponsiveContainer width="100%" height="88%"><BarChart data={displayData} layout="vertical" margin={{ left: 36, right: 20 }}><CartesianGrid stroke="#ffffff12" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="displayName" width={100} tick={{ fill: "#cbd5e1", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip content={<DarkTooltip />} /><Bar dataKey="concluidas" name="Concluídas" stackId="tasks" fill="#34d399" /><Bar dataKey="abertas" name="Abertas" stackId="tasks" fill="#38bdf8" /><Bar dataKey="vencidas" name="Vencidas" stackId="tasks" fill="#f87171" radius={[0, 7, 7, 0]} /></BarChart></ResponsiveContainer>
      <div className="flex gap-5 text-[0.65rem] text-slate-400"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#34d399]" />Concluídas</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#38bdf8]" />Abertas</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#f87171]" />Vencidas</span></div>
    </TvPanel>
    <div className="col-span-4 grid grid-rows-3 gap-4"><TvKpi icon={CheckCircle2} label="Tarefas da equipe" value={total} /><TvKpi icon={Users} label="Usuários com tarefas" value={data.length} /><TvKpi icon={Activity} label="Usuários com atrasos" value={overloaded} danger={overloaded > 0} /></div>
    {!isAdmin && <TvPanel className="col-span-12 flex items-center justify-between px-8"><p className="font-semibold">Visão individual ativa</p><p className="text-sm text-slate-400">A consolidação de toda a equipe é exibida quando o Painel TV é aberto por um administrador.</p></TvPanel>}
  </div>;
}

function IntimationsProductivitySlide({ intimacoesHoje, naoLidas, clientsWithIntimations, linkedPercent, notifiedToday, intimacoesData, taxa }: any) {
  return <div className="grid h-full grid-cols-12 gap-4">
    <TvPanel className="col-span-3"><Gauge value={linkedPercent} label="Clientes identificados" color="#34d399" /><Mini value={notifiedToday} label="Clientes notificados hoje" /></TvPanel>
    <TvPanel className="col-span-3"><Gauge value={taxa} label="Conclusão de tarefas" color="#c59a32" /><Mini value={clientsWithIntimations} label="Clientes impactados" /></TvPanel>
    <TvPanel className="col-span-6" title="Ritmo de entrada das intimações"><ResponsiveContainer width="100%" height="88%"><BarChart data={intimacoesData}><CartesianGrid stroke="#ffffff12" vertical={false} /><XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip content={<DarkTooltip />} /><Bar dataKey="total" name="Intimações" fill="#c59a32" radius={[8, 8, 2, 2]} maxBarSize={44} /></BarChart></ResponsiveContainer></TvPanel>
    <div className="col-span-12 grid grid-cols-3 gap-4"><TvKpi icon={FileText} label="Intimações recebidas hoje" value={intimacoesHoje} /><TvKpi icon={EyeOff} label="Aguardando leitura" value={naoLidas} danger={naoLidas > 0} /><TvKpi icon={Users} label="Clientes relacionados" value={clientsWithIntimations} /></div>
  </div>;
}

function OperationalSlide({ abertas, vencidas, concluidas, taxa, saude, processosAtivos, processData, heatData }: any) {
  const max = Math.max(...heatData.map((item: any) => item.total), 1);
  return <div className="grid h-full grid-cols-12 gap-4">
    <TvPanel className="col-span-3"><Gauge value={saude} label="Saúde operacional" color={saude > 70 ? "#34d399" : saude > 40 ? "#fbbf24" : "#f87171"} /><div className="grid grid-cols-3 gap-2"><Mini value={abertas} label="Abertas" /><Mini value={vencidas} label="Vencidas" danger /><Mini value={concluidas} label="Concluídas" /></div></TvPanel>
    <TvPanel className="col-span-3"><Gauge value={taxa} label="Produtividade" color="#c59a32" /><TvKpi icon={BriefcaseBusiness} label="Processos ativos" value={processosAtivos} /></TvPanel>
    <TvPanel className="col-span-2" title="Status dos processos"><Donut data={processData} center={`${processosAtivos}`} /></TvPanel>
    <TvPanel className="col-span-4" title="Carga de tarefas · próximos 14 dias"><div className="grid h-[88%] grid-cols-7 gap-2 pt-3">{heatData.map((item: any) => <div key={item.key} className="flex flex-col items-center justify-center rounded-xl border border-white/8" style={{ backgroundColor: `rgba(197,154,50,${0.08 + (item.total / max) * 0.72})` }}><strong className="text-xl">{item.total}</strong><span className="text-[0.55rem] text-slate-300">{item.label}</span></div>)}</div></TvPanel>
  </div>;
}

function OverviewSlide({ tarefas, abertas, vencidas, processos, clientes, intimacoes, taxa, saude, taskData, processData }: any) {
  return <div className="grid h-full grid-cols-12 grid-rows-[auto_1fr] gap-4">
    <div className="col-span-12 grid grid-cols-6 gap-3"><TvKpi icon={BriefcaseBusiness} label="Processos" value={processos} /><TvKpi icon={CheckCircle2} label="Tarefas" value={tarefas} /><TvKpi icon={Activity} label="Demandas abertas" value={abertas} /><TvKpi icon={FileText} label="Intimações hoje" value={intimacoes} /><TvKpi icon={Users} label="Clientes" value={clientes} /><TvKpi icon={Activity} label="Vencidas" value={vencidas} danger={vencidas > 0} /></div>
    <TvPanel className="col-span-3"><Gauge value={saude} label="Saúde operacional" color={saude > 70 ? "#34d399" : saude > 40 ? "#fbbf24" : "#f87171"} /><p className="text-center text-xs text-slate-400">Considera a proporção de tarefas vencidas</p></TvPanel>
    <TvPanel className="col-span-3"><Gauge value={taxa} label="Taxa de conclusão" color="#c59a32" /><p className="text-center text-xs text-slate-400">Percentual de demandas concluídas</p></TvPanel>
    <TvPanel className="col-span-3" title="Fluxo das tarefas"><Donut data={taskData} center="Status" /></TvPanel>
    <TvPanel className="col-span-3" title="Carteira processual"><Donut data={processData} center="Processos" /></TvPanel>
  </div>;
}

function TasksSlide({ abertas, vencidas, concluidas, taxa, statusData, heatData }: any) {
  const max = Math.max(...heatData.map((item: any) => item.total), 1);
  return <div className="grid h-full grid-cols-12 gap-4">
    <TvPanel className="col-span-3"><Gauge value={taxa} label="Produtividade" color="#34d399" /><div className="mt-1 grid grid-cols-3 gap-2 text-center"><Mini value={abertas} label="Abertas" /><Mini value={vencidas} label="Vencidas" danger /><Mini value={concluidas} label="Concluídas" /></div></TvPanel>
    <TvPanel className="col-span-5" title="Demandas por etapa"><ResponsiveContainer width="100%" height="88%"><BarChart data={statusData} layout="vertical" margin={{ left: 18 }}><CartesianGrid stroke="#ffffff12" horizontal={false} /><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={90} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip content={<DarkTooltip />} /><Bar dataKey="value" radius={[0, 8, 8, 0]}>{statusData.map((item: any) => <Cell key={item.name} fill={item.color} />)}</Bar></BarChart></ResponsiveContainer></TvPanel>
    <TvPanel className="col-span-4" title="Mapa de carga · próximos 14 dias"><div className="grid h-[82%] grid-cols-7 gap-2 pt-5">{heatData.map((item: any) => <div key={item.key} className="flex flex-col items-center justify-center rounded-xl border border-white/8" style={{ backgroundColor: `rgba(197,154,50,${0.08 + (item.total / max) * 0.72})` }}><strong className="text-xl">{item.total}</strong><span className="text-[0.58rem] text-slate-300">{item.label}</span></div>)}</div></TvPanel>
  </div>;
}

function PortfolioSlide({ processos, clientes, intimacoesHoje, naoLidas, processData, intimacoesData, privacy }: any) {
  return <div className="grid h-full grid-cols-12 gap-4">
    <TvPanel className="col-span-4" title="Distribuição dos processos"><Donut data={processData} center={`${processos}`} large /></TvPanel>
    <TvPanel className="col-span-5" title="Intimações · últimos 7 dias"><ResponsiveContainer width="100%" height="88%"><LineChart data={intimacoesData}><CartesianGrid stroke="#ffffff12" vertical={false} /><XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip content={<DarkTooltip />} /><Line type="monotone" dataKey="total" stroke="#c59a32" strokeWidth={4} dot={{ fill: "#c59a32", r: 5 }} /></LineChart></ResponsiveContainer></TvPanel>
    <div className="col-span-3 grid grid-rows-3 gap-4"><TvKpi icon={Users} label="Clientes acompanhados" value={clientes} /><TvKpi icon={FileText} label="Publicações hoje" value={intimacoesHoje} /><TvKpi icon={EyeOff} label="Intimações não lidas" value={naoLidas} danger={naoLidas > 0} /></div>
    <TvPanel className="col-span-12 flex items-center justify-between px-8"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c59a32]">Privacidade</p><p className="mt-1 text-xl font-semibold">{privacy ? "Exibição segura para áreas compartilhadas" : "Modo interno habilitado"}</p></div><p className="max-w-xl text-right text-sm text-slate-400">Este painel apresenta totais e tendências. Nomes, números processuais, valores e conteúdos confidenciais não são exibidos.</p></TvPanel>
  </div>;
}

function Gauge({ value, label, color }: { value: number; label: string; color: string }) { return <div className="flex h-full flex-col items-center justify-center"><svg viewBox="0 0 240 150" className="w-full max-w-[270px]"><path d="M 28 130 A 94 94 0 1 1 212 130" fill="none" stroke="#ffffff12" strokeWidth="20" strokeLinecap="round" pathLength="100" /><path d="M 28 130 A 94 94 0 1 1 212 130" fill="none" stroke={color} strokeWidth="20" strokeLinecap="round" pathLength="100" strokeDasharray={`${value} 100`} /><text x="120" y="105" textAnchor="middle" fill="white" fontSize="42" fontWeight="700">{value}%</text><text x="120" y="132" textAnchor="middle" fill="#94a3b8" fontSize="12">{label}</text></svg></div>; }
function Donut({ data, center, large }: any) { return <div className="relative h-[88%]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" innerRadius={large ? "64%" : "60%"} outerRadius={large ? "86%" : "82%"} paddingAngle={4} cornerRadius={6} stroke="none">{data.map((item: any) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip content={<DarkTooltip />} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex items-center justify-center font-display text-2xl font-semibold">{center}</div></div>; }
function TvPanel({ children, title, className = "" }: any) { return <section className={`min-h-0 rounded-2xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/10 ${className}`}>{title && <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-300">{title}</h2>}{children}</section>; }
function TvKpi({ icon: Icon, label, value, danger = false }: any) { return <div className={`flex min-h-0 items-center gap-3 rounded-2xl border p-4 ${danger ? "border-red-400/25 bg-red-500/10" : "border-white/10 bg-white/[0.045]"}`}><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${danger ? "bg-red-400/15 text-red-300" : "bg-[#c59a32]/15 text-[#e6bf5c]"}`}><Icon className="h-5 w-5" /></span><div><strong className="font-display text-3xl leading-none">{value}</strong><p className="mt-1 text-[0.62rem] font-semibold uppercase tracking-wider text-slate-400">{label}</p></div></div>; }
function Mini({ value, label, danger = false }: any) { return <div className={`rounded-xl border p-2 ${danger ? "border-red-400/20 bg-red-500/10" : "border-white/8 bg-white/5"}`}><strong className={danger ? "text-red-300" : "text-white"}>{value}</strong><p className="text-[0.55rem] text-slate-400">{label}</p></div>; }
function TvControl({ children, onClick, label }: any) { return <button type="button" onClick={onClick} title={label} aria-label={label} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white [&_svg]:h-4 [&_svg]:w-4">{children}</button>; }
function DarkTooltip({ active, payload, label }: any) { if (!active || !payload?.length) return null; return <div className="rounded-lg border border-white/10 bg-[#0f1b2d] p-2 text-xs shadow-xl"><p className="mb-1 text-slate-400">{label}</p>{payload.map((item: any) => <p key={item.name} className="font-semibold text-white">{item.name}: {item.value}</p>)}</div>; }
