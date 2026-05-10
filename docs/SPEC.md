# Nova 恐怖小说生成器 — 技术规格文档（SPEC）

> 版本：v0.2
> 配套文档：`PRD.md`
> 最后更新：2026-05-07

---

## 1. 技术栈总览

| 层 | 技术 | 选型理由 |
|---|---|---|
| 桌面壳 | **Tauri 2.x** | 安装包小（~10MB）、Rust 后端安全、原生 webview |
| 前端框架 | **React 18 + TypeScript 5** | 生态成熟，TipTap/Zustand 友好 |
| 构建工具 | **Vite 5** | Tauri 默认推荐 |
| UI 组件 | **shadcn/ui + Tailwind CSS** | 可定制、暗色主题原生支持（恐怖题材必备） |
| 富文本编辑器 | **TipTap 2** | 基于 ProseMirror，扩展性强，选区操作易实现 |
| 状态管理 | **Zustand** | 轻量、无样板代码 |
| 路由 | **React Router 6** | 标配 |
| 本地存储 | **SQLite**（通过 `tauri-plugin-sql`） | 单文件、嵌入式、零配置 |
| 密钥存储 | **tauri-plugin-stronghold** 或系统 keychain | API Key 加密 |
| HTTP 客户端 | **原生 `fetch` API**（Tauri Webview 无 CORS 限制） | 直接调任意 OpenAI 兼容 API |
| 流式解析 | **手动 SSE 解析**（逐行读取 `ReadableStream`） | 无需额外依赖，支持 `reasoning_content` |
| 文档导出 | **docx**（npm）、原生 fs API | Word/TXT/MD |
| 日志 | **tauri-plugin-log** | 调试与崩溃排查 |

---

## 2. 系统架构

```
┌──────────────────────────────────────────────────────────────┐
│                       Tauri Webview (前端)                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Pages: Dashboard / Project / Editor / Settings        │  │
│  │  Components: OutlineTree / StoryCardList /             │  │
│  │             ChapterEditor / LoreSidebar                │  │
│  │  Hooks: useGenerator / useProject / useStreamingChat   │  │
│  │  Stores: projectStore / settingsStore / generationStore│  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Service Layer (TS)                                     │  │
│  │  - DeepSeekClient (流式 + 重试)                         │  │
│  │  - PromptBuilder (模板 + 上下文注入 + 模式路由)        │  │
│  │  - ContextManager (摘要压缩 + 设定库检索)               │  │
│  │  - LoreExtractor (从正文抽取设定)                       │  │
│  │  - ExportService (TXT/Docx/MD)                          │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────┬───────────────────────────────────┘
                           │ Tauri IPC (invoke)
┌──────────────────────────┴───────────────────────────────────┐
│                    Rust Backend (Tauri Core)                  │
│  - SQL Plugin (SQLite CRUD)                                   │
│  - FS Plugin (导出文件)                                        │
│  - Stronghold (密钥)                                           │
│  - HTTP Plugin (绕过 CORS 调 API)                              │
│  - 系统通知 / 自动更新                                         │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
                  ~/AppData/Nova/nova.db
                  ~/AppData/Nova/exports/
                  ~/AppData/Nova/logs/
```

---

## 3. 数据模型（SQLite Schema）

### 3.1 整体 ER 图（两种模式）

```
【长篇单行模式】                          【短篇怪谈集模式】
┌──────────┐                             ┌──────────┐
│ Project  │                             │ Project  │
│ (novel)  │                             │(anthology)│
└────┬─────┘                             └────┬─────┘
     │                                        │
     ├── Characters (全局角色)                  │
     ├── Volumes ── Chapters                   └── Chapters（每篇即一个独立故事）
     ├── LoreEntries (全局设定)                        │
     ├── Foreshadows (跨章伏笔)                        ├── story_premise（本篇核心创意）
     └── ApiUsage                                      ├── story_setting（本篇场景）
                                                       └── story_protagonist（本篇主角）
                                                    （无全局角色、无卷结构、无跨篇伏笔）
```

