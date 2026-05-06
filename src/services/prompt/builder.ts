import type { Message } from "@/types";

/**
 * PromptBuilder - 构建 DeepSeek API 的 prompt
 *
 * 模板分层：
 * SystemPrompt（恐怖通用规则）
 *   + SubgenrePrompt（都市怪谈/民俗恐怖各异）
 *   + TaskPrompt（outline/chapter/polish）
 *   + ContextInjection（人物卡 + 设定库 + 前情摘要）
 *   + UserInput
 */

// ============== 恐怖通用 System Prompt ==============
const HORROR_SYSTEM_PROMPT = `你是一位经验丰富的中文恐怖小说作家。请严格遵守以下创作准则：

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
- 对话用方言/口头禅强化人物辨识度。`;

// ============== 子类型提示 ==============
const SUBGENRE_PROMPTS: Record<string, string> = {
  urban_legend: `【都市怪谈创作指南】
- 背景设定在现代都市，利用日常场景（地铁、电梯、便利店、公寓）制造恐怖。
- 核心恐怖来源：违背常理的现象、都市传说的现实化、科技产品的诡异用途。
- 保持"可信度"——让读者觉得"这也有可能发生在我身边"。
- 结局可以是开放式，留下余悸。`,

  folk_horror: `【民俗恐怖创作指南】
- 背景设定在乡村/古镇/山林，利用传统习俗、禁忌、祭祀仪式制造恐怖。
- 核心恐怖来源：代代相传的规矩被打破、古老信仰的黑暗面、人与自然/祖先的契约。
- 注重氛围营造——雨夜、老宅、黄纸、香灰、红绳。
- 结局应当揭示民俗背后的真相，但保留一丝不可知。`,
};

// ============== 任务提示 ==============
const TASK_PROMPTS: Record<string, string> = {
  outline: `【任务：生成大纲】
请根据以下项目信息，生成详细的小说大纲。

要求：
1. 将全书分为 3-5 卷，每卷有明确的剧情目标
2. 每卷下分若干章，每章提供：
   - 章节标题
   - 细纲（200-300字概述）
   - 核心恐怖点（本章最恐怖的元素）
   - 章末钩子（吸引读者看下一章）
3. 整体节奏：前 30% 铺垫建立世界观，中间 50% 逐步升级冲突，最后 20% 高潮+收尾
4. 注意伏笔的埋设与回收

请以 JSON 格式输出。`,

  chapter: `【任务：生成正文】
请根据大纲细纲，生成一章完整的恐怖小说正文。

要求：
1. 严格遵守上述【节奏】【感官】【视角】【语言】准则
2. 字数控制在目标字数 ±10% 范围内
3. 开头与前情衔接自然，结尾保留钩子
4. 如果本章有关键线索/伏笔，自然地融入叙事`,

  summarize: `【任务：生成章节摘要】
请为以下章节生成 200 字以内的摘要，重点包括：
- 本章发生的关键事件
- 出场人物及其状态变化
- 新出现的设定/线索
- 本章结束时留下的悬念`,

  extract_lore: `【任务：抽取设定】
请从以下正文中抽取设定信息，以 JSON 格式输出：
{
  "new_characters": [{ "name": "角色名", "role": "protagonist|antagonist|supporting", "appearance": "外貌", "personality": "性格", "secret": "秘密/动机" }],
  "new_locations": [{ "name": "地点名", "description": "描述" }],
  "new_items": [{ "name": "道具名", "description": "描述" }],
  "new_foreshadows": [{ "description": "伏笔描述" }],
  "paid_off_foreshadows": ["伏笔ID"]
}
没有新增的项目请返回空数组。`,
};

// ============== 润色操作提示 ==============
const POLISH_PROMPTS: Record<string, string> = {
  rewrite: "保持原意，用不同的句式和词汇重写以下段落。不要改变情节和视角。",
  expand: "将以下段落扩写到 2 倍长度，增加感官细节、心理描写和环境渲染，但不改变情节进展。",
  enhance_horror: "加强以下段落的恐怖氛围：增加感官细节（声音/气味/温度/触感）、放慢节奏、用暗示代替直说、强化心理压迫感。",
  remove_ai: "改写以下段落使其更像人类作家写的：打散排比句、删除AI套话（'总而言之'、'不仅...而且'等）、加入口语化表达、让句式更自然多变。",
  first_person: "将以下段落改为第一人称限制视角（'我'），只描述主角能感知到的内容，不透露其他人的想法。",
};

