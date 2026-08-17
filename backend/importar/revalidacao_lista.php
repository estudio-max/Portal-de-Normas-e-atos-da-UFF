<?php

/**
 * Normaliza as versões singular e plural do módulo de revalidação do JSON.
 *
 * null indica que o módulo não veio no ato; uma lista vazia indica que ele
 * veio explicitamente, mas não há revalidações para persistir.
 */
function revalidacoes_do_json(array $ato): ?array {
    $temPlural = array_key_exists('revalidacoes', $ato);
    $temSingular = array_key_exists('revalidacao', $ato);

    if (!$temPlural && !$temSingular) {
        return null;
    }
    if ($temPlural) {
        return is_array($ato['revalidacoes']) ? array_values($ato['revalidacoes']) : [];
    }

    $um = $ato['revalidacao'];
    return is_array($um) ? [$um] : [];
}
