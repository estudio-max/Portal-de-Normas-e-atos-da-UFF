# Redesign do Portal — implementação e validação

Data: 01/08/2026  
Escopo: integração do redesign React/Vite sem alterações na API PHP, banco de dados ou pipeline de indexação.

## O que foi corrigido

O redesign introduziu um novo shell com sidebar, topbar e Dashboard, mantendo o
roteamento por hash. A primeira cópia do `App.tsx` ligava itens do menu a
componentes da interface de curadoria antiga, que exigem dados e callbacks não
fornecidos. Como consequência, os destinos da navegação podiam falhar após o
clique.

As correções aplicadas são:

| Destino | Antes | Agora |
|---|---|---|
| `#/atos` | `ActSpreadsheet`, editor que exige sete props | `ActTable`, tabela somente leitura compatível com API e fallback estático |
| `#/relacoes` em modo API | `ActRelationships` sem `acts` | `ActRelationsApi`, que consulta a API paginada |
| `#/relacoes` no fallback estático | `ActRelationships` sem `acts` | `ActRelationships` com `ds.todosAtos()` |
| cards de atos recentes | hash `#/atos/<id>` sem rota implementada | hash `#/atos`, que abre a lista de consulta |
| sidebar compacta | escondia Ajuda, Privacidade e Sobre | apresenta todos os destinos, inclusive os itens do rodapé |

## Arquivos alterados nesta correção

- `src/App.tsx`: roteia Atos para `ActTable` e escolhe o painel de relações pelo modo de dados.
- `src/components/dashboard/Dashboard.tsx`: remove o destino de detalhe que ainda não existe.
- `src/components/layout/Sidebar.tsx`: inclui os destinos de rodapé na navegação compacta.
- `tools/test_redesign_integrity.mjs`: testes de regressão estrutural das rotas e da sidebar.
- `docs/superpowers/plans/2026-08-01-correcao-redesign-navegacao.md`: plano executado.

## Preservação de fallback

O `dataSource` continua sendo inicializado por `ds.init()`:

- com a API disponível, telas usam as rotas PHP e consultas paginadas;
- sem a API, o portal carrega `portal-data.json` e a tela de relações recebe o
  acervo estático em memória;
- a tela de Atos continua usando `ActTable`, que já usa a mesma camada de dados
  nos dois modos.

Não houve mudança no endpoint `/api`, no schema MySQL nem no mecanismo de
contingência do `portal-data.json`.

## Acessibilidade e busca global

- O ícone de lua da barra superior agora alterna uma skin escura de baixo brilho.
  A escolha é persistida em `localStorage`, anunciada por `aria-pressed` e pode
  ser revertida pelo mesmo botão (que passa a exibir o ícone de sol).
- A skin usa superfícies, bordas e textos declarados para contraste em ambiente
  escuro; não usa inversão de cores.
- A busca global possui atalho `Ctrl+K`/`⌘K`, aplica debounce de 300 ms e, a
  partir de dois caracteres, abre `#/atos` com o termo preenchido no filtro de
  busca da tabela. Ao limpar o campo, o filtro aplicado também é limpo.

## Validações executadas

```powershell
node tools/test_redesign_integrity.mjs
npm run lint
npm run build
```

O teste de integridade cobre especificamente os problemas que causavam a
navegação inconsistente: componente correto para atos, seleção de relações por
modo, ausência de rota de detalhe não implementada e itens completos na sidebar
compacta.

Os três passam. Além das rotas, o teste hoje guarda as correções de 03/08/2026:
identidade estável da busca global, cabeçalho sticky com o controle de tema
sempre alcançável, cartão clicável com acesso por teclado, o par
cartões-no-mobile + tabela-no-desktop em cada painel de lista, a cobertura da
skin escura e o contrato de `/stats` no mock.

## Teste manual antes do deploy

1. Execute `npm run dev` e abra `http://localhost:3000/`.
2. Clique em cada item da sidebar no desktop e confirme que o hash muda para o
   destino correspondente.
3. Em `#/atos`, verifique busca, filtros, paginação e abertura da ficha de um
   ato.
4. Em `#/relacoes`, valide a lista e a ficha no modo API. Para simular a
   contingência, aponte a configuração de API para uma URL indisponível e
   confirme que a tela ainda abre no modo estático.
5. Reduza a janela para menos de 1024 px e confirme que Ajuda, Privacidade e
   Sobre continuam acessíveis pela sidebar de ícones.

## Limite intencional desta entrega

O hash `#/atos/<uid>` não é uma rota de detalhe implementada. Os cards do
Dashboard agora levam à lista de Atos, que já possui abertura de ficha em modal.
Uma tela de detalhe compartilhável pode ser criada depois como uma evolução
separada, com carregamento via `ds.getAto(uid)` e tratamento de UID inexistente.

## Dashboard: série anual e último boletim

