import initSqlJs, { Database, SqlJsStatic } from 'sql.js'
import fs from 'fs'
import path from 'path'

let SQL: SqlJsStatic | null = null

export class DatabaseManager {
  private db: Database | null = null
  private dbPath: string

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
  }

  public persist(): void {
    if (!this.db) return
    const data = this.db.export()
    const buffer = Buffer.from(data)
    fs.writeFileSync(this.dbPath, buffer)
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
