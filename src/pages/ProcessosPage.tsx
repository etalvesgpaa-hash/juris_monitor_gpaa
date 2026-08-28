import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useProcessos, useCreateProcesso, useDeleteProcesso, useUpdateProcesso, useMovimentacoes, useCreateMovimentacao, useDeleteMovimentacao } from "@/hooks/useProcessos";
import { useClientes } from "@/hooks/useClientes";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useFeriados } from "@/hooks/useFeriados";
import { useCreateTarefa } from "@/hooks/useTarefas";
import { useCrearTarefaDelegada, useAppUsersParaDelegacao } from "@/hooks/useDelegacao";
import { CreateTaskModal } from "@/components/CreateTaskModal";
import { X, Plus, ClipboardList } from "lucide-react";
import type { Processo } from "@/hooks/useProcessos";
import { detectarTribunalCNJ, maskCNJ } from "@/lib/cnj";
import { FASE_PROCESSO_OPTIONS } from "@/lib/statusProcesso";

// ── Status badges ──────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  "Ativo":     "bg-green-ok/10 text-green-ok border border-green-ok/20",
  "Pausado":   "bg-amber-500/10 text-amber-700 border border-amber-300/40",
  "Inativo":   "bg-red-alert/10 text-red-alert border border-red-alert/20",
  "Finalizado":"bg-muted text-muted-foreground border border-border",
};

const STATUS_OPTS = ["Ativo","Pausado","Inativo","Finalizado"];
const AREAS = ["Cível","Criminal","Trabalhista","Previdenciário","Tributário","Administrativo","Família","Eleitoral"];

// ── Tipo interno rico (estendendo Processo do Supabase) ───────────────────────
interface ProcessoRico extends Processo {
  _movimentacoes?: any[];
  _pendente?: boolean;
  tribunalNome?: string;
  autor?: string;
  reu?: string;
  orgaoJulgador?: string;
  dataAjuizamento?: string;
  ultimaMov?: string;
}

// ── Componente Principal ──────────────────────────────────────────────────────
interface ProcessosPageProps {
  /** Fase pré-selecionada ao navegar a partir do card "Processos por Fase" do Dashboard. */
  filtroFaseInicial?: string | null;
  /** Chamado assim que o filtro inicial é aplicado, pra o AppLayout limpar o estado. */
  onFiltroFaseConsumido?: () => void;
}