### 3.2 核心表结构

```sql
-- 项目
CREATE TABLE projects (
  id              TEXT PRIMARY KEY,           -- uuid
  title           TEXT NOT NULL,
  project_type    TEXT NOT NULL DEFAULT 'novel', -- 'novel' | 'anthology'
  subgenre        TEXT NOT NULL,              -- 'urban_legend' | 'folk_horror'
  premise         TEXT NOT NULL,              -- 长篇：核心创意；选集：合集主题
  target_words    INTEGER NOT NULL,
  target_chapters INTEGER NOT NULL,           -- 长篇：章节数；选集：故事数量
  words_per_chapter INTEGER DEFAULT 3000,    -- 长篇：每章字数；选集：每篇字数
  status          TEXT DEFAULT 'draft',       -- draft|outlining|writing|done
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

-- 角色（仅长篇模式全局使用；选集模式不使用此表，角色信息存储在 chapter 字段中）
CREATE TABLE characters (
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
  locked_fields TEXT,                        -- JSON 数组：被锁定不让 AI 改的字段
  created_at    INTEGER
);

-- 大纲：卷（仅长篇模式使用；选集模式无此表）
CREATE TABLE volumes (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  index_no      INTEGER NOT NULL,
  title         TEXT NOT NULL,
  summary       TEXT,
  arc_goal      TEXT                         -- 本卷剧情目标
);

-- 大纲：章（两种模式均使用，但含义不同）
--
-- 长篇模式：每行是一个章节，隶属于某卷，有前后衔接
-- 选集模式：每行是一个独立短篇故事，volume_id 为 NULL，
--           含 story_premise / story_setting / story_protagonist 字段
--
CREATE TABLE chapters (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  volume_id         TEXT REFERENCES volumes(id),  -- 选集模式为 NULL
  index_no          INTEGER NOT NULL,
  title             TEXT NOT NULL,
  outline           TEXT,                        -- 长篇：章节细纲；选集：故事细纲
  horror_beat       TEXT,                        -- 本篇/章核心恐怖点
  hook              TEXT,                        -- 篇/章末钩子
  content           TEXT,                        -- 正文（HTML/Markdown）
  summary           TEXT,                        -- AI 自动生成的摘要
  word_count        INTEGER DEFAULT 0,
  status            TEXT DEFAULT 'pending',      -- pending|generating|done|error

  -- 选集模式专属字段（长篇模式为 NULL）
  story_premise     TEXT,                        -- 本篇故事的核心创意
  story_setting     TEXT,                        -- 本篇故事的发生场景/地点
  story_protagonist TEXT,                        -- 本篇故事的主角名

  generated_at      INTEGER,
  edited_at         INTEGER
);

-- 设定库（两种模式均使用）
-- 长篇模式：project_id 全局共享
-- 选集模式：可通过 chapter_id 字段限定作用域（可选扩展）
CREATE TABLE lore_entries (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  chapter_id    TEXT REFERENCES chapters(id),     -- 选集模式限定单篇，NULL 表示全局
  category      TEXT NOT NULL,                    -- location|monster|item|organization|rule
  name          TEXT NOT NULL,
  description   TEXT,
  first_chapter INTEGER,
  locked        INTEGER DEFAULT 0,
  metadata      TEXT                              -- JSON 扩展
);

-- 伏笔表（仅长篇模式使用；选集模式无跨篇伏笔）
CREATE TABLE foreshadows (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  planted_chapter INTEGER,
  payoff_chapter  INTEGER,
  status        TEXT DEFAULT 'planted'       -- planted|paid_off
);

-- 章节版本历史（两种模式均使用）
CREATE TABLE chapter_versions (
  id            TEXT PRIMARY KEY,
  chapter_id    TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  reason        TEXT,                        -- 'manual'|'ai_polish'|'ai_rewrite'...
  created_at    INTEGER
);

-- API 用量记录
CREATE TABLE api_usage (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    TEXT,
  operation     TEXT,                        -- outline|chapter|polish|extract
  model         TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cost_cny      REAL,
  created_at    INTEGER
);

-- 设置（KV）
CREATE TABLE settings (
  key           TEXT PRIMARY KEY,
  value         TEXT
);
```

