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
