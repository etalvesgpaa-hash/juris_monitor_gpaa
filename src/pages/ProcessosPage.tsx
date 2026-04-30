import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useProcessos, useCreateProcesso, useDeleteProcesso, useUpdateProcesso, useMovimentacoes } from "@/hooks/useProcessos";
import { useClientes } from "@/hooks/useClientes";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Trash2, RefreshCw, Search, ExternalLink, AlertCircle } from "lucide-react";
import type { Processo } from "@/hooks/useProcessos";

// ── Helpers DataJud ───────────────────────────────────────────────────────────
function limparCNJ(num: string): string {
  return num.replace(/\D/g, "");
}

function detectarTribunal(numero: string): string {
  // Extrai o código do tribunal do número CNJ (posições 16-20 dos 20 dígitos)
  const limpo = limparCNJ(numero);
  if (limpo.length < 20) return "tjsp"; // fallback
  const tribunal = parseInt(limpo.slice(13, 16), 10);
  const mapa: Record<number, string> = {
    8: detectarJustica(limpo), // Justiça Estadual — precisa do segmento
    5: "trf" + (limpo[16] || "1"),
    1: "stf", 2: "cnj", 3: "stj",
    6: "trt" + limpo.slice(16, 18).replace(/^0/, ""),
  };
  return mapa[tribunal] || "tjsp";
}

function detectarJustica(limpo: string): string {
  const tribunal = parseInt(limpo.slice(16, 19), 10);
  const mapaEstadual: Record<number, string> = {
    26: "tjsp", 19: "tjmg", 17: "tjrj", 21: "tjrs", 8: "tjpr",
    12: "tjsc", 6: "tjba", 11: "tjgo", 16: "tjpe", 4: "tjam",
    14: "tjpa", 3: "tjal", 2: "tjac", 1: "tjap", 5: "tjce",
    7: "tjes", 9: "tjma", 10: "tjms", 13: "tjmt", 15: "tjpb",
    18: "tjrn", 20: "tjro", 22: "tjrr", 23: "tjse", 24: "tjto",
    25: "tjdf",
  };
  return mapaEstadual[tribunal] || "tjsp";
}

function extrairIndexDataJud(numero: string): string {
  const trib = detectarTribunal(numero);
  if (trib.startsWith("trf")) return `api_publica_${trib}`;
  if (trib.startsWith("trt")) return `api_publica_${trib}`;
  return `api_publica_${trib}`;
}

async function buscarDataJud(numeroCNJ: string, token: string): Promise<any | null> {
  const limpo = limparCNJ(numeroCNJ);
  const index = extrairIndexDataJud(numeroCNJ);

  const payload = {
    query: { match: { numeroProcesso: limpo } },
    size: 1,
  };

  const endpoints = [
    // Tenta o índice específico do tribunal
    `https://api-publica.datajud.cnj.jus.br/${index}/_search`,
    // Fallback: índice genérico
    `https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `ApiKey ${token}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) continue;
      const data = await res.json();
      const hits = data?.hits?.hits;
      if (hits?.length > 0) return hits[0]._source;
    } catch (_) {}
  }
  return null;
}

function normalizarDadosDataJud(src: any): Partial<Processo> {
  if (!src) return {};

  // Partes
  const partes: string[] = (src.partes || []).map((p: any) =>
    `${p.nome || ""}${p.tipoParte ? ` (${p.tipoParte})` : ""}`
  ).filter(Boolean);

  // Advogados
  const advs: string[] = [];
  (src.partes || []).forEach((p: any) => {
    (p.advogados || []).forEach((a: any) => {
      if (a.nome) advs.push(`${a.nome}${a.numeroOab ? ` OAB ${a.numeroOab}` : ""}`);
    });
  });

  // Movimentações
  const movs = (src.movimentos || []).map((m: any) => ({
    data: m.dataHora?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    titulo: m.nome || m.descricao || "Movimentação",
    descricao: m.complementosTabelados
      ?.map((c: any) => c.descricao).join("; ") || null,
  }));

  // Última movimentação
  const ultimaMov = movs[0]?.data || null;

  return {
    classe: src.classe?.nome || null,
    assunto: src.assuntos?.[0]?.nome || null,
    tribunal: src.tribunal?.nome || src.orgaoJulgador?.codigoTribunal || null,
    vara: src.orgaoJulgador?.nome || null,
    comarca: src.orgaoJulgador?.instancia || null,
    partes: partes.slice(0, 4).join(" · ") || null,
    advogados: advs.slice(0, 3).join(", ") || null,
    ultima_movimentacao: ultimaMov,
    dados_datajud: src,
  };
}

