<?php
// ============================================================================
//  ods_match.php — dado um ato, quais ODS ele evidencia e com que vínculo.
//
//  PORTE FIEL de tools/ods/classificador_corpus.py (recorte) +
//  tools/ods/rotulador_final.py (rótulo por clusters). Os dois são
//  DETERMINÍSTICOS: regex sobre o dispositivo, sem IA em tempo de execução.
//  O `metodo='ia'` gravado na tabela é herança do nome da carga original — o
//  que roda aqui é o mesmo conjunto de clusters auditados que produziu as
//  1.368 linhas em produção.
//
//  POR QUE ISTO EXISTE: até 03/08/2026 a `ato_ods` só era preenchida pelo
//  backfill offline, então boletim novo entrava SEM vínculo ODS nenhum e a aba
//  ficava parada até alguém rodar uma carga à mão. Agora o import diário
//  classifica sozinho, e a curadoria humana entra por cima.
//
//  A REGRA DE OURO: linha com `metodo='curadoria'` é intocável. Quem chama
//  apaga só o que for automático antes de regravar (ver importar_v2.php).
//
//  MÉTODO, ÂNCORAS E ARMADILHAS: docs/METODOLOGIA-ODS.md. Leia o §5 e o §5-A
//  antes de mexer em qualquer regex daqui — cada guarda abaixo custou uma
//  medição no corpus, e várias foram achadas com a carga JÁ em produção.
// ============================================================================

// Normalização: sem acento, minúsculas. Espelha strip() do Python.
function ods_norm(?string $s): string {
    $s = (string)$s;
    $t = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s);
    if ($t === false) $t = $s;
    // iconv//TRANSLIT às vezes emite ~a, 'e etc.; some com o diacrítico solto.
    $t = preg_replace('/[~^`\'"]([a-zA-Z])/', '$1', $t);
    return mb_strtolower($t, 'UTF-8');
}

// Só tipos NORMATIVOS entram. Ato de pessoal e expediente não propõem política.
function ods_tipo_normativo(string $tipo): bool {
    $t = preg_replace('/[^A-Z]/', '', mb_strtoupper(ods_norm($tipo), 'UTF-8'));
    return in_array($t, ['RESOLUCAO', 'DECISAO', 'INSTRUCAONORMATIVA',
                         'NORMADESERVICO', 'PORTARIA'], true);
}

// O DISPOSITIVO, não a ementa: do marcador "RESOLVE:/DECIDE:" em diante.
// Medido no lote de 210: ler o corpo mudou o veredito em 25 atos (~12%) e
// rejeitou 19/19 iscas que a ementa aceitaria.
function ods_dispositivo(string $corpo): string {
    if (preg_match('/\b(resolve[m]?|decide[m]?|determina|resolvo)\b\s*:?/', $corpo, $m, PREG_OFFSET_CAPTURE)) {
        return mb_substr(substr($corpo, $m[0][1]), 0, 3500);
    }
    return mb_substr($corpo, 0, 1500);
}

