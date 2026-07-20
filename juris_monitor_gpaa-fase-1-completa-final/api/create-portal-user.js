// api/create-portal-user.js
// Cria usuário no Supabase Auth usando SERVICE_ROLE_KEY (servidor apenas)
// e insere na tabela clientes_portal com o processo vinculado.

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  // Apenas POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { nome, email, senha, processo_cnj } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ error: "nome, email e senha são obrigatórios" });
  }

  // Cliente admin com SERVICE_ROLE_KEY (nunca exposta no frontend)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. Criar usuário no Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    });

    if (authError) {
      // Erro comum: usuário já existe
      if (authError.message.includes("already been registered")) {
        return res.status(409).json({ error: "Este e-mail já possui uma conta no portal." });
      }
      return res.status(400).json({ error: authError.message });
    }

    // 2. Inserir na clientes_portal
    const { error: dbError } = await supabaseAdmin
      .from("clientes_portal")
      .upsert(
        { nome, email, processo_cnj: processo_cnj || null, ativo: true },
        { onConflict: "email" }
      );

    if (dbError) {
      return res.status(400).json({ error: dbError.message });
    }

    return res.status(200).json({
      success: true,
      user_id: authData.user?.id,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Erro interno" });
  }
}
