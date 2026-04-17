import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  DollarSign,
  Plus,
  Search,
  TrendingUp,
  TrendingDown,
  Calendar,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Honorario {
  id: string;
  cliente_id: string | null;
  processo_id: string | null;
  descricao: string;
  valor: number;
  tipo: string;
  status: string;
  data_vencimento: string | null;
  data_pagamento: string | null;
  observacoes: string | null;
  created_at: string;
  clientes?: { nome: string } | null;
  processos?: { numero_cnj: string } | null;
}

export function HonorariosPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterTipo, setFilterTipo] = useState<string>("todos");

  // Estados do formulário
  const [formData, setFormData] = useState({
    cliente_id: "",
    processo_id: "",
    descricao: "",
    valor: "",
    tipo: "fixo",
    data_vencimento: "",
    observacoes: "",
  });

  // Query para buscar clientes
  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Query para buscar processos
  const { data: processos = [] } = useQuery({
    queryKey: ["processos", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select("id, numero_cnj")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Query para buscar honorários
  const { data: honorarios = [], isLoading } = useQuery({
    queryKey: ["honorarios", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("honorarios")
        .select(`
          *,
          clientes(nome),
          processos(numero_cnj)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Honorario[];
    },
    enabled: !!user,
  });

  // Mutation para criar honorário
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("honorarios").insert({
        ...data,
        valor: parseFloat(data.valor),
        cliente_id: data.cliente_id || null,
        processo_id: data.processo_id || null,
        user_id: user?.id,
        status: "pendente",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["honorarios"] });
      toast.success("Honorário cadastrado com sucesso!");
      setIsDialogOpen(false);
      setFormData({
        cliente_id: "",
        processo_id: "",
        descricao: "",
        valor: "",
        tipo: "fixo",
        data_vencimento: "",
        observacoes: "",
      });
    },
    onError: () => {
      toast.error("Erro ao cadastrar honorário");
    },
  });

  // Mutation para marcar como pago
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "pago") {
        updates.data_pagamento = new Date().toISOString();
      }

      const { error } = await supabase
        .from("honorarios")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["honorarios"] });
      toast.success("Status atualizado!");
    },
  });

  // Filtrar honorários
  const filteredHonorarios = honorarios.filter((honorario) => {
    const matchSearch =
      searchTerm === "" ||
      honorario.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      honorario.clientes?.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      honorario.processos?.numero_cnj.toLowerCase().includes(searchTerm.toLowerCase());

    const matchStatus = filterStatus === "todos" || honorario.status === filterStatus;
    const matchTipo = filterTipo === "todos" || honorario.tipo === filterTipo;

    return matchSearch && matchStatus && matchTipo;
  });

  // Calcular estatísticas
  const stats = {
    total: honorarios.reduce((acc, h) => acc + h.valor, 0),
    pendente: honorarios
      .filter((h) => h.status === "pendente")
      .reduce((acc, h) => acc + h.valor, 0),
    pago: honorarios
      .filter((h) => h.status === "pago")
      .reduce((acc, h) => acc + h.valor, 0),
    vencido: honorarios.filter((h) => {
      if (h.status !== "pendente" || !h.data_vencimento) return false;
      return new Date(h.data_vencimento) < new Date();
    }).length,
  };

  // Status Badge
  const getStatusBadge = (honorario: Honorario) => {
    if (honorario.status === "pago") {
      return <Badge className="bg-green-ok/10 text-green-ok">Pago</Badge>;
    }

    if (honorario.status === "cancelado") {
      return <Badge variant="outline">Cancelado</Badge>;
    }

    // Verificar se está vencido
    if (honorario.data_vencimento && new Date(honorario.data_vencimento) < new Date()) {
      return <Badge className="bg-red-alert/10 text-red-alert">Vencido</Badge>;
    }

    return <Badge className="bg-yellow-500/10 text-yellow-600">Pendente</Badge>;
  };

  // Formatar moeda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div>
      <div className="mb-7">
        <h1 className="font-display text-3xl font-bold tracking-tight">Honorários</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Controle financeiro de honorários e recebíveis
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-5 w-5 text-accent" />
            <div className="text-xs text-muted-foreground font-semibold uppercase">
              Total
            </div>
          </div>
          <div className="text-2xl font-bold">{formatCurrency(stats.total)}</div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-5 w-5 text-green-ok" />
            <div className="text-xs text-muted-foreground font-semibold uppercase">Pago</div>
          </div>
          <div className="text-2xl font-bold text-green-ok">
            {formatCurrency(stats.pago)}
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-5 w-5 text-yellow-600" />
            <div className="text-xs text-muted-foreground font-semibold uppercase">
              Pendente
            </div>
          </div>
          <div className="text-2xl font-bold text-yellow-600">
            {formatCurrency(stats.pendente)}
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="h-5 w-5 text-red-alert" />
            <div className="text-xs text-muted-foreground font-semibold uppercase">
              Vencidos
            </div>
          </div>
          <div className="text-2xl font-bold text-red-alert">{stats.vencido}</div>
        </div>
      </div>

      {/* Filtros e Ações */}
      <div className="flex flex-col md:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, cliente ou processo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="pago">Pagos</SelectItem>
            <SelectItem value="cancelado">Cancelados</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="fixo">Fixo</SelectItem>
            <SelectItem value="percentual">Percentual</SelectItem>
            <SelectItem value="sucumbencia">Sucumbência</SelectItem>
            <SelectItem value="contrato">Contrato</SelectItem>
          </SelectContent>
        </Select>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full md:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Novo Honorário
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Honorário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Descrição</Label>
                <Input
                  placeholder="Ex: Honorários advocatícios - Ação de cobrança"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={formData.valor}
                    onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixo">Fixo</SelectItem>
                      <SelectItem value="percentual">Percentual</SelectItem>
                      <SelectItem value="sucumbencia">Sucumbência</SelectItem>
                      <SelectItem value="contrato">Contrato</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cliente (Opcional)</Label>
                  <Select
                    value={formData.cliente_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, cliente_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {clientes.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          {cliente.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Processo (Opcional)</Label>
                  <Select
                    value={formData.processo_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, processo_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {processos.map((processo) => (
                        <SelectItem key={processo.id} value={processo.id}>
                          {processo.numero_cnj}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Data de Vencimento</Label>
                <Input
                  type="date"
                  value={formData.data_vencimento}
                  onChange={(e) =>
                    setFormData({ ...formData, data_vencimento: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Observações (Opcional)</Label>
                <Textarea
                  placeholder="Informações adicionais sobre o honorário..."
                  value={formData.observacoes}
                  onChange={(e) =>
                    setFormData({ ...formData, observacoes: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <Button
                onClick={() => createMutation.mutate(formData)}
                disabled={createMutation.isPending || !formData.descricao || !formData.valor}
                className="w-full"
              >
                {createMutation.isPending ? "Cadastrando..." : "Cadastrar Honorário"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de Honorários */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="w-10 h-10 border-4 border-accent/20 border-t-accent rounded-full animate-spin mx-auto" />
        </div>
      ) : filteredHonorarios.length === 0 ? (
        <div className="text-center py-12">
          <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {searchTerm || filterStatus !== "todos" || filterTipo !== "todos"
              ? "Nenhum honorário encontrado com os filtros aplicados."
              : "Nenhum honorário cadastrado ainda."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHonorarios.map((honorario) => (
            <div
              key={honorario.id}
              className="bg-card rounded-xl p-5 border border-border hover:border-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg">{honorario.descricao}</h3>
                    {getStatusBadge(honorario)}
                    <Badge variant="outline" className="text-xs">
                      {honorario.tipo}
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold text-accent">
                    {formatCurrency(honorario.valor)}
                  </div>
                </div>

                <div className="flex gap-2">
                  {honorario.status === "pendente" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateStatusMutation.mutate({
                          id: honorario.id,
                          status: "pago",
                        })
                      }
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Marcar como Pago
                    </Button>
                  )}
                </div>
              </div>

              {honorario.observacoes && (
                <p className="text-sm text-muted-foreground mb-3">{honorario.observacoes}</p>
              )}

              <div className="flex flex-wrap gap-4 text-sm">
                {honorario.clientes && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Cliente:</span>
                    <span className="font-medium">{honorario.clientes.nome}</span>
                  </div>
                )}

                {honorario.processos && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Processo:</span>
                    <span className="font-medium font-mono">
                      {honorario.processos.numero_cnj}
                    </span>
                  </div>
                )}

                {honorario.data_vencimento && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Vencimento:</span>
                    <span className="font-medium">
                      {format(new Date(honorario.data_vencimento), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                )}

                {honorario.data_pagamento && (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-green-ok" />
                    <span className="text-muted-foreground">Pago em:</span>
                    <span className="font-medium text-green-ok">
                      {format(new Date(honorario.data_pagamento), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
