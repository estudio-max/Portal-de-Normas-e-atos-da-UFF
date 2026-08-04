<?php
// ============================================================================
//  politicas_match.php — dado o texto de um ato, a que POLÍTICA ele pertence e
//  que PAPEL cumpre nela. Chamado pelo import diário (importar_v2.php), para
//  que ato novo entre no dossiê no mesmo import em que entra no acervo.
//
//  Antes disto, `ato_politica` só era preenchida pelo seed offline: uma
//  instrução normativa da PROAES publicada hoje entrava no acervo, ganhava
//  vínculo de comissão e de ODS, e NÃO aparecia no dossiê de assistência
//  estudantil. Os vínculos eram uma foto que envelhecia em silêncio — a mesma
//  lacuna que o ODS teve até 03/08/2026.
//
//  O registro abaixo é uma CÓPIA do CATALOGO de tools/gerar_seed_politicas.py,
//  que também gera o seed. Os dois não devem divergir: ao editar um, gere o
//  outro. `teste_politicas_match.php` trava a divergência no CI.
//
//  ---------------------------------------------------------------------------
//  DOIS SINAIS, como nas comissões:
//    1. FRASE ESTRITA na ementa           -> confiança alta
//    2. ÓRGÃO EMISSOR, quando a ementa    -> confiança média
//       não nomeia a política
//
//  O segundo não é luxo. "Fixa as diretrizes para execução do Programa Auxílio
//  Alimentação" não tem frase que diga "assistência estudantil" — quem diz é a
//  PROAES, que assina. Medido no seed: 24 dos 37 atos entram só por esse sinal.
// ============================================================================

if (!function_exists('politicas_termos')) {
    function politicas_termos(): array {
        static $t = [
            'assistencia-estudantil' => 'assistência estudantil|apoio estudantil|auxílio moradia|auxílio alimentação|auxílio acolhimento|auxílio creche|auxílio permanência|permanência estudantil|moradia universitária',
            'acessibilidade'         => 'acessibilidade|uff acessível|pessoa com deficiência|pessoas com deficiência',
            'acoes-afirmativas'      => 'ações afirmativas|políticas afirmativas|heteroidentificação|indígenas e quilombolas|reserva de vagas|equidade de gênero|nome social',
            'assedio'                => 'assédio',
            'integridade-riscos'     => 'plano de integridade|programa de integridade|política de integridade|gestão de riscos|gestão de risco|mapa de riscos|controles internos',
            'seguranca-informacao'   => 'segurança da informação|proteção de dados|lgpd|privacidade|governança digital|governança de dados',
            'sustentabilidade'       => 'sustentabilidade|sustentável|agenda ambiental|a3p|gestão socioambiental|logística sustentável',
        ];
        return $t;
    }
}

if (!function_exists('politicas_emissores')) {
    /** Sigla do órgão emissor -> política. O 2º sinal. */
    function politicas_emissores(): array {
        static $e = ['PROAES' => 'assistencia-estudantil'];
        return $e;
    }
}

if (!function_exists('politicas_fold')) {
    // Idêntica de propósito a comissoes_fold(): tira acento e caixa, replicando
    // o que o LIKE em utf8mb4_unicode_ci faz. Duplicada em vez de importada
    // para o arquivo ser carregável sozinho no teste; o CI confere que as duas
    // devolvem o mesmo.
    function politicas_fold(string $s): string {
        $s = mb_strtolower($s, 'UTF-8');
        $de = ['á','à','â','ã','ä','é','ê','ë','í','ï','ó','ô','õ','ö','ú','ü','ç','ñ'];
        $pa = ['a','a','a','a','a','e','e','e','i','i','o','o','o','o','u','u','c','n'];
        return str_replace($de, $pa, $s);
    }
}

if (!function_exists('politica_ementa_inutilizavel')) {
    /** A ementa dá para casar frase?
     *
     * Parte do acervo não tem ementa aproveitável: boletim sem ementa formal,
     * recorte que pegou rodapé, e o OCR que espaça letra a letra
     * ("C o n s t i t u i a C o m i s s a o"). Casar frase nesses é loteria —
     * 15 dos 136 atos do seed caíram aqui. Vão para curadoria, não para o
     * catálogo automático.
     *
     * @return string  motivo, ou '' se a ementa serve.
     */
    function politica_ementa_inutilizavel(string $ementa): string {
        $t = trim($ementa);
        if ($t === '' || mb_strpos(politicas_fold($t), 'sem ementa formal') !== false) return 'sem ementa';
        if (preg_match('/^[a-zà-ú\)\]•§]/u', $t)) return 'fragmento';
        if (preg_match('/^bs\s*-/i', $t)) return 'rodape';
        $toks = preg_split('/\s+/u', $t, -1, PREG_SPLIT_NO_EMPTY);
        if (count($toks) >= 12) {
            $um = 0;
            foreach ($toks as $x) if (mb_strlen($x, 'UTF-8') === 1) $um++;
            if ($um / count($toks) > 0.4) return 'ocr espacado';
        }
        return '';
    }
}

