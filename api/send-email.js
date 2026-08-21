import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import { escapeHtml, isValidEmail, requireSameOrigin } from './_security.js';

const clean = (v) => (v || '').replace(/[`'"\s]/g, '');

// Cliente Supabase autenticado com o token do próprio usuário que fez a
// requisição. A consulta respeita RLS (auth.uid() = user_id), então cada
// usuário só consegue ler a própria configuração de e-mail — sem precisar
// de nenhuma service_role key na Vercel.
async function getUserEmailConfig(req) {
  const authHeader = req.headers?.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return { user: null, config: null };

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return { user: null, config: null };

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return { user: null, config: null };

  const { data: config } = await supabase
    .from('api_keys')
    .select('email_provider, email_gmail_user, email_gmail_app_password, email_resend_api_key, email_remetente_nome, email_portal_url')
    .eq('user_id', user.id)
    .maybeSingle();

  return { user, config };
}

export default async function handler(req, res) {
  if (!requireSameOrigin(req, res, { methods: 'POST, OPTIONS', headers: 'Content-Type, Accept, Authorization' })) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 1) Tenta usar a configuração de e-mail salva pelo próprio usuário
  //    (Configurações > E-mail). 2) Se não houver, cai para as variáveis
  //    de ambiente da Vercel, mantendo compatibilidade com quem já usa assim.
  const { config } = await getUserEmailConfig(req);

  const provider = config?.email_provider || (((process.env.USE_GMAIL || '').toLowerCase() === 'true' || process.env.USE_GMAIL === '1') ? 'gmail' : 'resend');
  const useGmail = provider === 'gmail';

  const rawGmailUser = clean(config?.email_gmail_user) || clean(process.env.GMAIL_USER);
  const rawGmailPass = clean(config?.email_gmail_app_password) || clean(process.env.GMAIL_APP_PASSWORD);
  const rawResendKey = clean(config?.email_resend_api_key) || clean(process.env.RESEND_API_KEY);
  const remetenteNome = config?.email_remetente_nome || 'JurisMonitor';
  const portalUrlPadrao = config?.email_portal_url || '';

  console.log('[send-email] provider:', provider, config ? '(config do usuario)' : '(fallback env Vercel)');

  if (useGmail && (!rawGmailUser || !rawGmailPass)) {
    return res.status(500).json({ error: 'Configuracao do Gmail incompleta. Configure em Configurações > E-mail.' });
  }
  if (!useGmail && !rawResendKey) {
    return res.status(500).json({ error: 'Nenhum servico de e-mail configurado. Configure em Configurações > E-mail.' });
  }

  const {
    to_email,
    titulo,
    resumo,
    destinatario,
    nomeCliente,
    numeroProcesso,
    dataPublicacao,
    assunto,
    resumoIA,
    textoCompleto,
    nomeAdvogado,
  } = req.body || {};
  const portal_url = req.body?.portal_url || portalUrlPadrao;

  const isIntimacao = Boolean(destinatario && numeroProcesso);
  const emailDestino = destinatario || to_email;
  const emailTitulo = isIntimacao ? `Nova Intimacao - Processo ${numeroProcesso}` : titulo;

  if (!emailDestino || !emailTitulo) {
    return res.status(400).json({ error: 'Campos obrigatorios ausentes: destinatario/to_email e titulo' });
  }
  if (!isValidEmail(emailDestino)) {
    return res.status(400).json({ error: 'E-mail de destino invalido' });
  }

  const safe = {
    titulo: escapeHtml(emailTitulo),
    resumo: escapeHtml(resumo),
    portal_url: escapeHtml(portal_url),
    nomeCliente: escapeHtml(nomeCliente || 'Cliente'),
    numeroProcesso: escapeHtml(numeroProcesso),
    dataPublicacao: escapeHtml(dataPublicacao || 'Nao informada'),
    assunto: escapeHtml(assunto || 'Publicacao AASP'),
    resumoIA: escapeHtml(resumoIA),
    textoCompleto: escapeHtml(textoCompleto),
    nomeAdvogado: escapeHtml(nomeAdvogado || 'seu advogado'),
  };

  const emailBody = isIntimacao ? `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8f9fa;padding:24px;border-radius:12px">
      <div style="background:#0d2a1e;border-radius:10px;padding:20px 24px;margin-bottom:20px">
        <div style="color:#c9a84c;font-size:1.1rem;font-weight:700">JurisMonitor</div>
        <div style="color:rgba(255,255,255,0.7);font-size:0.78rem;margin-top:2px">Notificacao automatica de intimacao</div>
      </div>
      <div style="background:#fff;border-radius:10px;padding:24px;margin-bottom:16px;border:1px solid #e2e8f0">
        <div style="font-size:0.9rem;color:#0d2a1e;margin-bottom:20px">
          Ola <strong>${safe.nomeCliente}</strong>,<br><br>
          Foi detectada uma nova publicacao no Diario Oficial relacionada ao seu processo:
        </div>
        <div style="background:#faf7f2;border:2px solid #c9a84c;padding:16px;border-radius:8px;margin-bottom:16px">
          <div style="font-size:0.7rem;color:#8c8070;text-transform:uppercase;font-weight:600;margin-bottom:4px">Numero do Processo</div>
          <div style="font-family:monospace;font-size:0.95rem;font-weight:700;color:#0d2a1e;margin-bottom:12px">${safe.numeroProcesso}</div>
          <div style="font-size:0.7rem;color:#8c8070;text-transform:uppercase;font-weight:600;margin-bottom:4px">Data da Publicacao</div>
          <div style="font-size:0.85rem;color:#0d2a1e;margin-bottom:12px">${safe.dataPublicacao}</div>
          <div style="font-size:0.7rem;color:#8c8070;text-transform:uppercase;font-weight:600;margin-bottom:4px">Assunto</div>
          <div style="font-size:0.85rem;color:#0d2a1e">${safe.assunto}</div>
        </div>
        ${resumoIA ? `
          <div style="background:#e6f4ea;border-left:4px solid #34a853;padding:16px;border-radius:0 8px 8px 0;margin-bottom:16px">
            <div style="font-size:0.7rem;color:#1e7e34;text-transform:uppercase;font-weight:700;margin-bottom:8px">Analise automatica por IA</div>
            <div style="color:#0d2a1e;font-size:0.88rem;line-height:1.7;white-space:pre-wrap">${safe.resumoIA}</div>
          </div>` : ''}
        ${textoCompleto ? `
          <div style="background:#f8f9fa;border:1px solid #e2e8f0;padding:14px;border-radius:8px;font-size:0.8rem;color:#4a5568;line-height:1.6">
            <strong>Texto da publicacao:</strong><br>${safe.textoCompleto}
          </div>` : ''}
      </div>
      <div style="background:#eaf4ff;border:1px solid #b8d9f5;border-radius:8px;padding:14px;margin-bottom:16px">
        <div style="color:#1a4a7a;font-size:0.85rem;line-height:1.6">
          O Dr. ${safe.nomeAdvogado} avaliara a publicacao enviada e, caso haja necessidade, entrara em contato.
        </div>
      </div>
      <div style="text-align:center;font-size:0.72rem;color:#8c8070;margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0">
        Edson Teodoro Advocacia - JurisMonitor
      </div>
    </div>` : `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8f9fa;padding:24px;border-radius:12px">
      <div style="background:#0d2a1e;border-radius:10px;padding:20px 24px;margin-bottom:20px">
        <div style="color:#c9a84c;font-size:1.1rem;font-weight:700">JurisMonitor</div>
        <div style="color:rgba(255,255,255,0.7);font-size:0.78rem;margin-top:2px">Portal do Cliente - Edson Teodoro Advocacia</div>
      </div>
      <div style="background:#fff;border-radius:10px;padding:24px;margin-bottom:16px;border:1px solid #e2e8f0">
        <div style="font-size:0.72rem;color:#8c8070;text-transform:uppercase;font-weight:600;margin-bottom:8px">Notificacao Processual</div>
        <div style="font-size:1rem;font-weight:700;color:#0d2a1e;margin-bottom:16px">${safe.titulo}</div>
        ${resumo ? `<div style="background:#faf7f2;border-left:4px solid #c9a84c;padding:14px 16px;border-radius:0 8px 8px 0;color:#0d2a1e;font-size:0.88rem;line-height:1.7;white-space:pre-wrap">${safe.resumo}</div>` : ''}
      </div>
      ${portal_url ? `<div style="text-align:center;margin:20px 0"><a href="${safe.portal_url}" style="background:#c9a84c;color:#0d2a1e;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:0.9rem;display:inline-block">Acessar Portal</a></div>` : ''}
      <div style="text-align:center;font-size:0.72rem;color:#8c8070;margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0">
        Edson Teodoro Advocacia - JurisMonitor
      </div>
    </div>`;

  try {
    if (useGmail) {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: rawGmailUser, pass: rawGmailPass },
      });

      const info = await transporter.sendMail({
        from: `"${remetenteNome}" <${rawGmailUser}>`,
        to: emailDestino,
        subject: emailTitulo,
        html: emailBody,
      });

      console.log('[send-email] Gmail OK, messageId:', info.messageId);
      return res.status(200).json({ success: true, id: info.messageId, provider: 'gmail' });
    }

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${rawResendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'JurisMonitor <onboarding@resend.dev>',
        to: [emailDestino],
        subject: emailTitulo,
        html: emailBody,
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error('[send-email] Resend erro:', data);
      return res.status(500).json({ error: data.message || 'Erro Resend', dica: 'Verifique a Resend API Key em Configurações > E-mail.' });
    }

    console.log('[send-email] Resend OK, id:', data.id);
    return res.status(200).json({ success: true, id: data.id, provider: 'resend' });
  } catch (err) {
    console.error('[send-email] EXCECAO:', err.message);
    return res.status(500).json({
      error: err.message,
      dica: useGmail
        ? 'Erro SMTP Gmail. Confirme verificacao em 2 etapas e a senha de app em Configurações > E-mail.'
        : 'Verifique a Resend API Key em Configurações > E-mail.',
    });
  }
}