import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  useAdminProfiles,
  useAdminProcessos,
  useAdminClientes,
} from "@/hooks/useAdmin";
import {
  useAdminTarefasDelegadas,
  useDeleteTarefaDelegada,
  useUpdateTarefaDelegada,
} from "@/hooks/useDelegacao";
import { DelegarTarefaModal } from "@/components/DelegarTarefaModal";
import {
  Users, FileText, Briefcase, Download,
  Search, ChevronDown, ChevronRight, Shield, Printer,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parseia YYYY-MM-DD como data local (evita deslocamento UTC no Brasil) */
function parseDateLocal(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return parseDateLocal(iso).toLocaleDateString("pt-BR");
}

function csvEscape(v: unknown) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function statusBadge(status: string | null | undefined) {
  const map: Record<string, string> = {
    ativo:     "bg-emerald-100 text-emerald-700",
    ativa:     "bg-emerald-100 text-emerald-700",
    encerrado: "bg-gray-100 text-gray-500",
    pausado:   "bg-yellow-100 text-yellow-700",
    inativo:   "bg-red-100 text-red-600",
    arquivado: "bg-gray-100 text-gray-400",
  };
  const cls = map[status ?? ""] ?? "bg-gray-100 text-gray-500";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[0.7rem] font-semibold ${cls}`}>
      {status ?? "—"}
    </span>
  );
}

function SectionCard({ icon: Icon, label, count, color }: {
  icon: React.ElementType; label: string; count: number; color: string;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-4 ${color}`}>
      <Icon className="h-6 w-6 shrink-0" />
      <div>
        <div className="text-2xl font-extrabold font-display leading-none">{count}</div>
        <div className="text-xs font-medium opacity-70 mt-0.5">{label}</div>
      </div>
    </div>
  );
}

// ─── AdminPage ────────────────────────────────────────────────────────────────

