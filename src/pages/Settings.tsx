import { useState, useEffect } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, Save, RefreshCw, Eye, EyeOff } from "lucide-react";

export default function Settings() {
  const { settings, loadSettings, updateSettings, initialized } = useSettingsStore();
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState<"deepseek-chat" | "deepseek-reasoner">("deepseek-chat");
  const [temperature, setTemperature] = useState(0.85);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "testing" | "success" | "error">("idle");

  useEffect(() => {
    if (!initialized) {
      loadSettings();
    }
  }, [initialized, loadSettings]);

  useEffect(() => {
    setApiKey(settings.apiKey);
    setModel(settings.model);
    setTemperature(settings.temperature);
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    await updateSettings({ apiKey, model, temperature });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestConnection = async () => {
    if (!apiKey) return;
    setTestResult("testing");
    try {
      const { chatCompletion } = await import("@/services/deepseek");
      await chatCompletion(apiKey, {
        messages: [{ role: "user", content: "Hello" }],
        model,
        temperature: 0.1,
        maxTokens: 10,
      });
      setTestResult("success");
      setTimeout(() => setTestResult("idle"), 3000);
    } catch {
      setTestResult("error");
      setTimeout(() => setTestResult("idle"), 3000);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">设置</h1>
        <p className="text-muted-foreground mt-2">配置 API Key 和生成参数</p>
      </div>

      {/* API Key */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            DeepSeek API 密钥
          </CardTitle>
          <CardDescription>
            从{" "}
            <a
              href="https://platform.deepseek.com/api_keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4"
            >
              platform.deepseek.com
            </a>{" "}
            获取 API Key。密钥仅在本地加密存储。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={!apiKey || testResult === "testing"}
            >
              {testResult === "testing" ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {testResult === "success" ? "✓ 连接成功" : testResult === "error" ? "✗ 连接失败" : "测试连接"}
            </Button>
          </div>

          <div className="p-3 rounded-md bg-muted/50 text-xs text-muted-foreground">
            <p className="font-medium mb-1">💡 安全提示</p>
            <p>API Key 使用系统安全存储加密保存，仅在你调用 DeepSeek API 时使用。Nova 不会将你的密钥上传到任何第三方服务器。</p>
          </div>
        </CardContent>
      </Card>

      {/* 模型选择 */}
      <Card>
        <CardHeader>
          <CardTitle>生成参数</CardTitle>
          <CardDescription>配置默认使用的模型和生成参数</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">模型</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as "deepseek-chat" | "deepseek-reasoner")}
              className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm mt-1"
            >
              <option value="deepseek-chat">DeepSeek Chat (v3，¥0.5/M 输入 + ¥2/M 输出)</option>
              <option value="deepseek-reasoner">DeepSeek Reasoner (R1，¥4/M 输入 + ¥16/M 输出)</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">
              温度 (Temperature): {temperature}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full mt-1"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>精确 (0.0)</span>
              <span>创意 (1.0)</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              建议值：大纲生成 0.7 | 正文生成 0.85 | 摘要抽取 0.2 | 润色 0.6
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "保存中..." : saved ? "已保存" : "保存设置"}
        </Button>
      </div>
    </div>
  );
}
