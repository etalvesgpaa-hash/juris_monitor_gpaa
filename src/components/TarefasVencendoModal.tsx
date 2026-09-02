import { useEffect, useState } from "react";
import { AlertTriangle, Clock, X, ArrowRight, CheckSquare } from "lucide-react";
import { useTarefasVencendo } from "@/hooks/useTarefasVencendo";
import type { PageId } from "@/types/navigation";

const STORAGE_KEY = "jm_alerta_tarefas_data";

interface Props {
  onNavigate: (page: PageId) => void;
}

export function TarefasVencendoModal({ onNavigate }: Props) {
  const { tarefasVencendo, isLoading } = useTarefasVencendo();
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (isLoading || tarefasVencendo.length === 0) return;
    const now = new Date();
    const hoje = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    const ultimaVez = localStorage.getItem(STORAGE_KEY);
    if (ultimaVez === hoje) return;
    const timer = setTimeout(() => setAberto(true), 800);
    return () => clearTimeout(timer);
  }, [isLoading, tarefasVencendo.length]);

  const fechar = () => {
    const now = new Date();
    const hoje = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    localStorage.setItem(STORAGE_KEY, hoje);
    setAberto(false);
  };

  const irParaTarefas = () => {
    fechar();
    onNavigate("tarefas");
  };

  if (!aberto) return null;

  const vencidas = tarefasVencendo.filter(t => t.vencida);
  const hoje     = tarefasVencendo.filter(t => t.venceHoje);
  const amanha   = tarefasVencendo.filter(t => t.venceAmanha);

  // Cor do cabeçalho: vermelho escuro se tem vencidas, vermelho se vence hoje, amarelo se só amanhã
  const corHeader = vencidas.length > 0
    ? "bg-red-800"
    : hoje.length > 0
    ? "bg-red-600"
    : "bg-amber-500";

  // Título do cabeçalho
  const titulo = vencidas.length > 0
    ? `⚠️ Você tem ${vencidas.length} tarefa(s) em atraso!`
    : hoje.length > 0
    ? "⚠️ Tarefas vencendo hoje!"
    : "📅 Tarefas vencem amanhã";

  // Subtítulo
  const partes = [];
  if (vencidas.length > 0) partes.push(`${vencidas.length} em atraso`);
  if (hoje.length > 0)     partes.push(`${hoje.length} hoje`);
  if (amanha.length > 0)   partes.push(`${amanha.length} amanhã`);
  const subtitulo = partes.join(" · ");

  const badgePrioridade = (p: string) => {
    const m: Record<string, string> = {
      alta:  "bg-red-100 text-red-700 border-red-200",
      media: "bg-yellow-100 text-yellow-700 border-yellow-200",
      baixa: "bg-green-100 text-green-700 border-green-200",
    };
    return m[p] ?? "bg-gray-100 text-gray-600 border-gray-200";
  };

  function fmtDate(iso: string) {
    // new Date("YYYY-MM-DD") interpreta como UTC e no Brasil (UTC-3)
    // vira o dia anterior. Parseamos manualmente para evitar o deslocamento.
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
  }

  function Secao({ label, cor, icone, itens }: {
    label: string;
    cor: string;
    icone: string;
    itens: typeof tarefasVencendo;
  }) {
    if (itens.length === 0) return null;
    return (
      <>
        <div className={`px-5 py-2 flex items-center gap-1.5 ${cor}`}>
          <span className="text-sm">{icone}</span>
          <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
          <span className="ml-auto text-xs font-semibold opacity-70">{itens.length}</span>
        </div>
        {itens.map(t => (
          <div key={t.id} className="px-5 py-3 flex items-start gap-3 border-t border-border/50 hover:bg-muted/30 transition-colors">
            <CheckSquare className={`h-4 w-4 mt-0.5 shrink-0 ${
              t.vencida ? "text-red-800" : t.venceHoje ? "text-red-500" : "text-amber-500"
            }`} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground truncate">{t.titulo}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Vencimento: {fmtDate(t.data_vencimento)}
                {t.processo && ` · ${t.processo.numero_cnj}`}
              </p>
            </div>
            <span className={`shrink-0 text-[0.65rem] font-bold px-2 py-0.5 rounded border ${badgePrioridade(t.prioridade)}`}>
              {t.prioridade}
            </span>
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" onClick={fechar} />

      {/* Modal */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-card rounded-2xl shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200">

          {/* Cabeçalho */}
          <div className={`px-5 py-4 flex items-start gap-3 ${corHeader}`}>
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-extrabold text-white text-lg leading-tight">{titulo}</h2>
              <p className="text-white/80 text-sm mt-0.5">{subtitulo}</p>
            </div>
            <button onClick={fechar} className="text-white/70 hover:text-white transition-colors shrink-0 mt-0.5">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Lista */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border">
            <Secao
              label="Em atraso"
              cor="bg-red-100 text-red-800"
              icone="🔴"
              itens={vencidas}
            />
            <Secao
              label="Vence hoje"
              cor="bg-red-50 text-red-600"
              icone="🟠"
              itens={hoje}
            />
            <Secao
              label="Vence amanhã"
              cor="bg-amber-50 text-amber-600"
              icone="🟡"
              itens={amanha}
            />
          </div>

          {/* Rodapé */}
          <div className="px-5 py-4 border-t border-border bg-muted/20 flex items-center justify-between">
            <button onClick={fechar} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
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