// ---------------------------------------------------------------- recorte (A)
const ODS_RE_ADMIN = '/(torna(r)? sem efeito a nomea|declara(r)? vago|exonera|\bnomea(r)?\b|concede(r)? (pensao|aposentadoria|abono|progressao|licenca|gratificacao)|homologa\w* .{0,40}concurso|banca examinadora|comissao examinadora|reconhecimento do titulo|reconhecer o titulo|solicitacao de reconhecimento|indeferir)/';
const ODS_RE_ESTAGIO = '/concessao de estagio|estagios (obrigatorios|curriculares)|convenio .{0,60}estagio/';
const ODS_RE_FOUND = '/(institui(r)?|fica(m)? instituid|cria(r)?\b|fica(m)? criad|aprova(r)? (a politica|o programa|o plano|o regulamento|as diretrizes|a norma|o codigo)|fixa(r)? as diretrizes|estabelec\w+ (a politica|as diretrizes|normas|criterios)|regulament\w+|dispoe sobre a politica)/';
const ODS_RE_PESQ = '/projeto de pesquisa|pd&?i|pesquisa denominad/';
const ODS_RE_EXEC = '/designa(r)?|constitui(r)? .{0,20}comissao|reconduz|altera(r)? a (composicao|portaria|comissao)|comissao (permanente|local|interna|especial)/';
const ODS_RE_CURRIC = '/trabalho de conclusao|atividades complementares|criad\w+ .{0,10}disciplinas|progressao|estagio curricular|revisao de nota|regulamento do curso/';
// "lato/stricto sensu" SOZINHO não é oferta acadêmica — aparece como
// qualificador do público-alvo. Foi assim que a IN PROAES 38 (ações
// afirmativas na pós) virou "ensino" e caiu fora por não ter tema-ODS no nome
// de curso nenhum. O termo de nível só conta junto de verbo de criação.
const ODS_RE_ENSINO = '/cria(?:cao|r|da)?\s*(?:d[oe]s?\s*)?(?:novo\s*)?(?:curso|programa de pos-?graduacao|disciplina)|estabelece o curriculo|curriculo (?:pleno|do curso)|regimento interno do (?:programa|curso)|grade horaria|criad\w+ .{0,15}disciplin|ajuste curricular|alteracao curricular|(?:aprova|estabelece)\w*.{0,45}(?:curso|programa).{0,30}(?:lato sensu|stricto sensu|especializacao|mestrado|doutorado)/';

function ods_termos(): array {
    static $t = [
     1  => ['auxilio moradia', 'auxilio emergencial', 'apoio .{0,15}moradia', 'vulnerabilidade socioeconomica'],
     2  => ['restaurante universitario', 'seguranca alimentar', 'auxilio alimentacao'],
     3  => ['saude mental', 'saude do servidor', 'saude do trabalhador', 'qualidade de vida', 'atencao psicossocial', 'bem viver', 'promocao (da|a) saude'],
     4  => ['permanencia estudantil', 'acesso e permanencia', 'taxas de evasao', 'assistencia estudantil', 'inclusao digital', 'educacao inclusiva'],
     5  => ['assedio', 'violencia contra a mulher', 'equidade de genero', 'nome social', 'gestante', 'creche', 'educacao infantil', 'diversidade e equidade', '\bafide\b', '\bmulheres\b'],
     6  => ['saneamento', 'efluentes', 'recursos hidricos'],
     7  => ['eficiencia energetica', 'energia (solar|fotovoltaica|renovavel)'],
     8  => ['seguranca (do|no) trabalho', 'saude ocupacional', '\bcipa\b', 'prevencao de acidentes', 'plano de desenvolvimento de pessoas', 'programa de gestao e desempenho', 'trabalho decente', 'flexibilizacao da jornada'],
     9  => ['nucleo de inovacao', 'ciencia aberta', 'incubadora', 'propriedade (intelectual|industrial)', 'inovacao tecnologica'],
     10 => ['acoes afirmativas', 'acao afirmativa', '\bcotas\b', 'heteroidentificacao', 'acessibilidade', '\binclusao\b', 'indigenas', 'quilombolas', 'pessoas com deficiencia', 'reserva de vagas', '\bequidade\b', '\bsepad\b', '\bcppiq\b', '\bdiversidade\b'],
     11 => ['patrimonio (cultural|historico)', 'mobilidade urbana', 'abert\w+ (a|a) comunidade'],
     12 => ['logistica sustentavel', '\bpls\b', '\ba3p\b', 'coleta seletiva', 'residuos', 'gestao ambiental', 'sustentabilidade', 'compras sustentaveis', 'pgrss', 'socioambiental'],
     13 => ['mudancas climaticas', '\bclima\b', 'emissoes de carbono', 'educacao ambiental', 'efeito estufa'],
     14 => ['reciclagem de navios', 'ecossistema marinho', 'recursos pesqueiros', '\boceano'],
     15 => ['bem-estar animal', '\bceua\b', 'biodiversidade', 'manejo (sustentavel|da fauna|da flora)'],
     16 => ['governanca', 'integridade', 'gestao de riscos', 'corrupcao', '\betica\b', 'ouvidoria', 'transparencia', '\blgpd\b', 'seguranca da informacao', 'protecao de dados', 'plano de integridade', 'resolucao pacifica de conflitos'],
     17 => ['cooperacao internacional', 'acordo de cooperacao', 'internacionalizacao', '\bcotutela\b', 'relatorio .{0,10}ods'],
    ];
    return $t;
}

