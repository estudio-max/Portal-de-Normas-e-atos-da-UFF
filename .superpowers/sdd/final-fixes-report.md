# Relatório das correções da revisão final — múltiplas revalidações

Data: 2026-08-17

Base revisada: `3d6b463`

Commits de implementação: `976361f` e `c9cd84e`

## Escopo e restrições observadas

- Corrigidos os 4 achados Important e os 4 Minor de `final-review-findings.md`.
- A arquitetura da feature foi preservada; não houve redesign.
- Não foram executados produção, backfill real, reprocessamento, migração de banco ou push.
- O trabalho ficou restrito ao worktree `repo/.worktrees/multiplas-revalidacoes`.

## Mapeamento dos achados

### Important 1 — guarda de atos citados no parser coletivo

Correção:

- `tools/extrair_boletim.py` aplica `_reval_citado(texto, bloco.start())` antes de percorrer os itens do bloco coletivo, exatamente como já fazia para cada matcher singular.
- `backend/importar/revalidacao_lista_legada.php` obtém o offset do bloco com `PREG_OFFSET_CAPTURE` e aplica a mesma semântica: os 10 caracteres anteriores não podem terminar em `que`.
- Os testes Python e PHP reutilizam o bloco real positivo do ato `#5792`, prefixado por `a decisão anterior, que`, e exigem zero resultados; o positivo continua exigindo duas decisões em ordem documental.

Evidência RED:

- `python tools/teste_revalidacao.py` → exit `1`, `FALHA: bloco coletivo de ato citado não deveria produzir decisões`.
- `php backend/importar/teste_revalidacao_lista_legada.php` → exit `1`, `FALHA: bloco coletivo de ato citado nao produz decisoes`.
- Nota: a primeira montagem da fixture Python encontrou a quebra de linha real entre `pela` e `homologação` e gerou `IndexError`; a fixture foi corrigida e o RED semântico acima foi repetido antes de alterar o parser.

Evidência GREEN:

- `python tools/teste_revalidacao.py` → exit `0`, 20 casos e 0 falhas; `#5792` positivo com duas decisões e citado com zero.
- `php backend/importar/teste_revalidacao_lista_legada.php` → exit `0`.

### Important 2 — plural vazio explícito

Correção:

- `tools/gerar_dados_portal.py` registra presença quando existe `revalidacao` **ou** `revalidacoes`.
- `revalidacoes: []` isolado agora publica `revalidacao: null` e omite o plural; ausência das duas chaves continua omitindo ambas.

Evidência RED/GREEN:

- RED: `python tools/teste_dados_portal.py` → exit `1`, somente `plural vazio isolado publica null no alias singular` falhou.
- GREEN: o mesmo comando → exit `0`, `TODOS OK`.

### Important 3 — checklist operacional de deploy

Correção:

- `CLAUDE.md` passa de seis para **sete** auxiliares do importador e inclui `revalidacao_lista.php`.
- O mesmo checklist documenta `revalidacao_lista_legada.php` e `revalidacao_sincronizacao.php` como dependências obrigatórias do backfill, que devem subir antes do script principal.

Verificação:

- Checklist estático do self-review localizou `**os SETE**`, `revalidacao_lista.php`, `revalidacao_lista_legada.php` e `revalidacao_sincronizacao.php`.

### Important 4 — testes novos no CI

Correção:

- Job `frontend`: `node tools/teste_ato_revalidacao_schema.mjs`.
- Job `extrator`: `python tools/teste_dados_portal.py`.
- Job PHP existente (`ods`): os três testes `teste_revalidacao_lista.php`, `teste_revalidacao_lista_legada.php` e `teste_revalidacao_sincronizacao.php`.
- Todos os comandos PHP usam `php` fornecido por `shivammathur/setup-php`, sem caminho Windows.

Evidência RED/GREEN:

- RED estrutural: checagem dos cinco comandos → exit `1`, todos listados como ausentes.
- GREEN estrutural: exit `0`, `TODOS OS COMANDOS PRESENTES; PHP DO RUNNER; SEM CAMINHO WINDOWS`.
- YAML: `Get-Content ... | npm exec --yes --package=yaml -- yaml valid` → exit `0`.

### Minor 1 — precedência plural com valores conflitantes

Correção/cobertura:

- Python usa um singular indeferido de Odontologia e um plural cuja primeira decisão é deferida de Medicina; a saída exige que o plural governe a lista e `revalidacao` seja alias do primeiro item plural.
- PHP usa `$singularConflitante` diferente de `[$a, $b]` e exige que `revalidacoes_do_json()` devolva o plural.

