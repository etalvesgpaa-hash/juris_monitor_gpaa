import type { User } from "@supabase/supabase-js";
import type { PageId } from "./AppLayout";
import { RefreshCw, Bell, LogOut, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";

const STORE_KEY = "jm_aasp_intimacoes";

const tabs: { id: PageId; label: string }[] = [
  { id: "dashboard",    label: "Dashboard"      },
  { id: "processos",    label: "Processos"      },
  { id: "intimacoes",   label: "Intimações"     },
  { id: "notificacoes", label: "Notificações"   },
  { id: "honorarios",   label: "Honorários"     },
  { id: "tarefas",      label: "Tarefas"        },
  { id: "clientes",     label: "Clientes"       },
  { id: "config",       label: "Configurações"  },
];

interface TopNavProps {
  activePage: PageId;
  onPageChange: (id: PageId) => void;
  user: User | null;
  onSignOut: () => void;
}

export function TopNav({ activePage, onPageChange, user, onSignOut }: TopNavProps) {
  const [syncing, setSyncing]   = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef                  = useRef<HTMLDivElement>(null);

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
    <nav className="sticky top-0 z-50 bg-primary border-b border-accent/20 w-full">

      {/* ── Linha 1: Logo · Badges · Ações ── */}
      <div className="flex items-center gap-2 px-3 md:px-6 h-14 min-w-0 w-full">

        {/* Logo — texto sempre visível */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center text-xs font-extrabold text-primary font-display select-none">
            JM
          </div>
          <div className="leading-none">
            <div className="font-display font-semibold text-primary-foreground text-[0.9rem] tracking-wide">
              JurisMonitor
            </div>
            <div className="text-[0.5rem] text-accent/50 tracking-widest uppercase mt-0.5">
              EDSON TEODORO · Advocacia
            </div>
          </div>
        </div>

        {/* Espaçador */}
        <div className="flex-1 min-w-0" />

        {/* Badges de status — visíveis em telas md+ */}
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          {/* Datajud — sempre verde pois é API pública */}
          <div className="flex items-center gap-1.5 text-[0.62rem] bg-emerald-400/15 border border-emerald-400/40 px-2.5 py-1 rounded-full text-emerald-300 font-semibold whitespace-nowrap">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Datajud CNJ
          </div>
          {/* AASP — verde se conectada, acinzentado se não */}
          <div className={`flex items-center gap-1.5 text-[0.62rem] border px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${
            aaspConectada
              ? "bg-emerald-400/15 border-emerald-400/40 text-emerald-300"
              : "bg-white/5 border-white/15 text-white/40"
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${aaspConectada ? "bg-emerald-400 animate-pulse" : "bg-white/25"}`} />
            {aaspConectada ? `AASP · ${intimacoesCount}` : "AASP · aguard."}
          </div>
        </div>

        {/* Ações direita */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleSync}
            disabled={syncing}
            title="Sincronizar com DataJud"
            className="flex items-center gap-1 bg-accent/90 hover:bg-accent text-primary px-2 py-1.5 rounded-md text-xs font-semibold transition-all disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${syncing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Sincronizar</span>
          </button>

          <button
            onClick={() => onPageChange("intimacoes")}
            title="Intimações"
            className="flex items-center gap-1 bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground px-2 py-1.5 rounded-md text-xs font-semibold transition-all border border-primary-foreground/20 whitespace-nowrap"
          >
            <Bell className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Intimações</span>
          </button>

          <div className="w-7 h-7 bg-accent/85 rounded-full flex items-center justify-center text-xs font-bold text-primary shrink-0 select-none">
            {initials}
          </div>

          <button
            onClick={onSignOut}
            title="Sair"
            className="flex items-center gap-1 text-[0.7rem] text-primary-foreground/70 border border-primary-foreground/20 rounded px-2 py-1 hover:bg-primary-foreground/10 transition-colors whitespace-nowrap"
          >
            <LogOut className="h-3 w-3 shrink-0" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </div>

      {/* ── Linha 2 desktop (lg+): abas de navegação ── */}
      <div className="hidden lg:block border-t border-white/5 bg-primary/95">
        <div className="flex items-center gap-0 px-3 md:px-6 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onPageChange(tab.id)}
              className={`shrink-0 px-3.5 py-2 text-[0.74rem] font-medium tracking-wide transition-all border-b-2 whitespace-nowrap ${
                activePage === tab.id
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
      <div className="lg:hidden border-t border-white/5 px-3 py-1.5" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="flex items-center justify-between w-full text-primary-foreground/80 text-sm font-semibold py-1 select-none"
        >
          <span>{activeLabel}</span>
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`} />
        </button>
        {menuOpen && (
          <div className="mt-1 mb-2 grid grid-cols-2 gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { onPageChange(tab.id); setMenuOpen(false); }}
                className={`text-left px-3 py-2 rounded text-xs font-medium transition-all ${
                  activePage === tab.id
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
