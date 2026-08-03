// ============================================================================
//  teste_schema_inteligencia.mjs — regressão do schema do núcleo analítico.
//
//  Uso:  node tools/teste_schema_inteligencia.mjs      (sai 1 se algo quebrou)
//
//  Lê backend/db/inteligencia_institucional.sql como TEXTO e confere as
//  invariantes que só se descobre quebradas no phpMyAdmin — onde não há SSH,
//  não há rollback barato e o erro aparece no meio de uma janela de deploy.
//
//  Por que estática, e não contra um banco: a migração é aplicada à mão num
//  servidor compartilhado, uma vez. O teste precisa rodar ANTES disso, no CI,
//  sem banco nenhum. É o mesmo desenho do tools/test_redesign_integrity.mjs.
//
//  Cada bloco aqui corresponde a uma decisão do cabeçalho do .sql. Se você
//  mudar a decisão lá, mude a trava aqui — as duas contam a mesma história.
// ============================================================================
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const ARQUIVO = 'backend/db/inteligencia_institucional.sql';
const bruto = await readFile(new URL(ARQUIVO, root), 'utf8');

const falhas = [];
let ok = 0;
const checa = (cond, msg) => { if (cond) ok++; else falhas.push(msg); };

// Os comentários `--` saem antes de qualquer parsing: eles falam de DROP TABLE,
// de REGEXP_REPLACE e de outras coisas que as travas abaixo procuram no SQL.
const sql = bruto.replace(/^\s*--.*$/gm, '');

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------
const RX_TABELA   = /CREATE TABLE\s+(IF NOT EXISTS\s+)?`(\w+)`\s*\(([\s\S]*?)\n\)\s*([^;]*);/g;
const RX_COLUNA   = /^\s*`(\w+)`\s+([A-Za-z]+)(?:\(([^)]*)\))?([^\n]*)$/gm;
const RX_CHAVE    = /^\s*(PRIMARY KEY|UNIQUE KEY|KEY)(?:\s+`(\w+)`)?\s*\(((?:\s*`\w+`(?:\(\d+\))?\s*,?)+)\)/gm;
const RX_FK       = /^\s*CONSTRAINT\s+`(\w+)`\s+FOREIGN KEY\s*\(`(\w+)`\)\s*REFERENCES\s+`(\w+)`\s*\(`(\w+)`\)([^\n]*)$/gm;
const RX_COL_LIST = /`(\w+)`(?:\((\d+)\))?/g;

const tabelas = [];
for (const m of sql.matchAll(RX_TABELA)) {
  const [, ifNotExists, nome, corpo, cauda] = m;
  const colunas = new Map();
  for (const c of corpo.matchAll(RX_COLUNA)) {
    colunas.set(c[1], { tipo: c[2].toUpperCase(), arg: c[3] ?? '', resto: c[4] });
  }
  const chaves = [];
  for (const k of corpo.matchAll(RX_CHAVE)) {
    const cols = [...k[3].matchAll(RX_COL_LIST)]
      .map((c) => ({ nome: c[1], prefixo: c[2] ? Number(c[2]) : null }));
    chaves.push({ especie: k[1], nome: k[2] ?? 'PRIMARY', cols });
  }
  const fks = [...corpo.matchAll(RX_FK)].map((f) => ({
    nome: f[1], coluna: f[2], refTabela: f[3], refColuna: f[4], cauda: f[5],
  }));
  tabelas.push({ nome, ifNotExists: Boolean(ifNotExists), corpo, cauda, colunas, chaves, fks });
}

// Guarda do próprio parser: se um CREATE TABLE deixar de casar, as travas
// seguintes passariam sem examinar nada — silêncio que parece aprovação.
const declarados = (sql.match(/CREATE TABLE/g) ?? []).length;
checa(declarados === tabelas.length,
  `parser: ${declarados} CREATE TABLE no arquivo, ${tabelas.length} reconhecidos`);

// ---------------------------------------------------------------------------
// 1. As doze tabelas, nem uma a mais
// ---------------------------------------------------------------------------
const ESPERADAS = [
  'ato_politica', 'comissao', 'comissao_evento', 'comissao_membro_evento',
  'evidencia_fato', 'mudanca_relevante', 'obrigacao', 'obrigacao_evidencia',
  'politica', 'politica_alias', 'politica_evento', 'politica_indicador',
];
const nomes = tabelas.map((t) => t.nome).sort();
checa(JSON.stringify(nomes) === JSON.stringify(ESPERADAS),
  `tabelas divergem do esperado:\n  esperado: ${ESPERADAS.join(', ')}\n  veio:     ${nomes.join(', ')}`);

