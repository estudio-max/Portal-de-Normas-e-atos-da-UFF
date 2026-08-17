# Trabalho conjunto no reprocessamento (Claude + Codex)

Combinado em 17/08/2026 pelo mantenedor. Vale enquanto durar o trabalho do
[plano do reprocessamento](PLANO-REPROCESSAMENTO-ACERVO.md).

## A fronteira

Não se divide por quantidade de arquivos, e sim por **o que tem critério de
aceite objetivo e o que exige julgamento sobre contrato**.

| Frente | Arquivos | Responsável |
|---|---|---|
| **Padrões de extração** — redações antigas, múltiplas decisões por ato, canonização de país | `tools/extrair_boletim.py` (funções `extrai_*`), `backend/importar/backfill_ato_revalidacao.php` | Codex |
| **Contrato e pipeline** — formato do JSON, schema, importador, rotas, deploy, travas de CI | `tools/gerar_dados_portal.py`, `backend/importar/importar_v2.php`, `backend/api/index_v2.php`, `backend/db/*.sql`, `.github/workflows/*` | Claude |

**Regra que evita 90% do atrito: os dois nunca editam o mesmo arquivo na mesma
janela.** Se uma tarefa exigir tocar os dois lados, ela para e vira conversa —
não vira commit.

## O teste é o contrato

Padrão novo **só entra com caso de teste junto**. O formato já existe em
`tools/teste_revalidacao.py`; siga-o.

Regras do caso de teste, todas com motivo:

1. **Use trecho REAL do acervo**, não exemplo inventado. Todo caso lá veio do
   modo diagnóstico rodado em produção. Exemplo inventado testa a regex contra
   a imaginação de quem a escreveu.
2. **Inclua o caso NEGATIVO.** Para cada redação nova, um trecho parecido que
   NÃO pode casar. O acervo tem muito regimento de pós-graduação falando em
   "julgar as decisões do coordenador" — isso já quase virou falso positivo.
3. **Não remova o invariante de privacidade.** O último bloco do arquivo
   reprova se qualquer campo da saída contiver o nome da pessoa. O painel é
   agregado por decisão do mantenedor; se alguém "melhorar" a regex e capturar
   a pessoa sem querer, o CI tem de barrar.
4. **Texto em minúsculas quando for para o backfill.** O banco guarda assim
   (ver o plano); testar só com caixa correta esconde defeito.

O CI roda esses testes no job `extrator`. Verde é condição de merge.

## Ordem de merge

1. Contrato primeiro, padrões depois. Padrão que depende de campo novo no JSON
   fica bloqueado até o campo existir — o contrário gera commit que não roda.
2. Um PR por frente. PR que mistura as duas volta.
3. Quem concluir etapa, **marca o quadro no plano** — é a única fonte de
   verdade sobre o que já foi feito.

## Como medir cobertura (e como NÃO medir)

⚠️ **A busca do portal não serve de denominador.** Procurar a frase exata
"Revalidação do Diploma" devolve 20 atos, enquanto o backfill casa 135 com um
regex que exige essa frase. A busca por frase não varre o corpo como parece.

Meça com o modo diagnóstico do próprio script:

```
importar/backfill_ato_revalidacao.php?token=…&diagnostico=1
```

Ele não grava nada e informa: quantos casariam, quantos parecem decisão e não
casaram (com amostra do texto), e quantos estão no teto de truncagem.

## Armadilhas já pagas — não repita

- **Pasta `importar/` nega todo `.php` por padrão.** Script novo precisa de
  entrada no `backend/importar/.htaccess`, senão o Apache devolve 403 e
  **parece defeito do script**. Já custou uma rodada inteira de diagnóstico
  errado (o palpite foi permissão de arquivo; estava 0644).
- **A caixa do texto do banco.** `ato_texto.texto_original` era minúsculo
  apesar do nome (corrigido em 17/08/2026, mas as linhas antigas seguem assim
  até o reprocesso).
- **PHP nesta máquina não está no PATH.** Invoque por
  `& "$env:LOCALAPPDATA\php83\php.exe"`.
- **Classifique pela evidência, não pelo vocabulário.** "revalidação do
  **diploma** … como equivalente ao de **doutor** em letras" é pós-graduação.
  Ler pela palavra "diploma" põe doutorados na conta da graduação e estraga as
  duas taxas.
