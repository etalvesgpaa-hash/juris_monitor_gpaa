import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useProcessos, useCreateProcesso, useDeleteProcesso, useUpdateProcesso, useMovimentacoes } from "@/hooks/useProcessos";
import { useClientes } from "@/hooks/useClientes";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, X, Sparkles } from "lucide-react";
import { useGroqIA } from "@/hooks/useGroqIA";
import type { Processo } from "@/hooks/useProcessos";

// ── Mapa completo de tribunais (igual ao HTML de referência) ──────────────────
const TRIBUNAIS_MAP: Record<number, Record<number, { nome: string; alias: string }>> = {
  1: { 0: { nome: "Supremo Tribunal Federal", alias: "api_publica_stf" } },
  2: { 0: { nome: "Conselho Nacional de Justiça", alias: "api_publica_cnj" } },
  3: { 0: { nome: "Superior Tribunal de Justiça", alias: "api_publica_stj" } },
  4: {
    1: { nome: "TRF 1ª Região", alias: "api_publica_trf1" },
    2: { nome: "TRF 2ª Região", alias: "api_publica_trf2" },
    3: { nome: "TRF 3ª Região", alias: "api_publica_trf3" },
    4: { nome: "TRF 4ª Região", alias: "api_publica_trf4" },
    5: { nome: "TRF 5ª Região", alias: "api_publica_trf5" },
    6: { nome: "TRF 6ª Região", alias: "api_publica_trf6" },
  },
  5: {
    0:  { nome: "Tribunal Superior do Trabalho", alias: "api_publica_tst" },
    1:  { nome: "TRT 1ª Região (RJ)", alias: "api_publica_trt1" },
    2:  { nome: "TRT 2ª Região (SP)", alias: "api_publica_trt2" },
    3:  { nome: "TRT 3ª Região (MG)", alias: "api_publica_trt3" },
    4:  { nome: "TRT 4ª Região (RS)", alias: "api_publica_trt4" },
    5:  { nome: "TRT 5ª Região (BA)", alias: "api_publica_trt5" },
    6:  { nome: "TRT 6ª Região (PE)", alias: "api_publica_trt6" },
    7:  { nome: "TRT 7ª Região (CE)", alias: "api_publica_trt7" },
    8:  { nome: "TRT 8ª Região (PA/AP)", alias: "api_publica_trt8" },
    9:  { nome: "TRT 9ª Região (PR)", alias: "api_publica_trt9" },
    10: { nome: "TRT 10ª Região (DF/TO)", alias: "api_publica_trt10" },
    11: { nome: "TRT 11ª Região (AM/RR)", alias: "api_publica_trt11" },
    12: { nome: "TRT 12ª Região (SC)", alias: "api_publica_trt12" },
    13: { nome: "TRT 13ª Região (PB)", alias: "api_publica_trt13" },
    14: { nome: "TRT 14ª Região (RO/AC)", alias: "api_publica_trt14" },
    15: { nome: "TRT 15ª Região (Campinas)", alias: "api_publica_trt15" },
    16: { nome: "TRT 16ª Região (MA)", alias: "api_publica_trt16" },
    17: { nome: "TRT 17ª Região (ES)", alias: "api_publica_trt17" },
    18: { nome: "TRT 18ª Região (GO)", alias: "api_publica_trt18" },
    19: { nome: "TRT 19ª Região (AL)", alias: "api_publica_trt19" },
    20: { nome: "TRT 20ª Região (SE)", alias: "api_publica_trt20" },
    21: { nome: "TRT 21ª Região (RN)", alias: "api_publica_trt21" },
    22: { nome: "TRT 22ª Região (PI)", alias: "api_publica_trt22" },
    23: { nome: "TRT 23ª Região (MT)", alias: "api_publica_trt23" },
    24: { nome: "TRT 24ª Região (MS)", alias: "api_publica_trt24" },
  },
  8: {
    1:  { nome: "TJAC", alias: "api_publica_tjac" },
    2:  { nome: "TJAL", alias: "api_publica_tjal" },
    3:  { nome: "TJAM", alias: "api_publica_tjam" },
    4:  { nome: "TJAP", alias: "api_publica_tjap" },
    5:  { nome: "TJBA", alias: "api_publica_tjba" },
    6:  { nome: "TJCE", alias: "api_publica_tjce" },
    7:  { nome: "TJDF", alias: "api_publica_tjdft" },
    8:  { nome: "TJES", alias: "api_publica_tjes" },
    9:  { nome: "TJGO", alias: "api_publica_tjgo" },
    10: { nome: "TJMA", alias: "api_publica_tjma" },
    11: { nome: "TJMT", alias: "api_publica_tjmt" },
    12: { nome: "TJMS", alias: "api_publica_tjms" },
    13: { nome: "TJMG", alias: "api_publica_tjmg" },
    14: { nome: "TJPA", alias: "api_publica_tjpa" },
    15: { nome: "TJPB", alias: "api_publica_tjpb" },
    16: { nome: "TJPE", alias: "api_publica_tjpe" },
    17: { nome: "TJPI", alias: "api_publica_tjpi" },
    18: { nome: "TJPR", alias: "api_publica_tjpr" },
    19: { nome: "TJRJ", alias: "api_publica_tjrj" },
    20: { nome: "TJRN", alias: "api_publica_tjrn" },
    21: { nome: "TJRO", alias: "api_publica_tjro" },
    22: { nome: "TJRR", alias: "api_publica_tjrr" },
    23: { nome: "TJRS", alias: "api_publica_tjrs" },
    24: { nome: "TJSC", alias: "api_publica_tjsc" },
    25: { nome: "TJSE", alias: "api_publica_tjse" },
    26: { nome: "TJSP", alias: "api_publica_tjsp" },
    27: { nome: "TJTO", alias: "api_publica_tjto" },
  },
};

