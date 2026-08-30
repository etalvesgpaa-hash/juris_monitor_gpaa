import { createClient } from '@supabase/supabase-js';

// Google redireciona o NAVEGADOR do usuário pra cá (GET), não é uma chamada
// fetch da nossa SPA — por isso não temos o header Authorization normal.
// Usamos o parâmetro "state" (o access_token da sessão Supabase, colocado lá
// no momento em que o botão "Conectar com Google" foi clicado) para saber
// quem é o usuário e gravar o token na linha certa.

function paginaDeRetorno(origin, status, mensagem) {
  const url = `${origin}/?google_calendar=${status}${mensagem ? `&msg=${encodeURIComponent(mensagem)}` : ''}`;
  return url;
}

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  // Importante: usa o host real da requisição, não a variável APP_ORIGIN.
  // O Google exige que o redirect_uri usado aqui seja IDÊNTICO ao usado na
  // tela de autorização (que o frontend monta com window.location.origin) —
  // se APP_ORIGIN estiver desatualizada/errada, a troca do code por token falha.
  const appOrigin = `https://${req.headers.host}`;

  const { code, state, error: googleError } = req.query || {};

  if (googleError) {
    res.writeHead(302, { Location: paginaDeRetorno(appOrigin, 'erro', 'Autorização cancelada ou negada.') });
    return res.end();
  }
  if (!code || !state) {
    res.writeHead(302, { Location: paginaDeRetorno(appOrigin, 'erro', 'Parâmetros ausentes no retorno do Google.') });
    return res.end();
  }

  try {
    // 1) Descobre quem é o usuário a partir do token (state)
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: userErr } = await supabase.auth.getUser(state);
    if (userErr || !user) {
      res.writeHead(302, { Location: paginaDeRetorno(appOrigin, 'erro', 'Sessão expirada. Faça login novamente e tente conectar.') });
      return res.end();
    }

    // 2) Troca o "code" pelos tokens de acesso/refresh do Google
    const redirectUri = `${appOrigin}/api/google-calendar-callback`;
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenResp.json();
    if (!tokenResp.ok || !tokenData.access_token) {
      console.error('[google-calendar-callback] Erro ao trocar code por token:', tokenData);
      res.writeHead(302, { Location: paginaDeRetorno(appOrigin, 'erro', 'Falha ao conectar com o Google.') });
      return res.end();
    }

    // 3) Busca o e-mail da conta Google conectada (só pra exibir na tela)
    let googleEmail = null;
    try {
      const infoResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const info = await infoResp.json();
      googleEmail = info.email || null;
    } catch (_) { /* não é crítico */ }

    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

    // 4) Grava/atualiza a linha do usuário (upsert por user_id, que é UNIQUE)
    //    Se não veio refresh_token (Google só manda no primeiro consentimento),
    //    mantém o que já existia.
    const { data: existente } = await supabase
      .from('google_calendar_tokens')
      .select('refresh_token')
      .eq('user_id', user.id)
      .maybeSingle();

    const refreshToken = tokenData.refresh_token || existente?.refresh_token;
    if (!refreshToken) {
      res.writeHead(302, { Location: paginaDeRetorno(appOrigin, 'erro', 'O Google não retornou permissão de acesso contínuo. Remova o acesso do JurisMonitor em myaccount.google.com/permissions e tente conectar de novo.') });
      return res.end();
    }

    const supabaseComAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${state}` } },
    });
    const { error: upsertErr } = await supabaseComAuth
      .from('google_calendar_tokens')
      .upsert({
        user_id: user.id,
        access_token: tokenData.access_token,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        google_email: googleEmail,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (upsertErr) {
      console.error('[google-calendar-callback] Erro ao salvar tokens:', upsertErr);
      res.writeHead(302, { Location: paginaDeRetorno(appOrigin, 'erro', 'Erro ao salvar a conexão.') });
      return res.end();
    }

    res.writeHead(302, { Location: paginaDeRetorno(appOrigin, 'conectado') });
    return res.end();
  } catch (err) {
    console.error('[google-calendar-callback] Erro inesperado:', err);
    res.writeHead(302, { Location: paginaDeRetorno(appOrigin, 'erro', 'Erro inesperado ao conectar.') });
    return res.end();
  }
}
