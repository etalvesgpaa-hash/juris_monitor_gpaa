import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function AuthPage() {
  const [tab, setTab] = useState<"login" | "cadastro">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, resetPassword } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (tab === "login") {
        await signIn(email, password);
      } else {
        await signUp(email, password, name);
        toast({ title: "Conta criada!", description: "Verifique seu e-mail para confirmar." });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) {
      toast({ title: "Informe o e-mail", variant: "destructive" });
      return;
    }
    try {
      await resetPassword(email);
      toast({ title: "E-mail enviado", description: "Verifique sua caixa de entrada." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative z-[1]">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-accent rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="font-display font-extrabold text-primary text-lg">JM</span>
          </div>
          <h1 className="font-display text-2xl font-bold">JurisMonitor</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão Processual Inteligente</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-7 shadow-sm">
          {/* Tab Switcher */}
          <div className="flex bg-muted rounded-lg p-0.5 mb-6">
            <button
              onClick={() => setTab("login")}
              className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
                tab === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => setTab("cadastro")}
              className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
                tab === "cadastro" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Criar conta
            </button>
          </div>

          {/* Fields */}
          <div className="space-y-3">
            <div>
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
            {tab === "cadastro" && (
              <div>
                <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground">Nome completo</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                  placeholder="Dr(a). Nome Sobrenome"
                />
              </div>
            )}
          </div>

          <Button onClick={handleSubmit} disabled={loading} className="w-full mt-5" size="lg">
            {loading ? "Carregando..." : tab === "login" ? "Entrar" : "Criar conta"}
          </Button>

          {tab === "login" && (
            <div className="text-center mt-3">
              <button onClick={handleReset} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Esqueci a senha
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-[0.72rem] text-muted-foreground mt-4">
          Dados protegidos por RLS · Lovable Cloud
        </p>
      </div>
    </div>
  );
}