O gráfico **Atos por ano** mostra as 26 barras de 2001 a 2026. As quantidades
vêm da agregação de `ano`: a rota `/api/stats` calcula a série no banco e o
modo estático calcula a mesma série a partir de `portal-data.json`. Quando o
arquivo estático não possui atos de algum ano, a barra correspondente fica em
zero; nenhum valor é ilustrativo.

**A faixa da série não é constante.** O piso é 2001 (`ANO_INICIO_ACERVO` em
`src/config.ts`): antes disso o acervo só tem backlog legítimo — o boletim de
2001, digitalizado, publica atos de 1998-2000 de verdade — e resíduo de OCR,
que não pertencem ao gráfico. O **teto é o ano corrente**, decidido na camada
de dados: `YEAR(CURDATE())` no `/api/stats`, `new Date().getFullYear()` no modo
estático e no mock. O Dashboard não guarda faixa própria: ele lê o maior ano que
recebeu e preenche os buracos, para ano sem ato virar barra zerada em vez de
sumir.

O teto já esteve fixado em **2026 em quatro lugares** que precisavam concordar
(API, `dataSource`, Dashboard e mock). Em 01/01/2027 o gráfico pararia de
crescer enquanto o total de atos continuava subindo — gráfico e KPI discordando
sem nenhum aviso, que é o pior formato de erro para um painel. Corrigido em
03/08/2026; o teste de integridade barra o retorno do número fixo nos quatro.

O quadro de atos agora é identificado pelo Boletim de Serviço mais recente e
lista todos os seus atos, ordenados por data de assinatura. A API inclui essa
lista na resposta cacheada de `/api/stats`; o fallback estático seleciona o
mesmo arquivo pelo nome `NN-AA.pdf`. A invalidação do cache da API continua
sendo responsabilidade do fluxo de importação existente.

Para publicar essa alteração, envie o novo frontend de `dist/` e atualize
também `backend/api/index_v2.php` no arquivo publicado como `api/index.php`,
preservando o `config.php` do servidor.

**Os dois sobem juntos, na mesma janela.** A correção do teto da série mexeu na
consulta do `/api/stats` e no Dashboard ao mesmo tempo. Subir só o `dist/`
deixaria o front esperando um teto que a API antiga não devolve; subir só a API
não muda nada visível. `api_versao()` foi para `2026-08-03.1` — confira em
`GET /api/health` depois do upload, e rode `bash tools/smoke_test.sh`.

## Avaliação da implementação — 03/08/2026

Revisão do código integrado, com medição no navegador (dev server, modo
estático e modo API pelo `tools/mock_api.py`). **Os nove defeitos abaixo foram
corrigidos e reconferidos no navegador em 03/08/2026** — cada um traz a medição
que fechou o caso.

### O que está sólido

- `npm run lint` (tsc) e `npm run build` passam. O bundle inicial fica em
  315,8 kB (95,4 kB gzip) e os 14 painéis saem em chunks próprios pelo
  `React.lazy()` — o code splitting prometido de fato acontece.
- O fallback estático continua íntegro: `ds.init()` escolhe o modo e **todas as
  15 rotas abrem nos dois modos**. Jornada, Cooperação, Comissões e ODS exibem o
  aviso de "só no modo banco", como antes.
- A sidebar compacta expõe os 15 destinos, inclusive Ajuda/Privacidade/Sobre.
- O gráfico "Atos por ano" desenha as 26 barras a partir de `porAno` real.
- A lista de cartões de Chefias no mobile funciona: a 320 px são 167 cartões,
  a tabela fica em `display:none` e não há rolagem horizontal.

### Defeitos encontrados e corrigidos

**1. Bloqueador — a busca global prendia a navegação.**
Com qualquer termo de 2+ caracteres na caixa do topo, **todo destino da sidebar
volta sozinho para `#/atos`**. Medido: Cooperação, Ajuda, Dashboard e Prazos
levaram os quatro a `#/atos`; limpar a caixa devolve a navegação. Na prática o
portal fica travado numa aba só depois da primeira busca.
Causa: `handleGlobalSearch` (`src/App.tsx:146`) é recriada a cada render e está
no array de dependências do efeito do TopBar. Cada re-render do App mudava a
identidade da função, o efeito disparava de novo e reexecutava `navigate('atos')`.
**Corrigido** com duas guardas: `useCallback` no App e o callback numa `ref`
fora das dependências do efeito do TopBar — só o termo debounced dispara a
busca. Reconferido com o termo na caixa: Comissões, Ajuda, Dashboard, Prazos e
Cooperação abrem os cinco.

