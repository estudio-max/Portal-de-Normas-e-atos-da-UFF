# Dashboard: série anual e atos do último boletim

## Objetivo

Corrigir o painel **Atos por ano** e fazer com que **Últimos atos publicados**
represente integralmente o Boletim de Serviço mais recente indexado.

## Comportamento

### Série anual

- Exibir uma barra para cada ano de 2001 a 2026 que exista no acervo.
- Calcular a quantidade a partir do ano de cada ato; nenhuma barra usa dados
  simulados.
- Proporcionar a altura das barras ao maior valor da série.
- Exibir o ano e a quantidade exata por `title` e rótulo acessível.
- Manter o gráfico legível em telas menores, usando rótulos de eixo em
  intervalos, sem ocultar barras.

### Último boletim

- Determinar o boletim mais recente usando o identificador de arquivo
  `NN-AA.pdf`, como já ocorre no banner de atualização.
- Mostrar todos os atos cujo arquivo corresponde ao boletim encontrado.
- Ordenar os atos por data de assinatura, do mais recente para o mais antigo,
  preservando uma ordem determinística nos empates.
- Trocar o título para identificar o boletim e informar a quantidade de atos.
- A ação "Ver todos" continua levando à consulta completa de atos.

## Dados e compatibilidade

- No modo estático, derivar série e lista a partir de `portal-data.json`.
- No modo API, a resposta deve conter os agregados e metadados necessários para
  chegar ao mesmo resultado sem depender de dados estáticos locais.
- Ausência de dados deve exibir um estado vazio explícito; o dashboard nunca
  pode mostrar barras ilustrativas.

## Verificação

- Teste automatizado confirma a série anual de 2001 a 2026 e que o Dashboard
  recebe valores reais em `porAno`.
- Teste automatizado confirma que a lista seleciona todos e somente os atos do
  último arquivo de boletim, em ambos os modos de dados.
- Checagem de tipos, build de produção e teste de regressão estrutural passam.
