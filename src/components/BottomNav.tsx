import type { PageId } from "./AppLayout";

const items: { id: PageId; icon: string; label: string }[] = [
  { id: "dashboard", icon: "📊", label: "Dashboard" },
  { id: "processos", icon: "📁", label: "Processos" },
  { id: "intimacoes", icon: "⚖️", label: "Intimações" },
  { id: "tarefas", icon: "📋", label: "Tarefas" },
  { id: "clientes", icon: "👤", label: "Clientes" },
  { id: "honorarios", icon: "💰", label: "Honorários" },
  { id: "config", icon: "⚙️", label: "Config" },
];

interface BottomNavProps {
  activePage: PageId;
  onPageChange: (id: PageId) => void;
}

export function BottomNav({ activePage, onPageChange }: BottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-primary border-t border-accent/20 flex justify-around items-center h-16 px-1">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onPageChange(item.id)}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-[0.6rem] font-semibold transition-all ${
            activePage === item.id
              ? "text-accent"
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
