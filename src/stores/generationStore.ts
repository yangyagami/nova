import { create } from "zustand";
import { getDb } from "@/lib/db";
import { useSettingsStore } from "./settingsStore";
import { chatCompletion } from "@/services/deepseek";
import { buildOutlinePrompt } from "@/services/prompt";
import type { Volume, Chapter } from "@/types";

export type GenerationStatus = "idle" | "generating" | "done" | "error";
export type TaskType = "outline" | "chapter" | "polish";

export interface TaskInfo {
  type: TaskType;
  projectId: string;
  projectTitle: string;
  label: string; // e.g. "生成大纲"、"第 3 章生成"
}

interface GenerationState {
  // Task info (for global task bar)
  task: TaskInfo | null;

  status: GenerationStatus;
  currentStep: string;
  error: string | null;
  abortController: AbortController | null;

  // Raw streaming output — visible in real time
  streamingContent: string;

  // Generated outline data
  generatedVolumes: Volume[];
  generatedChapters: Chapter[];

  // Actions
  generateOutline: (projectId: string, projectTitle: string, params: {
    subgenre: string;
    premise: string;
    targetChapters: number;
    targetWords: number;
    characters?: { name: string; role: string; identity: string; secret: string }[];
  }) => Promise<void>;
  cancelGeneration: () => void;
  dismissTask: () => void;
  retryTask: () => void;
  reset: () => void;
  loadOutline: (projectId: string) => Promise<void>;
}

