<?php
// ============================================================================
//  teste_comissoes_match.php — regressão do vínculo ato<->colegiado permanente.
//
//  Uso:  php backend/importar/teste_comissoes_match.php     (sai 1 se quebrou)
//
//  CADA CASO AQUI É UMA EMENTA REAL DO ACERVO, medida antes de virar regra.
//  Não são exemplos ilustrativos.
//
//  A aba Comissões é dossiê: ela afirma que um ato é da vida de um colegiado.
//  Pendurar no corpo CENTRAL o ato de uma comissão homônima de UNIDADE é o
//  defeito caro aqui — foi o que motivou os qualificadores do CBio e da
//  Acessibilidade, e as exclusões do CPFJ.
// ============================================================================
require_once __DIR__ . '/comissoes_match.php';

$falhas = 0; $ok = 0;

/** A ementa TEM que ligar o ato a $slug. */
function aceita(string $rotulo, string $ementa, string $slug): void {
    global $falhas, $ok;
    $s = comissoes_do_texto($ementa);
    if (!in_array($slug, $s, true)) {
        echo "FALHA  [$rotulo] deveria aceitar '$slug', veio: "
           . (implode(',', $s) ?: '(nada)') . "\n";
        $falhas++;
    } else { $ok++; }
}

/** A ementa NÃO pode ligar o ato a $slug (ou a nada, se $slug = null). */
function recusa(string $rotulo, string $ementa, ?string $slug = null): void {
    global $falhas, $ok;
    $s = comissoes_do_texto($ementa);
    $achou = $slug === null ? count($s) > 0 : in_array($slug, $s, true);
    if ($achou) {
        echo "FALHA  [$rotulo] deveria recusar" . ($slug ? " '$slug'" : ' tudo')
           . ', veio: ' . (implode(',', $s) ?: '(nada)') . "\n";
        $falhas++;
    } else { $ok++; }
}

// ---------------------------------------------------------------------------
// 1. A GUARDA DE COLEGIADO — o documento homônimo do comitê não entra.
//    Sem ela o CSI ia de 3 atos reais para 83.
// ---------------------------------------------------------------------------
recusa('política não é o comitê',
       'Institui a Política de Segurança da Informação no âmbito da UFF.', 'csi');
aceita('o comitê é o comitê',
       'Designa os membros do Comitê de Segurança da Informação da UFF.', 'csi');

// ---------------------------------------------------------------------------
// 2. HOMÔNIMO DE UNIDADE — cada unidade tem a sua, e só a central conta.
// ---------------------------------------------------------------------------
recusa('biossegurança de unidade',
       'Designa a Comissão Interna de Biossegurança do Instituto de Química.', 'biosseg');
aceita('biossegurança central',
       'Aprova o Regimento da Comissão de Biossegurança da UFF.', 'biosseg');

// ---------------------------------------------------------------------------
// 3. CPFJ — o corpo que exigiu os dois prefixos novos ('!' e '+').
// ---------------------------------------------------------------------------

// 3.1 A vida do colegiado, pelo termo comum (que depende da guarda).
aceita('CPFJ constituída (62.325/2018)',
       'Constitui Comissão para estabelecer os critérios e procedimentos no âmbito '
     . 'da UFF, necessários à autorização de adoção da flexibilização da jornada de '
     . 'trabalho de servidores técnico-administrativos.', 'cpfj');
aceita('CPFJ retificação de membros (68.471/2022)',
       'Retificação dos membros integrantes, nos termos da Portaria 68.254/2021 de '
     . '06 de agosto de 2021 da Comissão Permanente de Flexibilização', 'cpfj');
aceita('CPFJ presidente e vice (64.061/2019)',
       'Cancela a Portaria Nº 63.954 de 30 de maio de 2019 e Retifica os nomes dos '
     . 'membros integrantes e nomeia o Presidente e Vice-Presidente, da Comissão '
     . 'Permanente de Flexibilização', 'cpfj');

// 3.2 A EXCLUSÃO. O HUAP tem a sua Comissão Permanente de Flexibilização
//     (Portaria 68.440/2022) e escreve o nome igualzinho ao da central. É o
//     caso que nenhum qualificador positivo separa — daí '!do hospital'.
recusa('CPFJ do HUAP é de unidade (68.440/2022)',
       'Cria a Comissão Permanente de Flexibilização do Hospital Universitário '
     . 'Antônio Pedro - HUAP.', 'cpfj');
recusa('composição da CPFJ do HUAP (68.563/2023)',
       'Altera a composição de membros da Comissão Permanente de Flexibilização do '
     . 'Hospital Universitário Antônio Pedro - HUAP.', 'cpfj');
recusa('comissão de implantação é de unidade (DTS 16/2016)',
       'Comissão de Implantação de procedimentos para adoção da flexibilização da '
     . 'jornada de trabalho de servidores técnicos administrativos do quadro '
     . 'permanente de pessoal da UFF.', 'cpfj');

// 3.3 O TERMO FORTE ('+'). Estas ementas nomeiam o INSTRUMENTO e não dizem
//     "comissão" em lugar nenhum: sem o '+', a guarda derrubava as ~54
//     portarias de plano, que são o grosso do que a comissão faz.
aceita('plano de UORG (65.984/2019)',
       'Aprova o plano de flexibilização da jornada de trabalho dos servidores '
     . 'técnicos administrativos do INSTITUTO DE COMPUTAÇÃO e dá outras providências',
       'cpfj');
