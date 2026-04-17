module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { to_name, to_email, titulo, resumo, portal_url } = req.body;
  if (!to_email || !titulo) return res.status(400).json({ error: 'to_email e titulo obrigatórios' });

  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      }
    });

    await transporter.sendMail({
      from: `"JurisMonitor — Edson Teodoro" <${process.env.EMAIL_USER}>`,
      to: to_email,
      subject: titulo,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8f9fa;padding:24px;border-radius:12px">
          <div style="background:#0d2a1e;border-radius:10px;padding:20px 24px;margin-bottom:20px">
            <div style="color:#c9a84c;font-size:1.1rem;font-weight:700">⚖️ JurisMonitor</div>
            <div style="color:rgba(255,255,255,0.7);font-size:0.78rem;margin-top:2px">Portal do Cliente — Edson Teodoro Advocacia</div>
          </div>
          <div style="background:#fff;border-radius:10px;padding:24px;margin-bottom:16px;border:1px solid #e2e8f0">
            <div style="font-size:0.72rem;color:#8c8070;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:8px">Notificação Processual</div>
            <div style="font-size:1rem;font-weight:700;color:#0d2a1e;margin-bottom:16px">${titulo}</div>
            ${resumo ? `<div style="background:#faf7f2;border-left:4px solid #c9a84c;padding:14px 16px;border-radius:0 8px 8px 0;color:#0d2a1e;font-size:0.88rem;line-height:1.7;white-space:pre-wrap">${resumo}</div>` : ''}
          </div>
          ${portal_url ? `<div style="text-align:center;margin:20px 0"><a href="${portal_url}" style="background:#c9a84c;color:#0d2a1e;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:0.9rem;display:inline-block">Acessar Portal do Cliente →</a></div>` : ''}
          <div style="text-align:center;font-size:0.72rem;color:#8c8070;margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0">
            Edson Teodoro Advocacia<br>
            Esta é uma notificação automática do JurisMonitor.
          </div>
        </div>`
    });
    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('send-email error:', e);
    return res.status(500).json({ error: e.message });
  }
};