### 3.3 迁移计划（v0.1 → v0.2）

```sql
-- migration 002: add anthology support
ALTER TABLE projects ADD COLUMN project_type TEXT NOT NULL DEFAULT 'novel';
ALTER TABLE chapters ADD COLUMN story_premise TEXT;
ALTER TABLE chapters ADD COLUMN story_setting TEXT;
ALTER TABLE chapters ADD COLUMN story_protagonist TEXT;
ALTER TABLE chapters ADD COLUMN volume_id DROP NOT NULL;  -- SQLite 不支持 DROP NOT NULL，
                                                          -- 需重建表或允许 NULL
ALTER TABLE lore_entries ADD COLUMN chapter_id TEXT REFERENCES chapters(id);
```

---

## 4. 核心模块详细设计

### 4.1 PromptBuilder（恐怖专用）

**模板分层（长篇模式·不变）：**
```
SystemPrompt（恐怖通用规则）
  + SubgenrePrompt（都市怪谈/民俗恐怖各异）
  + TaskPrompt（outline/chapter/polish）
  + ContextInjection（人物卡 + 设定库 + 前情摘要）
  + UserInput
```

**模板分层（选集模式·新增）：**
```
SystemPrompt（恐怖通用规则，放宽"连续"限制）
  + SubgenrePrompt（都市怪谈/民俗恐怖各异）
  + AnthologyTaskPrompt（anthology_outline / anthology_story）
  + ContextInjection（仅注入本篇故事的信息，无跨篇上下文）
  + UserInput
```

#### 新增 Anthology System Prompt 差异

选集模式下，恐怖通用规则需要调整以下几点：

```
【节奏差异 - 选集模式】
- 每篇故事是独立短篇，必须在开篇 200 字内建立悬念和氛围
- 前 30% 铺垫 → 调整为前 15% 快速入题
- 结尾可以是反转、细思极恐或开放式结局
- 不需要章末钩子延续到下一篇（每篇独立）
- 每篇故事应有完整起承转合

【视角差异 - 选集模式】
- 每篇可自由选择视角（第一人称/第三人称），不要求全书统一
- 每篇主角独立，无需与上一篇保持一致

【禁用词】规则不变
```

#### 新增 Anthology 任务 Prompt

```
ANTHOLOGY_OUTLINE_PROMPT = `【任务：生成短篇怪谈集大纲】
请根据以下合集信息，生成 N 篇独立短篇故事的大纲。

要求：
1. 每篇故事完全独立，有各自的主角、场景、核心怪谈
2. 每篇提供：
   - 故事标题
   - 核心创意（一句话，本篇的恐怖设定）
   - 发生场景（具体到某个日常场所）
   - 主角（姓名 + 简短身份）
   - 细纲（200-300字概述完整故事）
   - 核心恐怖点（本篇最让人毛骨悚然的元素）
   - 篇末钩子（最后一句话/结局余韵）
3. 各篇之间避免雷同的设定和套路
4. 整体风格符合合集主题

请严格按照以下 JSON 格式输出：
{
  "stories": [
    {
      "title": "故事标题",
      "premise": "核心创意（30字以内）",
      "setting": "发生场景",
      "protagonist": "主角名 - 身份简述",
      "outline": "完整故事细纲（200-300字）",
      "horrorBeat": "本篇核心恐怖点",
      "hook": "篇末结局/余韵"
    }
  ]
}
注意：JSON 中请勿包含注释，确保格式严格正确。`
```

```
ANTHOLOGY_STORY_PROMPT = `【任务：生成短篇怪谈正文】
请根据故事大纲，生成一篇完整的短篇恐怖小说。

