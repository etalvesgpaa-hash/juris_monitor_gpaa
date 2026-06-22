import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Settings } from "lucide-react";
import { calcularDiasUteis, type Feriado } from "@/hooks/useFeriados";
import { FeriadosManager } from "./FeriadosManager";

interface TarefaFormData {
  titulo: string;
  descricao: string;
  numero_processo: string;
  status: string;
  diasUteis: string;
  data_vencimento: string;
  prioridade: string;
}

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<TarefaFormData, "diasUteis">) => void;
  initialData?: Partial<TarefaFormData>;
  feriados?: Feriado[];
  submitLabel?: string;
}

const STATUS_OPTIONS = [
  { value: "triagem",       label: "Triagem",              color: "bg-gray-500"   },
  { value: "ag_documentos", label: "Ag. Documentos",       color: "bg-yellow-700" },
  { value: "ag_cliente",    label: "Ag. Cliente",          color: "bg-sky-600"    },
  { value: "elaboracao",    label: "Em Elaboração",        color: "bg-violet-600" },
  { value: "andamento",     label: "Em Andamento",         color: "bg-blue-600"   },
  { value: "audiencia",     label: "Audiência/Diligência", color: "bg-red-600"    },
  { value: "ag_tribunal",   label: "Ag. Tribunal",         color: "bg-purple-700" },
  { value: "concluida",     label: "Concluída",            color: "bg-green-600"  },
  { value: "cancelada",     label: "Cancelada",            color: "bg-gray-400"   },
];

function dateToLocalStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const EMPTY_FORM: TarefaFormData = {
  titulo: "",
  descricao: "",
  numero_processo: "",
  status: "triagem",
  diasUteis: "",
  data_vencimento: "",
  prioridade: "media",
};

export function CreateTaskModal({
  open,
  onClose,
  onSubmit,
  initialData,
  feriados = [],
  submitLabel,
}: CreateTaskModalProps) {
  const [showFeriados, setShowFeriados] = useState(false);
  const [form, setForm] = useState<TarefaFormData>(EMPTY_FORM);

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_FORM, ...(initialData ?? {}), diasUteis: "" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) setTimeout(() => setForm(EMPTY_FORM), 200);
  }, [open]);

  const handleDiasUteisChange = (dias: string) => {
    const num = parseInt(dias);
    const venc = (!isNaN(num) && num > 0)
      ? dateToLocalStr(calcularDiasUteis(new Date(), num, feriados))
      : "";
    setForm(prev => ({ ...prev, diasUteis: dias, data_vencimento: venc }));
  };

  const handleSubmit = () => {
    const { diasUteis, ...dataToSubmit } = form;
    onSubmit(dataToSubmit);
  };

  const formatDataVencimento = () => {
    if (!form.data_vencimento) return "—";
    const [ano, mes, dia] = form.data_vencimento.split("-");
    const dow = new Date(`${form.data_vencimento}T12:00:00`).getDay();
    const dias = ["dom","seg","ter","qua","qui","sex","sáb"];
    const meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
    return `${dias[dow]}, ${dia}/${meses[parseInt(mes) - 1]}/${ano}`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {submitLabel === "Salvar Alterações" ? "Editar Tarefa" : "Nova Tarefa"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">

            {/* Título */}
            <div>
              <Label htmlFor="titulo" className="text-sm font-bold">Nome da Tarefa *</Label>
              <Input
                id="titulo"
                placeholder="Ex: Elaborar petição inicial"
                value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                className="mt-1.5"
                autoFocus
              />
            </div>

            {/* Número do Processo */}
            <div>
              <Label htmlFor="numero_processo" className="text-sm font-bold">
                Número do Processo
              </Label>
              <Input
                id="numero_processo"
                placeholder="Ex: 0001234-56.2023.8.26.0000"
                value={form.numero_processo}
                onChange={e => setForm(f => ({ ...f, numero_processo: e.target.value }))}
                className="mt-1.5 font-mono"
              />
            </div>

            {/* Descrição */}
            <div>
              <Label htmlFor="descricao" className="text-sm font-bold">Descrição / Instruções</Label>
              <Textarea
                id="descricao"
                placeholder="Detalhes da tarefa..."
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                className="mt-1.5 min-h-[80px]"
              />
            </div>

            {/* Status */}
            <div>
              <Label className="text-sm font-bold">Status *</Label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, status: s.value }))}
                    className={`px-3 py-2 rounded-lg border-2 text-xs font-semibold transition-all text-center
                      ${form.status === s.value
                        ? `${s.color} text-white border-transparent scale-105`
                        : "border-border hover:border-accent bg-card hover:bg-accent/5"
                      }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Prazo */}
            <div className="bg-accent/5 p-4 rounded-xl border border-accent/20 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold">Prazo &amp; Vencimento</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowFeriados(true)} className="text-xs">
                  <Settings className="w-3 h-3 mr-1" />Feriados
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[0.72rem] font-bold uppercase tracking-wide text-muted-foreground block mb-1">
                    Dias Úteis
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number" min="1" max="999" placeholder="Ex: 15"
                      value={form.diasUteis}
                      onChange={e => handleDiasUteisChange(e.target.value)}
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">dias úteis</span>
                  </div>
                  <p className="text-[0.68rem] text-muted-foreground mt-1">Exclui sáb, dom e feriados</p>
                </div>
                <div>
                  <label className="text-[0.72rem] font-bold uppercase tracking-wide text-muted-foreground block mb-1">
                    Data de Vencimento
                  </label>
                  <input
                    type="date"
                    value={form.data_vencimento}
                    onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value, diasUteis: "" }))}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                  {form.data_vencimento && (
                    <p className="text-[0.7rem] font-semibold text-accent mt-1">
                      📅 {formatDataVencimento()}{form.diasUteis ? ` · ${form.diasUteis} dias úteis` : ""}
                    </p>
                  )}
                </div>
              </div>
              {feriados.length > 0 && (
                <p className="text-[0.68rem] text-muted-foreground bg-background/60 px-3 py-1.5 rounded-lg border border-border">
                  ✅ {feriados.length} feriado(s) serão descontados do prazo
                </p>
              )}
            </div>

            {/* Prioridade */}
            <div>
              <Label className="text-sm font-bold">Prioridade</Label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {[
                  { value: "baixa",   label: "Baixa",   color: "bg-gray-500"  },
                  { value: "media",   label: "Média",   color: "bg-accent"    },
                  { value: "alta",    label: "Alta",    color: "bg-red-500"   },
                  { value: "urgente", label: "Urgente", color: "bg-red-700"   },
                ].map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, prioridade: p.value }))}
                    className={`px-4 py-2.5 rounded-lg border-2 text-sm font-semibold transition-all
                      ${form.prioridade === p.value
                        ? `${p.color} text-white border-transparent`
                        : "border-border hover:border-accent bg-card"
                      }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.titulo.trim()}
              className="bg-accent hover:bg-accent/80 text-white"
            >
              {submitLabel ?? "Criar Tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FeriadosManager open={showFeriados} onClose={() => setShowFeriados(false)} />
    </>
  );
}
