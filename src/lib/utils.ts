import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatWordCount(count: number): string {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}万`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

export function formatTokenCost(cny: number): string {
  return `¥${cny.toFixed(4)}`;
}

export function estimateCost(
  promptTokens: number,
  completionTokens: number,
  model: "deepseek-chat" | "deepseek-reasoner" = "deepseek-chat"
): number {
  // DeepSeek pricing: input ¥0.5/M tokens, output ¥2/M tokens
  const inputPrice = model === "deepseek-reasoner" ? 4.0 : 0.5;
  const outputPrice = model === "deepseek-reasoner" ? 16.0 : 2.0;
  return (promptTokens * inputPrice + completionTokens * outputPrice) / 1_000_000;
}

export function subgenreLabel(subgenre: string): string {
  const labels: Record<string, string> = {
    urban_legend: "都市怪谈",
    folk_horror: "民俗恐怖",
  };
  return labels[subgenre] || subgenre;
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "草稿",
    outlining: "大纲中",
    writing: "写作中",
    done: "已完成",
    pending: "待生成",
    generating: "生成中",
    error: "错误",
  };
  return labels[status] || status;
}
