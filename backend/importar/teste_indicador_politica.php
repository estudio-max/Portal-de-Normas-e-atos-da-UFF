<?php
// ============================================================================
//  teste_indicador_politica.php — regressão do snapshot de etapas.
//
//  Uso:  php backend/importar/teste_indicador_politica.php   (sai 1 se quebrou)
//
//  O que este teste protege não é uma conta, é uma DECISÃO: a série histórica só
//  vale se ganhar linha quando algo acontece na política, e não quando o
//  calendário anda. Com o cron rodando 2x/dia, um snapshot gravado à toa vira
//  730 linhas por ano por política — e a pergunta "quando esta política ganhou
//  monitoramento?" deixa de ter resposta legível.
// ============================================================================
require_once __DIR__ . '/indicador_politica.php';

$falhas = 0; $ok = 0;

function checa(string $rotulo, bool $cond, string $detalhe = ''): void {
    global $falhas, $ok;
    if ($cond) { $ok++; return; }
    echo "FALHA  [$rotulo]" . ($detalhe ? " — $detalhe" : '') . "\n";
    $falhas++;
}

function lin(string $papel, ?string $data): array {
    return ['papel' => $papel, 'data_ato' => $data];
}

// ---------------------------------------------------------------------------
// 1. CONTAGEM, não pontuação. É a diferença que define a metodologia: ter
//    quinze atos de execução não vale o mesmo que ter um.
// ---------------------------------------------------------------------------
$c = indicador_politica_calcular([
    lin('execucao', '2025-01-10'), lin('execucao', '2025-02-10'),
    lin('execucao', '2025-03-10'), lin('fundador', '2020-01-01'),
]);
checa('conta atos por etapa, não pontos',
    $c['colunas']['execucao'] === 3 && $c['colunas']['instituicao'] === 1,
    'execucao=' . $c['colunas']['execucao'] . ' instituicao=' . $c['colunas']['instituicao']);

checa('etapa sem ato fica em zero', $c['colunas']['monitoramento'] === 0);

// `avaliacao` no vocabulário de papel cai na coluna `revisao` da tabela.
$c2 = indicador_politica_calcular([lin('avaliacao', '2024-06-01')]);
checa('avaliacao mapeia para a coluna revisao', $c2['colunas']['revisao'] === 1);

// Papel que não é etapa do ciclo (alteracao, revogacao, referencia) não conta.
$c3 = indicador_politica_calcular([
    lin('alteracao', '2025-01-01'), lin('revogacao', '2025-01-01'),
    lin('referencia', '2025-01-01'),
]);
checa('alteracao/revogacao/referencia não são etapas do ciclo',
    array_sum($c3['colunas']) === 0, 'soma=' . array_sum($c3['colunas']));

// ---------------------------------------------------------------------------
// 2. A REGRA DE ESCRITA. O motivo de o teste existir.
// ---------------------------------------------------------------------------
$vetor = ['instituicao' => 1, 'regulamentacao' => 0, 'governanca' => 2,
          'execucao' => 3, 'monitoramento' => 0, 'revisao' => 0];

checa('sem snapshot anterior, grava', indicador_politica_mudou($vetor, null));

checa('vetor idêntico NÃO grava de novo',
    !indicador_politica_mudou($vetor, $vetor));

$mudou = $vetor; $mudou['monitoramento'] = 1;
checa('etapa nova grava', indicador_politica_mudou($mudou, $vetor));

$aMais = $vetor; $aMais['execucao'] = 4;
checa('mais um ato na mesma etapa grava', indicador_politica_mudou($aMais, $vetor));

// A armadilha: `continuidade` cresce sozinha com o calendário. Se entrasse na
// comparação, a série ganharia uma linha por mês sem nada ter acontecido.
$anteriorComContinuidade = $vetor + ['continuidade' => 3];
checa('continuidade NÃO entra na decisão de gravar',
    !indicador_politica_mudou($vetor, $anteriorComContinuidade),
    'continuidade diferente não pode disparar snapshot');

// ---------------------------------------------------------------------------
// 3. O QUE O SNAPSHOT PRECISA CARREGAR para responder a pergunta factual.
// ---------------------------------------------------------------------------
$c4 = indicador_politica_calcular([
    lin('fundador', '2019-03-01'),
    lin('monitoramento', '2025-11-20'),
    lin('execucao', '2023-05-05'),
]);
$res = json_decode($c4['resumo'], true);
checa('resumo traz a versão da metodologia',
    ($res['metodologia'] ?? '') === indicador_politica_versao());
checa('resumo traz a última data por etapa',
    ($res['ultimaPorEtapa']['monitoramento'] ?? '') === '2025-11-20',
    'é o que responde "quando ganhou monitoramento?"');
checa('resumo traz a última evidência geral',
    ($res['ultimaEvidencia'] ?? '') === '2025-11-20');
checa('resumo NÃO carrega escore', !isset($res['escore']));

// ---------------------------------------------------------------------------
// 4. BORDAS.
// ---------------------------------------------------------------------------
$vazio = indicador_politica_calcular([]);
checa('política sem atos não quebra',
    array_sum($vazio['colunas']) === 0 && $vazio['continuidade'] === 0
    && $vazio['ultima'] === null);

$semData = indicador_politica_calcular([lin('fundador', null)]);
checa('ato sem data conta a etapa e não inventa continuidade',
    $semData['colunas']['instituicao'] === 1 && $semData['ultima'] === null);

// TINYINT UNSIGNED vai até 255; overflow silencioso viraria série mentirosa.
$muitos = array_fill(0, 300, lin('governanca', '2025-01-01'));
$c5 = indicador_politica_calcular($muitos);
checa('contagem satura em 255, não estoura o TINYINT',
    $c5['colunas']['governanca'] === 255, 'veio ' . $c5['colunas']['governanca']);

// ---------------------------------------------------------------------------
echo "\n$ok caso(s) OK, $falhas falha(s) — indicador_politica.php\n";
exit($falhas > 0 ? 1 : 0);
