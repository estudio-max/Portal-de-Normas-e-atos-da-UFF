<?php
// Variantes de matrícula e o árbitro de nome do dossiê (Meu SIAPE).
// Roda sem banco: extrai as duas funções puras do index_v2.php.
$src = file_get_contents(__DIR__ . '/../backend/api/index_v2.php');
foreach (['nome_ascii', 'nome_tokens', 'nomes_mesma_pessoa'] as $fn) {
    preg_match('/\nfunction ' . $fn . '\(.*?\n\}/s', $src, $m) or exit("nao achei $fn\n");
    eval($m[0]);
}

// Mesmas variantes que dossie() monta.
function variantes(string $chave): array {
    $v = [];
    if (strlen($chave) === 7) { $v[] = substr($chave, 0, 6); $v[] = substr($chave, 1); }
    elseif (strlen($chave) === 6) {
        for ($d = 0; $d <= 9; $d++) $v[] = $chave . $d;
        for ($d = 1; $d <= 9; $d++) $v[] = $d . $chave;
    }
    return $v;
}

$erros = 0;
$ok = function (bool $cond, string $msg) use (&$erros) { if (!$cond) { $erros++; echo "FALHOU: $msg\n"; } };

// --- variantes: o segundo vínculo tem que estar nos dois sentidos -----------
$ok(in_array('139693', variantes('7139693'), true),  '7139693 -> 139693 (tira o prefixo de vínculo)');
$ok(in_array('713969', variantes('7139693'), true),  '7139693 -> 713969 (tira o DV)');
$ok(in_array('7139693', variantes('139693'), true),  '139693 -> 7139693 (tenta o vínculo)');
$ok(in_array('1396932', variantes('139693'), true),  '139693 -> 1396932 (tenta o DV)');
$ok(!in_array('0139693', variantes('139693'), true), 'nao gera prefixo 0 (zero a esquerda ja colapsa na chave)');

// --- árbitro de nome -------------------------------------------------------
// o caso real que revelou o segundo vínculo: sobrenome duplicado na captura
$ok(nomes_mesma_pessoa('Denise Rosas Aparecida de Miranda Rosas',
                       'Denise Aparecida de Miranda Rosas'), 'Denise: sobrenome duplicado');
$ok(nomes_mesma_pessoa('Antônio Ribeiro de Oliveira Júnior',
                       'Antonio Ribeiro de Oliveira Junior'), 'so muda o acento');
// Regressao de plataforma: com iconv('ASCII//TRANSLIT') o libiconv do Windows
// devolve "Ant^onio" e o token parte em dois ("ant"+"onio"), enquanto o glibc
// do servidor devolve "Antonio". A dobra tem que ser a MESMA nas duas maquinas.
$ok(nome_tokens('Antônio') === ['antonio'], 'acento nao parte o token (NFC)');
$ok(nome_tokens("Anto\u{0302}nio") === ['antonio'], 'acento nao parte o token (NFD)');
$ok(nome_tokens('Conceição Inês') === ['conceicao', 'ines'], 'cedilha e circunflexo');
$ok(nomes_mesma_pessoa('Rose Mary Latini Cova', 'Rose Mary Latini'), 'nome de casada acrescenta sobrenome');
$ok(nomes_mesma_pessoa('Marcelo Badaró Mattos', 'Marcelo Badaró'), 'sobrenome comido pelo OCR');
// pessoas diferentes que dividem a base da matrícula — tem que RECUSAR
$ok(!nomes_mesma_pessoa('Aída Marques', 'Roberto Godofredo Fabri Ferreira'), 'pessoas diferentes');
$ok(!nomes_mesma_pessoa('Decio Luiz Bento de Mello', 'Décio Luiz Bento de Melo'), 'Melo != Mello: nao arrisca');
// a guarda de 2 tokens: um primeiro nome so nao une ninguem
$ok(!nomes_mesma_pessoa('Marcelo', 'Marcelo Badaró Mattos'), '1 token nao basta');
$ok(!nomes_mesma_pessoa('', 'Denise Aparecida de Miranda Rosas'), 'nome vazio nao une');

echo $erros ? "$erros falha(s)\n" : "ok\n";
exit($erros ? 1 : 0);