// Iscas de palavra-chave já medidas: o termo-ODS está no CARGO, na VAGA ou no
// nome do parceiro, não no que o ato faz.
function ods_isca(int $n, string $full): bool {
    if ($n === 8 && preg_match('/cargo de (tecnico|engenheiro) .{0,25}seguranca (do|no) trabalho/', $full)
        && preg_match(ODS_RE_ADMIN, $full)) return true;
    if (in_array($n, [5, 10], true)
        && preg_match('/(assistente social|vaga(s)? reservada|reservadas a (negros|pretos|pardos)|pessoa com deficiencia)/', $full)
        && preg_match(ODS_RE_ADMIN, $full)) return true;
    if (in_array($n, [7, 12, 17, 15], true) && preg_match(ODS_RE_ESTAGIO, $full)) return true;
    if ($n === 5 && preg_match('/comunicacao social/', $full) && preg_match('/nomea/', $full)) return true;
    return false;
}

/** Recorte: devolve ['vinc'=>..., 'ods'=>[...], 'disp'=>...] ou null. */
function ods_recorte(string $ementa, string $corpo): ?array {
    $disp = ods_dispositivo($corpo);
    // Janela estreita contra contaminação por ato vizinho no corpo extraído.
    $full = ods_norm($ementa) . ' ' . mb_substr($disp, 0, 1200);

    if (preg_match(ODS_RE_ADMIN, $disp) && !preg_match(ODS_RE_FOUND, $disp)) {
        if (preg_match('/pensao|aposentadoria|\bvago\b|exonera|reconhecimento do titulo|examinadora|homologa/', $disp)) {
            return null;
        }
    }
    $ensino = preg_match(ODS_RE_ENSINO, ods_norm($ementa))
           || preg_match(ODS_RE_ENSINO, mb_substr($disp, 0, 600));
    if (preg_match(ODS_RE_PESQ, $full))      $vinc = 'pesquisa';
    elseif ($ensino)                          $vinc = 'ensino';
    elseif (preg_match(ODS_RE_FOUND, $disp))  $vinc = 'proposta';
    elseif (preg_match(ODS_RE_EXEC, $disp))   $vinc = 'execucao';
    else                                      $vinc = 'nenhuma';

    $ods = [];
    foreach (ods_termos() as $n => $pats) {
        $casa = false;
        foreach ($pats as $p) { if (preg_match('/' . $p . '/', $full)) { $casa = true; break; } }
        if (!$casa) continue;
        if (ods_isca($n, $full)) continue;
        // ODS 4 infla: educação é a razão de ser da UFF. Só conta política de
        // acesso/permanência/inclusão — não regulamento de TCC nem progressão.
        if ($n === 4 && preg_match(ODS_RE_CURRIC, $disp)
            && !preg_match('/permanencia|acesso|inclusao|evasao|assistencia estudantil|vulnerab/', $full)) continue;
        $ods[] = $n;
    }
    if (!$ods) return null;
    if ($vinc === 'nenhuma') $vinc = 'execucao';
    sort($ods);
    return ['vinc' => $vinc, 'ods' => $ods, 'disp' => mb_substr($disp, 0, 600)];
}

