<?php
// Regressão da normalização do módulo de revalidação no JSON de entrada.

$falhas = 0;

function checa(string $rotulo, bool $ok): void {
    global $falhas;
    if (!$ok) {
        $falhas++;
        fwrite(STDERR, "FALHA: $rotulo\n");
    }
}

$helper = __DIR__ . '/revalidacao_lista.php';
if (!is_file($helper)) {
    checa('helper existe', false);
} else {
    require_once $helper;
}

if (function_exists('revalidacoes_do_json')) {
    $a = [
        'via' => 'Graduação',
        'decisao' => 'Deferido',
        'curso' => 'Engenharia',
    ];
    $b = [
        'via' => 'Pós-graduação',
        'decisao' => 'Indeferido',
        'curso' => 'História',
    ];
    $singularConflitante = [
        'via' => 'Graduação',
        'decisao' => 'Indeferido',
        'curso' => 'Odontologia',
    ];

    checa('ausente não sincroniza', revalidacoes_do_json([]) === null);
    checa('null explícito zera', revalidacoes_do_json(['revalidacao' => null]) === []);
    checa('singular vira lista', revalidacoes_do_json(['revalidacao' => $a]) === [$a]);
    checa('plural conflitante prevalece', revalidacoes_do_json([
        'revalidacao' => $singularConflitante,
        'revalidacoes' => [$a, $b],
    ]) === [$a, $b]);
    checa('plural vazio prevalece', revalidacoes_do_json([
        'revalidacao' => $a,
        'revalidacoes' => [],
    ]) === []);
} else {
    checa('função do helper existe', false);
}

$importador = __DIR__ . '/importar_v2.php';
$fonte = file_get_contents($importador);
checa('lê importar_v2.php', $fonte !== false);
if ($fonte !== false) {
    checa('importador inclui helper',
        str_contains($fonte, "require_once __DIR__ . '/revalidacao_lista.php';"));
    checa('insert inclui ordem',
        preg_match('/\\(ato_id\\s*,\\s*ordem\\s*,\\s*via\\s*,\\s*decisao/s', $fonte) === 1);
    checa('delete só ocorre quando módulo está presente',
        preg_match('/\\$listaReval\\s*=\\s*revalidacoes_do_json\\(\\$a\\);\\s*'
                 . 'if\\s*\\(\\$listaReval\\s*!==\\s*null\\)\\s*\\{\\s*'
                 . '\\$delReval->execute\\(\[\':id\'\\s*=>\\s*\\$atoId\]\);/s', $fonte) === 1);
}

exit($falhas === 0 ? 0 : 1);
