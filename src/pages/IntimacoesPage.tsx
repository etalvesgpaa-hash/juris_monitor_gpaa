import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue} from "@/components/ui/select";
import { toast } from "sonner";
import { RefreshCw, RotateCcw, TableIcon, LayoutGrid, Eye, CheckCircle, Pause, PlayCircle, Trash2, AlertCircle, Loader2, X } from "lucide-react";

// ── Tipos ──────────────────────────────────────────────────────
interface AaspIntimacao {
  _id: string;
  _data: string;
  _lida: boolean;
  _status: "ativa" | "finalizada" | "pausada";
  _resumoIA?: string | null;
  _titulo?: string;
  _numProc?: string;
  [key: string]: unknown;
}

// ── Helpers ────────────────────────────────────────────────────
function diasUteisRecentes(n: number): string[] {
  const dias: string[] = [];
  const d = new Date();
  while (dias.length < n) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) dias.push(d.toISOString().split("T")[0]);
    d.setDate(d.getDate() - 1);
  }
  return dias;
}

function extrairNumerosCNJ(texto: string): string[] {
  const regex = /\d{7}[-.]?\d{2}[-.]?\d{4}[-.]?\d{1}[-.]?\d{1,2}[-.]?\d{4,5}/g;
  return (texto.match(regex) || []).map((m) => m.replace(/\D/g, ""));
}

function gerarId(intim: AaspIntimacao, idx = 0): string {
  const numProc = (intim.NumeroProcesso || intim.numeroProcesso || intim.Processo || intim.processo || "") as string;
  const data = (intim.DataDisponibilizacao || intim.dataDisponibilizacao || intim.Data || intim.data || "") as string;
  const raw = `${numProc}|${String(data).slice(0, 10)}|${idx}`;
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) hash = ((hash << 5) + hash + raw.charCodeAt(i)) | 0;
  return "det_" + Math.abs(hash).toString(36);
}

function normalizar(raw: unknown): AaspIntimacao[] {
  if (Array.isArray(raw)) return raw as AaspIntimacao[];
  if (Array.isArray((raw as any)?.Intimacoes)) return (raw as any).Intimacoes;
  return [];
}

function fmtData(iso: string): string {
  const p = iso.slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

function extrairNumProc(intim: AaspIntimacao): string {
  const campos = [intim.NumeroProcesso, intim.numeroProcesso, intim.Texto, intim.texto].filter(Boolean).join(" ");
  const nums = extrairNumerosCNJ(campos);
  return nums.length > 0 ? nums[0] : "";
}

// ── Persistência ───────────────────────────────────────────────
const STORE_KEY = "jm_aasp_intimacoes";
function loadStore(): AaspIntimacao[] {
  try { const s = localStorage.getItem(STORE_KEY); return s ? JSON.parse(s) : []; } catch { return []; }
}
function saveStore(items: AaspIntimacao[]) { localStorage.setItem(STORE_KEY, JSON.stringify(items.slice(0, 500))); }

// ── Componente ─────────────────────────────────────────────────
export function IntimacoesPage() {
  const { user } = useAuth();
  const [intimacoes, setIntimacoes] = useState<AaspIntimacao[]>(() => loadStore());
  const [aaspKey, setAaspKey] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingDia, setLoadingDia] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<"ativa" | "finalizada" | "pausada">("ativa");
  const [filtroDia, setFiltroDia] = useState<string>("");
  const [viewMode, setViewMode] = useState<"tabela" | "cards">("tabela");
  const [selected, setSelected] = useState<AaspIntimacao | null>(null);

  useEffect(() => {
    const local = localStorage.getItem("jurismonitor_aasp_key") || "";
    if (local) { setAaspKey(local); }
  }, [user]);

  const buscarDia = useCallback(async (dataStr: string): Promise<AaspIntimacao[]> => {
    if (!aaspKey) return [];
    const params = new URLSearchParams({ chave: aaspKey, data: dataStr });
    const endpoint = `https://intimacaoapi.aasp.org.br/api/Associado/intimacao/json?${params}`;
    try {
      const resp = await fetch(`/api/proxy?url=${encodeURIComponent(endpoint)}`);
      const data = await resp.json();
      return normalizar(data).map((i, idx) => ({ ...i, _id: gerarId(i, idx), _data: dataStr, _status: "ativa", _numProc: extrairNumProc(i) }));
    } catch { return []; }
  }, [aaspKey]);

  const buscarTudo = useCallback(async () => {
    setLoading(true);
    const dias = diasUteisRecentes(7);
    let todas: AaspIntimacao[] = [];
    for (const d of dias) { todas = [...todas, ...(await buscarDia(d))]; }
    saveStore(todas);
    setIntimacoes(todas);
    setLoading(false);
  }, [buscarDia]);

  const filtradas = intimacoes.filter(i => (i._status || "ativa") === filtroStatus);

  return (
    <div>
      <h1 className="text-3xl font-bold">Intimações AASP</h1>
      {!aaspKey && <div className="p-4 bg-amber-50 text-amber-800">Configure sua chave AASP.</div>}
      
      {filtradas.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <p>Nenhuma intimação encontrada.</p>
          <p className="text-sm mt-1">
            {aaspKey ? 'Clique em "Atualizar" para buscar as publicações.' : 'Configure sua chave AASP nas Configurações.'}
          </p>
        </div>
      ) : (
        <div>/* Tabela ou Cards aqui */</div>
      )}
    </div>
  );
}