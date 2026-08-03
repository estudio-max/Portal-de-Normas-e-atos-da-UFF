// Configuração de origem dos dados.
//
// Em produção a API fica no mesmo domínio, em /api. Para desenvolvimento/teste
// pode-se apontar para o mock via ?api=http://127.0.0.1:8900 na URL.
//
// Se a API não responder, o app cai automaticamente para o modo ESTÁTICO
// (lê o portal-data.json do GitHub) — então nada quebra durante a transição.

const params = new URLSearchParams(location.search);

export const API_BASE: string =
  params.get('api') ||
  (window as any).__API_BASE__ ||
  '/api';

// Origem do JSON no modo estático (fallback)
export const JSON_FALLBACK: string =
  'https://raw.githubusercontent.com/estudio-max/' +
  'Portal-de-Normas-e-atos-da-UFF/main/public/portal-data.json';

// Primeiro ano da SÉRIE ANUAL. Antes de 2001 o acervo só tem backlog legítimo
// (o boletim de 2001, digitalizado, publica atos de 1998-2000 de verdade) e
// resíduo de OCR — nenhum dos dois pertence ao gráfico do Dashboard.
//
// O FIM da série não é constante nenhuma: é o ano corrente, decidido na camada
// de dados (`/api/stats` no banco, `getStats()` no modo estático). O limite
// superior já esteve fixado em 2026 em quatro lugares que precisavam concordar;
// em 01/01/2027 o gráfico pararia de crescer enquanto o total continuava
// subindo — o KPI e o gráfico passariam a discordar sem avisar.
export const ANO_INICIO_ACERVO = 2001;
