import React from 'react';

// Ajuda contextual: uma entrada por aba, aberta pelo "?" do cabeçalho.
//
// POR QUE ISTO EXISTE SEPARADO DA ABA AJUDA
//
// A aba Ajuda é um guia para ler de cabo a rabo — quem chega nela já parou o
// que estava fazendo. Este arquivo é outra coisa: a pessoa está DENTRO de um
// painel, olhando para ele, e a pergunta é sempre a mesma — "o que é isto e o
// que eu faço aqui?". Por isso cada entrada é curta e responde na ordem: o que
// é, como usar, o que não concluir.
//
// REGRA DE OURO: só descreva controle que EXISTE na tela. Ajuda que manda
// clicar num botão inexistente é pior que ajuda nenhuma — ela ensina a pessoa a
// desconfiar de todo o resto. Ao mexer num painel, passe aqui.
//
// O mapa é TOTAL sobre as abas do portal: `tools/test_redesign_integrity.mjs`
// reprova aba em ABAS_VALIDAS sem entrada aqui. Aba nova nasce com ajuda.

export interface AjudaAba {
  /** O nome da aba como ela aparece no menu. */
  titulo: string;
  /** O que é e a que pergunta responde. Duas frases, no máximo. */
  resumo: React.ReactNode;
  /** O caminho curto até o resultado. Cada passo é uma ação. */
  passos: React.ReactNode[];
  /** O conselho que muda o resultado. Aparece em destaque. */
  destaque?: React.ReactNode;
  /** O que o painel NÃO afirma. Presente sempre que houver inferência. */
  cuidado?: React.ReactNode;
}

const B = ({ children }: { children: React.ReactNode }) => <strong>{children}</strong>;

