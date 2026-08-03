<?php
// ============================================================================
//  teste_ods_match.php — regressão da classificação ODS automática.
//
//  Uso:  php backend/importar/teste_ods_match.php     (sai 1 se algo quebrou)
//
//  CADA CASO AQUI É UM DEFEITO QUE JÁ ESTEVE EM PRODUÇÃO. Não são exemplos
//  ilustrativos: são as iscas medidas no corpus e catalogadas no §5-A da
//  docs/METODOLOGIA-ODS.md, mais os verdadeiros-positivos que já sumiram uma
//  vez por falta de padrão. O objetivo do arquivo é impedir que a próxima
//  mexida nos regex reintroduza um falso-positivo já pago.
//
//  A regra do painel é precisão, não cobertura: é dossiê de EVIDÊNCIA. Ato sem
//  cluster fica de fora e vai para curadoria — falso-negativo é barato de
//  corrigir (basta um padrão novo), falso-positivo contamina o dossiê inteiro.
// ============================================================================
require_once __DIR__ . '/ods_match.php';

$falhas = 0;
$ok = 0;

/** Espera que o ato NÃO gere vínculo com a ODS $n (ou com nenhuma, se $n=null). */
function recusa(string $rotulo, string $tipo, string $ementa, string $corpo, ?int $n = null): void {
    global $falhas, $ok;
    $linhas = ods_do_ato($tipo, $ementa, $corpo);
    $achou = $n === null ? count($linhas) > 0
                         : count(array_filter($linhas, fn($l) => $l['ods'] === $n)) > 0;
    if ($achou) {
        $vistos = implode(',', array_map(fn($l) => $l['ods'] . '/' . $l['vinculo'], $linhas));
        echo "FALHA  [$rotulo] deveria recusar" . ($n ? " ODS $n" : " tudo") . ", veio: $vistos\n";
        $falhas++;
    } else { $ok++; }
}

/** Espera vínculo com a ODS $n, opcionalmente com um $vinculo específico. */
function aceita(string $rotulo, string $tipo, string $ementa, string $corpo, int $n, ?string $vinculo = null): void {
    global $falhas, $ok;
    $linhas = ods_do_ato($tipo, $ementa, $corpo);
    $casadas = array_values(array_filter($linhas, fn($l) => $l['ods'] === $n));
    if (!$casadas) {
        $vistos = $linhas ? implode(',', array_map(fn($l) => (string)$l['ods'], $linhas)) : '(nenhuma)';
        echo "FALHA  [$rotulo] deveria aceitar ODS $n, veio: $vistos\n";
        $falhas++; return;
    }
    if ($vinculo !== null && $casadas[0]['vinculo'] !== $vinculo) {
        echo "FALHA  [$rotulo] ODS $n deveria ser '$vinculo', veio '{$casadas[0]['vinculo']}'\n";
        $falhas++; return;
    }
    $ok++;
}

$R = 'RESOLVE: ';   // o dispositivo é recortado a partir deste marcador

// ---------------------------------------------------------------------------
// 1. A ISCA DO NOME PRÓPRIO (§5-A) — o termo-ODS está no nome de alguém.
// ---------------------------------------------------------------------------

// O caso mais numeroso e o último a cair: a ODS 2 exibia 60 de 75 atos do tipo
// "Designa Fulana, Nutricionista". O que casava era a profissão da pessoa.
recusa('cargo de quem recebe: nutricionista', 'Portaria',
    'Designa Vangelina Lins Melo, Nutricionista-Habilitacao, para o Restaurante Universitario.',
    $R . '1 - Designar Vangelina Lins Melo, Nutricionista, matricula SIAPE 1234567.', 2);

// O dispositivo raramente começa no verbo. Sem descascar "resolve: art. 1º -",
// o verbo não casava e 71 designações passavam batido.
recusa('ato de pessoal com marcador de item', 'Portaria',
    '',
    $R . 'Art. 1o - Dispensar o servidor da Divisao de Moradia Estudantil e Restaurante Universitario.', 2);

