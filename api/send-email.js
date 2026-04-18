import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ══════════════════════════════════════════════════════════════════════════
  // 1) LEITURA DAS VARIÁVEIS DE AMBIENTE
  // ══════════════════════════════════════════════════════════════════════════
  const useGmail = process.env.USE_GMAIL === 'true';
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
  const resendKey = process.env.RESEND_API_KEY;

  // DEBUG - Logs para verificar se variáveis estão chegando (remover após resolver)
  console.log('📧 [send-email] Verificação de variáveis:', {
    USE_GMAIL: process.env.USE_GMAIL,
    GMAIL_USER_exists: !!gmailUser,
    GMAIL_APP_PASSWORD_exists: !!gmailAppPassword,
    GMAIL_APP_PASSWORD_length: gmailAppPassword ? gmailAppPassword.length : 0,
    RESEND_API_KEY_exists: !!resendKey,
    useGmail_computed: useGmail
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 2) VALIDAÇÃO DA CONFIGURAÇÃO
  // ══════════════════════════════════════════════════════════════════════════
  if (useGmail) {
    // Validações específicas do Gmail
    if (!gmailUser) {
      return res.status(500).json({
        error: 'GMAIL_USER não configurado',
        debug: {
          USE_GMAIL: process.env.USE_GMAIL,
          GMAIL_USER: 'não encontrado'
        },
        dica: 'Configure GMAIL_USER nas Environment Variables do Vercel com seu e-mail Gmail completo.'
      });
    }

    if (!gmailAppPassword) {
      return res.status(500).json({
        error: 'GMAIL_APP_PASSWORD não configurado',
        debug: {
          USE_GMAIL: process.env.USE_GMAIL,
          GMAIL_USER: gmailUser,
          GMAIL_APP_PASSWORD: 'não encontrado'
        },
        dica: 'Configure GMAIL_APP_PASSWORD nas Environment Variables do Vercel. Gere uma senha de app em: https://myaccount.google.com/apppasswords'
      });
    }

    // Validação do formato da senha de app
    if (gmailAppPassword.length !== 16) {
      return res.status(500).json({
        error: 'GMAIL_APP_PASSWORD com formato inválido',
        debug: {
          length_atual: gmailAppPassword.length,
          length_esperado: 16
        },
        dica: 'A senha de app do Gmail deve ter exatamente 16 caracteres sem espaços. Gere uma nova em: https://myaccount.google.com/apppasswords'
      });
    }

  } else if (!resendKey) {
    return res.status(500).json({
      error: 'Nenhum serviço de e-mail configurado',
      debug: {
        USE_GMAIL: process.env.USE_GMAIL || 'não definido',
        RESEND_API_KEY: 'não encontrado'
      },
      dica: 'Configure USE_GMAIL=true com GMAIL_USER e GMAIL_APP_PASSWORD, ou configure RESEND_API_KEY.'
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3) EXTRAÇÃO DOS DADOS DO CORPO DA REQUISIÇÃO
  // ══════════════════════════════════════════════════════════════════════════
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

  // Validação dos dados obrigatórios
  if (!emailDestino || !emailTitulo) {
    return res.status(400).json({ 
      error: 'Dados obrigatórios faltando',
      campos_faltantes: {
        emailDestino: !emailDestino,
        emailTitulo: !emailTitulo
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4) MONTAGEM DO CORPO DO E-MAIL
  // ══════════════════════════════════════════════════════════════════════════
  let emailBody;

  if (isIntimacao) {
    // Template para intimações
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
    // Template padrão
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

  // ══════════════════════════════════════════════════════════════════════════
  // 5) ENVIO DO E-MAIL
  // ══════════════════════════════════════════════════════════════════════════
  try {
    if (useGmail) {
      // ────────────────────────────────────────────────────────────────────────
      // GMAIL - usando Nodemailer
      // ────────────────────────────────────────────────────────────────────────
      console.log('📧 [send-email] Enviando via Gmail para:', emailDestino);
      
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
      
      console.log('✅ [send-email] Enviado via Gmail | ID:', info.messageId);
      return res.status(200).json({ 
        success: true, 
        id: info.messageId, 
        provider: 'gmail',
        to: emailDestino
      });

    } else {
      // ────────────────────────────────────────────────────────────────────────
      // RESEND - fallback
      // ────────────────────────────────────────────────────────────────────────
      console.log('📧 [send-email] Enviando via Resend para:', emailDestino);
      
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
        console.error('❌ [send-email] Resend erro:', data);
        return res.status(500).json({
          error: data.message || 'Erro ao enviar pelo Resend',
          details: data,
          dica: 'Verifique se a RESEND_API_KEY está correta no Vercel.',
        });
      }

      console.log('✅ [send-email] Enviado via Resend | ID:', data.id);
      return res.status(200).json({ 
        success: true, 
        id: data.id, 
        provider: 'resend',
        to: emailDestino
      });
    }

  } catch (e) {
    console.error('❌ [send-email] Exceção:', e.message);
    console.error('Stack:', e.stack);
    
    // Mensagem de erro específica baseada no tipo de erro
    let errorResponse = {
      error: e.message,
      stack: e.stack,
      timestamp: new Date().toISOString()
    };

    if (useGmail) {
      // Erros específicos do Gmail
      if (e.message.includes('Invalid login')) {
        errorResponse.dica = 'Senha de App do Gmail inválida. Verifique:\n1. Autenticação em 2 fatores está ativada?\n2. Senha tem 16 caracteres?\n3. Gere nova senha em: https://myaccount.google.com/apppasswords';
      } else if (e.message.includes('Missing credentials')) {
        errorResponse.dica = 'Credenciais do Gmail não foram fornecidas corretamente. Verifique as variáveis de ambiente GMAIL_USER e GMAIL_APP_PASSWORD.';
      } else {
        errorResponse.dica = 'Erro ao enviar via Gmail. Verifique:\n1. Senha de App correta\n2. Autenticação em 2 fatores ativa\n3. Variáveis de ambiente corretas no Vercel';
      }
    }
    
    return res.status(500).json(errorResponse);
  }
}
