import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Parse UFF legislation texts using Gemini AI
  app.post("/api/parse-act", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "O texto do ato é obrigatório e deve ser uma string." });
      }

      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        return res.status(500).json({ 
          error: "A chave GEMINI_API_KEY não está configurada neste ambiente. Por favor, adicione-a no painel de Segredos (Secrets) do AI Studio." 
        });
      }

      const ai = new GoogleGenAI({
        apiKey: geminiApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const systemInstruction = `Você é um analista especialista em legislação universitária e indexação de documentos jurídicos/administrativos da Universidade Federal Fluminense (UFF).
Sua tarefa é analisar o texto bruto de um Ato Administrativo ou Norma publicado no Boletim de Serviço da UFF e extrair metadados estruturados de alta precisão jurídica em formato JSON.

Siga rigorosamente as diretrizes abaixo para extração:
1. "tipoAto": Identifique se o ato é uma "Portaria", "Resolução", "Instrução de Serviço", "Decisão" ou "Outro".
2. "numero": Extraia apenas o número do ato. Exemplo: "68.324" ou "12/2026" ou "05".
3. "ano": Extraia o ano de emissão do ato (ex: 2026).
4. "dataAssinatura": Identifique a data em que o ato foi assinado e formate-a como "YYYY-MM-DD" (ex: "2026-04-12").
5. "orgaoEmissor": Extraia a sigla ou nome do órgão emissor. Exemplos típicos da UFF: "Reitoria", "PROGEPE", "PROGRAD", "CUV" (Conselho Universitário), "CEPEx" (Conselho de Ensino, Pesquisa e Extensão), "GAR" (Gabinete do Reitor), "SCA" (Superintendência de Comunicação Acadêmica).
6. "ementa": Extraia a ementa original ou resuma sucintamente o objetivo formal do ato (ex: "Nomeia comissão de licitação", "Aprova o regulamento de estágio do curso de Engenharia").
7. "processoSei": Extraia o número do Processo SEI associado, que na UFF costuma ter o formato "23069.XXXXXX/AAAA-YY" ou similar. Se não houver processo SEI mencionado, retorne null.
8. "relacoes": Analise o texto em busca de menções a outros atos administrativos ou normas que são alterados, revogados, complementados ou regulamentados por este ato.
   Para cada relação encontrada, adicione um objeto com:
   - "tipoRelacao": Escolha estritamente entre "Altera", "Revoga", "Complementa", "Regulamenta".
   - "atoDestino": Nome legível do ato referenciado (ex: "Portaria nº 64.912/2023", "Resolução CEPEx nº 88/2018").
   - "detalhes": O que exatamente muda (ex: "Revoga o artigo 3º", "Altera a composição dos membros").
9. "tags": Forneça um array com 3 a 5 palavras-chave ou categorias temáticas (ex: ["Gestão de Pessoas", "Estágio", "Comissão", "Orçamento", "Acadêmico"]).
10. "conteudoResumido": Escreva uma explicação simplificada, didática e de fácil leitura sobre o impacto prático do ato (ex: "Este ato substitui a comissão anterior de compras por novos representantes para o ano letivo de 2026").

Trabalhe de forma extremamente profissional. Se o texto estiver confuso ou incompleto, faça a melhor inferência jurídica possível baseando-se nos padrões de redação de atos oficiais brasileiros.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: text,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tipoAto: { 
                type: Type.STRING, 
                description: "Tipo de ato administrativo (Portaria, Resolução, Instrução de Serviço, Decisão, Outro)" 
              },
              numero: { 
                type: Type.STRING, 
                description: "Número identificador do ato" 
              },
              ano: { 
                type: Type.INTEGER, 
                description: "Ano do ato" 
              },
              dataAssinatura: { 
                type: Type.STRING, 
                description: "Data da assinatura no formato YYYY-MM-DD" 
              },
              orgaoEmissor: { 
                type: Type.STRING, 
                description: "Órgão, conselho ou pró-reitoria responsável pela emissão" 
              },
              ementa: { 
                type: Type.STRING, 
                description: "Ementa formal ou resumo oficial" 
              },
              processoSei: { 
                type: Type.STRING, 
                description: "Número do processo SEI extraído, ou null se não houver" 
              },
              relacoes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    tipoRelacao: { 
                      type: Type.STRING, 
                      description: "Tipo de relação (Altera, Revoga, Complementa, Regulamenta)" 
                    },
                    atoDestino: { 
                      type: Type.STRING, 
                      description: "Identificador completo da norma de destino (ex: Portaria nº X/2025)" 
                    },
                    detalhes: { 
                      type: Type.STRING, 
                      description: "Informações adicionais da alteração ou revogação" 
                    }
                  },
                  required: ["tipoRelacao", "atoDestino"]
                },
                description: "Vínculos com atos anteriores mencionados"
              },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Palavras-chave extraídas"
              },
              conteudoResumido: { 
                type: Type.STRING, 
                description: "Explicação em linguagem natural e direta do impacto deste ato" 
              }
            },
            required: [
              "tipoAto", "numero", "ano", "dataAssinatura", "orgaoEmissor", 
              "ementa", "relacoes", "tags", "conteudoResumido"
            ]
          }
        }
      });

      const textOutput = response.text;
      if (!textOutput) {
        return res.status(500).json({ error: "O modelo de IA retornou uma resposta vazia." });
      }

      const parsedJson = JSON.parse(textOutput.trim());
      res.json(parsedJson);

    } catch (error: any) {
      console.error("Erro na rota de análise de atos:", error);
      res.status(500).json({ 
        error: "Ocorreu um erro ao processar o ato com IA.", 
        details: error.message || error 
      });
    }
  });

  // Serve static files and handle Vite Dev Server middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware loaded.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving production build from dist/ directory.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Falha ao iniciar o servidor express full-stack:", err);
});
