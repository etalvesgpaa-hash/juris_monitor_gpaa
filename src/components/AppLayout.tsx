import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { TopNav } from "./TopNav";
import { BottomNav } from "./BottomNav";
import { DashboardPage } from "@/pages/DashboardPage";
import { ProcessosPage } from "@/pages/ProcessosPage";
import { ClientesPage } from "@/pages/ClientesPage";
import { TarefasPage } from "@/pages/TarefasPage";
import { ConfigPage } from "@/pages/ConfigPage";
import { IntimacoesPage } from "@/pages/IntimacoesPage";
import { HonorariosPage } from "@/pages/HonorariosPage";
import { NotificacoesPage } from "@/pages/NotificacoesPage";

export type PageId = "dashboard" | "processos" | "intimacoes" | "notificacoes" | "honorarios" | "tarefas" | "clientes" | "config";

export function AppLayout() {
  const [activePage, setActivePage] = useState<PageId>("dashboard");
  const { user, signOut } = useAuth();

  const renderPage = () => {
    switch (activePage) {
      case "dashboard": return <DashboardPage onNavigate={setActivePage} />;
      case "processos": return <ProcessosPage />;
      case "intimacoes": return <IntimacoesPage />;
      case "notificacoes": return <NotificacoesPage />;
      case "honorarios": return <HonorariosPage />;
      case "tarefas": return <TarefasPage />;
      case "clientes": return <ClientesPage />;
      case "config": return <ConfigPage />;
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
    <div className="relative z-[1] min-h-screen">
      <TopNav activePage={activePage} onPageChange={setActivePage} user={user} onSignOut={signOut} />
      <main className="container mx-auto px-4 md:px-8 py-6 md:py-9 pb-24 md:pb-9">
        <div className="animate-fade-in">{renderPage()}</div>
      </main>
      <BottomNav activePage={activePage} onPageChange={setActivePage} />
    </div>
  );
}
