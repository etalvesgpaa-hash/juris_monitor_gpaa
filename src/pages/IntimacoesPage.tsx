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
import { Bell, Plus, Search, Filter, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Intimacao {
  id: string;
  numero_processo: string | null;
  origem: string;
  tipo: string | null;
  conteudo: string | null;
  data_publicacao: string | null;
  prazo: string | null;
  status: string;
  created_at: string;
}

export function IntimacoesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todas");
  const [filterOrigem, setFilterOrigem] = useState<string>("todas");

  // Estados do formulário
  const [formData, setFormData] = useState({
    numero_processo: "",
    origem: "aasp",
    tipo: "",
    conteudo: "",
    data_publicacao: "",
    prazo: "",
  });

  // Query para buscar intimações
  const { data: intimacoes = [], isLoading } = useQuery({
    queryKey: ["intimacoes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intimacoes")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Intimacao[];
    },
    enabled: !!user,
  });

  // Mutation para criar intimação
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("intimacoes").insert({
        ...data,
        user_id: user?.id,
        status: "ativa",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intimacoes"] });
      toast.success("Intimação cadastrada com sucesso!");
      setIsDialogOpen(false);
      setFormData({
        numero_processo: "",
        origem: "aasp",
        tipo: "",
        conteudo: "",
        data_publicacao: "",
        prazo: "",
      });
    },
    onError: () => {
      toast.error("Erro ao cadastrar intimação");
    },
  });

  // Mutation para atualizar status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("intimacoes")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intimacoes"] });
      toast.success("Status atualizado!");
    },
  });

  // Filtrar intimações
  const filteredIntimacoes = intimacoes.filter((intimacao) => {
    const matchSearch =
      searchTerm === "" ||
      intimacao.numero_processo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      intimacao.tipo?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchStatus = filterStatus === "todas" || intimacao.status === filterStatus;
    const matchOrigem = filterOrigem === "todas" || intimacao.origem === filterOrigem;

    return matchSearch && matchStatus && matchOrigem;
  });

  // Calcular dias restantes
  const getDiasRestantes = (prazo: string | null) => {
    if (!prazo) return null;
    const dias = differenceInDays(new Date(prazo), new Date());
    return dias;
  };

  // Status Badge
  const getStatusBadge = (intimacao: Intimacao) => {
    const diasRestantes = getDiasRestantes(intimacao.prazo);

    if (intimacao.status === "cumprida") {
      return <Badge className="bg-green-ok/10 text-green-ok">Cumprida</Badge>;
    }

    if (intimacao.status === "arquivada") {
      return <Badge variant="outline">Arquivada</Badge>;
    }

    if (!diasRestantes) {
      return <Badge className="bg-accent/10 text-accent">Ativa</Badge>;
    }

    if (diasRestantes < 0) {
      return <Badge className="bg-red-alert/10 text-red-alert">Vencida</Badge>;
    }

    if (diasRestantes <= 3) {
      return <Badge className="bg-red-alert/10 text-red-alert">Urgente</Badge>;
    }

    if (diasRestantes <= 7) {
      return <Badge className="bg-yellow-500/10 text-yellow-600">Atenção</Badge>;
    }

    return <Badge className="bg-accent/10 text-accent">Ativa</Badge>;
  };

  // Estatísticas
  const stats = {
    total: intimacoes.length,
    ativas: intimacoes.filter((i) => i.status === "ativa").length,
    urgentes: intimacoes.filter((i) => {
      const dias = getDiasRestantes(i.prazo);
      return i.status === "ativa" && dias !== null && dias <= 3 && dias >= 0;
    }).length,
    vencidas: intimacoes.filter((i) => {
      const dias = getDiasRestantes(i.prazo);
      return i.status === "ativa" && dias !== null && dias < 0;
    }).length,
  };

  return (
    <div>
      <div className="mb-7">
        <h1 className="font-display text-3xl font-bold tracking-tight">Intimações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie suas intimações e prazos processuais
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Total</div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="text-2xl font-bold text-accent">{stats.ativas}</div>
          <div className="text-sm text-muted-foreground">Ativas</div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="text-2xl font-bold text-yellow-600">{stats.urgentes}</div>
          <div className="text-sm text-muted-foreground">Urgentes</div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="text-2xl font-bold text-red-alert">{stats.vencidas}</div>
          <div className="text-sm text-muted-foreground">Vencidas</div>
        </div>
      </div>

      {/* Filtros e Ações */}
      <div className="flex flex-col md:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número do processo ou tipo..."
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
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="ativa">Ativas</SelectItem>
            <SelectItem value="cumprida">Cumpridas</SelectItem>
            <SelectItem value="arquivada">Arquivadas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterOrigem} onValueChange={setFilterOrigem}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="aasp">AASP</SelectItem>
            <SelectItem value="diario_oficial">Diário Oficial</SelectItem>
            <SelectItem value="email">E-mail</SelectItem>
            <SelectItem value="outros">Outros</SelectItem>
          </SelectContent>
        </Select>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full md:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Nova Intimação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Cadastrar Nova Intimação</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Número do Processo</Label>
                <Input
                  placeholder="Ex: 0000000-00.0000.0.00.0000"
                  value={formData.numero_processo}
                  onChange={(e) =>
                    setFormData({ ...formData, numero_processo: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Origem</Label>
                  <Select
                    value={formData.origem}
                    onValueChange={(value) => setFormData({ ...formData, origem: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aasp">AASP</SelectItem>
                      <SelectItem value="diario_oficial">Diário Oficial</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Tipo</Label>
                  <Input
                    placeholder="Ex: Sentença, Despacho"
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Conteúdo</Label>
                <Textarea
                  placeholder="Descreva o conteúdo da intimação..."
                  value={formData.conteudo}
                  onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data de Publicação</Label>
                  <Input
                    type="date"
                    value={formData.data_publicacao}
                    onChange={(e) =>
                      setFormData({ ...formData, data_publicacao: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label>Prazo</Label>
                  <Input
                    type="date"
                    value={formData.prazo}
                    onChange={(e) => setFormData({ ...formData, prazo: e.target.value })}
                  />
                </div>
              </div>

              <Button
                onClick={() => createMutation.mutate(formData)}
                disabled={createMutation.isPending}
                className="w-full"
              >
                {createMutation.isPending ? "Cadastrando..." : "Cadastrar Intimação"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de Intimações */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="w-10 h-10 border-4 border-accent/20 border-t-accent rounded-full animate-spin mx-auto" />
        </div>
      ) : filteredIntimacoes.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {searchTerm || filterStatus !== "todas" || filterOrigem !== "todas"
              ? "Nenhuma intimação encontrada com os filtros aplicados."
              : "Nenhuma intimação cadastrada ainda."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIntimacoes.map((intimacao) => {
            const diasRestantes = getDiasRestantes(intimacao.prazo);

            return (
              <div
                key={intimacao.id}
                className="bg-card rounded-xl p-5 border border-border hover:border-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg">
                        {intimacao.tipo || "Intimação"}
                      </h3>
                      {getStatusBadge(intimacao)}
                      <Badge variant="outline" className="text-xs">
                        {intimacao.origem.toUpperCase()}
                      </Badge>
                    </div>
                    {intimacao.numero_processo && (
                      <p className="text-sm text-muted-foreground font-mono">
                        {intimacao.numero_processo}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {intimacao.status === "ativa" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateStatusMutation.mutate({
                            id: intimacao.id,
                            status: "cumprida",
                          })
                        }
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Cumprir
                      </Button>
                    )}
                  </div>
                </div>

                {intimacao.conteudo && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {intimacao.conteudo}
                  </p>
                )}

                <div className="flex flex-wrap gap-4 text-sm">
                  {intimacao.data_publicacao && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Publicado:</span>
                      <span className="font-medium">
                        {format(new Date(intimacao.data_publicacao), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                  )}

                  {intimacao.prazo && (
                    <div className="flex items-center gap-1.5">
                      <AlertCircle
                        className={`h-4 w-4 ${
                          diasRestantes !== null && diasRestantes <= 3
                            ? "text-red-alert"
                            : "text-muted-foreground"
                        }`}
                      />
                      <span className="text-muted-foreground">Prazo:</span>
                      <span
                        className={`font-medium ${
                          diasRestantes !== null && diasRestantes <= 3
                            ? "text-red-alert"
                            : ""
                        }`}
                      >
                        {format(new Date(intimacao.prazo), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                        {diasRestantes !== null && diasRestantes >= 0 && (
                          <span className="ml-1">({diasRestantes} dias)</span>
                        )}
                        {diasRestantes !== null && diasRestantes < 0 && (
                          <span className="ml-1 text-red-alert">
                            (Vencido há {Math.abs(diasRestantes)} dias)
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
