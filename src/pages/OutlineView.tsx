import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProjectStore } from "@/stores/projectStore";
import { useGenerationStore } from "@/stores/generationStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, Loader2, XCircle, BookOpen, ChevronDown, ChevronRight, FileText, AlertCircle, CheckCircle2, Maximize2, Minimize2 } from "lucide-react";
import { subgenreLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function OutlineView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentProject, loading, getProject } = useProjectStore();
  const {
    status,
    currentStep,
    error,
    streamingContent,
    generatedVolumes,
    generatedChapters,
    generateOutline,
    cancelGeneration,
    loadOutline,
    ensureOutlineForProject,
  } = useGenerationStore();

  const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(new Set());
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [showStreamPanel, setShowStreamPanel] = useState(true);
  const streamEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      getProject(id);
    }
  }, [id, getProject]);

  // Clear stale outline + load existing if any
  useEffect(() => {
    if (currentProject && !initialLoadDone) {
      ensureOutlineForProject(currentProject.id);
      if (currentProject.status === "outlining" || currentProject.status === "writing") {
        loadOutline(currentProject.id);
      }
      setInitialLoadDone(true);
    }
  }, [currentProject, initialLoadDone, loadOutline, ensureOutlineForProject]);

  // Auto-expand after generation
  useEffect(() => {
    if (status === "done" && generatedVolumes.length > 0) {
      setExpandedVolumes(new Set(generatedVolumes.map((v) => v.id)));
    }
  }, [status, generatedVolumes]);

  // Auto-scroll streaming content
  useEffect(() => {
    if (status === "generating") {
      streamEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [streamingContent, status]);

  const toggleVolume = (volumeId: string) => {
    setExpandedVolumes((prev) => {
      const next = new Set(prev);
      if (next.has(volumeId)) next.delete(volumeId);
      else next.add(volumeId);
      return next;
    });
  };

  const handleGenerate = () => {
    if (!currentProject) return;
    generateOutline(currentProject.id, currentProject.title, {
      subgenre: currentProject.subgenre,
      premise: currentProject.premise,
      targetChapters: currentProject.targetChapters,
      targetWords: currentProject.targetWords,
    });
  };

  const chaptersForVolume = (volumeId: string) =>
    generatedChapters.filter((ch) => ch.volumeId === volumeId);

  const totalChapters = generatedChapters.length;

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

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/project/${id}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold truncate">{currentProject.title}</h1>
            <Badge variant="outline">{subgenreLabel(currentProject.subgenre)}</Badge>
            <Badge variant="secondary">大纲</Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5 truncate">{currentProject.premise}</p>
        </div>
      </div>

      {/* Initial — generate CTA */}
      {status === "idle" && generatedVolumes.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              生成大纲
            </CardTitle>
            <CardDescription>
              AI 将根据你的核心创意自动生成全书分卷大纲和章节细纲。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-md bg-muted/50">
                <p className="font-medium">目标章节</p>
                <p className="text-muted-foreground">{currentProject.targetChapters} 章</p>
              </div>
              <div className="p-3 rounded-md bg-muted/50">
                <p className="font-medium">目标字数</p>
                <p className="text-muted-foreground">{currentProject.targetWords.toLocaleString()} 字</p>
              </div>
            </div>
            <Button size="lg" onClick={handleGenerate}>
              <Sparkles className="h-4 w-4 mr-2" />
              生成大纲
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Generating — show streaming output */}
      {status === "generating" && (
        <div className="space-y-4">
          {/* Progress indicator */}
          <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{currentStep}</p>
              <div className="w-full bg-border rounded-full h-1 mt-1.5 overflow-hidden">
                <div className="bg-primary h-full rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowStreamPanel(!showStreamPanel)}>
              {showStreamPanel ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={cancelGeneration}>
              <XCircle className="h-4 w-4 mr-1" />
              取消
            </Button>
          </div>

          {/* Streaming text viewer */}
          {showStreamPanel && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">AI 实时输出</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto rounded-md bg-black/20 p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                  {streamingContent ? (
                    <>
                      {streamingContent}
                      <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />
                    </>
                  ) : (
                    <span className="text-muted-foreground">等待 AI 响应...</span>
                  )}
                  <div ref={streamEndRef} />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              生成失败
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{error}</p>
            {streamingContent && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">查看已接收的内容</summary>
                <pre className="mt-2 p-3 rounded-md bg-black/20 max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {streamingContent}
                </pre>
              </details>
            )}
            <div className="flex gap-2">
              <Button onClick={handleGenerate}>重试</Button>
              <Button variant="outline" onClick={() => navigate(`/project/${id}`)}>
                返回项目
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outline tree */}
      {generatedVolumes.length > 0 && (
        <>
          {/* Summary bar */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">卷:</span>
                    <span className="font-medium">{generatedVolumes.length}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">章:</span>
                    <span className="font-medium">{totalChapters}</span>
                  </span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {status === "done" ? "✓ 已保存" : "已加载"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Volume / Chapter tree */}
          <div className="space-y-3">
            {generatedVolumes.map((volume) => {
              const chapters = chaptersForVolume(volume.id);
              const isExpanded = expandedVolumes.has(volume.id);
              return (
                <Card key={volume.id}>
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => toggleVolume(volume.id)}
                  >
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="shrink-0">
                          第 {volume.indexNo} 卷
                        </Badge>
                        <h3 className="font-semibold truncate">{volume.title}</h3>
                      </div>
                      {volume.arcGoal && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          目标：{volume.arcGoal}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{chapters.length} 章</span>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border">
                      {chapters.map((chapter, idx) => (
                        <div
                          key={chapter.id}
                          className={cn(
                            "flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-b-0",
                            "hover:bg-muted/20 transition-colors"
                          )}
                        >
                          <span className="text-xs text-muted-foreground mt-0.5 w-6 text-right shrink-0">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-medium truncate">{chapter.title}</h4>
                            </div>
                            {chapter.outline && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{chapter.outline}</p>
                            )}
                            <div className="flex gap-3 mt-1.5">
                              {chapter.horrorBeat && (
                                <span className="text-xs text-primary/80">🎯 {chapter.horrorBeat}</span>
                              )}
                              {chapter.hook && (
                                <span className="text-xs text-amber-500/80">🪝 {chapter.hook}</span>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-xs">
                            {chapter.status === "done" ? "已完成" : chapter.status === "pending" ? "待生成" : chapter.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Bottom actions */}
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              共 {generatedVolumes.length} 卷，{totalChapters} 章
            </p>
            <div className="flex gap-2">
              {status === "done" && (
                <Button variant="outline" onClick={handleGenerate}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  重新生成
                </Button>
              )}
              <Button onClick={() => navigate(`/project/${id}`)}>返回项目</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
