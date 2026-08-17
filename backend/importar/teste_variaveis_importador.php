<?php
/**
 * Reprova VARIÁVEL USADA E NUNCA ATRIBUÍDA nos scripts de `importar/`.
 *
 *     php backend/importar/teste_variaveis_importador.php
 *
 * POR QUE EXISTE: em 17/08/2026 o bloco que grava o corpo do ato trocou
 * `$texto` por `$textoBusca`/`$textoOrig`, e os TRÊS usos de `$texto` mais
 * adiante no mesmo laço ficaram pendurados — a classificação ODS, o PAD/SINVE
 * e o radar de prazos. O `php -l` não vê: variável indefinida é AVISO, não
 * erro de sintaxe. O CI ficou verde, o defeito viajou até produção e apareceu
 * na primeira importação depois do deploy:
 *
 *     ods_do_ato(): Argument #3 ($corpo) must be of type string, null given
 *
 * Com a transação revertida, o portal parou de receber ato novo e o único
 * sinal foi uma linha no log do cron, que ninguém lê. Este arquivo fecha
 * justamente a classe de defeito que o projeto mais paga: a que não faz
 * barulho.
 *
 * O QUE ELE NÃO É: um analisador estático de verdade. Ele lê os tokens e
 * pergunta uma coisa só — "esta variável recebe valor em ALGUM lugar deste
 * arquivo?". Não segue fluxo, então não pega uso antes da atribuição. Pega
 * renomeação que deixou referência para trás, que é o defeito medido.
 */

// Variáveis que nascem prontas ou vêm de fora do arquivo.
const IGNORAR = [
    'this', 'GLOBALS', '_GET', '_POST', '_SERVER', '_ENV', '_COOKIE',
    '_FILES', '_SESSION', '_REQUEST', 'argv', 'argc', 'http_response_header',
];

/**
 * Funções que ESCREVEM num argumento por referência. Sem esta lista, todo
 * `preg_match($re, $s, $m)` viraria falso positivo em `$m`.
 */
const POR_REFERENCIA = [
    'preg_match' => [2], 'preg_match_all' => [2], 'str_replace' => [3],
    'preg_replace' => [4], 'sscanf' => [2, 3, 4, 5], 'similar_text' => [2],
    'array_multisort' => [0, 1, 2, 3], 'settype' => [0], 'parse_str' => [1],
];

