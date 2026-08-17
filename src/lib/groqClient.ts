/**
 * groqClient
 *
 * Ponto ÚNICO de chamada à API da Groq em todo o sistema.
 * Antes, o nome do modelo estava copiado em 4 arquivos diferentes — quando a
 * Groq descontinuou o "llama-3.3-70b-versatile" (17/06/2026), foi preciso
 * caçar e trocar em cada um deles manualmente.
 *
 * A partir de agora:
 *  1. Só existe UM lugar com o nome do modelo (aqui embaixo, em MODEL_FALLBACK_CHAIN).
 *  2. Se o modelo escolhido for descontinuado (erro 404 / "model_decommissioned"),
 *     o sistema tenta automaticamente o próximo da lista, sem quebrar para o usuário.
 *  3. O modelo pode ser sobrescrito sem precisar mexer em código: basta salvar
 *     um valor em localStorage("jurismonitor_groq_model") — o campo "Modelo de IA"
 *     em Configurações faz isso automaticamente.
 *
 * Se a Groq depreciar o modelo padrão de novo no futuro, é só atualizar a
 * primeira posição de MODEL_FALLBACK_CHAIN abaixo (ou, melhor ainda, trocar
 * pelo campo "Modelo de IA" na tela de Configurações, sem precisar de deploy).
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL_STORAGE_KEY = "jurismonitor_groq_model";

/**
 * Ordem de tentativa dos modelos. O primeiro é o "preferido"; os seguintes
 * só são usados automaticamente se o anterior estiver indisponível/descontinuado.
 * Baseado na recomendação oficial da Groq para quem usava llama-3.3-70b-versatile
 * (ver https://console.groq.com/docs/deprecations).
 */
export const MODEL_FALLBACK_CHAIN = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.6-27b",
];

export function getGroqModelPreferido(): string {
  const custom = typeof localStorage !== "undefined" ? localStorage.getItem(MODEL_STORAGE_KEY) : null;
  return custom?.trim() || MODEL_FALLBACK_CHAIN[0];
}

export function setGroqModelPreferido(model: string) {
  if (!model?.trim()) {
    localStorage.removeItem(MODEL_STORAGE_KEY);
  } else {
    localStorage.setItem(MODEL_STORAGE_KEY, model.trim());
  }
}

function isModelIndisponivel(status: number, errBody: any): boolean {
  if (status === 404) return true;
  const code = errBody?.error?.code || errBody?.error?.type || "";
  const msg = (errBody?.error?.message || "").toLowerCase();
  return code === "model_decommissioned" || code === "model_not_found" || msg.includes("decommission") || msg.includes("does not exist");
}

async function chamarModelo(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userContent: string,
  opts: { temperature?: number; maxTokens?: number },
  tentativaRateLimit = 1
): Promise<string> {
  const resp = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 300,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });

  // Rate limit — aguarda e tenta novamente (até 3x) no MESMO modelo
  if (resp.status === 429 && tentativaRateLimit <= 3) {
    const wait = tentativaRateLimit * 8000; // 8s, 16s, 24s
    await new Promise((r) => setTimeout(r, wait));
    return chamarModelo(apiKey, model, systemPrompt, userContent, opts, tentativaRateLimit + 1);
  }

  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    const error: any = new Error(`Erro na API Groq: ${errBody?.error?.message || `HTTP ${resp.status}`}`);
    error.status = resp.status;
    error.body = errBody;
    throw error;
  }

  const data = await resp.json();
  const texto = data.choices?.[0]?.message?.content?.trim() || "";
  if (!texto) throw new Error("Resposta vazia da IA");
  return texto;
}

/**
 * Chama a Groq com resumo automático de IA, tentando o modelo preferido e,
 * se ele estiver indisponível/descontinuado, caindo para os próximos da lista.
 * Use esta função em vez de chamar fetch() direto para a API da Groq.
 */
export async function chamarGroq(
  apiKey: string,
  systemPrompt: string,
  userContent: string,
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const preferido = getGroqModelPreferido();
  const ordem = [preferido, ...MODEL_FALLBACK_CHAIN.filter((m) => m !== preferido)];

  let ultimoErro: any = null;
  for (const model of ordem) {
    try {
      const texto = await chamarModelo(apiKey, model, systemPrompt, userContent, opts);
      // Se o fallback funcionou com um modelo diferente do preferido, avisa no console
      // para o usuário perceber e atualizar o campo "Modelo de IA" em Configurações.
      if (model !== preferido) {
        console.warn(
          `[GroqIA] Modelo "${preferido}" indisponível. Usado fallback "${model}" com sucesso. ` +
          `Considere atualizar o campo "Modelo de IA" em Configurações para não depender do fallback.`
        );
      }
      return texto;
    } catch (err: any) {
      ultimoErro = err;
      if (isModelIndisponivel(err.status, err.body)) {
        continue; // tenta o próximo modelo da lista
      }
      throw err; // erro que não é de modelo indisponível (ex: chave inválida) — não adianta trocar de modelo
    }
  }
  throw ultimoErro || new Error("Nenhum modelo Groq disponível no momento.");
}
