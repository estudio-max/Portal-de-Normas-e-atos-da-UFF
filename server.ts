// Servidor de DESENVOLVIMENTO, e só isso (`npm run dev` → tsx server.ts):
// sobe o Vite em middleware mode na porta 3000. Não existe em produção —
// lá o frontend é estático (dist/ na raiz do site) e a API é PHP
// (backend/api/index_v2.php publicado como api/index.php).
//
// Já foi um servidor "full-stack" do AI Studio, com uma rota Gemini
// (/api/parse-act) que NADA no frontend chamava — o ActParser analisa
// localmente, sem chave de API. A rota, o @google/genai, o dotenv e o
// caminho Cloud Run (Dockerfile/serve.cjs) foram removidos em 20/07/2026
// para o repositório parar de fingir que tem um runtime Node de produção.
import express from "express";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Em produção /api/* é PHP; no dev NÃO EXISTE — e precisa dizer isso com
  // 404. Sem esta rota, o fallback SPA do Vite responde /api/stats com 200 +
  // index.html, o tentaApi() do front acredita que a API está no ar e o
  // portal trava em "Carregando…" para sempre (achado real, 20/07/2026 —
  // era o motivo de o dev só funcionar com ?api=… na URL). Com o 404, o
  // front cai limpo para o modo estático, com o banner de contingência.
  // Para testar o modo banco no dev: ?api=http://127.0.0.1:8900 (mock_api.py).
  app.use("/api", (_req, res) => {
    res.status(404).json({ erro: "sem API no dev — use ?api=http://127.0.0.1:8900 (tools/mock_api.py)" });
  });

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Dev server (Vite middleware) em http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Falha ao iniciar o dev server:", err);
});
