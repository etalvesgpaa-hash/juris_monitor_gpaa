import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useClientes } from "@/hooks/useClientes";
import { useProcessos } from "@/hooks/useProcessos";
import {
  useFinanceiro,
  useCreateLancamento,
  useUpdateLancamento,
  useDeleteLancamento,
  useDeleteGrupoParcelamento,
  type Lancamento,
} from "@/hooks/useFinanceiro";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Plus, X, Edit2, Trash2, TrendingUp, TrendingDown,
  Clock, CheckCircle2, AlertCircle, DollarSign, Filter,
  ArrowUpCircle, ArrowDownCircle, Scale, Download, Layers,
} from "lucide-react";

// ── Constantes ──────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ["pendente", "recebido", "atrasado"];
const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const CORES_MESES = [
  "#4f86c6","#6a9fd8","#5ba85a","#7bc67a",
  "#c9a84c","#e8b84b","#e07b39","#d4573a",
  "#9b59b6","#7d3c98","#2e86ab","#1a5276",
];

const CATEGORIAS_RECEITA = [
  "Honorários Contratuais", "Honorários de Êxito", "Honorários Sucumbenciais",
  "Consultoria", "Custas Reembolsadas", "Outros",
];
const CATEGORIAS_DESPESA = [
  "Custas Processuais", "Repasse a Correspondente", "Aluguel / Condomínio",
  "Salários / Pró-labore", "Softwares / Assinaturas", "Marketing",
  "Impostos", "Outros",
];
const FORMAS_PAGAMENTO = ["PIX", "Boleto", "Transferência", "Cartão", "Dinheiro", "Cheque"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtData(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Rótulos de status dependem do tipo (receita usa "Recebido/A Receber",
 *  despesa usa "Pago/A Pagar"), mas o valor salvo no banco é o mesmo. */
function statusLabel(s: string, tipoLancamento: string) {
  const pago = tipoLancamento === "despesa";
  if (s === "recebido") return pago ? "Pago" : "Recebido";
  if (s === "atrasado") return pago ? "Em atraso" : "Atrasado";
  return pago ? "A Pagar" : "Pendente";
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

function downloadCSV(rows: (Lancamento & { status: string })[]) {
  const header = [
    "Tipo", "Categoria", "Cliente", "Processo", "Descrição", "Valor",
    "Vencimento", "Recebimento/Pagamento", "Status", "Forma de Pagamento",
  ];
  const linhas = rows.map(l => [
    l.tipo_lancamento === "despesa" ? "Despesa" : "Receita",
    l.categoria || l.tipo || "",
    l.cliente_nome || "",
    l.processo || "",
    l.descricao || "",
    String(l.valor).replace(".", ","),
    fmtData(l.data_vencimento),
    fmtData(l.data_recebimento),
    statusLabel(l.status, l.tipo_lancamento),
    l.forma_pagamento || "",
  ]);
  const csv = [header, ...linhas]
    .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `financeiro_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const EMPTY_FORM = {
  tipo_lancamento: "receita" as "receita" | "despesa",
  cliente_id: "",
  cliente_nome: "",
  processo_id: "",
  processo: "",
  categoria: CATEGORIAS_RECEITA[0],
  descricao: "",
  valor: "",
  forma_pagamento: "",
  data_vencimento: "",
  data_recebimento: "",
  status: "pendente",
  observacoes: "",
  parcelas: "1",
};

// ── Componente principal ──────────────────────────────────────────────────────

export function FinanceiroPage() {
  const { user } = useAuth();
  const { data: clientes = [] } = useClientes();
  const { data: processos = [] } = useProcessos();

  const { data: lancamentos = [], isLoading } = useFinanceiro();
  const createMutation = useCreateLancamento();
  const updateMutation = useUpdateLancamento();
  const deleteMutation = useDeleteLancamento();
  const deleteGrupoMutation = useDeleteGrupoParcelamento();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Lancamento | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [filtroMes, setFiltroMes] = useState<number | "todos">("todos");
  const [filtroAno, setFiltroAno] = useState<number>(new Date().getFullYear());
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "receita" | "despesa">("todos");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<Lancamento | null>(null);

  // ── Enriquecer com status calculado ────────────────────────────────────────

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
      if (filtroTipo !== "todos" && l.tipo_lancamento !== filtroTipo) return false;
      if (filtroCliente && !l.cliente_nome.toLowerCase().includes(filtroCliente.toLowerCase())) return false;
      return true;
    });
  }, [lancamentosComStatus, filtroMes, filtroAno, filtroStatus, filtroTipo, filtroCliente]);

  // ── Indicadores ─────────────────────────────────────────────────────────────

  const receitas = filtrados.filter(l => l.tipo_lancamento !== "despesa");
  const despesas = filtrados.filter(l => l.tipo_lancamento === "despesa");

  const totalRecebido = receitas.filter(l => l.status === "recebido").reduce((s, l) => s + l.valor, 0);
  const totalAReceber = receitas.filter(l => l.status !== "recebido").reduce((s, l) => s + l.valor, 0);
  const totalPago = despesas.filter(l => l.status === "recebido").reduce((s, l) => s + l.valor, 0);
  const totalAPagar = despesas.filter(l => l.status !== "recebido").reduce((s, l) => s + l.valor, 0);
  const totalAtrasado = filtrados.filter(l => l.status === "atrasado").reduce((s, l) => s + l.valor, 0);
  const saldo = totalRecebido - totalPago;

  // ── Gráfico mensal (receita x despesa) ────────────────────────────────────

  const dadosMensais = useMemo(() => {
    return MESES.map((mes, i) => {
      const doMes = lancamentosComStatus.filter(l => {
        const [y, m] = l.data_vencimento.slice(0, 7).split("-");
        return parseInt(m) - 1 === i && parseInt(y) === filtroAno;
      });
      const receitaMes = doMes.filter(l => l.tipo_lancamento !== "despesa").reduce((s, l) => s + l.valor, 0);
      const despesaMes = doMes.filter(l => l.tipo_lancamento === "despesa").reduce((s, l) => s + l.valor, 0);
      return { mes, receita: receitaMes, despesa: despesaMes };
    });
  }, [lancamentosComStatus, filtroAno]);

  const maxMensal = Math.max(...dadosMensais.map(d => Math.max(d.receita, d.despesa)), 1);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setEditing(null);
    setShowForm(false);
  }

  function openNew(tipo: "receita" | "despesa" = "receita") {
    setForm({
      ...EMPTY_FORM,
      tipo_lancamento: tipo,
      categoria: tipo === "despesa" ? CATEGORIAS_DESPESA[0] : CATEGORIAS_RECEITA[0],
    });
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(l: Lancamento) {
    setForm({
      tipo_lancamento: (l.tipo_lancamento as "receita" | "despesa") || "receita",
      cliente_id: l.cliente_id || "",
      cliente_nome: l.cliente_nome || "",
      processo_id: l.processo_id || "",
      processo: l.processo || "",
      categoria: l.categoria || l.tipo || CATEGORIAS_RECEITA[0],
      descricao: l.descricao || "",
      valor: String(l.valor),
      forma_pagamento: l.forma_pagamento || "",
      data_vencimento: l.data_vencimento.slice(0, 10),
      data_recebimento: l.data_recebimento?.slice(0, 10) || "",
      status: l.status,
      observacoes: l.observacoes || "",
      parcelas: "1",
    });
    setEditing(l);
    setShowForm(true);
  }

  function handleSave() {
    const clienteSelecionado = clientes.find(c => c.id === form.cliente_id);
    const clienteNomeFinal = form.cliente_id ? (clienteSelecionado?.nome || "") : form.cliente_nome.trim();
    const processoSelecionado = processos.find(p => p.id === form.processo_id);
    const processoFinal = form.processo_id ? (processoSelecionado?.numero_cnj || "") : form.processo.trim();

    if (!clienteNomeFinal) return toast.error(form.tipo_lancamento === "despesa" ? "Informe o favorecido/fornecedor." : "Informe o cliente.");
    if (!form.valor || isNaN(parseFloat(form.valor.replace(",", ".")))) return toast.error("Informe um valor válido.");
    if (!form.data_vencimento) return toast.error("Informe a data de vencimento.");

    const payload = {
      tipo_lancamento: form.tipo_lancamento,
      cliente_id: form.cliente_id || null,
      cliente_nome: clienteNomeFinal,
      processo_id: form.processo_id || null,
      processo: processoFinal || null,
      categoria: form.categoria,
      tipo: form.categoria, // mantém compatibilidade com o campo legado `tipo`
      descricao: form.descricao || null,
      valor: parseFloat(form.valor.replace(",", ".")),
      forma_pagamento: form.forma_pagamento || null,
      data_vencimento: form.data_vencimento,
      data_recebimento: form.data_recebimento || null,
      status: form.status,
      observacoes: form.observacoes || null,
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, ...payload }, {
        onSuccess: () => { toast.success("Lançamento atualizado!"); resetForm(); },
        onError: (e: any) => toast.error(e.message),
      });
    } else {
      const parcelaTotal = Math.max(1, parseInt(form.parcelas) || 1);
      createMutation.mutate({ lancamento: payload, parcelaTotal }, {
        onSuccess: () => {
          toast.success(parcelaTotal > 1 ? `${parcelaTotal} parcelas criadas!` : "Lançamento criado!");
          resetForm();
        },
        onError: (e: any) => toast.error(e.message),
      });
    }
  }

  function handleDelete(l: Lancamento) {
    if (l.grupo_parcelamento) {
      deleteGrupoMutation.mutate(l.grupo_parcelamento, {
        onSuccess: () => { toast.success("Todas as parcelas do grupo foram excluídas."); setDeleteConfirm(null); },
        onError: (e: any) => toast.error(e.message),
      });
    } else {
      deleteMutation.mutate(l.id, {
        onSuccess: () => { toast.success("Lançamento excluído."); setDeleteConfirm(null); },
        onError: (e: any) => toast.error(e.message),
      });
    }
  }

  const processosDoCliente = form.cliente_id
    ? processos.filter(p => p.cliente_id === form.cliente_id)
    : processos;

  const categoriasDisponiveis = form.tipo_lancamento === "despesa" ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA;

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
              <p className="text-xs text-muted-foreground">Contas a pagar e a receber do escritório</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => downloadCSV(filtrados)} className="gap-2" disabled={filtrados.length === 0}>
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">Exportar</span>
          </Button>
          <Button variant="outline" onClick={() => openNew("despesa")} className="gap-2 text-red-600 border-red-200 hover:bg-red-50">
            <ArrowDownCircle className="w-4 h-4" /> <span className="hidden sm:inline">Despesa</span>
          </Button>
          <Button variant="gold" onClick={() => openNew("receita")} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Lançamento
          </Button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
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
            <span className="text-xs font-semibold text-muted-foreground uppercase">A Receber</span>
          </div>
          <p className="text-lg font-bold font-mono text-yellow-600">{fmtMoeda(totalAReceber)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownCircle className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold text-muted-foreground uppercase">Pago</span>
          </div>
          <p className="text-lg font-bold font-mono text-blue-600">{fmtMoeda(totalPago)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-orange-600" />
            <span className="text-xs font-semibold text-muted-foreground uppercase">A Pagar</span>
          </div>
          <p className="text-lg font-bold font-mono text-orange-600">{fmtMoeda(totalAPagar)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Scale className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold text-muted-foreground uppercase">Saldo</span>
          </div>
          <p className={`text-lg font-bold font-mono ${saldo >= 0 ? "text-accent" : "text-red-600"}`}>{fmtMoeda(saldo)}</p>
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
          <h2 className="font-display font-semibold text-sm">Receitas x Despesas — {filtroAno}</h2>
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
              <div className="w-full flex items-end justify-center gap-0.5 h-24 relative">
                <div className="w-1/2 h-full flex items-end">
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${(d.receita / maxMensal) * 100}%`,
                      backgroundColor: "#1a6b3abb",
                      minHeight: d.receita > 0 ? "2px" : "0",
                    }}
                  />
                </div>
                <div className="w-1/2 h-full flex items-end">
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${(d.despesa / maxMensal) * 100}%`,
                      backgroundColor: "#c0392bbb",
                      minHeight: d.despesa > 0 ? "2px" : "0",
                    }}
                  />
                </div>
                {(d.receita > 0 || d.despesa > 0) && (
                  <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-popover border border-border rounded px-2 py-1.5 text-[0.6rem] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none shadow space-y-0.5">
                    <div style={{ color: "#1a6b3a" }}>Receitas: {fmtMoeda(d.receita)}</div>
                    <div style={{ color: "#c0392b" }}>Despesas: {fmtMoeda(d.despesa)}</div>
                    <div className="font-bold border-t border-border pt-0.5 mt-0.5">Saldo: {fmtMoeda(d.receita - d.despesa)}</div>
                  </div>
                )}
              </div>
              <span className="text-[0.6rem] text-muted-foreground font-medium">{d.mes}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3 text-[0.65rem] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: "#1a6b3abb" }} /> Receitas</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: "#c0392bbb" }} /> Despesas</span>
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
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value as any)}
            className="border border-border rounded-lg px-3 py-1.5 text-sm bg-card outline-none focus:border-accent"
          >
            <option value="todos">Receitas e Despesas</option>
            <option value="receita">Só Receitas</option>
            <option value="despesa">Só Despesas</option>
          </select>
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
            <option value="pendente">Pendente / A Pagar</option>
            <option value="recebido">Recebido / Pago</option>
            <option value="atrasado">Atrasado</option>
          </select>
          {(filtroCliente || filtroStatus !== "todos" || filtroMes !== "todos" || filtroTipo !== "todos") && (
            <Button variant="outline" size="sm" onClick={() => { setFiltroCliente(""); setFiltroStatus("todos"); setFiltroMes("todos"); setFiltroTipo("todos"); }}>
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
          <table className="w-full text-sm" style={{ minWidth: "820px" }}>
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground">Cliente / Favorecido</th>
                <th className="px-4 py-3 text-left text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Processo</th>
                <th className="px-4 py-3 text-left text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Categoria</th>
                <th className="px-4 py-3 text-left text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground">Valor</th>
                <th className="px-4 py-3 text-left text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Vencimento</th>
                <th className="px-4 py-3 text-left text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtrados.map(l => (
                <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 max-w-[180px]">
                    <div className="flex items-center gap-1.5">
                      {l.tipo_lancamento === "despesa"
                        ? <ArrowDownCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        : <ArrowUpCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />}
                      <div className="font-semibold text-sm truncate" title={l.cliente_nome}>{l.cliente_nome}</div>
                    </div>
                    {l.descricao && <div className="text-xs text-muted-foreground truncate">{l.descricao}</div>}
                    {l.parcela_total && l.parcela_total > 1 && (
                      <span className="inline-flex items-center gap-1 text-[0.6rem] mt-0.5 bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                        <Layers className="h-2.5 w-2.5" /> {l.parcela_numero}/{l.parcela_total}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs font-mono text-muted-foreground">{l.processo || "—"}</span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${l.tipo_lancamento === "despesa" ? "bg-red-50 text-red-700" : "bg-accent/10 text-accent"}`}>
                      {l.categoria || l.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-mono font-semibold text-sm ${l.tipo_lancamento === "despesa" ? "text-red-600" : ""}`}>
                      {l.tipo_lancamento === "despesa" ? "− " : ""}{fmtMoeda(l.valor)}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs text-muted-foreground">{fmtData(l.data_vencimento)}</span>
                    {l.data_recebimento && (
                      <div className="text-[0.65rem] text-green-600">{l.tipo_lancamento === "despesa" ? "Pago" : "Rec"}: {fmtData(l.data_recebimento)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${statusColor(l.status)}`}>
                      {statusLabel(l.status, l.tipo_lancamento)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(l)} title="Editar">
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:border-red-300" onClick={() => setDeleteConfirm(l)} title="Excluir">
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
                <td className="px-4 py-3 font-mono font-bold text-sm">{fmtMoeda(saldo)} <span className="text-[0.6rem] font-normal text-muted-foreground">(saldo)</span></td>
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
                <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Toggle Receita / Despesa */}
              {!editing && (
                <div className="flex mb-5 rounded-lg overflow-hidden border border-border">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, tipo_lancamento: "receita", categoria: CATEGORIAS_RECEITA[0] }))}
                    className={`flex-1 py-2 text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors ${form.tipo_lancamento === "receita" ? "bg-green-600 text-white" : "bg-muted/40 text-muted-foreground hover:bg-muted"}`}
                  >
                    <ArrowUpCircle className="h-4 w-4" /> Receita (a receber)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, tipo_lancamento: "despesa", categoria: CATEGORIAS_DESPESA[0] }))}
                    className={`flex-1 py-2 text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors ${form.tipo_lancamento === "despesa" ? "bg-red-600 text-white" : "bg-muted/40 text-muted-foreground hover:bg-muted"}`}
                  >
                    <ArrowDownCircle className="h-4 w-4" /> Despesa (a pagar)
                  </button>
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Cliente */}
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">
                      {form.tipo_lancamento === "despesa" ? "Favorecido / Fornecedor" : "Cliente"} *
                    </label>
                    <select
                      value={form.cliente_id}
                      onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value, processo_id: "" }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-accent outline-none mb-2"
                    >
                      <option value="">— Nome avulso (sem cadastro) —</option>
                      {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                    {!form.cliente_id && (
                      <input
                        type="text"
                        value={form.cliente_nome}
                        onChange={e => setForm(f => ({ ...f, cliente_nome: e.target.value }))}
                        placeholder={form.tipo_lancamento === "despesa" ? "Ex: Cartório, correspondente, fornecedor..." : "Nome do cliente"}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
                      />
                    )}
                  </div>

                  {/* Processo */}
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Processo vinculado</label>
                    <select
                      value={form.processo_id}
                      onChange={e => setForm(f => ({ ...f, processo_id: e.target.value }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-accent outline-none mb-2"
                    >
                      <option value="">— Nenhum / digitar manualmente —</option>
                      {processosDoCliente.map(p => (
                        <option key={p.id} value={p.id}>{p.numero_cnj}{p.assunto ? ` — ${p.assunto}` : ""}</option>
                      ))}
                    </select>
                    {!form.processo_id && (
                      <input
                        type="text"
                        value={form.processo}
                        onChange={e => setForm(f => ({ ...f, processo: e.target.value }))}
                        placeholder="Número do processo (opcional)"
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none font-mono"
                      />
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Categoria *</label>
                    <select
                      value={form.categoria}
                      onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-accent outline-none"
                    >
                      {categoriasDisponiveis.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Forma de Pagamento</label>
                    <select
                      value={form.forma_pagamento}
                      onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-accent outline-none"
                    >
                      <option value="">— Não informado —</option>
                      {FORMAS_PAGAMENTO.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Descrição</label>
                    <input
                      type="text"
                      value={form.descricao}
                      onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                      placeholder="Ex: 1ª parcela de honorários contratuais"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Valor total (R$) *</label>
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

                  {!editing && (
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">Parcelar em</label>
                      <select
                        value={form.parcelas}
                        onChange={e => setForm(f => ({ ...f, parcelas: e.target.value }))}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-accent outline-none"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n}>{n === 1 ? "À vista (1x)" : `${n}x mensais`}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">
                      {editing ? "Vencimento *" : (parseInt(form.parcelas) > 1 ? "Vencimento da 1ª parcela *" : "Vencimento *")}
                    </label>
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
                      <option value="pendente">{form.tipo_lancamento === "despesa" ? "A Pagar" : "Pendente"}</option>
                      <option value="recebido">{form.tipo_lancamento === "despesa" ? "Pago" : "Recebido"}</option>
                    </select>
                  </div>
                  {form.status === "recebido" && (
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">
                        Data do {form.tipo_lancamento === "despesa" ? "Pagamento" : "Recebimento"}
                      </label>
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

              <div className="flex gap-2 mt-6">
                <Button variant="gold" className="flex-1" onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) ? "Salvando..." : "Salvar"}
                </Button>
                <Button variant="outline" onClick={resetForm}>Cancelar</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmação de Exclusão */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <h3 className="font-display font-semibold">
              {deleteConfirm.grupo_parcelamento ? "Excluir todas as parcelas?" : "Excluir lançamento?"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {deleteConfirm.grupo_parcelamento
                ? `Este lançamento faz parte de um parcelamento (${deleteConfirm.parcela_numero}/${deleteConfirm.parcela_total}). Todas as ${deleteConfirm.parcela_total} parcelas serão excluídas. Esta ação não pode ser desfeita.`
                : "Esta ação não pode ser desfeita."}
            </p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleteMutation.isPending || deleteGrupoMutation.isPending}
              >
                {(deleteMutation.isPending || deleteGrupoMutation.isPending) ? "Excluindo..." : "Excluir"}
              </Button>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
