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
assert.match(dashboard, /aria-label=\{`\$\{ano\}: \$\{count\} atos`\}/,
  'Each annual bar must expose its value.');
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
                    'analitico', 'jornada', 'cooperacao', 'comissoes', 'ods', 'dossie']) {
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

console.log('Redesign structure is safe for TypeScript compilation.');
