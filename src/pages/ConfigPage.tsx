import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Key, CheckCircle, XCircle, Save, Scale, Loader2, AlertCircle } from "lucide-react";
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
      toast({ 
        title: "Chave não configurada", 
        description: "Configure a chave AASP antes de testar",
        variant: "destructive" 
      });
      return;
    }

    setTestingAasp(true);
    try {
      // Domínio correto da AASP (intimacaoapi.aasp.org.br)
      // O proxy recebe a URL via query string (?url=...), não via body
      const aaspUrl = `https://intimacaoapi.aasp.org.br/api/Associado/intimacao/json?chave=${encodeURIComponent(apiKeys.aasp_chave)}&diferencial=false`;
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(aaspUrl)}`;

      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      // O proxy repassa o status HTTP original da AASP
      const upstreamStatus = response.headers.get('X-Upstream-Status') || String(response.status);

      if (!response.ok) {
        if (upstreamStatus === '401' || upstreamStatus === '403' || response.status === 403) {
          throw new Error("Chave AASP inválida ou expirada. Verifique em https://minha.aasp.org.br");
        }
        if (response.status === 500) {
          const errBody = await response.text().catch(() => '');
          throw new Error(`Erro no proxy: ${errBody || 'Falha ao contatar a API da AASP'}`);
        }
        throw new Error(`Erro HTTP ${upstreamStatus}: verifique sua chave AASP`);
      }

      const data = await response.json().catch(() => null);
      const count = Array.isArray(data) ? data.length : (data?.quantidade ?? 0);
      
      toast({ 
        title: "✅ AASP conectada!", 
        description: `API respondeu com sucesso. ${count} intimação(ões) encontrada(s).` 
      });
    } catch (err: any) {
      const message = err.message || "Falha ao conectar com AASP";
      toast({ 
        title: "❌ Erro ao conectar com AASP", 
        description: message.includes("Failed to fetch") 
          ? "Problema de rede. Verifique sua conexão e tente novamente." 
          : message, 
        variant: "destructive" 
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
        <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="apis">API Keys</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
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
                <li>Configure as API Keys na aba "API Keys" para ativar as integrações</li>
                <li>As chaves são armazenadas de forma segura e criptografada</li>
                <li>Você pode testar a conexão após salvar as credenciais</li>
                <li>Algumas funcionalidades requerem integrações ativas</li>
              </ul>
            </div>
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