const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br";
const DEFAULT_TOKEN = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

function detectarTribunalCNJ(numero: string): { nome: string; alias: string } | null {
  const limpo = numero.replace(/\D/g, "");
  if (limpo.length < 15) return null;
  const J  = parseInt(limpo[13], 10);
  const TR = parseInt(limpo.slice(14, 16), 10);
  return TRIBUNAIS_MAP[J]?.[TR] || TRIBUNAIS_MAP[J]?.[0] || null;
}

function maskCNJ(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 20);
  if (d.length <= 7)  return d;
  if (d.length <= 9)  return `${d.slice(0,7)}-${d.slice(7)}`;
  if (d.length <= 13) return `${d.slice(0,7)}-${d.slice(7,9)}.${d.slice(9)}`;
  if (d.length <= 14) return `${d.slice(0,7)}-${d.slice(7,9)}.${d.slice(9,13)}.${d.slice(13)}`;
  if (d.length <= 16) return `${d.slice(0,7)}-${d.slice(7,9)}.${d.slice(9,13)}.${d.slice(13,14)}.${d.slice(14)}`;
  if (d.length <= 20) return `${d.slice(0,7)}-${d.slice(7,9)}.${d.slice(9,13)}.${d.slice(13,14)}.${d.slice(14,16)}.${d.slice(16)}`;
  return v;
}

