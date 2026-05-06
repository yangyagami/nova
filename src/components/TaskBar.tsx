import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGenerationStore } from "@/stores/generationStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  BookOpen,
  FileText,
} from "lucide-react";

export default function TaskBar() {
  const navigate = useNavigate();
  const { task, status, currentStep, error, cancelGeneration, dismissTask, retryTask } =
    useGenerationStore();
  const [minimized, setMinimized] = useState(false);

  // No task → nothing to show
  if (!task) return null;

  const isRunning = status === "generating";
  const isError = status === "error";
  const isDone = status === "done";

  const statusIcon = () => {
    if (isRunning) return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    if (isError) return <AlertCircle className="h-4 w-4 text-destructive" />;
    if (isDone) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    return null;
  };

  const statusColor = () => {
    if (isRunning) return "border-primary/30 bg-primary/5";
    if (isError) return "border-destructive/30 bg-destructive/5";
    if (isDone) return "border-green-500/30 bg-green-500/5";
    return "border-border bg-background";
  };

  const handleNavigateToProject = () => {
    navigate(`/project/${task.projectId}/outline`);
  };

  const volumesCount = useGenerationStore.getState().generatedVolumes.length;
  const chaptersCount = useGenerationStore.getState().generatedChapters.length;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 border-t transition-all duration-200",
        statusColor(),
        minimized ? "h-10" : "h-16"
      )}
    >
      {/* Handle bar — always visible */}
      <div className="flex items-center gap-3 px-4 h-10 border-b border-border/50">
        {statusIcon()}
        <span className="text-sm font-medium truncate flex-1">
          {task.label}
          <span className="text-muted-foreground font-normal ml-2">
            · {task.projectTitle}
          </span>
        </span>
        <span className="text-xs text-muted-foreground hidden sm:inline">{currentStep}</span>

        {/* Minimize / expand */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setMinimized(!minimized)}
          title={minimized ? "展开" : "最小化"}
        >
          {minimized ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>

        {/* Navigate to project page */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleNavigateToProject}
          title="跳转到大纲页"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>

        {/* Action buttons */}
        {isRunning && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={cancelGeneration}>
            <X className="h-3 w-3 mr-1" />
            取消
          </Button>
        )}
        {isError && (
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={retryTask}>
              重试
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={dismissTask}>
              忽略
            </Button>
          </div>
        )}
        {isDone && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={dismissTask}>
            <X className="h-3 w-3 mr-1" />
            关闭
          </Button>
        )}
      </div>

      {/* Expanded content — no raw JSON, just progress info */}
      {!minimized && (
        <div className="h-full overflow-hidden">
          {isRunning && (
            <div className="flex items-center gap-4 p-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" />
                <span>{volumesCount} 卷</span>
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                <span>{chaptersCount} 章</span>
              </span>
              <span className="text-primary animate-pulse text-xs ml-auto">{currentStep}</span>
            </div>
          )}

          {isError && (
            <div className="p-3 text-xs text-muted-foreground">
              <p className="text-destructive font-medium mb-1">错误</p>
              <p>{error}</p>
            </div>
          )}

          {isDone && (
            <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>大纲生成完成</span>
              <Badge variant="outline" className="text-xs ml-2">
                可在大纲页查看
              </Badge>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
