<?php
// Regressão da aba Convênios de Estágio (rota /api/convenios_estagio).
//
// Roda SEM banco: extrai as funções puras do index_v2.php e as executa — mesmo
// mecanismo de teste_siape_variantes.php. É a única cobertura possível desta
// lógica, porque o PHP não roda na máquina do mantenedor; quem só passa no
// portão local não está vendo este arquivo rodar.
//
// Cada caso abaixo é texto REAL do acervo, medido em 14/09/2026 antes de virar
// regra. O painel afirma para a Divisão de Estágio quando um convênio vence:
// data errada aqui não é imprecisão de contagem, é a empresa certa no dia
// errado.
$src = file_get_contents(__DIR__ . '/../backend/api/index_v2.php');
foreach (['nome_ascii', 'coop_paises', 'coop_normaliza_pais', 'coop_instituicao',
          'conv_estagio_vigencia', 'conv_estagio_modalidade', 'conv_estagio_empresa'] as $fn) {
    preg_match('/\nfunction ' . $fn . '\(.*?\n\}/s', $src, $m) or exit("nao achei $fn\n");
    eval($m[0]);
}

$erros = 0;
$ok = function (bool $cond, string $msg) use (&$erros) { if (!$cond) { $erros++; echo "FALHOU: $msg\n"; } };
$eq = function ($obtido, $esperado, string $msg) use (&$erros) {
    if ($obtido !== $esperado) {
        $erros++;
        echo "FALHOU: $msg\n  esperado: " . var_export($esperado, true)
           . "\n  obtido:   " . var_export($obtido, true) . "\n";
    }
};

// --- VIGÊNCIA --------------------------------------------------------------
// As duas pontuações do corpus. A sem hífen é a do PDF da Res. CEPEx 5.801/2026
// (PWC); a com hífen é a da 5.560/2026 (PROGECON). Uma expressão cobre as duas.
$eq(conv_estagio_vigencia('Art. 2º - A vigência do convênio é de 09/11/2025 a 08/11/2030.'),
    ['2025-11-09', '2030-11-08'], 'vigência com hífen depois do "Art. 2º"');
$eq(conv_estagio_vigencia('Art. 2º A vigência do convênio é de 19/02/2026 a 18/02/2031.'),
    ['2026-02-19', '2031-02-18'], 'vigência sem hífen (Res. CEPEx 5.801/2026)');

// A âncora na FRASE é o que separa prazo de convênio de data qualquer. O corpo
// de toda resolução traz a data da sessão, a da assinatura eletrônica e a do
// boletim; sem âncora, "de X a Y" casaria em coisa que não é vigência nenhuma.
$eq(conv_estagio_vigencia('Sala das Sessões, 08 de abril de 2026. Documento assinado '
                        . 'eletronicamente em 15/01/2026, às 12:22, conforme horário '
                        . 'oficial de Brasília. Referência: Processo nº 23069.154480/2026-86'),
    ['', ''], 'data solta no corpo NÃO vira vigência');

// Os convênios de PD&I/Finep citam convênio na ementa igual aos de estágio e
// não declaram vigência — os 5 casos de 2026 medidos na fatia local.
$eq(conv_estagio_vigencia('Art. 1º - Ratificar o Convênio de Pesquisa, Desenvolvimento e '
                        . 'Inovação. Art. 2º - Esta Resolução entrará em vigor na data de '
                        . 'sua publicação.'),
    ['', ''], 'convênio de PD&I (sem Art. 2º de vigência) fica de fora');

// OCR troca dígito. Linha ausente é melhor que data que não existe: a data
// falsa não parece defeito, e é exatamente por isso que contamina o painel.
$eq(conv_estagio_vigencia('A vigência do convênio é de 31/02/2026 a 30/02/2031.'),
    ['', ''], 'data impossível (31/02) é descartada');
$eq(conv_estagio_vigencia('A vigência do convênio é de 09/11/2030 a 08/11/2025.'),
    ['', ''], 'fim anterior ao início é descartado');

// --- MODALIDADE ------------------------------------------------------------
// Medição de 14/09/2026 na fatia local, sobre os 181 convênios aceitos:
// curricular profissional 141, obrigatório 27, curricular 5, obrigatório e não
// obrigatório 4, não obrigatório 1, sem declaração 3. As três redações abaixo
// são as que a primeira versão do classificador deixava em branco.

// A armadilha da ordem: "não obrigatórios" CONTÉM "obrigatórios". Ler a forma
// positiva antes rotularia ao contrário — e o rótulo trocado diz ao aluno que
// o curso exige um estágio que não exige.
$eq(conv_estagio_modalidade('RESOLVE: a concessão de estágios não obrigatórios de complementação educacional'),
    'não obrigatório', 'não obrigatório não é lido como obrigatório');
$eq(conv_estagio_modalidade('RESOLVE: a concessão de estágios OBRIGATÓRIOS de complementação educacional'),
    'obrigatório', 'obrigatório');
$eq(conv_estagio_modalidade('RESOLVE: a concessão de estágios curriculares profissionais de complementação '
                          . 'educacional a estudantes regularmente matriculados'),
    'curricular profissional', 'curricular profissional (a redação dominante, 141 de 181)');
