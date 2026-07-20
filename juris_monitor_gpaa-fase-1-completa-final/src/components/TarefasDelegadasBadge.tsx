/**
 * TarefasDelegadasBadge.tsx
 *
 * Badge que aparece na barra de navegação (TopNav / BottomNav)
 * indicando que o usuário tem tarefas delegadas não lidas.
 *
 * Uso no TopNav:
 *   import { TarefasDelegadasBadge } from "@/components/TarefasDelegadasBadge";
 *   ...
 *   <button onClick={() => onPageChange("tarefas")}>
 *     Tarefas
 *     <TarefasDelegadasBadge />
 *   </button>
 */

import { useTarefasDelegadasNaoLidas } from "@/hooks/useDelegacao";

export function TarefasDelegadasBadge() {
  const { data: count = 0 } = useTarefasDelegadasNaoLidas();
  if (count === 0) return null;

  return (
    <span className="inline-flex items-center justify-center min-w-[16px] h-4
                     rounded-full bg-red-500 text-white text-[9px] font-bold
                     px-1 ml-1 leading-none">
      {count > 9 ? "9+" : count}
    </span>
  );
}

/**
 * TarefasDelegadasToast
 *
 * Modal/banner que aparece ao abrir o app se houver tarefas delegadas não lidas.
 * Adicione no AppLayout.tsx.
 */

import { useEffect, useState } from "react";
import { UserCheck, X, ChevronRight } from "lucide-react";
import { useTarefasDelegadasParaMim, useMarcarTarefaLida } from "@/hooks/useDelegacao";
import { useAuth } from "@/hooks/useAuth";

interface TarefasDelegadasToastProps {
  onVerTarefas: () => void;
}

export function TarefasDelegadasToast({ onVerTarefas }: TarefasDelegadasToastProps) {
  const { user } = useAuth();
  const { data: delegadas = [] } = useTarefasDelegadasParaMim();
  const { mutate: marcarLida } = useMarcarTarefaLida();

  const [open, setOpen]     = useState(false);
  const [visivel, setVisi]  = useState(false);

  const naoLidas = delegadas.filter(t => !t.lida_pelo_destinatario);

  useEffect(() => {
    if (naoLidas.length > 0 && !open) {
      setOpen(true);
      setTimeout(() => setVisi(true), 30);
    }
  }, [naoLidas.length]);

  function fechar() {
    setVisi(false);
    setTimeout(() => setOpen(false), 250);
  }

  function verTarefas() {
    // Marca todas como lidas
    naoLidas.forEach(t => marcarLida(t.id));
    fechar();
    onVerTarefas();
  }

  if (!open || !user) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-250
                    ${visivel ? "opacity-100" : "opacity-0"}`}
        onClick={fechar}
        aria-hidden
      />

      <div
        className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50
                   w-full max-w-md bg-background border border-border rounded-2xl
                   shadow-2xl overflow-hidden transition-all duration-250
                   ${visivel ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 bg-violet-600 border-b border-violet-700">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <UserCheck className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-white">
              {naoLidas.length === 1
                ? "Você recebeu 1 nova tarefa!"
                : `Você recebeu ${naoLidas.length} novas tarefas!`}
            </div>
            <div className="text-xs text-white/60">Delegadas pelo administrador</div>
          </div>
          <button onClick={fechar} className="text-white/40 hover:text-white/80 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Lista */}
        <div className="divide-y divide-border max-h-64 overflow-y-auto">
          {naoLidas.slice(0, 5).map(t => (
            <div key={t.id} className="px-4 py-3 flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                t.prioridade === "urgente" ? "bg-red-500" :
                t.prioridade === "alta"    ? "bg-orange-500" :
                t.prioridade === "media"   ? "bg-yellow-500" : "bg-gray-400"
              }`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{t.titulo}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  {t.criador && (
                    <span className="text-[11px] text-muted-foreground">
                      por {t.criador.full_name}
                    </span>
                  )}
                  {t.data_vencimento && (
                    <span className="text-[11px] text-accent font-semibold">
                      · vence {new Date(t.data_vencimento + "T12:00:00")
                        .toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </span>
                  )}
                </div>
                {t.descricao && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {t.descricao}
                  </p>
                )}
              </div>
            </div>
          ))}
          {naoLidas.length > 5 && (
            <div className="px-4 py-2 text-xs text-center text-muted-foreground">
              +{naoLidas.length - 5} outras tarefas
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3 border-t border-border bg-muted/30">
          <button
            onClick={fechar}
            className="flex-1 py-2 rounded-lg border border-border text-sm
                       text-muted-foreground hover:bg-muted transition-colors"
          >
            Fechar
          </button>
          <button
            onClick={verTarefas}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg
                       bg-violet-600 text-white text-sm font-bold
                       hover:bg-violet-700 transition-colors"
          >
            Ver minhas tarefas
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}
