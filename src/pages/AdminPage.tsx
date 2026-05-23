import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  useAdminProfiles,
  useAdminProcessos,
  useAdminIntimacoes,
  useAdminClientes,
  useAdminTarefas,
} from "@/hooks/useAdmin";
import {
  Users, FileText, Bell, Briefcase, CheckSquare,
  Download, Search, ChevronDown, ChevronRight,
  Shield, AlertTriangle, Printer,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function statusLabel(s?: string | null) {
  return s ?? "—";
}

function csvEscape(v: unknown) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function statusBadge(status: string | null | undefined) {
  const map: Record<string, string> = {
    ativo:     "bg-emerald-100 text-emerald-700",
    encerrado: "bg-gray-100 text-gray-500",
    ativa:     "bg-blue-100 text-blue-700",
    lida:      "bg-gray-100 text-gray-400",
    pendente:  "bg-yellow-100 text-yellow-700",
    concluida: "bg-emerald-100 text-emerald-700",
    arquivada: "bg-gray-100 text-gray-400",
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
  const { data: profiles = [],   isLoading: loadProfiles  } = useAdminProfiles();
  const { data: processos = [],  isLoading: loadProcessos } = useAdminProcessos();
  const { data: intimacoes = [], isLoading: loadIntimacoes } = useAdminIntimacoes();
  const { data: clientes = [] }  = useAdminClientes();
  const { data: tarefas = [] }   = useAdminTarefas();

  const [search, setSearch]           = useState("");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [tab, setTab]                 = useState<"overview" | "processos" | "intimacoes" | "relatorio">("overview");

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
        <Shield className="h-12 w-12 text-destructive/50" />
        <p className="text-lg font-display font-semibold">Acesso restrito</p>
        <p className="text-sm">Apenas administradores podem acessar esta página.</p>
      </div>
    );
  }

  const profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p]));
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
  const filteredIntimacoes = intimacoes.filter(i =>
    !q ||
    i.numero_processo?.toLowerCase().includes(q) ||
    i.tipo?.toLowerCase().includes(q) ||
    i.conteudo?.toLowerCase().includes(q) ||
    nomeResponsavel(i.user_id).toLowerCase().includes(q)
  );

  // ── CSV completo (processos + intimações separadas em seções) ─────────────
  const handleExportCSV = () => {
    const linhas: string[][] = [];

    // Seção processos
    linhas.push(["=== PROCESSOS ==="]);
    linhas.push(["Nº CNJ","Classe","Tribunal","Comarca","Vara","Status","Responsável","Escritório","Intimações vinculadas","Tarefas","Criado em"]);
    processos.forEach(p => {
      linhas.push([
        p.numero_cnj,
        p.classe ?? "",
        p.tribunal ?? "",
        p.comarca ?? "",
        p.vara ?? "",
        p.status,
        nomeResponsavel(p.user_id),
        profileMap[p.user_id]?.escritorio ?? "",
        String(intimacoes.filter(i => i.processo_id === p.id).length),
        String(tarefas.filter(t => t.processo_id === p.id).length),
        fmtDate(p.created_at),
      ]);
    });

    linhas.push([]);
    linhas.push(["=== INTIMAÇÕES ==="]);
    linhas.push(["Nº Processo","Tipo","Origem","Publicação","Prazo","Status","Responsável","Escritório","Processo vinculado","Conteúdo"]);
    intimacoes.forEach(i => {
      const proc = processos.find(p => p.id === i.processo_id);
      linhas.push([
        i.numero_processo ?? "",
        i.tipo ?? "",
        i.origem,
        fmtDate(i.data_publicacao),
        fmtDate(i.prazo),
        i.status,
        nomeResponsavel(i.user_id),
        profileMap[i.user_id]?.escritorio ?? "",
        proc?.numero_cnj ?? "Não vinculado",
        i.conteudo ?? "",
      ]);
    });

    linhas.push([]);
    linhas.push(["=== CLIENTES ==="]);
    linhas.push(["Nome","CPF/CNPJ","Email","Telefone","Responsável","Escritório","Cadastrado em"]);
    clientes.forEach(c => {
      linhas.push([
        c.nome,
        c.cpf_cnpj ?? "",
        c.email ?? "",
        c.telefone ?? "",
        nomeResponsavel(c.user_id),
        profileMap[c.user_id]?.escritorio ?? "",
        fmtDate(c.created_at),
      ]);
    });

    linhas.push([]);
    linhas.push(["=== TAREFAS ==="]);
    linhas.push(["Título","Prioridade","Status","Vencimento","Responsável","Escritório","Processo","Criado em"]);
    tarefas.forEach(t => {
      const proc = processos.find(p => p.id === t.processo_id);
      linhas.push([
        t.titulo,
        t.prioridade,
        t.status,
        fmtDate(t.data_vencimento),
        nomeResponsavel(t.user_id),
        profileMap[t.user_id]?.escritorio ?? "",
        proc?.numero_cnj ?? "",
        fmtDate(t.created_at),
      ]);
    });

    const csv = linhas.map(r => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `jurismonitor_relatorio_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── PDF via janela nova (nunca vem em branco) ─────────────────────────────
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
      .pendente     { background:#fef9c3; color:#854d0e; }
      .encerrado,.lida,.arquivada { background:#f1f5f9; color:#64748b; }
      .totais { display: flex; gap: 12px; margin: 12px 0; }
      .tot   { background: #f1f5f9; border-radius: 6px; padding: 8px 14px; text-align: center; }
      .tot b { display: block; font-size: 20px; }
      .intim-row { background: #fffbeb; font-size: 10px; }
      .sem-vinculo { background: #fff7ed; border-left: 3px solid #f59e0b; padding: 4px 8px; margin: 2px 0; border-radius: 3px; }
      @media print { body { margin: 10px; } h2 { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    `;

    const badge = (s?: string | null) =>
      `<span class="badge ${s ?? ''}">${s ?? '—'}</span>`;

    let corpo = `
      <h1>Relatório Geral — JurisMonitor</h1>
      <p>Gerado em ${gerado} &nbsp;|&nbsp; Administrador: ${admin}</p>
      <div class="totais">
        <div class="tot"><b>${profiles.length}</b>Usuários</div>
        <div class="tot"><b>${processos.length}</b>Processos</div>
        <div class="tot"><b>${intimacoes.length}</b>Intimações</div>
        <div class="tot"><b>${clientes.length}</b>Clientes</div>
        <div class="tot"><b>${tarefas.length}</b>Tarefas</div>
      </div>
    `;

    profiles.forEach(profile => {
      const uid           = profile.user_id;
      const userProcessos = processos.filter(p => p.user_id === uid);
      const userIntimacoes = intimacoes.filter(i => i.user_id === uid);

      corpo += `
        <h2>
          ${profile.full_name || "Sem nome"}
          ${profile.is_admin ? ' <small>[ADMIN]</small>' : ''}
          &nbsp;&mdash;&nbsp;
          ${profile.escritorio || '—'} &nbsp;|&nbsp; OAB: ${profile.oab || '—'} &nbsp;|&nbsp; Tel: ${profile.telefone || '—'}
        </h2>
        <p>${userProcessos.length} processo(s) &nbsp;·&nbsp; ${userIntimacoes.length} intimação(ões)</p>
      `;

      if (userProcessos.length > 0) {
        corpo += `<h3>Processos</h3><table>
          <thead><tr>
            <th>Nº CNJ</th><th>Classe</th><th>Tribunal</th><th>Vara</th><th>Status</th><th>Últ. Movim.</th>
          </tr></thead><tbody>`;

        userProcessos.forEach(p => {
          const pi = intimacoes.filter(i => i.processo_id === p.id);
          corpo += `<tr>
            <td><b>${p.numero_cnj}</b></td>
            <td>${p.classe || '—'}</td>
            <td>${p.tribunal || '—'}</td>
            <td>${p.vara || '—'}</td>
            <td>${badge(p.status)}</td>
            <td>${fmtDate(p.ultima_movimentacao)}</td>
          </tr>`;
          pi.forEach(i => {
            corpo += `<tr class="intim-row"><td colspan="6" style="padding-left:20px">
              ⚖ <b>${i.tipo || 'Intimação'}</b> &nbsp;·&nbsp;
              Publicação: ${fmtDate(i.data_publicacao)} &nbsp;·&nbsp;
              Prazo: ${fmtDate(i.prazo)} &nbsp;·&nbsp;
              ${badge(i.status)}
              ${i.conteudo ? `<br><span style="color:#64748b">${i.conteudo.slice(0,200)}${i.conteudo.length>200?'…':''}</span>` : ''}
            </td></tr>`;
          });
        });
        corpo += `</tbody></table>`;
      }

      // Intimações sem processo
      const soltas = userIntimacoes.filter(i => !i.processo_id);
      if (soltas.length > 0) {
        corpo += `<h3>Intimações sem processo vinculado</h3>`;
        soltas.forEach(i => {
          corpo += `<div class="sem-vinculo">
            ⚠ <b>${i.numero_processo || 'Sem número'}</b> — ${i.tipo || '—'} &nbsp;·&nbsp;
            Publicação: ${fmtDate(i.data_publicacao)} &nbsp;·&nbsp; Prazo: ${fmtDate(i.prazo)} &nbsp;·&nbsp; ${badge(i.status)}
            ${i.conteudo ? `<br><span style="color:#64748b">${i.conteudo.slice(0,200)}${i.conteudo.length>200?'…':''}</span>` : ''}
          </div>`;
        });
      }

      if (userProcessos.length === 0 && userIntimacoes.length === 0) {
        corpo += `<p style="color:#94a3b8;font-style:italic">Usuário sem processos ou intimações cadastrados.</p>`;
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

  const loading = loadProfiles || loadProcessos || loadIntimacoes;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-accent" />
          <div>
            <h1 className="font-display font-extrabold text-xl text-foreground">Painel Admin</h1>
            <p className="text-xs text-muted-foreground">Visão global de todos os usuários e processos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 bg-accent text-primary px-3 py-2 rounded-lg text-xs font-semibold hover:bg-accent/90 transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </button>
          <button
            onClick={handlePDF}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <Printer className="h-3.5 w-3.5" /> Gerar PDF
          </button>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <SectionCard icon={Users}       label="Usuários"   count={profiles.length}   color="bg-violet-50 text-violet-700 border-violet-200" />
        <SectionCard icon={FileText}    label="Processos"  count={processos.length}  color="bg-blue-50 text-blue-700 border-blue-200" />
        <SectionCard icon={Bell}        label="Intimações" count={intimacoes.length} color="bg-amber-50 text-amber-700 border-amber-200" />
        <SectionCard icon={Briefcase}   label="Clientes"   count={clientes.length}   color="bg-emerald-50 text-emerald-700 border-emerald-200" />
        <SectionCard icon={CheckSquare} label="Tarefas"    count={tarefas.length}    color="bg-rose-50 text-rose-700 border-rose-200" />
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b border-border">
        {(["overview","processos","intimacoes","relatorio"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-all border-b-2 -mb-px ${
              tab === t ? "border-accent text-accent font-bold" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {{ overview:"Por Usuário", processos:"Processos", intimacoes:"Intimações", relatorio:"Relatório" }[t]}
          </button>
        ))}
      </div>

      {/* Barra de busca (abas processos / intimações) */}
      {(tab === "processos" || tab === "intimacoes") && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por número, tribunal, responsável..."
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
            const uid            = profile.user_id;
            const userProcessos  = processos.filter(p => p.user_id === uid);
            const userIntimacoes = intimacoes.filter(i => i.user_id === uid);
            const userClientes   = clientes.filter(c => c.user_id === uid);
            const userTarefas    = tarefas.filter(t => t.user_id === uid);
            const expanded       = expandedUser === uid;

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
                    <span><b>{userIntimacoes.length}</b> intimações</span>
                    <span><b>{userClientes.length}</b> clientes</span>
                    <span><b>{userTarefas.length}</b> tarefas</span>
                  </div>
                  {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                </button>

                {expanded && (
                  <div className="border-t border-border px-4 py-4 space-y-4 bg-muted/20">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Processos</h3>
                      {userProcessos.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum processo.</p> : (
                        <div className="overflow-x-auto rounded-lg border border-border">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="text-left px-3 py-2 font-semibold">Nº CNJ</th>
                                <th className="text-left px-3 py-2 font-semibold">Classe</th>
                                <th className="text-left px-3 py-2 font-semibold">Tribunal</th>
                                <th className="text-left px-3 py-2 font-semibold">Status</th>
                                <th className="text-left px-3 py-2 font-semibold">Intimações</th>
                              </tr>
                            </thead>
                            <tbody>
                              {userProcessos.map(p => (
                                <tr key={p.id} className="border-t border-border/50 hover:bg-accent/5">
                                  <td className="px-3 py-2 font-mono">{p.numero_cnj}</td>
                                  <td className="px-3 py-2">{p.classe || "—"}</td>
                                  <td className="px-3 py-2">{p.tribunal || "—"}</td>
                                  <td className="px-3 py-2">{statusBadge(p.status)}</td>
                                  <td className="px-3 py-2">{intimacoes.filter(i => i.processo_id === p.id).length}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {userIntimacoes.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Últimas Intimações</h3>
                        <div className="space-y-1.5">
                          {userIntimacoes.slice(0, 5).map(i => (
                            <div key={i.id} className="rounded-lg border border-border bg-background px-3 py-2 text-xs flex items-start gap-2">
                              <Bell className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold truncate">{i.numero_processo || "Sem número"} — {i.tipo || "—"}</div>
                                <div className="text-muted-foreground">Publicação: {fmtDate(i.data_publicacao)} · Prazo: {fmtDate(i.prazo)}</div>
                              </div>
                              {statusBadge(i.status)}
                            </div>
                          ))}
                          {userIntimacoes.length > 5 && <p className="text-xs text-muted-foreground pl-1">+ {userIntimacoes.length - 5} mais…</p>}
                        </div>
                      </div>
                    )}
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
                  <th className="text-left px-3 py-2.5 font-semibold">Intim.</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Tarefas</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Cadastrado</th>
                </tr>
              </thead>
              <tbody>
                {filteredProcessos.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum processo encontrado.</td></tr>
                )}
                {filteredProcessos.map(p => (
                  <tr key={p.id} className="border-t border-border/50 hover:bg-accent/5">
                    <td className="px-3 py-2 font-mono">{p.numero_cnj}</td>
                    <td className="px-3 py-2">{p.classe || "—"}</td>
                    <td className="px-3 py-2">{p.tribunal || "—"}</td>
                    <td className="px-3 py-2">{p.comarca || "—"}</td>
                    <td className="px-3 py-2">{statusBadge(p.status)}</td>
                    <td className="px-3 py-2 font-medium">{nomeResponsavel(p.user_id)}</td>
                    <td className="px-3 py-2 text-center">{intimacoes.filter(i => i.processo_id === p.id).length}</td>
                    <td className="px-3 py-2 text-center">{tarefas.filter(t => t.processo_id === p.id).length}</td>
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

      {/* ── ABA: INTIMAÇÕES ── */}
      {tab === "intimacoes" && !loading && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2.5 font-semibold">Nº Processo</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Tipo</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Origem</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Publicação</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Prazo</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Status</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Responsável</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Conteúdo</th>
                </tr>
              </thead>
              <tbody>
                {filteredIntimacoes.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma intimação encontrada.</td></tr>
                )}
                {filteredIntimacoes.map(i => (
                  <tr key={i.id} className="border-t border-border/50 hover:bg-accent/5">
                    <td className="px-3 py-2 font-mono">{i.numero_processo || "—"}</td>
                    <td className="px-3 py-2">{i.tipo || "—"}</td>
                    <td className="px-3 py-2 uppercase">{i.origem}</td>
                    <td className="px-3 py-2">{fmtDate(i.data_publicacao)}</td>
                    <td className="px-3 py-2">{fmtDate(i.prazo)}</td>
                    <td className="px-3 py-2">{statusBadge(i.status)}</td>
                    <td className="px-3 py-2 font-medium">{nomeResponsavel(i.user_id)}</td>
                    <td className="px-3 py-2 max-w-xs truncate text-muted-foreground" title={i.conteudo ?? ""}>
                      {i.conteudo ? i.conteudo.slice(0, 80) + (i.conteudo.length > 80 ? "…" : "") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            {filteredIntimacoes.length} intimação(ões)
          </div>
        </div>
      )}

      {/* ── ABA: RELATÓRIO (prévia do que será impresso) ── */}
      {tab === "relatorio" && !loading && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display font-extrabold text-lg">Relatório Geral — JurisMonitor</h2>
                <p className="text-xs text-muted-foreground">Clique em "Gerar PDF" (botão acima) para abrir o relatório completo formatado para impressão.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: "Usuários",   val: profiles.length },
                { label: "Processos",  val: processos.length },
                { label: "Intimações", val: intimacoes.length },
                { label: "Clientes",   val: clientes.length },
                { label: "Tarefas",    val: tarefas.length },
              ].map(s => (
                <div key={s.label} className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-extrabold font-display">{s.val}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {profiles.map(profile => {
            const uid            = profile.user_id;
            const userProcessos  = processos.filter(p => p.user_id === uid);
            const userIntimacoes = intimacoes.filter(i => i.user_id === uid);

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
                    <div className="text-xs opacity-70">{profile.escritorio || "—"} · OAB: {profile.oab || "—"} · Tel: {profile.telefone || "—"}</div>
                  </div>
                  <div className="hidden sm:flex gap-4 text-xs text-primary-foreground/70 shrink-0">
                    <span><b className="text-primary-foreground">{userProcessos.length}</b> proc.</span>
                    <span><b className="text-primary-foreground">{userIntimacoes.length}</b> intim.</span>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {userProcessos.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" /> Processos e Intimações
                      </h4>
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/40">
                            <tr>
                              <th className="text-left px-3 py-2 font-semibold">Nº CNJ</th>
                              <th className="text-left px-3 py-2 font-semibold">Classe</th>
                              <th className="text-left px-3 py-2 font-semibold">Tribunal</th>
                              <th className="text-left px-3 py-2 font-semibold">Status</th>
                              <th className="text-left px-3 py-2 font-semibold">Últ. Movim.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {userProcessos.map(p => {
                              const pi = intimacoes.filter(i => i.processo_id === p.id);
                              return (
                                <>
                                  <tr key={p.id} className="border-t border-border/50">
                                    <td className="px-3 py-2 font-mono">{p.numero_cnj}</td>
                                    <td className="px-3 py-2">{p.classe || "—"}</td>
                                    <td className="px-3 py-2">{p.tribunal || "—"}</td>
                                    <td className="px-3 py-2">{statusBadge(p.status)}</td>
                                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(p.ultima_movimentacao)}</td>
                                  </tr>
                                  {pi.map(i => (
                                    <tr key={i.id} className="bg-amber-50/60 border-t border-amber-100">
                                      <td colSpan={5} className="px-5 py-1.5">
                                        <div className="flex items-start gap-2 text-[0.7rem]">
                                          <Bell className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                                          <div>
                                            <span className="font-semibold text-amber-700">{i.tipo || "Intimação"}</span>
                                            <span className="mx-1 text-muted-foreground">·</span>
                                            Publicação: {fmtDate(i.data_publicacao)}
                                            <span className="mx-1 text-muted-foreground">·</span>
                                            Prazo: {fmtDate(i.prazo)}
                                            <span className="ml-1">{statusBadge(i.status)}</span>
                                            {i.conteudo && <div className="text-muted-foreground mt-0.5 line-clamp-2">{i.conteudo}</div>}
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {(() => {
                    const soltas = userIntimacoes.filter(i => !i.processo_id);
                    if (!soltas.length) return null;
                    return (
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Intimações sem processo vinculado
                        </h4>
                        {soltas.map(i => (
                          <div key={i.id} className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-xs flex items-start gap-2 mb-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <div className="font-semibold">{i.numero_processo || "Sem número"} — {i.tipo || "—"}</div>
                              <div className="text-muted-foreground">Publicação: {fmtDate(i.data_publicacao)} · Prazo: {fmtDate(i.prazo)}</div>
                              {i.conteudo && <div className="mt-0.5 text-muted-foreground line-clamp-2">{i.conteudo}</div>}
                            </div>
                            {statusBadge(i.status)}
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {userProcessos.length === 0 && userIntimacoes.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Sem processos ou intimações cadastrados.</p>
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
