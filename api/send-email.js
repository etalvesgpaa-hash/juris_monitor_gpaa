import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Diagnóstico: verifica variáveis de ambiente
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('[send-email] EMAIL_USER ou EMAIL_PASS não configurados no Vercel');
    return res.status(500).json({
      error: 'Configuração de e-mail ausente. Configure EMAIL_USER e EMAIL_PASS nas variáveis de ambiente do Vercel.',
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
    return res.status(400).json({ error: 'Dados obrigatórios faltando (destinatario e numeroProcesso)' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS.replace(/\s/g, ''), // remove espaços acidentais
      },
    });

    await transporter.verify();

    let emailBody;

    if (isIntimacao) {
      emailBody = `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8f9fa;padding:24px;border-radius:12px">
          <div style="background:#0d2a1e;border-radius:10px;padding:20px 24px;margin-bottom:20px">
            <div style="color:#c9a84c;font-size:1.1rem;font-weight:700">⚖️ JurisMonitor</div>
            <div style="color:rgba(255,255,255,0.7);font-size:0.78rem;margin-top:2px">Notificação Automática de Intimação</div>
          </div>
          <div style="background:#fff;border-radius:10px;padding:24px;margin-bottom:16px;border:1px solid #e2e8f0">
            <div style="font-size:0.72rem;color:#8c8070;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:8px">
              Olá ${nomeCliente || 'Cliente'},
            </div>
            <div style="color:#0d2a1e;font-size:0.9rem;margin-bottom:20px">
              Foi detectada uma nova publicação no Diário Oficial relacionada ao seu processo:
            </div>
            <div style="background:#faf7f2;border:2px solid #c9a84c;padding:16px;border-radius:8px;margin-bottom:16px">
              <div style="font-size:0.7rem;color:#8c8070;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:4px">Número do Processo</div>
              <div style="font-family:monospace;font-size:0.95rem;font-weight:700;color:#0d2a1e;margin-bottom:12px">${numeroProcesso}</div>
              <div style="font-size:0.7rem;color:#8c8070;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:4px">Data da Publicação</div>
              <div style="font-size:0.85rem;color:#0d2a1e;margin-bottom:12px">📅 ${dataPublicacao || 'Não informada'}</div>
              <div style="font-size:0.7rem;color:#8c8070;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:4px">Assunto</div>
              <div style="font-size:0.85rem;color:#0d2a1e">${assunto || 'Publicação AASP'}</div>
            </div>
            ${resumoIA ? `
              <div style="background:#e6f4ea;border-left:4px solid #34a853;padding:16px;border-radius:0 8px 8px 0;margin-bottom:16px">
                <div style="font-size:0.7rem;color:#1e7e34;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;margin-bottom:8px">✨ Análise Automática (IA)</div>
                <div style="color:#0d2a1e;font-size:0.88rem;line-height:1.7;white-space:pre-wrap">${resumoIA}</div>
              </div>` : ''}
            ${textoCompleto ? `
              <details style="margin-top:16px">
                <summary style="cursor:pointer;color:#c9a84c;font-weight:600;font-size:0.85rem">📄 Ver texto completo da publicação</summary>
                <div style="background:#f8f9fa;border:1px solid #e2e8f0;padding:14px;border-radius:8px;margin-top:8px;font-size:0.8rem;color:#4a5568;line-height:1.6">${textoCompleto}</div>
              </details>` : ''}
          </div>
          <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:14px;margin-bottom:16px">
            <div style="color:#856404;font-size:0.85rem;line-height:1.6">
              <strong>⚠️ Atenção:</strong> Esta é uma notificação automática. Recomendamos que você entre em contato com nosso escritório para verificar prazos e orientações específicas.
            </div>
          </div>
          <div style="text-align:center;font-size:0.72rem;color:#8c8070;margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0">
            Edson Teodoro Advocacia<br>Esta é uma notificação automática do sistema JurisMonitor.
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
          ${portal_url ? `<div style="text-align:center;margin:20px 0"><a href="${portal_url}" style="background:#c9a84c;color:#0d2a1e;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:0.9rem;display:inline-block">Acessar Portal do Cliente →</a></div>` : ''}
          <div style="text-align:center;font-size:0.72rem;color:#8c8070;margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0">
            Edson Teodoro Advocacia<br>Esta é uma notificação automática do JurisMonitor.
          </div>
        </div>`;
    }

    await transporter.sendMail({
      from: `"JurisMonitor — Edson Teodoro" <${process.env.EMAIL_USER}>`,
      to: emailDestino,
      subject: emailTitulo,
      html: emailBody,
    });

    console.log(`[send-email] ✅ Enviado para ${emailDestino}`);
    return res.status(200).json({ success: true });

  } catch (e) {
    console.error('[send-email] ❌', e.code, e.message);
    return res.status(500).json({
      error: e.message,
      code: e.code || null,
      dica: e.code === 'EAUTH'
        ? 'Autenticação Gmail falhou. Verifique se EMAIL_PASS é uma "Senha de app" de 16 dígitos gerada em myaccount.google.com → Segurança → Senhas de app.'
        : e.code === 'ECONNECTION'
        ? 'Falha de conexão SMTP. Verifique EMAIL_USER e EMAIL_PASS no Vercel.'
        : 'Verifique os logs em Vercel → Functions → send-email.',
    });
  }
}