// ============== Public API ==============

export interface BuildOutlinePromptParams {
  subgenre: string;
  premise: string;
  targetChapters: number;
  targetWords: number;
  characters?: { name: string; role: string; identity: string; secret: string }[];
}

export interface BuildChapterPromptParams {
  subgenre: string;
  premise: string;
  chapterTitle: string;
  chapterOutline: string;
  horrorBeat: string;
  hook: string;
  targetWords: number;
  characters: string; // formatted character cards
  lore: string; // formatted lore entries
  recentSummaries: string[]; // last 3 chapter summaries
  previousEnding: string; // last 500 chars of previous chapter
  activeForeshadows: string; // formatted foreshadow entries
}

export interface BuildPolishPromptParams {
  operation: string;
  text: string;
}

/**
 * 构建大纲生成 prompt
 */
export function buildOutlinePrompt(params: BuildOutlinePromptParams): Message[] {
  const { subgenre, premise, targetChapters, targetWords, characters = [] } = params;

  const characterCards = characters
    .map((c) => `- ${c.name}（${c.role === "protagonist" ? "主角" : c.role === "antagonist" ? "反派" : "配角"}）身份：${c.identity}，秘密/动机：${c.secret}`)
    .join("\n");

  const userContent = `# 项目信息\n\n- 类型：${subgenre === "folk_horror" ? "民俗恐怖" : "都市怪谈"}\n- 核心创意：${premise}\n- 目标章节数：${targetChapters}\n- 目标总字数：${targetWords}\n\n## 角色设定\n${characterCards || "（暂无详细设定）"}`;

  return [
    { role: "system", content: `${HORROR_SYSTEM_PROMPT}\n\n${SUBGENRE_PROMPTS[subgenre] || ""}\n\n${TASK_PROMPTS.outline}` },
    { role: "user", content: userContent },
  ];
}

/**
 * 构建单章生成 prompt
 */
export function buildChapterPrompt(params: BuildChapterPromptParams): Message[] {
  const {
    subgenre,
    premise,
    chapterTitle,
    chapterOutline,
    horrorBeat,
    hook: chapterHook,
    targetWords,
    characters,
    lore,
    recentSummaries,
    previousEnding,
    activeForeshadows,
  } = params;

  const summariesSection = recentSummaries.length > 0
    ? `\n\n## 前情摘要\n${recentSummaries.map((s, i) => `第 ${i + 1} 章摘要：${s}`).join("\n")}`
    : "";

  const previousEndingSection = previousEnding
    ? `\n\n## 前一章结尾\n${previousEnding}`
    : "";

  const userContent = `# 项目信息\n\n- 类型：${subgenre === "folk_horror" ? "民俗恐怖" : "都市怪谈"}\n- 核心创意：${premise}\n- 目标字数：${targetWords}\n\n## 本章信息\n- 标题：${chapterTitle}\n- 细纲：${chapterOutline}\n- 核心恐怖点：${horrorBeat}\n- 章末钩子：${chapterHook}${summariesSection}${previousEndingSection}\n\n## 角色设定（本章相关）\n${characters}\n\n## 相关设定\n${lore}\n\n## 活跃伏笔\n${activeForeshadows}`;

  return [
    { role: "system", content: `${HORROR_SYSTEM_PROMPT}\n\n${SUBGENRE_PROMPTS[subgenre] || ""}\n\n${TASK_PROMPTS.chapter}` },
    { role: "user", content: userContent },
  ];
}

/**
 * 构建润色 prompt
 */
export function buildPolishPrompt(params: BuildPolishPromptParams): Message[] {
  const { operation, text } = params;
  const instruction = POLISH_PROMPTS[operation] || POLISH_PROMPTS.rewrite;

  return [
    {
      role: "system",
      content: `你是一位资深的小说编辑。${instruction}\n\n请直接输出修改后的段落，不要输出其他内容。`,
    },
    { role: "user", content: `请润色以下段落：\n\n${text}` },
  ];
}

/**
 * 构建摘要生成 prompt
 */
export function buildSummarizePrompt(chapterContent: string): Message[] {
  return [
    { role: "system", content: TASK_PROMPTS.summarize },
    { role: "user", content: chapterContent },
  ];
}

/**
 * 构建设定抽取 prompt
 */
export function buildLoreExtractPrompt(chapterContent: string): Message[] {
  return [
    { role: "system", content: TASK_PROMPTS.extract_lore },
    { role: "user", content: chapterContent },
  ];
}
