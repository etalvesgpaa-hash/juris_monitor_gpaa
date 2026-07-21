import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTarefas, useCreateTarefa, useUpdateTarefa, useDeleteTarefa } from "@/hooks/useTarefas";
import { useFeriados, useCreateFeriado, useDeleteFeriado, calcularDiasUteis } from "@/hooks/useFeriados";
import { useProcessos } from "@/hooks/useProcessos";
import { useClientes } from "@/hooks/useClientes";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Calendar, CheckCircle2, Edit2, Trash2, Plus, X, LayoutGrid, List, Eye, Clock, User, FileText, Tag } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CreateTaskModal } from "@/components/CreateTaskModal";

import { useIntimacoes } from "@/hooks/useIntimacoes";
import { DelegarTarefaModal } from "@/components/DelegarTarefaModal";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Parseia YYYY-MM-DD como data local (evita deslocamento UTC no Brasil) */
function parseDateLocal(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Retorna a data de hoje no formato YYYY-MM-DD usando fuso horário LOCAL (não UTC) */
function hojeLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}


type FilterType = "todas" | "triagem" | "ag_documentos" | "ag_cliente" | "elaboracao" | "andamento" | "audiencia" | "ag_tribunal" | "concluidas" | "canceladas" | "pendente";
type ViewMode = "kanban" | "lista" | "agenda";

/** Formata data YYYY-MM-DD para DD/MM/YYYY sem offset de fuso horário */
function fmtDataLocal(iso: string): string {
  if (!iso) return "";
  const parts = iso.slice(0, 10).split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso;
}

