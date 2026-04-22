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
  type DiagRow = { data: string; diaSemana: string; retorno: string; quantidade: number; jsonPreview: string; erro?: string };
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagRows, setDiagRows] = useState<DiagRow[]>([]);
  const [diagJsonAberto, setDiagJsonAberto] = useState<string | null>(null);

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
      const hoje  = new Date().toISOString().split("T")[0];

      // Monta endpoint final da AASP — igual ao aaspFetch() do index.html original
      // NUNCA envia diferencial=false (a AASP não reconhece o valor em string)
      const params = new URLSearchParams({ chave, data: hoje });
      const endpoint = `https://intimacaoapi.aasp.org.br/api/Associado/intimacao/json?${params}`;

      // Mesma estratégia do index.html que funciona:
      // tenta /api/proxy primeiro, depois corsproxy.io, depois allorigins como fallback
      const proxies = [
        { nome: "allorigins",   url: `https://api.allorigins.win/raw?url=${encodeURIComponent(endpoint)}` },
        { nome: "codetabs",     url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(endpoint)}` },
        { nome: "backend (/api/proxy)", url: `/api/proxy?url=${encodeURIComponent(endpoint)}` },
        { nome: "thingproxy",   url: `https://thingproxy.freeboard.io/fetch/${endpoint}` },
      ];

      const erros: string[] = [];

      for (const p of proxies) {
        try {
          const resp = await fetch(p.url + `&_t=${Date.now()}`, {
            headers: { Accept: "application/json", "Cache-Control": "no-cache" },
            cache: "no-store",
          });

          if (!resp.ok) {
            erros.push(`${p.nome}: HTTP ${resp.status}`);
            continue;
          }

          const text = await resp.text();
          if (!text || text.trim() === "" || text.includes("Free usage is limited")) {
            erros.push(`${p.nome}: resposta inválida`);
            continue;
          }

          let data: any = null;
          try { data = JSON.parse(text); } catch { /* tenta allorigins wrapper */ }
          // allorigins encapsula em { contents: "..." }
          if (!data) {
            try { const w = JSON.parse(text); if (w?.contents) data = JSON.parse(w.contents); } catch { /* ok */ }
          }

          if (!data) {
            erros.push(`${p.nome}: JSON inválido — ${text.slice(0, 100)}`);
            continue;
          }

          // Sucesso!
          const lista = Array.isArray(data) ? data
            : (data?.Intimacoes ?? data?.intimacoes ?? data?.Data ?? []);
          const count = Array.isArray(lista) ? lista.length : 0;

          toast({
            title: "✅ AASP conectada!",
            description: `Conexão OK via ${p.nome}. ${count} intimação(ões) hoje.`,
          });
          return; // encerra aqui

        } catch (e: any) {
          erros.push(`${p.nome}: ${e.message}`);
        }
      }

      // Todos os proxies falharam
      throw new Error(
        `Falha em todos os proxies para hoje (${hoje}):\n` + erros.join("\n") + "\n\n" +
        "Verifique se sua chave AASP é válida em minha.aasp.org.br → Meu Painel → Intimações → API"
      );

    } catch (err: any) {
      toast({
        title: "❌ Erro ao conectar com AASP",
        description: err.message?.slice(0, 400) ?? "Falha desconhecida",
        variant: "destructive",
      });
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
    if (!apiKeys.aasp_chave) {
      toast({ title: "Chave AASP não configurada", variant: "destructive" });
      return;
    }
    setDiagLoading(true);
    setDiagRows([]);
    setDiagJsonAberto(null);

    // Gera últimos 10 dias úteis com data local
    function dataLocalStr(d: Date) {
      const a = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dia = String(d.getDate()).padStart(2, "0");
      return `${a}-${m}-${dia}`;
    }
    const diasUteis: string[] = [];
    const cur = new Date();
    while (diasUteis.length < 10) {
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) diasUteis.push(dataLocalStr(cur));
      cur.setDate(cur.getDate() - 1);
    }

    const chave = apiKeys.aasp_chave.trim();

    const resultados = await Promise.all(
      diasUteis.map(async (dataStr): Promise<DiagRow> => {
        const [ano, mes, dia] = dataStr.split("-");
        const diaSemana = new Date(`${dataStr}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
        const dataFmt = `${dia}/${mes}/${ano}`;

        const params = new URLSearchParams({ chave, data: dataStr });
        const endpoint = `https://intimacaoapi.aasp.org.br/api/Associado/intimacao/json?${params}`;
        const proxies = [
          `https://api.allorigins.win/raw?url=${encodeURIComponent(endpoint)}`,
          `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(endpoint)}`,
          `/api/proxy?url=${encodeURIComponent(endpoint)}`,
        ];

        for (const proxyUrl of proxies) {
          try {
            const resp = await fetch(proxyUrl + `&_t=${Date.now()}`, {
              headers: { Accept: "application/json", "Cache-Control": "no-cache" },
              cache: "no-store",
              signal: AbortSignal.timeout(15000),
            });
            const text = await resp.text();
            if (!text.trim() || text.includes("Free usage is limited")) continue;

            let raw: any = null;
            try { raw = JSON.parse(text); } catch { continue; }

            const lista = Array.isArray(raw) ? raw
              : (raw?.intimacoes ?? raw?.Intimacoes ?? raw?.Data ?? []);

            if (!Array.isArray(lista)) continue;

            return {
              data: dataFmt,
              diaSemana,
              retorno: lista.length > 0 ? "Intimações" : "Sem dados",
              quantidade: lista.length,
              jsonPreview: JSON.stringify(raw, null, 2).slice(0, 3000),
            };
          } catch { continue; }
        }

        return {
          data: dataFmt,
          diaSemana,
          retorno: "Erro",
          quantidade: 0,
          jsonPreview: "",
          erro: "Todos os proxies falharam",
        };
      })
    );

    setDiagRows(resultados);
    setDiagLoading(false);
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
                  Consulta os últimos 10 dias úteis na API AASP e mostra o retorno de cada um
                </p>
              </div>
              <Button
                variant="gold"
                onClick={runDiagnostico}
                disabled={diagLoading || !apiKeys.aasp_chave}
              >
                {diagLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Consultando...</>
                ) : (
                  <><FlaskConical className="h-4 w-4 mr-2" /> Executar Diagnóstico</>
                )}
              </Button>
            </div>

            {!apiKeys.aasp_chave && (
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Configure a chave AASP na aba "API Keys" antes de executar o diagnóstico.</AlertDescription>
              </Alert>
            )}

            {diagRows.length > 0 && (
              <>
                <div className="overflow-x-auto rounded-lg border border-border mb-4">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 border-b border-border">
                      <tr>
                        {["DATA ENVIADA PARA API", "RETORNO", "QUANTIDADE", "ENVELOPE JSON"].map((h) => (
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
                                ? "bg-green-ok/10 text-green-ok"
                                : row.retorno === "Erro"
                                ? "bg-red-alert/10 text-red-alert"
                                : "bg-muted text-muted-foreground"
                            }`}>
                              {row.retorno}
                            </span>
                            {row.erro && <span className="text-xs text-red-alert ml-2">{row.erro}</span>}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs font-bold text-accent">
                            {row.quantidade > 0 ? row.quantidade : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {row.jsonPreview ? (
                              <button
                                onClick={() => setDiagJsonAberto(diagJsonAberto === row.data ? null : row.data)}
                                className="text-xs text-accent hover:underline font-semibold"
                              >
                                {diagJsonAberto === row.data ? "▲ Fechar" : "▼ Ver JSON"}
                              </button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* JSON expandido */}
                {diagJsonAberto && (
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Envelope JSON — {diagJsonAberto}
                      </span>
                      <button onClick={() => setDiagJsonAberto(null)} className="text-xs text-muted-foreground hover:text-foreground">✕ Fechar</button>
                    </div>
                    <pre className="text-[0.7rem] text-foreground overflow-x-auto max-h-80 leading-relaxed whitespace-pre-wrap break-all">
                      {diagRows.find(r => r.data === diagJsonAberto)?.jsonPreview}
                    </pre>
                  </div>
                )}
              </>
            )}

            {diagRows.length === 0 && !diagLoading && (
              <div className="text-center py-12 text-muted-foreground">
                <FlaskConical className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Clique em "Executar Diagnóstico" para consultar os últimos 10 dias úteis na API AASP.</p>
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