export function AdminPage() {
  const { user, isAdmin } = useAuth();
  const { data: profiles  = [], isLoading: loadProfiles  } = useAdminProfiles();
  const { data: processos = [], isLoading: loadProcessos } = useAdminProcessos();
  const { data: clientes  = [], isLoading: loadClientes  } = useAdminClientes();
  const { data: delegadas = [], isLoading: loadDelegadas } = useAdminTarefasDelegadas();
  const { mutate: deletarDelegada } = useDeleteTarefaDelegada();
  const { mutate: updateDelegada  } = useUpdateTarefaDelegada();
  const [delegarOpen, setDelegarOpen] = useState(false);
  const [delegarPreUser, setDelegarPreUser] = useState<string | undefined>();

  const [search, setSearch]             = useState("");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [tab, setTab]                   = useState<"overview" | "processos" | "clientes" | "relatorio" | "delegacao">("overview");

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
        <Shield className="h-12 w-12 text-destructive/50" />
        <p className="text-lg font-display font-semibold">Acesso restrito</p>
        <p className="text-sm">Apenas administradores podem acessar esta página.</p>
      </div>
    );
  }

  const profileMap      = Object.fromEntries(profiles.map(p => [p.user_id, p]));
  const nomeResponsavel = (uid: string) =>
    profileMap[uid]?.full_name || profileMap[uid]?.escritorio || uid.slice(0, 8) + "…";

  const q = search.toLowerCase();

  const filteredProcessos = processos.filter(p =>
    !q ||
    p.numero_cnj?.toLowerCase().includes(q) ||
    p.classe?.toLowerCase().includes(q) ||
    p.tribunal?.toLowerCase().includes(q) ||
    p.comarca?.toLowerCase().includes(q) ||
    nomeResponsavel(p.user_id).toLowerCase().includes(q)
  );

  const filteredClientes = clientes.filter(c =>
    !q ||
    c.nome?.toLowerCase().includes(q) ||
    c.cpf_cnpj?.toLowerCase().includes(q) ||
    c.email?.toLowerCase().includes(q) ||
    nomeResponsavel(c.user_id).toLowerCase().includes(q)
  );

  // ── CSV ───────────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const linhas: string[][] = [];

    linhas.push(["=== PROCESSOS ==="]);
    linhas.push(["Nº CNJ","Classe","Tribunal","Comarca","Vara","Status","Responsável","Escritório","Cadastrado em"]);
    processos.forEach(p => linhas.push([
      p.numero_cnj, p.classe ?? "", p.tribunal ?? "", p.comarca ?? "", p.vara ?? "",
      p.status, nomeResponsavel(p.user_id), profileMap[p.user_id]?.escritorio ?? "", fmtDate(p.created_at),
    ]));

    linhas.push([]);
    linhas.push(["=== CLIENTES ==="]);
    linhas.push(["Nome","CPF/CNPJ","E-mail","Telefone","Status","Responsável","Escritório","Cadastrado em"]);
    clientes.forEach(c => linhas.push([
      c.nome, c.cpf_cnpj ?? "", c.email ?? "", c.telefone ?? "",
      c.status_monitoramento ?? "", nomeResponsavel(c.user_id),
      profileMap[c.user_id]?.escritorio ?? "", fmtDate(c.created_at),
    ]));

    const csv  = linhas.map(r => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `jurismonitor_admin_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── PDF ───────────────────────────────────────────────────────────────────
  const handlePDF = () => {
    const gerado = new Date().toLocaleString("pt-BR");
    const admin  = user?.user_metadata?.full_name || user?.email || "Admin";

    const estilos = `
      body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 20px; }
      h1   { font-size: 18px; margin-bottom: 2px; }
      h2   { font-size: 13px; background: #1e293b; color: #fff; padding: 6px 10px; margin: 18px 0 6px; border-radius: 4px; }
      h3   { font-size: 11px; color: #475569; margin: 12px 0 4px; text-transform: uppercase; letter-spacing: .05em; }
      p    { margin: 2px 0; color: #475569; font-size: 10px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
      th   { background: #f1f5f9; text-align: left; padding: 5px 7px; font-size: 10px; border: 1px solid #e2e8f0; }
      td   { padding: 4px 7px; border: 1px solid #e2e8f0; vertical-align: top; }
      tr:nth-child(even) td { background: #f8fafc; }
      .badge { display: inline-block; padding: 1px 6px; border-radius: 99px; font-size: 9px; font-weight: 700; }
      .ativo,.ativa { background:#d1fae5; color:#065f46; }
      .pausado      { background:#fef9c3; color:#854d0e; }
      .inativo      { background:#fee2e2; color:#991b1b; }
      .encerrado,.arquivado { background:#f1f5f9; color:#64748b; }
      .totais { display:flex; gap:12px; margin:12px 0; }
      .tot    { background:#f1f5f9; border-radius:6px; padding:8px 14px; text-align:center; }
      .tot b  { display:block; font-size:20px; }
      @media print {
        body { margin: 10px; }
        h2 { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `;

    const badge = (s?: string | null) =>
      `<span class="badge ${s ?? ''}">${s ?? '—'}</span>`;

    let corpo = `
      <h1>Relatório Geral — JurisMonitor</h1>
      <p>Gerado em ${gerado} &nbsp;|&nbsp; Administrador: ${admin}</p>
      <div class="totais">
        <div class="tot"><b>${profiles.length}</b>Usuários</div>
        <div class="tot"><b>${processos.length}</b>Processos</div>
        <div class="tot"><b>${clientes.length}</b>Clientes</div>
      </div>
    `;

    profiles.forEach(profile => {
      const uid            = profile.user_id;
      const userProcessos  = processos.filter(p => p.user_id === uid);
      const userClientes   = clientes.filter(c => c.user_id === uid);

      corpo += `
        <h2>
          ${profile.full_name || "Sem nome"}
          ${profile.is_admin ? ' <small>[ADMIN]</small>' : ''}
          &nbsp;—&nbsp;
          ${profile.escritorio || '—'} &nbsp;|&nbsp; OAB: ${profile.oab || '—'}
        </h2>
        <p>${userProcessos.length} processo(s) &nbsp;·&nbsp; ${userClientes.length} cliente(s)</p>
      `;

      // Processos
      if (userProcessos.length > 0) {
        corpo += `<h3>Processos</h3><table>
          <thead><tr>
            <th>Nº CNJ</th><th>Classe</th><th>Tribunal</th><th>Comarca</th><th>Status</th><th>Cadastrado</th>
          </tr></thead><tbody>`;
        userProcessos.forEach(p => {
          corpo += `<tr>
            <td><b>${p.numero_cnj}</b></td>
            <td>${p.classe || '—'}</td>
            <td>${p.tribunal || '—'}</td>
            <td>${p.comarca || '—'}</td>
            <td>${badge(p.status)}</td>
            <td>${fmtDate(p.created_at)}</td>
          </tr>`;
        });
        corpo += `</tbody></table>`;
      }

      // Clientes (todos os status)
      if (userClientes.length > 0) {
        corpo += `<h3>Clientes</h3><table>
          <thead><tr>
            <th>Nome</th><th>CPF/CNPJ</th><th>E-mail</th><th>Telefone</th><th>Status</th>
          </tr></thead><tbody>`;
        userClientes.forEach(c => {
          corpo += `<tr>
            <td><b>${c.nome}</b></td>
            <td>${c.cpf_cnpj || '—'}</td>
            <td>${c.email || '—'}</td>
            <td>${c.telefone || '—'}</td>
            <td>${badge(c.status_monitoramento)}</td>
          </tr>`;
        });
        corpo += `</tbody></table>`;
      }

      if (userProcessos.length === 0 && userClientes.length === 0) {
        corpo += `<p style="color:#94a3b8;font-style:italic">Sem processos ou clientes cadastrados.</p>`;
      }
    });

    const html = `<!DOCTYPE html><html lang="pt-BR">
      <head><meta charset="UTF-8"><title>Relatório JurisMonitor</title>
      <style>${estilos}</style></head>
      <body>${corpo}</body></html>`;

    const janela = window.open("", "_blank", "width=900,height=700");
    if (!janela) { alert("Permita pop-ups para gerar o PDF."); return; }
    janela.document.write(html);
    janela.document.close();
    janela.focus();
    setTimeout(() => janela.print(), 800);
  };

  const loading = loadProfiles || loadProcessos || loadClientes;

  return (
    <div className="page-stack">

      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-accent" />
          <div>
            <h1 className="page-title">Painel Admin</h1>
            <p className="text-xs text-muted-foreground">Processos e clientes de todos os usuários</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV}
            className="flex items-center gap-1.5 bg-accent text-primary px-3 py-2 rounded-lg text-xs font-semibold hover:bg-accent/90 transition-colors">
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </button>
          <button onClick={handlePDF}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity">
            <Printer className="h-3.5 w-3.5" /> Gerar PDF
          </button>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-3 gap-3">
        <SectionCard icon={Users}     label="Usuários"  count={profiles.length}  color="bg-violet-50 text-violet-700 border-violet-200" />
        <SectionCard icon={FileText}  label="Processos" count={processos.length} color="bg-blue-50 text-blue-700 border-blue-200" />
        <SectionCard icon={Briefcase} label="Clientes"  count={clientes.length}  color="bg-emerald-50 text-emerald-700 border-emerald-200" />
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b border-border">
        {(["overview","processos","clientes","relatorio","delegacao"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-all border-b-2 -mb-px ${
              tab === t ? "border-accent text-accent font-bold" : "border-transparent text-muted-foreground hover:text-foreground"
            } ${t === "delegacao" ? "text-violet-400" : ""}`}>
            {{ overview:"Por Usuário", processos:"Processos", clientes:"Clientes", relatorio:"Relatório", delegacao:"🎯 Delegação" }[t]}
            {t === "delegacao" && delegadas.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 text-[10px] font-bold">
                {delegadas.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Barra de busca */}
      {(tab === "processos" || tab === "clientes") && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={tab === "processos" ? "Buscar por número, tribunal, responsável..." : "Buscar por nome, CPF/CNPJ, e-mail..."}
            className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
        </div>
      )}

      {/* ── ABA: POR USUÁRIO ── */}
      {tab === "overview" && !loading && (
        <div className="space-y-3">
          {profiles.length === 0 && <p className="text-center text-muted-foreground py-10 text-sm">Nenhum usuário cadastrado.</p>}
          {profiles.map(profile => {
            const uid           = profile.user_id;
            const userProcessos = processos.filter(p => p.user_id === uid);
            const userClientes  = clientes.filter(c => c.user_id === uid);
            const expanded      = expandedUser === uid;

            return (
              <div key={uid} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/5 transition-colors text-left"
                  onClick={() => setExpandedUser(expanded ? null : uid)}>
                  <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-sm font-bold text-accent shrink-0">
                    {(profile.full_name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                      {profile.full_name || "Sem nome"}
                      {profile.is_admin && <span className="bg-violet-100 text-violet-700 text-[0.6rem] px-1.5 py-0.5 rounded font-bold">ADMIN</span>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{profile.escritorio || "Sem escritório"} · OAB: {profile.oab || "—"}</div>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                    <span><b>{userProcessos.length}</b> processos</span>
                    <span><b>{userClientes.length}</b> clientes</span>
                  </div>
                  {expanded
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                </button>

                {expanded && (
                  <div className="border-t border-border px-4 py-4 space-y-4 bg-muted/20">

                    {/* Processos */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" /> Processos ({userProcessos.length})
                      </h3>
                      {userProcessos.length === 0
                        ? <p className="text-xs text-muted-foreground">Nenhum processo.</p>
                        : (
                          <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full text-xs">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="text-left px-3 py-2 font-semibold">Nº CNJ</th>
                                  <th className="text-left px-3 py-2 font-semibold">Classe</th>
                                  <th className="text-left px-3 py-2 font-semibold">Tribunal</th>
                                  <th className="text-left px-3 py-2 font-semibold">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {userProcessos.map(p => (
                                  <tr key={p.id} className="border-t border-border/50 hover:bg-accent/5">
                                    <td className="px-3 py-2 font-mono">{p.numero_cnj}</td>
                                    <td className="px-3 py-2">{p.classe || "—"}</td>
                                    <td className="px-3 py-2">{p.tribunal || "—"}</td>
                                    <td className="px-3 py-2">{statusBadge(p.status)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                    </div>

                    {/* Clientes — todos os status */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5" /> Clientes ({userClientes.length})
                      </h3>
                      {userClientes.length === 0
                        ? <p className="text-xs text-muted-foreground">Nenhum cliente.</p>
                        : (
                          <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full text-xs">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="text-left px-3 py-2 font-semibold">Nome</th>
                                  <th className="text-left px-3 py-2 font-semibold">CPF/CNPJ</th>
                                  <th className="text-left px-3 py-2 font-semibold">E-mail</th>
                                  <th className="text-left px-3 py-2 font-semibold">Telefone</th>
                                  <th className="text-left px-3 py-2 font-semibold">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {userClientes.map(c => (
                                  <tr key={c.id} className="border-t border-border/50 hover:bg-accent/5">
                                    <td className="px-3 py-2 font-medium">{c.nome}</td>
                                    <td className="px-3 py-2">{c.cpf_cnpj || "—"}</td>
                                    <td className="px-3 py-2">{c.email || "—"}</td>
                                    <td className="px-3 py-2">{c.telefone || "—"}</td>
                                    <td className="px-3 py-2">{statusBadge(c.status_monitoramento)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── ABA: PROCESSOS ── */}
      {tab === "processos" && !loading && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2.5 font-semibold">Nº CNJ</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Classe</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Tribunal</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Comarca</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Status</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Responsável</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Cadastrado</th>
                </tr>
              </thead>
              <tbody>
                {filteredProcessos.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum processo encontrado.</td></tr>
                )}
                {filteredProcessos.map(p => (
                  <tr key={p.id} className="border-t border-border/50 hover:bg-accent/5">
                    <td className="px-3 py-2 font-mono">{p.numero_cnj}</td>
                    <td className="px-3 py-2">{p.classe || "—"}</td>
                    <td className="px-3 py-2">{p.tribunal || "—"}</td>
                    <td className="px-3 py-2">{p.comarca || "—"}</td>
                    <td className="px-3 py-2">{statusBadge(p.status)}</td>
                    <td className="px-3 py-2 font-medium">{nomeResponsavel(p.user_id)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            {filteredProcessos.length} processo(s)
          </div>
        </div>
      )}

      {/* ── ABA: CLIENTES ── */}
      {tab === "clientes" && !loading && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2.5 font-semibold">Nome</th>
                  <th className="text-left px-3 py-2.5 font-semibold">CPF/CNPJ</th>
                  <th className="text-left px-3 py-2.5 font-semibold">E-mail</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Telefone</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Status</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Responsável</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Cadastrado</th>
                </tr>
              </thead>
              <tbody>
                {filteredClientes.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado.</td></tr>
                )}
                {filteredClientes.map(c => (
                  <tr key={c.id} className="border-t border-border/50 hover:bg-accent/5">
                    <td className="px-3 py-2 font-medium">{c.nome}</td>
                    <td className="px-3 py-2">{c.cpf_cnpj || "—"}</td>
                    <td className="px-3 py-2">{c.email || "—"}</td>
                    <td className="px-3 py-2">{c.telefone || "—"}</td>
                    <td className="px-3 py-2">{statusBadge(c.status_monitoramento)}</td>
                    <td className="px-3 py-2">{nomeResponsavel(c.user_id)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            {filteredClientes.length} cliente(s) — todos os status
          </div>
        </div>
      )}

      {/* ── ABA: RELATÓRIO ── */}
      {tab === "relatorio" && !loading && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display font-extrabold text-lg mb-1">Relatório Geral — JurisMonitor</h2>
            <p className="text-xs text-muted-foreground mb-4">Clique em "Gerar PDF" para abrir o relatório completo formatado para impressão.</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Usuários",  val: profiles.length  },
                { label: "Processos", val: processos.length },
                { label: "Clientes",  val: clientes.length  },
              ].map(s => (
                <div key={s.label} className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-extrabold font-display">{s.val}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {profiles.map(profile => {
            const uid           = profile.user_id;
            const userProcessos = processos.filter(p => p.user_id === uid);
            const userClientes  = clientes.filter(c => c.user_id === uid);

            return (
              <div key={uid} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="bg-primary px-5 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {(profile.full_name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 text-primary-foreground">
                    <div className="font-bold text-sm">
                      {profile.full_name || "Sem nome"}
                      {profile.is_admin && <span className="ml-2 text-[0.6rem] bg-accent text-primary px-1.5 py-0.5 rounded font-bold">ADMIN</span>}
                    </div>
                    <div className="text-xs opacity-70">{profile.escritorio || "—"} · OAB: {profile.oab || "—"}</div>
                  </div>
                  <div className="hidden sm:flex gap-4 text-xs text-primary-foreground/70 shrink-0">
                    <span><b className="text-primary-foreground">{userProcessos.length}</b> proc.</span>
                    <span><b className="text-primary-foreground">{userClientes.length}</b> clientes</span>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {/* Processos */}
                  {userProcessos.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" /> Processos
                      </h4>
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/40">
                            <tr>
                              <th className="text-left px-3 py-2 font-semibold">Nº CNJ</th>
                              <th className="text-left px-3 py-2 font-semibold">Classe</th>
                              <th className="text-left px-3 py-2 font-semibold">Tribunal</th>
                              <th className="text-left px-3 py-2 font-semibold">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {userProcessos.map(p => (
                              <tr key={p.id} className="border-t border-border/50">
                                <td className="px-3 py-2 font-mono">{p.numero_cnj}</td>
                                <td className="px-3 py-2">{p.classe || "—"}</td>
                                <td className="px-3 py-2">{p.tribunal || "—"}</td>
                                <td className="px-3 py-2">{statusBadge(p.status)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Clientes */}
                  {userClientes.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5" /> Clientes
                      </h4>
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/40">
                            <tr>
                              <th className="text-left px-3 py-2 font-semibold">Nome</th>
                              <th className="text-left px-3 py-2 font-semibold">CPF/CNPJ</th>
                              <th className="text-left px-3 py-2 font-semibold">E-mail</th>
                              <th className="text-left px-3 py-2 font-semibold">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {userClientes.map(c => (
                              <tr key={c.id} className="border-t border-border/50">
                                <td className="px-3 py-2 font-medium">{c.nome}</td>
                                <td className="px-3 py-2">{c.cpf_cnpj || "—"}</td>
                                <td className="px-3 py-2">{c.email || "—"}</td>
                                <td className="px-3 py-2">{statusBadge(c.status_monitoramento)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {userProcessos.length === 0 && userClientes.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Sem processos ou clientes cadastrados.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* ── ABA: DELEGAÇÃO ── */}
      {tab === "delegacao" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-extrabold text-lg">Tarefas Delegadas</h2>
              <p className="text-xs text-muted-foreground">
                {delegadas.length} tarefa(s) delegadas no total
              </p>
            </div>
            <button
              onClick={() => { setDelegarPreUser(undefined); setDelegarOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700
                         text-white text-sm font-semibold transition-colors"
            >
              + Delegar Nova Tarefa
            </button>
          </div>

          {loadDelegadas ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Carregando…</div>
          ) : delegadas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-4xl mb-3">🎯</div>
              <p className="font-semibold">Nenhuma tarefa delegada ainda</p>
              <p className="text-sm mt-1">Use o botão acima para delegar uma tarefa a um usuário</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Tarefa</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Delegada para</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Prioridade</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Vencimento</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Lida</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {delegadas.map(t => (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-sm">{t.titulo}</div>
                        {t.descricao && (
                          <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{t.descricao}</div>
                        )}
                        {t.processo && (
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{t.processo.numero_cnj}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {t.destinatario?.full_name
                          ? <div className="text-sm font-semibold">{t.destinatario.full_name}</div>
                          : <span className="text-xs text-muted-foreground italic">—</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={t.status}
                          onChange={e => updateDelegada({ id: t.id, status: e.target.value })}
                          className="text-xs px-2 py-1 border border-border rounded bg-background
                                     focus:outline-none focus:ring-1 focus:ring-accent/40"
                        >
                          {["triagem","ag_documentos","ag_cliente","elaboracao","andamento",
                            "audiencia","ag_tribunal","concluida","cancelada"].map(s => (
                            <option key={s} value={s}>{s.replace("_"," ")}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold text-white ${
                          t.prioridade === "urgente" ? "bg-red-500" :
                          t.prioridade === "alta"    ? "bg-orange-500" :
                          t.prioridade === "media"   ? "bg-yellow-500" : "bg-gray-500"
                        }`}>
                          {t.prioridade}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {fmtDate(t.data_vencimento)}
                      </td>
                      <td className="px-4 py-3">
                        {t.lida_pelo_destinatario ? (
                          <span className="text-[10px] text-emerald-600 font-semibold">✓ Lida</span>
                        ) : (
                          <span className="text-[10px] text-amber-500 font-semibold">Não lida</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => { if (confirm("Excluir esta tarefa?")) deletarDelegada(t.id); }}
                          className="text-xs text-destructive hover:underline"
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal de delegação */}
      <DelegarTarefaModal
        open={delegarOpen}
        onClose={() => setDelegarOpen(false)}
        profiles={(profiles ?? [])
          .filter((p: any) => p.user_id)
          .map((p: any) => ({ id: p.user_id, full_name: p.full_name || "Usuário" }))}
        preselectedUserId={delegarPreUser}
      />

    </div>
  );
}
