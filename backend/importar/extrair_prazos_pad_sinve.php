<?php
// ============================================================================
//  Extração de prazos PAD/SINVE (alta confiança) — espelho PHP de
//  extrair_prazos_pad_sinve.py. Rodado durante importação de cada ato.
//
//  Classificação:
//    - Tipo: PAD, PAD_SUMARIO, SINVE, SINDACUS
//    - Papel: INSTAURACAO, EXTENSAO, SOBRESTAMENTO
//    - Base legal: dias literais extraídos do texto
//
//  Uso (CLI):
//      php -r "require 'extrair_prazos_pad_sinve.php'; var_dump(extrair_prazos_pad_sinve(...));"
//
//  Uso (no importador):
//      foreach (extrair_prazos_pad_sinve($ementaP, $textoP, $dataP) as $pz) { ... }
// ============================================================================

function extrair_prazos_pad_sinve(string $ementa, string $texto, ?string $data_ato): array {
    $blob = mb_strtolower($ementa . " " . $texto, 'UTF-8');

    // Classificação por tipo. As SINDICÂNCIAS vêm antes do PAD: são o termo
    // mais específico, e uma sindicância costuma citar "processo administrativo
    // disciplinar" como possível desdobramento — checar PAD antes rotularia
    // esses atos como PAD por engano.
    // (Espelha classifica_tipo em extrair_prazos_pad_sinve.py.)
    //
    // Sindicância ACUSATÓRIA (também chamada punitiva) e INVESTIGATIVA são
    // instrumentos diferentes: a investigativa é inquisitorial e não pune; a
    // acusatória tem contraditório e pode aplicar penalidade. Misturar as duas
    // numa categoria só apaga a distinção que interessa a quem consulta.
    //
    // Um mesmo ato pode citar as duas ("converter a investigativa em
    // acusatória"), então vence a que aparece PRIMEIRO — e o blob começa pela
    // ementa, que é onde o ato declara o que ele próprio faz.
    $posAcus = preg_match('/sindic[âa]ncia\s+(?:acusat[óo]ria|punitiva)/u', $blob, $mA, PREG_OFFSET_CAPTURE)
             ? $mA[0][1] : PHP_INT_MAX;
    $posInv  = preg_match('/sindic[âa]ncia\s+investigat[óo]ria|sindic[âa]ncia\s+investigativa/u', $blob, $mI, PREG_OFFSET_CAPTURE)
             ? $mI[0][1] : PHP_INT_MAX;

    if ($posAcus < $posInv) {
        $tipo = 'SINDACUS';
    } elseif ($posInv !== PHP_INT_MAX) {
        $tipo = 'SINVE';
    } elseif (preg_match('/processo\s+administrativo\s+disciplinar\s+sum[aá]rio/u', $blob)) {
        $tipo = 'PAD_SUMARIO';
    } elseif (preg_match('/processo\s+administrativo\s+disciplinar/u', $blob)) {
        $tipo = 'PAD';
    } else {
        return [];  // fora do escopo PAD/SINVE
    }

    // Classificação por papel (só primeiros ~600 chars pra evitar falsos positivos)
    $inicio = mb_substr($blob, 0, 600);
    if (preg_match('/\breconduz\w*\b|\bprorroga\w*\b/', $inicio)) {
        $papel = 'EXTENSAO';
    } elseif (preg_match('/\binstaura(r|ção|da|do|m)?\b/', $inicio)) {
        $papel = 'INSTAURACAO';
    } elseif (preg_match('/\bsobrest\w*\b/', $inicio)) {
        $papel = 'SOBRESTAMENTO';
    } else {
        return [];  // papel desconhecido
    }

    // Extração de dias: "prazo de 30 (trinta) dias" ou "prorrogar por 60 dias"
    $dias = null;
    if (preg_match('/prazo\s+(?:\S+\s+){0,2}?de\s+(\d{1,3})\s*\([^)]{0,25}\)?\s*dias/iu', $blob, $m)) {
        $dias = (int)$m[1];
    } elseif (preg_match('/prorroga\w*\s+(?:o\s+prazo\s+)?por\s+(?:mais\s+)?(\d{1,3})\s*\(?[^)]{0,25}\)?\s*dias/iu', $blob, $m)) {
        $dias = (int)$m[1];
    }

    if ($dias === null) {
        return [];  // sem dias literal declarado
    }

    // Calcular data_limite: data_ato + dias (regra lei 9784: exclui dia inicial)
    // Simplificação: usar dias corridos (não úteis), sem feriado lookup
    if ($data_ato && preg_match('/^\d{4}-\d{2}-\d{2}$/', $data_ato)) {
        $dt = DateTime::createFromFormat('Y-m-d', $data_ato);
        if ($dt) {
            $dt->modify("+{$dias} days");
            $data_limite = $dt->format('Y-m-d');
        } else {
            $data_limite = null;
        }
    } else {
        $data_limite = null;
    }

    // Rótulo "público" determinístico (mesmo no backfill e no import diário)
    $publico_map = [
        'PAD'         => 'Comissão de PAD',
        'PAD_SUMARIO' => 'Comissão de PAD Sumário',
        'SINVE'       => 'Comissão de Sindicância',
        'SINDACUS'    => 'Comissão de Sindicância',
    ];
    $publico = $publico_map[$tipo] ?? 'Comissão';

    $papel_label = [
        'INSTAURACAO'   => 'instauração',
        'EXTENSAO'      => 'prorrogação/recondução',
        'SOBRESTAMENTO' => 'sobrestamento',
    ][$papel] ?? $papel;
    $tipo_label = [
        'PAD'         => 'PAD',
        'PAD_SUMARIO' => 'PAD Sumário',
        'SINVE'       => 'Sindicância Investigativa',
        'SINDACUS'    => 'Sindicância Acusatória',
    ][$tipo] ?? $tipo;

    // Resultado: um "prazo" de alta confiança
    return [[
        'tipo' => $tipo,           // PAD, PAD_SUMARIO, SINVE, SINDACUS (código; o front rotula)
        'papel' => $papel,         // INSTAURACAO, EXTENSAO, SOBRESTAMENTO
        'dias' => $dias,
        'dataLimite' => $data_limite,
        'conf' => 'alta',   // minúsculo: casa com o filtro do front (p.conf==='alta')
        'base' => 'PAD_SINVE',
        'publico' => $publico,
        'origem' => "{$tipo_label} · {$papel_label} · prazo de {$dias} dias",
    ]];
}