// ------------------------------------------------------------- descartes (B)
function ods_descartes(): array {
    static $d = [
     ['afastamento/cessao (ato de pessoal)', '/afastamento do pais|manifestar-se favoravel\w* (ao|a) afastamento|autorizar a cessao|alterar a lotacao/'],
     ['mocao (manifestacao politica, nao norma)', '/\bmocao\b|mocao de (apoio|louvor|repudio)/'],
     ['concurso/progressao/incentivo (gestao de pessoal)', '/abertura de concurso|incentivo a qualificacao|gratificacao de estimulo|homologar? .{0,30}concurso|validar o titulo|revalidacao do diploma|homologar o ato .{0,30}diploma/'],
     ['aditivo/convenio de estagio (operacao de ensino)', '/termo aditivo ao convenio para estagio|convenio para estagio|concessao de estagios/'],
     ['reestruturacao administrativa generica', '/reestruturacao administrativa/'],
     ['deferimento individual', '/deferimento (parcial )?do pedido d[oa] discente|pelo deferimento do recurso/'],
     ['concessao individual de auxilio (folha, nao programa)', '/conceder .{0,40}auxilio[- ](alimentacao|transporte|pre[- ]escolar|natalidade)|auxilio[- ]alimentacao a[o]? servidor/'],
     ['doacao de material', '/doacao de (material|bens)|doacao feita/'],
     ['nomeacao/designacao de cargo CD/FG (pessoal)', '/(nomear|designar|dispensar|exonerar)[^.]{0,200}(cargo de direcao|codigo cd|cd-\d|fg-\d|substituto eventual)|alterar na portaria [^.]{0,80}(excluir|incluir): (cd|fg)-\d/'],
     // Remaneja códigos de chefia entre unidades: o termo-ODS mora no NOME DA
     // UNIDADE ("Divisão de Saúde Ocupacional", "Restaurante Universitário").
     ['ato de estrutura: remanejo de codigos de chefia', '/situacao atual\s+situacao transformada|chefia codigo|alterar na portaria n?o? ?24\.153/'],
     ['progressao/merito/adicional individual (folha)', '/progressao por (capacitacao|merito)|conceder .{0,25}(progressao|adicional de)|retificar[^.]{0,60}que concedeu/'],
     // A Escola de Governança em Gestão Pública assina centenas de atos de
     // capacitação: a palavra "governança" no NOME DELA fez 193 atos de folha
     // parecerem política de governança (ODS 16). Nenhum cita governança no
     // dispositivo. É a isca mais numerosa já medida.
     ['termo-ODS no nome do orgao emissor (Escola de Governanca)', '/escola de governanca em gestao publica(?!.{0,80}(institui|cria|regulament))/'],
    ];
    return $d;
}

// Ato de pessoal: a guarda é o OBJETO DO VERBO. "Designa Fulana, Nutricionista"
// entrava na ODS 2 porque o CARGO dela casava o tema — o ato não faz política
// alimentar nenhuma. Medido em produção: 292 das 1.662 ligações (17,6%).
// Se o objeto é COLEGIADO ("designa membros da Comissão de Ações Afirmativas"),
// é execução legítima de política e fica.
const ODS_RE_PESSOAL_VERBO = '/^(designa|dispensa|nomeia|nomear|exonera|reconduz|torna sem efeito a nomea|declara vago|concede)/';
const ODS_RE_COLEGIADO = '/comissao|comite|grupo de trabalho|\bgt\b|conselho|camara|colegiado|subcomissao|equipe|banca|nucleo/';
// O dispositivo quase nunca começa no verbo: vem "resolve: 1- designar…",
// "resolve: art. 1º - dispensar…". Sem descascar o marcador de item o verbo não
// casa e o ato de pessoal passa batido (71 designações sobreviveram assim).
const ODS_RE_ABRE = '/^(resolve[m]?|decide[m]?|determina|resolvo)\s*:?\s*/';
const ODS_RE_ITEM = '/^(?:art\.?\s*\d+\s*[o°]?\s*[-.]?\s*|\d+\s*[-.)]\s*|[ivx]+\s*[-.)]\s*)+/i';

function ods_eh_ato_de_pessoal(string $em, string $disp): bool {
    $alvo = trim($em);
    if ($alvo === '') {
        $alvo = trim(preg_replace(ODS_RE_ITEM, '', trim(preg_replace(ODS_RE_ABRE, '', $disp))));
    }
    if (!preg_match(ODS_RE_PESSOAL_VERBO, $alvo)) return false;
    return !preg_match(ODS_RE_COLEGIADO, mb_substr($alvo, 0, 200));
}

