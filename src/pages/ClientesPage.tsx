import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useClientes, useCreateCliente, useUpdateCliente, useDeleteCliente } from "@/hooks/useClientes";
import { useToast } from "@/hooks/use-toast";
;
import type { Cliente } from "@/hooks/useClientes";

export function ClientesPage() {
  const { data: clientes = [], isLoading } = useClientes();
  const createCliente = useCreateCliente();
  const updateCliente = useUpdateCliente();
  const deleteCliente = useDeleteCliente();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ nome: "", cpf_cnpj: "", email: "", telefone: "", endereco: "", observacoes: "" });

  const resetForm = () => {
    setForm({ nome: "", cpf_cnpj: "", email: "", telefone: "", endereco: "", observacoes: "" });
    setShowForm(false);
    setEditing(null);
  };

  const openEdit = (c: Cliente) => {
    setForm({
      nome: c.nome,
      cpf_cnpj: c.cpf_cnpj || "",
      email: c.email || "",
      telefone: c.telefone || "",
      endereco: c.endereco || "",
      observacoes: c.observacoes || "",
    });
    setEditing(c);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast({ title: "Informe o nome", variant: "destructive" });
      return;
    }
    const payload = {
      nome: form.nome,
      cpf_cnpj: form.cpf_cnpj || null,
      email: form.email || null,
      telefone: form.telefone || null,
      endereco: form.endereco || null,
      observacoes: form.observacoes || null,
    };
    try {
      if (editing) {
        await updateCliente.mutateAsync({ id: editing.id, ...payload });
        toast({ title: "Cliente atualizado!" });
      } else {
        await createCliente.mutateAsync(payload);
        toast({ title: "Cliente cadastrado!" });
      }
      resetForm();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este cliente?")) return;
    try {
      await deleteCliente.mutateAsync(id);
      toast({ title: "Cliente excluído" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const filtered = clientes.filter(
    (c) =>
      c.nome.toLowerCase().includes(search.toLowerCase()) ||
      (c.cpf_cnpj || "").includes(search) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-7">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie seus clientes e contatos</p>
        </div>
        <Button variant="gold" onClick={() => { resetForm(); setShowForm(true); }}>+ Novo Cliente</Button>
      </div>

      <div className="mb-6">
        <input
          className="w-full max-w-lg border border-border rounded-lg px-4 py-3 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
          placeholder="Buscar por nome, CPF/CNPJ ou e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {showForm && (
        <div className="bg-card border border-accent/30 rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="font-display text-xl font-bold mb-4">{editing ? "Editar Cliente" : "Novo Cliente"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <InputField label="Nome *" value={form.nome} onChange={(v) => setForm({ ...form, nome: v })} placeholder="Nome completo" />
            <InputField label="CPF / CNPJ" value={form.cpf_cnpj} onChange={(v) => setForm({ ...form, cpf_cnpj: v })} placeholder="000.000.000-00" />
            <InputField label="E-mail" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="email@exemplo.com" />
            <InputField label="Telefone" value={form.telefone} onChange={(v) => setForm({ ...form, telefone: v })} placeholder="(11) 99999-9999" />
            <div className="md:col-span-2">
              <InputField label="Endereço" value={form.endereco} onChange={(v) => setForm({ ...form, endereco: v })} placeholder="Rua, número, bairro, cidade" />
            </div>
            <div className="md:col-span-2">
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground">Observações</label>
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all min-h-[80px]"
                placeholder="Notas sobre o cliente..."
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="gold" onClick={handleSave} disabled={createCliente.isPending || updateCliente.isPending}>
              {createCliente.isPending || updateCliente.isPending ? "Salvando..." : "Salvar"}
            </Button>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground text-sm">Nenhum cliente encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <div key={c.id} className="bg-card border border-border rounded-xl p-4 hover:border-accent/40 hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm">{c.nome}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {[c.cpf_cnpj, c.email, c.telefone].filter(Boolean).join(" · ") || "Sem dados adicionais"}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => openEdit(c)}>Editar</Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(c.id)}>Excluir</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
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
