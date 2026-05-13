import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAutoFetchIntimacoes } from "@/hooks/useAutoFetchIntimacoes";
import { TopNav } from "./TopNav";
import { BottomNav } from "./BottomNav";
import { DashboardPage }   from "@/pages/DashboardPage";
import { ProcessosPage }   from "@/pages/ProcessosPage";
import { ClientesPage }    from "@/pages/ClientesPage";
import { TarefasPage }     from "@/pages/TarefasPage";
import { ConfigPage }      from "@/pages/ConfigPage";
import { IntimacoesPage }  from "@/pages/IntimacoesPage";
import { HonorariosPage }  from "@/pages/HonorariosPage";
import { NotificacoesPage } from "@/pages/NotificacoesPage";

export type PageId =
  | "dashboard" | "processos" | "intimacoes" | "notificacoes"
  | "honorarios" | "tarefas" | "clientes" | "config";

export function AppLayout() {
  const [activePage, setActivePage] = useState<PageId>("dashboard");
  const { user, signOut } = useAuth();

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
    /*
     * overflow-x-hidden no wrapper externo impede que conteúdo interno
     * extra-largo quebre o layout e crie barra de scroll horizontal,
     * especialmente ao aumentar o zoom do browser.
     */
    <div className="relative z-[1] flex flex-col min-h-screen">
      <TopNav activePage={activePage} onPageChange={setActivePage} user={user} onSignOut={signOut} />

      {/* w-full garante que o main nunca ultrapasse a viewport no zoom */}
      <main className="flex-1 w-full max-w-screen-2xl mx-auto px-3 sm:px-6 md:px-8 py-5 md:py-8 pb-24 md:pb-10">
        <div className="animate-fade-in">
          {renderPage()}
        </div>
      </main>

      <BottomNav activePage={activePage} onPageChange={setActivePage} />
    </div>
  );
}