// ------------------------------------------------------------- clusters (C)
// Ordem = prioridade. Cada regra: nome, padrão, ODS[], vínculo, confiança,
// meta ancorada (THE/IPEA) e justificativa — sem justificativa não grava,
// é o que torna cada rótulo auditável.
function ods_clusters(): array {
    static $c = [
     ['integridade-plano', '/(programa e )?plano de integridade|programa de integridade/', [16], 'proposta', 'alta', 'IPEA 16.5/16.6', 'Plano/Programa de Integridade — combate a corrupcao e instituicoes eficazes'],
     ['gestao-riscos', '/politica de gestao de riscos/', [16], 'proposta', 'alta', 'IPEA 16.6', 'Politica de Gestao de Riscos — governanca e instituicoes responsaveis'],
     ['cgirc-comite', '/comite de governanca|governanca, integridade, riscos/', [16], 'proposta', 'alta', 'IPEA 16.6', 'Institui/reestrutura o comite central de governanca (CGIRC)'],
     ['psi-seginfo', '/politica de seguranca da informacao|\bpsi\b/', [16], 'proposta', 'alta', 'IPEA 16.6', 'Politica de Seguranca da Informacao — capacidade institucional'],
     ['lgpd-dados', '/protecao de dados pessoais|privacidade|\blgpd\b/', [16], 'proposta', 'alta', 'IPEA 16.6/16.10', 'Governanca de protecao de dados pessoais (LGPD)'],
     ['ouvidoria', '/\bouvidoria\b/', [16], 'proposta', 'media', 'IPEA 16.6/16.10', 'Ouvidoria — acesso a informacao e responsividade institucional'],
     // CEUA antes da ética genérica: "comissão de ética NO USO DE ANIMAIS"
     // casaria no cluster de ética pública.
     ['ceua-fundadora', '/uso de animais no ensino e na pesquisa|criar a comissao de etica no uso de animais/', [15, 16], 'proposta', 'alta', 'THE 15.2.5 / IPEA 15', 'Regulamenta o uso etico de animais (CEUA) — bem-estar animal e etica em pesquisa'],
     ['ceua-regimento', '/comissao de etica no uso de animais|\bceua\b/', [15], 'execucao', 'media', 'IPEA 15', 'Operacao da CEUA (regimento/composicao)'],
     ['bioterio', '/\bbioterio/', [15], 'proposta', 'media', 'IPEA 15', 'Estrutura/regulamento de bioterio — bem-estar animal'],
     ['etica-regimento', '/(regimento|codigo) .{0,30}(comissao de etica|de etica)(?! no uso)|constitui .{0,20}comissao de etica(?! no uso)/', [16], 'proposta', 'media', 'IPEA 16.6', 'Estrutura permanente de etica publica'],
     ['etica-composicao', '/comissao de etica(?! no uso)/', [16], 'execucao', 'media', 'IPEA 16.6', 'Operacao da Comissao de Etica (composicao/alteracao)'],
     ['resol-conflitos', '/resolucao pacifica de conflitos/', [16], 'proposta', 'alta', 'IPEA 16.1/16.6', 'Procedimentos de resolucao pacifica de conflitos'],

     ['proaes-alimentacao', '/(programa|diretrizes|edital)[^.]{0,80}(auxilio alimentacao|complementacao de alimenta)|(auxilio alimentacao|complementacao de alimenta)[^.]{0,80}(programa|diretrizes)|restaurante universitario/', [2, 10], 'proposta', 'alta', 'IPEA 2.1 / THE 2.x', 'Programa de alimentacao estudantil — acesso a alimento'],
     ['proaes-moradia', '/auxilio moradia|moradia universitaria|apoio .{0,15}moradia|acolhimento para estudantes/', [1, 4, 10], 'proposta', 'alta', 'IPEA 1.4/4.5', 'Programa de moradia/acolhimento estudantil — permanencia de vulneraveis'],
     ['proaes-emergencial', '/auxilio emergencial|emprestimo emergencial|inclusao digital|acesso a internet/', [1, 4, 10], 'proposta', 'alta', 'IPEA 1.4/4.5', 'Auxilio emergencial/inclusao digital — permanencia de vulneraveis'],
     ['proaes-afirmativas', '/politicas afirmativas|pessoas trans|indigenas e quilombolas|estudantes indigenas|refugiad/', [10, 5, 4], 'proposta', 'alta', 'IPEA 10.2/10.3 / THE 10.6.4', 'Programa de politicas afirmativas — reducao de desigualdades'],
     ['proaes-deficiencia', '/estudante com deficiencia/', [10, 4], 'proposta', 'alta', 'IPEA 10.2 / THE 10.6.4', 'Apoio a estudantes com deficiencia — inclusao'],
     ['proaes-outros', '/assistencia estudantil|permanencia estudantil|material didatico|educacao infantil|gestantes/', [4, 10], 'proposta', 'alta', 'IPEA 4.3/4.5', 'Programa de assistencia estudantil — acesso e permanencia'],

     ['nome-social', '/nome social de travestis|inclusao do nome social/', [5, 10], 'proposta', 'alta', 'IPEA 10.3 / THE 10.6.4', 'Regulamenta o uso do nome social — inclusao de pessoas trans'],
     ['acessibilidade-estrutura', '/(cria|institui|regulament)\w* .{0,40}acessibilidade|comissao .{0,30}acessibilidade|cartilha de acessibilidade/', [10], 'proposta', 'media', 'IPEA 10.2 / THE 10.6.4', 'Estrutura/instrumento permanente de acessibilidade'],
     ['heteroident', '/heteroidentificacao|verificacao .{0,20}(etnico|quilombola|deficiencia|renda)/', [10], 'execucao', 'media', 'IPEA 10.3', 'Operacao da politica de cotas (bancas de verificacao)'],
     // A CPEG é "Comissão Permanente PARA Equidade de Gênero" (não "de") e
     // nasceu do GT "Mulheres na Ciência": uma preposição diferente fazia a
     // portaria fundadora sumir na cauda longa. Cluster é lista de nomes
     // próprios, e nome próprio da UFF varia.
     ['equidade-genero', '/equidade (de|para) genero|permanente para equidade|mulheres na ciencia|plano .{0,15}equidade de genero|\bcpeg\b/', [5, 10], 'proposta', 'alta', 'IPEA 5.1/5.5 / THE 5.6.x', 'Estrutura/politica permanente de equidade de genero'],
     ['sepad-afide', '/\bsepad\b|equidade, politicas afirmativas|acoes afirmativas, diversidade e equidade|\bafide\b|\bcppiq\b|politicas .{0,15}indigenas e quilombolas/', [10, 5], 'proposta', 'alta', 'IPEA 10.2/10.3', 'Estrutura permanente de equidade e acoes afirmativas'],

     ['assedio', '/\bassedio\b/', [5, 8, 16], 'proposta', 'media', 'THE 10.6.11 / IPEA 5.2/8.8', 'Enfrentamento ao assedio — ambiente seguro de trabalho e estudo'],
     ['creche', '/\bcreche\b/', [5, 4], 'proposta', 'media', 'IPEA 5.4/4.2', 'Creche/educacao infantil — corresponsabilidade de cuidado'],

     ['saude-servidor', '/saude do servidor|cissp|qualidade de vida|bem viver|saude ocupacional|juntas? medicas/', [3, 8], 'proposta', 'media', 'THE 3.3.7 / IPEA 8.8', 'Saude e qualidade de vida do servidor'],
     ['cipa-seguranca', '/\bcipa\b|prevencao de acidentes/', [8, 5], 'proposta', 'media', 'IPEA 8.8', 'Prevencao de acidentes e assedio no trabalho (CIPA)'],
     ['pdp-capacitacao', '/plano de desenvolvimento de pessoas|\bpdp\b|acoes de desenvolvimento/', [4, 8], 'proposta', 'media', 'IPEA 4.3/8.5', 'Desenvolvimento e capacitacao de pessoal'],
     ['jornada-norma', '/(regulamenta|dispoe sobre|estabelece os criterios)[^.]{0,60}(flexibilizacao da )?jornada/', [8], 'proposta', 'media', 'IPEA 8.5', 'Norma geral de organizacao da jornada de trabalho'],
     ['jornada-adesao', '/flexibilizacao da jornada|programa de gestao e desempenho/', [8], 'execucao', 'media', 'IPEA 8.5', 'Adesao/operacao setorial da jornada flexibilizada ou PGD'],

     ['pls-a3p', '/logistica sustentavel|\bpls\b|\ba3p\b|gestao socioambiental/', [12, 13], 'proposta', 'alta', 'IPEA 12.7 / THE 13.x', 'Plano institucional de sustentabilidade (PLS/A3P)'],
     ['residuos-gestao', '/(programa|plano|comissao|grupo de trabalho|laboratorio) .{0,50}residuos|gerenciamento de residuos|coleta seletiva/', [12], 'proposta', 'media', 'IPEA 12.5', 'Gestao de residuos'],
     ['sustentab-estrutura', '/(nucleo|comissao|laboratorio|comite) .{0,60}sustentab|desenvolvimento sustentavel/', [12], 'proposta', 'media', 'IPEA 12.6', 'Estrutura permanente de sustentabilidade'],

     ['inovacao', '/propriedade (industrial|intelectual)|transferencia de tecnologia|incubadora|agencia de inovacao|\bagir\b|ciencia aberta/', [9], 'proposta', 'media', 'IPEA 9.5', 'Inovacao, propriedade intelectual e transferencia de tecnologia'],

     // A POLÍTICA de cooperação é proposta; o CONVÊNIO INDIVIDUAL é execução
     // dela. Sem esta separação, 671 instrumentos individuais entravam como
     // proposta e a ODS 17 sozinha respondia por 68% das propostas do dossiê —
     // número que não sobrevive à leitura de um avaliador.
     ['coop-politica', '/regulament\w+.{0,45}(cotutela|convenio|acordo de cooperacao|cooperacao)|regime de cotutela|politica de internacionalizacao|(cria|institui|reestrutura|altera)\w*.{0,80}(assuntos internacionais|relacoes internacionais|internacionalizacao)|(superintendencia|assessoria|escritorio|coordenacao|diretoria).{0,40}(internacion|relacoes internacionais)|(plano|projeto|programa|politica) .{0,30}internacionaliz|normas .{0,35}(celebracao|celebrar|firmar).{0,25}(convenio|acordo)/', [17], 'proposta', 'alta', 'THE 17.2 / IPEA 17.17', 'Politica/regulamento institucional de cooperacao e internacionalizacao'],
     ['coop-internacional', '/cooperacao internacional|cotutela|intercambio .{0,30}(universi|internacional)/', [17], 'execucao', 'media', 'THE 17.2 / IPEA 17.6', 'Acordo internacional firmado (instrumento individual — execucao da politica)'],
     ['coop-tecnica', '/acordo de cooperacao|protocolo de (cooperacao|intencoes)|termo de cooperacao/', [17], 'execucao', 'baixa', 'THE 17.2 / IPEA 17.17', 'Acordo interinstitucional firmado (instrumento individual — execucao da politica)'],
    ];
    return $c;
}