/** Formata data+hora para exibição no card kanban */
function fmtPrazoKanban(iso: string): string {
  if (!iso) return "";
  const slice = iso.slice(0, 16);
  const segments = slice.split("T");
  if (segments.length < 2) return fmtDataLocal(iso);
  const dateParts = segments[0].split("-");
  const timeParts = segments[1].split(":");
  if (dateParts.length === 3 && timeParts.length >= 2) {
    return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]} ${timeParts[0]}:${timeParts[1]}`;
  }
  return fmtDataLocal(iso);
}

/** Calcula quantos dias uma tarefa está em aberto desde a criação */
function diasEmAberto(created_at: string): number {
  const criacao = new Date(created_at);
  const hoje = new Date();
  const diff = hoje.getTime() - criacao.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/** Gera iniciais do nome para o avatar */
function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Cor de fundo do avatar baseada no nome */
function getAvatarColor(name: string): string {
  const colors = [
    "#2e7d32", "#1565c0", "#6a1b9a", "#ad1457",
    "#e65100", "#00695c", "#4527a0", "#283593",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ── Colunas do Kanban ──────────────────────────────────────────────────────
// Cada coluna lista os status do banco que ela exibe (compatibilidade com dados antigos)
const KANBAN_COLUMNS = [
  { key: "triagem",       statusKeys: ["triagem", "pendente"], label: "TRIAGEM",               color: "#6b7280" },
  { key: "ag_documentos", statusKeys: ["ag_documentos"],       label: "AG. DOCUMENTOS",        color: "#b45309" },
  { key: "ag_cliente",    statusKeys: ["ag_cliente"],          label: "AG. CLIENTE",           color: "#0369a1" },
  { key: "elaboracao",    statusKeys: ["elaboracao"],          label: "EM ELABORAÇÃO",         color: "#7c3aed" },
  { key: "andamento",     statusKeys: ["andamento"],           label: "EM ANDAMENTO",          color: "#1565c0" },
  { key: "audiencia",     statusKeys: ["audiencia"],           label: "AUDIÊNCIA/DILIGÊNCIA",  color: "#b91c1c" },
  { key: "ag_tribunal",   statusKeys: ["ag_tribunal"],         label: "AG. TRIBUNAL",          color: "#6d28d9" },
  { key: "concluida",     statusKeys: ["concluida"],           label: "CONCLUÍDOS",            color: "#166534" },
] as const;

// Status aceitos pelo banco (novos + legados para compatibilidade)
const ALL_STATUS_OPTIONS = [
  { value: "triagem",       label: "Triagem" },
  { value: "ag_documentos", label: "Aguardando Documentos" },
  { value: "ag_cliente",    label: "Aguardando Cliente" },
  { value: "elaboracao",    label: "Em Elaboração" },
  { value: "andamento",     label: "Em Andamento" },
  { value: "audiencia",     label: "Audiência/Diligência" },
  { value: "ag_tribunal",   label: "Aguardando Tribunal" },
  { value: "concluida",     label: "Concluída" },
  { value: "cancelada",     label: "Cancelada" },
  // legados — mantidos para dados já existentes
  { value: "pendente",      label: "Aguardando (legado)" },
] as const;

export function TarefasPage() {
  const { user, isAdmin } = useAuth();
  const { data: tarefas = [], isLoading } = useTarefas();
  const { data: processos = [] } = useProcessos();
  const { data: clientes = [] } = useClientes();
  const { data: feriados = [] } = useFeriados();
  const { data: appUsers = [] } = useQuery({
    queryKey: ["profiles-para-delegacao"],
    queryFn: async () => {
      // 1. Busca todos os profiles
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, is_admin")
        .order("full_name");

      if (!allProfiles || allProfiles.length === 0) return [];

      // 2. Busca user_ids dos clientes do portal para excluir da lista
      const { data: portalUsers } = await supabase
        .from("clientes_portal")
        .select("user_id")
        .not("user_id", "is", null);

      const portalUserIds = new Set((portalUsers || []).map((c: any) => c.user_id));

      // 3. Retorna apenas advogados (profiles que não são clientes do portal)
      return allProfiles.filter((p: any) => !portalUserIds.has(p.user_id));
    },
    enabled: isAdmin,
  });

  const { data: intimacoesResumo = [] } = useIntimacoes();

  const createTarefa = useCreateTarefa();
  const updateTarefa = useUpdateTarefa();
  const deleteTarefa = useDeleteTarefa();
  const createFeriado = useCreateFeriado();
  const deleteFeriado = useDeleteFeriado();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [delegarOpen, setDelegarOpen] = useState(false);
  const [taskInitialData, setTaskInitialData] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showFeriados, setShowFeriados] = useState(false);
  const [showFormFeriado, setShowFormFeriado] = useState(false);
  const [filter, setFilter] = useState<FilterType>("todas");
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem("jm_tasks_view") as ViewMode) || "kanban");
  const [showConcluidas, setShowConcluidas] = useState(false);
  const [tarefaDetalhe, setTarefaDetalhe] = useState<typeof tarefas[0] | null>(null);
  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    numero_processo: "",
    data_vencimento: "",
    diasUteis: "",
    prioridade: "media",
    status: "pendente",
  });

  const [formFeriado, setFormFeriado] = useState({
    data: "",
    descricao: "",
    tipo: "feriado" as "feriado" | "suspensao" | "recesso",
    abrangencia: "local" as "nacional" | "estadual" | "municipal" | "local",
  });

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("jm_tasks_view", mode);
  };

  const resetForm = () => {
    setForm({ titulo: "", descricao: "", numero_processo: "", data_vencimento: "", diasUteis: "", prioridade: "media", status: "pendente" });
    setShowForm(false);
    setShowTaskModal(false);
    setTaskInitialData(null);
    setEditingId(null);
  };

  const resetFormFeriado = () => {
    setFormFeriado({ data: "", descricao: "", tipo: "feriado", abrangencia: "local" });
    setShowFormFeriado(false);
  };

  const handleEdit = (t: typeof tarefas[0]) => {
    const initialData = {
      titulo:           t.titulo,
      descricao:        t.descricao || "",
      numero_processo:  (t as any).numero_processo || "",
      data_vencimento:  t.data_vencimento ? t.data_vencimento.slice(0, 10) : "",
      hora_vencimento:  (t as any).hora_vencimento || "",
      prioridade:       t.prioridade,
      status:           t.status || "triagem",
    };
    setTaskInitialData(initialData);
    setEditingId(t.id);
    setTimeout(() => setShowTaskModal(true), 10);
  };


  /** Chamado pelo CreateTaskModal */
  const handleSubmitViModal = async (data: any) => {
    if (!data.titulo.trim()) {
      toast({ title: "Informe o título", variant: "destructive" });
      return;
    }
    try {
      if (editingId) {
        await updateTarefa.mutateAsync({
          id: editingId,
          titulo: data.titulo,
          descricao: data.descricao || null,
          numero_processo: data.numero_processo || null,
          data_vencimento: data.data_vencimento || null,
          hora_vencimento: data.hora_vencimento || null,
          prioridade: data.prioridade,
          status: data.status,
        });
        toast({ title: "Tarefa atualizada!" });
      } else {
        await createTarefa.mutateAsync({
          titulo: data.titulo,
          descricao: data.descricao || null,
          numero_processo: data.numero_processo || null,
          data_vencimento: data.data_vencimento || null,
          hora_vencimento: data.hora_vencimento || null,
          prioridade: data.prioridade,
          status: data.status,
        });
        toast({ title: "Tarefa criada!" });
      }
      resetForm();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleCreateOrUpdate = async () => {
    if (!form.titulo.trim()) {
      toast({ title: "Informe o título", variant: "destructive" });
      return;
    }
    try {
      if (editingId) {
        await updateTarefa.mutateAsync({
          id: editingId,
          titulo: form.titulo,
          descricao: form.descricao || null,
          numero_processo: (form as any).numero_processo || null,
          data_vencimento: form.data_vencimento || null,
          hora_vencimento: (form as any).hora_vencimento || null,
          prioridade: form.prioridade,
          status: form.status,
        });
        toast({ title: "Tarefa atualizada!" });
      } else {
        await createTarefa.mutateAsync({
          titulo: form.titulo,
          descricao: form.descricao || null,
          numero_processo: (form as any).numero_processo || null,
          data_vencimento: form.data_vencimento || null,
          hora_vencimento: (form as any).hora_vencimento || null,
          prioridade: form.prioridade,
          status: form.status,
        });
        toast({ title: "Tarefa criada!" });
      }
      resetForm();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleCreateFeriado = async () => {
    if (!formFeriado.data || !formFeriado.descricao.trim()) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    try {
      await createFeriado.mutateAsync(formFeriado);
      toast({ title: "Feriado cadastrado!" });
      resetFormFeriado();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteFeriado = async (id: string) => {
    if (!confirm("Excluir este feriado?")) return;
    try {
      await deleteFeriado.mutateAsync(id);
      toast({ title: "Feriado excluído" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const toggleConcluida = async (t: typeof tarefas[0]) => {
    const isConcluida = t.status === "concluida";
    try {
      await updateTarefa.mutateAsync({
        id: t.id,
        status: isConcluida ? "pendente" : "concluida",
        concluida_em: isConcluida ? null : new Date().toISOString(),
      });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta tarefa?")) return;
    try {
      await deleteTarefa.mutateAsync(id);
      toast({ title: "Tarefa excluída" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleMoveStatus = async (t: typeof tarefas[0], newStatus: string) => {
    try {
      await updateTarefa.mutateAsync({
        id: t.id,
        status: newStatus,
        concluida_em: newStatus === "concluida" ? new Date().toISOString() : null,
      });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleReschedule = async (t: typeof tarefas[0], newDate: string) => {
    if ((t.data_vencimento || "").slice(0, 10) === newDate) return;
    try {
      await updateTarefa.mutateAsync({ id: t.id, data_vencimento: newDate });
      toast({ title: "Tarefa reagendada", description: `Novo vencimento: ${fmtDataLocal(newDate)}` });
    } catch (err: any) {
      toast({ title: "Erro ao reagendar", description: err.message, variant: "destructive" });
    }
  };

  const filtered = tarefas.filter((t) => {
    if (filter === "triagem")       return t.status === "triagem" || t.status === "pendente";
    if (filter === "ag_documentos") return t.status === "ag_documentos";
    if (filter === "ag_cliente")    return t.status === "ag_cliente";
    if (filter === "elaboracao")    return t.status === "elaboracao";
    if (filter === "andamento")     return t.status === "andamento";
    if (filter === "audiencia")     return t.status === "audiencia";
    if (filter === "ag_tribunal")   return t.status === "ag_tribunal";
    if (filter === "concluidas")    return t.status === "concluida";
    if (filter === "canceladas")    return t.status === "cancelada";
    if (filter === "pendente")      return t.status === "pendente";
    // "todas" — respeita toggle de concluídas
    if (!showConcluidas && t.status === "concluida") return false;
    return true;
  });

  const now = new Date();
  const tarefasAbertas = tarefas.filter(t => t.status !== "concluida" && t.status !== "cancelada");
  const tarefasVencidas = tarefasAbertas.filter(t => t.data_vencimento && t.data_vencimento.slice(0, 10) < hojeLocal());
  const tarefasHoje = tarefasAbertas.filter(t => t.data_vencimento?.slice(0, 10) === hojeLocal());
  const tarefasConcluidas = tarefas.filter(t => t.status === "concluida");

  const prioridadeColor = (prio: string) => {
    if (prio === "urgente") return "text-red-700 bg-red-700/10";
    if (prio === "alta") return "text-red-alert bg-red-alert/10";
    if (prio === "media") return "text-accent bg-accent/10";
    return "text-muted-foreground bg-muted";
  };

  const hoje = hojeLocal();
  const feriadosFuturos = feriados
    .filter(f => f.data >= hoje)
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, 5);

  // Dados do usuário logado para o card do kanban
  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";
  const userInitials = getInitials(userName);
  const userAvatarColor = getAvatarColor(userName);

  // Localidade: pega do processo vinculado, se houver
  const getLocalidade = (t: typeof tarefas[0]): string => {
    const proc = t.processo as any;
    if (!proc) return "";
    const cidade = proc.cidade || proc.municipio || "";
    const uf = proc.uf || proc.estado || "";
    if (cidade && uf) return `${cidade} - ${uf}`;
    if (cidade) return cidade;
    if (proc.vara) return proc.vara;
    return "";
  };

  return (
    <div className="page-stack">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Gerenciar Demandas</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie tarefas com controle de prazo em dias úteis</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant={viewMode === "kanban" ? "default" : "outline"} size="sm" onClick={() => changeViewMode("kanban")}>
            <LayoutGrid className="w-4 h-4 mr-1" /> Kanban
          </Button>
          <Button variant={viewMode === "lista" ? "default" : "outline"} size="sm" onClick={() => changeViewMode("lista")}>
            <List className="w-4 h-4 mr-1" /> Lista
          </Button>
          <Button variant={viewMode === "agenda" ? "default" : "outline"} size="sm" onClick={() => changeViewMode("agenda")}>
            <Calendar className="w-4 h-4 mr-1" /> Agenda
          </Button>
          <Button
            variant={showConcluidas ? "default" : "outline"}
            size="sm"
            onClick={() => setShowConcluidas(!showConcluidas)}
            className={showConcluidas ? "bg-green-700 hover:bg-green-800 border-green-700" : "text-muted-foreground"}
          >
            {showConcluidas ? "✓ Ocultar Concluídas" : "Mostrar Concluídas"}
          </Button>
          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => setDelegarOpen(true)}
              className="border-violet-500/50 text-violet-400 hover:bg-violet-500/10"
            >
              👤 Delegar Tarefa
            </Button>
          )}
          <Button variant="gold" onClick={() => { setEditingId(null); setTaskInitialData(null); setShowTaskModal(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Criar Demanda
          </Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TaskMetric icon={Clock} label="Demandas abertas" value={tarefasAbertas.length} tone="default" />
        <TaskMetric icon={AlertTriangle} label="Vencidas" value={tarefasVencidas.length} tone="danger" />
        <TaskMetric icon={Calendar} label="Vencem hoje" value={tarefasHoje.length} tone="warning" />
        <TaskMetric icon={CheckCircle2} label="Concluídas" value={tarefasConcluidas.length} tone="success" />
      </div>

      {viewMode === "kanban" && (
        <div className="mb-4 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-xs text-muted-foreground">
          Arraste um card para outra coluna para atualizar o status. No celular, use a opção “Mover” disponível no card.
        </div>
      )}

      {viewMode === "agenda" && (
        <div className="mb-4 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-xs text-muted-foreground">
          Arraste uma tarefa para outro dia para alterar a data de vencimento. Clique na tarefa para editar os detalhes.
        </div>
      )}

      {/* ── Formulário de Feriado ── */}
      {showFormFeriado && (
        <div className="bg-card border border-accent/30 rounded-2xl p-6 mb-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold">Novo Feriado/Suspensão</h2>
            <Button variant="ghost" size="sm" onClick={resetFormFeriado}><X className="w-4 h-4" /></Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <InputField label="Data *" value={formFeriado.data} onChange={(v) => setFormFeriado({ ...formFeriado, data: v })} type="date" />
            <InputField label="Descrição *" value={formFeriado.descricao} onChange={(v) => setFormFeriado({ ...formFeriado, descricao: v })} placeholder="Ex: Feriado Municipal" />
            <div>
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground">Tipo</label>
              <select className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent outline-none" value={formFeriado.tipo} onChange={(e) => setFormFeriado({ ...formFeriado, tipo: e.target.value as any })}>
                <option value="feriado">Feriado</option>
                <option value="suspensao">Suspensão de Prazo</option>
                <option value="recesso">Recesso</option>
              </select>
            </div>
            <div>
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground">Abrangência</label>
              <select className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent outline-none" value={formFeriado.abrangencia} onChange={(e) => setFormFeriado({ ...formFeriado, abrangencia: e.target.value as any })}>
                <option value="local">Local</option>
                <option value="municipal">Municipal</option>
                <option value="estadual">Estadual</option>
                <option value="nacional">Nacional</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="gold" onClick={handleCreateFeriado} disabled={createFeriado.isPending}>{createFeriado.isPending ? "Salvando..." : "Salvar"}</Button>
            <Button variant="outline" onClick={resetFormFeriado}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* ── Formulário de Tarefa ── */}
      {showForm && (
        <div className="bg-card border border-accent/30 rounded-2xl p-6 mb-5 shadow-sm">
          <h2 className="font-display text-xl font-bold mb-4">{editingId ? "Editar Demanda" : "Nova Demanda"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <InputField label="Título *" value={form.titulo} onChange={(v) => setForm({ ...form, titulo: v })} placeholder="Título da tarefa" />
            <div>
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground">Prioridade</label>
              <select className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent outline-none" value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value })}>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div>
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground">Status</label>
              <select className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent outline-none" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {ALL_STATUS_OPTIONS.filter(o => o.value !== "pendente").map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 bg-accent/5 rounded-xl border border-accent/20 p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground block mb-1">Dias Úteis para Vencimento</label>
                <input
                  type="number" min="1" placeholder="Ex: 15" value={form.diasUteis}
                  onChange={(e) => {
                    const dias = e.target.value;
                    const num = parseInt(dias);
                    if (!isNaN(num) && num > 0) {
                      const resultado = calcularDiasUteis(new Date(), num, feriados);
                      const ano = resultado.getFullYear();
                      const mes = String(resultado.getMonth() + 1).padStart(2, "0");
                      const dia = String(resultado.getDate()).padStart(2, "0");
                      setForm({ ...form, diasUteis: dias, data_vencimento: `${ano}-${mes}-${dia}` });
                    } else {
                      setForm({ ...form, diasUteis: dias, data_vencimento: "" });
                    }
                  }}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent outline-none"
                />
                <p className="text-[0.68rem] text-muted-foreground mt-1">Exclui sáb, dom e {feriados.length > 0 ? `${feriados.length} feriado(s)` : "feriados"}</p>
              </div>
              <div>
                <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground block mb-1">Data de Vencimento</label>
                <input
                  type="date" value={form.data_vencimento}
                  onChange={(e) => setForm({ ...form, data_vencimento: e.target.value, diasUteis: "" })}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent outline-none"
                />
                {form.data_vencimento && form.diasUteis && (
                  <p className="text-[0.7rem] font-semibold text-accent mt-1">📅 {form.diasUteis} dias úteis a partir de hoje</p>
                )}
              </div>
            </div>
            {/* ── Número do Processo ── */}
            <div className="md:col-span-2">
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground">Número do Processo</label>
              <input
                type="text"
                value={(form as any).numero_processo || ""}
                onChange={(e) => setForm({ ...form, numero_processo: e.target.value } as any)}
                placeholder="Ex: 0001234-56.2023.8.26.0000"
                className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent outline-none font-mono"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground">Descrição</label>
              <textarea
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all min-h-[80px]"
                placeholder="Detalhes da tarefa..."
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="gold" onClick={handleCreateOrUpdate} disabled={createTarefa.isPending || updateTarefa.isPending}>
              {(createTarefa.isPending || updateTarefa.isPending) ? "Salvando..." : "Salvar"}
            </Button>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
          </div>
        </div>
      )}





      {/* ── Filtros (apenas lista e agenda) ── */}
      {viewMode !== "kanban" && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {([
            ["todas",        "Todas"],
            ["triagem",      "Triagem"],
            ["ag_documentos","Ag. Docs"],
            ["ag_cliente",   "Ag. Cliente"],
            ["elaboracao",   "Elaboração"],
            ["andamento",    "Andamento"],
            ["audiencia",    "Audiência"],
            ["ag_tribunal",  "Ag. Tribunal"],
            ["concluidas",   "Concluídas"],
            ["canceladas",   "Canceladas"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === key ? "bg-accent text-primary" : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Conteúdo principal ── */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : viewMode === "kanban" ? (
        <KanbanBoard
          tarefas={tarefas}
          userName={userName}
          userInitials={userInitials}
          userAvatarColor={userAvatarColor}
          getLocalidade={getLocalidade}
          showConcluidas={showConcluidas}
          isAdmin={isAdmin}
          profiles={appUsers}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onMoveStatus={handleMoveStatus}
          onVerDetalhes={(t) => setTarefaDetalhe(t)}
        />
      ) : viewMode === "agenda" ? (
        <AgendaCalendario tarefas={tarefas} onEditTarefa={handleEdit} onReschedule={handleReschedule} />
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground text-sm">Nenhuma tarefa encontrada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const isVencida = t.data_vencimento && t.status !== "concluida" && t.data_vencimento.slice(0, 10) < hojeLocal();
            const processo = t.processo;
            const statusTarefaColor = (status: string) => {
              if (status === "concluida")     return "text-green-ok bg-green-ok/10";
              if (status === "cancelada")     return "text-muted-foreground bg-muted";
              if (status === "triagem")       return "text-gray-600 bg-gray-100";
              if (status === "pendente")      return "text-gray-600 bg-gray-100";
              if (status === "ag_documentos") return "text-amber-600 bg-amber-100";
              if (status === "ag_cliente")    return "text-sky-600 bg-sky-100";
              if (status === "elaboracao")    return "text-violet-600 bg-violet-100";
              if (status === "andamento")     return "text-blue-600 bg-blue-100";
              if (status === "audiencia")     return "text-red-600 bg-red-100";
              if (status === "ag_tribunal")   return "text-purple-600 bg-purple-100";
              return "text-muted-foreground bg-muted/50";
            };
            const statusTarefaLabel = (status: string) => {
              if (status === "concluida")     return "Concluída";
              if (status === "cancelada")     return "Cancelada";
              if (status === "triagem")       return "Triagem";
              if (status === "pendente")      return "Triagem";
              if (status === "ag_documentos") return "Ag. Documentos";
              if (status === "ag_cliente")    return "Ag. Cliente";
              if (status === "elaboracao")    return "Em Elaboração";
              if (status === "andamento")     return "Em Andamento";
              if (status === "audiencia")     return "Audiência/Diligência";
              if (status === "ag_tribunal")   return "Ag. Tribunal";
              return status;
            };
            return (
              <div
                key={t.id}
                className={`bg-card border rounded-xl p-4 transition-all ${
                  isVencida ? "border-red-alert/40" : "border-border hover:border-accent/40"
                } ${t.status === "concluida" ? "opacity-60" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => toggleConcluida(t)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        t.status === "concluida" ? "bg-green-ok border-green-ok text-white" : "border-border hover:border-accent"
                      }`}
                    >
                      {t.status === "concluida" && "✓"}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className={`font-semibold text-sm cursor-pointer hover:text-accent transition-colors ${t.status === "concluida" ? "line-through" : ""}`}
                          onClick={() => handleEdit(t)}
                        >
                          {t.titulo}
                        </div>
                        <span className={`text-[0.65rem] px-2 py-0.5 rounded-full font-bold uppercase ${statusTarefaColor(t.status)}`}>
                          {statusTarefaLabel(t.status)}
                        </span>
                      </div>
                      {t.descricao && <div className="text-xs text-muted-foreground truncate">{t.descricao}</div>}
                      {((t as any).numero_processo || processo) && (
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {(processo as any)?.cliente?.nome && (
                            <span className="text-xs font-semibold text-accent/80">👤 {(processo as any).cliente.nome}</span>
                          )}
                          <span className="text-xs text-muted-foreground font-mono">
                            📋 {(t as any).numero_processo || processo?.numero_cnj}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[0.65rem] px-2 py-0.5 rounded-full font-bold uppercase ${prioridadeColor(t.prioridade)}`}>{t.prioridade}</span>
                    {t.data_vencimento && (
                      <span className={`text-xs font-mono ${isVencida ? "text-red-alert font-bold" : "text-muted-foreground"}`}>
                        {fmtDataLocal(t.data_vencimento)}
                        {(t as any).hora_vencimento && ` · ${(t as any).hora_vencimento}`}
                      </span>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-accent" onClick={() => handleEdit(t)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-alert" onClick={() => handleDelete(t.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Feriados e Suspensões — exibido abaixo do kanban/lista/agenda ── */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mt-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-primary">
              FERIADOS E SUSPENSÕES DE PRAZO
            </h2>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFeriados(!showFeriados)}>
              {showFeriados ? "Ocultar" : "Ver Todos"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowFormFeriado(true)}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground italic mb-3">
          Cadastrados aqui, válidos para <strong>todas as tarefas</strong>. Os feriados nacionais já são automáticos.
        </p>

        {!showFeriados && feriadosFuturos.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Próximos feriados:</p>
            {feriadosFuturos.map(f => (
              <div key={f.id} className="text-xs text-foreground flex items-center gap-2">
                <span className="font-mono">{fmtDataLocal(f.data)}</span>
                <span>•</span>
                <span>{f.descricao}</span>
                {f.abrangencia !== 'nacional' && (
                  <span className="text-[0.65rem] bg-muted px-2 py-0.5 rounded-full">{f.abrangencia}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {!showFeriados && feriadosFuturos.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Nenhum feriado próximo cadastrado.</p>
        )}

        {showFeriados && (
          <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
            {feriados.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum feriado cadastrado.</p>
            ) : (
              feriados.map(f => (
                <div key={f.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-semibold">{fmtDataLocal(f.data)}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-sm">{f.descricao}</span>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[0.65rem] bg-muted px-2 py-0.5 rounded-full">{f.tipo}</span>
                      <span className="text-[0.65rem] bg-muted px-2 py-0.5 rounded-full">{f.abrangencia}</span>
                    </div>
                  </div>
                  {f.abrangencia !== 'nacional' && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-alert" onClick={() => handleDeleteFeriado(f.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Modal de Detalhe ── */}
      {tarefaDetalhe && (
        <TarefaDetalheModal
          tarefa={tarefaDetalhe}
          userName={userName}
          userInitials={userInitials}
          userAvatarColor={userAvatarColor}
          getLocalidade={getLocalidade}
          onClose={() => setTarefaDetalhe(null)}
          onEdit={() => { setTarefaDetalhe(null); handleEdit(tarefaDetalhe); }}
          onDelete={() => { setTarefaDetalhe(null); handleDelete(tarefaDetalhe.id); }}
          onMoveStatus={(status) => { handleMoveStatus(tarefaDetalhe, status); setTarefaDetalhe(null); }}
        />
      )}

      <CreateTaskModal
        open={showTaskModal}
        onClose={resetForm}
        onSubmit={handleSubmitViModal}
        initialData={taskInitialData}
        intimacoes={intimacoesResumo}
        feriados={feriados}
        submitLabel={editingId ? "Salvar Alterações" : "Criar Demanda"}
      />

      {isAdmin && (
        <DelegarTarefaModal
          open={delegarOpen}
          onClose={() => setDelegarOpen(false)}
          profiles={appUsers
            .filter((u: any) => u.user_id && u.user_id !== user?.id)
            .map((u: any) => ({
              id: u.user_id,
              full_name: u.full_name || "Usuário",
              email: "",
            }))}
            intimacoes={intimacoesResumo}
          feriados={feriados}
        />
      )}
    </div>
  );
}

// ── TarefaDetalheModal ──────────────────────────────────────────────────────
function TarefaDetalheModal({ tarefa, userName, userInitials, userAvatarColor, getLocalidade, onClose, onEdit, onDelete, onMoveStatus }: {
  tarefa: any; userName: string; userInitials: string; userAvatarColor: string;
  getLocalidade: (t: any) => string;
  onClose: () => void; onEdit: () => void; onDelete: () => void;
  onMoveStatus: (status: string) => void;
}) {
  const hojeStr = hojeLocal();
  const prazo = tarefa.data_vencimento?.slice(0, 10) || "";
  const processo = tarefa.processo as any;
  const cliente = processo?.cliente as any;
  const localidade = getLocalidade(tarefa);

  // Badge de prazo
  const prazoBadge = () => {
    if (tarefa.status === "concluida") return { label: "Concluída", bg: "#1e40af", text: "#fff" };
    if (!prazo) return null;
    if (prazo < hojeStr) return { label: "Vencida", bg: "#dc2626", text: "#fff" };
    if (prazo === hojeStr) return { label: "Hoje", bg: "#d97706", text: "#fff" };
    return { label: "Próximos dias", bg: "#16a34a", text: "#fff" };
  };
  const badge = prazoBadge();

  const colAtual = KANBAN_COLUMNS.find(c =>
    (c.statusKeys as readonly string[]).includes(tarefa.status)
  );

  const prioridadeLabel: Record<string, string> = {
    urgente: "Urgente", alta: "Alta", media: "Média", baixa: "Baixa",
  };
  const prioridadeCor: Record<string, string> = {
    urgente: "text-red-700 bg-red-50 border border-red-400 font-bold",
    alta: "text-red-600 bg-red-50 border border-red-200",
    media: "text-yellow-700 bg-yellow-50 border border-yellow-200",
    baixa: "text-gray-600 bg-gray-100 border border-gray-200",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header do modal */}
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {colAtual && (
                <span
                  className="text-[0.6rem] px-2 py-0.5 rounded-full font-bold text-white"
                  style={{ backgroundColor: colAtual.color }}
                >
                  {colAtual.label}
                </span>
              )}
              {badge && (
                <span
                  className="text-[0.6rem] px-2 py-0.5 rounded-full font-bold"
                  style={{ backgroundColor: badge.bg, color: badge.text }}
                >
                  {badge.label}
                </span>
              )}
              {tarefa.prioridade && (
                <span className={`text-[0.6rem] px-2 py-0.5 rounded-full font-bold ${prioridadeCor[tarefa.prioridade] || ""}`}>
                  {prioridadeLabel[tarefa.prioridade] || tarefa.prioridade}
                </span>
              )}
            </div>
            <h2 className={`text-lg font-bold text-foreground leading-snug ${tarefa.status === "concluida" ? "line-through text-muted-foreground" : ""}`}>
              {tarefa.titulo}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo */}
        <div className="p-5 space-y-4">

          {/* Prazo */}
          {tarefa.data_vencimento && (
            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Prazo</p>
                <p className={`text-sm font-semibold ${prazo < hojeStr && tarefa.status !== "concluida" ? "text-red-600" : "text-foreground"}`}>
                  {fmtDataLocal(prazo)}
                  {(tarefa as any).hora_vencimento && (
                    <span className="text-muted-foreground font-normal ml-2">🕐 {(tarefa as any).hora_vencimento}</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Data de criação + dias em aberto */}
          {tarefa.created_at && (
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Criada em</p>
                <p className="text-sm font-semibold text-foreground">
                  {fmtDataLocal(tarefa.created_at.slice(0, 10))}
                  {tarefa.status !== "concluida" && (() => {
                    const d = diasEmAberto(tarefa.created_at);
                    const label = d === 0 ? "hoje" : d === 1 ? "1 dia em aberto" : `${d} dias em aberto`;
                    const cor = d > 30 ? "text-red-500" : d > 14 ? "text-yellow-600" : "text-muted-foreground";
                    return <span className={`ml-2 text-xs font-normal ${cor}`}>⏱ {label}</span>;
                  })()}
                </p>
              </div>
            </div>
          )}

          {/* Descrição */}
          {tarefa.descricao && (
            <div className="flex items-start gap-3">
              <FileText className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Descrição</p>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{tarefa.descricao}</p>
              </div>
            </div>
          )}

          {/* Cliente */}
          {cliente?.nome && (
            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Cliente</p>
                <p className="text-sm font-semibold text-foreground">{cliente.nome}</p>
              </div>
            </div>
          )}

          {/* Processo */}
          {(tarefa.numero_processo || processo?.numero_cnj) && (
            <div className="flex items-start gap-3">
              <Tag className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Número do Processo</p>
                <p className="text-sm font-mono text-foreground">{tarefa.numero_processo || processo?.numero_cnj}</p>
                {localidade && <p className="text-xs text-muted-foreground mt-0.5">{localidade}</p>}
              </div>
            </div>
          )}

          {/* Responsável */}
          <div className="flex items-start gap-3">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[0.65rem] font-bold shrink-0"
              style={{ backgroundColor: userAvatarColor }}
            >
              {userInitials}
            </div>
            <div>
              <p className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Responsável</p>
              <p className="text-sm font-semibold text-foreground">{userName}</p>
            </div>
          </div>

          {/* Mover para */}
          <div>
            <p className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground mb-2">Mover para</p>
            <div className="flex flex-wrap gap-1.5">
              {KANBAN_COLUMNS
                .filter(c => !(c.statusKeys as readonly string[]).includes(tarefa.status))
                .map(col => (
                  <button
                    key={col.key}
                    onClick={() => onMoveStatus(col.key)}
                    className="text-[0.65rem] px-2.5 py-1 rounded-full font-bold text-white transition-opacity hover:opacity-80"
                    style={{ backgroundColor: col.color }}
                  >
                    {col.label}
                  </button>
                ))}
            </div>
          </div>
        </div>

        {/* Footer com ações */}
        <div className="flex gap-2 p-5 pt-0">
          <Button variant="gold" size="sm" className="flex-1" onClick={onEdit}>
            <Edit2 className="w-4 h-4 mr-1" /> Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200"
            onClick={onDelete}
          >
            <Trash2 className="w-4 h-4 mr-1" /> Excluir
          </Button>
        </div>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground">{label}</label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
        placeholder={placeholder}
      />
    </div>
  );
}

function TaskMetric({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: number; tone: "default" | "danger" | "warning" | "success" }) {
  const tones = {
    default: "bg-primary/7 text-primary",
    danger: "bg-red-500/10 text-red-600",
    warning: "bg-amber-500/10 text-amber-600",
    success: "bg-emerald-500/10 text-emerald-700",
  };
  return (
    <div className="content-panel flex items-center gap-3 p-4">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-[18px] w-[18px]" /></span>
      <div className="min-w-0">
        <p className="font-display text-2xl font-semibold leading-none text-foreground">{value}</p>
        <p className="mt-1 truncate text-[0.68rem] font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// ── KanbanBoard ────────────────────────────────────────────────────────────
function KanbanBoard({ tarefas, userName, userInitials, userAvatarColor, getLocalidade, showConcluidas, isAdmin, profiles, onEdit, onDelete, onMoveStatus, onVerDetalhes }: {
  tarefas: any[]; userName: string; userInitials: string; userAvatarColor: string;
  getLocalidade: (t: any) => string; showConcluidas: boolean;
  isAdmin?: boolean; profiles?: any[];
  onEdit: (t: any) => void; onDelete: (id: string) => void; onMoveStatus: (t: any, status: string) => void;
  onVerDetalhes: (t: any) => void;
}) {
  const now = new Date();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const tarefasPorColuna = (col: typeof KANBAN_COLUMNS[number]) =>
    tarefas.filter(t => (col.statusKeys as readonly string[]).includes(t.status));

  /** Para admin: resolve nome/iniciais/cor do dono real da tarefa; senão usa o do usuário logado */
  const getOwnerInfo = (t: any) => {
    if (isAdmin && profiles && profiles.length > 0) {
      const profile = profiles.find((p: any) => p.user_id === t.user_id);
      if (profile?.full_name) {
        return {
          name: profile.full_name,
          initials: getInitials(profile.full_name),
          color: getAvatarColor(profile.full_name),
        };
      }
    }
    return { name: userName, initials: userInitials, color: userAvatarColor };
  };

  const colunas = showConcluidas
    ? KANBAN_COLUMNS
    : KANBAN_COLUMNS.filter(c => c.key !== "concluida");

  // Com 7 colunas visíveis: 2 cols mobile → 4 tablet → 7 desktop
  // Com 8 colunas visíveis: 2 cols mobile → 4 tablet → 8 desktop
  const totalCols = colunas.length;
  const gridClass = totalCols <= 7
    ? "grid-cols-2 md:grid-cols-4 lg:grid-cols-7"
    : "grid-cols-2 md:grid-cols-4 lg:grid-cols-8";

  return (
    <div className={`grid gap-2 ${gridClass}`}>
      {colunas.map((col) => {
        const cards = tarefasPorColuna(col);
        return (
          <div
            key={col.key}
            className={`flex min-w-0 flex-col rounded-xl transition-all ${dropTarget === col.key ? "bg-accent/5 ring-2 ring-accent/35" : ""}`}
            onDragOver={(event) => { event.preventDefault(); setDropTarget(col.key); }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTarget(null); }}
            onDrop={(event) => {
              event.preventDefault();
              const taskId = event.dataTransfer.getData("text/task-id") || draggingId;
              const task = tarefas.find((item) => item.id === taskId);
              if (task && !(col.statusKeys as readonly string[]).includes(task.status)) onMoveStatus(task, col.key);
              setDraggingId(null);
              setDropTarget(null);
            }}
          >
            {/* Cabeçalho da coluna */}
            <div
              className="flex items-center justify-between px-2 py-2 rounded-xl mb-3 gap-1"
              style={{ borderTop: `4px solid ${col.color}`, background: `${col.color}18` }}
            >
              <span className="text-xs font-bold leading-tight min-w-0 break-words" style={{ color: col.color }}>{col.label}</span>
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white shrink-0" style={{ backgroundColor: col.color }}>
                {cards.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-3 min-h-[100px]">
              {cards.length === 0 ? (
                <div className="border-2 border-dashed border-border rounded-xl p-5 text-center">
                  <p className="text-xs text-muted-foreground">Nenhuma demanda</p>
                </div>
              ) : (
                cards.map((t) => {
                  const isVencida = t.data_vencimento && t.status !== "concluida" && t.data_vencimento.slice(0, 10) < hojeLocal();
                  return (
                    <KanbanCard
                      key={t.id}
                      tarefa={t}
                      isVencida={!!isVencida}
                      localidade={getLocalidade(t)}
                      processoNumero={(t.processo as any)?.numero_cnj || ""}
                      userName={getOwnerInfo(t).name}
                      userInitials={getOwnerInfo(t).initials}
                      userAvatarColor={getOwnerInfo(t).color}
                      currentColKey={col.key}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onMoveStatus={onMoveStatus}
                      onVerDetalhes={onVerDetalhes}
                      onDragStart={() => setDraggingId(t.id)}
                      onDragEnd={() => { setDraggingId(null); setDropTarget(null); }}
                    />
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Helpers de status para o card do Kanban ────────────────────────────────
function statusKanbanLabel(status: string): string {
  if (status === "triagem" || status === "pendente") return "Triagem";
  if (status === "ag_documentos") return "Ag. Documentos";
  if (status === "ag_cliente")    return "Ag. Cliente";
  if (status === "elaboracao")    return "Em Elaboração";
  if (status === "andamento")     return "Em Andamento";
  if (status === "audiencia")     return "Audiência";
  if (status === "ag_tribunal")   return "Ag. Tribunal";
  if (status === "concluida")     return "Concluída";
  if (status === "cancelada")     return "Cancelada";
  return status;
}

function statusKanbanStyle(status: string): { bg: string; text: string } {
  if (status === "triagem" || status === "pendente") return { bg: "#f3f4f6", text: "#374151" };
  if (status === "ag_documentos") return { bg: "#fff7ed", text: "#92400e" };
  if (status === "ag_cliente")    return { bg: "#e0f2fe", text: "#075985" };
  if (status === "elaboracao")    return { bg: "#f5f3ff", text: "#5b21b6" };
  if (status === "andamento")     return { bg: "#eff6ff", text: "#1e3a8a" };
  if (status === "audiencia")     return { bg: "#fef2f2", text: "#991b1b" };
  if (status === "ag_tribunal")   return { bg: "#faf5ff", text: "#4c1d95" };
  if (status === "concluida")     return { bg: "#dcfce7", text: "#14532d" };
  if (status === "cancelada")     return { bg: "#f3f4f6", text: "#6b7280" };
  return { bg: "#f3f4f6", text: "#374151" };
}

// ── KanbanCard ─────────────────────────────────────────────────────────────
function KanbanCard({ tarefa, isVencida, localidade, processoNumero, userName, userInitials, userAvatarColor, currentColKey, onEdit, onDelete, onMoveStatus, onVerDetalhes, onDragStart, onDragEnd }: {
  tarefa: any; isVencida: boolean; localidade: string; processoNumero: string;
  userName: string; userInitials: string; userAvatarColor: string; currentColKey: string;
  onEdit: (t: any) => void; onDelete: (id: string) => void; onMoveStatus: (t: any, status: string) => void;
  onVerDetalhes: (t: any) => void;
  onDragStart: () => void; onDragEnd: () => void;
}) {
  const [showMover, setShowMover] = useState(false);

  const prazoFormatado = tarefa.data_vencimento
    ? fmtDataLocal(tarefa.data_vencimento.slice(0, 10)) +
      ((tarefa as any).hora_vencimento ? ` · ${(tarefa as any).hora_vencimento}` : "")
    : null;

  const dias = tarefa.created_at ? diasEmAberto(tarefa.created_at) : null;
  const diasLabel = dias === null ? null : dias === 0 ? "Criada hoje" : dias === 1 ? "1 dia em aberto" : `${dias} dias em aberto`;
  // Exclui a coluna atual (verifica se o status da tarefa está nos statusKeys da coluna)
  const opcoesMovimento = KANBAN_COLUMNS.filter(
    (c) => !(c.statusKeys as readonly string[]).includes(tarefa.status) && c.key !== currentColKey
  );

  const prioridadeStyle = (prio: string) => {
    if (prio === "urgente") return { bg: "#fef2f2", text: "#7f1d1d", border: "#f87171" };
    if (prio === "alta")  return { bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" };
    if (prio === "media") return { bg: "#fef9c3", text: "#a16207", border: "#fde047" };
    return { bg: "#f3f4f6", text: "#6b7280", border: "#d1d5db" };
  };
  const ps = prioridadeStyle(tarefa.prioridade);

  return (
    <div
      draggable
      onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/task-id", tarefa.id); onDragStart(); }}
      onDragEnd={onDragEnd}
      className={`bg-card border rounded-xl shadow-sm transition-all hover:shadow-md w-full min-w-0 cursor-grab active:cursor-grabbing ${
      isVencida ? "border-red-300" : "border-border hover:border-accent/40"
    } ${tarefa.status === "concluida" ? "opacity-75" : ""}`}
    >
      {/* Área clicável — abre o modal de detalhe */}
      <div className="p-2 cursor-pointer" onClick={() => onVerDetalhes(tarefa)}>
        {/* Título + prioridade */}
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <h3 className={`text-xs font-bold leading-snug flex-1 min-w-0 break-words ${
            tarefa.status === "concluida" ? "line-through text-muted-foreground" : "text-foreground"
          }`}>
            {tarefa.titulo}
          </h3>
          {tarefa.prioridade && (
            <span
              className="text-[0.55rem] px-1 py-0.5 rounded font-bold uppercase shrink-0 leading-tight"
              style={{ backgroundColor: ps.bg, color: ps.text, border: `1px solid ${ps.border}` }}
            >
              {tarefa.prioridade}
            </span>
          )}
        </div>

        {/* Badge de prazo */}
        {(() => {
          const hoje = hojeLocal();
          const prazo = tarefa.data_vencimento?.slice(0, 10) || "";
          let label = "";
          let bg = "";
          let text = "";
          if (tarefa.status === "concluida") {
            label = "Concluída"; bg = "#1e40af"; text = "#fff";
          } else if (prazo && prazo < hoje) {
            label = "Vencida"; bg = "#dc2626"; text = "#fff";
          } else if (prazo && prazo === hoje) {
            label = "Hoje"; bg = "#d97706"; text = "#fff";
          } else if (prazo && prazo > hoje) {
            label = "Próximos dias"; bg = "#16a34a"; text = "#fff";
          }
          if (!label) return null;
          return (
            <div className="mb-1.5">
              <span
                className="text-[0.58rem] px-1.5 py-0.5 rounded-full font-bold leading-tight"
                style={{ backgroundColor: bg, color: text }}
              >
                {label}
              </span>
            </div>
          );
        })()}

        {/* Localidade */}
        {localidade && <p className="text-[0.68rem] text-muted-foreground mb-1 truncate">{localidade}</p>}

        {/* Cliente */}
        {(tarefa.processo as any)?.cliente?.nome && (
          <p className="text-[0.62rem] font-semibold text-accent/80 mb-1 truncate">👤 {(tarefa.processo as any).cliente.nome}</p>
        )}

        {/* Processo */}
        {processoNumero && (
          <p className="text-[0.62rem] text-muted-foreground font-mono mb-1 truncate">📋 {processoNumero}</p>
        )}

        {/* Prazo */}
        {prazoFormatado && (
          <p className={`text-[0.68rem] font-semibold mb-1.5 break-words ${isVencida ? "text-red-600" : "text-muted-foreground"}`}>
            {isVencida ? "⚠️ " : "🗓 "}{prazoFormatado}
          </p>
        )}

        {/* Dias em aberto */}
        {diasLabel && tarefa.status !== "concluida" && (
          <p className={`text-[0.62rem] font-semibold mb-1 ${dias && dias > 30 ? "text-red-500" : dias && dias > 14 ? "text-yellow-600" : "text-muted-foreground"}`}>
            ⏱ {diasLabel}
          </p>
        )}

        {/* Descrição — oculta em colunas muito estreitas para não poluir */}
        {tarefa.descricao && (
          <p className="text-[0.65rem] text-muted-foreground line-clamp-2 mb-1.5 hidden sm:block">{tarefa.descricao}</p>
        )}

        {/* Rodapé do card: responsável + ações */}
        <div className="border-t border-border pt-1.5 mt-1 flex items-center gap-1.5">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[0.6rem] font-bold shrink-0"
            style={{ backgroundColor: userAvatarColor }}
          >
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] font-semibold truncate text-foreground">{userName}</p>
          </div>
          <div className="flex items-center gap-0.5 ml-auto shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => onEdit(tarefa)}
              className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors"
              title="Editar"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              onClick={() => onDelete(tarefa.id)}
              className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Excluir"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>{/* fim área clicável */}

      {/* Mover para outra coluna */}
      <div className="border-t border-border px-2 py-1.5">
        <button
          onClick={() => setShowMover(!showMover)}
          className="text-[0.6rem] text-muted-foreground hover:text-accent font-semibold transition-colors w-full text-left"
        >
          {showMover ? "▲ Fechar" : "▼ Mover..."}
        </button>
        {showMover && (
          <div className="flex flex-wrap gap-1 mt-1.5 pb-1">
            {opcoesMovimento.map((col) => (
              <button
                key={col.key}
                onClick={() => { onMoveStatus(tarefa, col.key); setShowMover(false); }}
                className="text-[0.55rem] px-1.5 py-0.5 rounded-full font-semibold text-white transition-opacity hover:opacity-80 leading-tight"
                style={{ backgroundColor: col.color }}
              >
                {col.label}
              </button>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

// ── AgendaCalendario ───────────────────────────────────────────────────────
function AgendaCalendario({ tarefas, onEditTarefa, onReschedule }: { tarefas: any[]; onEditTarefa?: (t: any) => void; onReschedule?: (t: any, date: string) => void }) {
  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [dropDate, setDropDate] = useState<string | null>(null);

  const nomesMeses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const diasSemana = ["SEG","TER","QUA","QUI","SEX","SÁB","DOM"];

  const irParaHoje = () => { setMes(hoje.getMonth()); setAno(hoje.getFullYear()); };
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
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={mesAnterior} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors text-sm font-bold">‹</button>
          <h2 className="font-display text-lg font-bold tracking-tight">{nomesMeses[mes]} · {ano}</h2>
          <button onClick={proximoMes} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors text-sm font-bold">›</button>
          <button onClick={irParaHoje} className="px-3 py-1 rounded-lg border border-border text-xs font-semibold hover:bg-muted transition-colors">Hoje</button>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-[0.65rem] font-semibold">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#dc2626]" /> Vencida</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#d97706]" /> Hoje</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#16a34a]" /> Próximos dias</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#1e40af]" /> Concluída</span>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-border">
        {diasSemana.map(d => (
          <div key={d} className="py-2 text-center text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, idx) => {
          if (!cell) return <div key={`empty-${idx}`} className="min-h-[100px] border-b border-r border-border bg-muted/20 last:border-r-0" />;
          const { diaNum, diaStr } = cell;
          const isHoje = diaStr === hojeStr;
          const isWeekend = ((idx % 7) === 5 || (idx % 7) === 6);
          const tarefasDia = tarefasPorDia[diaStr] || [];
          return (
            <div
              key={diaStr}
              onDragOver={(event) => { event.preventDefault(); setDropDate(diaStr); }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropDate(null); }}
              onDrop={(event) => {
                event.preventDefault();
                const taskId = event.dataTransfer.getData("text/task-id");
                const task = tarefas.find((item) => item.id === taskId);
                if (task) onReschedule?.(task, diaStr);
                setDropDate(null);
              }}
              className={`min-h-[100px] border-b border-r border-border p-1.5 last:border-r-0 relative transition-all ${isWeekend ? "bg-muted/30" : "bg-card"} ${isHoje ? "ring-2 ring-inset ring-accent" : ""} ${dropDate === diaStr ? "bg-accent/10 ring-2 ring-inset ring-accent/50" : ""}`}
            >
              <div className="flex items-center gap-1 mb-1">
                <span className={`text-xs font-semibold leading-none ${isHoje ? "bg-accent text-white rounded-full w-5 h-5 flex items-center justify-center text-[0.65rem] font-bold" : isWeekend ? "text-muted-foreground" : "text-foreground"}`}>
                  {diaNum}
                </span>
                {isHoje && <span className="text-[0.55rem] font-bold uppercase tracking-wide text-accent">Hoje</span>}
              </div>
              <div className="space-y-0.5">
                {tarefasDia.slice(0, 3).map((t: any) => (
                  <div key={t.id} title={`${t.titulo} — arraste para reagendar`} onClick={() => onEditTarefa?.(t)} draggable
                    onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/task-id", t.id); }}
                    onDragEnd={() => setDropDate(null)}
                    className={`text-[0.62rem] font-semibold px-1.5 py-0.5 rounded truncate leading-snug cursor-grab active:cursor-grabbing hover:opacity-80 transition-opacity ${corTarefa(t)}`}>
                    {t.titulo}
                  </div>
                ))}
                {tarefasDia.length > 3 && (
                  <div className="text-[0.6rem] text-muted-foreground font-semibold px-1">+{tarefasDia.length - 3} mais</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
