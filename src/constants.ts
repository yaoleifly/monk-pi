import os from "node:os";
import path from "node:path";

export const MONK_BASE_URL = "https://monk.party/v1";
export const MONK_WEBSITE = "https://monk.party";
export const MONK_ACCOUNT_URL = "https://monk.party/account/";
export const MONK_PI_VERSION = "0.11.0";

export const MONK_MODELS = [
  {
    id: "monk-coding",
    name: "Monk Coding (代码主力 - 推荐)",
    description: "专为 Agent 深度优化，兼备高吞吐逻辑推演与工具调用能力",
    reasoning: true,
    contextWindow: 1000000,
    maxTokens: 64000,
  },
  {
    id: "monk-fast",
    name: "Monk Fast (极速推理)",
    description: "极速响应，适合日常问答、快速代码探索与单文件阅读",
    reasoning: true,
    contextWindow: 1000000,
    maxTokens: 64000,
  },
  {
    id: "monk",
    name: "Monk (融合模型)",
    description: "集三大 Flash 之所长，综合质量与思考能力优先",
    reasoning: true,
    contextWindow: 1000000,
    maxTokens: 64000,
  },
] as const;

export type MonkModelId = (typeof MONK_MODELS)[number]["id"];
export const DEFAULT_MONK_MODEL: MonkModelId = "monk-coding";

// Path resolution
export function getMonkHomeDir(): string {
  return path.join(os.homedir(), ".monk-pi");
}

export function getMonkConfigFile(): string {
  return path.join(getMonkHomeDir(), "config.json");
}

export function getPiHomeDir(): string {
  return process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), ".pi", "agent");
}

export function getPiModelsFile(): string {
  return path.join(getPiHomeDir(), "models.json");
}

export function getPiSettingsFile(): string {
  return path.join(getPiHomeDir(), "settings.json");
}

export function getPiExtensionsDir(): string {
  return path.join(getPiHomeDir(), "extensions");
}

export function getPiMonkExtensionFile(): string {
  return path.join(getPiExtensionsDir(), "monk.ts");
}

