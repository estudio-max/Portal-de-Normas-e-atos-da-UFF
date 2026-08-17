# Redações antigas de revalidação no extrator

## Objetivo

Fazer `tools/extrair_boletim.py` reconhecer três redações históricas de
revalidação que hoje são reconhecidas apenas pelo backfill PHP, sem ampliar o
escopo para atos com várias decisões.

Os casos-alvo são os atos `#6095`, `#8910`/`#8911` e `#10848`, já encontrados
pelo modo diagnóstico. O ato `#5792` fica explicitamente fora desta mudança:
ele combina redação substantivada com uma lista de pedidos e pertence à etapa
2 do plano, que alterará o contrato para permitir várias decisões por ato.

## Abordagem

Preservar os dois padrões modernos existentes e acrescentar padrões legados
estreitos, um para cada família de redação:

- decisão expressa como substantivo: “indeferimento do pedido”;
- decisão expressa como gerúndio: “indeferindo a solicitação”;
- homologação de revalidação de título com equivalência a doutorado ou
  mestrado.

Os padrões modernos continuam tendo precedência. Os padrões legados só entram
quando o moderno não casa. Todos convergem para o mesmo resultado público:
`via`, `decisao`, `nivel`, `curso`, `instituicao` e `pais`.

Esta opção é preferível a generalizar o regex moderno porque mantém estreita a
superfície de casamento e torna cada ampliação rastreável a evidência real do
acervo. Um parser novo por etapas também foi descartado por ser uma mudança
estrutural maior do que a cobertura destes três formatos exige.

## Privacidade e classificação

O nome da pessoa não será incluído em nenhum grupo retornado. Os padrões podem
atravessar o trecho nominal apenas para chegar à instituição, como já ocorre
nos padrões modernos, mas a estrutura resultante nunca o armazena.

A via será decidida pela evidência do ato. Equivalência a doutor ou mestre
classifica o registro como pós-graduação mesmo quando o texto usa “diploma” ou
“revalidação”. Na ausência dessa evidência, a forma de graduação continuará
classificada como graduação.

Países passam pela canonização já existente em `_reval_pais`; esta mudança não
criará uma segunda tabela de aliases.

## Testes e aceite

`tools/teste_revalidacao.py` receberá, para cada família nova:

- um trecho positivo real do acervo;
- um trecho negativo semelhante que não pode casar;
- os nomes do trecho positivo no invariante global de privacidade.

Os testes existentes devem continuar verdes. O caso `#5792` será registrado
como limitação da etapa, sem alterar a interface atual de retorno único.

A mudança estará aceita quando:

1. os três formatos de decisão única retornarem os campos esperados;
2. os negativos retornarem `None`;
3. nenhum nome aparecer em qualquer valor retornado;
4. a suíte existente do extrator continuar passando;
5. nenhum arquivo da frente de contrato/pipeline do Claude for modificado.

## Coordenação

Esta implementação toca somente a frente Codex definida em
`docs/CONTRIBUINDO-REPROCESSAMENTO.md`: `tools/extrair_boletim.py` e
`tools/teste_revalidacao.py`. O quadro do plano só será atualizado depois da
implementação validada e sem misturar alterações concorrentes do Claude.
