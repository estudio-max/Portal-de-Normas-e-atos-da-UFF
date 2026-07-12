<?php
// ============================================================================
//  extrair_prazos.php — extração server-side de datas-limite (Radar de Prazos).
//  ESPELHO FIEL de extrairPrazos + inferirPublico de repo/src/dataSource.ts
//  (e de scratchpad/extrair_prazos.py, usado no backfill). Mesma lógica de
//  intent-anchoring: só extrai uma data se houver intenção de prazo por perto.
//
//  ⚠️ Se mudar a lógica aqui, mude TAMBÉM no dataSource.ts (fallback estático)
//  e no extrair_prazos.py (backfill) — os três precisam concordar.
//
//  Incluído por importar_v2.php; popula a tabela `prazo` a cada importação.
// ============================================================================

const PZ_MES = ['janeiro'=>1,'fevereiro'=>2,'março'=>3,'marco'=>3,'abril'=>4,'maio'=>5,
    'junho'=>6,'julho'=>7,'agosto'=>8,'setembro'=>9,'outubro'=>10,'novembro'=>11,'dezembro'=>12];

const PZ_EXCLUI  = '#(período\s+aquisitivo|aquisitivo|ônus\s+limitad|afastament|licença|capacitaç|suspens|penalidade|advertência|retroativ|\bfaltas?\b|ausência|puniç|apenad|designaç|designad|exercício\s+financeiro|mandato)#u';
const PZ_INSCR   = '#(inscriç|matrícul|requeriment|candidatur)#u';
const PZ_RECURSO = '#(recurso|impugnaç|interpos|contestaç)#u';
const PZ_ENTREGA = '#(entrega|envio|encaminh|apresentaç|protocol|submet|remess|preenchiment|manifestaç)#u';
const PZ_VIGENCIA= '#(comissã|banca|edital|credenciament|cadastr|chapa|portaria)#u';

function _pz_y4($y) { $n = (int)$y; return $n < 100 ? 2000 + $n : $n; }
function _pz_iso($y, $m, $d) { return sprintf('%04d-%02d-%02d', $y, $m, $d); }
function _pz_valida($s) {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) return false;
    $y = (int)substr($s, 0, 4); return $y >= 2015 && $y <= 2035;
}
function _pz_add_dias($b, $n) {
    $dt = DateTime::createFromFormat('Y-m-d', $b); if (!$dt) return '';
    $dt->modify("+$n days"); return $dt->format('Y-m-d');
}
function _pz_add_meses($b, $n) {
    $dt = DateTime::createFromFormat('Y-m-d', $b); if (!$dt) return '';
    // "+N months" do PHP transborda dia (31 jan +1 mês = 3 mar); mesmo comportamento
    // aproximado do JS setUTCMonth. Diferença é rara e cosmética p/ este radar.
    $dt->modify("+$n months"); return $dt->format('Y-m-d');
}

// Fiel a inferirPublico(ementa, contexto) do dataSource.ts
function inferir_publico($ementa, $contexto) {
    $f = mb_strtolower(($ementa ?? '') . ' ' . ($contexto ?? ''), 'UTF-8');
    $has = fn($p) => (bool)preg_match($p . 'u', $f);
    if ($has('#licitaç|pregão|contrataç|fornecedor|termo de referência|dispensa de licit|cotaç.o de preç|chamamento públic#')) return 'Fornecedores';
    if ($has('#eleiç|consulta eleitoral|\bchapa|votaç|urna|escrutín|diretório acadêmic#')) return 'Comunidade (eleição)';
    $dom = $has('#monitoria#') ? 'monitoria'
        : ($has('#mestrad|doutorad|pós-?gradua|\bppg|stricto sensu|lato sensu|resid.ncia médic|especializaç#') ? 'pós-graduação'
        : ($has('#docente|professor|magistério|magisterio|processo seletivo simplificado|\bpss\b|concurso públic#') ? 'seleção docente'
        : ($has('#pibic|pibid|iniciaç.o cient|\bbolsa#') ? 'bolsa'
        : ($has('#estági#') ? 'estágio'
        : ($has('#graduaç|graduand|discente|\balun[oa]s?\b|estudante#') ? 'graduação' : null)))));
    $selec = $has('#inscriç|processo seletivo|seleç.o|candidat|concurso|\bedital|\bprova\b|classificaç#');
    if ($selec) return $dom ? "Candidatos · $dom" : 'Candidatos';
    if ($dom) return $dom === 'seleção docente' ? 'Docentes' : "Discentes · $dom";
    if ($has('#servidor|técnico-?administrativ|\btae\b#')) return 'Servidores';
    return 'Comunidade acadêmica';
}

/**
 * Extrai datas-limite. @return array de ['dataLimite','tipo','conf','base','origem','ctx']
 * $dataAto = 'YYYY-MM-DD'|null (base dos prazos relativos).
 */
