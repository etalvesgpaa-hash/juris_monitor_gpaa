import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAutoFetchIntimacoes } from "@/hooks/useAutoFetchIntimacoes";
import { TopNav } from "./TopNav";
import { BottomNav } from "./BottomNav";
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
import type { PageId } from "@/types/navigation";

export function AppLayout() {
  const [activePage, setActivePage] = useState<PageId>("dashboard");
  const { user, signOut, isAdmin } = useAuth();

  useAutoFetchIntimacoes();

  const renderPage = () => {
    switch (activePage) {
      case "dashboard":    return <DashboardPage onNavigate={setActivePage} />;
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
    <div className="relative z-[1] flex min-h-screen flex-col overflow-x-hidden bg-background">
      <TopNav
        activePage={activePage}
        onPageChange={setActivePage}
        user={user}
        onSignOut={signOut}
        isAdmin={isAdmin}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 overflow-x-hidden px-3 pb-24 pt-5 sm:px-5 md:px-8 md:pb-10 md:pt-8 xl:px-10">
        <div key={activePage} className="w-full animate-fade-in">
          {renderPage()}
        </div>
      </main>

      <BottomNav activePage={activePage} onPageChange={setActivePage} isAdmin={isAdmin} />

      {/* Modal de tarefas vencendo — aparece automaticamente ao carregar */}
      <TarefasVencendoModal onNavigate={setActivePage} />

      {/* Modal de novas intimações AASP — aparece quando detecta novidades */}
      <NovasIntimacoesModal onVerTodas={() => setActivePage("intimacoes")} />

      {/* Toast de tarefas delegadas pelo admin */}
      <TarefasDelegadasToast onVerTarefas={() => setActivePage("tarefas")} />
    </div>
  );
}
