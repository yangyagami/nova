import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { getDb } from "@/lib/db";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  Edit3,
  Lock,
  Unlock,
  MapPin,
  Skull,
  Package,
  Building2,
  FileCheck,
  Loader2,
  BookOpen,
} from "lucide-react";
import type { LoreEntry, LoreCategory } from "@/types";

const CATEGORY_CONFIG: Record<LoreCategory, { label: string; icon: React.ReactNode }> = {
  location: { label: "地点", icon: <MapPin className="h-3.5 w-3.5" /> },
  monster: { label: "怪物", icon: <Skull className="h-3.5 w-3.5" /> },
  item: { label: "道具", icon: <Package className="h-3.5 w-3.5" /> },
  organization: { label: "组织", icon: <Building2 className="h-3.5 w-3.5" /> },
  rule: { label: "规则", icon: <FileCheck className="h-3.5 w-3.5" /> },
};

interface LoreSidebarProps {
  projectId: string;
}

export default function LoreSidebar({ projectId }: LoreSidebarProps) {
  const [entries, setEntries] = useState<LoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LoreEntry | null>(null);
  const [form, setForm] = useState({
    category: "location" as LoreCategory,
    name: "",
    description: "",
  });

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const db = await getDb();
      const rows = await db.select<any[]>(
        `SELECT id, project_id as projectId, category, name, description,
                first_chapter as firstChapter, locked, metadata
         FROM lore_entries WHERE project_id = $1 ORDER BY category, name`,
        [projectId]
      );
      setEntries(
        rows.map((r: any) => ({
          ...r,
          locked: !!r.locked,
          metadata: r.metadata ? JSON.parse(r.metadata) : {},
        }))
      );
    } catch (e) {
      console.error("Failed to load lore entries:", e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const openNew = () => {
    setEditingEntry(null);
    setForm({ category: "location", name: "", description: "" });
    setShowDialog(true);
  };

  const openEdit = (entry: LoreEntry) => {
    setEditingEntry(entry);
    setForm({ category: entry.category, name: entry.name, description: entry.description || "" });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    const db = await getDb();

    if (editingEntry) {
      await db.execute(
        "UPDATE lore_entries SET category = $1, name = $2, description = $3 WHERE id = $4",
        [form.category, form.name, form.description, editingEntry.id]
      );
    } else {
      const id = `lore_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`;
      await db.execute(
        `INSERT INTO lore_entries (id, project_id, category, name, description)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, projectId, form.category, form.name, form.description]
      );
    }

    setShowDialog(false);
    loadEntries();
  };

  const handleDelete = async (id: string) => {
    const db = await getDb();
    await db.execute("DELETE FROM lore_entries WHERE id = $1", [id]);
    loadEntries();
  };

  const toggleLock = async (entry: LoreEntry) => {
    const db = await getDb();
    await db.execute("UPDATE lore_entries SET locked = $1 WHERE id = $2", [
      entry.locked ? 0 : 1,
      entry.id,
    ]);
    loadEntries();
  };

  const groupedEntries = entries.reduce(
    (acc, entry) => {
      if (!acc[entry.category]) acc[entry.category] = [];
      acc[entry.category].push(entry);
      return acc;
    },
    {} as Record<string, LoreEntry[]>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <BookOpen className="h-4 w-4 text-primary" />
            设定库
          </h3>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{entries.length} 条设定</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            <p>暂无设定</p>
            <Button variant="ghost" size="sm" className="h-6 text-xs mt-1" onClick={openNew}>
              <Plus className="h-3 w-3 mr-1" />
              添加设定
            </Button>
          </div>
        ) : (
          Object.entries(groupedEntries).map(([category, cats]) => (
            <div key={category}>
              <p className="text-xs text-muted-foreground mb-1 px-1 flex items-center gap-1">
                {CATEGORY_CONFIG[category as LoreCategory]?.icon}
                {CATEGORY_CONFIG[category as LoreCategory]?.label}
                <span className="ml-auto">{cats.length}</span>
              </p>
              {cats.map((entry) => (
                <div
                  key={entry.id}
                  className="group relative p-2 rounded-md hover:bg-muted/30 transition-colors cursor-pointer mb-1"
                  onClick={() => openEdit(entry)}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-xs font-medium truncate flex-1">{entry.name}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLock(entry);
                        }}
                        title={entry.locked ? "解锁" : "锁定"}
                      >
                        {entry.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                      </button>
                      <button
                        className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(entry.id);
                        }}
                        title="删除"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  {entry.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{entry.description}</p>
                  )}
                  {entry.locked && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 mt-0.5 h-4">
                      已锁定
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* 添加/编辑弹窗 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "编辑设定" : "添加设定"}</DialogTitle>
            <DialogDescription>
              {editingEntry ? "修改设定信息" : "添加新的世界观设定"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select
              label="分类"
              value={form.category}
              onValueChange={(val) => setForm({ ...form, category: val as LoreCategory })}
              options={[
                { value: "location", label: "地点" },
                { value: "monster", label: "怪物" },
                { value: "item", label: "道具" },
                { value: "organization", label: "组织" },
                { value: "rule", label: "规则" },
              ]}
            />
            <Input
              label="名称"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="设定名称"
            />
            <Input
              label="描述"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="详细描述这个设定"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={!form.name}>
              {editingEntry ? "保存" : "添加"}
            </Button>
          </DialogFooter>
        </div>
      </Dialog>
    </div>
  );
}
