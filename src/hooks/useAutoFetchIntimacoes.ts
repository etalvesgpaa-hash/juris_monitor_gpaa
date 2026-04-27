/**
 * useAutoFetchIntimacoes
 *
 * 1. Busca intimações AASP automaticamente no login (uma vez por userId).
 * 2. Após salvar, cruza com clientes cadastrados e dispara e-mail automático
 *    para cada cliente que:
 *      - tem notificacoes_email = true
 *      - tem e-mail cadastrado
 *      - tem status_monitoramento = "ativo"
 *      - possui número de processo que bate com a intimação nova
 *      - ainda não recebeu notificação desta intimação (cheque via Supabase)
 */

import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ── Chave ÚNICA de localStorage — usada em todo o projeto ─────
export const INTIMACOES_STORE_KEY = "jm_aasp_intimacoes";

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

// ── Controle de sessão em memória (reset automático no logout) ─
let ultimoUserIdFetched: string | null = null;

// ── Helpers ────────────────────────────────────────────────────
function dataLocalStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function diasUteisRecentes(n: number): string[] {
  const dias: string[] = [];
  const d = new Date();
  while (dias.length < n) {
    if (d.getDay() !== 0 && d.getDay() !== 6) dias.push(dataLocalStr(d));
    d.setDate(d.getDate() - 1);
  }
  return dias;
}

function gerarId(intim: any, idx = 0): string {
  const codRel = intim.codigoRelacionamento || intim.CodigoRelacionamento;
  if (codRel && String(codRel) !== "0") return "aasp_" + String(codRel);
  const idApi = intim.Id || intim.id || intim.CodigoIntimacao || intim.codigoIntimacao;
  if (idApi && String(idApi) !== "0") return String(idApi);
  const numProc = intim.numeroUnicoProcesso || intim.NumeroProcesso || intim.numeroProcesso || "";
  const data = (intim.jornal?.dataDisponibilizacao_Publicacao) || intim.DataDisponibilizacao || intim.dataDisponibilizacao || intim.Data || "";
  const titulo = intim.titulo || intim.TituloAssunto || intim.Assunto || "";
  const texto = String(intim.textoPublicacao || intim.Texto || intim.texto || "").slice(0, 400);
  const raw = `${numProc}|${String(data).slice(0,19)}|${titulo}|${idx}|${texto}`;
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) hash = ((hash << 5) + hash + raw.charCodeAt(i)) | 0;
  return "det_" + Math.abs(hash).toString(36);
}

function normalizar(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray((raw as any)?.Intimacoes)) return (raw as any).Intimacoes;
  if (Array.isArray((raw as any)?.Data)) return (raw as any).Data;
  if (Array.isArray((raw as any)?.intimacoes)) return (raw as any).intimacoes;
  for (const v of Object.values((raw as object) || {})) {
    if (Array.isArray(v)) return v as any[];
  }
  return [];
}

function extrairNumProc(intim: any): string {
  const regex = /\d{7}[-.]?\d{2}[-.]?\d{4}[-.]?\d{1}[-.]?\d{1,2}[-.]?\d{4,5}/g;
  const campos = [intim.NumeroProcesso, intim.numeroProcesso, intim.Processo, intim.processo, intim.numeroUnicoProcesso, intim.Texto || intim.texto || ""].filter(Boolean).join(" ");
  const nums = (campos.match(regex) || []).map((m: string) => m.replace(/\D/g, ""));
  if (!nums.length) return "";
  const n = nums[0];
  if (n.length === 20) return `${n.slice(0,7)}-${n.slice(7,9)}.${n.slice(9,13)}.${n.slice(13,14)}.${n.slice(14,16)}.${n.slice(16)}`;
  return n;
}

function extrairOrgaoPublicacao(intim: any): string {
  if (intim.jornal?.nomeJornal) return String(intim.jornal.nomeJornal).toUpperCase();
  return String(intim.Meio || intim.meio || intim.NomeJornal || intim.nomeJornal || "").toUpperCase();
}

function extrairPartes(intim: any): string {
  const c = [intim.Partes, intim.partes, intim.NomePartes].filter(Boolean);
  if (c.length) return String(c[0]);
  const texto = String(intim.textoPublicacao || intim.Texto || intim.texto || "");
  const m = texto.match(/Parte\(s\):\s*([\s\S]*?)(?:\n\r?\s*Advogado|$)/i);
  if (m) {
    const nomes = m[1].split(/[\r\n]+/).map((s: string) => s.trim()).filter((s: string) => s.length > 2);
    if (nomes.length) return nomes.join(" · ");
  }
  return "";
}

function extrairOrgaoJulgador(intim: any): string {
  const c = [intim.OrgaoJulgador, intim.orgaoJulgador, intim.Vara].filter(Boolean);
  if (c.length) return String(c[0]);
  const texto = String(intim.textoPublicacao || intim.Texto || intim.texto || "");
  const m = texto.match(/[Óó]rg[ãa]o:\s*([^\r\n]+)/i);
  return m ? m[1].trim() : "";
}

