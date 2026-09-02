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
  Search,
  Star,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
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

const SIDEBAR_FAVORITES_KEY = "jm_sidebar_favorites";
const SIDEBAR_RECENTS_KEY = "jm_sidebar_recents";

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
  const [query, setQuery] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<PageId[]>(() => {
    try { return JSON.parse(localStorage.getItem(SIDEBAR_FAVORITES_KEY) || "[]"); } catch { return []; }
  });
  const [recentIds, setRecentIds] = useState<PageId[]>(() => {
    try { return JSON.parse(localStorage.getItem(SIDEBAR_RECENTS_KEY) || "[]"); } catch { return []; }
  });

  const allItems = [...primaryItems, ...managementItems, ...(isAdmin ? [{ id: "admin" as PageId, label: "Administração", icon: Shield }] : [])];
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const matchesQuery = (item: NavigationItem) => !normalizedQuery || item.label.toLocaleLowerCase("pt-BR").includes(normalizedQuery);

  const navigate = (page: PageId) => {
    const nextRecents = [page, ...recentIds.filter((id) => id !== page)].slice(0, 3);
    setRecentIds(nextRecents);
    localStorage.setItem(SIDEBAR_RECENTS_KEY, JSON.stringify(nextRecents));
    onPageChange(page);
    onMobileClose();
  };

  const toggleFavorite = (page: PageId) => {
    const nextFavorites = favoriteIds.includes(page)
      ? favoriteIds.filter((id) => id !== page)
      : [...favoriteIds, page];
    setFavoriteIds(nextFavorites);
    localStorage.setItem(SIDEBAR_FAVORITES_KEY, JSON.stringify(nextFavorites));
  };

  const renderItem = (item: NavigationItem) => {
    const Icon = item.icon;
    const active = activePage === item.id;

    return (
      <div key={item.id} className="group/item flex items-center gap-1">
      <button
        type="button"
        onClick={() => navigate(item.id)}
        title={collapsed ? item.label : undefined}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex h-10 min-w-0 flex-1 items-center rounded-lg text-sm font-medium transition-all",
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
      {!collapsed && (
        <button type="button" onClick={() => toggleFavorite(item.id)} className="rounded-md p-1.5 text-primary-foreground/25 opacity-0 transition-all hover:bg-white/10 hover:text-accent group-hover/item:opacity-100 focus:opacity-100" aria-label={favoriteIds.includes(item.id) ? `Remover ${item.label} dos favoritos` : `Adicionar ${item.label} aos favoritos`} title={favoriteIds.includes(item.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}>
          <Star className={cn("h-3.5 w-3.5", favoriteIds.includes(item.id) && "fill-accent text-accent")} />
        </button>
      )}
      </div>
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
          {!collapsed && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-foreground/35" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar no menu..." className="h-9 w-full rounded-lg border border-white/10 bg-white/5 pl-9 pr-3 text-xs text-primary-foreground outline-none placeholder:text-primary-foreground/30 focus:border-accent/50 focus:bg-white/8 focus:ring-2 focus:ring-accent/15" aria-label="Buscar no menu" />
            </div>
          )}

          {!collapsed && !normalizedQuery && favoriteIds.length > 0 && (
            <div className="space-y-1">
              <p className="mb-2 px-3 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-primary-foreground/32">Favoritos</p>
              {favoriteIds.map((id) => allItems.find((item) => item.id === id)).filter(Boolean).map((item) => renderItem(item!))}
            </div>
          )}

          {!collapsed && !normalizedQuery && recentIds.length > 0 && (
            <div className="space-y-1">
              <p className="mb-2 px-3 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-primary-foreground/32">Recentes</p>
              {recentIds.map((id) => allItems.find((item) => item.id === id)).filter(Boolean).map((item) => renderItem(item!))}
            </div>
          )}

          <div className="space-y-1">
            {!collapsed && <p className="mb-2 px-3 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-primary-foreground/32">Escritório</p>}
            {primaryItems.filter(matchesQuery).map(renderItem)}
          </div>

          <div className="space-y-1">
            {!collapsed && <p className="mb-2 px-3 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-primary-foreground/32">Gestão</p>}
            {managementItems.filter(matchesQuery).map(renderItem)}
          </div>

          {isAdmin && matchesQuery({ id: "admin", label: "Administração", icon: Shield }) && (
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
