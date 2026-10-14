import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pc from "picocolors";
import { MONK_PI_VERSION } from "../constants";
import { compareVersions } from "../semver";
import { logError, logInfo, logSuccess, logWarn, printBanner } from "../ui";

export type InstallChannel = "brew" | "npm" | "pnpm" | "bun" | "npx" | "local";

export interface InstallLocation {
  channel: InstallChannel;
  scriptPath: string;
}

const UPGRADE_COMMANDS: Record<Exclude<InstallChannel, "npx" | "local">, { cmd: string; args: string[] }> = {
  brew: { cmd: "brew", args: ["upgrade", "yaoleifly/tap/monk-pi"] },
  npm: { cmd: "npm", args: ["install", "-g", "monk-pi@latest"] },
  pnpm: { cmd: "pnpm", args: ["add", "-g", "monk-pi@latest"] },
  bun: { cmd: "bun", args: ["add", "-g", "monk-pi@latest"] },
};

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+$/, "");
}

export function classifyInstallPath(
  scriptPath: string,
  options?: { cwd?: string; npmGlobalPrefix?: string }
): InstallChannel {
  const path = normalizePath(scriptPath);
  if (/\/_npx\//.test(path)) return "npx";
  if (path.includes("/Cellar/") || path.includes("/homebrew/") || path.includes("/linuxbrew/")) {
    return "brew";
  }
  if (path.includes("/.bun/") || path.includes("/bun/install/global/")) return "bun";
  if (path.includes("/pnpm/global/") || path.includes("/.local/share/pnpm/")) return "pnpm";

  const prefix = options?.npmGlobalPrefix ? normalizePath(options.npmGlobalPrefix) : "";
  if (prefix && (path === prefix || path.startsWith(`${prefix}/`))) return "npm";

  if (/\/node_modules\/monk-pi\//.test(path)) {
    const cwd = options?.cwd ? normalizePath(options.cwd) : "";
    if (cwd && (path === cwd || path.startsWith(`${cwd}/`))) return "local";
    return "npm";
  }

  return "local";
}

export function detectInstallLocation(): InstallLocation {
  const scriptPath = fileURLToPath(import.meta.url);
  let npmGlobalPrefix = "";
  try {
    const probe = spawnSync("npm", ["prefix", "-g"], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
    if (probe.status === 0 && probe.stdout) npmGlobalPrefix = probe.stdout.trim();
  } catch {
    // npm may be absent; classification still works from the path.
  }
  return {
    channel: classifyInstallPath(scriptPath, { cwd: process.cwd(), npmGlobalPrefix }),
    scriptPath,
  };
}

export async function fetchLatestNpmVersion(
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const response = await fetchImpl("https://registry.npmjs.org/monk-pi/latest", {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`npm registry 响应异常 (HTTP ${response.status})`);
  }
  const payload = (await response.json()) as { version?: string };
  if (!payload.version) throw new Error("npm registry 未返回版本号");
  return payload.version;
}

function printManualUpgrade(): void {
  console.log(`  ${pc.dim("可按安装方式手动升级：")}`);
  console.log(`    ${pc.cyan("brew upgrade yaoleifly/tap/monk-pi")}`);
  console.log(`    ${pc.cyan("npm install -g monk-pi@latest")}`);
  console.log(`    ${pc.cyan("pnpm add -g monk-pi@latest")}`);
  console.log(`    ${pc.cyan("bun add -g monk-pi@latest")}`);
  console.log(`    ${pc.dim("通过 npx 运行时，直接再次执行")} ${pc.cyan("npx monk-pi")}`);
}

export async function updateCommand(
  force = false,
  deps?: {
    location?: InstallLocation;
    latest?: string;
    fetchLatest?: () => Promise<string>;
    runUpgrade?: (cmd: string, args: string[]) => number;
  }
): Promise<number> {
  printBanner();
  console.log(`  ${pc.bold("【检查 Monk-Pi 更新】")}`);
  console.log();

  const location = deps?.location ?? detectInstallLocation();
  logInfo(`当前版本: ${pc.bold(`v${MONK_PI_VERSION}`)} ${pc.dim(`· 安装来源 ${location.channel}`)}`);

  let latest = deps?.latest;
  if (!latest) {
    try {
      latest = await (deps?.fetchLatest ?? fetchLatestNpmVersion)();
    } catch (err: unknown) {
      logError(`无法查询云端版本: ${err instanceof Error ? err.message : String(err)}`);
      return 1;
    }
  }

  const comparison = compareVersions(MONK_PI_VERSION, latest);
  if (comparison > 0) {
    logSuccess(`本地 v${MONK_PI_VERSION} 新于已发布的 v${latest}，无需降级。`);
    return 0;
  }
  if (comparison === 0 && !force) {
    logSuccess(`已是最新版本 (v${MONK_PI_VERSION})。`);
    return 0;
  }

  if (comparison === 0 && force) {
    logInfo("版本一致，按 --force 继续执行升级命令。");
  } else {
    logWarn(`发现新版本 ${pc.bold(`v${latest}`)}，准备升级...`);
  }

  if (location.channel === "npx") {
    logSuccess("当前通过 npx 运行。下次执行 npx monk-pi 会拉取已发布的最新版本。");
    return 0;
  }

  if (location.channel === "local") {
    logWarn("当前是源码或项目内运行，不会自动改全局安装。");
    printManualUpgrade();
    return 0;
  }

  const plan = UPGRADE_COMMANDS[location.channel];
  logInfo(`执行: ${pc.yellow(`${plan.cmd} ${plan.args.join(" ")}`)}`);
  const status = deps?.runUpgrade
    ? deps.runUpgrade(plan.cmd, plan.args)
    : spawnSync(plan.cmd, plan.args, { stdio: "inherit" }).status ?? 1;

  if (status === 0) {
    logSuccess("升级命令已完成。请重新打开终端，再运行 monk-pi --version 确认。");
    return 0;
  }
  logError(`升级失败，退出码: ${status}`);
  printManualUpgrade();
  return status;
}
