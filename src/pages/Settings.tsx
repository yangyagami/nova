import { useState, useEffect } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  KeyRound,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Globe,
  Cpu,
  Thermometer,
  AlignLeft,
} from "lucide-react";

export default function Settings() {
  const { settings, loadSettings, updateSettings, initialized } =
    useSettingsStore();
  const [apiKey, setApiKey] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [model, setModel] = useState("deepseek-chat");
  const [temperature, setTemperature] = useState(0.85);
  const [maxTokens, setMaxTokens] = useState(8192);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");

  useEffect(() => {
    if (!initialized) {
      loadSettings();
    }
  }, [initialized, loadSettings]);

  useEffect(() => {
    setApiKey(settings.apiKey);
    setApiBaseUrl(settings.apiBaseUrl);
    setModel(settings.model);
    setTemperature(settings.temperature);
    setMaxTokens(settings.maxTokens);
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    await updateSettings({
      apiKey,
      apiBaseUrl,
      model,
      temperature,
      maxTokens,
    });
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
        apiBaseUrl,
      });
      setTestResult("success");
      setTimeout(() => setTestResult("idle"), 3000);
    } catch (e) {
      console.error("Test connection failed:", e);
      setTestResult("error");
      setTimeout(() => setTestResult("idle"), 3000);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">设置</h1>
        <p className="text-muted-foreground mt-2">
          配置 API 连接和生成参数
        </p>
      </div>

      {/* API 密钥 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            API 密钥
          </CardTitle>
          <CardDescription>
            你的 API Key 仅在本地加密存储，仅用于调用你指定的 API。
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
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
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
              {testResult === "success"
                ? "✓ 连接成功"
                : testResult === "error"
                  ? "✗ 连接失败"
                  : "测试连接"}
            </Button>
          </div>

          <div className="p-3 rounded-md bg-muted/50 text-xs text-muted-foreground">
            <p className="font-medium mb-1">💡 安全提示</p>
            <p>
              API Key 仅保存在本地 SQLite 数据库中，不会上传到任何第三方服务器。
              你可以在任意兼容 OpenAI 格式的 API 服务商处获取 Key。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* API 地址 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            API 地址
          </CardTitle>
          <CardDescription>
            默认使用 DeepSeek 官方 API。可以改为任何兼容 OpenAI 格式的 API
            端点。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            placeholder="https://api.deepseek.com/v1"
            className="font-mono text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setApiBaseUrl("https://api.deepseek.com/v1")
              }
              className={apiBaseUrl === "https://api.deepseek.com/v1" ? "border-primary" : ""}
            >
              DeepSeek 官方
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setApiBaseUrl("https://api.openai.com/v1")
              }
              className={apiBaseUrl === "https://api.openai.com/v1" ? "border-primary" : ""}
            >
              OpenAI 兼容
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            注意：地址末尾不需要 /chat/completions，程序会自动拼接。
          </p>
        </CardContent>
      </Card>

      {/* 生成参数 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            生成参数
          </CardTitle>
          <CardDescription>配置默认使用的模型和生成参数</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 模型名称 */}
          <div>
            <label className="text-sm font-medium">模型名称</label>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="deepseek-chat"
              className="mt-1 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              填入你的 API 提供商支持的模型名称（如 deepseek-chat、gpt-4o、claude-sonnet-4 等）
            </p>
          </div>

          {/* 温度 */}
          <div>
            <div className="flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-muted-foreground" />
              <label className="text-sm font-medium">
                温度 (Temperature):{" "}
                <span className="text-primary">{temperature.toFixed(2)}</span>
              </label>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={temperature}
              onChange={(e) =>
                setTemperature(parseFloat(e.target.value))
              }
              className="w-full mt-2 accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>精确 (0.0)</span>
              <span>平衡 (1.0)</span>
              <span>创意 (2.0)</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              建议值：大纲 0.7 | 正文 0.85 | 摘要 0.2 | 润色 0.6
            </p>
          </div>

          {/* 最大 Token */}
          <div>
            <div className="flex items-center gap-2">
              <AlignLeft className="h-4 w-4 text-muted-foreground" />
              <label className="text-sm font-medium">
                最大输出 Token:
                <span className="text-primary ml-1">{maxTokens}</span>
              </label>
            </div>
            <input
              type="range"
              min="512"
              max="32768"
              step="512"
              value={maxTokens}
              onChange={(e) =>
                setMaxTokens(parseInt(e.target.value, 10))
              }
              className="w-full mt-2 accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>512（短回复）</span>
              <span>8192（默认）</span>
              <span>32768（长文）</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving
            ? "保存中..."
            : saved
              ? "✓ 已保存"
              : "保存设置"}
        </Button>
      </div>
    </div>
  );
}
