import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useClientes,
  useCreateCliente,
  useUpdateCliente,
  useDeleteCliente,
} from "@/hooks/useClientes";
import { useToast } from "@/hooks/use-toast";
import {
  Edit2,
  Trash2,
  Mail,
  MailX,
  Pause,
  Play,
  Plus,
  Search,
  AlertCircle,
  RefreshCw,
  Sparkles,
  MessageCircle,
  Send,
  Clock,
  Users,
  CheckCircle2,
  Bell,
  Eye,
  X,
  Globe,
  FileText,
} from "lucide-react";
import type { Cliente } from "../hooks/useClientes";
import { supabase } from "@/lib/supabase";
import { INTIMACOES_STORE_KEY } from "@/hooks/useAutoFetchIntimacoes";
import { useAuth } from "@/hooks/useAuth";

// ─── Types ───────────────────────────────────────────────────────────────────

interface NotificacaoEnviada {
  id: string;
  cliente_id: string;
  numero_processo: string;
  assunto: string;
  resumo_ia: string | null;
  email_destino: string;
  status: string;
  created_at: string;
  intimacao_id: string | null;
}

interface IntimacaoLocal {
  _id: string;
  _data: string;
  _numProc: string | null;
  _titulo: string;
  _resumoIA: string | null;
  textoPublicacao?: string;
  Texto?: string;
  texto?: string;
  Conteudo?: string;
  conteudo?: string;
  [key: string]: unknown;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtData(s: string) {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime())
    ? s
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDateTime(s: string | null | undefined) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime())
    ? s
    : d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function formatPhone(tel: string) {
  return tel.replace(/\D/g, "");
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClientesPage() {
  const { user } = useAuth();
  const nomeAdvogado = (user?.user_metadata?.full_name as string) || user?.email?.split("@")[0] || "Dr.(a)";
  const { data: clientes = [], isLoading, refetch } = useClientes();
  const createCliente = useCreateCliente();
  const updateCliente = useUpdateCliente();
  const deleteCliente = useDeleteCliente();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    nome: "",
    cpf_cnpj: "",
    email: "",
    telefone: "",
    endereco: "",
    observacoes: "",
    numeros_processo: [] as string[],
    notificacoes_email: true,
    notificacoes_whatsapp: false,
    status_monitoramento: "ativo" as "ativo" | "pausado" | "inativo",
  });
  const [processoInput, setProcessoInput] = useState("");

  // Per-cliente state for actions in progress
  const [sendingEmail, setSendingEmail] = useState<Record<string, boolean>>({});
  const [reprocessing, setReprocessing] = useState<Record<string, boolean>>({});
  const [updatingResumos, setUpdatingResumos] = useState<Record<string, boolean>>({});
  const [lastNotificacoes, setLastNotificacoes] = useState<Record<string, NotificacaoEnviada>>({});

  // Modal de visualização do resumo da intimação enviada por e-mail
  const [modalResumo, setModalResumo] = useState<{
    nomeCliente: string;
    assunto: string;
    resumo_ia: string;
    email_destino: string;
    created_at: string;
  } | null>(null);

  // Modal processo clicável
  const [modalProcesso, setModalProcesso] = useState<{
    cliente: Cliente;
    processo: string;
  } | null>(null);

  const editingId = editing?.id ?? null;

  // Stats
  const totalClientes = clientes.length;
  const clientesAtivos = clientes.filter((c) => c.status_monitoramento === "ativo").length;
  const [notificacoesHoje, setNotificacoesHoje] = useState(0);

  // Load last notifications for each client.
  // Para clientes sem notificação enviada, busca o resumo direto da tabela intimacoes.
  const loadLastNotificacoes = useCallback(async () => {
    if (!user) return;

    // 1. Notificações já enviadas (fonte principal)
    const { data: enviadas } = await supabase
      .from("notificacoes_enviadas")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "enviado")
      .order("created_at", { ascending: false });

    const byCliente: Record<string, NotificacaoEnviada> = {};
    for (const n of (enviadas || []) as NotificacaoEnviada[]) {
      const existing = byCliente[n.cliente_id];
      // Prefere o registro com resumo_ia; entre iguais mantém o mais recente
      if (!existing || (!existing.resumo_ia && n.resumo_ia)) {
        byCliente[n.cliente_id] = n;
      }
    }

    // 2. Para clientes ainda sem resumo, busca direto na tabela intimacoes
    const clientesSemResumo = clientes.filter(
      (c) => !byCliente[c.id]?.resumo_ia && c.numeros_processo && c.numeros_processo.length > 0
    );

    if (clientesSemResumo.length > 0) {
      const { data: intimacoesDB } = await supabase
        .from("intimacoes")
        .select("resumo_ia, numero_processo, data_publicacao, tipo")
        .eq("user_id", user.id)
        .eq("origem", "aasp")
        .not("resumo_ia", "is", null)
        .order("data_publicacao", { ascending: false })
        .limit(500);

      if (intimacoesDB && intimacoesDB.length > 0) {
        for (const cliente of clientesSemResumo) {
          const procs = (cliente.numeros_processo || []).map((p) => p.replace(/\D/g, ""));
          // Acha a intimação mais recente com resumo para qualquer processo deste cliente
          const match = (intimacoesDB as any[]).find((row) => {
            if (!row.numero_processo || !row.resumo_ia) return false;
            const iLimpo = String(row.numero_processo).replace(/\D/g, "");
            return procs.some((p) => p && (iLimpo.includes(p) || p.includes(iLimpo)));
          });
          if (match) {
            // Monta um registro sintético compatível com NotificacaoEnviada
            // para que a UI exiba o resumo mesmo sem e-mail enviado
            const existing = byCliente[cliente.id];
            if (!existing || !existing.resumo_ia) {
              byCliente[cliente.id] = {
                id: `local-${cliente.id}`,
                cliente_id: cliente.id,
                numero_processo: match.numero_processo,
                assunto: match.tipo || "Publicação AASP",
                resumo_ia: match.resumo_ia,
                email_destino: cliente.email || "",
                status: "enviado",
                created_at: match.data_publicacao || new Date().toISOString(),
                intimacao_id: null,
              } as NotificacaoEnviada;
            }
          }
        }
      }
    }

    setLastNotificacoes(byCliente);
  }, [user, clientes]);

  useEffect(() => {
    if (!user) return;
    loadLastNotificacoes();
  }, [user, loadLastNotificacoes]);

  // Contagem de notificações hoje — query direta idêntica ao Dashboard
  useEffect(() => {
    if (!user) return;
    const d = new Date();
    const hoje = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    supabase
      .from("notificacoes_enviadas")
      .select("cliente_id")
      .eq("user_id", user.id)
      .eq("status", "enviado")
      .gte("created_at", `${hoje}T00:00:00`)
      .lte("created_at", `${hoje}T23:59:59`)
      .then(({ data }) => {
        if (!data) return;
        const uniq = new Set((data as any[]).map((n: any) => n.cliente_id));
        setNotificacoesHoje(uniq.size);
      });
  }, [user, lastNotificacoes]);

  // ── Form helpers ────────────────────────────────────────────────────────────

  const resetForm = () => {
    setForm({
      nome: "",
      cpf_cnpj: "",
      email: "",
      telefone: "",
      endereco: "",
      observacoes: "",
      numeros_processo: [],
      notificacoes_email: true,
      notificacoes_whatsapp: false,
      status_monitoramento: "ativo",
    });
    setProcessoInput("");
    setShowForm(false);
    setEditing(null);
  };

  const openEdit = (c: Cliente) => {
    setForm({
      nome: c.nome,
      cpf_cnpj: c.cpf_cnpj || "",
      email: c.email || "",
      telefone: c.telefone || "",
      endereco: c.endereco || "",
      observacoes: c.observacoes || "",
      numeros_processo: c.numeros_processo || [],
      notificacoes_email: c.notificacoes_email ?? true,
      notificacoes_whatsapp: (c as any).notificacoes_whatsapp ?? false,
      status_monitoramento: c.status_monitoramento || "ativo",
    });
    setEditing(c);
    setShowForm(true);
  };

  const adicionarProcesso = () => {
    const proc = processoInput.trim();
    if (!proc) return;
    if (!form.numeros_processo.includes(proc)) {
      setForm({ ...form, numeros_processo: [...form.numeros_processo, proc] });
      setProcessoInput("");
    } else {
      toast({ title: "Processo já adicionado", variant: "default" });
    }
  };

  const removerProcesso = (proc: string) => {
    setForm({ ...form, numeros_processo: form.numeros_processo.filter((p) => p !== proc) });
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast({ title: "Informe o nome do cliente", variant: "destructive" });
      return;
    }
    if (form.notificacoes_email && !form.email) {
      toast({
        title: "E-mail obrigatório",
        description: "Para ativar notificações por e-mail, informe o e-mail do cliente",
        variant: "destructive",
      });
      return;
    }
    if ((form as any).notificacoes_whatsapp && !form.telefone) {
      toast({
        title: "Telefone obrigatório",
        description: "Para ativar notificações por WhatsApp, informe o telefone do cliente",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      nome: form.nome,
      cpf_cnpj: form.cpf_cnpj || null,
      email: form.email || null,
      telefone: form.telefone || null,
      endereco: form.endereco || null,
      observacoes: form.observacoes || null,
      numeros_processo: form.numeros_processo.length > 0 ? form.numeros_processo : null,
      notificacoes_email: form.notificacoes_email,
      notificacoes_whatsapp: (form as any).notificacoes_whatsapp,
      status_monitoramento: form.status_monitoramento,
    };

    try {
      if (editing) {
        await updateCliente.mutateAsync({ id: editing.id, ...payload });
        toast({ title: "✅ Cliente atualizado com sucesso!" });
      } else {
        await createCliente.mutateAsync(payload);
        toast({ title: "✅ Cliente cadastrado com sucesso!" });
      }
      resetForm();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita."))
      return;
    try {
      await deleteCliente.mutateAsync(id);
      toast({ title: "Cliente excluído com sucesso" });
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  const toggleNotificacoes = async (c: Cliente) => {
    if (!c.email && !c.notificacoes_email) {
      toast({
        title: "E-mail necessário",
        description: "Adicione um e-mail ao cliente para ativar notificações",
        variant: "destructive",
      });
      return;
    }
    try {
      await updateCliente.mutateAsync({ id: c.id, notificacoes_email: !c.notificacoes_email });
      toast({ title: c.notificacoes_email ? "Notificações por e-mail desativadas" : "Notificações por e-mail ativadas" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const toggleStatus = async (c: Cliente) => {
    const novoStatus = c.status_monitoramento === "ativo" ? "pausado" : "ativo";
    try {
      await updateCliente.mutateAsync({ id: c.id, status_monitoramento: novoStatus });
      toast({ title: novoStatus === "ativo" ? "Monitoramento reativado" : "Monitoramento pausado" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  // ── WhatsApp ─────────────────────────────────────────────────────────────────

  const enviarWhatsApp = (c: Cliente, resumo?: string | null) => {
    if (!c.telefone) {
      toast({ title: "Telefone não cadastrado", variant: "destructive" });
      return;
    }
    const numero = formatPhone(c.telefone);
    const processos = (c.numeros_processo || []).join(", ") || "não informado";
    const texto = resumo
      ? `*JurisMonitor — Nova Intimação*\n\nOlá ${c.nome},\n\nFoi detectada uma publicação relacionada ao seu processo: ${processos}\n\n*Resumo:*\n${resumo}\n\nEm caso de dúvidas, entre em contato com o escritório.`
      : `*JurisMonitor — Aviso de Intimação*\n\nOlá ${c.nome},\n\nHá uma intimação relacionada ao seu processo: ${processos}.\nEntre em contato com o escritório para mais detalhes.`;

    const url = `https://wa.me/55${numero}?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank");
  };

  // ── AI Summary ───────────────────────────────────────────────────────────────

  const buscarResumoIA = async (numProc: string): Promise<string | null> => {
    try {
      const procLimpo = numProc.replace(/\D/g, "");

      // 1. Busca no Supabase pelo campo numero_processo (coluna indexada, mesma fonte do envio)
      const { data: rowsDB } = await supabase
        .from("intimacoes")
        .select("resumo_ia, numero_processo")
        .eq("user_id", user!.id)
        .eq("origem", "aasp")
        .not("resumo_ia", "is", null)
        .order("data_publicacao", { ascending: false })
        .limit(500);

      if (rowsDB && rowsDB.length > 0) {
        const matchDB = rowsDB.find((row: any) => {
          if (!row.numero_processo) return false;
          const iLimpo = String(row.numero_processo).replace(/\D/g, "");
          return iLimpo && (iLimpo.includes(procLimpo) || procLimpo.includes(iLimpo));
        });
        if (matchDB?.resumo_ia) return matchDB.resumo_ia;
      }

      // 2. Fallback: busca no localStorage
      const stored = localStorage.getItem(INTIMACOES_STORE_KEY);
      if (!stored) return null;

      const intimacoes: IntimacaoLocal[] = JSON.parse(stored);
      const match = intimacoes.find((i) => {
        if (!i._numProc) return false;
        const iLimpo = i._numProc.replace(/\D/g, "");
        return iLimpo.includes(procLimpo) || procLimpo.includes(iLimpo);
      });

      if (!match) return null;
      if (match._resumoIA) return match._resumoIA;

      // 3. Gera resumo via Groq se não existir em nenhuma fonte
      const texto = (match.textoPublicacao || match.Texto || match.texto || match.Conteudo || match.conteudo || "") as string;
      if (!texto || texto.length < 50) return null;

      const { data: apiKeys } = await supabase
        .from("api_keys")
        .select("groq_api_key")
        .eq("user_id", user!.id)
        .maybeSingle();

      const groqKey = apiKeys?.groq_api_key;
      if (!groqKey) return null;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content:
                "Você é um assistente jurídico especializado em analisar publicações do Diário Oficial. Faça resumos claros, objetivos e em português.",
            },
            {
              role: "user",
              content: `Analise esta publicação jurídica e faça um resumo em até 3 parágrafos curtos, destacando: 1) O que está sendo determinado/intimado, 2) Prazos ou ações necessárias, 3) Possíveis consequências. Seja direto e objetivo.\n\nPublicação:\n${texto.slice(0, 2000)}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 300,
        }),
      });

      if (!response.ok) return null;
      const data = await response.json();
      const resumo = data.choices?.[0]?.message?.content || null;

      // Salva resumo de volta no localStorage
      if (resumo) {
        const updated = intimacoes.map((i) =>
          i._id === match._id ? { ...i, _resumoIA: resumo } : i
        );
        localStorage.setItem(INTIMACOES_STORE_KEY, JSON.stringify(updated));
      }

      return resumo;
    } catch {
      return null;
    }
  };

  // ── Send Email manually ───────────────────────────────────────────────────────

  const enviarEmailManual = async (c: Cliente) => {
    if (!c.email) {
      toast({ title: "Cliente sem e-mail cadastrado", variant: "destructive" });
      return;
    }
    if (!c.numeros_processo || c.numeros_processo.length === 0) {
      toast({ title: "Nenhum processo vinculado a este cliente", variant: "destructive" });
      return;
    }

    setSendingEmail((prev) => ({ ...prev, [c.id]: true }));
    try {
      const resumos: string[] = [];
      for (const numProc of c.numeros_processo) {
        const resumo = await buscarResumoIA(numProc);
        if (resumo) resumos.push(`📂 Processo ${numProc}:\n${resumo}`);
      }

      const assinatura = `\n\n---\nO Dr. ${nomeAdvogado} estará avaliando a publicação que foi enviada e, caso haja necessidade, entrará em contato.`;

      const resumoFinal =
        resumos.length > 0
          ? resumos.join("\n\n---\n\n") + assinatura
          : "Nenhum resumo de IA disponível no momento. Acesse o portal para ver os detalhes das intimações." + assinatura;

      const emailData = {
        destinatario: c.email,
        nomeCliente: c.nome,
        numeroProcesso: (c.numeros_processo || []).join(", "),
        dataPublicacao: fmtData(new Date().toISOString()),
        assunto: "Atualização de Intimações",
        resumoIA: resumoFinal,
        textoCompleto: "",
      };

      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailData),
      });

      if (!response.ok) {
        // Lê o erro real retornado pelo servidor para mostrar ao usuário
        let errMsg = "Falha ao enviar e-mail";
        try {
          const errData = await response.json();
          errMsg = errData.dica || errData.error || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      // Registra no banco
      await supabase.from("notificacoes_enviadas").insert({
        user_id: user!.id,
        cliente_id: c.id,
        intimacao_id: null,
        numero_processo: (c.numeros_processo || []).join(", "),
        assunto: "Envio manual — Resumo IA",
        resumo_ia: resumoFinal,
        email_destino: c.email,
        status: "enviado",
      });

      await updateCliente.mutateAsync({
        id: c.id,
        ultima_notificacao: new Date().toISOString(),
      });

      await loadLastNotificacoes();
      toast({ title: `✅ E-mail enviado para ${c.nome}` });
    } catch (err: any) {
      toast({ title: "Erro ao enviar e-mail", description: err.message, variant: "destructive" });
    } finally {
      setSendingEmail((prev) => ({ ...prev, [c.id]: false }));
    }
  };

  // ── Reprocessar Intimações ────────────────────────────────────────────────────

  const reprocessarIntimacoes = async (c: Cliente) => {
    if (!c.numeros_processo || c.numeros_processo.length === 0) {
      toast({ title: "Nenhum processo vinculado", variant: "destructive" });
      return;
    }

    setReprocessing((prev) => ({ ...prev, [c.id]: true }));
    try {
      // Busca todas notificações já enviadas para este cliente
      const { data: jaEnviadas } = await supabase
        .from("notificacoes_enviadas")
        .select("intimacao_id")
        .eq("cliente_id", c.id)
        .eq("status", "enviado");

      const idsEnviados = new Set((jaEnviadas || []).map((n: any) => n.intimacao_id).filter(Boolean));

      // Busca intimações do localStorage
      const storeKey = INTIMACOES_STORE_KEY;
      const stored = localStorage.getItem(storeKey);
      if (!stored) {
        toast({ title: "Nenhuma intimação no cache local. Sincronize primeiro.", variant: "default" });
        return;
      }

      const intimacoes: IntimacaoLocal[] = JSON.parse(stored);
      const procLimpas = (c.numeros_processo || []).map((p) => p.replace(/\D/g, ""));

      const matchs = intimacoes.filter((i) => {
        if (!i._numProc) return false;
        const iLimpo = i._numProc.replace(/\D/g, "");
        return procLimpas.some((p) => iLimpo.includes(p) || p.includes(iLimpo));
      });

      if (matchs.length === 0) {
        toast({ title: "Nenhuma intimação encontrada para os processos deste cliente", variant: "default" });
        return;
      }

      let enviados = 0;
      for (const intim of matchs) {
        if (idsEnviados.has(intim._id)) continue; // já enviou

        if (c.email && c.notificacoes_email) {
          const resumo = intim._resumoIA || (await buscarResumoIA(intim._numProc || ""));
          const emailData = {
            destinatario: c.email,
            nomeCliente: c.nome,
            numeroProcesso: intim._numProc,
            dataPublicacao: fmtData(intim._data),
            assunto: intim._titulo || "Nova Publicação AASP",
            resumoIA: (resumo || "Resumo não disponível.") + `\n\n---\nO Dr. ${nomeAdvogado} estará avaliando a publicação que foi enviada e, caso haja necessidade, entrará em contato.`,
            textoCompleto: "",
          };
          const res = await fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(emailData),
          });
          if (res.ok) {
            await supabase.from("notificacoes_enviadas").insert({
              user_id: user!.id,
              cliente_id: c.id,
              intimacao_id: intim._id,
              numero_processo: intim._numProc || "",
              assunto: intim._titulo || "Reprocessamento",
              resumo_ia: resumo,
              email_destino: c.email,
              status: "enviado",
            });
            enviados++;
          }
        }
      }

      await updateCliente.mutateAsync({ id: c.id, ultima_notificacao: new Date().toISOString() });
      await loadLastNotificacoes();
      toast({
        title: enviados > 0
          ? `✅ ${enviados} notificação(ões) reprocessada(s) e enviada(s)`
          : "✓ Nenhuma intimação nova encontrada para reenvio",
      });
    } catch (err: any) {
      toast({ title: "Erro no reprocessamento", description: err.message, variant: "destructive" });
    } finally {
      setReprocessing((prev) => ({ ...prev, [c.id]: false }));
    }
  };

  // ── Atualizar Resumos IA ──────────────────────────────────────────────────────

  const atualizarResumosIA = async (c: Cliente) => {
    if (!c.numeros_processo || c.numeros_processo.length === 0) {
      toast({ title: "Nenhum processo vinculado", variant: "destructive" });
      return;
    }

    setUpdatingResumos((prev) => ({ ...prev, [c.id]: true }));
    try {
      let atualizados = 0;
      for (const numProc of c.numeros_processo) {
        const resumo = await buscarResumoIA(numProc);
        if (resumo) atualizados++;
      }
      toast({
        title: atualizados > 0
          ? `✅ ${atualizados} resumo(s) de IA atualizado(s)`
          : "Nenhum texto de intimação encontrado para gerar resumos",
      });
    } catch (err: any) {
      toast({ title: "Erro ao atualizar resumos", description: err.message, variant: "destructive" });
    } finally {
      setUpdatingResumos((prev) => ({ ...prev, [c.id]: false }));
    }
  };

  // ── Filtered list ─────────────────────────────────────────────────────────────

  const filtered = clientes.filter(
    (c) =>
      c.nome.toLowerCase().includes(search.toLowerCase()) ||
      (c.cpf_cnpj || "").includes(search) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.numeros_processo || []).some((p) => p.includes(search))
  );

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
    <div className="w-full min-w-0 max-w-[1400px] mx-auto px-2 sm:px-4">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4 mb-7">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-accent" />
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              Clientes — Portal
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 ml-13">
            Cadastre clientes e vincule processos para acesso no portal
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              // Reprocessar TODOS os clientes
              toast({ title: "Reprocessando intimações para todos os clientes..." });
              for (const c of clientes.filter(
                (cl) => cl.status_monitoramento === "ativo" && cl.notificacoes_email && cl.email
              )) {
                await reprocessarIntimacoes(c);
              }
            }}
            className="h-9 text-xs gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reprocessar Intimações
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              toast({ title: "Atualizando resumos de IA para todos os clientes..." });
              for (const c of clientes) {
                await atualizarResumosIA(c);
              }
            }}
            className="h-9 text-xs gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Atualizar Resumos do Portal
          </Button>

          <Button
            variant="gold"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            TOTAL CLIENTES
          </div>
          <div className="text-4xl font-bold font-display">{totalClientes}</div>
          <div className="text-xs text-muted-foreground mt-1">cadastrados</div>
        </div>
        <div className="bg-card border-2 border-green-500/30 rounded-xl p-5">
          <div className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            ATIVOS
          </div>
          <div className="text-4xl font-bold font-display text-green-600">{clientesAtivos}</div>
          <div className="text-xs text-muted-foreground mt-1">com acesso</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            NOTIFICAÇÕES
          </div>
          <div className="text-4xl font-bold font-display">{notificacoesHoje}</div>
          <div className="text-xs text-muted-foreground mt-1">enviadas hoje</div>
        </div>
      </div>

      {/* Busca */}
      <div className="bg-card border border-border rounded-xl p-4 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full pl-10 border border-border rounded-lg px-4 py-2.5 text-sm bg-background focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
            placeholder="Buscar por nome, e-mail ou processo CNJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Formulário — Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
        <div className="bg-card border border-border rounded-2xl w-full max-w-2xl my-auto shadow-2xl">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-xl font-bold">
              {editing ? "Editar Cliente" : "Novo Cliente"}
            </h2>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="gold"
                onClick={handleSave}
                disabled={createCliente.isPending || updateCliente.isPending}
              >
                {createCliente.isPending || updateCliente.isPending ? "Salvando..." : "Salvar"}
              </Button>

              <Button variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Nome Completo *"
                value={form.nome}
                onChange={(v) => setForm({ ...form, nome: v })}
                placeholder="Nome do cliente"
              />
              <InputField
                label="CPF / CNPJ"
                value={form.cpf_cnpj}
                onChange={(v) => setForm({ ...form, cpf_cnpj: v })}
                placeholder="000.000.000-00"
              />
              <InputField
                label="E-mail"
                value={form.email}
                type="email"
                onChange={(v) => setForm({ ...form, email: v })}
                placeholder="email@exemplo.com"
              />
              <InputField
                label="Telefone / WhatsApp"
                value={form.telefone}
                onChange={(v) => setForm({ ...form, telefone: v })}
                placeholder="(11) 99999-9999"
              />
            </div>

            <InputField
              label="Endereço"
              value={form.endereco}
              onChange={(v) => setForm({ ...form, endereco: v })}
              placeholder="Rua, número, bairro, cidade - UF"
            />

            {/* Processos */}
            <div className="border border-border rounded-xl p-4 bg-muted/30">
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground mb-3 block">
                Números de Processo (CNJ)
              </label>
              <p className="text-xs text-muted-foreground mb-3">
                Adicione os números de processo CNJ. Quando houver novas intimações, o cliente
                receberá notificação automática por e-mail e/ou WhatsApp.
              </p>
              <div className="flex gap-2 mb-3">
                <input
                  value={processoInput}
                  onChange={(e) => setProcessoInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && adicionarProcesso()}
                  className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all font-mono"
                  placeholder="0000000-00.0000.0.00.0000"
                />
                <Button variant="outline" size="sm" onClick={adicionarProcesso}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>
              {form.numeros_processo.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {form.numeros_processo.map((proc) => (
                    <div
                      key={proc}
                      className="inline-flex items-center gap-2 bg-accent/10 border border-accent/30 rounded-lg px-3 py-1.5 text-xs font-mono"
                    >
                      {proc}
                      <button
                        onClick={() => removerProcesso(proc)}
                        className="text-red-500 hover:text-red-700 ml-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Nenhum processo adicionado ainda
                </p>
              )}
            </div>

            {/* Notificações */}
            <div className="border border-border rounded-xl p-4 bg-muted/30">
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground mb-3 block">
                Canais de Notificação Automática
              </label>
              <div className="space-y-4">
                {/* E-mail */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Mail className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Notificações por E-mail</p>
                      <p className="text-xs text-muted-foreground">
                        Envio automático com resumo da IA ao detectar nova intimação
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.notificacoes_email}
                      onChange={(e) => setForm({ ...form, notificacoes_email: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                  </label>
                </div>

                {/* WhatsApp */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <MessageCircle className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Notificações por WhatsApp</p>
                      <p className="text-xs text-muted-foreground">
                        Abre o WhatsApp Web para envio manual ao detectar nova intimação
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(form as any).notificacoes_whatsapp || false}
                      onChange={(e) =>
                        setForm({ ...form, notificacoes_whatsapp: e.target.checked } as any)
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                  </label>
                </div>

                {/* Status */}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div>
                    <p className="text-sm font-medium">Status do Monitoramento</p>
                    <p className="text-xs text-muted-foreground">
                      Controle se as intimações deste cliente estão sendo monitoradas
                    </p>
                  </div>
                  <select
                    value={form.status_monitoramento}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status_monitoramento: e.target.value as "ativo" | "pausado" | "inativo",
                      })
                    }
                    className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="pausado">Pausado</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Observações */}
            <div>
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground block mb-2">
                Observações
              </label>
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all min-h-[100px]"
                placeholder="Notas e observações sobre o cliente..."
              />
            </div>
          </div>
        </div>
        </div>
        </div>
      )}

      {/* Tabela */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-3"></div>
          Carregando clientes...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">
            {search ? "Nenhum cliente encontrado com este filtro" : "Nenhum cliente cadastrado"}
          </p>
          {!search && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Cadastrar primeiro cliente
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm" style={{ minWidth: "700px", maxWidth: "100%" }}>
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {[
                    "NOME",
                    "E-MAIL",
                    "PROCESSO CNJ",
                    "STATUS",
                    "NOTIFICAÇÕES",
                    "CADASTRADO",
                    "AÇÕES",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const ultimaNotif = lastNotificacoes[c.id];
                  const isLoading =
                    sendingEmail[c.id] || reprocessing[c.id] || updatingResumos[c.id];

                  return (
                    <tr
                      key={c.id}
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                    >
                      {/* NOME */}
                      <td className="px-4 py-3 max-w-[180px]">
                        <div className="font-semibold text-sm truncate" title={c.nome}>{c.nome}</div>
                        {c.cpf_cnpj && (
                          <div className="text-xs text-muted-foreground font-mono truncate">{c.cpf_cnpj}</div>
                        )}
                        {c.telefone && (
                          <div className="text-xs text-muted-foreground truncate">{c.telefone}</div>
                        )}
                      </td>

                      {/* E-MAIL */}
                      <td className="px-4 py-3 max-w-[180px]">
                        {c.email ? (
                          <div className="text-xs truncate" title={c.email}>{c.email}</div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Sem e-mail</span>
                        )}
                      </td>

                      {/* PROCESSO CNJ */}
                      <td className="px-4 py-3 max-w-[200px]">
                        {c.numeros_processo && c.numeros_processo.length > 0 ? (
                          <div className="space-y-1">
                            {c.numeros_processo.slice(0, 2).map((proc) => (
                              <button
                                key={proc}
                                onClick={() => setModalProcesso({ cliente: c, processo: proc })}
                                className="block text-xs font-mono bg-accent/10 hover:bg-accent/20 text-accent hover:text-accent/80 px-2 py-0.5 rounded transition-colors cursor-pointer underline-offset-2 hover:underline"
                                title="Clique para ver opções do processo"
                              >
                                {proc}
                              </button>
                            ))}
                            {c.numeros_processo.length > 2 && (
                              <div className="text-xs text-muted-foreground">
                                +{c.numeros_processo.length - 2} mais
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            Nenhum processo
                          </span>
                        )}
                      </td>

                      {/* STATUS */}
                      <td className="px-4 py-3">
                        {c.status_monitoramento === "ativo" ? (
                          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                            • Ativo
                          </Badge>
                        ) : c.status_monitoramento === "pausado" ? (
                          <Badge variant="outline">Pausado</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Inativo
                          </Badge>
                        )}
                      </td>

                      {/* NOTIFICAÇÕES */}
                      <td className="px-4 py-3 min-w-[140px] max-w-[220px]">
                        <div className="space-y-1.5">
                          {/* Resumo IA — vem de notificação enviada ou direto da tabela intimacoes */}
                          {ultimaNotif?.resumo_ia ? (
                            <>
                              {/* Data — só mostra se for de e-mail real (id não começa com "local-") */}
                              {!ultimaNotif.id.startsWith("local-") && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {fmtDateTime(ultimaNotif.created_at)}
                                </div>
                              )}
                              <div className="mt-1 p-2 bg-accent/5 border border-accent/20 rounded-md">
                                <div className="flex items-center gap-1 mb-1">
                                  <Sparkles className="h-3 w-3 text-accent" />
                                  <span className="text-[0.65rem] font-semibold text-accent uppercase tracking-wide">
                                    Resumo IA
                                  </span>
                                </div>
                                <p className="text-[0.7rem] text-foreground/80 leading-relaxed line-clamp-3">
                                  {ultimaNotif.resumo_ia}
                                </p>
                                <button
                                  onClick={() =>
                                    setModalResumo({
                                      nomeCliente: c.nome,
                                      assunto: ultimaNotif.assunto,
                                      resumo_ia: ultimaNotif.resumo_ia!,
                                      email_destino: ultimaNotif.email_destino,
                                      created_at: ultimaNotif.created_at,
                                    })
                                  }
                                  className="mt-1.5 flex items-center gap-1 text-[0.65rem] text-accent hover:underline"
                                >
                                  <Eye className="h-3 w-3" />
                                  Ver resumo completo
                                </button>
                              </div>
                            </>
                          ) : ultimaNotif && !ultimaNotif.resumo_ia ? (
                            /* Notificação enviada mas sem resumo IA */
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {fmtDateTime(ultimaNotif.created_at)}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground italic">
                              Sem resumo disponível
                            </div>
                          )}

                          {/* Botão Notificar / toggle e-mail */}
                          <button
                            onClick={() => toggleNotificacoes(c)}
                            className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors ${
                              c.notificacoes_email
                                ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {c.notificacoes_email ? (
                              <>
                                <Mail className="h-3 w-3" />
                                Notificar
                              </>
                            ) : (
                              <>
                                <MailX className="h-3 w-3" />
                                Desativado
                              </>
                            )}
                          </button>

                          {/* Botão WhatsApp */}
                          {c.telefone && (
                            <button
                              onClick={() => enviarWhatsApp(c)}
                              className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                            >
                              <MessageCircle className="h-3 w-3" />
                              WA
                            </button>
                          )}
                        </div>
                      </td>

                      {/* CADASTRADO */}
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(c.created_at).toLocaleDateString("pt-BR")}
                      </td>

                      {/* AÇÕES */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          {/* Row 1: Edit + Toggle + Delete */}
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(c)}
                              className="h-7 px-2"
                              title="Editar cliente"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleStatus(c)}
                              className="h-7 px-2"
                              title={c.status_monitoramento === "ativo" ? "Pausar monitoramento" : "Reativar"}
                            >
                              {c.status_monitoramento === "ativo" ? (
                                <Pause className="h-3.5 w-3.5" />
                              ) : (
                                <Play className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(c.id)}
                              className="h-7 px-2"
                              title="Excluir cliente"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          {/* Row 2: Send Email */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => enviarEmailManual(c)}
                            disabled={sendingEmail[c.id] || !c.email}
                            className="h-7 px-2 text-xs gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                            title="Enviar e-mail com resumo IA"
                          >
                            {sendingEmail[c.id] ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <Send className="h-3 w-3" />
                            )}
                            {sendingEmail[c.id] ? "Enviando..." : "Enviar E-mail"}
                          </Button>

                          {/* Row 2b: Send WhatsApp */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => enviarWhatsApp(c, lastNotificacoes[c.id]?.resumo_ia)}
                            disabled={!c.telefone}
                            className="h-7 px-2 text-xs gap-1 text-green-600 border-green-200 hover:bg-green-50"
                            title={c.telefone ? "Enviar WhatsApp com resumo IA" : "Telefone não cadastrado"}
                          >
                            <MessageCircle className="h-3 w-3" />
                            Enviar WA
                          </Button>

                          {/* Row 3: Reprocess + Update Resumos */}
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => reprocessarIntimacoes(c)}
                              disabled={reprocessing[c.id]}
                              className="h-7 px-2 text-xs gap-1 flex-1"
                              title="Reprocessar intimações pendentes"
                            >
                              {reprocessing[c.id] ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                              {reprocessing[c.id] ? "..." : "Reprocessar"}
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => atualizarResumosIA(c)}
                              disabled={updatingResumos[c.id]}
                              className="h-7 px-2 text-xs gap-1 flex-1 text-purple-600 border-purple-200 hover:bg-purple-50"
                              title="Atualizar resumos de IA"
                            >
                              {updatingResumos[c.id] ? (
                                <Sparkles className="h-3 w-3 animate-spin" />
                              ) : (
                                <Sparkles className="h-3 w-3" />
                              )}
                              {updatingResumos[c.id] ? "..." : "IA"}
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal — Resumo da Intimação Enviada por E-mail */}
      {modalResumo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          onClick={() => setModalResumo(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho do modal */}
            <div className="flex items-start justify-between p-5 border-b border-border">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <span className="text-[0.7rem] font-bold uppercase tracking-wider text-accent">
                    Resumo da Intimação — E-mail Enviado
                  </span>
                </div>
                <h3 className="font-display font-bold text-base">{modalResumo.nomeCliente}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{modalResumo.assunto}</p>
              </div>
              <button
                onClick={() => setModalResumo(null)}
                className="text-muted-foreground hover:text-foreground transition-colors ml-4 mt-0.5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Metadados */}
            <div className="flex items-center gap-4 px-5 py-3 bg-muted/30 border-b border-border text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {modalResumo.email_destino}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {fmtDateTime(modalResumo.created_at)}
              </span>
            </div>

            {/* Conteúdo do resumo — rolável */}
            <div className="p-5 overflow-y-auto flex-1">
              <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {modalResumo.resumo_ia}
              </p>
            </div>

            {/* Rodapé do modal */}
            <div className="p-4 border-t border-border flex justify-end">
              <button
                onClick={() => setModalResumo(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rodapé */}
      {filtered.length > 0 && (
        <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-sm text-muted-foreground">
          <div>
            Exibindo {filtered.length} de {clientes.length} cliente(s)
          </div>
          <div className="flex gap-4">
            <span>
              Ativos:{" "}
              <strong className="text-green-600">
                {clientes.filter((c) => c.status_monitoramento === "ativo").length}
              </strong>
            </span>
            <span>
              E-mail ativo:{" "}
              <strong className="text-accent">
                {clientes.filter((c) => c.notificacoes_email).length}
              </strong>
            </span>
            <span>
              WhatsApp:{" "}
              <strong className="text-green-600">
                {clientes.filter((c) => c.telefone).length}
              </strong>
            </span>
          </div>
        </div>
      )}
    </div>

    {/* ── Modal: Opções do Processo ─────────────────────────────────── */}
    {modalProcesso && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-base">Processo</h3>
            <button onClick={() => setModalProcesso(null)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="text-xs font-mono bg-accent/10 px-3 py-2 rounded text-center break-all">
            {modalProcesso.processo}
          </div>
          <div className="text-sm text-muted-foreground text-center">
            Cliente: <strong>{modalProcesso.cliente.nome}</strong>
          </div>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full gap-2 justify-start"
              onClick={() => {
                navigator.clipboard.writeText(modalProcesso.processo);
                toast({ title: "Copiado!", description: "Número do processo copiado." });
              }}
            >
              <FileText className="w-4 h-4" />
              Copiar número
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2 justify-start"
              onClick={() => {
                const url = `https://esaj.tjsp.jus.br/cpopg/search.do?conversationId=&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=${modalProcesso.processo.replace(/[^0-9]/g, "").substring(0,7)}&foroNumeroUnificado=${modalProcesso.processo.slice(-4)}&dePesquisaNuUnificado=${modalProcesso.processo}&dePesquisa=&uuidCaptcha=`;
                window.open(url, "_blank");
              }}
            >
              <Globe className="w-4 h-4" />
              Abrir no TJSP
            </Button>

            <Button
              variant="outline"
              className="w-full gap-2 justify-start"
              onClick={() => {
                const c = modalProcesso.cliente;
                setModalProcesso(null);
                openEdit(c);
              }}
            >
              <Edit2 className="w-4 h-4" />
              Editar cliente
            </Button>
          </div>
        </div>
      </div>
    )}


    </>
  );
}

// ─── Input helper ─────────────────────────────────────────────────────────────

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground block mb-2">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
        placeholder={placeholder}
      />
    </div>
  );
}