// "declara vago o cargo de Engenheiro de Segurança do Trabalho" — cargo, não ODS 8.
recusa('cargo: engenheiro de seguranca do trabalho', 'Portaria',
    'Declara vago o cargo de Engenheiro de Seguranca do Trabalho.',
    $R . 'Declarar vago o cargo de Engenheiro de Seguranca do Trabalho, por posse em outro cargo.', 8);

// Nomeação ANULADA de vaga reservada não é política de cotas.
recusa('vaga reservada em nomeacao tornada sem efeito', 'Portaria',
    'Torna sem efeito a nomeacao em vagas reservadas a negros e pessoas com deficiencia.',
    $R . 'Tornar sem efeito a nomeacao referente as vagas reservadas a negros e pessoa com deficiencia.', 10);

// A isca "nome social" casando "Nomeia ... Social".
recusa('nomeia Superintendente de Comunicacao Social', 'Portaria',
    'Nomeia o Superintendente de Comunicacao Social.',
    $R . 'Nomear o titular da Superintendencia de Comunicacao Social.', 5);

// Nome do PARCEIRO, não política ambiental.
recusa('parceiro chamado Socioambiental', 'Portaria',
    'Ratifica convenio para estagio com o Instituto Biasse Socioambiental.',
    $R . 'Ratificar o convenio para estagio celebrado com o Instituto Biasse Socioambiental.', 12);

// A isca mais numerosa: 193 atos de folha com "governança" no NOME DO EMISSOR.
recusa('governanca no nome do orgao emissor (EGGP)', 'Portaria',
    'Concede progressao por capacitacao.',
    $R . 'A Escola de Governanca em Gestao Publica concede progressao por capacitacao ao servidor.', 16);

// O termo-ODS no NOME DA UNIDADE remanejada, não no objeto do ato.
recusa('remanejo de codigo de chefia (unidade com termo-ODS)', 'Portaria',
    'Altera codigos de chefia.',
    $R . 'Situacao atual Situacao transformada: excluir CD-3 da Divisao de Saude Ocupacional.', 3);

// ---------------------------------------------------------------------------
// 2. PALAVRA COMUM HOMÔNIMA — jargão administrativo que não é o conceito.
// ---------------------------------------------------------------------------

// "inclusão de disciplina" não é inclusão social. Sem a guarda, alteração
// curricular de Estatística virava evidência de ODS 10.
recusa('inclusao de disciplina (jargao curricular)', 'Resolucao',
    'Aprova a inclusao de disciplina no curriculo do curso de Estatistica.',
    $R . 'Aprovar a criacao de disciplinas e a inclusao de disciplina no curso.', 10);

// "Bioética" é nome de curso, não comissão de ética.
recusa('bioetica (nome de curso)', 'Resolucao',
    'Cria o curso de especializacao em Bioetica.',
    $R . 'Criar o curso de especializacao em Bioetica.', 16);

// ---------------------------------------------------------------------------
// 3. CONTAMINAÇÃO PELO CORPO — designação de colegiado cujo corpo cita o tema.
// ---------------------------------------------------------------------------

// "Designar representantes do Comitê Científico da Agenda Acadêmica" virou
// evidência de creche (2012) e de assistência estudantil (2014) — as duas pelo
// CORPO, nenhuma pela ementa. Cluster `creche` só vale com sinal na ementa.
recusa('creche citada na programacao do corpo', 'Portaria',
    'Designa representantes do Comite Cientifico da Agenda Academica.',
    $R . 'Designar os representantes do Comite Cientifico da Agenda Academica, cuja programacao inclui '
       . 'mesa sobre creche e educacao infantil no campus.', 5);

// ---------------------------------------------------------------------------
// 4. VERDADEIROS-POSITIVOS que precisam sobreviver.
// ---------------------------------------------------------------------------

