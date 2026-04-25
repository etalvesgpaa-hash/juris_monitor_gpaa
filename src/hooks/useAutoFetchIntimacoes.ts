/**
 * useAutoFetchIntimacoes
 *
 * Executa a busca de intimações AASP automaticamente assim que o usuário
 * faz login. Roda apenas UMA vez por sessão (controle via sessionStorage).
 *
 * Uso: chame este hook dentro do AppLayout (ou qualquer componente que só
 * renderiza quando o usuário já está autenticado).
 */

import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ── Tipos mínimos necessários ─────────────────────────────────
interface AaspIntimacao {
  _id: string;
  _data: string;
  _lida: boolean;
  _status: "ativa" | "finalizada" | "pausada";
  _resumoIA?: string | null;
  _titulo?: string;
  _numProc?: string;
  _orgaoPublicacao?: string;
  _partes?: string;
  _orgaoJulgador?: string;
  [key: string]: unknown;
}

// ── Chave de sessão — evita rebuscar ao mudar de página ──────
const SESSION_FLAG = "jm_auto_fetch_done";
const STORE_KEY = "jm_aasp_intimacoes";

// ── Helpers (idênticos ao IntimacoesPage) ────────────────────
function dataLocalStr(d: Date): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

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

function gerarId(intim: AaspIntimacao, idx = 0): string {
  const codRel = (intim as any).codigoRelacionamento || (intim as any).CodigoRelacionamento;
  if (codRel && String(codRel) !== "0") return "aasp_" + String(codRel);
  const idApi =
    (intim as any).Id || (intim as any).id ||
    (intim as any).CodigoIntimacao || (intim as any).codigoIntimacao;
  if (idApi && String(idApi) !== "0") return String(idApi);
  const jornal = (intim as any).jornal;
  const numProc = (intim as any).numeroUnicoProcesso || intim.NumeroProcesso || intim.numeroProcesso || "";
  const data =
    (jornal && (jornal.dataDisponibilizacao_Publicacao || jornal.dataTratamento)) ||
    intim.DataDisponibilizacao || intim.dataDisponibilizacao || intim.Data || "";
  const titulo = (intim as any).titulo || intim.TituloAssunto || intim.Assunto || "";
  const texto = ((intim.textoPublicacao || intim.Texto || intim.texto || "") as string).slice(0, 400);
  const raw = `${numProc}|${String(data).slice(0, 19)}|${titulo}|${idx}|${texto}`;
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) hash = ((hash << 5) + hash + raw.charCodeAt(i)) | 0;
  return "det_" + Math.abs(hash).toString(36);
}

function normalizar(raw: unknown): AaspIntimacao[] {
  if (Array.isArray(raw)) return raw as AaspIntimacao[];
  if (Array.isArray((raw as any)?.Intimacoes)) return (raw as any).Intimacoes;
  if (Array.isArray((raw as any)?.Data)) return (raw as any).Data;
  if (Array.isArray((raw as any)?.intimacoes)) return (raw as any).intimacoes;
  for (const v of Object.values((raw as object) || {})) {
    if (Array.isArray(v)) return v as AaspIntimacao[];
  }
  return [];
}

function extrairNumProc(intim: AaspIntimacao): string {
  const regex = /\d{7}[-.]?\d{2}[-.]?\d{4}[-.]?\d{1}[-.]?\d{1,2}[-.]?\d{4,5}/g;
  const campos = [intim.NumeroProcesso, intim.numeroProcesso, intim.Processo, intim.processo, intim.numeroUnicoProcesso, intim.Texto || intim.texto || ""].filter(Boolean).join(" ");
  const nums = (campos.match(regex) || []).map((m) => m.replace(/\D/g, ""));
  if (!nums.length) return "";
  const n = nums[0];
  if (n.length === 20) return `${n.slice(0,7)}-${n.slice(7,9)}.${n.slice(9,13)}.${n.slice(13,14)}.${n.slice(14,16)}.${n.slice(16)}`;
  return n;
}

