# Nova 恐怖小说生成器 — 技术规格文档（SPEC）

> 版本：v0.1
> 配套文档：`PRD.md`
> 最后更新：2026-05-04

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
| HTTP 客户端 | **Tauri `fetch` API**（绕过 CORS） | 直接调 DeepSeek |
| 流式解析 | **eventsource-parser** | SSE 流式输出 |
| 文档导出 | **docx**（npm）、原生 fs API | Word/TXT/MD |
| 日志 | **tauri-plugin-log** | 调试与崩溃排查 |

---

## 2. 系统架构

```
┌──────────────────────────────────────────────────────────────┐
│                       Tauri Webview (前端)                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Pages: Dashboard / Project / Editor / Settings        │  │
│  │  Components: OutlineTree / ChapterEditor / LoreSidebar │  │
│  │  Hooks: useGenerator / useProject / useStreamingChat   │  │
│  │  Stores: projectStore / settingsStore / generationStore│  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Service Layer (TS)                                     │  │
│  │  - DeepSeekClient (流式 + 重试)                         │  │
│  │  - PromptBuilder (模板 + 上下文注入)                    │  │
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

```sql
-- 项目
CREATE TABLE projects (
  id            TEXT PRIMARY KEY,           -- uuid
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

-- 主角与配角（设定库的特殊化）
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

-- 大纲：卷
CREATE TABLE volumes (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  index_no      INTEGER NOT NULL,
  title         TEXT NOT NULL,
  summary       TEXT,
  arc_goal      TEXT                         -- 本卷剧情目标
);

-- 大纲：章
CREATE TABLE chapters (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  volume_id     TEXT REFERENCES volumes(id),
  index_no      INTEGER NOT NULL,
  title         TEXT NOT NULL,
  outline       TEXT,                        -- 章节细纲
  horror_beat   TEXT,                        -- 本章核心恐怖点
  hook          TEXT,                        -- 章末钩子
  content       TEXT,                        -- 正文（HTML/Markdown）
  summary       TEXT,                        -- AI 自动生成的章节摘要（供后续上下文用）
  word_count    INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'pending',      -- pending|generating|done|error
  generated_at  INTEGER,
  edited_at     INTEGER
);

-- 设定库（地点/怪物/道具/组织）
CREATE TABLE lore_entries (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,              -- location|monster|item|organization|rule
  name          TEXT NOT NULL,
  description   TEXT,
  first_chapter INTEGER,
  locked        INTEGER DEFAULT 0,
  metadata      TEXT                         -- JSON 扩展
);

-- 伏笔表
CREATE TABLE foreshadows (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  planted_chapter INTEGER,
  payoff_chapter  INTEGER,
  status        TEXT DEFAULT 'planted'       -- planted|paid_off
);

-- 章节版本历史
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

---

## 4. 核心模块详细设计

### 4.1 PromptBuilder（恐怖专用）

**模板分层：**
```
SystemPrompt（恐怖通用规则）
  + SubgenrePrompt（都市怪谈/民俗恐怖各异）
  + TaskPrompt（outline/chapter/polish）
  + ContextInjection（人物卡 + 设定库 + 前情摘要）
  + UserInput
```

**恐怖通用 SystemPrompt（节选）：**
```
你是一位经验丰富的中文恐怖小说作家。请严格遵守以下创作准则：

【节奏】
- 恐怖来自"不确定"，不来自"血浆"。前 30% 篇幅必须以铺垫为主。
- 禁用词："突然"、"忽然"、"猛地"、"骤然"——用环境变化暗示异常。
- 每章保留至少 1 个未解之谜延续到下一章。

【感官】
- 每千字至少包含 3 处非视觉描写（声音/气味/温度/触感）。
- 优先使用具体名词，避免"恐怖的"、"诡异的"、"瘆人的"等抽象形容词。

【视角】
- 默认第一人称限制视角，未经允许不切换。
- 主角不得"全知"，对超自然现象的认知必须随情节推进。

【语言】
- 句式长短交替，段落之间避免相同开头。
- 禁用 AI 套话："总而言之"、"不仅...而且"、"在这个...的世界里"。
- 对话用方言/口头禅强化人物辨识度。
```

**章节生成 Prompt 结构：**
```typescript
interface ChapterPromptContext {
  project: { title, subgenre, premise };
  characters: Character[];        // 仅注入本章涉及的
  lore: LoreEntry[];              // 仅注入相关条目（按章纲关键词检索）
  recentSummaries: string[];      // 前 3 章摘要
  previousChapterEnding: string;  // 上一章最后 500 字（保证衔接）
  currentOutline: ChapterOutline; // 本章细纲
  activeForeshadows: Foreshadow[]; // 本章应埋/回收的伏笔
  targetWords: number;
}
```

### 4.2 ContextManager（长程一致性核心）

**问题**：50 万字小说不能全塞进 prompt（DeepSeek 上下文 64K）。

**策略：滑动窗口 + 分层摘要**
```
完整正文（DB） → 章节摘要（200字/章） → 卷摘要（500字/卷） → 全书梗概（1000字）

注入上下文时：
- 当前章前 1 章：完整结尾 500 字
- 当前章前 2-5 章：章节摘要
- 同卷其他章：卷摘要
- 其他卷：全书梗概
```

**摘要生成时机**：每章正文确认后异步触发，存入 `chapters.summary`。

### 4.3 LoreExtractor（设定库自动维护）

每章生成完成后，调用 DeepSeek 做结构化抽取：
```
输入：本章正文 + 当前设定库快照
输出 JSON：{
  new_characters: [...],
  updated_characters: [{ id, field, new_value, reason }],
  new_locations: [...],
  new_items: [...],
  new_foreshadows: [...],
  paid_off_foreshadows: [id, ...]
}
```

**冲突处理**：
- 若更新的字段在 `locked_fields` 中 → 拒绝，记入日志
- 若新增条目与现有 name 重名 → 弹窗让用户合并/重命名

### 4.4 DeepSeekClient

```typescript
class DeepSeekClient {
  async chat(opts: {
    messages: Message[];
    model: 'deepseek-chat' | 'deepseek-reasoner';
    stream: boolean;
    temperature?: number;
    onToken?: (token: string) => void;
    signal?: AbortSignal;
  }): Promise<{ content: string; usage: TokenUsage }>;

  // 自动重试：429/5xx 指数退避，最多 3 次
  // 失败抛 DeepSeekError，包含原始响应用于调试
}
```

**温度建议：**
- 大纲生成：0.7
- 正文生成：0.85（恐怖需要一定随机性）
- 摘要/抽取：0.2（结构化任务）
- 润色：0.6

### 4.5 批量生成器（Pipeline）

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
│   │   ├── Dashboard.tsx         # 项目列表
│   │   ├── ProjectSetup.tsx      # 创意配置
│   │   ├── OutlineView.tsx       # 大纲编辑
│   │   ├── EditorView.tsx        # 正文编辑器
│   │   └── Settings.tsx
│   ├── components/
│   │   ├── editor/               # TipTap 相关
│   │   ├── outline/
│   │   ├── lore/
│   │   └── ui/                   # shadcn 组件
│   ├── services/
│   │   ├── deepseek/
│   │   ├── prompt/
│   │   │   ├── templates/
│   │   │   │   ├── system.ts
│   │   │   │   ├── urban_legend.ts
│   │   │   │   ├── folk_horror.ts
│   │   │   │   └── tasks.ts
│   │   │   └── builder.ts
│   │   ├── context/
│   │   ├── lore/
│   │   ├── pipeline/
│   │   └── export/
│   ├── stores/
│   │   ├── projectStore.ts
│   │   ├── settingsStore.ts
│   │   └── generationStore.ts
│   ├── db/
│   │   ├── schema.sql
│   │   ├── migrations/
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

---

## 6. 关键交互流程

### 6.1 新建项目 → 生成第一章

```
用户点击"新建项目"
  → 选择模板（都市怪谈/民俗恐怖/空白）
  → 填写: 标题、一句话创意、主角设定、目标字数
  → [创建] 写入 projects + characters 表
  → 跳转到 OutlineView
  → [生成大纲] 调 DeepSeek-Reasoner，流式渲染卷/章树
  → 用户编辑/确认大纲
  → 跳转到 EditorView，章节列表显示
  → [生成本章] 单章生成，流式渲染到编辑器
  → 完成后异步：抽取设定 + 生成摘要
  → 用户右键润色 → 提交修改 → 保存版本
```

### 6.2 批量生成

```
用户在 OutlineView 选择章节范围 [3-50]
  → 弹窗预估成本 (token × 单价)
  → [确认] 进入批量模式
  → 顶部进度条 + 当前章节标题 + 终止按钮
  → 后台串行生成，每章完成后写库 + 更新设定库
  → 任意章失败连续 3 次 → 暂停 + 弹窗（重试/跳过/终止）
  → 全部完成 → 系统通知 + 总用量报表
```

---

## 7. 错误处理与边界

| 场景 | 处理 |
|---|---|
| API Key 无效 | 设置页红色警告 + 阻止生成操作 |
| 网络中断 | 流式生成保留已生成部分 + 提供"续写"按钮 |
| 上下文超长 | ContextManager 自动降级（更激进的摘要） |
| DeepSeek 返回敏感内容拦截 | 捕获错误，提示用户修改创意/换章节细纲 |
| SQLite 损坏 | 启动时校验 + 自动从最近备份恢复（每日凌晨备份） |
| 用户关闭 app 时正在生成 | 弹窗确认 + 标记该章为 `error`，下次启动可恢复 |

---

## 8. 测试策略

| 类型 | 工具 | 范围 |
|---|---|---|
| 单元测试 | Vitest | services/ 全部、PromptBuilder、ContextManager |
| 集成测试 | Vitest + Mock API | 完整生成 pipeline、设定库抽取一致性 |
| E2E | Playwright（可选） | 新建项目→生成第一章主流程 |
| 手工 QA | — | 真实生成一本 5 万字短篇验收 |

---

## 9. 开发计划（4 周 MVP）

| 周 | 目标 |
|---|---|
| **W1** | 项目脚手架、Tauri+SQLite 跑通、设置页 + DeepSeek 客户端 |
| **W2** | 项目管理 + 创意配置 + 大纲生成（含恐怖 prompt 模板） |
| **W3** | 编辑器 + 单章生成 + 设定库抽取 + 上下文管理 |
| **W4** | 批量生成 + 润色操作 + 导出 + 打磨 + 实测一本 5 万字 |

---

## 10. 后续扩展方向（v0.2+ 占位）

- 多模型适配层（OpenAI/Claude/Gemini/本地 Ollama）
- 风格学习：用户上传 3-5 章范文，few-shot 注入
- 章节大纲 A/B 多版本对比
- 敏感词检查器（按平台规则库）
- 写作日历 / 字数统计仪表盘
- 插件系统（用户自定义 prompt 模板包）