// Clusters que só valem com o sinal na EMENTA. A Agenda Acadêmica cita creche
// na programação dentro do CORPO, e isso fazia "Designar representantes do
// Comitê Científico da Agenda Acadêmica" virar evidência de ODS 5.
const ODS_SO_EMENTA = ['coop-politica', 'creche'];

// Ensino: a ODS vem do NOME DO CURSO, na ementa.
function ods_ensino_tema(): array {
    static $t = [
     2 => 'alimentacao|alimentos|nutricao',           3 => 'saude|enfermagem|psican|psiquiatr|medicina',
     4 => 'educacao|pedagogia|ensino|docencia',       5 => 'genero|mulher',
     6 => 'recursos hidricos|saneamento|agua',        7 => 'energia',
     8 => 'seguranca do trabalho|engenharia de producao|gestao',
     9 => 'tecnologia|computacao|inovacao',
     10 => 'inclusiva|inclusao|acessibilidade|diversidade|educacao especial',
     11 => 'urbanismo|patrimonio|cidade',             12 => 'ambiental|sustentab|turismo',
     13 => 'clima',                                   14 => 'oceano|marinh|geofisica|pesca',
     15 => 'biodiversidade|biologia|geografia|florest',
     16 => 'direito|defesa civil|justica|seguranca publica',
     17 => 'internacional',
    ];
    return $t;
}

