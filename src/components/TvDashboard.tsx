import { useEffect, useMemo, useRef, useState } from "react";
import { useClientes } from "@/hooks/useClientes";
import { useProcessos } from "@/hooks/useProcessos";
import { useTarefas } from "@/hooks/useTarefas";
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
  const { data: tarefas = [] } = useTarefas();
  const { data: processos = [] } = useProcessos();
  const { data: clientes = [] } = useClientes();
  const [intimacoes, setIntimacoes] = useState<any[]>(loadIntimacoes);
  const [slide, setSlide] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [privacy, setPrivacy] = useState(true);
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(new Date());
      setIntimacoes(loadIntimacoes());
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setSlide(current => (current + 1) % 3), 20_000);
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
          {slide === 0 && <OverviewSlide tarefas={tarefas.length} abertas={abertas.length} vencidas={vencidas.length} processos={processos.length} clientes={clientes.length} intimacoes={intimacoesHoje.length} taxa={taxaConclusao} saude={saudeOperacional} taskData={statusTarefas} processData={statusProcessos} />}
          {slide === 1 && <TasksSlide abertas={abertas.length} vencidas={vencidas.length} concluidas={concluidas.length} taxa={taxaConclusao} statusData={statusTarefas} heatData={cargaSemana} />}
          {slide === 2 && <PortfolioSlide processos={processos.length} clientes={clientes.length} intimacoesHoje={intimacoesHoje.length} naoLidas={naoLidas.length} processData={statusProcessos} intimacoesData={intimacoesSemana} privacy={privacy} />}
        </main>

        <footer className="flex items-center justify-between border-t border-white/10 pt-3 text-[0.65rem] text-slate-400">
          <span>{privacy ? "Modo privacidade ativo · dados sensíveis ocultos" : "Modo interno · exibição autorizada"}</span>
          <div className="flex gap-2">{[0, 1, 2].map(index => <button key={index} onClick={() => setSlide(index)} className={`h-1.5 rounded-full transition-all ${slide === index ? "w-9 bg-[#c59a32]" : "w-4 bg-white/20"}`} aria-label={`Abrir painel ${index + 1}`} />)}</div>
          <span>Painel {slide + 1} de 3 · troca a cada 20s</span>
        </footer>
      </div>
    </div>
  );
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