要求：
1. 此篇是完全独立的短篇故事，需要有完整的起承转合
2. 开篇 200 字内必须建立悬念和氛围
3. 严格控制字数在目标字数 ±10% 范围内
4. 遵守【节奏】【感官】【视角】【语言】创作准则（选集模式特调版）
5. 结尾应有力——可以是真相揭露、细思极恐、留有想象空间
6. 不依赖任何前文信息，本篇自成一体

字数控制：{targetWords} 字`
```

#### 新增 `BuildAnthologyOutlinePromptParams` 和 `BuildAnthologyStoryPromptParams`

```typescript
export interface BuildAnthologyOutlinePromptParams {
  subgenre: string;
  theme: string;            // 合集主题
  storyCount: number;
  targetWordsPerStory: number;
}

export interface BuildAnthologyStoryPromptParams {
  subgenre: string;
  theme: string;            // 合集主题（用于氛围统一）
  storyTitle: string;
  storyPremise: string;
  storySetting: string;
  storyProtagonist: string;
  outline: string;
  horrorBeat: string;
  hook: string;
  targetWords: number;
}
```

### 4.2 ContextManager（长程一致性核心）

#### 长篇模式（不变）

```
完整正文（DB） → 章节摘要（200字/章） → 卷摘要（500字/卷） → 全书梗概（1000字）

注入上下文时：
- 当前章前 1 章：完整结尾 500 字
- 当前章前 2-5 章：章节摘要
- 同卷其他章：卷摘要
- 其他卷：全书梗概
```

#### 选集模式（无需上下文管理）

```
选集模式每篇故事独立生成，不需要：
- 前情摘要（没有前后文依赖）
- 滑动窗口（不担心上下文超长）
- 跨篇伏笔追踪

ContextManager 在选集模式下返回空上下文。
```

### 4.3 LoreExtractor（设定库自动维护）

#### 长篇模式（不变）

每章生成完成后，调用 DeepSeek 做结构化抽取。

#### 选集模式（简化）

```
- 不自动抽取全局设定库（每篇故事独立）
- 如需支持，通过 chapter_id 作用域限定 lore_entries
- 用户可手动为单篇故事添加设定条目
```

### 4.4 AIClient（AI 客户端）

```typescript
// 文件位置: src/services/deepseek/client.ts
// 命名空间虽为 deepseek/，实际是通用 OpenAI 兼容客户端

export async function chatCompletion(
  apiKey: string,
  opts: ChatOptions
): Promise<ChatResult>;

export interface ChatOptions {
  messages: Message[];
  model?: string;              // 自由文本，默认为 'deepseek-chat'
  temperature?: number;        // 默认 0.85
  maxTokens?: number;          // 默认 8192
  apiBaseUrl?: string;         // 默认 'https://api.deepseek.com/v1'
  signal?: AbortSignal;
  onToken?: (token: string) => void;        // 流式内容回调
  onReasoning?: (token: string) => void;    // 思维链回调（如 DeepSeek-R1）
}

export interface ChatResult {
  content: string;
  reasoningContent?: string;   // 推理模型专用
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

**重试策略（实际实现）：**

```
尝试次数: 最多 3 次
退避策略: 指数退避（1s, 2s, 4s）
可重试条件: HTTP 429（限流）或 5xx（服务器错误）
立即报错: HTTP 400 / 401 / 422（请求格式错误 / 认证失败 / 不可处理）
AbortError: 立即抛出，不重试
```

**流式实现细节：**

| 步骤 | 说明 |
|---|---|
| 1. `POST {apiBaseUrl}/chat/completions` | 带上 `stream: true` 请求体 |
| 2. `response.body.getReader()` | 获取 `ReadableStream` 读取器 |
| 3. 逐行读取 | 按 `\n` 分行，每行前缀 `data: ` |
| 4. 解析 `delta.content` 或 `delta.reasoning_content` | 分别回调 `onToken` / `onReasoning` |
| 5. `data: [DONE]` 信号 | 结束流式读取 |
| 6. 尾部 `usage` 字段 | 从最后一个 SSE 事件中提取 token 用量 |

**温度建议（完整版）：**
| 任务 | 推荐温度 | 推荐模型 | 说明 |
|---|---|---|---|
| 长篇大纲生成 | 0.7 | 任意（推荐 DeepSeek-Chat / GPT-4o） | 结构化 JSON 输出，需可控 |
| 长篇正文生成 | 0.85 | 任意（推荐 DeepSeek-Chat / GPT-4o） | 恐怖需要一定随机性 |
| 选集大纲生成 | 0.8 | 任意 | 需多样性，避免各篇雷同 |
| 选集故事生成 | 0.85 | 任意 | 每篇独立，更需要创意发散 |
| 推理/思考（大纲） | 0.1-0.7 | DeepSeek-R1 / o1 / o3 | 使用 reasoning 模型做深度规划 |
| 摘要/抽取 | 0.2 | 任意 | 结构化任务，低温度 |
| 润色 | 0.6 | 任意 | 保持原意的调整 |

**模型兼容性说明：**
```
- 所有 OpenAI Chat Completions API 格式的模型均可使用
- 支持 `reasoning_content` 字段的模型（DeepSeek-R1、OpenAI o1/o3）
  会通过 `onReasoning` 回调展示思维链
