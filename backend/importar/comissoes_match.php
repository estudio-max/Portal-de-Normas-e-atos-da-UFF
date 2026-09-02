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
        // Valor pode ter VÁRIAS frases separadas por '|' (o corpo mudou de nome
        // ao longo dos anos: o CEP é "em pesquisa" hoje mas já foi "na
        // pesquisa"; a Comissão de Ética aparece como "da UFF" e "Pública").
        //
        // Dois prefixos, os dois criados para o CPFJ (ver o comentário lá) e
        // válidos para qualquer corpo:
        //   '!'  EXCLUSÃO — se a frase aparecer, o ato não casa aquele corpo,
        //        por mais que uma variante positiva tenha batido. É o recurso
        //        para o homônimo de UNIDADE que nenhum qualificador positivo
        //        separa.
        //   '+'  TERMO FORTE — dispensa a guarda de colegiado. Serve à frase
        //        que nomeia o INSTRUMENTO que o corpo produz, não o corpo:
        //        aí a ementa não diz "comissão" nenhuma e a guarda derrubaria
        //        tudo. Só se usa com frase medida a 100% de precisão — ela
        //        entra SEM a rede de segurança que a guarda dá às outras.
        static $t = [
            'cpa'           => 'própria de avaliação',
            'cppd'          => 'permanente de pessoal docente',
            'ceua'          => 'ética no uso de animais',
            // Cada unidade tem a sua comissão de biossegurança, e os dois
            // nomes são usados dos dois lados: 'CBio/IQ/UFF' é do Instituto
            // de Química, e 'Comissão INTERNA de Biossegurança da Pró
            // Reitoria' é a central. O discriminador é o QUALIFICADOR, não a
            // palavra 'interna'. Medido em 145 atos: o termo antigo trazia 7
            // comissões de unidade e perdia o Regimento (RES. CUV 443/2024).
            'biosseg'       => 'biossegurança da uff|biossegurança da pró reitoria|biossegurança da pró-reitoria',
            'etica'         => 'ética da uff|ética pública',
            'cep'           => 'ética em pesquisa|ética na pesquisa',
            'cis'           => 'interna de supervisão',
            'gov-dig'       => 'governança digital',
            'cgirc'         => 'governança, integridade|comitê de governança da uff',
            'cgi'           => 'gestão da integridade',
            'cgestao-inf'   => 'comitê de gestão da informação',
            'acessib'       => 'acessibilidade e inclusão da uff|uff acessível',
            'cipa'          => 'prevenção de acidentes e de assédio',
            'cppta'         => 'permanente de pessoal técnico',
            'csi'           => 'segurança da informação',
            'cti'           => 'comitê de tecnologia da informação',
            'assessor-pesq' => 'assessor de pesquisa da pró',
            'multi-pesq'    => 'multidisciplinar de pesquisa',
            'patrim-gen'    => 'acesso ao patrimônio genético',
            'afide'         => 'permanente de ações afirmativas, diversidade e equidade',
            'cppiq'         => 'indígenas e quilombolas',
            'cps'           => 'permanente de sustentabilidade',
            'cpt'           => 'permanente de telefonia',
            // CPFJ — o único corpo do registro que se apura por DOIS tipos de
            // frase, e o motivo é que ele quase nunca se nomeia na ementa.
            //
            // (1) 'permanente de flexibilização' pega a vida do colegiado: a
            //     constituição (62.325/2018), as retificações de composição
            //     (62.902 e 62.927/2019, 64.061/2019, 66.247 e 66.765/2020,
            //     68.471/2022, 68.514/2023, 68.810/2025) e o ato que as torna
            //     sem efeito (63.682/2019). O HUAP tem a SUA Comissão
            //     Permanente de Flexibilização (Portaria 68.440/2022) e o
            //     acervo escreve as duas sem qualificador — aqui, ao
            //     contrário do CBio e da Acessibilidade, NÃO existe
            //     qualificador positivo que sirva: as retificações do corpo
            //     central terminam em "…da Comissão Permanente de
            //     Flexibilização" e param aí. Daí '!do hospital'.
            // (2) As quatro frases '+' pegam o que a comissão PRODUZ: as ~54
            //     portarias que aprovam ou mantêm o plano de uma UORG, os
            //     atos normativos do rito (Portaria 57.302/2016, Portaria
            //     62.111/2018 e a NS 672/2019, que fixa as competências da
            //     CPFJ nos arts. 10, 11 e 14) e a 68.403/2022, que suspende o
            //     prazo da avaliação anual do inciso V do art. 10. A ementa
            //     desses atos nomeia o INSTRUMENTO, e é o preâmbulo que
            //     registra a CPFJ ("no exercício de sua competência, emitiu
            //     avaliação anual da UORG flexibilizada") — a guarda de
            //     colegiado derrubava todos, daí o '+'.
            //     As três são complementares por causa do OCR, que espaça
            //     palavra no meio ("d o p l ano d e flexibilização",
            //     "jornada de t r a b a l h o"), e da alternância
            //     "da jornada"/"de jornada": cada uma alcança o que as outras
            //     perdem.
            //     A quarta, 'jornada flexibilizada', é a SAÍDA do setor — a
            //     portaria que revoga o plano de uma UORG ("Revogar a Portaria
            //     X - Jornada Flexibilizada de …"). Ela inverte a ordem das
            //     palavras e por isso escapava das outras três: 38 atos de
            //     2022 a 2026 ficavam de fora, e com eles o único movimento
            //     recente do card — a CPFJ parecia parada em 2025 com m12=0
            //     enquanto encerrava flexibilização em 2026 (Portaria
            //     68.930/2026). Medido: 38 ementas no acervo contêm a frase e
            //     as 38 são desta família, zero falso positivo.
            // Medido no acervo cheio (128.426 atos do dump v2): 71 atos, ZERO
            // falso positivo na conferência à mão. As duas exclusões são
            // corpos de UNIDADE do mesmo tema — o do HUAP e a "Comissão de
            // Implantação" do CMV (DTS 16/2016).
            //
            // FORA daqui de propósito: as Portarias 57.301, 57.303, 57.529 e
            // 57.655/2016. São a história da POLÍTICA de flexibilização, não
            // atos do colegiado — a CPFJ só nasce em outubro de 2018, e
            // pendurá-las neste card diria que uma comissão inexistente agiu.
            'cpfj'          => 'permanente de flexibilização'
                             . '|+plano de flexibilização da jornada'
                             . '|+flexibilização da jornada de trabalho'
                             . '|+flexibilização de jornada'
                             . '|+jornada flexibilizada'
                             . '|!do hospital|!comissão de implantação',
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

if (!function_exists('comissoes_casa')) {
    /** O texto (já dobrado) casa o termo de um corpo?
     *
     * Uma variante positiva basta; qualquer variante de EXCLUSÃO ('!' na
     * frente) veta, mesmo que a positiva já tenha batido. O veto sai da função
     * na hora, então a ordem das variantes no registro não muda o resultado.
     *
     * $comGuarda diz se o texto passou na guarda de colegiado. Quando NÃO
     * passou, só as variantes fortes ('+') contam — as demais dependem da
     * guarda para não trazer o documento homônimo do colegiado. As exclusões
     * valem nos dois casos.
     */
    function comissoes_casa(string $dobrado, string $termos, bool $comGuarda = true): bool {
        $positivo = false;
        foreach (explode('|', $termos) as $termo) {
            $termo = trim($termo);
            if ($termo === '') continue;
            $marca = $termo[0];
            $frase = ($marca === '!' || $marca === '+') ? substr($termo, 1) : $termo;
            if ($marca === '!') {
                if (mb_strpos($dobrado, comissoes_fold($frase)) !== false) return false;
                continue;
            }
            if (!$comGuarda && $marca !== '+') continue;
            if (mb_strpos($dobrado, comissoes_fold($frase)) !== false) $positivo = true;
        }
        return $positivo;
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
     *
     * A guarda deixou de ser eliminatória para o texto inteiro: ementa que não
     * a passa ainda é testada contra as variantes FORTES ('+'), que existem
     * justamente para o corpo cuja ementa nomeia o instrumento e não o
     * colegiado — ver o CPFJ em comissoes_termos().
     */
    function comissoes_do_texto(string $ementa): array {
        $e = comissoes_fold($ementa);
        $comGuarda = (bool)preg_match('/comiss|comit|c[aâ]mara|conselho/', $e);
        $out = [];
        foreach (comissoes_termos() as $slug => $termos) {
            if (comissoes_casa($e, $termos, $comGuarda)) $out[] = $slug;
        }
        return $out;
    }
}

if (!function_exists('comissoes_do_orgao')) {
    /** Slugs cujo termo casa o NOME CANÔNICO do órgão emissor do ato.
     *
     * Sinal COMPLEMENTAR ao da ementa, para o ato que a comissão ASSINA em vez
     * de citar. A DECISÃO CGIRC nº 1/2025 ("Aprovação do Plano de Enfrentamento
     * ao Assédio") não nomeia o colegiado na ementa — quem a identifica é o
     * órgão emissor. Medido no acervo: o CGIRC emite 13 decisões e a ementa só
     * pegava 8 (as outras casavam por acaso, quando o preâmbulo vazava pra
     * ementa); 5 ficavam invisíveis.
     *
     * Casa contra `orgao.nome` (dimensão CURADA), não contra o texto do ato:
     * por isso NÃO precisa da guarda de colegiado e NÃO sofre o overloading de
     * sigla. "CPS"/"CEP"/"CPT" são siglas de DEPARTAMENTO cujos atos (designar
     * professor, alocar vaga) casariam pela sigla, mas o NOME do órgão deles não
     * casa termo de comissão nenhum — medido em 925 órgãos: só o do CGIRC casa.
     *
     * Como aqui não há guarda, todas as variantes positivas valem (o `true`);
     * as de exclusão continuam vetando — nome de órgão do HUAP não pode virar
     * ato do corpo central.
     */
    function comissoes_do_orgao(string $orgaoNome): array {
        $nome = comissoes_fold($orgaoNome);
        if ($nome === '') return [];
        $out = [];
        foreach (comissoes_termos() as $slug => $termos) {
            if (comissoes_casa($nome, $termos, true)) $out[] = $slug;
        }
        return $out;
    }
}
