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
 * Nome de INSTITUIÇÃO. Três defeitos reais, todos apontados na aba em
 * produção em 17/08/2026, e cada um com causa própria:
 *
 * 1. **País no lugar de instituição** — "Argentina", "Bolívia", "Paraguai".
 *    Nasce quando a origem capturada não tem vírgula: o código toma a parte
 *    única como instituição, mesmo quando ela é claramente o país. O ato diz
 *    "…obtido por Fulano, na Argentina" e ponto — não nomeia instituição
 *    nenhuma. O honesto é ficar sem instituição, não inventar uma.
 *
 * 2. **Cláusula inteira** — "Termos Estabelecidos Na Resolução 267/2013",
 *    3 pedidos. Mesma família do "Deste Conselho" que virava país.
 *
 * 3. **País grudado no fim do nome** — "…Die Medizinische Fakultät”,
 *    Tübingen, Na Alemanha". Este veio pelo caminho do EXTRATOR, que não
 *    passava por esta limpeza; é o que motivou a amostra compartilhada.
 */
function revalidacao_limpa_instituicao(string $bruto, array $mapa): string {
    $s = trim($bruto);
    if ($s === '') return '';

    // Limpa CADA parte separada por vírgula, e não a string inteira: o nome
    // costuma vir entre aspas junto do endereço — `“…Fakultät”, Tübingen` —
    // e desembrulhar só quando a aspa cerca o TODO não alcançaria a primeira
    // parte. Parte por parte, `“…Fakultät”` desembrulha e `Tübingen` fica.
    $partes = [];
    foreach (explode(',', $s) as $p) {
        $p = revalidacao_limpa_campo($p);
        // Aspa de abertura sem a de fechamento: captura truncada ("“Language").
        $p = preg_replace('/^["“”«»]\s*(?=[^"“”«»]*$)/u', '', $p);
        $p = trim($p);
        if ($p !== '') $partes[] = $p;
    }
    if (!$partes) return '';

    // País no FIM do nome: "…, Tübingen, Na Alemanha" -> tira a última parte.
    // Só quando ela é país RECONHECIDO — cidade fica, porque faz parte do
    // endereço e ajuda a distinguir instituições homônimas.
    while (count($partes) > 1 && revalidacao_e_pais(end($partes), $mapa)) {
        array_pop($partes);
    }
    $s = implode(', ', $partes);

    // Sobrou só o país (ou a origem nunca teve vírgula e era o país): não é
    // instituição. Sem instituição é lacuna; país como instituição é erro.
    if (count($partes) <= 1 && revalidacao_e_pais($s, $mapa)) return '';

    foreach (REVALIDACAO_NAO_INSTITUICAO as $palavra) {
        if (strpos(revalidacao_dobra($s), $palavra) !== false) return '';
    }
    return $s;
}

/**
 * O trecho É um país reconhecido?
 *
 * ⚠️ Teste ESTRITO — pertence à tabela, seja como chave (variante) ou como
 * valor (nome canônico). Usar `revalidacao_pais_canon()` para isto foi erro
 * meu, pego pelo teste: ela é PERMISSIVA de propósito (devolve nome plausível
 * desconhecido, para a curadoria ver depois), então "Tübingen" e "Language"
 * respondiam "sim, é país" — e a limpeza engolia a cidade do endereço e o
 * único nome que a instituição tinha.
 */
function revalidacao_e_pais(string $s, array $mapa): bool {
    $k = revalidacao_dobra(revalidacao_limpa_campo($s));
    if ($k === '') return false;
    if (isset($mapa[$k])) return true;
    foreach ($mapa as $canonico) {
        if (revalidacao_dobra($canonico) === $k) return true;
    }
    return false;
}

/** O que denuncia cláusula no lugar de nome de instituição. Mais curta que a
 *  lista de país: "universidade" e "instituto" são nomes LEGÍTIMOS aqui. */