if (!function_exists('politicas_sem_clausula_emissor')) {
    /** Remove a cláusula de abertura que nomeia quem assina.
     *
     * O CGIRC abre seus atos com "O COMITÊ DE GOVERNANÇA, INTEGRIDADE, RISCOS E
     * CONTROLES...", e essa abertura entra na ementa capturada. Sem tirá-la, o
     * termo `integridade` casava o Plano Socioambiental, o Programa Bem Viver e
     * o relatório do PDI — três atos que não são de integridade, só foram
     * assinados por quem tem a palavra no nome.
     *
     * É a armadilha-mãe da METODOLOGIA-ODS: o termo costuma estar no NOME de
     * alguém, não no dispositivo.
     */
    function politicas_sem_clausula_emissor(string $ementa): string {
        return preg_replace('/\bo (comit[êe]|conselho|colegiado|comiss[ãa]o) d[eoa][^.]{0,120}/iu',
                            ' ', $ementa) ?? $ementa;
    }
}

if (!function_exists('politica_papel')) {
    /** O que o ato FAZ pela política. A ordem importa: a primeira regra que
     *  casa vence, da ação mais forte para a mais fraca.
     *
     *  "Designa comissão" é GOVERNANÇA, não execução: montar colegiado não é
     *  executar a política. Sem essa separação, política com dez designações e
     *  nenhuma entrega apareceria como a mais ativa de todas — e o indicador de
     *  maturidade documental vai depender disto.
     *
     *  `plano de` fica em `fundador`, não em monitoramento: o Plano de
     *  Enfrentamento ao Assédio aprovado pelo CGIRC em 2025 é o ato que FUNDA
     *  aquela política na UFF. Medido: com `plano de` em monitoramento, a
     *  política de assédio nascia sem ato fundador nenhum.
     *
     *  `institui a cartilha|manual|guia` fica em `regulamentacao` e vem ANTES
     *  de `fundador`: material de orientação detalha como cumprir, não funda.
     *  Medido: a IN que institui a Cartilha de acessibilidade atitudinal
     *  aparecia como ato fundador da política de acessibilidade em produção.
     */
    function politica_papel(string $ementa): string {
        $e = politicas_fold($ementa);
        $regras = [
            'revogacao'      => ['/\brevoga/'],
            'alteracao'      => ['/\baltera/', '/\bmodifica/', '/\bretifica/'],
            'governanca'     => ['/\bdesigna/', '/\bconstitui (a )?comiss/', '/\binstitui (a|o) comit/',
                                 '/\binstitui (a )?comiss/', '/\bcria (e designa )?(a )?comiss/',
                                 '/\bcomissao (interna|local|permanente|temporaria)/',
                                 '/\bgrupo de trabalho/', '/\bcomite local/', '/\binclui novo membro/'],
            'execucao'       => ['/\bfixa(r)? as diretrizes/', '/\bexecucao do programa/'],
            'regulamentacao' => ['/\binstitui (a |o )?(cartilha|manual|guia|caderno)/',
                                 '/\bregulamenta/', '/\bregimento interno/', '/\bnormatiza/',
                                 '/\bdispoe sobre (o|a|os|as)/'],
            'monitoramento'  => ['/\brelatorio/', '/\bprestacao de contas/', '/\bacompanhamento e avaliacao/'],
            'fundador'       => ['/\binstitui/', '/\bcria\b/', '/\baprova (e institui )?(o|a)/',
                                 '/\bplano de/', '/\bpolitica de/', '/\bprograma\b/'],
        ];
        foreach ($regras as $papel => $padroes) {
            foreach ($padroes as $p) {
                if (preg_match($p . 'u', $e)) return $papel;
            }
        }
        return 'referencia';
    }
}

if (!function_exists('politicas_do_ato')) {
    /** Vínculos ato<->política deste ato.
     *
     * @return array de ['politica','papel','confianca','justificativa']
     */
    function politicas_do_ato(string $ementa, string $siglaOrgao = ''): array {
        if (politica_ementa_inutilizavel($ementa) !== '') return [];

        // Sindicância apura caso concreto: efeito estritamente individual, fora
        // do catálogo público por regra de privacidade.
        $bruto = politicas_fold($ementa);
        if (preg_match('/\bsindicanc|\bapurar denuncia|\bprocesso administrativo disciplinar/u', $bruto)) {
            return [];
        }

        $alvo = politicas_fold(politicas_sem_clausula_emissor($ementa));
        $papel = politica_papel($ementa);
        $out = [];
        $vistos = [];

        foreach (politicas_termos() as $slug => $termos) {
            foreach (explode('|', $termos) as $termo) {
                if (mb_strpos($alvo, politicas_fold($termo)) !== false) {
                    $out[] = ['politica' => $slug, 'papel' => $papel, 'confianca' => 'alta',
                              'justificativa' => 'frase: ' . politicas_fold($termo)];
                    $vistos[$slug] = true;
                    break;
                }
            }
        }

        $sig = mb_strtoupper(trim($siglaOrgao), 'UTF-8');
        $porEmissor = politicas_emissores();
        if ($sig !== '' && isset($porEmissor[$sig]) && !isset($vistos[$porEmissor[$sig]])) {
            $out[] = ['politica' => $porEmissor[$sig], 'papel' => $papel, 'confianca' => 'media',
                      'justificativa' => 'emissor: ' . $sig];
        }
        return $out;
    }
}
