import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Key, CheckCircle, XCircle, Save, Scale, Loader2, AlertCircle, FlaskConical } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ConfigPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState({ 
    full_name: "", 
    oab: "", 
    telefone: "", 
    escritorio: "" 
  });
  const [apiKeys, setApiKeys] = useState({
    datajud_token: "",
    aasp_chave: "",
    groq_api_key: "",
    whatsapp_token: "",
  });
  const [showKeys, setShowKeys] = useState({
    datajud_token: false,
    aasp_chave: false,
    groq_api_key: false,
    whatsapp_token: false,
  });
  const [loading, setLoading] = useState(false);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [testingDatajud, setTestingDatajud] = useState(false);
  const [testingAasp, setTestingAasp] = useState(false);
  const [testingGroq, setTestingGroq] = useState(false);

  // Estado do diagnóstico AASP
  type DiagRow = {
    data: string; diaSemana: string; retorno: string; quantidade: number;
    jsonPreview: string; erro?: string;
    rawObj?: any; // objeto raw completo para envelope/campos
  };
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagRows, setDiagRows] = useState<DiagRow[]>([]);
  const [diagJsonAberto, setDiagJsonAberto] = useState<string | null>(null);
  const [diagFmtDetectado, setDiagFmtDetectado] = useState<string>("");
  const [diagStatus, setDiagStatus] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    
    // Carregar perfil
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfile({
            full_name: data.full_name || "",
            oab: data.oab || "",
            telefone: data.telefone || "",
            escritorio: data.escritorio || "",
          });
        }
      });

    // Carregar API Keys
    supabase
      .from("api_keys")
      .select("*")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setApiKeys({
            datajud_token: data.datajud_token || "",
            aasp_chave: data.aasp_chave || "",
            groq_api_key: data.groq_api_key || "",
            whatsapp_token: data.whatsapp_token || "",
          });
        }
      })
      .catch(() => {
        // Tabela não existe ainda
      });
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name || null,
          oab: profile.oab || null,
          telefone: profile.telefone || null,
          escritorio: profile.escritorio || null,
        })
        .eq("user_id", user.id);
      if (error) throw error;
      toast({ title: "✅ Perfil atualizado com sucesso!" });
    } catch (err: any) {
      toast({ 
        title: "Erro ao salvar perfil", 
        description: err.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveApiKeys = async () => {
    if (!user) return;
    setLoadingKeys(true);
    try {
      // Gerar UUID se não houver
      const generateId = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };

      // Verificar se já existe registro (maybeSingle para não gerar erro se não existir)
      const { data: existingRecord, error: selectError } = await supabase
        .from("api_keys")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingRecord) {
        // Atualizar registro existente
        const { error: updateError } = await supabase
          .from("api_keys")
          .update({
            datajud_token: apiKeys.datajud_token || null,
            aasp_chave: apiKeys.aasp_chave || null,
            groq_api_key: apiKeys.groq_api_key || null,
            whatsapp_token: apiKeys.whatsapp_token || null,
            updated_at: new Date().toISOString()
          })
          .eq("user_id", user.id);
        
        if (updateError) throw updateError;
      } else {
        // Inserir novo registro com ID gerado automaticamente
        const { error: insertError } = await supabase
          .from("api_keys")
          .insert({
            id: generateId(),
            user_id: user.id,
            datajud_token: apiKeys.datajud_token || null,
            aasp_chave: apiKeys.aasp_chave || null,
            groq_api_key: apiKeys.groq_api_key || null,
            whatsapp_token: apiKeys.whatsapp_token || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (insertError) {
          console.error("Erro ao inserir:", insertError);
          if (insertError.message.includes("api_keys")) {
            throw new Error("Tabela 'api_keys' não existe. Crie a tabela no Supabase com as colunas: id, user_id, datajud_token, aasp_chave, groq_api_key, whatsapp_token");
          }
          throw insertError;
        }
      }

      // Persiste no localStorage para que IntimacoesPage leia mesmo sem nova query ao Supabase
      if (apiKeys.aasp_chave) localStorage.setItem("jurismonitor_aasp_key", apiKeys.aasp_chave);
      else localStorage.removeItem("jurismonitor_aasp_key");
      if (apiKeys.groq_api_key) localStorage.setItem("jurismonitor_groq_key", apiKeys.groq_api_key);
      else localStorage.removeItem("jurismonitor_groq_key");

      toast({ title: "✅ API Keys salvas com sucesso!" });
    } catch (err: any) {
      console.error("Erro completo:", err);
      toast({ 
        title: "Erro ao salvar API Keys", 
        description: err.message || "Erro desconhecido ao salvar", 
        variant: "destructive" 
      });
    } finally {
      setLoadingKeys(false);
    }
  };

  const toggleShowKey = (key: keyof typeof showKeys) => {
    setShowKeys({ ...showKeys, [key]: !showKeys[key] });
  };

  const testDatajudConnection = async () => {
    if (!apiKeys.datajud_token) {
      toast({ 
        title: "Token não configurado", 
        description: "Configure o token do DataJud antes de testar",
        variant: "destructive" 
      });
      return;
    }

    setTestingDatajud(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast({ 
        title: "✅ DataJud conectado!", 
        description: "API respondeu com sucesso" 
      });
    } catch (err: any) {
      toast({ 
        title: "❌ Erro ao conectar", 
        description: err.message, 
        variant: "destructive" 
      });
    } finally {
      setTestingDatajud(false);
    }
  };

  const testAaspConnection = async () => {
    if (!apiKeys.aasp_chave) {
      toast({ title: "Chave não configurada", description: "Configure a chave AASP antes de testar", variant: "destructive" });
      return;
    }
    setTestingAasp(true);
    try {
      const chave = apiKeys.aasp_chave.trim();

      function fetchComTimeout(url: string, ms: number): Promise<Response> {
        return Promise.race([
          fetch(url, { headers: { Accept: "application/json" } }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timeout após ${ms}ms`)), ms)),
        ]);
      }

      async function fetchRaw(dataParam: string): Promise<any> {
        const aaspUrl = `https://intimacaoapi.aasp.org.br/api/Associado/intimacao/json?chave=${encodeURIComponent(chave)}&data=${dataParam}`;
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(aaspUrl)}`;
        try {
          const r = await fetchComTimeout(proxyUrl, 25000);
          const txt = await r.text();
          if (!txt?.trim()) return { _parseError: "Resposta vazia" };
          return JSON.parse(txt);
        } catch (e: any) {
          return { _parseError: e.message };
        }
      }

      function aaspNorm(raw: any): any[] {
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw?.Intimacoes)) return raw.Intimacoes;
        if (Array.isArray(raw?.Data)) return raw.Data;
        if (Array.isArray(raw?.intimacoes)) return raw.intimacoes;
        for (const v of Object.values(raw || {})) { if (Array.isArray(v)) return v as any[]; }
        return [];
      }

      // Gera últimos 7 dias úteis
      const diasUteis: Date[] = [];
      for (let i = 0; diasUteis.length < 7 && i < 14; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        if (d.getDay() !== 0 && d.getDay() !== 6) diasUteis.push(d);
      }

      // ── Testa ISO vs BR no primeiro dia útil (igual ao projeto de referência) ──
      const d0 = diasUteis[0];
      const fmtISO = d0.toISOString().split("T")[0];
      const fmtBR  = `${String(d0.getDate()).padStart(2,"0")}/${String(d0.getMonth()+1).padStart(2,"0")}/${d0.getFullYear()}`;

      const [resISO, resBR] = await Promise.all([fetchRaw(fmtISO), fetchRaw(fmtBR)]);
      const listaISO = aaspNorm(resISO);
      const listaBR  = aaspNorm(resBR);

      const usarBR = listaBR.length >= listaISO.length;
      const fmtLabel = usarBR ? "DD/MM/YYYY" : "YYYY-MM-DD";

      // Persiste o formato correto para a IntimacoesPage usar
      localStorage.setItem("jurismonitor_aasp_fmt", usarBR ? "BR" : "ISO");

      // ── Busca os demais dias com o formato correto ──
      let total = (usarBR ? listaBR : listaISO).length;
      let diasComDados = total > 0 ? 1 : 0;

      for (let i = 1; i < diasUteis.length; i++) {
        const d = diasUteis[i];
        const param = usarBR
          ? `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`
          : d.toISOString().split("T")[0];
        try {
          const raw = await fetchRaw(param);
          const lista = aaspNorm(raw);
          if (lista.length > 0) { total += lista.length; diasComDados++; }
          await new Promise(r => setTimeout(r, 300));
        } catch {}
      }

      toast({
        title: "✅ AASP conectada!",
        description: `Formato: ${fmtLabel} · ${total} intimação(ões) em ${diasComDados}/7 dias úteis`,
      });

    } catch (err: any) {
      toast({ title: "❌ Erro ao conectar com AASP", description: err.message?.slice(0, 400), variant: "destructive" });
    } finally {
      setTestingAasp(false);
    }
  };

  const testGroqConnection = async () => {
    if (!apiKeys.groq_api_key) {
      toast({ 
        title: "API Key não configurada", 
        description: "Configure a chave Groq antes de testar",
        variant: "destructive" 
      });
      return;
    }

    setTestingGroq(true);
    try {
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKeys.groq_api_key}`,
        }
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const data = await response.json();
      toast({ 
        title: "✅ Groq AI conectada!", 
        description: `${data.data?.length || 0} modelos disponíveis` 
      });
    } catch (err: any) {
      toast({ 
        title: "❌ Erro ao conectar com Groq", 
        description: err.message, 
        variant: "destructive" 
      });
    } finally {
      setTestingGroq(false);
    }
  };

  const runDiagnostico = async () => {
    const chaveResolvida = apiKeys.aasp_chave.trim() || localStorage.getItem("jurismonitor_aasp_key")?.trim() || "";

    if (!chaveResolvida) {
      toast({ title: "Chave AASP não configurada", description: "Salve a chave AASP na aba API Keys primeiro.", variant: "destructive" });
      return;
    }
    setDiagLoading(true);
    setDiagRows([]);
    setDiagJsonAberto(null);
    setDiagFmtDetectado("");
    setDiagStatus("Testando conectividade do servidor com a AASP...");

    const chave = chaveResolvida;

    function fetchComTimeout(url: string, ms: number): Promise<Response> {
      return Promise.race([
        fetch(url, { headers: { Accept: "application/json" } }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms)),
      ]);
    }

    // ── Teste de conectividade via /api/diag-aasp ─────────────────────────────
    // Este endpoint faz a chamada DIRETAMENTE do servidor Vercel para a AASP
    // e retorna diagnóstico detalhado, incluindo se a AASP bloqueou o IP da Vercel.
    try {
      const diagRes = await fetchComTimeout(`/api/diag-aasp?chave=${encodeURIComponent(chave)}`, 30000);
      const diagData = await diagRes.json().catch(() => null);
      if (diagData) {
        const regiao = diagData.vercel_region || "desconhecida";
        const brOk = diagData.resultados?.BR?.ok;
        const brStatus = diagData.resultados?.BR?.httpStatus;
        const brQtd = diagData.resultados?.BR?.quantidadeIntimacoes ?? 0;
        if (!brOk && brStatus === 403) {
          setDiagStatus(`⚠️ Servidor Vercel (região: ${regiao}) está bloqueado pela AASP (HTTP 403). Buscando mesmo assim via proxy...`);
        } else if (brOk) {
          setDiagStatus(`✅ Servidor conectado à AASP (região: ${regiao}). ${brQtd} intimação(ões) hoje. Buscando 7 dias...`);
          setDiagFmtDetectado(diagData.formatoRecomendado === "BR" ? "DD/MM/YYYY (BR)" : "YYYY-MM-DD (ISO)");
          localStorage.setItem("jurismonitor_aasp_fmt", diagData.formatoRecomendado);
        } else {
          setDiagStatus(`⚠️ Servidor (${regiao}): HTTP ${brStatus}. Buscando via proxy...`);
        }
      }
    } catch (_) {
      setDiagStatus("Teste de conectividade falhou. Tentando busca direta...");
    }

    await new Promise(r => setTimeout(r, 800));

    async function fetchRaw(dataParam: string): Promise<any> {
      const aaspUrl = `https://intimacaoapi.aasp.org.br/api/Associado/intimacao/json?chave=${encodeURIComponent(chave)}&data=${dataParam}`;
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(aaspUrl)}`;
      try {
        const r = await fetchComTimeout(proxyUrl, 25000);
        const txt = await r.text();
        if (!txt?.trim()) return { ok: false, raw: null, status: r.status, text: `Resposta vazia (HTTP ${r.status})`, proxy: "/api/proxy" };
        if (!r.ok) return { ok: false, raw: null, status: r.status, text: `HTTP ${r.status}: ${txt.slice(0, 200)}`, proxy: "/api/proxy" };
        try {
          const parsed = JSON.parse(txt);
          return { ok: true, raw: parsed, status: r.status, proxy: "/api/proxy" };
        } catch {
          return { ok: false, raw: null, status: r.status, text: `JSON inválido: ${txt.slice(0, 200)}`, proxy: "/api/proxy" };
        }
      } catch (e: any) {
        return { ok: false, raw: null, status: 0, text: e.message, proxy: "/api/proxy" };
      }
    }

    function aaspNorm(raw: any): any[] {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      if (Array.isArray(raw?.Intimacoes)) return raw.Intimacoes;
      if (Array.isArray(raw?.Data)) return raw.Data;
      if (Array.isArray(raw?.intimacoes)) return raw.intimacoes;
      for (const v of Object.values(raw)) { if (Array.isArray(v)) return v as any[]; }
      return [];
    }

    // Gera últimos 7 dias úteis (igual à tela de Intimações)
    const diasUteis: Date[] = [];
    const cur = new Date();
    while (diasUteis.length < 7) {
      if (cur.getDay() !== 0 && cur.getDay() !== 6) diasUteis.push(new Date(cur));
      cur.setDate(cur.getDate() - 1);
    }

    // ── Detecta formato ISO vs BR no primeiro dia ──
    const d0 = diasUteis[0];
    const fmtISO0 = d0.toISOString().split("T")[0];
    const fmtBR0  = `${String(d0.getDate()).padStart(2,"0")}/${String(d0.getMonth()+1).padStart(2,"0")}/${d0.getFullYear()}`;

    setDiagStatus(`Testando formatos ISO (${fmtISO0}) e BR (${fmtBR0})...`);
    const [resISO0, resBR0] = await Promise.all([fetchRaw(fmtISO0), fetchRaw(fmtBR0)]);
    const listaISO0 = aaspNorm(resISO0.raw);
    const listaBR0  = aaspNorm(resBR0.raw);

    const usarBR = listaBR0.length >= listaISO0.length;
    const fmtLabel = usarBR ? "DD/MM/YYYY (BR)" : "YYYY-MM-DD (ISO)";
    localStorage.setItem("jurismonitor_aasp_fmt", usarBR ? "BR" : "ISO");
    setDiagFmtDetectado(fmtLabel);
    setDiagStatus(`Formato detectado: ${fmtLabel}. Buscando 7 dias úteis...`);

    function toParam(d: Date): string {
      if (usarBR) return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
      return d.toISOString().split("T")[0];
    }

    // ── Busca todos os 10 dias sequencialmente ──
    const resultados: DiagRow[] = [];

    for (let i = 0; i < diasUteis.length; i++) {
      const d = diasUteis[i];
      const iso = d.toISOString().split("T")[0];
      const [ano, mes, dia] = iso.split("-");
      const dataFmt = `${dia}/${mes}/${ano}`;
      const diaSemana = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");

      setDiagStatus(`Buscando ${dataFmt} (${i+1}/7)...`);

      const res = i === 0
        ? (usarBR ? resBR0 : resISO0)
        : await fetchRaw(toParam(d));

      const lista = aaspNorm(res.raw);

      let retorno = "Sem dados";
      let erro: string | undefined;
      if (!res.ok && res.status === 0) { retorno = "Erro de conexão"; erro = res.text; }
      else if (!res.ok) { retorno = `HTTP ${res.status}`; erro = res.text; }
      else if (lista.length > 0) { retorno = "Intimações"; }

      resultados.push({
        data: dataFmt,
        diaSemana,
        retorno,
        quantidade: lista.length,
        jsonPreview: JSON.stringify(res.raw, null, 2).slice(0, 4000),
        rawObj: res.raw,
        erro,
      });

      if (i < diasUteis.length - 1) await new Promise(r => setTimeout(r, 300));
    }

    setDiagRows(resultados);
    setDiagLoading(false);
    setDiagStatus("");
  };

  const getConnectionStatus = () => {
    return {
      datajud: !!apiKeys.datajud_token,
      aasp: !!apiKeys.aasp_chave,
      groq: !!apiKeys.groq_api_key,
      whatsapp: !!apiKeys.whatsapp_token,
    };
  };

  const status = getConnectionStatus();

  return (
    <div>
      <div className="mb-7">
        <h1 className="font-display text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie seu perfil e integrações com APIs externas
        </p>
      </div>

      <Tabs defaultValue="perfil" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-[750px]">
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="apis">API Keys</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
          <TabsTrigger value="diagnostico">Diagnóstico AASP</TabsTrigger>
        </TabsList>

        {/* ABA PERFIL */}
        <TabsContent value="perfil" className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
              👤 Meu Perfil
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nome Completo</Label>
                <Input
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  placeholder="Dr(a). Nome Sobrenome"
                />
              </div>
              <div>
                <Label>OAB</Label>
                <Input
                  value={profile.oab}
                  onChange={(e) => setProfile({ ...profile, oab: e.target.value })}
                  placeholder="OAB/SP 12345"
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={profile.telefone}
                  onChange={(e) => setProfile({ ...profile, telefone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div>
                <Label>Escritório</Label>
                <Input
                  value={profile.escritorio}
                  onChange={(e) => setProfile({ ...profile, escritorio: e.target.value })}
                  placeholder="Nome do Escritório"
                />
              </div>
            </div>
            <Button 
              onClick={handleSaveProfile} 
              disabled={loading}
              className="mt-6"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Salvando..." : "Salvar Perfil"}
            </Button>
          </div>
        </TabsContent>

        {/* ABA API KEYS */}
        <TabsContent value="apis" className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
              <Key className="h-6 w-6" />
              API Keys & Credenciais
            </h2>
            
            <div className="space-y-4">
              {/* DataJud CNJ */}
              <div className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">DataJud CNJ</h3>
                    <p className="text-xs text-muted-foreground">
                      Token de acesso ao DataJud do CNJ
                    </p>
                  </div>
                  {status.datajud ? (
                    <CheckCircle className="h-5 w-5 text-green-ok" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="relative">
                  <Input
                    type={showKeys.datajud_token ? "text" : "password"}
                    value={apiKeys.datajud_token}
                    onChange={(e) => setApiKeys({ ...apiKeys, datajud_token: e.target.value })}
                    placeholder="Token CNJ DataJud"
                    className="pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey("datajud_token")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKeys.datajud_token ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={testDatajudConnection}
                    disabled={testingDatajud || !apiKeys.datajud_token}
                  >
                    {testingDatajud ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Testando...
                      </>
                    ) : (
                      <>⚡ Testar Conexão</>
                    )}
                  </Button>
                </div>
              </div>

              {/* AASP - Novo Layout */}
              <div className="border-2 border-accent/30 rounded-xl p-5 bg-gradient-to-br from-card to-accent/5">
                <div className="flex items-start gap-3 mb-4">
                  <Scale className="h-7 w-7 text-accent shrink-0 mt-1" />
                  <div>
                    <h3 className="font-bold text-lg">AASP — Intimações</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Integração com a API de Intimações da AASP (Associação dos Advogados de São Paulo).
                    </p>
                    <p className="text-sm text-muted-foreground">
                      A chave de acesso é individual, fornecida pela AASP ao associado.
                    </p>
                  </div>
                  {status.aasp && (
                    <CheckCircle className="h-6 w-6 text-green-ok shrink-0" />
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-bold uppercase tracking-wider">
                      CHAVE DE ACESSO AASP
                    </Label>
                    <div className="relative mt-2">
                      <Input
                        type={showKeys.aasp_chave ? "text" : "password"}
                        value={apiKeys.aasp_chave}
                        onChange={(e) => setApiKeys({ ...apiKeys, aasp_chave: e.target.value })}
                        placeholder="3D665015974749886C7525C75B53..."
                        className="pr-10 font-mono text-sm h-11"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey("aasp_chave")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showKeys.aasp_chave ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <Alert className="bg-muted/50 border-muted-foreground/20">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Obtida em{" "}
                      <a
                        href="https://minha.aasp.org.br"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-accent hover:underline"
                      >
                        minha.aasp.org.br
                      </a>
                      {" "}→ Meu Painel → Intimações → API
                    </AlertDescription>
                  </Alert>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={testAaspConnection}
                      disabled={testingAasp || !apiKeys.aasp_chave}
                    >
                      {testingAasp ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Testando...
                        </>
                      ) : (
                        <>⚡ Testar Conexão</>
                      )}
                    </Button>
                    <Button
                      variant="gold"
                      size="sm"
                      onClick={handleSaveApiKeys}
                      disabled={loadingKeys || !apiKeys.aasp_chave}
                    >
                      {loadingKeys ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>Salvar Chave</>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <a
                        href="https://minha.aasp.org.br"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        🔄 Buscar Agora
                      </a>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Groq AI */}
              <div className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">Groq AI</h3>
                    <p className="text-xs text-muted-foreground">
                      API Key para análise de processos com IA
                    </p>
                  </div>
                  {status.groq ? (
                    <CheckCircle className="h-5 w-5 text-green-ok" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="relative">
                  <Input
                    type={showKeys.groq_api_key ? "text" : "password"}
                    value={apiKeys.groq_api_key}
                    onChange={(e) => setApiKeys({ ...apiKeys, groq_api_key: e.target.value })}
                    placeholder="gsk_..."
                    className="pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey("groq_api_key")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKeys.groq_api_key ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-muted-foreground">
                    Obtenha em:{" "}
                    <a 
                      href="https://console.groq.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-accent hover:underline font-semibold"
                    >
                      console.groq.com
                    </a>
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={testGroqConnection}
                    disabled={testingGroq || !apiKeys.groq_api_key}
                  >
                    {testingGroq ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Testando...
                      </>
                    ) : (
                      <>⚡ Testar Conexão</>
                    )}
                  </Button>
                </div>
              </div>

              {/* WhatsApp */}
              <div className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">WhatsApp Business</h3>
                    <p className="text-xs text-muted-foreground">
                      Token para envio de notificações via WhatsApp
                    </p>
                  </div>
                  {status.whatsapp ? (
                    <CheckCircle className="h-5 w-5 text-green-ok" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="relative">
                  <Input
                    type={showKeys.whatsapp_token ? "text" : "password"}
                    value={apiKeys.whatsapp_token}
                    onChange={(e) => setApiKeys({ ...apiKeys, whatsapp_token: e.target.value })}
                    placeholder="EAAx..."
                    className="pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey("whatsapp_token")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKeys.whatsapp_token ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button 
                onClick={handleSaveApiKeys} 
                disabled={loadingKeys}
                size="lg"
              >
                <Save className="h-4 w-4 mr-2" />
                {loadingKeys ? "Salvando..." : "Salvar Todas as API Keys"}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ABA INTEGRAÇÕES */}
        <TabsContent value="integracoes" className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h2 className="font-display text-xl font-bold mb-4">Status das Integrações</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <IntegrationCard
                title="DataJud CNJ"
                description="Consulta processual automática"
                status={status.datajud}
              />
              <IntegrationCard
                title="AASP Intimações"
                description="Importação automática de intimações"
                status={status.aasp}
              />
              <IntegrationCard
                title="Groq AI"
                description="Análise inteligente de processos"
                status={status.groq}
              />
              <IntegrationCard
                title="WhatsApp"
                description="Notificações em tempo real"
                status={status.whatsapp}
              />
            </div>

            <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
              <h3 className="font-semibold mb-2">ℹ️ Informações</h3>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Configure as API Keys na aba &quot;API Keys&quot; para ativar as integrações</li>
                <li>As chaves são armazenadas de forma segura e criptografada</li>
                <li>Você pode testar a conexão após salvar as credenciais</li>
                <li>Algumas funcionalidades requerem integrações ativas</li>
              </ul>
            </div>
          </div>
        </TabsContent>
        {/* ABA DIAGNÓSTICO AASP */}
        <TabsContent value="diagnostico" className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-display text-xl font-bold flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-accent" />
                  Diagnóstico AASP
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Consulta os últimos 7 dias úteis na API AASP e mostra o retorno de cada um
                </p>
              </div>
              <Button
                variant="gold"
                onClick={runDiagnostico}
                disabled={diagLoading || (!apiKeys.aasp_chave && !localStorage.getItem("jurismonitor_aasp_key"))}
              >
                {diagLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Consultando...</>
                ) : (
                  <><FlaskConical className="h-4 w-4 mr-2" /> Executar Diagnóstico</>
                )}
              </Button>
            </div>

            {!apiKeys.aasp_chave && !localStorage.getItem("jurismonitor_aasp_key") && (
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Configure a chave AASP na aba "API Keys" antes de executar o diagnóstico.</AlertDescription>
              </Alert>
            )}

            {/* Status em tempo real */}
            {diagLoading && diagStatus && (
              <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
                {diagStatus}
              </div>
            )}

            {/* Formato detectado */}
            {diagFmtDetectado && !diagLoading && (
              <div className="mb-4 flex items-center gap-2 text-sm px-3 py-2 rounded-lg" style={{ background: "rgba(26,107,58,0.1)", border: "1px solid rgba(26,107,58,0.3)" }}>
                <span className="text-green-700 font-bold">✅ Formato de data detectado:</span>
                <span className="font-mono font-bold">{diagFmtDetectado}</span>
                <span className="text-muted-foreground text-xs ml-1">(salvo e aplicado automaticamente nas buscas)</span>
              </div>
            )}

            {diagRows.length > 0 && (
              <>
                {/* Aviso quando todos os dias deram erro de conexão */}
                {diagRows.every(r => r.retorno === "Erro de conexão") && (
                  <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-600">
                    <strong>⚠️ Todos os proxies falharam.</strong> Detalhes do erro:
                    <pre className="mt-2 text-xs whitespace-pre-wrap break-all opacity-80">{diagRows[0]?.erro}</pre>
                    <p className="mt-2 text-xs opacity-70">Em produção (Vercel) o /api/proxy funciona. Em desenvolvimento local, verifique se a rede permite conexões externas.</p>
                  </div>
                )}

                <div className="overflow-x-auto rounded-lg border border-border mb-4">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 border-b border-border">
                      <tr>
                        {["DATA", "RETORNO", "QTD", "PROXY USADO"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {diagRows.map((row, i) => (
                        <tr key={i} className="border-b border-border hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs">
                            <span className="text-muted-foreground mr-2">{row.diaSemana}</span>
                            <span className="font-bold">{row.data}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              row.retorno === "Intimações"
                                ? "bg-green-500/10 text-green-700"
                                : row.retorno.startsWith("Erro") || row.retorno.startsWith("HTTP")
                                ? "bg-red-500/10 text-red-600"
                                : "bg-muted text-muted-foreground"
                            }`}>
                              {row.retorno}
                            </span>
                            {row.erro && (
                              <span className="block text-[0.65rem] text-red-500 mt-0.5 opacity-70 max-w-[300px] truncate" title={row.erro}>
                                {row.erro}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs font-bold text-accent">
                            {row.quantidade > 0 ? row.quantidade : "—"}
                          </td>
                          <td className="px-4 py-3 text-[0.68rem] text-muted-foreground font-mono">
                            {(row as any).proxy || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Envelope JSON — mostra o rawObj do 1º dia com dados */}
                {(() => {
                  const primeiroCom = diagRows.find(r => r.quantidade > 0 && r.rawObj);
                  const primeiroErro = diagRows.find(r => r.rawObj);
                  const alvo = primeiroCom || primeiroErro;
                  if (!alvo?.rawObj) return null;

                  const lista: any[] = Array.isArray(alvo.rawObj) ? alvo.rawObj
                    : (alvo.rawObj?.Intimacoes ?? alvo.rawObj?.Data ?? alvo.rawObj?.intimacoes ?? []);
                  const primeiroItem = lista[0];
                  const isArray = Array.isArray(alvo.rawObj);
                  const chaves = !isArray ? Object.keys(alvo.rawObj).filter(k => !Array.isArray((alvo.rawObj as any)[k])) : [];

                  return (
                    <div className="space-y-4">
                      {/* Envelope / wrapper */}
                      <div className="rounded-xl border border-border overflow-hidden">
                        <div className="bg-muted/40 px-4 py-2 text-[0.68rem] font-bold uppercase tracking-widest text-muted-foreground">
                          ▼ Envelope JSON (estrutura do retorno da API) — {alvo.data}
                        </div>
                        <div className="p-4 text-xs font-mono text-foreground space-y-1">
                          {isArray ? (
                            <div><span className="text-accent">tipo:</span> Array direto com <span className="font-bold">{lista.length}</span> item(s)</div>
                          ) : (
                            chaves.map(k => (
                              <div key={k}>
                                <span className="text-accent">{k}:</span>{" "}
                                <span className="opacity-80">{JSON.stringify((alvo.rawObj as any)[k]).slice(0, 120)}</span>
                              </div>
                            ))
                          )}
                          {lista.length > 0 && (
                            <div><span className="text-accent">{isArray ? "length" : (alvo.rawObj?.Intimacoes ? "Intimacoes" : alvo.rawObj?.Data ? "Data" : "lista")}:</span>{" "}
                              <span className="font-bold text-green-600">[{lista.length} item(s)]</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Campos do 1º item */}
                      {primeiroItem && (
                        <div className="rounded-xl border border-border overflow-hidden">
                          <div className="bg-muted/40 px-4 py-2 text-[0.68rem] font-bold uppercase tracking-widest text-muted-foreground">
                            ▼ Campos do 1º item com dados ({alvo.data})
                          </div>
                          <div className="p-4 text-xs font-mono text-foreground space-y-1 max-h-64 overflow-y-auto">
                            {Object.entries(primeiroItem).map(([k, v]) => (
                              <div key={k}>
                                <span className="text-accent">{k}:</span>{" "}
                                <span className="opacity-80 break-all">
                                  {typeof v === "string"
                                    ? v.replace(/\r\n|\n/g, "↵").slice(0, 200)
                                    : JSON.stringify(v).slice(0, 200)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* JSON bruto expansível */}
                      <div className="rounded-xl border border-border overflow-hidden">
                        <button
                          className="w-full bg-muted/40 px-4 py-2 text-[0.68rem] font-bold uppercase tracking-widest text-muted-foreground text-left hover:bg-muted/60"
                          onClick={() => setDiagJsonAberto(diagJsonAberto === alvo.data ? null : alvo.data)}
                        >
                          {diagJsonAberto === alvo.data ? "▲" : "▼"} JSON bruto do dia com dados ({alvo.data} · {alvo.jsonPreview.length} chars)
                        </button>
                        {diagJsonAberto === alvo.data && (
                          <pre className="p-4 text-[0.68rem] text-foreground overflow-x-auto max-h-96 leading-relaxed whitespace-pre-wrap break-all bg-muted/20">
                            {alvo.jsonPreview}
                          </pre>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}

            {diagRows.length === 0 && !diagLoading && (
              <div className="text-center py-12 text-muted-foreground">
                <FlaskConical className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Clique em "Executar Diagnóstico" para consultar os últimos 7 dias úteis na API AASP.</p>
                <p className="text-xs mt-1 opacity-60">O diagnóstico detecta automaticamente o formato de data aceito pela API e salva para uso nas buscas.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function IntegrationCard({ 
  title, 
  description, 
  status 
}: { 
  title: string; 
  description: string; 
  status: boolean;
}) {
  return (
    <div className="flex items-center justify-between border border-border rounded-lg px-4 py-3 hover:border-accent/50 transition-colors">
      <div className="flex-1">
        <h3 className="font-medium text-sm">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {status ? (
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-ok" />
          <span className="text-xs font-semibold text-green-ok">Conectado</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground">Não configurado</span>
        </div>
      )}
    </div>
  );
}
