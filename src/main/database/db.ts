import initSqlJs, { Database, SqlJsStatic } from 'sql.js'
import fs from 'fs'
import path from 'path'

let SQL: SqlJsStatic | null = null

export class DatabaseManager {
  private db: Database | null = null
  private dbPath: string
  private inTransaction = false

  constructor(dbPath: string) {
    this.dbPath = dbPath
  }

  public static async getSqlEngine(): Promise<SqlJsStatic> {
    if (!SQL) {
      try {
        const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm')
        SQL = await initSqlJs({
          locateFile: () => wasmPath
        })
      } catch {
        SQL = await initSqlJs()
      }
    }
    return SQL
  }

  public async init(): Promise<void> {
    const engine = await DatabaseManager.getSqlEngine()
    const dir = path.dirname(this.dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    if (fs.existsSync(this.dbPath)) {
      const fileBuffer = fs.readFileSync(this.dbPath)
      this.db = new engine.Database(fileBuffer)
      this.initSchema()
      this.persist()
    } else {
      this.db = new engine.Database()
      this.initSchema()
      this.persist()
    }
  }

  private initSchema(): void {
    if (!this.db) return

    const schema = `
      -- 1. Project
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        script TEXT,
        target_platform TEXT,
        target_duration REAL,
        aspect_ratio TEXT,
        status TEXT NOT NULL DEFAULT 'PLANNING',
        project_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- 2. EditVersion
      CREATE TABLE IF NOT EXISTS edit_versions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        name TEXT NOT NULL,
        video_path TEXT NOT NULL,
        duration REAL,
        fps REAL,
        width INTEGER,
        height INTEGER,
        parent_version_id TEXT,
        created_by TEXT NOT NULL DEFAULT 'USER',
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY(parent_version_id) REFERENCES edit_versions(id)
      );

      -- 3. SourceAsset
      CREATE TABLE IF NOT EXISTS source_assets (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        original_path TEXT NOT NULL,
        proxy_path TEXT,
        thumbnail_path TEXT,
        filename TEXT NOT NULL,
        duration REAL,
        width INTEGER,
        height INTEGER,
        fps REAL,
        codec TEXT,
        file_size INTEGER,
        file_hash TEXT,
        imported_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      -- 4. ReviewComment
      CREATE TABLE IF NOT EXISTS review_comments (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        edit_version_id TEXT NOT NULL,
        timestamp REAL NOT NULL,
        frame_number INTEGER,
        category TEXT NOT NULL,
        priority TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'OPEN',
        created_by TEXT NOT NULL DEFAULT 'User',
        created_at TEXT NOT NULL,
        resolved_at TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY(edit_version_id) REFERENCES edit_versions(id) ON DELETE CASCADE
      );

      -- 5. ReviewAttachment
      CREATE TABLE IF NOT EXISTS review_attachments (
        id TEXT PRIMARY KEY,
        review_comment_id TEXT NOT NULL,
        type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        width INTEGER,
        height INTEGER,
        created_at TEXT NOT NULL,
        FOREIGN KEY(review_comment_id) REFERENCES review_comments(id) ON DELETE CASCADE
      );

      -- 6. Annotation
      CREATE TABLE IF NOT EXISTS annotations (
        id TEXT PRIMARY KEY,
        review_comment_id TEXT NOT NULL,
        type TEXT NOT NULL,
        data_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(review_comment_id) REFERENCES review_comments(id) ON DELETE CASCADE
      );

      -- 7. RevisionPackage
      CREATE TABLE IF NOT EXISTS revision_packages (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        source_version_id TEXT NOT NULL,
        package_path TEXT NOT NULL,
        instructions TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY(source_version_id) REFERENCES edit_versions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_comments_version ON review_comments(edit_version_id);
      CREATE INDEX IF NOT EXISTS idx_versions_project ON edit_versions(project_id);
      CREATE INDEX IF NOT EXISTS idx_sources_project ON source_assets(project_id);
    `
    this.db.run(schema)
    // Additive migration for projects created before persistent SRC thumbnails.
    if (!this.query<{ name: string }>('PRAGMA table_info(source_assets)').some((column) => column.name === 'thumbnail_path')) {
      this.db.run('ALTER TABLE source_assets ADD COLUMN thumbnail_path TEXT')
    }
    // Additive migration for project script (kịch bản phân cảnh).
    if (!this.query<{ name: string }>('PRAGMA table_info(projects)').some((column) => column.name === 'script')) {
      this.db.run('ALTER TABLE projects ADD COLUMN script TEXT')
    }
    // Versioned, additive module migration; existing review/source rows are preserved.
    this.db.run('CREATE TABLE IF NOT EXISTS module_migrations (name TEXT PRIMARY KEY, version INTEGER NOT NULL)')
    if (!this.get('SELECT name FROM module_migrations WHERE name = ?', ['src-analysis-v1'])) {
      try {
        this.db.run(`
        BEGIN TRANSACTION;
        CREATE TABLE source_analysis_runs (
          id TEXT PRIMARY KEY, project_id TEXT NOT NULL, source_asset_id TEXT NOT NULL,
          state TEXT NOT NULL CHECK(state IN ('RUNNING','COMPLETED','FAILED','CANCELLED','INTERRUPTED')),
          model TEXT NOT NULL, returned_model TEXT, protocol TEXT NOT NULL,
          prompt_version TEXT NOT NULL, brief TEXT NOT NULL, file_fingerprint TEXT NOT NULL,
          start_time REAL NOT NULL, end_time REAL NOT NULL,
          summary TEXT NOT NULL DEFAULT '', audio_observed INTEGER NOT NULL DEFAULT 0,
          media_method TEXT NOT NULL DEFAULT 'original', media_note TEXT NOT NULL DEFAULT '',
          review TEXT NOT NULL DEFAULT 'UNREVIEWED' CHECK(review IN ('UNREVIEWED','ACCEPTED','REJECTED')),
          user_note TEXT NOT NULL DEFAULT '', error TEXT, created_at TEXT NOT NULL, completed_at TEXT,
          FOREIGN KEY(project_id) REFERENCES projects(id),
          FOREIGN KEY(source_asset_id) REFERENCES source_assets(id)
        );
        CREATE TABLE source_segments (
          id TEXT PRIMARY KEY, analysis_run_id TEXT NOT NULL,
          start_time REAL NOT NULL, end_time REAL NOT NULL, summary TEXT NOT NULL,
          shot_type TEXT NOT NULL, recommended_use TEXT NOT NULL, scores_json TEXT NOT NULL,
          CHECK(start_time >= 0 AND end_time > start_time),
          FOREIGN KEY(analysis_run_id) REFERENCES source_analysis_runs(id)
        );
        CREATE TABLE source_issues (
          id TEXT PRIMARY KEY, analysis_run_id TEXT NOT NULL,
          start_time REAL NOT NULL, end_time REAL NOT NULL, type TEXT NOT NULL,
          severity TEXT NOT NULL, description TEXT NOT NULL, evidence TEXT NOT NULL,
          CHECK(start_time >= 0 AND end_time > start_time),
          FOREIGN KEY(analysis_run_id) REFERENCES source_analysis_runs(id)
        );
        CREATE TABLE source_tags (
          id TEXT PRIMARY KEY, source_asset_id TEXT NOT NULL, analysis_run_id TEXT,
          tag TEXT NOT NULL, source TEXT NOT NULL CHECK(source IN ('AI','USER','AGENT')),
          FOREIGN KEY(source_asset_id) REFERENCES source_assets(id),
          FOREIGN KEY(analysis_run_id) REFERENCES source_analysis_runs(id)
        );
        CREATE INDEX idx_analysis_source ON source_analysis_runs(source_asset_id, created_at);
        CREATE INDEX idx_analysis_project_state ON source_analysis_runs(project_id, state);
        CREATE INDEX idx_segments_run ON source_segments(analysis_run_id, start_time);
        CREATE INDEX idx_issues_run ON source_issues(analysis_run_id, start_time);
        CREATE INDEX idx_tags_source ON source_tags(source_asset_id, source);
        INSERT INTO module_migrations (name, version) VALUES ('src-analysis-v1', 1);
        COMMIT;
        `)
      } catch (error) {
        this.db.run('ROLLBACK')
        throw error
      }
    }
    if (!this.get('SELECT name FROM module_migrations WHERE name = ?', ['src-analysis-v2-dialogue'])) {
      try {
        this.db.run(`
        BEGIN TRANSACTION;
        CREATE TABLE IF NOT EXISTS source_dialogues (
          id TEXT PRIMARY KEY,
          analysis_run_id TEXT NOT NULL,
          source_asset_id TEXT NOT NULL,
          start_time REAL NOT NULL,
          end_time REAL NOT NULL,
          speaker TEXT,
          text TEXT NOT NULL,
          CHECK(start_time >= 0 AND end_time >= start_time),
          FOREIGN KEY(analysis_run_id) REFERENCES source_analysis_runs(id),
          FOREIGN KEY(source_asset_id) REFERENCES source_assets(id)
        );
        CREATE INDEX IF NOT EXISTS idx_dialogues_run ON source_dialogues(analysis_run_id, start_time);
        CREATE INDEX IF NOT EXISTS idx_dialogues_source ON source_dialogues(source_asset_id, start_time);
        INSERT INTO module_migrations (name, version) VALUES ('src-analysis-v2-dialogue', 2);
        COMMIT;
        `)
      } catch (error) {
        this.db.run('ROLLBACK')
        throw error
      }
    }
  }

  public persist(): void {
    if (!this.db || this.inTransaction) return
    const data = this.db.export()
    const buffer = Buffer.from(data)
    const temporaryPath = `${this.dbPath}.tmp`
    try {
      fs.writeFileSync(temporaryPath, buffer)
      fs.renameSync(temporaryPath, this.dbPath)
    } finally {
      if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath)
    }
  }

