import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Plus, X, Edit2, Trash2, TrendingUp, TrendingDown,
  Clock, CheckCircle2, AlertCircle, DollarSign, Filter
} from "lucide-react";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Lancamento {
  id: string;
  user_id: string;
  cliente_nome: string;
  processo: string | null;
  tipo: string;
  descricao: string | null;
  valor: number;
  data_vencimento: string;
  data_recebimento: string | null;
  status: string;
  observacoes: string | null;
  created_at: string;
}

const TIPOS = ["Honorários", "Êxito", "Custas", "Acordo", "Outros"];
const STATUS_OPTIONS = ["pendente", "recebido", "atrasado"];
const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const CORES_MESES = [
  "#4f86c6","#6a9fd8","#5ba85a","#7bc67a",
  "#c9a84c","#e8b84b","#e07b39","#d4573a",
  "#9b59b6","#7d3c98","#2e86ab","#1a5276",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtData(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function statusLabel(s: string) {
  if (s === "recebido") return "Recebido";
  if (s === "atrasado") return "Atrasado";
  return "Pendente";
}

function statusColor(s: string) {
  if (s === "recebido") return "bg-green-100 text-green-700 border-green-300";
  if (s === "atrasado") return "bg-red-100 text-red-700 border-red-300";
  return "bg-yellow-100 text-yellow-700 border-yellow-300";
}

function calcStatus(l: Lancamento): string {
  if (l.status === "recebido") return "recebido";
  const hoje = new Date().toISOString().slice(0, 10);
  if (l.data_vencimento < hoje) return "atrasado";
  return "pendente";
}

const EMPTY_FORM = {
  cliente_nome: "",
  processo: "",
  tipo: "Honorários",
  descricao: "",
  valor: "",
  data_vencimento: "",
  data_recebimento: "",
  status: "pendente",
  observacoes: "",
};

// ── Componente principal ──────────────────────────────────────────────────────

export function FinanceiroPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Lancamento | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [filtroMes, setFiltroMes] = useState<number | "todos">("todos");
  const [filtroAno, setFiltroAno] = useState<number>(new Date().getFullYear());
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: lancamentos = [], isLoading } = useQuery({
    queryKey: ["financeiro", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro")
        .select("*")
        .eq("user_id", user!.id)
        .order("data_vencimento", { ascending: false });
      if (error) throw error;
      return (data || []) as Lancamento[];
    },
    enabled: !!user,
  });

  // Enriquecer com status calculado
  const lancamentosComStatus = useMemo(() =>
    lancamentos.map(l => ({ ...l, status: calcStatus(l) })),
    [lancamentos]
  );

  // ── Filtros ─────────────────────────────────────────────────────────────────

  const filtrados = useMemo(() => {
    return lancamentosComStatus.filter(l => {
      const [y, m] = l.data_vencimento.slice(0, 7).split("-");
      if (filtroMes !== "todos" && parseInt(m) - 1 !== filtroMes) return false;
      if (parseInt(y) !== filtroAno) return false;
      if (filtroStatus !== "todos" && l.status !== filtroStatus) return false;
      if (filtroCliente && !l.cliente_nome.toLowerCase().includes(filtroCliente.toLowerCase())) return false;
      return true;
    });
  }, [lancamentosComStatus, filtroMes, filtroAno, filtroStatus, filtroCliente]);

  // ── Somatórios ──────────────────────────────────────────────────────────────

  const totalPendente = filtrados.filter(l => l.status === "pendente").reduce((s, l) => s + l.valor, 0);
  const totalRecebido = filtrados.filter(l => l.status === "recebido").reduce((s, l) => s + l.valor, 0);
  const totalAtrasado = filtrados.filter(l => l.status === "atrasado").reduce((s, l) => s + l.valor, 0);
  const totalGeral    = filtrados.reduce((s, l) => s + l.valor, 0);

  // ── Gráfico mensal ──────────────────────────────────────────────────────────

  const dadosMensais = useMemo(() => {
    return MESES.map((mes, i) => {
      const do_mes = lancamentosComStatus.filter(l => {
        const [y, m] = l.data_vencimento.slice(0, 7).split("-");
        return parseInt(m) - 1 === i && parseInt(y) === filtroAno;
      });
      return {
        mes,
        total: do_mes.reduce((s, l) => s + l.valor, 0),
        recebido: do_mes.filter(l => l.status === "recebido").reduce((s, l) => s + l.valor, 0),
        pendente: do_mes.filter(l => l.status !== "recebido").reduce((s, l) => s + l.valor, 0),
      };
    });
  }, [lancamentosComStatus, filtroAno]);

  const maxMensal = Math.max(...dadosMensais.map(d => d.total), 1);

  // ── Mutations ────────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editing) {
        const { error } = await supabase.from("financeiro").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("financeiro").insert({ ...payload, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      toast.success(editing ? "Lançamento atualizado!" : "Lançamento criado!");
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financeiro").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      toast.success("Lançamento excluído.");
      setDeleteConfirm(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setEditing(null);
    setShowForm(false);
  }

  function openEdit(l: Lancamento) {
    setForm({
      cliente_nome: l.cliente_nome,
      processo: l.processo || "",
      tipo: l.tipo,
      descricao: l.descricao || "",
      valor: String(l.valor),
      data_vencimento: l.data_vencimento.slice(0, 10),
      data_recebimento: l.data_recebimento?.slice(0, 10) || "",
      status: l.status,
      observacoes: l.observacoes || "",
    });
    setEditing(l);
    setShowForm(true);
  }

  function handleSave() {
    if (!form.cliente_nome.trim()) return toast.error("Informe o nome do cliente.");
    if (!form.valor || isNaN(parseFloat(form.valor))) return toast.error("Informe um valor válido.");
    if (!form.data_vencimento) return toast.error("Informe a data de vencimento.");

    saveMutation.mutate({
      cliente_nome: form.cliente_nome.trim(),
      processo: form.processo || null,
      tipo: form.tipo,
      descricao: form.descricao || null,
      valor: parseFloat(form.valor.replace(",", ".")),
      data_vencimento: form.data_vencimento,
      data_recebimento: form.data_recebimento || null,
      status: form.status,
      observacoes: form.observacoes || null,
    });
  }

  const anos = Array.from(
    new Set(lancamentos.map(l => parseInt(l.data_vencimento.slice(0, 4))))
  ).sort((a, b) => b - a);
  if (!anos.includes(filtroAno)) anos.push(filtroAno);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="page-stack">

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h1 className="page-title">Financeiro</h1>
              <p className="text-xs text-muted-foreground">Controle de valores a receber</p>
            </div>
          </div>
        </div>
        <Button variant="gold" onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Lançamento
        </Button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold text-muted-foreground uppercase">Total</span>
          </div>
          <p className="text-lg font-bold font-mono">{fmtMoeda(totalGeral)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-xs font-semibold text-muted-foreground uppercase">Recebido</span>
          </div>
          <p className="text-lg font-bold font-mono text-green-600">{fmtMoeda(totalRecebido)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-yellow-600" />
            <span className="text-xs font-semibold text-muted-foreground uppercase">Pendente</span>
          </div>
          <p className="text-lg font-bold font-mono text-yellow-600">{fmtMoeda(totalPendente)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-xs font-semibold text-muted-foreground uppercase">Atrasado</span>
          </div>
          <p className="text-lg font-bold font-mono text-red-600">{fmtMoeda(totalAtrasado)}</p>
        </div>
      </div>

      {/* Gráfico mensal */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-display font-semibold text-sm">Visão Mensal — {filtroAno}</h2>
          <select
            value={filtroAno}
            onChange={e => setFiltroAno(parseInt(e.target.value))}
            className="border border-border rounded-lg px-2 py-1 text-xs bg-card outline-none focus:border-accent"
          >
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="flex items-end gap-1.5 h-32">
          {dadosMensais.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="w-full flex flex-col justify-end h-24 gap-0.5 relative">
                {d.total > 0 ? (
                  <>
                    {/* Barra total com cor do mês */}
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-t transition-all"
                      style={{
                        height: `${(d.total / maxMensal) * 100}%`,
                        backgroundColor: CORES_MESES[i] + "44",
                        border: `2px solid ${CORES_MESES[i]}`,
                      }}
                    />
                    {/* Barra recebido mais opaca */}
                    {d.recebido > 0 && (
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-t transition-all"
                        style={{
                          height: `${(d.recebido / maxMensal) * 100}%`,
                          backgroundColor: CORES_MESES[i] + "bb",
                        }}
                      />
                    )}
                    {/* Tooltip */}
                    <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-popover border border-border rounded px-2 py-1.5 text-[0.6rem] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none shadow space-y-0.5">
                      <div className="font-bold">{fmtMoeda(d.total)}</div>
                      {d.recebido > 0 && <div style={{ color: CORES_MESES[i] }}>Rec: {fmtMoeda(d.recebido)}</div>}
                      {d.pendente > 0 && <div className="text-yellow-600">Pend: {fmtMoeda(d.pendente)}</div>}
                    </div>
                  </>
                ) : (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-border rounded" />
                )}
              </div>
              <span className="text-[0.6rem] text-muted-foreground font-medium">{d.mes}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3 text-[0.65rem] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block opacity-80" style={{ backgroundColor: "#4f86c6bb" }} /> Recebido</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block border-2" style={{ borderColor: "#4f86c6", backgroundColor: "#4f86c644" }} /> Total lançado</span>
          <span className="text-[0.6rem] italic">Passe o mouse para ver detalhes</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase">Filtros</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={filtroCliente}
            onChange={e => setFiltroCliente(e.target.value)}
            className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
          />
          <select
            value={filtroMes}
            onChange={e => setFiltroMes(e.target.value === "todos" ? "todos" : parseInt(e.target.value))}
            className="border border-border rounded-lg px-3 py-1.5 text-sm bg-card outline-none focus:border-accent"
          >
            <option value="todos">Todos os meses</option>
            {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value)}
            className="border border-border rounded-lg px-3 py-1.5 text-sm bg-card outline-none focus:border-accent"
          >
            <option value="todos">Todos os status</option>
            <option value="pendente">Pendente</option>
            <option value="recebido">Recebido</option>
            <option value="atrasado">Atrasado</option>
          </select>
          {(filtroCliente || filtroStatus !== "todos" || filtroMes !== "todos") && (
            <Button variant="outline" size="sm" onClick={() => { setFiltroCliente(""); setFiltroStatus("todos"); setFiltroMes("todos"); }}>
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-3" />
            Carregando lançamentos...
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum lançamento encontrado</p>
            <p className="text-sm mt-1">Clique em "Novo Lançamento" para começar</p>
          </div>
        ) : (
          <table className="w-full text-sm" style={{ minWidth: "700px" }}>
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground">Cliente</th>
                <th className="px-4 py-3 text-left text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Processo</th>
                <th className="px-4 py-3 text-left text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Tipo</th>
                <th className="px-4 py-3 text-left text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground">Valor</th>
                <th className="px-4 py-3 text-left text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Vencimento</th>
                <th className="px-4 py-3 text-left text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtrados.map(l => (
                <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 max-w-[160px]">
                    <div className="font-semibold text-sm truncate" title={l.cliente_nome}>{l.cliente_nome}</div>
                    {l.descricao && <div className="text-xs text-muted-foreground truncate">{l.descricao}</div>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs font-mono text-muted-foreground">{l.processo || "—"}</span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full">{l.tipo}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold text-sm">{fmtMoeda(l.valor)}</span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs text-muted-foreground">{fmtData(l.data_vencimento)}</span>
                    {l.data_recebimento && (
                      <div className="text-[0.65rem] text-green-600">Rec: {fmtData(l.data_recebimento)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${statusColor(l.status)}`}>
                      {statusLabel(l.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(l)} title="Editar">
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:border-red-300" onClick={() => setDeleteConfirm(l.id)} title="Excluir">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/30 border-t-2 border-border">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-xs font-bold text-muted-foreground">{filtrados.length} lançamento(s)</td>
                <td className="px-4 py-3 font-mono font-bold text-sm">{fmtMoeda(totalGeral)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Modal Formulário */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg my-auto shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-lg font-bold">
                  {editing ? "Editar Lançamento" : "Novo Lançamento"}
                </h2>
                <div className="flex gap-2">
                  <Button variant="gold" onClick={handleSave} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                  <Button variant="outline" onClick={resetForm}>Cancelar</Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Cliente *</label>
                    <input
                      type="text"
                      value={form.cliente_nome}
                      onChange={e => setForm(f => ({ ...f, cliente_nome: e.target.value }))}
                      placeholder="Nome do cliente"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Processo</label>
                    <input
                      type="text"
                      value={form.processo}
                      onChange={e => setForm(f => ({ ...f, processo: e.target.value }))}
                      placeholder="Número do processo"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Tipo *</label>
                    <select
                      value={form.tipo}
                      onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-accent outline-none"
                    >
                      {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Descrição</label>
                    <input
                      type="text"
                      value={form.descricao}
                      onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                      placeholder="Ex: 1ª parcela de honorários"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Valor (R$) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.valor}
                      onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                      placeholder="0,00"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Vencimento *</label>
                    <input
                      type="date"
                      value={form.data_vencimento}
                      onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Status</label>
                    <select
                      value={form.status}
                      onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-accent outline-none"
                    >
                      <option value="pendente">Pendente</option>
                      <option value="recebido">Recebido</option>
                    </select>
                  </div>
                  {form.status === "recebido" && (
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">Data do Recebimento</label>
                      <input
                        type="date"
                        value={form.data_recebimento}
                        onChange={e => setForm(f => ({ ...f, data_recebimento: e.target.value }))}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
                      />
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Observações</label>
                    <textarea
                      value={form.observacoes}
                      onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                      placeholder="Notas adicionais..."
                      rows={2}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmação de Exclusão */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <h3 className="font-display font-semibold">Excluir lançamento?</h3>
            <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => deleteMutation.mutate(deleteConfirm)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
              </Button>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
