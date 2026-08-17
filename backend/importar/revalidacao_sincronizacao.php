<?php

/**
 * Executa uma operação de forma atômica sem confirmar ou reverter a transação
 * de quem chamou. Quando já existe transação, um savepoint delimita somente a
 * sincronização deste ato.
 */
function executar_atomico_revalidacao(object $conexao, callable $operacao): void {
    static $sequencia = 0;
    $transacaoExterna = $conexao->inTransaction();
    $savepoint = 'backfill_revalidacao_' . (++$sequencia);

    if ($transacaoExterna) {
        $conexao->exec("SAVEPOINT $savepoint");
    } else {
        $conexao->beginTransaction();
    }

    try {
        $operacao();
        if ($transacaoExterna) {
            $conexao->exec("RELEASE SAVEPOINT $savepoint");
        } else {
            $conexao->commit();
        }
    } catch (Throwable $erro) {
        try {
            if ($transacaoExterna) {
                $conexao->exec("ROLLBACK TO SAVEPOINT $savepoint");
                $conexao->exec("RELEASE SAVEPOINT $savepoint");
            } elseif ($conexao->inTransaction()) {
                $conexao->rollBack();
            }
        } catch (Throwable $erroRollback) {
            throw new RuntimeException(
                'Falha ao reverter sincronização de revalidações: ' . $erroRollback->getMessage(),
                0,
                $erro
            );
        }
        throw $erro;
    }
}

/**
 * Substitui todas as revalidações de um ato preservando a ordem documental.
 * Os callables permitem reutilizar statements preparados e testar sem banco.
 */
function sincronizar_revalidacoes_ato(
    object $conexao,
    int|string $atoId,
    array $achados,
    bool $diagnostico,
    callable $remover,
    callable $inserir
): void {
    if ($diagnostico || !$achados) return;

    executar_atomico_revalidacao($conexao, static function () use (
        $atoId,
        $achados,
        $remover,
        $inserir
    ): void {
        $remover($atoId);
        foreach ($achados as $idx => $achou) {
            $inserir($atoId, $idx + 1, $achou);
        }
    });
}
