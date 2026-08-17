// Requisitos do RSC-PCCTAE — INSTRUÇÃO NORMATIVA GAR/RET/UFF nº 129, de 24 de
// julho de 2026 (BS nº 66/2026, Seção III), que regulamenta na UFF a Lei
// 11.091/2005 (arts. 12-B a 12-I, redação da Lei 15.367/2026) e o Decreto
// 13.048/2026.
//
// ─────────────────────────────────────────────────────────────────────────────
// O QUE ESTE MÓDULO AFIRMA — E O QUE ELE NÃO PODE AFIRMAR
//
// Ele NÃO diz que um ato é "elegível", e isso não é excesso de cautela: é o que
// a própria IN determina, em três dispositivos que se somam.
//
//   Art. 15 §8º e art. 20 §3º — "O atendimento aos requisitos objetivos
//     previstos na legislação NÃO ASSEGURA, POR SI SÓ, a concessão", cabendo à
//     CRSC-UFF a decisão fundamentada.
//   Art. 20 §2º — não se pontua atividade que represente "exclusivamente o
//     desempenho ordinário das atribuições legais do cargo". Isso depende do
//     memorial descritivo, não do ato: o Boletim publica a designação, nunca o
//     que ela exigiu de quem a cumpriu.
//   Art. 15 §6º — vedada a dupla contagem: a mesma atividade só entra uma vez,
//     ainda que corresponda a mais de um requisito.
//
// O que ele afirma é o passo anterior, e esse é sólido: **o ato publicado é do
// TIPO que o Requisito N descreve**. Isso tem valor prático direto porque o
// art. 19, parágrafo único, I da mesma IN lista, entre os documentos válidos de
// comprovação, exatamente "portarias, resoluções ou atos de designação ou
// nomeação editados pela Instituição Federal de Ensino" — que é o que esta aba
// entrega, com a referência do BS.
//
// Ou seja: o selo é uma ISCA DE CONFERÊNCIA, não um veredito. Quem decide é a
// CRSC-UFF; quem escreve o memorial é a pessoa.
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ O SELO ESTÁ DESLIGADO DESDE 17/08/2026 — DECISÃO DA GESTÃO, NÃO DEFEITO
//
// A gestora da PROGEPE avaliou que exibir o selo cria risco de o servidor
// entender que o direito está reconhecido e cobrá-lo — **mesmo com o texto
// dizendo o contrário na tela e no PDF**. Essa leitura é dela, não do portal, e
// é ela quem responde pelo processo de RSC na universidade.
//
// O que isso ensina, e vale além deste caso: quando o mal-entendido acontece
// apesar do aviso escrito, o aviso não é o remédio. O portal pode afirmar "isto
// não é decisão" com todas as letras e ainda assim ser lido como decisão,
// porque quem lê está procurando uma resposta, não uma ressalva.
//
// O QUE FOI DESLIGADO: só a EXIBIÇÃO — o selo na tela, o resumo no topo, a
// coluna e a legenda no PDF, e os passos da ajuda que os descrevem.
//
// O QUE FICA, DE PROPÓSITO: este classificador inteiro, com os testes de
// regressão (`tools/teste_rsc_requisitos.ts`, 45 casos) e a metodologia
// (`docs/METODOLOGIA-RSC.md`). Apagar custaria a medição que já foi paga — foi
// aqui que se descobriu o regex morto no singular (cobertura de 158 para 1.169)
// e o bloco de assinatura (101 dos 112 falsos do Requisito V). Se a decisão for
// revista, religar é trocar `false` por `true` nesta linha.
export const SELO_RSC_ATIVO = false;
//
// ─────────────────────────────────────────────────────────────────────────────
// LIMITE DE ALCANCE, medido em 4.000 atos de 2025-2026 do acervo
//
// Só três dos seis requisitos são detectáveis a partir do que o Boletim publica:
//   I  — colegiados (banca, comissão, comitê, GT, núcleo, mesa receptora)
//   IV — responsabilidade técnico-administrativa (fiscal/gestor de contrato,
//        equipe de planejamento da contratação)
//   V  — CD/FG, e este NÃO sai da ementa (ver `requisitosDaFuncao`)
//
// II (projetos), III (premiação) e VI (produção científica) ficam de fora de
// propósito: não viram ato de designação no BS. Comprovam-se por certificado,
// publicação, declaração — documentos que esta aba não tem e não deve fingir ter.
// Silêncio honesto; a ausência de selo nunca significa ausência de direito.

