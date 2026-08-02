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
