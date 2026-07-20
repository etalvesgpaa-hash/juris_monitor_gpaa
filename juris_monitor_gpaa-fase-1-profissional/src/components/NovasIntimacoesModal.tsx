/**
 * NovasIntimacoesModal.tsx
 *
 * Modal que aparece automaticamente quando o useAutoFetchIntimacoes
 * detecta novas intimações AASP no dia atual.
 *
 * Escuta o evento customizado "intimacoes-novas-encontradas"
 * disparado pelo hook após comparar com o Supabase.
 */

import { useEffect, useState } from "react";
import { X, FileText, AlertCircle, ChevronRight, Bell } from "lucide-react";
import { loadStore, AaspIntimacao } from "@/hooks/useAutoFetchIntimacoes";

interface NovasIntimacoesModalProps {
  onVerTodas: () => void;
}

export function NovasIntimacoesModal({ onVerTodas }: NovasIntimacoesModalProps) {
  const [open, setOpen]             = useState(false);
  const [intimacoes, setIntimacoes] = useState<AaspIntimacao[]>([]);
  const [visivel, setVisivel]       = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ count: number; hoje: string }>;
      if (ev.detail.count <= 0) return;

      const hoje  = ev.detail.hoje;
      const todas = loadStore();
      const deHoje = todas
        .filter(i => (i._data || "").slice(0, 10) === hoje)
        .sort((a, b) => (a._lida === b._lida ? 0 : a._lida ? 1 : -1));

      setIntimacoes(deHoje.slice(0, 10));
      setOpen(true);
      // Pequeno delay para a animação de entrada funcionar
      setTimeout(() => setVisivel(true), 20);
    };

    window.addEventListener("intimacoes-novas-encontradas", handler);
    return () => window.removeEventListener("intimacoes-novas-encontradas", handler);
  }, []);

  function fechar() {
    setVisivel(false);
    setTimeout(() => {
      setOpen(false);
      setIntimacoes([]);
    }, 250);
  }

  function irParaIntimacoes() {
    fechar();
    onVerTodas();
  }

  if (!open) return null;

  const naoLidas = intimacoes.filter(i => !i._lida).length;
  const total    = intimacoes.length;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/55 backdrop-blur-sm transition-opacity duration-250 ${visivel ? "opacity-100" : "opacity-0"}`}
        onClick={fechar}
        aria-hidden
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal
        aria-label="Novas intimações encontradas"
        className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50
                   w-full max-w-lg bg-background border border-border rounded-2xl
                   shadow-2xl flex flex-col overflow-hidden
                   transition-all duration-250
                   ${visivel ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
        style={{ maxHeight: "85vh" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 bg-[#0d2a1e] border-b border-[#c9a84c]/20 flex-shrink-0">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-[#c9a84c]/15 flex items-center justify-center">
              <Bell className="w-5 h-5 text-[#c9a84c]" />
            </div>
            <div className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 rounded-full
                            bg-red-500 text-white text-[10px] font-bold
                            flex items-center justify-center px-1.5 shadow">
              {total}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white">
              {total === 1 ? "1 nova intimação hoje!" : `${total} novas intimações hoje!`}
            </div>
            <div className="text-xs text-white/50">
              AASP · {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </div>
          </div>

          {naoLidas > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full
                            bg-red-500/15 border border-red-500/30 text-red-400
                            text-[10px] font-semibold flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              {naoLidas} não {naoLidas === 1 ? "lida" : "lidas"}
            </div>
          )}

          <button
            onClick={fechar}
            className="text-white/35 hover:text-white/70 transition-colors p-1 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {intimacoes.map((intim, i) => (
            <ItemIntimacao key={intim._id ?? i} intim={intim} />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-muted/30 flex-shrink-0">
          <button
            onClick={fechar}
            className="flex-1 py-2 rounded-lg border border-border text-sm
                       text-muted-foreground hover:bg-muted transition-colors"
          >
            Fechar
          </button>
          <button
            onClick={irParaIntimacoes}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg
                       bg-[#c9a84c] text-[#0d2a1e] text-sm font-bold
                       hover:bg-[#b8963c] transition-colors"
          >
            Ver todas as intimações
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}

// ── Item individual ───────────────────────────────────────────

function ItemIntimacao({ intim }: { intim: AaspIntimacao }) {
  return (
    <div className={`px-4 py-3 flex items-start gap-3 ${intim._lida ? "bg-background" : "bg-amber-400/5"}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5
                       ${intim._lida ? "bg-muted" : "bg-[#c9a84c]/15"}`}>
        {intim._lida
          ? <FileText className="w-4 h-4 text-muted-foreground" />
          : <AlertCircle className="w-4 h-4 text-[#c9a84c]" />
        }
      </div>

      <div className="flex-1 min-w-0">
        {intim._numProc && (
          <div className="text-[11px] font-mono text-muted-foreground mb-0.5 truncate">
            {intim._numProc}
          </div>
        )}

        <div className={`text-sm font-semibold truncate ${intim._lida ? "text-muted-foreground" : "text-foreground"}`}>
          {intim._titulo || "Publicação AASP"}
        </div>

        {intim._resumoIA ? (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
            {intim._resumoIA}
          </p>
        ) : intim._orgaoJulgador ? (
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {intim._orgaoJulgador}
          </div>
        ) : null}

        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {intim._orgaoPublicacao && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {intim._orgaoPublicacao}
            </span>
          )}
          {intim._data && (
            <span className="text-[10px] text-muted-foreground">
              {new Date(intim._data + "T12:00:00").toLocaleDateString("pt-BR")}
            </span>
          )}
          {intim._resumoIA && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-500">
              ✨ Resumo IA
            </span>
          )}
          {!intim._lida && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-600 font-semibold">
              Não lida
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