function ods_rotula_ensino(string $em): array {
    $ods = [];
    foreach (ods_ensino_tema() as $n => $pat) {
        if (preg_match('/' . $pat . '/', $em)) $ods[] = $n;
    }
    // "inclusão" é jargão administrativo ("inclusão de disciplina, de
    // pré-requisito, de servidor na comissão") e NÃO significa inclusão social.
    // Sem esta guarda, alteração curricular de Estatística virava ODS 10.
    if (in_array(10, $ods, true)
        && preg_match('/inclusao de (disciplin|pre-?requisit|component|carga|servidor|membro|vaga)/', $em)
        && !preg_match('/inclusiv|acessibilidad|deficien|indigen|quilombol|afirmativ|diversidade|equidade/', $em)) {
        $ods = array_values(array_diff($ods, [10]));
    }
    // "ética" idem, quando é o NOME do curso ("Bioética", "Ética na Comunicação").
    if (in_array(16, $ods, true)
        && preg_match('/bioetica|etica na comunicacao|etica aplicada/', $em)
        && !preg_match('/comissao de etica|codigo de etica|comite de etica/', $em)) {
        $ods = array_values(array_diff($ods, [16]));
    }
    return $ods;
}

/**
 * Entrada pública. Devolve a lista de linhas a gravar em `ato_ods`:
 *   [['ods'=>10,'vinculo'=>'proposta','confianca'=>'alta','meta'=>...,'justificativa'=>...], ...]
 * Lista vazia = nenhum vínculo automático. NUNCA chuta: sem cluster, o ato vira
 * resíduo para curadoria humana (é ali que mora o falso-negativo — ver §8-B).
 */
