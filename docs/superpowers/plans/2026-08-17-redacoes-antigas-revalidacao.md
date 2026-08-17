# Redações Antigas de Revalidação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o extrator Python reconhecer três formatos históricos de decisão única sobre revalidação, mantendo privacidade e sem antecipar o suporte a várias decisões por ato.

**Architecture:** Os dois regex modernos permanecem inalterados e com precedência. Três regex legados estreitos são avaliados depois deles e convertidos para o mesmo dicionário público por pequenos normalizadores internos, reutilizando `_reval_pais`.

**Tech Stack:** Python 3, `re`, suíte executável `tools/teste_revalidacao.py`, Git.

## Global Constraints

- Tocar somente `tools/extrair_boletim.py`, `tools/teste_revalidacao.py` e, após validação, o estado da etapa 3 em `docs/PLANO-REPROCESSAMENTO-ACERVO.md`.
- Não editar os arquivos de contrato/pipeline atribuídos ao Claude.
- Usar apenas trechos reais do acervo nos testes positivos e negativos.
- Nenhum valor retornado pode conter o nome da pessoa requerente.
- Manter retorno único; o ato `#5792` e listas de pedidos continuam fora do escopo.
- Preservar os padrões modernos e executar os legados somente quando eles não casarem.

---

## File Structure

- `tools/teste_revalidacao.py`: fixtures reais, expectativas, negativos e invariante de privacidade.
- `tools/extrair_boletim.py`: regex e normalização das três famílias legadas.
- `docs/PLANO-REPROCESSAMENTO-ACERVO.md`: quadro de estado; marcar etapa 3 somente depois de toda a verificação.

### Task 1: Travar os três formatos históricos com testes reais

**Files:**
- Modify: `tools/teste_revalidacao.py`

**Interfaces:**
- Consumes: `extrai_revalidacao(trecho: str) -> dict[str, str] | None`.
- Produces: fixtures `LEGADO_INDEFERIMENTO`, `LEGADO_GERUNDIO`, `LEGADO_TITULO` e `REGIMENTO_REVALIDACAO`; expectativas públicas para os três formatos.

- [ ] **Step 1: Acrescentar as fixtures reais**

Inserir depois de `POS_MESTRADO`:

```python
LEGADO_INDEFERIMENTO = """decide manifestar-se pelo indeferimento do pedido de
revalidação do diploma de tatiane costa dos santos, em nível de graduação em
bioquímica, realizado na universidade de suffolk, boston, estados unidos da
américa."""

LEGADO_GERUNDIO = """decide 1-homologar o parecer da comissão de equivalência
do colegiado do curso de medicina, indeferindo a solicitação de revalidação de
diploma de tito victor martinez carrasco, em nível de graduação em medicina,
realizado na universidad mayor real y pontifícia de san francisco xavier de
chuquisaca."""

LEGADO_TITULO = """decide homologar a revalidação do título de “doctor of
philosophy in computer science”, obtido por bianca zadrozny, junto a university
of california, san diego, estados unidos da américa, como doutor em ciência da
computação, nos termos estabelecidos na resolução 97/1996, deste conselho."""

REGIMENTO_REVALIDACAO = """cabe ao colegiado aprovar a comissão de validação e
revalidação de diplomas, indicados pela coordenação do programa, bem como os
respectivos pareceres; homologar os relatórios das comissões examinadoras;
julgar as decisões do coordenador do programa a respeito de recursos."""

RECURSO_INDEFERIMENTO = """resolve: art. 1º conhecer o pedido de recurso
relativo ao indeferimento do pedido de reconhecimento de diploma de
pós-graduação obtido no exterior, e dar-lhe provimento."""
```

Esses trechos vêm, respectivamente, dos atos `6095`, `8910`, `10848` e do
regimento anexado à Resolução `546/2014` no dump local. O último vem da
Resolução CUV/UFF `685/2026`, já presente no índice local.

- [ ] **Step 2: Acrescentar os positivos e o negativo à lista `CASOS`**

Inserir antes da seção de canonização:

```python
    ("legado: indeferimento substantivado, ato 6095", LEGADO_INDEFERIMENTO, {
        "via": "Graduação", "decisao": "Indeferido", "nivel": "Graduação",
        "curso": "bioquímica", "instituicao": "universidade de suffolk, boston",
        "pais": "Estados Unidos"}),

    ("legado: indeferindo em parecer homologado, ato 8910", LEGADO_GERUNDIO, {
        "via": "Graduação", "decisao": "Indeferido", "nivel": "Graduação",
        "curso": "medicina",
        "instituicao": "universidad mayor real y pontifícia de san francisco xavier de chuquisaca",
        "pais": ""}),

    ("legado: revalidacao de titulo como doutor, ato 10848", LEGADO_TITULO, {
        "via": "Pós-graduação", "decisao": "Deferido", "nivel": "Doutorado",
        "curso": "doctor of philosophy in computer science",
        "instituicao": "university of california, san diego",
        "pais": "Estados Unidos"}),

    ("regimento apenas define competencia sobre revalidacao",
     REGIMENTO_REVALIDACAO, None),

    ("recurso menciona indeferimento anterior, mas decide dar provimento",
     RECURSO_INDEFERIMENTO, None),
```

As três guardas negativas ficam explícitas: `RECURSO_INDEFERIMENTO` protege a
forma substantivada; `REGIMENTO_REVALIDACAO` protege o vocabulário de parecer e
competência; o caso já existente “oração relativa descreve ato CITADO” protege
contra extrair decisão histórica apenas mencionada por outro ato.

“Homologar a revalidação” produz `Deferido`: o ato homologa a concessão, sem
negação no dispositivo.

- [ ] **Step 3: Estender o invariante de privacidade**

Adicionar a `NOMES`:

```python
    (LEGADO_INDEFERIMENTO, ["tatiane", "costa", "santos"]),
    (LEGADO_GERUNDIO, ["tito", "victor", "martinez", "carrasco"]),
    (LEGADO_TITULO, ["bianca", "zadrozny"]),
```

- [ ] **Step 4: Rodar o teste para comprovar a falha inicial**

Run: `python tools/teste_revalidacao.py`

Expected: exit `1`; exatamente os três casos `legado:` falham com “veio None”; os casos anteriores e o negativo de regimento continuam `ok`.

- [ ] **Step 5: Commitar apenas os testes vermelhos**

```powershell
git add -- tools/teste_revalidacao.py
git commit -m "Testa redacoes antigas de revalidacao"
```

### Task 2: Implementar os padrões legados estreitos

**Files:**
- Modify: `tools/extrair_boletim.py:1835-1916`
- Test: `tools/teste_revalidacao.py`

**Interfaces:**
- Consumes: texto normalizado por espaços em `extrai_revalidacao` e `_reval_pais(bruto: str) -> str`.
- Produces: o mesmo `dict` com `via`, `decisao`, `nivel`, `curso`, `instituicao`, `pais`; não altera assinatura nem cardinalidade.

- [ ] **Step 1: Declarar os três regex depois de `_REVAL_POS_RE`**

```python
_REVAL_INDEFERIMENTO_RE = re.compile(
    r"manifestar-se\s+pelo\s+indeferimento\s+do\s+pedido\s+de\s+"
    r"revalida[çc][ãa]o\s+do\s+diploma\s+de\s+.+?,\s*"
    r"em\s+n[íi]vel\s+de\s+(?P<nivel>gradua[çc][ãa]o|mestrado|doutorado)\s+em\s+"
    r"(?P<curso>.+?),\s*realizad[oa]\s+n[ao]\s+(?P<origem>.+?)\.\s*",
    re.I | re.S)

_REVAL_GERUNDIO_RE = re.compile(
    r"homologar\s+o\s+parecer\s+da\s+comiss[ãa]o.+?,\s*"
    r"indeferindo\s+a\s+solicita[çc][ãa]o\s+de\s+revalida[çc][ãa]o\s+de\s+"
    r"diploma\s+de\s+.+?,\s*em\s+n[íi]vel\s+de\s+"
    r"(?P<nivel>gradua[çc][ãa]o|mestrado|doutorado)\s+em\s+"
    r"(?P<curso>.+?),\s*realizad[oa]\s+n[ao]\s+(?P<origem>.+?)\.\s*",
    re.I | re.S)

_REVAL_TITULO_LEGADO_RE = re.compile(
    r"homologar\s+a\s+revalida[çc][ãa]o\s+do\s+t[íi]tulo\s+de\s+[“\"']?"
    r"(?P<curso>.+?)[”\"']?,\s*obtid[oa]\s+por\s+.+?,\s*"
    r"junto\s+[aà]o?\s+(?P<origem>.+?),\s*como\s+"
    r"(?P<equiv>doutor(?:ado)?|mestre|mestrado)\s+em\s+.+?"
    r"(?:,\s*nos\s+termos|\.\s|$)",
    re.I | re.S)
```

- [ ] **Step 2: Acrescentar normalizadores locais antes de `extrai_revalidacao`**

