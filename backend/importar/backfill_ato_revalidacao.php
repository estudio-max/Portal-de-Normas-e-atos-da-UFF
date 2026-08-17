<?php
// ============================================================================
//  backfill_ato_revalidacao.php — recupera o HISTÓRICO de revalidações.
//
//  POR QUE ISTO EXISTE
//  O extrator passou a capturar revalidação em 16/08/2026, mas ele só roda
//  sobre os boletins que o pipeline tem em cache — cerca de um ano. Os atos
//  antigos já estão no banco e entraram antes disso, então não têm linha em
//  `ato_revalidacao`. Resultado medido em produção: a aba abriu com 95 pedidos
//  quando a busca por "revalidação" encontra 669 atos no acervo.
//
//  E POR QUE NÃO PRECISA REPROCESSAR PDF
//  O importador guarda o corpo do ato em `ato_texto`. Confirmado em produção:
//  a busca por "junto a Universidad" — frase que só existe no Art. 1º, nunca
//  na ementa — devolve 447 atos. O dispositivo está no banco.
//
//  ⚠️ O TEXTO ESTÁ EM MINÚSCULAS, e isso é a armadilha central deste script.
//  Apesar do nome, `ato_texto.texto_original` NÃO é o texto original: o
//  importador grava nas duas colunas o mesmo `textoBusca`, que é o corpo já
//  passado por lower() e cortado em 7.000 caracteres (ver importar_v2.php,
//  onde `$texto` alimenta `:t` e `:t2`). Sem tratar isso, o histórico entraria
//  como "universidad de los andes / venezuela" e NÃO se juntaria ao
//  "Universidad de los Andes / Venezuela" que o pipeline diário grava — o
//  mesmo país viraria duas fatias do gráfico, que é exatamente o defeito que a
//  canonização de país existe para evitar.
//
//  Uso (navegador, protegido por token):
//    https://SEU_SITE/importar/backfill_ato_revalidacao.php?token=SEU_TOKEN
//  Uso (CLI):
//    php backfill_ato_revalidacao.php
//
//  NÃO apaga o que o import diário gravou: faz upsert por `ato_id`, e as
//  linhas do pipeline (que vêm com maiúsculas corretas) são reescritas com o
//  mesmo conteúdo. Rodar duas vezes é seguro.
// ============================================================================
$raiz = dirname(__DIR__);
require_once $raiz . '/api/db.php';

$cfg = carregar_config();
$cli = (PHP_SAPI === 'cli');
if (!$cli) {
    header('Content-Type: text/plain; charset=utf-8');
    $token = $cfg['import_token'] ?? '';
    if ($token === '' || !hash_equals($token, (string)($_GET['token'] ?? ''))) {
        http_response_code(403);
        exit("Acesso negado. Use ?token=...\n");
    }
}
function log_($m) { echo $m . "\n"; @flush(); }

// MODO DIAGNÓSTICO — `&diagnostico=1` (ou `php ... --diagnostico`).
//
// Existe porque não dá para saber, de fora, se 245 é o total ou metade dele.
// A busca do portal NÃO serve de denominador: procurar a frase exata
// "Revalidação do Diploma" devolve 20 atos, enquanto este mesmo script casou
// 135 de graduação com um regex que exige essa frase. As duas coisas não podem
// estar certas — a busca por frase não varre o corpo como se supunha.
//
// Então em vez de estimar, este modo MOSTRA: lista os candidatos que parecem
// decisão (têm "deferir/indeferir" perto de "revalidação/reconhecimento") e
// mesmo assim não casaram padrão nenhum. Se vierem redações antigas
// reconhecíveis, acrescenta-se o padrão; se vier só designação de comitê e
// edital, então 245 É o número real.
//
// NÃO GRAVA NADA neste modo — é seguro rodar a qualquer hora.
$diagnostico = $cli
    ? in_array('--diagnostico', $argv ?? [], true)
    : (($_GET['diagnostico'] ?? '') !== '');

$pdo = conectar($cfg);

