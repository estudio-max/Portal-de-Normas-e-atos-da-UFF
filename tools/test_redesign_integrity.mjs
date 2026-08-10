import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const dataSource = await read('src/dataSource.ts');
const mockPy = await read('tools/mock_api.py');

const tsconfig = JSON.parse(await read('tsconfig.json'));
assert.deepEqual(
  tsconfig.include,
  ['src'],
  'TypeScript must compile only the production source, not proposal and backup folders.'
);

const migratedPanels = [
  'src/components/panels/ActRelationships.tsx',
  'src/components/panels/ChefiasApi.tsx',
  'src/components/panels/ComissoesApi.tsx',
  'src/components/panels/CooperacaoApi.tsx',
  'src/components/panels/DossieApi.tsx',
  'src/components/panels/InsightsApi.tsx',
  'src/components/panels/JornadaApi.tsx',
  'src/components/panels/MandatosApi.tsx',
  'src/components/panels/OdsApi.tsx',
  'src/components/panels/PrazosApi.tsx',
];

for (const panel of migratedPanels) {
  const source = await read(panel);
  assert.match(
    source,
    /from ['"]\.\.\/\.\.\/(dataSource|types)['"];/,
    `${panel} must retain a valid import after its move to components/panels.`
  );
}

const appShell = await read('src/components/layout/AppShell.tsx');
const topBar = await read('src/components/layout/TopBar.tsx');
// O cabeçalho mora DENTRO da coluna de conteúdo (sticky). Enquanto era fixed,
// ele repetia o recuo da sidebar à mão e o <main> compensava a altura com um
// padding chutado — a 320 px o conteúdo do cabeçalho media 371 px numa caixa de
// 256 px e o botão de modo escuro ficava fora da tela, inalcançável.
assert.match(topBar, /<header className="sticky top-0/,
  'The top bar must be sticky inside the content column, not fixed with a hand-copied offset.');
assert.doesNotMatch(topBar, /left-16|left-56/,
  'The top bar must not re-derive the sidebar offset.');
assert.doesNotMatch(appShell, /pt-32/,
  'The content area must not compensate for the header height with a magic padding.');
assert.match(topBar, /hidden sm:inline/,
  'The API status label must collapse to the dot on narrow screens so the controls still fit.');
assert.match(topBar, /w-8 h-8 shrink-0 rounded-lg/,
  'The theme toggle must never shrink out of reach.');
assert.match(appShell, /onThemeToggle: \(\) => void/, 'The app shell must expose the theme toggle to the top bar.');
assert.match(appShell, /onSearch=\{onSearch\} onThemeToggle=\{onThemeToggle\}/, 'The app shell must forward search and theme interactions.');
assert.match(topBar, /onThemeToggle: \(\) => void/, 'The top bar theme control must have a real callback.');
assert.match(topBar, /aria-pressed=\{fotofobia\}/, 'The theme control must expose its state to assistive technology.');
assert.match(topBar, /onClick=\{onThemeToggle\}/, 'The theme control must invoke the callback.');
assert.match(topBar, /Boletim de Serviço 2026/, 'The institutional Boletim shortcut must remain visible in the fixed top bar.');
assert.match(topBar, /Pesquisa Pública SEI/, 'The institutional SEI shortcut must remain visible in the fixed top bar.');
assert.match(topBar, /Atualização mais recente em/, 'The top bar must render the latest imported update.');

const dashboard = await read('src/components/dashboard/Dashboard.tsx');
assert.doesNotMatch(dashboard, /1\.247 este mês/, 'Dashboard metrics must not show a hard-coded monthly value.');
assert.doesNotMatch(dashboard, /Math\.random\(\)/, 'Dashboard chart placeholders must not change on every render.');
assert.doesNotMatch(dashboard, /\[35, 48, 42, 58/, 'Annual chart must not use placeholder bars.');
assert.doesNotMatch(dashboard, /recentActs\.slice\(0, 5\)/, 'The latest bulletin list must not be truncated.');
// Os gráficos moraram dentro do Dashboard até 04/08/2026; hoje são o
// Graficos.tsx. O Dashboard segue decidindo a FAIXA da série (abaixo) — quem
// desenha não escolhe até que ano vai.
const graficos = await read('src/components/dashboard/Graficos.tsx');
assert.match(graficos, /aria-label=\{`\$\{ano\}: \$\{fmt\(dados\[i\]\[1\]\)\} atos`\}/,
  'Each annual data point must expose its value.');
// O modo fotofobia age por seletor de CLASSE (`[class*="bg-white"]`), e `fill`
// dentro de SVG não é alcançado por isso: gráfico pintado por classe do
// Tailwind fica escuro sobre escuro no tema escuro, sem erro nenhum. A marca
// tem que sair de custom property.
assert.match(graficos, /stroke="var\(--chart-mark\)"/,
  'Chart marks must be painted from theme tokens, not Tailwind classes.');
assert.doesNotMatch(graficos, /(fill|stroke)="#[0-9A-Fa-f]{3,6}"/,
  'No literal hex may paint a chart mark — it would not follow the dark theme.');
// Cada gráfico tem que ter tabela equivalente: forma sem número é conteúdo que
// só existe para quem enxerga.
assert.equal((graficos.match(/<TabelaDados/g) || []).length, 3,
  'Every chart must ship its equivalent table.');
// Os painéis do boletim leem os atos que a home JÁ recebeu. Se um dia passarem
// a buscar sozinhos, a home faz duas viagens para a mesma pergunta.
assert.doesNotMatch(graficos, /fetch\(|useEffect/,
  'The bulletin charts must derive from the acts already on the page.');
// A faixa da série anual NÃO pode ser constante em lugar nenhum: com o fim
// fixado em 2026, o gráfico pararia de crescer em 01/01/2027 enquanto o total
// continuava subindo. O teto é o ano corrente, decidido na camada de dados.
assert.doesNotMatch(dashboard, /Array\.from\(\{ length: 26 \}/,
  'Annual chart must not hard-code a 26-year window.');
assert.match(dashboard, /anoFim - ANO_INICIO_ACERVO \+ 1/,
  'Annual chart must derive its range from the data it received.');
assert.doesNotMatch(dataSource, /a\.ano <= 2026/,
  'Static stats must not cap the annual series at a fixed year.');
assert.match(dataSource, /a\.ano <= new Date\(\)\.getFullYear\(\)/,
  'Static stats must cap the annual series at the current year.');

// ---------------------------------------------------------------------------
// AJUDA CONTEXTUAL — o mapa tem que ser TOTAL sobre as abas.
//
// A aba nasce numa linha de ABAS_VALIDAS e o painel vai para o ar. Sem esta
// trava, ela iria sem explicação nenhuma e ninguém notaria: o "?" some sozinho
// quando a aba não está no mapa, então a falha é silenciosa por desenho — o que
// é certo em produção e péssimo sem alguém conferindo aqui.
// ---------------------------------------------------------------------------
const appTsx = await read('src/App.tsx');
const ajudaTsx = await read('src/components/help/ajudaConteudo.tsx');

const blocoAbas = appTsx.match(/const ABAS_VALIDAS = \[([\s\S]*?)\];/);
assert.ok(blocoAbas, 'ABAS_VALIDAS must remain a literal array so the help map can be checked against it.');
const abas = [...blocoAbas[1].matchAll(/'([^']*)'/g)].map(m => m[1]);
assert.ok(abas.length >= 15, `Expected the full tab list, found ${abas.length}.`);

// Chaves do mapa: `'': {`, `atos: {`, `'pessoal/siape': {` — as três formas.
const blocoAjuda = ajudaTsx.match(/export const AJUDA: Record<string, AjudaAba> = \{([\s\S]*?)\n\};/);
assert.ok(blocoAjuda, 'The help content must stay a literal object so its keys can be checked.');
const chaves = [...blocoAjuda[1].matchAll(/^ {2}(?:'([^']*)'|([\w]+)):\s*\{\s*$/gm)]
  .map(m => (m[1] !== undefined ? m[1] : m[2]));

// Ajuda, Privacidade e Sobre não levam o "?": elas já SÃO a explicação. A
// isenção é declarada numa lista, e não deduzida aqui, para que a cobertura
// continue TOTAL — aba nova entra num dos dois lados por decisão de quem a
// criou, em vez de ficar sem ajuda porque ninguém lembrou.
const blocoIsentas = ajudaTsx.match(/export const ABAS_SEM_AJUDA = \[([^\]]*)\]/);
assert.ok(blocoIsentas, 'The exempt-tab list must stay a literal array.');
const isentas = [...blocoIsentas[1].matchAll(/'([^']*)'/g)].map(m => m[1]);

const cobertas = [...chaves, ...isentas];
const semAjuda = abas.filter(a => !cobertas.includes(a));
assert.deepEqual(semAjuda, [],
  `Every tab must either ship contextual help or be listed as exempt. Missing: ${semAjuda.map(a => `"${a}"`).join(', ')}`);
const orfas = cobertas.filter(k => !abas.includes(k));
assert.deepEqual(orfas, [],
  `Help written for a tab that does not exist (typo in the key?): ${orfas.map(a => `"${a}"`).join(', ')}`);
const duplicadas = chaves.filter(k => isentas.includes(k));
assert.deepEqual(duplicadas, [],
  `A tab cannot be both exempt and have help: ${duplicadas.map(a => `"${a}"`).join(', ')}`);

// Toda entrada precisa das duas partes que respondem a pergunta de quem abriu o
// modal: o que é isto, e o que eu faço aqui.
for (const chave of chaves) {
  const corpo = blocoAjuda[1].split(new RegExp(`^ {2}(?:'${chave.replace(/\//g, '\\/')}'|${chave}):\\s*\\{`, 'm'))[1] ?? '';
  const entrada = corpo.split(/\n {2}\}/)[0];
  assert.match(entrada, /resumo:/, `Help entry "${chave}" must say what the tab is.`);
  assert.match(entrada, /passos:/, `Help entry "${chave}" must say how to use it.`);
  // O "por que" é o que faz a pessoa QUERER usar a aba; os passos só ensinam a
  // operá-la. Sem isto a ajuda vira manual — e manual ninguém abre.
  assert.match(entrada, /porQue:/, `Help entry "${chave}" must explain why the tab exists.`);
  const porQue = entrada.split('porQue:')[1]?.split(/\n {4}\],/)[0] ?? '';
  assert.ok(porQue.replace(/<[^>]*>/g, '').trim().length > 320,
    `The "why" for "${chave}" is too short to convey the tab's value.`);
}

// A aba mais usada é o Meu SIAPE, e o conselho que muda o resultado ali é
// preencher os DOIS campos: só parte dos atos do Boletim registra matrícula, e
// quem busca só pelo SIAPE não alcança o resto. Sem isso a pessoa conclui que
// não tem ato nenhum publicado.
assert.match(blocoAjuda[1], /Preencha os <B>dois<\/B> campos/,
  'The Meu SIAPE help must tell the user to fill in both SIAPE and name.');

const ajudaModal = await read('src/components/help/AjudaModal.tsx');
// showModal() é o que dá armadilha de foco, Esc e camada superior. Abrir pelo
// atributo `open` renderiza a mesma caixa SEM nada disso — e parece funcionar.
assert.match(ajudaModal, /\.showModal\(\)/,
  'The help dialog must open with showModal(), or it traps neither focus nor Esc.');
assert.doesNotMatch(ajudaModal, /<dialog[^>]*\sopen\b/,
  'The help dialog must not be opened by the `open` attribute — that skips modal mode.');
assert.match(topBar, /useEffect\(\(\) => \{ setAjudaAberta\(false\); \}, \[activePath\]\)/,
  'Switching tabs must close the help modal, or it would describe the previous tab.');

const php = await read('backend/api/index_v2.php');
assert.doesNotMatch(php, /ano BETWEEN 2001 AND 2026/,
  'The API annual series must not stop at a hard-coded year.');
assert.match(php, /ano BETWEEN 2001 AND YEAR\(CURDATE\(\)\)/,
  'The API annual series must cap at the current year.');
assert.doesNotMatch(mockPy, /2001 <= ano <= 2026/,
  'The mock annual series must not stop at a hard-coded year.');

// A curadoria ODS não entra pelo importador (ato_ods vem do backfill), então a
// aba tem que DIZER até quando alcança. Sem isso ela mostrava menos evidência
// que o acervo tem, sem nada indicando que havia atos por avaliar.
assert.match(php, /'cobertura' => \['ate' => \$ate, 'ultimoNormativo' => \$ultNorm, 'diasParado' => \$gap\]/,
  'The ODS route must report how far the curation reaches.');
assert.match(mockPy, /"cobertura": \{"ate": ate, "ultimoNormativo": ult_norm, "diasParado": gap\}/,
  'The mock ODS route must report the curation cutoff too.');
assert.match(dataSource, /cobertura\?: \{ ate: string \| null; ultimoNormativo: string \| null; diasParado: number \| null \}/,
  'The ODS response type must carry the staleness signal.');
const odsPanel = await read('src/components/panels/OdsApi.tsx');
assert.match(odsPanel, /r\.cobertura\?\.diasParado != null && r\.cobertura\.diasParado > 90/,
  'The ODS panel must warn only when the classification has demonstrably stopped.');

// A classificação ODS roda no import: sem isso a aba fica parada até alguém
// rodar uma carga à mão, que foi o estado até 03/08/2026.
const importador = await read('backend/importar/importar_v2.php');
assert.match(importador, /require_once __DIR__ \. '\/ods_match\.php'/,
  'The importer must load the ODS classifier.');
assert.match(importador, /ods_do_ato\(\$tipoNome/,
  'The importer must classify each act against the ODS clusters.');
// A curadoria humana é soberana: o DELETE do import não pode tocá-la.
assert.match(importador, /DELETE FROM ato_ods WHERE ato_id=:id AND metodo <> 'curadoria'/,
  'The import must never delete human-curated ODS links.');
assert.match(importador, /INSERT IGNORE INTO ato_ods/,
  'Automatic ODS links must yield to a curated row for the same (ato, ods).');

// O backfill automático dá a passada uniforme no acervo antigo com o MESMO
// classificador do import — e preserva a curadoria com a mesma regra.
const backfillOds = await read('backend/importar/backfill_ato_ods_auto.php');
assert.match(backfillOds, /require_once __DIR__ \. '\/ods_match\.php'/,
  'The ODS backfill must reuse the importer classifier, not a copy.');
assert.match(backfillOds, /DELETE FROM ato_ods WHERE metodo <> 'curadoria'/,
  'The backfill reset must spare human curation.');
assert.match(backfillOds, /DELETE FROM ato_ods WHERE ato_id = \? AND metodo <> 'curadoria'/,
  'The per-act rewrite must spare human curation.');
assert.match(backfillOds, /LIMIT \$lote/,
  'The backfill must run in resumable batches — the corpus does not fit one request.');

// O workflow diário só publica o índice estático. Dizer que o site reflete em
// minutos é falso — produção exige o passo manual do importador.
const workflow = await read('.github/workflows/indexar.yml');
assert.doesNotMatch(workflow, /O site no ar refletirá/,
  'The workflow must not claim it updates the live site.');
assert.match(workflow, /NÃO\*\* ATUALIZOU: o site em produção/,
  'The workflow must say plainly that it does not touch production.');

const actCard = await read('src/components/acts/ActCard.tsx');
assert.doesNotMatch(actCard, /w-1\.5 shrink-0/, 'Act cards must not rely on decorative colored side stripes.');

const actListCard = await read('src/components/acts/ActListCard.tsx');
assert.match(actListCard, /md:hidden/, 'Act list card must be mobile-only.');

// Listas no mobile: cada linha de tabela vira um cartão abaixo de 768 px.
// A asserção exige o PAR — a lista de cartões e a tabela escondida —, não uma
// classe marcadora: a versão anterior procurava `mobile-stack-table`, string que
// não existia em CSS nenhum, então bastava colá-la num arquivo para o teste
// passar sem que nada ficasse responsivo.
for (const file of ['ChefiasApi.tsx', 'JornadaApi.tsx', 'ComissoesApi.tsx', 'CooperacaoApi.tsx', 'DossieApi.tsx']) {
  const source = await read(`src/components/panels/${file}`);
  assert.match(source, /<RecordCardList/,
    `${file} must render one card per row on mobile.`);
  assert.match(source, /<DesktopTable/,
    `${file} must keep its table for the desktop breakpoint.`);
  assert.doesNotMatch(source, /<div className="overflow-x-auto">\s*<table/,
    `${file} must not leave an interactive table in a raw horizontal scroller.`);
}

const recordCard = await read('src/components/ui/RecordCard.tsx');
assert.match(recordCard, /md:hidden/, 'The card list must be mobile-only.');
assert.match(recordCard, /hidden md:block/, 'The desktop table wrapper must hide below the breakpoint.');

// Painéis que já eram lista de cartões: só não podem voltar a fixar largura
// mínima maior que a viewport estreita.
for (const file of ['MandatosApi.tsx', 'PrazosApi.tsx']) {
  assert.doesNotMatch(await read(`src/components/panels/${file}`), /flex-1 min-w-\[\d+px\]/,
    `${file} filters must be allowed to shrink on a narrow screen.`);
}

// A planilha de curadoria antiga saiu do repo: nada em src/ a importava desde
// que a rota de atos passou a usar ActTable.
await assert.rejects(() => read('src/components/panels/ActSpreadsheet.tsx'),
  'The dead curation spreadsheet must stay deleted.');

// Cartão clicável: o Card precisa REPASSAR o onClick. Enquanto ele só declarava
// children/className/hover, o handler do ActCard era descartado em silêncio e o
// cartão do Dashboard exibia cursor-pointer sem fazer nada.
const card = await read('src/components/ui/Card.tsx');
assert.match(card, /onClick\?: \(\) => void/, 'Card must accept a click handler.');
assert.match(card, /role="button"/, 'A clickable card must announce itself as a control.');
assert.match(card, /tabIndex=\{0\}/, 'A clickable card must be reachable by keyboard.');
assert.match(card, /e\.key === 'Enter' \|\| e\.key === ' '/, 'A clickable card must respond to Enter and Space.');
assert.match(actCard, /onClick=\{onClick\}/, 'The act card must hand its click to the Card.');

// Setas de tendência: o número é participação no acervo, não série temporal.
const statCard = await read('src/components/dashboard/StatCard.tsx');
assert.doesNotMatch(statCard, /trendUp \? '↑' : '↓'/,
  'Stat cards must not draw a trend arrow for a share of the collection.');

// O mock tem que falar o mesmo /stats da API PHP, senão testar o modo banco no
// dev mostra dashboard vazio e parece problema de dados.
const mock = mockPy;
for (const chave of ['porAno', 'ultimaAtualizacao', 'ultimoBoletim']) {
  assert.match(mock, new RegExp(`"${chave}"`),
    `mock_api.py must mirror the /stats contract, including ${chave}.`);
}
// Toda rota que o front chama tem que existir no mock, senao o painel cai no
// estado vazio no dev e parece tela quebrada.
for (const rota of ['chefias', 'mandatos', 'prazos', 'pad_cadeia', 'insights',
                    'analitico', 'jornada', 'cooperacao', 'comissoes', 'politicas', 'mudancas', 'ods',
                    'dossie']) {
  assert.match(mock, new RegExp(`recurso == "${rota}"`),
    `mock_api.py must serve /${rota}, which the frontend calls.`);
}
// O classificador PAD/SINVE vem do importador; copia paralela volta a divergir.
assert.match(mock, /from extrair_prazos_pad_sinve import/,
  'The mock must reuse the importer PAD/SINVE classifier instead of copying it.');

const app = await read('src/App.tsx');
assert.match(dataSource, /porAno: Record<number, number>/,
  'Stats must expose real annual totals.');
assert.match(dataSource, /atos: DashboardAct\[\]/,
  'The latest bulletin must expose all of its acts.');
assert.match(app, /porAno: s\.porAno/,
  'App must pass annual totals to the Dashboard.');
assert.doesNotMatch(app, /por_pagina: 5/,
  'Dashboard must not truncate the latest bulletin to five acts.');
assert.match(app, /import ActTable from '\.\/components\/ActTable';/, 'The acts route must use the read-only table that supports both API and static modes.');
assert.match(app, /if \(aba === 'atos'\) return <ActTable buscaGlobal=\{buscaGlobal\} \/>;/, 'The acts route must use the read-only table with the global query applied.');
assert.match(app, /import ActRelationsApi from '\.\/components\/ActRelationsApi';/, 'The relations route must import the API-capable relationship panel.');
assert.match(app, /if \(aba === 'relacoes'\) return apiMode \? <ActRelationsApi \/> : <Suspense fallback=\{<PanelFallback \/>\}><ActRelationships acts=\{ds\.todosAtos\(\)\} \/><\/Suspense>;/, 'The relations route must select a component that receives data in both API and static modes.');
assert.match(app, /const \[fotofobia, setFotofobia\]/, 'The app must own the persistent low-light theme state.');
assert.match(app, /document\.documentElement\.classList\.toggle\('fotofobia', fotofobia\)/, 'The app must apply the selected theme to the document root.');
// A busca prendia a navegação: como handleGlobalSearch era recriada a cada
// render e entrava nas dependências do efeito do TopBar, o efeito redisparava e
// reexecutava navigate('atos') — com termo na caixa, TODO destino da sidebar
// voltava para a aba de atos. Duas guardas: identidade estável no App e o
// callback fora das dependências no TopBar.
assert.match(app, /const handleGlobalSearch = useCallback\(\(query: string\)/,
  'The global search handler must keep a stable identity across renders.');
assert.match(topBar, /const onSearchRef = useRef\(onSearch\)/,
  'The top bar must hold the search callback in a ref.');
assert.match(topBar, /onSearchRef\.current\?\.\(debouncedQuery\);\s*\}, \[debouncedQuery\]\);/,
  'Only the debounced term may re-trigger the global search.');
assert.doesNotMatch(topBar, /\}, \[debouncedQuery, onSearch\]\);/,
  'The search effect must not depend on the callback identity.');
