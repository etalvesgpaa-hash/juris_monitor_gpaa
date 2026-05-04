import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },

    proxy: {
      // Em dev: /api/proxy → Vercel Function local simulada
      // Repassa GET e POST preservando body e headers (Authorization)
      "/api/proxy": {
        target: "https://intimacaoapi.aasp.org.br",
        changeOrigin: true,
        secure: true,
        // Reescrita: extrai a URL do parâmetro ?url= e redireciona para o host alvo
        // Suporta múltiplos hosts — usamos configure para lógica custom
        bypass(req, _res, _options) {
          // Para DataJud: o target muda dinamicamente — usamos um bypass custom
          // que delega para o nosso mini-proxy Node.js inline
          return null; // null = deixa o proxy padrão agir (será reescrito abaixo)
        },
        configure(proxy, _options) {
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            // Extrai URL do parâmetro ?url=
            const rawUrl = req.url || "";
            const match  = rawUrl.match(/[?&]url=([^&]+)/);
            if (!match) return;

            let decoded = match[1];
            try { decoded = decodeURIComponent(decoded); } catch (_) {}

            // Extrai hostname e path da URL destino
            const hostMatch = decoded.match(/^https?:\/\/([^/?#]+)(.*)/);
            if (!hostMatch) return;

            const targetHost = hostMatch[1];
            const targetPath = hostMatch[2] || "/";

            // Reescreve o host e path
            proxyReq.setHeader("host", targetHost);
            proxyReq.path = targetPath;

            // Mantém Authorization se presente
            const auth = req.headers["authorization"];
            if (auth) proxyReq.setHeader("authorization", auth);

            // Content-Type para POST
            if (req.method === "POST") {
              proxyReq.setHeader("content-type", "application/json");
            }
          });

          proxy.on("error", (err, _req, res: any) => {
            console.error("[vite-proxy] erro:", err.message);
            res.writeHead(502, { "Content-Type": "application/json" });
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
