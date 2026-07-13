<?php
// ============================================================================
//  Extração de prazos PAD/SINVE (alta confiança) — espelho PHP de
//  extrair_prazos_pad_sinve.py. Rodado durante importação de cada ato.
//
//  Classificação:
//    - Tipo: PAD, PAD_SUMARIO, SINVE
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
    $resultado = [];
    $blob = mb_strtolower($ementa . " " . $texto);

    // Classificação por tipo
    if (preg_match('/processo\s+administrativo\s+disciplinar\s+sum[aá]rio/', $blob)) {
        $tipo = 'PAD_SUMARIO';
    } elseif (preg_match('/processo\s+administrativo\s+disciplinar/', $blob)) {
        $tipo = 'PAD';
    } elseif (preg_match('/sindic[âa]ncia\s+investigat[óo]ria|sindic[âa]ncia\s+investigativa/', $blob)) {
        $tipo = 'SINVE';
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
    if (preg_match('/prazo\s+(?:\w+\s+){0,2}?de\s+(\d{1,3})\s*\([^)]{0,25}\)?\s*dias/i', $blob, $m)) {
        $dias = (int)$m[1];
    } elseif (preg_match('/prorroga\w*\s+(?:o\s+prazo\s+)?por\s+(?:mais\s+)?(\d{1,3})\s*\(?[^)]{0,25}\)?\s*dias/i', $blob, $m)) {
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

    // Resultado: um "prazo" de alta confiança
    return [[
        'tipo' => $tipo,           // PAD, PAD_SUMARIO, SINVE
        'papel' => $papel,         // INSTAURACAO, EXTENSAO, SOBRESTAMENTO
        'dias' => $dias,
        'dataLimite' => $data_limite,
        'conf' => 'Alta',
        'base' => 'PAD_SINVE',
        'ctx' => '',  // sem contexto (já é estruturado o suficiente)
        'origem' => "({$tipo}, {$papel}, {$dias} dias)",
    ]];
}
