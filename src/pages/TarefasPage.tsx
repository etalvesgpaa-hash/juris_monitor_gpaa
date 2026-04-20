import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTarefas, useCreateTarefa, useUpdateTarefa, useDeleteTarefa } from "@/hooks/useTarefas";
import { useFeriados, useCreateFeriado, useDeleteFeriado, calcularDiasUteis } from "@/hooks/useFeriados";
import { useProcessos } from "@/hooks/useProcessos";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Edit2, Trash2, Plus, X } from "lucide-react";

type FilterType = "todas" | "pendente" | "andamento" | "ag_cliente" | "ag_tribunal" | "concluidas" | "canceladas";

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
    prioridade: "media",
    processo_id: "",
  });

  const [formFeriado, setFormFeriado] = useState({
    data: "",
    descricao: "",
    tipo: "feriado" as "feriado" | "suspensao" | "recesso",
    abrangencia: "local" as "nacional" | "estadual" | "municipal" | "local",
  });

  const resetForm = () => {
    setForm({ titulo: "", descricao: "", data_vencimento: "", prioridade: "media", processo_id: "" });
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
      data_vencimento: t.data_vencimento ? new Date(t.data_vencimento).toISOString().split('T')[0] : "",
      prioridade: t.prioridade,
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
          processo_id: form.processo_id || null,
        });
        toast({ title: "Tarefa atualizada!" });
      } else {
        await createTarefa.mutateAsync({
          titulo: form.titulo,
          descricao: form.descricao || null,
          data_vencimento: form.data_vencimento || null,
          prioridade: form.prioridade,
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
  const feriadosFuturos = feriados
    .filter(f => new Date(f.data) >= now)
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
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
                <span className="font-mono">{new Date(f.data).toLocaleDateString('pt-BR')}</span>
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
                      <span className="text-sm font-mono font-semibold">{new Date(f.data).toLocaleDateString('pt-BR')}</span>
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
            <InputField 
              label="Data de Vencimento" 
              value={form.data_vencimento} 
              onChange={(v) => setForm({ ...form, data_vencimento: v })} 
              type="date" 
            />
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
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground text-sm">Nenhuma tarefa encontrada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const isVencida = t.data_vencimento && t.status !== "concluida" && new Date(t.data_vencimento) < now;
            const processo = t.processo;
            const statusProcesso = processo?.status || null;
            
            const statusProcessoColor = (status: string | null) => {
              if (!status) return "";
              if (status === "ativo") return "text-green-ok bg-green-ok/10";
              if (status === "arquivado") return "text-muted-foreground bg-muted";
              if (status === "suspenso") return "text-amber-500 bg-amber-500/10";
              return "text-accent bg-accent/10";
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
                      <div className={`font-semibold text-sm ${t.status === "concluida" ? "line-through" : ""}`}>
                        {t.titulo}
                      </div>
                      {t.descricao && <div className="text-xs text-muted-foreground truncate">{t.descricao}</div>}
                      {processo && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs text-muted-foreground font-mono">
                            📋 {processo.numero_cnj}
                          </span>
                          {statusProcesso && (
                            <span className={`text-[0.65rem] px-2 py-0.5 rounded-full font-bold uppercase ${statusProcessoColor(statusProcesso)}`}>
                              {statusProcesso}
                            </span>
                          )}
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
                        {new Date(t.data_vencimento).toLocaleDateString("pt-BR")}
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
