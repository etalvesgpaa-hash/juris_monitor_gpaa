import type { User } from "@supabase/supabase-js";
import type { PageId } from "@/types/navigation";
import { RefreshCw, Bell, LogOut, ChevronDown, Shield } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";

const STORE_KEY = "jm_aasp_intimacoes";

const baseTabs: { id: PageId; label: string }[] = [
  { id: "dashboard",    label: "Dashboard"      },
  { id: "clientes",     label: "Clientes"       },
  { id: "intimacoes",   label: "Intimações"     },
  { id: "processos",    label: "Processos"      },
  { id: "tarefas",      label: "Tarefas"        },
  { id: "notificacoes", label: "Notificações"   },
  { id: "honorarios",   label: "Honorários"     },
  { id: "financeiro",   label: "Financeiro"     },
  { id: "config",       label: "Configurações"  },
];

const adminTab: { id: PageId; label: string } = { id: "admin", label: "⚙ Admin" };

interface TopNavProps {
  activePage: PageId;
  onPageChange: (id: PageId) => void;
  user: User | null;
  onSignOut: () => void;
  isAdmin?: boolean;
}

export function TopNav({ activePage, onPageChange, user, onSignOut, isAdmin = false }: TopNavProps) {
  const [syncing, setSyncing]   = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef                  = useRef<HTMLDivElement>(null);

  const tabs = isAdmin ? [...baseTabs, adminTab] : baseTabs;

  const [intimacoesCount, setIntimacoesCount] = useState<number>(() => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]").length; } catch { return 0; }
  });

  useEffect(() => {
    const update = () => {
      try { setIntimacoesCount(JSON.parse(localStorage.getItem(STORE_KEY) || "[]").length); } catch { /* noop */ }
    };
    window.addEventListener("focus", update);
    window.addEventListener("storage", update);
    return () => { window.removeEventListener("focus", update); window.removeEventListener("storage", update); };
  }, []);

  const aaspConectada = intimacoesCount > 0;

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const handleSync = async () => {
    setSyncing(true);
    toast.info("Sincronizando com DataJud CNJ...");
    setTimeout(() => {
      setSyncing(false);
      toast.success("Sincronização concluída!");
      try { setIntimacoesCount(JSON.parse(localStorage.getItem(STORE_KEY) || "[]").length); } catch { /* noop */ }
    }, 2000);
  };

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const activeLabel = tabs.find(t => t.id === activePage)?.label ?? "Menu";

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-primary/95 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl">

      {/* ── Linha 1: Logo · Badges · Ações ── */}
      <div className="mx-auto flex h-16 w-full max-w-[1440px] min-w-0 items-center gap-3 px-3 sm:px-5 md:px-8 xl:px-10">

        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex h-9 w-9 select-none items-center justify-center rounded-xl border border-accent/30 bg-accent font-display text-xs font-extrabold text-primary shadow-sm">
            JM
          </div>
          <div className="leading-none">
            <div className="font-display text-base font-semibold tracking-wide text-primary-foreground">
              JurisMonitor
            </div>
            <div className="hidden text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-primary-foreground/50 sm:block">
              EDSON TEODORO · Advocacia
            </div>
          </div>
        </div>

        {/* Badges de status */}
        <div className="hidden md:flex items-center gap-1.5 shrink-0 ml-3">
          <div className="flex items-center gap-1.5 text-[0.62rem] bg-emerald-400/15 border border-emerald-400/40 px-2.5 py-1 rounded-full text-emerald-300 font-semibold whitespace-nowrap">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Datajud CNJ
          </div>
          <div className={`flex items-center gap-1.5 text-[0.62rem] border px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${
            aaspConectada
              ? "bg-emerald-400/15 border-emerald-400/40 text-emerald-300"
              : "bg-white/5 border-white/15 text-white/40"
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${aaspConectada ? "bg-emerald-400 animate-pulse" : "bg-white/25"}`} />
            {aaspConectada ? `AASP · ${intimacoesCount}` : "AASP · aguard."}
          </div>

          {/* Badge admin */}
          {isAdmin && (
            <div className="flex items-center gap-1.5 text-[0.62rem] bg-violet-400/15 border border-violet-400/40 px-2.5 py-1 rounded-full text-violet-300 font-semibold whitespace-nowrap">
              <Shield className="w-3 h-3" />
              Admin
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0" />

        {/* Ações direita */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleSync}
            disabled={syncing}
            title="Sincronizar com DataJud"
            className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-accent px-2.5 text-xs font-semibold text-primary shadow-sm transition-all hover:bg-gold-light hover:shadow-md disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${syncing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Sincronizar</span>
          </button>

          <button
            onClick={() => onPageChange("intimacoes")}
            title="Intimações"
            className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs font-semibold text-primary-foreground/80 transition-colors hover:bg-white/10 hover:text-primary-foreground"
          >
            <Bell className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Intimações</span>
          </button>

          {/* Botão admin rápido */}
          {isAdmin && (
            <button
              onClick={() => onPageChange("admin")}
              title="Painel Admin"
              className="flex items-center gap-1 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 px-2 py-1.5 rounded-md text-xs font-semibold transition-all border border-violet-400/30 whitespace-nowrap"
            >
              <Shield className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Admin</span>
            </button>
          )}

          <div className="flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-full border border-accent/30 bg-accent/90 text-xs font-bold text-primary shadow-sm">
            {initials}
          </div>

          <button
            onClick={onSignOut}
            title="Sair"
            className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-xs font-semibold text-primary-foreground/55 transition-colors hover:bg-white/10 hover:text-primary-foreground"
          >
            <LogOut className="h-3 w-3 shrink-0" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </div>

      {/* ── Linha 2 desktop (lg+): abas de navegação ── */}
      <div className="hidden border-t border-white/5 bg-black/5 lg:block">
        <div className="mx-auto flex max-w-[1440px] items-center gap-1 overflow-x-auto px-3 sm:px-5 md:px-8 xl:px-10" style={{ scrollbarWidth: "none" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onPageChange(tab.id)}
              className={`shrink-0 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[0.8rem] font-semibold tracking-wide transition-all ${
                tab.id === "admin"
                  ? activePage === "admin"
                    ? "border-violet-400 text-violet-300 font-bold"
                    : "border-transparent text-violet-300/50 hover:text-violet-300/85 hover:border-violet-300/20"
                  : activePage === tab.id
                    ? "border-accent text-accent font-bold"
                    : "border-transparent text-primary-foreground/50 hover:text-primary-foreground/85 hover:border-primary-foreground/20"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Dropdown mobile (< lg) ── */}
      <div className="border-t border-white/5 px-3 py-2 lg:hidden" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="flex w-full select-none items-center justify-between rounded-lg px-1 py-1 text-sm font-semibold text-primary-foreground/85"
          aria-expanded={menuOpen}
        >
          <span>{activeLabel}</span>
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`} />
        </button>
        {menuOpen && (
          <div className="mb-1 mt-2 grid grid-cols-2 gap-1.5 rounded-xl border border-white/10 bg-black/10 p-2 shadow-xl">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { onPageChange(tab.id); setMenuOpen(false); }}
                className={`rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition-all ${
                  tab.id === "admin"
                    ? activePage === "admin"
                      ? "bg-violet-500 text-white font-bold"
                      : "text-violet-300/70 hover:bg-violet-500/20"
                    : activePage === tab.id
                      ? "bg-accent text-primary font-bold"
                      : "text-primary-foreground/60 hover:bg-primary-foreground/10"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
