// Configuração de origem dos dados.
//
// Em produção a API fica no mesmo domínio, em /api. Para desenvolvimento/teste
// pode-se apontar para o mock via ?api=http://127.0.0.1:8900 na URL.
//
// Se a API não responder, o app cai automaticamente para o modo ESTÁTICO
// (lê o portal-data.json do GitHub) — então nada quebra durante a transição.

const params = new URLSearchParams(location.search);

// ⚠️ `?api=` SÓ VALE EM DESENVOLVIMENTO, e a restrição é de segurança, não de
// arrumação. Enquanto ele aceitava qualquer valor, bastava um link
//
//     https://<portal>/?api=https://atacante.example
//
// para que o portal inteiro passasse a ler daquela origem — exibindo atos
// forjados com a identidade visual da UFF. Pior: a aba Meu SIAPE ENVIA a
// matrícula e o nome digitados para `API_BASE`, então o mesmo link vazaria o
// dado pessoal de quem clicasse. Não é hipótese remota: é a aba de maior uso, e
// o público dela é o servidor procurando o próprio registro.
//
// A regra: o override só é aceito quando a PÁGINA está em localhost E o ALVO é
// localhost. Isso preserva `?api=http://127.0.0.1:8900` (mock do dev) e mata o
// vetor em produção, onde a API é sempre a do próprio domínio.
const LOCAIS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function apiDaUrl(): string | null {
  const bruto = params.get('api');
  if (!bruto) return null;
  if (!LOCAIS.has(location.hostname)) {
    console.warn('[config] ?api= ignorado: o override de origem só vale em localhost.');
    return null;
  }
  let u: URL;
  try {
    u = new URL(bruto, location.origin);
  } catch {
    console.warn('[config] ?api= ignorado: valor não é uma URL válida.');
    return null;
  }
  if (!LOCAIS.has(u.hostname)) {
    console.warn('[config] ?api= ignorado: só é permitido apontar para localhost.');
    return null;
  }
  // devolve sem barra final para não gerar `//` ao concatenar as rotas
  return (u.origin + u.pathname).replace(/\/$/, '');
}

export const API_BASE: string =
  apiDaUrl() ||
  // Configuração legítima de implantação: vem do HTML servido, não da URL, então
  // não é forjável por link.
  (window as any).__API_BASE__ ||
  '/api';

// Origem do JSON no modo estático (fallback).
//
// Aponta para o repositório de DADOS, separado do código, e o motivo é
// estrutural: esta busca acontece no NAVEGADOR DO VISITANTE. Não existe token
// que se possa usar aqui — qualquer chave embutida no bundle fica visível para
// qualquer um no DevTools. Ou seja, esta URL PRECISA ser pública, sempre.
//
// Enquanto o índice morava junto com o código, isso amarrava as duas coisas: em
// 13/08/2026 o repositório do código foi fechado e este fallback morreu junto,
// em silêncio. Com o índice num repositório só de dados, o código pode ser
// fechado sem derrubar a contingência.
export const JSON_FALLBACK: string =
  'https://raw.githubusercontent.com/estudio-max/' +
  'Portal-de-Normas-e-atos-da-UFF-dados/main/portal-data.json';

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
