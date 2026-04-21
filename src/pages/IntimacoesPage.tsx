import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClientes } from "@/hooks/useClientes";
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
import { RefreshCw, RotateCcw, TableIcon, LayoutGrid, Eye, CheckCircle, Pause, PlayCircle, Trash2, AlertCircle, Loader2, X, FileText, Flag, Plus, Sparkles } from "lucide-react";

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

/** Extrai órgão de publicação da intimação (ex: DJENTJSP) */
function extrairOrgaoPublicacao(intim: AaspIntimacao): string {
  // A API AASP retorna jornal como objeto: { nomeJornal: "DJENTJSP", ... }
  const jornal = (intim as any).jornal;
  if (jornal?.nomeJornal) return String(jornal.nomeJornal).toUpperCase();

  // Fallbacks para outros formatos
  const nomeJornal = (intim.NomeJornal || intim.nomeJornal || "") as string;
  const meio = (intim.Meio || intim.meio || "") as string;
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
  const { data: feriados = [] } = useFeriados();
  const { data: processos = [] } = useProcessos();
  const createTarefa = useCreateTarefa();

  // Estado do modal de criação de tarefa
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskModalInitialData, setTaskModalInitialData] = useState<any>(null);

  const [intimacoes, setIntimacoes] = useState<AaspIntimacao[]>(() => loadStore());
  const [aaspKey, setAaspKey] = useState<string>("");
  const [groqKey, setGroqKey] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingDia, setLoadingDia] = useState<string | null>(null);
  const [loadingIA, setLoadingIA] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<"ativa" | "finalizada" | "pausada">("ativa");
  const [filtroDia, setFiltroDia] = useState<string>("");
  const [filtroData, setFiltroData] = useState<string>("todos"); // "todos" ou YYYY-MM-DD
  const [viewMode, setViewMode] = useState<"tabela" | "cards">(() =>
    window.innerWidth < 768 ? "cards" : "tabela"
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

  /** Busca intimações de um dia */
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
          
          if (!resp.ok) continue;
          
          const text = await resp.text();
          
          if (!text.trim()) continue;

          let raw: unknown = null;
          
          try { 
            raw = JSON.parse(text);
          } catch (parseErr) { 
            try {
              const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
              if (jsonMatch) raw = JSON.parse(jsonMatch[0]);
            } catch {}
          }

          if (!raw) continue;

          let arr = normalizar(raw);
          if (arr.length === 0) continue;

          arr = arr.map((it, idx) => {
            const id = gerarId(it, idx);
            const existente = intimacoes.find((x) => x._id === id);
            // DEBUG: log todos os campos da primeira intimação para diagnóstico
            if (idx === 0) {
              console.log("[AASP DEBUG] Campos disponíveis na intimação:", Object.keys(it));
              console.log("[AASP DEBUG] Dados completos:", JSON.stringify(it, null, 2));
            }
            return {
              ...it,
              _id: id,
              _data: dataStr,
              _lida: existente?._lida || false,
              _status: existente?._status || "ativa",
              _resumoIA: existente?._resumoIA || null,
              _titulo: it.TituloAssunto || it.Assunto || (it as any).titulo || (it as any).cabecalho?.replace(/\r\n|\n/g, "").trim() || "Publicação AASP",
              _numProc: extrairNumProc(it),
              _orgaoPublicacao: extrairOrgaoPublicacao(it),
              _partes: extrairPartes(it),
              _orgaoJulgador: extrairOrgaoJulgador(it),
            };
          });

          if (!silencioso) toast.success(`${arr.length} intimação(ões) encontrada(s) em ${fmtData(dataStr)}`);
          return arr;
        } catch (err) {
          console.error(`[AASP] Erro ao buscar ${dataStr} via ${p.nome}:`, err);
        }
      }

      if (!silencioso) toast.error(`Nenhuma intimação retornada para ${fmtData(dataStr)}.`);
      return [];
    },
    [aaspKey, intimacoes]
  );

  /** Atualizar (últimos 5 dias úteis) */
  const atualizar = async () => {
    if (!aaspKey) {
      toast.error("Configure sua chave AASP nas Configurações.");
      return;
    }
    setLoading(true);
    const dias = diasUteisRecentes(5);
    const novas: AaspIntimacao[] = [];
    for (const d of dias) {
      setLoadingDia(d);
      const arr = await buscarDia(d, true);
      novas.push(...arr);
    }
    setLoadingDia(null);
    setLoading(false);

    const merged = [...novas, ...intimacoes];
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
    toast.success(`${novas.length} intimação(ões) encontrada(s).`);
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
  };

  /** Gerar resumo IA para uma intimação */
  const gerarResumoIA = async (intimacao: AaspIntimacao) => {
    if (!groqKey) {
      toast.error("Configure sua chave Groq nas Configurações para usar IA.");
      return;
    }

    const texto = (
      intimacao.textoPublicacao ||
      intimacao.Texto ||
      intimacao.texto ||
      intimacao.Conteudo ||
      intimacao.conteudo ||
      ""
    ) as string;

    if (!texto || texto.trim().length < 50) {
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
      const resumo = data.choices?.[0]?.message?.content?.trim() || "";

      if (!resumo) {
        throw new Error("Resumo vazio retornado pela IA");
      }

      // Atualiza no estado
      setIntimacoes((prev) =>
        prev.map((it) =>
          it._id === intimacao._id ? { ...it, _resumoIA: resumo } : it
        )
      );

      // Salva no localStorage
      const updated = intimacoes.map((it) =>
        it._id === intimacao._id ? { ...it, _resumoIA: resumo } : it
      );
      saveStore(updated);

      toast.success("Resumo IA gerado com sucesso!");
      return resumo;
    } catch (err: any) {
      console.error("Erro ao gerar resumo IA:", err);
      toast.error(`Erro ao gerar resumo: ${err.message}`);
      return null;
    }
  };

  /** Gerar resumos IA para todas as intimações ativas sem resumo */
  const gerarTodosResumosIA = async () => {
    if (!groqKey) {
      toast.error("Configure sua chave Groq nas Configurações para usar IA.");
      return;
    }

    const semResumo = intimacoes.filter(
      (it) => it._status === "ativa" && !it._resumoIA
    );

    if (semResumo.length === 0) {
      toast.info("Todas as intimações ativas já possuem resumo IA.");
      return;
    }

    if (!confirm(`Gerar resumo IA para ${semResumo.length} intimação(ões)? Isso pode levar alguns minutos.`)) {
      return;
    }

    setLoadingIA(true);
    let sucesso = 0;
    let erro = 0;

    for (const intimacao of semResumo) {
      const resumo = await gerarResumoIA(intimacao);
      if (resumo) {
        sucesso++;
      } else {
        erro++;
      }
      // Pequeno delay para evitar rate limit
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setLoadingIA(false);
    toast.success(`${sucesso} resumos gerados com sucesso${erro > 0 ? `, ${erro} com erro` : ''}.`);
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
        status: data.status || "pendente",
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
  };

  const setStatus = (id: string, status: AaspIntimacao["_status"]) => {
    setIntimacoes((prev) => {
      const updated = prev.map((it) => (it._id === id ? { ...it, _status: status } : it));
      saveStore(updated);
      return updated;
    });
    toast.success("Status atualizado.");
  };

  const excluir = (id: string) => {
    if (!confirm("Excluir esta intimação?")) return;
    setIntimacoes((prev) => {
      const updated = prev.filter((it) => it._id !== id);
      saveStore(updated);
      return updated;
    });
    toast.success("Intimação excluída.");
  };

  const limparTudo = () => {
    if (!confirm("Limpar TODAS as intimações? Esta ação não pode ser desfeita.")) return;
    setIntimacoes([]);
    saveStore([]);
    toast.success("Todas as intimações foram removidas.");
  };

  // Gera os últimos 7 dias usando data LOCAL (sem bug UTC: toISOString retorna UTC que no Brasil vira dia anterior)
  const ultimos7Dias = (() => {
    const dias: string[] = [];
    const d = new Date();
    for (let i = 0; i < 7; i++) {
      const ano = d.getFullYear();
      const mes = String(d.getMonth() + 1).padStart(2, "0");
      const dia = String(d.getDate()).padStart(2, "0");
      dias.push(`${ano}-${mes}-${dia}`);
      d.setDate(d.getDate() - 1);
    }
    
    // DEBUG: Verificar distribuição de intimações
    console.log("=== DEBUG: Distribuição de Intimações ===");
    console.log("Filtro de status atual:", filtroStatus);
    console.log("Total de intimações:", intimacoes.length);
    console.log("Intimações por status:", {
      ativa: intimacoes.filter(i => i._status === "ativa").length,
      finalizada: intimacoes.filter(i => i._status === "finalizada").length,
      pausada: intimacoes.filter(i => i._status === "pausada").length,
    });
    
    const distribuicao = {};
    dias.forEach(dia => {
      const total = intimacoes.filter(i => i._data === dia).length;
      const ativas = intimacoes.filter(i => i._data === dia && i._status === "ativa").length;
      if (total > 0) {
        distribuicao[dia] = { total, ativas };
      }
    });
    console.log("Distribuição por dia:", distribuicao);
    
    return dias;
  })();

  // Contagem de intimações por dia (todas, independente do status)
  const contagemPorDia = intimacoes.reduce<Record<string, number>>((acc, it) => {
    acc[it._data] = (acc[it._data] || 0) + 1;
    return acc;
  }, {});

  const filtradas = intimacoes.filter((it) => {
    if (it._status !== filtroStatus) return false;
    if (filtroData !== "todos" && it._data !== filtroData) return false;
    return true;
  });

  const renderLinha = (intim: AaspIntimacao) => {
    const naoLida = intim._status === "ativa" && !intim._lida;
    const jornal = intim._orgaoPublicacao || (intim.NomeJornal || intim.nomeJornal || "") as string;
    const orgao = intim._orgaoJulgador || (intim.OrgaoJulgador || intim.orgaoJulgador || "") as string;
    const partes = intim._partes || (intim.Partes || intim.partes || "") as string;
    const meio = (intim.Meio || intim.meio || "") as string;
    
    return (
      <tr key={intim._id} className={`border-b border-border ${naoLida ? "bg-accent/5" : ""}`}>
        <td className="px-3 py-2.5 align-top">
          <div className="flex items-center gap-1.5">
            {naoLida && <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />}
            <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">{fmtData(intim._data)}</span>
          </div>
        </td>
        <td className="px-3 py-2.5 align-top">
          {intim._numProc ? (
            <div className="font-mono text-xs font-bold text-accent break-all">{intim._numProc}</div>
          ) : (
            <span className="text-xs text-muted-foreground italic">—</span>
          )}
        </td>
        <td className="px-3 py-2.5 align-top">
          <div className="text-xs font-semibold truncate max-w-[200px]">{intim._titulo}</div>
        </td>
        <td className="px-3 py-2.5 align-top">
          {orgao ? (
            <div className="text-[0.7rem] text-foreground max-w-[180px]">{orgao}</div>
          ) : (
            <span className="text-xs text-muted-foreground italic">—</span>
          )}
        </td>
        <td className="px-3 py-2.5 align-top">
          {meio ? (
            <div className="text-[0.7rem] text-accent font-medium">{meio}</div>
          ) : jornal ? (
            <div className="text-[0.7rem] text-accent font-medium">{jornal}</div>
          ) : (
            <span className="text-xs text-muted-foreground italic">—</span>
          )}
        </td>
        <td className="px-3 py-2.5 align-top max-w-[200px]">
          {partes ? (
            <div className="text-[0.7rem] text-foreground truncate" title={partes}>{partes}</div>
          ) : (
            <span className="text-xs text-muted-foreground italic">—</span>
          )}
        </td>
        <td className="px-3 py-2.5 align-top max-w-[250px]">
          {intim._resumoIA ? (
            <div className="text-xs text-foreground leading-relaxed">{intim._resumoIA}</div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground hover:text-accent"
              onClick={() => gerarResumoIA(intim)}
            >
              <Sparkles className="h-3 w-3 mr-1" /> Gerar Resumo IA
            </Button>
          )}
        </td>
        <td className="px-3 py-2.5 align-top">
          <StatusBadge status={intim._status || "ativa"} nova={naoLida} />
        </td>
        <td className="px-3 py-2.5 align-top">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1">
              <ActionBtn title="Visualizar" onClick={() => { marcarLida(intim._id); setSelected(intim); }}>
                <Eye className="h-3.5 w-3.5" />
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
    const jornal = intim._orgaoPublicacao || (intim.NomeJornal || intim.nomeJornal || "") as string;
    const orgao = intim._orgaoJulgador || (intim.OrgaoJulgador || intim.orgaoJulgador || "") as string;
    const partes = intim._partes || (intim.Partes || intim.partes || "") as string;
    const meio = (intim.Meio || intim.meio || "") as string;
    
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
              <div className="font-mono text-sm font-bold text-accent break-all">{intim._numProc}</div>
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
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Intimações AASP</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {intimacoes.length} intimação(ões) armazenada(s) localmente
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant={viewMode === "tabela" ? "default" : "outline"} size="sm" onClick={() => setViewMode("tabela")}>
            <TableIcon className="w-4 h-4" />
          </Button>
          <Button variant={viewMode === "cards" ? "default" : "outline"} size="sm" onClick={() => setViewMode("cards")}>
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={atualizar} disabled={loading || !aaspKey}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={gerarTodosResumosIA} disabled={loadingIA || !groqKey}>
            {loadingIA ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          </Button>
          <Button variant="destructive" size="sm" onClick={limparTudo}>
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Barra de controles: status + filtro por dia + ações */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {/* Filtros de status */}
        <div className="flex gap-2 flex-wrap">
          {(["ativa", "finalizada", "pausada"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFiltroStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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
            <SelectTrigger className="w-52 text-xs h-9 border border-border bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos" className="text-xs">
                Todos os dias ({intimacoes.filter(i => i._status === filtroStatus).length})
              </SelectItem>
              {ultimos7Dias.map((dia) => {
                const count = intimacoes.filter(i => i._data === dia && i._status === filtroStatus).length;
                const countTotal = intimacoes.filter(i => i._data === dia).length;
                
                // DEBUG: Log para investigar
                if (countTotal > 0 && count === 0) {
                  console.log(`DEBUG: Dia ${dia} tem ${countTotal} intimações, mas 0 com status ${filtroStatus}`);
                  console.log('Status das intimações deste dia:', 
                    intimacoes.filter(i => i._data === dia).map(i => ({ id: i._id, status: i._status }))
                  );
                }
                
                const [ano, mes, d] = dia.split("-");
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
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Buscar novo dia na AASP</label>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  {["DATA", "PROCESSO", "TÍTULO", "ÓRGÃO", "TIPO COMUNICAÇÃO", "PARTES", "RESUMO IA", "STATUS", "AÇÕES"].map((h) => (
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
          onCriarTarefa={criarTarefaDeIntimacao}
          onGerarResumo={gerarResumoIA}
        />
      )}

      {/* Modal de Criação de Tarefa */}
      <CreateTaskModal
        open={showTaskModal}
        onClose={() => { setShowTaskModal(false); setTaskModalInitialData(null); }}
        onSubmit={handleSubmitTarefa}
        initialData={taskModalInitialData}
        processos={processos}
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
  onCriarTarefa,
  onGerarResumo,
}: {
  intim: AaspIntimacao;
  onClose: () => void;
  onSetStatus: (id: string, s: AaspIntimacao["_status"]) => void;
  onExcluir: (id: string) => void;
  onCriarTarefa: (intim: AaspIntimacao) => void;
  onGerarResumo: (intim: AaspIntimacao) => void;
}) {
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
          <Button variant="gold" size="sm" onClick={() => { onCriarTarefa(intim); onClose(); }}>
            <Plus className="h-4 w-4 mr-1.5" /> Criar Tarefa
          </Button>
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
