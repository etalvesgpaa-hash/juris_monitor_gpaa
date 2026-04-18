import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import { RefreshCw, RotateCcw, TableIcon, LayoutGrid, Eye, CheckCircle, Pause, PlayCircle, Trash2, AlertCircle, X, FileText, Flag } from "lucide-react";

// ── Tipos ──────────────────────────────────────────────────────
interface AaspIntimacao {
  _id: string;
  _data: string;         // YYYY-MM-DD
  _lida: boolean;
  _status: "ativa" | "finalizada" | "pausada";
  _resumoIA?: string | null;
  _titulo?: string;
  _numProc?: string;
  _tarefaCriada?: boolean;
  _dataInclusao?: string;

  // Campos diretos da API AASP
  TituloAssunto?: string;
  Assunto?: string;
  NomeJornal?: string;
  nomeJornal?: string;
  DataDisponibilizacao?: string;
  dataDisponibilizacao?: string;
  Data?: string;
  Texto?: string;
  texto?: string;
  Conteudo?: string;
  conteudo?: string;
  textoPublicacao?: string;
  NumeroProcesso?: string;
  numeroProcesso?: string;
  Processo?: string;
  processo?: string;
  Partes?: string;
  partes?: string;
  OrgaoJulgador?: string;
  orgaoJulgador?: string;
  Meio?: string;
  meio?: string;
  numeroUnicoProcesso?: string;

  [key: string]: unknown;
}

// ── Helpers ────────────────────────────────────────────────────

/** Gera os últimos N dias úteis a partir de hoje */
function diasUteisRecentes(n: number): string[] {
  const dias: string[] = [];
  const d = new Date();
  while (dias.length < n) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) dias.push(d.toISOString().split("T")[0]);
    d.setDate(d.getDate() - 1);
  }
  return dias;
}

/** Extrai todos os números CNJ de um texto */
function extrairNumerosCNJ(texto: string): string[] {
  const regex = /\d{7}[-.]?\d{2}[-.]?\d{4}[-.]?\d{1}[-.]?\d{1,2}[-.]?\d{4,5}/g;
  return (texto.match(regex) || []).map((m) => m.replace(/\D/g, ""));
}

/** Gera ID determinístico para uma intimação */
function gerarId(intim: AaspIntimacao, idx = 0): string {
  const numProc =
    intim.NumeroProcesso || intim.numeroProcesso || intim.Processo || intim.processo || "";
  const data =
    intim.DataDisponibilizacao || intim.dataDisponibilizacao || intim.Data || intim.data || "";
  const titulo = intim.TituloAssunto || intim.Assunto || "";
  const jornal = (intim.NomeJornal || intim.nomeJornal || "") as string;
  const meio = (intim.Meio || intim.meio || "") as string;
  const texto = (intim.textoPublicacao || intim.Texto || intim.texto || "").slice(0, 120);
  const raw = `${numProc}|${String(data).slice(0, 10)}|${titulo}|${jornal}|${meio}|${idx}|${texto}`;
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) hash = ((hash << 5) + hash + raw.charCodeAt(i)) | 0;
  return "det_" + Math.abs(hash).toString(36);
}

/** Normaliza resposta da AASP em array */
function normalizar(raw: unknown): AaspIntimacao[] {
  if (Array.isArray(raw)) return raw as AaspIntimacao[];
  if (Array.isArray((raw as any)?.Intimacoes)) return (raw as any).Intimacoes;
  if (Array.isArray((raw as any)?.Data)) return (raw as any).Data;
  if (Array.isArray((raw as any)?.intimacoes)) return (raw as any).intimacoes;
  for (const v of Object.values(raw as object || {})) {
    if (Array.isArray(v)) return v as AaspIntimacao[];
  }
  return [];
}

