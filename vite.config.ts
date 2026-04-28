import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },

    // ── Proxy de desenvolvimento ──────────────────────────────────────────────
    // Em produção (Vercel), /api/proxy é a Serverless Function api/proxy.js.
    // Em dev local, usamos o proxy do Vite para rotear /api/proxy → AASP direto,
    // sem passar por proxies públicos que bloqueiam CORS.
    proxy: {
      "/api/proxy": {
        target: "https://intimacaoapi.aasp.org.br",
        changeOrigin: true,
        secure: true,
        rewrite: (reqPath) => {
          // reqPath = /api/proxy?url=https%3A%2F%2Fintimacaoapi...%3Fchave%3DXXX%26data%3D28%2F04%2F2026
          // Queremos extrair tudo após "intimacaoapi.aasp.org.br" preservando %2F intacto
          const urlMatch = reqPath.match(/[?&]url=(.+)$/);
          if (!urlMatch) return "/";

          let raw = urlMatch[1];
          // Decodifica UMA vez (encodeURIComponent aplicado pelo frontend)
          try { raw = decodeURIComponent(raw); } catch (_) {}

          // Extrai pathname + query sem usar new URL() (evita normalizar %2F→/)
          const pathMatch = raw.match(/^https?:\/\/[^/]+(\/[^?#]*)?(\?[^#]*)?(#.*)?$/);
          if (!pathMatch) return "/";

          const pathname = pathMatch[1] || "/";
          const search   = pathMatch[2] || "";
          return pathname + search;
        },
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("Accept", "application/json");
            proxyReq.setHeader("User-Agent", "JurisMonitor/1.0");
          });
          proxy.on("error", (err, _req, res: any) => {
            console.error("[vite-proxy] Erro:", err.message);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Proxy dev error", detail: err.message }));
          });
        },
      },
    },
  },

  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),

  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    dedupe: [
      "react", "react-dom",
      "react/jsx-runtime", "react/jsx-dev-runtime",
      "@tanstack/react-query", "@tanstack/query-core",
    ],
  },
}));
