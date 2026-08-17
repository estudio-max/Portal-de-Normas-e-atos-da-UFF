<?php
// Teste comportamental do nucleo atomico usado pelo backfill de revalidacao.

$falhas = 0;

function checa_sincronizacao(string $rotulo, bool $ok): void {
    global $falhas;
    if (!$ok) {
        $falhas++;
        fwrite(STDERR, "FALHA: $rotulo\n");
    }
}

$helper = __DIR__ . '/revalidacao_sincronizacao.php';
if (is_file($helper)) {
    require_once $helper;
}
if (!function_exists('sincronizar_revalidacoes_ato')) {
    checa_sincronizacao('funcao sincronizar_revalidacoes_ato existe', false);
    exit(1);
}

final class ConexaoRevalidacaoMemoria {
    public array $linhas;
    public array $eventos = [];
    public ?int $falharNaOrdem = null;
    private bool $emTransacao = false;
    private array $inicio = [];
    private array $savepoints = [];

    public function __construct(array $linhas) {
        $this->linhas = $linhas;
    }

    public function beginTransaction(): bool {
        if ($this->emTransacao) throw new RuntimeException('transacao ja iniciada');
        $this->eventos[] = 'BEGIN';
        $this->inicio = $this->linhas;
        $this->emTransacao = true;
        return true;
    }

    public function commit(): bool {
        if (!$this->emTransacao) throw new RuntimeException('sem transacao');
        $this->eventos[] = 'COMMIT';
        $this->inicio = [];
        $this->savepoints = [];
        $this->emTransacao = false;
        return true;
    }

    public function rollBack(): bool {
        if (!$this->emTransacao) throw new RuntimeException('sem transacao');
        $this->eventos[] = 'ROLLBACK';
        $this->linhas = $this->inicio;
        $this->inicio = [];
        $this->savepoints = [];
        $this->emTransacao = false;
        return true;
    }

    public function inTransaction(): bool {
        return $this->emTransacao;
    }

    public function exec(string $sql): int|false {
        $this->eventos[] = $sql;
        if (preg_match('/^SAVEPOINT ([a-z0-9_]+)$/i', $sql, $m)) {
            $this->savepoints[$m[1]] = $this->linhas;
            return 0;
        }
        if (preg_match('/^ROLLBACK TO SAVEPOINT ([a-z0-9_]+)$/i', $sql, $m)) {
            if (!array_key_exists($m[1], $this->savepoints)) throw new RuntimeException('savepoint ausente');
            $this->linhas = $this->savepoints[$m[1]];
            return 0;
        }
        if (preg_match('/^RELEASE SAVEPOINT ([a-z0-9_]+)$/i', $sql, $m)) {
            unset($this->savepoints[$m[1]]);
            return 0;
        }
        throw new RuntimeException("SQL transacional inesperado: $sql");
    }

    public function remover(int|string $atoId): void {
        $this->eventos[] = "DELETE:$atoId";
        $this->linhas = array_values(array_filter(
            $this->linhas,
            static fn(array $linha): bool => $linha['ato_id'] !== $atoId
        ));
    }

    public function inserir(int|string $atoId, int $ordem, array $achado): void {
        $this->eventos[] = "INSERT:$atoId:$ordem";
        if ($this->falharNaOrdem === $ordem) throw new RuntimeException('falha de insert simulada');
        $this->linhas[] = ['ato_id' => $atoId, 'ordem' => $ordem] + $achado;
    }
}

function achado_teste(string $curso): array {
    return [
        'via' => 'Pós-graduação', 'decisao' => 'Deferido',
        'nivel' => 'Doutorado', 'curso' => $curso,
        'instituicao' => "Instituição $curso", 'pais' => 'Reino Unido',
    ];
}