// Normaliza resposta DataJud → formato interno
function normalizarDatajud(src: any, tribunal: { nome: string }) {
  const partes = (src.partes || []).map((p: any) => ({
    nome: p.nome || "",
    tipo: (p.tipoParte || "").toLowerCase().includes("passiv") ? "Passivo" : "Ativo",
    advogados: (p.advogados || []).map((a: any) => ({ nome: a.nome || "", oab: a.numeroOab || "" })),
  }));

  const autor = partes.find((x: any) => x.tipo === "Ativo")?.nome || "—";
  const reu   = partes.find((x: any) => x.tipo === "Passivo")?.nome || "—";

  const movimentacoes = (src.movimentos || [])
    .map((m: any) => {
      const dataRaw = m.dataHora || m.data || "";
      const dataISO = dataRaw.slice(0, 10);
      const dataBR  = dataISO
        ? dataISO.split("-").reverse().join("/")
        : "—";
      const comps = (m.complementosTabelados || []).map((c: any) => ({
        codigo: c.codigo || "",
        nome: c.nome || c.descricao || "",
        valor: c.valor || "",
      }));
      return {
        data: dataBR,
        dataISO,
        tipo: m.nome || m.descricao || "Movimentação",
        codigo: m.codigo || "",
        classificacao: m.complementosTabelados?.[0]?.nome || "",
        complementosTabelados: comps,
        complementoLivre: m.complemento || "",
        resumo_ia: null as string | null,
        urgencia: "baixa" as "alta" | "media" | "baixa",
        nova: false,
      };
    })
    .sort((a: any, b: any) => b.dataISO.localeCompare(a.dataISO));

  return {
    tribunalNome: tribunal.nome,
    classe:        src.classe?.nome || "—",
    assunto:       src.assuntos?.[0]?.nome || "—",
    orgaoJulgador: src.orgaoJulgador?.nome || "—",
    dataAjuizamento: src.dataAjuizamento
      ? src.dataAjuizamento.slice(0, 10).split("-").reverse().join("/")
      : "—",
    autor,
    reu,
    partes,
    ultimaMov: movimentacoes[0]?.data || "—",
    _movimentacoes: movimentacoes,
  };
}

// Busca DataJud via /api/proxy (funciona em produção e dev via Vite proxy)
async function buscarDataJud(numero: string, token: string) {
  const tribunal = detectarTribunalCNJ(numero);
  if (!tribunal) throw new Error("Tribunal não identificado. Verifique o número CNJ.");

  const numeroPuro = numero.replace(/\D/g, "");
  const endpoint = `${DATAJUD_BASE}/${tribunal.alias}/_search`;
  const proxyUrl = `/api/proxy?url=${encodeURIComponent(endpoint)}`;

  const bodyPayload = {
    size: 1,
    query: {
      bool: {
        should: [
          { term:  { numeroProcesso: numeroPuro } },
          { match: { numeroProcesso: numeroPuro } },
          { term:  { numeroProcesso: numero } },
        ],
        minimum_should_match: 1,
      },
    },
    _source: [
      "numeroProcesso", "tribunal", "classe", "assuntos",
      "dataAjuizamento", "orgaoJulgador", "partes", "movimentos",
    ],
  };

  const resp = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // "ApiKey" com K maiúsculo — formato exato exigido pela DataJud CNJ
      "Authorization": `ApiKey ${token}`,
    },
    body: JSON.stringify(bodyPayload),
    signal: AbortSignal.timeout(35000),
  });

  const rawText = await resp.text();

  if (!resp.ok) {
    // Tenta extrair mensagem de erro da resposta
    let detalhe = rawText.slice(0, 300);
    try { detalhe = JSON.stringify(JSON.parse(rawText)); } catch(_) {}
    throw new Error(`Erro HTTP ${resp.status} — ${detalhe}`);
  }

  let data: any;
  try { data = JSON.parse(rawText); } catch(_) {
    throw new Error(`Resposta inválida da API: ${rawText.slice(0, 200)}`);
  }

  const parsed = typeof data.contents === "string" ? JSON.parse(data.contents) : data;
  const hit = parsed?.hits?.hits?.[0]?._source;
  if (!hit) return null;
  return normalizarDatajud(hit, tribunal);
}

// ── Status badges ──────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  "Ativo":                "bg-green-ok/10 text-green-ok border border-green-ok/20",
  "Em Recurso":           "bg-blue-500/10 text-blue-700 border border-blue-200",
  "Em Execução":          "bg-accent/10 text-accent border border-accent/20",
  "Suspenso":             "bg-purple-500/10 text-purple-700 border border-purple-200",
  "Transitado em Julgado":"bg-emerald-500/10 text-emerald-700 border border-emerald-200",
  "Encerrado":            "bg-muted text-muted-foreground border border-border",
  "Arquivado":            "bg-muted text-muted-foreground border border-border",
};

