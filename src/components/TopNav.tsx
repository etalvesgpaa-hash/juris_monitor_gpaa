import type { User } from "@supabase/supabase-js";
import type { PageId } from "./AppLayout";

const tabs: { id: PageId; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "processos", label: "Processos" },
  { id: "intimacoes", label: "Intimações" },
  { id: "notificacoes", label: "Notificações" },
  { id: "honorarios", label: "Honorários" },
  { id: "tarefas", label: "Tarefas" },
  { id: "clientes", label: "Clientes" },
  { id: "config", label: "Configurações" },
];

interface TopNavProps {
  activePage: PageId;
  onPageChange: (id: PageId) => void;
  user: User | null;
  onSignOut: () => void;
}

export function TopNav({ activePage, onPageChange, user, onSignOut }: TopNavProps) {
  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <nav className="sticky top-0 z-50 bg-primary border-b border-accent/20 px-4 md:px-8 flex items-center justify-between h-16">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-accent rounded-lg flex items-center justify-center text-xs font-extrabold text-primary font-display">
          JM
        </div>
        <div>
          <div className="font-display font-semibold text-primary-foreground text-[1.05rem] tracking-wide">
            JurisMonitor
          </div>
          <div className="text-[0.58rem] text-accent/50 tracking-widest">
            Gestão Processual
          </div>
        </div>
      </div>

      <div className="hidden lg:flex gap-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onPageChange(tab.id)}
            className={`px-3.5 py-1.5 rounded text-[0.78rem] font-medium tracking-wide transition-all ${
              activePage === tab.id
                ? "bg-accent text-primary font-bold"
                : "text-primary-foreground/55 hover:text-primary-foreground/90 hover:bg-primary-foreground/[0.07]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 text-xs bg-accent/10 border border-accent/25 px-3 py-1 rounded-full text-accent font-semibold">
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          Datajud Online
        </div>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-accent/85 rounded-full flex items-center justify-center text-xs font-bold text-primary">
            {initials}
          </div>
          <button
            onClick={onSignOut}
            className="text-[0.7rem] text-primary-foreground/70 border border-primary-foreground/20 rounded px-2 py-0.5 hover:bg-primary-foreground/10 transition-colors"
          >
            Sair
          </button>
        </div>
      </div>
    </nav>
  );
}
