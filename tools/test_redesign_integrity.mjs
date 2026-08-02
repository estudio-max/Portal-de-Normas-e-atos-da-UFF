import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const dataSource = await read('src/dataSource.ts');

const tsconfig = JSON.parse(await read('tsconfig.json'));
assert.deepEqual(
  tsconfig.include,
  ['src'],
  'TypeScript must compile only the production source, not proposal and backup folders.'
);

const migratedPanels = [
  'src/components/panels/ActRelationships.tsx',
  'src/components/panels/ActSpreadsheet.tsx',
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
assert.match(appShell, /<TopBar apiMode=\{apiMode\} compact=\{isMobile\}/, 'The top bar must align with the collapsed navigation on smaller screens.');
assert.match(topBar, /compact: boolean/, 'The top bar must receive the responsive navigation state.');
assert.match(topBar, /compact \? 'left-16' : 'left-56'/, 'The top bar must use the same responsive offset as the content area.');
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
assert.match(dashboard, /Array\.from\(\{ length: 26 \}/,
  'Annual chart must render every year from 2001 through 2026.');

const actCard = await read('src/components/acts/ActCard.tsx');
assert.doesNotMatch(actCard, /w-1\.5 shrink-0/, 'Act cards must not rely on decorative colored side stripes.');

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
assert.match(app, /const handleGlobalSearch = \(query: string\)/, 'The app must receive queries from the global search.');
assert.match(app, /<ActTable buscaGlobal=\{buscaGlobal\} \/>/, 'The acts route must receive the global query.');
assert.match(app, /onSearch=\{handleGlobalSearch\} onThemeToggle=\{\(\) => setFotofobia\(ativo => !ativo\)\}/, 'The shell must connect global search and theme state.');
assert.match(app, /portalStats=\{portalStats\}/, 'The shell must receive the source statistics for the update indicator.');

assert.doesNotMatch(dashboard, /onNavigate\(`atos\/\$\{act\.id\}`\)/, 'Dashboard cards must not navigate to an unimplemented act-detail hash route.');

const sidebar = await read('src/components/layout/Sidebar.tsx');
assert.match(sidebar, /const compactItems = \[\.\.\.NAV_SECTIONS\.flatMap\(section => section\.items\), \.\.\.FOOTER_ITEMS\];/, 'The compact navigation must include the footer destinations.');
assert.match(sidebar, /\{compactItems\.map\(item => \(/, 'The compact navigation must render every compact destination.');

const actTable = await read('src/components/ActTable.tsx');
assert.match(actTable, /buscaGlobal\?: string/, 'The acts table must accept a query from the global search.');
assert.match(actTable, /setBusca\(buscaGlobal\)/, 'The acts table must apply the global query to its existing search filter.');

const css = await read('src/index.css');
assert.match(css, /html\.fotofobia \{/, 'The stylesheet must define the low-light skin.');
assert.doesNotMatch(css, /filter: invert\(1\)/, 'The low-light skin must use deliberate colors instead of inverting the interface.');

console.log('Redesign structure is safe for TypeScript compilation.');