function extrairOrgaoPublicacao(intim: AaspIntimacao): string {
  const jornal = (intim as any).jornal;
  if (jornal?.nomeJornal) return String(jornal.nomeJornal).toUpperCase();
  return ((intim.Meio || intim.meio || intim.NomeJornal || intim.nomeJornal || "") as string).toUpperCase();
}

function extrairPartes(intim: AaspIntimacao): string {
  const candidatos = [intim.Partes, intim.partes, (intim as any).NomePartes].filter(Boolean);
  if (candidatos.length) return String(candidatos[0]);
  const texto = (intim.textoPublicacao || intim.Texto || intim.texto || "") as string;
  const m = texto.match(/Parte\(s\):\s*([\s\S]*?)(?:\n\r?\s*Advogado|$)/i);
  if (m) {
    const nomes = m[1].split(/[\r\n]+/).map((s) => s.trim()).filter((s) => s.length > 2);
    if (nomes.length) return nomes.join(" · ");
  }
  return "";
}

function extrairOrgaoJulgador(intim: AaspIntimacao): string {
  const candidatos = [intim.OrgaoJulgador, intim.orgaoJulgador, (intim as any).Vara].filter(Boolean);
  if (candidatos.length) return String(candidatos[0]);
  const texto = (intim.textoPublicacao || intim.Texto || intim.texto || "") as string;
  const m = texto.match(/[Óó]rg[ãa]o:\s*([^\r\n]+)/i);
  return m ? m[1].trim() : "";
}

