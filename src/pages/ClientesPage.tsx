import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useClientes, useCreateCliente, useUpdateCliente, useDeleteCliente } from "@/hooks/useClientes";
import { useToast } from "@/hooks/use-toast";
import { Edit2, Trash2, Mail, MailWarning, Pause, Play, Plus, Search, AlertCircle } from "lucide-react";import type { Cliente } from "../hooks/useClientes";

export function ClientesPage() {
  const { data: clientes = [], isLoading } = useClientes();
  const createCliente = useCreateCliente();
  const updateCliente = useUpdateCliente();
  const deleteCliente = useDeleteCliente();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    nome: "",
    cpf_cnpj: "",
    email: "",
    telefone: "",
    endereco: "",
    observacoes: "",
    numeros_processo: [] as string[],
    notificacoes_email: true,
    status_monitoramento: "ativo" as "ativo" | "pausado" | "inativo",
  });
  const [processoInput, setProcessoInput] = useState("");

  const resetForm = () => {
    setForm({
      nome: "",
      cpf_cnpj: "",
      email: "",
      telefone: "",
      endereco: "",
      observacoes: "",
      numeros_processo: [],
      notificacoes_email: true,
      status_monitoramento: "ativo",
    });
    setProcessoInput("");
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
      numeros_processo: c.numeros_processo || [],
      notificacoes_email: c.notificacoes_email ?? true,
      status_monitoramento: c.status_monitoramento || "ativo",
    });
    setEditing(c);
    setShowForm(true);
  };

  const adicionarProcesso = () => {
    const proc = processoInput.trim();
    if (!proc) return;
    
    // Remove duplicatas
    if (!form.numeros_processo.includes(proc)) {
      setForm({ ...form, numeros_processo: [...form.numeros_processo, proc] });
      setProcessoInput("");
    } else {
      toast({ title: "Processo já adicionado", variant: "default" });
    }
  };

  const removerProcesso = (proc: string) => {
    setForm({
      ...form,
      numeros_processo: form.numeros_processo.filter((p) => p !== proc),
    });
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast({ title: "Informe o nome do cliente", variant: "destructive" });
      return;
    }

    if (form.notificacoes_email && !form.email) {
      toast({
        title: "E-mail obrigatório",
        description: "Para ativar notificações, informe o e-mail do cliente",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      nome: form.nome,
      cpf_cnpj: form.cpf_cnpj || null,
      email: form.email || null,
      telefone: form.telefone || null,
      endereco: form.endereco || null,
      observacoes: form.observacoes || null,
      numeros_processo: form.numeros_processo.length > 0 ? form.numeros_processo : null,
      notificacoes_email: form.notificacoes_email,
      status_monitoramento: form.status_monitoramento,
    };

    try {
      if (editing) {
        await updateCliente.mutateAsync({ id: editing.id, ...payload });
        toast({ title: "✅ Cliente atualizado com sucesso!" });
      } else {
        await createCliente.mutateAsync(payload);
        toast({ title: "✅ Cliente cadastrado com sucesso!" });
      }
      resetForm();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita."))
      return;
    try {
      await deleteCliente.mutateAsync(id);
      toast({ title: "Cliente excluído com sucesso" });
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  const toggleNotificacoes = async (c: Cliente) => {
    if (!c.email && !c.notificacoes_email) {
      toast({
        title: "E-mail necessário",
        description: "Adicione um e-mail ao cliente para ativar notificações",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateCliente.mutateAsync({
        id: c.id,
        notificacoes_email: !c.notificacoes_email,
      });
      toast({
        title: c.notificacoes_email ? "Notificações desativadas" : "Notificações ativadas",
      });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const toggleStatus = async (c: Cliente) => {
    const novoStatus = c.status_monitoramento === "ativo" ? "pausado" : "ativo";
    try {
      await updateCliente.mutateAsync({
        id: c.id,
        status_monitoramento: novoStatus,
      });
      toast({
        title:
          novoStatus === "ativo"
            ? "Monitoramento reativado"
            : "Monitoramento pausado",
      });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const filtered = clientes.filter(
    (c) =>
      c.nome.toLowerCase().includes(search.toLowerCase()) ||
      (c.cpf_cnpj || "").includes(search) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.numeros_processo || []).some((p) => p.includes(search))
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4 mb-7">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie clientes e monitore intimações automaticamente
          </p>
        </div>
        <Button
          variant="gold"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Novo Cliente
        </Button>
      </div>

      {/* Busca */}
      <div className="mb-6 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          className="w-full pl-11 border border-border rounded-lg px-4 py-3 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
          placeholder="Buscar por nome, CPF/CNPJ, e-mail ou número de processo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-card border-2 border-accent/40 rounded-2xl p-6 mb-6 shadow-lg">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-xl font-bold">
              {editing ? "Editar Cliente" : "Novo Cliente"}
            </h2>
            <div className="flex gap-2">
              <Button variant="gold" onClick={handleSave} disabled={createCliente.isPending || updateCliente.isPending}>
                {createCliente.isPending || updateCliente.isPending ? "Salvando..." : "Salvar"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
            </div>
          </div>

          {/* Dados básicos */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Nome Completo *"
                value={form.nome}
                onChange={(v) => setForm({ ...form, nome: v })}
                placeholder="Nome do cliente"
              />
              <InputField
                label="CPF / CNPJ"
                value={form.cpf_cnpj}
                onChange={(v) => setForm({ ...form, cpf_cnpj: v })}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
              />
              <InputField
                label="E-mail"
                value={form.email}
                type="email"
                onChange={(v) => setForm({ ...form, email: v })}
                placeholder="email@exemplo.com"
              />
              <InputField
                label="Telefone"
                value={form.telefone}
                onChange={(v) => setForm({ ...form, telefone: v })}
                placeholder="(11) 99999-9999"
              />
            </div>

            <InputField
              label="Endereço"
              value={form.endereco}
              onChange={(v) => setForm({ ...form, endereco: v })}
              placeholder="Rua, número, bairro, cidade - UF"
            />

            {/* Processos */}
            <div className="border border-border rounded-xl p-4 bg-muted/30">
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground mb-3 block">
                Números de Processo (CNJ)
              </label>
              <p className="text-xs text-muted-foreground mb-3">
                Adicione os números de processo CNJ que deseja monitorar para este cliente. Quando
                houver novas intimações, o cliente receberá um e-mail automático.
              </p>

              <div className="flex gap-2 mb-3">
                <input
                  value={processoInput}
                  onChange={(e) => setProcessoInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && adicionarProcesso()}
                  className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all font-mono"
                  placeholder="0000000-00.0000.0.00.0000"
                />
                <Button variant="outline" size="sm" onClick={adicionarProcesso}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>

              {form.numeros_processo.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {form.numeros_processo.map((proc) => (
                    <div
                      key={proc}
                      className="inline-flex items-center gap-2 bg-accent/10 border border-accent/30 rounded-lg px-3 py-1.5 text-xs font-mono"
                    >
                      {proc}
                      <button
                        onClick={() => removerProcesso(proc)}
                        className="text-red-500 hover:text-red-700 ml-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Nenhum processo adicionado ainda
                </p>
              )}
            </div>

            {/* Configurações de Notificação */}
            <div className="border border-border rounded-xl p-4 bg-muted/30">
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground mb-3 block">
                Monitoramento e Notificações
              </label>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Notificações por E-mail</p>
                    <p className="text-xs text-muted-foreground">
                      Enviar e-mail automático quando houver novas intimações
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.notificacoes_email}
                      onChange={(e) =>
                        setForm({ ...form, notificacoes_email: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Status do Monitoramento</p>
                    <p className="text-xs text-muted-foreground">
                      Controle se as intimações deste cliente estão sendo monitoradas
                    </p>
                  </div>
                  <select
                    value={form.status_monitoramento}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status_monitoramento: e.target.value as "ativo" | "pausado" | "inativo",
                      })
                    }
                    className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="pausado">Pausado</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Observações */}
            <div>
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground block mb-2">
                Observações
              </label>
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all min-h-[100px]"
                placeholder="Notas e observações sobre o cliente..."
              />
            </div>
          </div>
        </div>
      )}

      {/* Lista de Clientes */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-3"></div>
          Carregando clientes...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">
            {search ? "Nenhum cliente encontrado com este filtro" : "Nenhum cliente cadastrado"}
          </p>
          {!search && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Cadastrar primeiro cliente
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {["NOME", "E-MAIL", "PROCESSOS", "STATUS", "NOTIFICAÇÕES", "CADASTRO", "AÇÕES"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                  >
                    {/* NOME */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-sm">{c.nome}</div>
                      {c.cpf_cnpj && (
                        <div className="text-xs text-muted-foreground font-mono">
                          {c.cpf_cnpj}
                        </div>
                      )}
                    </td>

                    {/* E-MAIL */}
                    <td className="px-4 py-3">
                      {c.email ? (
                        <div className="text-xs">{c.email}</div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Sem e-mail</span>
                      )}
                      {c.telefone && (
                        <div className="text-xs text-muted-foreground">{c.telefone}</div>
                      )}
                    </td>

                    {/* PROCESSOS */}
                    <td className="px-4 py-3">
                      {c.numeros_processo && c.numeros_processo.length > 0 ? (
                        <div className="space-y-1">
                          {c.numeros_processo.slice(0, 2).map((proc) => (
                            <div
                              key={proc}
                              className="text-xs font-mono bg-accent/10 px-2 py-0.5 rounded"
                            >
                              {proc}
                            </div>
                          ))}
                          {c.numeros_processo.length > 2 && (
                            <div className="text-xs text-muted-foreground">
                              +{c.numeros_processo.length - 2} mais
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Nenhum processo
                        </span>
                      )}
                    </td>

                    {/* STATUS */}
                    <td className="px-4 py-3">
                      {c.status_monitoramento === "ativo" ? (
                        <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                          Ativo
                        </Badge>
                      ) : c.status_monitoramento === "pausado" ? (
                        <Badge variant="outline">Pausado</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Inativo
                        </Badge>
                      )}
                    </td>

                    {/* NOTIFICAÇÕES */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleNotificacoes(c)}
                        className="flex items-center gap-1.5 text-xs hover:bg-muted/50 rounded-lg px-2 py-1 transition-colors"
                        title={
                          c.notificacoes_email
                            ? "Desativar notificações"
                            : "Ativar notificações"
                        }
                      >
                        {c.notificacoes_email ? (
                          <>
                            <Mail className="h-3.5 w-3.5 text-green-600" />
                            <span className="text-green-600">Ativas</span>
                          </>
                        ) : (
                          <>
                            <MailOff className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Desativadas</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* CADASTRO */}
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </td>

                    {/* AÇÕES */}
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(c)}
                          className="h-8"
                        >
                          <Edit2 className="h-3.5 w-3.5 mr-1" />
                          Editar
                        </Button>
                        {c.status_monitoramento === "ativo" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleStatus(c)}
                            className="h-8"
                            title="Pausar monitoramento"
                          >
                            <Pause className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleStatus(c)}
                            className="h-8"
                            title="Reativar monitoramento"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(c.id)}
                          className="h-8"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rodapé com estatísticas */}
      {filtered.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Exibindo {filtered.length} de {clientes.length} cliente(s)
          </div>
          <div className="flex gap-4">
            <span>
              Ativos:{" "}
              <strong className="text-green-600">
                {clientes.filter((c) => c.status_monitoramento === "ativo").length}
              </strong>
            </span>
            <span>
              Notificações:{" "}
              <strong className="text-accent">
                {clientes.filter((c) => c.notificacoes_email).length}
              </strong>
            </span>
          </div>
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
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground block mb-2">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
        placeholder={placeholder}
      />
    </div>
  );
}
