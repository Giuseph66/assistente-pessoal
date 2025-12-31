/**
 * Migration 007 - Adiciona coluna de resumo às sessões de IA
 */
const version = 7;

function up(db) {
    db.exec(`
    ALTER TABLE ai_sessions ADD COLUMN summary TEXT;
  `);
}

function down(db) {
    // SQLite não suporta DROP COLUMN facilmente em versões antigas, 
    // mas para desenvolvimento podemos apenas ignorar ou recriar a tabela se necessário.
    // Por simplicidade nesta migration:
    console.log('Down migration for 007: DROP COLUMN not supported in simple ALTER TABLE');
}

module.exports = {
    version,
    up,
    down,
};
