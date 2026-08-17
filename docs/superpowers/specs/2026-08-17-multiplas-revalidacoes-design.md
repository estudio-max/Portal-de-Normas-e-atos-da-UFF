# Múltiplas decisões de revalidação por ato

## Objetivo

Representar todos os pedidos decididos por um mesmo ato, em vez de gravar
silenciosamente apenas o primeiro. O caso real que fecha o contrato é o ato
interno `#5792`: as Decisões nº 018/08 e nº 019/08 foram publicadas no mesmo
bloco e homologam dois diplomas distintos.

A unidade contada no painel passa a ser o pedido decidido, não o ato que o
publicou. A mudança preserva a regra estrutural de privacidade: nenhum nome de
requerente entra no JSON estruturado nem em `ato_revalidacao`.

## Contrato de transição do JSON

A transição será compatível com consumidores antigos:

- `revalidacao` continua contendo a primeira decisão, quando houver ao menos
  uma;
- `revalidacoes` aparece somente quando houver duas ou mais e contém a lista
  completa, na ordem documental;
- ato sem decisão continua com `revalidacao: null` e sem `revalidacoes`.

O campo singular não é uma segunda fonte. Ele é um alias transitório do
primeiro item da lista produzida pelo extrator. O gerador deriva os dois da
mesma lista em memória para impedir divergência.

O importador novo prefere `revalidacoes` quando presente e cai para
`revalidacao` nas safras anteriores. Um JSON anterior ao módulo, sem nenhuma
das duas chaves, não apaga fatos existentes. Um JSON novo que declare
explicitamente `revalidacao: null` sincroniza o ato para zero decisões.

## Extração

`tools/extrair_boletim.py` ganhará a interface autoritativa:

```python
def extrai_revalidacoes(trecho: str) -> list[dict]:
    ...
```

Ela percorre todas as ocorrências válidas, preserva a ordem no texto e devolve
uma lista de dicionários com `via`, `decisao`, `nivel`, `curso`, `instituicao`
e `pais`. `extrai_revalidacao(trecho)` permanece como wrapper compatível que
retorna o primeiro item ou `None`.

Os padrões modernos e legados continuam usando a mesma guarda contra decisões
apenas citadas. A extração do formato em lista de `#5792` deve reconhecer as
duas entradas, não capturar os nomes e não atravessar a Decisão nº 017/08 de
afastamento publicada antes do bloco.

## Persistência e migração

`ato_revalidacao` ganhará:

```sql
ordem SMALLINT UNSIGNED NOT NULL DEFAULT 1
```

A chave única muda de `ato_id` para `(ato_id, ordem)`. As linhas existentes
recebem `ordem = 1`, preservando todos os IDs e fatos atuais. A migração deve
ser idempotente para operação pelo phpMyAdmin em Percona Server 5.7 e deve ser
aplicada antes do importador que grava listas.

Para cada ato cujo JSON declara o módulo, o importador sincroniza o conjunto
completo dentro da transação existente: remove as linhas anteriores daquele
`ato_id` e insere a lista numerada a partir de 1. Isso elimina ordens obsoletas
quando uma reextração corrige ou reduz a lista. Repetir a mesma importação
produz o mesmo estado.

O backfill histórico passa a usar o mesmo contrato de ordem quando encontrar
mais de uma decisão. Ele não pode continuar com `break` na primeira ocorrência
nem com upsert por `ato_id` isolado.

## API e interface

A rota agregada não muda de formato. As consultas já contam linhas de
`ato_revalidacao`; após a migração, cada linha representa um pedido e os totais
passam a refletir corretamente atos coletivos. Não será criada rota nominal ou
lista de requerentes.

Não é necessário expor `ordem` no frontend atual: ela existe para identidade e
idempotência da tabela-fato. O ato individual continua acessível pela busca
normal.

## Compatibilidade e ordem de deploy

A ordem obrigatória é:

1. aplicar a migração SQL no servidor;
2. implantar importador e auxiliares compatíveis com lista;
3. publicar JSON que possa conter `revalidacoes`;
4. reprocessar/importar o acervo.

O caminho inverso perderia silenciosamente os itens após o primeiro. O
importador novo aceita JSON antigo; o importador antigo não entende a lista e
por isso não pode receber o JSON novo antes do deploy.

`CLAUDE.md` deve registrar esta decisão e a ordem de deploy, substituindo a
afirmação antiga de que um ato decide um pedido. Assim o Claude encontra o
contrato ao retomar o projeto.

## Testes e critérios de aceite

Os testes usarão o trecho real de `#5792` e devem comprovar:

1. duas decisões extraídas, na ordem 018/08 e 019/08;
2. ambas classificadas como pós-graduação, Doutorado, Deferido e Reino Unido;
3. instituições distintas preservadas;
4. nenhum fragmento dos dois nomes nos valores retornados;
5. o wrapper singular devolve exatamente o primeiro item;
6. todos os 20 casos existentes continuam verdes;
7. JSON com uma decisão mantém apenas o singular; com duas publica singular e
   plural; sem decisão publica `revalidacao: null` sem plural;
8. importador aceita JSON antigo, de transição e novo, e remove ordens
   obsoletas somente quando o módulo está declarado;
9. migração preserva as linhas existentes como ordem 1 e permite duas linhas
   para o mesmo ato;
10. consultas agregadas continuam válidas sem mudança de resposta.

## Fora do escopo

- Expor nomes de requerentes.
- Redesenhar o painel de revalidação.
- Executar o reprocessamento completo, importação em produção ou auditoria de
  PDFs; essas são as etapas 4 a 7 do plano.
- Endurecer genericamente todos os curingas dos regex além do necessário para
  o caso real e suas regressões.
