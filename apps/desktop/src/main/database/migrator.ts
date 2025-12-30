import Database from 'better-sqlite3';
import { join } from 'path';
import { readdirSync, existsSync } from 'fs';

/**
 * Interface para migrations
 */
export interface Migration {
  version: number;
  up: (db: Database.Database) => void;
  down: (db: Database.Database) => void;
}

/**
 * Executor de migrations
 */
export class Migrator {
  private db: Database.Database;
  private migrationsDir: string;

  constructor(db: Database.Database, migrationsDir: string) {
    this.db = db;
    this.migrationsDir = migrationsDir;
    this.initSchemaVersion();
  }

  /**
   * Inicializa a tabela de controle de versão
   */
  private initSchemaVersion(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      );
    `);
  }

  /**
   * Obtém a versão atual do schema
   */
  getCurrentVersion(): number {
    const row = this.db.prepare('SELECT MAX(version) as version FROM schema_version').get() as {
      version: number | null;
    };
    return row.version ?? 0;
  }

  /**
   * Carrega todas as migrations do diretório
   */
  private loadMigrations(): Migration[] {
    // Verifica se o diretório existe
    if (!existsSync(this.migrationsDir)) {
      console.warn(`Migrations directory not found: ${this.migrationsDir}`);
      return [];
    }

    const files = readdirSync(this.migrationsDir)
      .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
      .sort();

    const migrations: Migration[] = [];

    for (const file of files) {
      try {
        // Em produção, será .js, em dev será .ts
        const migrationPath = join(this.migrationsDir, file);
        // Para arquivos .ts compilados, precisamos usar .js
        // Para arquivos .ts em dev, precisamos transpilá-los ou usar ts-node
        // Por enquanto, vamos tentar carregar como .js (compilado)
        let migrationPathToLoad = migrationPath;
        if (file.endsWith('.ts')) {
          // Tenta carregar como .js primeiro (compilado)
          migrationPathToLoad = migrationPath.replace(/\.ts$/, '.js');
          if (!existsSync(migrationPathToLoad)) {
            // Se não existe .js, tenta .ts (pode funcionar com ts-node em dev)
            migrationPathToLoad = migrationPath.replace(/\.js$/, '');
          }
        } else {
          migrationPathToLoad = migrationPath.replace(/\.js$/, '');
        }
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const migration = require(migrationPathToLoad);
        if (migration.version && migration.up && migration.down) {
          migrations.push(migration as Migration);
        }
      } catch (error) {
        console.error(`Failed to load migration ${file}:`, error);
      }
    }

    return migrations.sort((a, b) => a.version - b.version);
  }

  /**
   * Executa migrations pendentes
   */
  migrate(): void {
    const currentVersion = this.getCurrentVersion();
    const migrations = this.loadMigrations();
    const pending = migrations.filter((m) => m.version > currentVersion);

    if (pending.length === 0) {
      console.log('Database is up to date');
      return;
    }

    console.log(`Running ${pending.length} migration(s)...`);

    for (const migration of pending) {
      console.log(`Applying migration ${migration.version}...`);
      const transaction = this.db.transaction(() => {
        migration.up(this.db);
        this.db
          .prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)')
          .run(migration.version, Date.now());
      });

      try {
        transaction();
        console.log(`Migration ${migration.version} applied successfully`);
      } catch (error) {
        console.error(`Failed to apply migration ${migration.version}:`, error);
        throw error;
      }
    }

    console.log(`Database migrated to version ${this.getCurrentVersion()}`);
  }

  /**
   * Reverte uma migration específica
   */
  rollback(version: number): void {
    const migrations = this.loadMigrations();
    const migration = migrations.find((m) => m.version === version);

    if (!migration) {
      throw new Error(`Migration ${version} not found`);
    }

    const transaction = this.db.transaction(() => {
      migration.down(this.db);
      this.db.prepare('DELETE FROM schema_version WHERE version = ?').run(version);
    });

    transaction();
    console.log(`Rolled back migration ${version}`);
  }
}

