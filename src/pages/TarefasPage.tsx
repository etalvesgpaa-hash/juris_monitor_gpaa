import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTarefas, useCreateTarefa, useUpdateTarefa, useDeleteTarefa } from "@/hooks/useTarefas";
import { useFeriados, useCreateFeriado, useDeleteFeriado, calcularDiasUteis } from "@/hooks/useFeriados";
import { useProcessos } from "@/hooks/useProcessos";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Edit2, Trash2, Plus, X } from "lucide-react";

type FilterType = "todas" | "pendente" | "andamento" | "ag_cliente" | "ag_tribunal" | "concluidas" | "canceladas";

/** Formata data YYYY-MM-DD para DD/MM/YYYY sem offset de fuso horário */
function fmtDataLocal(iso: string): string {
  if (!iso) return "";
  const p = iso.slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

export function TarefasPage() {
  const { data: tarefas = [], isLoading } = useTarefas();
  const { data: processos = [] } = useProcessos();
  const { data: feriados = [] } = useFeriados();
  const createTarefa = useCreateTarefa();
  const updateTarefa = useUpdateTarefa();
  const deleteTarefa = useDeleteTarefa();
  const createFeriado = useCreateFeriado();
  const deleteFeriado = useDeleteFeriado();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showFeriados, setShowFeriados] = useState(false);
  const [showFormFeriado, setShowFormFeriado] = useState(false);
  const [filter, setFilter] = useState<FilterType>("todas");
  const [viewMode, setViewMode] = useState<"lista" | "agenda">("lista");
  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    data_vencimento: "",
    diasUteis: "",
    prioridade: "media",
    status: "pendente",
    processo_id: "",
  });

  const [formFeriado, setFormFeriado] = useState({
    data: "",
    descricao: "",
    tipo: "feriado" as "feriado" | "suspensao" | "recesso",
    abrangencia: "local" as "nacional" | "estadual" | "municipal" | "local",
  });

  const resetForm = () => {
    setForm({ titulo: "", descricao: "", data_vencimento: "", diasUteis: "", prioridade: "media", status: "pendente", processo_id: "" });
    setShowForm(false);
    setEditingId(null);
  };

  const resetFormFeriado = () => {
    setFormFeriado({ data: "", descricao: "", tipo: "feriado", abrangencia: "local" });
    setShowFormFeriado(false);
  };

  const handleEdit = (t: typeof tarefas[0]) => {
    setForm({
      titulo: t.titulo,
      descricao: t.descricao || "",
      data_vencimento: t.data_vencimento ? t.data_vencimento.slice(0, 10) : "",
      diasUteis: "",
      prioridade: t.prioridade,
      status: t.status || "pendente",
      processo_id: t.processo_id || "",
    });
    setEditingId(t.id);
    setShowForm(true);
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
          data_vencimento: form.data_vencimento || null,
          prioridade: form.prioridade,
          status: form.status,
          processo_id: form.processo_id || null,
        });
        toast({ title: "Tarefa atualizada!" });
      } else {
        await createTarefa.mutateAsync({
          titulo: form.titulo,
          descricao: form.descricao || null,
          data_vencimento: form.data_vencimento || null,
          prioridade: form.prioridade,
          status: form.status,
          processo_id: form.processo_id || null,
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

  const filtered = tarefas.filter((t) => {
    if (filter === "pendente") return t.status === "pendente";
    if (filter === "andamento") return t.status === "andamento";
    if (filter === "ag_cliente") return t.status === "ag_cliente";
    if (filter === "ag_tribunal") return t.status === "ag_tribunal";
    if (filter === "concluidas") return t.status === "concluida";
    if (filter === "canceladas") return t.status === "cancelada";
    return true;
  });

  const now = new Date();
  
  // Cálculos para os cards
  const totalTarefas = tarefas.length;
  const emAberto = tarefas.filter((t) => t.status !== "concluida" && t.status !== "cancelada").length;
  const vencidas = tarefas.filter((t) => {
    if (!t.data_vencimento || t.status === "concluida" || t.status === "cancelada") return false;
    return new Date(t.data_vencimento) < now;
  }).length;
  const concluidas = tarefas.filter((t) => t.status === "concluida").length;

  const prioridadeColor = (p: string) => {
    if (p === "alta") return "text-red-alert bg-red-alert/10";
    if (p === "media") return "text-accent bg-accent/10";
    return "text-muted-foreground bg-muted";
  };

  // Filtrar feriados futuros e ordenar por data
  const hoje = new Date().toISOString().split("T")[0]; // YYYY-MM-DD local-safe
  const feriadosFuturos = feriados
    .filter(f => f.data >= hoje)
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, 5);

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-7">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Tarefas</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie tarefas com controle de prazo em dias úteis</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={viewMode === "lista" ? "default" : "outline"} 
            size="sm"
            onClick={() => setViewMode("lista")}
          >
            ☰ Lista
          </Button>
          <Button 
            variant={viewMode === "agenda" ? "default" : "outline"} 
            size="sm"
            onClick={() => setViewMode("agenda")}
          >
            <Calendar className="w-4 h-4 mr-1" /> Agenda
          </Button>
          <Button variant="gold" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nova Tarefa
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-card border-t-4 border-t-accent rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">TOTAL</div>
          <div className="text-3xl font-bold text-foreground">{totalTarefas}</div>
          <div className="text-xs text-muted-foreground mt-0.5">tarefas</div>
        </div>
        <div className="bg-card border-t-4 border-t-yellow-500 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">EM ABERTO</div>
          <div className="text-3xl font-bold text-yellow-600">{emAberto}</div>
          <div className="text-xs text-muted-foreground mt-0.5">pendente/andamento</div>
        </div>
        <div className="bg-card border-t-4 border-t-red-500 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">VENCIDAS</div>
          <div className="text-3xl font-bold text-red-alert">{vencidas}</div>
          <div className="text-xs text-muted-foreground mt-0.5">prazo expirado</div>
        </div>
        <div className="bg-card border-t-4 border-t-green-500 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">CONCLUÍDAS</div>
          <div className="text-3xl font-bold text-green-ok">{concluidas}</div>
          <div className="text-xs text-muted-foreground mt-0.5">este mês</div>
        </div>
      </div>

      {/* Feriados e Suspensões */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-primary">
              FERIADOS E SUSPENSÕES DE PRAZO
            </h2>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowFeriados(!showFeriados)}
            >
              {showFeriados ? "Ocultar" : "Ver Todos"}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowFormFeriado(true)}
            >
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
                  <span className="text-[0.65rem] bg-muted px-2 py-0.5 rounded-full">
                    {f.abrangencia}
                  </span>
                )}
              </div>
            ))}
          </div>
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
                      <span className="text-[0.65rem] bg-muted px-2 py-0.5 rounded-full">
                        {f.tipo}
                      </span>
                      <span className="text-[0.65rem] bg-muted px-2 py-0.5 rounded-full">
                        {f.abrangencia}
                      </span>
                    </div>
                  </div>
                  {f.abrangencia !== 'nacional' && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-alert"
                      onClick={() => handleDeleteFeriado(f.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Formulário de Feriado */}
      {showFormFeriado && (
        <div className="bg-card border border-accent/30 rounded-2xl p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold">Novo Feriado/Suspensão</h2>
            <Button variant="ghost" size="sm" onClick={resetFormFeriado}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <InputField 
              label="Data *" 
              value={formFeriado.data} 
              onChange={(v) => setFormFeriado({ ...formFeriado, data: v })} 
              type="date" 
            />
            <InputField 
              label="Descrição *" 
              value={formFeriado.descricao} 
              onChange={(v) => setFormFeriado({ ...formFeriado, descricao: v })} 
              placeholder="Ex: Feriado Municipal" 
            />
            <div>
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground">Tipo</label>
              <select
                className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent outline-none"
                value={formFeriado.tipo}
                onChange={(e) => setFormFeriado({ ...formFeriado, tipo: e.target.value as any })}
              >
                <option value="feriado">Feriado</option>
                <option value="suspensao">Suspensão de Prazo</option>
                <option value="recesso">Recesso</option>
              </select>
            </div>
            <div>
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground">Abrangência</label>
              <select
                className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent outline-none"
                value={formFeriado.abrangencia}
                onChange={(e) => setFormFeriado({ ...formFeriado, abrangencia: e.target.value as any })}
              >
                <option value="local">Local</option>
                <option value="municipal">Municipal</option>
                <option value="estadual">Estadual</option>
                <option value="nacional">Nacional</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="gold" onClick={handleCreateFeriado} disabled={createFeriado.isPending}>
              {createFeriado.isPending ? "Salvando..." : "Salvar"}
            </Button>
            <Button variant="outline" onClick={resetFormFeriado}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {([
          ["todas", "Todas"],
          ["pendente", "Pendente"],
          ["andamento", "Andamento"],
          ["ag_cliente", "Ag. Cliente"],
          ["ag_tribunal", "Ag. Tribunal"],
          ["concluidas", "Concluídas"],
          ["canceladas", "Canceladas"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === key
                ? "bg-accent text-primary"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Formulário de Tarefa */}
      {showForm && (
        <div className="bg-card border border-accent/30 rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="font-display text-xl font-bold mb-4">
            {editingId ? "Editar Tarefa" : "Nova Tarefa"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <InputField 
              label="Título *" 
              value={form.titulo} 
              onChange={(v) => setForm({ ...form, titulo: v })} 
              placeholder="Título da tarefa" 
            />
            <div>
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground">Prioridade</label>
              <select
                className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent outline-none"
                value={form.prioridade}
                onChange={(e) => setForm({ ...form, prioridade: e.target.value })}
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div>
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground">Status</label>
              <select
                className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent outline-none"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="pendente">Pendente</option>
                <option value="andamento">Em Andamento</option>
                <option value="ag_cliente">Aguardando Cliente</option>
                <option value="ag_tribunal">Aguardando Tribunal</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
            <div className="md:col-span-2 bg-accent/5 rounded-xl border border-accent/20 p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground block mb-1">
                  Dias Úteis para Vencimento
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="Ex: 15"
                  value={form.diasUteis}
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
                <p className="text-[0.68rem] text-muted-foreground mt-1">
                  Exclui sáb, dom e {feriados.length > 0 ? `${feriados.length} feriado(s)` : "feriados"}
                </p>
              </div>
              <div>
                <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground block mb-1">
                  Data de Vencimento
                </label>
                <input
                  type="date"
                  value={form.data_vencimento}
                  onChange={(e) => setForm({ ...form, data_vencimento: e.target.value, diasUteis: "" })}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent outline-none"
                />
                {form.data_vencimento && form.diasUteis && (
                  <p className="text-[0.7rem] font-semibold text-accent mt-1">
                    📅 {form.diasUteis} dias úteis a partir de hoje
                  </p>
                )}
              </div>
            </div>
            <div>
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground">Processo vinculado</label>
              <select
                className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent outline-none"
                value={form.processo_id}
                onChange={(e) => setForm({ ...form, processo_id: e.target.value })}
              >
                <option value="">Nenhum</option>
                {processos.map((p) => (
                  <option key={p.id} value={p.id}>{p.numero_cnj}</option>
                ))}
              </select>
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
            <Button 
              variant="gold" 
              onClick={handleCreateOrUpdate} 
              disabled={createTarefa.isPending || updateTarefa.isPending}
            >
              {(createTarefa.isPending || updateTarefa.isPending) ? "Salvando..." : "Salvar"}
            </Button>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : viewMode === "agenda" ? (
        <AgendaCalendario tarefas={tarefas} />
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground text-sm">Nenhuma tarefa encontrada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const isVencida = t.data_vencimento && t.status !== "concluida" && new Date(t.data_vencimento) < now;
            const processo = t.processo;
            
            const statusTarefaColor = (status: string) => {
              if (status === "concluida") return "text-green-ok bg-green-ok/10";
              if (status === "cancelada") return "text-muted-foreground bg-muted";
              if (status === "andamento") return "text-blue-500 bg-blue-500/10";
              if (status === "ag_cliente") return "text-amber-500 bg-amber-500/10";
              if (status === "ag_tribunal") return "text-purple-500 bg-purple-500/10";
              return "text-muted-foreground bg-muted/50"; // pendente
            };

            const statusTarefaLabel = (status: string) => {
              if (status === "concluida") return "Concluída";
              if (status === "cancelada") return "Cancelada";
              if (status === "andamento") return "Em Andamento";
              if (status === "ag_cliente") return "Ag. Cliente";
              if (status === "ag_tribunal") return "Ag. Tribunal";
              return "Pendente";
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
                        <div className={`font-semibold text-sm ${t.status === "concluida" ? "line-through" : ""}`}>
                          {t.titulo}
                        </div>
                        <span className={`text-[0.65rem] px-2 py-0.5 rounded-full font-bold uppercase ${statusTarefaColor(t.status)}`}>
                          {statusTarefaLabel(t.status)}
                        </span>
                      </div>
                      {t.descricao && <div className="text-xs text-muted-foreground truncate">{t.descricao}</div>}
                      {processo && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs text-muted-foreground font-mono">
                            📋 {processo.numero_cnj}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[0.65rem] px-2 py-0.5 rounded-full font-bold uppercase ${prioridadeColor(t.prioridade)}`}>
                      {t.prioridade}
                    </span>
                    {t.data_vencimento && (
                      <span className={`text-xs font-mono ${isVencida ? "text-red-alert font-bold" : "text-muted-foreground"}`}>
                        {fmtDataLocal(t.data_vencimento)}
                      </span>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-accent" 
                      onClick={() => handleEdit(t)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-alert" 
                      onClick={() => handleDelete(t.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InputField({ 
  label, 
  value, 
  onChange, 
  placeholder, 
  type = "text" 
}: { 
  label: string; 
  value: string; 
  onChange: (v: string) => void; 
  placeholder?: string; 
  type?: string;
}) {
  return (
    <div>
      <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
        placeholder={placeholder}
      />
    </div>
  );
}

// ── Componente de Agenda / Calendário Mensal ────────────────────────────────
function AgendaCalendario({ tarefas }: { tarefas: any[] }) {
  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;

  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());

  const nomesMeses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const diasSemana = ["SEG","TER","QUA","QUI","SEX","SÁB","DOM"];

  const irParaHoje = () => { setMes(hoje.getMonth()); setAno(hoje.getFullYear()); };
  const mesAnterior = () => { if (mes === 0) { setMes(11); setAno(a => a - 1); } else setMes(m => m - 1); };
  const proximoMes  = () => { if (mes === 11) { setMes(0); setAno(a => a + 1); } else setMes(m => m + 1); };

  // Monta grid do calendário (lunedì = index 0)
  const primeiroDia = new Date(ano, mes, 1);
  const ultimoDia   = new Date(ano, mes + 1, 0);
  // getDay(): 0=dom,1=seg...6=sab → queremos seg=0
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
                    className={`text-[0.62rem] font-semibold px-1.5 py-0.5 rounded truncate leading-snug ${corTarefa(t)}`}
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
