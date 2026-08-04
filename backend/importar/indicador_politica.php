<?php
// ============================================================================
//  indicador_politica.php — snapshot das ETAPAS de cada política.
//
//  Não produz nota. A nota do §8 do projeto foi simulada sobre os dados reais e
//  reprovada: com pontuação binária cinco das sete políticas empatam, a
//  assistência estudantil (38 atos) tira o mesmo que a acessibilidade (8), e o
//  assédio aparece como a menos madura justamente por ter o padrão mais nítido
//  do acervo. Além disso `monitoramento` e `avaliacao` quase não são emitidos
//  pelas regras de papel, o que deixa 25 dos 100 pontos inalcançáveis.
//
//  O que este arquivo guarda são CONTAGENS por etapa, num snapshot por
//  metodologia `etapas-v1`. Isso sustenta pergunta factual — "quando esta
//  política ganhou monitoramento?", "há quanto tempo não tem ato de execução?"
//  — sem arbitrar peso nenhum.
//
//  REGRA DE ESCRITA: só grava quando o vetor de etapas MUDA em relação ao
//  último snapshot daquela política. O import roda 2x/dia; gravar sempre criaria
//  730 linhas por política por ano, todas iguais, e a série deixaria de dizer
//  quando algo aconteceu — que é a única coisa que ela existe para dizer.
// ============================================================================

if (!function_exists('indicador_politica_versao')) {
    function indicador_politica_versao(): string { return 'etapas-v1'; }
}

if (!function_exists('indicador_politica_etapas')) {
    /** As etapas contadas, na ordem do ciclo. A chave é o papel em
     *  `ato_politica`; o valor é a coluna correspondente em
     *  `politica_indicador`.
     *
     *  `avaliacao` -> coluna `revisao`: a tabela nasceu com o nome do projeto
     *  (§5.7) e o vocabulário de papel usa `avaliacao`. Mapear em vez de
     *  renomear evita um ALTER numa coluna que já está no ar.
     */
    function indicador_politica_etapas(): array {
        return [
            'fundador'       => 'instituicao',
            'regulamentacao' => 'regulamentacao',
            'governanca'     => 'governanca',
            'execucao'       => 'execucao',
            'monitoramento'  => 'monitoramento',
            'avaliacao'      => 'revisao',
        ];
    }
}

if (!function_exists('indicador_politica_calcular')) {
    /** Vetor de etapas de UMA política, a partir das linhas de ato_politica.
     *
     * @param array $linhas  cada uma com ['papel','data_ato']
     * @return array colunas de politica_indicador + resumo
     */
    function indicador_politica_calcular(array $linhas): array {
        $col = [];
        foreach (indicador_politica_etapas() as $coluna) $col[$coluna] = 0;

        $ultimaPorEtapa = [];
        $ultima = null;
        foreach ($linhas as $l) {
            $papel = (string)($l['papel'] ?? '');
            $mapa = indicador_politica_etapas();
            if (isset($mapa[$papel])) {
                $col[$mapa[$papel]]++;
                $d = $l['data_ato'] ?? null;
                if ($d && (!isset($ultimaPorEtapa[$papel]) || $d > $ultimaPorEtapa[$papel])) {
                    $ultimaPorEtapa[$papel] = $d;
                }
            }
            $d = $l['data_ato'] ?? null;
            if ($d && ($ultima === null || $d > $ultima)) $ultima = $d;
        }

        // TINYINT UNSIGNED vai até 255. Nenhuma política chega perto, mas um
        // reprocessamento defeituoso poderia — e um overflow silencioso aqui
        // viraria série histórica mentirosa.
        foreach ($col as $k => $v) $col[$k] = min(255, $v);

        // `continuidade`: meses desde o ato mais recente. É o único campo que
        // muda sozinho com o tempo, então NÃO entra na comparação que decide se
        // grava snapshot — senão gravaria um por mês sem nada ter acontecido.
        $meses = 0;
        if ($ultima !== null) {
            $dif = (time() - strtotime($ultima)) / (86400 * 30.44);
            $meses = max(0, min(255, (int)floor($dif)));
        }

        return [
            'colunas' => $col,
            'continuidade' => $meses,
            'ultima' => $ultima,
            'resumo' => json_encode([
                'metodologia' => indicador_politica_versao(),
                'etapas' => $col,
                'ultimaPorEtapa' => $ultimaPorEtapa,
                'ultimaEvidencia' => $ultima,
                'nota' => 'sem escore: ver o cabeçalho de indicador_politica.php',
            ], JSON_UNESCAPED_UNICODE),
        ];
    }
}

if (!function_exists('indicador_politica_mudou')) {
    /** O vetor de etapas mudou em relação ao snapshot anterior?
     *
     * Compara SÓ as contagens por etapa. `continuidade` fica de fora de
     * propósito: ela cresce sozinha com o calendário, e incluí-la faria a série
     * ganhar uma linha por mês sem que nada tivesse acontecido na política.
     */
    function indicador_politica_mudou(array $colunas, ?array $anterior): bool {
        if ($anterior === null) return true;
        foreach ($colunas as $k => $v) {
            if ((int)($anterior[$k] ?? -1) !== (int)$v) return true;
        }
        return false;
    }
}

if (!function_exists('indicador_politica_atualizar')) {
    /** Recalcula e grava snapshot para TODAS as políticas que mudaram.
     *
     * Roda uma vez ao fim do import, não por ato: são 7 políticas e o custo é
     * irrelevante, mas rodar por ato gravaria snapshots intermediários que não
     * correspondem a estado nenhum.
     *
     * @return array [gravados, avaliados]
     */
    function indicador_politica_atualizar(PDO $pdo): array {
        $pols = $pdo->query("SELECT id, slug FROM politica")->fetchAll(PDO::FETCH_ASSOC);
        $stLinhas = $pdo->prepare("
            SELECT ap.papel, a.data_ato
              FROM ato_politica ap JOIN ato a ON a.id = ap.ato_id
             WHERE ap.politica_id = :id");
        $stUlt = $pdo->prepare("
            SELECT instituicao, regulamentacao, governanca, execucao,
                   monitoramento, revisao
              FROM politica_indicador
             WHERE politica_id = :id AND versao_metodologia = :v
          ORDER BY calculado_em DESC LIMIT 1");
        $ins = $pdo->prepare("
            INSERT INTO politica_indicador
              (politica_id, calculado_em, versao_metodologia,
               instituicao, regulamentacao, governanca, execucao,
               monitoramento, revisao, continuidade, resumo_calculo)
            VALUES (:id, NOW(), :v, :i, :r, :g, :e, :m, :rv, :c, :res)");

        $gravados = 0;
        foreach ($pols as $p) {
            $stLinhas->execute([':id' => $p['id']]);
            $calc = indicador_politica_calcular($stLinhas->fetchAll(PDO::FETCH_ASSOC));

            $stUlt->execute([':id' => $p['id'], ':v' => indicador_politica_versao()]);
            $anterior = $stUlt->fetch(PDO::FETCH_ASSOC) ?: null;
            if (!indicador_politica_mudou($calc['colunas'], $anterior)) continue;

            $c = $calc['colunas'];
            $ins->execute([
                ':id' => $p['id'], ':v' => indicador_politica_versao(),
                ':i' => $c['instituicao'], ':r' => $c['regulamentacao'],
                ':g' => $c['governanca'], ':e' => $c['execucao'],
                ':m' => $c['monitoramento'], ':rv' => $c['revisao'],
                ':c' => $calc['continuidade'], ':res' => $calc['resumo'],
            ]);
            $gravados++;
        }
        return [$gravados, count($pols)];
    }
}
