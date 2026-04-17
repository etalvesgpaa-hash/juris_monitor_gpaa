import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export function ConfigPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState({ full_name: "", oab: "", telefone: "", escritorio: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
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
      toast({ title: "Perfil atualizado!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-7">
        <h1 className="font-display text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie seu perfil e preferências</p>
      </div>

      {/* Profile */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-6 shadow-sm">
        <h2 className="font-display text-xl font-bold mb-4">👤 Meu Perfil</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <InputField label="Nome completo" value={profile.full_name} onChange={(v) => setProfile({ ...profile, full_name: v })} placeholder="Dr(a). Nome" />
          <InputField label="OAB" value={profile.oab} onChange={(v) => setProfile({ ...profile, oab: v })} placeholder="OAB/SP 12345" />
          <InputField label="Telefone" value={profile.telefone} onChange={(v) => setProfile({ ...profile, telefone: v })} placeholder="(11) 99999-9999" />
          <InputField label="Escritório" value={profile.escritorio} onChange={(v) => setProfile({ ...profile, escritorio: v })} placeholder="Nome do escritório" />
        </div>
        <Button variant="gold" className="mt-4" onClick={handleSaveProfile} disabled={loading}>
          {loading ? "Salvando..." : "Salvar Perfil"}
        </Button>
      </div>

      {/* API Keys info */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold mb-4">🔑 Integrações</h2>
        <p className="text-sm text-muted-foreground mb-4">
          As chaves de API (AASP, Groq AI, etc.) são configuradas de forma segura no backend. Entre em contato com o suporte para alterações.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { title: "Datajud CNJ", status: "Conectado", ok: true },
            { title: "AASP Intimações", status: "Não configurado", ok: false },
            { title: "Groq AI", status: "Não configurado", ok: false },
            { title: "WhatsApp", status: "Não configurado", ok: false },
          ].map((item) => (
            <div key={item.title} className="flex items-center justify-between border border-border rounded-lg px-4 py-3">
              <span className="text-sm font-medium">{item.title}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                item.ok ? "bg-green-ok/10 text-green-ok" : "bg-muted text-muted-foreground"
              }`}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-[0.72rem] font-bold uppercase tracking-wider text-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
        placeholder={placeholder}
      />
    </div>
  );
}
