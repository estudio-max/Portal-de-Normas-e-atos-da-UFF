# Múltiplas Decisões de Revalidação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Representar e persistir todos os pedidos de revalidação decididos por um mesmo ato, preservando consumidores antigos e a privacidade estrutural.

**Architecture:** `extrai_revalidacoes()` vira a fonte autoritativa e o singular permanece um alias do primeiro item. O JSON publica o plural apenas quando necessário; o importador sincroniza uma tabela-fato chaveada por `(ato_id, ordem)` e o backfill ganha um parser puro para o formato coletivo legado.

**Tech Stack:** Python 3 (`re`), PHP 8.3, Percona Server 5.7 SQL, Node.js para travas estáticas, GitHub Actions.

## Global Constraints

- `revalidacao` continua contendo a primeira decisão; `revalidacoes` aparece somente com duas ou mais e contém a lista completa em ordem documental.
- JSON sem nenhuma das duas chaves não apaga fatos; JSON que declara `revalidacao: null` sincroniza zero decisões.
- Nenhum nome de requerente entra no JSON estruturado nem em `ato_revalidacao`.
- A chave natural é `(ato_id, ordem)`, com `ordem` iniciando em 1.
- Percona Server 5.7: sem CTE, window functions, `ADD COLUMN IF NOT EXISTS` ou `DROP INDEX IF EXISTS`.
- Migração SQL antes do importador; importador antes de JSON com plural.
- O caso real `#5792` deve produzir duas decisões, 018/08 e 019/08, sem capturar a Decisão 017/08 de afastamento.
- A API agregada não muda de formato e passa a contar pedidos porque cada linha representa um pedido.
- Atualizar `CLAUDE.md` com o contrato e a ordem de deploy.
- Não executar reprocessamento completo nem operação de produção nesta implementação.

---

## File Structure

- `tools/extrair_boletim.py`: lista autoritativa e wrapper singular.
- `tools/teste_revalidacao.py`: regressão real de `#5792`, ordem e privacidade.
- `tools/gerar_dados_portal.py` e `tools/teste_dados_portal.py`: contrato singular/plural publicado.
- `backend/db/ato_revalidacao.sql`: schema canônico para instalações novas.
- `backend/db/migrar_ato_revalidacao_multiplas.sql`: migração idempotente Percona 5.7.
- `tools/teste_ato_revalidacao_schema.mjs`: trava estática do schema e da migração.
- `backend/importar/revalidacao_lista.php`: normalizador puro das safras de JSON.
- `backend/importar/teste_revalidacao_lista.php`: testes sem banco do normalizador e da integração estática.
- `backend/importar/importar_v2.php`: sincronização por ordem.
- `backend/importar/revalidacao_lista_legada.php`: parser puro do bloco coletivo histórico.
- `backend/importar/teste_revalidacao_lista_legada.php`: regressão PHP do ato `#5792`.
- `backend/importar/backfill_ato_revalidacao.php`: sincronização de todas as ocorrências.
- `CLAUDE.md` e `docs/PLANO-REPROCESSAMENTO-ACERVO.md`: decisão permanente e estado.

### Task 1: Extrair todas as decisões do ato coletivo

**Files:**
- Modify: `tools/teste_revalidacao.py`
- Modify: `tools/extrair_boletim.py:1835-1992`

**Interfaces:**
- Produces: `extrai_revalidacoes(trecho: str) -> list[dict[str, str]]` em ordem documental.
- Preserves: `extrai_revalidacao(trecho: str) -> dict[str, str] | None` como primeiro item.

- [ ] **Step 1: Adicionar fixture e asserts reais antes da implementação**

Importar `extrai_revalidacoes` e inserir a fixture literal, reduzida apenas ao bloco relevante do dump:

