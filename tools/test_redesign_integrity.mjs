import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

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
// A home abre pelas TAREFAS, não pelos indicadores do acervo: quem chega quer
// resolver algo, e o total de atos não responde a nenhuma dessas perguntas.
assert.match(dashboard, /O que você quer fazer\?/,
  'The dashboard must open with the task question, not with collection metrics.');
assert.match(dashboard, /<TaskCard/, 'The dashboard must offer the priority tasks as entry points.');
// Número de interface sai da API. A versão anterior escrevia "26 colegiados
// cadastrados" à mão num cartão de atalho — e o catálogo pode mudar sem que
// ninguém lembre de vir aqui.
assert.doesNotMatch(dashboard, /\d+ colegiados cadastrados/,
  'Dashboard shortcuts must not hard-code a catalogue count.');
// `stats.porAno` é ANUAL. Rotular o gráfico como "últimos 12 meses" — como faz
// o mockup — seria o portal afirmando um recorte que ninguém calculou.
assert.doesNotMatch(dashboard, /últimos 12 meses/i,
  'The annual chart must not claim to be a 12-month window.');
assert.match(dashboard, /Atos publicados por ano/, 'The annual chart must be labelled by year.');
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

// ActCard.tsx e StatCard.tsx foram APAGADOS no redesenho de 13/08/2026: o
// Dashboard passou a abrir por tarefas, e com isso a lista de atos recentes
// virou linha compacta e os quatro KPIs viraram um bloco de números dentro do
// "Resumo do acervo". Nada mais os importava. As duas lições que as travas
// deles guardavam continuam valendo para quem desenhar o próximo componente:
//   - cartão de ato não se distingue por tarja colorida na lateral (era
//     `w-1.5 shrink-0`): a cor sozinha não diz o que ela marca;
//   - número que é PARTICIPAÇÃO no acervo não leva seta de tendência — "↓ 1%
//     do acervo" lia-se como queda de 1%, que ninguém mediu.
// A regra de clique acessível sobreviveu nas asserções do `Card`, que continua
// em uso.

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

// O cartão de tarefa da home é <button> nativo, e não um <div role="button">:
// o conteúdo é só rótulo e uma frase, então cabe num botão sem HTML inválido —
// e foco, Enter, Espaço e nome acessível vêm do navegador em vez de um handler
// de teclado escrito à mão, que é onde esse tipo de componente costuma quebrar.
const taskCard = await read('src/components/dashboard/TaskCard.tsx');
assert.match(taskCard, /<button\s/, 'The task card must be a real button.');
assert.doesNotMatch(taskCard, /role="button"/,
  'The task card must not re-implement button semantics on a div.');
// A tarefa em foco precisa se anunciar por TEXTO, não só pelo anel verde.
assert.match(taskCard, /Comece aqui/,
  'The focused task must name itself in words, not only by color.');
assert.match(taskCard, /selo-marca/,
  'Task card brand surfaces must come from the theme tokens, not Tailwind greens.');

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
// A navegação foi reduzida às rotas frequentes em 13/08/2026, com o resto sob
// "Mais". A trilha COMPACTA (rail de 64 px) continua tendo que listar TUDO: ali
// não há rótulo para ler, então um disclosure fechado seria um beco sem saída —
// e o destino que mais sumia era o rodapé (Ajuda, Privacidade, Sobre).
assert.match(sidebar, /const compactItems: NavItem\[\] = \[\.\.\.NAV_PRIMARIO, \.\.\.ITENS_MAIS, \.\.\.FOOTER_ITEMS\];/,
  'The compact navigation must include the primary, the "Mais" and the footer destinations.');