const REVALIDACAO_NAO_INSTITUICAO = [
    'resolucao', 'termos estabelecidos', 'deste conselho', 'parecer da comissao',
    'nos termos', 'processo n', 'decisao n',
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

/**
 * País colado ao nome da instituição entre parênteses: '(País)' ou
 * '(Cidade, País)'. Sem isto os dois viravam pais=NULL -- achados reais em
 * produção: "Universidad de la Empresa (Uruguai)", "Universidad Complutense
 * de Madrid (Espanha)". Quando a cidade acompanha o país, a vírgula DENTRO
 * do parêntese confundia o split por vírgula que separa instituição de
 * país: "Kth - Kungliga Tekniska Högskolan (Estocolmo, Suécia)" partia o
 * parêntese ao meio e o país saía como "Suécia)", com o parêntese aberto
 * sobrando na instituição.
 *
 * Espelha _reval_extrai_pais_parenteses() em tools/extrair_boletim.py --
 * mesma função, duas linguagens; padrão novo entra nas duas.
 *
 * Devolve [resto_sem_parenteses, pais]; pais === '' quando não achou nada
 * dentro dos parênteses (o parêntese pode não ser país nenhum).
 */
function revalidacao_extrai_pais_parenteses(string $bruto, array $mapa): array {
    if (!preg_match('/^(?P<resto>.*?)\s*\((?P<dentro>[^()]{2,80})\)\s*$/su', trim($bruto), $m)) {
        return [$bruto, ''];
    }
    $partes = array_values(array_filter(array_map('trim', explode(',', $m['dentro'])), 'strlen'));
    $pais = $partes ? revalidacao_pais_canon(end($partes), $mapa) : '';
    if ($pais === '') return [$bruto, ''];
    return [trim($m['resto'], " .,;"), $pais];
}

/**
 * Canonização de país. Chave = nome sem acento e em minúsculas, para casar
 * tanto o texto do banco quanto as variantes e o erro de digitação da fonte
 * ("Aústria"). O VALOR é o nome próprio canônico, igual ao de `coop_paises()`
 * — é ele que garante que o histórico se junte ao que o pipeline diário
 * grava, em vez de virar uma fatia separada no gráfico.
 *
 * Mora AQUI, e não no backfill, porque o teste precisa da mesma tabela: uma
 * cópia reduzida dentro do teste o fazia passar contra uma realidade que não
 * existe — 'França' e 'Peru' não estavam nela, e a limpeza de instituição
 * "passou" no teste enquanto errava na tela.
 */
function revalidacao_paises_canon(): array {
    static $p = [
    'eua' => 'Estados Unidos',
    'estados unidos' => 'Estados Unidos',
    'estados unidos da america' => 'Estados Unidos',
    'estados unidos de america' => 'Estados Unidos',
    'reino unido' => 'Reino Unido',
    'reino unido da gra bretanha' => 'Reino Unido',
    'reino unido da gra-bretanha' => 'Reino Unido',
    'inglaterra' => 'Reino Unido',
    'austria' => 'Áustria',
    'holanda' => 'Países Baixos',
    'paises baixos' => 'Países Baixos',
    'alemanha' => 'Alemanha', 'argentina' => 'Argentina', 'angola' => 'Angola',
    'bolivia' => 'Bolívia', 'brasil' => 'Brasil', 'canada' => 'Canadá',
    'chile' => 'Chile', 'china' => 'China', 'colombia' => 'Colômbia',
    'cuba' => 'Cuba', 'egito' => 'Egito', 'equador' => 'Equador',
    'espanha' => 'Espanha', 'franca' => 'França', 'haiti' => 'Haiti',
    'honduras' => 'Honduras', 'italia' => 'Itália', 'iemen' => 'Iêmen',
    'japao' => 'Japão', 'mexico' => 'México', 'mocambique' => 'Moçambique',
    'nigeria' => 'Nigéria', 'noruega' => 'Noruega', 'paraguai' => 'Paraguai',
    'peru' => 'Peru', 'polonia' => 'Polônia', 'portugal' => 'Portugal',
    'republica tcheca' => 'República Tcheca', 'romenia' => 'Romênia',
    'russia' => 'Rússia', 'suecia' => 'Suécia', 'suica' => 'Suíça',
    'uruguai' => 'Uruguai', 'venezuela' => 'Venezuela',
    'cabo verde' => 'Cabo Verde', 'guine-bissau' => 'Guiné-Bissau',
    'coreia do sul' => 'Coreia do Sul', 'india' => 'Índia',
    'irlanda' => 'Irlanda', 'israel' => 'Israel', 'dinamarca' => 'Dinamarca',
    'finlandia' => 'Finlândia', 'belgica' => 'Bélgica', 'turquia' => 'Turquia',
    'somalilandia' => 'Somalilândia', 'bangladesh' => 'Bangladesh',
    // Formas longas, cidade no lugar do país e erro de digitação da fonte.
    // Levantados em 17/08/2026 ao medir a cobertura do mapa: cada um destes
    // era um país que existe na tabela de coordenadas mas não era alcançado,
    // então ficava fora do mapa sem que nada acusasse.
    'paises baixos' => 'Holanda',
    'inglaterra' => 'Reino Unido',
    'gra bretanha' => 'Reino Unido',
    'republica bolivariana de venezuela' => 'Venezuela',
    'republica do peru' => 'Peru',
    'republica arabe da siria' => 'Síria',
    'siria' => 'Síria',
    'cochabamba bolivia' => 'Bolívia',
    'cochabamba - bolivia' => 'Bolívia',
    'paraguayl' => 'Paraguai',   // erro de digitação do próprio Boletim
    'republica dominicana' => 'República Dominicana',
    'porto rico' => 'Porto Rico',
    'malta' => 'Malta', 'haiti' => 'Haiti', 'iemen' => 'Iêmen',
    ];
    return $p;
}
