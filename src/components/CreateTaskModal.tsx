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
  processo_id: string;
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
  processos: Array<{ id: string; numero_processo: string; parte_autora?: string }>;
  feriados?: Feriado[]; // feriados do Supabase (useFeriados)
}

const STATUS_OPTIONS = [
  { value: "pendente",    label: "Pendente",           color: "bg-yellow-500" },
  { value: "andamento",   label: "Em Andamento",        color: "bg-blue-500" },
  { value: "ag_cliente",  label: "Aguardando Cliente",  color: "bg-purple-500" },
  { value: "ag_tribunal", label: "Aguardando Tribunal", color: "bg-orange-500" },
  { value: "concluida",   label: "Concluída",           color: "bg-green-500" },
  { value: "cancelada",   label: "Cancelada",           color: "bg-gray-500" },
];

/** Converte Date para string YYYY-MM-DD sem deslocamento de fuso */
function dateToLocalStr(d: Date): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function CreateTaskModal({
  open,
  onClose,
  onSubmit,
  initialData,
  processos,
  feriados = [],
}: CreateTaskModalProps) {
  const [showFeriados, setShowFeriados] = useState(false);
  const [form, setForm] = useState<TarefaFormData>({
    titulo: "",
    descricao: "",
    processo_id: "",
    status: "pendente",
    diasUteis: "",
    data_vencimento: "",
    prioridade: "media",
  });

  useEffect(() => {
    if (initialData) {
      setForm(prev => ({ ...prev, ...initialData, diasUteis: "" }));
    }
  }, [initialData, open]);

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setForm({
          titulo: "",
          descricao: "",
          processo_id: "",
          status: "pendente",
          diasUteis: "",
          data_vencimento: "",
          prioridade: "media",
        });
      }, 200);
    }
  }, [open]);

  /** Recalcula a data de vencimento sempre que dias ou feriados mudarem */
  const calcularVencimento = (diasStr: string): string => {
    const num = parseInt(diasStr);
    if (isNaN(num) || num <= 0) return "";
    const hoje = new Date();
    const resultado = calcularDiasUteis(hoje, num, feriados);
    return dateToLocalStr(resultado);
  };

  const handleDiasUteisChange = (dias: string) => {
    const venc = calcularVencimento(dias);
    setForm(prev => ({ ...prev, diasUteis: dias, data_vencimento: venc }));
  };

  const handleDataManualChange = (data: string) => {
    // Ao editar a data manualmente, limpa os dias úteis
    setForm(prev => ({ ...prev, data_vencimento: data, diasUteis: "" }));
  };

  const handleSubmit = () => {
    const { diasUteis, ...dataToSubmit } = form;
    onSubmit(dataToSubmit);
  };

  const formatDataVencimento = () => {
    if (!form.data_vencimento) return "—";
    const [ano, mes, dia] = form.data_vencimento.split("-");
    const nomesDias = ["dom","seg","ter","qua","qui","sex","sáb"];
    const dow = new Date(`${form.data_vencimento}T12:00:00`).getDay();
    const nomesMeses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
    return `${nomesDias[dow]}, ${dia}/${nomesMeses[parseInt(mes) - 1]}/${ano}`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Nova Tarefa
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Nome da Tarefa */}
            <div>
              <Label htmlFor="titulo" className="text-sm font-bold">
                Nome da Tarefa *
              </Label>
              <Input
                id="titulo"
                placeholder="Ex: Elaborar petição inicial"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                className="mt-1.5"
              />
            </div>

            {/* Descrição */}
            <div>
              <Label htmlFor="descricao" className="text-sm font-bold">
                Descrição
              </Label>
              <Textarea
                id="descricao"
                placeholder="Detalhes da tarefa..."
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                className="mt-1.5 min-h-[80px]"
              />
            </div>

            {/* Processo */}
            <div>
              <Label htmlFor="processo" className="text-sm font-bold">
                Processo Relacionado
              </Label>
              <select
                id="processo"
                value={form.processo_id}
                onChange={(e) => setForm({ ...form, processo_id: e.target.value })}
                className="mt-1.5 w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Sem vínculo com processo</option>
                {processos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.numero_processo} {p.parte_autora ? `- ${p.parte_autora}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <Label className="text-sm font-bold">Status *</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1.5">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status.value}
                    type="button"
                    onClick={() => setForm({ ...form, status: status.value })}
                    className={`
                      px-4 py-2.5 rounded-lg border-2 text-sm font-semibold transition-all
                      ${form.status === status.value
                        ? `${status.color} text-white border-transparent scale-105`
                        : "border-border hover:border-accent bg-card hover:bg-accent/5"
                      }
                    `}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Prazo em Dias Úteis + Data Vencimento ── */}
            <div className="bg-accent/5 p-4 rounded-xl border border-accent/20 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold">Prazo &amp; Vencimento</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFeriados(true)}
                  className="text-xs"
                >
                  <Settings className="w-3 h-3 mr-1" />
                  Feriados
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Dias Úteis */}
                <div>
                  <label className="text-[0.72rem] font-bold uppercase tracking-wide text-muted-foreground block mb-1">
                    Quantidade de Dias Úteis
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      max="999"
                      placeholder="Ex: 15"
                      value={form.diasUteis}
                      onChange={(e) => handleDiasUteisChange(e.target.value)}
                      className="w-full"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">dias úteis</span>
                  </div>
                  <p className="text-[0.68rem] text-muted-foreground mt-1">
                    Exclui sáb, dom e feriados cadastrados
                  </p>
                </div>

                {/* Data Vencimento */}
                <div>
                  <label className="text-[0.72rem] font-bold uppercase tracking-wide text-muted-foreground block mb-1">
                    Data de Vencimento
                  </label>
                  <input
                    type="date"
                    value={form.data_vencimento}
                    onChange={(e) => handleDataManualChange(e.target.value)}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                  {form.data_vencimento && (
                    <p className="text-[0.7rem] font-semibold text-accent mt-1">
                      📅 {formatDataVencimento()}
                      {form.diasUteis ? ` · ${form.diasUteis} dias úteis` : ""}
                    </p>
                  )}
                </div>
              </div>

              {/* Info sobre feriados usados */}
              {feriados.length > 0 && (
                <div className="text-[0.68rem] text-muted-foreground bg-background/60 px-3 py-1.5 rounded-lg border border-border">
                  ✅ {feriados.length} feriado(s) cadastrado(s) serão descontados do prazo
                </div>
              )}
            </div>

            {/* Prioridade */}
            <div>
              <Label className="text-sm font-bold">Prioridade</Label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {[
                  { value: "baixa", label: "Baixa",  color: "bg-gray-500" },
                  { value: "media", label: "Média",   color: "bg-accent"   },
                  { value: "alta",  label: "Alta",    color: "bg-red-500"  },
                ].map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setForm({ ...form, prioridade: p.value })}
                    className={`
                      px-4 py-2.5 rounded-lg border-2 text-sm font-semibold transition-all
                      ${form.prioridade === p.value
                        ? `${p.color} text-white border-transparent`
                        : "border-border hover:border-accent bg-card"
                      }
                    `}
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
              Criar Tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FeriadosManager open={showFeriados} onClose={() => setShowFeriados(false)} />
    </>
  );
}