// ── Componente principal ───────────────────────────────────────────────────────
export function ProcessosPage() {
  const { data: processos = [], isLoading } = useProcessos();
  const { data: clientes = [] } = useClientes();
  const { user } = useAuth();
  const createProcesso = useCreateProcesso();
  const deleteProcesso = useDeleteProcesso();
  const updateProcesso = useUpdateProcesso();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [selectedProcesso, setSelectedProcesso] = useState<Processo | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [atualizando, setAtualizando] = useState<Set<string>>(new Set());
  const [atualizandoTodos, setAtualizandoTodos] = useState(false);

  const [form, setForm] = useState({
    numero_cnj: "", classe: "", assunto: "", tribunal: "",
    vara: "", comarca: "", status: "ativo", valor_causa: "",
    partes: "", advogados: "", cliente_id: "",
  });

  // Busca token DataJud
  const getToken = useCallback(async (): Promise<string> => {
    const local = localStorage.getItem("jurismonitor_datajud_token");
    if (local) return local;
    const { data } = await supabase
      .from("api_keys").select("datajud_token").eq("user_id", user!.id).maybeSingle();
    if (data?.datajud_token) {
      localStorage.setItem("jurismonitor_datajud_token", data.datajud_token);
      return data.datajud_token;
    }
    return "";
  }, [user]);

  const resetForm = () => {
    setForm({ numero_cnj: "", classe: "", assunto: "", tribunal: "", vara: "", comarca: "", status: "ativo", valor_causa: "", partes: "", advogados: "", cliente_id: "" });
    setShowForm(false);
  };

  // Ao digitar número CNJ no form — tenta buscar DataJud automaticamente
  const handleCNJBlur = async () => {
    if (!form.numero_cnj.trim() || limparCNJ(form.numero_cnj).length < 18) return;
    try {
      const token = await getToken();
      if (!token) return;
      toast({ title: "🔍 Buscando na DataJud CNJ..." });
      const src = await buscarDataJud(form.numero_cnj, token);
      if (src) {
        const dados = normalizarDadosDataJud(src);
        setForm(f => ({
          ...f,
          classe:    dados.classe    || f.classe,
          assunto:   dados.assunto   || f.assunto,
          tribunal:  dados.tribunal  || f.tribunal,
          vara:      dados.vara      || f.vara,
          comarca:   dados.comarca   || f.comarca,
          partes:    dados.partes    || f.partes,
          advogados: dados.advogados || f.advogados,
        }));
        toast({ title: "✅ Dados preenchidos pela DataJud CNJ" });
      } else {
        toast({ title: "ℹ️ Processo não localizado na DataJud", description: "Preencha os dados manualmente." });
      }
    } catch (_) {}
  };

  const handleCreate = async () => {
    if (!form.numero_cnj.trim()) {
      toast({ title: "Informe o número CNJ", variant: "destructive" });
      return;
    }
    try {
      const created = await createProcesso.mutateAsync({
        numero_cnj:  form.numero_cnj,
        classe:      form.classe || null,
        assunto:     form.assunto || null,
        tribunal:    form.tribunal || null,
        vara:        form.vara || null,
        comarca:     form.comarca || null,
        status:      form.status,
        valor_causa: form.valor_causa ? parseFloat(form.valor_causa) : null,
        partes:      form.partes || null,
        advogados:   form.advogados || null,
        cliente_id:  form.cliente_id || null,
      });
      toast({ title: "✅ Processo cadastrado!" });
      resetForm();

      // Dispara atualização DataJud em background
      if (created?.id) sincronizarProcesso(created.id, form.numero_cnj, true);
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

  // ── Sincroniza um processo com DataJud ─────────────────────────────────────
  const sincronizarProcesso = useCallback(async (id: string, numeroCNJ: string, silencioso = false) => {
    setAtualizando(prev => new Set(prev).add(id));
    try {
      const token = await getToken();
      if (!token) {
        if (!silencioso) toast({ title: "Token DataJud não configurado", description: "Configure em Configurações → API Keys", variant: "destructive" });
        return;
      }

      const src = await buscarDataJud(numeroCNJ, token);
      if (!src) {
        if (!silencioso) toast({ title: "Processo não localizado na DataJud", variant: "destructive" });
        return;
      }

      const dados = normalizarDadosDataJud(src);
      const movimentos = (src.movimentos || []) as any[];

      // Atualiza processo
      await updateProcesso.mutateAsync({ id, ...dados });

      // Upsert movimentações
      if (movimentos.length > 0 && user) {
        const rows = movimentos.slice(0, 50).map((m: any) => ({
          processo_id: id,
          user_id: user.id,
          data: m.dataHora?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          titulo: m.nome || m.descricao || "Movimentação",
          descricao: m.complementosTabelados?.map((c: any) => c.descricao).join("; ") || null,
          analise_ia: null,
        }));

        // Deleta antigas e insere novas (garante dados frescos)
        await supabase.from("movimentacoes").delete().eq("processo_id", id);
        await supabase.from("movimentacoes").insert(rows);
      }

      if (!silencioso) toast({ title: "✅ Processo atualizado!", description: `${movimentos.length} movimentação(ões) sincronizada(s).` });

      // Atualiza detalhe aberto
      setSelectedProcesso(prev => prev?.id === id ? { ...prev, ...dados } as Processo : prev);

    } catch (err: any) {
      if (!silencioso) toast({ title: "Erro ao sincronizar", description: err.message, variant: "destructive" });
    } finally {
      setAtualizando(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }, [getToken, updateProcesso, user, toast]);

  // ── Atualiza TODOS os processos ─────────────────────────────────────────────
  const sincronizarTodos = async () => {
    if (processos.length === 0) return;
    setAtualizandoTodos(true);
    toast({ title: `🔄 Atualizando ${processos.length} processo(s)...` });
    let ok = 0, fail = 0;
    for (const p of processos) {
      try {
        await sincronizarProcesso(p.id, p.numero_cnj, true);
        ok++;
      } catch (_) { fail++; }
      // Pequena pausa entre chamadas para não sobrecarregar a DataJud
      await new Promise(r => setTimeout(r, 400));
    }
    setAtualizandoTodos(false);
    toast({ title: `✅ Atualização concluída: ${ok} ok${fail > 0 ? `, ${fail} falhou` : ""}` });
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
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Processos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Sincronização automática via API DataJud CNJ</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={sincronizarTodos}
            disabled={atualizandoTodos || processos.length === 0}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${atualizandoTodos ? "animate-spin" : ""}`} />
            {atualizandoTodos ? "Atualizando..." : "Atualizar Todos"}
          </Button>
          <Button variant="gold" onClick={() => setShowForm(true)}>+ Cadastrar</Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
            placeholder="Buscar número CNJ, parte, assunto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-border rounded-lg px-4 py-2.5 text-sm bg-card focus:border-accent outline-none"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="todos">Todos os status</option>
          <option value="ativo">Ativos</option>
          <option value="pendente">Pendentes</option>
          <option value="inativo">Inativos</option>
          <option value="arquivado">Arquivados</option>
        </select>
      </div>

      {/* Formulário de cadastro */}
      {showForm && (
        <div className="bg-card border border-accent/30 rounded-2xl p-5 mb-5 shadow-sm">
          <h2 className="font-display text-lg font-bold mb-1">Novo Processo</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Informe o número CNJ e pressione Tab — os dados serão buscados automaticamente na DataJud CNJ.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <InputField
                label="Número CNJ *"
                value={form.numero_cnj}
                onChange={(v) => setForm({ ...form, numero_cnj: v })}
                placeholder="0001234-56.2024.8.26.0100"
                onBlur={handleCNJBlur}
              />
            </div>
            <InputField label="Classe" value={form.classe} onChange={(v) => setForm({ ...form, classe: v })} placeholder="Preenchido automaticamente" />
            <InputField label="Assunto" value={form.assunto} onChange={(v) => setForm({ ...form, assunto: v })} placeholder="Preenchido automaticamente" />
            <InputField label="Tribunal" value={form.tribunal} onChange={(v) => setForm({ ...form, tribunal: v })} placeholder="Preenchido automaticamente" />
            <InputField label="Vara / Órgão Julgador" value={form.vara} onChange={(v) => setForm({ ...form, vara: v })} placeholder="Preenchido automaticamente" />
            <InputField label="Comarca" value={form.comarca} onChange={(v) => setForm({ ...form, comarca: v })} placeholder="Preenchido automaticamente" />
            <InputField label="Valor da Causa (R$)" value={form.valor_causa} onChange={(v) => setForm({ ...form, valor_causa: v })} placeholder="50000.00" />
            <InputField label="Partes" value={form.partes} onChange={(v) => setForm({ ...form, partes: v })} placeholder="Preenchido automaticamente" />
            <InputField label="Advogados" value={form.advogados} onChange={(v) => setForm({ ...form, advogados: v })} placeholder="Preenchido automaticamente" />
            <div>
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground">Status</label>
              <select
                className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent outline-none"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="ativo">Ativo</option>
                <option value="pendente">Pendente</option>
                <option value="inativo">Inativo</option>
                <option value="arquivado">Arquivado</option>
              </select>
            </div>
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
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="gold" onClick={handleCreate} disabled={createProcesso.isPending}>
              {createProcesso.isPending ? "Salvando..." : "Salvar Processo"}
            </Button>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando processos...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm font-medium">Nenhum processo encontrado.</p>
          <p className="text-muted-foreground text-xs mt-1">Clique em "+ Cadastrar" para adicionar um processo.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  {["Nº CNJ / Assunto", "Tribunal / Vara", "Partes", "Última Movim.", "Status", "Ações"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const sincronizando = atualizando.has(p.id);
                  return (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-mono text-sm font-bold text-accent">{p.numero_cnj}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 max-w-[220px] truncate">{p.assunto || p.classe || "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium">{p.tribunal || "—"}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{p.vara || p.comarca || "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-muted-foreground max-w-[200px] truncate">{p.partes || p.advogados || "—"}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {p.ultima_movimentacao
                          ? new Date(p.ultima_movimentacao + "T00:00:00").toLocaleDateString("pt-BR")
                          : p.dados_datajud ? "Sem movim." : "Não sincronizado"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                          p.status === "ativo"     ? "bg-green-ok/10 text-green-ok" :
                          p.status === "arquivado" ? "bg-muted text-muted-foreground" :
                          p.status === "pendente"  ? "bg-accent/10 text-accent" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {p.status === "ativo" ? "Ativo" : p.status === "arquivado" ? "Arquivado" : p.status === "pendente" ? "Pendente" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setSelectedProcesso(p)}
                            className="p-1.5 hover:bg-accent/10 rounded transition-colors"
                            title="Visualizar"
                          >
                            <Eye className="h-4 w-4 text-accent" />
                          </button>
                          <button
                            onClick={() => sincronizarProcesso(p.id, p.numero_cnj)}
                            disabled={sincronizando}
                            className="p-1.5 hover:bg-accent/10 rounded transition-colors disabled:opacity-40"
                            title="Atualizar na DataJud"
                          >
                            <RefreshCw className={`h-4 w-4 text-accent ${sincronizando ? "animate-spin" : ""}`} />
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
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-border bg-muted/10 text-xs text-muted-foreground">
            {filtered.length} processo(s) · clique em <RefreshCw className="h-3 w-3 inline" /> para sincronizar com DataJud CNJ
          </div>
        </div>
      )}

      {/* Modal detalhe */}
      <ProcessoDetailDialog
        processo={selectedProcesso}
        onClose={() => setSelectedProcesso(null)}
        onDelete={handleDelete}
        onSincronizar={(id, cnj) => sincronizarProcesso(id, cnj)}
        sincronizando={atualizando}
      />
    </div>
  );
}

// ── Modal de detalhe ──────────────────────────────────────────────────────────
function ProcessoDetailDialog({
  processo, onClose, onDelete, onSincronizar, sincronizando,
}: {
  processo: Processo | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  onSincronizar: (id: string, cnj: string) => void;
  sincronizando: Set<string>;
}) {
  const { data: movimentacoes = [] } = useMovimentacoes(processo?.id ?? null);
  const isSinc = processo ? sincronizando.has(processo.id) : false;

  if (!processo) return null;

  const djRaw = processo.dados_datajud as any;

  return (
    <Dialog open={!!processo} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <DialogTitle className="font-display text-lg">
                {processo.numero_cnj}
              </DialogTitle>
              {processo.classe && <p className="text-sm text-muted-foreground mt-0.5">{processo.classe}</p>}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSincronizar(processo.id, processo.numero_cnj)}
                disabled={isSinc}
                className="flex items-center gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSinc ? "animate-spin" : ""}`} />
                {isSinc ? "Sincronizando..." : "Atualizar DataJud"}
              </Button>
              {djRaw?.numeroCNJ && (
                <a
                  href={`https://www.cnj.jus.br/consultas-processuais/?searchType=busca_por_cnj&v=&v=${processo.numero_cnj}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-accent underline underline-offset-2 mt-1"
                >
                  <ExternalLink className="h-3 w-3" /> Ver no CNJ
                </a>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 mt-1">
          {/* Badge status + data última sincronização */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
              processo.status === "ativo"     ? "bg-green-ok/10 text-green-ok border border-green-ok/20" :
              processo.status === "arquivado" ? "bg-muted text-muted-foreground border border-border" :
              "bg-accent/10 text-accent border border-accent/20"
            }`}>
              {processo.status}
            </span>
            {processo.ultima_movimentacao && (
              <span className="text-xs text-muted-foreground">
                Última movimentação: {new Date(processo.ultima_movimentacao + "T00:00:00").toLocaleDateString("pt-BR")}
              </span>
            )}
            {!processo.dados_datajud && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                ⚠️ Não sincronizado com DataJud
              </span>
            )}
          </div>

          {/* Dados principais */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Detail label="Classe" value={processo.classe} />
            <Detail label="Assunto" value={processo.assunto} />
            <Detail label="Tribunal" value={processo.tribunal} />
            <Detail label="Vara / Órgão" value={processo.vara} />
            <Detail label="Comarca" value={processo.comarca} />
            <Detail label="Valor da Causa" value={processo.valor_causa ? `R$ ${Number(processo.valor_causa).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : null} />
          </div>

          {/* Partes e Advogados */}
          {(processo.partes || processo.advogados) && (
            <div className="space-y-2">
              {processo.partes && (
                <div>
                  <div className="text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground mb-1">Partes</div>
                  <div className="text-sm leading-relaxed">{processo.partes}</div>
                </div>
              )}
              {processo.advogados && (
                <div>
                  <div className="text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground mb-1">Advogados</div>
                  <div className="text-sm leading-relaxed">{processo.advogados}</div>
                </div>
              )}
            </div>
          )}

          {/* Resumo IA */}
          {processo.resumo_ia && (
            <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
              <div className="text-[0.7rem] font-bold uppercase tracking-widest text-accent mb-1.5">🤖 Resumo IA</div>
              <p className="text-sm leading-relaxed">{processo.resumo_ia}</p>
            </div>
          )}

          {/* Movimentações DataJud */}
          <div>
            <div className="text-[0.7rem] font-bold uppercase tracking-widest text-foreground mb-2 flex items-center gap-1.5">
              <div className="w-[18px] h-0.5 bg-accent" />
              Movimentações ({movimentacoes.length})
              {movimentacoes.length === 0 && !processo.dados_datajud && (
                <span className="text-muted-foreground font-normal normal-case ml-1">— clique em "Atualizar DataJud"</span>
              )}
            </div>
            {movimentacoes.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {movimentacoes.map((m) => (
                  <div key={m.id} className="border-l-2 border-accent/30 pl-3 py-1.5 hover:border-accent/60 transition-colors">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {new Date(m.data + "T00:00:00").toLocaleDateString("pt-BR")}
                      </span>
                      <span className="font-semibold text-sm">{m.titulo}</span>
                    </div>
                    {m.descricao && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{m.descricao}</p>}
                    {m.analise_ia && <p className="text-xs text-accent mt-1 italic">🤖 {m.analise_ia}</p>}
                  </div>
                ))}
              </div>
            ) : processo.dados_datajud ? (
              <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada para este processo.</p>
            ) : (
              <div className="bg-muted/30 border border-dashed border-border rounded-lg p-4 text-center text-sm text-muted-foreground">
                Clique em <strong>"Atualizar DataJud"</strong> para carregar movimentações.
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1 border-t border-border">
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
      <div className="mt-0.5 text-sm">{value || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, onBlur }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; onBlur?: () => void;
}) {
  return (
    <div>
      <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
        placeholder={placeholder}
      />
    </div>
  );
}