// Ordem invertida das mesmas palavras — a redação que a primeira versão perdia.
$eq(conv_estagio_modalidade('RESOLVE: Estágios Curriculares Obrigatórios de complementação educacional a '
                          . 'estudantes selecionados (as)'),
    'obrigatório', '"Curriculares Obrigatórios" (adjetivo depois) é obrigatório');
$eq(conv_estagio_modalidade('RESOLVE: a concessão de Estágios Curriculares de complementação educacional'),
    'curricular', '"Curriculares" sem "profissionais" nem obrigatoriedade');
// As duas modalidades na mesma frase são resultado legítimo: escolher uma
// esconderia metade do que foi acordado.
$eq(conv_estagio_modalidade('RESOLVE: concessão de estágio extracurricular não obrigatório e curricular '
                          . 'obrigatório a estudantes regularmente matriculados'),
    'obrigatório e não obrigatório', 'convênio que abre as duas modalidades');
$eq(conv_estagio_modalidade('RESOLVE: ESTÁGIO A ESTUDANTES DE AMBAS AS INSTITUIÇÕES DE ENSINO, de interesse '
                          . 'curricular, obrigatório ou não'),
    'obrigatório e não obrigatório', '"obrigatório ou não" declara as duas');

// ⚠️ A ARMADILHA-MÃE: o termo mora no NOME da parte, não no dispositivo. O
// corpo abre com título e ementa, e o nome se repete DENTRO do Art. 1º antes
// da redação que interessa. Estes dois casos são razões sociais reais do
// acervo; sem a varredura de todas as menções, os dois saíam sem modalidade.
$eq(conv_estagio_modalidade('RESOLUÇÃO CEPEx/UFF Nº 1, DE 1 DE JANEIRO DE 2026. Dispõe sobre a ratificação '
                          . 'do Convênio celebrado entre a UFF e a ESTÁGIOS.APP TECNOLOGIA DA INFORMAÇÃO '
                          . 'LTDA. O CONSELHO DE ENSINO, PESQUISA E EXTENSÃO, R E S O L V E : Art. 1º - '
                          . 'Ratificar os atos praticados para a assinatura do convênio entre a UFF e a '
                          . 'ESTÁGIOS.APP TECNOLOGIA DA INFORMAÇÃO LTDA, para formalizar, nos termos da Lei '
                          . 'nº 11.788, de 25 de setembro de 2008, e da Resolução CEPEx/UFF nº 4.071, de 06 '
                          . 'de novembro de 2024, a concessão de estágios curriculares profissionais de '
                          . 'complementação educacional a estudantes.'),
    'curricular profissional', 'razão social com "ESTÁGIOS" não rouba a janela');
$eq(conv_estagio_modalidade('Dispõe sobre a ratificação do Convênio celebrado entre a UFF e o CENTRO '
                          . 'EDUCACIONAL DE TRABALHO E ESTAGIO REMUNERADO. O CONSELHO DE ENSINO, PESQUISA '
                          . 'E EXTENSÃO, R E S O L V E : Art. 1º - Ratificar os atos praticados, a '
                          . 'concessão de estágios OBRIGATÓRIOS de complementação educacional.'),
    'obrigatório', 'razão social com "ESTAGIO REMUNERADO" não rouba a janela');

// Sem redação de modalidade o campo fica VAZIO, e a aba escreve "não
// declarado". Inventar a modalidade dominante para quem não a declara seria
// afirmar pelo ato o que o ato não diz. São 3 dos 181 na fatia medida.
$eq(conv_estagio_modalidade('R E S O L V E : Art. 1º - Ratificar o convênio para concessão de estágio aos '
                          . 'alunos da INSTITUIÇÃO DE ENSINO, regularmente matriculados nos cursos que '
                          . 'esta oferece, por meio de atividades supervisionadas.'),
    '', 'sem obrigatoriedade nem vínculo curricular declarado, campo vazio');

// --- EMPRESA ---------------------------------------------------------------
$eq(conv_estagio_empresa('Dispõe sobre a ratificação do Convênio celebrado entre a '
                       . 'Universidade Federal Fluminense - UFF e a PWC STRATEGY& DO BRASIL '
                       . 'CONSULTORIA EMPRESARIAL LTDA.'),
    'PWC STRATEGY& DO BRASIL CONSULTORIA EMPRESARIAL LTDA', 'empresa na redação de 2026');
// "Concedente" é o PAPEL da parte na Lei 11.788, não parte do nome: deixá-lo
// jogaria a empresa para a letra C na ordenação e quebraria a busca por nome.
$eq(conv_estagio_empresa('Ratificação do Convênio celebrado entre a UFF - UFF e a Concedente '
                       . 'HELP REFORMA E CONSTRUÇÃO LTDA.'),
    'HELP REFORMA E CONSTRUÇÃO LTDA', 'o rótulo "Concedente" não entra no nome');
// Redação de 2021 — "ratificação DE Convênio", sem artigo antes da empresa.
$eq(conv_estagio_empresa('Dispõe sobre a ratificação de Convênio celebrado entre a UFF e '
                       . 'Carl Zeiss Vision Brasil Indústria Óptica Ltda.'),
    'Carl Zeiss Vision Brasil Indústria Óptica Ltda', 'empresa na redação de 2021');

echo $erros ? "$erros falha(s)\n" : "ok\n";
exit($erros ? 1 : 0);