```python
MULTIPLAS_5792 = """o conselho de ensino e pesquisa da universidade federal
fluminense, no uso de suas atribuições, através das decisões n.ºs 018 e
019/2008, pronuncia-se, em face do que dispõe a legislação em vigor, pela
homologação da revalidação do diploma, obtido por: decisão nº. 018/08. julius
césar barreto leite, diploma de “doctor of philosophy” junto à the victoria
university of manchester, institute of science and technology, departament of
eletrical engineering and electronics, inglaterra, como doutorado em ciência
da computação. (processo nº 23069.054576/07-82); e decisão nº. 019/08. orlando
gomes loques filho, diploma de “doctor of philosophy” junto à university of
london, imperial college of science and technology, inglaterra, como doutorado
em ciência da computação. (processo nº. 23069.054577/07-27). sala das reuniões,
16 de janeiro de 2008."""

ESPERADO_5792 = [
    {"via": "Pós-graduação", "decisao": "Deferido", "nivel": "Doutorado",
     "curso": "doctor of philosophy",
     "instituicao": "the victoria university of manchester, institute of science and technology, departament of eletrical engineering and electronics",
     "pais": "Reino Unido"},
    {"via": "Pós-graduação", "decisao": "Deferido", "nivel": "Doutorado",
     "curso": "doctor of philosophy",
     "instituicao": "university of london, imperial college of science and technology",
     "pais": "Reino Unido"},
]

obtidas_5792 = extrai_revalidacoes(MULTIPLAS_5792)
if obtidas_5792 != ESPERADO_5792:
    falhas += 1
    print(f"FALHA: ato 5792 deveria produzir duas decisões\n   {obtidas_5792}")
else:
    print("ok   : ato 5792 produz duas decisões na ordem documental")
if extrai_revalidacao(MULTIPLAS_5792) != ESPERADO_5792[0]:
    falhas += 1
    print("FALHA: wrapper singular não devolve o primeiro item")
```

Adicionar `MULTIPLAS_5792` ao invariante com os nomes `julius`, `césar`,
`barreto`, `leite`, `orlando`, `gomes`, `loques`, `filho`.

- [ ] **Step 2: Confirmar RED**

Run: `python tools/teste_revalidacao.py`

Expected: exit `1` porque `extrai_revalidacoes` ainda não existe.

- [ ] **Step 3: Implementar o parser coletivo e a interface de lista**

Adicionar regex estreitos para o cabeçalho e itens:

```python
_REVAL_BLOCO_LISTA_RE = re.compile(
    r"pela\s+homologa[çc][ãa]o\s+da\s+revalida[çc][ãa]o\s+do\s+diploma,?\s*"
    r"obtid[oa]\s+por:\s*(?P<itens>.+?)(?=\bsala\s+das\s+reuni[õo]es\b|$)",
    re.I | re.S)

_REVAL_ITEM_LISTA_RE = re.compile(
    r"decis[ãa]o\s+n[º°.]?\s*\.?(?P<numero>\d+)\s*/\s*(?P<ano>\d{2,4})\s*\.\s*"
    r".+?,\s*diploma\s+de\s+[“\"']?(?P<curso>.+?)[”\"']?\s+"
    r"junto\s+[aà]o?\s+(?P<origem>.+?),\s*como\s+"
    r"(?P<equiv>doutor(?:ado)?|mestre|mestrado)\s+em\s+.+?"
    r"(?=\.\s*\(processo|;\s*e\s*decis[ãa]o|$)", re.I | re.S)
```

Extrair o bloco primeiro, transformar cada item com `_reval_origem()` e
`_reval_nivel()`, e produzir pares `(posição, resultado)`. Refatorar os regex
modernos e legados para acrescentarem pares em vez de retornarem cedo. Ordenar
pela posição, remover duplicatas exatas de intervalo e devolver apenas os
dicionários.

```python
def extrai_revalidacoes(trecho):
    texto = re.sub(r"\s+", " ", trecho or "")
    achados = []
    for matcher, conversor in _REVALIDACAO_MATCHERS:
        for match in matcher.finditer(texto):
            dado = conversor(match)
            if dado is not None:
                achados.append((match.start(), match.end(), dado))
    for bloco in _REVAL_BLOCO_LISTA_RE.finditer(texto):
        itens = bloco.group("itens")
        for item in _REVAL_ITEM_LISTA_RE.finditer(itens):
            dado = _revalidacao_de_item_lista(item)
            inicio = bloco.start("itens") + item.start()
            fim = bloco.start("itens") + item.end()
            achados.append((inicio, fim, dado))
    achados.sort(key=lambda x: x[0])
    vistos = set()
    saida = []
    for inicio, fim, dado in achados:
        chave = (inicio, fim)
        if chave not in vistos:
            vistos.add(chave)
            saida.append(dado)
    return saida


def extrai_revalidacao(trecho):
    achados = extrai_revalidacoes(trecho)
    return achados[0] if achados else None
```

