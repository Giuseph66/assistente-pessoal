/**
 * Migration 003 - Tabelas para sistema de análise de IA
 */
const version = 3;

function up(db) {
  db.exec(`
    -- Tabela de provedores de IA
    CREATE TABLE IF NOT EXISTS ai_providers (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      base_url TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Tabela de modelos disponíveis por provedor
    CREATE TABLE IF NOT EXISTS ai_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id TEXT NOT NULL,
      model_name TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      metadata_json TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (provider_id) REFERENCES ai_providers(id),
      UNIQUE(provider_id, model_name)
    );

    -- Tabela de API keys (criptografadas)
    CREATE TABLE IF NOT EXISTS ai_api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id TEXT NOT NULL,
      alias TEXT NOT NULL,
      encrypted_key TEXT NOT NULL,
      last4 TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      cooldown_until INTEGER,
      success_count INTEGER DEFAULT 0,
      failure_count INTEGER DEFAULT 0,
      last_error_code TEXT,
      last_used_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (provider_id) REFERENCES ai_providers(id)
    );

    -- Tabela de sessões de análise
    CREATE TABLE IF NOT EXISTS ai_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      screenshot_id INTEGER NOT NULL,
      provider_id TEXT NOT NULL,
      model_name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (screenshot_id) REFERENCES screenshots(id),
      FOREIGN KEY (provider_id) REFERENCES ai_providers(id)
    );

    -- Tabela de mensagens de chat
    CREATE TABLE IF NOT EXISTS ai_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES ai_sessions(id)
    );

    -- Tabela de execuções (runs) de análise
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

    -- Tabela de templates de prompts
    CREATE TABLE IF NOT EXISTS ai_prompt_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      prompt_text TEXT NOT NULL,
      category TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Índices
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
    DROP INDEX IF EXISTS idx_ai_runs_created;
    DROP INDEX IF EXISTS idx_ai_runs_session;
    DROP INDEX IF EXISTS idx_ai_messages_session;
    DROP INDEX IF EXISTS idx_ai_sessions_screenshot;
    DROP INDEX IF EXISTS idx_ai_api_keys_provider;
    DROP INDEX IF EXISTS idx_ai_models_provider;

    DROP TABLE IF EXISTS ai_prompt_templates;
    DROP TABLE IF EXISTS ai_runs;
    DROP TABLE IF EXISTS ai_messages;
    DROP TABLE IF EXISTS ai_sessions;
    DROP TABLE IF EXISTS ai_api_keys;
    DROP TABLE IF EXISTS ai_models;
    DROP TABLE IF EXISTS ai_providers;
  `);
}

module.exports = {
  version,
  up,
  down,
};


