import { UffAct } from '../types';

export const INITIAL_ACTS: UffAct[] = [
  {
    id: "act-dts-cgb-2-2026",
    tipoAto: "Instrução de Serviço",
    numero: "DTS CGB/ISNF nº 2",
    ano: 2026,
    dataAssinatura: "2026-06-12",
    orgaoEmissor: "CGB/ISNF",
    ementa: "Designa os docentes que atuarão no estágio curricular do Curso de Graduação em Biomedicina (Nova Friburgo) do Instituto de Saúde de Nova Friburgo.",
    processoSei: "23069.004112/2026-04",
    relacoes: [
      {
        id: "rel-dts-cgb-2-rev",
        tipoRelacao: "Revoga",
        atoDestino: "DTS CGB/ISNF nº 2 de 10 de Outubro de 2023",
        detalhes: "Revoga integralmente a designação anterior de estágio de Biomedicina em Nova Friburgo."
      }
    ],
    tags: ["Biomedicina", "Nova Friburgo", "Estágio", "Designação", "CGB", "ISNF"],
    conteudoResumido: "Organiza a equipe de professores orientadores para as atividades de estágio obrigatório de Biomedicina. Revoga portaria anterior de 2023.",
    status: "Ativo",
    boletimNumero: "BS nº 54/2026",
    linkBoletim: "https://boletimdeservico.uff.br/boletins/bs-2026/bs-54/",
    notasInternas: "Assinado pela Coordenadora Caroline Fernandes dos Santos Bottino.",
    dataCriacao: "2026-06-18"
  },
  {
    id: "act-dts-cgb-2-2023",
    tipoAto: "Instrução de Serviço",
    numero: "DTS CGB/ISNF nº 2",
    ano: 2023,
    dataAssinatura: "2023-10-10",
    orgaoEmissor: "CGB/ISNF",
    ementa: "Designa docentes orientadores e coordenadores de estágio de Biomedicina do Instituto de Saúde de Nova Friburgo.",
    processoSei: "23069.002145/2023-01",
    relacoes: [],
    tags: ["Biomedicina", "Nova Friburgo", "Estágio", "Designação"],
    conteudoResumido: "Dispunha sobre as coordenações de estágio do curso de Biomedicina antes de sua completa revogação pela nova determinação em 2026.",
    status: "Revogado",
    boletimNumero: "BS nº 19/2023",
    linkBoletim: "https://boletimdeservico.uff.br/boletins/bs-2023/bs-19/",
    notasInternas: "Totalmente revogada pela DTS CGB/ISNF nº 2/2026.",
    dataCriacao: "2023-10-11"
  },
  {
    id: "act-dts-inf-21-2026",
    tipoAto: "Instrução de Serviço",
    numero: "DTS INF nº 21",
    ano: 2026,
    dataAssinatura: "2026-06-12",
    orgaoEmissor: "INF",
    ementa: "Altera a composição do Colegiado do Programa de Pós-Graduação em Ensino – GES – do Instituto do Noroeste Fluminense de Educação Superior.",
    processoSei: "23069.001925/2026-02",
    relacoes: [
      {
        id: "rel-dts-inf-21-subst",
        tipoRelacao: "Revoga",
        atoDestino: "DTS INF nº 50 de 22 de Dezembro de 2025",
        detalhes: "Substitui integralmente a composição anterior do colegiado de pós-graduação."
      }
    ],
    tags: ["Pós-Graduação", "INF", "Colegiado", "Ensino", "GES"],
    conteudoResumido: "Ajusta a composição do colegiado do curso de Pós-Graduação em Ensino (GES) no INF UFF, nomeando novos representantes discentes e docentes. Substitui o ato de 2025.",
    status: "Ativo",
    boletimNumero: "BS nº 54/2026",
    linkBoletim: "https://boletimdeservico.uff.br/boletins/bs-2026/bs-54/",
    notasInternas: "Assinado pelo Diretor do Instituto, Silvio Cezar de Souza Lima.",
    dataCriacao: "2026-06-18"
  },
  {
    id: "act-dts-inf-50-2025",
    tipoAto: "Instrução de Serviço",
    numero: "DTS INF nº 50",
    ano: 2025,
    dataAssinatura: "2025-12-22",
    orgaoEmissor: "INF",
    ementa: "Define a composição do Colegiado do Programa de Pós-Graduação em Ensino – GES – do Instituto do Noroeste Fluminense de Educação Superior para o ano letivo de 2026.",
    processoSei: "23069.008122/2025-15",
    relacoes: [],
    tags: ["Pós-Graduação", "INF", "Colegiado"],
    conteudoResumido: "Vigorava definindo o colegiado de ensino da pós-graduação até ser substituída pela nova comissão instituída no Boletim nº 54 de 2026.",
    status: "Revogado",
    boletimNumero: "BS nº 153/2025",
    linkBoletim: "https://boletimdeservico.uff.br/boletins/bs-2025/bs-153/",
    notasInternas: "Revogada e substituída pela DTS INF nº 21/2026.",
    dataCriacao: "2025-12-23"
  },
  {
    id: "act-dts-inf-20-2026",
    tipoAto: "Instrução de Serviço",
    numero: "DTS INF nº 20",
    ano: 2026,
    dataAssinatura: "2026-06-10",
    orgaoEmissor: "INF",
    ementa: "Altera a Comissão de elaboração da proposta de criação do Curso de Bacharelado em Engenharia de Computação do Instituto do Noroeste Fluminense de Educação Superior - INF.",
    processoSei: "23069.001853/2026-11",
    relacoes: [
      {
        id: "rel-dts-inf-20-alt",
        tipoRelacao: "Altera",
        atoDestino: "DTS INF nº 19 de 21 de Maio de 2026",
        detalhes: "Modifica a composição da comissão designada anteriormente."
      }
    ],
    tags: ["Comissão", "Engenharia de Computação", "INF", "Criação de Curso"],
    conteudoResumido: "Modifica a comissão de desenvolvimento do novo curso de Engenharia de Computação do INF, sob coordenação de Rodrigo Erthal Wilson.",
    status: "Ativo",
    boletimNumero: "BS nº 54/2026",
    linkBoletim: "https://boletimdeservico.uff.br/boletins/bs-2026/bs-54/",
    notasInternas: "Assinado pelo Diretor Silvio Cezar de Souza Lima.",
    dataCriacao: "2026-06-18"
  },
  {
    id: "act-dts-inf-19-2026",
    tipoAto: "Instrução de Serviço",
    numero: "DTS INF nº 19",
    ano: 2026,
    dataAssinatura: "2026-05-21",
    orgaoEmissor: "INF",
    ementa: "Constitui comissão de elaboração da proposta de criação do Curso de Bacharelado em Engenharia de Computação do Instituto do Noroeste Fluminense de Educação Superior - INF.",
    processoSei: "23069.001853/2026-11",
    relacoes: [],
    tags: ["Comissão", "Engenharia de Computação", "INF"],
    conteudoResumido: "Ato originário de instauração da comissão do curso de computação. Posteriormente alterado para ajuste de membros.",
    status: "Alterado",
    boletimNumero: "BS nº 46/2026",
    linkBoletim: "https://boletimdeservico.uff.br/boletins/bs-2026/bs-46/",
    notasInternas: "Membros alterados pela DTS INF nº 20/2026.",
    dataCriacao: "2026-05-22"
  },
  {
    id: "act-portaria-1009-2026",
    tipoAto: "Portaria",
    numero: "1009",
    ano: 2026,
    dataAssinatura: "2026-06-10",
    orgaoEmissor: "Reitoria",
    ementa: "Alterar o percentual de INCENTIVO À QUALIFICAÇÃO do servidor André Hoffmann Pereira Pinto, SIAPE 3139759, investido no cargo de Biólogo, de 52% para 75% pela conclusão do curso de Doutorado em Ciências Aplicadas a Produtos para a Saúde.",
    processoSei: "23069.165470/2026-76",
    relacoes: [
      {
        id: "rel-port-1009-alt",
        tipoRelacao: "Altera",
        atoDestino: "Portaria PROGEPE nº 12 de 17 de Outubro de 2019",
        detalhes: "Reajusta o percentual de incentivo conforme titulação de doutor outorgada e homologada."
      }
    ],
    tags: ["Incentivo", "Qualificação", "Biólogo", "Doutorado", "PROGEPE", "Servidores"],
    conteudoResumido: "Amplia o incentivo à qualificação de biólogo da UFF de 52% para 75% em função da conclusão de doutorado em Ciências Aplicadas.",
    status: "Ativo",
    boletimNumero: "BS nº 54/2026",
    linkBoletim: "https://boletimdeservico.uff.br/boletins/bs-2026/bs-54/",
    notasInternas: "Assinado por Antonio Claudio Lucas da Nobrega, Reitor.",
    dataCriacao: "2026-06-18"
  },
  {
    id: "act-portaria-progepe-12-2019",
    tipoAto: "Portaria",
    numero: "12",
    ano: 2019,
    dataAssinatura: "2019-10-17",
    orgaoEmissor: "PROGEPE",
    ementa: "Concede incentivo à qualificação de 52% para servidores ativos da UFF com base em titulações de pós-graduação.",
    processoSei: "23069.009124/2019-12",
    relacoes: [],
    tags: ["Incentivo", "Qualificação", "PROGEPE"],
    conteudoResumido: "Portaria anterior que estipulava a concessão de incentivos profissionais, readequada em favor de André Hoffmann pela Portaria nº 1009 de 2026.",
    status: "Alterado",
    boletimNumero: "BS nº 21/2019",
    linkBoletim: "https://boletimdeservico.uff.br/boletins/bs-2019/bs-21/",
    notasInternas: "Modificado pela Portaria Reitoria nº 1009/2026.",
    dataCriacao: "2019-10-18"
  },
  {
    id: "act-dts-dap-39-2026",
    tipoAto: "Instrução de Serviço",
    numero: "DTS DAP nº 39",
    ano: 2026,
    dataAssinatura: "2026-06-11",
    orgaoEmissor: "DAP",
    ementa: "Lotar no Hospital Universitário Antonio Pedro (HUAP) a servidora Gabriela Pizelli Mocco Grillo, ocupante do cargo de Enfermeiro/Área, redistribuída da Universidade Federal do Rio de Janeiro.",
    processoSei: "23069.159612/2025-85",
    relacoes: [],
    tags: ["Lotação", "HUAP", "Enfermeiro", "Redistribuição", "DAP", "Servidores"],
    conteudoResumido: "Determina a lotação oficial de enfermeira redistribuída da UFRJ para o Hospital Universitário Antonio Pedro (HUAP).",
    status: "Ativo",
    boletimNumero: "BS nº 54/2026",
    linkBoletim: "https://boletimdeservico.uff.br/boletins/bs-2026/bs-54/",
    notasInternas: "Assinado pelo Diretor de Administração de Pessoal Gabriel Barbosa Gomes de Oliveira Filho.",
    dataCriacao: "2026-06-18"
  },
  {
    id: "act-portaria-1024-2026",
    tipoAto: "Portaria",
    numero: "1024",
    ano: 2026,
    dataAssinatura: "2026-06-11",
    orgaoEmissor: "Reitoria",
    ementa: "Reconduzir a Comissão para proceder à complementação da apuração da SINDICÂNCIA, instaurada através da Portaria nº 3128, de 14 de novembro de 2025.",
    processoSei: "23069.001197/2024-91",
    relacoes: [
      {
        id: "rel-port-1024-alt",
        tipoRelacao: "Altera",
        atoDestino: "Portaria nº 3128 de 14 de Novembro de 2025",
        detalhes: "Complementa e prorroga os prazos legais da comissão de sindicância por 30 dias."
      }
    ],
    tags: ["Sindicância", "Recondução", "Comissão", "Apuração", "Reitoria"],
    conteudoResumido: "Prorroga o funcionamento e reconduz a comissão apuradora de sindicância de novembro de 2025 para finalização dos trâmites administrativos.",
    status: "Ativo",
    boletimNumero: "BS nº 54/2026",
    linkBoletim: "https://boletimdeservico.uff.br/boletins/bs-2026/bs-54/",
    notasInternas: "Assinado por Antonio Claudio Lucas da Nobrega, Reitor.",
    dataCriacao: "2026-06-18"
  },
  {
    id: "act-portaria-3128-2025",
    tipoAto: "Portaria",
    numero: "3128",
    ano: 2025,
    dataAssinatura: "2025-11-14",
    orgaoEmissor: "Reitoria",
    ementa: "Instaura Comissão de Sindicância para apurar irregularidades administrativas apontadas em processo de auditoria interna.",
    processoSei: "23069.001197/2024-91",
    relacoes: [],
    tags: ["Sindicância", "Comissão", "Auditoria"],
    conteudoResumido: "Ato original de abertura da sindicância. Teve os prazos prorrogados em junho de 2026 pela Portaria nº 1024.",
    status: "Alterado",
    boletimNumero: "BS nº 142/2025",
    linkBoletim: "https://boletimdeservico.uff.br/boletins/bs-2025/bs-142/",
    notasInternas: "Alvo de prorrogação administrativa em 2026.",
    dataCriacao: "2025-11-15"
  },
  {
    id: "act-res-cepex-004-ar-2026",
    tipoAto: "Resolução",
    numero: "004 AR",
    ano: 2026,
    dataAssinatura: "2026-06-10",
    orgaoEmissor: "CEPEx",
    ementa: "Aprova ad referendum a liberação da exigência de contratação de dois terços de pessoas vinculadas à UFF para a realização do projeto de pesquisa 'Apoio às ações de formação em direitos de educadores e de mobilização jurídica do Observatório Nacional da Violência contra Educadores/as (ONVE)'.",
    processoSei: "23069.167694/2026-12",
    relacoes: [],
    tags: ["Pesquisa", "ONVE", "Contratação", "CEPEx", "Aprovação"],
    conteudoResumido: "Dispensa a exigência de quórum de dois terços de servidores da UFF para contratações do projeto do Observatório contra a Violência a Educadores.",
    status: "Ativo",
    boletimNumero: "BS nº 53/2026",
    linkBoletim: "https://boletimdeservico.uff.br/boletins/bs-2026/bs-53/",
    notasInternas: "Autorizado ad referendum pelo Presidente em Exercício, Fabio Barboza Passos.",
    dataCriacao: "2026-06-15"
  },
  {
    id: "act-res-cepex-5926-2026",
    tipoAto: "Resolução",
    numero: "5.926",
    ano: 2026,
    dataAssinatura: "2026-06-03",
    orgaoEmissor: "CEPEx",
    ementa: "Dispõe sobre a Prorrogação de Validade de Concurso na área de conhecimento Inspeção Sanitária de Produtos de Origem Animal - Edital de Abertura 140/2021.",
    processoSei: "23069.159168/2026-89",
    relacoes: [],
    tags: ["Concurso", "Prorrogação", "MTA", "Tecnologia de Alimentos", "Docente"],
    conteudoResumido: "Prorroga por mais 2 anos a vigência do concurso público homologado em 2024 para contratação de docentes do Departamento de Tecnologia dos Alimentos (MTA).",
    status: "Ativo",
    boletimNumero: "BS nº 53/2026",
    linkBoletim: "https://boletimdeservico.uff.br/boletins/bs-2026/bs-53/",
    notasInternas: "Assinado eletronicamente pelo Vice-Reitor em exercício, Fabio Barboza Passos.",
    dataCriacao: "2026-06-15"
  },
  {
    id: "act-res-cuv-707-2026",
    tipoAto: "Resolução",
    numero: "707",
    ano: 2026,
    dataAssinatura: "2026-06-03",
    orgaoEmissor: "CUV",
    ementa: "Homologa o resultado da Eleição para Representação Docente nas Câmaras Especializadas do Conselho Universitário (2026-2027).",
    processoSei: "23069.167534/2026-73",
    relacoes: [],
    tags: ["Eleição", "CUV", "Conselho", "Câmaras", "Representação Docente"],
    conteudoResumido: "Aprova os resultados oficiais do pleito docente das câmaras técnicas permanentes de Legislação, Orçamento e Administração do CUV.",
    status: "Ativo",
    boletimNumero: "BS nº 53/2026",
    linkBoletim: "https://boletimdeservico.uff.br/boletins/bs-2026/bs-53/",
    notasInternas: "Homologado pelo Reitor Antonio Claudio Lucas da Nobrega, na qualidade de Presidente do CUV.",
    dataCriacao: "2026-06-15"
  }
];

