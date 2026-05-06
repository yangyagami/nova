import type { Message, DeepSeekResponse } from "@/types";

const DEEPSEEK_API_BASE = "https://api.deepseek.com/v1";

export class DeepSeekError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "DeepSeekError";
    this.status = status;
    this.body = body;
  }
}

export interface ChatOptions {
  messages: Message[];
  model?: "deepseek-chat" | "deepseek-reasoner";
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  onToken?: (token: string) => void;
  onReasoning?: (token: string) => void;
}

export interface ChatResult {
  content: string;
  reasoningContent?: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * DeepSeek API 客户端
 * 支持流式输出、自动重试（指数退避）、错误处理
 */
export async function chatCompletion(
  apiKey: string,
  opts: ChatOptions
): Promise<ChatResult> {
  const {
    messages,
    model = "deepseek-chat",
    temperature = 0.85,
    maxTokens = 8192,
    signal,
    onToken,
    onReasoning,
  } = opts;

  const isStream = !!onToken;

  // 构建请求体
  const body = JSON.stringify({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: isStream,
  });

  let lastError: Error | null = null;

  // 重试逻辑：指数退避，最多 3 次
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) {
        // 指数退避：1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      if (isStream) {
        return await streamChat(apiKey, body, model, signal, onToken, onReasoning);
      } else {
        return await nonStreamChat(apiKey, body);
      }
    } catch (err) {
      lastError = err as Error;

      // 非可重试错误直接抛出
      if (err instanceof DeepSeekError) {
        if (err.status === 401 || err.status === 400 || err.status === 422) {
          throw err;
        }
        // 429 (限流) 或 5xx 可重试
        if (err.status < 429) {
          throw err;
        }
      }

      // 如果是 AbortError，直接抛出
      if ((err as Error)?.name === "AbortError") {
        throw err;
      }

      console.warn(
        `DeepSeek API attempt ${attempt + 1} failed:`,
        (err as Error).message
      );
    }
  }

  throw lastError || new Error("Request failed after 3 retries");
}

async function nonStreamChat(
  apiKey: string,
  body: string
): Promise<ChatResult> {
  const response = await fetch(`${DEEPSEEK_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body,
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => null);
    throw new DeepSeekError(
      `API error: ${response.status} ${response.statusText}`,
      response.status,
      errBody
    );
  }

  const data: DeepSeekResponse = await response.json();
  const message = data.choices?.[0]?.message;

  return {
    content: message?.content || "",
    reasoningContent: message?.reasoning_content,
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    },
  };
}

async function streamChat(
  apiKey: string,
  body: string,
  model: string,
  signal?: AbortSignal,
  onToken?: (token: string) => void,
  onReasoning?: (token: string) => void
): Promise<ChatResult> {
  const response = await fetch(`${DEEPSEEK_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body,
    signal,
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => null);
    throw new DeepSeekError(
      `API error: ${response.status} ${response.statusText}`,
      response.status,
      errBody
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new DeepSeekError("No response body", 0);
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let reasoningContent = "";
  let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;

      const data = trimmed.slice(6);
      if (data === "[DONE]") continue;

      try {
        const parsed: DeepSeekResponse = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;

        if (delta?.content) {
          content += delta.content;
          onToken?.(delta.content);
        }

        if (delta?.reasoning_content) {
          reasoningContent += delta.reasoning_content;
          onReasoning?.(delta.reasoning_content);
        }

        if (parsed.usage) {
          usage = {
            promptTokens: parsed.usage.prompt_tokens,
            completionTokens: parsed.usage.completion_tokens,
            totalTokens: parsed.usage.total_tokens,
          };
        }
      } catch {
        // Skip malformed JSON lines
      }
    }
  }

  return { content, reasoningContent, usage };
}
