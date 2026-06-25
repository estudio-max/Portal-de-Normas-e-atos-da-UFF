export interface ActRelation {
  id: string;
  tipoRelacao: 'Altera' | 'Revoga' | 'Complementa' | 'Regulamenta';
  atoDestino: string; // Ex: "Portaria nº 68.120/2026" ou "Resolução CEPEx nº 88/2018"
  detalhes?: string;
}

export type ActType = 'Portaria' | 'Resolução' | 'Instrução de Serviço' | 'Decisão' | 'Outro';

export interface UffAct {
  id: string;
  tipoAto: ActType;
  numero: string; // ex: "68.120" ou "05/2026"
  ano: number; // ex: 2026
  dataAssinatura: string; // YYYY-MM-DD
  orgaoEmissor: string; // ex: "Reitoria", "PROGEPE", "CUV", "CEPEx", "PROGRAD"
  ementa: string; // Resumo oficial do ato
  processoSei: string | null; // e.g. "23069.011245/2026-12" ou null
  relacoes: ActRelation[]; // Relações com outras leis/atos
  tags: string[]; // Marcadores/Palavras-chave
  conteudoResumido: string; // Explicação legível do impacto prático
  status: 'Ativo' | 'Revogado' | 'Alterado';
  boletimNumero?: string; // Número do boletim de serviço, ex: "BS nº 10/2026"
  linkBoletim?: string; // Link direto do Boletim de Serviço
  notasInternas?: string; // Notas administrativas de indexação
  dataCriacao?: string; // Data em que foi adicionado ao portal
}

export interface UffStatistics {
  total: number;
  ativoCount: number;
  revogadoCount: number;
  alteradoCount: number;
  porTipo: Record<ActType, number>;
  porOrgao: Record<string, number>;
  porAno: Record<number, number>;
}
