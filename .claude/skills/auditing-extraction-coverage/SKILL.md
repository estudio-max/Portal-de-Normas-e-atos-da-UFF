---
name: auditing-extraction-coverage
description: Use when writing or changing an extraction pattern in tools/extrair_boletim.py or a backfill in backend/importar/, when publishing a new series or panel from extracted data, or when investigating a number on a panel that looks wrong — especially an absolute zero, a whole year missing, or a rate that jumps between periods.
---

# Auditando a cobertura de um extrator

> **Este arquivo existe em DUAS cópias.** A que o Claude Code carrega é a da
> pasta-mãe (`portal-normas-uff/.claude/skills/`) — skill dentro de `repo/` não
> é descoberta quando se trabalha a partir da pasta-mãe. A do `repo/` é a
> versionada no Git. **Editou uma, copie para a outra:**
> `cp repo/.claude/skills/auditing-extraction-coverage/SKILL.md .claude/skills/auditing-extraction-coverage/SKILL.md`

## Por que esta skill existe

Um padrão de extração cego **não erra — ele emudece.** Não há exceção, log nem
contagem estranha: o extrator acerta tudo o que vê, e o que ele não vê não deixa
rastro. O CI fica verde. O número chega à tela plausível.

Aconteceu **duas vezes em 17/08/2026**, e nas duas por falta de UM VERBO:

| Onde | Faltava | Efeito publicado |
|---|---|---|
| Revalidação | `Aprovar a revalidação` | **0% de deferimento** em anos inteiros; 511 deferimentos invisíveis; 2019 e 2020 ausentes da série |
| Aposentadoria | `Aposentar por invalidez` | `invalidez = 0` em **todos** os anos da série |

Nenhum teste podia pegar: os casos de teste são escritos **a partir do padrão** —
escreve-se o indeferimento porque foi o indeferimento que se programou.

## O procedimento

### 1. Meça antes de supor

```bash
python tools/auditar_cobertura.py --campo revalidacao --assunto revalida
python tools/auditar_cobertura.py --campo aposentadoria --assunto aposent
```

Ele devolve três coisas:

- **cobertura por ano** — atos que citam o assunto contra atos marcados;
- **verbo órfão** — verbo que aparece no texto e em ato marcado *nenhum*. É o
  achado que resolve: foi assim que `Aprovar` apareceu, com 511 ocorrências e
  zero atos marcados;
- **zero absoluto** — ano com atos do assunto e nenhum marcado.

⚠️ **Depois de consertar um padrão, rode com `--vivo`**, senão você mede o JSON
antigo e conclui que o conserto não funcionou:

```bash
python tools/auditar_cobertura.py --campo aposentadoria --assunto aposent \
    --vivo extrai_aposentadoria
```

### 2. Leia o texto antes de escrever padrão

A ferramenta aponta onde olhar; **quem decide é quem lê o ato.** Proximidade
contamina: em 2015 a maioria dos `indeferir` perto de `revalidação` é
*"Indeferir o pedido de ADICIONAL DE INSALUBRIDADE"*.

O campo a ler é `corpo_texto`, nunca a ementa — a busca do portal não varre o
corpo.

> **Trocar a palavra numa frase que você mesmo escreveu prova que o padrão é
> assimétrico. Só o texto bruto diz qual frase o acervo usa.** Eu já confundi as
> duas e atribuí o defeito à causa errada.

### 3. Consulte e alimente as equivalências

[`docs/EQUIVALENCIAS-DE-TERMOS.md`](../../../docs/EQUIVALENCIAS-DE-TERMOS.md) —
a lista viva das redações que o Boletim usa para o mesmo fato, com trecho real
de cada uma. Cubra todas as do domínio; acrescente a que faltar.

### 4. Nunca escreva a decisão dentro do padrão

```python
r"pelo\s+indeferimento\s+do\s+pedido"        # errado: o oposto fica invisível
r"pelo\s+(?P<neg>in)?deferimento\s+do\s+pedido"   # certo: o verbo é capturado
```

### 5. Feche com teste, nos dois sentidos

- Caso novo no teste do domínio (`tools/teste_revalidacao.py`,
  `tools/teste_aposentadoria.py`), incluindo o que **não** pode casar.
- **Confira a reprovação:** reintroduza o defeito e veja o teste falhar
  nomeando a redação. Trava que não reprova não é trava.
- Espelhe no backfill em PHP — extrator e `backend/importar/` têm que ter os
  mesmos padrões, senão o ato aparece ou some conforme o caminho que o gravou.

### 6. Faça o painel denunciar

Gráfico que desenha só o volume esconde numerador quebrado: 700 decisões e 7
deferimentos produzem colunas de aparência normal. Desenhe a **composição**.

E distinga contagem de taxa no texto da tela: "mínimo verificado" é honesto para
uma contagem, que só cresce; **porcentagem não é mínimo de nada.**

## Lista de conferência

- [ ] Rodei `auditar_cobertura.py` no domínio, e com `--vivo` depois do conserto.
- [ ] Li o `corpo_texto` de alguns atos dos verbos órfãos.
- [ ] Nenhum padrão tem a decisão escrita como literal.
- [ ] Cobri todas as redações de `EQUIVALENCIAS-DE-TERMOS.md`, e acrescentei a nova.
- [ ] Caso de teste novo, e conferi que ele reprova sem o conserto.
- [ ] Extrator e backfill PHP têm os mesmos padrões.
- [ ] O painel desenha a composição, não só o volume.
- [ ] Conferi a série **ano a ano** procurando zero absoluto.

## O sinal que denuncia

**Zero absoluto e cem por cento absoluto são quase sempre artefato.** Um
processo humano com centenas de casos não dá zero por sete anos seguidos e volta
a 83%. Quando a série fizer isso, o padrão está descrevendo a si mesmo — não o
acervo.

Método completo: [`docs/VIES-DE-EXTRACAO.md`](../../../docs/VIES-DE-EXTRACAO.md).
