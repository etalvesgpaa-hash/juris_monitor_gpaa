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
import { Bell, Plus, Search, Filter, CheckCircle, Clock, AlertCircle, Eye, Trash2 } from "lucide-react";
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
  const [selectedIntimacao, setSelectedIntimacao] = useState<Intimacao | null>(null);

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
      setSelectedIntimacao(null);
    },
  });

  // Mutation para deletar
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("intimacoes")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intimacoes"] });
      toast.success("Intimação excluída!");
      setSelectedIntimacao(null);
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
        <h1 className="font-display text-3xl font-bold tracking-tight">Intimações AASP</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Publicações do Diário de Justiça Eletrônico — atualizadas automaticamente
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Total</div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="text-2xl font-bold text-accent">{stats.ativas}</div>
          <div className="text-xs text-muted-foreground">Ativas</div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="text-2xl font-bold text-yellow-600">{stats.urgentes}</div>
          <div className="text-xs text-muted-foreground">Urgentes</div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="text-2xl font-bold text-red-alert">{stats.vencidas}</div>
          <div className="text-xs text-muted-foreground">Vencidas</div>
        </div>
      </div>

      {/* Filtros e Ações */}
      <div className="flex flex-col md:flex-row gap-3 mb-5 items-start md:items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar número, parte, assunto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos os status</SelectItem>
            <SelectItem value="ativa">Ativas</SelectItem>
            <SelectItem value="cumprida">Cumpridas</SelectItem>
            <SelectItem value="arquivada">Arquivadas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterOrigem} onValueChange={setFilterOrigem}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as origens</SelectItem>
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
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-[0.75rem] uppercase tracking-wide text-muted-foreground">DATA</th>
                  <th className="px-4 py-3 text-left font-semibold text-[0.75rem] uppercase tracking-wide text-muted-foreground">PROCESSO</th>
                  <th className="px-4 py-3 text-left font-semibold text-[0.75rem] uppercase tracking-wide text-muted-foreground">TIPO / ÓRGÃO</th>
                  <th className="px-4 py-3 text-left font-semibold text-[0.75rem] uppercase tracking-wide text-muted-foreground">PUBLICAÇÃO</th>
                  <th className="px-4 py-3 text-left font-semibold text-[0.75rem] uppercase tracking-wide text-muted-foreground">PARTES</th>
                  <th className="px-4 py-3 text-left font-semibold text-[0.75rem] uppercase tracking-wide text-muted-foreground">STATUS</th>
                  <th className="px-4 py-3 text-left font-semibold text-[0.75rem] uppercase tracking-wide text-muted-foreground">AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {filteredIntimacoes.map((intimacao) => {
                  const diasRestantes = getDiasRestantes(intimacao.prazo);

                  return (
                    <tr key={intimacao.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {intimacao.created_at ? new Date(intimacao.created_at).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-sm font-bold text-accent">{intimacao.numero_processo || "—"}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{intimacao.tipo || "Intimação"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs font-mono">
                          {intimacao.origem.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {intimacao.data_publicacao ? format(new Date(intimacao.data_publicacao), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-muted-foreground max-w-xs truncate">
                          {intimacao.conteudo ? intimacao.conteudo.substring(0, 40) + "..." : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(intimacao)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedIntimacao(intimacao)}
                            className="p-1.5 hover:bg-accent/10 rounded transition-colors"
                            title="Visualizar"
                          >
                            <Eye className="h-4 w-4 text-accent" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Deseja excluir esta intimação?")) {
                                deleteMutation.mutate(intimacao.id);
                              }
                            }}
                            className="p-1.5 hover:bg-red-alert/10 rounded transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4 text-red-alert" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      {selectedIntimacao && (
        <Dialog open={!!selectedIntimacao} onOpenChange={(open) => !open && setSelectedIntimacao(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Intimação #{selectedIntimacao.numero_processo || "—"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetailItem label="Tipo" value={selectedIntimacao.tipo || "—"} />
                <DetailItem label="Origem" value={selectedIntimacao.origem} />
                <DetailItem label="Data Publicação" value={selectedIntimacao.data_publicacao ? format(new Date(selectedIntimacao.data_publicacao), "dd/MM/yyyy", { locale: ptBR }) : "—"} />
                <DetailItem label="Prazo" value={selectedIntimacao.prazo ? format(new Date(selectedIntimacao.prazo), "dd/MM/yyyy", { locale: ptBR }) : "—"} />
              </div>

              {selectedIntimacao.conteudo && (
                <div className="bg-muted/50 border border-border rounded-lg p-4">
                  <div className="text-[0.72rem] font-bold uppercase tracking-widest text-muted-foreground mb-2">Conteúdo</div>
                  <p className="text-sm leading-relaxed">{selectedIntimacao.conteudo}</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedIntimacao(null)}>Fechar</Button>
                {selectedIntimacao.status === "ativa" && (
                  <Button 
                    variant="gold" 
                    size="sm"
                    onClick={() => updateStatusMutation.mutate({ id: selectedIntimacao.id, status: "cumprida" })}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Marcar Cumprida
                  </Button>
                )}
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => {
                    if (confirm("Deseja excluir esta intimação?")) {
                      deleteMutation.mutate(selectedIntimacao.id);
                    }
                  }}
                >
                  Excluir
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}
