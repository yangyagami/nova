import { create } from "zustand";
import { getDb } from "@/lib/db";
import { useSettingsStore } from "./settingsStore";
import { chatCompletion } from "@/services/deepseek";
import { buildOutlinePrompt } from "@/services/prompt";
import type { Volume, Chapter } from "@/types";

type GenerationStatus = "idle" | "generating" | "done" | "error";

interface GenerationState {
  status: GenerationStatus;
  currentStep: string;
  error: string | null;
  abortController: AbortController | null;

  // Generated outline data
  generatedVolumes: Volume[];
  generatedChapters: Chapter[];

  // Actions
  generateOutline: (projectId: string, params: {
    subgenre: string;
    premise: string;
    targetChapters: number;
    targetWords: number;
    characters?: { name: string; role: string; identity: string; secret: string }[];
  }) => Promise<void>;
  cancelGeneration: () => void;
  reset: () => void;
  loadOutline: (projectId: string) => Promise<void>;
}

function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}${random}`;
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
  status: "idle",
  currentStep: "",
  error: null,
  abortController: null,
  generatedVolumes: [],
  generatedChapters: [],

  generateOutline: async (projectId, params) => {
    const abortController = new AbortController();
    set({
      status: "generating",
      currentStep: "正在连接 API...",
      error: null,
      abortController,
      generatedVolumes: [],
      generatedChapters: [],
    });

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
          set({ currentStep: `已接收 ${fullContent.length} 字符...` });
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
        const now = Math.floor(Date.now() / 1000);

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
      set({ abortController: null });
    }
  },

  reset: () => {
    set({
      status: "idle",
      currentStep: "",
      error: null,
      abortController: null,
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

function parseOutlineJSON(content: string): ParsedOutline | null {
  // Try to extract JSON from the response (it might be wrapped in markdown code blocks)
  let jsonStr = content;

  // Remove markdown code block fences
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  // Try to find a JSON object/array in the remaining text
  const objectMatch = jsonStr.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (objectMatch) {
    jsonStr = objectMatch[1];
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Handle both { volumes: [...] } and [...] formats
    let volumes: ParsedOutline["volumes"];
    if (Array.isArray(parsed)) {
      volumes = parsed;
    } else if (parsed.volumes) {
      volumes = parsed.volumes;
    } else {
      // Try to find any array in the parsed object
      const arrayKey = Object.keys(parsed).find((k) => Array.isArray(parsed[k]));
      if (arrayKey) {
        volumes = parsed[arrayKey];
      } else {
        return null;
      }
    }

    return { volumes };
  } catch {
    // If JSON parsing fails, try to do a structured extraction
    return null;
  }
}