- [ ] **Step 4: Confirmar GREEN e regressões**

Run: `python tools/teste_revalidacao.py`

Expected: exit `0`; 20 casos singulares, caso coletivo e privacidade verdes.

Run: todos os `tools/teste_*.py` com o loop PowerShell já usado no projeto.

- [ ] **Step 5: Commit**

```powershell
git add -- tools/extrair_boletim.py tools/teste_revalidacao.py
git commit -m "Extrai multiplas revalidacoes por ato"
```

### Task 2: Publicar o contrato singular/plural sem divergência

**Files:**
- Modify: `tools/extrair_boletim.py:940-956`
- Modify: `tools/gerar_dados_portal.py:251-258`
- Modify: `tools/teste_dados_portal.py`

**Interfaces:**
- Consumes: `extrai_revalidacoes()` da Task 1.
- Produces: `revalidacao: dict | None`; `revalidacoes: list[dict]` somente se `len > 1`.

- [ ] **Step 1: Escrever testes vermelhos do contrato**

Fazer `_ato()` aceitar `revalidacoes=None`; testar três entradas no conversor:

```python
uma = [{"via": "Graduação", "decisao": "Deferido", "nivel": "Graduação",
        "curso": "Medicina", "instituicao": "Universidad X", "pais": "Cuba"}]
duas = uma + [{"via": "Pós-graduação", "decisao": "Deferido", "nivel": "Doutorado",
               "curso": "Doctor of Philosophy", "instituicao": "University Y",
               "pais": "Reino Unido"}]

checa("uma decisão mantém somente singular",
      saida_uma["revalidacao"] == uma[0] and "revalidacoes" not in saida_uma)
checa("duas decisões publicam singular e lista completa",
      saida_duas["revalidacao"] == duas[0] and saida_duas["revalidacoes"] == duas)
checa("zero decisões publica null sem plural",
      saida_zero["revalidacao"] is None and "revalidacoes" not in saida_zero)
```

- [ ] **Step 2: Confirmar RED**

Run: `python tools/teste_dados_portal.py`

Expected: exit `1` no caso plural.

- [ ] **Step 3: Implementar uma única fonte em cada camada**

No extrator, calcular a lista uma vez antes de montar o ato:

```python
revalidacoes = extrai_revalidacoes(trecho)
ato["revalidacao"] = revalidacoes[0] if revalidacoes else None
if len(revalidacoes) > 1:
    ato["revalidacoes"] = revalidacoes
```

No gerador:

```python
lista_reval = a.get("revalidacoes")
if not isinstance(lista_reval, list):
    lista_reval = [a["revalidacao"]] if a.get("revalidacao") else []
registro["revalidacao"] = lista_reval[0] if lista_reval else None
if len(lista_reval) > 1:
    registro["revalidacoes"] = lista_reval
```

- [ ] **Step 4: Confirmar GREEN**

Run: `python tools/teste_dados_portal.py` e `python tools/teste_revalidacao.py`.

Expected: ambos exit `0`.

- [ ] **Step 5: Commit**

```powershell
git add -- tools/extrair_boletim.py tools/gerar_dados_portal.py tools/teste_dados_portal.py
git commit -m "Publica lista compativel de revalidacoes"
```

### Task 3: Migrar a chave natural no Percona 5.7

**Files:**
- Modify: `backend/db/ato_revalidacao.sql`
- Create: `backend/db/migrar_ato_revalidacao_multiplas.sql`
- Create: `tools/teste_ato_revalidacao_schema.mjs`

**Interfaces:**
- Produces: coluna `ordem SMALLINT UNSIGNED NOT NULL DEFAULT 1`; UNIQUE `(ato_id, ordem)`.

- [ ] **Step 1: Criar a trava estática vermelha**

O teste Node deve ler os dois SQLs e exigir:

```javascript
assert.match(schema, /`ordem`\s+SMALLINT UNSIGNED NOT NULL DEFAULT 1/);
assert.match(schema, /UNIQUE KEY `uq_ato_revalidacao`\s*\(`ato_id`,\s*`ordem`\)/);
assert.doesNotMatch(schema, /UNIQUE KEY `uq_ato_revalidacao`\s*\(`ato_id`\)/);
assert.match(migracao, /information_schema\.COLUMNS/i);
assert.match(migracao, /information_schema\.STATISTICS/i);
assert.match(migracao, /PREPARE\s+stmt/i);
assert.doesNotMatch(migracao, /ADD COLUMN IF NOT EXISTS|DROP INDEX IF EXISTS/i);
```

