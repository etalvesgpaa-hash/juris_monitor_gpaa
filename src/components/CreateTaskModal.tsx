import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Settings } from "lucide-react";
import { calcularDataLimite, FeriadosManager } from "./FeriadosManager";

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
}

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente", color: "bg-yellow-500" },
  { value: "andamento", label: "Em Andamento", color: "bg-blue-500" },
  { value: "ag_cliente", label: "Aguardando Cliente", color: "bg-purple-500" },
  { value: "ag_tribunal", label: "Aguardando Tribunal", color: "bg-orange-500" },
  { value: "concluida", label: "Concluída", color: "bg-green-500" },
  { value: "cancelada", label: "Cancelada", color: "bg-gray-500" },
];

export function CreateTaskModal({ open, onClose, onSubmit, initialData, processos }: CreateTaskModalProps) {
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
      setForm(prev => ({
        ...prev,
        ...initialData,
        diasUteis: "",
      }));
    }
  }, [initialData, open]);

  useEffect(() => {
    if (!open) {
      // Reset form when closing
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

  const handleDiasUteisChange = (dias: string) => {
    setForm(prev => ({ ...prev, diasUteis: dias }));
    
    const num = parseInt(dias);
    if (!isNaN(num) && num > 0) {
      const dataLimite = calcularDataLimite(num);
      setForm(prev => ({ 
        ...prev, 
        data_vencimento: dataLimite.toISOString().split('T')[0] 
      }));
    } else {
      setForm(prev => ({ ...prev, data_vencimento: "" }));
    }
  };

  const handleSubmit = () => {
    const { diasUteis, ...dataToSubmit } = form;
    onSubmit(dataToSubmit);
  };

  const formatDataVencimento = () => {
    if (!form.data_vencimento) return "—";
    const data = new Date(form.data_vencimento + 'T00:00:00');
    return data.toLocaleDateString("pt-BR", { 
      weekday: 'short', 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
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
                className="mt-1.5 min-h-[100px]"
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
                        : 'border-border hover:border-accent bg-card hover:bg-accent/5'
                      }
                    `}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Prazo em Dias Úteis */}
            <div className="bg-accent/5 p-4 rounded-lg border border-accent/20">
              <div className="flex items-center justify-between mb-3">
                <Label htmlFor="diasUteis" className="text-sm font-bold">
                  Prazo em Dias Úteis
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFeriados(true)}
                  className="text-xs"
                >
                  <Settings className="w-3 h-3 mr-1" />
                  Gerenciar Feriados
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Input
                    id="diasUteis"
                    type="number"
                    min="1"
                    placeholder="Ex: 15"
                    value={form.diasUteis}
                    onChange={(e) => handleDiasUteisChange(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Dias úteis (exclui sáb/dom/feriados)
                  </p>
                </div>
                
                <div>
                  <div className="px-3 py-2 bg-card border border-border rounded-md">
                    <div className="text-xs text-muted-foreground">Data Limite:</div>
                    <div className="font-bold text-sm mt-0.5">
                      {formatDataVencimento()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs text-muted-foreground bg-white/50 p-2 rounded border border-border">
                ℹ️ O sistema calculará automaticamente a data limite excluindo sábados, domingos e feriados cadastrados
              </div>
            </div>

            {/* Prioridade */}
            <div>
              <Label className="text-sm font-bold">Prioridade</Label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {[
                  { value: "baixa", label: "Baixa", color: "bg-gray-500" },
                  { value: "media", label: "Média", color: "bg-accent" },
                  { value: "alta", label: "Alta", color: "bg-red-500" },
                ].map((prioridade) => (
                  <button
                    key={prioridade.value}
                    type="button"
                    onClick={() => setForm({ ...form, prioridade: prioridade.value })}
                    className={`
                      px-4 py-2.5 rounded-lg border-2 text-sm font-semibold transition-all
                      ${form.prioridade === prioridade.value 
                        ? `${prioridade.color} text-white border-transparent` 
                        : 'border-border hover:border-accent bg-card'
                      }
                    `}
                  >
                    {prioridade.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!form.titulo.trim()}
              className="bg-accent hover:bg-accent/80"
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