export const SAMPLE_TEXTS_TO_PARSE = [
  {
    title: "Portaria da Reitoria - Designação de Comissão (Exemplo)",
    text: `UNIVERSIDADE FEDERAL FLUMINENSE
PORTARIA UFF Nº 68.614, DE 15 DE JUNHO DE 2026
EMENTA: Designa comissão permanente de avaliação de documentos de arquivo da reitoria.

O REITOR da Universidade Federal Fluminense, no uso de suas atribuições legais e regimentais, e tendo em vista o que consta do Processo SEI nº 23069.005182/2026-44,

RESOLVE:

Art. 1º - Designar os servidores abaixo relacionados para, sob a presidência do primeiro, constituírem a Comissão de Avaliação de Documentos de Arquivo (CADA):
- MARCOS SILVA (matrícula SIAPE 1234567) - Presidente
- ANA BEATRIZ SOUZA (matrícula SIAPE 2345678) - Membro
- CARLOS ROBERTO (matrícula SIAPE 3456789) - Membro

Art. 2º - Esta portaria altera a Portaria UFF nº 65.231, de 10 de Março de 2024, que passa a vigorar acrescida de novos representantes técnicos da Superintendência de Arquivos da UFF.

Art. 3º - Esta portaria entra em vigor na data de sua publicação no Boletim de Serviço da UFF.

Niterói, 15 de junho de 2026.
ANTONIO CLAUDIO LUCAS DA SILVA
Reitor`
  },
  {
    title: "Resolução do CEPEx - Regulamento Acadêmico (Exemplo)",
    text: `CONSELHO DE ENSINO, PESQUISA E EXTENSÃO (CEPEx)
RESOLUÇÃO CEPEx Nº 09/2026, DE 22 DE MAIO DE 2026
EMENTA: Aprova o regulamento de mobilidade estudantil internacional de graduação da UFF e revoga a Resolução CEPEx nº 14/2015.

O Conselho de Ensino, Pesquisa e Extensão da Universidade Federal Fluminense, no uso de suas competências, e considerando as deliberações em plenário em sua 4ª Sessão Ordinária realizada em 18 de maio de 2026, com autos sob Processo SEI nº 23069.001948/2026-90,

RESOLVE:

Art. 1º - Aprovar o Regulamento de Mobilidade Estudantil Internacional para estudantes de graduação presencial da UFF, na forma do anexo a esta Resolução.

Art. 2º - Fica expressamente revogada a Resolução CEPEx nº 14/2015, de 12 de Setembro de 2015, bem como todas as disposições em contrário que disciplinavam a mobilidade discente internacional no período anterior.

Art. 3º - Esta Resolução entra em vigor a partir do primeiro dia útil do mês subsequente ao de sua publicação no Boletim de Serviço.

Sala das Sessões, 22 de maio de 2026.
ANTONIO CLAUDIO LUCAS DA SILVA
Presidente do Colegiado`
  },
  {
    title: "Instrução de Serviço da PROGEPE - Trabalho Remoto (Exemplo)",
    text: `PRÓ-REITORIA DE GESTÃO DE PESSOAS (PROGEPE)
INSTRUÇÃO DE SERVIÇO PROGEPE Nº 08/2026, DE 12 DE JANEIRO DE 2026
EMENTA: Estabelece normas complementares de fluxo e aprovação para o Programa de Gestão de Teletrabalho na UFF.

A PRÓ-REITORA DE GESTÃO DE PESSOAS da Universidade Federal Fluminense, no uso de suas atribuições subdelegadas pela Portaria nº 48.912/2021, e com fulcro no Processo Administrativo SEI nº 23069.000412/2026-11,

RESOLVE:

Art. 1º - Ficam instituídas as normas complementares de fluxo para as chefias homologarem planos de trabalho individual de teletrabalho parcial ou total.

Art. 2º - Esta Instrução de Serviço complementa e regulamenta o disposto na Instrução de Serviço PROGEPE nº 02/2025, especificamente quanto aos relatórios de aferição mensal de entregas pactuadas.

Art. 3º - Os servidores atualmente cadastrados terão 30 dias para se adequarem aos novos formulários de relatório disponíveis no módulo correspondente do SEI.

Niterói, 12 de janeiro de 2026.
MARIA ALICE RIBEIRO DE SOUZA
Pró-Reitora de Gestão de Pessoas`
  }
];
