import spawn from "cross-spawn";
import { logError, logInfo, logSuccess } from "./ui";

export interface PiDetectResult {
  installed: boolean;
  version?: string;
  path?: string;
}

/**
 * Checks if pi CLI is available in the current environment
 */
export function detectPi(): PiDetectResult {
  try {
    const result = spawn.sync("pi", ["--version"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    if (result.status === 0 && result.stdout) {
      const version = result.stdout.trim();
      return {
        installed: true,
        version,
      };
    }
  } catch {
    // Fall through
  }

  return { installed: false };
}

/**
 * Installs pi globally via npm
 */
export async function installPi(): Promise<boolean> {
  logInfo("正在执行 npm install -g @earendil-works/pi-coding-agent ...");
  try {
    const child = spawn.sync("npm", ["install", "-g", "@earendil-works/pi-coding-agent"], {
      stdio: "inherit",
    });

    if (child.status === 0) {
      logSuccess("Pi 安装成功！");
      return true;
    } else {
      logError(`Pi 安装失败，npm 返回码: ${child.status}`);
      return false;
    }
  } catch (err: unknown) {
    logError(`执行安装命令异常: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

export interface LaunchPiOptions {
  apiKey: string;
  defaultModel: string;
  passthroughArgs: string[];
}

/**
 * Launches Pi with Monk provider & model flags, passing through all user arguments
 */
export function launchPi(options: LaunchPiOptions): number {
  const { apiKey, defaultModel, passthroughArgs } = options;

  const args: string[] = [];

  // Check if user already passed --provider or --model
  const hasProvider = passthroughArgs.includes("--provider");
  const hasModel = passthroughArgs.some((arg, idx) => {
    return arg === "--model" || arg === "-m" || passthroughArgs[idx - 1] === "--model";
  });

  if (!hasProvider && !hasModel) {
    args.push("--provider", "monk", "--model", defaultModel);
  } else if (!hasProvider && hasModel) {
    // If user passed e.g. --model monk-fast without provider, specify monk
    args.push("--provider", "monk");
  }

  // Append user's arguments
  args.push(...passthroughArgs);

  // Set environment variables
  const env = {
    ...process.env,
    MONK_API_KEY: apiKey,
  };

  const child = spawn("pi", args, {
    stdio: "inherit",
    env,
  });

  // Handle process termination signals
  const forwardSignal = (signal: NodeJS.Signals) => {
    try {
      child.kill(signal);
    } catch {
      // Ignore
    }
  };

  process.on("SIGINT", () => forwardSignal("SIGINT"));
  process.on("SIGTERM", () => forwardSignal("SIGTERM"));

  return new Promise<number>((resolve) => {
    child.on("close", (code) => {
      resolve(code ?? 0);
    });
    child.on("error", (err) => {
      logError(`启动 Pi 发生错误: ${err.message}`);
      resolve(1);
    });
  }) as unknown as number;
}
