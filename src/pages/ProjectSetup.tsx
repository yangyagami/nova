import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProjectStore } from "@/stores/projectStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { subgenreLabel, statusLabel } from "@/lib/utils";
import { ArrowLeft, Sparkles, Loader2, BookOpen, Settings2 } from "lucide-react";

export default function ProjectSetup() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentProject, loading, getProject } = useProjectStore();
  const [generatingOutline, setGeneratingOutline] = useState(false);

  useEffect(() => {
    if (id) {
      getProject(id);
    }
  }, [id, getProject]);

  if (loading) {
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
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{currentProject.title}</h1>
            <Badge variant="outline">{subgenreLabel(currentProject.subgenre)}</Badge>
            <Badge variant="secondary">{statusLabel(currentProject.status)}</Badge>
          </div>
          <p className="text-muted-foreground mt-1">{currentProject.premise}</p>
        </div>
        <Button variant="outline" onClick={() => navigate(`/project/${id}/edit`)}>
          <Settings2 className="h-4 w-4 mr-2" />
          编辑项目
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">目标字数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{currentProject.targetWords.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">章节数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{currentProject.targetChapters}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">每章字数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{currentProject.wordsPerChapter.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>开始创作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            下一步：生成全书大纲。Nova 将根据你的核心创意和设定，自动生成卷和章节的详细规划。
          </p>
          <Button
            size="lg"
            disabled={generatingOutline}
            onClick={() => {
              setGeneratingOutline(true);
              // TODO: Implement outline generation
              navigate(`/project/${id}/outline`);
            }}
          >
            {generatingOutline ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                生成大纲
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
