import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTarefas, useCreateTarefa, useUpdateTarefa, useDeleteTarefa } from "@/hooks/useTarefas";
import { useProcessos } from "@/hooks/useProcessos";
import { useToast } from "@/hooks/use-toast";

export function TarefasPage() {
  const { data: tarefas = [], isLoading } = useTarefas();
  const { data: processos = [] } = useProcessos();
  const createTarefa = useCreateTarefa();
  const updateTarefa = useUpdateTarefa();
  const deleteTarefa = useDeleteTarefa();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"todas" | "pendente" | "concluida">("todas");
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
    if (filter === "pendente") return t.status !== "concluida";
    if (filter === "concluida") return t.status === "concluida";
    return true;
  });

  const now = new Date();

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
          <p className="text-sm text-muted-foreground mt-1">Controle prazos e atividades</p>
        </div>
        <Button variant="gold" onClick={() => setShowForm(true)}>+ Nova Tarefa</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        {([["todas", "Todas"], ["pendente", "Pendentes"], ["concluida", "Concluídas"]] as const).map(([key, label]) => (
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
