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

// A tabela REAL, a mesma que o backfill usa. Uma cópia reduzida aqui fazia o
// teste passar contra uma realidade inventada: 'França' e 'Peru' não estavam
// nela, então a limpeza de instituição "passou" enquanto errava em produção.
$PAIS_CANON = revalidacao_paises_canon();

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

// A amostra COMPARTILHADA com o lado Python. Há DOIS caminhos de escrita em
// `ato_revalidacao` — o backfill (PHP, lê o texto do banco) e o import
// (Python, publica o JSON) — e foi a assimetria entre eles que deixou
// `"…Fakultät", Tübingen, Na Alemanha` chegar à tela DEPOIS de a limpeza do
// PHP já estar no ar. Os dois conferem esta mesma lista.
echo "\n-- pais entre parenteses colado ao nome (achado real, via='Pós-graduação' com pais=NULL) --\n";
// 18/08/2026: SELECT curso, instituicao, pais FROM ato_revalidacao WHERE
// via='Pós-graduação' mostrou pais=NULL para instituicao com o pais colado
// entre parenteses, em vez de separado por virgula. O quarto caso -- cidade
// e pais juntos no mesmo parenteses -- partia o parenteses ao meio quando o
// split por virgula ainda nao sabia que estava dentro de um parenteses.
$checa('"Universidad de la Empresa (Uruguai)" -- so pais, sem cidade',
    revalidacao_extrai_pais_parenteses('Universidad de la Empresa (Uruguai)', $PAIS_CANON),
    ['Universidad de la Empresa', 'Uruguai']);
$checa('"Universidad Complutense de Madrid (Espanha)"',
    revalidacao_extrai_pais_parenteses('Universidad Complutense de Madrid (Espanha)', $PAIS_CANON),
    ['Universidad Complutense de Madrid', 'Espanha']);
$checa('"Universidad de Buenos Aires (Argentina)"',
    revalidacao_extrai_pais_parenteses('Universidad de Buenos Aires (Argentina)', $PAIS_CANON),
    ['Universidad de Buenos Aires', 'Argentina']);
$checa('"Kth - Kungliga Tekniska Högskolan (Estocolmo, Suécia)" -- parenteses NAO parte ao meio',
    revalidacao_extrai_pais_parenteses('Kth - Kungliga Tekniska Högskolan (Estocolmo, Suécia)', $PAIS_CANON),
    ['Kth - Kungliga Tekniska Högskolan', 'Suécia']);
$checa('sem parenteses: devolve o bruto intacto e pais vazio',
    revalidacao_extrai_pais_parenteses('Universidad de los Andes, Venezuela', $PAIS_CANON),
    ['Universidad de los Andes, Venezuela', '']);
$checa('parenteses que e claramente clausula (bate REVALIDACAO_NAO_PAIS): nao inventa pais',
    revalidacao_extrai_pais_parenteses('Universidade Federal Fluminense (Comissão de Avaliação)', $PAIS_CANON),
    ['Universidade Federal Fluminense (Comissão de Avaliação)', '']);

echo "\n-- amostra compartilhada (a mesma que o teste Python confere) --\n";
$amostra = json_decode((string)file_get_contents(
    __DIR__ . '/../../tools/dados_referencia/revalidacao-campos.json'), true);
foreach (['pais', 'curso', 'instituicao'] as $campo) {
    foreach ($amostra[$campo] as [$bruto, $esperado]) {
        if ($campo === 'pais')             $obtido = revalidacao_pais_canon($bruto, $PAIS_CANON);
        elseif ($campo === 'instituicao')  $obtido = revalidacao_limpa_instituicao($bruto, $PAIS_CANON);
        else                               $obtido = revalidacao_limpa_campo($bruto);
        $checa("$campo: " . mb_substr($bruto, 0, 44), $obtido, $esperado);
    }
}

echo "\n", $falhas ? "$falhas FALHA(S)\n" : "TODOS OK\n";
exit($falhas ? 1 : 0);
