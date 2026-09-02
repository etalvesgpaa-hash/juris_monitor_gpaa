import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGroqIA } from "@/hooks/useGroqIA";
import { useClientes, useCreateCliente } from "@/hooks/useClientes";
import { useCreateTarefa } from "@/hooks/useTarefas";
import { useFeriados } from "@/hooks/useFeriados";
import { useProcessos } from "@/hooks/useProcessos";
import { CreateTaskModal } from "@/components/CreateTaskModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue} from "@/components/ui/select";
import { toast } from "sonner";
import { RefreshCw, RotateCcw, TableIcon, LayoutGrid, Eye, CheckCircle, Pause, PlayCircle, Trash2, AlertCircle, Loader2, X, FileText, Flag, Plus, Sparkles, UserPlus, Mail, UserCheck } from "lucide-react";

// ── Tipos ──────────────────────────────────────────────────────
interface AaspIntimacao {
  _id: string;
  _data: string;         // YYYY-MM-DD
  _lida: boolean;
  _status: "ativa" | "finalizada" | "pausada";
  _resumoIA?: string | null;
  _titulo?: string;
  _numProc?: string;
  _orgaoPublicacao?: string; // órgão de publicação (DJENTJSP, etc)
  _partes?: string;          // partes do processo (normalizado)
  _orgaoJulgador?: string;   // órgão julgador (normalizado)

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

/** Formata Date para YYYY-MM-DD usando data LOCAL (sem bug UTC) */
function dataLocalStr(d: Date): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/** Gera os últimos N dias úteis a partir de hoje */
function diasUteisRecentes(n: number): string[] {
  const dias: string[] = [];
  const d = new Date();
  while (dias.length < n) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) dias.push(dataLocalStr(d));
    d.setDate(d.getDate() - 1);
  }
  return dias;
}

/** Extrai todos os números CNJ de um texto */
function extrairNumerosCNJ(texto: string): string[] {
  const regex = /\d{7}[-.]?\d{2}[-.]?\d{4}[-.]?\d{1}[-.]?\d{1,2}[-.]?\d{4,5}/g;
  return (texto.match(regex) || []).map((m) => m.replace(/\D/g, ""));
}

