import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProjectStore } from "@/stores/projectStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Plus, BookOpen, Trash2, Clock, Target, FileText } from "lucide-react";
import { formatDate, subgenreLabel, statusLabel } from "@/lib/utils";
import type { Subgenre } from "@/types";

export default function Dashboard() {
  const navigate = useNavigate();
  const { projects, loading, listProjects, createProject, deleteProject } = useProjectStore();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newProject, setNewProject] = useState({
    title: "",
    subgenre: "urban_legend" as Subgenre,
    premise: "",
    protagonistName: "",
    targetWords: 50000,
    targetChapters: 15,
    wordsPerChapter: 3000,
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listProjects();
  }, [listProjects]);

  const handleCreate = async () => {
    if (!newProject.title || !newProject.premise) return;
    setCreating(true);
    try {
      const project = await createProject({
        title: newProject.title,
        subgenre: newProject.subgenre,
        premise: newProject.premise,
        targetWords: newProject.targetWords,
        targetChapters: newProject.targetChapters,
        wordsPerChapter: newProject.wordsPerChapter,
      });
      setShowNewDialog(false);
      navigate(`/project/${project.id}`);
    } catch (e) {
      console.error("Failed to create project:", e);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (window.confirm(`确定要删除项目「${title}」吗？此操作不可恢复。`)) {
      await deleteProject(id);
    }
  };

  // Template presets
  const fillTemplate = (type: "folk_horror" | "urban_legend") => {
    if (type === "folk_horror") {
      setNewProject({
        title: "老屋",
        subgenre: "folk_horror",
        premise: "返乡青年发现祖宅地下埋着七口棺材，村里老人说这是「镇宅」，但棺材里的东西正在一个个消失。",
        protagonistName: "陈远",
        targetWords: 50000,
        targetChapters: 15,
        wordsPerChapter: 3000,
      });
    } else {
      setNewProject({
        title: "最后一班地铁",
        subgenre: "urban_legend",
        premise: "每晚末班地铁的最后一节车厢总有一个空位，坐上去的人第二天都会消失。",
        protagonistName: "林晚",
        targetWords: 30000,
        targetChapters: 10,
        wordsPerChapter: 3000,
      });
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nova</h1>
          <p className="text-muted-foreground mt-1">恐怖小说生成器</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fillTemplate("folk_horror")}>
            民俗恐怖示例
          </Button>
          <Button variant="outline" onClick={() => fillTemplate("urban_legend")}>
            都市怪谈示例
          </Button>
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新建项目
          </Button>
        </div>
      </div>

      {/* Project List */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">加载中...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <BookOpen className="h-16 w-16 mx-auto text-muted-foreground/40" />
          <h2 className="text-xl font-semibold">还没有项目</h2>
          <p className="text-muted-foreground">
            点击上方「新建项目」或选择一个示例模板开始创作
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate(`/project/${project.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{project.title}</CardTitle>
                  <Badge variant="outline">{subgenreLabel(project.subgenre)}</Badge>
                </div>
                <CardDescription className="line-clamp-2">
                  {project.premise}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Target className="h-3.5 w-3.5" />
                    {project.targetWords.toLocaleString()} 字
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    {project.targetChapters} 章
                  </span>
                  <Badge variant="secondary">{statusLabel(project.status)}</Badge>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDate(project.createdAt)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(project.id, project.title);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* New Project Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <div className="space-y-6">
          <DialogHeader>
            <DialogTitle>新建项目</DialogTitle>
            <DialogDescription>填写以下信息开始创作你的恐怖小说</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
          <Input
            label="作品标题"
            value={newProject.title}
            onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
            placeholder="输入小说标题"
          />
          <Select
            label="子类型"
            value={newProject.subgenre}
            onChange={(e) => setNewProject({ ...newProject, subgenre: e.target.value as Subgenre })}
            options={[
              { value: "urban_legend", label: "都市怪谈" },
              { value: "folk_horror", label: "民俗恐怖" },
            ]}
          />
          <Input
            label="核心创意（一句话）"
            value={newProject.premise}
            onChange={(e) => setNewProject({ ...newProject, premise: e.target.value })}
            placeholder="用一句话描述你的故事核心"
          />
          <Input
            label="主角姓名"
            value={newProject.protagonistName}
            onChange={(e) => setNewProject({ ...newProject, protagonistName: e.target.value })}
            placeholder="主角的名字"
          />
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="目标字数"
              type="number"
              value={String(newProject.targetWords)}
              onChange={(e) => setNewProject({ ...newProject, targetWords: parseInt(e.target.value) || 0 })}
            />
            <Input
              label="章节数"
              type="number"
              value={String(newProject.targetChapters)}
              onChange={(e) => setNewProject({ ...newProject, targetChapters: parseInt(e.target.value) || 0 })}
            />
            <Input
              label="每章字数"
              type="number"
              value={String(newProject.wordsPerChapter)}
              onChange={(e) => setNewProject({ ...newProject, wordsPerChapter: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newProject.title || !newProject.premise}>
              {creating ? "创建中..." : "创建项目"}
            </Button>
          </DialogFooter>
        </div>
      </Dialog>
    </div>
  );
}
