/**
 * Migration 005 - add recognized_text to ai_messages
 */
const version = 5;

function up(db) {
  const columns = db
    .prepare("PRAGMA table_info('ai_messages')")
    .all()
    .map((row) => row.name);

  if (!columns.includes('recognized_text')) {
    db.exec('ALTER TABLE ai_messages ADD COLUMN recognized_text TEXT');
  }
}

function down(db) {
  // SQLite doesn't support dropping columns easily; leave as-is.
}

module.exports = {
  version,
  up,
  down,
};
