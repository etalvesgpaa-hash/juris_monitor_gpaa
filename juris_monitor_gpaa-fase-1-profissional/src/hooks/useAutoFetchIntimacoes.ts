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

import { useEffect, useRef, useCallback, useState } from "react";
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

function gerarId(intim: any, _idx = 0): string {
  const codRel = intim.codigoRelacionamento || intim.CodigoRelacionamento;
  if (codRel && String(codRel) !== "0") return "aasp_" + String(codRel);
  const idApi = intim.Id || intim.id || intim.CodigoIntimacao || intim.codigoIntimacao;
  if (idApi && String(idApi) !== "0") return String(idApi);
  // Hash baseado SOMENTE no conteúdo — nunca no índice posicional,
  // pois a AASP pode retornar as intimações em ordens diferentes entre chamadas.
  const numProc = intim.numeroUnicoProcesso || intim.NumeroProcesso || intim.numeroProcesso || "";
  const data = (intim.jornal?.dataDisponibilizacao_Publicacao) || intim.DataDisponibilizacao || intim.dataDisponibilizacao || intim.Data || "";
  const titulo = intim.titulo || intim.TituloAssunto || intim.Assunto || "";
  const texto = String(intim.textoPublicacao || intim.Texto || intim.texto || "").slice(0, 400);
  const raw = `${numProc}|${String(data).slice(0,19)}|${titulo}|${texto}`;
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
    let fetchedData: any[] = [];
    try {
      const { data } = await supabase
        .from("intimacoes")
        .select("id")
        .in("id", ids.slice(i, i + 100))
        .eq("user_id", userId);
      fetchedData = data || [];
    } catch (_) {}
    fetchedData.forEach((r: any) => existentes.add(r.id));
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
    try {
      await supabase.from("intimacoes")
        .update(update)
        .eq("id", it._id)
        .eq("user_id", userId);
    } catch (_) {}
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

    // Busca por ID exato das intimações novas
    const { data: jaEnviadasPorId } = await supabase
      .from("notificacoes_enviadas")
      .select("intimacao_id, cliente_id, numero_processo, created_at")
      .eq("user_id", userId)
      .eq("status", "enviado")
      .in("intimacao_id", novas.map(i => i._id).filter(Boolean));

    // Busca adicional por número de processo (protege contra IDs instáveis do gerarId)
    const numProcs = novas.map(i => i._numProc).filter(Boolean);
    const { data: jaEnviadasPorProc } = numProcs.length > 0
      ? await supabase
          .from("notificacoes_enviadas")
          .select("intimacao_id, cliente_id, numero_processo, created_at")
          .eq("user_id", userId)
          .eq("status", "enviado")
          .in("numero_processo", numProcs)
      : { data: [] };

    const todasEnviadas = [...(jaEnviadasPorId || []), ...(jaEnviadasPorProc || [])];

    // Chave primária: cliente_id + intimacao_id
    const enviados = new Set(
      todasEnviadas.map((n: any) => `${n.cliente_id}::${n.intimacao_id}`)
    );

    // Chave secundária: cliente_id + numero_processo_limpo + data_envio
    // Evita reenvio mesmo quando o ID hash mudou entre execuções
    const enviadosPorProcData = new Set(
      todasEnviadas
        .filter((n: any) => n.numero_processo && n.created_at)
        .map((n: any) =>
          `${n.cliente_id}::${String(n.numero_processo).replace(/\D/g, "")}::${String(n.created_at).slice(0, 10)}`
        )
    );

    let totalEnviados = 0;

    for (const cliente of clientes) {
      if (!cliente.email || !cliente.numeros_processo?.length) continue;
      const procLimpas = (cliente.numeros_processo as string[]).map(p => p.replace(/\D/g, ""));

      for (const intim of novas) {
        if (!intim._numProc) continue;
        const intimLimpo = intim._numProc.replace(/\D/g, "");
        if (!intimLimpo || intimLimpo.length < 7) continue;

        // Matching robusto: considera igual se os dígitos relevantes coincidem.
        // Extrai os 7 dígitos iniciais (NNNNNNN) + 4 do ano para comparação núcleo.
        const nucleoIntim = intimLimpo.slice(0, 7) + intimLimpo.slice(9, 13);
        const bate = procLimpas.some(p => {
          if (!p || p.length < 7) return false;
          // Igualdade exata após limpar
          if (p === intimLimpo) return true;
          // Um contém o outro (casos de número parcial)
          if (intimLimpo.includes(p) || p.includes(intimLimpo)) return true;
          // Comparação por núcleo (7 dígitos do número + 4 do ano)
          const nucleoCliente = p.slice(0, 7) + p.slice(9, 13);
          if (nucleoCliente.length >= 11 && nucleoIntim.length >= 11 && nucleoCliente === nucleoIntim) return true;
          return false;
        });
        if (!bate) continue;

        const chave = `${cliente.id}::${intim._id}`;
        if (enviados.has(chave)) continue;

        // Segunda camada: bloqueia reenvio por numero_processo+data mesmo se o ID hash mudou
        const chaveProcData = `${cliente.id}::${intimLimpo}::${intim._data || ""}`;
        if (enviadosPorProcData.has(chaveProcData)) continue;

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
  const [buscarTrigger, setBuscarTrigger] = useState(0);

  /** Força uma nova busca completa na AASP (reseta o guard de "já rodou") */
  const forceBusca = useCallback(() => {
    ultimoUserIdFetched = null;
    rodandoRef.current = false;
    setBuscarTrigger(t => t + 1);
  }, []);

  // Escuta o evento global — permite que qualquer página acione a busca
  // sem precisar instanciar o hook diretamente (evita múltiplas instâncias)
  useEffect(() => {
    const handler = () => forceBusca();
    window.addEventListener("force-busca-intimacoes", handler);
    return () => window.removeEventListener("force-busca-intimacoes", handler);
  }, [forceBusca]);

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
    console.log("[AutoFetch] useEffect disparado. ultimoUserIdFetched:", ultimoUserIdFetched, "user.id:", user.id, "rodando:", rodandoRef.current, "trigger:", buscarTrigger);
    if (ultimoUserIdFetched === user.id) { console.log("[AutoFetch] BLOQUEADO: já rodou para este user."); return; }
    if (rodandoRef.current) { console.log("[AutoFetch] BLOQUEADO: já está rodando."); return; }

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
                _data:           dataReal.slice(0, 10), // garante YYYY-MM-DD sem horário
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
        const storeComHistorico = loadStore(); // relê após carregarDoSupabase
        const merged = [...novas, ...storeComHistorico];
        const uniq: AaspIntimacao[] = [];
        const seen = new Set<string>();
        for (const it of merged) {
          if (!seen.has(it._id)) { seen.add(it._id); uniq.push(it); }
        }
        saveStore(uniq);

        // 5. Filtra apenas as intimações de HOJE (dias[0])
        const hoje = dias[0];
        // CORRIGIDO: normaliza _data para YYYY-MM-DD antes de comparar
        // (a AASP às vezes retorna "2026-05-21T00:00:00" com horário)
        const novasDeHoje = novas.filter(n => {
          const d = (n._data || "").slice(0, 10);
          return d === hoje;
        });
        console.log("[AutoFetch] hoje:", hoje, "novas total:", novas.length, "novasDeHoje:", novasDeHoje.length, "datas encontradas:", [...new Set(novas.map(n => (n._data || "").slice(0, 10)))]);

        // 5b. Consulta IDs já no Supabase ANTES de sincronizar
        // (deve vir antes do syncParaSupabase para saber o que é realmente novo)
        let idsJaNoSupabaseAntes = new Set<string>();
        if (novasDeHoje.length > 0) {
          const { data: jaNoSupabase } = await supabase
            .from("intimacoes")
            .select("id")
            .eq("user_id", user.id)
            .in("id", novasDeHoje.map(n => n._id).filter(Boolean));
          idsJaNoSupabaseAntes = new Set((jaNoSupabase || []).map((r: any) => r.id));
          console.log("[AutoFetch] idsJaNoSupabaseAntes:", idsJaNoSupabaseAntes.size, "de", novasDeHoje.length, "de hoje");
        }

        // Verifica notificacoes_enviadas para não reenviar e-mail
        let idsJaNotificados = new Set<string>();
        if (novasDeHoje.length > 0) {
          const { data: jaNotificados } = await supabase
            .from("notificacoes_enviadas")
            .select("intimacao_id")
            .eq("user_id", user.id)
            .eq("status", "enviado")
            .in("intimacao_id", novasDeHoje.map(n => n._id).filter(Boolean));
          idsJaNotificados = new Set((jaNotificados || []).map((r: any) => r.intimacao_id));
          console.log("[AutoFetch] idsJaNotificados:", idsJaNotificados.size);
        }

        // recentementeNovas = de hoje sem e-mail enviado ainda
        const recentementeNovas = novasDeHoje.filter(n => !idsJaNotificados.has(n._id));
        // paraExibirNoToast = de hoje que não existiam no banco antes desta execução
        const paraExibirNoToast = novasDeHoje.filter(n => !idsJaNoSupabaseAntes.has(n._id));
        console.log("[AutoFetch] recentementeNovas:", recentementeNovas.length, "paraExibirNoToast:", paraExibirNoToast.length);

        // 5c. Sincroniza para Supabase (depois das consultas acima)
        await syncParaSupabase(uniq, user.id).catch(() => {});

        // 5d. Relê resumo_ia do Supabase — fonte de verdade
        const resumosNoSupabase = new Map<string, string | null>();
        if (novasDeHoje.length > 0) {
          try {
            const { data: rows } = await supabase
              .from("intimacoes")
              .select("id, resumo_ia")
              .eq("user_id", user.id)
              .in("id", novasDeHoje.map(n => n._id).filter(Boolean));
            (rows || []).forEach((r: any) => resumosNoSupabase.set(r.id, r.resumo_ia ?? null));
          } catch (_) {}
        }

        const hojesSemResumo = novasDeHoje.filter(n => !resumosNoSupabase.get(n._id));
        console.log("[AutoFetch] hojesSemResumo:", hojesSemResumo.length);

        // 6. Gera resumo IA
        //    6a. Para as intimações NOVAS DE HOJE: aguarda antes de enviar e-mail
        //    6b. Para as demais (históricas sem resumo): roda em background sem bloquear

        // Busca a chave Groq uma única vez
        let groqKey: string | null = null;
        try {
          const { data: apiKeys } = await supabase
            .from("api_keys")
            .select("groq_api_key")
            .eq("user_id", user.id)
            .maybeSingle();
          groqKey = apiKeys?.groq_api_key ?? null;
        } catch (_) {}
        console.log("[AutoFetch] groqKey presente:", !!groqKey, "hojesSemResumo:", hojesSemResumo.length, "recentementeNovas:", recentementeNovas.length);

        // Função reutilizável: gera resumo para uma intimação e persiste
        const gerarResumo = async (intim: AaspIntimacao): Promise<string | null> => {
          if (!groqKey || intim._resumoIA) return intim._resumoIA ?? null;
          try {
          const textoRaw = String(
            intim.textoPublicacao || intim.Texto || intim.texto ||
            intim.Conteudo || intim.conteudo || ""
          );
          const texto = textoRaw.trim().length >= 50 ? textoRaw : [
            intim._numProc && `Processo: ${intim._numProc}`,
            intim._titulo && `Tipo: ${intim._titulo}`,
            intim._orgaoJulgador && `Órgão: ${intim._orgaoJulgador}`,
            intim._data && `Data: ${intim._data}`,
            intim._partes && `Partes: ${intim._partes}`,
            intim._orgaoPublicacao && `Publicação: ${intim._orgaoPublicacao}`,
          ].filter(Boolean).join("\n");
          if (!texto || texto.length < 20) return null;

            const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
              body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                  { role: "system", content: "Você é um assistente jurídico especializado em analisar publicações do Diário Oficial. Faça resumos claros, objetivos e em português." },
                  { role: "user", content: `Analise esta publicação jurídica e faça um resumo em até 3 parágrafos curtos, destacando: 1) O que está sendo determinado/intimado, 2) Prazos ou ações necessárias, 3) Possíveis consequências. Seja direto e objetivo.\n\nPublicação:\n${texto.slice(0, 2000)}` },
                ],
                temperature: 0.3,
                max_tokens: 300,
              }),
            });
            if (!resp.ok) return null;
            const aiData = await resp.json();
            const resumo: string | null = aiData.choices?.[0]?.message?.content || null;
            if (!resumo) return null;

            // Persiste no Supabase
            try {
              await supabase
                .from("intimacoes")
                .update({ resumo_ia: resumo })
                .eq("id", intim._id)
                .eq("user_id", user.id);
            } catch (_) {}

            // Persiste no localStorage
            const store = loadStore();
            saveStore(store.map(i => i._id === intim._id ? { ...i, _resumoIA: resumo } : i));

            // Notifica a IntimacoesPage para atualizar a UI em tempo real
            window.dispatchEvent(new CustomEvent("intimacao-resumo-gerado", {
              detail: { id: intim._id, resumo },
            }));

            return resumo;
          } catch (_) { return null; }
        };

        // 6a. Aguarda resumos de todas as intimações de HOJE sem resumo
        //     (inclui novas + as que voltaram após exclusão)
        //     Necessário antes do e-mail para garantir que o resumo vai no corpo
        let novasComResumo = recentementeNovas;
        if (hojesSemResumo.length > 0 && groqKey) {
          toast.info("Gerando resumos IA…", { duration: 4000, id: "resumo-ia" });
          const resumosMap = new Map<string, string>();
          await Promise.all(
            hojesSemResumo.map(async intim => {
              const resumo = await gerarResumo(intim);
              if (resumo) resumosMap.set(intim._id, resumo);
            })
          );
          // Aplica os resumos gerados às novas (para o e-mail)
          novasComResumo = recentementeNovas.map(intim =>
            resumosMap.has(intim._id) ? { ...intim, _resumoIA: resumosMap.get(intim._id)! } : intim
          );
          toast.dismiss("resumo-ia");
        }

        // 6b. Resumos históricos (dias anteriores, sem bloquear)
        const historicasSemResumo = uniq.filter(
          n => !n._resumoIA && n._id && !hojesSemResumo.some(r => r._id === n._id)
        );
        if (historicasSemResumo.length > 0 && groqKey) {
          (async () => {
            for (const intim of historicasSemResumo) {
              await gerarResumo(intim);
            }
          })();
        }

        toast.dismiss("auto-fetch");
        if (paraExibirNoToast.length > 0) {
          toast.success(`✅ ${paraExibirNoToast.length} nova(s) intimação(ões) encontrada(s)!`, { duration: 5000 });
        } else {
          toast.success("Intimações atualizadas — nenhuma novidade.", { duration: 3000 });
        }

        // Emite evento com a contagem exata de novas para o TopNav
        window.dispatchEvent(new CustomEvent("intimacoes-novas-count", {
          detail: { count: paraExibirNoToast.length },
        }));

        // Abre o modal de novas intimações se houver novidades no dia
        if (paraExibirNoToast.length > 0) {
          window.dispatchEvent(new CustomEvent("intimacoes-novas-encontradas", {
            detail: { count: paraExibirNoToast.length, hoje: dias[0] },
          }));
        }

        // 7. Notificações automáticas por e-mail — agora com resumo_ia preenchido
        console.log("[AutoFetch] novasComResumo:", novasComResumo.length, "disparando email:", novasComResumo.length > 0);
        if (novasComResumo.length > 0) {
          dispararNotificacoesAutomaticas(novasComResumo, user.id).catch(() => {});
        }

      } catch (err: any) {
        console.error("[AutoFetch] Erro:", err.message);
        toast.dismiss("auto-fetch");
      } finally {
        rodandoRef.current = false;
      }
    })();
  }, [user, fetchComTimeout, buscarTrigger]);

  return { forceBusca };
}
