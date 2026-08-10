// Regressão do classificador de Requisitos do RSC-PCCTAE.
//
// Cada caso aqui é uma ISCA REAL: ou um acerto que precisa continuar acertando,
// ou um falso positivo que a medição de 06/08/2026 (4.000 atos de 2025-2026 do
// acervo) encontrou e que uma guarda passou a barrar. Ementas copiadas do
// Boletim, não inventadas.
//
// Rodar:  npx tsx tools/teste_rsc_requisitos.ts
import { requisitosDoAto, requisitosDaFuncao, REQUISITOS } from '../src/components/panels/rscRequisitos';

type Caso = { ementa: string; esperado: string[]; porque: string };

const CASOS: Caso[] = [
  // ── REQUISITO I: acertos ───────────────────────────────────────────────────
  { ementa: 'Designa os servidores para compor o Comitê Gestor responsável pela organização da Agenda Acadêmica UFF/SNCT 2026.',
    esperado: ['I'], porque: 'comitê + "para compor" = Anexo I item 3' },
  { ementa: 'Designação de Membros para compor Comissão de Sindicância/apuração de fato ocorrido nas dependências da Faculdade de Odontologia CMO/UFF.',
    esperado: ['I'], porque: 'sindicância é explícita no Anexo I item 4' },
  { ementa: 'Designar os membros para comporem a Mesa Receptora para consulta da identificação das preferências da comunidade para escolha de Reitor e Vice-Reitor - Quadriênio 2022-2026 - 1º Turno.',
    esperado: ['I'], porque: 'mesa receptora = colegiado formalmente instituído' },
  { ementa: 'Designa servidores para secretariar Comissões Examinadoras de Concurso Público e Processos de Seleção Simplificada no âmbito do Departamento de Ciências da Natureza.',
    esperado: ['I'], porque: 'é por aqui que o TAE entra no Requisito I (Anexo I item 5)' },
  { ementa: 'Designar os integrantes das Câmaras Especializadas do Conselho de Ensino, Pesquisa e Extensão da UFF para mandato de 1 (um) ano, conforme art. 7º do Regimento.',
    esperado: ['I'], porque: 'órgão colegiado superior = Anexo I item 1' },
  { ementa: 'Designação de Membros do Núcleo Docente Estruturante do Curso de Bacharelado em Inteligência Artificial e Ciência de Dados.',
    esperado: ['I'], porque: 'NDE é núcleo formalmente instituído' },

  // ── REQUISITO IV: acertos ──────────────────────────────────────────────────
  { ementa: 'Designa os membros da Gestão e Fiscalização Contrato n° 65/2026 celebrado entre a UFF e a empresa VALID CERTIFICADORA DIGITAL LTDA.',
    esperado: ['IV'], porque: 'gestão/fiscalização de contrato = Anexo IV item 3' },
  { ementa: 'Designação de equipe de planejamento da contratação de serviço de engenharia.',
    esperado: ['IV'], porque: 'equipe de planejamento da contratação = Anexo IV item 2' },
  { ementa: 'Designação de Fiscal de Contratos dentro do Sistema de Concessão de Diárias e Passagens (SCDP), no âmbito da UFF.',
    esperado: ['IV'], porque: 'fiscal de contrato' },

  // ── FALSOS POSITIVOS que as guardas barram ─────────────────────────────────
  // (1) bloco de assinatura — 101 dos 112 falsos do Requisito V vinham daqui
  { ementa: 'Designação de Solicitantes de Viagens dentro do Sistema de Concessão de Diárias e Passagens (SCDP), no âmbito da UFF. A SUBSTITUTA EVENTUAL DO PRÓ-REITOR DE PLANEJAMENTO, no uso da delegação de competência...',
    esperado: [], porque: 'GUARDA: "SUBSTITUTA EVENTUAL" é quem ASSINA, não quem foi designado' },
  // (2) ato SOBRE o cargo não é designação de pessoa
  { ementa: 'Altera o cargo de direção CD-4 para o cargo de direção CD-3 do titular do cargo de Diretora da Faculdade de Nutrição Emília de Jesus Ferreiro.',
    esperado: [], porque: 'GUARDA: altera nível do CD; não designa ninguém (e V não sai da ementa)' },
  // (3) distribuição de vaga não é designação de pessoa
  { ementa: 'Distribuição de 9 (nove) Funções Gratificadas, de nível 2, (FG-2) na estrutura organizacional da UFF.',
    esperado: [], porque: 'GUARDA: cria VAGA de FG na estrutura, não designa servidor' },
  // (4) posse de aprovado em concurso não é atuação em banca
  { ementa: 'Nomeia Felipe Taumaturgo Rodrigues de Azevedo habilitado e classificado em Concurso Público de Provas e Títulos, aberto pelo Edital nº 34/2024.',
    esperado: [], porque: 'GUARDA: é a POSSE do aprovado, não participação na comissão examinadora' },
  // (5) fragmento de ementa
  { ementa: 'publicada no BS de ,SEÇÃO IV, P.078, em atenção às Resoluções CUV nº 104/1997 e de acordo com as Decisões.',
    esperado: [], porque: 'GUARDA: fragmento de recorte, não ementa' },
  // (6) menção, não dispositivo
  { ementa: 'Retifica a Portaria nº 68.100/2026, que designou os membros da Comissão de Ética.',
    esperado: [], porque: 'GUARDA: retificação que CITA designação anterior não designa' },
  // (7) revisão de prova de disciplina não é certame
  { ementa: 'Designa os membros da Banca para revisão de prova da disciplina de Fisiologia VII da aluna Letícia Aguiar Casagrande Rodrigues.',
    esperado: [], porque: 'GUARDA: avaliação acadêmica de aluno, não exame de seleção' },
];

let ok = 0, mau = 0;
for (const c of CASOS) {
  const got = requisitosDoAto({ ementa: c.ementa } as never).sort();
  const esp = [...c.esperado].sort();
  const bom = JSON.stringify(got) === JSON.stringify(esp);
  bom ? ok++ : mau++;
  if (!bom) {
    console.log(`FALHA  esperado=[${esp}] obtido=[${got}]`);
    console.log(`       ${c.porque}`);
    console.log(`       "${c.ementa.slice(0, 110)}"`);
  }
}

// Requisito V vem do dado estruturado, e só a designação marca.
const fv = [
  { f: { acao: 'designar' }, esp: ['V'], porque: 'designação de CD/FG comprova o exercício' },
  { f: { acao: 'dispensar' }, esp: [], porque: 'dispensa ENCERRA o exercício; marcar as duas pontas convida à dupla contagem (art. 15 §6º)' },
];
for (const c of fv) {
  const got = requisitosDaFuncao(c.f as never);
  const bom = JSON.stringify(got) === JSON.stringify(c.esp);
  bom ? ok++ : mau++;
  if (!bom) console.log(`FALHA funcao ${c.f.acao}: esperado=[${c.esp}] obtido=[${got}] — ${c.porque}`);
}

// O catálogo tem que cobrir os SEIS requisitos do art. 2º da IN 129/2026,
// mesmo os três que não são detectáveis: a interface precisa poder nomeá-los
// ao explicar o que ela NÃO alcança.
const faltando = (['I', 'II', 'III', 'IV', 'V', 'VI'] as const).filter(r => !REQUISITOS[r]?.titulo);
if (faltando.length) { console.log(`FALHA catálogo incompleto: ${faltando}`); mau++; } else ok++;

console.log(`\n${ok} ok, ${mau} falha(s)`);
process.exit(mau ? 1 : 0);
