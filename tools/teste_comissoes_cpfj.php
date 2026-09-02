<?php
require __DIR__ . '/../backend/importar/comissoes_match.php';
$casos = [
  // saída do setor — a família que faltava (Portaria 68.930/2026 e as 37 irmãs)
  ['Revogar a Portaria 68.484/2023 - Jornada Flexibilizada da Biblioteca da Biblioteca de Rio das Ostras - BRO/SDC', true],
  ['Revogar as Portaria 66.469/ 2020 e sua retificação Portaria 68386/ 2022 - Jornada Flexibilizada do INSTITUTO', true],
  // entrada e vida do colegiado — continuam casando
  ['Aprova o plano de flexibilização da jornada de trabalho dos servidores', true],
  ['Retificação dos membros integrantes da Comissão Permanente de Flexibilização de Jornada', true],
  // homônimo de unidade — segue vetado mesmo com a frase nova
  ['Revogar a Portaria X - Jornada Flexibilizada do hospital universitário', false],
  // sem relação
  ['Designa Fulano de Tal, Professor do Magistério Superior.', false],
];
$erros = 0;
foreach ($casos as [$ementa, $esperado]) {
    $tem = in_array('cpfj', comissoes_do_texto($ementa), true);
    if ($tem !== $esperado) { $erros++; echo "FALHOU: $ementa\n"; }
}
echo $erros ? "$erros falha(s)\n" : "ok\n";
exit($erros ? 1 : 0);
