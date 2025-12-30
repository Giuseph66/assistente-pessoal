/**
 * Migration 004 - Estender tabela screenshots com campos para otimização e tags
 */
const version = 4;

function up(db) {
  db.exec(`
    -- Adicionar coluna para caminho da imagem otimizada
    ALTER TABLE screenshots ADD COLUMN optimized_path TEXT;

    -- Adicionar coluna para tags (JSON array)
    ALTER TABLE screenshots ADD COLUMN tags_json TEXT;
  `);
}

function down(db) {
  // SQLite não suporta DROP COLUMN diretamente
  // Seria necessário recriar a tabela, mas isso é complexo
  // Por enquanto, apenas documentamos que a reversão não é trivial
  // Em produção, isso seria feito via migration mais complexa
  db.exec(`
    -- SQLite não suporta DROP COLUMN
    -- A reversão completa exigiria recriar a tabela
    -- Por enquanto, apenas marcamos como não reversível
  `);
}

module.exports = {
  version,
  up,
  down,
};