assert.match(sidebar, /\{compactItems\.map\(item => \(/, 'The compact navigation must render every compact destination.');
// Chegar numa aba que mora sob "Mais" — por link colado, pelo cartão de tarefa
// ou pelo botão "voltar" — e ver a navegação sem NADA selecionado é perder a
// própria posição. O disclosure abre sozinho nesse caso.
assert.match(sidebar, /if \(ativaEmMais\) setMaisAberto\(true\);/,
  'The "Mais" disclosure must open itself when the active tab lives inside it.');
assert.match(sidebar, /aria-expanded=\{maisAberto\}/,
  'The "Mais" disclosure must expose its state to assistive technology.');
assert.match(sidebar, /aria-current=\{isActive\(item\.id\) \? 'page' : undefined\}/,
  'Navigation items must announce which one is the current page.');

const actTable = await read('src/components/ActTable.tsx');
assert.match(actTable, /<ActListCard/, 'The main act list must render mobile cards.');
assert.match(actTable, /buscaGlobal\?: string/, 'The acts table must accept a query from the global search.');
assert.match(actTable, /setBusca\(buscaGlobal\)/, 'The acts table must apply the global query to its existing search filter.');
// Contador não pode dizer "0 atos encontrados" enquanto a primeira consulta
// ainda corre: é afirmar um resultado que ninguém obteve. Carregando, vazio e
// erro são estados visuais DIFERENTES.
assert.match(actTable, /const semResultadoAinda = carregando && resp === null;/,
  'The result count must distinguish "still loading" from "found nothing".');
assert.match(actTable, /Buscando atos…/, 'The first load must say it is loading.');
// O chip carrega o NOME DO CAMPO junto do valor: "PROGEPE" solto não diz de
// qual filtro ele saiu, e sem o chip a única forma de desfazer um filtro
// avançado era achá-lo de volta dentro do painel.
for (const campo of ['Tipo: ', 'Ano: ', 'Órgão: ', 'Processo: ']) {
  assert.ok(actTable.includes(`\`${campo}`),
    `Active filter chips must name the field they came from (${campo.trim()}).`);
}
// Estado vazio explica e oferece saída, em vez de um "nenhum resultado" seco.
assert.match(actTable, /function EstadoVazio/, 'The acts list must have a real empty state.');

// Os filtros secundários abrem em painel, não em modal: quem filtra quer VER a
// lista mudar, e um modal cobriria justamente o resultado sendo ajustado.
const filtrosAvancados = await read('src/components/acts/FiltrosAvancados.tsx');
assert.match(filtrosAvancados, /e\.key === 'Escape'/, 'The advanced filter panel must close with the keyboard.');
assert.match(filtrosAvancados, /aria-label="Filtros avançados"/, 'The advanced filter panel must announce its title.');
for (const id of ['filtro-emissor', 'filtro-nome', 'filtro-siape', 'filtro-processo']) {
  assert.ok(filtrosAvancados.includes(`htmlFor="${id}"`) && filtrosAvancados.includes(`id="${id}"`),
    `The advanced filter "${id}" must have a real visible label, not a placeholder.`);
}

// Cabeçalho de página: toda tela responde "o que é isto?" antes de mostrar
// dado, e por um <h1> só — é por ele que quem navega por cabeçalhos se situa.
const pageHeader = await read('src/components/ui/PageHeader.tsx');
assert.match(pageHeader, /<h1 /, 'The page header must render the single page-level heading.');

const css = await read('src/index.css');
assert.match(css, /html\.fotofobia \{/, 'The stylesheet must define the low-light skin.');
assert.doesNotMatch(css, /filter: invert\(1\)/, 'The low-light skin must use deliberate colors instead of inverting the interface.');
// A skin cobria só as classes do shell. Os tons mais usados DENTRO dos painéis
// ficavam escuros sobre fundo escuro: text-slate-600 (67 usos) e o azul
// institucional text-[#003366] (36 usos).
for (const classe of ['text-slate-600', 'text-\\[\\#003366\\]', 'text-\\[\\#64748B\\]']) {
  assert.ok(css.includes(`html.fotofobia [class*="${classe}"]`),
    `The low-light skin must cover ${classe.replace(/\\/g, '')}, used throughout the panels.`);
}

// Contraste do texto de apoio. `#A0AEC0` media 2,26:1 sobre branco — abaixo do
// mínimo de 4,5:1 e até do 3:1 de texto grande — e pintava rótulo de KPI,
// subtítulo da home, título de seção da navegação e os itens do rodapé dela.
// Foi trocado por `#64748B` (4,76:1), que é o mesmo valor do `--chart-axis`, já
// medido neste projeto. A trava impede que ele volte por cópia de código antigo.
const fontesTsx = await Promise.all([
  'src/App.tsx',
  'src/components/layout/Sidebar.tsx',
  'src/components/layout/TopBar.tsx',
  'src/components/dashboard/Dashboard.tsx',
  'src/components/dashboard/Graficos.tsx',
].map(read));
for (const fonte of fontesTsx) {
  assert.doesNotMatch(fonte, /text-\[#A0AEC0\]/,
    'Support text must not use #A0AEC0, which fails the contrast minimum on white.');
}

// O verde institucional como COR DE TEXTO. `#006400` não está na lista de
// conversão do fotofobia, então atravessa a troca de tema intacto e fica
// verde-escuro sobre fundo escuro — sem erro nenhum no console, que é como esta
// armadilha sempre se apresenta. MEDIDO em 13/08/2026 no botão "Pesquisa
// Pública SEI" do cabeçalho: **1,85:1**, ilegível, e estava assim em produção.
// Com `.botao-marca`/`.texto-marca` (tokens `--marca-*`, declarados nos dois
// temas) mede 9,57 no claro e 9,34 no escuro.
// A classe `bg-[#006400]` continua permitida: fundo verde cheio com texto
// branco por cima não depende da superfície em volta e mede 7,4:1 nos dois.
// A varredura ignora COMENTÁRIO: este arquivo e o Sidebar precisam poder
// escrever o hex para explicar por que ele não se usa — foi exatamente o que
// derrubou a primeira versão desta trava.
const semComentario = (fonte) => fonte
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter(linha => !/^\s*(\/\/|\*)/.test(linha))
  .join('\n');

for (const [nome, fonte] of [
  ['TopBar', topBar],
  ['Sidebar', sidebar],
  ['DossieApi', await read('src/components/panels/DossieApi.tsx')],
  ['PrazosApi', await read('src/components/panels/PrazosApi.tsx')],
]) {
  assert.doesNotMatch(semComentario(fonte), /text-\[#006400\]/,
    `${nome} must paint the institutional green from the theme tokens ` +
    '(.botao-marca / .texto-marca), not from text-[#006400], which is invisible in the low-light skin.');
}
for (const classe of ['.botao-marca', '.texto-marca']) {
  assert.ok(css.includes(classe), `The stylesheet must define ${classe}.`);
}

// ── Piso tipográfico ────────────────────────────────────────────────────────
// Boa parte do público deste portal não tem prática com sites, e o acervo se
// consulta muito no celular. A escala tem TRÊS degraus e o piso é 11px:
//   11px — selo, chip, cabeçalho de coluna (rótulo curto, alto contraste)
//   12px — apoio e corpo secundário
//   13px+ — corpo
// Antes de 13/08/2026 havia 26 usos de `text-[9px]` e 113 de `text-[10px]`
// espalhados pelos painéis. 9px é ilegível para qualquer pessoa; num público
// que inclui quem tem baixa visão, é barreira de acesso, não estilo.
// A varredura cobre `src/` inteiro de propósito: meia reforma de tipografia
// fica pior que nenhuma, porque o contraste de densidade entre uma aba e outra
// denuncia que o portal está pela metade.
const varrerTsx = async (dir) => {
  const achados = [];
  for (const entrada of await readdir(new URL(dir, root), { withFileTypes: true })) {
    const caminho = `${dir}${entrada.name}`;
    if (entrada.isDirectory()) achados.push(...await varrerTsx(`${caminho}/`));
    else if (caminho.endsWith('.tsx')) achados.push(caminho);
  }
  return achados;
};
// Duas formas, e a segunda foi por onde o piso escapou na primeira passada:
// classe do Tailwind (`text-[11px]`) e rótulo de eixo em SVG (`fontSize={9}`),
// que nenhuma varredura de classe alcança. Os gráficos de Prazos, Insights,
// Cooperação e Jornada rotulavam o eixo a 8,5–10px — medido no navegador em
// 13/08/2026, depois de a varredura de classes já ter passado e dado "pronto".
const abaixoDoPiso = [];
for (const arquivo of await varrerTsx('src/')) {
  const fonte = await read(arquivo);
  for (const m of fonte.matchAll(/text-\[(\d+)px\]/g)) {
    if (Number(m[1]) < 11) abaixoDoPiso.push(`${arquivo}: ${m[0]}`);
  }
  // As DUAS formas de escrever o mesmo atributo em JSX. Cobrir só a de chaves
  // deu falso "pronto" em 13/08/2026: os rótulos de mês do Insights estavam
  // como `fontSize="10"`, a trava passou, e o navegador continuou mostrando
  // 10px. Trava que só enxerga uma das grafias é pior que trava nenhuma —
  // ela produz confiança sem cobertura.
  for (const m of fonte.matchAll(/fontSize=(?:\{([\d.]+)\}|"([\d.]+)")/g)) {
    const valor = Number(m[1] ?? m[2]);
    if (valor < 11) abaixoDoPiso.push(`${arquivo}: ${m[0]}`);
  }
}
assert.deepEqual(abaixoDoPiso, [],
  'Text below 11px is an access barrier for this audience. Use 11px for short labels, 12px for support text, 13px+ for body.');

// Os tokens da marca precisam existir nos DOIS temas, senão o cartão de tarefa
// e o chip de filtro ficam verde-escuro sobre fundo escuro — sem erro nenhum no
// console, que é como esta armadilha sempre se apresenta neste projeto.
for (const token of ['--marca-fundo', '--marca-borda', '--marca-texto', '--marca-anel', '--sup-cartao']) {
  const claro = new RegExp(`:root \\{[\\s\\S]*?${token}:`);
  const escuro = new RegExp(`html\\.fotofobia \\{[\\s\\S]*?${token}:`);
  assert.match(css, claro, `${token} must be declared for the light theme.`);
  assert.match(css, escuro, `${token} must be declared for the low-light theme.`);
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