import * as ds from '../../dataSource';

export type Requisito = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';

export const REQUISITOS: Record<Requisito, { titulo: string; anexo: string }> = {
  I: {
    titulo: 'Participação em grupos de trabalho, comissões, comitês, núcleos, representações ou similares',
    anexo: 'Anexo I',
  },
  II: {
    titulo: 'Participação e atuação em projetos institucionais, na gestão, no apoio ao ensino, à pesquisa, à extensão, de inovação e assistência especializada',
    anexo: 'Anexo II',
  },
  III: {
    titulo: 'Recebimento de premiação em evento de reconhecimento público por projetos implementados na administração pública',
    anexo: 'Anexo III',
  },
  IV: {
    titulo: 'Designação para assunção de responsabilidades técnico-administrativas ou especializadas',
    anexo: 'Anexo IV',
  },
  V: {
    titulo: 'Exercício de função ou cargo de direção ou de assessoramento institucional',
    anexo: 'Anexo V',
  },
  VI: {
    titulo: 'Produção, prospecção e difusão de conhecimento científico ou técnico',
    anexo: 'Anexo VI',
  },
};

// O PDF do Boletim usa ligaduras tipográficas que o extrator às vezes decodifica
// como caractere solto: "ConsƟtuir Comissão Interna", "Processo SeleƟvo",
// "InsƟtuto". O `Ɵ` está no lugar de "ti". Medido: 23 ementas em 4.000 (0,6%),
// e sem esta troca elas ficam invisíveis para qualquer padrão — inclusive
// "ConsƟtuir Comissão", que é Requisito I legítimo. Troca determinística: `Ɵ`
// não é letra do português, então não há como confundir com texto real.
//
// NÃO cobre o outro defeito de OCR, o espaçamento no meio da palavra
// ("Const it ui o Grupo Gest or"). Ali a correção exigiria recolar fragmentos, e
// o detector que tentei marcou 631 ementas na amostra sendo que quase todas eram
// texto normal ("de 03 de" casa o mesmo padrão). Fica como limitação conhecida:
// esses atos não recebem selo e caem na conferência humana, que é o lado seguro.
const LIGADURAS: [RegExp, string][] = [
  [/Ɵ/g, 'ti'], [/ﬁ/g, 'fi'], [/ﬂ/g, 'fl'], [/ﬀ/g, 'ff'],
];
const semAc = (s: string) => {
  let t = s || '';
  for (const [re, sub] of LIGADURAS) t = t.replace(re, sub);
  return t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
};

// ── guarda 0: cortar o BLOCO DE ASSINATURA ───────────────────────────────────
// A ementa capturada arrasta com frequência o preâmbulo de quem ASSINA ("A
// SUBSTITUTA EVENTUAL DO PRÓ-REITOR..., no uso da delegação de competência").
// Medido: sem este corte, "Designação de Solicitantes de Viagens no SCDP. A
// SUBSTITUTA EVENTUAL DO PRÓ-REITOR" era marcada como Requisito V pelo cargo de
// QUEM ASSINOU. É a armadilha-mãe da METODOLOGIA-ODS — o termo mora no nome de
// alguém, não no dispositivo — e sozinha respondia por 101 dos 112 falsos.
const RE_DELEGACAO = /\bno\s+uso\s+d[ae]\s+(delega|atribui)/i;
const RE_ASSINATURA =
  /(?:\.\s*)?\b(a|o)\s+(substitut[oa]\s+eventual|pr[oó]-?reitor[a]?|reitor[a]?|subchefe|chefia|coordena[çc][ãa]o|diretor[a]?\s+d[oe]\s+departamento|superintendente)\b[\s\S]{0,400}$/i;

