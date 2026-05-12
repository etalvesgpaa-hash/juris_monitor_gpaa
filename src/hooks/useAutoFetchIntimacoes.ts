/**
 * useAutoFetchIntimacoes
 *
 * 1. Busca intimações AASP no login (uma vez por userId em memória).
 * 2. Salva no localStorage E no Supabase → qualquer dispositivo do mesmo
 *    usuário vê as mesmas intimações.
 * 3. Ao inicializar, carrega do Supabase se o localStorage local estiver vazio
 *    (resolve o problema mobile vs desktop).
 * 4. Após salvar, cruza com clientes e dispara e-mails automáticos.
 */

import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ── Chave ÚNICA de localStorage — exportada para todos os arquivos ──
export const INTIMACOES_STORE_KEY = "jm_aasp_intimacoes";

export interface AaspIntimacao {
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

// ── Controle em memória (reset automático no logout) ──────────
let ultimoUserIdFetched: string | null = null;

// ── Helpers ───────────────────────────────────────────────────
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
  const campos = [intim.NumeroProcesso, intim.numeroProcesso, intim.Processo, intim.processo,
    intim.numeroUnicoProcesso, intim.Texto || intim.texto || ""].filter(Boolean).join(" ");
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

// ── localStorage ─────────────────────────────────────────────
export function loadStore(): AaspIntimacao[] {
  try { return JSON.parse(localStorage.getItem(INTIMACOES_STORE_KEY) || "[]"); } catch { return []; }
}
function saveStore(items: AaspIntimacao[]) {
  localStorage.setItem(INTIMACOES_STORE_KEY, JSON.stringify(items.slice(0, 1000)));
}

// ── Supabase sync ─────────────────────────────────────────────
/**
 * Salva/atualiza intimações na tabela `intimacoes` do Supabase.
 * - Novas intimações: insert completo
 * - Existentes: atualiza apenas campos não-nulos (nunca sobrescreve resumo_ia com null)
 */
async function syncParaSupabase(items: AaspIntimacao[], userId: string) {
  if (!items.length) return;

  // Verifica quais já existem no banco
  const ids = items.map(i => i._id);
  const existentes = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase
      .from("intimacoes")
      .select("id")
      .in("id", ids.slice(i, i + 100))
      .eq("user_id", userId)
      .catch(() => ({ data: null }));
    (data || []).forEach((r: any) => existentes.add(r.id));
  }

  const novas  = items.filter(it => !existentes.has(it._id));
  const antigas = items.filter(it =>  existentes.has(it._id));

  // INSERT das novas (completo)
  if (novas.length > 0) {
    const rows = novas.map(it => ({
      id:              it._id,
      user_id:         userId,
      origem:          "aasp",
      data_publicacao: it._data || null,
      numero_processo: it._numProc || null,
      tipo:            it._titulo || null,
      partes:          it._partes || null,
      orgao_julgador:  it._orgaoJulgador || null,
      resumo_ia:       it._resumoIA || null,
      status:          it._status || "ativa",
      dados_raw:       it as any,
    }));
    for (let i = 0; i < rows.length; i += 50) {
      await supabase.from("intimacoes")
        .insert(rows.slice(i, i + 50))
        .then(({ error }) => {
          if (error) console.warn("[Supabase sync] insert falhou:", error.message);
        });
    }
  }

  // UPDATE das existentes — NUNCA sobrescreve resumo_ia com null
  for (const it of antigas) {
    const update: Record<string, any> = {
      status:    it._status || "ativa",
      dados_raw: it as any,
    };
    // Só atualiza resumo_ia se tiver valor (não apaga resumo existente)
    if (it._resumoIA) update.resumo_ia = it._resumoIA;
    await supabase.from("intimacoes")
      .update(update)
      .eq("id", it._id)
      .eq("user_id", userId)
      .catch(() => {});
  }
}

/**
 * Carrega intimações do Supabase e preenche o localStorage local.
 * Chamado quando o localStorage está vazio (ex: primeiro acesso no celular).
 */
async function carregarDoSupabase(userId: string): Promise<AaspIntimacao[]> {
  const { data, error } = await supabase
    .from("intimacoes")
    .select("*")
    .eq("user_id", userId)
    .eq("origem", "aasp")
    .order("data_publicacao", { ascending: false })
    .limit(500);

  if (error) {
    console.error("[Supabase] Erro ao carregar intimacoes:", error.code, error.message, error.details);
    return [];
  }
  if (!data?.length) return [];

  const items: AaspIntimacao[] = data.map((row: any) => {
    const raw = (row.dados_raw as AaspIntimacao) || {};
    return {
      ...raw,
      _id:              row.id,
      _data:            ((row.data_publicacao ?? raw._data ?? "") as string).slice(0, 10),
      _lida:            raw._lida ?? false,
      // Supabase tem prioridade absoluta em status e resumo_ia.
      // ?? garante que um resumo salvo no banco nunca é ignorado,
      // mesmo que raw._resumoIA seja null ou undefined no dados_raw.
      _status:          (row.status as any) ?? "ativa",
      _resumoIA:        row.resumo_ia ?? raw._resumoIA ?? null,
      _titulo:          row.tipo ?? raw._titulo ?? "Publicação AASP",
      _numProc:         row.numero_processo ?? raw._numProc ?? "",
      _orgaoPublicacao: raw._orgaoPublicacao ?? "",
      _partes:          row.partes ?? raw._partes ?? "",
      _orgaoJulgador:   row.orgao_julgador ?? raw._orgaoJulgador ?? "",
    };
  });

  saveStore(items);
  return items;
}

