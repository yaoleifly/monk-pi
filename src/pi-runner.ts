import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import spawn from "cross-spawn";
import pc from "picocolors";
import { logError, logInfo, logSuccess, logWarn } from "./ui";

export type PiBinaryType = "global" | "local" | "bundled" | "missing";

export interface ResolvedPi {
  type: PiBinaryType;
  command: string;
  argsPrefix: string[];
  version?: string;
  sourceDescription: string;
}

/**
 * Resolves Pi executable across global PATH, local project, and bundled dependencies
 */
export function resolvePiBinary(): ResolvedPi {
  // 1. Try global PATH first
  try {
    const globalCheck = spawn.sync("pi", ["--version"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (globalCheck.status === 0 && globalCheck.stdout) {
      return {
        type: "global",
        command: "pi",
        argsPrefix: [],
        version: globalCheck.stdout.trim(),
        sourceDescription: "系统全局命令 (PATH)",
      };
    }
  } catch {
    // Ignore and proceed
  }

  // 2. Try resolving via node_modules/.bin/pi
  const candidateBinDirs = [
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../node_modules/.bin/pi"),
    path.resolve(process.cwd(), "node_modules/.bin/pi"),
  ];

  for (const binPath of candidateBinDirs) {
    if (fs.existsSync(binPath)) {
      try {
        const localCheck = spawn.sync(binPath, ["--version"], {
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "ignore"],
        });
        if (localCheck.status === 0 && localCheck.stdout) {
          return {
            type: "local",
            command: binPath,
            argsPrefix: [],
            version: localCheck.stdout.trim(),
            sourceDescription: `本地依赖 (${path.basename(path.dirname(binPath))})`,
          };
        }
      } catch {
        // Continue
      }
    }
  }

  // 3. Try resolving directly via ESM package (@earendil-works/pi-coding-agent)
  try {
    const mainEntry = fileURLToPath(import.meta.resolve("@earendil-works/pi-coding-agent"));
    const cliEntry = path.join(path.dirname(mainEntry), "bundle", "cli.js");

    if (fs.existsSync(cliEntry)) {
      const moduleCheck = spawn.sync(process.execPath, [cliEntry, "--version"], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      if (moduleCheck.status === 0 && moduleCheck.stdout) {
        return {
          type: "bundled",
          command: process.execPath,
          argsPrefix: [cliEntry],
          version: moduleCheck.stdout.trim(),
          sourceDescription: "Monk-Pi 内嵌核心 (免安装运行)",
        };
      }
    }
  } catch {
    // Continue
  }

  return {
    type: "missing",
    command: "",
    argsPrefix: [],
    sourceDescription: "未检测到可用的 Pi 核心",
  };
}

export function detectPi(): { installed: boolean; version?: string; type?: PiBinaryType; description?: string } {
  const resolved = resolvePiBinary();
  return {
    installed: resolved.type !== "missing",
    version: resolved.version,
    type: resolved.type,
    description: resolved.sourceDescription,
  };
}

/**
 * Detects the available package manager on the host machine
 */
export function detectPackageManager(): "bun" | "pnpm" | "npm" {
  try {
    const bunCheck = spawn.sync("bun", ["--version"], { stdio: "ignore" });
    if (bunCheck.status === 0) return "bun";
  } catch {}

  try {
    const pnpmCheck = spawn.sync("pnpm", ["--version"], { stdio: "ignore" });
    if (pnpmCheck.status === 0) return "pnpm";
  } catch {}

  return "npm";
}

/**
 * Installs Pi globally using the best detected package manager
 */
export async function installPi(): Promise<boolean> {
  const pm = detectPackageManager();
  let cmd = "npm";
  let args = ["install", "-g", "@earendil-works/pi-coding-agent"];

  if (pm === "bun") {
    cmd = "bun";
    args = ["add", "-g", "@earendil-works/pi-coding-agent"];
  } else if (pm === "pnpm") {
    cmd = "pnpm";
    args = ["add", "-g", "@earendil-works/pi-coding-agent"];
  }

  logInfo(`检测到包管理器: ${pc.bold(pm)}，正在执行: ${pc.yellow(`${cmd} ${args.join(" ")}`)} ...`);

  try {
    const child = spawn.sync(cmd, args, {
      stdio: "inherit",
    });

    if (child.status === 0) {
      logSuccess("Pi 核心套件安装成功！");
      return true;
    }

    logError(`安装失败，退出码: ${child.status}`);
    logWarn(`若因权限问题 (EACCES) 失败，请尝试:`);
    console.log(`    ${pc.cyan(`sudo ${cmd} ${args.join(" ")}`)}`);
    console.log(`    或直接使用免安装方案: ${pc.cyan("npx monk-pi")}`);
    return false;
  } catch (err: unknown) {
    logError(`执行安装异常: ${err instanceof Error ? err.message : String(err)}`);
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
  const resolved = resolvePiBinary();
  if (resolved.type === "missing") {
    logError("未找到可用的 Pi 核心运行环境。");
    return 1;
  }

  const { apiKey, defaultModel, passthroughArgs } = options;

  const extraArgs: string[] = [];

  // Check if user already passed --provider or --model
  const hasProvider = passthroughArgs.includes("--provider");
  const hasModel = passthroughArgs.some((arg, idx) => {
    return arg === "--model" || arg === "-m" || passthroughArgs[idx - 1] === "--model";
  });

  if (!hasProvider && !hasModel) {
    extraArgs.push("--provider", "monk", "--model", defaultModel);
  } else if (!hasProvider && hasModel) {
    extraArgs.push("--provider", "monk");
  }

  // Combine prefix args (e.g. node cli.js) + monk flags + user args
  const fullArgs = [...resolved.argsPrefix, ...extraArgs, ...passthroughArgs];

  const env = {
    ...process.env,
    MONK_API_KEY: apiKey,
  };

  const child = spawn(resolved.command, fullArgs, {
    stdio: "inherit",
    env,
  });

  // Handle process termination signals
  const forwardSignal = (signal: NodeJS.Signals) => {
    try {
      child.kill(signal);
    } catch {}
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