  // Synchronous operations only: commit the whole review and its relations once.
  public transaction<T>(operation: () => T): T {
    if (!this.db || !SQL) throw new Error('Database not initialized')
    if (this.inTransaction) throw new Error('Nested transactions are not supported')
    const snapshot = this.db.export()
    this.db.run('BEGIN TRANSACTION')
    this.inTransaction = true
    try {
      const result = operation()
      this.db.run('COMMIT')
      this.inTransaction = false
      this.persist()
      return result
    } catch (error) {
      this.inTransaction = false
      this.db.close()
      this.db = new SQL.Database(snapshot)
      throw error
    }
  }

  public run(sql: string, params: (string | number | null | undefined)[] = []): void {
    if (!this.db) throw new Error('Database not initialized')
    this.db.run(sql, params as (string | number | null)[])
    this.persist()
  }

  public query<T = Record<string, unknown>>(sql: string, params: (string | number | null | undefined)[] = []): T[] {
    if (!this.db) throw new Error('Database not initialized')
    const stmt = this.db.prepare(sql)
    if (params.length > 0) {
      stmt.bind(params as (string | number | null)[])
    }
    const results: T[] = []
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as T)
    }
    stmt.free()
    return results
  }

  public get<T = Record<string, unknown>>(sql: string, params: (string | number | null | undefined)[] = []): T | null {
    const list = this.query<T>(sql, params)
    return list.length > 0 ? list[0] : null
  }

  public close(): void {
    if (this.db) {
      this.persist()
      this.db.close()
      this.db = null
    }
  }
}
