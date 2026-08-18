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
//  ⚠️ O TEXTO DEIXOU DE SER MINÚSCULO em 17/08/2026, e isso INVERTEU a
//  armadilha central deste script. Até então o importador gravava `textoBusca`
//  nas duas colunas, e `ato_texto.texto_original` não era o original: vinha em
//  caixa baixa e cortado em 7.000 caracteres. Hoje ele é o texto de verdade,
//  com a caixa preservada e o teto em 40.000.
//
//  O QUE ISSO MUDA AQUI: os padrões seguem com `i`, então casam igual; mas o
//  `revalidacao_caixa_nome()` foi escrito para RECONSTRUIR nome próprio a
//  partir de caixa baixa, e agora recebe texto que já vem certo. Ele continua
//  porque as linhas ANTIGAS do banco seguem minúsculas até serem reescritas —
//  e porque aplicá-lo a texto já correto é inofensivo. Se um dia todo o acervo
//  tiver sido reimportado, este é o primeiro código a poder sair.
//
//  O que NÃO mudou é o motivo de a canonização de país existir: sem ela o mesmo
//  país vira duas fatias do gráfico.
//
//  Uso (navegador, protegido por token):
//    https://SEU_SITE/importar/backfill_ato_revalidacao.php?token=SEU_TOKEN
//  Uso (CLI):
//    php backfill_ato_revalidacao.php
//
//  Sincroniza todas as linhas de cada ato reconhecido. As linhas existentes
//  desse ato são substituídas na ordem documental, então rodar duas vezes é
//  seguro.
// ============================================================================
$raiz = dirname(__DIR__);
require_once $raiz . '/api/db.php';
require_once __DIR__ . '/revalidacao_lista_legada.php';
require_once __DIR__ . '/revalidacao_sincronizacao.php';
require_once __DIR__ . '/revalidacao_campos.php';   // limpeza de curso/instituição/país

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
// `aprov` entrou em 17/08/2026: o CEPEx DEFERE escrevendo "Aprovar a
// revalidacao do Diploma", e nenhum dos dois caminhos de escrita tinha esse
// verbo. Medido no acervo local: 511 deferimentos invisiveis entre 2010 e
// 2022, contra 696 vistos. O painel publicava 0% em anos inteiros.
$RE_GRAD = '/(?P<decisao>aprov|defer|indefer|homolog)\w*\s+'
         . '(?:a\s+solicita[çc][ãa]o\s+de\s+|o\s+pedido\s+de\s+|a\s+)?'
         // "do diploma" OU "do título": o Conselho escreve das duas formas, e
         // exigir só "diploma" deixava fora ato real — caso #324/2005,
         // "homologar a revalidação do Título de Máster Degree obtido pela
         // Professora …, na Universidade de Leiden, Holanda". Conferido contra
         // o texto ARMAZENADO, não contra o trecho limpo do relatório: foi
         // testando com o trecho limpo que eu concluí, antes, que o extrator
         // já cobria este caso — e não cobria.
         . 'revalida[çc][ãa]o\s+d[oe]\s+(?:diploma|t[íi]tulo)\s*'
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

// A tabela de canonização de país vive em `revalidacao_campos.php`: o teste
// precisa da MESMA tabela, e uma cópia reduzida dentro do teste o fazia
// passar contra uma realidade que não existe — foi assim que 'França' e
// 'Peru' escaparam da limpeza de instituição na primeira tentativa.
$PAIS_CANON = revalidacao_paises_canon();


/** Nome próprio a partir de texto em caixa baixa. "universidad de los andes"
 *  -> "Universidad de los Andes". Preposições e artigos ficam minúsculos, como
 *  manda a grafia de nome próprio nas línguas do corpus. */


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
    "INSERT INTO ato_revalidacao (ato_id,ordem,via,decisao,nivel,curso,instituicao,pais)
     VALUES (:id,:o,:v,:d,:n,:c,:i,:p)");
