<?php
// ============================================================================
//  comissoes_match.php — dado o texto de um ato, quais colegiados permanentes
//  ele menciona. Compartilhado pelo import diário (importar_v2.php) e pelo
//  backfill (backfill_ato_comissao.php), pra os dois taguearem IGUAL.
//
//  O casamento é por FRASE (substring, sem acento/caixa), não FULLTEXT: o
//  índice de texto tokeniza e "segurança da informação" casaria "informação"
//  em qualquer contexto. A frase estrita é o que dá precisão (medido: o termo
//  do CSI caiu de 83 falsos-positivos no FULLTEXT para 15 atos reais).
//
//  O registro abaixo é uma CÓPIA do que está em comissoes_registro() no
//  index_v2.php — os dois nascem de tools/registro_comissoes.py e não devem
//  divergir. A rota /api/comissoes usa a cópia de lá (metadados p/ exibir);
//  o tagueamento usa esta (nome+termo). Ao editar um, gere o outro.
// ============================================================================

if (!function_exists('comissoes_termos')) {
    function comissoes_termos(): array {
        // [slug => termo de busca (frase distintiva)]
        static $t = [
            'cpa'           => 'própria de avaliação',
            'cppd'          => 'permanente de pessoal docente',
            'cppta'         => 'permanente de pessoal técnico',
            'cis'           => 'interna de supervisão',
            'etica-pub'     => 'ética pública',
            'ceua'          => 'ética no uso de animais',
            'cep'           => 'ética na pesquisa',
            'gov'           => 'comitê de governança da uff',
            'gov-dig'       => 'governança digital',
            'csi'           => 'segurança da informação',
            'cgi'           => 'gestão da integridade',
            'cti'           => 'comitê de tecnologia da informação',
            'cgestao-inf'   => 'comitê de gestão da informação',
            'assessor-pesq' => 'assessor de pesquisa',
            'multi-pesq'    => 'multidisciplinar de pesquisa',
            'patrim-gen'    => 'acesso ao patrimônio genético',
            'acessib'       => 'acessibilidade e inclusão',
            'afide'         => 'ações afirmativas',
            'cppiq'         => 'indígenas e quilombolas',
            'cps'           => 'permanente de sustentabilidade',
            'cpt'           => 'permanente de telefonia',
            'pgd'           => 'permanente do programa de gestão',
            'doc-sig'       => 'documentos públicos de natureza sigilosa',
            'rsc'           => 'reconhecimento de saberes',
        ];
        return $t;
    }
}

if (!function_exists('comissoes_fold')) {
    // Tira acento e caixa — replica o que o LIKE em utf8mb4_unicode_ci faz, pra
    // o tagueamento em PHP casar exatamente o mesmo que o SQL do backfill.
    function comissoes_fold(string $s): string {
        $s = mb_strtolower($s, 'UTF-8');
        $de = ['á','à','â','ã','ä','é','ê','ë','í','ï','ó','ô','õ','ö','ú','ü','ç','ñ'];
        $pa = ['a','a','a','a','a','e','e','e','i','i','o','o','o','o','u','u','c','n'];
        return str_replace($de, $pa, $s);
    }
}

if (!function_exists('comissoes_do_texto')) {
    /** Slugs dos colegiados mencionados NA EMENTA.
     *
     * Só a ementa, não o corpo: a ementa declara o que o ato É; o corpo cita a
     * frase de passagem (medido: casar o corpo inflava o CSI de 15 para 86,
     * "ações afirmativas" de 45 para 341 — a frase aparece em política, edital,
     * currículo). E uma GUARDA: a ementa tem que citar um colegiado
     * (comissão/comitê/câmara/conselho), senão "Política de Segurança da
     * Informação" (documento, não o Comitê) entraria. Com a guarda, CSI cai
     * para os 3 atos que são mesmo do comitê.
     */
    function comissoes_do_texto(string $ementa): array {
        $e = comissoes_fold($ementa);
        if (!preg_match('/comiss|comit|c[aâ]mara|conselho/', $e)) return [];
        $out = [];
        foreach (comissoes_termos() as $slug => $termo) {
            if (mb_strpos($e, comissoes_fold($termo)) !== false) $out[] = $slug;
        }
        return $out;
    }
}
