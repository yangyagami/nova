import { useState, useRef, useEffect } from "react";
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
  Maximize2,
  Minimize2,
} from "lucide-react";

export default function TaskBar() {
  const navigate = useNavigate();
  const { task, status, currentStep, streamingContent, error, cancelGeneration, dismissTask, retryTask } =
    useGenerationStore();
  const [minimized, setMinimized] = useState(false);
  const [showStream, setShowStream] = useState(false);
  const streamEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll stream content
  useEffect(() => {
    if (showStream && status === "generating") {
      streamEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [streamingContent, showStream, status]);

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

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 border-t transition-all duration-200",
        statusColor(),
        minimized ? "h-10" : showStream ? "h-80" : "h-16"
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

        {/* Show stream toggle (for running tasks) */}
        {isRunning && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setShowStream(!showStream)}
            title={showStream ? "隐藏输出" : "显示输出"}
          >
            {showStream ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
        )}

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

      {/* Expanded content */}
      {!minimized && (
        <div className="h-full overflow-hidden">
          {isRunning && showStream && (
            <div className="h-[calc(100%-2.5rem)] overflow-y-auto p-4">
              <div className="rounded-md bg-black/20 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap h-full overflow-y-auto">
                {streamingContent ? (
                  <>
                    {streamingContent}
                    <span className="inline-block w-1.5 h-3 bg-primary animate-pulse ml-0.5" />
                  </>
                ) : (
                  <span className="text-muted-foreground">等待 AI 响应...</span>
                )}
                <div ref={streamEndRef} />
              </div>
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
