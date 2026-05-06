import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (db) return db;

  db = await Database.load("sqlite:nova.db");

  // Run migrations on first load
  await db.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL,
      subgenre      TEXT NOT NULL,
      premise       TEXT NOT NULL,
      target_words  INTEGER NOT NULL,
      target_chapters INTEGER NOT NULL,
      words_per_chapter INTEGER DEFAULT 3000,
      status        TEXT DEFAULT 'draft',
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS characters (
      id            TEXT PRIMARY KEY,
      project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      role          TEXT,
      gender        TEXT,
      identity      TEXT,
      appearance    TEXT,
      personality   TEXT,
      secret        TEXT,
      relationships TEXT,
      first_chapter INTEGER,
      locked_fields TEXT,
      created_at    INTEGER
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS volumes (
      id            TEXT PRIMARY KEY,
      project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      index_no      INTEGER NOT NULL,
      title         TEXT NOT NULL,
      summary       TEXT,
      arc_goal      TEXT
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chapters (
      id            TEXT PRIMARY KEY,
      project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      volume_id     TEXT REFERENCES volumes(id),
      index_no      INTEGER NOT NULL,
      title         TEXT NOT NULL,
      outline       TEXT,
      horror_beat   TEXT,
      hook          TEXT,
      content       TEXT,
      summary       TEXT,
      word_count    INTEGER DEFAULT 0,
      status        TEXT DEFAULT 'pending',
      generated_at  INTEGER,
      edited_at     INTEGER
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS lore_entries (
      id            TEXT PRIMARY KEY,
      project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      category      TEXT NOT NULL,
      name          TEXT NOT NULL,
      description   TEXT,
      first_chapter INTEGER,
      locked        INTEGER DEFAULT 0,
      metadata      TEXT
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS foreshadows (
      id            TEXT PRIMARY KEY,
      project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      description   TEXT NOT NULL,
      planted_chapter INTEGER,
      payoff_chapter  INTEGER,
      status        TEXT DEFAULT 'planted'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chapter_versions (
      id            TEXT PRIMARY KEY,
      chapter_id    TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
      content       TEXT NOT NULL,
      reason        TEXT,
      created_at    INTEGER
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS api_usage (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id    TEXT,
      operation     TEXT,
      model         TEXT,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      cost_cny      REAL,
      created_at    INTEGER
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key           TEXT PRIMARY KEY,
      value         TEXT
    )
  `);

  return db;
}