**2. Alta — os cartões de ato do Dashboard não eram clicáveis.**
`ActCard` passava `onClick` para `Card`, mas `CardProps` não declarava a
propriedade e o `Card` não a repassava para a `div`. O handler nunca chegava ao
DOM — e o `hover` aplicava `cursor-pointer`, então o cartão *parecia* clicável.
**Corrigido:** o `Card` aceita `onClick` e, quando recebe, vira controle de
verdade (`role="button"`, `tabIndex=0`, Enter e Espaço). Não virou `<button>`
porque o conteúdo tem título e parágrafo, que não podem morar dentro de um botão
sem HTML inválido. Medido: 59 cartões clicáveis, clique abre a consulta de atos.

**3. Alta — o botão de modo escuro ficava fora da tela no celular.**
O conteúdo do cabeçalho ocupava 371 px numa caixa de 256 px a 320 px de
viewport. O cabeçalho era `fixed`, não quebrava linha e não rolava: ficavam fora
da tela o indicador Online/Offline, o **botão de modo escuro (inteiro)** e o
selo "UFF". A 390 px continuava cortado — só aparecia a partir de ~440 px.
**Corrigido** trocando `fixed` por `sticky` dentro da coluna de conteúdo: o
cabeçalho herda a largura da coluna sozinho, sem repetir o recuo da sidebar à
mão nem obrigar o `<main>` a compensar altura com padding chutado. Em tela
estreita o rótulo Online/Offline recolhe para o ponto (com `title`) e o selo
institucional sai. Medido a 320 px: cabeçalho 256/256, nada fora da tela, botão
de tema em 272–304.

**4. Média — a skin escura cobria só parte da paleta.**
O bloco `html.fotofobia` listava classes específicas. Ficavam de fora
`text-slate-600` (67 usos) e `text-[#003366]` (36 usos), escuros sobre superfície
escura. **Corrigido:** a lista passou a cobrir os tons de texto usados nos
painéis e os chips coloridos (texto e fundo), mantendo a cor semântica. Medido
no escuro: `text-[#003366]` a 15,4:1 e `text-slate-600` a 11,3:1 sobre o fundo
— ambos acima do AAA.

**5. Média — o `tools/mock_api.py` ficou para trás do contrato de `/stats`.**
A API PHP devolve `porAno`, `ultimaAtualizacao` e `ultimoBoletim`
(`backend/api/index_v2.php:483-485`); o mock devolvia só as 7 chaves antigas.
Como o CLAUDE.md documenta o mock como o jeito de testar o modo banco no dev,
quem testasse o redesign por ali via "Nenhum ato recente disponível", o gráfico
anual zerado e "Atualização mais recente indisponível" — indistinguível de um
problema de dados de verdade. **Corrigido:** `stats_payload()` espelha as três
chaves. Medido: 59 atos no último boletim.

**6. Média — o trabalho de mobile estava pela metade, com asserção vazia.**
A Task 2 do plano tocou 3 dos 8 painéis, e o marcador escolhido para a asserção,
`mobile-stack-table`, **não existia em CSS nenhum**: bastava colar a string para
o teste passar sem nada ficar responsivo. **Corrigido:** o marcador saiu, a
conversão foi concluída (ver a seção de listas no mobile) e a asserção agora
exige o par lista-de-cartões + tabela-escondida, além de barrar tabela
interativa solta dentro de `overflow-x-auto`.

**7. Baixa — `ActSpreadsheet.tsx` era código morto.**
Nada em `src/` o importava desde que a rota de atos passou a usar `ActTable`.
**Removido do repo** (está no `git log` para arqueologia, como manda a regra da
casa). O teste agora falha se o arquivo voltar.

**8. Baixa — o dropdown da busca não preenchia nada.**
O TopBar abria um painel que exibia "Buscando..." para sempre, com um comentário
dizendo que os resultados viriam do dataSource. **Removido** — a busca leva à
consulta de atos com o termo aplicado, que é o caminho que de fato funciona.

**9. Baixa — as setas de tendência dos StatCards afirmavam o que não foi medido.**
"↓ 1% do acervo" em Revogados lia-se como queda; é participação, não tendência.
**Corrigido:** a linha virou `nota`, sem seta e sem cor de alerta.

## Listas de atos no mobile

Abaixo de **768 px** (`md`), cada linha de tabela vira um **cartão** de largura
total; do breakpoint para cima, a tabela do desktop continua intacta. As tabelas
geradas para impressão (`window.print`) não foram tocadas.

O desenho do cartão mora em `src/components/ui/RecordCard.tsx` — título, selo de
status, grade curta de metadados, texto longo em linha própria e ações — junto
com os dois envoltórios que escolhem a apresentação (`RecordCardList`, com
`md:hidden`, e `DesktopTable`, com `hidden md:block`). Ficou compartilhado de
propósito: quem aprendeu a ler o cartão de Chefias lê o de Cooperação sem
pensar.

