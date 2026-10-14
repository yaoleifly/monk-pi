import os from "node:os";
import path from "node:path";

export const MONK_BASE_URL = "https://monk.party/v1";
export const MONK_WEBSITE = "https://monk.party";
export const MONK_ACCOUNT_URL = "https://monk.party/account/";
export const MONK_PI_VERSION = "0.13.0";

/** Pi 1.2 declares this engine. Below it, the bundled runtime is unsupported. */
export const MIN_NODE_VERSION = "22.19.0";

/** Paid keys are `sk-monk-*`. Protocol is OpenAI Chat Completions, not Anthropic. */
export const MONK_KEY_PREFIX = "sk-monk-";

/** Alipay ¥30 / 30 days, or Stripe $5 / 30 days. Education-domain emails are 10% off. */
export const MONK_PRICE_SUMMARY = "支付宝 ¥30 / 30 天，或 Stripe $5 / 30 天（教育邮箱 9 折）";

export const MONK_MODELS = [
  {
    id: "monk-coding",
    name: "Monk Coding (代码主力 - 推荐)",
    description: "编码与 Agent 工作负载，工具调用优先",
    reasoning: true,
    contextWindow: 1000000,
    maxTokens: 64000,
  },
  {
    id: "monk-fast",
    name: "Monk Fast (极速推理)",
    description: "更短更快，适合日常问答、快速代码探索与单文件阅读",
    reasoning: true,
    contextWindow: 1000000,
    maxTokens: 64000,
  },
  {
    id: "monk",
    name: "Monk (质量优先)",
    description: "默认融合模型，综合质量与思考能力优先",
    reasoning: true,
    contextWindow: 1000000,
    maxTokens: 64000,
  },
  {
    id: "monk-free",
    name: "Monk Free (付费 Key 可用)",
    description: "额外融合通道，任意付费 sk-monk-* Key 均可调用",
    reasoning: true,
    contextWindow: 1000000,
    maxTokens: 64000,
  },
] as const;

export type MonkModelId = (typeof MONK_MODELS)[number]["id"];
export const DEFAULT_MONK_MODEL: MonkModelId = "monk-coding";

export const MONK_MODEL_IDS: readonly MonkModelId[] = MONK_MODELS.map((model) => model.id);

/**
 * Match a user-supplied model name to a combo id.
 * Accepts the full id (`monk-fast`) or a unique short suffix (`fast`).
 */
export function matchMonkModel(target: string): (typeof MONK_MODELS)[number] | undefined {
  const query = target.trim().toLowerCase();
  if (!query) return undefined;

  const exact = MONK_MODELS.find((model) => model.id === query);
  if (exact) return exact;

  const bySuffix = MONK_MODELS.filter(
    (model) => model.id === `monk-${query}` || model.id.endsWith(`-${query}`)
  );
  return bySuffix.length === 1 ? bySuffix[0] : undefined;
}

export function isMonkApiKeyShape(key: string): boolean {
  return key.trim().startsWith(MONK_KEY_PREFIX);
}

// Path resolution
export function getMonkHomeDir(): string {
  const override = process.env.MONK_PI_HOME?.trim();
  if (override) return override;
  return path.join(os.homedir(), ".monk-pi");
}

export function getMonkConfigFile(): string {
  return path.join(getMonkHomeDir(), "config.json");
}

export function getPiHomeDir(): string {
  // Keep in step with Pi's getAgentDir(): ~/.pi/agent, overridden by PI_CODING_AGENT_DIR.
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

