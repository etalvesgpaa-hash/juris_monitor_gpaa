// ESM — compatível com "type": "module" no package.json
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Lê e limpa variáveis de ambiente
  const rawUseGmail     = (process.env.USE_GMAIL          || '').replace(/[`'"\s]/g, '');
  const rawGmailUser    = (process.env.GMAIL_USER         || '').replace(/[`'"\s]/g, '');
  const rawGmailPass    = (process.env.GMAIL_APP_PASSWORD || '').replace(/[`'"\s]/g, '');
  const rawResendKey    = (process.env.RESEND_API_KEY     || '').replace(/[`'"\s]/g, '');

  const useGmail        = rawUseGmail.toLowerCase() === 'true' || rawUseGmail === '1';

  // Log de diagnóstico (sem expor valores sensíveis)
  console.log('[send-email] USE_GMAIL raw:', JSON.stringify(rawUseGmail), '-> useGmail:', useGmail);
  console.log('[send-email] GMAIL_USER:', rawGmailUser ? `"${rawGmailUser}"` : 'AUSENTE');
  console.log('[send-email] GMAIL_APP_PASSWORD length:', rawGmailPass.length);
  console.log('[send-email] RESEND_API_KEY:', rawResendKey ? 'OK' : 'AUSENTE');

  // Valida configuração
  if (useGmail && (!rawGmailUser || !rawGmailPass)) {
    return res.status(500).json({
      error: 'Configuração do Gmail incompleta',
      debug: { gmailUser: !!rawGmailUser, gmailPassLen: rawGmailPass.length },
    });
  }
  if (!useGmail && !rawResendKey) {
    return res.status(500).json({
      error: 'Nenhum serviço de e-mail configurado',
      debug: { USE_GMAIL: rawUseGmail, useGmail },
    });
  }

  const {
    to_email, titulo, resumo, portal_url,
    destinatario, nomeCliente, numeroProcesso,
    dataPublicacao, assunto, resumoIA, textoCompleto,
    nomeAdvogado,
  } = req.body;

  const isIntimacao  = !!(destinatario && numeroProcesso);
  const emailDestino = destinatario || to_email;
  const emailTitulo  = isIntimacao ? `Nova Intimação - Processo ${numeroProcesso}` : titulo;

  if (!emailDestino || !emailTitulo) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes: destinatario/to_email e titulo' });
  }

  // ── HTML do e-mail ────────────────────────────────────────────────────────
  const emailBody = isIntimacao ? `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8f9fa;padding:24px;border-radius:12px">
      <div style="background:#0d2a1e;border-radius:10px;padding:20px 24px;margin-bottom:20px">
        <div style="color:#c9a84c;font-size:1.1rem;font-weight:700">⚖️ JurisMonitor</div>
        <div style="color:rgba(255,255,255,0.7);font-size:0.78rem;margin-top:2px">Notificação Automática de Intimação</div>
      </div>
      <div style="background:#fff;border-radius:10px;padding:24px;margin-bottom:16px;border:1px solid #e2e8f0">
        <div style="font-size:0.9rem;color:#0d2a1e;margin-bottom:20px">
          Olá <strong>${nomeCliente || 'Cliente'}</strong>,<br><br>
          Foi detectada uma nova publicação no Diário Oficial relacionada ao seu processo:
        </div>
        <div style="background:#faf7f2;border:2px solid #c9a84c;padding:16px;border-radius:8px;margin-bottom:16px">
          <div style="font-size:0.7rem;color:#8c8070;text-transform:uppercase;font-weight:600;margin-bottom:4px">Número do Processo</div>
          <div style="font-family:monospace;font-size:0.95rem;font-weight:700;color:#0d2a1e;margin-bottom:12px">${numeroProcesso}</div>
          <div style="font-size:0.7rem;color:#8c8070;text-transform:uppercase;font-weight:600;margin-bottom:4px">Data da Publicação</div>
          <div style="font-size:0.85rem;color:#0d2a1e;margin-bottom:12px">📅 ${dataPublicacao || 'Não informada'}</div>
          <div style="font-size:0.7rem;color:#8c8070;text-transform:uppercase;font-weight:600;margin-bottom:4px">Assunto</div>
          <div style="font-size:0.85rem;color:#0d2a1e">${assunto || 'Publicação AASP'}</div>
        </div>
        ${resumoIA ? `
          <div style="background:#e6f4ea;border-left:4px solid #34a853;padding:16px;border-radius:0 8px 8px 0;margin-bottom:16px">
            <div style="font-size:0.7rem;color:#1e7e34;text-transform:uppercase;font-weight:700;margin-bottom:8px">✨ Análise Automática (IA)</div>
            <div style="color:#0d2a1e;font-size:0.88rem;line-height:1.7;white-space:pre-wrap">${resumoIA}</div>
          </div>` : ''}
        ${textoCompleto ? `
          <div style="background:#f8f9fa;border:1px solid #e2e8f0;padding:14px;border-radius:8px;font-size:0.8rem;color:#4a5568;line-height:1.6">
            <strong>Texto da publicação:</strong><br>${textoCompleto}
          </div>` : ''}
      </div>
      <div style="background:#eaf4ff;border:1px solid #b8d9f5;border-radius:8px;padding:14px;margin-bottom:16px">
        <div style="color:#1a4a7a;font-size:0.85rem;line-height:1.6">
          📋 O Dr. ${nomeAdvogado || 'seu advogado'} estará avaliando a publicação que foi enviada e, caso haja necessidade, entrará em contato.
        </div>
      </div>
      <div style="text-align:center;font-size:0.72rem;color:#8c8070;margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0">
        Edson Teodoro Advocacia — JurisMonitor
      </div>
    </div>` : `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8f9fa;padding:24px;border-radius:12px">
      <div style="background:#0d2a1e;border-radius:10px;padding:20px 24px;margin-bottom:20px">
        <div style="color:#c9a84c;font-size:1.1rem;font-weight:700">⚖️ JurisMonitor</div>
        <div style="color:rgba(255,255,255,0.7);font-size:0.78rem;margin-top:2px">Portal do Cliente — Edson Teodoro Advocacia</div>
      </div>
      <div style="background:#fff;border-radius:10px;padding:24px;margin-bottom:16px;border:1px solid #e2e8f0">
        <div style="font-size:0.72rem;color:#8c8070;text-transform:uppercase;font-weight:600;margin-bottom:8px">Notificação Processual</div>
        <div style="font-size:1rem;font-weight:700;color:#0d2a1e;margin-bottom:16px">${emailTitulo}</div>
        ${resumo ? `<div style="background:#faf7f2;border-left:4px solid #c9a84c;padding:14px 16px;border-radius:0 8px 8px 0;color:#0d2a1e;font-size:0.88rem;line-height:1.7;white-space:pre-wrap">${resumo}</div>` : ''}
      </div>
      ${portal_url ? `<div style="text-align:center;margin:20px 0"><a href="${portal_url}" style="background:#c9a84c;color:#0d2a1e;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:0.9rem;display:inline-block">Acessar Portal →</a></div>` : ''}
      <div style="text-align:center;font-size:0.72rem;color:#8c8070;margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0">
        Edson Teodoro Advocacia — JurisMonitor
      </div>
    </div>`;

  // ── Envio ────────────────────────────────────────────────────────────────
  try {
    if (useGmail) {
      console.log('[send-email] Enviando via Gmail para:', emailDestino);

      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: rawGmailUser,
          pass: rawGmailPass,
        },
      });

      const info = await transporter.sendMail({
        from: `"JurisMonitor" <${rawGmailUser}>`,
        to: emailDestino,
        subject: emailTitulo,
        html: emailBody,
      });

      console.log('[send-email] ✅ Gmail OK, messageId:', info.messageId);
      return res.status(200).json({ success: true, id: info.messageId, provider: 'gmail' });

    } else {
      console.log('[send-email] Enviando via Resend para:', emailDestino);

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
        return res.status(500).json({ error: data.message || 'Erro Resend', dica: 'Verifique RESEND_API_KEY no Vercel.' });
      }

      console.log('[send-email] ✅ Resend OK, id:', data.id);
      return res.status(200).json({ success: true, id: data.id, provider: 'resend' });
    }

  } catch (err) {
    console.error('[send-email] ❌ EXCEÇÃO:', err.message);
    console.error('[send-email] Stack:', err.stack);
    return res.status(500).json({
      error: err.message,
      dica: useGmail
        ? 'Erro SMTP Gmail. Confirme: 1) Verificação em 2 etapas ativada na conta Google, 2) Senha de App gerada em myaccount.google.com/apppasswords (não é sua senha normal), 3) A senha no Vercel não tem espaços ou aspas.'
        : 'Verifique a RESEND_API_KEY no Vercel.',
    });
  }
}
