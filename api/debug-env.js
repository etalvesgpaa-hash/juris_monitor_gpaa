export default function handler(req, res) {
  res.status(200).json({
    USE_GMAIL: process.env.USE_GMAIL ?? 'UNDEFINED',
    GMAIL_USER: process.env.GMAIL_USER ?? 'UNDEFINED',
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD ? `OK (${process.env.GMAIL_APP_PASSWORD.length} chars)` : 'UNDEFINED',
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  });
}