export const AJUDA: Record<string, AjudaAba> = {
  '': {
    titulo: 'Dashboard',
    resumo: <>A visão de chegada: o tamanho do acervo, quantas normas estão em vigor e o que
      saiu no <B>boletim mais recente</B>.</>,
    passos: [
      <>Os quatro números do topo somam o acervo inteiro: total de atos, vigentes, alterados e revogados.</>,
      <>A lista central traz <B>todos</B> os atos do último Boletim de Serviço, não uma amostra.</>,
      <>À direita, os gráficos: a evolução por ano e a composição do último boletim (por tipo de
        ato, por unidade que publicou, e quantos trazem processo SEI).</>,
      <>Passe o mouse sobre o gráfico de anos para ver o número de cada ano. Abaixo de cada
        gráfico há um <B>“Ver em tabela”</B> com os valores exatos.</>,
    ],
    cuidado: <>Os números refletem o que já foi <B>indexado</B>. O portal se atualiza sozinho
      duas vezes por dia a partir dos PDFs do Boletim; um ato publicado hoje de manhã pode
      aparecer só na atualização seguinte.</>,
  },

  atos: {
    titulo: 'Atos e Normas',
    resumo: <>A planilha completa do acervo, com busca e filtros. É por onde se procura um ato
      específico — por número, assunto, processo SEI, nome de pessoa ou matrícula.</>,
    passos: [
      <>Digite na busca o que você tem em mãos: o número da portaria, uma palavra da ementa, o
        número do processo SEI ou o nome de alguém.</>,
      <>Estreite com os filtros de <B>tipo</B>, <B>órgão</B>, <B>ano</B> e <B>situação</B>.</>,
      <>Clique na linha para abrir a <B>ficha do ato</B>: ementa completa, relações com outros
        atos, processo SEI e o link para o PDF oficial do boletim.</>,
    ],
    destaque: <>Escreva o hífen quando ele existir na palavra: <B>pós-graduação</B> e
      <B> Vice-Reitor</B> são grafias que o portal entende. E se não achar pelo nome completo,
      tente só o sobrenome.</>,
    cuidado: <>A lista mostra os primeiros resultados para a tela não travar — se o seu ato não
      apareceu, refine a busca em vez de rolar. E o documento oficial é sempre o <B>PDF do
      Boletim</B>, cujo link está em cada ato.</>,
  },

  relacoes: {
    titulo: 'Mapa de Relações',
    resumo: <>Responde a uma pergunta só, e é a mais importante de um portal de normas:
      <B> este ato ainda vale?</B> Mostra quem alterou, quem revogou e o que depende dele.</>,
    passos: [
      <>Escolha um ato na lista da esquerda (dá para filtrar por número ou assunto).</>,
      <>Leia o <B>veredito</B> no topo: vigente, alterado por um ato posterior, ou revogado —
        com o ato responsável nomeado.</>,
      <>Percorra a teia: tudo é clicável, então dá para andar de um ato ao outro sem voltar
        para a busca.</>,
    ],
    cuidado: <>As relações são lidas do <B>texto</B> dos atos. Um ato que revoga outro sem citar
      número e ano não gera ligação — a ausência de relação não prova que nada mudou. Em decisão
      oficial, confira o PDF.</>,
  },

  insights: {
    titulo: 'Insights',
    resumo: <>O acervo em números: ritmo de publicação, quem mais publica, cobertura de processo
      SEI, situação de vigência e rotatividade de chefias.</>,
    passos: [
      <>Comece pelo calendário de publicação: ele mostra os picos do ano (concurso, início de
        semestre, fim de exercício).</>,
      <>Veja os órgãos que mais publicam e a composição do acervo por tipo de ato.</>,
      <>Desça até a rotatividade de chefias para ver quais cadeiras mais trocam de titular.</>,
    ],
    cuidado: <>É um panorama do que está <B>indexado</B>, não um relatório oficial de gestão.
      Alguns painéis só ganham sentido conforme mais anos entram na base — por isso alguns
      aparecem vazios e se ativam sozinhos com o tempo.</>,
  },

  mudancas: {
    titulo: 'O que mudou',
    resumo: <>O feed do que saiu de novo e <B>por que aquilo importa</B> — só atos com efeito
      institucional, não as movimentações de pessoal do dia a dia.</>,
    passos: [
      <>Escolha a janela de tempo: 30, 90, 180 ou 365 dias.</>,
      <>Leia os <B>selos</B> de cada item — eles dizem o motivo de o ato estar ali: “política”,
        “colegiado”, “muda vigência”, “prazo”.</>,
      <>Clique para abrir o ato no Boletim.</>,
    ],
    destaque: <>O texto de cada item é a <B>ementa do próprio ato</B>, copiada como está. Nada
      aqui é resumo escrito por máquina — sobre atos que afetam pessoas, isso seria inventar.</>,
    cuidado: <>A maioria dos atos publicados é de efeito individual (designações, licenças,
      afastamentos) e <B>não entra neste feed</B> de propósito. Para esses, use Atos e Normas ou
      Meu SIAPE.</>,
  },

  'pessoal/siape': {
    titulo: 'Meu SIAPE',
    resumo: <>Reúne os atos publicados no Boletim que citam <B>você</B>, com a referência exata
      (boletim, seção e página) para copiar num processo. Foi feita para instruir pedidos que
      exigem comprovar participação em comissões, comitês, grupos de trabalho e núcleos — como
      o <B>RSC</B> (Decreto 13.048/2026).</>,
    passos: [
      <>Digite a <B>matrícula SIAPE</B> (só números — zeros à esquerda não fazem diferença).</>,
      <>Preencha também o <B>nome</B>, no campo ao lado.</>,
      <>Clique em <B>Buscar</B>. O resultado vem em até três blocos: designações e dispensas de
        função, atos que citam a matrícula, e atos que citam o nome no texto.</>,
      <>Use <B>Exportar / Imprimir PDF</B> para gerar a lista pronta para anexar ao processo.</>,
    ],
    destaque: <>Preencha os <B>dois</B> campos, sempre. Só uma parte dos atos do Boletim registra
      a matrícula de quem eles citam — o resto traz apenas o nome escrito no texto. Buscando só
      pelo SIAPE, esses atos não aparecem, e é comum que sejam justamente os de participação em
      comissão. O nome é o que alcança essa parte do acervo.</>,
    cuidado: <>Isto é <B>material de instrução, não decisão</B>. A lista mostra que existe um ato
      publicado que cita você e onde ele saiu — ela não comprova participação por si só (numa
      banca, o avaliado também é citado), não é exaustiva, e não apura pontuação nenhuma: quem
      avalia é a comissão. A busca por nome pode trazer <B>pessoas de nome parecido</B>. Confira
      ato por ato antes de usar.</>,
  },

  'pessoal/chefias': {
    titulo: 'Chefias',
    resumo: <>Quem chefia cada setor hoje, montado a partir das designações e dispensas
      publicadas no Boletim. Cada linha aponta a portaria que a originou.</>,
    passos: [
      <>Busque por setor, nome, cargo ou SIAPE.</>,
      <>Confira sempre a <B>data</B> e a <B>portaria</B> mostradas na linha — é delas que a
        informação vem.</>,
    ],
    cuidado: <>Vale a designação mais recente <B>publicada</B>. Se a última movimentação de um
      cargo foi uma dispensa sem sucessor publicado, o setor não aparece aqui — o que não
      significa que ele esteja sem chefia.</>,
  },

  'pessoal/mandatos': {
    titulo: 'Mandatos',
    resumo: <>O outro lado das Chefias: setores cuja <B>designação venceu</B> ou que não têm
      chefia formalmente constituída no que foi publicado.</>,
    passos: [
      <>Busque por setor, cargo, nome ou SIAPE.</>,
      <>Veja há quanto tempo a última designação daquele setor foi publicada.</>,
    ],
    cuidado: <>O fim de um mandato quase nunca gera ato próprio — quem cumpriu e entregou é
      indistinguível de quem foi esquecido. O que esta aba afirma é apenas que <B>não há ato
      posterior publicado</B> para aquele setor, e isso é um ponto de partida para conferir, não
      um veredito.</>,
  },

  'pessoal/prazos': {
    titulo: 'Prazos',
    resumo: <>Uma agenda com as datas-limite encontradas no texto dos atos: inscrições,
      recursos, entregas, validades e prazos de comissão disciplinar.</>,
    passos: [
      <>Escolha a <B>janela</B> (esta semana, 30 dias, 90 dias…).</>,
      <>Alterne entre <B>PAD/Sindicância</B> e <B>Gerais</B>. Os primeiros são mais confiáveis: o
        número de dias é lido literalmente do ato (“prazo de 30 (trinta) dias”).</>,
      <>Filtre por <B>público</B> (candidatos, discentes, docentes, fornecedores…) e use
        <B> Imprimir / PDF</B> para levar a lista no papel.</>,
    ],
    cuidado: <>É um apoio para não perder prazo, <B>não uma agenda oficial</B>. A data e o
      “para quem” são detectados automaticamente e podem escorregar. Prazos relativos (“30 dias
      a contar da assinatura”) contam a partir da data do ato. Em PAD e sindicância, cada
      prorrogação é um prazo novo — vale o do ato mais recente. Confirme sempre no ato.</>,
  },

  'pessoal/jornada': {
    titulo: 'Jornada',
    resumo: <>Os dois regimes de jornada lado a lado: <B>flexibilização</B> (as seis horas
      corridas) e <B>Programa de Gestão e Desempenho</B>. Mostra quais setores aderiram a cada
      um, e quais saíram.</>,
    passos: [
      <>Escolha o regime nas abas internas.</>,
      <>Procure o setor na lista. Cada linha traz o ato de aprovação e, quando houve, o de
        revogação.</>,
      <>O gráfico de adesão e saída por ano mostra o movimento ao longo do tempo.</>,
    ],
    cuidado: <>Os setores são agrupados pelo <B>número do processo SEI</B>, não pelo nome — o
      nome do setor é escrito de forma diferente a cada ano e não serve de chave. Um setor
      aparece como “saiu” quando alguma portaria do processo foi revogada.</>,
  },

  'institucional/comissoes': {
    titulo: 'Comissões',
    resumo: <>Os <B>colegiados permanentes centrais</B> da UFF — CPA, CPPD, CEUA, CIS, comitês de
      ética e governança — e os atos que cada um gerou ao longo do tempo.</>,
    passos: [
      <>Filtre por nome ou sigla, ou use os selos para ver só as obrigatórias.</>,
      <>Abra um colegiado para ver a linha do tempo de atos que o citam ou que ele assinou.</>,
    ],
    destaque: <>Cada colegiado traz um selo de <B>origem legal</B>: exigido por <B>lei</B>,
      cobrado por <B>órgão de controle</B>, ou nenhum dos dois. É curadoria, não leitura
      automática do texto.</>,
    cuidado: <>É uma <B>amostra curada</B>, não o universo: a UFF constituiu milhares de
      comissões em 25 anos, a maioria efêmera (banca, sindicância, comissão eleitoral), e essas
      ficam de fora. Comissões locais de unidade também não entram — só as centrais.</>,
  },

  'institucional/politicas': {
    titulo: 'Políticas',
    resumo: <>Buscar “assédio” devolve uma lista de atos em ordem de data. Esta aba responde
      outra pergunta: <B>como esse assunto foi construído na UFF ao longo do tempo?</B> Cada
      política reúne os atos que a formaram, do que a instituiu ao que a executa hoje.</>,
    passos: [
      <>Escolha uma política na lista (ou filtre pelo nome).</>,
      <>Olhe a <B>faixa de etapas</B> do cartão: Instituição, Regulamentação, Governança,
        Execução, Monitoramento, Avaliação. Etapa colorida tem ato; etapa apagada em tracejado
        significa que <B>nenhuma evidência foi localizada no Boletim</B> — que é bem diferente
        de dizer que não aconteceu.</>,
      <>Abra a política para ver os atos, cada um com o <B>papel</B> que cumpre.</>,
    ],
    destaque: <>O que organiza tudo é o <B>papel</B> de cada ato — o que ele <em>faz</em> pela
      política, não o assunto de que trata. Designar uma comissão é <B>governança</B>, não
      execução. Sem essa distinção, uma política com dez designações e nenhuma entrega pareceria
      a mais ativa de todas.</>,
    cuidado: <>O catálogo é <B>curado e pequeno</B>: são as políticas já conferidas, não o
      conjunto das políticas da UFF. O selo <B>⚠ confiança media</B> marca o ato que foi ligado
      à política pelo <B>órgão que o emitiu</B>, sem a política nomeada na ementa. E ausência de
      evidência no Boletim não prova ausência de execução — muita coisa acontece fora dele.</>,
  },

  'institucional/cooperacao': {
    titulo: 'Cooperação',
    resumo: <>Os acordos, protocolos e cotutelas que a UFF firmou, com a instituição parceira e
      o país.</>,
    passos: [
      <>Busque por instituição, país ou número do ato.</>,
      <>Use as categorias para separar os tipos de instrumento; a <B>cotutela</B> tem categoria
        própria, por ser um instrumento de natureza distinta.</>,
    ],
    cuidado: <>O país nem sempre está escrito no ato. Quando ele foi deduzido a partir da
      instituição, aparece marcado com <B>*</B> — trate como indicação, não como dado
      declarado.</>,
  },

  'institucional/ods': {
    titulo: 'ODS',
    resumo: <>Os atos normativos agrupados pelos <B>17 Objetivos de Desenvolvimento
      Sustentável</B> da ONU — o formato que rankings internacionais e órgãos de controle usam
      para avaliar a gestão universitária.</>,
    passos: [
      <>Clique numa ODS para ver os atos que a sustentam.</>,
      <>Use os botões de <B>vínculo</B> dentro dela. O que responde “o que a UFF de fato
        institucionalizou aqui?” é <B>Proposta</B> — o ato fundador.</>,
      <>Cada linha traz a meta em que se ancora e a justificativa da classificação.</>,
    ],
    destaque: <>A separação por vínculo é o ponto da aba. Um curso <em>sobre</em> recursos
      hídricos não é a política hídrica da universidade, e ratificar um convênio não é propor
      uma política de cooperação. Somar tudo num número só inflaria o resultado.</>,
    cuidado: <>A classificação é <B>assistida por computador, com curadoria humana</B>, e não é
      um relatório oficial da UFF. ODS sem evidência aparecem <B>vazias de propósito</B>: a
      produção normativa real é desigual, e forçar equilíbrio seria fabricar evidência.</>,
  },

};

/** Abas que NÃO levam o "?", porque elas já SÃO a explicação: Ajuda é o guia
 *  completo, Privacidade explica o tratamento dos dados, Sobre explica o
 *  portal. Um modal explicando a página de explicação não ajuda ninguém.
 *
 *  A lista é explícita de propósito. Junto com o mapa acima ela cobre TODAS as
 *  abas do portal, e o `tools/test_redesign_integrity.mjs` exige essa cobertura
 *  total: aba nova entra numa das duas listas por decisão de quem a criou, não
 *  fica sem ajuda por esquecimento. */
export const ABAS_SEM_AJUDA = ['ajuda', 'privacidade', 'sobre'];

/** A aba pode não estar no mapa se alguém acrescentar uma sem passar aqui — a
 *  trava do CI pega isso, mas em produção o botão simplesmente não aparece, em
 *  vez de abrir um modal vazio. */
export function ajudaDaAba(aba: string): AjudaAba | null {
  return AJUDA[aba] ?? null;
}
