import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProjectStore } from "@/stores/projectStore";
import { useGenerationStore } from "@/stores/generationStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { subgenreLabel, statusLabel, formatDate, cn } from "@/lib/utils";
import { getDb } from "@/lib/db";
import { ArrowLeft, Sparkles, Loader2, BookOpen, Settings2, FileText, BookOpenCheck, ListTree, UserPlus, Trash2, Edit3, Lock, Unlock } from "lucide-react";
import type { Subgenre, Character, CharacterRole } from "@/types";

export default function ProjectSetup() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentProject, loading, getProject, updateProject, volumes, setVolumes, chapters, setChapters } = useProjectStore();
  const { generatedVolumes, generatedChapters, loadOutline, ensureOutlineForProject } = useGenerationStore();
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

  // Clear stale outline data when switching to a new/different project
  useEffect(() => {
    if (currentProject) {
      ensureOutlineForProject(currentProject.id);
      if (currentProject.status === "outlining" || currentProject.status === "writing") {
        loadOutline(currentProject.id);
      }
    }
  }, [currentProject?.id, currentProject?.status, ensureOutlineForProject, loadOutline]);

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

      {/* Characters Section */}
      <CharacterManager projectId={id!} />

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

// ==================== 角色管理组件 ====================
function CharacterManager({ projectId }: { projectId: string }) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingChar, setEditingChar] = useState<Character | null>(null);
  const [form, setForm] = useState({
    name: "",
    role: "supporting" as CharacterRole,
    gender: "",
    identity: "",
    appearance: "",
    personality: "",
    secret: "",
  });

  const loadCharacters = useCallback(async () => {
    setLoading(true);
    try {
      const db = await getDb();
      const rows = await db.select<any[]>(
        `SELECT id, project_id as projectId, name, role, gender, identity, appearance, personality, secret,
                relationships, first_chapter as firstChapter, locked_fields as lockedFields, created_at as createdAt
         FROM characters WHERE project_id = $1 ORDER BY created_at`,
        [projectId]
      );
      setCharacters(
        rows.map((r: any) => ({
          ...r,
          relationships: r.relationships ? JSON.parse(r.relationships) : {},
          lockedFields: r.lockedFields ? JSON.parse(r.lockedFields) : [],
        }))
      );
    } catch (e) {
      console.error("Failed to load characters:", e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  const openNew = () => {
    setEditingChar(null);
    setForm({ name: "", role: "supporting", gender: "", identity: "", appearance: "", personality: "", secret: "" });
    setShowDialog(true);
  };

  const openEdit = (ch: Character) => {
    setEditingChar(ch);
    setForm({
      name: ch.name,
      role: ch.role,
      gender: ch.gender || "",
      identity: ch.identity || "",
      appearance: ch.appearance || "",
      personality: ch.personality || "",
      secret: ch.secret || "",
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    const db = await getDb();
    const timestamp = Math.floor(Date.now() / 1000);

    if (editingChar) {
      await db.execute(
        `UPDATE characters SET name = $1, role = $2, gender = $3, identity = $4, appearance = $5, personality = $6, secret = $7 WHERE id = $8`,
        [form.name, form.role, form.gender, form.identity, form.appearance, form.personality, form.secret, editingChar.id]
      );
    } else {
      const id = `char_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`;
      await db.execute(
        `INSERT INTO characters (id, project_id, name, role, gender, identity, appearance, personality, secret, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, projectId, form.name, form.role, form.gender, form.identity, form.appearance, form.personality, form.secret, timestamp]
      );
    }

    setShowDialog(false);
    loadCharacters();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("确定要删除这个角色吗？")) return;
    const db = await getDb();
    await db.execute("DELETE FROM characters WHERE id = $1", [id]);
    loadCharacters();
  };

  const toggleLock = async (ch: Character, field: string) => {
    const locked = ch.lockedFields.includes(field)
      ? ch.lockedFields.filter((f) => f !== field)
      : [...ch.lockedFields, field];
    const db = await getDb();
    await db.execute("UPDATE characters SET locked_fields = $1 WHERE id = $2", [
      JSON.stringify(locked),
      ch.id,
    ]);
    loadCharacters();
  };

  const roleLabel = (role: string) => {
    const map: Record<string, string> = {
      protagonist: "主角",
      antagonist: "反派",
      supporting: "配角",
    };
    return map[role] || role;
  };

  const roleColor = (role: string) => {
    const map: Record<string, string> = {
      protagonist: "bg-blue-500/10 text-blue-500 border-blue-500/30",
      antagonist: "bg-red-500/10 text-red-500 border-red-500/30",
      supporting: "bg-green-500/10 text-green-500 border-green-500/30",
    };
    return map[role] || "";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpenCheck className="h-5 w-5 text-primary" />
              角色设定
            </CardTitle>
            <CardDescription>管理小说角色信息，可锁定字段防止 AI 误改</CardDescription>
          </div>
          <Button size="sm" onClick={openNew}>
            <UserPlus className="h-4 w-4 mr-1" />
            添加角色
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : characters.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            暂无角色，点击「添加角色」开始创建
          </p>
        ) : (
          <div className="space-y-3">
            {characters.map((ch) => (
              <div
                key={ch.id}
                className="p-4 rounded-md border border-border/50 bg-muted/20 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{ch.name}</span>
                    <Badge variant="outline" className={cn("text-xs", roleColor(ch.role))}>
                      {roleLabel(ch.role)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(ch)}>
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(ch.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {ch.gender && (
                    <span>
                      性别：<span className="text-foreground">{ch.gender}</span>
                    </span>
                  )}
                  {ch.identity && (
                    <span>
                      身份：<span className="text-foreground">{ch.identity}</span>
                    </span>
                  )}
                  {ch.appearance && (
                    <span className="col-span-2">
                      外貌：<span className="text-foreground">{ch.appearance}</span>
                    </span>
                  )}
                  {ch.personality && (
                    <span className="col-span-2">
                      性格：<span className="text-foreground">{ch.personality}</span>
                    </span>
                  )}
                  {ch.secret && (
                    <span className="col-span-2">
                      秘密/动机：<span className="text-foreground">{ch.secret}</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 添加/编辑角色弹窗 */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editingChar ? "编辑角色" : "添加角色"}</DialogTitle>
              <DialogDescription>
                {editingChar ? "修改角色信息" : "填写新角色的详细信息"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                label="角色名"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="输入角色名"
              />
              <Select
                label="角色定位"
                value={form.role}
                onValueChange={(val) => setForm({ ...form, role: val as CharacterRole })}
                options={[
                  { value: "protagonist", label: "主角" },
                  { value: "antagonist", label: "反派" },
                  { value: "supporting", label: "配角" },
                ]}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="性别"
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  placeholder="男/女/未知"
                />
                <Input
                  label="身份/职业"
                  value={form.identity}
                  onChange={(e) => setForm({ ...form, identity: e.target.value })}
                  placeholder="如：大学生、记者"
                />
              </div>
              <Input
                label="外貌"
                value={form.appearance}
                onChange={(e) => setForm({ ...form, appearance: e.target.value })}
                placeholder="角色的外貌描述"
              />
              <Input
                label="性格"
                value={form.personality}
                onChange={(e) => setForm({ ...form, personality: e.target.value })}
                placeholder="角色的性格特点"
              />
              <Input
                label="秘密/动机"
                value={form.secret}
                onChange={(e) => setForm({ ...form, secret: e.target.value })}
                placeholder="角色隐藏的秘密或行为动机"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                取消
              </Button>
              <Button onClick={handleSave} disabled={!form.name}>
                {editingChar ? "保存" : "添加"}
              </Button>
            </DialogFooter>
          </div>
        </Dialog>
      </CardContent>
    </Card>
  );
}
