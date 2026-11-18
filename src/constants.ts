import os from "node:os";
import path from "node:path";

export const MONK_BASE_URL = "https://monk.party/v1";
export const MONK_WEBSITE = "https://monk.party";
export const MONK_ACCOUNT_URL = "https://monk.party/account/";
/** Key 鉴权的 Opus 钱包查询（2026-11-18 起）：余额 / 今日已扣 / 日限额。 */
export const MONK_OPUS_KEYINFO_URL = "https://monk.party/monk-api/opus/key-info";
/** Opus 钱包充值入口（用户中心）。 */
export const MONK_OPUS_TOPUP_URL = "https://monk.party/me/#opus";
export const MONK_PI_VERSION = "0.14.0";

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
    useCase: "写代码干活 · 推荐",
    reasoning: true,
    contextWindow: 1000000,
    maxTokens: 64000,
    // USD per 1M tokens shown in Pi's cost display. Subscription models are flat-rate → 0.
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
  {
    id: "monk-fast",
    name: "Monk Fast (极速推理)",
    description: "更短更快，适合日常问答、快速代码探索与单文件阅读",
    useCase: "日常问答 · 极速",
    reasoning: true,
    contextWindow: 1000000,
    maxTokens: 64000,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
  {
    id: "monk",
    name: "Monk (质量优先)",
    description: "默认融合模型，综合质量与思考能力优先",
    useCase: "综合质量优先",
    reasoning: true,
    contextWindow: 1000000,
    maxTokens: 64000,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
  {
    id: "monk-free",
    name: "Monk Free (付费 Key 可用)",
    description: "额外融合通道，任意付费 sk-monk-* Key 均可调用",
    useCase: "额外备用通道",
    reasoning: true,
    contextWindow: 1000000,
    maxTokens: 64000,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
  {
    id: "monk-opus",
    name: "Monk Opus (Claude Opus 5.5 · Opus 钱包按量)",
    description: "Claude Opus 5.5 旗舰模型，走 Opus 钱包按量扣费（用户中心充值），适合难题推理与长任务",
    useCase: "难题推理 · 按量付费",
    reasoning: true,
    contextWindow: 1000000,
    maxTokens: 64000,
    // From https://monk.party/opus/ ($1.20 in / $6.00 out per 1M; cache read/write billed as input).
    cost: { input: 1.2, output: 6.0, cacheRead: 1.2, cacheWrite: 1.2 },
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