// ---------------------------------------------------------------------------
// Os dois padrões do dispositivo. Espelham extrai_revalidacao() do
// tools/extrair_boletim.py — se um mudar lá, muda aqui. São duas famílias com
// redações incompatíveis: a pós usa "na" e não "junto a", e põe o país entre
// parênteses junto da cidade.
//
// `u` (unicode) + `i` (maiúsculas/minúsculas) porque o texto do banco está em
// caixa baixa e com acento.
// ---------------------------------------------------------------------------
// Generalizado em 17/08/2026 a partir do modo diagnóstico, que revelou TRÊS
// redações antigas que a forma moderna não cobria. Todas reais, do acervo:
//
//   2013-15  "decide: 1- indeferir O PEDIDO de revalidação do diploma,
//             NÍVEL DE GRADUAÇÃO EM medicina, obtido por FULANO, junto a
//             universidad del norte, paraguai, nos termos..."
//   sem nível "indeferir o pedido de revalidação DO DIPLOMA DE licenciado em
//             informática de gestão, obtido por FULANO, junto AO instituto
//             politecnico de coimbra, portugal..."
//   2008-14  "decide HOMOLOGAR a revalidação do diploma de 'doctor of
//             philosophy', obtido por FULANA, NA university of california,
//             los angeles, estados unidos da américa, COMO EQUIVALENTE AO DE
//             doutor em letras"
//
// O que varia, e por isso virou alternativa em vez de regex nova: o verbo
// (deferir/indeferir/homologar), o objeto ("a solicitação de" / "o pedido de"
// / nada), a forma do nível ("nível Graduação de" / "nível de graduação em" /
// ausente), e a preposição da origem ("junto a" / "junto ao" / "na").
//
// A VIA não é decidida por qual regex casou — é decidida pela evidência: se o
// ato declara equivalência a doutor/mestre, é pós-graduação, mesmo escrito
// como "revalidação do diploma". Foi o caso do "doctor of philosophy ... como
// equivalente ao de doutor em letras", que a leitura ingênua classificaria
// como graduação.
$RE_GRAD = '/(?P<decisao>defer|indefer|homolog)\w*\s+'
         . '(?:a\s+solicita[çc][ãa]o\s+de\s+|o\s+pedido\s+de\s+|a\s+)?'
         . 'revalida[çc][ãa]o\s+do\s+diploma\s*'
         . '(?:,?\s*n[íi]vel\s+(?:de\s+)?(?P<nivel>gradua[çc][ãa]o|mestrado|doutorado)\s*(?:em|de)?\s*)?'
         . '(?:de\s+)?(?P<curso>[^,]{0,180}?)\s*,\s*obtid[oa]\s+por\s+.+?,\s*'
         . '(?:junto\s+[aà]o?s?|n[ao]s?)\s+(?P<origem>.+?)'
         . '(?:,\s*nos\s+termos|,\s*como\s+equivalente\s+ao\s+de\s+(?P<equiv>[^,.]{0,80})|\.\s|$)/iu';

$RE_POS  = '/(?P<decisao>deferir|indeferir)\s+a\s+solicita[çc][ãa]o\s+de\s+'
         . 'reconhecimento\s+do\s+t[íi]tulo\s+de\s+(?P<curso>.+?),\s*'
         . 'obtid[oa]\s+por\s+.+?,\s*'
         . 'n[ao]s?\s+(?P<inst>.+?)\s*\((?P<local>[^)]{3,60})\)\s*,?\s*'
         . '(?:como\s+equivalente\s+ao\s+de\s+(?P<equiv>.+?))?[,.]/iu';

// Oração relativa: "...a Resolução X, QUE deferiu..." descreve o ato CITADO.
$RE_QUE = '/\bque\s*$/iu';

// Canonização de país. Chave = nome sem acento e em minúsculas, para casar
// tanto o texto do banco (caixa baixa) quanto as variantes e o erro de
// digitação da fonte ("Aústria"). O VALOR é o nome próprio canônico, igual ao
// de coop_paises() — é ele que garante que o histórico se junte ao que o
// pipeline diário grava, em vez de virar uma fatia separada no gráfico.
$PAIS_CANON = [
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
];

function dobra(string $s): string {
    $s = mb_strtolower(trim($s), 'UTF-8');
    $s = strtr($s, [
        'á'=>'a','à'=>'a','ã'=>'a','â'=>'a','ä'=>'a','é'=>'e','ê'=>'e','è'=>'e',
        'í'=>'i','ì'=>'i','î'=>'i','ó'=>'o','ô'=>'o','õ'=>'o','ò'=>'o','ö'=>'o',
        'ú'=>'u','ù'=>'u','û'=>'u','ü'=>'u','ç'=>'c','ñ'=>'n',
    ]);
    return preg_replace('/\s+/', ' ', $s);
}

/** Nome próprio a partir de texto em caixa baixa. "universidad de los andes"
 *  -> "Universidad de los Andes". Preposições e artigos ficam minúsculos, como
 *  manda a grafia de nome próprio nas línguas do corpus. */
