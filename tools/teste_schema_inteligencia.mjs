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
// 11. O seed de comissões não divergiu do gerador
//
// `backend/db/seed_comissao.sql` é GERADO por tools/registro_comissoes.py. O
// registro curado já vive em três projeções que não podem divergir; esta trava
// existe para que a quarta (o .sql commitado) não passe a ser editada à mão.
//
// A primeira versão deste seed saiu do gerador com um `;` fechando o statement
// ANTES do ON DUPLICATE KEY UPDATE — SQL inválido que só apareceria no
// phpMyAdmin. Daí a checagem de statement único.
// ---------------------------------------------------------------------------
const SEED = 'backend/db/seed_comissao.sql';
const GERADOR = 'tools/registro_comissoes.py';
const seedBruto = await readFile(new URL(SEED, root), 'utf8');
const seed = seedBruto.replace(/^\s*--.*$/gm, '');
const py = await readFile(new URL(GERADOR, root), 'utf8');

const RX_REGISTRO = /^\s*\('([\w-]+)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)'\),\s*\r?$/gm;
const registro = [...py.matchAll(RX_REGISTRO)].map((r) => ({
  slug: r[1], sigla: r[2], nome: r[3], obrig: r[6] || 'nao_classificada',
}));
const RX_SEED_ROW = /^\s*\('([\w-]+)',\s*'((?:[^']|'')*)',\s*(?:'([^']*)'|NULL),\s*'(\w+)',\s*'(\w+)',\s*(\d)\),?\s*$/gm;
const semeados = [...seed.matchAll(RX_SEED_ROW)].map((r) => ({
  slug: r[1], nome: r[2].replace(/''/g, "'"), sigla: r[3] ?? '', obrig: r[4],
}));

checa(registro.length > 0, `${GERADOR}: não consegui ler o REGISTRO (o formato das tuplas mudou?)`);
checa(semeados.length === registro.length,
  `${SEED}: ${semeados.length} corpos semeados contra ${registro.length} no registro — rode: python tools/registro_comissoes.py --sql`);

for (const r of registro) {
  const s = semeados.find((x) => x.slug === r.slug);
  if (!s) { falhas.push(`${SEED}: falta o corpo '${r.slug}' — regenere o arquivo`); continue; }
  checa(s.nome === r.nome, `${SEED}: '${r.slug}' com nome divergente do gerador ("${s.nome}" ≠ "${r.nome}")`);
  checa(s.sigla === r.sigla, `${SEED}: '${r.slug}' com sigla divergente do gerador`);
  checa(s.obrig === r.obrig, `${SEED}: '${r.slug}' com obrigatoriedade divergente ("${s.obrig}" ≠ "${r.obrig}")`);
  checa(r.slug.length <= 32, `${GERADOR}: slug '${r.slug}' não cabe no VARCHAR(32) da tabela`);
}

// Statement único e upsert que não desfaz curadoria.
checa((seed.match(/;/g) ?? []).length === 1,
  `${SEED}: precisa ser UM statement só — um ';' extra corta o ON DUPLICATE KEY UPDATE fora`);
checa(/ON DUPLICATE KEY UPDATE/i.test(seed),
  `${SEED}: sem ON DUPLICATE KEY UPDATE — reaplicar o seed daria erro de chave duplicada`);
const upsert = seed.slice(seed.search(/ON DUPLICATE KEY UPDATE/i));
for (const curado of ['ato_fundador_id', 'orgao_id', 'fundamento_texto']) {
  checa(!upsert.includes(curado),
    `${SEED}: o upsert escreve em \`${curado}\` — esse campo é curadoria humana e o seed não pode desfazê-lo`);
}
for (const proibido of ['DROP TABLE', 'TRUNCATE', 'DELETE FROM']) {
  checa(!new RegExp(proibido, 'i').test(seed), `${SEED}: ${proibido} num arquivo de seed`);
}