/** Formata data YYYY-MM-DD → DD/MM/YYYY */
function fmtData(iso: string): string {
  const p = iso.slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

/** Extrai número CNJ mais relevante da intimação */
function extrairNumProc(intim: AaspIntimacao): string {
  const campos = [
    intim._numProc,
    intim.NumeroProcesso,
    intim.numeroProcesso,
    intim.Processo,
    intim.processo,
    intim.numeroUnicoProcesso,
    intim.Texto || intim.texto || intim.Conteudo || intim.conteudo || intim.textoPublicacao || "",
  ]
    .filter(Boolean)
    .join(" ");
  const nums = extrairNumerosCNJ(campos);
  if (nums.length === 0) return "";
  // Formata como CNJ: 0000000-00.0000.0.00.0000
  const n = nums[0];
  if (n.length === 20)
    return `${n.slice(0, 7)}-${n.slice(7, 9)}.${n.slice(9, 13)}.${n.slice(13, 14)}.${n.slice(14, 16)}.${n.slice(16)}`;
  return n;
}

// ── Persistência local ─────────────────────────────────────────
const STORE_KEY = "jm_aasp_intimacoes";

function loadStore(): AaspIntimacao[] {
  try {
    const s = localStorage.getItem(STORE_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

function saveStore(items: AaspIntimacao[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(items.slice(0, 500)));
}

// Função para gerar resumo com Groq
async function gerarResumoGroq(texto: string): Promise<string> {
  try {
    const groqKey = localStorage.getItem("jurismonitor_groq_key");
    if (!groqKey) return "";

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: "mixtral-8x7b-32768",
        messages: [
          {
            role: "user",
            content: `Faça um resumo conciso (máximo 3 frases) desta publicação jurídica:\n\n${texto.slice(0, 2000)}`
          }
        ],
        max_tokens: 200,
      }),
    });

    if (!response.ok) return "";
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (error) {
    console.error("Erro ao gerar resumo:", error);
    return "";
  }
}

// ── Componente ─────────────────────────────────────────────────
export function IntimacoesPage() {
  const { user } = useAuth();

  const [intimacoes, setIntimacoes] = useState<AaspIntimacao[]>(() => loadStore());
  const [aaspKey, setAaspKey] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingDia, setLoadingDia] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<"ativa" | "finalizada" | "pausada" | "todas">("ativa");
  const [filtroDia, setFiltroDia] = useState<string>("");
  const [viewMode, setViewMode] = useState<"tabela" | "cards">("tabela");
  const [selected, setSelected] = useState<AaspIntimacao | null>(null);
  const [ultimos7Dias, setUltimos7Dias] = useState<string[]>([]);
  const [gerandoResumosIds, setGerandoResumosIds] = useState<Set<string>>(new Set());

  // Carrega chave AASP do Supabase / localStorage
  useEffect(() => {
    const local = localStorage.getItem("jurismonitor_aasp_key") || "";
    if (local) { setAaspKey(local); return; }
    if (!user) return;
    supabase
      .from("api_keys")
      .select("aasp_chave")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const k = data?.aasp_chave || "";
        if (k) { localStorage.setItem("jurismonitor_aasp_key", k); setAaspKey(k); }
      })
      .catch(() => {});
  }, [user]);

  // Calcula últimos 7 dias úteis
  useEffect(() => {
    setUltimos7Dias(diasUteisRecentes(7));
  }, []);

  /** Busca intimações de um dia — tenta /api/proxy, corsproxy.io e allorigins */
  const buscarDia = useCallback(
    async (dataStr: string, silencioso = false): Promise<AaspIntimacao[]> => {
      if (!aaspKey) return [];

      const params   = new URLSearchParams({ chave: aaspKey, data: dataStr });
      const endpoint = `https://intimacaoapi.aasp.org.br/api/Associado/intimacao/json?${params}`;

      const proxies = [
        { nome: "backend",    url: `/api/proxy?url=${encodeURIComponent(endpoint)}` },
        { nome: "corsproxy",  url: `https://corsproxy.io/?url=${encodeURIComponent(endpoint)}` },
        { nome: "allorigins", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(endpoint)}` },
      ];

      for (const p of proxies) {
        try {
          const resp = await fetch(p.url, { headers: { Accept: "application/json" } });
          if (!resp.ok) {
            if (!silencioso) console.warn(`[AASP] ${dataStr} via ${p.nome}: HTTP ${resp.status}`);
            continue;
          }
          const text = await resp.text();
          if (!text.trim()) continue;

          let raw: unknown = null;
          try { raw = JSON.parse(text); } catch { /* ok */ }
          if (!raw) { try { const w: any = JSON.parse(text); if (w?.contents) raw = JSON.parse(w.contents); } catch { /* ok */ } }
          if (!raw) continue;

          return normalizar(raw).map((intim, idx) => {
            const existente = intimacoes.find(i => gerarId(intim, idx) === i._id);
            return {
              ...intim,
              _id:     gerarId(intim, idx),
              _data:   dataStr,
              _lida:   existente?._lida ?? false,
              _status: existente?._status ?? "ativa" as const,
              _resumoIA: existente?._resumoIA ?? null,
              _tarefaCriada: existente?._tarefaCriada ?? false,
              _dataInclusao: existente?._dataInclusao ?? new Date().toISOString().split("T")[0],
              _numProc: extrairNumProc(intim),
              _titulo:
                intim.TituloAssunto ||
                intim.Assunto ||
                (intim.Texto || intim.texto || "").slice(0, 80) ||
                "Publicação AASP",
            };
          });
        } catch (e) {
          if (!silencioso) console.error(`[AASP] ${dataStr} via ${p.nome}:`, e);
        }
      }
      return [];
    },
    [aaspKey, intimacoes]
  );

  /** Busca últimos 7 dias úteis */
  const buscarUltimos7Dias = useCallback(async () => {
    if (!aaspKey) {
      toast.error("Configure sua chave AASP nas Configurações.");
      return;
    }
    setLoading(true);
    try {
      const dias = diasUteisRecentes(7);
      const resultados: AaspIntimacao[] = [];
      for (const dia of dias) {
        setLoadingDia(dia);
        const intims = await buscarDia(dia, false);
        resultados.push(...intims);
      }
      setLoadingDia(null);
      
      // Mescla com existentes
      const merged = new Map<string, AaspIntimacao>();
      intimacoes.forEach(i => merged.set(i._id, i));
      resultados.forEach(i => merged.set(i._id, i));
      
      const novo = Array.from(merged.values());
      setIntimacoes(novo);
      saveStore(novo);
      
      const novasQtd = resultados.filter(r => !intimacoes.find(i => i._id === r._id)).length;
      toast.success(`Busca completa! ${novasQtd} novas intimações encontradas.`);
    } catch (error) {
      console.error("Erro na busca:", error);
      toast.error("Erro ao buscar intimações.");
    } finally {
      setLoading(false);
      setLoadingDia(null);
    }
  }, [aaspKey, buscarDia, intimacoes]);

  /** Atualiza status */
  const setStatus = (id: string, status: "ativa" | "finalizada" | "pausada") => {
    const novo = intimacoes.map(i =>
      i._id === id ? { ...i, _status: status } : i
    );
    setIntimacoes(novo);
    saveStore(novo);
    toast.success(`Intimação ${status}.`);
  };

  /** Exclui intimação */
  const excluir = (id: string) => {
    const novo = intimacoes.filter(i => i._id !== id);
    setIntimacoes(novo);
    saveStore(novo);
    toast.success("Intimação excluída.");
  };

  /** Gera resumo com IA Groq */
  const gerarResumo = async (id: string) => {
    const intim = intimacoes.find(i => i._id === id);
    if (!intim) return;

    const texto = (
      intim.textoPublicacao ||
      intim.Texto ||
      intim.texto ||
      intim.Conteudo ||
      intim.conteudo ||
      ""
    ) as string;

    if (!texto) {
      toast.error("Nenhum texto disponível para resumir.");
      return;
    }

    setGerandoResumosIds(prev => new Set(prev).add(id));
    try {
      const resumo = await gerarResumoGroq(texto);
      if (resumo) {
        const novo = intimacoes.map(i =>
          i._id === id ? { ...i, _resumoIA: resumo } : i
        );
        setIntimacoes(novo);
        saveStore(novo);
        if (selected?._id === id) {
          setSelected({ ...selected, _resumoIA: resumo });
        }
        toast.success("Resumo gerado com sucesso!");
      } else {
        toast.error("Falha ao gerar resumo.");
      }
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao gerar resumo.");
    } finally {
      setGerandoResumosIds(prev => {
        const novo = new Set(prev);
        novo.delete(id);
        return novo;
      });
    }
  };

  /** Cria tarefa para esta intimação */
  const criarTarefa = async (id: string) => {
    const intim = intimacoes.find(i => i._id === id);
    if (!intim) return;

    try {
      const { error } = await supabase.from("tarefas").insert({
        user_id: user?.id,
        titulo: `Intimação: ${intim._titulo || intim._numProc || "Publicação"}`,
        descricao: `Processo: ${intim._numProc || "N/A"}\nData: ${fmtData(intim._data)}\nStatus: ${intim._status}`,
        status: intim._status === "ativa" ? "pendente" : intim._status === "pausada" ? "pausado" : "concluido",
        prioridade: intim._status === "ativa" ? "alta" : "normal",
        data_vencimento: new Date(intim._data).toISOString().split("T")[0],
      });

      if (error) throw error;

      const novo = intimacoes.map(i =>
        i._id === id ? { ...i, _tarefaCriada: true } : i
      );
      setIntimacoes(novo);
      saveStore(novo);
      toast.success("Tarefa criada com sucesso!");
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao criar tarefa.");
    }
  };

  // Filtra intimações
  const filtradas = useMemo(() => {
    return intimacoes.filter(i => {
      if (filtroStatus !== "todas" && i._status !== filtroStatus) return false;
      if (filtroDia && i._data !== filtroDia) return false;
      return true;
    });
  }, [intimacoes, filtroStatus, filtroDia]);

  // Calcula métricas
  const metricas = useMemo(() => {
    const ativas = intimacoes.filter(i => i._status === "ativa").length;
    const finalizadas = intimacoes.filter(i => i._status === "finalizada").length;
    const pausadas = intimacoes.filter(i => i._status === "pausada").length;
    const total = intimacoes.length;
    const novas = intimacoes.filter(i => !i._lida).length;
    return { ativas, finalizadas, pausadas, total, novas };
  }, [intimacoes]);

  // Render linha da tabela
  function renderLinha(intim: AaspIntimacao) {
    const jornal = (intim.NomeJornal || intim.nomeJornal || "") as string;
    const partes = (intim.Partes || intim.partes || "") as string;
    const orgao = (intim.OrgaoJulgador || intim.orgaoJulgador || "") as string;

    return (
      <tr key={intim._id} className="border-b border-border hover:bg-muted/30 transition-colors">
        <td className="px-3 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
          {fmtData(intim._data)}
        </td>
        <td className="px-3 py-3 text-xs font-mono text-foreground cursor-pointer hover:text-accent" onClick={() => setSelected(intim)}>
          {intim._numProc || "—"}
        </td>
        <td className="px-3 py-3 text-xs text-foreground max-w-xs truncate">
          {intim._titulo || intim.Assunto || "—"}
        </td>
        <td className="px-3 py-3 text-xs text-muted-foreground max-w-xs truncate">
          {jornal || intim.Meio || "—"}
        </td>
        <td className="px-3 py-3 text-xs text-muted-foreground max-w-xs truncate">
          {partes ? partes.split(";")[0].trim() : "—"}
        </td>
        <td className="px-3 py-3">
          <StatusBadge status={intim._status} nova={!intim._lida} />
        </td>
        <td className="px-3 py-3 flex gap-1">
          <ActionBtn
            title="Ver detalhes"
            onClick={() => setSelected(intim)}
          >
            <Eye className="h-4 w-4 text-accent" />
          </ActionBtn>
          {intim._status === "ativa" && (
            <ActionBtn
              title="Finalizar"
              onClick={() => setStatus(intim._id, "finalizada")}
            >
              <CheckCircle className="h-4 w-4 text-green-ok" />
            </ActionBtn>
          )}
          {intim._status !== "pausada" && (
            <ActionBtn
              title="Pausar"
              onClick={() => setStatus(intim._id, "pausada")}
            >
              <Pause className="h-4 w-4 text-yellow-600" />
            </ActionBtn>
          )}
          <ActionBtn
            title="Excluir"
            onClick={() => excluir(intim._id)}
            className="text-red-500 hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" />
          </ActionBtn>
        </td>
      </tr>
    );
  }

  // Render card
  function renderCard(intim: AaspIntimacao) {
    const jornal = (intim.NomeJornal || intim.nomeJornal || "") as string;
    return (
      <div key={intim._id} className="bg-card border border-border rounded-xl p-4 hover:border-accent/50 transition-colors">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="text-xs text-muted-foreground mb-1">{fmtData(intim._data)}</div>
            <div className="font-bold text-sm line-clamp-2">{intim._titulo || "Publicação"}</div>
          </div>
          <StatusBadge status={intim._status} nova={!intim._lida} />
        </div>
        {intim._numProc && <div className="text-xs font-mono text-accent mb-2">{intim._numProc}</div>}
        {jornal && <div className="text-xs text-muted-foreground mb-3">{jornal}</div>}
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="ghost" onClick={() => setSelected(intim)}>
            <Eye className="h-3 w-3 mr-1" /> Ver
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setStatus(intim._id, intim._status === "ativa" ? "finalizada" : "ativa")}>
            <CheckCircle className="h-3 w-3 mr-1" /> Status
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-1">Intimações AASP</h1>
        <p className="text-sm text-muted-foreground">Publicações do Diário de Justiça Eletrônico — atualizadas automaticamente</p>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Ativas" value={metricas.ativas} highlight={metricas.ativas > 0} />
        <StatCard label="Finalizadas" value={metricas.finalizadas} />
        <StatCard label="Pausadas" value={metricas.pausadas} />
        <StatCard label="30 ativas · 30 não lidas" value={metricas.total} highlight color="bg-yellow-500/15 text-yellow-600" />
        <StatCard label="Última semana" value={ultimos7Dias.length} color="bg-blue-500/15 text-blue-600" />
      </div>

      {/* Controles */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Tabs de Status */}
        <div className="flex gap-2 border border-border rounded-lg p-1 bg-muted/20">
          {["ativa", "finalizada", "pausada", "todas"].map((status) => (
            <button
              key={status}
              onClick={() => setFiltroStatus(status as any)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                filtroStatus === status
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {status === "ativa" ? "Ativas" : status === "finalizada" ? "Finalizadas" : status === "pausada" ? "Pausadas" : "Todas"}
            </button>
          ))}
        </div>

        {/* Filtro por dia */}
        <Select value={filtroDia} onValueChange={setFiltroDia}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Últimos 7 dias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os dias</SelectItem>
            {ultimos7Dias.map((dia) => (
              <SelectItem key={dia} value={dia}>
                {fmtData(dia)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View Mode */}
        <Button
          size="sm"
          variant={viewMode === "tabela" ? "default" : "outline"}
          onClick={() => setViewMode("tabela")}
        >
          <TableIcon className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={viewMode === "cards" ? "default" : "outline"}
          onClick={() => setViewMode("cards")}
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>

        <div className="flex-1" />

        {/* Botões de ação */}
        <Button
          size="sm"
          onClick={buscarUltimos7Dias}
          disabled={loading || !aaspKey}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
        <Button size="sm" variant="outline" onClick={() => {
          setIntimacoes([]);
          saveStore([]);
          toast.success("Historico limpo!");
        }}>
          <RotateCcw className="h-4 w-4 mr-1" />
          Limpar
        </Button>
      </div>

      {/* Status de carregamento */}
      {loading && loadingDia && (
        <div className="flex items-center gap-2 text-sm text-accent">
          <div className="animate-spin"><RefreshCw className="h-4 w-4" /></div>
          <span>Buscando publicações de {fmtData(loadingDia)}...</span>
        </div>
      )}

      {/* Lista */}
      {filtradas.length === 0 && !loading ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-base font-medium">Nenhuma intimação encontrada.</p>
          <p className="text-sm mt-1">
            {aaspKey ? 'Clique em "Atualizar" para buscar as publicações.' : 'Configure sua chave AASP nas Configurações.'}
          </p>
        </div>
      ) : viewMode === "tabela" ? (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  {["DATA", "PROCESSO", "TIPO / ÓRGÃO", "PUBLICAÇÃO", "PARTES", "STATUS", "AÇÕES"].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>{filtradas.map(renderLinha)}</tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtradas.map(renderCard)}
        </div>
      )}

      {/* Modal de Detalhe */}
      {selected && (
        <ModalDetalhe
          intim={selected}
          onClose={() => setSelected(null)}
          onSetStatus={setStatus}
          onExcluir={excluir}
          onGerarResumo={() => gerarResumo(selected._id)}
          onCriarTarefa={() => criarTarefa(selected._id)}
          gerandoResumo={gerandoResumosIds.has(selected._id)}
          onUpdate={(updated) => {
            setSelected(updated);
            const novo = intimacoes.map(i => i._id === updated._id ? updated : i);
            setIntimacoes(novo);
            saveStore(novo);
          }}
        />
      )}
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────

function StatCard({ 
  label, 
  value, 
  highlight = false,
  color = "bg-accent/10 text-accent"
}: { 
  label: string; 
  value: number | string;
  highlight?: boolean;
  color?: string;
}) {
  return (
    <div className={`p-3 rounded-lg border border-border ${highlight ? color : "bg-muted/20"}`}>
      <div className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <div className={`text-2xl font-bold ${highlight ? "" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status, nova }: { status: string; nova: boolean }) {
  if (status === "finalizada") return <Badge className="bg-green-ok/10 text-green-ok text-[0.65rem]">Finalizada</Badge>;
  if (status === "pausada") return <Badge variant="outline" className="text-[0.65rem]">Pausada</Badge>;
  if (nova) return <Badge className="bg-accent/15 text-accent text-[0.65rem] font-bold">Nova</Badge>;
  return <Badge className="bg-muted text-muted-foreground text-[0.65rem]">Ativa</Badge>;
}

function ActionBtn({
  title,
  onClick,
  children,
  className = "",
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`p-1 rounded hover:bg-muted transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

function ModalDetalhe({
  intim,
  onClose,
  onSetStatus,
  onExcluir,
  onGerarResumo,
  onCriarTarefa,
  gerandoResumo,
  onUpdate,
}: {
  intim: AaspIntimacao;
  onClose: () => void;
  onSetStatus: (id: string, s: AaspIntimacao["_status"]) => void;
  onExcluir: (id: string) => void;
  onGerarResumo: () => void;
  onCriarTarefa: () => void;
  gerandoResumo: boolean;
  onUpdate: (updated: AaspIntimacao) => void;
}) {
  const titulo =
    intim._titulo ||
    intim.TituloAssunto ||
    intim.Assunto ||
    "Publicação AASP";

  const jornal = (intim.NomeJornal || intim.nomeJornal || "") as string;
  const orgao = (intim.OrgaoJulgador || intim.orgaoJulgador || "") as string;
  const partes = (intim.Partes || intim.partes || "") as string;
  const meio = (intim.Meio || intim.meio || jornal) as string;
  const texto = (
    intim.textoPublicacao ||
    intim.Texto ||
    intim.texto ||
    intim.Conteudo ||
    intim.conteudo ||
    ""
  ) as string;
  const dataFmt = fmtData(intim._data);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(13,42,30,0.78)", backdropFilter: "blur(5px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-border">
          <div className="flex-1 pr-4">
            <div className="text-[0.65rem] font-bold tracking-[0.12em] uppercase text-accent mb-2">
              📋 Publicação AASP
            </div>
            <h2 className="font-display text-lg font-bold text-foreground leading-snug">
              {titulo}
              {intim._numProc ? ` — ${intim._numProc}` : ""}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center flex-shrink-0 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Badges de meta */}
        <div className="px-6 pt-4 pb-0 flex flex-wrap gap-2">
          {meio && (
            <span className="text-xs bg-muted/60 border border-border px-3 py-1 rounded-full font-medium">
              {meio}
            </span>
          )}
          <span className="text-xs bg-muted/60 border border-border px-3 py-1 rounded-full font-medium">
            📅 {dataFmt}
          </span>
          {jornal && jornal !== meio && (
            <span className="text-xs bg-muted/60 border border-border px-3 py-1 rounded-full font-medium">
              {jornal}
            </span>
          )}
        </div>

        {/* Corpo */}
        <div className="p-6 space-y-4">
          {/* Órgão e Partes */}
          {orgao && (
            <p className="text-sm text-foreground">
              📍 <strong>{orgao}</strong>
            </p>
          )}
          {partes && (
            <p className="text-sm text-muted-foreground">
              👤 <strong>Partes:</strong> {partes}
            </p>
          )}

          {/* Análise IA */}
          {intim._resumoIA && (
            <div className="bg-accent/5 border-l-2 border-accent/60 rounded-r-xl p-4">
              <div className="text-[0.65rem] font-black uppercase tracking-widest text-accent mb-2">
                ✦ Análise IA (Resumo)
              </div>
              <p className="text-sm text-foreground leading-relaxed">{intim._resumoIA}</p>
            </div>
          )}

          {/* Botão de gerar resumo */}
          {!intim._resumoIA && texto && (
            <Button 
              size="sm" 
              onClick={onGerarResumo}
              disabled={gerandoResumo}
              className="gap-2"
            >
              {gerandoResumo ? "Gerando..." : "Gerar Resumo com IA"}
            </Button>
          )}

          {/* Texto da publicação */}
          {texto && (
            <>
              <div className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">
                Texto da Publicação
              </div>
              <div className="bg-muted/30 border border-border rounded-xl p-4 text-sm text-foreground leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap">
                {texto}
              </div>
            </>
          )}

          {/* Campos extras da API (para diagnóstico) */}
          {!texto && !partes && !orgao && (
            <div className="text-sm text-muted-foreground italic">
              Nenhum conteúdo textual disponível nesta publicação.
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="px-6 pb-6 flex flex-wrap gap-2 border-t border-border pt-4">
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
          
          {/* Status Actions */}
          {(intim._status || "ativa") === "ativa" ? (
            <Button 
              variant="outline" 
              size="sm" 
              className="text-green-ok border-green-ok/30"
              onClick={() => { onSetStatus(intim._id, "finalizada"); onClose(); }}
            >
              <CheckCircle className="h-4 w-4 mr-1.5" /> Finalizar
            </Button>
          ) : (
            <Button 
              variant="outline" 
              size="sm" 
              className="text-accent border-accent/30"
              onClick={() => { onSetStatus(intim._id, "ativa"); onClose(); }}
            >
              <PlayCircle className="h-4 w-4 mr-1.5" /> Reativar
            </Button>
          )}

          {intim._status !== "pausada" && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => { onSetStatus(intim._id, "pausada"); onClose(); }}
            >
              <Pause className="h-4 w-4 mr-1.5" /> Pausar
            </Button>
          )}

          {/* Visualizar Publicação */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              const link = `https://intimacaoapi.aasp.org.br/api/Associado/intimacao/json?chave=${localStorage.getItem("jurismonitor_aasp_key")}&data=${intim._data}`;
              window.open(link, "_blank");
            }}
          >
            <FileText className="h-4 w-4 mr-1.5" /> Ver Publicação
          </Button>

          {/* Criar Tarefa */}
          <Button 
            variant="outline" 
            size="sm"
            disabled={intim._tarefaCriada}
            onClick={() => { onCriarTarefa(); onClose(); }}
          >
            <Flag className="h-4 w-4 mr-1.5" /> {intim._tarefaCriada ? "Tarefa criada" : "Criar Tarefa"}
          </Button>

          {/* Excluir */}
          <Button 
            variant="destructive" 
            size="sm"
            onClick={() => { onExcluir(intim._id); onClose(); }}
          >
            <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
          </Button>
        </div>
      </div>
    </div>
  );
}
