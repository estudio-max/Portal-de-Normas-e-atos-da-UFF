// ============================================================================
// teste_ato_revalidacao_schema.mjs — trava estática da chave natural de atos
// de revalidação. Roda sem banco para proteger o SQL aplicado manualmente no
// Percona Server 5.7.
// ============================================================================
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const schema = await readFile(new URL('backend/db/ato_revalidacao.sql', root), 'utf8');
const migracao = await readFile(new URL('backend/db/migrar_ato_revalidacao_multiplas.sql', root), 'utf8');

assert.match(schema, /`ordem`\s+SMALLINT UNSIGNED NOT NULL DEFAULT 1/);
assert.match(schema, /UNIQUE KEY `uq_ato_revalidacao`\s*\(`ato_id`,\s*`ordem`\)/);
assert.doesNotMatch(schema, /UNIQUE KEY `uq_ato_revalidacao`\s*\(`ato_id`\)/);
assert.match(migracao, /information_schema\.COLUMNS/i);
assert.match(migracao, /information_schema\.STATISTICS/i);
assert.match(migracao, /PREPARE\s+stmt/i);
assert.doesNotMatch(migracao, /ADD COLUMN IF NOT EXISTS|DROP INDEX IF EXISTS/i);

console.log('Schema e migração de ato_revalidacao: OK.');