- [ ] **Step 2: Confirmar RED**

Run: `node tools/teste_ato_revalidacao_schema.mjs`

Expected: falha porque migração e coluna ainda não existem.

- [ ] **Step 3: Atualizar schema e criar migração idempotente**

O schema canônico inclui `ordem` depois de `ato_id` e a UNIQUE composta.

A migração usa `information_schema` + SQL dinâmico:

```sql
SET @tem_ordem := (SELECT COUNT(*) FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ato_revalidacao' AND COLUMN_NAME='ordem');
SET @sql := IF(@tem_ordem=0,
 'ALTER TABLE `ato_revalidacao` ADD COLUMN `ordem` SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER `ato_id`',
 'SELECT ''ordem já existe'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @uq_cols := (SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX)
 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()
 AND TABLE_NAME='ato_revalidacao' AND INDEX_NAME='uq_ato_revalidacao');
SET @sql := CASE
 WHEN @uq_cols='ato_id,ordem' THEN 'SELECT ''chave já migrada'' AS info'
 WHEN @uq_cols IS NULL THEN 'ALTER TABLE `ato_revalidacao` ADD UNIQUE KEY `uq_ato_revalidacao` (`ato_id`,`ordem`)'
 ELSE 'ALTER TABLE `ato_revalidacao` DROP INDEX `uq_ato_revalidacao`, ADD UNIQUE KEY `uq_ato_revalidacao` (`ato_id`,`ordem`)'
 END;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
```

Finalizar com consultas de verificação de coluna, índice e duplicatas.

- [ ] **Step 4: Confirmar GREEN**

Run: `node tools/teste_ato_revalidacao_schema.mjs`.

Expected: exit `0`.

- [ ] **Step 5: Commit**

```powershell
git add -- backend/db/ato_revalidacao.sql backend/db/migrar_ato_revalidacao_multiplas.sql tools/teste_ato_revalidacao_schema.mjs
git commit -m "Migra revalidacao para chave por ordem"
```

### Task 4: Normalizar safras e sincronizar o importador

**Files:**
- Create: `backend/importar/revalidacao_lista.php`
- Create: `backend/importar/teste_revalidacao_lista.php`
- Modify: `backend/importar/importar_v2.php:300-335,556-576`

**Interfaces:**
- Produces: `revalidacoes_do_json(array $ato): ?array`; `null` significa módulo ausente, lista vazia significa sincronizar zero.

- [ ] **Step 1: Escrever teste PHP vermelho**

Casos obrigatórios, usando contador explícito porque `zend.assertions` pode
desativar `assert()`:

```php
$falhas = 0;
function checa(string $rotulo, bool $ok): void {
    global $falhas;
    if (!$ok) { $falhas++; fwrite(STDERR, "FALHA: $rotulo\n"); }
}
checa('ausente não sincroniza', revalidacoes_do_json([]) === null);
checa('null explícito zera', revalidacoes_do_json(['revalidacao' => null]) === []);
checa('singular vira lista', revalidacoes_do_json(['revalidacao' => $a]) === [$a]);
checa('plural prevalece', revalidacoes_do_json([
    'revalidacao' => $a, 'revalidacoes' => [$a, $b]
]) === [$a, $b]);
checa('plural vazio prevalece', revalidacoes_do_json([
    'revalidacao' => $a, 'revalidacoes' => []
]) === []);
exit($falhas === 0 ? 0 : 1);
```

O teste também lê `importar_v2.php` e exige `require_once` do helper,
`(ato_id,ordem,via,decisao` no INSERT e execução do DELETE somente dentro de
`if ($listaReval !== null)`.

- [ ] **Step 2: Confirmar RED**

Run: `& "$env:LOCALAPPDATA\php83\php.exe" backend/importar/teste_revalidacao_lista.php`

Expected: exit `1`, helper ausente.

- [ ] **Step 3: Implementar helper puro**

