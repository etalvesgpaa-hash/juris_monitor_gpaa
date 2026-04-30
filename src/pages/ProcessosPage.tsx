import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useProcessos, useCreateProcesso, useDeleteProcesso, useMovimentacoes } from "@/hooks/useProcessos";
import { useClientes } from "@/hooks/useClientes";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Trash2 } from "lucide-react";
import type { Processo } from "@/hooks/useProcessos";

export function ProcessosPage() {
  const { data: processos = [], isLoading } = useProcessos();
  const { data: clientes = [] } = useClientes();
  const createProcesso = useCreateProcesso();
  const deleteProcesso = useDeleteProcesso();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [selectedProcesso, setSelectedProcesso] = useState<Processo | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [form, setForm] = useState({
    numero_cnj: "",
    classe: "",
    assunto: "",
    tribunal: "",
    vara: "",
    comarca: "",
    status: "ativo",
    valor_causa: "",
    partes: "",
    advogados: "",
    cliente_id: "",
  });

  const resetForm = () => {
    setForm({ numero_cnj: "", classe: "", assunto: "", tribunal: "", vara: "", comarca: "", status: "ativo", valor_causa: "", partes: "", advogados: "", cliente_id: "" });
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!form.numero_cnj.trim()) {
      toast({ title: "Informe o número CNJ", variant: "destructive" });
      return;
    }
    try {
      await createProcesso.mutateAsync({
        numero_cnj: form.numero_cnj,
        classe: form.classe || null,
        assunto: form.assunto || null,
        tribunal: form.tribunal || null,
        vara: form.vara || null,
        comarca: form.comarca || null,
        status: form.status,
        valor_causa: form.valor_causa ? parseFloat(form.valor_causa) : null,
        partes: form.partes || null,
        advogados: form.advogados || null,
        cliente_id: form.cliente_id || null,
      });
      toast({ title: "Processo cadastrado!" });
      resetForm();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este processo?")) return;
    try {
      await deleteProcesso.mutateAsync(id);
      toast({ title: "Processo excluído" });
      setSelectedProcesso(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const filtered = processos.filter(
    (p) =>
      (p.numero_cnj.toLowerCase().includes(search.toLowerCase()) ||
        (p.assunto || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.partes || "").toLowerCase().includes(search.toLowerCase())) &&
      (filterStatus === "todos" || p.status === filterStatus)
  );

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-7">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Processos Cadastrados</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerenciar e monitore processos via API DataJud CNJ</p>
        </div>
        <Button variant="gold" onClick={() => setShowForm(true)}>+ Cadastrar Processo</Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <input
          className="flex-1 border border-border rounded-lg px-4 py-3 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
          placeholder="Buscar número, parte, assunto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-3">
          <select
            className="border border-border rounded-lg px-4 py-3 text-sm bg-card focus:border-accent outline-none"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="todos">Todos os status</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
            <option value="arquivado">Arquivados</option>
          </select>
          <Button variant="outline">⚙️ Atualizar</Button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-card border border-accent/30 rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="font-display text-xl font-bold mb-4">Novo Processo</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <InputField label="Número CNJ *" value={form.numero_cnj} onChange={(v) => setForm({ ...form, numero_cnj: v })} placeholder="0001234-56.2024.8.26.0100" />
            <InputField label="Classe" value={form.classe} onChange={(v) => setForm({ ...form, classe: v })} placeholder="Ação Trabalhista" />
            <InputField label="Assunto" value={form.assunto} onChange={(v) => setForm({ ...form, assunto: v })} placeholder="Rescisão indireta" />
            <InputField label="Tribunal" value={form.tribunal} onChange={(v) => setForm({ ...form, tribunal: v })} placeholder="TJSP" />
            <InputField label="Vara" value={form.vara} onChange={(v) => setForm({ ...form, vara: v })} placeholder="1ª Vara Cível" />
            <InputField label="Comarca" value={form.comarca} onChange={(v) => setForm({ ...form, comarca: v })} placeholder="São Paulo" />
            <InputField label="Valor da Causa (R$)" value={form.valor_causa} onChange={(v) => setForm({ ...form, valor_causa: v })} placeholder="50000.00" />
            <div>
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground">Cliente</label>
              <select
                className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent outline-none"
                value={form.cliente_id}
                onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
              >
                <option value="">Sem cliente vinculado</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <InputField label="Partes" value={form.partes} onChange={(v) => setForm({ ...form, partes: v })} placeholder="Autor vs Réu" />
            <InputField label="Advogados" value={form.advogados} onChange={(v) => setForm({ ...form, advogados: v })} placeholder="Dr. Fulano OAB/SP 12345" />
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="gold" onClick={handleCreate} disabled={createProcesso.isPending}>
              {createProcesso.isPending ? "Salvando..." : "Salvar Processo"}
            </Button>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground text-sm">Nenhum processo encontrado.</p>
          <p className="text-muted-foreground text-xs mt-1">Cadastre um processo para começar.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-[0.75rem] uppercase tracking-wide text-muted-foreground">DATA</th>
                  <th className="px-4 py-3 text-left font-semibold text-[0.75rem] uppercase tracking-wide text-muted-foreground">PROCESSO</th>
                  <th className="px-4 py-3 text-left font-semibold text-[0.75rem] uppercase tracking-wide text-muted-foreground">TIPO / ÓRGÃO</th>
                  <th className="px-4 py-3 text-left font-semibold text-[0.75rem] uppercase tracking-wide text-muted-foreground">PUBLICAÇÃO</th>
                  <th className="px-4 py-3 text-left font-semibold text-[0.75rem] uppercase tracking-wide text-muted-foreground">PARTES</th>
                  <th className="px-4 py-3 text-left font-semibold text-[0.75rem] uppercase tracking-wide text-muted-foreground">STATUS</th>
                  <th className="px-4 py-3 text-left font-semibold text-[0.75rem] uppercase tracking-wide text-muted-foreground">AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-sm font-bold text-accent">{p.numero_cnj}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{p.assunto || p.classe || "Sem assunto"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{p.vara || p.tribunal || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-muted-foreground max-w-xs truncate">{p.partes || p.advogados || "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                        p.status === "ativo" ? "bg-green-ok/10 text-green-ok" :
                        p.status === "arquivado" ? "bg-muted text-muted-foreground" :
                        "bg-accent/10 text-accent"
                      }`}>
                        {p.status === "ativo" ? "Ativo" : p.status === "arquivado" ? "Arquivado" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedProcesso(p)}
                          className="p-1.5 hover:bg-accent/10 rounded transition-colors"
                          title="Visualizar"
                        >
                          <Eye className="h-4 w-4 text-accent" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 hover:bg-red-alert/10 rounded transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4 text-red-alert" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <ProcessoDetailDialog
        processo={selectedProcesso}
        onClose={() => setSelectedProcesso(null)}
        onDelete={handleDelete}
      />
    </div>
  );
}

function ProcessoDetailDialog({ processo, onClose, onDelete }: { processo: Processo | null; onClose: () => void; onDelete: (id: string) => void }) {
  const { data: movimentacoes = [] } = useMovimentacoes(processo?.id ?? null);

  if (!processo) return null;

  return (
    <Dialog open={!!processo} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Processo {processo.numero_cnj}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Detail label="Classe" value={processo.classe} />
            <Detail label="Assunto" value={processo.assunto} />
            <Detail label="Tribunal" value={processo.tribunal} />
            <Detail label="Vara" value={processo.vara} />
            <Detail label="Comarca" value={processo.comarca} />
            <Detail label="Status" value={processo.status} />
            <Detail label="Valor da Causa" value={processo.valor_causa ? `R$ ${Number(processo.valor_causa).toLocaleString("pt-BR")}` : null} />
            <Detail label="Partes" value={processo.partes} />
            <Detail label="Advogados" value={processo.advogados} />
          </div>

          {processo.resumo_ia && (
            <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
              <div className="text-[0.72rem] font-bold uppercase tracking-widest text-accent mb-2">🤖 Resumo IA</div>
              <p className="text-sm leading-relaxed">{processo.resumo_ia}</p>
            </div>
          )}

          {/* Movimentações */}
          <div>
            <div className="text-[0.72rem] font-bold uppercase tracking-widest text-foreground mb-2 flex items-center gap-1.5">
              <div className="w-[18px] h-0.5 bg-accent" />
              Movimentações ({movimentacoes.length})
            </div>
            {movimentacoes.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {movimentacoes.map((m) => (
                  <div key={m.id} className="border-l-2 border-accent/30 pl-3 py-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">
                        {new Date(m.data).toLocaleDateString("pt-BR")}
                      </span>
                      <span className="font-semibold text-sm">{m.titulo}</span>
                    </div>
                    {m.descricao && <p className="text-xs text-muted-foreground mt-0.5">{m.descricao}</p>}
                    {m.analise_ia && (
                      <p className="text-xs text-accent mt-1 italic">🤖 {m.analise_ia}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
            <Button variant="destructive" size="sm" onClick={() => onDelete(processo.id)}>Excluir</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <div className="text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value || "—"}</div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
        placeholder={placeholder}
      />
    </div>
  );
}