function soODispositivo(ementa: string): string {
  let e = ementa || '';
  const m = RE_DELEGACAO.exec(e);
  if (m) {
    const corte = e.lastIndexOf('.', m.index);
    e = corte > 20 ? e.slice(0, corte + 1) : e.slice(0, m.index);
  }
  return e.replace(RE_ASSINATURA, '').trim();
}

// ── guarda 1: o ato tem que DISPOR, não citar ────────────────────────────────
// Regra do domínio: "classifique pelo dispositivo, não por menção". Retificação
// que cita designação anterior ("...portaria X, QUE DESIGNOU...") não designa.
// Ato que fala SOBRE outro ato, ou que divulga o desfecho de um processo. O
// segundo grupo (homologação/proclamação/resultado/consulta eleitoral) é ato
// EMITIDO pela comissão eleitoral: ela aparece na ementa como autora, e o texto
// costuma trazer "designada pela DTS nº…", que casaria o verbo de designação.
const RE_META =
  /^\s*(retifica|errata|torna\s+sem\s+efeito|revoga|anula|republica|convalida|homologa[çc][ãa]o|proclama[çc][ãa]o|resultado|consulta\s+eleitoral)/i;
const RE_CITA = /\bque\s+(designou|constituiu|instituiu|nomeou|criou)\b/;

// ── guarda 2: ementa inutilizável / fragmento ────────────────────────────────
// Espelha politica_ementa_inutilizavel(). Sem ela, o recorte "publicada no BS
// de ,SEÇÃO IV, P.078, em atenção às Resoluções CUV..." entrava como Requisito I.
const FRAGMENTOS: RegExp[] = [
  /^art\.?\s*\d/i,
  /^(cap[íi]tulo|se[çc][ãa]o|anexo|t[íi]tulo)\b/i,
  /^publicad[oa]\b/i,
  /^(que|considerando|resolve|a\s+saber)\b/i,
  /^[a-zà-ú]/,          // começa em minúscula = recorte no meio da frase
  /^[)\]•●▪§]/,         // pontuação órfã
];
const inutilizavel = (e: string) =>
  !e || e.trim().length < 12 || FRAGMENTOS.some(p => p.test(e.trim()));

// ── guarda 3: POSSE de aprovado não é atuação em banca ───────────────────────
// "Nomeia Felipe ... habilitado e classificado em Concurso Público" é a posse do
// candidato aprovado, não participação na comissão examinadora.
const RE_POSSE =
  /\b(habilitad|classificad|aprovad)[oa]s?\b[\s\S]{0,60}\bconcurso|\bnomeia\b[\s\S]{0,120}\b(habilitad|classificad)[oa]/;

// ── Requisito I ──────────────────────────────────────────────────────────────
// ATENÇÃO ao escrever estes padrões: eles rodam SOBRE O TEXTO JÁ SEM ACENTO
// (ver `semAc`). Escrever `comiss[õo]es?` — como esteve até 06/08/2026 — deixa o
// termo mais importante do requisito MORTO no singular, porque "comissão" chega
// aqui como "comissao" e `comiss[õo]` nunca casa `comissa`. O defeito era
// silencioso: os poucos casos que passavam entravam pelo caminho do certame
// (`RE_PAPEL_CERTAME`, que usa `[ãa]`). Medido: a correção levou a cobertura de
// 143 para 512 num universo de 1.204 candidatos. Prefira classes que incluam a
// vogal sem acento, ou escreva o termo já normalizado.
const RE_COLEGIADO =
  /(comiss[ãa]o|comiss[õo]es|comit[êe]s?|grupos?\s+(de\s+trabalho|gestor(es)?)|c[âa]maras?|conselhos?|colegiados?|bancas?|sindic[âa]ncias?|processos?\s+administrativos?\s+disciplinares?|tomadas?\s+de\s+contas|mesas?\s+receptoras?|n[úu]cleos?\s+docentes?\s+estruturantes?)/;
// Exigir estrutura explícita de composição ("para compor", "como membros") foi
// tentado e REPROVADO: a forma dominante no Boletim é direta — "Designa a
// Comissão X", "Constitui Grupo de Trabalho Y" —, e a exigência descartava a
// maioria dos atos de colegiado do acervo. O colegiado como objeto do verbo de
// designação basta; as guardas abaixo é que separam o que não é participação.