Painéis convertidos: **Chefias**, **Jornada** (flexibilização e Programa de
Gestão), **Comissões** (atos do colegiado), **Cooperação** e **Meu SIAPE**
(designações e atos que citam a matrícula). **Atos e Normas** já usava
`ActListCard`; **Mandatos** e **Prazos** já eram listas de cartões e só
precisaram que os filtros parassem de fixar largura mínima maior que a tela.

Medição a 320 px, nas 12 rotas: **nenhuma rola horizontalmente**. Sobram apenas
os gráficos que rolam de propósito — o mapa-múndi e o gráfico empilhado da
Cooperação e o combo da Jornada. A regra vale para listas, não para cartografia.

## ODS: classificação automática no import

A `ato_ods` passou a ser preenchida **a cada importação**
(`backend/importar/ods_match.php`, chamado pelo `importar_v2.php`), como já
acontecia com `ato_comissao` e `prazo`. Antes ela só vinha do backfill offline,
então boletim novo entrava sem vínculo ODS e a aba ficava parada.

O que roda no import é **determinístico** — o mesmo recorte e os mesmos clusters
auditados que geraram a carga em produção, portados do Python para PHP. Não há
IA em tempo de execução.

Duas invariantes que o teste de integridade agora exige:

- **A curadoria humana vence.** O import apaga só o que é automático e grava com
  `INSERT IGNORE`; a UNIQUE `(ato_id, ods)` faz a linha revisada à mão prevalecer.
- **Sem cluster não há rótulo.** Ato que não casa vira resíduo para curadoria.
  Falso-negativo se conserta com um padrão novo; falso-positivo contamina o dossiê.

A barreira contra falso-positivo é `backend/importar/teste_ods_match.php`: 22
casos, cada um uma isca que já esteve em produção (o cargo de quem recebe o ato,
a governança no nome do emissor, o parceiro "Socioambiental", a creche na
programação da Agenda Acadêmica). Roda no CI, num job com PHP.

O aviso de cobertura na aba mudou de sentido: não anuncia mais "atos por
avaliar" — o painel é amostra por desenho e esse número seria alarmista. Ele
agora detecta **classificação parada**, comparando o ato normativo mais recente
do acervo com o mais recente que recebeu vínculo, e só aparece acima de 90 dias
de distância.

## Mock de desenvolvimento

`tools/mock_api.py` cobre hoje **todas as rotas que o front chama**: `stats`,
`filtros`, `atos`, `atos/{id}`, `chefias`, `mandatos`, `prazos`, `pad_cadeia`,
`insights`, `analitico`, `jornada`, `cooperacao`, `comissoes`, `ods` e `dossie`.
Antes faltavam cinco (`chefias`, `prazos`, `insights`, `analitico`,
`pad_cadeia`), e os painéis correspondentes caíam no estado vazio com
`?api=http://127.0.0.1:8900` — indistinguível de tela quebrada.

Duas decisões que sustentam o mock:

- **O classificador PAD/SINVE é importado, não recopiado.** `prazos` e
  `pad_cadeia` chamam `classifica_tipo`/`classifica_papel`/`extrai_dias` de
  `backend/importar/extrair_prazos_pad_sinve.py` — a mesma regra que roda na
  importação. Cópia divergente foi exatamente o que fez o `/stats` do mock ficar
  para trás do contrato da API.
- **O resto espelha a projeção estática do `dataSource.ts`**, que por sua vez
  espelha o SQL: mesma regra de titular por posição em `chefias`, mesma janela
  de 90 dias em `prazos`, mesmas agregações em `insights` e `analitico`.

Conferido contra o acervo carregado: 167 chefias (igual ao modo estático), 109
prazos dos quais 78 PAD/SINVE, cadeia de 3 atos num processo real, e `/stats`,
`/insights` e a soma de `porTipo` concordando no mesmo total.

O que o mock **não** reproduz, de propósito: o cache em disco da API PHP e o
cabeçalho `X-Cache`. Tudo é calculado por requisição sobre o JSON em memória —
o que também significa que o mock precisa ser reiniciado depois de o
`portal-data.json` mudar.

## Preparação para commit e deploy

Revise o `git status` porque o checkout já possuía alterações não commitadas
antes desta correção. Os arquivos acima são os que pertencem a esta etapa de
correção.

Depois da revisão:

```powershell
git add src/App.tsx src/components/dashboard/Dashboard.tsx src/components/layout/Sidebar.tsx tools/test_redesign_integrity.mjs docs/IMPLEMENTACAO-REDESIGN.md docs/superpowers/plans/2026-08-01-correcao-redesign-navegacao.md
git commit -m "fix: corrige navegação do redesign"
npm run build
```

Para publicar na hospedagem atual, envie o conteúdo de `dist/` e mantenha a API
PHP existente. Para a migração à UFF, mantenha uma release anterior do frontend
preservada e alterne o diretório ou link `current` para reverter apenas a camada
visual sem tocar no banco.