function ods_do_ato(string $tipo, string $ementa, string $corpo): array {
    if (!ods_tipo_normativo($tipo)) return [];

    $rec = ods_recorte($ementa, ods_norm($corpo));
    if ($rec === null) return [];

    $em = ods_norm($ementa);
    $disp = $rec['disp'];
    $texto = $em . ' ' . $disp;

    // Ato de pessoal decide ANTES de qualquer cluster.
    if (ods_eh_ato_de_pessoal($em, $disp)) return [];

    // Designação de COLEGIADO sobrevive (é execução de política), mas aí o tema
    // tem de vir da EMENTA — o corpo desses atos é lista de membros e
    // programação de evento, fonte certa de contaminação.
    $so_ementa_este_ato = trim($em) !== '' && (bool)preg_match(ODS_RE_PESSOAL_VERBO, trim($em));

    foreach (ods_descartes() as [$motivo, $pat]) {
        if (preg_match($pat, $texto)) return [];
    }

    if ($rec['vinc'] === 'ensino') {
        $ods = ods_rotula_ensino($em);
        if (!$ods) return [];   // tema vinha de disciplina no corpo, não do curso
        $linhas = [];
        foreach (array_slice($ods, 0, 2) as $n) {
            $linhas[] = ['ods' => $n, 'vinculo' => 'ensino', 'confianca' => 'media',
                         'meta' => 'THE educational programmes',
                         'justificativa' => 'Oferta academica sobre tema-ODS (nome do curso/disciplina na ementa)'];
        }
        return $linhas;
    }

    $hit = null;
    foreach (ods_clusters() as $cl) {
        [$nome, $pat, $ods, $vinc, $conf, $meta, $just] = $cl;
        $alvo = (in_array($nome, ODS_SO_EMENTA, true) || $so_ementa_este_ato) ? $em : $texto;
        if (preg_match($pat, $alvo)) { $hit = $cl; break; }
    }
    if ($hit === null) return [];   // resíduo: vai para curadoria, não se chuta

    [$nome, $pat, $ods, $vinc, $conf, $meta, $just] = $hit;
    // Regex nunca PROMOVE: se o recorte leu execução e o cluster diz proposta,
    // vale o verbo do recorte.
    if ($rec['vinc'] === 'execucao' && $vinc === 'proposta') {
        $vinc = 'execucao';
        $conf = ($conf === 'alta') ? 'media' : 'baixa';
    }
    // 'pesquisa' do recorte vem de menção a "projeto de pesquisa" no corpo — só
    // confiar quando o cluster É de cooperação/pesquisa.
    if ($rec['vinc'] === 'pesquisa' && strpos($nome, 'coop-') === 0) $vinc = 'pesquisa';

    $linhas = [];
    foreach ($ods as $n) {
        $linhas[] = ['ods' => $n, 'vinculo' => $vinc, 'confianca' => $conf,
                     'meta' => $meta, 'justificativa' => $just];
    }
    return $linhas;
}
