# Listas de atos no mobile

## Objetivo

Tornar todas as listas interativas de atos e registros do portal legíveis e
operáveis em telas estreitas, sem remover informações ou funções disponíveis
no desktop.

## Comportamento responsivo

- Em larguras a partir de 768 px, cada tela mantém sua tabela atual.
- Abaixo de 768 px, cada linha de resultado é apresentada como um cartão de
  largura total, sem rolagem horizontal.
- O cartão expõe primeiro a identificação principal e o estado; data, órgão e
  demais metadados aparecem em uma grade curta e legível; textos longos ocupam
  uma linha própria.
- Ações existentes — abrir ficha, navegar para relações, consultar o SEI e
  paginar — continuam acessíveis por toque.
- Filtros passam a uma coluna em telas estreitas, mantendo a ordem e os mesmos
  controles disponíveis no desktop.

## Escopo

O padrão é aplicado às listas interativas de Atos e Normas, planilha legada,
Chefias, Mandatos, Prazos, Jornada, Comissões, Cooperação e Dossiê. Tabelas
geradas exclusivamente para impressão não mudam.

## Implementação

- Criar componentes de cartão focados em responsabilidade: um cartão geral de
  ato e variações pequenas por domínio quando os campos não forem equivalentes.
- Renderizar tabela e lista de cartões a partir da mesma coleção de dados;
  classes responsivas escolhem uma ou outra apresentação.
- Reutilizar cores, etiquetas, bordas, tipografia e foco visível já definidos
  pelo portal; não introduzir dependências de interface.

## Critérios de aceitação

- Nenhuma lista interativa exige rolagem horizontal em 320 px de largura.
- Todas as informações exibidas em uma linha móvel ficam disponíveis no cartão
  ou em sua ação existente de detalhe.
- Paginação, filtros e botões funcionam no layout móvel.
- As tabelas de desktop e o layout de impressão permanecem sem regressões.
- Checagem TypeScript, teste estrutural e build de produção passam.