export function ProcessosPage({ filtroFaseInicial, onFiltroFaseConsumido }: ProcessosPageProps = {}) {
  const { data: rawProcessos = [], isLoading, refetch } = useProcessos();
  const { user, isAdmin } = useAuth();
  const { data: clientes = [] } = useClientes();
  const { data: feriados = [] } = useFeriados();
  const createProcesso = useCreateProcesso();
  const deleteProcesso = useDeleteProcesso();
  const updateProcesso = useUpdateProcesso();
  const createTarefa = useCreateTarefa();
  const criarTarefaDelegada = useCrearTarefaDelegada();
  const { data: profilesParaDelegacao = [] } = useAppUsersParaDelegacao();
  const { toast } = useToast();

  // ── Criar Tarefa a partir de um processo ──────────────────────────────────
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskModalInitialData, setTaskModalInitialData] = useState<any>(null);
  const [processoParaTarefa, setProcessoParaTarefa] = useState<ProcessoRico | null>(null);

  const criarTarefaDeProcesso = (processo: ProcessoRico) => {
    setProcessoParaTarefa(processo);
    setTaskModalInitialData({
      titulo: `Processo ${processo.numero_cnj}`,
      numero_processo: processo.numero_cnj,
      prioridade: "media",
    });
    setShowTaskModal(true);
  };

  const handleSubmitTarefaDeProcesso = async (data: any) => {
    try {
      const payloadBase = {
        titulo: data.titulo,
        descricao: data.descricao || null,
        data_vencimento: data.data_vencimento || null,
        prioridade: data.prioridade,
        status: data.status || "triagem",
        processo_id: processoParaTarefa?.id || null,
        numero_processo: data.numero_processo || processoParaTarefa?.numero_cnj || null,
      };

      if (data.delegado_para) {
        await criarTarefaDelegada.mutateAsync({ ...payloadBase, delegado_para: data.delegado_para } as any);
      } else {
        await createTarefa.mutateAsync(payloadBase as any);
        toast({ title: "✅ Tarefa criada com sucesso!" });
      }
      setShowTaskModal(false);
      setTaskModalInitialData(null);
      setProcessoParaTarefa(null);
    } catch (err: any) {
      toast({ title: "Erro ao criar tarefa", description: err.message, variant: "destructive" });
    }
  };

  // Estado local enriquecido (adiciona _movimentacoes etc.)
  // hidratarDoSupabase é definida logo abaixo — usamos inline aqui para o estado inicial
  const [processos, setProcessos] = useState<ProcessoRico[]>(() =>
    (rawProcessos as ProcessoRico[]).map(rp => {
      const djd = rp.dados_datajud as any;
      if (!djd) return rp;
      return {
        ...rp,
        tribunalNome:    djd.tribunalNome    || rp.tribunal || undefined,
        autor:           (djd.autor && djd.autor !== "—") ? djd.autor : undefined,
        reu:             (djd.reu   && djd.reu   !== "—") ? djd.reu   : undefined,
        orgaoJulgador:   djd.orgaoJulgador   || rp.vara     || undefined,
        dataAjuizamento: djd.dataAjuizamento || undefined,
        ultimaMov:       djd.ultimaMov       || undefined,
        _movimentacoes:  djd._movimentacoes  || [],
      };
    })
  );
  const [search, setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterFase, setFilterFase] = useState("");

  // Chegou um filtro de fase vindo do Dashboard (card "Processos por Fase")?
  useEffect(() => {
    if (filtroFaseInicial) {
      setFilterFase(filtroFaseInicial);
      onFiltroFaseConsumido?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroFaseInicial]);
  const [panelProcesso, setPanelProcesso] = useState<ProcessoRico | null>(null);
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [tribunalDetect, setTribunalDetect] = useState("");

  // Hidrata campos ricos a partir de dados_datajud salvo no Supabase
  function hidratarDoSupabase(rp: ProcessoRico): ProcessoRico {
    const djd = rp.dados_datajud as any;
    if (!djd) return rp;
    return {
      ...rp,
      tribunalNome:    rp.tribunalNome    || djd.tribunalNome    || rp.tribunal || undefined,
      autor:           (rp.autor && rp.autor !== "—") ? rp.autor : ((djd.autor && djd.autor !== "—") ? djd.autor : undefined),
      reu:             (rp.reu   && rp.reu   !== "—") ? rp.reu   : ((djd.reu   && djd.reu   !== "—") ? djd.reu   : undefined),
      orgaoJulgador:   rp.orgaoJulgador   || djd.orgaoJulgador   || rp.vara     || undefined,
      dataAjuizamento: rp.dataAjuizamento || djd.dataAjuizamento || undefined,
      ultimaMov:       rp.ultimaMov       || djd.ultimaMov       || undefined,
      // Só hidrata _movimentacoes do banco se ainda não tiver local (sync pós-página)
      _movimentacoes:  rp._movimentacoes?.length
        ? rp._movimentacoes
        : (djd._movimentacoes || []),
    };
  }

  // Mantém processos locais sincronizados com Supabase
  const prevRaw = useRef<string>("");
  const rawStr = JSON.stringify(rawProcessos.map(p => p.id));
  if (rawStr !== prevRaw.current) {
    prevRaw.current = rawStr;
    setProcessos(prev => {
      return (rawProcessos as ProcessoRico[]).map(rp => {
        const existing = prev.find(p => p.id === rp.id);
        if (existing) {
          // Campos enriquecidos localmente (pós-sync na sessão) têm prioridade
          // mas dados do Supabase preenchem o que ainda não existe localmente
          const hidratado = hidratarDoSupabase(rp);
          return {
            ...hidratado,
            // Preserva campos enriquecidos pela sync local desta sessão
            tribunalNome:    existing.tribunalNome    || hidratado.tribunalNome,
            autor:           existing.autor           || hidratado.autor,
            reu:             existing.reu             || hidratado.reu,
            orgaoJulgador:   existing.orgaoJulgador   || hidratado.orgaoJulgador,
            dataAjuizamento: existing.dataAjuizamento || hidratado.dataAjuizamento,
            ultimaMov:       existing.ultimaMov       || hidratado.ultimaMov,
            _movimentacoes:  existing._movimentacoes?.length
              ? existing._movimentacoes
              : hidratado._movimentacoes,
            resumo_ia:       rp.resumo_ia || existing.resumo_ia,
          };
        }
        return hidratarDoSupabase(rp);
      });
    });
  }

  const FORM_VAZIO = {
    numero_cnj: "", advogado: "", oab: "", clienteNome: "", whatsapp: "",
    area: "Cível", status: "Ativo", obs: "", cliente_id: "",
    autorManual: "", reuManual: "",
    classe: "", assunto: "", vara: "", comarca: "", valorCausa: "",
    fase: "",
  };
  const [form, setForm] = useState(FORM_VAZIO);

  const resetForm = () => {
    setForm(FORM_VAZIO);
    setEditId(null);
    setTribunalDetect("");
    setShowForm(false);
  };

  const handleCNJInput = (v: string) => {
    const masked = maskCNJ(v);
    setForm(f => ({ ...f, numero_cnj: masked }));
    const trib = detectarTribunalCNJ(masked);
    setTribunalDetect(trib ? `✓ ${trib.nome}` : masked.replace(/\D/g,"").length >= 15 ? "Tribunal não reconhecido" : "");
  };

  const handleSalvar = async () => {
    if (!form.numero_cnj.trim()) { toast({ title: "Informe o número CNJ", variant: "destructive" }); return; }
    const tribunal = detectarTribunalCNJ(form.numero_cnj);
    if (!tribunal) { toast({ title: "Número CNJ inválido ou tribunal não mapeado", variant: "destructive" }); return; }

    // Monta string "Autor × Réu" a partir dos campos manuais (só entra o que foi preenchido)
    const autorManual = form.autorManual.trim();
    const reuManual    = form.reuManual.trim();
    const partesManuais = (autorManual || reuManual)
      ? `${autorManual || "—"} × ${reuManual || "—"}`
      : null;

    try {
      if (editId) {
        await updateProcesso.mutateAsync({
          id: editId,
          advogados: form.advogado || null,
          status: form.status.toLowerCase(),
          partes: partesManuais,
          classe: form.classe.trim() || null,
          assunto: form.assunto.trim() || null,
          vara: form.vara.trim() || null,
          comarca: form.comarca.trim() || null,
          fase: form.fase || null,
          valor_causa: form.valorCausa ? parseFloat(form.valorCausa.replace(/\./g, "").replace(",", ".")) : null,
        });
        // Reflete imediatamente na lista/painel local, sem esperar refetch
        setProcessos(prev => prev.map(p => p.id === editId
          ? {
              ...p, partes: partesManuais, autor: autorManual || p.autor, reu: reuManual || p.reu,
              classe: form.classe.trim() || p.classe, assunto: form.assunto.trim() || p.assunto,
              vara: form.vara.trim() || p.vara, comarca: form.comarca.trim() || p.comarca,
              fase: form.fase || p.fase,
            }
          : p));
        toast({ title: "✅ Processo atualizado!" });
      } else {
        await createProcesso.mutateAsync({
          numero_cnj: form.numero_cnj,
          tribunal: tribunal.nome,
          status: form.status.toLowerCase(),
          advogados: form.advogado || null,
          classe: form.classe.trim() || null,
          assunto: form.assunto.trim() || null,
          vara: form.vara.trim() || null,
          comarca: form.comarca.trim() || null,
          fase: form.fase || null,
          partes: partesManuais,
          valor_causa: form.valorCausa ? parseFloat(form.valorCausa.replace(/\./g, "").replace(",", ".")) : null,
          cliente_id: form.cliente_id || null,
        });
        toast({ title: "✅ Processo cadastrado!", description: tribunal.nome });
      }
      resetForm();
      refetch();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este processo?")) return;
    await deleteProcesso.mutateAsync(id);
    if (panelProcesso?.id === id) setPanelProcesso(null);
    toast({ title: "Processo removido" });
  };

  const abrirEdicao = (p: ProcessoRico) => {
    // Tenta obter autor/réu já conhecidos (DataJud) ou o texto salvo em "partes" (ex: "Fulano × Beltrano")
    const djd = p.dados_datajud as any;
    const partesStr = p.partes || "";
    const sepIdx = partesStr.indexOf("×");
    const autorFallback = sepIdx > -1 ? partesStr.slice(0, sepIdx).trim() : partesStr.trim();
    const reuFallback   = sepIdx > -1 ? partesStr.slice(sepIdx + 1).trim() : "";
    const autorAtual = (p.autor || djd?.autor || autorFallback || "").replace(/^—$/, "");
    const reuAtual    = (p.reu   || djd?.reu   || reuFallback   || "").replace(/^—$/, "");

    setForm({
      numero_cnj: p.numero_cnj, advogado: p.advogados || "", oab: "", clienteNome: "", whatsapp: "",
      area: "Cível", status: p.status || "Ativo", obs: "", cliente_id: p.cliente_id || "",
      autorManual: autorAtual, reuManual: reuAtual,
      classe: p.classe || "", assunto: p.assunto || "", vara: p.vara || "", comarca: p.comarca || "",
      valorCausa: p.valor_causa != null ? String(p.valor_causa) : "",
      fase: p.fase || "",
    });
    setEditId(p.id);
    setTribunalDetect(p.tribunal ? `✓ ${p.tribunal}` : "");
    setShowForm(true);
  };

  const filtered = processos.filter(p =>
    (!search || p.numero_cnj.includes(search) || (p.advogados || "").toLowerCase().includes(search.toLowerCase()) || (p.partes || "").toLowerCase().includes(search.toLowerCase())) &&
    (!filterStatus || p.status === filterStatus.toLowerCase() || p.status === filterStatus) &&
    (!filterFase || p.fase === filterFase)
  );

  const statusBadge = (status: string) => {
    const cls = STATUS_BADGE[status] || STATUS_BADGE["Ativo"];
    return <span className={`text-[0.68rem] font-bold px-2 py-0.5 rounded-full ${cls}`}>{status}</span>;
  };

  return (
    <div className="page-stack">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Processos Cadastrados</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie os processos e prazos do escritório</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="gold" onClick={() => { setEditId(null); setShowForm(true); }}>
            + Cadastrar Processo
          </Button>
        </div>
      </div>

      {/* LGPD Banner */}
      <div className="flex items-start gap-2.5 bg-blue-500/5 border border-blue-500/15 rounded-lg px-4 py-2.5 mb-5 text-xs text-muted-foreground">
        <span className="text-base shrink-0">🔒</span>
        <span><strong>LGPD & Sigilo Profissional:</strong> Dados de processos e clientes armazenados no Supabase com criptografia em trânsito, sob responsabilidade do escritório.</span>
      </div>

      {/* Card principal */}
      <div className="content-panel">
        {/* Filtros */}
        <div className="flex gap-2.5 p-4 border-b border-border flex-wrap items-center justify-between">
          <input
            type="text"
            placeholder="Buscar número, parte, advogado…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all max-w-xs w-full"
          />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-accent"
          >
            <option value="">Todos os status</option>
            {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
          </select>
          <select
            value={filterFase}
            onChange={e => setFilterFase(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-accent"
          >
            <option value="">Todas as fases</option>
            {FASE_PROCESSO_OPTIONS.map(f => <option key={f}>{f}</option>)}
          </select>
          {filterFase && (
            <button
              onClick={() => setFilterFase("")}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              limpar filtro de fase
            </button>
          )}
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Carregando processos…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum processo.{" "}
              <button className="underline text-accent" onClick={() => setShowForm(true)}>Cadastrar</button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  {["Número CNJ", "Tribunal / Classe", "Partes", "Assunto / Órgão", "Fase", "Última Mov.", "Status", "Ações"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const rico = p as ProcessoRico;
                  const movs = rico._movimentacoes || [];
                  const m = movs[0];
                  return (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      {/* Número CNJ */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setPanelProcesso(rico)}
                          className="font-mono text-sm font-bold text-accent/90 hover:text-accent hover:underline underline-offset-2 transition-colors text-left"
                          title="Ver detalhes do processo"
                        >
                          {p.numero_cnj}
                        </button>
                        {p._pendente && <span className="text-[0.6rem] bg-accent/10 text-accent px-1.5 py-0.5 rounded font-bold ml-1">pendente</span>}
                        {p.advogados && <div className="text-[0.65rem] text-muted-foreground mt-0.5 truncate max-w-[180px]">{p.advogados}</div>}
                      </td>

                      {/* Tribunal + Classe */}
                      <td className="px-4 py-3 text-xs max-w-[160px]">
                        <div className="font-medium text-foreground leading-snug">
                          {(rico.tribunalNome || p.tribunal || "—").slice(0, 25)}
                        </div>
                        {(() => {
                          const djd = p.dados_datajud as any;
                          const classe = rico.classe || p.classe || djd?.classe || null;
                          return classe ? (
                            <div className="text-[0.65rem] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{classe}</div>
                          ) : null;
                        })()}
                      </td>

                      {/* Partes */}
                      <td className="px-4 py-3 text-xs max-w-[180px]">
                        {(() => {
                          const djd = p.dados_datajud as any;
                          const autorFinal = (rico.autor && rico.autor !== "—") ? rico.autor : ((djd?.autor && djd.autor !== "—") ? djd.autor : null);
                          const reuFinal   = (rico.reu   && rico.reu   !== "—") ? rico.reu   : ((djd?.reu   && djd.reu   !== "—") ? djd.reu   : null);
                          const partesStr  = p.partes || "";
                          const sepIdx     = partesStr.indexOf("×");
                          const autorFallback = sepIdx > -1 ? partesStr.slice(0, sepIdx).trim() : partesStr.trim();
                          const reuFallback   = sepIdx > -1 ? partesStr.slice(sepIdx + 1).trim() : null;
                          const autorExibir   = autorFinal || autorFallback || "—";
                          const reuExibir     = reuFinal   || reuFallback   || "—";
                          return (
                            <>
                              <div className="font-medium text-foreground line-clamp-2">{autorExibir}</div>
                              <div className="text-muted-foreground line-clamp-2">× {reuExibir}</div>
                            </>
                          );
                        })()}
                      </td>

                      {/* Assunto + Órgão Julgador */}
                      <td className="px-4 py-3 text-xs max-w-[180px]">
                        {(() => {
                          const djd = p.dados_datajud as any;
                          const assunto = rico.assunto || p.assunto || djd?.assunto || null;
                          const orgao   = rico.orgaoJulgador || p.vara || djd?.orgaoJulgador || null;
                          return (
                            <>
                              {assunto && <div className="font-medium text-foreground line-clamp-2 leading-snug">{assunto}</div>}
                              {orgao   && <div className="text-[0.65rem] text-muted-foreground mt-0.5 line-clamp-2 leading-snug">{orgao}</div>}
                              {!assunto && !orgao && <span className="text-muted-foreground">—</span>}
                            </>
                          );
                        })()}
                      </td>

                      {/* Fase do Processo */}
                      <td className="px-4 py-3 text-xs">
                        {p.fase ? (
                          <span className="inline-block text-[0.65rem] font-semibold bg-purple-500/10 text-purple-600 border border-purple-400/25 rounded px-2 py-1">{p.fase}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Última Movimentação */}
                      <td className="px-4 py-3 max-w-[220px]">
                        {p.ultima_movimentacao_titulo || p.ultima_movimentacao ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[0.68rem] text-blue-600 font-semibold">
                              {(() => {
                                const raw = p.ultima_movimentacao;
                                if (!raw) return "—";
                                const [ano, mes, dia] = raw.slice(0, 10).split("-");
                                return (ano && mes && dia) ? `${dia}/${mes}/${ano}` : "—";
                              })()}
                            </span>
                            {p.ultima_movimentacao_titulo && (
                              <span className="text-xs font-semibold text-foreground leading-tight line-clamp-1">{p.ultima_movimentacao_titulo}</span>
                            )}
                            {p.ultima_movimentacao_descricao && (
                              <span className="text-[0.65rem] text-muted-foreground leading-snug line-clamp-2">{p.ultima_movimentacao_descricao}</span>
                            )}
                          </div>
                        ) : m ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[0.68rem] text-blue-600 font-semibold">{m.data}</span>
                            <span className="text-xs font-semibold text-foreground leading-tight max-w-[160px] line-clamp-2">{m.tipo}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {statusBadge(p.status ? p.status.charAt(0).toUpperCase() + p.status.slice(1) : "Ativo")}
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button onClick={() => setPanelProcesso(rico)} title="Ver detalhes"
                            className="text-xs border border-border rounded px-2 py-1 hover:bg-muted transition-colors">📋</button>
                          <button onClick={() => abrirEdicao(rico)} title="Editar"
                            className="text-xs border border-border rounded px-2 py-1 hover:bg-muted transition-colors">✏️</button>
                          <button onClick={() => criarTarefaDeProcesso(rico)} title="Criar Tarefa"
                            className="text-xs bg-accent/15 text-accent border border-accent/30 rounded px-2 py-1 hover:bg-accent/25 transition-colors font-bold">📌</button>
                          <button onClick={() => handleDelete(p.id)} title="Remover"
                            className="text-xs bg-red-alert/10 text-red-alert border border-red-alert/20 rounded px-2 py-1 hover:bg-red-alert/20 transition-colors">✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal de Cadastro / Edição */}
      {showForm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/50" onClick={e => { if (e.target === e.currentTarget) resetForm(); }}>
          <div className="bg-card rounded-2xl p-7 max-w-xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="font-display text-lg font-bold mb-4">{editId ? "Editar Processo" : "Cadastrar Processo"}</h2>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-[0.72rem] font-bold uppercase tracking-wider">Número CNJ *</label>
                <input
                  value={form.numero_cnj}
                  onChange={e => handleCNJInput(e.target.value)}
                  placeholder="0000001-00.0000.0.00.0000"
                  readOnly={!!editId}
                  className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all font-mono disabled:bg-muted"
                />
                {tribunalDetect && (
                  <div className="text-xs text-green-ok mt-1">{tribunalDetect}</div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FG label="Advogado Responsável"><input value={form.advogado} onChange={e => setForm(f => ({ ...f, advogado: e.target.value }))} placeholder="Dr(a). Nome" className="field" /></FG>
                <FG label="OAB"><input value={form.oab} onChange={e => setForm(f => ({ ...f, oab: e.target.value }))} placeholder="SP 123456" className="field" /></FG>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FG label="Parte Ativa (Autor)"><input value={form.autorManual} onChange={e => setForm(f => ({ ...f, autorManual: e.target.value }))} placeholder="Nome do autor/requerente" className="field" /></FG>
                <FG label="Parte Passiva (Réu)"><input value={form.reuManual} onChange={e => setForm(f => ({ ...f, reuManual: e.target.value }))} placeholder="Nome do réu/requerido" className="field" /></FG>
              </div>
              <div className="text-[0.68rem] text-muted-foreground -mt-1.5">
                💡 Preencha os dados do processo manualmente. Essas informações ficam salvas e podem ser editadas a qualquer momento.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FG label="Classe"><input value={form.classe} onChange={e => setForm(f => ({ ...f, classe: e.target.value }))} placeholder="Ex: Procedimento Comum Cível" className="field" /></FG>
                <FG label="Assunto"><input value={form.assunto} onChange={e => setForm(f => ({ ...f, assunto: e.target.value }))} placeholder="Ex: Indenização por Dano Moral" className="field" /></FG>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FG label="Vara"><input value={form.vara} onChange={e => setForm(f => ({ ...f, vara: e.target.value }))} placeholder="Ex: 3ª Vara Cível" className="field" /></FG>
                <FG label="Comarca"><input value={form.comarca} onChange={e => setForm(f => ({ ...f, comarca: e.target.value }))} placeholder="Ex: São Paulo/SP" className="field" /></FG>
              </div>
              <FG label="Valor da Causa (R$)">
                <input value={form.valorCausa} onChange={e => setForm(f => ({ ...f, valorCausa: e.target.value.replace(/[^0-9.,]/g, "") }))} placeholder="Ex: 15000,00" className="field" />
              </FG>
              <div className="grid grid-cols-2 gap-3">
                <FG label="Área do Direito">
                  <select value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} className="field">
                    {AREAS.map(a => <option key={a}>{a}</option>)}
                  </select>
                </FG>
                <FG label="Status">
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="field">
                    {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </FG>
              </div>
              <FG label="Fase do Processo">
                <select value={form.fase} onChange={e => setForm(f => ({ ...f, fase: e.target.value }))} className="field">
                  <option value="">— Não informado —</option>
                  {FASE_PROCESSO_OPTIONS.map(f => <option key={f}>{f}</option>)}
                </select>
              </FG>
              <FG label="Observações Internas (sigilo profissional)">
                <textarea value={form.obs} onChange={e => setForm(f => ({ ...f, obs: e.target.value }))} placeholder="Notas do advogado — não compartilhadas com o cliente" className="field min-h-[70px]" />
              </FG>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={resetForm} className="btn-outline-sm">Cancelar</button>
              <Button variant="gold" onClick={handleSalvar} disabled={createProcesso.isPending || updateProcesso.isPending}>
                {editId ? "💾 Salvar Alterações" : "💾 Cadastrar Processo"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay */}
      {panelProcesso && (
        <div className="fixed inset-0 bg-black/30 z-[190]" onClick={() => setPanelProcesso(null)} />
      )}

      {/* Painel lateral deslizante */}
      <div className={`fixed right-0 top-0 bottom-0 w-[540px] max-w-full bg-card border-l border-border shadow-2xl z-[200] overflow-y-auto transition-transform duration-300 ease-in-out ${panelProcesso ? "translate-x-0" : "translate-x-full"}`}>
        {panelProcesso && (
          <DetailPanel
            processo={panelProcesso}
            onClose={() => setPanelProcesso(null)}
            onDelete={handleDelete}
            onCriarTarefa={criarTarefaDeProcesso}
            statusBadge={statusBadge}
          />
        )}
      </div>

      {/* Modal de Criação de Tarefa (a partir de um processo) */}
      <CreateTaskModal
        open={showTaskModal}
        onClose={() => { setShowTaskModal(false); setTaskModalInitialData(null); setProcessoParaTarefa(null); }}
        onSubmit={handleSubmitTarefaDeProcesso}
        initialData={taskModalInitialData}
        feriados={feriados}
        isAdmin={isAdmin}
        delegacaoProfiles={profilesParaDelegacao.map((p: any) => ({ id: p.user_id, full_name: p.full_name || "Usuário" }))}
      />
    </div>
  );
}

// ── Painel de Detalhe ──────────────────────────────────────────────────────────
function DetailPanel({ processo, onClose, onDelete, onCriarTarefa, statusBadge }: {
  processo: ProcessoRico;
  onClose: () => void;
  onDelete: (id: string) => void;
  onCriarTarefa: (processo: ProcessoRico) => void;
  statusBadge: (s: string) => React.ReactNode;
}) {
  const { data: movimentacoesDB = [] } = useMovimentacoes(processo.id);
  const createMovimentacao = useCreateMovimentacao();
  const deleteMovimentacao = useDeleteMovimentacao();
  const { toast } = useToast();
  // Prioriza movimentações locais (pós-sync antigo, se existir) sobre as do banco
  const movs = (processo._movimentacoes?.length ? processo._movimentacoes : movimentacoesDB) as any[];

  const djData = processo.dados_datajud as any;

  // Extrai partes com fallback robusto
  const partesStr = processo.partes || "";
  const sepIdx = partesStr.indexOf("×");
  const autorFallback = sepIdx > -1 ? partesStr.slice(0, sepIdx).trim() : partesStr.trim();
  const reuFallback   = sepIdx > -1 ? partesStr.slice(sepIdx + 1).trim() : null;

  const autorLimpo = (processo.autor && processo.autor !== "—") ? processo.autor : null;
  const reuLimpo   = (processo.reu   && processo.reu   !== "—") ? processo.reu   : null;
  const djAutorLimpo = (djData?.autor && djData.autor !== "—") ? djData.autor : null;
  const djReuLimpo   = (djData?.reu   && djData.reu   !== "—") ? djData.reu   : null;

  const autor = autorLimpo || djAutorLimpo || autorFallback || "—";
  const reu   = reuLimpo   || djReuLimpo   || reuFallback   || "—";

  // ── Adicionar movimentação manual ─────────────────────────────────────────
  const [showMovForm, setShowMovForm] = useState(false);
  const [movForm, setMovForm] = useState({ titulo: "", descricao: "", data: new Date().toISOString().slice(0, 10) });

  const salvarMovimentacao = async () => {
    if (!movForm.titulo.trim()) { toast({ title: "Informe um título para a movimentação", variant: "destructive" }); return; }
    try {
      await createMovimentacao.mutateAsync({
        processo_id: processo.id,
        titulo: movForm.titulo.trim(),
        descricao: movForm.descricao.trim() || null,
        data: movForm.data,
      });
      setMovForm({ titulo: "", descricao: "", data: new Date().toISOString().slice(0, 10) });
      setShowMovForm(false);
      toast({ title: "✅ Movimentação adicionada!" });
    } catch (err: any) {
      toast({ title: "Erro ao adicionar movimentação", description: err.message, variant: "destructive" });
    }
  };

  return (
    <>
      <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10">
        <div>
          <div className="font-mono text-sm font-bold text-accent">{processo.numero_cnj}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{processo.tribunalNome || processo.tribunal || "—"}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onCriarTarefa(processo)}
            className="flex items-center gap-1 text-xs bg-accent/15 text-accent border border-accent/30 rounded-md px-3 py-1.5 font-bold hover:bg-accent/25 transition-colors"
          >
            <ClipboardList className="h-3 w-3" />
            Criar Tarefa
          </button>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Dados principais */}
        <div>
          <div className="text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2 mb-3">Dados do Processo</div>
          <div className="space-y-0">
            {[
              ["Tribunal",        processo.tribunalNome || processo.tribunal],
              ["Classe",          processo.classe],
              ["Assunto",         processo.assunto],
              ["Fase",            processo.fase],
              ["Vara / Órgão Julgador", processo.orgaoJulgador || processo.vara],
              ["Comarca",         processo.comarca],
              ["Valor da Causa",  processo.valor_causa != null ? `R$ ${Number(processo.valor_causa).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : null],
              ["Data Ajuizamento",processo.dataAjuizamento || (processo.dados_datajud as any)?.dataAjuizamento],
              ["Polo Ativo",      autor],
              ["Polo Passivo",    reu],
              ["Advogado",        processo.advogados],
              ["Status",          null],
            ].map(([key, val]) => (
              <div key={key as string} className="flex justify-between items-start py-2 border-b border-border/40 gap-4">
                <span className="text-xs font-bold text-muted-foreground shrink-0">{key}</span>
                <span className="text-xs text-right">
                  {key === "Status"
                    ? statusBadge(processo.status ? processo.status.charAt(0).toUpperCase() + processo.status.slice(1) : "Ativo")
                    : (val as string) || "—"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Última movimentação em destaque */}
        {(processo.ultima_movimentacao_titulo || processo.ultima_movimentacao_descricao) && (
          <div className="bg-blue-500/5 border border-blue-400/20 rounded-lg p-3">
            <div className="text-[0.62rem] font-bold uppercase tracking-wider text-blue-600 mb-1">📌 Última Movimentação</div>
            {processo.ultima_movimentacao_titulo && (
              <div className="text-sm font-semibold text-foreground">{processo.ultima_movimentacao_titulo}</div>
            )}
            {processo.ultima_movimentacao_descricao && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{processo.ultima_movimentacao_descricao}</p>
            )}
          </div>
        )}

        {/* Movimentações */}
        <div>
          <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
            <div className="text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground">
              Movimentações ({movs.length})
            </div>
            <button
              onClick={() => setShowMovForm(v => !v)}
              className="flex items-center gap-1 text-[0.68rem] font-bold text-accent hover:underline"
            >
              <Plus className="h-3 w-3" /> Adicionar
            </button>
          </div>

          {showMovForm && (
            <div className="bg-muted/30 border border-border rounded-lg p-3 mb-3 space-y-2">
              <FG label="Título">
                <input value={movForm.titulo} onChange={e => setMovForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Juntada de petição" className="field" />
              </FG>
              <FG label="Data">
                <input type="date" value={movForm.data} onChange={e => setMovForm(f => ({ ...f, data: e.target.value }))} className="field" />
              </FG>
              <FG label="Descrição (opcional)">
                <textarea value={movForm.descricao} onChange={e => setMovForm(f => ({ ...f, descricao: e.target.value }))} className="field min-h-[60px]" />
              </FG>
              <div className="flex gap-2 justify-end pt-1">
                <button onClick={() => setShowMovForm(false)} className="btn-outline-sm">Cancelar</button>
                <Button variant="gold" size="sm" onClick={salvarMovimentacao} disabled={createMovimentacao.isPending}>Salvar</Button>
              </div>
            </div>
          )}

          {movs.length > 0 ? (
            <div className="relative pl-5">
              <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />
              <div className="space-y-4">
                {movs.map((m: any, i: number) => (
                  <div key={m.id || i} className="relative group">
                    <div className="absolute -left-5 top-1 w-3 h-3 rounded-full bg-accent border-2 border-card shadow" />
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[0.65rem] font-bold text-blue-600 uppercase tracking-wider mb-0.5">{m.data || m.data_publicacao}</div>
                      {m.id && (
                        <button
                          onClick={() => deleteMovimentacao.mutate({ id: m.id, processo_id: processo.id })}
                          className="opacity-0 group-hover:opacity-100 text-[0.65rem] text-red-alert hover:underline transition-opacity"
                        >
                          remover
                        </button>
                      )}
                    </div>
                    <div className="text-sm font-semibold leading-snug">
                      {m.tipo || m.titulo}
                      {m.codigo && <span className="ml-1.5 text-[0.6rem] font-mono text-muted-foreground">TPU {m.codigo}</span>}
                    </div>
                    {(m.complementosTabelados?.length > 0) && (
                      <div className="mt-1.5 flex flex-col gap-1">
                        {m.complementosTabelados.map((c: any, j: number) => (
                          <div key={j} className="text-xs bg-muted/50 rounded px-2 py-1 inline-flex gap-1.5 items-baseline">
                            {c.codigo && <span className="font-mono text-muted-foreground text-[0.65rem]">{c.codigo}</span>}
                            <span>{c.nome}</span>
                            {c.valor && <span className="font-bold text-accent">{c.valor}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {m.descricao && <p className="text-xs text-muted-foreground mt-1">{m.descricao}</p>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 border border-dashed border-border rounded-lg text-sm text-muted-foreground">
              Nenhuma movimentação registrada. Clique em <strong>Adicionar</strong> para incluir a primeira.
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex gap-2 pt-2 border-t border-border">
          <button onClick={onClose} className="btn-outline-sm">Fechar</button>
          <button onClick={() => onDelete(processo.id)} className="text-xs bg-red-alert/10 text-red-alert border border-red-alert/20 rounded-lg px-3 py-1.5 font-semibold hover:bg-red-alert/20 transition-colors">
            Remover
          </button>
        </div>
      </div>
    </>
  );
}

// ── Helpers de UI ─────────────────────────────────────────────────────────────
function FG({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground">{label}</label>
      {children}
    </div>
  );
}
