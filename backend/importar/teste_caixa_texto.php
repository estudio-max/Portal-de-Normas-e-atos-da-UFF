<?php
/**
 * Regressão da CAIXA do corpo do ato, do lado do PHP.
 *
 *     php backend/importar/teste_caixa_texto.php
 *
 * POR QUE EXISTE: desde 18/08/2026 o portal-data.json publica o corpo numa
 * forma só — `textoOriginal`, com a caixa preservada —, e o `texto_busca` (o
 * que alimenta o índice FULLTEXT e toda busca do modo banco) é DERIVADO no
 * importador por `mb_strtolower()`. Publicar as duas formas dobrava o arquivo.
 *
 * A derivação só é segura enquanto Python, PHP e JavaScript rebaixarem a caixa
 * EXATAMENTE igual: o Python é quem gerou o índice histórico, o PHP é quem
 * grava o de agora, e o JavaScript é quem busca no modo de contingência. Se um
 * deles divergir numa letra, a mesma busca passa a dar resultado diferente
 * conforme o modo — sem erro, sem log, sem sintoma até alguém comparar.
 *
 * A amostra é compartilhada (`tools/dados_referencia/caixa-texto.json`) e os
 * três a conferem: aqui, em `tools/teste_dados_portal.py` e em
 * `tools/test_redesign_integrity.mjs`.
 *
 * ⚠️ Este arquivo é de TESTE e roda no CI. Não vai para o servidor, e o
 * importador NÃO o inclui — importador com `require_once` a mais é HTTP 500 de
 * corpo vazio se o arquivo não subir junto (ver CLAUDE.md).
 */

$fixture = __DIR__ . '/../../tools/dados_referencia/caixa-texto.json';
$dados = json_decode((string)file_get_contents($fixture), true);
if (!is_array($dados) || empty($dados['pares'])) {
    fwrite(STDERR, "ERRO: amostra nao encontrada ou vazia: $fixture\n");
    exit(1);
}

$falhas = 0;
echo "-- caixa: PHP (mb_strtolower) contra a amostra compartilhada --\n";
foreach ($dados['pares'] as $par) {
    [$original, $esperado] = $par;
    // O 'UTF-8' explícito é parte do que se testa: sem ele o PHP cai no
    // mbstring.internal_encoding do servidor, que é configuração de host e não
    // do dado.
    $obtido = mb_strtolower($original, 'UTF-8');
    $ok = $obtido === $esperado;
    $falhas += !$ok;
    printf("  %s %s\n", $ok ? 'OK  ' : 'FALHA', json_encode($original));
    if (!$ok) {
        printf("       obtido   %s\n       esperado %s\n",
            json_encode($obtido), json_encode($esperado));
    }
}

// A derivação do importador, reproduzida: JSON novo traz só `textoOriginal`, e
// o `texto_busca` sai daqui. As três formas de entrada precisam funcionar.
echo "\n-- derivacao do importador (as duas safras de JSON) --\n";
$deriva = function (array $a): array {
    $textoBusca = (string)($a['textoBusca'] ?? '');
    $textoOrig  = (string)($a['textoOriginal'] ?? '') ?: $textoBusca;
    if ($textoBusca === '' && $textoOrig !== '') {
        $textoBusca = mb_strtolower($textoOrig, 'UTF-8');
    }
    return [$textoOrig, $textoBusca];
};
$corpo = 'RESOLVE: Homologar a revalidacao do titulo obtido na Universidad de '
       . 'Los Andes, Bogota - COLOMBIA. CPF nº ***.456.789-**';
$casos = [
    ['JSON novo (so textoOriginal) -> deriva a minuscula',
     ['textoOriginal' => $corpo], $corpo, mb_strtolower($corpo, 'UTF-8')],
    ['JSON antigo (so textoBusca) -> importa como antes, sem inventar caixa',
     ['textoBusca' => mb_strtolower($corpo, 'UTF-8')],
     mb_strtolower($corpo, 'UTF-8'), mb_strtolower($corpo, 'UTF-8')],
    ['JSON de transicao (os dois campos) -> respeita o que veio',
     ['textoOriginal' => $corpo, 'textoBusca' => mb_strtolower($corpo, 'UTF-8')],
     $corpo, mb_strtolower($corpo, 'UTF-8')],
    ['ato sem corpo nenhum -> as duas colunas vazias, sem erro',
     [], '', ''],
];
foreach ($casos as [$nome, $entrada, $espOrig, $espBusca]) {
    [$orig, $busca] = $deriva($entrada);
    $ok = $orig === $espOrig && $busca === $espBusca;
    $falhas += !$ok;
    printf("  %s %s\n", $ok ? 'OK  ' : 'FALHA', $nome);
}

// A guarda que impede a derivação de sair do teste e o importador ficar para
// trás: se alguém trocar a linha lá, este teste continua passando sozinho e
// não serve de nada. Confere que o importador tem a mesma chamada.
echo "\n-- o importador usa a mesma derivacao --\n";
$importador = (string)file_get_contents(__DIR__ . '/importar_v2.php');
$temDerivacao = strpos($importador, "mb_strtolower(\$textoOrig, 'UTF-8')") !== false;
$falhas += !$temDerivacao;
printf("  %s importar_v2.php deriva texto_busca com mb_strtolower(..., 'UTF-8')\n",
    $temDerivacao ? 'OK  ' : 'FALHA');

echo "\n", $falhas ? "$falhas FALHA(S)\n" : "TODOS OK\n";
exit($falhas ? 1 : 0);