```python
def _reval_origem(bruto):
    partes = [x.strip() for x in limpar(bruto).split(",") if x.strip()]
    if len(partes) >= 2:
        pais = _reval_pais(partes[-1])
        if pais != partes[-1] or _fold(partes[-1]) in _REVAL_PAIS_CANON:
            return ", ".join(partes[:-1]), pais
    return limpar(bruto).strip(" .,;"), ""


def _reval_nivel(bruto):
    folded = _fold(bruto or "")
    if "doutor" in folded:
        return "Pós-graduação", "Doutorado"
    if "mestr" in folded:
        return "Pós-graduação", "Mestrado"
    return "Graduação", "Graduação"
```

`_reval_origem` só separa o último segmento quando ele é alias conhecido. Isso
preserva instituições com cidade, como “universidade de suffolk, boston”, e
mantém país vazio no ato `8910`, que não declara país.

- [ ] **Step 3: Avaliar os legados depois do laço moderno**

Inserir antes do `return None` final de `extrai_revalidacao`:

```python
    for rx, decisao in (
            (_REVAL_INDEFERIMENTO_RE, "Indeferido"),
            (_REVAL_GERUNDIO_RE, "Indeferido")):
        m = rx.search(texto)
        if not m:
            continue
        inst, pais = _reval_origem(m.group("origem"))
        via, nivel = _reval_nivel(m.group("nivel"))
        return {
            "via": via,
            "decisao": decisao,
            "nivel": nivel,
            "curso": limpar(m.group("curso")).strip(" .,;")[:180],
            "instituicao": inst[:180],
            "pais": pais,
        }

    m = _REVAL_TITULO_LEGADO_RE.search(texto)
    if m:
        inst, pais = _reval_origem(m.group("origem"))
        via, nivel = _reval_nivel(m.group("equiv"))
        return {
            "via": via,
            "decisao": "Deferido",
            "nivel": nivel,
            "curso": limpar(m.group("curso")).strip(" “”\"'.,;")[:180],
            "instituicao": inst[:180],
            "pais": pais,
        }
```

- [ ] **Step 4: Rodar o teste focal**

Run: `python tools/teste_revalidacao.py`

Expected: exit `0`, resumo `17 caso(s), 0 falha(s).` e mensagem de que nenhum nome aparece na saída.

- [ ] **Step 5: Rodar as regressões Python do extrator**

Run:

```powershell
$tests = Get-ChildItem tools -Filter 'teste_*.py' | Sort-Object Name
foreach ($test in $tests) {
    python $test.FullName
    if ($LASTEXITCODE -ne 0) { throw "Falhou: $($test.Name)" }
}
```

Expected: exit `0`; nenhuma exceção `Falhou:`.

- [ ] **Step 6: Commitar a implementação verde**

```powershell
git add -- tools/extrair_boletim.py
git commit -m "Extrai redacoes antigas de revalidacao"
```

### Task 3: Registrar conclusão da etapa e fazer verificação final

**Files:**
- Modify: `docs/PLANO-REPROCESSAMENTO-ACERVO.md`
- Test: `tools/teste_revalidacao.py`

**Interfaces:**
- Consumes: implementação e regressões verdes das Tasks 1 e 2.
- Produces: quadro do plano com a etapa 3 marcada como concluída; não muda interfaces de código.

- [ ] **Step 1: Atualizar somente a linha da etapa 3**

Alterar:

```markdown
| 3 | Acrescentar as 4 redações antigas | ⬜ |
```

para:

```markdown
| 3 | Acrescentar as redações antigas de decisão única (`#5792` segue na etapa 2) | ✅ |
```

- [ ] **Step 2: Verificar diff e ausência de arquivos do Claude no stage**

Run:

```powershell
git diff --check
git status --short
git diff --name-only --cached
```

Expected: `git diff --check` sem saída; arquivos do Claude podem continuar modificados na árvore, mas nenhum deles aparece no índice.

- [ ] **Step 3: Repetir a verificação focal fresca**

Run: `python tools/teste_revalidacao.py`

Expected: exit `0`, `17 caso(s), 0 falha(s).`.

- [ ] **Step 4: Commitar o estado do plano**

```powershell
git add -- docs/PLANO-REPROCESSAMENTO-ACERVO.md
git commit -m "Marca redacoes antigas de revalidacao concluidas"
```

- [ ] **Step 5: Conferir os commits e a árvore compartilhada**

Run:

```powershell
git log -4 --oneline
git status --short --branch
```

Expected: os commits de teste, implementação e plano aparecem no topo; as alterações locais do Claude permanecem presentes e não foram incluídas nesses commits.