// ── Notificações automáticas por e-mail ──────────────────────
async function dispararNotificacoesAutomaticas(novas: AaspIntimacao[], userId: string) {
  if (!novas.length) return;
  try {
    const { data: clientes } = await supabase
      .from("clientes")
      .select("id, nome, email, numeros_processo, notificacoes_email, status_monitoramento")
      .eq("user_id", userId)
      .eq("notificacoes_email", true)
      .eq("status_monitoramento", "ativo")
      .not("email", "is", null)
      .not("numeros_processo", "is", null);

    if (!clientes?.length) return;

    const { data: jaEnviadas } = await supabase
      .from("notificacoes_enviadas")
      .select("intimacao_id, cliente_id")
      .eq("user_id", userId)
      .eq("status", "enviado")
      .in("intimacao_id", novas.map(i => i._id));

    const enviados = new Set(
      (jaEnviadas || []).map((n: any) => `${n.cliente_id}::${n.intimacao_id}`)
    );

    let totalEnviados = 0;

    for (const cliente of clientes) {
      if (!cliente.email || !cliente.numeros_processo?.length) continue;
      const procLimpas = (cliente.numeros_processo as string[]).map(p => p.replace(/\D/g, ""));

      for (const intim of novas) {
        if (!intim._numProc) continue;
        const intimLimpo = intim._numProc.replace(/\D/g, "");
        if (!intimLimpo) continue;

        const bate = procLimpas.some(p => intimLimpo.includes(p) || p.includes(intimLimpo));
        if (!bate) continue;

        const chave = `${cliente.id}::${intim._id}`;
        if (enviados.has(chave)) continue;

        try {
          const res = await fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              destinatario:  cliente.email,
              nomeCliente:   cliente.nome,
              numeroProcesso: intim._numProc,
              dataPublicacao: fmtDataBR(intim._data),
              assunto:       intim._titulo || "Nova Publicação AASP",
              resumoIA:      intim._resumoIA || null,
              textoCompleto: "",
            }),
          });

          const status = res.ok ? "enviado" : "falha";
          await supabase.from("notificacoes_enviadas").insert({
            user_id:        userId,
            cliente_id:     cliente.id,
            intimacao_id:   intim._id,
            numero_processo: intim._numProc || "",
            assunto:        intim._titulo || "Nova Publicação AASP",
            resumo_ia:      intim._resumoIA || null,
            email_destino:  cliente.email,
            status,
          });

          if (res.ok) {
            enviados.add(chave);
            totalEnviados++;
            await supabase.from("clientes")
              .update({ ultima_notificacao: new Date().toISOString() })
              .eq("id", cliente.id);
          }
        } catch (e: any) {
          console.error("[AutoNotif] Falha e-mail:", e.message);
        }
      }
    }

    if (totalEnviados > 0) {
      toast.success(`📧 ${totalEnviados} e-mail(s) enviado(s) automaticamente!`, { duration: 6000 });
    }
  } catch (e: any) {
    console.error("[AutoNotif] Erro geral:", e.message);
  }
}

