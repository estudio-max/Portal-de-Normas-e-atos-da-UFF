<?php
/**
 * Limpeza dos CAMPOS de uma revalidação — curso, instituição e país.
 *
 * POR QUE EXISTE (17/08/2026): a aba Revalidação estava exibindo "Na Bolívia"
 * ao lado de "Bolívia", "Em Medicina" ao lado de "Medicina" e instituição com
 * aspas soltas. Não era ruído estético — era CONTAGEM PARTIDA: "Medicina" tinha
 * 306 pedidos e "Em Medicina" outros 275, a mesma coisa em duas fatias do
 * gráfico. 30% do painel de cursos estava na fatia errada.
 *
 * A causa é a fonte, não o regex: o Boletim escreve "…realizado na Bolívia",
 * "…em nível de Graduação em Medicina", e o `origem`/`curso` capturado carrega
 * a preposição junto. Como `pais_canon()` procura a chave exata, "na bolívia"
 * não bate em nada e passa direto, capitalizada.
 *
 * ⚠️ ESTAS FUNÇÕES SÃO DE LIMPEZA, NÃO DE FUSÃO. Elas consertam o que a captura
 * trouxe a mais. NÃO tentam adivinhar que "Universidade Mayor de San Simon" e
 * "Universidad Mayor de San Simon" são a mesma instituição — isso é resolução
 * de entidade, e a medição de 17/08/2026 mostrou por que não pode ser
 * automática: no corte de 90% de similaridade, "universidad de aquino"
 * (Bolívia, 82 pedidos) casa com "universidad del quindío" (Colômbia, 1), que
 * são instituições diferentes. Fundir por similaridade num dado que vai a órgão
 * de controle inventaria história. O caminho é tabela curada, como
 * `coop_inst_pais_curada` já faz para país de instituição.
 */

/** Dobra para comparação: minúscula, sem acento, espaço normalizado. */
function revalidacao_dobra(string $s): string {
    $s = mb_strtolower(trim($s), 'UTF-8');
    $s = strtr($s, [
        'á'=>'a','à'=>'a','ã'=>'a','â'=>'a','ä'=>'a','é'=>'e','ê'=>'e','è'=>'e',
        'í'=>'i','ì'=>'i','î'=>'i','ó'=>'o','ô'=>'o','õ'=>'o','ò'=>'o','ö'=>'o',
        'ú'=>'u','ù'=>'u','û'=>'u','ü'=>'u','ç'=>'c','ñ'=>'n',
    ]);
    return preg_replace('/\s+/', ' ', $s);
}

/**
 * Tira o que a captura trouxe grudado: aspas em volta, preposição inicial e o
 * rótulo de nível que antecede o curso.
 *
 * As aspas só saem das BORDAS. Aspas no meio costumam ser parte do nome —
 * `Universidad Tecnológica de la Habana "José Antonio Echeverría"` é o nome
 * oficial da instituição, e limpar tudo estragaria o registro certo para
 * arrumar o errado.
 */
function revalidacao_limpa_campo(string $s): string {
    $s = preg_replace('/\s+/u', ' ', trim($s));
    if ($s === '') return '';
    // ⚠️ SÓ DESEMBRULHA QUANDO A ASPA ENVOLVE A STRING INTEIRA. A regra ingênua
    // — "tirar aspas das bordas" — estraga o registro certo para arrumar o
    // errado: `Universidad Tecnológica de la Habana "José Antonio Echeverría"`
    // é o nome oficial, e ali a aspa final NÃO é embrulho, é parte do nome.
    // O teste prende os dois lados.
    // ⚠️ A pontuação de borda sai por `preg` com `/u`, NUNCA por `trim($s,
    // '…–—')`: o `trim` trabalha BYTE a byte, e uma lista com travessão
    // multibyte come pedaço do caractere vizinho. Aqui isso quebrava o `“`
    // (E2 80 9C) porque os bytes E2 e 80 também formam o `–` — a string virava
    // UTF-8 inválido e todo `preg` seguinte devolvia null, silenciosamente.
    $abre = ['"', '“', '”', "'", '«', '»'];
    for ($i = 0; $i < 4; $i++) {
        $antes = $s;
        $s = preg_replace('/^[\s.,;:\-–—]+|[\s.,;:\-–—]+$/u', '', $s);
        $primeiro = mb_substr($s, 0, 1, 'UTF-8');
        $ultimo = mb_substr($s, -1, 1, 'UTF-8');
        if (mb_strlen($s, 'UTF-8') > 1
            && in_array($primeiro, $abre, true) && in_array($ultimo, $abre, true)) {
            $s = mb_substr($s, 1, mb_strlen($s, 'UTF-8') - 2, 'UTF-8');
        }
        $s = trim($s);
        if ($s === $antes) break;
    }
    // "em nível de Graduação em Medicina" -> "Medicina"; "no México" -> "México".
    // A ordem importa: o rótulo de nível sai ANTES da preposição solta, senão
    // "Graduação em Medicina" viraria "Graduação em Medicina" (o `em` não está
    // no começo) e depois nada mais casaria.
    $s = preg_replace('/^(?:n[íi]vel\s+(?:de\s+)?)?(?:gradua[çc][ãa]o|bacharelado|licenciatura|mestrado|doutorado|p[óo]s-?gradua[çc][ãa]o)\s+em\s+/iu', '', $s);
    $s = preg_replace('/^(?:na|no|nos|nas|em|de|da|do|dos|das|como)\s+/iu', '', $s);
    return trim($s);
}