Evidência RED/GREEN:

- O helper PHP já tinha a precedência correta. Mutação controlada para singular primeiro → exit `1`, falhas `plural conflitante prevalece` e `plural vazio prevalece`; restauração → exit `0`.
- O teste Python conflitante passou junto do GREEN do Important 2.

### Minor 2 — savepoint em transação externa

Correção/cobertura:

- O teste injeta um objeto `RuntimeException` conhecido e exige propagação por identidade.
- No erro, exige um `SAVEPOINT`, um `ROLLBACK TO SAVEPOINT`, um `RELEASE SAVEPOINT`, ausência de rollback/commit global e transação externa ainda aberta.
- No sucesso, exige sincronização completa, `RELEASE SAVEPOINT`, ausência de rollback/commit global e transação externa ainda aberta.

Evidência RED/GREEN:

- O helper já cumpria o contrato. Mutação controlada removendo os releases e embrulhando a exceção → exit `1`, quatro falhas relevantes.
- Implementação restaurada: `php backend/importar/teste_revalidacao_sincronizacao.php` → exit `0`.

### Minor 3 — plano de reprocessamento coerente

Correção:

- `docs/PLANO-REPROCESSAMENTO-ACERVO.md` agora chama as quatro redações de incorporadas e descreve a correção de múltiplos pedidos como concluída.
- Foi removida a afirmação obsoleta de que `#5792` ainda gravava somente o primeiro pedido.

### Minor 4 — diagnóstico distingue atos de pedidos/linhas

Correção:

- A consulta com `LEFT JOIN` usa `COUNT(DISTINCT CASE WHEN r.ato_id IS NOT NULL THEN a.id END) AS atos_capturados` e `COUNT(DISTINCT a.id) AS total_atos`.
- Os logs distinguem `atos candidatos lidos`, `pedidos que casariam`, `pedidos gravados`, `atos capturados`, `atos em aberto` e a contagem final de `linha(s)`.
- `$gravados++` e os totais por via continuam intencionalmente contando pedidos/ocorrências.

Evidência RED/GREEN:

- RED: `php backend/importar/teste_revalidacao_lista_legada.php` → exit `1`, três falhas sobre contagem distinta e rótulos.
- GREEN: o mesmo comando → exit `0`.

## Verificação integrada fresca

| Verificação | Resultado |
|---|---|
| Todos os `tools/teste_*.py` | 9 arquivos, 0 falhas |
| `tools/teste_revalidacao.py` | 20 casos, 0 falhas |
| Todos os `backend/importar/teste_*.php` | 8 arquivos, 0 falhas |
| `php -l` nos PHP alterados | 5 arquivos, 0 erros de sintaxe |
| `node tools/test_redesign_integrity.mjs` | exit 0 |
| `npx tsx tools/teste_rsc_requisitos.ts` | 45 ok, 0 falhas |
| `node tools/teste_schema_inteligencia.mjs` | 1.282 verificações, 0 falhas |
| `node tools/teste_ato_revalidacao_schema.mjs` | exit 0 |
| YAML e estrutura do CI | válidos; cinco comandos presentes; nenhum caminho Windows |
| `npm run lint` | exit 0 (`tsc --noEmit`) |
| `npm run build` | exit 0; 1.719 módulos transformados |
| `git diff --check` / `git diff --cached --check` | exit 0, sem erros |

## Self-review

- Diff conferido integralmente contra `3d6b463`; os arquivos alterados correspondem aos oito achados.
- A guarda coletiva é aplicada no início do bloco e mantém os dois casos positivos reais de `#5792`.
- O contrato de ausência, singular, plural, plural vazio e conflito está coberto nos dois consumidores relevantes.
- A consulta do diagnóstico não pode mais inflar atos por cardinalidade um-para-muitos, enquanto pedidos continuam contados por linha onde intencional.
- O workflow segue a estrutura existente e o binário portátil do runner.
- `git status` após o build não mostrou artefatos `dist/` nem arquivos inesperados.

## Preocupações e limitações

- `tools/teste_data_boletim.py` terminou verde, mas pulou 18 casos dependentes de PDFs ausentes neste worktree; os 6 casos autossuficientes passaram. Nenhum corpus foi baixado ou reprocessado.
- O CI remoto não foi executado porque não houve push, conforme a restrição explícita. A equivalência local dos comandos adicionados foi executada integralmente.
- Não houve teste integrado contra banco/Percona nem execução do backfill; isso foi deliberadamente excluído do escopo operacional.
