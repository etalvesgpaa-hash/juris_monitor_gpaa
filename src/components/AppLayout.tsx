import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAutoFetchIntimacoes } from "@/hooks/useAutoFetchIntimacoes";
import { TopNav } from "./TopNav";
import { AppSidebar } from "./AppSidebar";
import { TarefasVencendoModal } from "./TarefasVencendoModal";
import { NovasIntimacoesModal } from "./NovasIntimacoesModal";
import { TarefasDelegadasToast } from "@/components/TarefasDelegadasBadge";
import { DashboardPage }    from "@/pages/DashboardPage";
import { ProcessosPage }    from "@/pages/ProcessosPage";
import { ClientesPage }     from "@/pages/ClientesPage";
import { TarefasPage }      from "@/pages/TarefasPage";
import { ConfigPage }       from "@/pages/ConfigPage";
import { IntimacoesPage }   from "@/pages/IntimacoesPage";
import { HonorariosPage }   from "@/pages/HonorariosPage";
import { NotificacoesPage } from "@/pages/NotificacoesPage";
import { AdminPage }        from "@/pages/AdminPage";
import { FinanceiroPage }   from "@/pages/FinanceiroPage";
import { TvDashboard } from "@/components/TvDashboard";
import type { PageId } from "@/types/navigation";

export function AppLayout() {
  const [activePage, setActivePage] = useState<PageId>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("jm_sidebar_collapsed") === "true");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tvOpen, setTvOpen] = useState(false);
  const { user, signOut, isAdmin } = useAuth();

  useAutoFetchIntimacoes();

  const handleSidebarCollapsed = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    localStorage.setItem("jm_sidebar_collapsed", String(collapsed));
  };

  const renderPage = () => {
    switch (activePage) {
      case "dashboard":    return <DashboardPage onNavigate={setActivePage} onOpenTv={() => setTvOpen(true)} />;
      case "processos":    return <ProcessosPage />;
      case "intimacoes":   return <IntimacoesPage />;
      case "notificacoes": return <NotificacoesPage />;
      case "honorarios":   return <HonorariosPage />;
      case "financeiro":   return <FinanceiroPage />;
      case "tarefas":      return <TarefasPage />;
      case "clientes":     return <ClientesPage />;
      case "config":       return <ConfigPage />;
      case "admin":        return isAdmin ? <AdminPage /> : (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p className="text-lg font-display font-semibold">Acesso negado</p>
          <p className="text-sm mt-1">Área restrita a administradores.</p>
        </div>
      );
      default:
        return (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <p className="text-lg font-display font-semibold">Módulo em construção</p>
            <p className="text-sm mt-1">Este módulo será implementado em breve.</p>
          </div>
        );
    }
  };

  return (
    <div className="relative z-[1] flex min-h-screen overflow-x-hidden bg-background">
      <AppSidebar
        activePage={activePage}
        onPageChange={setActivePage}
        collapsed={sidebarCollapsed}
        onCollapsedChange={handleSidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        isAdmin={isAdmin}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav
          activePage={activePage}
          onPageChange={setActivePage}
          user={user}
          onSignOut={signOut}
          onMenuToggle={() => setMobileMenuOpen(true)}
          isAdmin={isAdmin}
        />

        <main className="mx-auto w-full max-w-[1560px] flex-1 overflow-x-hidden px-3 pb-10 pt-5 sm:px-5 md:px-7 md:pt-7 xl:px-9">
          <div key={activePage} className="w-full animate-fade-in">
            {renderPage()}
          </div>
        </main>
      </div>

      {/* Modal de tarefas vencendo — aparece automaticamente ao carregar */}
      <TarefasVencendoModal onNavigate={setActivePage} />

      {/* Modal de novas intimações AASP — aparece quando detecta novidades */}
      <NovasIntimacoesModal onVerTodas={() => setActivePage("intimacoes")} />

      {/* Toast de tarefas delegadas pelo admin */}
      <TarefasDelegadasToast onVerTarefas={() => setActivePage("tarefas")} />
      {tvOpen && <TvDashboard onClose={() => setTvOpen(false)} />}
    </div>
  );
}