aceita('NS 672/2019 fixa as competências da CPFJ',
       'Estabelece os critérios e as condições para a adoção da flexibilização da '
     . 'jornada de trabalho dos servidores técnico-administrativos no âmbito da UFF.',
       'cpfj');
aceita('suspende avaliação anual (68.403/2022)',
       'Suspender o prazo para a avaliação anual dos resultados da flexibilização de '
     . 'jornada, prevista no inciso V do artigo 10 da Norma de Serviço nº 672.',
       'cpfj');

// 3.4 O OCR do Boletim espaça palavra no meio. É por isso que há três frases
//     '+' e não uma: cada uma alcança o que as outras perdem.
aceita('OCR quebrou "trabalho" (68.484/2023)',
       'Aprova o plano de flexibilização da jornada de t r a b a l h o d o s '
     . 's e r v i d o r e s t é c n i c o s administrativos da CBI/SDC', 'cpfj');
aceita('OCR quebrou "plano de" (68.609/2023)',
       'Ap r o va a m anut enç ão d o p l ano d e flexibilização da jornada de '
     . 'trabalho dos servidores técnicos adm inistrativos da Biblioteca do '
     . 'Instituto Biomédico', 'cpfj');

// 3.5 A HISTÓRIA DA POLÍTICA NÃO É A COMISSÃO. A CPFJ só nasce em outubro de
//     2018; os atos de 2016 são do rito anterior e não podem entrar no card,
//     senão o dossiê afirma que um colegiado inexistente agiu.
recusa('40h e registro de frequência (57.301/2016)',
       'Dispõe sobre a jornada de trabalho e o registro da frequência dos '
     . 'servidores técnico-administrativos da UFF.', 'cpfj');
recusa('trabalho remoto (57.303/2016)',
       'Dispõe sobre a regulamentação do Trabalho Remoto no âmbito da UFF e dá '
     . 'outras providências.', 'cpfj');
recusa('revoga a 57.302 (57.655/2016)',
       'Revoga a Portaria nº 57.302 e suspende por 24 (vinte e quatro) meses a '
     . 'vigência da Portaria nº 57.303.', 'cpfj');

// ---------------------------------------------------------------------------
// 4. O '+' de um corpo não pode vazar para os outros: ementa de plano de
//    flexibilização não liga a comissão nenhuma além do CPFJ.
// ---------------------------------------------------------------------------
$s = comissoes_do_texto('Aprova o plano de flexibilização da jornada de trabalho dos '
                      . 'servidores técnicos administrativos da EGL - INSTITUTO DE LETRAS');
if ($s !== ['cpfj']) {
    echo 'FALHA  [plano só liga cpfj] veio: ' . (implode(',', $s) ?: '(nada)') . "\n";
    $falhas++;
} else { $ok++; }

// ---------------------------------------------------------------------------
// 5. Sinal por ÓRGÃO EMISSOR — sem guarda, mas as exclusões continuam valendo.
// ---------------------------------------------------------------------------
$s = comissoes_do_orgao('Comitê de Governança, Integridade, Riscos e Controles');
if (!in_array('cgirc', $s, true)) {
    echo "FALHA  [órgão CGIRC] deveria ligar 'cgirc', veio: "
       . (implode(',', $s) ?: '(nada)') . "\n";
    $falhas++;
} else { $ok++; }

$s = comissoes_do_orgao('Comissão Permanente de Flexibilização do Hospital '
                      . 'Universitário Antônio Pedro');
if (in_array('cpfj', $s, true)) {
    echo "FALHA  [órgão HUAP] a exclusão tem que valer também por órgão emissor\n";
    $falhas++;
} else { $ok++; }

// ---------------------------------------------------------------------------
// 6. As três projeções do registro curado têm que ter os MESMOS slugs.
//    (aqui só dá para conferir contra o index_v2.php; o gerador Python é a
//    fonte dos dois e o CI não tem Python neste job)
// ---------------------------------------------------------------------------
$api = dirname(__DIR__) . '/api/index_v2.php';
$src = file_get_contents($api);
if ($src === false) {
    echo "FALHA  [projeções] não consegui ler $api\n";
    $falhas++;
} else {
    preg_match('/function comissoes_registro\(\): array \{.*?\n    \}/s', $src, $m);
    preg_match_all("/\[\s*'([a-z0-9\-]+)'\s*,/", $m[0] ?? '', $mm);
    $noIndex = $mm[1] ?? [];
    $noMatch = array_keys(comissoes_termos());
    if ($noIndex !== $noMatch) {
        echo "FALHA  [projeções] comissoes_registro() e comissoes_termos() divergem\n";
        echo '  só no index_v2.php : ' . implode(',', array_diff($noIndex, $noMatch)) . "\n";
        echo '  só no match        : ' . implode(',', array_diff($noMatch, $noIndex)) . "\n";
        $falhas++;
    } else { $ok++; }
}

echo "\n$ok ok, $falhas falha(s).\n";
exit($falhas > 0 ? 1 : 0);
