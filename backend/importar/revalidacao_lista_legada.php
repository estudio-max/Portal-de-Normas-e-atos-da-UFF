<?php

$blocoRe = '~pela\s+homologa[çc][ãa]o\s+da\s+revalida[çc][ãa]o\s+do\s+'
    . 'diploma,?\s*obtid[oa]\s+por:\s*(?<itens>.+?)'
    . '(?=\bsala\s+das\s+reuni[õo]es\b|$)~isu';
$itemRe = '~decis[ãa]o\s+n[º°.]?\s*\.?\s*(?<numero>\d+)\s*/\s*(?<ano>\d{2,4})'
    . '\s*\.\s*.+?,\s*diploma\s+de\s+[“"\']?(?<curso>.+?)[”"\']?\s+'
    . 'junto\s+[aà]o?\s+(?<origem>.+?),\s*como\s+'
    . '(?<equiv>doutor(?:ado)?|mestre|mestrado)\s+em\s+.+?'
    . '(?=\.\s*\(processo|;\s*e\s*decis[ãa]o|$)~isu';

function normalizar_revalidacao(string $texto): string {
    $texto = mb_strtolower(trim($texto), 'UTF-8');
    $texto = strtr($texto, [
        'á' => 'a', 'à' => 'a', 'ã' => 'a', 'â' => 'a', 'ä' => 'a',
        'é' => 'e', 'ê' => 'e', 'è' => 'e', 'ë' => 'e',
        'í' => 'i', 'ì' => 'i', 'î' => 'i', 'ï' => 'i',
        'ó' => 'o', 'ô' => 'o', 'õ' => 'o', 'ò' => 'o', 'ö' => 'o',
        'ú' => 'u', 'ù' => 'u', 'û' => 'u', 'ü' => 'u',
        'ç' => 'c', 'ñ' => 'n',
    ]);
    return preg_replace('/\s+/u', ' ', $texto) ?? $texto;
}

function limpar_revalidacao(string $texto): string {
    $texto = preg_replace('/\s+/u', ' ', trim($texto)) ?? trim($texto);
    return trim($texto, " \t\n\r\0\x0B.,;:'\"“”");
}

function separar_origem_revalidacao(string $origem): array {
    $paises = [
        'estados unidos da america' => 'Estados Unidos',
        'estados unidos de america' => 'Estados Unidos',
        'estados unidos' => 'Estados Unidos',
        'reino unido da gra-bretanha' => 'Reino Unido',
        'reino unido da gra bretanha' => 'Reino Unido',
        'reino unido' => 'Reino Unido',
        'inglaterra' => 'Reino Unido',
        'paises baixos' => 'Países Baixos',
        'holanda' => 'Países Baixos',
        'guine-bissau' => 'Guiné-Bissau',
        'coreia do sul' => 'Coreia do Sul',
        'cabo verde' => 'Cabo Verde',
        'republica tcheca' => 'República Tcheca',
        'somalilandia' => 'Somalilândia',
        'bangladesh' => 'Bangladesh',
        'argentina' => 'Argentina', 'alemanha' => 'Alemanha',
        'angola' => 'Angola', 'austria' => 'Áustria',
        'belgica' => 'Bélgica', 'bolivia' => 'Bolívia',
        'brasil' => 'Brasil', 'canada' => 'Canadá',
        'chile' => 'Chile', 'china' => 'China',
        'colombia' => 'Colômbia', 'cuba' => 'Cuba',
        'dinamarca' => 'Dinamarca', 'egito' => 'Egito',
        'equador' => 'Equador', 'espanha' => 'Espanha',
        'finlandia' => 'Finlândia', 'franca' => 'França',
        'haiti' => 'Haiti', 'honduras' => 'Honduras',
        'india' => 'Índia', 'iemen' => 'Iêmen',
        'irlanda' => 'Irlanda', 'israel' => 'Israel',
        'italia' => 'Itália', 'japao' => 'Japão',
        'mexico' => 'México', 'mocambique' => 'Moçambique',
        'nigeria' => 'Nigéria', 'noruega' => 'Noruega',
        'paraguai' => 'Paraguai', 'peru' => 'Peru',
        'polonia' => 'Polônia', 'portugal' => 'Portugal',
        'romenia' => 'Romênia', 'russia' => 'Rússia',
        'suecia' => 'Suécia', 'suica' => 'Suíça',
        'turquia' => 'Turquia', 'uruguai' => 'Uruguai',
        'venezuela' => 'Venezuela',
    ];

    $origem = limpar_revalidacao($origem);
    foreach ($paises as $sufixo => $canonico) {
        if (!preg_match('/(?:^|,\s*)' . preg_quote($sufixo, '/') . '$/iu', normalizar_revalidacao($origem), $m, PREG_OFFSET_CAPTURE)) {
            continue;
        }
        $inicio = $m[0][1];
        $instituicao = limpar_revalidacao(mb_substr($origem, 0, $inicio, 'UTF-8'));
        return [$instituicao, $canonico];
    }

    return [$origem, ''];
}

function extrair_revalidacoes_lista_legada(string $texto): array {
    global $blocoRe, $itemRe;
    if (!preg_match($blocoRe, $texto, $bloco)) return [];
    if (!preg_match_all($itemRe, $bloco['itens'], $itens, PREG_SET_ORDER)) return [];

    $saida = [];
    foreach ($itens as $item) {
        [$instituicao, $pais] = separar_origem_revalidacao($item['origem']);
        $saida[] = [
            'via' => 'Pós-graduação',
            'decisao' => 'Deferido',
            'nivel' => str_starts_with(normalizar_revalidacao($item['equiv']), 'doutor')
                ? 'Doutorado' : 'Mestrado',
            'curso' => limpar_revalidacao($item['curso']),
            'instituicao' => $instituicao,
            'pais' => $pais,
        ];
    }
    return $saida;
}
