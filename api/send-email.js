import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Limpeza de variáveis - remove acentos graves, aspas e espaços
  const cleanEnv = (value) => {
    if (!value) return value;
    return String(value).replace(/[`'"]/g, '').trim();
  };

  // Configuração: prioriza Gmail, fallback para Resend
  const useGmailRaw = cleanEnv(process.env.USE_GMAIL);
  const useGmail = useGmailRaw === 'true' || useGmailRaw === '1' || useGmailRaw === 'TRUE';
  const gmailUser = cleanEnv(process.env.GMAIL_USER);
  const gmailAppPassword = cleanEnv(process.env.GMAIL_APP_PASSWORD);
  const resendKey = cleanEnv(process.env.RESEND_API_KEY);

  console.log('[send-email] 🔍 Configuração:');
  console.log('  USE_GMAIL:', useGmailRaw, '→ interpretado como:', useGmail);
  console.log('  GMAIL_USER:', gmailUser ? 'OK' : 'AUSENTE');
  console.log('  GMAIL_APP_PASSWORD:', gmailAppPassword ? 'OK (len:' + gmailAppPassword.length + ')' : 'AUSENTE');
  console.log('  RESEND_API_KEY:', resendKey ? 'OK' : 'AUSENTE');

  // Valida configuração
  if (useGmail) {
    if (!gmailUser || !gmailAppPassword) {
      console.log('[send-email] ❌ Gmail configurado mas faltam credenciais');
      return res.status(500).json({
        error: 'Configuração do Gmail incompleta',
        dica: 'Configure GMAIL_USER e GMAIL_APP_PASSWORD nas variáveis de ambiente. Gere uma senha de app em: https://myaccount.google.com/apppasswords',
        debug: {
          gmailUser: !!gmailUser,
          gmailAppPassword: !!gmailAppPassword,
          passwordLength: gmailAppPassword?.length || 0
        }
      });
    }
  } else if (!resendKey) {
    console.log('[send-email] ❌ Nenhum serviço configurado');
    return res.status(500).json({
      error: 'Nenhum serviço de e-mail configurado',
      dica: 'Configure USE_GMAIL=true com GMAIL_USER e GMAIL_APP_PASSWORD, ou configure RESEND_API_KEY.',
      debug: {
        USE_GMAIL_raw: process.env.USE_GMAIL,
        useGmail_calculated: useGmail
      }
    });
  }

  const {
    to_email,
    titulo,
    resumo,
    portal_url,
    destinatario,
    nomeCliente,
    numeroProcesso,
    dataPublicacao,
    assunto,
    resumoIA,
    textoCompleto,
  } = req.body;

  const isIntimacao = destinatario && numeroProcesso;
  const emailDestino = destinatario || to_email;
  const emailTitulo = isIntimacao
    ? `Nova Intimação - Processo ${numeroProcesso}`
    : titulo;

  if (!emailDestino || !emailTitulo) {
    return res.status(400).json({ error: 'Dados obrigatórios faltando (to_email/destinatario e titulo)' });
  }

  // Monta o corpo do email
  let emailBody;

  if (isIntimacao) {
    emailBody = `
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
            <div style="background:#f8f9fa;border:1px solid #e2e8f0;padding:14px;border-radius:8px;margin-top:8px;font-size:0.8rem;color:#4a5568;line-height:1.6">
              <strong>Texto da publicação:</strong><br>${textoCompleto}
            </div>` : ''}
        </div>
        <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:14px;margin-bottom:16px">
          <div style="color:#856404;font-size:0.85rem;line-height:1.6">
            <strong>⚠️ Atenção:</strong> Entre em contato com o escritório para verificar prazos e orientações específicas sobre esta publicação.
          </div>
        </div>
        <div style="text-align:center;font-size:0.72rem;color:#8c8070;margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0">
          Edson Teodoro Advocacia — JurisMonitor
        </div>
      </div>`;
  } else {
    emailBody = `
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
  }

  try {
    if (useGmail) {
      // ════════════════════════════════════════════════════════════════════════
      // GMAIL - usando Nodemailer
      // ════════════════════════════════════════════════════════════════════════
      console.log('[send-email] 📧 Enviando via Gmail...');
      console.log('[send-email] De:', gmailUser);
      console.log('[send-email] Para:', emailDestino);
      
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailAppPassword,
        },
      });

      const mailOptions = {
        from: `"JurisMonitor" <${gmailUser}>`,
        to: emailDestino,
        subject: emailTitulo,
        html: emailBody,
      };

      const info = await transporter.sendMail(mailOptions);
      
      console.log('[send-email] ✅ Enviado via Gmail para', emailDestino, '| id:', info.messageId);
      return res.status(200).json({ 
        success: true, 
        id: info.messageId, 
        provider: 'gmail' 
      });

    } else {
      // ════════════════════════════════════════════════════════════════════════
      // RESEND - fallback
      // ════════════════════════════════════════════════════════════════════════
      console.log('[send-email] 📧 Enviando via Resend...');
      
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'JurisMonitor <onboarding@resend.dev>',
          to: [emailDestino],
          subject: emailTitulo,
          html: emailBody,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[send-email] Resend erro:', data);
        return res.status(500).json({
          error: data.message || 'Erro ao enviar pelo Resend',
          dica: 'Verifique se a RESEND_API_KEY está correta no Vercel.',
        });
      }

      console.log('[send-email] ✅ Enviado via Resend para', emailDestino, '| id:', data.id);
      return res.status(200).json({ 
        success: true, 
        id: data.id, 
        provider: 'resend' 
      });
    }

  } catch (e) {
    console.error('[send-email] ❌ Exceção:', e.message);
    console.error('[send-email] Stack:', e.stack);
    
    // Mensagem de erro mais específica para Gmail
    if (useGmail) {
      return res.status(500).json({ 
        error: e.message,
        dica: 'Verifique se a Senha de App do Gmail está correta e se a autenticação em 2 fatores está ativada. Gere uma nova senha em: https://myaccount.google.com/apppasswords',
        details: e.stack
      });
    }
    
    return res.status(500).json({ error: e.message });
  }
}