$antiga = ['ato_id' => 42, 'ordem' => 1] + achado_teste('Antigo');
$outra = ['ato_id' => 99, 'ordem' => 1] + achado_teste('Outro ato');
$db = new ConexaoRevalidacaoMemoria([$antiga, $outra]);
$novos = [achado_teste('Primeiro'), achado_teste('Segundo')];
sincronizar_revalidacoes_ato(
    $db, 42, $novos, false,
    [$db, 'remover'], [$db, 'inserir']
);
$doAto = array_values(array_filter($db->linhas, static fn(array $l): bool => $l['ato_id'] === 42));
checa_sincronizacao('remove linhas antigas antes de inserir', count($doAto) === 2);
checa_sincronizacao('insere duas linhas na ordem documental',
    array_column($doAto, 'ordem') === [1, 2]
    && array_column($doAto, 'curso') === ['Primeiro', 'Segundo']);
checa_sincronizacao('preserva linhas de outros atos', in_array($outra, $db->linhas, true));
checa_sincronizacao('confirma transacao propria no sucesso',
    $db->eventos[0] === 'BEGIN' && end($db->eventos) === 'COMMIT');

// O parser singular continua no chamador; o nucleo recebe seu dado ja normalizado.
$dbSingular = new ConexaoRevalidacaoMemoria([]);
$singular = achado_teste('Singular legado');
sincronizar_revalidacoes_ato(
    $dbSingular, 7, [$singular], false,
    [$dbSingular, 'remover'], [$dbSingular, 'inserir']
);
checa_sincronizacao('dado singular normalizado recebe ordem um',
    $dbSingular->linhas === [['ato_id' => 7, 'ordem' => 1] + $singular]);

$estadoDiagnostico = [$antiga, $outra];
$dbDiagnostico = new ConexaoRevalidacaoMemoria($estadoDiagnostico);
$naoChamar = static function (): void { throw new RuntimeException('mutacao no diagnostico'); };
sincronizar_revalidacoes_ato($dbDiagnostico, 42, $novos, true, $naoChamar, $naoChamar);
checa_sincronizacao('diagnostico nao altera estado', $dbDiagnostico->linhas === $estadoDiagnostico);
checa_sincronizacao('diagnostico nao inicia transacao', $dbDiagnostico->eventos === []);

$dbFalha = new ConexaoRevalidacaoMemoria([$antiga, $outra]);
$dbFalha->falharNaOrdem = 2;
$lancou = false;
try {
    sincronizar_revalidacoes_ato(
        $dbFalha, 42, $novos, false,
        [$dbFalha, 'remover'], [$dbFalha, 'inserir']
    );
} catch (RuntimeException $e) {
    $lancou = $e->getMessage() === 'falha de insert simulada';
}
checa_sincronizacao('propaga falha de insert', $lancou);
checa_sincronizacao('rollback proprio restaura estado sem linha parcial',
    $dbFalha->linhas === [$antiga, $outra]);
checa_sincronizacao('rollback proprio encerra somente sua transacao',
    !$dbFalha->inTransaction() && end($dbFalha->eventos) === 'ROLLBACK');

$dbExterna = new ConexaoRevalidacaoMemoria([$antiga, $outra]);
$dbExterna->beginTransaction();
$dbExterna->eventos = [];
$dbExterna->falharNaOrdem = 2;
try {
    sincronizar_revalidacoes_ato(
        $dbExterna, 42, $novos, false,
        [$dbExterna, 'remover'], [$dbExterna, 'inserir']
    );
} catch (RuntimeException $e) {
    // esperado
}
checa_sincronizacao('savepoint restaura estado dentro de transacao externa',
    $dbExterna->linhas === [$antiga, $outra]);
checa_sincronizacao('falha nao encerra transacao externa', $dbExterna->inTransaction());
checa_sincronizacao('falha externa usa savepoint e nao rollback global',
    count(array_filter($dbExterna->eventos, static fn(string $e): bool => str_starts_with($e, 'SAVEPOINT '))) === 1
    && count(array_filter($dbExterna->eventos, static fn(string $e): bool => str_starts_with($e, 'ROLLBACK TO SAVEPOINT '))) === 1
    && !in_array('ROLLBACK', $dbExterna->eventos, true)
    && !in_array('COMMIT', $dbExterna->eventos, true));

exit($falhas === 0 ? 0 : 1);
