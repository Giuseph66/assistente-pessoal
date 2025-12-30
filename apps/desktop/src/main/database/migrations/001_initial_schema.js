/**
 * Migration inicial - cria todas as tabelas base
 */
const version = 1;

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      panel_type TEXT DEFAULT 'notes'
    );

    CREATE TABLE IF NOT EXISTS transcription_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      language TEXT DEFAULT 'en',
      total_segments INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transcription_segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      translated_text TEXT,
      confidence REAL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES transcription_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS screenshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL UNIQUE,
      file_size INTEGER,
      width INTEGER,
      height INTEGER,
      mode TEXT NOT NULL,
      source_app TEXT,
      monitor_index INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      payload TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sessions_started ON transcription_sessions(started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_segments_session ON transcription_segments(session_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_screenshots_created ON screenshots(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_events_created ON system_events(created_at DESC);
  `);
}

function down(db) {
  db.exec(`
    DROP INDEX IF EXISTS idx_events_created;
    DROP INDEX IF EXISTS idx_screenshots_created;
    DROP INDEX IF EXISTS idx_segments_session;
    DROP INDEX IF EXISTS idx_sessions_started;
    DROP INDEX IF EXISTS idx_notes_updated;
    
    DROP TABLE IF EXISTS system_events;
    DROP TABLE IF EXISTS screenshots;
    DROP TABLE IF EXISTS transcription_segments;
    DROP TABLE IF EXISTS transcription_sessions;
    DROP TABLE IF EXISTS notes;
  `);
}

module.exports = {
  version,
  up,
  down,
};
