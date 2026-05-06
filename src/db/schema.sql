-- Nova Database Schema v0.1
-- SQLite

CREATE TABLE IF NOT EXISTS projects (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  subgenre      TEXT NOT NULL,              -- 'urban_legend' | 'folk_horror'
  premise       TEXT NOT NULL,              -- 一句话核心创意
  target_words  INTEGER NOT NULL,
  target_chapters INTEGER NOT NULL,
  words_per_chapter INTEGER DEFAULT 3000,
  status        TEXT DEFAULT 'draft',       -- draft|outlining|writing|done
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS characters (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  role          TEXT,                        -- protagonist|antagonist|supporting
  gender        TEXT,
  identity      TEXT,                        -- 身份/职业
  appearance    TEXT,                        -- 外貌
  personality   TEXT,
  secret        TEXT,                        -- 秘密/动机
  relationships TEXT,                        -- JSON: {char_id: 关系描述}
  first_chapter INTEGER,
  locked_fields TEXT,                        -- JSON 数组
  created_at    INTEGER
);

CREATE TABLE IF NOT EXISTS volumes (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  index_no      INTEGER NOT NULL,
  title         TEXT NOT NULL,
  summary       TEXT,
  arc_goal      TEXT
);

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
  status        TEXT DEFAULT 'pending',      -- pending|generating|done|error
  generated_at  INTEGER,
  edited_at     INTEGER
);

CREATE TABLE IF NOT EXISTS lore_entries (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,              -- location|monster|item|organization|rule
  name          TEXT NOT NULL,
  description   TEXT,
  first_chapter INTEGER,
  locked        INTEGER DEFAULT 0,
  metadata      TEXT                        -- JSON
);

CREATE TABLE IF NOT EXISTS foreshadows (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  planted_chapter INTEGER,
  payoff_chapter  INTEGER,
  status        TEXT DEFAULT 'planted'       -- planted|paid_off
);

CREATE TABLE IF NOT EXISTS chapter_versions (
  id            TEXT PRIMARY KEY,
  chapter_id    TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  reason        TEXT,                        -- 'manual'|'ai_polish'|'ai_rewrite'
  created_at    INTEGER
);

CREATE TABLE IF NOT EXISTS api_usage (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    TEXT,
  operation     TEXT,                        -- outline|chapter|polish|extract
  model         TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cost_cny      REAL,
  created_at    INTEGER
);

CREATE TABLE IF NOT EXISTS settings (
  key           TEXT PRIMARY KEY,
  value         TEXT
);