- 模型名称由用户自由填入 Settings 页，不做预定义列表
- 常用模型示例: deepseek-chat, deepseek-reasoner, gpt-4o, gpt-4o-mini,
  claude-sonnet-4-20250514 (需通过 Anthropic API 转换层)
```

### 4.5 批量生成器（Pipeline）

#### 长篇模式（不变）

```typescript
async function batchGenerate(projectId: string, opts: {
  fromChapter: number;
  toChapter: number;
  onProgress: (ch: number, status: string) => void;
  signal: AbortSignal;
}) {
  for (let i = opts.fromChapter; i <= opts.toChapter; i++) {
    if (signal.aborted) break;
    try {
      await generateChapter(projectId, i, { onToken });
      await extractLore(projectId, i);
      await summarizeChapter(projectId, i);
      onProgress(i, 'done');
    } catch (e) {
      // 3 次重试后仍失败 → 暂停整体流程，UI 弹窗
      onProgress(i, 'error');
      break;
    }
    await sleep(1000); // 避免限流
  }
}
```

#### 选集模式（新增 - 更简单）

```typescript
async function batchGenerateAnthology(projectId: string, opts: {
  storyIndices: number[];           // 要生成的故事索引列表
  onProgress: (storyIdx: number, status: string) => void;
  signal: AbortSignal;
}) {
  for (const idx of opts.storyIndices) {
    if (signal.aborted) break;
    try {
      await generateAnthologyStory(projectId, idx, { onToken });
      // 无 LoreExtract（选集模式不自动抽取全局设定）
      // 无 Summarize（短篇本身就是完整内容，无需摘要注入后续上下文）
      onProgress(idx, 'done');
    } catch (e) {
      // 3 次重试后仍失败 → 暂停
      onProgress(idx, 'error');
      break;
    }
    await sleep(1000);
  }
}
```

### 4.6 编辑器选区操作

TipTap 自定义扩展，右键菜单触发 5 类操作：

| 操作 | Prompt 模板（节选） |
|---|---|
| **重写** | "保持原意，用不同句式和词汇重写以下段落..." |
| **扩写** | "将以下段落扩写到 2 倍长度，增加细节但不改变情节..." |
| **增强恐怖** | "加强以下段落的恐怖氛围：增加感官细节、放慢节奏、暗示而非直说..." |
| **去 AI 味** | "改写以下段落使其更像人类作家：打散排比句、删除 AI 套话、加入口语化表达..." |
| **改第一人称** | "将以下段落改为第一人称限制视角..." |

返回结果以"原文 / 新文"对比视图展示，三按钮：✅接受 / ❌拒绝 / 🔄再生成。

---

## 5. 目录结构

```
nova/
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/             # IPC 命令
│   │   └── db/                   # SQLite 迁移
│   ├── tauri.conf.json
│   └── Cargo.toml
├── src/                          # 前端
│   ├── main.tsx
│   ├── App.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx         # 项目列表（含书籍类型标识）
│   │   ├── ProjectSetup.tsx      # 创意配置（支持两种模式）
│   │   ├── OutlineView.tsx       # 大纲编辑（长篇：卷章树 / 选集：故事卡片列表）
│   │   ├── EditorView.tsx        # 正文编辑器
│   │   └── Settings.tsx
│   ├── components/
│   │   ├── editor/               # TipTap 相关
│   │   ├── outline/
│   │   │   ├── VolumeTree.tsx    # 长篇卷章树组件
│   │   │   └── StoryCardList.tsx # 选集故事卡片列表组件
│   │   ├── anthology/            # 选集模式专用组件
│   │   │   └── StoryCard.tsx     # 单篇故事卡片
│   │   ├── project/              # 项目配置组件
│   │   │   ├── NovelSetup.tsx    # 长篇模式配置表单
│   │   │   └── AnthologySetup.tsx# 选集模式配置表单
│   │   ├── lore/
│   │   └── ui/                   # shadcn 组件
│   ├── services/
│   │   ├── deepseek/
│   │   ├── prompt/
│   │   │   ├── templates/
│   │   │   │   ├── system.ts
│   │   │   │   ├── urban_legend.ts
│   │   │   │   ├── folk_horror.ts
│   │   │   │   ├── tasks.ts               # 长篇任务 prompt
│   │   │   │   └── anthology_tasks.ts     # 选集任务 prompt（新增）
│   │   │   └── builder.ts                 # 路由到两种模式的 prompt 构建
│   │   ├── context/
│   │   ├── lore/
│   │   ├── pipeline/
│   │   │   ├── novel.ts          # 长篇生成 pipeline
│   │   │   └── anthology.ts      # 选集生成 pipeline（新增）
│   │   └── export/
│   ├── stores/
│   │   ├── projectStore.ts
│   │   ├── settingsStore.ts
│   │   └── generationStore.ts    # 分叉支持两种模式
│   ├── db/
│   │   ├── schema.sql
│   │   ├── migrations/
│   │   │   ├── 001_init.ts
│   │   │   └── 002_anthology.ts  # 新增迁移
│   │   └── repositories/
│   ├── hooks/
│   ├── types/
│   └── lib/
├── docs/
│   ├── PRD.md
│   └── SPEC.md
├── package.json
└── README.md
```

### 新增/修改文件清单

| 文件 | 动作 | 说明 |
|---|---|---|
| `src/types/index.ts` | 修改 | 新增 `ProjectType`、`Chapter` 新字段、anthology 参数类型 |
| `src/db/migrations/002_anthology.ts` | 新增 | 数据库迁移 |
| `src/db/schema.sql` | 修改 | 更新完整 schema 注释 |
| `src/services/prompt/templates/anthology_tasks.ts` | 新增 | 选集模式 prompt 模板 |
| `src/services/prompt/builder.ts` | 修改 | 路由到两种模式的 prompt 构建 |
| `src/services/pipeline/anthology.ts` | 新增 | 选集生成 pipeline |
| `src/stores/projectStore.ts` | 修改 | 支持 `project_type` |
| `src/stores/generationStore.ts` | 修改 | 两种模式分叉 |
| `src/components/outline/StoryCardList.tsx` | 新增 | 选集故事卡片列表 |
| `src/components/anthology/StoryCard.tsx` | 新增 | 单篇故事卡片组件 |
| `src/components/project/NovelSetup.tsx` | 新增 | 长篇配置表单（从 ProjectSetup 提取） |
| `src/components/project/AnthologySetup.tsx` | 新增 | 选集配置表单 |
| `src/pages/ProjectSetup.tsx` | 修改 | 根据 `project_type` 渲染不同配置和展示 |
| `src/pages/OutlineView.tsx` | 修改 | 根据 `project_type` 渲染树或卡片列表 |
| `src/pages/Dashboard.tsx` | 修改 | 新建对话框增加模式选择 |
| `App.tsx` | 修改 | 可能新增路由 |

---

## 6. 关键交互流程

### 6.1 新建项目 → 生成第一篇（长篇模式·不变）

```
用户点击"新建项目"
  → 选择书籍结构: 长篇单行
  → 选择题材（都市怪谈/民俗恐怖）
  → 填写: 标题、一句话创意、主角设定、目标字数
  → [创建] 写入 projects + characters 表
  → 跳转到 OutlineView（长篇模式）
  → [生成大纲] 调 DeepSeek，流式渲染卷/章树
  → 用户编辑/确认大纲
  → 跳转到 EditorView，章节列表显示
  → [生成本章] 单章生成，流式渲染到编辑器
  → 完成后异步：抽取设定 + 生成摘要
  → 用户右键润色 → 提交修改 → 保存版本
