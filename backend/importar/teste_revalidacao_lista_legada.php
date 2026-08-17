<?php
// Regressao do bloco coletivo historico de revalidacoes (ato real #5792).

$falhas = 0;

function checa_legada(string $rotulo, bool $ok): void {
    global $falhas;
    if (!$ok) {
        $falhas++;
        fwrite(STDERR, "FALHA: $rotulo\n");
    }
}

$helper = __DIR__ . '/revalidacao_lista_legada.php';
if (is_file($helper)) {
    require_once $helper;
}

if (!function_exists('extrair_revalidacoes_lista_legada')) {
    checa_legada('funcao extrair_revalidacoes_lista_legada existe', false);
    exit(1);
}

checa_legada(
    'normaliza caixa, acentos e espacos',
    normalizar_revalidacao("  DOUTORÁDO\nEM  LETRAS ") === 'doutorado em letras'
);
checa_legada(
    'limpa aspas e pontuacao externas',
    limpar_revalidacao(' “doctor of philosophy”. ') === 'doctor of philosophy'
);
checa_legada(
    'separa pais conhecido sem cortar instituicao',
    separar_origem_revalidacao('université de montréal, canadá')
        === ['université de montréal', 'Canadá']
);

$texto = <<<'TEXTO'
o conselho de ensino e pesquisa da universidade federal
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
16 de janeiro de 2008.
TEXTO;

$esperado = [
    [
        'via' => 'Pós-graduação',
        'decisao' => 'Deferido',
        'nivel' => 'Doutorado',
        'curso' => 'doctor of philosophy',
        'instituicao' => 'the victoria university of manchester, institute of science and technology, departament of eletrical engineering and electronics',
        'pais' => 'Reino Unido',
    ],
    [
        'via' => 'Pós-graduação',
        'decisao' => 'Deferido',
        'nivel' => 'Doutorado',
        'curso' => 'doctor of philosophy',
        'instituicao' => 'university of london, imperial college of science and technology',
        'pais' => 'Reino Unido',
    ],
];

$obtido = extrair_revalidacoes_lista_legada($texto);
checa_legada('ato #5792 produz exatamente duas decisoes', count($obtido) === 2);
checa_legada('ato #5792 preserva conteudo e ordem documental', $obtido === $esperado);
checa_legada(
    'instituicoes sao distintas',
    isset($obtido[0]['instituicao'], $obtido[1]['instituicao'])
        && $obtido[0]['instituicao'] !== $obtido[1]['instituicao']
);

$campos = ['via', 'decisao', 'nivel', 'curso', 'instituicao', 'pais'];
foreach ($obtido as $idx => $item) {
    checa_legada("item " . ($idx + 1) . ' tem somente os seis campos publicos', array_keys($item) === $campos);
    checa_legada("item " . ($idx + 1) . ' e pos-graduacao', ($item['via'] ?? null) === 'Pós-graduação');
    checa_legada("item " . ($idx + 1) . ' foi deferido', ($item['decisao'] ?? null) === 'Deferido');
    checa_legada("item " . ($idx + 1) . ' e doutorado', ($item['nivel'] ?? null) === 'Doutorado');
    checa_legada("item " . ($idx + 1) . ' canoniza Inglaterra', ($item['pais'] ?? null) === 'Reino Unido');
}

$valores = [];
array_walk_recursive($obtido, static function ($valor) use (&$valores): void {
    $valores[] = (string)$valor;
});
$saida = mb_strtolower(implode(' | ', $valores), 'UTF-8');
foreach (['julius', 'césar', 'barreto', 'leite', 'orlando', 'gomes', 'loques', 'filho'] as $nome) {
    checa_legada("nao vaza o fragmento de nome '$nome'", !str_contains($saida, $nome));
}

$backfill = file_get_contents(__DIR__ . '/backfill_ato_revalidacao.php');
checa_legada('le backfill', $backfill !== false);
if ($backfill !== false) {
    checa_legada(
        'backfill inclui helper coletivo',
        str_contains($backfill, "require_once __DIR__ . '/revalidacao_lista_legada.php';")
    );
    checa_legada(
        'insert do backfill inclui ordem',
        preg_match('/INSERT INTO ato_revalidacao\s*\(ato_id,ordem,via,decisao,nivel,curso,instituicao,pais\)/s', $backfill) === 1
    );
    checa_legada(
        'backfill tenta coletivo antes do fallback singular',
        preg_match('/\$achados\s*=\s*extrair_revalidacoes_lista_legada\(\$txt\);\s*'
                 . 'if\s*\(!\$achados\)\s*\{/s', $backfill) === 1
    );
    checa_legada(
        'backfill nao escreve no diagnostico',
        preg_match('/if\s*\(!\$diagnostico\s*&&\s*\$achados\)\s*\{\s*'
                 . '\$pdo->prepare\(\'DELETE FROM ato_revalidacao WHERE ato_id=\?\'\)'
                 . '->execute\(\[\$row\[\'id\'\]\]\);/s', $backfill) === 1
    );
    checa_legada(
        'backfill insere todos os achados com ordem baseada em um',
        preg_match('/foreach\s*\(\$achados\s+as\s+\$idx\s*=>\s*\$achou\).*?'
                 . '\':o\'\s*=>\s*\$idx\s*\+\s*1/s', $backfill) === 1
    );
}

exit($falhas === 0 ? 0 : 1);