function analisa(string $arquivo): array {
    $tokens = token_get_all((string)file_get_contents($arquivo));
    // Descarta espaço e comentário: só atrapalham a leitura da vizinhança.
    $t = array_values(array_filter($tokens, function ($tk) {
        return !is_array($tk) || !in_array($tk[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true);
    }));

    $atribuidas = [];
    $usadas = [];
    $n = count($t);
    for ($i = 0; $i < $n; $i++) {
        if (!is_array($t[$i]) || $t[$i][0] !== T_VARIABLE) continue;
        $nome = ltrim($t[$i][1], '$');
        $linha = $t[$i][2];
        if (in_array($nome, IGNORAR, true)) continue;

        $usadas[$nome] = $usadas[$nome] ?? $linha;

        // 1) $x = ... | $x .= ... | $x['k'] = ... | $x++ | $x--
        $j = $i + 1;
        $prof = 0;
        while ($j < $n) {                       // pula índices: $x['a']['b'] =
            if ($t[$j] === '[') { $prof++; $j++; continue; }
            if ($t[$j] === ']') { $prof--; $j++; continue; }
            if ($prof > 0) { $j++; continue; }
            break;
        }
        $prox = $t[$j] ?? null;
        $eAtribuicao = $prox === '='
            || (is_array($prox) && in_array($prox[0], [
                T_PLUS_EQUAL, T_MINUS_EQUAL, T_MUL_EQUAL, T_DIV_EQUAL,
                T_CONCAT_EQUAL, T_MOD_EQUAL, T_AND_EQUAL, T_OR_EQUAL,
                T_XOR_EQUAL, T_SL_EQUAL, T_SR_EQUAL, T_POW_EQUAL,
                T_COALESCE_EQUAL, T_INC, T_DEC,
            ], true));
        // `==`, `===` e `=>` não são atribuição; token_get_all já os separa,
        // então basta o '=' cru acima.

        // 2) foreach (... as $x) / as $k => $x   |  3) parâmetro de função
        $ant = $t[$i - 1] ?? null;
        $ant2 = $t[$i - 2] ?? null;
        // Vem depois de um TIPO (`string $x`, `catch (PDOException $e)`,
        // `?array $x`): em PHP, identificador seguido de variável só acontece
        // em declaração — parâmetro tipado ou captura de exceção. Sem esta
        // linha, todo parâmetro com tipo virava falso positivo, e o teste que
        // grita à toa é o teste que se aprende a ignorar.
        $temTipoAntes = is_array($ant)
            && in_array($ant[0], [T_STRING, T_NAME_QUALIFIED, T_NAME_FULLY_QUALIFIED,
                                  T_ARRAY, T_CALLABLE], true);
        // ⚠️ NÃO vale marcar como declaração tudo que vem depois de `(` ou de
        // `,`: isso abrange ARGUMENTO DE CHAMADA, e foi o furo que deixou a
        // primeira versão deste teste passar em cima do defeito que ele
        // existe para pegar — `ods_do_ato($tipo, $ementa, $texto)` fazia
        // `$texto` parecer declarada. Parâmetro de verdade é detectado no
        // passo 3, pela lista da própria `function`.
        $eDeclaracao = (is_array($ant) && in_array($ant[0], [T_AS, T_DOUBLE_ARROW, T_GLOBAL, T_STATIC], true))
            || $ant === '&'
            || $temTipoAntes
            || (is_array($ant) && $ant[0] === T_LIST);

        if ($eAtribuicao || $eDeclaracao) $atribuidas[$nome] = true;
    }

    // 3) parâmetros de função/arrow/closure — inclusive o `use (...)` da
    //    closure, que importa variável de fora. Aqui, e só aqui, variável
    //    entre parênteses é declaração.
    for ($i = 0; $i < $n; $i++) {
        $ehFuncao = is_array($t[$i]) && in_array($t[$i][0], [T_FUNCTION, T_FN], true);
        $ehUse = is_array($t[$i]) && $t[$i][0] === T_USE && ($t[$i + 1] ?? null) === '(';
        if (!$ehFuncao && !$ehUse) continue;
        $abre = -1;
        for ($j = $i + 1; $j < $n && $j <= $i + 4; $j++) {   // pula nome e `&`
            if ($t[$j] === '(') { $abre = $j; break; }
        }
        if ($abre < 0) continue;
        $prof = 0;
        for ($j = $abre; $j < $n; $j++) {
            if ($t[$j] === '(') $prof++;
            elseif ($t[$j] === ')') { $prof--; if ($prof === 0) break; }
            elseif (is_array($t[$j]) && $t[$j][0] === T_VARIABLE) {
                $atribuidas[ltrim($t[$j][1], '$')] = true;
            }
        }
    }

    // 4) desestruturação com colchete curto: `[$a, $b] = f()` e
    //    `foreach (x as [$a, $b])`. É a forma que o projeto usa para devolver
    //    par de valores, então sem isto o teste acusaria código correto.
    for ($i = 0; $i < $n; $i++) {
        if ($t[$i] !== '[') continue;
        $ant = $t[$i - 1] ?? null;
        // `$x[...]` e `f()[...]` são ACESSO a índice, não destino de
        // atribuição — a variável de dentro ali é leitura.
        if ((is_array($ant) && $ant[0] === T_VARIABLE) || $ant === ']' || $ant === ')') continue;
        $prof = 0; $fim = -1;
        for ($j = $i; $j < $n; $j++) {
            if ($t[$j] === '[') $prof++;
            elseif ($t[$j] === ']') { $prof--; if ($prof === 0) { $fim = $j; break; } }
        }
        if ($fim < 0) continue;
        $depoisAs = is_array($ant) && $ant[0] === T_AS;
        $seguidoDeIgual = ($t[$fim + 1] ?? null) === '=';
        if (!$depoisAs && !$seguidoDeIgual) continue;
        for ($j = $i + 1; $j < $fim; $j++) {
            if (is_array($t[$j]) && $t[$j][0] === T_VARIABLE) {
                $atribuidas[ltrim($t[$j][1], '$')] = true;
            }
        }
    }

    // 5) argumentos escritos por referência por funções conhecidas
    for ($i = 0; $i < $n; $i++) {
        if (!is_array($t[$i]) || $t[$i][0] !== T_STRING) continue;
        $fn = strtolower($t[$i][1]);
        if (!isset(POR_REFERENCIA[$fn]) || ($t[$i + 1] ?? null) !== '(') continue;
        $arg = 0; $prof = 0;
        for ($j = $i + 2; $j < $n; $j++) {
            if (in_array($t[$j], ['(', '['], true)) { $prof++; continue; }
            if (in_array($t[$j], [')', ']'], true)) { if ($prof === 0) break; $prof--; continue; }
            if ($t[$j] === ',' && $prof === 0) { $arg++; continue; }
            if ($prof === 0 && is_array($t[$j]) && $t[$j][0] === T_VARIABLE
                && in_array($arg, POR_REFERENCIA[$fn], true)) {
                $atribuidas[ltrim($t[$j][1], '$')] = true;
            }
        }
    }

    $orfas = [];
    foreach ($usadas as $nome => $linha) {
        if (!isset($atribuidas[$nome])) $orfas[$nome] = $linha;
    }
    return $orfas;
}

$alvos = glob(__DIR__ . '/*.php') ?: [];
sort($alvos);
$falhas = 0;
echo "-- variavel usada e nunca atribuida em importar/ --\n";
foreach ($alvos as $arquivo) {
    $base = basename($arquivo);
    if (strpos($base, 'teste_') === 0) continue;   // os testes têm escopo próprio
    $orfas = analisa($arquivo);
    if (!$orfas) { printf("  OK   %s\n", $base); continue; }
    $falhas += count($orfas);
    foreach ($orfas as $nome => $linha) {
        printf("  FALHA %s: \$%s usada na linha %d e nunca atribuida\n", $base, $nome, $linha);
    }
}

echo "\n", $falhas ? "$falhas VARIAVEL(EIS) ORFA(S)\n" : "TODOS OK\n";
exit($falhas ? 1 : 0);