/** Gera ID para uma intimação — prioriza codigoRelacionamento (campo real e único da API AASP) */
function gerarId(intim: AaspIntimacao, idx = 0): string {
  // Prioridade 1: codigoRelacionamento — campo real e único da API AASP
  const codRel = (intim as any).codigoRelacionamento || (intim as any).CodigoRelacionamento;
  if (codRel && String(codRel) !== "0") return "aasp_" + String(codRel);

  // Prioridade 2: outros IDs explícitos da API
  const idApi =
    (intim as any).Id || (intim as any).id ||
    (intim as any).CodigoIntimacao || (intim as any).codigoIntimacao ||
    (intim as any).IdIntimacao || (intim as any).idIntimacao ||
    (intim as any).Protocolo || (intim as any).protocolo;
  if (idApi && String(idApi) !== "0") return String(idApi);

  // Fallback determinístico — usa campos reais do JSON AASP (jornal.* + numeroUnicoProcesso)
  const jornal = (intim as any).jornal;
  const numProc =
    (intim as any).numeroUnicoProcesso || (intim as any).NumeroUnicoProcesso ||
    intim.NumeroProcesso || intim.numeroProcesso || intim.Processo || intim.processo || "";
  const data =
    (jornal && (jornal.dataDisponibilizacao_Publicacao || jornal.dataTratamento)) ||
    intim.DataDisponibilizacao || intim.dataDisponibilizacao || intim.Data || (intim as any).data || "";
  const jornalNome = (jornal && jornal.nomeJornal) || intim.NomeJornal || intim.nomeJornal || "";
  const numPub = (intim as any).numeroPublicacao || (intim as any).NumeroPublicacao || "";
  const numArq = (intim as any).numeroArquivo || (intim as any).NumeroArquivo || "";
  const titulo = (intim as any).titulo || intim.TituloAssunto || intim.Assunto || "";
  const texto = (intim.textoPublicacao || intim.Texto || intim.texto || "").slice(0, 400);

  const raw = `${numProc}|${String(data).slice(0, 19)}|${jornalNome}|${numPub}|${numArq}|${titulo}|${idx}|${texto}`;
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

/** Extrai órgão de publicação da intimação (ex: DJENTJSP) */
function extrairOrgaoPublicacao(intim: AaspIntimacao): string {
  // A API AASP retorna jornal como objeto: { nomeJornal: "DJENTJSP", ... }
  const jornal = (intim as any).jornal;
  if (jornal?.nomeJornal) return String(jornal.nomeJornal).toUpperCase();

  // Fallbacks para outros formatos
  const meio = (intim.Meio || intim.meio || "") as string;
  const nomeJornal = (intim.NomeJornal || intim.nomeJornal || "") as string;
  if (meio) return meio.toUpperCase();
  if (nomeJornal) return nomeJornal.toUpperCase();

  // Tenta extrair "Meio: ..." do textoPublicacao
  const texto = (intim.textoPublicacao || intim.Texto || intim.texto || "") as string;
  const matchMeio = texto.match(/Meio:\s*([^\r\n]+)/i);
  if (matchMeio) return matchMeio[1].trim().toUpperCase();

  const padraoOrgao = /\b(DJE?N?T?J?S?P|DOE?S?P|DIÁRIO\s+(?:DE\s+)?JUSTIÇA|DIÁRIO\s+OFICIAL)\b/i;
  const match = texto.match(padraoOrgao);
  return match ? match[0].toUpperCase() : "";
}

/** Extrai partes do processo da intimação */
function extrairPartes(intim: AaspIntimacao): string {
  // Tenta campos diretos primeiro
  const candidatos = [
    intim.Partes,
    intim.partes,
    (intim as any).PartesProcesso,
    (intim as any).partesProcesso,
    (intim as any).NomePartes,
    (intim as any).nomePartes,
  ].filter(Boolean);
  if (candidatos.length > 0) return String(candidatos[0]);

  // A API AASP embute partes no textoPublicacao com padrão:
  // "Parte(s): \r NOME1\r NOME2\r\n\r Advogado(s)"
  const texto = (intim.textoPublicacao || intim.Texto || intim.texto || "") as string;

  const matchPartes = texto.match(/Parte\(s\):\s*([\s\S]*?)(?:\n\r?\s*Advogado|$)/i);
  if (matchPartes) {
    const nomes = matchPartes[1]
      .split(/[\r\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2 && !/^(Parte|Advogado)/i.test(s));
    if (nomes.length > 0) return nomes.join(" · ");
  }

  // Fallback: padrão "Autor/Requerente ... x Réu/Requerido ..."
  const padraoPartes = /(?:Autor(?:a)?|Requerente|Apelante|Impetrante)[:\s]+([^,\n;]{3,60})/i;
  const match = texto.match(padraoPartes);
  if (match) return match[1].trim();

  return "";
}

/** Extrai órgão julgador da intimação */
function extrairOrgaoJulgador(intim: AaspIntimacao): string {
  // Tenta campos diretos
  const candidatos = [
    intim.OrgaoJulgador,
    intim.orgaoJulgador,
    (intim as any).Orgao,
    (intim as any).orgao,
    (intim as any).NomeOrgao,
    (intim as any).nomeOrgao,
    (intim as any).Vara,
    (intim as any).vara,
  ].filter(Boolean);
  if (candidatos.length > 0) return String(candidatos[0]);

  // A API AASP embute o órgão no textoPublicacao com padrão:
  // "Órgão: Foro Regional VI - Penha de França - 4ª Vara Cível\r"
  const texto = (intim.textoPublicacao || intim.Texto || intim.texto || "") as string;

  const matchOrgao = texto.match(/[Óó]rg[ãa]o:\s*([^\r\n]+)/i);
  if (matchOrgao) return matchOrgao[1].trim();

  // Fallback: captura padrão "Xª Vara ..."
  const padraoVara = /(\d+[ªa°º]?\s*Vara(?:\s+\w+){0,4})/i;
  const matchVara = texto.match(padraoVara);
  if (matchVara) return matchVara[1].trim().replace(/\s+/g, " ");

  return "";
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
  localStorage.setItem(STORE_KEY, JSON.stringify(items.slice(0, 1000)));
}

// ── Componente ─────────────────────────────────────────────────
export function IntimacoesPage() {
  const { user } = useAuth();
  const { data: clientes = [] } = useClientes();
  const createCliente = useCreateCliente();
  const { data: feriados = [] } = useFeriados();
  const { data: processos = [] } = useProcessos();
  const createTarefa = useCreateTarefa();

  // Estado do modal de novo cliente (pré-preenchido da intimação)
  const [novoClienteIntimacao, setNovoClienteIntimacao] = useState<AaspIntimacao | null>(null);

  // Estado do modal de criação de tarefa
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskModalInitialData, setTaskModalInitialData] = useState<any>(null);

  const [intimacoes, setIntimacoes] = useState<AaspIntimacao[]>(() => loadStore());
  const [aaspKey, setAaspKey] = useState<string>("");

  // ── Carrega e sincroniza com Supabase SEMPRE ao abrir ────────────────────────
  // O Supabase é a fonte de verdade. localStorage é só cache inicial.
  const carregouParaUser = useRef<string | null>(null);
  useEffect(() => {
    if (!user) return;
    // Evita dupla execução (onAuthStateChange + getSession disparam user duas vezes)
    if (carregouParaUser.current === user.id) return;
    carregouParaUser.current = user.id;

    // 1. Exibe o cache local imediatamente (evita tela em branco)
    const local = loadStore();
    if (local.length > 0) setIntimacoes(local);

    // 2. Função de merge: Supabase tem prioridade em todos os campos
    const mapRow = (row: any): AaspIntimacao => {
      const raw = (row.dados_raw as AaspIntimacao) || {};
      return {
        ...raw,
        _id:              row.id,
        _data:            ((row.data_publicacao ?? raw._data ?? "") as string).slice(0, 10),
        _lida:            raw._lida ?? false,
        // ?? garante que resumo_ia do banco nunca é descartado
        _status:          (row.status as any) ?? "ativa",
        _resumoIA:        row.resumo_ia ?? raw._resumoIA ?? null,
        _titulo:          row.tipo ?? raw._titulo ?? "Publicação AASP",
        _numProc:         row.numero_processo ?? raw._numProc ?? "",
        _orgaoPublicacao: raw._orgaoPublicacao ?? "",
        _partes:          row.partes ?? raw._partes ?? "",
        _orgaoJulgador:   row.orgao_julgador ?? raw._orgaoJulgador ?? "",
      };
    };

    // 3. Busca do Supabase e mescla
    supabase
      .from("intimacoes")
      .select("*")
      .eq("user_id", user.id)
      .eq("origem", "aasp")
      .order("data_publicacao", { ascending: false })
      .limit(500)
      .then(async ({ data }) => {
        const fromDB: AaspIntimacao[] = (data || []).map(mapRow);
        const dbIds = new Set(fromDB.map(i => i._id));

        // 4. Migra intimações locais que nunca chegaram ao Supabase
        const apenasLocal = local.filter(i => !dbIds.has(i._id));
        if (apenasLocal.length > 0) {
          const migRows = apenasLocal.map((it: AaspIntimacao) => ({
            id:               it._id,
            user_id:          user.id,
            origem:           "aasp",
            numero_processo:  it._numProc ?? null,
            tipo:             it._titulo ?? null,
            data_publicacao:  it._data ?? null,
            status:           it._status ?? "ativa",
            partes:           it._partes ?? null,
            orgao_julgador:   it._orgaoJulgador ?? null,
            resumo_ia:        it._resumoIA ?? null,
            dados_raw:        it,
          }));
          for (let i = 0; i < migRows.length; i += 50) {
            await supabase.from("intimacoes")
              .upsert(migRows.slice(i, i + 50), { onConflict: "id" })
              .catch(() => {});
          }
        }

        // 5. Mescla final: Supabase tem prioridade
        const merged = [...fromDB, ...apenasLocal];
        saveStore(merged);
        setIntimacoes(merged);
        // Mantém o modal aberto se estava aberto antes da sincronização
        setSelected(prev => {
          if (!prev) return null;
          const atualizado = merged.find(i => i._id === prev._id);
          return atualizado ?? prev;
        });
      })
      .catch(() => {});
  }, [user]);

  // ── Set de IDs já conhecidos — detecta chegada de novas publicações ──────────
  const idsConhecidosRef = useRef<Set<string>>(new Set());

  // ── Reage ao evento do hook useAutoFetchIntimacoes (sincronização cross-device) ─
  useEffect(() => {
    // Popula o set com os IDs já carregados inicialmente (evita falsos positivos)
    intimacoes.forEach(i => idsConhecidosRef.current.add(i._id));

    const handler = (e: Event) => {
      const merged = (e as CustomEvent<AaspIntimacao[]>).detail;
      if (!Array.isArray(merged) || merged.length === 0) return;

      setIntimacoes(merged);

      // Detecta publicações que não existiam antes (genuinamente novas)
      const novas = merged.filter(
        i => !idsConhecidosRef.current.has(i._id) && i._status === "ativa"
      );

      // Atualiza o set de IDs conhecidos com todos os recebidos
      merged.forEach(i => idsConhecidosRef.current.add(i._id));

      if (novas.length > 0) {
        // Abre o modal automaticamente na intimação mais recente
        const maisRecente = [...novas].sort((a, b) =>
          b._data.localeCompare(a._data)
        )[0];
        setSelected(maisRecente);
      } else {
        // Sem novas: apenas mantém modal aberto atualizado (ex: resumo_ia)
        setSelected(prev => {
          if (!prev) return null;
          const atualizado = merged.find(i => i._id === prev._id);
          return atualizado ?? prev;
        });
      }
    };

    window.addEventListener("intimacoes-sincronizadas", handler);
    return () => window.removeEventListener("intimacoes-sincronizadas", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Atualiza resumo IA em tempo real conforme são gerados ──────
  useEffect(() => {
    const handler = (e: Event) => {
      const { id, resumo } = (e as CustomEvent<{ id: string; resumo: string }>).detail;
      setIntimacoes(prev =>
        prev.map(i => i._id === id ? { ...i, _resumoIA: resumo } : i)
      );
      setSelected(prev =>
        prev?._id === id ? { ...prev, _resumoIA: resumo } : prev
      );
    };
    window.addEventListener("intimacao-resumo-gerado", handler);
    return () => window.removeEventListener("intimacao-resumo-gerado", handler);
  }, []);

  // Refs para evitar stale closures nos callbacks assíncronos
  const aaspKeyRef = useRef(aaspKey);
  const intimacoesRef = useRef(intimacoes);
  useEffect(() => { aaspKeyRef.current = aaspKey; }, [aaspKey]);
  useEffect(() => { intimacoesRef.current = intimacoes; }, [intimacoes]);
  const [groqKey, setGroqKey] = useState<string>("");
  const { loadingIA: loadingIAHook, progresso, gerarResumoIntimacao: gerarResumoHook, gerarTodosResumosIntimacoes } = useGroqIA();
  const [loading, setLoading] = useState(false);
  const [loadingDia, setLoadingDia] = useState<string | null>(null);
  const [loadingIA, setLoadingIA] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<"ativa" | "finalizada" | "pausada">("ativa");
  const [filtroDia, setFiltroDia] = useState<string>("");
  const [filtroData, setFiltroData] = useState<string>("todos"); // "todos" ou YYYY-MM-DD
  const [viewMode, setViewMode] = useState<"tabela" | "cards">(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "cards" : "tabela"
  );
  const [selected, setSelected] = useState<AaspIntimacao | null>(null);

  // Carrega chaves do Supabase / localStorage
  useEffect(() => {
    const localAasp = localStorage.getItem("jurismonitor_aasp_key") || "";
    const localGroq = localStorage.getItem("jurismonitor_groq_key") || "";
    
    if (localAasp) setAaspKey(localAasp);
    if (localGroq) setGroqKey(localGroq);
    
    if (!user) return;
    
    supabase
      .from("api_keys")
      .select("aasp_chave, groq_api_key")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.aasp_chave) {
          localStorage.setItem("jurismonitor_aasp_key", data.aasp_chave);
          setAaspKey(data.aasp_chave);
        }
        if (data?.groq_api_key) {
          localStorage.setItem("jurismonitor_groq_key", data.groq_api_key);
          setGroqKey(data.groq_api_key);
        }
      })
      .catch(() => {});
  }, [user]);

  // ── Formato de data — detectado automaticamente na primeira busca e salvo
  const fmtPreferidoRef = useRef<"ISO" | "BR" | null>(
    (localStorage.getItem("jurismonitor_aasp_fmt") as "ISO" | "BR") || null
  );
  const detectandoFmtRef = useRef(false);

  /** fetchComTimeout — idêntico ao fetchWithTimeout do projeto de referência */
  const fetchComTimeout = useCallback((url: string, ms: number): Promise<Response> => {
    return Promise.race([
      fetch(url, { headers: { Accept: "application/json" } }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout após ${ms}ms`)), ms)
      ),
    ]);
  }, []);

  /**
   * aaspFetchRaw — chama /api/proxy com fallback para proxies públicos em dev.
   *
   * ATENÇÃO — encoding da data:
   * A data no formato BR (DD/MM/YYYY) contém barras "/".
   * Se usarmos URLSearchParams, ele encoda "/" → "%2F".
   * Depois, encodeURIComponent da URL inteira encoda "%" → "%25", resultando em "%252F".
   * O proxy decodifica uma vez: "%252F" → "%2F" — e a AASP recebe "%2F" em vez de "/", gerando erro 500.
   *
   * Solução: montar a URL da AASP com encodeURIComponent APENAS na chave
   * (que pode ter caracteres especiais), e a data concatenada RAW (sem encode extra).
   * O encodeURIComponent único acontece no parâmetro ?url= do proxy,
   * que o proxy decodifica uma vez, entregando a URL correta para a AASP.
   */
  const aaspFetchRaw = useCallback(async (dataParam: string): Promise<unknown> => {
    const chave = aaspKeyRef.current;
    if (!chave) throw new Error("Chave AASP não configurada.");

    // Monta a URL da AASP: chave encodada, data concatenada SEM encode extra
    const endpoint = `https://intimacaoapi.aasp.org.br/api/Associado/intimacao/json?chave=${encodeURIComponent(chave)}&data=${dataParam}`;

    // Lista de proxies — tenta em ordem, igual ao projeto de referência
    const proxies = [
      { nome: "backend (/api/proxy)", url: `/api/proxy?url=${encodeURIComponent(endpoint)}` },
      { nome: "corsproxy.io",         url: `https://corsproxy.io/?url=${encodeURIComponent(endpoint)}` },
      { nome: "allorigins",           url: `https://api.allorigins.win/raw?url=${encodeURIComponent(endpoint)}` },
    ];

    console.log(`[AASP] Buscando: data="${dataParam}"`);

    const erros: string[] = [];
    for (const p of proxies) {
      try {
        const resp = await fetchComTimeout(p.url, 20000);
        if (!resp.ok) { erros.push(`${p.nome}: HTTP ${resp.status}`); continue; }
        const text = await resp.text();
        if (!text || text.trim() === "") { erros.push(`${p.nome}: resposta vazia`); continue; }
        try { return JSON.parse(text); } catch (_) {}
        try { const w = JSON.parse(text); if ((w as any)?.contents) return JSON.parse((w as any).contents); } catch (_) {}
        erros.push(`${p.nome}: JSON inválido — ${text.slice(0, 120)}`);
      } catch (e: any) {
        erros.push(`${p.nome}: ${e.message}`);
      }
    }
    throw new Error(`Todos os proxies falharam:\n${erros.join("\n")}`);
  }, [fetchComTimeout]);

  /**
   * detectarFormato — testa ISO vs BR no primeiro dia útil e salva o resultado.
   * Idêntico ao testarAasp() do projeto de referência.
   */
  const detectarFormato = useCallback(async (dataStr: string): Promise<"ISO" | "BR"> => {
    const [a, m, d] = dataStr.split("-");
    const fmtISO = dataStr;           // YYYY-MM-DD
    const fmtBR  = `${d}/${m}/${a}`; // DD/MM/YYYY

    // Usa aaspFetchRaw que já passa a data como string (sem reencodar)
    const [resISO, resBR] = await Promise.all([
      aaspFetchRaw(fmtISO).catch(() => null),
      aaspFetchRaw(fmtBR).catch(() => null),
    ]);

    const listaISO = normalizar(resISO);
    const listaBR  = normalizar(resBR);

    const fmt = listaBR.length >= listaISO.length ? "BR" : "ISO";
    localStorage.setItem("jurismonitor_aasp_fmt", fmt);
    fmtPreferidoRef.current = fmt;
    console.log(`[AASP] Formato detectado: ${fmt} (ISO: ${listaISO.length}, BR: ${listaBR.length})`);
    return fmt;
  }, [aaspFetchRaw]);

  /**
   * aaspFetch — converte dataStr para o formato correto e chama aaspFetchRaw.
   * Usa URLSearchParams para evitar problema de double-encoding com datas BR (DD/MM/YYYY).
   * Se o formato ainda não foi detectado, detecta agora (igual ao projeto de referência).
   */
  const aaspFetch = useCallback(async (dataStr: string): Promise<unknown> => {
    // Detecta formato na primeira chamada se ainda não detectado
    if (!fmtPreferidoRef.current && !detectandoFmtRef.current) {
      detectandoFmtRef.current = true;
      await detectarFormato(dataStr);
      detectandoFmtRef.current = false;
    }

    // Converte para o formato correto
    const fmt = fmtPreferidoRef.current || "ISO";
    let dataParam = dataStr;
    if (fmt === "BR") {
      const [a, m, d] = dataStr.split("-");
      dataParam = `${d}/${m}/${a}`;
    }

    return aaspFetchRaw(dataParam);
  }, [aaspFetchRaw, detectarFormato]);

  /** Busca intimações de um dia — com suporte a paginação igual ao projeto de referência */
  const buscarDia = useCallback(
    async (dataStr: string, silencioso = false): Promise<AaspIntimacao[]> => {
      if (!aaspKeyRef.current) return [];

      let raw: unknown;
      try {
        raw = await aaspFetch(dataStr);
      } catch (err: any) {
        if (!silencioso) console.warn(`[AASP] buscarDia ${dataStr}:`, err.message);
        return [];
      }

      // Suporte a paginação — igual a aaspGetIntimacoes() do projeto de referência
      const info: any = (!Array.isArray(raw) && raw && typeof raw === "object") ? raw : null;
      const total   = info?.TotalRegistros ?? info?.totalRegistros ?? info?.Total ?? info?.total ?? null;
      const tamPag  = info?.TamanhoPagina  ?? info?.tamanhoPagina  ?? info?.PageSize ?? info?.pageSize ?? null;

      let todasItens = normalizar(raw);

      if (total !== null && tamPag && Number(tamPag) > 0) {
        const totalPags = Math.ceil(Number(total) / Number(tamPag));
        if (totalPags > 1) {
          console.log(`[AASP] ${dataStr}: ${total} intimações em ${totalPags} páginas.`);
          for (let pag = 2; pag <= totalPags; pag++) {
            try {
              const chave = aaspKeyRef.current;
              const fmt = fmtPreferidoRef.current || "ISO";
              const [a, m, d] = dataStr.split("-");
              const dataParam = fmt === "BR" ? `${d}/${m}/${a}` : dataStr;
              // data concatenada RAW — sem URLSearchParams para evitar double-encoding
              const aaspUrl2 = `https://intimacaoapi.aasp.org.br/api/Associado/intimacao/json?chave=${encodeURIComponent(chave)}&data=${dataParam}&pagina=${pag}`;
              const resp2 = await fetchComTimeout(`/api/proxy?url=${encodeURIComponent(aaspUrl2)}`, 20000);
              const raw2 = JSON.parse(await resp2.text());
              todasItens = [...todasItens, ...normalizar(raw2)];
              console.log(`[AASP] Pág ${pag}/${totalPags}: +${normalizar(raw2).length}`);
            } catch (_) { break; }
          }
        }
      }

      if (todasItens.length === 0) {
        console.warn(`[AASP] ${dataStr} sem intimações. Raw:`, JSON.stringify(raw).slice(0, 300));
        return [];
      }

      const arr = todasItens.map((it: any, idx: number) => {
        const id = gerarId(it, idx);
        const existente = intimacoesRef.current.find((x) => x._id === id);

        // Extrai a data bruta do JSON — pode vir como ISO "2026-04-23T00:00:00", "2026-04-23",
        // ou BR "23/04/2026". Normaliza SEMPRE para YYYY-MM-DD para bater com dataStr.
        const dataBruta = (
          (it.jornal && (it.jornal.dataDisponibilizacao_Publicacao || it.jornal.dataTratamento)) ||
          it.DataDisponibilizacao || it.dataDisponibilizacao ||
          it.Data || it.data || ""
        ) as string;

        let dataReal = dataStr; // fallback seguro
        if (dataBruta) {
          const isoMatch = dataBruta.match(/^(\d{4})-(\d{2})-(\d{2})/);
          const brMatch  = dataBruta.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
          if (isoMatch) {
            dataReal = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`; // já é YYYY-MM-DD
          } else if (brMatch) {
            dataReal = `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`; // DD/MM/YYYY → YYYY-MM-DD
          }
        }
        return {
          ...it,
          _id: id,
          _data: dataReal,
          _lida: existente?._lida || false,
          _status: existente?._status || "ativa",
          _resumoIA: existente?._resumoIA || null,
          _titulo: it.TituloAssunto || it.Assunto || it.titulo || it.cabecalho?.replace(/\r\n|\n/g, "").trim() || "Publicação AASP",
          _numProc: extrairNumProc(it),
          _orgaoPublicacao: extrairOrgaoPublicacao(it),
          _partes: extrairPartes(it),
          _orgaoJulgador: extrairOrgaoJulgador(it),
        };
      });

      if (!silencioso) toast.success(`${arr.length} intimação(ões) em ${fmtData(dataStr)}`);
      return arr;
    },
    [aaspFetch, fetchComTimeout]
  );

  /** Atualizar — aciona o hook completo (resumo IA + e-mail) via evento global */
  const atualizar = () => {
    if (!aaspKey) {
      toast.error("Configure sua chave AASP nas Configurações.");
      return;
    }
    window.dispatchEvent(new CustomEvent("force-busca-intimacoes"));
  };

  /** Buscar dia específico */
  const buscarDiaEspecifico = async () => {
    if (!filtroDia) {
      toast.error("Selecione uma data.");
      return;
    }
    setLoadingDia(filtroDia);
    const arr = await buscarDia(filtroDia);
    setLoadingDia(null);

    const merged = [...arr, ...intimacoes];
    const uniq: AaspIntimacao[] = [];
    const seen = new Set<string>();
    for (const it of merged) {
      if (!seen.has(it._id)) {
        seen.add(it._id);
        uniq.push(it);
      }
    }

    setIntimacoes(uniq);
    saveStore(uniq);

    // Persiste no Supabase
    if (arr.length > 0) {
      const rows = arr.map(it => ({
        id:               it._id,
        user_id:          user!.id,
        origem:           "aasp",
        numero_processo:  it._numProc || null,
        tipo:             it._titulo || null,
        data_publicacao:  it._data || null,
        status:           it._status || "ativa",
        partes:           it._partes || null,
        orgao_julgador:   it._orgaoJulgador || null,
        resumo_ia:        it._resumoIA || null,
        dados_raw:        it,
      }));
      try {
        await supabase.from("intimacoes").upsert(rows, { onConflict: "id" });
      } catch (_) {}
    }
  };

  /** Gerar resumo IA para uma intimação */
  const gerarResumoIA = async (intimacao: AaspIntimacao) => {
    if (!groqKey) {
      toast.error("Configure sua chave Groq nas Configurações para usar IA.");
      return;
    }

    const textoRaw = (
      intimacao.textoPublicacao ||
      intimacao.Texto ||
      intimacao.texto ||
      intimacao.Conteudo ||
      intimacao.conteudo ||
      ""
    ) as string;

    // Quando o texto principal está vazio, monta a partir dos campos estruturados
    const texto = textoRaw.trim().length >= 50 ? textoRaw : [
      intimacao._numProc && `Processo: ${intimacao._numProc}`,
      intimacao._titulo && `Tipo: ${intimacao._titulo}`,
      intimacao._orgaoJulgador && `Órgão: ${intimacao._orgaoJulgador}`,
      intimacao._data && `Data: ${intimacao._data}`,
      intimacao._partes && `Partes: ${intimacao._partes}`,
      intimacao._orgaoPublicacao && `Publicação: ${intimacao._orgaoPublicacao}`,
      intimacao.TituloAssunto && `Assunto: ${intimacao.TituloAssunto}`,
    ].filter(Boolean).join("\n");

    if (!texto || texto.trim().length < 20) {
      toast.error("Texto insuficiente para gerar resumo.");
      return;
    }

    try {
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: "Você é um assistente jurídico especializado em análise de intimações. Faça um resumo objetivo e profissional em até 3 frases, destacando: tipo de ato, prazo se houver, e ação necessária."
            },
            {
              role: "user",
              content: `Analise esta intimação e faça um resumo:\n\n${texto}`
            }
          ],
          temperature: 0.3,
          max_tokens: 200,
        }),
      });

      if (!resp.ok) {
        throw new Error(`Erro na API Groq: ${resp.status}`);
      }

      const data = await resp.json();
      const resumoBruto = data.choices?.[0]?.message?.content?.trim() || "";
      const resumo = resumoBruto
        .replace(/^(aqui (está|estão|segue|seguem)[^:\n]*:\s*)/i, "")
        .replace(/^(segue[^:\n]*:\s*)/i, "")
        .trim();

      if (!resumo) {
        throw new Error("Resumo vazio retornado pela IA");
      }

      // Atualiza no estado
      setIntimacoes((prev) =>
        prev.map((it) =>
          it._id === intimacao._id ? { ...it, _resumoIA: resumo } : it
        )
      );

      // Salva no localStorage usando ref para garantir snapshot atualizado
      const updated = intimacoesRef.current.map((it) =>
        it._id === intimacao._id ? { ...it, _resumoIA: resumo } : it
      );
      saveStore(updated);

      // Salva no Supabase para sincronização cross-device.
      // Inclui user_id para garantir RLS e detectar falhas silenciosas.
      if (user) {
        const { error: sbErr } = await supabase
          .from("intimacoes")
          .update({ resumo_ia: resumo } as any)
          .eq("id", intimacao._id)
          .eq("user_id", user.id);
        if (sbErr) {
          console.warn("[ResumoIA] Falha ao salvar no Supabase:", sbErr.message);
        }
      }

      toast.success("Resumo IA gerado e salvo!");
      return resumo;
    } catch (err: any) {
      console.error("Erro ao gerar resumo IA:", err);
      toast.error(`Erro ao gerar resumo: ${err.message}`);
      return null;
    }
  };

  /** Gerar resumos IA para todas as intimações ativas sem resumo */
  const gerarTodosResumosIA = async () => {
    await gerarTodosResumosIntimacoes(
      intimacoes,
      async (id: string, resumo: string) => {
        // Atualiza estado local
        setIntimacoes(prev => prev.map(it => it._id === id ? { ...it, _resumoIA: resumo } : it));
        // Salva no localStorage
        const updated = intimacoesRef.current.map(it => it._id === id ? { ...it, _resumoIA: resumo } : it);
        saveStore(updated);
        // Salva no Supabase — inclui user_id para RLS
        if (user) {
          const { error: sbErr } = await supabase
            .from("intimacoes")
            .update({ resumo_ia: resumo } as any)
            .eq("id", id)
            .eq("user_id", user.id);
          if (sbErr) {
            console.warn("[ResumoIA todos] Falha Supabase:", sbErr.message);
          }
        }
      }
    );
  };

  /** Criar tarefa a partir de uma intimação */
  const criarTarefaDeIntimacao = (intimacao: AaspIntimacao) => {
    setTaskModalInitialData({
      titulo: `Intimação: ${intimacao._titulo || "Publicação AASP"}`,
      descricao: intimacao._resumoIA ||
        (intimacao.textoPublicacao || intimacao.Texto || intimacao.texto || "").substring(0, 200),
      prioridade: "alta",
    });
    setShowTaskModal(true);
  };

  const handleSubmitTarefa = async (data: any) => {
    try {
      await createTarefa.mutateAsync({
        titulo: data.titulo,
        descricao: data.descricao || null,
        data_vencimento: data.data_vencimento || null,
        prioridade: data.prioridade,
        status: data.status || "triagem",
        processo_id: data.processo_id || null,
      });
      toast.success("Tarefa criada com sucesso!");
      setShowTaskModal(false);
      setTaskModalInitialData(null);
    } catch (err: any) {
      toast.error(`Erro ao criar tarefa: ${err.message}`);
    }
  };

  const marcarLida = (id: string) => {
    setIntimacoes((prev) => {
      const updated = prev.map((it) => (it._id === id ? { ...it, _lida: true } : it));
      saveStore(updated);
      return updated;
    });
    
    // Atualiza no Supabase de forma assíncrona (fire and forget)
    if (user) {
      supabase
        .from("intimacoes")
        .update({ dados_raw: { _lida: true } } as any)
        .eq("id", id)
        .eq("user_id", user.id)
        .then(() => {})
        .catch(() => {});
    }
  };

  const setStatus = (id: string, status: AaspIntimacao["_status"]) => {
    setIntimacoes((prev) => {
      const updated = prev.map((it) => (it._id === id ? { ...it, _status: status } : it));
      saveStore(updated);
      return updated;
    });
    
    if (user) {
      supabase
        .from("intimacoes")
        .update({ status } as any)
        .eq("id", id)
        .eq("user_id", user.id)
        .then(() => {})
        .catch(() => {});
    }
    
    toast.success("Status atualizado.");
  };

  const excluir = (id: string) => {
    if (!confirm("Excluir esta intimação?")) return;
    setIntimacoes((prev) => {
      const updated = prev.filter((it) => it._id !== id);
      saveStore(updated);
      return updated;
    });
    
    if (user) {
      supabase
        .from("intimacoes")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)
        .then(() => {})
        .catch(() => {});
    }
    
    toast.success("Intimação excluída.");
  };

  const limparTudo = () => {
    if (!confirm("Limpar TODAS as intimações? Esta ação não pode ser desfeita.")) return;
    setIntimacoes([]);
    saveStore([]);
    toast.success("Todas as intimações foram removidas.");
  };

  // ── Mapa: número do processo (dígitos) → clientes cadastrados ───────────────
  // Permite identificar rapidamente se uma intimação já tem cliente vinculado.
  const clientesPorProcesso = React.useMemo(() => {
    const mapa = new Map<string, { id: string; nome: string; email: string | null }[]>();
    for (const c of clientes) {
      const procs = (c.numeros_processo as string[] | null) || [];
      for (const p of procs) {
        const chave = p.replace(/\D/g, "");
        if (!chave) continue;
        if (!mapa.has(chave)) mapa.set(chave, []);
        mapa.get(chave)!.push({ id: c.id, nome: c.nome, email: c.email ?? null });
      }
    }
    return mapa;
  }, [clientes]);

  /** Retorna os clientes vinculados a uma intimação (pelo número do processo) */
  const clientesDaIntimacao = (intim: AaspIntimacao) => {
    if (!intim._numProc) return [];
    const chave = intim._numProc.replace(/\D/g, "");
    if (!chave) return [];
    // Busca por substring (igual ao envio automático do hook)
    const resultado: { id: string; nome: string; email: string | null }[] = [];
    for (const [k, lista] of clientesPorProcesso.entries()) {
      if (chave.includes(k) || k.includes(chave)) {
        resultado.push(...lista);
      }
    }
    // Remove duplicatas por id
    return resultado.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i);
  };

  // ── Reenvio manual de e-mail para clientes do processo ──────────────────────
  const [enviandoEmail, setEnviandoEmail] = useState<Set<string>>(new Set());

  const reenviarEmailManual = useCallback(async (intim: AaspIntimacao) => {
    if (!intim._numProc) { toast.error("Intimação sem número de processo."); return; }
    const destinatarios = clientesDaIntimacao(intim).filter(c => c.email);
    if (!destinatarios.length) { toast.info("Nenhum cliente com e-mail cadastrado para este processo."); return; }

    setEnviandoEmail(prev => new Set(prev).add(intim._id));
    const fmtDataBR = (iso: string) => {
      const p = (iso || "").slice(0, 10).split("-");
      return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
    };

    let ok = 0;
    for (const cliente of destinatarios) {
      try {
        const res = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destinatario:   cliente.email,
            nomeCliente:    cliente.nome,
            numeroProcesso: intim._numProc,
            dataPublicacao: fmtDataBR(intim._data),
            assunto:        intim._titulo || "Nova Publicação AASP",
            resumoIA:       intim._resumoIA || null,
            textoCompleto:  "",
          }),
        });
        const status = res.ok ? "enviado" : "falha";
        await supabase.from("notificacoes_enviadas").insert({
          user_id:         user!.id,
          cliente_id:      cliente.id,
          intimacao_id:    intim._id,
          numero_processo: intim._numProc || "",
          assunto:         intim._titulo || "Nova Publicação AASP",
          resumo_ia:       intim._resumoIA || null,
          email_destino:   cliente.email,
          status,
        });
        if (res.ok) {
          ok++;
          await supabase.from("clientes").update({ ultima_notificacao: new Date().toISOString() }).eq("id", cliente.id);
        }
      } catch (e: any) {
        console.error("[ReenvioManual]", e.message);
      }
    }
    setEnviandoEmail(prev => { const s = new Set(prev); s.delete(intim._id); return s; });
    if (ok > 0) toast.success(`📧 ${ok} e-mail(s) enviado(s) com sucesso!`);
    else toast.error("Falha ao enviar e-mails. Verifique as configurações.");
  }, [user, clientesPorProcesso]);

  // Gera os últimos 7 dias ÚTEIS usando data LOCAL
  const ultimos7Dias = (() => {
    const dias: string[] = [];
    const d = new Date();
    while (dias.length < 7) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) dias.push(dataLocalStr(d));
      d.setDate(d.getDate() - 1);
    }
    return dias;
  })();

  // Contagem de intimações por dia — normaliza _data para YYYY-MM-DD
  const contagemPorDia = intimacoes.reduce<Record<string, number>>((acc, it) => {
    const dataKey = (it._data || "").slice(0, 10);
    if (dataKey) acc[dataKey] = (acc[dataKey] || 0) + 1;
    return acc;
  }, {});

  const filtradas = intimacoes
    .filter((it) => {
      if (it._status !== filtroStatus) return false;
      if (filtroData !== "todos" && (it._data || "").slice(0, 10) !== filtroData) return false;
      return true;
    })
    .sort((a, b) => b._data.localeCompare(a._data));

  const renderLinha = (intim: AaspIntimacao) => {
    const naoLida = intim._status === "ativa" && !intim._lida;
    const jornal = intim._orgaoPublicacao || (intim.NomeJornal || intim.nomeJornal || "") as string;
    const orgao = intim._orgaoJulgador || (intim.OrgaoJulgador || intim.orgaoJulgador || "") as string;
    const partes = intim._partes || (intim.Partes || intim.partes || "") as string;
    const meio = (intim.Meio || intim.meio || "") as string;
    const clientesVinculados = clientesDaIntimacao(intim);
    const temCliente = clientesVinculados.length > 0;
    
    const handleClickProcesso = () => {
      console.log("🔍 Clicou no processo:", intim._numProc, intim);
      marcarLida(intim._id);
      setSelected(intim);
      console.log("✅ Estado selected atualizado");
    };
    
    return (
      <tr key={intim._id} className={`border-b border-border ${naoLida ? "bg-accent/5" : ""}`}>
        {/* Data */}
        <td className="px-3 py-2.5 align-top whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            {naoLida && <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />}
            <span className="text-xs text-muted-foreground font-mono">{fmtData(intim._data)}</span>
          </div>
        </td>

        {/* Processo + cliente vinculado */}
        <td className="px-3 py-2.5 align-top">
          {intim._numProc ? (
            <button
              className="font-mono text-xs font-bold text-accent hover:underline underline-offset-2 text-left transition-colors whitespace-nowrap"
              title="Visualizar intimação"
              onClick={handleClickProcesso}
            >
              {intim._numProc}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground italic">—</span>
          )}
          {temCliente && (
            <div className="mt-1 flex flex-col gap-0.5">
              {clientesVinculados.map(c => (
                <span key={c.id} className="inline-flex items-center gap-1 text-[0.62rem] font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-400/30 rounded px-1.5 py-0.5 whitespace-nowrap">
                  <UserCheck className="h-2.5 w-2.5 flex-shrink-0" />
                  {c.nome.split(" ").slice(0, 2).join(" ")}
                </span>
              ))}
            </div>
          )}
        </td>

        {/* Título + Órgão + Meio (coluna unificada) */}
        <td className="px-3 py-2.5 align-top min-w-[180px] max-w-[240px]">
          <div className="text-xs font-semibold line-clamp-2 leading-snug">{intim._titulo}</div>
          {orgao && <div className="text-[0.65rem] text-muted-foreground mt-0.5 line-clamp-1">{orgao}</div>}
          {(meio || jornal) && <div className="text-[0.65rem] text-accent font-medium mt-0.5">{meio || jornal}</div>}
        </td>

        {/* Partes */}
        <td className="px-3 py-2.5 align-top min-w-[120px] max-w-[180px]">
          {partes ? (
            <div className="text-[0.7rem] text-foreground line-clamp-3 leading-snug" title={partes}>{partes}</div>
          ) : (
            <span className="text-xs text-muted-foreground italic">—</span>
          )}
        </td>

        {/* Resumo IA */}
        <td className="px-3 py-2.5 align-top min-w-[140px] max-w-[220px]">
          {intim._resumoIA ? (
            <div className="text-xs text-foreground leading-relaxed line-clamp-3">{intim._resumoIA}</div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground hover:text-accent whitespace-nowrap"
              onClick={() => gerarResumoIA(intim)}
            >
              <Sparkles className="h-3 w-3 mr-1" /> Gerar IA
            </Button>
          )}
        </td>

        {/* Status */}
        <td className="px-3 py-2.5 align-top whitespace-nowrap">
          <StatusBadge status={intim._status || "ativa"} nova={naoLida} />
        </td>

        {/* Ações — linha única, nunca quebra */}
        <td className="px-3 py-2.5 align-top">
          <div className="flex items-center gap-0.5 flex-nowrap">
            <ActionBtn title="Visualizar" onClick={() => { marcarLida(intim._id); setSelected(intim); }}>
              <Eye className="h-3.5 w-3.5" />
            </ActionBtn>
            <ActionBtn
              title={temCliente ? `Cliente já cadastrado: ${clientesVinculados.map(c => c.nome).join(", ")}` : "Novo Cliente"}
              onClick={() => setNovoClienteIntimacao(intim)}
              className={temCliente ? "text-emerald-600 bg-emerald-500/10" : "text-emerald-600"}
            >
              {temCliente ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
            </ActionBtn>
            <ActionBtn
              title="Enviar e-mail ao cliente"
              onClick={() => reenviarEmailManual(intim)}
              className={temCliente ? "text-blue-500" : "text-muted-foreground"}
              disabled={enviandoEmail.has(intim._id) || !temCliente}
            >
              {enviandoEmail.has(intim._id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
            </ActionBtn>
            <ActionBtn title="Criar Tarefa" onClick={() => criarTarefaDeIntimacao(intim)} className="text-accent">
              <Plus className="h-3.5 w-3.5" />
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
            <ActionBtn title="Pausar" onClick={() => setStatus(intim._id, "pausada")} className="text-muted-foreground">
              <Pause className="h-3.5 w-3.5" />
            </ActionBtn>
            <ActionBtn title="Excluir" onClick={() => excluir(intim._id)} className="text-red-alert">
              <Trash2 className="h-3.5 w-3.5" />
            </ActionBtn>
          </div>
        </td>
      </tr>
    );
  };

  const renderCard = (intim: AaspIntimacao) => {
    const naoLida = (intim._status || "ativa") === "ativa" && !intim._lida;
    const jornal = intim._orgaoPublicacao || (intim.NomeJornal || intim.nomeJornal || "") as string;
    const orgao = intim._orgaoJulgador || (intim.OrgaoJulgador || intim.orgaoJulgador || "") as string;
    const partes = intim._partes || (intim.Partes || intim.partes || "") as string;
    const meio = (intim.Meio || intim.meio || "") as string;
    const clientesVinculados = clientesDaIntimacao(intim);
    const temCliente = clientesVinculados.length > 0;
    
    const handleClickProcesso = () => {
      console.log("🔍 [CARD] Clicou no processo:", intim._numProc, intim);
      marcarLida(intim._id);
      setSelected(intim);
      console.log("✅ [CARD] Estado selected atualizado");
    };
    
    return (
      <div
        key={intim._id}
        className="bg-card border border-border rounded-xl p-4 hover:border-accent/40 transition-colors"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              {naoLida && <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />}
              <span className="text-xs text-muted-foreground font-mono">{fmtData(intim._data)}</span>
            </div>
            {intim._numProc && (
              <button
                className="font-mono text-sm font-bold text-accent whitespace-nowrap hover:underline underline-offset-2 text-left transition-colors"
                title="Visualizar intimação"
                onClick={handleClickProcesso}
              >
                {intim._numProc}
              </button>
            )}
            {/* Badge(s) de cliente vinculado */}
            {temCliente && (
              <div className="flex flex-wrap gap-1 mt-1">
                {clientesVinculados.map(c => (
                  <span key={c.id} className="inline-flex items-center gap-1 text-[0.65rem] font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-400/30 rounded-full px-2 py-0.5">
                    <UserCheck className="h-3 w-3 flex-shrink-0" />
                    {c.nome.split(" ").slice(0, 2).join(" ")}
                  </span>
                ))}
              </div>
            )}
            <div className="text-sm font-semibold truncate mt-0.5">{intim._titulo}</div>
            
            {/* Órgão */}
            {orgao && (
              <div className="text-xs text-foreground mt-1 flex items-start gap-1">
                <span className="font-semibold">📍</span>
                <span className="flex-1">{orgao}</span>
              </div>
            )}
            
            {/* Tipo de Comunicação */}
            {(meio || jornal) && (
              <div className="text-xs text-accent font-medium mt-1 flex items-center gap-1">
                <span>📋</span>
                <span>{meio || jornal}</span>
              </div>
            )}
            
            {/* Partes */}
            {partes && (
              <div className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                <span className="font-semibold">👥</span>
                <span className="flex-1 line-clamp-2">{partes}</span>
              </div>
            )}
          </div>
          <StatusBadge status={intim._status || "ativa"} nova={naoLida} />
        </div>
        {intim._resumoIA ? (
          <div className="mt-2 text-xs text-muted-foreground bg-muted/40 rounded-lg p-2 border-l-2 border-accent/40 leading-relaxed">
            {intim._resumoIA}
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs w-full mt-2"
            onClick={() => gerarResumoIA(intim)}
          >
            <Sparkles className="h-3 w-3 mr-1" /> Gerar Resumo IA
          </Button>
        )}
        <div className="flex gap-2 mt-3 flex-wrap">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { marcarLida(intim._id); setSelected(intim); }}>
            <Eye className="h-3 w-3 mr-1" /> Ver
          </Button>
          <Button
            variant="outline" size="sm"
            className={`h-7 text-xs ${temCliente ? "text-emerald-600 border-emerald-400/50 bg-emerald-500/5" : "text-emerald-600 border-emerald-200"}`}
            onClick={() => setNovoClienteIntimacao(intim)}
            title={temCliente ? `Cliente já cadastrado: ${clientesVinculados.map(c => c.nome).join(", ")}` : "Cadastrar novo cliente"}
          >
            {temCliente ? <UserCheck className="h-3 w-3 mr-1" /> : <UserPlus className="h-3 w-3 mr-1" />}
            {temCliente ? "Cliente ✓" : "Cliente"}
          </Button>
          {temCliente && (
            <Button
              variant="outline" size="sm"
              className="h-7 text-xs text-blue-500 border-blue-200"
              onClick={() => reenviarEmailManual(intim)}
              disabled={enviandoEmail.has(intim._id)}
            >
              {enviandoEmail.has(intim._id) ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Mail className="h-3 w-3 mr-1" />}
              E-mail
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-7 text-xs text-accent" onClick={() => criarTarefaDeIntimacao(intim)}>
            <Plus className="h-3 w-3 mr-1" /> Tarefa
          </Button>
          {(intim._status || "ativa") === "ativa" ? (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setStatus(intim._id, "finalizada")}>
              <CheckCircle className="h-3 w-3 mr-1" /> Finalizar
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setStatus(intim._id, "ativa")}>
              <PlayCircle className="h-3 w-3 mr-1" /> Reativar
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 text-xs text-red-alert" onClick={() => excluir(intim._id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full overflow-x-hidden">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4 md:mb-6">
        <div>
          <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight">Intimações AASP</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            {intimacoes.length} intimação(ões) armazenada(s)
          </p>
        </div>
        <div className="flex gap-1.5 md:gap-2 flex-wrap">
          <Button variant={viewMode === "tabela" ? "default" : "outline"} size="sm" onClick={() => setViewMode("tabela")} className="hidden md:flex">
            <TableIcon className="w-4 h-4" />
          </Button>
          <Button variant={viewMode === "cards" ? "default" : "outline"} size="sm" onClick={() => setViewMode("cards")} className="hidden md:flex">
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={atualizar} disabled={loading || !aaspKey}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline ml-1.5">Atualizar</span>
          </Button>
          <Button variant="outline" size="sm" onClick={gerarTodosResumosIA} disabled={loadingIA || loadingIAHook || !groqKey}
            title="Gerar resumo IA para todas as intimações sem resumo" className="hidden sm:flex">
            {(loadingIA || loadingIAHook)
              ? <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{progresso.total > 0 ? `${progresso.atual}/${progresso.total}` : "..."}</span>
              : <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />Resumir</span>}
          </Button>
          <Button variant="destructive" size="sm" onClick={limparTudo} title="Limpar todas">
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Barra de controles: status + filtro por dia + ações */}
      <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-5 flex-wrap">
        {/* Filtros de status */}
        <div className="flex gap-1.5 flex-wrap">
          {(["ativa", "finalizada", "pausada"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFiltroStatus(st)}
              className={`px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg text-[0.7rem] md:text-xs font-semibold transition-all ${
                filtroStatus === st
                  ? "bg-accent text-primary"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {st === "ativa"
                ? `Ativas · ${intimacoes.filter(i => i._status === "ativa").length}`
                : st === "finalizada"
                ? `Finalizadas · ${intimacoes.filter(i => i._status === "finalizada").length}`
                : `Pausadas · ${intimacoes.filter(i => i._status === "pausada").length}`}
            </button>
          ))}
        </div>

        {/* Dropdown: últimos 7 dias com contagem */}
        <div className="ml-auto">
          <Select value={filtroData} onValueChange={setFiltroData}>
            <SelectTrigger className="w-40 md:w-52 text-xs h-8 md:h-9 border border-border bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos" className="text-xs">
                Todos ({intimacoes.filter(i => i._status === filtroStatus).length})
              </SelectItem>
              {ultimos7Dias.map((dia) => {
                const count = intimacoes.filter(i => (i._data || "").slice(0, 10) === dia && i._status === filtroStatus).length;
                const [, mes, d] = dia.split("-");
                const dow = new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
                const label = `${dow}, ${d}/${mes}`;
                return (
                  <SelectItem key={dia} value={dia} className="text-xs">
                    {count === 0
                      ? `${label} — sem dados`
                      : `${label} (${count})`}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Busca por dia específico (API AASP) */}
      <div className="bg-card border border-border rounded-xl p-3 md:p-4 mb-4 md:mb-6">
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Buscar dia na AASP</label>
            <input
              type="date"
              value={filtroDia}
              onChange={(e) => setFiltroDia(e.target.value)}
              className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-accent outline-none"
            />
          </div>
          <Button variant="gold" size="sm" onClick={buscarDiaEspecifico} disabled={!!loadingDia || !aaspKey}>
            {loadingDia ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Buscar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />
          <p className="text-sm">Buscando intimações...</p>
          {loadingDia && <p className="text-xs mt-1">Dia: {fmtData(loadingDia)}</p>}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-base font-medium">Nenhuma intimação encontrada.</p>
          <p className="text-sm mt-1">
            {aaspKey ? 'Clique em "Atualizar" para buscar as publicações.' : 'Configure sua chave AASP nas Configurações.'}
          </p>
        </div>
      ) : viewMode === "tabela" ? (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto -mx-0" style={{ WebkitOverflowScrolling: "touch" }}>
            <table className="w-full text-sm" style={{ minWidth: "760px" }}>
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  {["DATA", "PROCESSO", "TÍTULO / ÓRGÃO", "PARTES", "RESUMO IA", "STATUS", "AÇÕES"].map((h) => (
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtradas.map(renderCard)}
        </div>
      )}

      {/* Modal de Detalhe */}
      {selected && (
        <>
          {console.log("🎯 Renderizando ModalDetalhe com:", selected)}
          <ModalDetalhe
            intim={selected}
            onClose={() => setSelected(null)}
            onSetStatus={setStatus}
            onExcluir={excluir}
            onCriarTarefa={criarTarefaDeIntimacao}
            onGerarResumo={gerarResumoIA}
            onNovoCliente={(intim) => { setSelected(null); setNovoClienteIntimacao(intim); }}
            onReenviarEmail={reenviarEmailManual}
            enviandoEmail={enviandoEmail}
            clientesVinculados={clientesDaIntimacao(selected)}
          />
        </>
      )}

      {/* Modal de Novo Cliente (pré-preenchido da intimação) */}
      {novoClienteIntimacao && (
        <NovoClienteModal
          intim={novoClienteIntimacao}
          onClose={() => setNovoClienteIntimacao(null)}
          onCreate={async (dados) => {
            await createCliente.mutateAsync(dados);
            setNovoClienteIntimacao(null);
            toast.success("✅ Cliente cadastrado com sucesso!");
          }}
          saving={createCliente.isPending}
          clientesVinculados={clientesDaIntimacao(novoClienteIntimacao)}
        />
      )}

      {/* Modal de Criação de Tarefa */}
      <CreateTaskModal
        open={showTaskModal}
        onClose={() => { setShowTaskModal(false); setTaskModalInitialData(null); }}
        onSubmit={handleSubmitTarefa}
        initialData={taskModalInitialData}
        processos={processos}
        clientes={clientes}
        feriados={feriados}
      />
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
  disabled = false,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`p-1 rounded hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
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
  onCriarTarefa,
  onGerarResumo,
  onNovoCliente,
  onReenviarEmail,
  enviandoEmail,
  clientesVinculados,
}: {
  intim: AaspIntimacao;
  onClose: () => void;
  onSetStatus: (id: string, s: AaspIntimacao["_status"]) => void;
  onExcluir: (id: string) => void;
  onCriarTarefa: (intim: AaspIntimacao) => void;
  onGerarResumo: (intim: AaspIntimacao) => void;
  onNovoCliente: (intim: AaspIntimacao) => void;
  onReenviarEmail: (intim: AaspIntimacao) => void;
  enviandoEmail: Set<string>;
  clientesVinculados: { id: string; nome: string; email: string | null }[];
}) {
  const temCliente = clientesVinculados.length > 0;
  const titulo =
    intim._titulo ||
    intim.TituloAssunto ||
    intim.Assunto ||
    "Publicação AASP";

  const jornal = intim._orgaoPublicacao || (intim.NomeJornal || intim.nomeJornal || "") as string;
  const orgao = intim._orgaoJulgador || (intim.OrgaoJulgador || intim.orgaoJulgador || "") as string;
  const partes = intim._partes || (intim.Partes || intim.partes || "") as string;
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: "rgba(13,42,30,0.78)", backdropFilter: "blur(5px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-4 sm:p-6 pb-4 border-b border-border">
          <div className="flex-1 pr-4">
            <div className="text-[0.65rem] font-bold tracking-[0.12em] uppercase text-accent mb-2">
              📋 Publicação AASP
            </div>
            <h2 className="font-display text-base sm:text-lg font-bold text-foreground leading-snug">
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
        <div className="px-4 sm:px-6 pt-4 pb-0 flex flex-wrap gap-2">
          <span className="text-xs bg-muted/60 border border-border px-3 py-1 rounded-full font-medium">
            📅 {dataFmt}
          </span>
          {jornal && (
            <span className="text-xs bg-accent/10 border border-accent/30 px-3 py-1 rounded-full font-medium text-accent">
              📋 {jornal}
            </span>
          )}
          {meio && meio !== jornal && (
            <span className="text-xs bg-muted/60 border border-border px-3 py-1 rounded-full font-medium">
              {meio}
            </span>
          )}
        </div>

        {/* Corpo */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* Clientes vinculados */}
          {temCliente && (
            <div className="bg-emerald-500/8 border border-emerald-400/30 rounded-xl p-4">
              <div className="text-[0.65rem] font-black uppercase tracking-widest text-emerald-700 mb-2 flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5" />
                Cliente(s) Cadastrado(s) para este Processo
              </div>
              <div className="flex flex-col gap-2">
                {clientesVinculados.map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">{c.nome}</span>
                    {c.email && <span className="text-xs text-muted-foreground truncate">{c.email}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

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
          {intim._resumoIA ? (
            <div className="bg-accent/5 border-l-2 border-accent/60 rounded-r-xl p-4">
              <div className="text-[0.65rem] font-black uppercase tracking-widest text-accent mb-2">
                ✦ Análise IA
              </div>
              <p className="text-sm text-foreground leading-relaxed">{intim._resumoIA}</p>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onGerarResumo(intim)}
            >
              <Sparkles className="h-4 w-4 mr-2" /> Gerar Resumo com IA
            </Button>
          )}

          {/* Texto da publicação */}
          {texto && (
            <>
              <div className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">
                Texto da Publicação
              </div>
              <div className="bg-muted/30 border border-border rounded-xl p-4 text-sm text-foreground leading-relaxed max-h-60 sm:max-h-80 overflow-y-auto whitespace-pre-wrap">
                {texto}
              </div>
            </>
          )}

          {/* Nenhum conteúdo */}
          {!texto && !partes && !orgao && (
            <div className="text-sm text-muted-foreground italic">
              Nenhum conteúdo textual disponível nesta publicação.
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="px-4 sm:px-6 pb-6 flex flex-wrap gap-2 border-t border-border pt-4">
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
          <Button variant="gold" size="sm" onClick={() => { onCriarTarefa(intim); onClose(); }}>
            <Plus className="h-4 w-4 mr-1.5" /> Criar Tarefa
          </Button>
          <Button
            variant="outline" size="sm"
            className={temCliente
              ? "text-emerald-600 border-emerald-400/50 bg-emerald-500/5"
              : "text-emerald-600 border-emerald-300/60 hover:bg-emerald-50"}
            onClick={() => onNovoCliente(intim)}
            title={temCliente ? `Já cadastrado: ${clientesVinculados.map(c => c.nome).join(", ")}` : "Cadastrar novo cliente"}
          >
            {temCliente
              ? <><UserCheck className="h-4 w-4 mr-1.5" /> Cliente ✓</>
              : <><UserPlus className="h-4 w-4 mr-1.5" /> Novo Cliente</>}
          </Button>
          {temCliente && (
            <Button
              variant="outline" size="sm"
              className="text-blue-500 border-blue-300/60 hover:bg-blue-50"
              onClick={() => onReenviarEmail(intim)}
              disabled={enviandoEmail.has(intim._id)}
            >
              {enviandoEmail.has(intim._id)
                ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                : <Mail className="h-4 w-4 mr-1.5" />}
              E-mail
            </Button>
          )}
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

// ── Modal Novo Cliente (pré-preenchido da intimação) ───────────────────────────
function NovoClienteModal({
  intim,
  onClose,
  onCreate,
  saving,
  clientesVinculados = [],
}: {
  intim: AaspIntimacao;
  onClose: () => void;
  onCreate: (dados: any) => Promise<void>;
  saving: boolean;
  clientesVinculados?: { id: string; nome: string; email: string | null }[];
}) {
  // Pré-preenche nome com a primeira parte da intimação
  const partesRaw = intim._partes || (intim.Partes || intim.partes || "") as string;
  const primeiroNome = partesRaw.split(/[·×,]/)[0]?.trim() || "";

  const STATUS_PROCESSO_OPTIONS = [
    "Novo Caso", "Documentação Pendente", "Petição Inicial", "Protocolado",
    "Distribuído", "Citado", "Contestação", "Audiência Designada",
    "Audiência Realizada", "Produção de Provas", "Sentença", "Recurso",
    "Trânsito em Julgado", "Cumprimento de Sentença", "Arquivado",
  ];

  const [form, setForm] = React.useState({
    nome: primeiroNome,
    cpf_cnpj: "",
    email: "",
    telefone: "",
    endereco: "",
    observacoes: "",
    numeros_processo: intim._numProc ? [intim._numProc] : [] as string[],
    notificacoes_email: true,
    status_monitoramento: "ativo" as "ativo" | "pausado" | "inativo",
    status_processo: "Novo Caso" as string,
  });
  const [processoInput, setProcessoInput] = React.useState("");

  const adicionarProcesso = () => {
    const proc = processoInput.trim();
    if (proc && !form.numeros_processo.includes(proc)) {
      setForm(f => ({ ...f, numeros_processo: [...f.numeros_processo, proc] }));
    }
    setProcessoInput("");
  };

  const removerProcesso = (proc: string) =>
    setForm(f => ({ ...f, numeros_processo: f.numeros_processo.filter(p => p !== proc) }));

  const handleSalvar = async () => {
    if (!form.nome.trim()) { toast.error("Informe o nome do cliente."); return; }
    await onCreate({
      nome: form.nome,
      cpf_cnpj: form.cpf_cnpj || null,
      email: form.email || null,
      telefone: form.telefone || null,
      endereco: form.endereco || null,
      observacoes: form.observacoes || null,
      numeros_processo: form.numeros_processo.length > 0 ? form.numeros_processo : null,
      notificacoes_email: form.notificacoes_email,
      status_monitoramento: form.status_monitoramento,
      status_processo: form.status_processo || "Novo Caso",
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(13,42,30,0.82)", backdropFilter: "blur(5px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-border">
          <div>
            <div className="text-[0.65rem] font-bold tracking-[0.12em] uppercase text-emerald-600 mb-1">
              👤 Novo Cliente
            </div>
            <h2 className="font-display text-lg font-bold text-foreground">Cadastrar Cliente</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Dados pré-preenchidos da intimação</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Aviso: cliente já cadastrado */}
        {clientesVinculados.length > 0 && (
          <div className="mx-6 mt-4 bg-amber-500/10 border border-amber-400/40 rounded-xl p-3 flex items-start gap-2.5">
            <UserCheck className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-700">Atenção: cliente já cadastrado para este processo</p>
              <div className="mt-1 flex flex-col gap-0.5">
                {clientesVinculados.map(c => (
                  <span key={c.id} className="text-xs text-amber-700">
                    • {c.nome}{c.email ? ` — ${c.email}` : ""}
                  </span>
                ))}
              </div>
              <p className="text-[0.65rem] text-amber-600 mt-1">Você pode cadastrar outro cliente se necessário.</p>
            </div>
          </div>
        )}

        {/* Formulário */}
        <div className="p-6 space-y-4">
          {/* Nome */}
          <div>
            <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground block mb-1.5">
              Nome Completo *
            </label>
            <input
              value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              placeholder="Nome do cliente"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground block mb-1.5">CPF / CNPJ</label>
              <input
                value={form.cpf_cnpj}
                onChange={e => setForm(f => ({ ...f, cpf_cnpj: e.target.value }))}
                placeholder="000.000.000-00"
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground block mb-1.5">Telefone / WhatsApp</label>
              <input
                value={form.telefone}
                onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                placeholder="(11) 99999-9999"
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground block mb-1.5">E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="email@exemplo.com"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
            />
          </div>

          {/* Processos */}
          <div className="border border-border rounded-xl p-4 bg-muted/30">
            <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground mb-2 block">
              Números de Processo (CNJ)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                value={processoInput}
                onChange={e => setProcessoInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && adicionarProcesso()}
                placeholder="0000000-00.0000.0.00.0000"
                className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all font-mono"
              />
              <button
                onClick={adicionarProcesso}
                className="border border-border rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.numeros_processo.map(proc => (
                <div key={proc} className="inline-flex items-center gap-1.5 bg-accent/10 border border-accent/30 rounded-lg px-2.5 py-1 text-xs font-mono">
                  {proc}
                  <button onClick={() => removerProcesso(proc)} className="text-red-500 hover:text-red-700">×</button>
                </div>
              ))}
              {form.numeros_processo.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Nenhum processo adicionado</p>
              )}
            </div>
          </div>

          {/* Notificações + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-border rounded-xl p-3 bg-muted/30">
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground block mb-2">
                Notificação por E-mail
              </label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.notificacoes_email}
                  onChange={e => setForm(f => ({ ...f, notificacoes_email: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent" />
              </label>
            </div>
            <div className="border border-border rounded-xl p-3 bg-muted/30">
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground block mb-2">
                Status
              </label>
              <select
                value={form.status_monitoramento}
                onChange={e => setForm(f => ({ ...f, status_monitoramento: e.target.value as any }))}
                className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-card outline-none focus:border-accent"
              >
                <option value="ativo">Ativo</option>
                <option value="pausado">Pausado</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
            <div>
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground block mb-2">
                Fase do Processo
              </label>
              <select
                value={form.status_processo}
                onChange={e => setForm(f => ({ ...f, status_processo: e.target.value }))}
                className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-card outline-none focus:border-accent"
              >
                {STATUS_PROCESSO_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground block mb-1.5">Observações</label>
            <textarea
              value={form.observacoes}
              onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              placeholder="Notas sobre o cliente..."
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all min-h-[70px]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-2 justify-end border-t border-border pt-4">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button
            variant="gold"
            size="sm"
            onClick={handleSalvar}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <UserPlus className="h-4 w-4 mr-1.5" />}
            {saving ? "Salvando..." : "Cadastrar Cliente"}
          </Button>
        </div>
      </div>
    </div>
  );
}
