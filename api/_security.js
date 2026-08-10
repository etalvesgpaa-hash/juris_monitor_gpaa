const DEFAULT_ALLOWED_HEADERS = "Content-Type, Accept, Authorization, X-Admin-Secret";

function normalizeOrigin(value) {
  if (!value) return "";
  try {
    return new URL(value.startsWith("http") ? value : `https://${value}`).origin;
  } catch (_) {
    return "";
  }
}

export function getAllowedOrigins(req) {
  const origins = new Set();
  for (const raw of [process.env.APP_ORIGIN, process.env.PORTAL_URL, process.env.VERCEL_URL, req?.headers?.host]) {
    const origin = normalizeOrigin(raw);
    if (origin) origins.add(origin);
  }
  return origins;
}

export function getRequestOrigin(req) {
  return normalizeOrigin(req.headers?.origin || req.headers?.referer);
}

export function isAllowedOrigin(req) {
  const origin = getRequestOrigin(req);
  if (!origin) return false;
  return getAllowedOrigins(req).has(origin);
}

export function setCorsHeaders(req, res, options = {}) {
  const allowedOrigin = isAllowedOrigin(req) ? getRequestOrigin(req) : "";
  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", options.methods || "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", options.headers || DEFAULT_ALLOWED_HEADERS);
}

export function requireSameOrigin(req, res, options = {}) {
  setCorsHeaders(req, res, options);
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return false;
  }
  if (!isAllowedOrigin(req)) {
    res.status(403).json({ error: "Origem nao autorizada." });
    return false;
  }
  return true;
}

export function hasValidAdminSecret(req) {
  const configuredSecret = (process.env.ADMIN_API_SECRET || "").trim();
  if (!configuredSecret) return false;
  const providedSecret = String(req.headers?.["x-admin-secret"] || req.headers?.["x-api-key"] || req.query?.admin_secret || "").trim();
  return providedSecret === configuredSecret;
}

export function requireAdminSecret(req, res, options = {}) {
  setCorsHeaders(req, res, options);
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return false;
  }
  if (!hasValidAdminSecret(req)) {
    res.status(403).json({ error: "Acesso administrativo nao autorizado." });
    return false;
  }
  return true;
}

export function debugEndpointsEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_DEBUG_ENDPOINTS === "true";
}

export function requireDebugAccess(req, res, options = {}) {
  setCorsHeaders(req, res, options);
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return false;
  }
  if (!debugEndpointsEnabled() && !hasValidAdminSecret(req)) {
    res.status(404).json({ error: "Endpoint indisponivel em producao." });
    return false;
  }
  if (!isAllowedOrigin(req) && !hasValidAdminSecret(req)) {
    res.status(403).json({ error: "Origem nao autorizada." });
    return false;
  }
  return true;
}

export function isValidEmail(value) {
  return typeof value === "string" && /^\S+@\S+\.\S+$/.test(value);
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