```

### 6.2 新建项目 → 生成全部故事（选集模式·新增）

```
用户点击"新建项目"
  → 选择书籍结构: 短篇怪谈集
  → 选择题材（都市怪谈/民俗恐怖）
  → 填写: 合集标题、合集主题（如"深夜都市的 10 个诡异传闻"）、故事数量、每篇字数
  → [创建] 写入 projects 表
  → 跳转到 OutlineView（选集模式）
  → [生成故事大纲] 调 DeepSeek，流式渲染 N 张故事卡片
    每张卡片含: 标题、核心创意、场景、主角、细纲、恐怖点、钩子
  → 用户编辑/确认每篇故事的大纲
  → 可逐篇点击 [生成本篇] 或一键 [生成全部故事]
  → 生成时: 每篇独立流式输出到编辑器，无跨篇上下文
  → 完成后无需 LoreExtract（无全局设定库）/ 无需 Summarize
  → 用户逐篇润色、导出时可选择"按篇分文件"或"合并为合集"
```

### 6.3 批量生成（长篇模式）

```
用户在 OutlineView 选择章节范围 [3-50]
  → 弹窗预估成本 (token × 单价)
  → [确认] 进入批量模式
  → 顶部进度条 + 当前章节标题 + 终止按钮
  → 后台串行生成，每章完成后写库 + 更新设定库
  → 任意章失败连续 3 次 → 暂停 + 弹窗（重试/跳过/终止）
  → 全部完成 → 系统通知 + 总用量报表