$remove = $pdo->prepare('DELETE FROM ato_revalidacao WHERE ato_id=?');
$removeAto = static fn(int|string $atoId): bool => $remove->execute([$atoId]);
$insereAto = static function (int|string $atoId, int $ordem, array $achou) use ($insere): void {
    $insere->execute([
        ':id' => $atoId, ':o' => $ordem,
        ':v' => $achou['via'], ':d' => $achou['decisao'],
        ':n' => $achou['nivel'] ?: null, ':c' => $achou['curso'] ?: null,
        ':i' => $achou['instituicao'] ?: null, ':p' => $achou['pais'] ?: null,
    ]);
};

$vistos = 0; $gravados = 0; $porVia = []; $semPais = 0; $suspeitos = [];
while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
    $vistos++;
    $txt = preg_replace('/\s+/u', ' ', (string)$row['txt']);

    $achados = extrair_revalidacoes_lista_legada($txt);
    if (!$achados) {
        $achou = null;
        foreach ([['Graduação', $RE_GRAD], ['Pós-graduação', $RE_POS]] as [$via, $re]) {
            if (!preg_match($re, $txt, $m, PREG_OFFSET_CAPTURE)) continue;
            $ini = $m[0][1];
            if (preg_match($RE_QUE, mb_substr($txt, max(0, $ini - 10), 10))) continue;

            $g = fn($k) => isset($m[$k]) ? trim($m[$k][0]) : '';
            if ($via === 'Graduação') {
                $partes = array_values(array_filter(array_map('trim', explode(',', $g('origem'))), 'strlen'));
                // Origem SEM vírgula pode ser o próprio país ("…obtido por
                // Fulano, na Argentina"): antes isso virava instituição
                // "Argentina", que é erro, e não lacuna.
                $pais = revalidacao_pais_canon(end($partes), $PAIS_CANON);
                $inst = count($partes) >= 2
                    ? revalidacao_limpa_instituicao(implode(', ', array_slice($partes, 0, -1)), $PAIS_CANON)
                    : revalidacao_limpa_instituicao($g('origem'), $PAIS_CANON);
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
                $pais = $loc ? revalidacao_pais_canon(end($loc), $PAIS_CANON) : '';
                $inst = revalidacao_limpa_instituicao($g('inst'), $PAIS_CANON);
                $eq = $g('equiv');
                $nivel = preg_match('/doutor/iu', $eq) ? 'Doutorado'
                       : (preg_match('/mestr/iu', $eq) ? 'Mestrado' : '');
            }
            $achou = [
                'via' => $via,
                'decisao' => (stripos($g('decisao'), 'indefer') === 0) ? 'Indeferido' : 'Deferido',
                'nivel' => $nivel,
                // `revalidacao_limpa_campo` ANTES do `caixa_nome`: é ela que
                // tira a preposição e as aspas de embrulho que a fonte cola no
                // valor ("em Medicina", "“Doctor of Philosophy”"). Sem isso a
                // mesma coisa virava duas fatias do gráfico — "Medicina" com
                // 306 pedidos e "Em Medicina" com outros 275.
                'curso' => mb_substr(revalidacao_caixa_nome(revalidacao_limpa_campo($g('curso'))), 0, 180),
                'instituicao' => mb_substr($inst === '' ? '' : revalidacao_caixa_nome($inst), 0, 180),
                'pais' => $pais,
            ];
            break;
        }
        if ($achou) $achados = [$achou];
    }
    if (!$achados) {
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

    sincronizar_revalidacoes_ato(
        $pdo, $row['id'], $achados, $diagnostico,
        $removeAto, $insereAto
    );
    foreach ($achados as $achou) {
        $gravados++;
        $porVia[$achou['via']] = ($porVia[$achou['via']] ?? 0) + 1;
        if (!$diagnostico && $achou['pais'] === '') $semPais++;
    }
}

log_($diagnostico ? "=== MODO DIAGNÓSTICO — nada foi gravado ===" : "");
log_("atos candidatos lidos : $vistos");
log_(($diagnostico ? "pedidos que casariam  : " : "pedidos gravados      : ") . $gravados);
log_("pedidos por via:");
foreach ($porVia as $v => $n) log_("  $v: $n");
if (!$diagnostico) log_("pedidos sem país      : $semPais");

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

