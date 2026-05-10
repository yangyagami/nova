import { create } from "zustand";
import type { Project, CreateProjectInput, Volume, Chapter, Character, LoreEntry } from "@/types";
import { getDb } from "@/lib/db";

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  volumes: Volume[];
  chapters: Chapter[];
  characters: Character[];
  loreEntries: LoreEntry[];
  loading: boolean;

  // Actions
  listProjects: () => Promise<void>;
  createProject: (input: CreateProjectInput) => Promise<Project>;
  getProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  updateProject: (id: string, input: CreateProjectInput) => Promise<void>;
  setCurrentProject: (project: Project | null) => void;

  // Volumes
  setVolumes: (volumes: Volume[]) => void;

  // Chapters
  setChapters: (chapters: Chapter[]) => void;
  updateChapter: (id: string, partial: Partial<Chapter>) => void;

  // Characters
  setCharacters: (characters: Character[]) => void;

  // Lore
  setLoreEntries: (entries: LoreEntry[]) => void;
}

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `prj_${timestamp}${random}`;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  volumes: [],
  chapters: [],
  characters: [],
  loreEntries: [],
  loading: false,

  listProjects: async () => {
    set({ loading: true });
    try {
      const db = await getDb();
      const projects = await db.select<Project[]>(
        "SELECT id, title, project_type as projectType, subgenre, premise, target_words as targetWords, target_chapters as targetChapters, words_per_chapter as wordsPerChapter, status, created_at as createdAt, updated_at as updatedAt FROM projects ORDER BY updated_at DESC"
      );
      set({ projects, loading: false });
    } catch (e) {
      console.error("Failed to list projects:", e);
      set({ loading: false });
    }
  },

  createProject: async (input: CreateProjectInput) => {
    const id = generateId();
    const timestamp = now();
    const projectType = input.projectType || "novel";

    const db = await getDb();
    await db.execute(
      `INSERT INTO projects (id, title, project_type, subgenre, premise, target_words, target_chapters, words_per_chapter, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        input.title,
        projectType,
        input.subgenre,
        input.premise,
        input.targetWords,
        input.targetChapters,
        input.wordsPerChapter,
        "draft",
        timestamp,
        timestamp,
      ]
    );

    // 如果提供了主角姓名，同步创建角色记录
    if (input.protagonistName) {
      const charId = `char_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`;
      await db.execute(
        `INSERT INTO characters (id, project_id, name, role, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [charId, id, input.protagonistName, "protagonist", timestamp]
      );
    }

    const project: Project = {
      id,
      title: input.title,
      projectType,
      subgenre: input.subgenre,
      premise: input.premise,
      targetWords: input.targetWords,
      targetChapters: input.targetChapters,
      wordsPerChapter: input.wordsPerChapter,
      status: "draft",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    set((state) => ({ projects: [project, ...state.projects] }));
    return project;
  },

  getProject: async (id: string) => {
    set({ loading: true });
    try {
      const db = await getDb();
      const projects = await db.select<Project[]>(
        "SELECT id, title, project_type as projectType, subgenre, premise, target_words as targetWords, target_chapters as targetChapters, words_per_chapter as wordsPerChapter, status, created_at as createdAt, updated_at as updatedAt FROM projects WHERE id = $1",
        [id]
      );
      set({ currentProject: projects[0] || null, loading: false });
    } catch (e) {
      console.error("Failed to get project:", e);
      set({ loading: false });
    }
  },

  deleteProject: async (id: string) => {
    try {
      const db = await getDb();
      await db.execute("DELETE FROM projects WHERE id = $1", [id]);
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
      }));
    } catch (e) {
      console.error("Failed to delete project:", e);
    }
  },

  updateProject: async (id: string, input: CreateProjectInput) => {
    try {
      const db = await getDb();
      const timestamp = now();
      const projectType = input.projectType || "novel";

      // 更新前获取现有项目的状态和创建时间，防止丢失
      const state = get();
      const existing =
        state.projects.find((p) => p.id === id) || state.currentProject;
      const preservedStatus = existing?.status || "draft";
      const preservedCreatedAt = existing?.createdAt || timestamp;

      await db.execute(
        `UPDATE projects SET title = $1, project_type = $2, subgenre = $3, premise = $4, target_words = $5, target_chapters = $6, words_per_chapter = $7, updated_at = $8 WHERE id = $9`,
        [
          input.title,
          projectType,
          input.subgenre,
          input.premise,
          input.targetWords,
          input.targetChapters,
          input.wordsPerChapter,
          timestamp,
          id,
        ]
      );

      const project: Project = {
        id,
        title: input.title,
        projectType,
        subgenre: input.subgenre,
        premise: input.premise,
        targetWords: input.targetWords,
        targetChapters: input.targetChapters,
        wordsPerChapter: input.wordsPerChapter,
        status: preservedStatus,
        createdAt: preservedCreatedAt,
        updatedAt: timestamp,
      };

      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? project : p)),
        currentProject:
          state.currentProject?.id === id ? project : state.currentProject,
      }));
    } catch (e) {
      console.error("Failed to update project:", e);
    }
  },

  setCurrentProject: (project) => set({ currentProject: project }),

  setVolumes: (volumes) => set({ volumes }),
  setChapters: (chapters) => set({ chapters }),

  updateChapter: (id, partial) => {
    set((state) => ({
      chapters: state.chapters.map((ch) =>
        ch.id === id ? { ...ch, ...partial } : ch
      ),
    }));
  },

  setCharacters: (characters) => set({ characters }),
  setLoreEntries: (entries) => set({ loreEntries: entries }),
}));
