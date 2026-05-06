import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProjectStore } from "@/stores/projectStore";
import { useGenerationStore } from "@/stores/generationStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { subgenreLabel, statusLabel, formatDate } from "@/lib/utils";
import { ArrowLeft, Sparkles, Loader2, BookOpen, Settings2, FileText, BookOpenCheck, ListTree } from "lucide-react";
import type { Subgenre } from "@/types";

export default function ProjectSetup() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentProject, loading, getProject, updateProject, volumes, setVolumes, chapters, setChapters } = useProjectStore();
  const { generatedVolumes, generatedChapters, loadOutline } = useGenerationStore();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    subgenre: "" as Subgenre | "",
    premise: "",
    targetWords: 0,
    targetChapters: 0,
    wordsPerChapter: 0,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      getProject(id);
    }
  }, [id, getProject]);

  // Load outline if project has been outlined
  useEffect(() => {
    if (currentProject && (currentProject.status === "outlining" || currentProject.status === "writing")) {
      loadOutline(currentProject.id);
    }
  }, [currentProject?.id, currentProject?.status]);

  // Sync generated data to project store
  useEffect(() => {
    if (generatedVolumes.length > 0) {
      setVolumes(generatedVolumes);
    }
  }, [generatedVolumes]);

  useEffect(() => {
    if (generatedChapters.length > 0) {
      setChapters(generatedChapters);
    }
  }, [generatedChapters]);

  // Use either generated or store data
  const displayVolumes = generatedVolumes.length > 0 ? generatedVolumes : volumes;
  const displayChapters = generatedChapters.length > 0 ? generatedChapters : chapters;

  const handleOpenEdit = () => {
    if (!currentProject) return;
    setEditForm({
      title: currentProject.title,
      subgenre: currentProject.subgenre,
      premise: currentProject.premise,
      targetWords: currentProject.targetWords,
      targetChapters: currentProject.targetChapters,
      wordsPerChapter: currentProject.wordsPerChapter,
    });
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!id || !editForm.title || !editForm.premise || !editForm.subgenre) return;
    setSaving(true);
    await updateProject(id, {
      title: editForm.title,
      subgenre: editForm.subgenre as Subgenre,
      premise: editForm.premise,
      targetWords: editForm.targetWords,
      targetChapters: editForm.targetChapters,
      wordsPerChapter: editForm.wordsPerChapter,
    });
    setSaving(false);
    setShowEditDialog(false);
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

  const outlineExists = displayVolumes.length > 0;

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold truncate">{currentProject.title}</h1>
            <Badge variant="outline">{subgenreLabel(currentProject.subgenre)}</Badge>
            <Badge variant="secondary">{statusLabel(currentProject.status)}</Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5 truncate">{currentProject.premise}</p>
        </div>
        <Button variant="outline" onClick={handleOpenEdit}>
          <Settings2 className="h-4 w-4 mr-2" />
          编辑项目
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">创建时间</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-sm">{formatDate(currentProject.createdAt)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Outline Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ListTree className="h-5 w-5 text-primary" />
                大纲
              </CardTitle>
              <CardDescription>
                {outlineExists
                  ? `共 ${displayVolumes.length} 卷 ${displayChapters.length} 章`
                  : "生成全书大纲，包含分卷结构和章节细纲"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {outlineExists ? (
            <div className="space-y-3">
              {displayVolumes.map((vol) => {
                const chs = displayChapters.filter((ch) => ch.volumeId === vol.id);
                return (
                  <div key={vol.id} className="p-3 rounded-md bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        第 {vol.indexNo} 卷
                      </Badge>
                      <span className="font-medium text-sm">{vol.title}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{chs.length} 章</span>
                    </div>
                    {vol.arcGoal && (
                      <p className="text-xs text-muted-foreground ml-1 mb-1 truncate">
                        🎯 {vol.arcGoal}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {chs.map((ch) => (
                        <Badge key={ch.id} variant="outline" className="text-xs">
                          {ch.indexNo}. {ch.title}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
          <div className="flex gap-2">
            {outlineExists ? (
              <>
                <Button onClick={() => navigate(`/project/${id}/outline`)}>
                  <ListTree className="h-4 w-4 mr-2" />
                  查看完整大纲
                </Button>
                <Button variant="outline" onClick={() => navigate(`/project/${id}/outline`)}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  重新生成
                </Button>
              </>
            ) : (
              <Button size="lg" onClick={() => navigate(`/project/${id}/outline`)}>
                <Sparkles className="h-4 w-4 mr-2" />
                生成大纲
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Characters Section (placeholder for future) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5 text-primary" />
            角色设定
          </CardTitle>
          <CardDescription>管理小说角色信息（即将上线）</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            在 M3 版本中，你将可以在此处添加和管理角色设定，包括主角、反派和配角的外貌、性格、秘密等信息。
          </p>
        </CardContent>
      </Card>

      {/* Edit Project Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <div className="space-y-6">
          <DialogHeader>
            <DialogTitle>编辑项目</DialogTitle>
            <DialogDescription>修改项目的基本信息和创作目标</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              label="作品标题"
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              placeholder="输入小说标题"
            />
            <Select
              label="子类型"
              value={editForm.subgenre}
              onValueChange={(val) => setEditForm({ ...editForm, subgenre: val as Subgenre })}
              options={[
                { value: "urban_legend", label: "都市怪谈" },
                { value: "folk_horror", label: "民俗恐怖" },
              ]}
            />
            <Input
              label="核心创意（一句话）"
              value={editForm.premise}
              onChange={(e) => setEditForm({ ...editForm, premise: e.target.value })}
              placeholder="用一句话描述你的故事核心"
            />
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="目标字数"
                type="number"
                value={String(editForm.targetWords)}
                onChange={(e) =>
                  setEditForm({ ...editForm, targetWords: parseInt(e.target.value) || 0 })
                }
              />
              <Input
                label="章节数"
                type="number"
                value={String(editForm.targetChapters)}
                onChange={(e) =>
                  setEditForm({ ...editForm, targetChapters: parseInt(e.target.value) || 0 })
                }
              />
              <Input
                label="每章字数"
                type="number"
                value={String(editForm.wordsPerChapter)}
                onChange={(e) =>
                  setEditForm({ ...editForm, wordsPerChapter: parseInt(e.target.value) || 0 })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving || !editForm.title || !editForm.premise}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </div>
      </Dialog>
    </div>
  );
}
