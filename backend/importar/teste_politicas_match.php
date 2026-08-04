<?php
// ============================================================================
//  teste_politicas_match.php — regressão do vínculo ato<->política.
//
//  Uso:  php backend/importar/teste_politicas_match.php     (sai 1 se quebrou)
//
//  CADA CASO AQUI É UM DEFEITO QUE JÁ ESTEVE EM PRODUÇÃO ou que a medição do
//  seed pegou. Não são exemplos ilustrativos.
//
//  O painel de políticas é dossiê: ele afirma que um ato construiu uma política
//  e diz qual papel cumpriu. Rótulo errado aqui não é imprecisão de contagem —
//  é atribuir a uma política um ato que não é dela, ou chamar de "ato fundador"
//  uma cartilha. Falso-negativo se conserta com um termo novo; falso-positivo
//  estraga o dossiê.
// ============================================================================
require_once __DIR__ . '/politicas_match.php';

$falhas = 0; $ok = 0;

function slugs(array $lin): array {
    return array_map(fn($l) => $l['politica'], $lin);
}

/** O ato NÃO pode gerar vínculo com $slug (ou com nada, se $slug = null). */
function recusa(string $rotulo, string $ementa, ?string $slug = null, string $sigla = ''): void {
    global $falhas, $ok;
    $lin = politicas_do_ato($ementa, $sigla);
    $s = slugs($lin);
    $achou = $slug === null ? count($lin) > 0 : in_array($slug, $s, true);
    if ($achou) {
        echo "FALHA  [$rotulo] deveria recusar" . ($slug ? " '$slug'" : ' tudo')
           . ', veio: ' . (implode(',', $s) ?: '(nada)') . "\n";
        $falhas++;
    } else { $ok++; }
}

/** O ato tem que gerar vínculo com $slug, opcionalmente com $papel e $conf. */
function aceita(string $rotulo, string $ementa, string $slug,
                ?string $papel = null, ?string $conf = null, string $sigla = ''): void {
    global $falhas, $ok;
    $lin = politicas_do_ato($ementa, $sigla);
    $casadas = array_values(array_filter($lin, fn($l) => $l['politica'] === $slug));
    if (!$casadas) {
        echo "FALHA  [$rotulo] deveria aceitar '$slug', veio: "
           . (implode(',', slugs($lin)) ?: '(nada)') . "\n";
        $falhas++; return;
    }
    if ($papel !== null && $casadas[0]['papel'] !== $papel) {
        echo "FALHA  [$rotulo] papel deveria ser '$papel', veio '{$casadas[0]['papel']}'\n";
        $falhas++; return;
    }
    if ($conf !== null && $casadas[0]['confianca'] !== $conf) {
        echo "FALHA  [$rotulo] confiança deveria ser '$conf', veio '{$casadas[0]['confianca']}'\n";
        $falhas++; return;
    }
    $ok++;
}

// ---------------------------------------------------------------------------
// 1. O TERMO NO NOME DE QUEM ASSINA — a armadilha-mãe da METODOLOGIA-ODS,
//    reaparecendo aqui. O CGIRC abre seus atos com "O COMITÊ DE GOVERNANÇA,
//    INTEGRIDADE, RISCOS E CONTROLES...", e isso entra na ementa capturada.
//    Medido: `integridade` solto trazia três atos que não são de integridade.
// ---------------------------------------------------------------------------
recusa('CGIRC assina plano socioambiental — não é integridade',
    'Aprova o Plano de Gestão Socioambiental da Agenda Ambiental na Administração Pública. '
  . 'O COMITÊ DE GOVERNANÇA, INTEGRIDADE, RISCOS E CONTROLES da UFF, no uso de suas atribuições, decide:',
    'integridade-riscos');

recusa('CGIRC assina Bem Viver — não é integridade',
    'Aprova e institui o Programa Bem Viver UFF. O COMITÊ DE GOVERNANÇA, INTEGRIDADE, '
  . 'RISCOS E CONTROLES da UFF decide:',
    'integridade-riscos');

// E o verdadeiro tem que continuar entrando.
aceita('plano de integridade de verdade',
    'Aprova o Programa e Plano de Integridade 2025-2027 no âmbito da UFF.',
    'integridade-riscos');

