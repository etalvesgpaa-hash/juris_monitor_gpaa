import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  RefreshCw,
  RotateCcw,
  TableIcon,
  LayoutGrid,
  Eye,
  CheckCircle,
  Pause,
  PlayCircle,
  Trash2,
  X,
  ChevronDown,
  Loader2,
  AlertCircle,
} from "lucide-react";

// ── Tipos ──────────────────────────────────────────────────────
interface AaspIntimacao {
  _id: string;
  _data: string;         // YYYY-MM-DD
  _lida: boolean;
  _status: "ativa" | "finalizada" | "pausada";
  _resumoIA?: string | null;
  _titulo?: string;
  _numProc?: string;

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

// ── Componente ─────────────────────────────────────────────────
export function IntimacoesPage() {
  const { user } = useAuth();

  const [intimacoes, setIntimacoes] = useState<AaspIntimacao[]>(() => loadStore());
  const [aaspKey, setAaspKey] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingDia, setLoadingDia] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<"ativa" | "finalizada" | "pausada">("ativa");
  const [filtroDia, setFiltroDia] = useState<string>("");
  const [viewMode, setViewMode] = useState<"tabela" | "cards">("tabela");
  const [selected, setSelected] = useState<AaspIntimacao | null>(null);

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

  /** Busca intimações de um dia específico via proxy */
  const buscarDia = useCallback(
    async (dataStr: string, silencioso = false): Promise<AaspIntimacao[]> => {
      if (!aaspKey) return [];
      const aaspUrl =
        `https://intimacaoapi.aasp.org.br/api/Associado/intimacao/json` +
        `?chave=${encodeURIComponent(aaspKey)}&data=${dataStr}`;
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(aaspUrl)}`;

      const resp = await fetch(proxyUrl, { headers: { Accept: "application/json" } });
      if (!resp.ok) {
        // 500 = dia sem publicação (comportamento normal da AASP)
        if (!silencioso) console.warn(`[AASP] ${dataStr}: HTTP ${resp.status}`);
        return [];
      }
      const text = await resp.text();
      if (!text.trim()) return [];
      try {
        const raw = JSON.parse(text);
        return normalizar(raw).map((intim, idx) => ({
          ...intim,
          _id: gerarId(intim, idx),
          _data: dataStr,
          _lida: false,
          _status: "ativa" as const,
          _resumoIA: null,
          _numProc: extrairNumProc(intim),
          _titulo:
            intim.TituloAssunto ||
            intim.Assunto ||
            (intim.Texto || intim.texto || "").slice(0, 80) ||
            "Publicação AASP",
        }));
      } catch {
        return [];
      }
    },
    [aaspKey]
  );

  /** Busca os últimos 7 dias úteis e mescla com store */
  const buscarTudo = useCallback(async () => {
    if (!aaspKey) {
      toast.error("Configure a chave AASP em Configurações primeiro.");
      return;
    }
    setLoading(true);
    try {
      const dias = diasUteisRecentes(7);
      const existentes = loadStore();
      const existentesIds = new Set(existentes.map((i) => i._id));
      let novas = 0;
      const novasLista: AaspIntimacao[] = [];

      for (const dia of dias) {
        const lista = await buscarDia(dia, true);
        for (const item of lista) {
          if (!existentesIds.has(item._id)) {
            novasLista.push(item);
            novas++;
          }
        }
        await new Promise((r) => setTimeout(r, 300));
      }

      const merged = [...novasLista, ...existentes]
        .sort((a, b) => (b._data > a._data ? 1 : -1))
        .slice(0, 500);

      saveStore(merged);
      setIntimacoes(merged);
      toast.success(novas > 0 ? `✅ ${novas} nova(s) intimação(ões) carregada(s)!` : "Nenhuma intimação nova nos últimos 7 dias úteis.");
    } catch (e: any) {
      toast.error("Erro ao buscar intimações: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [aaspKey, buscarDia]);

  /** Busca dia específico */
  const buscarDiaEspecifico = useCallback(
    async (dataStr: string) => {
      if (!aaspKey) { toast.error("Configure a chave AASP."); return; }
      setLoadingDia(dataStr);
      try {
        const lista = await buscarDia(dataStr);
        if (!lista.length) { toast.info(`Nenhuma publicação para ${fmtData(dataStr)}.`); return; }
        const existentes = loadStore();
        const existentesIds = new Set(existentes.map((i) => i._id));
        const novas = lista.filter((i) => !existentesIds.has(i._id));
        const merged = [...novas, ...existentes].sort((a, b) => (b._data > a._data ? 1 : -1)).slice(0, 500);
        saveStore(merged);
        setIntimacoes(merged);
        toast.success(`✅ ${lista.length} publicação(ões) de ${fmtData(dataStr)} carregada(s)!`);
      } catch (e: any) {
        toast.error("Erro: " + e.message);
      } finally {
        setLoadingDia(null);
      }
    },
    [aaspKey, buscarDia]
  );

  // Auto-busca na primeira carga se tiver chave e store vazio
  useEffect(() => {
    if (aaspKey && intimacoes.length === 0) buscarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aaspKey]);

  /** Altera status de uma intimação */
  const setStatus = (id: string, status: AaspIntimacao["_status"]) => {
    setIntimacoes((prev) => {
      const next = prev.map((i) =>
        i._id === id ? { ...i, _status: status, _lida: status !== "ativa" ? true : i._lida } : i
      );
      saveStore(next);
      return next;
    });
    if (selected?._id === id) setSelected((s) => s ? { ...s, _status: status } : s);
  };

  /** Exclui uma intimação */
  const excluir = (id: string) => {
    if (!confirm("Excluir esta intimação?")) return;
    setIntimacoes((prev) => {
      const next = prev.filter((i) => i._id !== id);
      saveStore(next);
      return next;
    });
    if (selected?._id === id) setSelected(null);
    toast.success("Intimação excluída.");
  };

  /** Marcar como lida */
  const marcarLida = (id: string) => {
    setIntimacoes((prev) => {
      const next = prev.map((i) => (i._id === id ? { ...i, _lida: true } : i));
      saveStore(next);
      return next;
    });
  };

  // ── Filtragem ──────────────────────────────────────────────
  const filtradas = intimacoes.filter((i) => {
    const statusOk = (i._status || "ativa") === filtroStatus;
    const diaOk = !filtroDia || i._data === filtroDia;
    return statusOk && diaOk;
  });

  const totalAtivas = intimacoes.filter((i) => (i._status || "ativa") === "ativa").length;
  const naoLidas = intimacoes.filter((i) => (i._status || "ativa") === "ativa" && !i._lida).length;

  // Dropdown de dias
  const diasDisponiveis = diasUteisRecentes(7);
  const contagemPorDia: Record<string, number> = {};
  for (const i of intimacoes) if (i._data) contagemPorDia[i._data] = (contagemPorDia[i._data] || 0) + 1;

  const totalFiltro = filtradas.length;
  const labelFiltro = filtroDia
    ? `${fmtData(filtroDia)} (${totalFiltro})`
    : `Todos os dias (${totalFiltro})`;

  // ── Renderização de linha/card ─────────────────────────────
  const renderLinha = (intim: AaspIntimacao) => {
    const naoLida = (intim._status || "ativa") === "ativa" && !intim._lida;
    const jornal = (intim.NomeJornal || intim.nomeJornal || "") as string;
    const orgao = (intim.OrgaoJulgador || intim.orgaoJulgador || intim.Texto || intim.texto || "").slice(0, 60) as string;
    const partes = (intim.Partes || intim.partes || "") as string;
    const meio = (intim.Meio || intim.meio || jornal || "") as string;

    return (
      <tr
        key={intim._id}
        className="border-b border-border/50 hover:bg-muted/20 transition-colors"
      >
        {/* DATA */}
        <td className="px-3 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            {naoLida && (
              <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0 inline-block" />
            )}
            {fmtData(intim._data).slice(0, 8)}…
          </div>
        </td>

        {/* PROCESSO */}
        <td className="px-3 py-3">
          {intim._numProc ? (
            <button
              onClick={() => { marcarLida(intim._id); setSelected(intim); }}
              className="font-mono text-xs font-bold text-accent hover:underline text-left"
            >
              {intim._numProc.slice(0, 30)}…
            </button>
          ) : (
            <button
              onClick={() => { marcarLida(intim._id); setSelected(intim); }}
              className="text-xs text-muted-foreground hover:text-accent transition-colors"
            >
              Ver publicação
            </button>
          )}
        </td>

        {/* TIPO / ÓRGÃO */}
        <td className="px-3 py-3">
          <div className="text-xs font-semibold text-foreground max-w-[220px] truncate">
            {intim._titulo}
          </div>
          <div className="text-xs text-muted-foreground max-w-[220px] truncate mt-0.5">
            {orgao}
          </div>
        </td>

        {/* PUBLICAÇÃO */}
        <td className="px-3 py-3">
          <div className="text-xs font-semibold">{meio || jornal || "—"}</div>
          <div className="text-xs text-muted-foreground">Diário de Justiça</div>
        </td>

        {/* PARTES */}
        <td className="px-3 py-3 text-xs text-muted-foreground max-w-[150px] truncate">
          {partes.slice(0, 40) || "—"}
        </td>

        {/* STATUS */}
        <td className="px-3 py-3">
          <StatusBadge status={intim._status || "ativa"} nova={naoLida} />
        </td>

        {/* AÇÕES */}
        <td className="px-3 py-3">
          <div className="flex flex-col gap-1">
            <div className="flex gap-1">
              <ActionBtn title="Visualizar" onClick={() => { marcarLida(intim._id); setSelected(intim); }}>
                <Eye className="h-3.5 w-3.5" />
              </ActionBtn>
              {(intim._status || "ativa") === "ativa" ? (
                <ActionBtn title="Finalizar" onClick={() => setStatus(intim._id, "finalizada")} className="text-green-ok">
                  <CheckCircle className="h-3.5 w-3.5" />
                </ActionBtn>
              ) : (
                <ActionBtn title="Reativar" onClick={() => setStatus(intim._id, "ativa")} className="text-accent">
                  <PlayCircle className="h-3.5 w-3.5" />
                </ActionBtn>
              )}
            </div>
            <div className="flex gap-1">
              <ActionBtn title="Pausar" onClick={() => setStatus(intim._id, "pausada")} className="text-muted-foreground">
                <Pause className="h-3.5 w-3.5" />
              </ActionBtn>
              <ActionBtn title="Excluir" onClick={() => excluir(intim._id)} className="text-red-alert">
                <Trash2 className="h-3.5 w-3.5" />
              </ActionBtn>
            </div>
          </div>
        </td>
      </tr>
    );
  };

  const renderCard = (intim: AaspIntimacao) => {
    const naoLida = (intim._status || "ativa") === "ativa" && !intim._lida;
    const jornal = (intim.NomeJornal || intim.nomeJornal || "") as string;
    const orgao = (intim.OrgaoJulgador || intim.orgaoJulgador || "") as string;
    return (
      <div
        key={intim._id}
        className="bg-card border border-border rounded-xl p-4 hover:border-accent/40 transition-colors cursor-pointer"
        onClick={() => { marcarLida(intim._id); setSelected(intim); }}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              {naoLida && <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />}
              <span className="text-xs text-muted-foreground font-mono">{fmtData(intim._data)}</span>
            </div>
            {intim._numProc && (
              <div className="font-mono text-sm font-bold text-accent truncate">{intim._numProc}</div>
            )}
            <div className="text-sm font-semibold truncate mt-0.5">{intim._titulo}</div>
            {orgao && <div className="text-xs text-muted-foreground truncate">{orgao}</div>}
          </div>
          <StatusBadge status={intim._status || "ativa"} nova={naoLida} />
        </div>
        {intim._resumoIA && (
          <div className="mt-2 text-xs text-muted-foreground bg-muted/40 rounded-lg p-2 border-l-2 border-accent/40 leading-relaxed">
            {intim._resumoIA}
          </div>
        )}
        <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
          {(intim._status || "ativa") === "ativa" ? (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setStatus(intim._id, "finalizada")}>
              <CheckCircle className="h-3 w-3 mr-1" /> Finalizar
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setStatus(intim._id, "ativa")}>
              <PlayCircle className="h-3 w-3 mr-1" /> Reativar
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setStatus(intim._id, "pausada")}>
            <Pause className="h-3 w-3 mr-1" /> Pausar
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs text-red-alert" onClick={() => excluir(intim._id)}>
            <Trash2 className="h-3 w-3 mr-1" /> Excluir
          </Button>
        </div>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h1 className="font-display text-3xl font-bold tracking-tight">Intimações AASP</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Publicações do Diário de Justiça Eletrônico — atualizadas automaticamente
        </p>
      </div>

      {!aaspKey && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm text-amber-800">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          Configure sua chave AASP em <strong>Configurações → API Keys</strong> para carregar as publicações.
        </div>
      )}

      {/* Barra de controles */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Filtros de status */}
        <Button
          size="sm"
          variant={filtroStatus === "ativa" ? "gold" : "outline"}
          className="h-8 text-xs"
          onClick={() => setFiltroStatus("ativa")}
        >
          Ativas
        </Button>
        <Button
          size="sm"
          variant={filtroStatus === "finalizada" ? "default" : "outline"}
          className="h-8 text-xs"
          onClick={() => setFiltroStatus("finalizada")}
        >
          Finalizadas
        </Button>
        <Button
          size="sm"
          variant={filtroStatus === "pausada" ? "default" : "outline"}
          className="h-8 text-xs"
          onClick={() => setFiltroStatus("pausada")}
        >
          Pausadas
        </Button>

        {/* Badge contagem */}
        <span className="text-xs px-3 py-1 rounded-full bg-accent/10 text-accent font-semibold">
          {totalAtivas} ativa{totalAtivas !== 1 ? "s" : ""} · {naoLidas} não lida{naoLidas !== 1 ? "s" : ""}
        </span>

        {/* Dropdown de dia */}
        <div className="relative">
          <Select
            value={filtroDia || "__todos__"}
            onValueChange={(v) => {
              if (v === "__todos__") { setFiltroDia(""); return; }
              setFiltroDia(v);
            }}
          >
            <SelectTrigger className="h-8 text-xs w-52">
              <SelectValue>{labelFiltro}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__todos__">
                Todos os dias ({intimacoes.filter((i) => (i._status || "ativa") === filtroStatus).length})
              </SelectItem>
              {diasDisponiveis.map((d) => (
                <SelectItem key={d} value={d}>
                  {fmtData(d)} {contagemPorDia[d] ? `(${contagemPorDia[d]})` : "— sem dados"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Botão atualizar dia específico */}
        {filtroDia && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={!!loadingDia}
            onClick={() => buscarDiaEspecifico(filtroDia)}
          >
            {loadingDia === filtroDia ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            Atualizar
          </Button>
        )}

        {/* Botão atualizar todos */}
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={loading}
          onClick={buscarTudo}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          )}
          {loading ? "Buscando…" : "Atualizar"}
        </Button>

        {/* Rebuscar 7 dias */}
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={loading}
          onClick={buscarTudo}
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Rebuscar
        </Button>

        {/* Toggle Tabela / Cards */}
        <div className="ml-auto flex gap-1">
          <Button
            size="sm"
            variant={viewMode === "tabela" ? "default" : "outline"}
            className="h-8 px-3"
            onClick={() => setViewMode("tabela")}
            title="Tabela"
          >
            <TableIcon className="h-3.5 w-3.5 mr-1" /> Tabela
          </Button>
          <Button
            size="sm"
            variant={viewMode === "cards" ? "default" : "outline"}
            className="h-8 px-3"
            onClick={() => setViewMode("cards")}
            title="Cards"
          >
            <LayoutGrid className="h-3.5 w-3.5 mr-1" /> Cards
          </Button>
        </div>
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-accent" />
          <p className="text-muted-foreground text-sm">Buscando publicações dos últimos 7 dias úteis…</p>
        </div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-base font-medium">Nenhuma intimação encontrada.</p>
          <p className="text-sm mt-1">
            {aaspKey ? "Clique em "Atualizar" para buscar as publicações." : "Configure sua chave AASP nas Configurações."}
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
        />
      )}
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────

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
}: {
  intim: AaspIntimacao;
  onClose: () => void;
  onSetStatus: (id: string, s: AaspIntimacao["_status"]) => void;
  onExcluir: (id: string) => void;
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
                ✦ Análise IA
              </div>
              <p className="text-sm text-foreground leading-relaxed">{intim._resumoIA}</p>
            </div>
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
          {(intim._status || "ativa") === "ativa" ? (
            <Button variant="outline" size="sm" className="text-green-ok border-green-ok/30"
              onClick={() => { onSetStatus(intim._id, "finalizada"); onClose(); }}>
              <CheckCircle className="h-4 w-4 mr-1.5" /> Finalizar
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="text-accent border-accent/30"
              onClick={() => { onSetStatus(intim._id, "ativa"); onClose(); }}>
              <PlayCircle className="h-4 w-4 mr-1.5" /> Reativar
            </Button>
          )}
          <Button variant="outline" size="sm"
            onClick={() => { onSetStatus(intim._id, "pausada"); onClose(); }}>
            <Pause className="h-4 w-4 mr-1.5" /> Pausar
          </Button>
          <Button variant="destructive" size="sm"
            onClick={() => { onExcluir(intim._id); onClose(); }}>
            <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
          </Button>
        </div>
      </div>
    </div>
  );
}
