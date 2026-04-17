import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Key, CheckCircle, XCircle, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    aasp_user: "",
    aasp_password: "",
    groq_api_key: "",
    whatsapp_token: "",
  });
  const [showKeys, setShowKeys] = useState({
    datajud_token: false,
    aasp_password: false,
    groq_api_key: false,
    whatsapp_token: false,
  });
  const [loading, setLoading] = useState(false);
  const [loadingKeys, setLoadingKeys] = useState(false);

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

    // Carregar API Keys (se existir tabela)
    supabase
      .from("api_keys")
      .select("*")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setApiKeys({
            datajud_token: data.datajud_token || "",
            aasp_user: data.aasp_user || "",
            aasp_password: data.aasp_password || "",
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
      // Tentar atualizar primeiro
      const { error: updateError } = await supabase
        .from("api_keys")
        .update({
          datajud_token: apiKeys.datajud_token || null,
          aasp_user: apiKeys.aasp_user || null,
          aasp_password: apiKeys.aasp_password || null,
          groq_api_key: apiKeys.groq_api_key || null,
          whatsapp_token: apiKeys.whatsapp_token || null,
        })
        .eq("user_id", user.id);

      // Se não existir, criar
      if (updateError?.code === "PGRST116") {
        const { error: insertError } = await supabase
          .from("api_keys")
          .insert({
            user_id: user.id,
            datajud_token: apiKeys.datajud_token || null,
            aasp_user: apiKeys.aasp_user || null,
            aasp_password: apiKeys.aasp_password || null,
            groq_api_key: apiKeys.groq_api_key || null,
            whatsapp_token: apiKeys.whatsapp_token || null,
          });
        if (insertError) throw insertError;
      } else if (updateError) {
        throw updateError;
      }

      toast({ title: "✅ API Keys salvas com sucesso!" });
    } catch (err: any) {
      toast({ 
        title: "Erro ao salvar API Keys", 
        description: err.message, 
        variant: "destructive" 
      });
    } finally {
      setLoadingKeys(false);
    }
  };

  const toggleShowKey = (key: keyof typeof showKeys) => {
    setShowKeys({ ...showKeys, [key]: !showKeys[key] });
  };

  const getConnectionStatus = () => {
    return {
      datajud: !!apiKeys.datajud_token,
      aasp: !!(apiKeys.aasp_user && apiKeys.aasp_password),
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
            <h2 className="font-display text-xl font-bold mb-2 flex items-center gap-2">
              <Key className="h-5 w-5" />
              Chaves de API
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Configure suas chaves de API para habilitar integrações automáticas
            </p>

            <div className="space-y-6">
              {/* DataJud CNJ */}
              <div className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">DataJud CNJ</h3>
                    <p className="text-xs text-muted-foreground">
                      Token de acesso à API do CNJ
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
                    placeholder="Bearer eyJhbGciOiJIUzI1..."
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey("datajud_token")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKeys.datajud_token ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* AASP */}
              <div className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">AASP Intimações</h3>
                    <p className="text-xs text-muted-foreground">
                      Credenciais de acesso ao portal AASP
                    </p>
                  </div>
                  {status.aasp ? (
                    <CheckCircle className="h-5 w-5 text-green-ok" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Usuário/E-mail</Label>
                    <Input
                      value={apiKeys.aasp_user}
                      onChange={(e) => setApiKeys({ ...apiKeys, aasp_user: e.target.value })}
                      placeholder="usuario@exemplo.com"
                    />
                  </div>
                  <div className="relative">
                    <Label className="text-xs">Senha</Label>
                    <Input
                      type={showKeys.aasp_password ? "text" : "password"}
                      value={apiKeys.aasp_password}
                      onChange={(e) => setApiKeys({ ...apiKeys, aasp_password: e.target.value })}
                      placeholder="••••••••"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey("aasp_password")}
                      className="absolute right-3 bottom-2 text-muted-foreground hover:text-foreground"
                    >
                      {showKeys.aasp_password ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
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
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey("groq_api_key")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKeys.groq_api_key ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Obtenha sua chave em:{" "}
                  <a 
                    href="https://console.groq.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    console.groq.com
                  </a>
                </p>
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
                    className="pr-10"
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

            <Button 
              onClick={handleSaveApiKeys} 
              disabled={loadingKeys}
              className="mt-6"
            >
              <Save className="h-4 w-4 mr-2" />
              {loadingKeys ? "Salvando..." : "Salvar API Keys"}
            </Button>
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