/** Nome próprio a partir de texto em caixa baixa. Preposições e artigos ficam
 *  minúsculos, como manda a grafia de nome próprio nas línguas do corpus. */
function revalidacao_caixa_nome(string $s): string {
    $s = preg_replace('/\s+/u', ' ', trim($s));
    if ($s === '') return '';
    $minusculas = ['de','da','do','das','dos','del','della','di','du','e','y',
                   'la','le','les','las','los','el','a','o','of','the','and',
                   'van','von','zu','der','den','för'];
    $saida = [];
    foreach (explode(' ', $s) as $i => $p) {
        $limpa = revalidacao_dobra($p);
        if ($i > 0 && in_array($limpa, $minusculas, true)) { $saida[] = $limpa; continue; }
        $saida[] = mb_convert_case($p, MB_CASE_TITLE, 'UTF-8');
    }
    return implode(' ', $saida);
}

/**
 * Palavras que denunciam que o trecho capturado NÃO é país. Nasceram de casos
 * reais: "…nos termos estabelecidos na Resolução 97/1996, deste Conselho" fazia
 * o país virar **"Deste Conselho"**, com 17 pedidos em produção — a terceira
 * maior "origem" do painel era um pedaço de cláusula.
 */
const REVALIDACAO_NAO_PAIS = [
    'conselho', 'resolucao', 'termos', 'parecer', 'comissao', 'colegiado',
    'processo', 'decisao', 'reuniao', 'sala', 'universidade', 'universidad',
    'faculdade', 'instituto', 'departamento', 'curso', 'diploma', 'titulo',
    'equivalente', 'doutor', 'mestre', 'bacharel',
    // A cláusula de equivalência vaza inteira quando a origem varre até o
    // ponto: "…, como Mestrado em Economia" virava país. Medido no acervo: 6
    // rótulos assim, um por área.
    'mestrado', 'doutorado', 'licenciatura', 'ph.d', 'phd', 'sorbonne',
];

/**
 * País canônico. Devolve '' quando não dá para afirmar — e isso é decisão:
 * a aba mostra "(não informado)", que é honesto, enquanto um rótulo inventado
 * vira fatia no gráfico e número em relatório de controle.
 */
function revalidacao_pais_canon(string $bruto, array $mapa): string {
    $p = revalidacao_limpa_campo($bruto);
    if ($p === '' || mb_strlen($p) > 40) return '';
    $k = revalidacao_dobra($p);
    if (isset($mapa[$k])) return $mapa[$k];
    // Não está na lista: só passa se ainda PARECER país. Antes daqui, qualquer
    // sobra de cláusula era capitalizada e exibida.
    foreach (REVALIDACAO_NAO_PAIS as $palavra) {
        if (strpos($k, $palavra) !== false) return '';
    }
    // `str_word_count` não é confiável em UTF-8 nem com charlist; contar por
    // espaço basta e não mente.
    if (count(preg_split('/\s+/u', $k)) > 4) return '';
    return revalidacao_caixa_nome($p);
}
