import { useState, useEffect } from "react";
import { X, UserCheck, Calendar, AlertCircle, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCrearTarefaDelegada } from "@/hooks/useDelegacao";
import { calcularDiasUteis, type Feriado } from "@/hooks/useFeriados";

const STATUS_OPTIONS = [
  { value: "triagem",       label: "Triagem"              },
  { value: "ag_documentos", label: "Ag. Documentos"       },
  { value: "ag_cliente",    label: "Ag. Cliente"          },
  { value: "elaboracao",    label: "Em Elaboração"        },
  { value: "andamento",     label: "Em Andamento"         },
  { value: "audiencia",     label: "Audiência/Diligência" },
  { value: "ag_tribunal",   label: "Ag. Tribunal"         },
  { value: "concluida",     label: "Concluída"            },
  { value: "cancelada",     label: "Cancelada"            },
];

const PRIORIDADE_OPTIONS = [
  { value: "baixa",   label: "Baixa",   color: "bg-gray-500"   },
  { value: "media",   label: "Média",   color: "bg-yellow-500" },
  { value: "alta",    label: "Alta",    color: "bg-orange-500" },
  { value: "urgente", label: "Urgente", color: "bg-red-600"    },
];

interface Profile {
  id: string;
  full_name: string;
  email?: string;
}

interface DelegarTarefaModalProps {
  open: boolean;
  onClose: () => void;
  profiles: Profile[];
  feriados?: Feriado[];
  preselectedUserId?: string;
}

export function DelegarTarefaModal({
  open,
  onClose,
  profiles,
  feriados = [],
  preselectedUserId,
}: DelegarTarefaModalProps) {
  const { mutateAsync: criarDelegada, isPending } = useCrearTarefaDelegada();

  const emptyForm = () => ({
    delegado_para:   preselectedUserId || "",
    titulo:          "",
    descricao:       "",
    numero_processo: "",
    status:          "triagem",
    prioridade:      "media",
    data_vencimento: "",
    diasUteis:       "",
  });

  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    if (open) setForm(emptyForm());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselectedUserId]);

  const destinatario = profiles.find(p => p.id === form.delegado_para);

  function handleDiasUteis(dias: string) {
    const n = parseInt(dias);
    if (!isNaN(n) && n > 0) {
      const res = calcularDiasUteis(new Date(), n, feriados);
      const str = `${res.getFullYear()}-${String(res.getMonth()+1).padStart(2,"0")}-${String(res.getDate()).padStart(2,"0")}`;
      setForm(f => ({ ...f, diasUteis: dias, data_vencimento: str }));
    } else {
      setForm(f => ({ ...f, diasUteis: dias }));
    }
  }

  function formatData(iso: string) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    const meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
    return `${d}/${meses[parseInt(m)-1]}/${y}`;
  }

  async function handleSubmit() {
    if (!form.titulo.trim() || !form.delegado_para) return;
    await criarDelegada({
      titulo:          form.titulo.trim(),
      descricao:       form.descricao || undefined,
      numero_processo: form.numero_processo || undefined,
      status:          form.status,
      prioridade:      form.prioridade,
      data_vencimento: form.data_vencimento || undefined,
      delegado_para:   form.delegado_para,
    });
    onClose();
  }

  const canSubmit = form.titulo.trim() && form.delegado_para && !isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserCheck className="w-5 h-5 text-violet-500" />
            Delegar Tarefa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">

          {/* Destinatário */}
          <div className="bg-violet-500/8 border border-violet-500/20 rounded-xl p-4">
            <Label className="text-sm font-bold mb-2 block">Delegar para *</Label>
            <select
              value={form.delegado_para}
              onChange={e => setForm(f => ({ ...f, delegado_para: e.target.value }))}
              className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            >
              <option value="">Selecione o usuário…</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
            {destinatario && (
              <div className="flex items-center gap-2 mt-2.5 px-3 py-2 bg-violet-500/10 rounded-lg border border-violet-500/20">
                <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-400 shrink-0">
                  {destinatario.full_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-semibold text-violet-300">{destinatario.full_name}</div>
                  {destinatario.email && <div className="text-[10px] text-muted-foreground">{destinatario.email}</div>}
                </div>
                <div className="ml-auto text-[10px] text-violet-400 font-semibold">Receberá notificação por e-mail</div>
              </div>
            )}
          </div>

          {/* Título */}
          <div>
            <Label className="text-sm font-bold">Título da Tarefa *</Label>
            <Input
              value={form.titulo}
              onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
              placeholder="Ex: Analisar processo e elaborar recurso"
              className="mt-1.5"
              autoFocus
            />
          </div>

          {/* Número do Processo */}
          <div>
            <Label className="text-sm font-bold">Número do Processo</Label>
            <Input
              value={form.numero_processo}
              onChange={e => setForm(f => ({ ...f, numero_processo: e.target.value }))}
              placeholder="Ex: 0001234-56.2023.8.26.0000"
              className="mt-1.5 font-mono"
            />
          </div>

          {/* Descrição */}
          <div>
            <Label className="text-sm font-bold">Descrição / Instruções</Label>
            <Textarea
              value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Descreva o que precisa ser feito, documentos necessários, etc."
              className="mt-1.5 min-h-[80px]"
            />
          </div>

          {/* Status */}
          <div>
            <Label className="text-sm font-bold">Status inicial</Label>
            <div className="grid grid-cols-3 gap-1.5 mt-1.5">
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, status: s.value }))}
                  className={`px-2 py-1.5 rounded-lg border text-xs font-semibold transition-all
                    ${form.status === s.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:border-accent text-muted-foreground"
                    }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prazo */}
          <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 space-y-3">
            <Label className="text-sm font-bold flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Prazo
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[0.7rem] text-muted-foreground font-semibold uppercase block mb-1">Dias úteis a contar de hoje</label>
                <div className="flex items-center gap-2">
                  <Input type="number" min="1" placeholder="Ex: 15" value={form.diasUteis} onChange={e => handleDiasUteis(e.target.value)} />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">dias</span>
                </div>
              </div>
              <div>
                <label className="text-[0.7rem] text-muted-foreground font-semibold uppercase block mb-1">Data de vencimento</label>
                <input
                  type="date"
                  value={form.data_vencimento}
                  onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value, diasUteis: "" }))}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>
            </div>
            {form.data_vencimento && (
              <p className="text-xs font-semibold text-accent">
                📅 Vence em {formatData(form.data_vencimento)}{form.diasUteis ? ` (${form.diasUteis} dias úteis)` : ""}
              </p>
            )}
          </div>

          {/* Prioridade */}
          <div>
            <Label className="text-sm font-bold">Prioridade</Label>
            <div className="grid grid-cols-4 gap-2 mt-1.5">
              {PRIORIDADE_OPTIONS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, prioridade: p.value }))}
                  className={`py-2 rounded-lg border-2 text-sm font-semibold transition-all
                    ${form.prioridade === p.value
                      ? `${p.color} text-white border-transparent`
                      : "border-border text-muted-foreground hover:border-accent"
                    }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {form.prioridade === "urgente" && (
            <div className="flex items-start gap-2 p-3 bg-red-500/8 border border-red-500/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 dark:text-red-400">
                Tarefa urgente — o destinatário será notificado imediatamente por e-mail.
              </p>
            </div>
          )}

        </div>

        <div className="flex gap-2 pt-2 border-t border-border mt-4">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Delegando…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                Delegar Tarefa
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