function loadStore(): AaspIntimacao[] {
  try {
    const s = localStorage.getItem(STORE_KEY);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

function saveStore(items: AaspIntimacao[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(items.slice(0, 1000)));
}

// ── Hook principal ────────────────────────────────────────────
export function useAutoFetchIntimacoes() {
  const { user } = useAuth();
  const rodouRef = useRef(false);

  const fetchComTimeout = useCallback((url: string, ms: number): Promise<Response> => {
    return Promise.race([
      fetch(url, { headers: { Accept: "application/json" } }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout após ${ms}ms`)), ms)
      ),
    ]);
  }, []);

  useEffect(() => {
    // Só executa se: há usuário logado, ainda não rodou nesta sessão, e não está rodando
    if (!user) return;
    if (rodouRef.current) return;
    if (sessionStorage.getItem(SESSION_FLAG)) return;

    rodouRef.current = true;

    (async () => {
      // 1. Busca a chave AASP do Supabase (ou localStorage como fallback)
      let aaspKey = localStorage.getItem("jurismonitor_aasp_key") || "";

      try {
        const { data } = await supabase
          .from("api_keys")
          .select("aasp_chave")
          .eq("user_id", user.id)
          .maybeSingle();
        if (data?.aasp_chave) {
          aaspKey = data.aasp_chave;
          localStorage.setItem("jurismonitor_aasp_key", aaspKey);
        }
      } catch (_) {}

      if (!aaspKey) {
        // Usuário não configurou a chave ainda — silencia
        sessionStorage.setItem(SESSION_FLAG, "1");
        return;
      }

      // 2. Detecta formato de data da AASP (ISO ou BR)
      const dias = diasUteisRecentes(7);
      const primeirodia = dias[0];
      const [ano, mes, dia] = primeirodia.split("-");
      let fmtPreferido: "ISO" | "BR" =
        (localStorage.getItem("jurismonitor_aasp_fmt") as "ISO" | "BR") || "ISO";

      // Detecta formato apenas se ainda não foi detectado
      if (!localStorage.getItem("jurismonitor_aasp_fmt")) {
        try {
          const urlISO = `/api/proxy?url=${encodeURIComponent(`https://intimacaoapi.aasp.org.br/api/Associado/intimacao/json?chave=${encodeURIComponent(aaspKey)}&data=${primeirodia}`)}`;
          const urlBR  = `/api/proxy?url=${encodeURIComponent(`https://intimacaoapi.aasp.org.br/api/Associado/intimacao/json?chave=${encodeURIComponent(aaspKey)}&data=${dia}/${mes}/${ano}`)}`;
          const [rISO, rBR] = await Promise.all([
            fetchComTimeout(urlISO, 15000).then(r => r.text()).then(t => normalizar(JSON.parse(t))).catch(() => []),
            fetchComTimeout(urlBR,  15000).then(r => r.text()).then(t => normalizar(JSON.parse(t))).catch(() => []),
          ]);
          fmtPreferido = (rBR as any[]).length >= (rISO as any[]).length ? "BR" : "ISO";
          localStorage.setItem("jurismonitor_aasp_fmt", fmtPreferido);
        } catch (_) {}
      }

      // 3. Toast informativo discreto
      toast.info("Atualizando intimações AASP…", { duration: 3000 });

      // 4. Busca sequencial dos últimos 7 dias úteis
      const novas: AaspIntimacao[] = [];
      const storeAtual = loadStore();

      for (const d of dias) {
        const [a, m, dd] = d.split("-");
        const dataParam = fmtPreferido === "BR" ? `${dd}/${m}/${a}` : d;
        const url = `/api/proxy?url=${encodeURIComponent(`https://intimacaoapi.aasp.org.br/api/Associado/intimacao/json?chave=${encodeURIComponent(aaspKey)}&data=${dataParam}`)}`;

        try {
          const resp = await fetchComTimeout(url, 20000);
          if (!resp.ok) continue;
          const text = await resp.text();
          if (!text?.trim()) continue;
          const raw = JSON.parse(text);
          const lista = normalizar(raw);

          lista.forEach((it, idx) => {
            const id = gerarId(it as AaspIntimacao, idx);
            const existente = storeAtual.find((x) => x._id === id);

            // Normaliza data
            const dataBruta = ((it as any).jornal?.dataDisponibilizacao_Publicacao || (it as any).DataDisponibilizacao || (it as any).dataDisponibilizacao || (it as any).Data || "") as string;
            let dataReal = d;
            const isoMatch = dataBruta.match(/^(\d{4})-(\d{2})-(\d{2})/);
            const brMatch  = dataBruta.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
            if (isoMatch) dataReal = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
            else if (brMatch) dataReal = `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;

            novas.push({
              ...(it as AaspIntimacao),
              _id: id,
              _data: dataReal,
              _lida: existente?._lida || false,
              _status: existente?._status || "ativa",
              _resumoIA: existente?._resumoIA || null,
              _titulo: (it as any).TituloAssunto || (it as any).Assunto || (it as any).titulo || "Publicação AASP",
              _numProc: extrairNumProc(it as AaspIntimacao),
              _orgaoPublicacao: extrairOrgaoPublicacao(it as AaspIntimacao),
              _partes: extrairPartes(it as AaspIntimacao),
              _orgaoJulgador: extrairOrgaoJulgador(it as AaspIntimacao),
            });
          });
        } catch (_) {
          // Falha silenciosa por dia — não interrompe os outros
        }
      }

      // 5. Merge com deduplicação
      const merged = [...novas, ...storeAtual];
      const uniq: AaspIntimacao[] = [];
      const seen = new Set<string>();
      for (const it of merged) {
        if (!seen.has(it._id)) { seen.add(it._id); uniq.push(it); }
      }
      saveStore(uniq);

      // 6. Toast de conclusão
      const novasCount = novas.filter(n => !storeAtual.find(s => s._id === n._id)).length;
      if (novasCount > 0) {
        toast.success(`${novasCount} nova(s) intimação(ões) encontrada(s)!`);
      } else {
        toast.success("Intimações atualizadas. Nenhuma novidade.");
      }

      // 7. Marca que já rodou nesta sessão do browser
      sessionStorage.setItem(SESSION_FLAG, "1");
    })();
  }, [user, fetchComTimeout]);
}
