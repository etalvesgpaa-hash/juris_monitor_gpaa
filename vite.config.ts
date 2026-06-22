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
      // Em dev: /api/proxy → mini-proxy que repassa para o host real extraído do ?url=
      // Funciona para DataJud, AASP e qualquer outro host permitido
      "/api/proxy": {
        target: "https://api-publica.datajud.cnj.jus.br",
        changeOrigin: true,
        secure: false, // aceita qualquer cert upstream em dev
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

            // Reescreve o host e path para o destino real
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

          proxy.on("proxyRes", (proxyRes, _req, res: any) => {
            // Expõe X-Upstream-Status para que o frontend leia corretamente
            res.setHeader?.("Access-Control-Expose-Headers", "X-Upstream-Status, X-Proxy-Url");
            res.setHeader?.("X-Upstream-Status", String(proxyRes.statusCode));
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
