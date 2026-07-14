"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useBootstrap } from "@/lib/hooks";
import { api } from "@/lib/client-api";
import {
  Card,
  CardHeader,
  Badge,
  Button,
  Spinner,
  Field,
  inputCls,
} from "@/components/ui";
import type { ProviderDef } from "@/lib/ai/providers";

interface SettingsResp {
  providers: ProviderDef[];
  settings: {
    provider: string;
    model: string;
    baseUrl: string;
    apiKeyMasked: string;
    hasApiKey: boolean;
  };
}

export default function SettingsPage() {
  const { data: boot } = useBootstrap();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["aiSettings"],
    queryFn: () => api<SettingsResp>("/api/settings/ai"),
  });

  const [providerId, setProviderId] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (data && !providerId) {
      setProviderId(data.settings.provider);
      setModel(data.settings.model);
      setBaseUrl(data.settings.baseUrl);
    }
  }, [data, providerId]);

  const save = useMutation({
    mutationFn: () =>
      api("/api/settings/ai", {
        method: "PUT",
        body: JSON.stringify({ provider: providerId, model, apiKey, baseUrl }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aiSettings"] });
      setApiKey("");
      setMessage({ ok: true, text: "已保存，之后的批改与行为分析将使用该模型" });
    },
    onError: (e) => setMessage({ ok: false, text: e.message }),
  });

  const reset = useMutation({
    mutationFn: () => api("/api/reset", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
      setMessage({ ok: true, text: "已重置为演示种子数据" });
    },
    onError: (e) => setMessage({ ok: false, text: e.message }),
  });

  if (!boot || !data) return <Spinner label="加载中…" />;

  const isPrincipal = boot.user.role === "principal";
  const selected = data.providers.find((p) => p.id === providerId);
  const domestic = data.providers.filter((p) =>
    ["mock", "qwen", "doubao", "glm", "moonshot", "stepfun", "hunyuan", "deepseek"].includes(p.id)
  );
  const overseas = data.providers.filter((p) => ["openai", "gemini", "anthropic"].includes(p.id));
  const aggregators = data.providers.filter((p) =>
    ["siliconflow", "openrouter", "custom"].includes(p.id)
  );

  function selectProvider(p: ProviderDef) {
    setProviderId(p.id);
    setModel(p.visionModels[0] ?? p.textModels?.[0] ?? "");
    setBaseUrl("");
    setMessage(null);
  }

  const groups: Array<[string, ProviderDef[]]> = [
    ["国产模型（优先，符合 PRD 要求）", domestic],
    ["海外模型", overseas],
    ["聚合平台 / 自定义（OpenAI 兼容协议）", aggregators],
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">AI 模型设置</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          识图批改与行为分析的多模态 / 大语言模型接入，支持 {data.providers.length - 1}+
          提供商（不限于千问 VL 与豆包 Seed）
        </p>
      </div>

      <Card className="p-4 flex items-center gap-3 flex-wrap">
        <span className="text-sm text-slate-600">当前生效：</span>
        <Badge color="indigo">
          {data.providers.find((p) => p.id === data.settings.provider)?.label ?? data.settings.provider}
        </Badge>
        {data.settings.model && <Badge color="slate">{data.settings.model}</Badge>}
        {data.settings.provider !== "mock" && (
          <Badge color={data.settings.hasApiKey ? "green" : "red"}>
            {data.settings.hasApiKey ? `API Key ${data.settings.apiKeyMasked}` : "未配置 API Key"}
          </Badge>
        )}
      </Card>

      {!isPrincipal && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
          🔒 仅校长角色可修改模型配置（RBAC 权限控制），当前为只读展示。
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-4">
          {groups.map(([label, list]) => (
            <div key={label}>
              <p className="text-xs font-semibold text-slate-500 mb-2">{label}</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {list.map((p) => (
                  <button
                    key={p.id}
                    disabled={!isPrincipal}
                    onClick={() => selectProvider(p)}
                    className={clsx(
                      "text-left rounded-xl border-2 p-3 transition-all disabled:cursor-not-allowed",
                      providerId === p.id
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800 flex-1">
                        {p.label}
                      </span>
                      {p.vision ? (
                        <Badge color="sky">识图</Badge>
                      ) : (
                        <Badge color="slate">仅文本</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {p.vendor}
                      {p.visionModels[0] && ` · ${p.visionModels[0]}`}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="接入配置" subtitle={selected?.label ?? ""} />
            <div className="px-5 pb-5 space-y-3">
              {selected?.id === "mock" ? (
                <p className="text-sm text-slate-500 leading-relaxed">
                  内置演示模型无需任何配置，返回确定性的模拟批改结果，用于体验完整业务流程。
                  接入真实模型后，AI 将基于照片实际识别与批改。
                </p>
              ) : (
                <>
                  {selected?.id === "custom" && (
                    <Field label="Base URL（OpenAI 兼容）">
                      <input
                        className={inputCls}
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        placeholder="https://your-host/v1"
                        disabled={!isPrincipal}
                      />
                    </Field>
                  )}
                  <Field label="模型名称">
                    <input
                      className={inputCls}
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      list="model-suggestions"
                      disabled={!isPrincipal}
                    />
                    <datalist id="model-suggestions">
                      {[...(selected?.visionModels ?? []), ...(selected?.textModels ?? [])].map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                  </Field>
                  <Field label="API Key（留空保持不变）">
                    <input
                      className={inputCls}
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={data.settings.hasApiKey ? data.settings.apiKeyMasked : "sk-..."}
                      disabled={!isPrincipal}
                    />
                  </Field>
                  {selected?.keyHint && (
                    <p className="text-xs text-slate-400">💡 {selected.keyHint}</p>
                  )}
                </>
              )}
              {isPrincipal && (
                <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
                  {save.isPending ? "保存中…" : "保存配置"}
                </Button>
              )}
              {message && (
                <p className={clsx("text-sm", message.ok ? "text-emerald-600" : "text-red-500")}>
                  {message.text}
                </p>
              )}
            </div>
          </Card>

          <Card className="p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-500">说明</p>
            <ul className="text-xs text-slate-500 space-y-1.5 leading-relaxed list-disc pl-4">
              <li>所有提供商统一通过 OpenAI 兼容协议接入，也可通过「自定义」接入 Ollama / vLLM 等自部署模型。</li>
              <li>API Key 仅保存在服务端，前端只展示掩码。</li>
              <li>可用环境变量预置：AI_PROVIDER / AI_MODEL / AI_API_KEY / AI_BASE_URL。</li>
              <li>DeepSeek 等纯文本模型仅用于行为分析，识图批改需选择带「识图」标记的模型。</li>
            </ul>
          </Card>

          {isPrincipal && (
            <Card className="p-4">
              <p className="text-xs font-semibold text-slate-500 mb-2">演示数据</p>
              <Button variant="danger" size="sm" onClick={() => reset.mutate()} disabled={reset.isPending}>
                {reset.isPending ? "重置中…" : "重置为种子数据"}
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
