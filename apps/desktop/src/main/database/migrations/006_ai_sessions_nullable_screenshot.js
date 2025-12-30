/**
 * Migration 006 - Permitir sessões de IA sem screenshot
 */
const version = 6;

function up(db) {
  db.exec(`
    ALTER TABLE ai_messages RENAME TO ai_messages_old;
    ALTER TABLE ai_runs RENAME TO ai_runs_old;
    ALTER TABLE ai_sessions RENAME TO ai_sessions_old;

    CREATE TABLE IF NOT EXISTS ai_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      screenshot_id INTEGER,
      provider_id TEXT NOT NULL,
      model_name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (screenshot_id) REFERENCES screenshots(id),
      FOREIGN KEY (provider_id) REFERENCES ai_providers(id)
    );

    INSERT INTO ai_sessions (id, screenshot_id, provider_id, model_name, created_at)
    SELECT id, screenshot_id, provider_id, model_name, created_at FROM ai_sessions_old;

    CREATE TABLE IF NOT EXISTS ai_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      recognized_text TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES ai_sessions(id)
    );

    INSERT INTO ai_messages (id, session_id, role, content, recognized_text, created_at)
    SELECT id, session_id, role, content, recognized_text, created_at FROM ai_messages_old;

    CREATE TABLE IF NOT EXISTS ai_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      provider_id TEXT NOT NULL,
      model_name TEXT NOT NULL,
      api_key_id INTEGER,
      status TEXT NOT NULL,
      duration_ms INTEGER,
      error_code TEXT,
      error_message_redacted TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES ai_sessions(id),
      FOREIGN KEY (provider_id) REFERENCES ai_providers(id),
      FOREIGN KEY (api_key_id) REFERENCES ai_api_keys(id)
    );

    INSERT INTO ai_runs (id, session_id, provider_id, model_name, api_key_id, status, duration_ms, error_code, error_message_redacted, created_at)
    SELECT id, session_id, provider_id, model_name, api_key_id, status, duration_ms, error_code, error_message_redacted, created_at FROM ai_runs_old;

    DROP TABLE ai_messages_old;
    DROP TABLE ai_runs_old;
    DROP TABLE ai_sessions_old;

    CREATE INDEX IF NOT EXISTS idx_ai_models_provider ON ai_models(provider_id);
    CREATE INDEX IF NOT EXISTS idx_ai_api_keys_provider ON ai_api_keys(provider_id, status);
    CREATE INDEX IF NOT EXISTS idx_ai_sessions_screenshot ON ai_sessions(screenshot_id);
    CREATE INDEX IF NOT EXISTS idx_ai_messages_session ON ai_messages(session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_ai_runs_session ON ai_runs(session_id);
    CREATE INDEX IF NOT EXISTS idx_ai_runs_created ON ai_runs(created_at DESC);
  `);
}

function down(db) {
  db.exec(`
    ALTER TABLE ai_messages RENAME TO ai_messages_old;
    ALTER TABLE ai_runs RENAME TO ai_runs_old;
    ALTER TABLE ai_sessions RENAME TO ai_sessions_old;

    CREATE TABLE IF NOT EXISTS ai_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      screenshot_id INTEGER NOT NULL,
      provider_id TEXT NOT NULL,
      model_name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (screenshot_id) REFERENCES screenshots(id),
      FOREIGN KEY (provider_id) REFERENCES ai_providers(id)
    );

    INSERT INTO ai_sessions (id, screenshot_id, provider_id, model_name, created_at)
    SELECT id, screenshot_id, provider_id, model_name, created_at
    FROM ai_sessions_old
    WHERE screenshot_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS ai_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      recognized_text TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES ai_sessions(id)
    );

    INSERT INTO ai_messages (id, session_id, role, content, recognized_text, created_at)
    SELECT id, session_id, role, content, recognized_text, created_at
    FROM ai_messages_old
    WHERE session_id IN (SELECT id FROM ai_sessions);

    CREATE TABLE IF NOT EXISTS ai_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      provider_id TEXT NOT NULL,
      model_name TEXT NOT NULL,
      api_key_id INTEGER,
      status TEXT NOT NULL,
      duration_ms INTEGER,
      error_code TEXT,
      error_message_redacted TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES ai_sessions(id),
      FOREIGN KEY (provider_id) REFERENCES ai_providers(id),
      FOREIGN KEY (api_key_id) REFERENCES ai_api_keys(id)
    );

    INSERT INTO ai_runs (id, session_id, provider_id, model_name, api_key_id, status, duration_ms, error_code, error_message_redacted, created_at)
    SELECT id, session_id, provider_id, model_name, api_key_id, status, duration_ms, error_code, error_message_redacted, created_at
    FROM ai_runs_old
    WHERE session_id IN (SELECT id FROM ai_sessions);

    DROP TABLE ai_messages_old;
    DROP TABLE ai_runs_old;
    DROP TABLE ai_sessions_old;

    CREATE INDEX IF NOT EXISTS idx_ai_models_provider ON ai_models(provider_id);
    CREATE INDEX IF NOT EXISTS idx_ai_api_keys_provider ON ai_api_keys(provider_id, status);
    CREATE INDEX IF NOT EXISTS idx_ai_sessions_screenshot ON ai_sessions(screenshot_id);
    CREATE INDEX IF NOT EXISTS idx_ai_messages_session ON ai_messages(session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_ai_runs_session ON ai_runs(session_id);
    CREATE INDEX IF NOT EXISTS idx_ai_runs_created ON ai_runs(created_at DESC);
  `);
}

module.exports = {
  version,
  up,
  down,
};
