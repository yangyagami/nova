import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useProjectStore } from "@/stores/projectStore";
import { useGenerationStore } from "@/stores/generationStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { chatCompletion } from "@/services/deepseek";
import { buildChapterPrompt, buildPolishPrompt, buildSummarizePrompt } from "@/services/prompt";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import LoreSidebar from "@/components/lore/LoreSidebar";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  BookOpen,
  Send,
  RotateCcw,
  X,
  Save,
  ChevronRight,
  ChevronDown,
  Layers,
  Eye,
  EyeOff,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getDb } from "@/lib/db";
import type { Chapter, Volume, PolishOperation } from "@/types";

// ==================== TipTap 轻量文本编辑区 ====================
function SimpleEditor({
  content,
  onChange,
  readOnly = false,
  placeholder = "开始写作...",
}: {
  content: string;
  onChange?: (html: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(content);

  useEffect(() => {
    setValue(content);
  }, [content]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setValue(newVal);
    onChange?.(newVal);
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={handleChange}
      readOnly={readOnly}
      placeholder={placeholder}
      className={cn(
        "w-full h-full min-h-[400px] resize-none bg-transparent p-6 text-base leading-relaxed",
        "focus:outline-none focus:ring-0",
        "placeholder:text-muted-foreground/40",
        readOnly && "cursor-default"
      )}
      style={{ fontFamily: "'Noto Serif SC', 'Source Han Serif SC', 'SimSun', serif" }}
    />
  );
}

// ==================== 润色对比视图 ====================
function CompareView({
  original,
  polished,
  onAccept,
  onReject,
  onRegenerate,
}: {
  original: string;
  polished: string;
  onAccept: () => void;
  onReject: () => void;
  onRegenerate: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[80vh] bg-card rounded-lg border border-border shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold">润色对比</h3>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onRegenerate}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              再生成
            </Button>
            <Button size="sm" variant="outline" onClick={onReject}>
              <X className="h-3.5 w-3.5 mr-1" />
              拒绝
            </Button>
            <Button size="sm" onClick={onAccept}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              接受
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 flex-1 divide-x divide-border overflow-hidden">
          <div className="p-4 overflow-auto">
            <p className="text-xs text-muted-foreground mb-2 font-medium">原文</p>
            <div className="text-sm whitespace-pre-wrap text-muted-foreground">{original}</div>
          </div>
          <div className="p-4 overflow-auto bg-primary/5">
            <p className="text-xs text-primary mb-2 font-medium">润色后</p>
            <div className="text-sm whitespace-pre-wrap">{polished}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== 润色操作菜单 ====================
const POLISH_OPERATIONS: { value: PolishOperation; label: string; icon: string }[] = [
  { value: "rewrite", label: "重写", icon: "✏️" },
  { value: "expand", label: "扩写", icon: "📖" },
  { value: "enhance_horror", label: "增强恐怖氛围", icon: "👻" },
  { value: "remove_ai", label: "去 AI 味", icon: "🧹" },
  { value: "first_person", label: "改第一人称", icon: "👤" },
];

// ==================== 主页面 ====================
export default function EditorView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { currentProject, loading, getProject, chapters, setChapters, updateChapter } = useProjectStore();
  const { generatedVolumes, generatedChapters, loadOutline } = useGenerationStore();

  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(new Set());
  const [showPolishDialog, setShowPolishDialog] = useState(false);
  const [polishOriginal, setPolishOriginal] = useState("");
  const [polishResult, setPolishResult] = useState("");
  const [isPolishing, setIsPolishing] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [showCompare, setShowCompare] = useState(false);
  const [chapterList, setChapterList] = useState<Chapter[]>([]);
  const [showLore, setShowLore] = useState(false);
  const [volumeList, setVolumeList] = useState<Volume[]>([]);

  // 加载项目和大纲
  useEffect(() => {
    if (id) {
      getProject(id);
      loadOutline(id);
    }
  }, [id, getProject, loadOutline]);

  // 更新本地章节列表
  useEffect(() => {
    const allChapters = generatedChapters.length > 0 ? generatedChapters : chapters;
    const allVolumes = generatedVolumes.length > 0 ? generatedVolumes : [];
    setChapterList(allChapters);
    setVolumeList(allVolumes);

    // 自动展开所有卷
    if (allVolumes.length > 0) {
      setExpandedVolumes(new Set(allVolumes.map((v) => v.id)));
    }

    // 如果有 URL 参数指定章节，或自动选中第一章
    const chapterIdParam = searchParams.get("chapter");
    if (chapterIdParam && allChapters.find((ch) => ch.id === chapterIdParam)) {
      setActiveChapterId(chapterIdParam);
    } else if (!activeChapterId && allChapters.length > 0) {
      setActiveChapterId(allChapters[0].id);
    }
  }, [generatedChapters, chapters, generatedVolumes, searchParams]);

  // 切换章节时加载内容
  useEffect(() => {
    if (activeChapterId) {
      const ch = chapterList.find((c) => c.id === activeChapterId);
      if (ch) {
        setEditorContent(ch.content || "");
      }
    }
  }, [activeChapterId, chapterList]);

  const activeChapter = chapterList.find((c) => c.id === activeChapterId);

  // 获取当前章节索引（在整个故事中的顺序位置）
  const getChapterIndex = (chId: string) => chapterList.findIndex((ch) => ch.id === chId);
  const currentIndex = activeChapter ? getChapterIndex(activeChapter.id) : -1;

  // 保存内容到数据库
  const saveContent = useCallback(async () => {
    if (!activeChapterId) return;
    try {
      const db = await getDb();
      const wordCount = editorContent.replace(/\s/g, "").length;
      await db.execute(
        "UPDATE chapters SET content = $1, word_count = $2, edited_at = $3 WHERE id = $4",
        [editorContent, wordCount, Math.floor(Date.now() / 1000), activeChapterId]
      );
      updateChapter(activeChapterId, { content: editorContent, wordCount });
    } catch (e) {
      console.error("Failed to save content:", e);
    }
  }, [activeChapterId, editorContent, updateChapter]);

  // 自动保存（每30秒）
  useEffect(() => {
    if (!activeChapterId || isGenerating) return;
    const interval = setInterval(saveContent, 30000);
    return () => clearInterval(interval);
  }, [activeChapterId, isGenerating, saveContent]);

  // 生成单章正文（可指定章节 ID，用于批量生成）
  const handleGenerate = async (chapterId?: string) => {
    const targetChapter = chapterId
      ? chapterList.find((ch) => ch.id === chapterId)
      : activeChapter;
    if (!targetChapter || !currentProject || !id) return;

    const ac = new AbortController();
    setAbortController(ac);
    setIsGenerating(true);
    setError(null);
    setCurrentStep("正在准备生成...");

    try {
      await useSettingsStore.getState().ensureLoaded();
      const settings = useSettingsStore.getState().settings;

      if (!settings.apiKey) {
        throw new Error("请先在设置页配置 API Key");
      }

      // 标记生成中
      setCurrentStep("正在生成第 " + targetChapter.indexNo + " 章...");
      await getDb().then((db) =>
        db.execute("UPDATE chapters SET status = $1 WHERE id = $2", ["generating", targetChapter.id])
      );

      // 构建角色设定字符串
      const db = await getDb();
      const chars = await db.select<any[]>(
        "SELECT name, role, identity, secret FROM characters WHERE project_id = $1",
        [id]
      );
      const characterStr =
        chars.length > 0
          ? chars
              .map(
                (c: any) =>
                  `- ${c.name}（${c.role === "protagonist" ? "主角" : c.role === "antagonist" ? "反派" : "配角"}）${c.identity ? "身份：" + c.identity : ""}${c.secret ? "，秘密：" + c.secret : ""}`
              )
              .join("\n")
          : "（暂无角色设定）";

      // 获取前情摘要（前三章）
      const prevChapters = chapterList
        .filter((ch) => ch.indexNo < targetChapter.indexNo && ch.summary)
        .sort((a, b) => b.indexNo - a.indexNo)
        .slice(0, 3)
        .reverse();

      const recentSummaries = prevChapters.map((ch) => ch.summary);

      // 获取前一章结尾
      const prevChapter = chapterList.find((ch) => ch.indexNo === targetChapter.indexNo - 1);
      const previousEnding = prevChapter?.content
        ? prevChapter.content.slice(-500)
        : "";

      // 获取相关设定
      const loreEntries = await db.select<any[]>(
        "SELECT name, category, description FROM lore_entries WHERE project_id = $1 LIMIT 20",
        [id]
      );
      const loreStr =
        loreEntries.length > 0
          ? loreEntries
              .map((l: any) => `[${l.category}] ${l.name}：${l.description || ""}`)
              .join("\n")
          : "（暂无设定）";

      // 获取活跃伏笔
      const foreshadows = await db.select<any[]>(
        "SELECT description FROM foreshadows WHERE project_id = $1 AND status = 'planted'",
        [id]
      );
      const foreshadowStr =
        foreshadows.length > 0
          ? foreshadows.map((f: any) => `- ${f.description}`).join("\n")
          : "（暂无活跃伏笔）";

      const messages = buildChapterPrompt({
        subgenre: currentProject.subgenre,
        premise: currentProject.premise,
        chapterTitle: targetChapter.title,
        chapterOutline: targetChapter.outline,
        horrorBeat: targetChapter.horrorBeat,
        hook: targetChapter.hook,
        targetWords: currentProject.wordsPerChapter,
        characters: characterStr,
        lore: loreStr,
        recentSummaries,
        previousEnding,
        activeForeshadows: foreshadowStr,
      });

      let fullContent = "";

      const onToken = (token: string) => {
        fullContent += token;
        setEditorContent(fullContent);
      };

      await chatCompletion(settings.apiKey, {
        messages,
        model: settings.model,
        temperature: 0.85,
        maxTokens: settings.maxTokens,
        apiBaseUrl: settings.apiBaseUrl,
        signal: ac.signal,
        onToken,
      });

      // 保存到数据库
      const wordCount = fullContent.replace(/\s/g, "").length;
      const timestamp = Math.floor(Date.now() / 1000);
      await db.execute(
        "UPDATE chapters SET content = $1, word_count = $2, status = $3, generated_at = $4 WHERE id = $5",
        [fullContent, wordCount, "done", timestamp, targetChapter.id]
      );
      updateChapter(targetChapter.id, {
        content: fullContent,
        wordCount,
        status: "done",
        generatedAt: timestamp,
      });

      setCurrentStep("生成完成!");
      setIsGenerating(false);
      setAbortController(null);

      // 异步：生成摘要
      generateSummary(targetChapter.id, fullContent);

      // 检查是否所有章节都已生成
      const updatedChapters = chapterList.map((ch) =>
        ch.id === targetChapter.id ? { ...ch, content: fullContent, wordCount, status: "done" as const } : ch
      );
      const allDone = updatedChapters.every((ch) => ch.status === "done");
      if (allDone) {
        await db.execute("UPDATE projects SET status = $1, updated_at = $2 WHERE id = $3", [
          "done",
          timestamp,
          id,
        ]);
      }
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setCurrentStep("已取消");
        setIsGenerating(false);
        return;
      }
      setError(e.message || "生成失败");
      setCurrentStep("生成失败");

      // 标记为错误
      try {
        const db = await getDb();
        await db.execute("UPDATE chapters SET status = $1 WHERE id = $2", ["error", targetChapter.id]);
      } catch {}
    } finally {
      setIsGenerating(false);
      setAbortController(null);
    }
  };

  // 生成摘要
  const generateSummary = async (chapterId: string, content: string) => {
    try {
      const settings = useSettingsStore.getState().settings;
      if (!settings.apiKey) return;

      const messages = buildSummarizePrompt(content.slice(0, 4000));
      const result = await chatCompletion(settings.apiKey, {
        messages,
        model: settings.model,
        temperature: 0.2,
        maxTokens: 512,
      });

      const db = await getDb();
      await db.execute("UPDATE chapters SET summary = $1 WHERE id = $2", [result.content, chapterId]);
      updateChapter(chapterId, { summary: result.content });
    } catch (e) {
      console.error("Failed to generate summary:", e);
    }
  };

  // 取消生成
  const handleCancel = () => {
    abortController?.abort();
    setAbortController(null);
  };

  // 润色操作
  const handlePolish = async (operation: PolishOperation) => {
    const text = selectedText || editorContent;
    if (!text) return;

    setPolishOriginal(text);
    setShowPolishDialog(true);
    setIsPolishing(true);
    setPolishResult("");

    try {
      await useSettingsStore.getState().ensureLoaded();
      const settings = useSettingsStore.getState().settings;

      if (!settings.apiKey) throw new Error("请先配置 API Key");

      const messages = buildPolishPrompt({ operation, text });

      let result = "";
      await chatCompletion(settings.apiKey, {
        messages,
        model: settings.model,
        temperature: 0.6,
        maxTokens: Math.max(text.length * 3, 2048),
        apiBaseUrl: settings.apiBaseUrl,
        onToken: (token) => {
          result += token;
          setPolishResult(result);
        },
      });

      setShowCompare(true);
    } catch (e: any) {
      setPolishResult("润色失败: " + e.message);
    } finally {
      setIsPolishing(false);
    }
  };

  // 接受润色结果
  const handleAcceptPolish = () => {
    if (selectedText) {
      // 替换选中文本
      const newContent = editorContent.replace(selectedText, polishResult);
      setEditorContent(newContent);
    } else {
      setEditorContent(polishResult);
    }
    setShowCompare(false);
    setShowPolishDialog(false);
    setPolishResult("");
    setSelectedText("");
  };

  // 拒绝润色结果
  const handleRejectPolish = () => {
    setShowCompare(false);
    setShowPolishDialog(false);
    setPolishResult("");
  };

  // 文本选择处理
  const handleTextSelect = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      setSelectedText(selection.toString().trim());
    }
  };

  // 切换卷展开
  const toggleVolume = (volId: string) => {
    setExpandedVolumes((prev) => {
      const next = new Set(prev);
      if (next.has(volId)) next.delete(volId);
      else next.add(volId);
      return next;
    });
  };

  // 切换到上一章/下一章
  const goToPrevChapter = () => {
    if (currentIndex > 0) {
      const prev = chapterList[currentIndex - 1];
      setActiveChapterId(prev.id);
      setSearchParams({ chapter: prev.id });
    }
  };

  const goToNextChapter = () => {
    if (currentIndex < chapterList.length - 1) {
      const next = chapterList[currentIndex + 1];
      setActiveChapterId(next.id);
      setSearchParams({ chapter: next.id });
    }
  };

  // 批量生成所有章节
  const handleBatchGenerate = async () => {
    const pendingChapters = chapterList.filter((ch) => ch.status !== "done");
    if (pendingChapters.length === 0) {
      setError("所有章节已生成完毕");
      return;
    }

    for (let i = 0; i < pendingChapters.length; i++) {
      const ch = pendingChapters[i];
      setActiveChapterId(ch.id);
      setSearchParams({ chapter: ch.id });
      // 将章节 ID 传入，确保 batch 模式下使用正确的章节
      await handleGenerate(ch.id);
      // 短暂等待，避免限流
      await new Promise((r) => setTimeout(r, 1000));
    }
  };

  if (loading && !currentProject) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="container mx-auto py-16 text-center space-y-4">
        <BookOpen className="h-16 w-16 mx-auto text-muted-foreground/40" />
        <h2 className="text-xl font-semibold">项目未找到</h2>
        <Button onClick={() => navigate("/")}>返回首页</Button>
      </div>
    );
  }

  const pendingCount = chapterList.filter((ch) => ch.status !== "done").length;
  const doneCount = chapterList.filter((ch) => ch.status === "done").length;

  return (
    <div className="h-[calc(100vh-3.5rem-3rem)] flex">
      {/* 左侧：章节列表 */}
      <div className="w-64 border-r border-border bg-muted/20 flex flex-col shrink-0">
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/project/${id}`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h3 className="font-semibold text-sm truncate">{currentProject.title}</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              {doneCount}/{chapterList.length}
            </span>
            {pendingCount > 0 && (
              <Button variant="outline" size="sm" className="h-6 text-xs ml-auto" onClick={handleBatchGenerate} disabled={isGenerating}>
                <Sparkles className="h-3 w-3 mr-1" />
                批量生成
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {volumeList.map((vol) => {
            const volChapters = chapterList.filter((ch) => ch.volumeId === vol.id);
            const isExpanded = expandedVolumes.has(vol.id);
            return (
              <div key={vol.id}>
                <button
                  className="flex items-center gap-1 w-full px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
                  onClick={() => toggleVolume(vol.id)}
                >
                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <span className="truncate">{vol.title}</span>
                  <span className="ml-auto text-xs">{volChapters.length} 章</span>
                </button>
                {isExpanded &&
                  volChapters.map((ch) => (
                    <button
                      key={ch.id}
                      className={cn(
                        "flex items-center gap-2 w-full px-6 py-2 text-sm transition-colors text-left",
                        ch.id === activeChapterId
                          ? "bg-primary/10 text-primary font-medium border-r-2 border-primary"
                          : "hover:bg-muted/30 text-muted-foreground",
                        ch.status === "done" && "text-foreground"
                      )}
                      onClick={() => {
                        setActiveChapterId(ch.id);
                        setSearchParams({ chapter: ch.id });
                      }}
                    >
                      <span className="text-xs text-muted-foreground w-5 shrink-0">{ch.indexNo}</span>
                      <span className="truncate text-xs">{ch.title}</span>
                      {ch.status === "done" && <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0 ml-auto" />}
                      {ch.status === "error" && <AlertCircle className="h-3 w-3 text-destructive shrink-0 ml-auto" />}
                    </button>
                  ))}
              </div>
            );
          })}
          {volumeList.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground text-center">暂无章节，请先生成大纲</div>
          )}
        </div>
      </div>

      {/* 右侧：编辑器 + 设定库侧栏 */}
      <div className={cn("flex-1 flex min-w-0", showLore ? "flex-row" : "flex-col")}>
        <div className="flex flex-col min-w-0 flex-1">
        {/* 顶部工具栏 */}
        {activeChapter && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/10 shrink-0">
            <Badge variant="outline" className="text-xs shrink-0">
              第 {activeChapter.indexNo} 章
            </Badge>
            <span className="text-sm font-medium truncate">{activeChapter.title}</span>

            <div className="flex items-center gap-1 ml-auto">
              {/* 导航按钮 */}
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={goToPrevChapter} disabled={currentIndex <= 0}>
                上一章
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={goToNextChapter} disabled={currentIndex >= chapterList.length - 1}>
                下一章
              </Button>

              <div className="w-px h-5 bg-border mx-1" />

              {/* 保存 */}
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={saveContent}>
                <Save className="h-3.5 w-3.5 mr-1" />
                保存
              </Button>

              {/* 生成/取消 */}
              {isGenerating ? (
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleCancel}>
                  <X className="h-3.5 w-3.5 mr-1" />
                  取消
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleGenerate}
                    disabled={activeChapter.status === "done"}
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    {activeChapter.status === "done" ? "已生成" : "生成正文"}
                  </Button>
                  {/* 设定库开关 */}
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-7 text-xs", showLore && "bg-muted")}
                onClick={() => setShowLore(!showLore)}
              >
                <BookOpen className="h-3.5 w-3.5 mr-1" />
                设定库
              </Button>

              {/* 润色按钮 */}
              {activeChapter.content && (
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowPolishDialog(true)}
                  >
                    <Wand2 className="h-3.5 w-3.5 mr-1" />
                    润色
                  </Button>
                </div>
              )}
                </>
              )}
            </div>
          </div>
        )}

        {/* 生成进度 */}
        {isGenerating && (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-primary/5 border-b border-primary/20 text-xs text-primary">
            <Loader2 className="h-3 w-3 animate-spin" />
            {currentStep}
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-destructive/5 border-b border-destructive/20 text-xs text-destructive">
            <AlertCircle className="h-3 w-3" />
            {error}
            <Button variant="ghost" size="sm" className="h-5 text-xs ml-auto" onClick={() => setError(null)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* 编辑器主体 */}
        <div className="flex-1 overflow-auto" onMouseUp={handleTextSelect} onKeyUp={handleTextSelect}>
          {activeChapter ? (
            <SimpleEditor
              content={editorContent}
              onChange={setEditorContent}
              readOnly={isGenerating}
              placeholder={
                activeChapter.status === "done"
                  ? "点击「润色」或直接编辑..."
                  : "点击「生成正文」开始写作..."
              }
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center space-y-2">
                <FileText className="h-12 w-12 mx-auto opacity-40" />
                <p>请从左侧选择一章</p>
              </div>
            </div>
          )}
        </div>

        {/* 字数统计 */}
        {activeChapter && (
          <div className="flex items-center gap-4 px-4 py-1.5 border-t border-border text-xs text-muted-foreground shrink-0">
            <span>
              字数：{editorContent.replace(/\s/g, "").length.toLocaleString()} / {currentProject.wordsPerChapter.toLocaleString()}
            </span>
            <span>
              状态：
              <Badge variant="outline" className="text-xs ml-1">
                {activeChapter.status === "done" ? "已完成" : activeChapter.status === "generating" ? "生成中" : activeChapter.status === "error" ? "错误" : "待生成"}
              </Badge>
            </span>
            {selectedText && (
              <span className="text-primary">
                已选 {selectedText.length} 字
              </span>
            )}
          </div>
        )}
      </div>

        {/* 设定库侧栏 */}
        {showLore && id && (
          <div className="w-64 border-l border-border bg-muted/10 shrink-0 overflow-y-auto">
            <LoreSidebar projectId={id} />
          </div>
        )}
      </div>

      {/* 润色弹窗 */}
      <Dialog open={showPolishDialog && !showCompare} onOpenChange={(v) => { if (!v) { setShowPolishDialog(false); setPolishResult(""); } }}>
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle>选择润色操作</DialogTitle>
            <DialogDescription>
              {selectedText ? `已选中 ${selectedText.length} 字` : "将对整章内容进行润色"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2">
            {POLISH_OPERATIONS.map((op) => (
              <Button
                key={op.value}
                variant="outline"
                className="justify-start h-auto py-3 px-4"
                onClick={() => handlePolish(op.value)}
                disabled={isPolishing}
              >
                <span className="mr-2">{op.icon}</span>
                <span className="text-sm">{op.label}</span>
              </Button>
            ))}
          </div>
          {isPolishing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/30 rounded-md">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在润色...
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPolishDialog(false); setPolishResult(""); }}>
              取消
            </Button>
          </DialogFooter>
        </div>
      </Dialog>

      {/* 润色对比视图 */}
      {showCompare && (
        <CompareView
          original={polishOriginal}
          polished={polishResult}
          onAccept={handleAcceptPolish}
          onReject={handleRejectPolish}
          onRegenerate={() => {
            if (selectedText) {
              handlePolish(
                POLISH_OPERATIONS.find(
                  (op) => op.label === document.querySelector("[data-polish-op]")?.getAttribute("data-polish-op")
                )?.value || "rewrite"
              );
            }
          }}
        />
      )}
    </div>
  );
}