// GUARDA: o ato é DA comissão, não sobre ela. "A Comissão Eleitoral Local,
// instituída pela DTS nº 13, vem tornar público o resultado…" — aqui o
// colegiado é quem ASSINA. Mesma família da guarda do bloco de assinatura.
//
// Duas formas, porque exigir só o verbo de publicação deixava passar o caso em
// que ele vem muito depois do preâmbulo ("…em conformidade com o Edital 01/2026,
// publicado no BS nº 40, de acordo com o Regulamento Geral das Consultas…").
// Abrir com o artigo + nome do colegiado + "instituída/designada por" já é
// preâmbulo: um ato que DESIGNA colegiado começa pelo verbo, não pelo artigo.
const RE_ATO_DO_COLEGIADO =
  /^\s*(a|o)\s+(comiss[ãa]o|comit[êe]|c[âa]mara|conselho|mesa)\b(?:[\s\S]{0,220}\b(torna\s+p[úu]blic|vem\s+tornar|homologa|proclama|divulga|resultado\s+final|comunica)|[\s\S]{0,80}\b(institu[íi]d|designad|criad)[oa]s?\s+(pel[ao]s?|por)\b)/i;

// GUARDA: "Designa dentre os membros do Colegiado, Fulano" é a escolha de um
// COORDENADOR a partir do colegiado — o `ato_funcao` já o marca como Requisito
// V. Marcar também o ato como Requisito I duplicaria o mesmo fato na tela, e o
// art. 15 §6º veda contar a mesma atividade duas vezes.
const RE_ESCOLHA_DENTRE = /\bdentre\s+os\s+membros\b/;

// GUARDA: designação para CHEFIAR uma unidade que por acaso se chama núcleo ou
// comissão é Requisito V (a função capta), não participação em colegiado.
const RE_CHEFIA_DE = /\b(chefia|dire[çc][ãa]o|coordena[çc][ãa]o)\s+d[aeo]s?\s+(n[úu]cleo|comiss|comit)/;
const RE_CERTAME =
  /(concursos?|vestibular|exames?\s+de\s+sele[çc][ãa]o|processos?\s+seletivos?)/;
const RE_PAPEL_CERTAME =
  /(banca|comiss[ãa]o\s+recursal|comiss[ãa]o\s+examinadora|secretari|fiscaliza|aplica[çc][ãa]o\s+de\s+provas?|elabora[çc][ãa]o[\s\S]{0,30}provas?)/;
// revisão de prova/nota de DISCIPLINA é avaliação acadêmica de aluno; o Anexo I
// item 6 fala de prova "de exame de seleção, vestibular ou concursos".
const RE_REVISAO_DISCIPLINA = /revis[ãa]o\s+(de\s+)?(prova|nota)/;

// ── Requisito IV ─────────────────────────────────────────────────────────────
// Anexo IV, itens 2 e 3. Medido: 61 de 61 corretos na amostra.
const RE_REQ_IV =
  /(fiscal(iza[çc][ãa]o)?\s+(d[oe]s?\s+)?contratos?|gest[ãa]o\s+e\s+fiscaliza|gestor(es)?\s+d[oe]s?\s+contratos?|fiscais?\s+d[oe]s?\s+contratos?|equipes?\s+de\s+planejamento\s+d[ae]\s+contrata[çc][ãa]o|pregoeir[oa]s?|agentes?\s+de\s+contrata[çc][ãa]o)/;

// Verbos que CONSTITUEM o vínculo com o colegiado. A lista cresceu em
// 06/08/2026 com variações trazidas da leitura do Boletim: `instaura` (comissão
// de sindicância/PAD), `cria`, `reconduz` (recondução de comissão em curso) e
// `altera a composição` — todos designam alguém, e nenhum casava antes.
//
// `altera` entra SÓ com "composição" junto, nunca solto: "Altera o cargo de
// direção CD-4 para CD-3" é ato sobre o cargo, e foi um dos falsos positivos
// medidos do Requisito V.
const RE_DESIGNA =
  /\b(designa|designar|designacao|constitui|constituir|institui|instituir|instaura|instaurar|nomeia|nomear|cria|criar|recondu)/;

