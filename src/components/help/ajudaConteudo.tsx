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
  /**
   * POR QUE a aba existe — o problema real que ela resolve, e o que se fazia
   * (ou não se conseguia fazer) antes dela. Um ou dois parágrafos.
   *
   * Esta é a parte que faz a pessoa QUERER usar a aba; o resto só ensina a
   * operá-la. Escreva sobre o trabalho de quem lê, não sobre o recurso: "achar
   * isso exigiria abrir 25 anos de PDF" vale mais que "consulta indexada".
   */
  porQue: React.ReactNode[];
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
    resumo: <>A porta de entrada: quatro tarefas para começar, o que saiu no <B>boletim mais
      recente</B> e o tamanho do acervo.</>,
    porQue: [
      <>O Boletim de Serviço é um PDF de dezenas de páginas, publicado quase todo dia. Para
        saber o que saiu, alguém precisa abrir o arquivo e percorrê-lo. Multiplique isso pelos
        boletins do mês e a pergunta mais simples que existe — <em>o que a universidade publicou
        ultimamente?</em> — vira meia hora de leitura.</>,
      <>Esta tela responde isso de uma vez: quantos atos vieram, de que tipos, de quais
        unidades, e quantos trazem processo SEI para rastrear. E põe ao lado o tamanho do acervo
        inteiro, que é o outro número que ninguém tem à mão — <B>quantas normas da UFF estão em
        vigor hoje</B> não é uma informação que exista em lugar nenhum além daqui.</>,
    ],
    passos: [
      <>Os <B>quatro cartões do topo</B> são atalhos para as tarefas mais comuns: encontrar um
        ato, consultar o seu SIAPE, acompanhar prazos e explorar relações.</>,
      <><B>Atualizações recentes</B> traz os atos do último Boletim de Serviço. A lista abre com
        os primeiros e o botão abaixo dela diz quantos faltam — nenhum ato fica escondido.</>,
      <><B>Resumo do acervo</B> soma o acervo inteiro: total, vigentes, revogados e alterados,
        com a evolução por ano ao lado.</>,
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
    porQue: [
      <>O acervo da UFF são <B>milhares de PDFs</B>, um por boletim, espalhados por 25 anos. Cada
        arquivo é pesquisável por dentro, mas não existe busca <em>entre</em> eles: para achar
        uma portaria de 2013 era preciso saber antes em que boletim ela saiu — e é justamente
        isso que a pessoa não sabe, senão não estaria procurando.</>,
      <>Aqui os 25 anos viraram uma tabela só. A pergunta deixa de ser “em que arquivo isto
        está?” e passa a ser “o que eu quero encontrar?”. É a aba que sustenta todas as outras:
        o resto do portal são recortes desta mesma base, feitos para perguntas específicas.</>,
    ],
    passos: [
      <>Digite na busca o que você tem em mãos: o número da portaria, uma palavra da ementa, o
        número do processo SEI ou o nome de alguém.</>,
      <>Estreite com <B>Tipo</B>, <B>Ano</B> e <B>Status</B>, que ficam logo abaixo da busca.</>,
      <>Órgão emissor, nome, matrícula, processo e os dois recortes (“só com relações”, “só com
        processo”) estão em <B>Mais filtros</B>, no painel que abre à direita.</>,
      <>Cada filtro que você aplica vira uma <B>etiqueta</B> abaixo dos campos. Clique nela para
        remover só aquele filtro, ou use <B>Limpar filtros</B> para desfazer todos.</>,
      <>Use <B>Ver ato</B>, no fim da linha, para abrir a ficha: ementa completa, relações com
        outros atos, processo SEI e o link para o PDF oficial do boletim.</>,
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
    porQue: [
      <>Uma norma revogada é <B>idêntica</B> a uma norma em vigor. O PDF de 2015 não muda quando
        uma resolução de 2022 o revoga — ele continua lá, com a mesma cara de norma válida. Quem
        o encontra por busca não tem como saber, olhando para ele, que aquilo não vale mais.</>,
      <>Quem sabe é o ato <em>posterior</em>, que diz “fica revogada a Resolução X”. O portal lê
        essas frases em todo o acervo e monta a corrente ao contrário: dado um ato, quem mexeu
        nele depois. Num portal de normas este é o erro mais caro que existe — instruir um
        processo citando norma revogada —, e é o único que a busca sozinha não evita.</>,
    ],
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
    porQue: [
      <>A UFF publica há 25 anos e nunca olhou para a própria produção normativa como
        <em> conjunto</em>. Perguntas de gestão elementares não têm resposta em lugar nenhum:
        quais unidades mais normatizam, em que época do ano a máquina publica mais, que fatia do
        acervo já foi revogada, quantos atos permitem chegar ao processo que os originou.</>,
      <>Nenhuma dessas respostas cabe num ato isolado — todas exigem o acervo inteiro de uma vez,
        que é exatamente o que ninguém tinha. É o painel de quem precisa <B>decidir sobre a
        norma</B>, e não consultar uma norma específica.</>,
    ],
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
    porQue: [
      <>Acompanhar o Boletim é inviável pelo volume, mas o problema real não é o volume — é a
        <B> proporção</B>. A maior parte do que sai são atos de efeito individual: designações,
        licenças, afastamentos, progressões. São legítimos e necessários, e afogam por completo
        o punhado de atos que mudam alguma coisa para todo mundo.</>,
      <>Esta aba inverte o filtro. Em vez de tentar excluir o individual, ela <B>exige laço
        institucional</B>: o ato só entra se estiver ligado a uma política, a um colegiado
        permanente, ou se alterar a vigência de outra norma. O resultado é curto de propósito —
        é a lista que um dirigente consegue de fato ler toda semana.</>,
    ],
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
      o <B>RSC</B> (IN GAR/RET/UFF nº 129/2026, que regulamenta o Decreto 13.048/2026 na UFF).</>,
    porQue: [
      <>A IN GAR/RET/UFF nº 129, de 24/07/2026, lista no art. 2º os <B>seis requisitos</B> do
        Reconhecimento de Saberes e Competências da carreira técnico-administrativa: participação
        em comissões, comitês, grupos de trabalho e núcleos; projetos institucionais; premiação;
        responsabilidade técnico-administrativa; cargo de direção; e produção de conhecimento. E o
        art. 19 diz o que serve de prova — entre outras coisas, <B>“portarias, resoluções ou atos
        de designação ou nomeação”</B>. Ou seja: o ato publicado no Boletim, com a indicação de
        onde ele saiu, é exatamente o documento que o processo pede.</>,
      <>Só que essa prova está espalhada por 25 anos de PDFs, e ninguém guarda a portaria que o
        designou para uma comissão em 2011. Montar o próprio histórico à mão significaria abrir
        boletim por boletim procurando o próprio nome — na prática, ninguém faz, e a
        consequência é concreta: <B>o servidor perde pontuação por não conseguir localizar um
        ato que existe</B>. Esta aba faz essa procura em segundos e devolve a referência pronta
        para colar no processo.</>,
    ],
    passos: [
      <>Digite a <B>matrícula SIAPE</B> (só números — zeros à esquerda não fazem diferença).</>,
      <>Preencha também o <B>nome</B>, no campo ao lado.</>,
      <>Clique em <B>Buscar atos</B>. O resultado vem em até três blocos: designações e dispensas de
        função, atos que citam a matrícula, e atos que citam o nome no texto.</>,
      <>Use <B>Exportar / Imprimir PDF</B> para gerar a lista pronta para anexar ao processo, com a
        referência do boletim em cada linha. Organizar a documentação <B>na ordem dos requisitos</B>,
        como o art. 18, §3º recomenda, é trabalho de quem monta o processo: o portal entrega os
        atos e onde eles saíram, não a classificação deles.</>,
    ],
    destaque: <>Preencha os <B>dois</B> campos, sempre. Só uma parte dos atos do Boletim registra
      a matrícula de quem eles citam — o resto traz apenas o nome escrito no texto. Buscando só
      pelo SIAPE, esses atos não aparecem, e é comum que sejam justamente os de participação em
      comissão. O nome é o que alcança essa parte do acervo.</>,
    cuidado: <>Isto é <B>material de instrução, não decisão</B>. A lista mostra que existe um ato
      publicado que cita você e onde ele saiu — ela não comprova participação por si só (numa
      banca, o avaliado também é citado), não é exaustiva, e não apura pontuação nenhuma: quem
      avalia é a <B>CRSC-UFF</B>. <B>O portal não classifica ato por requisito</B> e não diz se
      algo pontua: a IN é expressa ao dizer que atender aos requisitos objetivos “não assegura,
      por si só, a concessão” (art. 15, §8º), e não se pontua o que for “exclusivamente o
      desempenho ordinário das atribuições legais do cargo” (art. 20, §2º) — isso depende do seu
      memorial. O que esta aba entrega é o <B>ato e a referência do boletim</B>, que é o documento
      que o art. 19, parágrafo único, I aceita como prova; enquadrá-lo é parte do seu pedido. Nem
      tudo que conta está no Boletim: projetos, premiação e produção científica comprovam-se por
      certificado ou publicação. A busca por nome pode trazer <B>pessoas de nome parecido</B>.
      Confira ato por ato antes de usar.</>,
  },

  'pessoal/chefias': {
    titulo: 'Chefias',
    resumo: <>Quem chefia cada setor hoje, montado a partir das designações e dispensas
      publicadas no Boletim. Cada linha aponta a portaria que a originou.</>,
    porQue: [
      <>Parece que deveria existir uma lista de quem chefia o quê na UFF. Não existe — o que
        existe é a <B>sequência de designações e dispensas</B> publicadas ao longo dos anos. O
        titular atual de um setor é o resultado de ler essa sequência até o fim, e ninguém tem
        tempo de fazer isso para 900 unidades.</>,
      <>O portal lê. Cada linha aqui é uma conclusão a partir de um ato real, com a portaria
        nomeada ao lado — para conferir, e para citar. Serve tanto a quem precisa saber a quem se
        dirigir quanto a quem precisa <B>provar</B> quem respondia por um setor numa data.</>,
    ],
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
    porQue: [
      <>Designação tem prazo; o fim dele quase nunca é publicado. O setor continua funcionando,
        a pessoa continua assinando, e a designação que a autoriza venceu há dois anos sem que
        ninguém percebesse — não por descuido de alguém, mas porque <B>nada no sistema avisa</B>.</>,
      <>Esta aba é esse aviso. Ela não acusa irregularidade: aponta onde a formalização ficou
        para trás do funcionamento, que é uma lista de pendências a resolver antes de virar
        problema — em auditoria, ou na hora em que um ato assinado por quem estava com a
        designação vencida for questionado.</>,
    ],
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
    porQue: [
      <>Um prazo não é publicado como prazo. Ele aparece <B>dentro do texto</B> de um ato que
        trata de outra coisa: um edital que menciona “dez dias para recurso”, uma portaria que
        institui comissão “pelo prazo de 60 dias”. Não há campo, não há calendário — só a frase,
        no meio do documento.</>,
      <>Quem precisa cumprir esses prazos hoje depende de lembrar. Esta aba junta as datas
        encontradas no corpo dos atos numa agenda única, com o trecho de onde cada uma saiu para
        conferir. Em <B>PAD e sindicância</B> isso deixa de ser conveniência: o prazo tem
        consequência legal, e a contagem se reabre a cada prorrogação — perder o fio é perder o
        processo.</>,
    ],
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
    porQue: [
      <>Os dois regimes conviveram por anos, cada setor entrou no seu tempo, e a decisão de cada
        um saiu numa portaria própria — às vezes seguida, anos depois, de uma revogação igualmente
        avulsa. Não existe lista consolidada: existe uma coleção de portarias que, lidas juntas e
        na ordem, dizem quem está em quê.</>,
      <>É a leitura que esta aba faz. Para gestão de pessoas ela responde de uma vez a pergunta
        que hoje se responde setor a setor — <B>quem está em qual regime, desde quando, e por qual
        ato</B> — e mostra o movimento ao longo do tempo, que é o que permite enxergar a política
        e não só os casos.</>,
    ],
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
    porQue: [
      <>Boa parte destes colegiados <B>existe porque uma lei ou um órgão de controle exige</B> —
        e o que se cobra numa auditoria não é a norma que os criou, é a evidência de que estão
        funcionando: quando se reuniram, o que deliberaram, quem os compõe agora. Essa evidência
        está publicada, mas dispersa em anos de boletins, sob nomes que mudaram no caminho.</>,
      <>Aqui cada corpo tem a sua linha do tempo reunida, com o selo dizendo se ele é exigido por
        lei, cobrado por controle, ou nenhum dos dois. É o que transforma “a CPA existe” em
        “a CPA agiu, nestas datas, nestes atos” — que é a diferença entre <B>afirmar e
        comprovar</B>.</>,
    ],
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
    porQue: [
      <>Uma política institucional não nasce de um ato. Ela se constrói ao longo de anos, por
        atos de órgãos diferentes: uma resolução institui, um regimento detalha, uma portaria
        designa quem cuida, uma outra fixa diretrizes de execução, um relatório presta contas.
        Cada um desses atos foi publicado sozinho, e <B>ninguém guarda o fio que os liga</B>.</>,
      <>O resultado é que a pergunta mais natural que um gestor, um órgão de controle ou um
        pesquisador pode fazer — <em>o que a UFF já fez sobre assédio?</em> — hoje se responde
        pela memória de quem estava lá. Esta aba materializa esse fio: reúne os atos de um
        assunto na ordem em que o construíram e mostra <B>em que ponto do ciclo cada um
        entra</B>. Ler a sequência inteira leva um minuto, e é a diferença entre ter uma lista de
        atos e ter a história de uma decisão institucional.</>,
      <>E há uma segunda leitura, que veio de os grupos saírem do <B>PDI</B> — o plano de
        desenvolvimento institucional da própria UFF. Como cada política aparece sob o eixo e o
        subtema do plano, dá para ver <B>o que a universidade executa e o plano prevê</B> e, do
        outro lado, o que nasceu fora dele: a prevenção ao assédio e a segurança da informação
        não têm subtema próprio no PDI vigente, porque são recentes e movidas por lei externa. É
        um descompasso real entre o que se faz e o que está planejado — e ele fica visível
        justamente porque a classificação não é nossa.</>,
    ],
    passos: [
      <>Escolha uma política na lista (ou filtre pelo nome, pelo eixo ou pelo subtema).</>,
      <>Olhe a <B>faixa de etapas</B> do cartão: Instituição, Regulamentação, Governança,
        Execução, Monitoramento, Avaliação. Etapa colorida tem ato; etapa apagada em tracejado
        significa que <B>nenhuma evidência foi localizada no Boletim</B> — que é bem diferente
        de dizer que não aconteceu.</>,
      <>Leia a <B>etiqueta de tema</B> abaixo do nome: é o subtema do PDI, e os títulos que
        agrupam a lista são os eixos do plano. Etiqueta sem ressalva significa que o PDI tem um
        subtema com aquele nome.</>,
      <>Abra a política para ver os atos, cada um com o <B>papel</B> que cumpre.</>,
    ],
    destaque: <>O que organiza tudo é o <B>papel</B> de cada ato — o que ele <em>faz</em> pela
      política, não o assunto de que trata. Designar uma comissão é <B>governança</B>, não
      execução. Sem essa distinção, uma política com dez designações e nenhuma entrega pareceria
      a mais ativa de todas.</>,
    cuidado: <>O catálogo é <B>curado e pequeno</B>: são as políticas já conferidas, não o
      conjunto das políticas da UFF. O selo <B>⚠ confiança media</B> marca o ato ligado à
      política pelo <B>órgão que o emitiu</B>, sem a política nomeada na ementa. Na etiqueta de
      tema, <B>por conteúdo</B> avisa que o PDI descreve o tema sem usar a palavra, e <B>por
      afinidade</B> avisa que o plano não o cobre e a aproximação é do portal — passe o mouse
      para ver a justificativa de cada uma. A âncora também é <B>datada</B>: vale enquanto valer
      o PDI vigente. E ausência de evidência no Boletim não prova ausência de execução — muita
      coisa acontece fora dele.</>,
  },

  'institucional/revalidacao': {
    titulo: 'Revalidação',
    resumo: <>O que a UFF decidiu sobre pedidos de revalidação e reconhecimento de diplomas
      obtidos fora do Brasil — em números, sem identificar quem pediu.</>,
    porQue: [
      <>Quem estudou no exterior e quer que o diploma valha no Brasil precisa pedir revalidação a
        uma universidade pública. A decisão sai publicada no Boletim de Serviço, uma por ato, e
        some no meio de centenas de páginas. Somadas, essas decisões respondem o que ninguém
        conseguia responder antes: <B>quais cursos e países a UFF mais defere, e quanto tempo a
        fila leva</B>.</>,
      <>Serve também à prestação de contas. CGU e TCU cobram das universidades justamente a
        publicidade desses atos e o tempo de tramitação dos processos.</>,
    ],
    passos: [
      <>Escolha entre <B>Graduação</B> e <B>Pós-graduação</B>: são processos diferentes, com
        normas e prazos próprios, e somar os dois esconde a diferença entre eles.</>,
      <>Veja por país, curso ou instituição de origem para ter uma ideia do que costuma ser
        deferido.</>,
    ],
    cuidado: <>Esta aba <B>não mostra nomes</B>: quem pede revalidação é pessoa privada, e o
      objetivo aqui é orientar, não expor. A taxa de deferimento só aparece a partir de um número
      mínimo de pedidos — com uma amostra pequena, um único indeferimento viraria "0% de
      aprovação" e afastaria alguém que talvez devesse pedir. E o tempo de tramitação é uma
      <B> aproximação</B>: o boletim publica a decisão, não a data em que o processo foi aberto.</>,
  },
  'institucional/cooperacao': {
    titulo: 'Cooperação',
    resumo: <>Os acordos, protocolos e cotutelas que a UFF firmou, com a instituição parceira e
      o país.</>,
    porQue: [
      <>Cada convênio é publicado como um ato isolado, e o nome da instituição parceira vem
        escrito de um jeito diferente a cada vez. Somados, esses atos são o retrato da
        internacionalização da universidade — mas <B>só somados</B>, e é justamente essa soma que
        não existia em lugar nenhum.</>,
      <>Com quantos países a UFF tem acordo? Quais instituições aparecem mais de uma vez? A
        cooperação cresceu ou encolheu na última década? São perguntas de relatório de gestão e
        de ranking internacional, e cada uma delas exigia percorrer o acervo à mão para
        responder.</>,
    ],
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
    porQue: [
      <>Rankings de impacto e órgãos de controle não perguntam o que a universidade pretende:
        pedem <B>evidência documental</B> de que ela institucionalizou alguma coisa. E a
        evidência que eles aceitam é exatamente o que o Boletim publica — o ato que cria a
        política, o programa, a estrutura.</>,
      <>Montar essa resposta costuma ser um esforço de meses, feito a cada ciclo de avaliação,
        garimpando atos no acervo. Aqui ela já está montada e se atualiza sozinha a cada
        importação. O ganho não é a contagem — é <B>a linha do ato ao lado do objetivo</B>: em
        vez de afirmar que a UFF atua num tema, apontar em que documento isso está escrito.</>,
    ],
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