function fmtDataBR(iso: string): string {
  if (!iso) return "";
  const p = iso.slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

export function loadStore(): AaspIntimacao[] {
  try { return JSON.parse(localStorage.getItem(INTIMACOES_STORE_KEY) || "[]"); } catch { return []; }
}
function saveStore(items: AaspIntimacao[]) {
  localStorage.setItem(INTIMACOES_STORE_KEY, JSON.stringify(items.slice(0, 1000)));
}

// ── Notificação automática por e-mail ─────────────────────────
async function dispararNotificacoesAutomaticas(
  novasIntimacoes: AaspIntimacao[],
  userId: string
) {
  if (novasIntimacoes.length === 0) return;

  try {
    // 1. Busca todos os clientes ativos com e-mail e monitoramento ativo
    const { data: clientes, error } = await supabase
      .from("clientes")
      .select("id, nome, email, numeros_processo, notificacoes_email, status_monitoramento")
      .eq("user_id", userId)
      .eq("notificacoes_email", true)
      .eq("status_monitoramento", "ativo")
      .not("email", "is", null)
      .not("numeros_processo", "is", null);

    if (error || !clientes || clientes.length === 0) return;

    // 2. Busca IDs de intimações já notificadas (evita duplicatas)
    const { data: jaEnviadas } = await supabase
      .from("notificacoes_enviadas")
      .select("intimacao_id, cliente_id")
      .eq("user_id", userId)
      .eq("status", "enviado")
      .in("intimacao_id", novasIntimacoes.map(i => i._id));

    const enviados = new Set(
      (jaEnviadas || []).map((n: any) => `${n.cliente_id}::${n.intimacao_id}`)
    );

    // 3. Cruza intimações novas com clientes
    let totalEmailsEnviados = 0;

    for (const cliente of clientes) {
      if (!cliente.email || !cliente.numeros_processo?.length) continue;

      const procLimpas = (cliente.numeros_processo as string[]).map((p: string) => p.replace(/\D/g, ""));

      for (const intim of novasIntimacoes) {
        if (!intim._numProc) continue;
        const intimProcLimpo = intim._numProc.replace(/\D/g, "");
        if (!intimProcLimpo) continue;

        // Verifica correspondência de número de processo
        const bate = procLimpas.some(
          (p: string) => intimProcLimpo.includes(p) || p.includes(intimProcLimpo)
        );
        if (!bate) continue;

        // Verifica se já foi notificado
        const chave = `${cliente.id}::${intim._id}`;
        if (enviados.has(chave)) continue;

        // 4. Dispara e-mail
        try {
          const payload = {
            destinatario: cliente.email,
            nomeCliente: cliente.nome,
            numeroProcesso: intim._numProc,
            dataPublicacao: fmtDataBR(intim._data),
            assunto: intim._titulo || "Nova Publicação AASP",
            resumoIA: intim._resumoIA || null,
            textoCompleto: "",
          };

          const res = await fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (res.ok) {
            // 5. Registra no Supabase
            await supabase.from("notificacoes_enviadas").insert({
              user_id: userId,
              cliente_id: cliente.id,
              intimacao_id: intim._id,
              numero_processo: intim._numProc || "",
              assunto: intim._titulo || "Nova Publicação AASP",
              resumo_ia: intim._resumoIA || null,
              email_destino: cliente.email,
              status: "enviado",
            });

            // Atualiza última notificação do cliente
            await supabase
              .from("clientes")
              .update({ ultima_notificacao: new Date().toISOString() })
              .eq("id", cliente.id);

            totalEmailsEnviados++;
            enviados.add(chave); // evita reenvio se mesmo cliente tem 2 processos que batem
          } else {
            const errBody = await res.json().catch(() => ({}));
            console.error("[AutoNotif] Falha ao enviar e-mail:", errBody);

            // Registra falha para auditoria
            await supabase.from("notificacoes_enviadas").insert({
              user_id: userId,
              cliente_id: cliente.id,
              intimacao_id: intim._id,
              numero_processo: intim._numProc || "",
              assunto: intim._titulo || "Nova Publicação AASP",
              resumo_ia: null,
              email_destino: cliente.email,
              status: "falha",
            });
          }
        } catch (emailErr: any) {
          console.error("[AutoNotif] Erro ao enviar e-mail para", cliente.email, emailErr.message);
        }
      }
    }

    if (totalEmailsEnviados > 0) {
      toast.success(`📧 ${totalEmailsEnviados} e-mail(s) enviado(s) automaticamente para clientes!`, {
        duration: 6000,
      });
    }
  } catch (err: any) {
    console.error("[AutoNotif] Erro geral nas notificações automáticas:", err.message);
  }
}

// ── Hook principal ─────────────────────────────────────────────
export function useAutoFetchIntimacoes() {
  const { user } = useAuth();
  const rodandoRef = useRef(false);

  const fetchComTimeout = useCallback((url: string, ms: number): Promise<Response> => {
    return Promise.race([
      fetch(url, { headers: { Accept: "application/json" } }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timeout ${ms}ms`)), ms)),
    ]);
  }, []);

  useEffect(() => {
    // Sem usuário → zera flag para próximo login
    if (!user) {
      ultimoUserIdFetched = null;
      return;
    }

    // Já buscou para este userId
    if (ultimoUserIdFetched === user.id) return;

    // Já está rodando (React StrictMode double-effect)
    if (rodandoRef.current) return;

    rodandoRef.current = true;
    ultimoUserIdFetched = user.id;

    (async () => {
      try {
        // ── 1. Busca chave AASP ──────────────────────────────────
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
          console.log("[AutoFetch] Chave AASP não configurada — pulando.");
          return;
        }

        // ── 2. Detecta formato de data ───────────────────────────
        const dias = diasUteisRecentes(7);
        const [ano, mes, dia] = dias[0].split("-");

        let fmtPreferido: "ISO" | "BR" =
          (localStorage.getItem("jurismonitor_aasp_fmt") as "ISO" | "BR") || "ISO";

        if (!localStorage.getItem("jurismonitor_aasp_fmt")) {
          try {
            const mkUrl = (param: string) =>
              `/api/proxy?url=${encodeURIComponent(`https://intimacaoapi.aasp.org.br/api/Associado/intimacao/json?chave=${encodeURIComponent(aaspKey)}&data=${param}`)}`;
            const [rISO, rBR] = await Promise.all([
              fetchComTimeout(mkUrl(dias[0]), 15000).then(r => r.text()).then(t => normalizar(JSON.parse(t))).catch(() => []),
              fetchComTimeout(mkUrl(`${dia}/${mes}/${ano}`), 15000).then(r => r.text()).then(t => normalizar(JSON.parse(t))).catch(() => []),
            ]);
            fmtPreferido = (rBR as any[]).length >= (rISO as any[]).length ? "BR" : "ISO";
            localStorage.setItem("jurismonitor_aasp_fmt", fmtPreferido);
          } catch (_) {}
        }

        toast.info("Buscando intimações AASP…", { duration: 3500, id: "auto-fetch" });

        // ── 3. Busca sequencial dos últimos 7 dias úteis ─────────
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

            lista.forEach((it: any, idx: number) => {
              const id = gerarId(it, idx);
              const existente = storeAtual.find((x) => x._id === id);
              const dataBruta = String(it.jornal?.dataDisponibilizacao_Publicacao || it.DataDisponibilizacao || it.dataDisponibilizacao || it.Data || "");
              let dataReal = d;
              const isoM = dataBruta.match(/^(\d{4})-(\d{2})-(\d{2})/);
              const brM  = dataBruta.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
              if (isoM) dataReal = `${isoM[1]}-${isoM[2]}-${isoM[3]}`;
              else if (brM) dataReal = `${brM[3]}-${brM[2]}-${brM[1]}`;

              novas.push({
                ...it,
                _id: id,
                _data: dataReal,
                _lida: existente?._lida || false,
                _status: existente?._status || "ativa",
                _resumoIA: existente?._resumoIA || null,
                _titulo: it.TituloAssunto || it.Assunto || it.titulo || "Publicação AASP",
                _numProc: extrairNumProc(it),
                _orgaoPublicacao: extrairOrgaoPublicacao(it),
                _partes: extrairPartes(it),
                _orgaoJulgador: extrairOrgaoJulgador(it),
              });
            });
          } catch (_) {}
        }

        // ── 4. Merge com deduplicação ────────────────────────────
        const merged = [...novas, ...storeAtual];
        const uniq: AaspIntimacao[] = [];
        const seen = new Set<string>();
        for (const it of merged) {
          if (!seen.has(it._id)) { seen.add(it._id); uniq.push(it); }
        }
        saveStore(uniq);

        // ── 5. Calcula intimações realmente novas ────────────────
        const idsAntigos = new Set(storeAtual.map(i => i._id));
        const recentementeNovas = novas.filter(n => !idsAntigos.has(n._id));

        toast.dismiss("auto-fetch");
        if (recentementeNovas.length > 0) {
          toast.success(`✅ ${recentementeNovas.length} nova(s) intimação(ões) encontrada(s)!`, { duration: 5000 });
        } else {
          toast.success("Intimações atualizadas — nenhuma novidade.", { duration: 3000 });
        }

        // ── 6. Notificações automáticas por e-mail ───────────────
        // Roda em background — não bloqueia o toast acima
        if (recentementeNovas.length > 0) {
          dispararNotificacoesAutomaticas(recentementeNovas, user.id).catch(
            (err) => console.error("[AutoNotif] Erro inesperado:", err)
          );
        }

      } catch (err: any) {
        console.error("[AutoFetch] Erro inesperado:", err);
        toast.dismiss("auto-fetch");
      } finally {
        rodandoRef.current = false;
      }
    })();
  }, [user, fetchComTimeout]);
}