function caixa_nome(string $s): string {
    $s = preg_replace('/\s+/u', ' ', trim($s));
    if ($s === '') return '';
    $minusculas = ['de','da','do','das','dos','del','della','di','du','e','y',
                   'la','le','les','las','los','el','a','o','of','the','and',
                   'van','von','zu','der','den','för','för'];
    $palavras = explode(' ', $s);
    $saida = [];
    foreach ($palavras as $i => $p) {
        $limpa = dobra($p);
        // Sigla curta toda junta (uff, unam) vira maiúscula inteira só quando
        // já vinha assim seria impossível saber — o texto está todo em caixa
        // baixa. Então NÃO se adivinha sigla: capitaliza como palavra comum.
        if ($i > 0 && in_array($limpa, $minusculas, true)) { $saida[] = $limpa; continue; }
        $saida[] = mb_convert_case($p, MB_CASE_TITLE, 'UTF-8');
    }
    return implode(' ', $saida);
}

function pais_canon(string $bruto, array $mapa): string {
    $p = trim($bruto, " \t\n\r\0\x0B.,;");
    if ($p === '' || mb_strlen($p) > 40) return '';
    $k = dobra($p);
    if (isset($mapa[$k])) return $mapa[$k];
    // Não está na lista: devolve capitalizado, para pelo menos não poluir o
    // gráfico com caixa baixa. Fica visível para curadoria depois.
    return caixa_nome($p);
}

// ---------------------------------------------------------------------------
// Só os candidatos: filtro barato no SQL antes do regex caro.
// ---------------------------------------------------------------------------
$sql = "SELECT a.id, t.texto_original AS txt
          FROM ato a
          JOIN ato_texto t ON t.ato_id = a.id
         WHERE t.texto_original LIKE '%revalida%'
            OR t.texto_original LIKE '%reconhecimento do t%'";
$st = $pdo->query($sql);

$insere = $pdo->prepare(
    "INSERT INTO ato_revalidacao (ato_id,via,decisao,nivel,curso,instituicao,pais)
     VALUES (:id,:v,:d,:n,:c,:i,:p)
     ON DUPLICATE KEY UPDATE via=VALUES(via), decisao=VALUES(decisao),
       nivel=VALUES(nivel), curso=VALUES(curso),
       instituicao=VALUES(instituicao), pais=VALUES(pais)");

$vistos = 0; $gravados = 0; $porVia = []; $semPais = 0; $suspeitos = [];
while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
    $vistos++;
    $txt = preg_replace('/\s+/u', ' ', (string)$row['txt']);

    $achou = null;
    foreach ([['Graduação', $RE_GRAD], ['Pós-graduação', $RE_POS]] as [$via, $re]) {
        if (!preg_match($re, $txt, $m, PREG_OFFSET_CAPTURE)) continue;
        $ini = $m[0][1];
        if (preg_match($RE_QUE, mb_substr($txt, max(0, $ini - 10), 10))) continue;

        $g = fn($k) => isset($m[$k]) ? trim($m[$k][0]) : '';
        if ($via === 'Graduação') {
            $partes = array_values(array_filter(array_map('trim', explode(',', $g('origem'))), 'strlen'));
            $pais = count($partes) >= 2 ? pais_canon(end($partes), $PAIS_CANON) : '';
            $inst = count($partes) >= 2 ? implode(', ', array_slice($partes, 0, -1)) : $g('origem');
            $nivel = mb_convert_case($g('nivel'), MB_CASE_TITLE, 'UTF-8');

            // A EQUIVALÊNCIA MANDA MAIS QUE A PALAVRA "DIPLOMA".
            // "homologar a revalidação do diploma de 'doctor of philosophy' …
            //  como equivalente ao de doutor em letras" é pós-graduação, ainda
            // que escrito com o vocabulário da graduação. Classificar pelo
            // texto que casou, e não pelo que o ato AFIRMA, poria doutorados
            // na conta da graduação e estragaria as duas taxas.
            $eq = $g('equiv');
            if (preg_match('/doutor/iu', $eq)) { $via = 'Pós-graduação'; $nivel = 'Doutorado'; }
            elseif (preg_match('/mestr/iu', $eq)) { $via = 'Pós-graduação'; $nivel = 'Mestrado'; }
            elseif ($nivel !== '' && preg_match('/^(Doutorado|Mestrado)$/u', $nivel)) { $via = 'Pós-graduação'; }
            elseif ($nivel === '') { $nivel = 'Graduação'; }
        } else {
            $loc = array_values(array_filter(array_map('trim', explode(',', $g('local'))), 'strlen'));
            $pais = $loc ? pais_canon(end($loc), $PAIS_CANON) : '';
            $inst = $g('inst');
            $eq = $g('equiv');
            $nivel = preg_match('/doutor/iu', $eq) ? 'Doutorado'
                   : (preg_match('/mestr/iu', $eq) ? 'Mestrado' : '');
        }
        $achou = [
            'via' => $via,
            'decisao' => (stripos($g('decisao'), 'indefer') === 0) ? 'Indeferido' : 'Deferido',
            'nivel' => $nivel,
            'curso' => mb_substr(caixa_nome($g('curso')), 0, 180),
            'inst'  => mb_substr(caixa_nome($inst), 0, 180),
            'pais'  => $pais,
        ];
        break;
    }
    if (!$achou) {
        // Parece decisão e não casou? Guarda para o relatório.
        // O teste é deliberadamente FROUXO: verbo decisório a até ~120
        // caracteres de "revalida"/"reconhecimento do t". Frouxo de propósito
        // — o objetivo aqui é achar redação que eu não conheço, então errar
        // para o lado de mostrar demais é melhor que filtrar cedo e concluir
        // que não há nada.
        if (preg_match('/\b(defer\w+|indefer\w+|homolog\w+|revalid\w+)\b.{0,120}?'
                     . '(revalida|reconhecimento do t)|'
                     . '(revalida|reconhecimento do t).{0,120}?\b(defer\w+|indefer\w+|homolog\w+)\b/iu',
                       $txt, $mm, PREG_OFFSET_CAPTURE)) {
            $ini = max(0, $mm[0][1] - 40);
            $suspeitos[] = [$row['id'], mb_substr($txt, $ini, 230)];
        }
        continue;
    }

    if ($diagnostico) { $gravados++; $porVia[$achou['via']] = ($porVia[$achou['via']] ?? 0) + 1; continue; }

    $insere->execute([
        ':id' => $row['id'], ':v' => $achou['via'], ':d' => $achou['decisao'],
        ':n' => $achou['nivel'] ?: null, ':c' => $achou['curso'] ?: null,
        ':i' => $achou['inst'] ?: null, ':p' => $achou['pais'] ?: null,
    ]);
    $gravados++;
    $porVia[$achou['via']] = ($porVia[$achou['via']] ?? 0) + 1;
    if ($achou['pais'] === '') $semPais++;
}

