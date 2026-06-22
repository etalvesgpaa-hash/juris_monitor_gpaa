import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface Feriado {
  id: string;
  nome: string;
  data: string; // formato: MM-DD (para feriados fixos) ou YYYY-MM-DD (para específicos)
  tipo: "fixo" | "especifico";
}

const FERIADOS_NACIONAIS_FIXOS: Feriado[] = [
  { id: "confrat", nome: "Confraternização Universal", data: "01-01", tipo: "fixo" },
  { id: "tiradentes", nome: "Tiradentes", data: "04-21", tipo: "fixo" },
  { id: "trabalho", nome: "Dia do Trabalho", data: "05-01", tipo: "fixo" },
  { id: "independencia", nome: "Independência do Brasil", data: "09-07", tipo: "fixo" },
  { id: "aparecida", nome: "Nossa Senhora Aparecida", data: "10-12", tipo: "fixo" },
  { id: "finados", nome: "Finados", data: "11-02", tipo: "fixo" },
  { id: "proclamacao", nome: "Proclamação da República", data: "11-15", tipo: "fixo" },
  { id: "consciencia", nome: "Consciência Negra", data: "11-20", tipo: "fixo" },
  { id: "natal", nome: "Natal", data: "12-25", tipo: "fixo" },
];

const STORAGE_KEY = "jm_feriados_customizados";

export function FeriadosManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [newFeriado, setNewFeriado] = useState({ nome: "", data: "" });
  const { toast } = useToast();

  useEffect(() => {
    loadFeriados();
  }, []);

  const loadFeriados = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const customizados = saved ? JSON.parse(saved) : [];
      setFeriados([...FERIADOS_NACIONAIS_FIXOS, ...customizados]);
    } catch {
      setFeriados([...FERIADOS_NACIONAIS_FIXOS]);
    }
  };

  const saveFeriados = (novosCustomizados: Feriado[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(novosCustomizados));
    setFeriados([...FERIADOS_NACIONAIS_FIXOS, ...novosCustomizados]);
  };

  const handleAdd = () => {
    if (!newFeriado.nome.trim() || !newFeriado.data) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    const customizados = feriados.filter(f => !FERIADOS_NACIONAIS_FIXOS.find(fn => fn.id === f.id));
    const novo: Feriado = {
      id: `custom_${Date.now()}`,
      nome: newFeriado.nome,
      data: newFeriado.data,
      tipo: "especifico",
    };

    saveFeriados([...customizados, novo]);
    setNewFeriado({ nome: "", data: "" });
    toast({ title: "✅ Feriado adicionado!" });
  };

  const handleDelete = (id: string) => {
    if (FERIADOS_NACIONAIS_FIXOS.find(f => f.id === id)) {
      toast({ title: "Feriados nacionais não podem ser removidos", variant: "destructive" });
      return;
    }

    const customizados = feriados.filter(f => f.id !== id && !FERIADOS_NACIONAIS_FIXOS.find(fn => fn.id === f.id));
    saveFeriados(customizados);
    toast({ title: "Feriado removido" });
  };

  const formatarData = (data: string, tipo: string) => {
    if (tipo === "fixo") {
      const [mes, dia] = data.split("-");
      const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      return `${dia}/${meses[parseInt(mes) - 1]} (todo ano)`;
    } else {
      const [ano, mes, dia] = data.split("-");
      return `${dia}/${mes}/${ano}`;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Gerenciar Feriados
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Adicionar novo feriado */}
          <div className="bg-muted/30 p-4 rounded-lg border border-border">
            <h3 className="text-sm font-bold mb-3 uppercase tracking-wide">Adicionar Feriado</h3>
            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-2">
              <Input
                placeholder="Nome do feriado"
                value={newFeriado.nome}
                onChange={(e) => setNewFeriado({ ...newFeriado, nome: e.target.value })}
              />
              <Input
                type="date"
                value={newFeriado.data}
                onChange={(e) => setNewFeriado({ ...newFeriado, data: e.target.value })}
              />
              <Button onClick={handleAdd} className="bg-accent hover:bg-accent/80">
                <Plus className="w-4 h-4 mr-1" />
                Adicionar
              </Button>
            </div>
          </div>

          {/* Feriados Nacionais */}
          <div>
            <h3 className="text-sm font-bold mb-3 uppercase tracking-wide text-green-600">
              📅 Feriados Nacionais (Fixos)
            </h3>
            <div className="space-y-2">
              {FERIADOS_NACIONAIS_FIXOS.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between px-4 py-3 rounded-lg border border-green-600/20 bg-green-600/5"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{f.nome}</div>
                    <div className="text-xs text-muted-foreground">{formatarData(f.data, f.tipo)}</div>
                  </div>
                  <div className="text-xs px-2 py-1 rounded bg-green-600/10 text-green-600 font-bold">
                    NACIONAL
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Feriados Customizados */}
          {feriados.filter(f => !FERIADOS_NACIONAIS_FIXOS.find(fn => fn.id === f.id)).length > 0 && (
            <div>
              <h3 className="text-sm font-bold mb-3 uppercase tracking-wide text-accent">
                📌 Feriados Personalizados
              </h3>
              <div className="space-y-2">
                {feriados
                  .filter(f => !FERIADOS_NACIONAIS_FIXOS.find(fn => fn.id === f.id))
                  .map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{f.nome}</div>
                        <div className="text-xs text-muted-foreground">{formatarData(f.data, f.tipo)}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(f.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="outline">Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Função auxiliar para obter todos os feriados (usada no cálculo de dias úteis)
export function getFeriados(): Feriado[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const customizados = saved ? JSON.parse(saved) : [];
    return [...FERIADOS_NACIONAIS_FIXOS, ...customizados];
  } catch {
    return [...FERIADOS_NACIONAIS_FIXOS];
  }
}

// Função para calcular data limite considerando dias úteis e feriados
export function calcularDataLimite(diasUteis: number, dataInicial: Date = new Date()): Date {
  const feriados = getFeriados();
  let data = new Date(dataInicial);
  let diasAdicionados = 0;

  while (diasAdicionados < diasUteis) {
    data.setDate(data.getDate() + 1);
    
    // Verifica se é fim de semana
    const diaSemana = data.getDay();
    if (diaSemana === 0 || diaSemana === 6) continue; // Pula sábado e domingo
    
    // Verifica se é feriado
    const dataStr = data.toISOString().split('T')[0]; // YYYY-MM-DD
    const mesdia = `${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`; // MM-DD
    
    const ehFeriado = feriados.some(f => 
      (f.tipo === "fixo" && f.data === mesdia) || 
      (f.tipo === "especifico" && f.data === dataStr)
    );
    
    if (ehFeriado) continue; // Pula feriados
    
    diasAdicionados++;
  }

  return data;
}