function extrair_prazos($texto, $dataAto) {
    if (!$texto) return [];
    $t = mb_strtolower($texto, 'UTF-8');
    $out = []; $vistos = [];
    $win = fn($i, $w = 95) => mb_substr($t, max(0, $i - $w), $w * 2, 'UTF-8');
    $snip = function ($i) use ($t) {
        return '…' . trim(preg_replace('/\s+/u', ' ', mb_substr($t, max(0, $i - 48), 103, 'UTF-8'))) . '…';
    };
    $push = function ($dl, $tipo, $conf, $base, $i) use (&$out, &$vistos, $t, $snip) {
        if (_pz_valida($dl) && !isset($vistos[$dl])) {
            $vistos[$dl] = true;
            $out[] = ['dataLimite' => $dl, 'tipo' => $tipo, 'conf' => $conf, 'base' => $base,
                      'origem' => $snip($i), 'ctx' => mb_substr($t, max(0, $i - 170), 340, 'UTF-8')];
        }
    };
    // offsets do preg_match_all são em BYTES; converto p/ índice de caractere
    // antes de fatiar com mb_substr (o texto tem acentos).
    $ci = fn($byteOff) => mb_strlen(substr($t, 0, $byteOff), 'UTF-8');

    // 1) janela "de X a Y" — inscrição/recurso
    if (preg_match_all('#de\s+(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\s+a\s+(\d{1,2})/(\d{1,2})/(\d{2,4})#u', $t, $ms, PREG_SET_ORDER | PREG_OFFSET_CAPTURE)) {
        foreach ($ms as $m) { $i = $ci($m[0][1]); $c = $win($i, 110);
            if (preg_match(PZ_EXCLUI, $c)) continue;
            $intent = preg_match(PZ_INSCR, $c) ? 'inscrição' : (preg_match(PZ_RECURSO, $c) ? 'recurso' : null);
            if (!$intent) continue;
            $push(_pz_iso(_pz_y4($m[6][0]), (int)$m[5][0], (int)$m[4][0]), $intent, 'alta', 'data no texto', $i);
        }
    }
    // 2) "até DD/MM/AAAA"
    if (preg_match_all('#até\s+(?:o\s+dia\s+|as?\s+\d{1,2}h?\s+de\s+)?(\d{1,2})/(\d{1,2})/(\d{2,4})#u', $t, $ms, PREG_SET_ORDER | PREG_OFFSET_CAPTURE)) {
        foreach ($ms as $m) { $i = $ci($m[0][1]); $c = $win($i);
            if (preg_match(PZ_EXCLUI, $c)) continue;
            $intent = preg_match(PZ_INSCR, $c) ? 'inscrição' : (preg_match(PZ_RECURSO, $c) ? 'recurso'
                    : (preg_match(PZ_ENTREGA, $c) ? 'entrega/requerimento'
                    : (preg_match(PZ_VIGENCIA, $c) ? 'vigência/validade' : null)));
            if (!$intent) continue;
            $push(_pz_iso(_pz_y4($m[3][0]), (int)$m[2][0], (int)$m[1][0]), $intent,
                  $intent === 'vigência/validade' ? 'média' : 'alta', 'data no texto', $i);
        }
    }
    // 3) "até DD de MÊS (de AAAA)?"
    if (preg_match_all('#até\s+(?:o\s+dia\s+)?(\d{1,2})\s+de\s+([a-zç]+)(?:\s+de\s+(\d{4}))?#u', $t, $ms, PREG_SET_ORDER | PREG_OFFSET_CAPTURE)) {
        foreach ($ms as $m) { $mes = $m[2][0]; if (!isset(PZ_MES[$mes])) continue;
            $i = $ci($m[0][1]); $c = $win($i);
            if (preg_match(PZ_EXCLUI, $c)) continue;
            $intent = preg_match(PZ_INSCR, $c) ? 'inscrição' : (preg_match(PZ_RECURSO, $c) ? 'recurso'
                    : (preg_match(PZ_ENTREGA, $c) ? 'entrega/requerimento' : null));
            if (!$intent) continue;
            $ano = !empty($m[3][0]) ? (int)$m[3][0] : ($dataAto ? (int)substr($dataAto, 0, 4) : 0);
            if (!$ano) continue;
            $push(_pz_iso($ano, PZ_MES[$mes], (int)$m[1][0]), $intent, 'alta', 'data no texto', $i);
        }
    }
    // 4) relativo em DIAS
    if (preg_match_all('#(\d{1,3})\s*(?:\([^)]*\)\s*)?dias?\s+(?:úteis\s+)?(?:,?\s*)?(?:a\s+contar|contad[oa]s?|a\s+partir)\s+d[ae]\s+(?:sua\s+)?(public|assinatura|data|receb|notific|ciênc)#u', $t, $ms, PREG_SET_ORDER | PREG_OFFSET_CAPTURE)) {
        foreach ($ms as $m) { $i = $ci($m[0][1]); $c = $win($i);
            if (preg_match(PZ_EXCLUI, $c)) continue;
            if ($dataAto) { $dl = _pz_add_dias($dataAto, (int)$m[1][0]);
                if ($dl) $push($dl, "prazo ({$m[1][0]} dias)", 'média', 'assinatura+N', $i); }
        }
    }
    // 5) relativo MESES/ANOS
    if (preg_match_all('#(\d{1,2})\s*(?:\([^)]*\)\s*)?(mês|meses|anos?)\s+(?:a\s+contar|a\s+partir)\s+d[ae]\s+(?:sua\s+)?(assinatura|data|public)#u', $t, $ms, PREG_SET_ORDER | PREG_OFFSET_CAPTURE)) {
        foreach ($ms as $m) { $i = $ci($m[0][1]); $c = $win($i);
            if (preg_match(PZ_EXCLUI, $c)) continue;
            $mult = preg_match('#ano#u', $m[2][0]) ? 12 : 1;
            if ($dataAto) { $dl = _pz_add_meses($dataAto, (int)$m[1][0] * $mult);
                if ($dl) $push($dl, "prazo ({$m[1][0]} {$m[2][0]})", 'média', 'assinatura+N', $i); }
        }
    }
    return $out;
}