```php
function revalidacoes_do_json(array $ato): ?array {
    $temPlural = array_key_exists('revalidacoes', $ato);
    $temSingular = array_key_exists('revalidacao', $ato);
    if (!$temPlural && !$temSingular) return null;
    if ($temPlural) return is_array($ato['revalidacoes']) ? array_values($ato['revalidacoes']) : [];
    $um = $ato['revalidacao'];
    return is_array($um) ? [$um] : [];
}
```

- [ ] **Step 4: Sincronizar no importador**

Adicionar `ordem` ao INSERT. No loop:

```php
$listaReval = revalidacoes_do_json($a);
if ($listaReval !== null) {
    $delReval->execute([':id' => $atoId]);
    foreach ($listaReval as $idx => $rv) {
        if (!is_array($rv)
            || !in_array($rv['via'] ?? '', ['Graduação','Pós-graduação'], true)
            || !in_array($rv['decisao'] ?? '', ['Deferido','Indeferido'], true)) continue;
        $insReval->execute([
            ':id'=>$atoId, ':o'=>$idx + 1, ':v'=>$rv['via'], ':d'=>$rv['decisao'],
            ':n'=>($rv['nivel'] ?? '') ?: null, ':c'=>($rv['curso'] ?? '') ?: null,
            ':i'=>($rv['instituicao'] ?? '') ?: null, ':p'=>($rv['pais'] ?? '') ?: null,
        ]);
    }
}
```

- [ ] **Step 5: Confirmar GREEN e PHP syntax**

Run: teste PHP, `php -l` nos três arquivos e os testes PHP do CI relacionados.

- [ ] **Step 6: Commit**

```powershell
git add -- backend/importar/revalidacao_lista.php backend/importar/teste_revalidacao_lista.php backend/importar/importar_v2.php
git commit -m "Importa multiplas revalidacoes de forma idempotente"
```

### Task 5: Fazer o backfill recuperar o bloco coletivo

**Files:**
- Create: `backend/importar/revalidacao_lista_legada.php`
- Create: `backend/importar/teste_revalidacao_lista_legada.php`
- Modify: `backend/importar/backfill_ato_revalidacao.php:200-285`

**Interfaces:**
- Produces: `extrair_revalidacoes_lista_legada(string $texto): array` com a mesma estrutura pública e sem nomes.

- [ ] **Step 1: Escrever regressão PHP real de `#5792`**

Usar o mesmo trecho literal da Task 1 em minúsculas. Exigir duas linhas,
instituições distintas, `Reino Unido`, `Doutorado`, `Deferido`, e varrer todos
os valores contra os oito fragmentos dos nomes.

- [ ] **Step 2: Confirmar RED**

Run: `& "$env:LOCALAPPDATA\php83\php.exe" backend/importar/teste_revalidacao_lista_legada.php`

Expected: exit `1`, função ausente.

- [ ] **Step 3: Implementar parser puro e integrar**

O helper usa estes PCRE estreitos, canoniza `inglaterra` como `Reino Unido` e
devolve apenas os seis campos públicos:

```php
$blocoRe = '~pela\s+homologa[çc][ãa]o\s+da\s+revalida[çc][ãa]o\s+do\s+'
    . 'diploma,?\s*obtid[oa]\s+por:\s*(?<itens>.+?)'
    . '(?=\bsala\s+das\s+reuni[õo]es\b|$)~isu';
$itemRe = '~decis[ãa]o\s+n[º°.]?\s*\.?(?<numero>\d+)\s*/\s*(?<ano>\d{2,4})'
    . '\s*\.\s*.+?,\s*diploma\s+de\s+[“"\']?(?<curso>.+?)[”"\']?\s+'
    . 'junto\s+[aà]o?\s+(?<origem>.+?),\s*como\s+'
    . '(?<equiv>doutor(?:ado)?|mestre|mestrado)\s+em\s+.+?'
    . '(?=\.\s*\(processo|;\s*e\s*decis[ãa]o|$)~isu';

function extrair_revalidacoes_lista_legada(string $texto): array {
    global $blocoRe, $itemRe;
    if (!preg_match($blocoRe, $texto, $bloco)) return [];
    if (!preg_match_all($itemRe, $bloco['itens'], $itens, PREG_SET_ORDER)) return [];
    $saida = [];
    foreach ($itens as $item) {
        [$instituicao, $pais] = separar_origem_revalidacao($item['origem']);
        $saida[] = [
            'via' => 'Pós-graduação', 'decisao' => 'Deferido',
            'nivel' => str_starts_with(normalizar_revalidacao($item['equiv']), 'doutor')
                ? 'Doutorado' : 'Mestrado',
            'curso' => limpar_revalidacao($item['curso']),
            'instituicao' => $instituicao, 'pais' => $pais,
        ];
    }
    return $saida;
}
```

