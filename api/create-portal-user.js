// api/create-portal-user.js
// Cria usuario no Supabase Auth usando SERVICE_ROLE_KEY no servidor.
// Endpoint administrativo: exige ADMIN_API_SECRET.

import { createClient } from "@supabase/supabase-js";
import { isValidEmail, requireAdminSecret } from "./_security.js";

export default async function handler(req, res) {
  if (!requireAdminSecret(req, res, { methods: "POST, OPTIONS" })) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { nome, email, senha, processo_cnj } = req.body || {};

  if (!nome || !email || !senha) {
    return res.status(400).json({ error: "nome, email e senha sao obrigatorios" });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "E-mail invalido" });
  }
  if (String(senha).length < 8) {
    return res.status(400).json({ error: "A senha precisa ter pelo menos 8 caracteres" });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE_KEY nao configurada" });
  }

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes("already been registered")) {
        return res.status(409).json({ error: "Este e-mail ja possui uma conta no portal." });
      }
      return res.status(400).json({ error: authError.message });
    }

    const { error: dbError } = await supabaseAdmin
      .from("clientes_portal")
      .upsert(
        { nome, email, processo_cnj: processo_cnj || null, ativo: true },
        { onConflict: "email" }
      );

    if (dbError) {
      return res.status(400).json({ error: dbError.message });
    }

    return res.status(200).json({ success: true, user_id: authData.user?.id });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Erro interno" });
  }
}