// ---------------------------------------------------------------------------
// 2. O EMISSOR COMO SEGUNDO SINAL. A ementa não diz "assistência estudantil";
//    quem diz é a PROAES. 24 dos 37 atos entram só por aqui.
// ---------------------------------------------------------------------------
aceita('PROAES sem a frase — entra pelo emissor',
    'Fixa as diretrizes para a execução do Programa Auxílio Alimentação para Estudantes Ingressantes.',
    'assistencia-estudantil', 'execucao', 'media', 'PROAES');

// Com a frase, a confiança é alta e o emissor não duplica a linha.
aceita('frase presente — confiança alta',
    'Modifica e fixa as diretrizes para execução do Programa Auxílio Acolhimento para Estudantes.',
    'assistencia-estudantil', 'alteracao', 'alta', 'PROAES');

recusa('emissor desconhecido não inventa vínculo',
    'Designa servidor para exercer função gratificada.', null, 'PROGEPE');

// ---------------------------------------------------------------------------
// 3. O PAPEL. Trocar o papel muda a faixa de etapas do cartão e, adiante, o
//    indicador de maturidade.
// ---------------------------------------------------------------------------
// Cartilha NÃO funda política — apareceu como ato fundador de acessibilidade
// em produção, e foi o primeiro defeito de curadoria que o painel exibiu.
aceita('cartilha é regulamentação, não fundação',
    'Institui a Cartilha de acessibilidade atitudinal para o sistema de arquivos da UFF.',
    'acessibilidade', 'regulamentacao');

// Plano É instrumento fundador. Com `plano de` em monitoramento, a política de
// assédio nascia sem ato fundador nenhum.
aceita('plano de enfrentamento funda a política',
    'Aprovação do Plano de Enfrentamento ao Assédio e Discriminação.',
    'assedio', 'fundador');

// Designar comissão é GOVERNANÇA. Sem isso, política com dez designações e
// nenhuma entrega apareceria como a mais ativa de todas.
aceita('designação é governança, não execução',
    'Designa membros para compor a Comissão Permanente de Sustentabilidade da UFF.',
    'sustentabilidade', 'governanca');

aceita('relatório é monitoramento',
    'Aprova o Relatório Anual de Gestão de Riscos referente ao exercício de 2025.',
    'integridade-riscos', 'monitoramento');

// ---------------------------------------------------------------------------
// 4. EFEITO INDIVIDUAL. Sindicância apura caso concreto — regra de privacidade,
//    não de relevância. Quatro saíram do seed por aqui.
// ---------------------------------------------------------------------------
recusa('sindicância de assédio não entra',
    'Designa Comissão Local de Sindicância para apurar denúncias de suposto assédio moral.');

recusa('processo disciplinar não entra',
    'Instaura processo administrativo disciplinar para apurar os fatos narrados.');

// ---------------------------------------------------------------------------
// 5. EMENTA INUTILIZÁVEL. 15 dos 136 atos do seed caíram aqui. Casar frase
//    nesses é loteria; vão para curadoria.
// ---------------------------------------------------------------------------
recusa('OCR espaçado não recebe rótulo',
    'C o n s t i t u i a C o m i s s ã o d e A c e s s i b i l i d a d e d a U F F p a r a');

recusa('rodapé de boletim não recebe rótulo',
    'BS - - SEÇÃO II, págs. 121 a 134. Publique-se, registre-se e cumpra-se.');

recusa('fragmento que abre em minúscula não recebe rótulo',
    'que trata da política de acessibilidade e inclusão da UFF, conforme o disposto');

recusa('ementa vazia não recebe rótulo', '');

// ---------------------------------------------------------------------------
// 6. UM ATO PODE PERTENCER A DUAS POLÍTICAS — é caso previsto no projeto.
// ---------------------------------------------------------------------------
$lin = politicas_do_ato(
    'Fixa as diretrizes para execução do Programa de Políticas Afirmativas: auxílio para '
  . 'estudantes com deficiência, no âmbito da assistência estudantil.', 'PROAES');
$s = slugs($lin);
if (count(array_intersect(['assistencia-estudantil', 'acoes-afirmativas', 'acessibilidade'], $s)) >= 2) {
    $ok++;
} else {
    echo 'FALHA  [ato em duas políticas] esperava ao menos duas, veio: ' . implode(',', $s) . "\n";
    $falhas++;
}

// ---------------------------------------------------------------------------
echo "\n$ok caso(s) OK, $falhas falha(s) — politicas_match.php\n";
exit($falhas > 0 ? 1 : 0);