const STATUS_OPTS = ["Ativo","Em Recurso","Em Execução","Suspenso","Transitado em Julgado","Encerrado","Arquivado"];
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
export function ProcessosPage() {
  const { data: rawProcessos = [], isLoading, refetch } = useProcessos();
  const { user } = useAuth();
  const { loadingIA, progresso, gerarResumoProcesso, gerarTodosResumosProcessos } = useGroqIA();
  const createProcesso = useCreateProcesso();
  const deleteProcesso = useDeleteProcesso();
  const updateProcesso = useUpdateProcesso();
  const { toast } = useToast();

  // Estado local enriquecido (adiciona _movimentacoes etc.)
  const [processos, setProcessos] = useState<ProcessoRico[]>(() => rawProcessos as ProcessoRico[]);
  const [search, setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [panelProcesso, setPanelProcesso] = useState<ProcessoRico | null>(null);
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [syncing, setSyncing]     = useState<Set<string>>(new Set());
  const [syncingAll, setSyncingAll] = useState(false);
  const [tribunalDetect, setTribunalDetect] = useState("");

  // Mantém processos locais sincronizados com Supabase
  const prevRaw = useRef<string>("");
  const rawStr = JSON.stringify(rawProcessos.map(p => p.id));
  if (rawStr !== prevRaw.current) {
    prevRaw.current = rawStr;
    setProcessos(prev => {
      return (rawProcessos as ProcessoRico[]).map(rp => {
        const existing = prev.find(p => p.id === rp.id);
        return existing ? { ...rp, ...existing } : rp;
      });
    });
  }

  const [form, setForm] = useState({
    numero_cnj: "", advogado: "", oab: "", clienteNome: "", whatsapp: "",
    area: "Cível", status: "Ativo", obs: "", cliente_id: "",
  });

  const getToken = useCallback(async () => {
    const local = localStorage.getItem("jurismonitor_datajud_token");
    if (local) return local;
    try {
      const { data } = await supabase
        .from("api_keys").select("datajud_token").eq("user_id", user!.id).maybeSingle();
      if (data?.datajud_token) {
        localStorage.setItem("jurismonitor_datajud_token", data.datajud_token);
        return data.datajud_token;
      }
    } catch (_) {}
    return DEFAULT_TOKEN;
  }, [user]);

  // Pré-carrega o token DataJud do Supabase no mount para não depender só do localStorage
  useEffect(() => {
    if (!user) return;
    if (localStorage.getItem("jurismonitor_datajud_token")) return; // já está em cache
    supabase
      .from("api_keys")
      .select("datajud_token")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.datajud_token) {
          localStorage.setItem("jurismonitor_datajud_token", data.datajud_token);
        }
      });
  }, [user]);

  const resetForm = () => {
    setForm({ numero_cnj: "", advogado: "", oab: "", clienteNome: "", whatsapp: "", area: "Cível", status: "Ativo", obs: "", cliente_id: "" });
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

  // ── Sincronizar processo com DataJud ──────────────────────────────────────
  const sincronizar = useCallback(async (id: string, numero: string, silencioso = false) => {
    setSyncing(prev => new Set(prev).add(id));
    try {
      const token = await getToken();
      if (!silencioso) toast({ title: `🔄 Consultando DataJud: ${numero.slice(0,18)}…` });

      const norm = await buscarDataJud(numero, token);
      if (!norm) {
        if (!silencioso) toast({ title: "Processo não localizado no DataJud", variant: "destructive" });
        return;
      }

      // Monta partes formatadas
      const partesFormatadas = [norm.autor, norm.reu].filter(x => x && x !== "—").join(" × ") || null;

      // Atualiza processo no Supabase com todos os campos DataJud
      await updateProcesso.mutateAsync({
        id,
        classe:              norm.classe !== "—" ? norm.classe : undefined,
        assunto:             norm.assunto !== "—" ? norm.assunto : undefined,
        tribunal:            norm.tribunalNome,
        vara:                norm.orgaoJulgador !== "—" ? norm.orgaoJulgador : undefined,
        comarca:             norm.orgaoJulgador !== "—" ? norm.orgaoJulgador : undefined,
        partes:              partesFormatadas,
        ultima_movimentacao: norm._movimentacoes[0]?.dataISO || null,
        dados_datajud:       norm as any,
      });

      // Salva movimentações no Supabase
      if (user) {
        // Deleta antigas
        await supabase.from("movimentacoes").delete().eq("processo_id", id);

        if (norm._movimentacoes.length > 0) {
          const rows = norm._movimentacoes.slice(0, 200).map((m: any) => ({
            processo_id: id,
            user_id:     user.id,
            data:        m.dataISO || new Date().toISOString().slice(0, 10),
            titulo:      m.tipo || "Movimentação",
            descricao:   [
              ...(m.complementosTabelados || []).map((c: any) => c.nome).filter(Boolean),
              m.complementoLivre,
            ].filter(Boolean).join("; ") || null,
            analise_ia: null,
          }));

          const { error: insErr } = await supabase.from("movimentacoes").insert(rows);
          if (insErr) console.error("[sync] Erro ao inserir movimentações:", insErr.message);
        }
      }

      // Atualiza estado local imediatamente (sem esperar refetch)
      const processoAtualizado: Partial<ProcessoRico> = {
        classe:      norm.classe !== "—" ? norm.classe : undefined,
        assunto:     norm.assunto !== "—" ? norm.assunto : undefined,
        tribunal:    norm.tribunalNome,
        vara:        norm.orgaoJulgador !== "—" ? norm.orgaoJulgador : undefined,
        partes:      partesFormatadas,
        ultima_movimentacao: norm._movimentacoes[0]?.dataISO || null,
        dados_datajud: norm as any,
        tribunalNome: norm.tribunalNome,
        autor:        norm.autor,
        reu:          norm.reu,
        orgaoJulgador: norm.orgaoJulgador,
        dataAjuizamento: norm.dataAjuizamento,
        ultimaMov:    norm.ultimaMov,
        _movimentacoes: norm._movimentacoes,
      };

      setProcessos(prev => prev.map(p => p.id === id ? { ...p, ...processoAtualizado } : p));
      if (panelProcesso?.id === id) setPanelProcesso(p => p ? { ...p, ...processoAtualizado } as ProcessoRico : p);

      if (!silencioso) toast({
        title: `✅ ${norm._movimentacoes.length} movimentação(ões) sincronizada(s)!`,
        description: norm.tribunalNome,
      });

    } catch (err: any) {
      if (!silencioso) toast({ title: "Erro ao sincronizar", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }, [getToken, updateProcesso, user, panelProcesso, toast]);

  // ── Resumo IA de um processo ─────────────────────────────────────────────
  const gerarResumoUmProcesso = useCallback(async (processo: ProcessoRico) => {
    const movs = processo._movimentacoes || [];
    const resumo = await gerarResumoProcesso(processo, movs);
    if (!resumo) return;

    // Salva no Supabase
    await supabase.from("processos").update({ resumo_ia: resumo } as any).eq("id", processo.id);

    // Atualiza estado local
    setProcessos(prev => prev.map(p => p.id === processo.id ? { ...p, resumo_ia: resumo } : p));
    if (panelProcesso?.id === processo.id) setPanelProcesso(p => p ? { ...p, resumo_ia: resumo } as ProcessoRico : p);
    toast({ title: "✦ Resumo IA gerado e salvo!" });
  }, [gerarResumoProcesso, panelProcesso]);

  // ── Gerar todos os resumos IA ───────────────────────────────────────────────
  const gerarTodosResumos = useCallback(async () => {
    await gerarTodosResumosProcessos(
      processos,
      async (id: string) => {
        const p = processos.find(x => x.id === id);
        return p?._movimentacoes || [];
      },
      async (id: string, resumo: string) => {
        await supabase.from("processos").update({ resumo_ia: resumo } as any).eq("id", id);
        setProcessos(prev => prev.map(p => p.id === id ? { ...p, resumo_ia: resumo } : p));
      }
    );
  }, [gerarTodosResumosProcessos, processos]);

  const sincronizarTodos = async () => {
    if (!processos.length) return;
    setSyncingAll(true);
    toast({ title: `🔄 Sincronizando ${processos.length} processo(s)…` });
    for (let i = 0; i < processos.length; i++) {
      const p = processos[i];
      await sincronizar(p.id, p.numero_cnj, true);
      if (i < processos.length - 1) await new Promise(r => setTimeout(r, 600));
    }
    setSyncingAll(false);
    toast({ title: "✅ Sincronização concluída!" });
  };

  const handleSalvar = async () => {
    if (!form.numero_cnj.trim()) { toast({ title: "Informe o número CNJ", variant: "destructive" }); return; }
    const tribunal = detectarTribunalCNJ(form.numero_cnj);
    if (!tribunal) { toast({ title: "Número CNJ inválido ou tribunal não mapeado", variant: "destructive" }); return; }

    try {
      if (editId) {
        await updateProcesso.mutateAsync({
          id: editId,
          advogados: form.advogado || null,
          status: form.status.toLowerCase(),
        });
        toast({ title: "✅ Processo atualizado!" });
      } else {
        const created = await createProcesso.mutateAsync({
          numero_cnj: form.numero_cnj,
          tribunal: tribunal.nome,
          status: "ativo",
          advogados: form.advogado || null,
          classe: null, assunto: null, vara: null, comarca: null,
          partes: null, valor_causa: null, cliente_id: null,
        });
        toast({ title: "✅ Processo cadastrado! Buscando na DataJud…", description: tribunal.nome });
        if (created?.id) setTimeout(() => sincronizar(created.id, form.numero_cnj), 500);
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
    setForm({ numero_cnj: p.numero_cnj, advogado: p.advogados || "", oab: "", clienteNome: "", whatsapp: "", area: "Cível", status: p.status || "Ativo", obs: "", cliente_id: p.cliente_id || "" });
    setEditId(p.id);
    setTribunalDetect(p.tribunal ? `✓ ${p.tribunal}` : "");
    setShowForm(true);
  };

  const filtered = processos.filter(p =>
    (!search || p.numero_cnj.includes(search) || (p.advogados || "").toLowerCase().includes(search.toLowerCase()) || (p.partes || "").toLowerCase().includes(search.toLowerCase())) &&
    (!filterStatus || p.status === filterStatus.toLowerCase() || p.status === filterStatus)
  );

  const statusBadge = (status: string) => {
    const cls = STATUS_BADGE[status] || STATUS_BADGE["Ativo"];
    return <span className={`text-[0.68rem] font-bold px-2 py-0.5 rounded-full ${cls}`}>{status}</span>;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Processos Cadastrados</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie e monitore processos via API DataJud CNJ</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={sincronizarTodos}
            disabled={syncingAll || processos.length === 0}
            className="flex items-center gap-1.5 bg-accent/15 border border-accent/40 rounded-md text-accent text-xs font-bold px-3 py-2 hover:bg-accent/25 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncingAll ? "animate-spin" : ""}`} />
            Sincronizar
          </button>
          <button
            onClick={gerarTodosResumos}
            disabled={loadingIA || processos.length === 0}
            className="flex items-center gap-1.5 bg-purple-500/10 border border-purple-400/40 rounded-md text-purple-600 text-xs font-bold px-3 py-2 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
          >
            <Sparkles className={`h-3.5 w-3.5 ${loadingIA ? "animate-pulse" : ""}`} />
            {loadingIA && progresso.total > 0 ? `Resumindo ${progresso.atual}/${progresso.total}…` : "✦ Resumir Todos"}
          </button>
          <Button variant="gold" onClick={() => { setEditId(null); setShowForm(true); }}>
            + Cadastrar Processo
          </Button>
        </div>
      </div>

      {/* LGPD Banner */}
      <div className="flex items-start gap-2.5 bg-blue-500/5 border border-blue-500/15 rounded-lg px-4 py-2.5 mb-5 text-xs text-muted-foreground">
        <span className="text-base shrink-0">🔒</span>
        <span><strong>LGPD & Sigilo Profissional:</strong> Consultas à API DataJud são públicas por natureza (Res. CNJ 331/2020). Dados armazenados no Supabase com criptografia em trânsito.</span>
      </div>

      {/* Card principal */}
      <div className="bg-card border border-border rounded-xl shadow-sm">
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
                  {["Número CNJ", "Tribunal", "Partes", "Advogado", "Última Mov.", "Status", "Ações"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const rico = p as ProcessoRico;
                  const movs = rico._movimentacoes || [];
                  const m = movs[0];
                  const isSyncing = syncing.has(p.id);
                  const djData = p.dados_datajud as any;
                  return (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-mono text-sm font-bold text-accent/90">{p.numero_cnj}</div>
                        {p._pendente && <span className="text-[0.6rem] bg-accent/10 text-accent px-1.5 py-0.5 rounded font-bold">pendente</span>}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[140px]">
                        {(rico.tribunalNome || p.tribunal || "—").split("—")[0].slice(0, 22)}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div>{rico.autor || djData?.autor || (p.partes?.split("×")[0]) || "—"}</div>
                        <div className="text-muted-foreground">× {rico.reu || djData?.reu || (p.partes?.split("×")[1]) || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{p.advogados || "—"}</td>
                      <td className="px-4 py-3">
                        {m ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[0.68rem] text-blue-600 font-semibold">{m.data}</span>
                            <span className="text-xs font-semibold text-foreground leading-tight max-w-[160px] line-clamp-2">{m.tipo}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">{p.ultima_movimentacao ? new Date(p.ultima_movimentacao + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {statusBadge(p.status === "ativo" ? "Ativo" : p.status === "arquivado" ? "Arquivado" : p.status || "Ativo")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button onClick={() => setPanelProcesso(rico)} title="Ver detalhes"
                            className="text-xs border border-border rounded px-2 py-1 hover:bg-muted transition-colors">📋</button>
                          <button onClick={() => abrirEdicao(rico)} title="Editar"
                            className="text-xs border border-border rounded px-2 py-1 hover:bg-muted transition-colors">✏️</button>
                          <button onClick={() => sincronizar(p.id, p.numero_cnj)} disabled={isSyncing} title="Sincronizar DataJud"
                            className="text-xs bg-accent/15 text-accent border border-accent/30 rounded px-2 py-1 hover:bg-accent/25 transition-colors disabled:opacity-40 font-bold">
                            {isSyncing ? "⏳" : "⟳"}
                          </button>
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
              <FG label="Observações Internas (sigilo profissional)">
                <textarea value={form.obs} onChange={e => setForm(f => ({ ...f, obs: e.target.value }))} placeholder="Notas do advogado — não compartilhadas com o cliente" className="field min-h-[70px]" />
              </FG>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={resetForm} className="btn-outline-sm">Cancelar</button>
              <Button variant="gold" onClick={handleSalvar} disabled={createProcesso.isPending || updateProcesso.isPending}>
                {editId ? "💾 Salvar Alterações" : "Cadastrar + Buscar na API"}
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
            onSincronizar={sincronizar}
            onResumoIA={gerarResumoUmProcesso}
            loadingIA={loadingIA}
            syncing={syncing}
            statusBadge={statusBadge}
          />
        )}
      </div>
    </div>
  );
}

// ── Painel de Detalhe ──────────────────────────────────────────────────────────
function DetailPanel({ processo, onClose, onDelete, onSincronizar, onResumoIA, loadingIA, syncing, statusBadge }: {
  processo: ProcessoRico;
  onClose: () => void;
  onDelete: (id: string) => void;
  onSincronizar: (id: string, numero: string) => void;
  onResumoIA: (processo: ProcessoRico) => void;
  loadingIA: boolean;
  syncing: Set<string>;
  statusBadge: (s: string) => React.ReactNode;
}) {
  const { data: movimentacoesDB = [] } = useMovimentacoes(processo.id);
  const isSyncing = syncing.has(processo.id);
  const movs = (processo._movimentacoes?.length ? processo._movimentacoes : movimentacoesDB) as any[];
  const djData = processo.dados_datajud as any;
  const partes = processo.partes?.split("×").map(s => s.trim()) || [];
  const autor = processo.autor || partes[0] || djData?.autor || "—";
  const reu   = processo.reu   || partes[1] || djData?.reu   || "—";

  return (
    <>
      <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10">
        <div>
          <div className="font-mono text-sm font-bold text-accent">{processo.numero_cnj}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{processo.tribunalNome || processo.tribunal || "—"}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSincronizar(processo.id, processo.numero_cnj)}
            disabled={isSyncing}
            className="flex items-center gap-1 text-xs bg-accent/15 text-accent border border-accent/30 rounded-md px-3 py-1.5 font-bold hover:bg-accent/25 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Sincronizando…" : "⟳ DataJud"}
          </button>
          <button
            onClick={() => onResumoIA(processo)}
            disabled={loadingIA}
            className="flex items-center gap-1 text-xs bg-purple-500/10 text-purple-600 border border-purple-400/30 rounded-md px-3 py-1.5 font-bold hover:bg-purple-500/20 transition-colors disabled:opacity-40"
          >
            <Sparkles className={`h-3 w-3 ${loadingIA ? "animate-pulse" : ""}`} />
            {loadingIA ? "Gerando…" : "✦ Resumo IA"}
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
              ["Órgão Julgador",  processo.orgaoJulgador || processo.vara],
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
                    ? statusBadge(processo.status === "ativo" ? "Ativo" : processo.status || "Ativo")
                    : (val as string) || "—"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Resumo IA */}
        <div>
          <div className="text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2 mb-3 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-purple-500" />
            Resumo IA das Movimentações
          </div>
          {processo.resumo_ia ? (
            <div className="bg-purple-500/5 border border-purple-400/20 rounded-lg p-4">
              <p className="text-sm leading-relaxed text-foreground">{processo.resumo_ia as string}</p>
              <button
                onClick={() => onResumoIA(processo)}
                disabled={loadingIA}
                className="mt-2 text-[0.68rem] text-purple-600 hover:underline disabled:opacity-50"
              >
                {loadingIA ? "Atualizando…" : "↻ Atualizar resumo"}
              </button>
            </div>
          ) : (
            <div className="border border-dashed border-purple-300/40 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">
                {movs.length > 0
                  ? "Clique para gerar um resumo inteligente das movimentações."
                  : "Sincronize com DataJud primeiro para gerar o resumo IA."}
              </p>
              <button
                onClick={() => onResumoIA(processo)}
                disabled={loadingIA || movs.length === 0}
                className="flex items-center gap-1.5 mx-auto text-xs bg-purple-500/10 text-purple-600 border border-purple-400/30 rounded-md px-3 py-1.5 font-bold hover:bg-purple-500/20 transition-colors disabled:opacity-40"
              >
                <Sparkles className="h-3 w-3" />
                {loadingIA ? "Gerando resumo…" : "✦ Gerar Resumo IA"}
              </button>
            </div>
          )}
        </div>

        {/* Movimentações */}
        <div>
          <div className="text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2 mb-3">
            Movimentações ({movs.length}) — Fonte: DataJud CNJ
          </div>
          {movs.length > 0 ? (
            <div className="relative pl-5">
              <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />
              <div className="space-y-4">
                {movs.map((m: any, i: number) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-5 top-1 w-3 h-3 rounded-full bg-accent border-2 border-card shadow" />
                    <div className="text-[0.65rem] font-bold text-blue-600 uppercase tracking-wider mb-0.5">{m.data || m.data_publicacao}</div>
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
                    {m.analise_ia && (
                      <div className="mt-1.5 bg-accent/5 border border-accent/20 rounded px-2.5 py-1.5">
                        <div className="text-[0.6rem] font-bold text-accent uppercase tracking-wider mb-0.5">✦ Resumo IA</div>
                        <div className="text-xs text-foreground">{m.analise_ia}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 border border-dashed border-border rounded-lg text-sm text-muted-foreground">
              Sem movimentações. Clique <strong>⟳ DataJud</strong> para sincronizar.
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