assert.doesNotMatch(topBar, /Buscando\.\.\./,
  'The top bar must not ship a dropdown that never fills.');
assert.match(app, /<ActTable buscaGlobal=\{buscaGlobal\} \/>/, 'The acts route must receive the global query.');
assert.match(app, /onSearch=\{handleGlobalSearch\} onThemeToggle=\{alternarTema\}/, 'The shell must connect global search and theme state.');
assert.match(app, /portalStats=\{portalStats\}/, 'The shell must receive the source statistics for the update indicator.');

assert.doesNotMatch(dashboard, /onNavigate\(`atos\/\$\{act\.id\}`\)/, 'Dashboard cards must not navigate to an unimplemented act-detail hash route.');

const sidebar = await read('src/components/layout/Sidebar.tsx');
assert.match(sidebar, /const compactItems = \[\.\.\.NAV_SECTIONS\.flatMap\(section => section\.items\), \.\.\.FOOTER_ITEMS\];/, 'The compact navigation must include the footer destinations.');
assert.match(sidebar, /\{compactItems\.map\(item => \(/, 'The compact navigation must render every compact destination.');

const actTable = await read('src/components/ActTable.tsx');
assert.match(actTable, /<ActListCard/, 'The main act list must render mobile cards.');
assert.match(actTable, /buscaGlobal\?: string/, 'The acts table must accept a query from the global search.');
assert.match(actTable, /setBusca\(buscaGlobal\)/, 'The acts table must apply the global query to its existing search filter.');

const css = await read('src/index.css');
assert.match(css, /html\.fotofobia \{/, 'The stylesheet must define the low-light skin.');
assert.doesNotMatch(css, /filter: invert\(1\)/, 'The low-light skin must use deliberate colors instead of inverting the interface.');
// A skin cobria só as classes do shell. Os tons mais usados DENTRO dos painéis
// ficavam escuros sobre fundo escuro: text-slate-600 (67 usos) e o azul
// institucional text-[#003366] (36 usos).
for (const classe of ['text-slate-600', 'text-\\[\\#003366\\]']) {
  assert.ok(css.includes(`html.fotofobia [class*="${classe}"]`),
    `The low-light skin must cover ${classe.replace(/\\/g, '')}, used throughout the panels.`);
}

// ── Hash documentado tem que existir ────────────────────────────────────────
// Quando as abas foram agrupadas em `pessoal/` e `institucional/`, a chave de
// ODS virou `institucional/ods` — mas `#ods` continuou escrito em 17 lugares
// dos documentos de metodologia, e `#dossie`/`#planilha` sobreviveram no
// CLAUDE.md com as abas já renomeadas para `pessoal/siape` e `atos`. Nenhum
// abria nada, e ninguém percebeu porque documento não é compilado.
//
// A trava vale para o hash escrito na forma canônica (`#/algo`) e para o
// atalho que coincide com o último segmento de uma aba real (`#ods`), que é
// exatamente a forma que envelhece quando uma aba muda de seção.
{
  const app = await read('src/App.tsx');
  const bloco = app.match(/const ABAS_VALIDAS = \[(.*?)\]/s);
  assert.ok(bloco, 'ABAS_VALIDAS must be readable to validate documented hashes.');
  const validas = new Set([...bloco[1].matchAll(/'([^']*)'/g)].map(m => m[1]).filter(Boolean));
  const ultimoSegmento = new Map();
  for (const v of validas) ultimoSegmento.set(v.split('/').pop(), v);

  const { readdir } = await import('node:fs/promises');
  const docs = ['CLAUDE.md',
    ...(await readdir(new URL('../docs/', import.meta.url)))
      .filter(f => f.endsWith('.md')).map(f => `docs/${f}`)];

  // Escape explícito: a linha que documenta um hash ERRADO de propósito (para
  // dizer que ele não funciona) marca-se com `<!-- hash-exemplo -->`. Sem isso
  // a trava impediria de escrever sobre o próprio defeito que ela previne.
  const problemas = [];
  for (const arq of docs) {
    const txt = await read(arq);
    const linhas = txt.split('\n');
    for (const m of txt.matchAll(/`#(\/?[a-z][a-z0-9/-]*)`/g)) {
      // acha a linha desta ocorrência para checar o marcador de exemplo
      let acc = 0, linha = '';
      for (const l of linhas) {
        if (m.index >= acc && m.index <= acc + l.length) { linha = l; break; }
        acc += l.length + 1;
      }
      if (linha.includes('hash-exemplo')) continue;
      const bruto = m[1];
      const alvo = bruto.replace(/^\//, '').replace(/\/$/, '');
      if (validas.has(alvo)) {
        if (!bruto.startsWith('/')) problemas.push(`${arq}: \`#${bruto}\` deve ser \`#/${alvo}\``);
        continue;
      }
      if (bruto.startsWith('/')) {
        problemas.push(`${arq}: \`#${bruto}\` não existe em ABAS_VALIDAS`);
      } else if (ultimoSegmento.has(alvo)) {
        problemas.push(`${arq}: \`#${bruto}\` é chave antiga — hoje é \`#/${ultimoSegmento.get(alvo)}\``);
      }
      // hash sem barra que não casa aba nenhuma (#fff, #root) não é rota: ignora
    }
  }
  assert.deepEqual(problemas, [],
    `Documented tab hashes must exist in ABAS_VALIDAS:\n  ${problemas.join('\n  ')}`);
}

// ── O override de origem da API não pode ser forjável por link ──────────────
// `?api=` valia para qualquer valor, e a aba Meu SIAPE ENVIA matrícula e nome
// para `API_BASE`: um link `?api=https://atacante.example` exibiria atos
// forjados com a cara do portal E vazaria o dado pessoal de quem clicasse.
{
  const config = await read('src/config.ts');
  assert.doesNotMatch(config, /API_BASE[^=]*=\s*\n?\s*params\.get\('api'\)/,
    'API_BASE must not take ?api= unchecked — it is forgeable by link.');
  assert.match(config, /LOCAIS/,
    'The ?api= override must be restricted to localhost origins.');
  assert.match(config, /location\.hostname/,
    'The ?api= override must check the page origin, not only the target.');
}

console.log('Redesign structure is safe for TypeScript compilation.');
