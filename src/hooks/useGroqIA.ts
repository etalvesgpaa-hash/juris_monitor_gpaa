/**
 * useGroqIA
 *
 * Hook compartilhado para geração de resumos IA via Groq.
 * Usado em IntimacoesPage e ProcessosPage.
 *
 * Funcionalidades:
 * - gerarResumoIntimacao: resume o texto de uma intimação AASP
 * - gerarResumoMovimentacoes: resume o histórico de movimentações de um processo
 * - Salva no localStorage (intimações) ou Supabase (movimentações de processos)
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const GROQ_URL  = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const DELAY_MS   = 600; // evita rate limit da Groq

async function chamarGroq(apiKey: string, systemPrompt: string, userContent: string, tentativa = 1): Promise<string> {
  const resp = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:       GROQ_MODEL,
      temperature: 0.3,
      max_tokens:  300,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userContent  },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });

  // Rate limit — aguarda e tenta novamente (até 3x)
  if (resp.status === 429 && tentativa <= 3) {
    const wait = tentativa * 8000; // 8s, 16s, 24s
    await new Promise(r => setTimeout(r, wait));
    return chamarGroq(apiKey, systemPrompt, userContent, tentativa + 1);
  }

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Erro na API Groq: ${err?.error?.message || `HTTP ${resp.status}`}`);
  }

  const data = await resp.json();
  const texto = data.choices?.[0]?.message?.content?.trim() || "";
  if (!texto) throw new Error("Resposta vazia da IA");
  return texto;
}

export function useGroqIA() {
  const { user } = useAuth();
  const [loadingIA, setLoadingIA] = useState(false);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 });

  const getGroqKey = useCallback(async (): Promise<string> => {
    const local = localStorage.getItem("jurismonitor_groq_key");
    if (local) return local;
    if (!user) return "";
    try {
      const { data } = await supabase
        .from("api_keys")
        .select("groq_api_key")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.groq_api_key) {
        localStorage.setItem("jurismonitor_groq_key", data.groq_api_key);
        return data.groq_api_key;
      }
    } catch (_) {}
    return "";
  }, [user]);

  // ── Resumo de uma intimação ─────────────────────────────────────────────────
  const gerarResumoIntimacao = useCallback(async (
    intimacao: any
  ): Promise<string | null> => {
    const apiKey = await getGroqKey();
    if (!apiKey) { toast.error("Configure a chave Groq em Configurações → API Keys."); return null; }

    const textoRaw = String(
      intimacao.textoPublicacao || intimacao.Texto || intimacao.texto ||
      intimacao.Conteudo || intimacao.conteudo || ""
    );

    // Quando texto principal vazio, monta a partir dos campos estruturados
    const texto = textoRaw.trim().length >= 50 ? textoRaw : [
      intimacao._numProc && `Processo: ${intimacao._numProc}`,
      intimacao._titulo && `Tipo: ${intimacao._titulo}`,
      intimacao._orgaoJulgador && `Órgão: ${intimacao._orgaoJulgador}`,
      intimacao._data && `Data: ${intimacao._data}`,
      intimacao._partes && `Partes: ${intimacao._partes}`,
      intimacao._orgaoPublicacao && `Publicação: ${intimacao._orgaoPublicacao}`,
      intimacao.TituloAssunto && `Assunto: ${intimacao.TituloAssunto}`,
    ].filter(Boolean).join("\n");

    if (texto.trim().length < 20) {
      toast.error("Sem informações suficientes para gerar resumo.");
      return null;
    }

    try {
      const resumo = await chamarGroq(
        apiKey,
        "Você é um assistente jurídico especializado em intimações judiciais. " +
        "Faça um resumo objetivo em até 3 frases, destacando: tipo de ato, prazo se houver, e ação necessária pelo advogado.",
        `Analise esta intimação e faça um resumo:\n\n${texto.slice(0, 4000)}`
      );
      return resumo;
    } catch (err: any) {
      console.error("[GroqIA] Erro intimação:", err.message);
      toast.error(`Erro IA: ${err.message}`);
      return null;
    }
  }, [getGroqKey]);

  // ── Resumo das movimentações de um processo ─────────────────────────────────
  const gerarResumoProcesso = useCallback(async (
    processo: any,
    movimentacoes: any[]
  ): Promise<string | null> => {
    const apiKey = await getGroqKey();
    if (!apiKey) { toast.error("Configure a chave Groq em Configurações → API Keys."); return null; }
    if (!movimentacoes.length) { toast.error("Sem movimentações para resumir."); return null; }

    // Monta histórico das últimas 20 movimentações
    const historico = movimentacoes
      .slice(0, 20)
      .map((m: any, i: number) =>
        `${i + 1}. [${m.data || m.dataISO || "—"}] ${m.tipo || m.titulo || "Movimentação"}${m.descricao ? `: ${m.descricao}` : ""}`
      )
      .join("\n");

    const contexto = [
      processo.classe && `Classe: ${processo.classe}`,
      processo.assunto && `Assunto: ${processo.assunto}`,
      processo.tribunal && `Tribunal: ${processo.tribunal}`,
      processo.partes && `Partes: ${processo.partes}`,
    ].filter(Boolean).join(" | ");

    try {
      const resumo = await chamarGroq(
        apiKey,
        "Você é um assistente jurídico especializado em análise processual. " +
        "Analise o histórico de movimentações do processo e faça um resumo executivo em até 4 frases, destacando: " +
        "fase atual do processo, últimas decisões relevantes, prazos em aberto e próximos passos recomendados ao advogado.",
        `Processo: ${processo.numero_cnj || processo.id}\n${contexto}\n\nHistórico de movimentações (mais recentes primeiro):\n${historico}`
      );
      return resumo;
    } catch (err: any) {
      console.error("[GroqIA] Erro processo:", err.message);
      toast.error(`Erro IA: ${err.message}`);
      return null;
    }
  }, [getGroqKey]);

  // ── Gerar TODOS os resumos de intimações ───────────────────────────────────
  const gerarTodosResumosIntimacoes = useCallback(async (
    intimacoes: any[],
    onResumo: (id: string, resumo: string) => void
  ) => {
    const apiKey = await getGroqKey();
    if (!apiKey) { toast.error("Configure a chave Groq em Configurações → API Keys."); return; }

    const semResumo = intimacoes.filter(it =>
      (it._status === "ativa" || !it._status) && !it._resumoIA
    );
    if (!semResumo.length) { toast.info("Todas as intimações já possuem resumo IA."); return; }
    if (!confirm(`Gerar resumo IA para ${semResumo.length} intimação(ões)? Isso pode levar alguns minutos.`)) return;

    setLoadingIA(true);
    setProgresso({ atual: 0, total: semResumo.length });
    let ok = 0, fail = 0;

    for (let i = 0; i < semResumo.length; i++) {
      setProgresso({ atual: i + 1, total: semResumo.length });
      const resumo = await gerarResumoIntimacao(semResumo[i]);
      if (resumo) { onResumo(semResumo[i]._id, resumo); ok++; }
      else fail++;
      if (i < semResumo.length - 1) await new Promise(r => setTimeout(r, DELAY_MS));
    }

    setLoadingIA(false);
    setProgresso({ atual: 0, total: 0 });
    toast.success(`${ok} resumo(s) gerado(s)${fail > 0 ? `, ${fail} com erro` : ""}.`);
  }, [getGroqKey, gerarResumoIntimacao]);

  // ── Gerar TODOS os resumos de processos ────────────────────────────────────
  const gerarTodosResumosProcessos = useCallback(async (
    processos: any[],
    getMovimentacoes: (id: string) => Promise<any[]>,
    onResumo: (id: string, resumo: string) => Promise<void>
  ) => {
    const apiKey = await getGroqKey();
    if (!apiKey) { toast.error("Configure a chave Groq em Configurações → API Keys."); return; }

    const candidatos = processos.filter(p => !p.resumo_ia);
    if (!candidatos.length) { toast.info("Todos os processos já possuem resumo IA."); return; }
    if (!confirm(`Gerar resumo IA para ${candidatos.length} processo(s)? Isso pode levar alguns minutos.`)) return;

    setLoadingIA(true);
    setProgresso({ atual: 0, total: candidatos.length });
    let ok = 0, fail = 0;

    for (let i = 0; i < candidatos.length; i++) {
      setProgresso({ atual: i + 1, total: candidatos.length });
      try {
        const movs = await getMovimentacoes(candidatos[i].id);
        if (!movs.length) { fail++; continue; }
        const resumo = await gerarResumoProcesso(candidatos[i], movs);
        if (resumo) { await onResumo(candidatos[i].id, resumo); ok++; }
        else fail++;
      } catch (_) { fail++; }
      if (i < candidatos.length - 1) await new Promise(r => setTimeout(r, DELAY_MS));
    }

    setLoadingIA(false);
    setProgresso({ atual: 0, total: 0 });
    toast.success(`${ok} resumo(s) de processo gerado(s)${fail > 0 ? `, ${fail} com erro` : ""}.`);
  }, [getGroqKey, gerarResumoProcesso]);

  return {
    loadingIA,
    progresso,
    getGroqKey,
    gerarResumoIntimacao,
    gerarResumoProcesso,
    gerarTodosResumosIntimacoes,
    gerarTodosResumosProcessos,
  };
}