// Ato que mexe na COMPOSIÇÃO de um colegiado designa gente, mesmo abrindo por
// verbo de correção. "Retificação dos membros integrantes … da Comissão
// Permanente de Flexibilização de Jornada" põe ou troca alguém lá dentro — vale
// tanto quanto "Altera a composição do Comitê", que já valia.
//
// Não confundir com `RE_CITA`: "Retifica a Portaria X, QUE DESIGNOU os membros…"
// apenas se refere a outro ato, e continua barrado — a checagem de citação roda
// antes desta.
const RE_MEXE_COMPOSICAO =
  /\b(retifica|retificacao|altera|alterar|alteracao|modifica|modificar)\b[\s\S]{0,90}\b(membros?|integrantes?|composi[çc][ãa]o)\b/;

/** Requisitos que a EMENTA do ato sinaliza. Nunca devolve 'V' — ver o módulo. */
export function requisitosDoAto(a: ds.DossieAto): Requisito[] {
  const bruta = a.ementa || '';
  if (inutilizavel(bruta)) return [];
  // A citação a outro ato barra sempre — inclusive "Retifica a Portaria X, QUE
  // DESIGNOU os membros…", que fala SOBRE uma designação alheia.
  if (RE_CITA.test(semAc(bruta))) return [];
  // Já o verbo de correção só barra quando NÃO mexe na composição de colegiado:
  // "Retificação dos membros integrantes da Comissão Permanente de
  // Flexibilização de Jornada" troca gente lá dentro e é vínculo tanto quanto
  // "Altera a composição do Comitê".
  const mexeComposicao = RE_MEXE_COMPOSICAO.test(semAc(bruta));
  if (RE_META.test(bruta.trim()) && !mexeComposicao) return [];
  const disp = soODispositivo(bruta);
  if (inutilizavel(disp)) return [];
  const e = semAc(disp);
  if (RE_POSSE.test(e)) return [];

  const reqs = new Set<Requisito>();
  const designa = RE_DESIGNA.test(e) || RE_MEXE_COMPOSICAO.test(e);
  const revisaoDisc = RE_REVISAO_DISCIPLINA.test(e);
  const atoDoColegiado = RE_ATO_DO_COLEGIADO.test(disp);
  if (designa && !revisaoDisc && !atoDoColegiado
      && !RE_CHEFIA_DE.test(e) && !RE_ESCOLHA_DENTRE.test(e)) {
    // O colegiado como OBJETO do verbo já basta ("Designa a Comissão X").
    // `RE_INTEGRA` deixou de ser exigência e virou reforço: ele cobre a forma
    // em que o colegiado aparece longe do verbo ("Designa os servidores
    // técnico-administrativos e docentes para composição da Comissão…").
    if (RE_COLEGIADO.test(e)) reqs.add('I');
    if (RE_CERTAME.test(e) && RE_PAPEL_CERTAME.test(e)) reqs.add('I');
  }
  if (RE_REQ_IV.test(e)) reqs.add('IV');
  return [...reqs];
}

/**
 * Requisito V. Sai do DADO ESTRUTURADO, nunca da ementa.
 *
 * Medido: pela ementa, 11 de 11 marcações eram falso positivo — "Altera o cargo
 * de direção CD-4 para CD-3" (ato SOBRE o cargo, não designação de pessoa) e
 * "Distribuição de 9 Funções Gratificadas na estrutura organizacional" (cria
 * VAGA, não designa ninguém). Já `ato_funcao` foi lido do dispositivo pelo
 * extrator com a whitelist `_NUC_CARGO`, que é branca de propósito e só aceita
 * cargo de direção/chefia.
 *
 * `dispensar` não marca: a dispensa encerra o exercício, não o comprova. Marcar
 * as duas pontas do mesmo exercício convidaria à dupla contagem que o art. 15
 * §6º veda — a dispensa serve para delimitar o período, e o painel já a mostra.
 */
export function requisitosDaFuncao(f: ds.DossieFuncao): Requisito[] {
  return f.acao === 'designar' ? ['V'] : [];
}