function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}${random}`;
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
  task: null,
  status: "idle",
  currentStep: "",
  error: null,
  abortController: null,
  streamingContent: "",
  generatedVolumes: [],
  generatedChapters: [],

  generateOutline: async (projectId, projectTitle, params) => {
    const abortController = new AbortController();

    // Store params for retry
    const lastParams = { projectId, projectTitle, params };

    set({
      task: { type: "outline", projectId, projectTitle, label: "生成大纲" },
      status: "generating",
      currentStep: "正在连接 API...",
      error: null,
      abortController,
      streamingContent: "",
      generatedVolumes: [],
      generatedChapters: [],
    });

    // Store for retry
    (get as any).__lastOutlineParams = lastParams;

    try {
      const settings = useSettingsStore.getState().settings;

      set({ currentStep: "正在构建 prompt..." });

      const messages = buildOutlinePrompt(params);

      set({ currentStep: "正在请求 AI 生成大纲..." });

      let fullContent = "";

      await chatCompletion(settings.apiKey, {
        messages,
        model: settings.model,
        temperature: 0.7,
        maxTokens: settings.maxTokens,
        apiBaseUrl: settings.apiBaseUrl,
        signal: abortController.signal,
        onToken: (token) => {
          fullContent += token;
          set({
            currentStep: `已接收 ${fullContent.length} 字符...`,
            streamingContent: fullContent,
          });
        },
      });

      set({ currentStep: "正在解析大纲..." });

      // Parse the JSON from the response
      const parsed = parseOutlineJSON(fullContent);

      if (!parsed || !parsed.volumes || parsed.volumes.length === 0) {
        throw new Error("未能解析出有效的大纲结构，请重试");
      }

      // Save to database
      const db = await getDb();
      const volumes: Volume[] = [];
      const chapters: Chapter[] = [];

      for (let vi = 0; vi < parsed.volumes.length; vi++) {
        const v = parsed.volumes[vi];
        const volumeId = generateId("vol");

        await db.execute(
          `INSERT INTO volumes (id, project_id, index_no, title, summary, arc_goal)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [volumeId, projectId, vi + 1, v.title, v.summary || "", v.arcGoal || ""]
        );

        const vol: Volume = {
          id: volumeId,
          projectId,
          indexNo: vi + 1,
          title: v.title,
          summary: v.summary || "",
          arcGoal: v.arcGoal || "",
        };
        volumes.push(vol);

        if (v.chapters) {
          for (let ci = 0; ci < v.chapters.length; ci++) {
            const ch = v.chapters[ci];
            const chapterId = generateId("ch");

            await db.execute(
              `INSERT INTO chapters (id, project_id, volume_id, index_no, title, outline, horror_beat, hook, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                chapterId,
                projectId,
                volumeId,
                ci + 1,
                ch.title || `第 ${ci + 1} 章`,
                ch.outline || "",
                ch.horrorBeat || "",
                ch.hook || "",
                "pending",
              ]
            );

            chapters.push({
              id: chapterId,
              projectId,
              volumeId,
              indexNo: ci + 1,
              title: ch.title || `第 ${ci + 1} 章`,
              outline: ch.outline || "",
              horrorBeat: ch.horrorBeat || "",
              hook: ch.hook || "",
              content: "",
              summary: "",
              wordCount: 0,
              status: "pending",
            });
          }
        }
      }

      // Update project status to 'outlining'
      await db.execute(
        "UPDATE projects SET status = $1, updated_at = $2 WHERE id = $3",
        ["outlining", Math.floor(Date.now() / 1000), projectId]
      );

      set({
        status: "done",
        currentStep: "大纲生成完成！",
        generatedVolumes: volumes,
        generatedChapters: chapters,
        abortController: null,
      });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") {
        set({ status: "idle", currentStep: "已取消", abortController: null });
        return;
      }
      set({
        status: "error",
        error: (e as Error).message,
        currentStep: "生成失败",
        abortController: null,
      });
    }
  },

  cancelGeneration: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ abortController: null, task: null, status: "idle" });
    }
  },

  dismissTask: () => {
    set({ task: null, status: "idle", streamingContent: "", error: null });
  },

  retryTask: () => {
    const lastParams = (get as any).__lastOutlineParams;
    if (lastParams) {
      get().generateOutline(lastParams.projectId, lastParams.projectTitle, lastParams.params);
    }
  },

  reset: () => {
    set({
      task: null,
      status: "idle",
      currentStep: "",
      error: null,
      abortController: null,
      streamingContent: "",
      generatedVolumes: [],
      generatedChapters: [],
    });
  },

  loadOutline: async (projectId: string) => {
    try {
      const db = await getDb();
      const volumes = await db.select<Volume[]>(
        "SELECT id, project_id as projectId, index_no as indexNo, title, summary, arc_goal as arcGoal FROM volumes WHERE project_id = $1 ORDER BY index_no",
        [projectId]
      );
      const chapters = await db.select<Chapter[]>(
        "SELECT id, project_id as projectId, volume_id as volumeId, index_no as indexNo, title, outline, horror_beat as horrorBeat, hook, content, summary, word_count as wordCount, status FROM chapters WHERE project_id = $1 ORDER BY index_no",
        [projectId]
      );
      set({ generatedVolumes: volumes, generatedChapters: chapters });
    } catch (e) {
      console.error("Failed to load outline:", e);
    }
  },
}));

// ============== JSON Parser ==============

interface ParsedOutline {
  volumes: {
    title: string;
    summary?: string;
    arcGoal?: string;
    chapters: {
      title: string;
      outline: string;
      horrorBeat: string;
      hook: string;
    }[];
  }[];
}

// ============== JSON Parser (robust) ==============

interface RawOutline {
  total_chapters?: number;
  volumes?: RawVolume[];
}

interface RawVolume {
  title?: string;
  summary?: string;
  arcGoal?: string;
  chapters?: RawChapter[];
  // Alternative field names used by AI
  volume_name?: string;
  volume_summary?: string;
  volume_goal?: string;
  volume_arc?: string;
  chapter_count?: number;
}

interface RawChapter {
  title?: string;
  outline?: string;
  horrorBeat?: string;
  hook?: string;
  // Alternative field names
  chapter_title?: string;
  chapter_outline?: string;
  core_horror?: string;
  chapter_hook?: string;
  summary?: string;
  content?: string;
}

/**
 * Repair common JSON formatting issues from LLM output:
 * - Double commas (,, → ,)
 * - Trailing commas before ] or }
 * - Truncated JSON (missing closing brackets — append them)
 * - Single quotes instead of double quotes
 */
function repairJSON(raw: string): string {
  let s = raw;

  // Remove markdown code blocks
  const jsonMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    s = jsonMatch[1].trim();
  }

  // Find the outermost JSON object/array
  const objStart = s.indexOf("{");
  const arrStart = s.indexOf("[");
  const jsonStart = objStart >= 0 && (arrStart < 0 || objStart < arrStart) ? objStart : arrStart;
  if (jsonStart < 0) return raw;
  s = s.slice(jsonStart);

  // Replace single quotes with double quotes (but not inside already-quoted strings)
  // Simple approach: replace single quotes used as field delimiters
  s = s.replace(/'/g, '"');

  // Fix double commas
  s = s.replace(/,\s*,/g, ",");

  // Fix trailing commas before closing brackets
  s = s.replace(/,\s*([}\]])/g, "$1");

  // Fix missing quotes around property names (bare words before colon)
  s = s.replace(/([{,])\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');

  // If truncated (missing closing brackets), try to add them
  let depth = 0;
  let inString = false;
  for (const ch of s) {
    if (ch === '"' && (s[s.indexOf(ch) - 1] !== '\\')) inString = !inString;
    if (!inString) {
      if (ch === '{' || ch === '[') depth++;
      if (ch === '}' || ch === ']') depth--;
    }
  }
  if (depth > 0) {
    while (depth-- > 0) s += '}';
  }

  return s;
}

/**
 * Normalise field names — map AI alternative naming to our expected fields.
 */
function normaliseVolume(v: RawVolume): { title: string; summary: string; arcGoal: string; chapters: RawChapter[] } {
  return {
    title: v.title || v.volume_name || "未命名卷",
    summary: v.summary || v.volume_summary || "",
    arcGoal: v.arcGoal || v.volume_goal || v.volume_arc || "",
    chapters: Array.isArray(v.chapters) ? v.chapters : [],
  };
}

function normaliseChapter(c: RawChapter): { title: string; outline: string; horrorBeat: string; hook: string } {
  return {
    title: c.title || c.chapter_title || "未命名章",
    outline: c.outline || c.chapter_outline || c.summary || "",
    horrorBeat: c.horrorBeat || c.core_horror || "",
    hook: c.hook || c.chapter_hook || "",
  };
}

function parseOutlineJSON(content: string): ParsedOutline | null {
  const repaired = repairJSON(content);

  let parsed: RawOutline | RawVolume[];
  try {
    parsed = JSON.parse(repaired);
  } catch {
    // Last resort: try parsing just the first JSON object if there are multiple
    return null;
  }

  let rawVolumes: RawVolume[];
  if (Array.isArray(parsed)) {
    rawVolumes = parsed;
  } else {
    const obj = parsed as RawOutline;
    if (obj.volumes && Array.isArray(obj.volumes)) {
      rawVolumes = obj.volumes;
    } else {
      // Search for any array-valued key
      const arrayKey = Object.keys(obj).find((k) => Array.isArray((obj as any)[k]));
      if (arrayKey) {
        rawVolumes = (obj as any)[arrayKey];
      } else {
        return null;
      }
    }
  }

  if (rawVolumes.length === 0) return null;

  const volumes = rawVolumes.map(normaliseVolume);

  return {
    volumes: volumes.map((v) => ({
      title: v.title,
      summary: v.summary,
      arcGoal: v.arcGoal,
      chapters: v.chapters.map(normaliseChapter),
    })),
  };
}
