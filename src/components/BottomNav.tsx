import type { PageId } from "./AppLayout";

const baseItems: { id: PageId; icon: string; label: string }[] = [
  { id: "dashboard",    icon: "📊", label: "Dashboard"  },
  { id: "clientes",     icon: "👤", label: "Clientes"   },
  { id: "intimacoes",   icon: "⚖️", label: "Intimações" },
  { id: "processos",    icon: "📁", label: "Processos"  },
  { id: "tarefas",      icon: "📋", label: "Tarefas"    },
  { id: "notificacoes", icon: "🔔", label: "Notif."     },
  { id: "honorarios",   icon: "💰", label: "Honorários" },
  { id: "config",       icon: "⚙️", label: "Config"     },
];

const adminItem = { id: "admin" as PageId, icon: "🛡️", label: "Admin" };

interface BottomNavProps {
  activePage: PageId;
  onPageChange: (id: PageId) => void;
  isAdmin?: boolean;
}

export function BottomNav({ activePage, onPageChange, isAdmin = false }: BottomNavProps) {
  const items = isAdmin ? [...baseItems, adminItem] : baseItems;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-primary border-t border-accent/20 flex justify-around items-center h-16 px-1 overflow-x-auto">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onPageChange(item.id)}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-[0.6rem] font-semibold transition-all shrink-0 ${
            activePage === item.id
              ? item.id === "admin" ? "text-violet-400" : "text-accent"
              : "text-primary-foreground/40 hover:text-primary-foreground/70"
          }`}
        >
          <span className="text-base">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}
