// ============== 项目 (Project) ==============
export interface Project {
  id: string;
  title: string;
  subgenre: Subgenre;
  premise: string;
  targetWords: number;
  targetChapters: number;
  wordsPerChapter: number;
  status: ProjectStatus;
  createdAt: number;
  updatedAt: number;
}

export type Subgenre = "urban_legend" | "folk_horror";
export type ProjectStatus = "draft" | "outlining" | "writing" | "done";

export interface CreateProjectInput {
  title: string;
  subgenre: Subgenre;
  premise: string;
  targetWords: number;
  targetChapters: number;
  wordsPerChapter: number;
}

// ============== 角色 (Character) ==============
export interface Character {
  id: string;
  projectId: string;
  name: string;
  role: CharacterRole;
  gender: string;
  identity: string;
  appearance: string;
  personality: string;
  secret: string;
  relationships: Record<string, string>;
  firstChapter: number;
  lockedFields: string[];
  createdAt: number;
}

export type CharacterRole = "protagonist" | "antagonist" | "supporting";

// ============== 卷与章 (Volume & Chapter) ==============
export interface Volume {
  id: string;
  projectId: string;
  indexNo: number;
  title: string;
  summary: string;
  arcGoal: string;
}

export interface Chapter {
  id: string;
  projectId: string;
  volumeId: string;
  indexNo: number;
  title: string;
  outline: string;
  horrorBeat: string;
  hook: string;
  content: string;
  summary: string;
  wordCount: number;
  status: ChapterStatus;
  generatedAt?: number;
  editedAt?: number;
}

export type ChapterStatus = "pending" | "generating" | "done" | "error";

// ============== 设定库 (Lore) ==============
export interface LoreEntry {
  id: string;
  projectId: string;
  category: LoreCategory;
  name: string;
  description: string;
  firstChapter: number;
  locked: boolean;
  metadata: Record<string, unknown>;
}

export type LoreCategory =
  | "location"
  | "monster"
  | "item"
  | "organization"
  | "rule";

// ============== 伏笔 (Foreshadow) ==============
export interface Foreshadow {
  id: string;
  projectId: string;
  description: string;
  plantedChapter: number;
  payoffChapter?: number;
  status: "planted" | "paid_off";
}

// ============== 设置 (Settings) ==============
export interface AppSettings {
  apiKey: string;
  model: "deepseek-chat" | "deepseek-reasoner";
  temperature: number;
}

// ============== API 用量 ==============
export interface ApiUsage {
  id: number;
  projectId: string;
  operation: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costCny: number;
  createdAt: number;
}

// ============== DeepSeek ==============
export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DeepSeekRequest {
  messages: Message[];
  model: "deepseek-chat" | "deepseek-reasoner";
  stream: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface DeepSeekResponse {
  id: string;
  choices: {
    index: number;
    delta?: { content?: string; reasoning_content?: string };
    message?: { content: string; reasoning_content?: string };
    finish_reason: string | null;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============== 润色操作 ==============
export type PolishOperation =
  | "rewrite"
  | "expand"
  | "enhance_horror"
  | "remove_ai"
  | "first_person";