// ---------------------------------------------------------------------------
// TRUNCAGEM — a medição que decide se este backfill é fonte confiável.
//
// `ato_texto` guarda o corpo cortado no teto do extrator. Num ato longo, o
// Art. 1º pode estar DEPOIS do corte — e aí ele não aparece aqui, sem nenhuma
// diferença visível entre "não é revalidação" e "não deu para ver". Para um
// número que vai a órgão de controle, essa diferença é a que mais importa.
//
// O teste: quantos candidatos estão exatamente no teto. Texto no teto é texto
// que FOI cortado — o original era maior.
//   - se poucos, e nenhum deles casaria, o corte não está escondendo decisão;
//   - se muitos, a origem precisa mudar: reprocessar os PDFs, que é mais
//     pesado e é a única forma de ver o ato inteiro.
//
// ⚠️ O TETO É PARÂMETRO, e ficou defasado uma vez — custou caro. Estava fixo em
// 6.990 quando o extrator passou a cortar em 40.000 (17/08/2026): a partir dali
// o teste contava TODO texto longo como truncado e passou a relatar 1.247 atos
// "em aberto", contra 628 antes, justamente quando o problema tinha sido
// resolvido. Um instrumento que piora quando a realidade melhora não mede nada
// — e era ele que precisava responder se ainda há decisão escondida, pergunta
// que autoriza remover o aviso de "série em consolidação" da tela.
//
// Se o teto do extrator mudar de novo, muda AQUI: `tools/extrair_boletim.py`,
// `corpo_texto = limpar(corpo)[:40000]`.
// ---------------------------------------------------------------------------
const REVALIDACAO_TETO_EXTRATOR = 40000;
$tetoMin = REVALIDACAO_TETO_EXTRATOR - 10;   // folga para a limpeza de espaços
$q = $pdo->query(
    "SELECT COUNT(*) AS n,
            SUM(CHAR_LENGTH(t.texto_original) >= $tetoMin) AS no_teto
       FROM ato a JOIN ato_texto t ON t.ato_id = a.id
      WHERE t.texto_original LIKE '%revalida%'
         OR t.texto_original LIKE '%reconhecimento do t%'")->fetch(PDO::FETCH_ASSOC);

$noTeto = (int)($q['no_teto'] ?? 0);
log_("=== truncagem do texto (limite de " . number_format(REVALIDACAO_TETO_EXTRATOR, 0, ',', '.') . " caracteres) ===");
log_("candidatos no teto : $noTeto de " . (int)$q['n']);

if ($noTeto > 0) {
    // Dos cortados, quantos JÁ foram capturados? Se um ato no teto casou, é
    // porque o dispositivo estava antes do corte — o risco só existe para os
    // cortados que NÃO casaram.
    $r2 = $pdo->query(
        "SELECT COUNT(DISTINCT CASE WHEN r.ato_id IS NOT NULL THEN a.id END) AS atos_capturados,
                COUNT(DISTINCT a.id) AS total_atos
           FROM ato a
           JOIN ato_texto t ON t.ato_id = a.id
           LEFT JOIN ato_revalidacao r ON r.ato_id = a.id
          WHERE CHAR_LENGTH(t.texto_original) >= $tetoMin
            AND (t.texto_original LIKE '%revalida%'
                 OR t.texto_original LIKE '%reconhecimento do t%')")->fetch(PDO::FETCH_ASSOC);
    $cap = (int)($r2['atos_capturados'] ?? 0);
    $tot = (int)($r2['total_atos'] ?? 0);
    log_("  destes, atos capturados : $cap");
    log_("  destes, atos em aberto   : " . ($tot - $cap) . "  <- é AQUI que pode haver decisão escondida");
    log_("");
    log_("  Em aberto acima de ~30, vale reprocessar os PDFs em vez do banco:");
    log_("  o corte pode estar escondendo o Art. 1º e não há como distinguir,");
    log_("  daqui, 'não é revalidação' de 'não deu para ver'.");
} else {
    log_("  Nenhum candidato encostou no teto — o corte do extrator");
    log_("  NÃO está escondendo dispositivo. O banco é fonte suficiente.");
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