// ── Hook principal ────────────────────────────────────────────
export function useAutoFetchIntimacoes() {
  const { user } = useAuth();
  const rodandoRef = useRef(false);

  const fetchComTimeout = useCallback((url: string, ms: number): Promise<Response> => {
    return Promise.race([
      fetch(url, { headers: { Accept: "application/json" } }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timeout ${ms}ms`)), ms)),
    ]);
  }, []);

  // ── Ao montar com usuário: SEMPRE sincroniza com Supabase ────────
  // Garante que mobile e desktop vejam exatamente os mesmos dados.
  // O Supabase é a fonte de verdade; localStorage é apenas cache de exibição.
  useEffect(() => {
    if (!user) return;
    const local = loadStore();

    carregarDoSupabase(user.id).then(fromDB => {
      if (!fromDB.length) {
        console.warn("[Sync] carregarDoSupabase retornou 0 itens para user:", user.id);
        return;
      }

      // Mescla: Supabase tem prioridade em status e resumo_ia.
      // Mantém itens locais que ainda não foram enviados ao banco.
      const dbIds = new Set(fromDB.map(i => i._id));
      const apenasLocal = local.filter(i => !dbIds.has(i._id));
      const merged = [...fromDB, ...apenasLocal];

      saveStore(merged);

      // Dispara evento customizado para que IntimacoesPage e DashboardPage
      // recarreguem o estado sem precisar de um reload completo.
      window.dispatchEvent(new CustomEvent("intimacoes-sincronizadas", { detail: merged }));

      if (local.length === 0 && fromDB.length > 0) {
        toast.info(`📱 ${fromDB.length} intimação(ões) carregada(s) da nuvem.`, { duration: 4000 });
      }
    }).catch((err: any) => {
      console.error("[Sync] Falha ao sincronizar com Supabase:", err?.message || err);
      window.dispatchEvent(new CustomEvent("supabase-sync-erro", { detail: err?.message || String(err) }));
    });
  }, [user]);

  // ── Busca AASP (uma vez por login) ───────────────────────────
  useEffect(() => {
    if (!user) {
      ultimoUserIdFetched = null;
      return;
    }
    if (ultimoUserIdFetched === user.id) return;
    if (rodandoRef.current) return;

    rodandoRef.current = true;
    ultimoUserIdFetched = user.id;

    (async () => {
      try {
        // 1. Chave AASP
        let aaspKey = localStorage.getItem("jurismonitor_aasp_key") || "";
        try {
          const { data } = await supabase
            .from("api_keys").select("aasp_chave").eq("user_id", user.id).maybeSingle();
          if (data?.aasp_chave) {
            aaspKey = data.aasp_chave;
            localStorage.setItem("jurismonitor_aasp_key", aaspKey);
          }
        } catch (_) {}

        if (!aaspKey) {
          console.log("[AutoFetch] Chave AASP não configurada.");
          return;
        }

        // 2. Formato de data
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

        // 3. Busca os últimos 7 dias úteis
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
            const lista = normalizar(JSON.parse(text));

            lista.forEach((it: any, idx: number) => {
              const id = gerarId(it, idx);
              const existente = storeAtual.find(x => x._id === id);
              const dataBruta = String(it.jornal?.dataDisponibilizacao_Publicacao || it.DataDisponibilizacao || it.dataDisponibilizacao || it.Data || "");
              let dataReal = d;
              const isoM = dataBruta.match(/^(\d{4})-(\d{2})-(\d{2})/);
              const brM  = dataBruta.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
              if (isoM) dataReal = `${isoM[1]}-${isoM[2]}-${isoM[3]}`;
              else if (brM) dataReal = `${brM[3]}-${brM[2]}-${brM[1]}`;

              novas.push({
                ...it,
                _id:             id,
                _data:           dataReal,
                _lida:           existente?._lida || false,
                _status:         existente?._status || "ativa",
                _resumoIA:       existente?._resumoIA || null,
                _titulo:         it.TituloAssunto || it.Assunto || it.titulo || "Publicação AASP",
                _numProc:        extrairNumProc(it),
                _orgaoPublicacao: extrairOrgaoPublicacao(it),
                _partes:         extrairPartes(it),
                _orgaoJulgador:  extrairOrgaoJulgador(it),
              });
            });
          } catch (_) {}
        }

        // 4. Merge + dedup
        const merged = [...novas, ...storeAtual];
        const uniq: AaspIntimacao[] = [];
        const seen = new Set<string>();
        for (const it of merged) {
          if (!seen.has(it._id)) { seen.add(it._id); uniq.push(it); }
        }
        saveStore(uniq);

        // 5. Filtra apenas as intimações de HOJE (dias[0])
        //    As de dias anteriores já foram processadas em execuções anteriores
        const hoje = dias[0]; // formato YYYY-MM-DD
        const novasDeHoje = novas.filter(n => n._data === hoje);

        // Verifica no Supabase quais IDs de hoje JÁ EXISTIAM antes desta sync
        // (feito ANTES do syncParaSupabase para não confundir recém-inseridos)
        let idsJaNoSupabase = new Set<string>();

        if (novasDeHoje.length > 0) {
          const { data: jaNoSupabase } = await supabase
            .from("intimacoes")
            .select("id")
            .eq("user_id", user.id)
            .in("id", novasDeHoje.map(n => n._id).filter(Boolean));
          idsJaNoSupabase = new Set((jaNoSupabase || []).map((r: any) => r.id));
        }

        // Intimação é "nova" somente se é de hoje E não existia no Supabase
        const recentementeNovas = novasDeHoje.filter(n => !idsJaNoSupabase.has(n._id));

        // 5b. Agora sincroniza para Supabase — aguarda antes de disparar notificações
        await syncParaSupabase(uniq, user.id).catch(() => {});

        toast.dismiss("auto-fetch");
        if (recentementeNovas.length > 0) {
          toast.success(`✅ ${recentementeNovas.length} nova(s) intimação(ões) encontrada(s)!`, { duration: 5000 });
        } else {
          toast.success("Intimações atualizadas — nenhuma novidade.", { duration: 3000 });
        }

        // 7. Notificações automáticas por e-mail — só para as realmente novas
        if (recentementeNovas.length > 0) {
          dispararNotificacoesAutomaticas(recentementeNovas, user.id).catch(() => {});
        }

      } catch (err: any) {
        console.error("[AutoFetch] Erro:", err.message);
        toast.dismiss("auto-fetch");
      } finally {
        rodandoRef.current = false;
      }
    })();
  }, [user, fetchComTimeout]);
}
