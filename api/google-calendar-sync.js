import { createClient } from '@supabase/supabase-js';
import { requireSameOrigin } from './_security.js';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

function getSupabaseAuth(req) {
  const authHeader = req.headers?.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!token) return { token: null, supabase: null };
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  return { token, supabase };
}

/** Garante um access_token válido, renovando via refresh_token se necessário. */
async function getValidAccessToken(supabase, userId) {
  const { data: config, error } = await supabase
    .from('google_calendar_tokens')
    .select('access_token, refresh_token, expires_at, calendar_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !config) return null;

  const expiraEm = new Date(config.expires_at).getTime();
  const jaExpirou = expiraEm - Date.now() < 60_000; // margem de 1 min

  if (!jaExpirou) {
    return { accessToken: config.access_token, calendarId: config.calendar_id || 'primary' };
  }

  // Renova o access_token usando o refresh_token
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: (process.env.GOOGLE_CLIENT_ID || '').trim(),
      client_secret: (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
      refresh_token: config.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const data = await resp.json();
  if (!resp.ok || !data.access_token) {
    console.error('[google-calendar-sync] Falha ao renovar token:', data);
    return null;
  }

  const novaExpiracao = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
  await supabase
    .from('google_calendar_tokens')
    .update({ access_token: data.access_token, expires_at: novaExpiracao, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  return { accessToken: data.access_token, calendarId: config.calendar_id || 'primary' };
}

function tarefaParaEventoGoogle(tarefa) {
  const desc = [
    tarefa.descricao || '',
    tarefa.numero_processo ? `Processo: ${tarefa.numero_processo}` : '',
    '\n(Sincronizado automaticamente pelo JurisMonitor)',
  ].filter(Boolean).join('\n');

  const base = {
    summary: tarefa.titulo,
    description: desc,
    extendedProperties: { private: { jurismonitor_tarefa_id: tarefa.id } },
  };

  if (!tarefa.data_vencimento) return { ...base, start: undefined, end: undefined };

  const dataVenc = tarefa.data_vencimento.slice(0, 10); // "YYYY-MM-DD"

  // Tem horário definido? Cria um evento COM horário específico.
  if (tarefa.hora_vencimento) {
    const dateTimeInicio = `${dataVenc}T${tarefa.hora_vencimento}:00`;
    // Duração padrão de 30 min pro compromisso não ficar "zerado" na agenda
    const [h, m] = tarefa.hora_vencimento.split(':').map(Number);
    const fimData = new Date(`${dataVenc}T00:00:00`);
    fimData.setHours(h, (m || 0) + 30);
    const dateTimeFim = `${dataVenc}T${String(fimData.getHours()).padStart(2, '0')}:${String(fimData.getMinutes()).padStart(2, '0')}:00`;

    return {
      ...base,
      start: { dateTime: dateTimeInicio, timeZone: 'America/Sao_Paulo' },
      end: { dateTime: dateTimeFim, timeZone: 'America/Sao_Paulo' },
    };
  }

  // Sem horário: evento de dia inteiro. A API do Google trata o "end.date"
  // como EXCLUSIVO — por isso precisa ser o dia SEGUINTE, senão alguns
  // calendários renderizam o evento incorretamente "vazando" pro dia anterior.
  const inicio = new Date(`${dataVenc}T00:00:00`);
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 1);
  const paraISODate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return {
    ...base,
    start: { date: paraISODate(inicio) },
    end: { date: paraISODate(fim) },
  };
}

export default async function handler(req, res) {
  if (!requireSameOrigin(req, res, { methods: 'POST, OPTIONS', headers: 'Content-Type, Accept, Authorization' })) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { supabase } = getSupabaseAuth(req);
  if (!supabase) return res.status(401).json({ error: 'Não autenticado' });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return res.status(401).json({ error: 'Sessão inválida' });

  const auth = await getValidAccessToken(supabase, user.id);
  if (!auth) return res.status(400).json({ error: 'Google Agenda não conectada. Conecte em Configurações > Google Agenda.' });

  const { action } = req.body || {};

  try {
    // ── PUSH: cria ou atualiza um evento a partir de uma tarefa ──
    if (action === 'push') {
      const { tarefa } = req.body;
      if (!tarefa?.titulo) return res.status(400).json({ error: 'Tarefa inválida' });

      // Sem data de vencimento não faz sentido criar evento de calendário
      if (!tarefa.data_vencimento) {
        return res.status(200).json({ skipped: true, reason: 'Tarefa sem data de vencimento' });
      }

      const evento = tarefaParaEventoGoogle(tarefa);
      const url = tarefa.google_event_id
        ? `${CALENDAR_API}/calendars/${encodeURIComponent(auth.calendarId)}/events/${tarefa.google_event_id}`
        : `${CALENDAR_API}/calendars/${encodeURIComponent(auth.calendarId)}/events`;

      const resp = await fetch(url, {
        method: tarefa.google_event_id ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${auth.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(evento),
      });
      const data = await resp.json();

      // Evento pode ter sido apagado manualmente no Google — recria do zero
      if (!resp.ok && (resp.status === 404 || resp.status === 410) && tarefa.google_event_id) {
        const respNovo = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(auth.calendarId)}/events`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${auth.accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(evento),
        });
        const dataNovo = await respNovo.json();
        if (!respNovo.ok) return res.status(500).json({ error: dataNovo.error?.message || 'Erro ao recriar evento' });
        return res.status(200).json({ success: true, google_event_id: dataNovo.id });
      }

      if (!resp.ok) return res.status(500).json({ error: data.error?.message || 'Erro ao sincronizar com o Google' });
      return res.status(200).json({ success: true, google_event_id: data.id });
    }

    // ── DELETE: remove o evento correspondente ──
    if (action === 'delete') {
      const { google_event_id } = req.body;
      if (!google_event_id) return res.status(200).json({ success: true });

      const resp = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(auth.calendarId)}/events/${google_event_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      // 404/410 = já não existe mais lá, tudo bem
      if (!resp.ok && resp.status !== 404 && resp.status !== 410) {
        const data = await resp.json().catch(() => ({}));
        return res.status(500).json({ error: data.error?.message || 'Erro ao remover evento' });
      }
      return res.status(200).json({ success: true });
    }

    // ── PULL: busca mudanças feitas direto no Google Agenda ──
    if (action === 'pull') {
      const { data: tokenRow } = await supabase
        .from('google_calendar_tokens')
        .select('last_sync_at')
        .eq('user_id', user.id)
        .maybeSingle();

      const params = new URLSearchParams({
        singleEvents: 'true',
        showDeleted: 'true',
        maxResults: '250',
      });
      if (tokenRow?.last_sync_at) {
        params.set('updatedMin', tokenRow.last_sync_at);
      } else {
        // Primeira sincronização: só últimos 30 dias pra trás, pra não trazer o histórico todo
        const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        params.set('updatedMin', trintaDiasAtras);
      }

      const resp = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(auth.calendarId)}/events?${params}`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const data = await resp.json();
      if (!resp.ok) return res.status(500).json({ error: data.error?.message || 'Erro ao buscar eventos do Google' });

      await supabase
        .from('google_calendar_tokens')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('user_id', user.id);

      const eventos = (data.items || []).map(ev => {
        // Se o evento tem horário (dateTime), extrai no fuso de São Paulo pra
        // não voltar com horas erradas quando importado de volta pra tarefa.
        let hora = null;
        if (ev.start?.dateTime) {
          try {
            hora = new Date(ev.start.dateTime).toLocaleTimeString('pt-BR', {
              hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo',
            });
          } catch (_) { /* mantém null se der erro de parse */ }
        }
        return {
          google_event_id: ev.id,
          status: ev.status, // 'cancelled' quando apagado no Google
          titulo: ev.summary || '(sem título)',
          descricao: ev.description || null,
          data: ev.start?.date || ev.start?.dateTime?.slice(0, 10) || null,
          hora,
          tarefa_id_vinculada: ev.extendedProperties?.private?.jurismonitor_tarefa_id || null,
        };
      });

      return res.status(200).json({ success: true, eventos });
    }

    return res.status(400).json({ error: 'Ação inválida' });
  } catch (err) {
    console.error('[google-calendar-sync] Erro:', err);
    return res.status(500).json({ error: err.message });
  }
}
