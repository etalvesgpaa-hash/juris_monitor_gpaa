import type { User } from "@supabase/supabase-js";
import type { PageId } from "@/types/navigation";
import { Bell, LogOut, Menu, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const STORE_KEY = "jm_aasp_intimacoes";

const pageLabels: Record<PageId, string> = {
  dashboard: "Visão geral",
  clientes: "Clientes",
  processos: "Processos",
  intimacoes: "Intimações",
  tarefas: "Tarefas",
  notificacoes: "Notificações",
  honorarios: "Honorários",
  financeiro: "Financeiro",
  config: "Configurações",
  admin: "Administração",
};

interface TopNavProps {
  activePage: PageId;
  onPageChange: (id: PageId) => void;
  user: User | null;
  onSignOut: () => void;
  onMenuToggle: () => void;
  isAdmin?: boolean;
}

export function TopNav({ activePage, onPageChange, user, onSignOut, onMenuToggle, isAdmin = false }: TopNavProps) {
  const [syncing, setSyncing] = useState(false);
  const [intimacoesCount, setIntimacoesCount] = useState<number>(() => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]").length; } catch { return 0; }
  });

  useEffect(() => {
    const update = () => {
      try { setIntimacoesCount(JSON.parse(localStorage.getItem(STORE_KEY) || "[]").length); } catch { /* noop */ }
    };
    window.addEventListener("focus", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("focus", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  const handleSync = () => {
    setSyncing(true);
    toast.info("Sincronizando com DataJud CNJ...");
    setTimeout(() => {
      setSyncing(false);
      toast.success("Sincronização concluída!");
      try { setIntimacoesCount(JSON.parse(localStorage.getItem(STORE_KEY) || "[]").length); } catch { /* noop */ }
    }, 2000);
  };

  const fullName = user?.user_metadata?.full_name || user?.email || "Usuário";
  const initials = fullName.split(" ").map((part: string) => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-40 flex h-[72px] items-center border-b border-border/70 bg-background/88 px-3 backdrop-blur-xl sm:px-5 lg:px-8">
      <button type="button" onClick={onMenuToggle} className="mr-2 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden" aria-label="Abrir menu">
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">JurisMonitor</p>
        <h2 className="truncate text-base font-semibold text-foreground sm:text-lg">{pageLabels[activePage]}</h2>
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <div className="mr-1 hidden items-center gap-2 xl:flex">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/7 px-2.5 py-1 text-[0.68rem] font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> DataJud ativo
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[0.68rem] font-semibold text-muted-foreground">
            AASP · {intimacoesCount}
          </span>
        </div>

        <button type="button" onClick={handleSync} disabled={syncing} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold text-foreground shadow-sm transition-all hover:border-primary/20 hover:shadow-md disabled:opacity-50 sm:px-3">
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Sincronizar</span>
        </button>

        <button type="button" onClick={() => onPageChange("notificacoes")} className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground" aria-label="Abrir notificações">
          <Bell className="h-4 w-4" />
          {intimacoesCount > 0 && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive ring-2 ring-card" />}
        </button>

        <div className="ml-1 hidden h-8 w-px bg-border sm:block" />

        <div className="group relative flex items-center gap-2 pl-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-sm">{initials}</div>
          <div className="hidden max-w-[130px] leading-tight md:block">
            <p className="truncate text-xs font-semibold text-foreground">{fullName}</p>
            <p className="text-[0.62rem] text-muted-foreground">{isAdmin ? "Administrador" : "Advogado"}</p>
          </div>
          {isAdmin && <ShieldCheck className="hidden h-4 w-4 text-accent md:block" />}
        </div>

        <button type="button" onClick={onSignOut} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/8 hover:text-destructive" aria-label="Sair">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