// ---------------------------------------------------------------------------
// 2. Migração aditiva: idempotente na criação, sem nada destrutivo
//
// O pacote vai para produção sem SSH e sem rollback barato. Um DROP TABLE aqui
// apagaria curadoria humana que não tem outra cópia.
// ---------------------------------------------------------------------------
for (const t of tabelas) {
  checa(t.ifNotExists, `${t.nome}: CREATE TABLE sem IF NOT EXISTS (reaplicar a migração vai falhar)`);
}
for (const proibido of ['DROP TABLE', 'DROP DATABASE', 'TRUNCATE', 'DROP COLUMN', 'ALTER TABLE']) {
  checa(!new RegExp(proibido, 'i').test(sql),
    `${proibido} no pacote de produção — migração aditiva não altera nem apaga o que já existe`);
}

// ---------------------------------------------------------------------------
// 3. Percona 5.7: nada de MySQL 8
//
// Um script que dependia do 8.0 já foi escrito e jogado fora neste projeto.
// ---------------------------------------------------------------------------
const MYSQL8 = [
  [/REGEXP_REPLACE/i, 'REGEXP_REPLACE'],
  [/REGEXP_SUBSTR/i, 'REGEXP_SUBSTR'],
  [/\bWITH\s+RECURSIVE\b/i, 'CTE recursiva'],
  [/\bOVER\s*\(/i, 'função de janela'],
  [/\bROW_NUMBER\s*\(/i, 'ROW_NUMBER()'],
  [/\bJSON_TABLE\b/i, 'JSON_TABLE'],
  [/\bCHECK\s*\(/i, 'CHECK constraint (o 5.7 aceita a sintaxe e IGNORA a regra)'],
];
for (const [rx, rotulo] of MYSQL8) {
  checa(!rx.test(sql), `${rotulo}: não existe em Percona Server 5.7`);
}

// ---------------------------------------------------------------------------
// 4. Motor e collation
//
// utf8mb4_unicode_ci não é gosto: é o que faz LIKE ignorar acento e caixa, do
// que dependem os casamentos por frase estrita. E FK exige collation IGUAL nos
// dois lados — comissao_slug ↔ comissao.slug quebra em silêncio se divergir.
// ---------------------------------------------------------------------------
for (const t of tabelas) {
  checa(/ENGINE=InnoDB/i.test(t.cauda), `${t.nome}: precisa ser InnoDB (FK e transação)`);
  checa(/CHARSET=utf8mb4/i.test(t.cauda), `${t.nome}: precisa ser utf8mb4`);
  checa(/COLLATE=utf8mb4_unicode_ci/i.test(t.cauda), `${t.nome}: precisa ser utf8mb4_unicode_ci`);
}

// ---------------------------------------------------------------------------
// 5. Chave natural em toda tabela  (idempotência)
//
// Sem UNIQUE de chave natural, reprocessar um ato duplica o fato. `comissao` é
// a exceção declarada: a PK dela É a chave natural (o slug do registro curado).
// ---------------------------------------------------------------------------
for (const t of tabelas) {
  const pk = t.chaves.find((k) => k.especie === 'PRIMARY KEY');
  const unicas = t.chaves.filter((k) => k.especie === 'UNIQUE KEY');
  checa(pk, `${t.nome}: sem PRIMARY KEY`);
  if (t.nome === 'comissao') {
    checa(pk && pk.cols.length === 1 && pk.cols[0].nome === 'slug',
      'comissao: a PK tem que ser o slug — é o que ato_comissao.comissao já guarda');
  } else {
    checa(unicas.length >= 1,
      `${t.nome}: sem chave natural UNIQUE — reprocessar um ato vai duplicar a linha`);
  }
}

// ---------------------------------------------------------------------------
// 6. Orçamento de índice do InnoDB
//
// Duas regras, não uma: cada COLUNA do índice cabe em 767 bytes no formato
// COMPACT/REDUNDANT (3072 no DYNAMIC), e a CHAVE INTEIRA cabe em 3072 bytes em
// qualquer formato. Como não há SSH para saber o formato do servidor antes de
// aplicar, o teste exige o pior caso dos dois.
// ---------------------------------------------------------------------------
const BYTES_FIXOS = {
  BIGINT: 8, INT: 4, MEDIUMINT: 3, SMALLINT: 2, TINYINT: 1,
  DATE: 3, DATETIME: 5, TIMESTAMP: 4, TIME: 3, YEAR: 1, ENUM: 1,
};
function bytesDaColuna(col, prefixo) {
  if (!col) return null;
  if (col.tipo === 'VARCHAR' || col.tipo === 'CHAR') {
    const n = prefixo ?? Number(col.arg);
    return Number.isFinite(n) ? n * 4 : null;   // utf8mb4: 4 bytes por caractere
  }
  if (col.tipo === 'ENUM') return 1;            // até 255 valores
  return BYTES_FIXOS[col.tipo] ?? null;
}
for (const t of tabelas) {
  for (const k of t.chaves) {
    let total = 0;
    for (const c of k.cols) {
      const col = t.colunas.get(c.nome);
      checa(col, `${t.nome}.${k.nome}: indexa coluna inexistente \`${c.nome}\``);
      const b = bytesDaColuna(col, c.prefixo);
      if (b === null) {
        falhas.push(`${t.nome}.${k.nome}: coluna \`${c.nome}\` (${col?.tipo}) precisa de prefixo para ser indexada`);
        continue;
      }
      checa(b <= 767,
        `${t.nome}.${k.nome}: a coluna \`${c.nome}\` ocupa ${b} bytes — passa dos 767 do formato COMPACT`);
      total += b;
    }
    checa(total <= 3072,
      `${t.nome}.${k.nome}: a chave inteira soma ${total} bytes — o teto do InnoDB é 3072`);
  }
}

// ---------------------------------------------------------------------------
// 7. Proveniência: extracao_id sempre com FK; entidade_id é a única solta
//
// A referência polimórfica da evidencia_fato é deliberada — cinco FKs opcionais
// mutuamente exclusivas seriam piores. Mas ela é a ÚNICA, e o preço dela (achar
// órfão por consulta) está no bloco 5 do verificar_inteligencia.sql.
// ---------------------------------------------------------------------------
const SOLTAS_PERMITIDAS = new Set(['evidencia_fato.entidade_id']);
for (const t of tabelas) {
  const comFk = new Set(t.fks.map((f) => f.coluna));
  for (const [nomeCol] of t.colunas) {
    if (!nomeCol.endsWith('_id') || nomeCol === 'id') continue;
    const chave = `${t.nome}.${nomeCol}`;
    if (SOLTAS_PERMITIDAS.has(chave)) {
      checa(!comFk.has(nomeCol), `${chave}: é a referência polimórfica, não pode ganhar FK`);
      continue;
    }
    checa(comFk.has(nomeCol), `${chave}: coluna de referência sem FOREIGN KEY`);
  }
  if (t.colunas.has('extracao_id')) {
    const fk = t.fks.find((f) => f.coluna === 'extracao_id');
    checa(fk && fk.refTabela === 'extracao',
      `${t.nome}.extracao_id: precisa referenciar extracao(id) — é a trilha de auditoria`);
  }
}

// ---------------------------------------------------------------------------
// 8. Toda FK declara ON DELETE, e nenhuma aponta para `prazo`
//
// O importador faz DELETE + INSERT em `prazo` a cada importação do ato, então
// prazo.id é reciclado todo dia: uma FK apontaria para linha trocada.
// ---------------------------------------------------------------------------
for (const t of tabelas) {
  for (const f of t.fks) {
    checa(/ON DELETE/i.test(f.cauda),
      `${t.nome}.${f.nome}: FOREIGN KEY sem ON DELETE — o comportamento vira o default silencioso`);
    checa(f.refTabela !== 'prazo',
      `${t.nome}.${f.nome}: FK para \`prazo\` — prazo.id é reciclado a cada import (DELETE+INSERT)`);
  }
}

// ---------------------------------------------------------------------------
// 9. Vocabulário dos ENUM
//
// 'media' sem acento, como já está na ato_ods — divergir aqui obrigaria a
// escrever o valor de dois jeitos no PHP. E toda tabela que carrega `metodo`
// precisa poder marcar curadoria: é o que o predicado de preservação lê para
// não apagar linha revisada por humano.
// ---------------------------------------------------------------------------
for (const t of tabelas) {
  for (const [nomeCol, col] of t.colunas) {
    if (col.tipo !== 'ENUM') continue;
    const valores = [...col.arg.matchAll(/'([^']*)'/g)].map((v) => v[1]);
    for (const v of valores) {
      checa(/^[a-z0-9_+]+$/.test(v),
        `${t.nome}.${nomeCol}: valor de ENUM '${v}' fora do vocabulário (minúscula, sem acento)`);
    }
    if (nomeCol === 'confianca') {
      checa(JSON.stringify(valores) === JSON.stringify(['alta', 'media', 'baixa']),
        `${t.nome}.confianca: precisa ser ENUM('alta','media','baixa'), veio (${valores.join(',')})`);
    }
    if (nomeCol === 'metodo') {
      checa(valores.includes('curadoria'),
        `${t.nome}.metodo: sem 'curadoria' no ENUM — a passada automática não teria como preservar revisão humana`);
    }
  }
}

// ---------------------------------------------------------------------------
// 10. O núcleo v2 continua intocado
//
// A regra do projeto: análise nova é tabela-fato, nunca coluna em `ato`.
// ---------------------------------------------------------------------------
checa(!/`ato`\s*\(/.test(sql.replace(/REFERENCES\s+`ato`\s*\(`id`\)/g, '')),
  'o arquivo cria ou redefine a tabela `ato` — análise nova entra como tabela-fato');

// ---------------------------------------------------------------------------
for (const f of falhas) console.log(`FALHA  ${f}`);
console.log(`\n${ok} verificação(ões) OK, ${falhas.length} falha(s) — ${ARQUIVO}`);
if (falhas.length) process.exit(1);