log_($diagnostico ? "=== MODO DIAGNÓSTICO — nada foi gravado ===" : "");
log_("candidatos lidos : $vistos");
log_(($diagnostico ? "casariam         : " : "gravados         : ") . $gravados);
foreach ($porVia as $v => $n) log_("  $v: $n");
if (!$diagnostico) log_("sem país         : $semPais");

// ---------------------------------------------------------------------------
// O relatório: quem parece decisão e não casou.
// ---------------------------------------------------------------------------
log_("");
log_("parecem decisão e NÃO casaram: " . count($suspeitos));
if ($suspeitos) {
    $mostrar = $diagnostico ? 25 : 5;
    log_("(amostra de até $mostrar — o trecho começa 40 caracteres antes do verbo)");
    log_("");
    foreach (array_slice($suspeitos, 0, $mostrar) as [$id, $trecho]) {
        log_("  ato #$id");
        log_("    …" . preg_replace('/\s+/u', ' ', $trecho) . "…");
    }
    if (!$diagnostico && count($suspeitos) > 5) {
        log_("");
        log_("  Rode com &diagnostico=1 para ver mais e entender se são");
        log_("  redações antigas (que faltam padrão) ou só designação de comitê");
        log_("  e edital, que corretamente não viram decisão.");
    }
} else {
    log_("  Nenhum. Todo candidato que parece decisão foi capturado —");
    log_("  o que sobrou no filtro são atos que só mencionam a palavra.");
}
log_("");

if ($diagnostico) {
    log_("Nada gravado (diagnóstico). Rode sem &diagnostico=1 para aplicar.");
    exit;
}

$tot = (int)$pdo->query("SELECT COUNT(*) FROM ato_revalidacao")->fetchColumn();
log_("ato_revalidacao agora com $tot linha(s).");

// O painel é rota cacheada — sem limpar, a aba continua mostrando o número
// antigo por até 10 minutos e parece que o backfill não funcionou.
$cacheDir = dirname(__DIR__) . '/api/cache';
$n = 0;
foreach (glob($cacheDir . '/*') ?: [] as $f) {
    if (is_file($f) && basename($f) !== '.htaccess') { @unlink($f); $n++; }
}
log_("Cache da API invalidado: $n arquivo(s).");