```

### 6.4 批量生成（选集模式·新增）

```
用户在 OutlineView 确认故事大纲后
  → [生成全部故事] 按钮
  → 弹窗显示: N 篇 × 每篇预估字数 = 总输出 token 预估
  → 用户确认后开始串行生成
  → 进度显示: "正在生成第 3/10 篇: 深夜电梯"
  → 每篇完成后更新 chapters 表 content 字段
  → 任意篇失败连续 3 次 → 暂停 + 弹窗（重试/跳过/终止）
  → 全部完成 → 系统通知 + 总用量报表
  → 无 LoreExtract / Summarize 步骤（与长篇模式的关键差异）
```

---

## 7. 错误处理与边界

| 场景 | 处理 |
|---|---|
| API Key 无效 | 设置页红色警告 + 阻止生成操作 |
| 网络中断 | 流式生成保留已生成部分 + 提供"续写"按钮 |
| 上下文超长 | ContextManager 自动降级（长篇模式）；选集模式无此问题 |
| DeepSeek 返回敏感内容拦截 | 捕获错误，提示用户修改创意/换细纲 |
| SQLite 损坏 | 启动时校验 + 自动从最近备份恢复（每日凌晨备份） |
| 用户关闭 app 时正在生成 | 弹窗确认 + 标记该章为 `error`，下次启动可恢复 |
| **选集模式：AI 生成的各篇故事题材雷同** | **prompt 中增加"避免各篇雷同"指令；温度设为 0.8 提高多样性** |
| **选集模式：单篇故事字数偏离过大** | **生成后检查字数，偏离 > 20% 时自动重生成（最多 2 次）** |

---

## 8. 测试策略

| 类型 | 工具 | 范围 |
|---|---|---|
| 单元测试 | Vitest | services/ 全部、PromptBuilder（两种模式）、ContextManager |
| 集成测试 | Vitest + Mock API | 完整生成 pipeline（长篇 + 选集）、设定库抽取一致性 |
| E2E | Playwright（可选） | 新建项目→生成第一篇（两种模式） |
| 手工 QA | — | 真实生成一本 5 万字短篇 + 一本 3 万字怪谈集验收 |

---

## 9. 开发计划

### 9.1 优先实施路线（4 周 MVP → +2 周选集）

| 周 | 目标 |
|---|---|
| **W1** | 项目脚手架、Tauri+SQLite 跑通、设置页 + DeepSeek 客户端 |
| **W2** | 项目管理 + 创意配置 + 长篇大纲生成（含恐怖 prompt 模板） |
| **W3** | 编辑器 + 长篇单章生成 + 设定库抽取 + 上下文管理 |
| **W4** | 长篇批量生成 + 润色操作 + 导出 + 实测一本 5 万字 |
| **W5** | **选集模式：数据层（类型、迁移、Store）+ prompt 模板 + pipeline** |
| **W6** | **选集模式：UI（故事卡片列表、模式切换、配置表单）+ 批量生成 + 测试** |

### 9.2 W5-W6 详细任务分解

#### W5：数据层 + 业务逻辑
| 任务 | 文件 | 预估工时 |
|---|---|---|
| 定义 `ProjectType` 和新增字段 | `src/types/index.ts` | 1h |
| 编写数据库迁移脚本 | `src/db/migrations/002_anthology.ts` | 1h |
| 更新 schema.sql 注释 | `src/db/schema.sql` | 0.5h |
| 更新 projectStore 支持 `project_type` | `src/stores/projectStore.ts` | 1h |
| 新增 anthology 任务 prompt 模板 | `src/services/prompt/templates/anthology_tasks.ts` | 2h |
| 修改 builder.ts 路由两种模式 | `src/services/prompt/builder.ts` | 1.5h |
| 新增 anthology pipeline | `src/services/pipeline/anthology.ts` | 1.5h |
| 修改 generationStore 分叉两种模式 | `src/stores/generationStore.ts` | 3h |

#### W6：UI + 集成
| 任务 | 文件 | 预估工时 |
|---|---|---|
| 新增 StoryCard 组件 | `src/components/anthology/StoryCard.tsx` | 1.5h |
| 新增 StoryCardList 组件 | `src/components/outline/StoryCardList.tsx` | 2h |
| 新增 NovelSetup / AnthologySetup 表单 | `src/components/project/*.tsx` | 2h |
| 修改 Dashboard 新建对话框 | `src/pages/Dashboard.tsx` | 1.5h |
| 修改 ProjectSetup 支持两种模式 | `src/pages/ProjectSetup.tsx` | 2h |
| 修改 OutlineView 渲染分叉 | `src/pages/OutlineView.tsx` | 3h |
| 集成测试 + 手工 QA | — | 3h |

---

## 10. 后续扩展方向（v0.3+ 占位）

- 多 AI 提供商一键切换 UI（当前已通过自由填写 apiBaseUrl + model 实现，可增加预设提供商下拉列表）
- 风格学习：用户上传 3-5 章范文，few-shot 注入
- 章节大纲 A/B 多版本对比
- 敏感词检查器（按平台规则库）
- **选集模式高级功能：跨篇串联线索（暗线合集，如"每个故事的主角是同一座城市的过客"）**
- **选集模式高级功能：故事排序拖拽、分组为"辑"**
- 写作日历 / 字数统计仪表盘
- 插件系统（用户自定义 prompt 模板包）
