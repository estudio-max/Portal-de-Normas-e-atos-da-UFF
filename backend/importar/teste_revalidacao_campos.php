<?php
/**
 * Regressão da limpeza dos campos de revalidação.
 *
 *     php backend/importar/teste_revalidacao_campos.php
 *
 * Cada caso saiu da aba em produção, em 17/08/2026, quando o mantenedor
 * apontou "Na Argentina" e "Em Medicina" no painel. Não são exemplos
 * inventados: são os rótulos que estavam na tela, com a contagem que tinham.
 */
require_once __DIR__ . '/revalidacao_campos.php';

$PAIS_CANON = [
    'eua' => 'Estados Unidos', 'estados unidos' => 'Estados Unidos',
    'estados unidos da america' => 'Estados Unidos',
    'bolivia' => 'Bolívia', 'argentina' => 'Argentina', 'mexico' => 'México',
    'cuba' => 'Cuba', 'colombia' => 'Colômbia', 'holanda' => 'Holanda',
    'paraguai' => 'Paraguai', 'venezuela' => 'Venezuela',
];

$falhas = 0;
$checa = function (string $nome, $obtido, $esperado) use (&$falhas) {
    $ok = $obtido === $esperado;
    $falhas += !$ok;
    printf("  %s %-56s %s\n", $ok ? 'OK  ' : 'FALHA', $nome,
        $ok ? '' : "obtido " . var_export($obtido, true) . ", esperado " . var_export($esperado, true));
};

echo "-- pais: preposicao colada (a queixa que abriu o caso) --\n";
// Volume medido em producao: Na Bolivia 18, Na Argentina 8, Na Colombia 6,
// No Mexico 6, Em Cuba 5, Na Venezuela 2. Todos partindo a fatia certa.
foreach ([['na Bolívia', 'Bolívia'], ['na Argentina', 'Argentina'],
          ['no México', 'México'], ['em Cuba', 'Cuba'],
          ['na Colômbia', 'Colômbia'], ['na Venezuela', 'Venezuela']] as [$in, $out]) {
    $checa("\"$in\"", revalidacao_pais_canon($in, $PAIS_CANON), $out);
}

echo "\n-- pais: variante que ja existia na tabela --\n";
$checa('"Estados Unidos da América" junta com "Estados Unidos"',
    revalidacao_pais_canon('Estados Unidos da América', $PAIS_CANON), 'Estados Unidos');
$checa('"nos Estados Unidos da América" tambem',
    revalidacao_pais_canon('nos Estados Unidos da América', $PAIS_CANON), 'Estados Unidos');

echo "\n-- pais: sobra de clausula NAO e pais --\n";
// "…nos termos estabelecidos na Resolucao 97/1996, deste Conselho" fazia o pais
// virar "Deste Conselho", com 17 pedidos — a 3a maior origem do painel.
$checa('"deste Conselho" vira vazio', revalidacao_pais_canon('deste Conselho', $PAIS_CANON), '');
$checa('"na Resolução 97/1996" vira vazio',
    revalidacao_pais_canon('na Resolução 97/1996', $PAIS_CANON), '');
$checa('"como Doutorado em Comunicação" vira vazio',
    revalidacao_pais_canon('como Doutorado em Comunicação', $PAIS_CANON), '');
$checa('pais desconhecido mas plausivel SOBREVIVE (curadoria depois)',
    revalidacao_pais_canon('Guiana Francesa', $PAIS_CANON), 'Guiana Francesa');

echo "\n-- curso: rotulo de nivel e preposicao --\n";
// "Em Medicina" tinha 275 pedidos contra 306 de "Medicina": a mesma coisa,
// contada duas vezes.
$checa('"em Medicina"', revalidacao_limpa_campo('em Medicina'), 'Medicina');
$checa('"Graduação em Medicina"', revalidacao_limpa_campo('Graduação em Medicina'), 'Medicina');
$checa('"nível de Graduação em Medicina"',
    revalidacao_limpa_campo('nível de Graduação em Medicina'), 'Medicina');
$checa('"em Engenharia Civil"', revalidacao_limpa_campo('em Engenharia Civil'), 'Engenharia Civil');
$checa('"Odontologia - Bacharelado" fica intacto',
    revalidacao_limpa_campo('Odontologia - Bacharelado'), 'Odontologia - Bacharelado');

echo "\n-- aspas: so as das BORDAS --\n";
$checa('"“Doctor of Philosophy”"',
    revalidacao_limpa_campo('“Doctor of Philosophy”'), 'Doctor of Philosophy');
$checa('"“Doctor of Philosophy”," (aspas + virgula)',
    revalidacao_limpa_campo('“Doctor of Philosophy”,'), 'Doctor of Philosophy');
// Aspas NO MEIO sao parte do nome oficial. Limpar tudo estragaria o registro
// certo para arrumar o errado.
$checa('aspas internas ficam (nome oficial da instituição)',
    revalidacao_limpa_campo('Universidad Tecnológica de la Habana "José Antonio Echeverría"'),
    'Universidad Tecnológica de la Habana "José Antonio Echeverría"');

echo "\n-- o que NAO se faz aqui: fundir grafias --\n";
// Resolucao de entidade e outra coisa, e nao pode ser automatica: no corte de
// 90% de similaridade, "universidad de aquino" (Bolivia, 82 pedidos) casa com
// "universidad del quindio" (Colombia, 1). Sao instituicoes diferentes.
$checa('"Universidade Mayor de San Simon" NAO vira "Universidad …"',
    revalidacao_limpa_campo('Universidade Mayor de San Simon'), 'Universidade Mayor de San Simon');

echo "\n", $falhas ? "$falhas FALHA(S)\n" : "TODOS OK\n";
exit($falhas ? 1 : 0);