// A CPEG estava na cauda longa como "caso único": os padrões tinham AFIDE,
// SEPAD e CPPIQ, mas ela é "Comissão Permanente PARA Equidade de Gênero" — uma
// preposição diferente e a evidência sumia. Achado lendo o painel no ar.
aceita('CPEG — equidade de genero (falso-negativo ja medido)', 'Portaria',
    'Constitui a Comissao Permanente para Equidade de Genero.',
    $R . 'Instituir a Comissao Permanente para Equidade de Genero no ambito da UFF.', 5, 'proposta');

aceita('Plano de Integridade', 'Resolucao',
    'Aprova o Plano de Integridade da UFF.',
    $R . 'Aprovar o Plano de Integridade e o programa de integridade da Universidade.', 16, 'proposta');

aceita('PLS — logistica sustentavel', 'Resolucao',
    'Institui o Plano de Logistica Sustentavel 2025-2028.',
    $R . 'Instituir o Plano de Logistica Sustentavel da UFF para o periodo 2025-2028.', 12, 'proposta');

aceita('nome social de travestis e transexuais', 'Decisao',
    'Regulamenta a inclusao do nome social de travestis e transexuais.',
    $R . 'Regulamentar a inclusao do nome social de travestis e transexuais nos registros academicos.', 5, 'proposta');

aceita('CEUA — uso de animais', 'Resolucao',
    'Cria a Comissao de Etica no Uso de Animais.',
    $R . 'Criar a comissao de etica no uso de animais no ensino e na pesquisa.', 15, 'proposta');

// Designação de COLEGIADO sobrevive: é execução legítima de política, e o tema
// vem da ementa, onde o colegiado se nomeia.
aceita('designa membros de colegiado (execucao legitima)', 'Portaria',
    'Designa membros para compor a Comissao de Etica da UFF.',
    $R . 'Designar os membros para compor a Comissao de Etica da UFF.', 16, 'execucao');

// ---------------------------------------------------------------------------
// 5. PROPOSTA vs EXECUÇÃO — o verbo decide. Sem esta separação, 671
//    instrumentos individuais entravam como proposta e a ODS 17 sozinha
//    respondia por 68% das propostas do dossiê.
// ---------------------------------------------------------------------------

aceita('politica de internacionalizacao e PROPOSTA', 'Resolucao',
    'Institui a politica de internacionalizacao da UFF.',
    $R . 'Instituir a politica de internacionalizacao da Universidade Federal Fluminense.', 17, 'proposta');

aceita('acordo individual e EXECUCAO, nao proposta', 'Portaria',
    'Aprova acordo de cooperacao internacional com a Universidade de Coimbra.',
    $R . 'Designar o coordenador do acordo de cooperacao internacional com a Universidade de Coimbra.', 17, 'execucao');

// ---------------------------------------------------------------------------
// 6. RECORTE — o que nem deveria ser candidato.
// ---------------------------------------------------------------------------

// Tipo não normativo não propõe política.
recusa('tipo nao normativo nao entra', 'Determinacao de Servico',
    'Institui a politica de gestao de riscos.',
    $R . 'Instituir a politica de gestao de riscos.', null);

// Aposentadoria/pensão: ato de pessoal puro.
recusa('concessao de aposentadoria', 'Portaria',
    'Concede aposentadoria a servidora da area de saude mental.',
    $R . 'Conceder aposentadoria voluntaria a servidora lotada no setor de saude mental.', null);

// ODS 4 infla: regulamento de TCC não é política de acesso/permanência.
recusa('regulamento de TCC nao e ODS 4', 'Resolucao',
    'Aprova o regulamento do trabalho de conclusao de curso.',
    $R . 'Aprovar o regulamento do trabalho de conclusao de curso e as atividades complementares.', 4);

// ---------------------------------------------------------------------------
echo "\nODS match: $ok caso(s) OK, $falhas falha(s).\n";
exit($falhas > 0 ? 1 : 0);