// O ENUM da coluna tem que aceitar todas as obrigatoriedades emitidas.
const colObrig = tabelas.find((t) => t.nome === 'comissao')?.colunas.get('obrigatoriedade');
const valoresObrig = colObrig ? [...colObrig.arg.matchAll(/'([^']*)'/g)].map((v) => v[1]) : [];
for (const s of semeados) {
  checa(valoresObrig.includes(s.obrig),
    `${SEED}: '${s.slug}' semeia obrigatoriedade '${s.obrig}', fora do ENUM (${valoresObrig.join(',')})`);
}

// ---------------------------------------------------------------------------
// 12. O seed de políticas é coerente com o schema e com o gerador
//
// `backend/db/seed_politica.sql` sai de tools/gerar_seed_politicas.py. Aqui
// interessa o que o phpMyAdmin só diria tarde: papel/confiança fora do ENUM,
// política publicada sem curadoria, e o vínculo repetido — que não daria erro
// (o ON DUPLICATE KEY UPDATE o engoliria), só sumiria em silêncio.
// ---------------------------------------------------------------------------
const SEEDPOL = 'backend/db/seed_politica.sql';
const GERPOL = 'tools/gerar_seed_politicas.py';
const seedPolBruto = await readFile(new URL(SEEDPOL, root), 'utf8');
const seedPol = seedPolBruto.replace(/^\s*--.*$/gm, '');
const pyPol = await readFile(new URL(GERPOL, root), 'utf8');

const tAtoPol = tabelas.find((t) => t.nome === 'ato_politica');
const enumDe = (tab, col) => {
  const c = tab?.colunas.get(col);
  return c ? [...c.arg.matchAll(/'([^']*)'/g)].map((v) => v[1]) : [];
};
const papeis = enumDe(tAtoPol, 'papel');
const confs = enumDe(tAtoPol, 'confianca');
const metodos = enumDe(tAtoPol, 'metodo');

