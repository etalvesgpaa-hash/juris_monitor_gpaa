import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAutoFetchIntimacoes } from "@/hooks/useAutoFetchIntimacoes";
import { TopNav } from "./TopNav";
import { BottomNav } from "./BottomNav";
import { TarefasVencendoModal } from "./TarefasVencendoModal";
import { DashboardPage }    from "@/pages/DashboardPage";
import { ProcessosPage }    from "@/pages/ProcessosPage";
import { ClientesPage }     from "@/pages/ClientesPage";
import { TarefasPage }      from "@/pages/TarefasPage";
import { ConfigPage }       from "@/pages/ConfigPage";
import { IntimacoesPage }   from "@/pages/IntimacoesPage";
import { HonorariosPage }   from "@/pages/HonorariosPage";
import { NotificacoesPage } from "@/pages/NotificacoesPage";
import { AdminPage }        from "@/pages/AdminPage";

export type PageId =
  | "dashboard" | "processos" | "intimacoes" | "notificacoes"
  | "honorarios" | "tarefas" | "clientes" | "config" | "admin";

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
      case "tarefas":      return <TarefasPage />;
      case "clientes":     return <ClientesPage />;
      case "config":       return <ConfigPage />;
      case "admin":        return <AdminPage />;
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
    <div className="relative z-[1] flex flex-col min-h-screen overflow-x-auto">
      <TopNav
        activePage={activePage}
        onPageChange={setActivePage}
        user={user}
        onSignOut={signOut}
        isAdmin={isAdmin}
      />

      <main className="flex-1 w-full max-w-screen-2xl mx-auto px-2 sm:px-4 md:px-8 py-4 md:py-8 pb-24 md:pb-10 overflow-x-hidden">
        <div className="animate-fade-in w-full">
          {renderPage()}
        </div>
      </main>

      <BottomNav activePage={activePage} onPageChange={setActivePage} isAdmin={isAdmin} />

      {/* Modal de tarefas vencendo — aparece automaticamente ao carregar */}
      <TarefasVencendoModal onNavigate={setActivePage} />
    </div>
  );
}
