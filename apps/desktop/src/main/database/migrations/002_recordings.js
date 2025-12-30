/**
 * Migration para registros de gravacoes de audio e legendas
 */
const version = 2;

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS recordings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      source_type TEXT NOT NULL,
      source_id TEXT,
      created_at INTEGER NOT NULL,
      sample_rate INTEGER NOT NULL,
      channels INTEGER NOT NULL,
      bytes INTEGER NOT NULL,
      duration_ms INTEGER
    );

    CREATE TABLE IF NOT EXISTS recording_subtitles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recording_id INTEGER NOT NULL,
      vtt_path TEXT,
      srt_path TEXT,
      created_at INTEGER NOT NULL,
      language TEXT,
      FOREIGN KEY (recording_id) REFERENCES recordings(id)
    );

    CREATE INDEX IF NOT EXISTS idx_recordings_created ON recordings(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_recording_subtitles_recording ON recording_subtitles(recording_id);
  `);
}

function down(db) {
  db.exec(`
    DROP INDEX IF EXISTS idx_recording_subtitles_recording;
    DROP INDEX IF EXISTS idx_recordings_created;

    DROP TABLE IF EXISTS recording_subtitles;
    DROP TABLE IF EXISTS recordings;
  `);
}

module.exports = {
  version,
  up,
  down,
};