const RX_VINCULO = /\(SELECT id FROM ato WHERE uid='([^']+)'\),\s*\(SELECT id FROM politica WHERE slug='([^']+)'\),\s*'(\w+)',\s*'(\w+)',\s*'([\w+]+)'/g;
const vinculos = [...seedPol.matchAll(RX_VINCULO)].map((m) => ({
  uid: m[1], slug: m[2], papel: m[3], confianca: m[4], metodo: m[5],
}));
checa(vinculos.length > 0, `${SEEDPOL}: nenhum vínculo ato↔política reconhecido (o formato mudou?)`);

for (const v of vinculos) {
  checa(papeis.includes(v.papel), `${SEEDPOL}: papel '${v.papel}' fora do ENUM de ato_politica`);
  checa(confs.includes(v.confianca), `${SEEDPOL}: confiança '${v.confianca}' fora do ENUM`);
  checa(metodos.includes(v.metodo), `${SEEDPOL}: método '${v.metodo}' fora do ENUM`);
}

// A UNIQUE é (ato_id, politica_id, papel): repetir a tripla faz a segunda
// linha ser absorvida pelo ON DUPLICATE, sem erro e sem aviso.
const triplas = new Set();
for (const v of vinculos) {
  const k = `${v.uid}|${v.slug}|${v.papel}`;
  checa(!triplas.has(k), `${SEEDPOL}: vínculo repetido (${k}) — a UNIQUE o engoliria em silêncio`);
  triplas.add(k);
}

// Os slugs do SQL têm que existir no catálogo do gerador, e vice-versa.
// Tolerar CRLF é obrigatório, e a lição é recente: na árvore de trabalho o git
// deixa os arquivos em CRLF, e o `$` do JS casa antes do LF — o CR fica
// sobrando e o padrão para de casar. A trava então deixa de checar EM SILÊNCIO,
// que é o pior modo de falha possível num teste. Daí o `?$` em todo padrão
// que ancora em fim de linha sobre código-fonte.
const RX_CATALOGO = /^\s*\('([\w-]+)',\s*'[^']*',\s*'[^']*',\r?$/gm;
const catalogo = [...pyPol.matchAll(RX_CATALOGO)].map((m) => m[1]);
checa(catalogo.length > 0, `${GERPOL}: não consegui ler o CATALOGO`);
const slugsNoSql = new Set(
  [...seedPol.matchAll(/INSERT INTO `politica`[\s\S]*?;/g)].flatMap((b) =>
    [...b[0].matchAll(/^\s*\('([\w-]+)',/gm)].map((m) => m[1])));
for (const s of catalogo) {
  checa(slugsNoSql.has(s), `${SEEDPOL}: política '${s}' está no gerador e não no SQL — regenere`);
}
for (const v of vinculos) {
  checa(slugsNoSql.has(v.slug), `${SEEDPOL}: vínculo aponta para política '${v.slug}', que o catálogo não cria`);
}

// Os aliases também. E aqui o silêncio é pior: o bloco é INSERT IGNORE, então
// um slug com typo faz o subselect devolver NULL, o IGNORE engole a violação
// de NOT NULL e a linha simplesmente não entra — sem erro, sem aviso.
const blocoAlias = (seedPol.match(/INSERT IGNORE INTO `politica_alias`[\s\S]*?;/) ?? [''])[0];
const aliases = [...blocoAlias.matchAll(/WHERE slug='([\w-]+)'\),\s*'([^']*)',\s*'(\w+)'/g)]
  .map((m) => ({ slug: m[1], termo: m[2], tipo: m[3] }));
checa(aliases.length > 0, `${SEEDPOL}: nenhum alias reconhecido (o formato mudou?)`);
const tiposAlias = enumDe(tabelas.find((t) => t.nome === 'politica_alias'), 'tipo');
for (const al of aliases) {
  checa(slugsNoSql.has(al.slug),
    `${SEEDPOL}: alias '${al.termo}' aponta para política '${al.slug}', que o catálogo não cria — o INSERT IGNORE o descartaria calado`);
  checa(tiposAlias.includes(al.tipo), `${SEEDPOL}: alias '${al.termo}' com tipo '${al.tipo}' fora do ENUM`);
}

// Nada nasce público: o catálogo é curado antes de aparecer no portal.
const blocoPol = (seedPol.match(/INSERT INTO `politica`[\s\S]*?;/) ?? [''])[0];
checa(!/'publicada'/.test(blocoPol),
  `${SEEDPOL}: política nascendo 'publicada' — o catálogo tem que entrar como rascunho`);
for (const proibido of ['DROP TABLE', 'TRUNCATE']) {
  checa(!new RegExp(proibido, 'i').test(seedPol), `${SEEDPOL}: ${proibido} num arquivo de seed`);
}

// DELETE é PERMITIDO neste seed, e necessário: `papel` faz parte da chave
// natural, então reclassificar um ato (a cartilha de acessibilidade saiu de
// `fundador` para `regulamentacao`) não é UPDATE — o upsert enxerga chave nova
// e insere, deixando a linha velha viva e o ato duplicado na linha do tempo.
//
// Mas ele só pode apagar o que a máquina escreveu. Sem a guarda, uma
// reaplicação do seed varre a curadoria humana e ninguém percebe: o painel
// continua cheio, só que com os rótulos automáticos de volta.
const GUARDA = /metodo`?\s+NOT IN\s*\(\s*'curadoria'\s*,\s*'regra\+curadoria'\s*,\s*'ia\+curadoria'\s*\)/i;
for (const arquivo of [[SEEDPOL, seedPol], [SEED, seed]]) {
  const [nome, texto] = arquivo;
  for (const stmt of texto.split(';')) {
    if (!/\bDELETE\b/i.test(stmt)) continue;
    checa(GUARDA.test(stmt),
      `${nome}: DELETE sem a guarda de curadoria — reaplicar o seed apagaria revisão humana`);
  }
}

// ---------------------------------------------------------------------------
// 13. O matcher do importador não divergiu do gerador do seed
//
// `politicas_match.php` roda no import diário; `gerar_seed_politicas.py` gera a
// carga offline. Os dois classificam os MESMOS atos e têm que concordar — se
// divergirem, o ato que entrar pelo import ganha um rótulo e o mesmo ato,
// recarregado pelo seed, ganha outro.
//
// É a lição que o projeto já pagou três vezes: `extrair_prazos` tem três
// espelhos que precisam concordar, e o registro de comissões, quatro.
// ---------------------------------------------------------------------------
const MATCHER = 'backend/importar/politicas_match.php';
const matcher = (await readFile(new URL(MATCHER, root), 'utf8')).replace(/^\s*\/\/.*$/gm, '');

const termosPhp = Object.fromEntries(
  [...matcher.matchAll(/^\s*'([\w-]+)'\s*=>\s*'([^']+)',$/gm)].map((m) => [m[1], m[2]]));
// O CATALOGO do gerador: slug na 1ª linha da tupla, termos na lista que segue.
// `\s*` e nunca `\n\s*` entre os campos: `\s` já cobre CR e LF, e exigir o LF
// literal foi o que fez este padrão casar zero entradas na primeira tentativa.
const RX_CAT_ENTRADA = /\('([\w-]+)',\s*'[^']*',\s*'[^']*',\s*'[^']*',\s*\[([\s\S]*?)\],\s*\[([^\]]*)\]\)/g;
const catalogoPy = {};
const emissoresPy = {};
for (const m of pyPol.matchAll(RX_CAT_ENTRADA)) {
  catalogoPy[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map((t) => t[1]);
  emissoresPy[m[1]] = [...m[3].matchAll(/'([^']+)'/g)].map((t) => t[1]);
}

checa(Object.keys(catalogoPy).length > 0, `${GERPOL}: não consegui ler os termos do CATALOGO`);
for (const [slug, termos] of Object.entries(catalogoPy)) {
  const php = termosPhp[slug];
  if (!php) { falhas.push(`${MATCHER}: falta a política '${slug}', que o gerador tem`); continue; }
  // O PHP guarda os termos ACENTUADOS (o fold tira na hora); o Python guarda
  // já normalizados. Comparo pela contagem e pelo conjunto normalizado.
  const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const doPhp = php.split('|').map(semAcento).sort();
  const doPy = termos.map(semAcento).sort();
  checa(JSON.stringify(doPhp) === JSON.stringify(doPy),
    `${MATCHER}: termos de '${slug}' divergem do gerador\n     php: ${doPhp.join(', ')}\n     py : ${doPy.join(', ')}`);
}
for (const slug of Object.keys(termosPhp)) {
  if (slug === 'PROAES') continue;   // o mapa de emissores, não de termos
  checa(slug in catalogoPy || Object.values(emissoresPy).flat().includes(slug),
    `${MATCHER}: política '${slug}' não existe no gerador`);
}
// O emissor é o 2º sinal e também não pode divergir.
const emissorPhp = [...matcher.matchAll(/'([A-Z]{3,})'\s*=>\s*'([\w-]+)'/g)]
  .map((m) => [m[1], m[2]]);
for (const [sigla, slug] of emissorPhp) {
  checa((emissoresPy[slug] ?? []).includes(sigla),
    `${MATCHER}: emissor ${sigla}→${slug} não está no gerador`);
}

// ---------------------------------------------------------------------------
for (const f of falhas) console.log(`FALHA  ${f}`);
console.log(`\n${ok} verificação(ões) OK, ${falhas.length} falha(s)`);
console.log(`   ${ARQUIVO}\n   ${SEED}\n   ${SEEDPOL} (${vinculos.length} vínculos)`);
if (falhas.length) process.exit(1);
