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

**Hoje o teste está VERMELHO** — ver a seção de avaliação abaixo. `npm run lint`
e `npm run build` passam.

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

O quadro de atos agora é identificado pelo Boletim de Serviço mais recente e
lista todos os seus atos, ordenados por data de assinatura. A API inclui essa
lista na resposta cacheada de `/api/stats`; o fallback estático seleciona o
mesmo arquivo pelo nome `NN-AA.pdf`. A invalidação do cache da API continua
sendo responsabilidade do fluxo de importação existente.

Para publicar essa alteração, envie o novo frontend de `dist/` e atualize
também `backend/api/index_v2.php` no arquivo publicado como `api/index.php`,
preservando o `config.php` do servidor.

## Avaliação da implementação — 03/08/2026

Revisão do código integrado, com medição no navegador (dev server, modo
estático e modo API pelo `tools/mock_api.py`). **Nada abaixo foi corrigido
ainda**; esta seção é o inventário do que a próxima etapa precisa fechar.

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

### Defeitos encontrados

**1. Bloqueador — a busca global prende a navegação.**
Com qualquer termo de 2+ caracteres na caixa do topo, **todo destino da sidebar
volta sozinho para `#/atos`**. Medido: Cooperação, Ajuda, Dashboard e Prazos
levaram os quatro a `#/atos`; limpar a caixa devolve a navegação. Na prática o
portal fica travado numa aba só depois da primeira busca.
Causa: `handleGlobalSearch` (`src/App.tsx:146`) é recriada a cada render e está
no array de dependências do efeito do TopBar (`src/components/layout/TopBar.tsx:33-35`).
Cada re-render do App muda a identidade da função, o efeito dispara de novo e
reexecuta `navigate('atos')`. Conserto: `useCallback` no App e tirar `onSearch`
das dependências, ou navegar por ação explícita (Enter/submit) em vez de por
efeito sobre o valor debounced.

**2. Alta — os cartões de ato do Dashboard não são clicáveis.**
`ActCard` passa `onClick` para `Card` (`src/components/acts/ActCard.tsx:23`), mas
`CardProps` não declara a propriedade e o `Card` não a repassa para a `div`
(`src/components/ui/Card.tsx:7-22`). O handler nunca chega ao DOM. Pior: o
`hover` aplica `cursor-pointer`, então o cartão *parece* clicável. Como é `div`
e não `button`, também não recebe foco nem responde ao teclado.

**3. Alta — o botão de modo escuro fica fora da tela no celular.**
O conteúdo do cabeçalho ocupa 371 px numa caixa de 256 px a 320 px de viewport.
O cabeçalho é `fixed`, não quebra linha e não rola: ficam fora da tela o
indicador Online/Offline (parcial), o **botão de modo escuro (inteiro)** e o
avatar "UFF". A 390 px (iPhone 14/15) o botão continua cortado — só aparece a
partir de ~440 px. A skin de baixo brilho é recurso de acessibilidade, e é
justamente em tela pequena que ela não pode ser ligada.

**4. Média — a skin escura cobre só parte da paleta.**
O bloco `html.fotofobia` (`src/index.css:34-58`) lista classes específicas.
Ficaram de fora `text-slate-600` (67 usos) e `text-[#003366]` (36 usos), que
continuam escuros sobre a superfície escura (#18221b). O contraste quebra dentro
dos painéis, que é onde está a maior parte do texto.

**5. Média — o `tools/mock_api.py` ficou para trás do contrato de `/stats`.**
A API PHP devolve `porAno`, `ultimaAtualizacao` e `ultimoBoletim`
(`backend/api/index_v2.php:483-485`); o mock devolve só as 7 chaves antigas. Como
o CLAUDE.md documenta o mock como o jeito de testar o modo banco no dev, quem
testar o redesign por ali vê "Nenhum ato recente disponível", o gráfico anual
zerado e "Atualização mais recente indisponível" — indistinguível de um problema
de dados de verdade.

**6. Média — o trabalho de mobile está pela metade e o teste está vermelho.**
`node tools/test_redesign_integrity.mjs` falha em `PrazosApi.tsx`. A Task 2 do
plano tocou 3 dos 8 painéis. E o marcador escolhido para a asserção,
`mobile-stack-table`, **não existe em CSS nenhum** — grep no `src/` só o acha
nos 3 arquivos JSX. Ou seja, a asserção fica verde só de colar a string, sem
comportamento algum. Dos 3 tocados, só Chefias virou lista de cartões de fato;
Mandatos ganhou a classe num `div` que já era cartão, e ActSpreadsheet a ganhou
numa tabela que continua dentro de `overflow-x-auto` com `min-w-[1000px]`.
Sugestão: trocar o marcador pela asserção que o próprio plano escreveu
(`/md:hidden/`), que ao menos exige a classe responsiva real.

**7. Baixa — `ActSpreadsheet.tsx` é código morto.**
Nada em `src/` o importa (a rota de atos usa `ActTable`). Só o
`tools/test_redesign_integrity.mjs` o menciona, duas vezes — inclusive na
asserção nova de mobile. Um dos 8 arquivos que a tarefa de mobile precisa mudar
nunca é renderizado.

**8. Baixa — o dropdown da busca não preenche nada.**
O TopBar abre um painel que exibe "Buscando..." para sempre, com um comentário
dizendo que os resultados viriam do dataSource
(`src/components/layout/TopBar.tsx:74-79`). Está em produção assim.

**9. Baixa — as setas de tendência dos StatCards afirmam o que não foi medido.**
"↓ 1% do acervo" em Revogados lê-se como queda; é participação, não tendência.
É o mesmo problema de honestidade que o teste já barra no "1.247 este mês".

### Rolagem horizontal a 320 px (medida)

Sobra a corrigir, no modo API: **Cooperação** (tabela rolando 182→760 px dentro
de `overflow-x-auto`) e **Jornada** (página estoura 68 px, tabela 182→384 px).
Comissões e ODS já são baseadas em cartões e passam. Atos, Chefias, Prazos,
Mandatos, Relações, Insights e Dashboard não exigem rolagem de página.

### Ordem sugerida

1. Defeito 1 (trava a navegação para todo mundo).
2. Defeitos 2 e 3 (função anunciada que não funciona).
3. Defeito 6 — refazer a asserção antes de continuar a Task 2, senão o resto
   dos painéis entra com o mesmo marcador vazio.
4. Defeitos 4, 5 e o resto.

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
