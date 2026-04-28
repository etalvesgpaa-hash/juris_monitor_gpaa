import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

// ── Tipos ──────────────────────────────────────────────────────
interface StepResult {
  label: string;
  status: "ok" | "erro" | "aviso" | "info";
  detalhe: string;
  extra?: string; // JSON preview ou body
}

// ── Helpers ────────────────────────────────────────────────────
function dataHoje(): string {
  const d = new Date();
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`; // DD/MM/YYYY — formato que a AASP espera
}

function dataHojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function testarUrl(url: string, label: string, timeoutMs = 15000): Promise<StepResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timer);

    const text = await resp.text().catch(() => "");
    const upstreamStatus = resp.headers.get("X-Upstream-Status");
    const bodyPreview = resp.headers.get("X-Upstream-Body-Preview");
    let bodyDecoded = "";
    try { bodyDecoded = bodyPreview ? decodeURIComponent(bodyPreview) : ""; } catch (_) { bodyDecoded = bodyPreview || ""; }

    if (!resp.ok) {
      // Tenta extrair mensagem de erro do body
      let errMsg = "";
      try { errMsg = JSON.parse(text)?.detail || JSON.parse(text)?.error || ""; } catch (_) {}
      return {
        label,
        status: "erro",
        detalhe: `HTTP ${resp.status}${upstreamStatus ? ` (AASP retornou: ${upstreamStatus})` : ""}${errMsg ? ` — ${errMsg}` : ""}`,
        extra: bodyDecoded || text.slice(0, 400),
      };
    }

    // Tenta parsear JSON
    let parsed: unknown = null;
    try { parsed = JSON.parse(text); } catch (_) {}

    if (!parsed) {
      return {
        label,
        status: "aviso",
        detalhe: `HTTP ${resp.status} mas resposta não é JSON válido`,
        extra: text.slice(0, 400),
      };
    }

    // Conta registros
    const arr = extrairArray(parsed);
    return {
      label,
      status: arr.length > 0 ? "ok" : "aviso",
      detalhe: arr.length > 0
        ? `✓ ${arr.length} intimação(ões) retornada(s)`
        : `HTTP ${resp.status} mas array vazio — AASP pode não ter publicações para esta data`,
      extra: JSON.stringify(parsed).slice(0, 600),
    };
  } catch (e: any) {
    clearTimeout(timer);
    const isAbort = e.name === "AbortError";
    const isCsp = e.message?.includes("Content Security Policy") || e.message?.includes("violates");
    return {
      label,
      status: "erro",
      detalhe: isAbort
        ? `Timeout após ${timeoutMs / 1000}s`
        : isCsp
        ? "Bloqueado pelo CSP do Vercel (domínio não está na connect-src)"
        : e.message || "Erro desconhecido",
    };
  }
}

function extrairArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  const campos = ["Intimacoes","intimacoes","Data","data","Publicacoes","publicacoes","Registros","registros","Items","items","Results","results"];
  for (const c of campos) {
    if (Array.isArray(obj[c])) return obj[c] as unknown[];
  }
  for (const v of Object.values(obj)) {
    if (Array.isArray(v) && v.length > 0) return v as unknown[];
  }
  return [];
}

// ── Componente ─────────────────────────────────────────────────
export function DiagnosticoAasp() {
  const [chave, setChave] = useState<string>(
    () => localStorage.getItem("jurismonitor_aasp_key") || ""
  );
  const [rodando, setRodando] = useState(false);
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [expandido, setExpandido] = useState<number | null>(null);
  const [concluido, setConcluido] = useState(false);

  const addStep = (step: StepResult, prev: StepResult[]) => [...prev, step];

  const rodar = async () => {
    if (!chave.trim()) {
      alert("Informe a chave AASP antes de rodar o diagnóstico.");
      return;
    }
    setRodando(true);
    setConcluido(false);
    setSteps([]);
    setExpandido(null);

    let resultado: StepResult[] = [];
    const push = (s: StepResult) => {
      resultado = addStep(s, resultado);
      setSteps([...resultado]);
    };

    // ── STEP 1: proxy acessível ──────────────────────────────────
    push({ label: "Verificando /api/proxy...", status: "info", detalhe: "Aguarde..." });
    const pingUrl = `/api/proxy?url=${encodeURIComponent("https://intimacaoapi.aasp.org.br/")}`;
    const ping = await testarUrl(pingUrl, "Proxy /api/proxy acessível", 8000);
    // Qualquer resposta (mesmo 403/404 da AASP) significa que o proxy está de pé
    resultado[resultado.length - 1] = {
      ...ping,
      label: "Proxy /api/proxy acessível",
      status: ping.status === "erro" && ping.detalhe.includes("Timeout") ? "erro" : "ok",
      detalhe: ping.status === "erro" && ping.detalhe.includes("Timeout")
        ? "Proxy não respondeu — Vercel pode estar fora"
        : "Proxy respondeu (mesmo que a AASP retorne 404 aqui, o proxy funciona)",
    };
    setSteps([...resultado]);

    // ── STEP 2: formato BR (DD/MM/YYYY) ──────────────────────────
    const dataBR = dataHoje();
    const aaspUrlBR = `https://intimacaoapi.aasp.org.br/api/Associado/intimacao/json?chave=${encodeURIComponent(chave.trim())}&data=${dataBR}`;
    push({ label: `Testando data BR (${dataBR}) via proxy`, status: "info", detalhe: "Aguarde..." });
    const resBR = await testarUrl(
      `/api/proxy?url=${encodeURIComponent(aaspUrlBR)}`,
      `Formato BR (${dataBR}) via proxy`,
      20000
    );
    resultado[resultado.length - 1] = resBR;
    setSteps([...resultado]);

    // ── STEP 3: formato ISO (YYYY-MM-DD) ─────────────────────────
    const dataISO = dataHojeISO();
    const aaspUrlISO = `https://intimacaoapi.aasp.org.br/api/Associado/intimacao/json?chave=${encodeURIComponent(chave.trim())}&data=${dataISO}`;
    push({ label: `Testando data ISO (${dataISO}) via proxy`, status: "info", detalhe: "Aguarde..." });
    const resISO = await testarUrl(
      `/api/proxy?url=${encodeURIComponent(aaspUrlISO)}`,
      `Formato ISO (${dataISO}) via proxy`,
      20000
    );
    resultado[resultado.length - 1] = resISO;
    setSteps([...resultado]);

    // ── STEP 4: chave válida? ─────────────────────────────────────
    const chaveSemDados = resBR.status === "aviso" && resISO.status === "aviso";
    const chaveErro = resBR.status === "erro" && resISO.status === "erro";
    if (chaveErro) {
      push({
        label: "Validação da chave AASP",
        status: "erro",
        detalhe: "Ambos os formatos retornaram erro. Verifique se a chave AASP está correta e ativa.",
      });
    } else if (chaveSemDados) {
      push({
        label: "Validação da chave AASP",
        status: "aviso",
        detalhe: "Chave aceita pela AASP, mas sem publicações hoje. Isso é normal fora do horário de publicação ou em dias sem movimentação.",
      });
    } else {
      const melhor = resBR.status === "ok" ? resBR : resISO;
      const fmtUsado = resBR.status === "ok" ? "BR (DD/MM/YYYY)" : "ISO (YYYY-MM-DD)";
      push({
        label: "Formato de data preferido",
        status: "ok",
        detalhe: `Usar formato ${fmtUsado} — ${melhor.detalhe}`,
      });
    }

    // ── STEP 5: verifica CSP (corsproxy.io deve estar BLOQUEADO) ──
    push({ label: "Verificando CSP (corsproxy.io deve ser bloqueado)", status: "info", detalhe: "Aguarde..." });
    const cspTest = await testarUrl(
      `https://corsproxy.io/?url=${encodeURIComponent("https://intimacaoapi.aasp.org.br/")}`,
      "corsproxy.io",
      5000
    );
    resultado[resultado.length - 1] = {
      label: "CSP: corsproxy.io",
      status: cspTest.status === "erro" && cspTest.detalhe.includes("CSP")
        ? "ok"  // bloqueado como esperado
        : "aviso",
      detalhe: cspTest.status === "erro" && cspTest.detalhe.includes("CSP")
        ? "✓ Bloqueado pelo CSP como esperado — não será usado como fallback"
        : `Inesperado: ${cspTest.detalhe}`,
    };
    setSteps([...resultado]);

    setRodando(false);
    setConcluido(true);
  };

  const statusIcon = (s: StepResult["status"]) => {
    if (s === "ok") return <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />;
    if (s === "erro") return <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
    if (s === "aviso") return <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />;
    return <Loader2 className="h-4 w-4 text-blue-400 animate-spin flex-shrink-0" />;
  };

  const statusBadge = (s: StepResult["status"]) => {
    const map = { ok: "bg-green-500/10 text-green-400", erro: "bg-red-500/10 text-red-400", aviso: "bg-yellow-500/10 text-yellow-400", info: "bg-blue-500/10 text-blue-400" };
    const labels = { ok: "OK", erro: "ERRO", aviso: "AVISO", info: "..." };
    return <span className={`text-[0.6rem] font-bold px-2 py-0.5 rounded-full ${map[s]}`}>{labels[s]}</span>;
  };

  const resumo = concluido ? {
    erros: steps.filter(s => s.status === "erro").length,
    avisos: steps.filter(s => s.status === "aviso").length,
    oks: steps.filter(s => s.status === "ok").length,
  } : null;

  return (
    <div className="bg-card border border-border rounded-2xl p-6 max-w-2xl mx-auto">
      <div className="mb-5">
        <h2 className="font-display text-xl font-bold">🔍 Diagnóstico AASP</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Testa cada etapa da conexão com a API da AASP para identificar exatamente onde está o problema.
        </p>
      </div>

      {/* Chave */}
      <div className="mb-4">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Chave AASP
        </label>
        <input
          type="text"
          value={chave}
          onChange={(e) => setChave(e.target.value)}
          placeholder="Cole sua chave AASP aqui"
          className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-background font-mono focus:border-accent outline-none"
        />
      </div>

      <Button onClick={rodar} disabled={rodando || !chave.trim()} className="w-full mb-5">
        {rodando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {rodando ? "Rodando diagnóstico..." : "▶ Rodar Diagnóstico"}
      </Button>

      {/* Resumo */}
      {resumo && (
        <div className="flex gap-3 mb-4 flex-wrap">
          {resumo.oks > 0 && <span className="text-xs bg-green-500/10 text-green-400 px-3 py-1 rounded-full font-bold">{resumo.oks} OK</span>}
          {resumo.avisos > 0 && <span className="text-xs bg-yellow-500/10 text-yellow-400 px-3 py-1 rounded-full font-bold">{resumo.avisos} aviso(s)</span>}
          {resumo.erros > 0 && <span className="text-xs bg-red-500/10 text-red-400 px-3 py-1 rounded-full font-bold">{resumo.erros} erro(s)</span>}
        </div>
      )}

      {/* Steps */}
      {steps.length > 0 && (
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={i} className="border border-border rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                onClick={() => setExpandido(expandido === i ? null : i)}
              >
                {statusIcon(step.status)}
                <span className="flex-1 text-sm font-medium">{step.label}</span>
                {statusBadge(step.status)}
                {step.extra && (expandido === i
                  ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                  : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
              <div className="px-4 pb-3 text-xs text-muted-foreground -mt-1">{step.detalhe}</div>
              {step.extra && expandido === i && (
                <div className="mx-4 mb-3 bg-muted/40 border border-border rounded-lg p-3 font-mono text-[0.65rem] text-foreground whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                  {step.extra}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Conclusão */}
      {concluido && resumo && (
        <div className={`mt-5 rounded-xl p-4 border text-sm ${
          resumo.erros > 0
            ? "bg-red-500/5 border-red-500/20 text-red-300"
            : resumo.avisos > 0
            ? "bg-yellow-500/5 border-yellow-500/20 text-yellow-300"
            : "bg-green-500/5 border-green-500/20 text-green-300"
        }`}>
          {resumo.erros > 0
            ? "❌ Foram encontrados erros. Expanda os itens acima para ver o detalhe exato de cada falha."
            : resumo.avisos > 0
            ? "⚠️ Conexão OK, mas sem publicações retornadas. Isso é normal se hoje não houver publicações para sua conta AASP."
            : "✅ Tudo funcionando. O proxy está conectando na AASP e retornando publicações."}
        </div>
      )}
    </div>
  );
}
