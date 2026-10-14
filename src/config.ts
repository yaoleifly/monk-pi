import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_MONK_MODEL,
  MONK_BASE_URL,
  MONK_MODELS,
  MonkModelId,
  getMonkConfigFile,
  getMonkHomeDir,
  getPiExtensionsDir,
  getPiHomeDir,
  getPiModelsFile,
  getPiMonkExtensionFile,
} from "./constants";

export const PI_MODELS_SCHEMA = "https://pi.dev/schemas/models.schema.json";

export interface MonkLocalConfig {
  apiKey?: string;
  defaultModel?: MonkModelId;
  baseUrl?: string;
  lastVerified?: string;
  email?: string;
  tradeNo?: string;
}

export function loadMonkConfig(): MonkLocalConfig {
  const configFile = getMonkConfigFile();
  try {
    if (fs.existsSync(configFile)) {
      const content = fs.readFileSync(configFile, "utf-8");
      return JSON.parse(content) as MonkLocalConfig;
    }
  } catch {
    // Ignore corrupt or unreadable files
  }
  return {};
}

export function saveMonkConfig(config: MonkLocalConfig): void {
  const homeDir = getMonkHomeDir();
  if (!fs.existsSync(homeDir)) {
    fs.mkdirSync(homeDir, { recursive: true });
  }
  const configFile = getMonkConfigFile();
  const existing = loadMonkConfig();
  const merged = { ...existing, ...config };
  fs.writeFileSync(configFile, JSON.stringify(merged, null, 2), "utf-8");
}

/**
 * Resolves the Monk API Key by checking env -> local config -> pi models.json
 */
export function resolveApiKey(): { key: string; source: "env" | "local" | "pi" | "none" } {
  // 1. Environment variable
  const envKey = process.env.MONK_API_KEY?.trim();
  if (envKey) {
    return { key: envKey, source: "env" };
  }

  // 2. Local monk-pi config
  const localConfig = loadMonkConfig();
  if (localConfig.apiKey?.trim()) {
    return { key: localConfig.apiKey.trim(), source: "local" };
  }

  // 3. Pi models.json
  const piModelsFile = getPiModelsFile();
  try {
    if (fs.existsSync(piModelsFile)) {
      const data = JSON.parse(fs.readFileSync(piModelsFile, "utf-8"));
      const key = data?.providers?.monk?.apiKey;
      if (typeof key === "string" && key.trim() && !key.startsWith("$")) {
        return { key: key.trim(), source: "pi" };
      }
    }
  } catch {
    // Ignore
  }

  return { key: "", source: "none" };
}

/**
 * Safely updates or injects the Monk provider config into Pi's models.json
 */
export function syncPiModelsJson(apiKey?: string): { success: boolean; path: string; error?: string } {
  const piDir = getPiHomeDir();
  const piModelsFile = getPiModelsFile();

  try {
    if (!fs.existsSync(piDir)) {
      fs.mkdirSync(piDir, { recursive: true });
    }

    let modelsData: Record<string, any> = { providers: {} };
    if (fs.existsSync(piModelsFile)) {
      const raw = fs.readFileSync(piModelsFile, "utf-8");
      try {
        modelsData = JSON.parse(raw);
        if (!modelsData.providers) {
          modelsData.providers = {};
        }
      } catch {
        modelsData = { providers: {} };
      }
    }

    const monkProviderConfig = buildMonkProviderConfig(apiKey);

    if (typeof modelsData.$schema !== "string") {
      modelsData.$schema = PI_MODELS_SCHEMA;
    }
    modelsData.providers.monk = monkProviderConfig;

    fs.writeFileSync(piModelsFile, JSON.stringify(modelsData, null, 2), "utf-8");
    return { success: true, path: piModelsFile };
  } catch (err: unknown) {
    return {
      success: false,
      path: piModelsFile,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function buildMonkProviderConfig(apiKey?: string) {
  return {
    name: "Monk",
    baseUrl: MONK_BASE_URL,
    api: "openai-completions",
    apiKey: apiKey && !apiKey.startsWith("$") ? apiKey : "$MONK_API_KEY",
    compat: {
      supportsDeveloperRole: false,
      maxTokensField: "max_tokens",
      requiresToolResultName: true,
    },
    models: MONK_MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      reasoning: m.reasoning,
      input: ["text", "image"] as const,
      contextWindow: m.contextWindow,
      maxTokens: m.maxTokens,
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
      },
    })),
  };
}

