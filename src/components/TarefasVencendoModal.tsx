import { useEffect, useState } from "react";
import { AlertTriangle, Clock, X, ArrowRight, CheckSquare } from "lucide-react";
import { useTarefasVencendo } from "@/hooks/useTarefasVencendo";
import type { PageId } from "./AppLayout";

// Chave para controlar se já exibiu hoje
const STORAGE_KEY = "jm_alerta_tarefas_data";

interface Props {
  onNavigate: (page: PageId) => void;
}

export function TarefasVencendoModal({ onNavigate }: Props) {
  const { tarefasVencendo, isLoading } = useTarefasVencendo();
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (isLoading || tarefasVencendo.length === 0) return;

    // Exibe apenas uma vez por dia
    const hoje = new Date().toISOString().slice(0, 10);
    const ultimaVez = localStorage.getItem(STORAGE_KEY);
    if (ultimaVez === hoje) return;

    // Pequeno delay para não aparecer antes da tela carregar
    const timer = setTimeout(() => setAberto(true), 800);
    return () => clearTimeout(timer);
  }, [isLoading, tarefasVencendo.length]);

  const fechar = () => {
    const hoje = new Date().toISOString().slice(0, 10);
    localStorage.setItem(STORAGE_KEY, hoje);
    setAberto(false);
  };

  const irParaTarefas = () => {
    fechar();
    onNavigate("tarefas");
  };

  if (!aberto) return null;

  const hoje    = tarefasVencendo.filter(t => t.venceHoje);
  const amanha  = tarefasVencendo.filter(t => t.venceAmanha);

  const badgePrioridade = (p: string) => {
    const m: Record<string, string> = {
      alta:  "bg-red-100 text-red-700 border-red-200",
      media: "bg-yellow-100 text-yellow-700 border-yellow-200",
      baixa: "bg-green-100 text-green-700 border-green-200",
    };
    return m[p] ?? "bg-gray-100 text-gray-600 border-gray-200";
  };

  return (
    <>
      {/* Overlay escuro */}
      <div
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
        onClick={fechar}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-card rounded-2xl shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200">

          {/* Cabeçalho */}
          <div className={`px-5 py-4 flex items-start gap-3 ${hoje.length > 0 ? "bg-red-600" : "bg-amber-500"}`}>
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-extrabold text-white text-lg leading-tight">
                {hoje.length > 0 ? "⚠️ Tarefas vencendo hoje!" : "📅 Tarefas vencem amanhã"}
              </h2>
              <p className="text-white/80 text-sm mt-0.5">
                {hoje.length > 0 && amanha.length > 0
                  ? `${hoje.length} tarefa(s) hoje · ${amanha.length} amanhã`
                  : hoje.length > 0
                  ? `${hoje.length} tarefa(s) com prazo hoje`
                  : `${amanha.length} tarefa(s) com prazo amanhã`}
              </p>
            </div>
            <button
              onClick={fechar}
              className="text-white/70 hover:text-white transition-colors shrink-0 mt-0.5"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Lista de tarefas */}
          <div className="max-h-72 overflow-y-auto divide-y divide-border">

            {/* Hoje */}
            {hoje.length > 0 && (
              <>
                <div className="px-5 py-2 bg-red-50 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-red-600" />
                  <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Vence hoje</span>
                </div>
                {hoje.map(t => (
                  <div key={t.id} className="px-5 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckSquare className="h-3.5 w-3.5 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{t.titulo}</p>
                      {t.processo && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          Processo: {t.processo.numero_cnj}
                          {t.processo.classe ? ` · ${t.processo.classe}` : ""}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 text-[0.65rem] font-bold px-2 py-0.5 rounded border ${badgePrioridade(t.prioridade)}`}>
                      {t.prioridade}
                    </span>
                  </div>
                ))}
              </>
            )}

            {/* Amanhã */}
            {amanha.length > 0 && (
              <>
                <div className="px-5 py-2 bg-amber-50 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Vence amanhã</span>
                </div>
                {amanha.map(t => (
                  <div key={t.id} className="px-5 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckSquare className="h-3.5 w-3.5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{t.titulo}</p>
                      {t.processo && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          Processo: {t.processo.numero_cnj}
                          {t.processo.classe ? ` · ${t.processo.classe}` : ""}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 text-[0.65rem] font-bold px-2 py-0.5 rounded border ${badgePrioridade(t.prioridade)}`}>
                      {t.prioridade}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Rodapé com botões */}
          <div className="px-5 py-4 border-t border-border bg-muted/20 flex items-center gap-3 justify-between">
            <button
              onClick={fechar}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Fechar
            </button>
            <button
              onClick={irParaTarefas}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Ver todas as tarefas
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
