export interface ActRelation {
  id: string;
  tipoRelacao: 'Altera' | 'Revoga' | 'Complementa' | 'Regulamenta';
  atoDestino: string; // Ex: "Portaria nº 68.120/2026" ou "Resolução CEPEx nº 88/2018"
  detalhes?: string;
}

// Tipos oficiais do Boletim de Serviço da UFF (abrange a base real indexada)
export type ActType =
  | 'Portaria' | 'Resolução' | 'Determinação de Serviço' | 'Instrução Normativa'
  | 'Norma de Serviço' | 'Ordem de Serviço' | 'Instrução de Serviço'
  | 'Decisão' | 'Deliberação' | 'Comunicado' | 'Edital'
  | 'Resumo de Despachos' | 'Outro';

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
  // Vínculos diretos com o SEI gerados pela indexação automática
  seiDocumento?: string | null; // código verificador do documento SEI
  linkSeiProcesso?: string | null;
  linkSeiDocumento?: string | null;
  secao?: string;
  pagina?: string;
  arquivo?: string;
  // Atos posteriores que alteram/revogam este (índice reverso pré-calculado)
  referenciadoPor?: { relacao: string; porId: string; porLabel: string; detalhes?: string }[];
  // Pessoas/matrículas para o filtro por servidor
  siapes?: string[];        // matrículas SIAPE citadas no ato
  textoBusca?: string;      // corpo do ato (minúsculo) para busca por nome/SIAPE
  signatario?: string;
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
