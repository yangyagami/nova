-- Nova Database Schema v0.1
-- SQLite

CREATE TABLE IF NOT EXISTS projects (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  project_type  TEXT NOT NULL DEFAULT 'novel',  -- 'novel' | 'anthology'
  subgenre      TEXT NOT NULL,              -- 'urban_legend' | 'folk_horror'
  premise       TEXT NOT NULL,              -- 长篇：核心创意；选集：合集主题
  target_words  INTEGER NOT NULL,
  target_chapters INTEGER NOT NULL,         -- 长篇：章节数；选集：故事数量
  words_per_chapter INTEGER DEFAULT 3000,   -- 长篇：每章字数；选集：每篇字数
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
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  volume_id         TEXT REFERENCES volumes(id),  -- 选集模式为 NULL
  index_no          INTEGER NOT NULL,
  title             TEXT NOT NULL,
  outline           TEXT,                        -- 长篇：章节细纲；选集：故事细纲
  horror_beat       TEXT,                        -- 本篇/章核心恐怖点
  hook              TEXT,                        -- 篇/章末钩子
  content           TEXT,                        -- 正文
  summary           TEXT,                        -- AI 自动生成的摘要
  word_count        INTEGER DEFAULT 0,
  status            TEXT DEFAULT 'pending',      -- pending|generating|done|error
  -- 选集模式专属字段
  story_premise     TEXT,                        -- 本篇故事的核心创意
  story_setting     TEXT,                        -- 本篇故事的发生场景/地点
  story_protagonist TEXT,                        -- 本篇故事的主角名
  generated_at      INTEGER,
  edited_at         INTEGER
);

CREATE TABLE IF NOT EXISTS lore_entries (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  chapter_id    TEXT REFERENCES chapters(id),     -- 选集模式限定单篇，NULL 表示全局
  category      TEXT NOT NULL,                    -- location|monster|item|organization|rule
  name          TEXT NOT NULL,
  description   TEXT,
  first_chapter INTEGER,
  locked        INTEGER DEFAULT 0,
  metadata      TEXT                              -- JSON
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