Definir no mesmo helper `normalizar_revalidacao()`, `limpar_revalidacao()` e
`separar_origem_revalidacao()`: a última separa o país pelo sufixo conhecido
(`inglaterra` → `Reino Unido`) e deixa todo o prefixo como instituição. O teste
deve chamar essas funções diretamente, sem banco.

No backfill, preparar INSERT com `ordem`; para cada ato:

```php
$achados = extrair_revalidacoes_lista_legada($txt);
if (!$achados) {
    // executar o matcher singular existente e, se casar, envolver em [$achou]
}
if (!$diagnostico && $achados) {
    $pdo->prepare('DELETE FROM ato_revalidacao WHERE ato_id=?')->execute([$row['id']]);
    foreach ($achados as $idx => $achou) {
        $insere->execute([... ':o' => $idx + 1 ...]);
    }
}
```

Remover o comentário e a lógica que afirmam upsert por `ato_id`. O diagnóstico
conta pedidos graváveis, não apenas atos com match.

- [ ] **Step 4: Confirmar GREEN**

Run: os dois testes PHP de lista, `php -l` no backfill/helper e
`python tools/teste_revalidacao.py` para conferir paridade do caso real.

- [ ] **Step 5: Commit**

```powershell
git add -- backend/importar/revalidacao_lista_legada.php backend/importar/teste_revalidacao_lista_legada.php backend/importar/backfill_ato_revalidacao.php
git commit -m "Recupera listas historicas de revalidacao no backfill"
```

### Task 6: Documentar para Claude e fechar a etapa 2

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/PLANO-REPROCESSAMENTO-ACERVO.md`

**Interfaces:**
- Consumes: todas as Tasks anteriores verdes.
- Produces: contrato e ordem de deploy permanentes; etapa 2 marcada concluída.

- [ ] **Step 1: Atualizar `CLAUDE.md`**

Na seção de revalidação, substituir “um ato decide um pedido” por:

```markdown
**Um ato pode decidir vários pedidos de revalidação.** O extrator mantém
`revalidacao` como alias do primeiro item e só publica `revalidacoes` quando há
mais de um. A tabela usa UNIQUE `(ato_id, ordem)`. Deploy obrigatório: migração
`backend/db/migrar_ato_revalidacao_multiplas.sql` → importador/auxiliares → JSON
novo. Inverter essa ordem perde silenciosamente os itens após o primeiro.
```

- [ ] **Step 2: Marcar a etapa 2**

Alterar a linha para:

```markdown
| 2 | Corrigir a chave de `ato_revalidacao` para múltiplas decisões | ✅ |
```

- [ ] **Step 3: Rodar verificação integrada fresca**

Run:

```powershell
python tools/teste_revalidacao.py
python tools/teste_dados_portal.py
node tools/teste_ato_revalidacao_schema.mjs
& "$env:LOCALAPPDATA\php83\php.exe" backend/importar/teste_revalidacao_lista.php
& "$env:LOCALAPPDATA\php83\php.exe" backend/importar/teste_revalidacao_lista_legada.php
node tools/test_redesign_integrity.mjs
npm run lint
npm run build
```

Expected: todos exit `0`, `git diff --check` sem saída e árvore contendo apenas
os dois documentos desta Task.

- [ ] **Step 4: Commit e push**

```powershell
git add -- CLAUDE.md docs/PLANO-REPROCESSAMENTO-ACERVO.md
git commit -m "Documenta contrato de multiplas revalidacoes"
git push origin main
```

- [ ] **Step 5: Acompanhar CI**

Run: `gh run list --commit <HEAD>` e `gh run watch <RUN_ID> --exit-status`.

Expected: CI e indexação verdes; se o workflow publicar novo índice, confirmar
que atos singulares mantêm apenas `revalidacao` e o contrato não duplica listas.
