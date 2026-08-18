// ============================================================================
//  ESPÉCIES DOCUMENTAIS — a taxonomia do Manual, em um lugar só.
//
//  POR QUE ESTE ARQUIVO EXISTE (18/08/2026)
//  A gestora da área de documentação (biblioteconomia/arquivologia) apontou
//  que o portal chamava de "tipo de ato" o que o Manual de Atos e Comunicações
//  Oficiais da UFF (4ª ed., 2022, anexo à IN GAR/RET/UFF nº 26/2022) classifica
//  como ESPÉCIE. Para quem consulta, "tipo" e "espécie" parecem sinônimos; para
//  quem trata do acervo, não são — e o portal fala com os dois públicos.
//
//  O ACHADO MAIOR NÃO FOI O NOME. Cruzando as espécies que existem de fato no
//  acervo com o Manual, elas caem em DUAS CLASSES que o portal exibia numa
//  lista só:
//    - atos NORMATIVOS (cap. 4): explicitam norma a ser observada;
//    - atos ORDINÁRIOS (cap. 5): dão execução, registram, comunicam.
//  Uma Determinação de Serviço (50.025 no acervo) e uma Portaria (45.324) não
//  são a mesma natureza de coisa, e o gráfico "composição por tipo" as punha
//  lado a lado como se fossem — sugerindo que o acervo é metade norma quando,
//  na verdade, a maior fatia dele é ato ordinário.
//
//  ⚠️ A VIGÊNCIA DA ESPÉCIE É DADO, NÃO OPINIÃO. A IN RET/UFF nº 01/2021
//  descontinuou espécies a partir de 01/03/2021. Conferido contra o acervo em
//  18/08/2026, e o dado bate com a norma:
//    - Norma de Serviço  → último ato em 2020 (203 no total)
//    - Ordem de Serviço  → último ato em 2020 (134 no total)
//    - Decisão           → ainda corrente (14.826), mas cai de 705/ano em 2019
//                          para ~130/ano depois de 2021.
//  Por isso Decisão NÃO é marcada como descontinuada: o próprio Manual ressalva
//  as decisões com conteúdo normativo, e o acervo mostra a ressalva em uso.
//  Chamá-la de extinta seria contrariar norma e dado ao mesmo tempo.
//
//  ⚠️ ESPÉCIE DESCONHECIDA NÃO É ERRO. O acervo tem 25 anos e o Manual é de
//  2022: espécie que não está no mapa cai em `outros`, aparece na interface
//  normalmente e não é escondida. Some-la para "ficar limpo" apagaria
//  justamente o ato antigo que ninguém mais sabe classificar.
// ============================================================================

export type ClasseEspecie = 'normativo' | 'ordinario' | 'outros';

export interface Especie {
  classe: ClasseEspecie;
  /** Ano do último ato desta espécie, quando ela deixou de ser usada.
   *  `null` = corrente. Medido no acervo, não presumido da norma. */
  descontinuadaEm?: number;
  /** Nota curta exibida junto da espécie quando há o que ressalvar. */
  nota?: string;
}

/** Rótulos das classes, como aparecem para quem consulta. */
export const ROTULO_CLASSE: Record<ClasseEspecie, string> = {
  normativo: 'Atos normativos',
  ordinario: 'Atos ordinários',
  outros: 'Outras espécies',
};

export const APOIO_CLASSE: Record<ClasseEspecie, string> = {
  normativo: 'Explicitam a norma a ser observada (Manual, cap. 4).',
  ordinario: 'Dão execução, registram ou comunicam (Manual, cap. 5).',
  outros: 'Espécies do acervo histórico ainda não mapeadas no Manual de 2022.',
};

/** A chave é o nome da espécie como o acervo a grava (tabela `tipo_ato`). */
export const ESPECIES: Record<string, Especie> = {
  // --- Atos normativos (Manual, cap. 4) ---
  'Portaria': { classe: 'normativo' },
  'Portaria Conjunta': { classe: 'normativo' },
  'Resolução': { classe: 'normativo' },
  'Resolução Conjunta': { classe: 'normativo' },
  'Resolução ad referendum': {
    classe: 'normativo',
    nota: 'Resolução editada pela presidência e submetida ao colegiado depois.',
  },
  'Instrução Normativa': { classe: 'normativo' },
  'Instrução Normativa Conjunta': { classe: 'normativo' },

  // --- Atos ordinários (Manual, cap. 5) ---
  'Determinação de Serviço': { classe: 'ordinario' },
  'Decisão': {
    classe: 'ordinario',
    nota: 'Uso restrito desde 2021 às decisões com conteúdo normativo (ressalva do Manual).',
  },
  'Edital': { classe: 'ordinario' },
  'Comunicado': { classe: 'ordinario' },
  'Resumo de Despachos': {
    classe: 'ordinario',
    nota: 'No Manual: Resumo de Despachos e Decisões (RDD).',
  },
  'Ata': { classe: 'ordinario' },
  'Parecer': { classe: 'ordinario' },
  'Despacho': { classe: 'ordinario' },
  'Regimento': { classe: 'ordinario' },
  'Regulamento': { classe: 'ordinario' },
  'Estatuto': { classe: 'ordinario' },
  'Nota Técnica': { classe: 'ordinario' },
  'Convocação': { classe: 'ordinario' },
  'Declaração': { classe: 'ordinario' },
  'Certidão': { classe: 'ordinario' },
  'Moção': { classe: 'ordinario' },
  'Indicação': { classe: 'ordinario' },
  'Relatório': { classe: 'ordinario' },

  // --- Descontinuadas pela IN RET/UFF nº 01/2021 (a partir de 01/03/2021) ---
  // O ano é o do ÚLTIMO ato encontrado no acervo, conferido em 18/08/2026.
  'Norma de Serviço': { classe: 'ordinario', descontinuadaEm: 2020 },
  'Ordem de Serviço': { classe: 'ordinario', descontinuadaEm: 2020 },
  'Instrução de Serviço': { classe: 'ordinario', descontinuadaEm: 2020 },
};

/** A espécie, ou o registro neutro de `outros` quando ela não está mapeada. */
export function especie(nome: string): Especie {
  return ESPECIES[nome?.trim()] ?? { classe: 'outros' };
}

export const classeDe = (nome: string): ClasseEspecie => especie(nome).classe;

/** Ordem de exibição das classes: norma primeiro, porque é o que se procura. */
export const ORDEM_CLASSES: ClasseEspecie[] = ['normativo', 'ordinario', 'outros'];

/** Agrupa uma lista de espécies por classe, preservando a ordem recebida
 *  dentro de cada grupo e omitindo classe vazia. */
export function agrupaPorClasse<T>(
  itens: T[],
  nomeDe: (item: T) => string,
): { classe: ClasseEspecie; itens: T[] }[] {
  const mapa = new Map<ClasseEspecie, T[]>();
  for (const item of itens) {
    const c = classeDe(nomeDe(item));
    const arr = mapa.get(c);
    if (arr) arr.push(item);
    else mapa.set(c, [item]);
  }
  return ORDEM_CLASSES
    .filter(c => mapa.has(c))
    .map(c => ({ classe: c, itens: mapa.get(c)! }));
}
