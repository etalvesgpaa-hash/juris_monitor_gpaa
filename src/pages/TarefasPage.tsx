import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTarefas, useCreateTarefa, useUpdateTarefa, useDeleteTarefa } from "@/hooks/useTarefas";
import { useProcessos } from "@/hooks/useProcessos";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "lucide-react";

type FilterType = "todas" | "pendente" | "andamento" | "ag_cliente" | "ag_tribunal" | "concluidas" | "canceladas";

export function TarefasPage() {
  const { data: tarefas = [], isLoading } = useTarefas();
  const { data: processos = [] } = useProcessos();
  const createTarefa = useCreateTarefa();
  const updateTarefa = useUpdateTarefa();
  const deleteTarefa = useDeleteTarefa();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<FilterType>("todas");
  const [viewMode, setViewMode] = useState<"lista" | "agenda">("lista");
  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    data_vencimento: "",
    prioridade: "media",
    processo_id: "",
  });

  const resetForm = () => {
    setForm({ titulo: "", descricao: "", data_vencimento: "", prioridade: "media", processo_id: "" });
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!form.titulo.trim()) {
      toast({ title: "Informe o título", variant: "destructive" });
      return;
    }
    try {
      await createTarefa.mutateAsync({
        titulo: form.titulo,
        descricao: form.descricao || null,
        data_vencimento: form.data_vencimento || null,
        prioridade: form.prioridade,
        processo_id: form.processo_id || null,
      });
      toast({ title: "Tarefa criada!" });
      resetForm();
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
          <Button variant="gold" onClick={() => setShowForm(true)}>+ Nova Tarefa</Button>
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
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-primary">
            FERIADOS E SUSPENSÕES DE PRAZO
          </h2>
        </div>
        <p className="text-xs text-muted-foreground italic">
          Cadastrados aqui, válidos para <strong>todas as tarefas</strong>. Os feriados nacionais já são automáticos.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          <em>Nenhum feriado extra cadastrado.</em>
        </p>
      </div>

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

      {showForm && (
        <div className="bg-card border border-accent/30 rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="font-display text-xl font-bold mb-4">Nova Tarefa</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <InputField label="Título *" value={form.titulo} onChange={(v) => setForm({ ...form, titulo: v })} placeholder="Título da tarefa" />
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
            <InputField label="Data de Vencimento" value={form.data_vencimento} onChange={(v) => setForm({ ...form, data_vencimento: v })} placeholder="YYYY-MM-DD" type="date" />
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
            <Button variant="gold" onClick={handleCreate} disabled={createTarefa.isPending}>
              {createTarefa.isPending ? "Salvando..." : "Salvar"}
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
                    <div className="min-w-0">
                      <div className={`font-semibold text-sm ${t.status === "concluida" ? "line-through" : ""}`}>{t.titulo}</div>
                      {t.descricao && <div className="text-xs text-muted-foreground truncate">{t.descricao}</div>}
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
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-alert" onClick={() => handleDelete(t.id)}>
                      ✕
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

function InputField({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
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
