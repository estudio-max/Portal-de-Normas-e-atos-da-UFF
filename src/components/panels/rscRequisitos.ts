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

const semAc = (s: string) =>
  (s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

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
const RE_META = /^\s*(retifica|torna\s+sem\s+efeito|revoga|anula|republica|convalida)/i;
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
const RE_COLEGIADO =
  /(comiss[õo]es?|comit[êe]s?|grupos?\s+de\s+trabalho|c[âa]maras?|conselhos?|bancas?|sindic[âa]ncias?|processos?\s+administrativos?\s+disciplinares?|tomadas?\s+de\s+contas|mesas?\s+receptoras?|n[úu]cleos?\s+docentes?\s+estruturantes?)/;
// a pessoa tem que INTEGRAR o colegiado, não apenas ser citada perto dele
const RE_INTEGRA =
  /(para\s+(compor|integrar|constituir|comporem)|como\s+membros?|membros?\s+d[aeo]s?|comporem|integrantes?\s+d[aeo]s?|componentes?\s+(para|d[aeo]s?)|sob\s+a\s+presid[êe]ncia|secretari[ae]|respons[áa]vel\s+pela\s+instala|representantes?\s+d)/;
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

const RE_DESIGNA =
  /\b(designa|designar|designacao|constitui|constituir|institui|instituir|nomeia|nomear)/;

/** Requisitos que a EMENTA do ato sinaliza. Nunca devolve 'V' — ver o módulo. */
export function requisitosDoAto(a: ds.DossieAto): Requisito[] {
  const bruta = a.ementa || '';
  if (inutilizavel(bruta) || RE_META.test(bruta.trim()) || RE_CITA.test(semAc(bruta))) return [];
  const disp = soODispositivo(bruta);
  if (inutilizavel(disp)) return [];
  const e = semAc(disp);
  if (RE_POSSE.test(e)) return [];

  const reqs = new Set<Requisito>();
  const designa = RE_DESIGNA.test(e);
  const revisaoDisc = RE_REVISAO_DISCIPLINA.test(e);
  if (designa && !revisaoDisc) {
    if (RE_COLEGIADO.test(e) && RE_INTEGRA.test(e)) reqs.add('I');
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
