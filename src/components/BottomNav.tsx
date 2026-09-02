import type { LucideIcon } from "lucide-react";
import { Bell, BriefcaseBusiness, CheckSquare2, LayoutDashboard, Users } from "lucide-react";
import type { PageId } from "@/types/navigation";

const items: { id: PageId; icon: LucideIcon; label: string }[] = [
  { id: "dashboard", icon: LayoutDashboard, label: "Início" },
  { id: "clientes", icon: Users, label: "Clientes" },
  { id: "processos", icon: BriefcaseBusiness, label: "Processos" },
  { id: "tarefas", icon: CheckSquare2, label: "Tarefas" },
  { id: "notificacoes", icon: Bell, label: "Alertas" },
];

interface BottomNavProps {
  activePage: PageId;
  onPageChange: (id: PageId) => void;
  isAdmin?: boolean;
}

export function BottomNav({ activePage, onPageChange }: BottomNavProps) {
  return (
    <nav
      aria-label="Navegação principal móvel"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-primary/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5 items-center gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;

          return (
            <button
              type="button"
              key={item.id}
              onClick={() => onPageChange(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[0.68rem] font-semibold transition-all ${
                isActive
                  ? "bg-white/10 text-accent"
                  : "text-primary-foreground/50 hover:bg-white/5 hover:text-primary-foreground/80"
              }`}
            >
              {isActive && <span className="absolute inset-x-4 -top-2 h-0.5 rounded-full bg-accent" />}
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
