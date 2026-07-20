import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BriefcaseBusiness,
  Calculator,
  CheckSquare2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  FileText,
  LayoutDashboard,
  Settings,
  Shield,
  Users,
  X,
} from "lucide-react";
import type { PageId } from "@/types/navigation";
import { cn } from "@/lib/utils";

interface NavigationItem {
  id: PageId;
  label: string;
  icon: LucideIcon;
}

const primaryItems: NavigationItem[] = [
  { id: "dashboard", label: "Visão geral", icon: LayoutDashboard },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "processos", label: "Processos", icon: BriefcaseBusiness },
  { id: "intimacoes", label: "Intimações", icon: FileText },
  { id: "tarefas", label: "Tarefas", icon: CheckSquare2 },
  { id: "notificacoes", label: "Notificações", icon: Bell },
];

const managementItems: NavigationItem[] = [
  { id: "honorarios", label: "Honorários", icon: Calculator },
  { id: "financeiro", label: "Financeiro", icon: CircleDollarSign },
  { id: "config", label: "Configurações", icon: Settings },
];

interface AppSidebarProps {
  activePage: PageId;
  onPageChange: (page: PageId) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  isAdmin?: boolean;
}

export function AppSidebar({
  activePage,
  onPageChange,
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileClose,
  isAdmin = false,
}: AppSidebarProps) {
  const navigate = (page: PageId) => {
    onPageChange(page);
    onMobileClose();
  };

  const renderItem = (item: NavigationItem) => {
    const Icon = item.icon;
    const active = activePage === item.id;

    return (
      <button
        type="button"
        key={item.id}
        onClick={() => navigate(item.id)}
        title={collapsed ? item.label : undefined}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex h-10 w-full items-center rounded-lg text-sm font-medium transition-all",
          collapsed ? "justify-center px-2" : "gap-3 px-3",
          active
            ? "bg-accent text-accent-foreground shadow-sm"
            : "text-primary-foreground/62 hover:bg-white/7 hover:text-primary-foreground",
        )}
      >
        {active && <span className="absolute -left-1 h-5 w-0.5 rounded-full bg-accent-foreground/70" />}
        <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </button>
    );
  };

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-[59] bg-slate-950/45 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[60] flex flex-col border-r border-white/10 bg-primary text-primary-foreground shadow-2xl transition-[width,transform] duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none",
          collapsed ? "lg:w-[76px]" : "lg:w-[248px]",
          "w-[272px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className={cn("flex h-[72px] items-center border-b border-white/8", collapsed ? "justify-center px-3" : "gap-3 px-5")}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent font-display text-sm font-bold text-primary shadow-lg shadow-black/10">
            JM
          </div>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <p className="truncate font-display text-lg font-semibold">JurisMonitor</p>
              <p className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-primary-foreground/40">
                Gestão jurídica
              </p>
            </div>
          )}
          <button type="button" onClick={onMobileClose} className="ml-auto rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Navegação principal">
          <div className="space-y-1">
            {!collapsed && <p className="mb-2 px-3 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-primary-foreground/32">Escritório</p>}
            {primaryItems.map(renderItem)}
          </div>

          <div className="space-y-1">
            {!collapsed && <p className="mb-2 px-3 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-primary-foreground/32">Gestão</p>}
            {managementItems.map(renderItem)}
          </div>

          {isAdmin && (
            <div className="space-y-1 border-t border-white/8 pt-5">
              {renderItem({ id: "admin", label: "Administração", icon: Shield })}
            </div>
          )}
        </nav>

        <div className="hidden border-t border-white/8 p-3 lg:block">
          <button
            type="button"
            onClick={() => onCollapsedChange(!collapsed)}
            className={cn(
              "flex h-9 w-full items-center rounded-lg text-xs font-semibold text-primary-foreground/45 transition-colors hover:bg-white/7 hover:text-primary-foreground",
              collapsed ? "justify-center" : "gap-2 px-3",
            )}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span>Recolher menu</span></>}
          </button>
        </div>
      </aside>
    </>
  );
}