/**
 * True when an existing Pi provider block already matches the current Monk service.
 */
export function isMonkProviderCurrent(provider: unknown): boolean {
  if (!provider || typeof provider !== "object") return false;
  const monk = provider as {
    api?: string;
    baseUrl?: string;
    compat?: { supportsDeveloperRole?: boolean; maxTokensField?: string };
    models?: Array<{ id?: string; input?: string[] }>;
  };
  const compatOk =
    monk.compat?.supportsDeveloperRole === false && monk.compat?.maxTokensField === "max_tokens";
  const endpointOk = monk.api === "openai-completions" && monk.baseUrl === MONK_BASE_URL;
  const models = Array.isArray(monk.models) ? monk.models : [];
  const ids = models.map((model) => model.id);
  const modelsOk =
    ids.length === MONK_MODELS.length &&
    MONK_MODELS.every((model) => ids.includes(model.id)) &&
    models.every((model) => Array.isArray(model.input) && model.input.includes("text") && model.input.includes("image"));
  return compatOk && endpointOk && modelsOk;
}

/**
 * Resolves the raw source code of monk-extension.ts cleanly from dist or src
 */
export function getMonkExtensionRaw(): string {
  try {
    // 1. Check relative to current bundle (dist/monk-extension.ts)
    const distPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "monk-extension.ts"
    );
    if (fs.existsSync(distPath)) {
      return fs.readFileSync(distPath, "utf-8");
    }

    // 2. Check source file in src/extension/
    const srcPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../src/extension/monk-extension.ts"
    );
    if (fs.existsSync(srcPath)) {
      return fs.readFileSync(srcPath, "utf-8");
    }

    // 3. Fallback cwd
    const cwdPath = path.resolve(process.cwd(), "src/extension/monk-extension.ts");
    if (fs.existsSync(cwdPath)) {
      return fs.readFileSync(cwdPath, "utf-8");
    }
  } catch {}

  return "";
}

/**
 * Safely writes or updates the Monk native extension in ~/.pi/agent/extensions/monk.ts
 */
export function syncPiExtension(force: boolean = false): {
  success: boolean;
  path: string;
  updated: boolean;
  error?: string;
} {
  const extDir = getPiExtensionsDir();
  const extFile = getPiMonkExtensionFile();

  try {
    if (!fs.existsSync(extDir)) {
      fs.mkdirSync(extDir, { recursive: true });
    }

    const targetContent = getMonkExtensionRaw().trim() + "\n";
    if (!targetContent.trim()) {
      return {
        success: false,
        path: extFile,
        updated: false,
        error: "未找到扩展源文件 monk-extension.ts",
      };
    }

    if (fs.existsSync(extFile)) {
      const existing = fs.readFileSync(extFile, "utf-8");
      if (existing === targetContent && !force) {
        return { success: true, path: extFile, updated: false };
      }
    }

    fs.writeFileSync(extFile, targetContent, "utf-8");
    return { success: true, path: extFile, updated: true };
  } catch (err: unknown) {
    return {
      success: false,
      path: extFile,
      updated: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Gets the current default model
 */
export function getDefaultModel(): MonkModelId {
  const config = loadMonkConfig();
  if (config.defaultModel && MONK_MODELS.some((m) => m.id === config.defaultModel)) {
    return config.defaultModel;
  }
  return DEFAULT_MONK_MODEL;
}
