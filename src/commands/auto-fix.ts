import spawn from "cross-spawn";
import { select } from "@inquirer/prompts";
import pc from "picocolors";
import { getDefaultModel, resolveApiKey, syncPiExtension, syncPiModelsJson } from "../config";
import { detectPi, installPi, launchPi } from "../pi-runner";
import { logError, logInfo, logSuccess, logWarn, promptInstallPi } from "../ui";
import { loginCommand } from "./login";

const OUTPUT_LIMIT = 12_000;

export interface CommandRunResult {
  command: string;
  exitCode: number;
  durationMs: number;
  output: string;
}

export type AutoFixChoice = "fix" | "interactive" | "ignore";

export function resolveShellCommand(args: string[]): string {
  return args.map((arg) => arg.trim()).filter(Boolean).join(" ").trim();
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  return `${Math.round(seconds)}s`;
}

export function buildAutoFixPrompt(result: CommandRunResult): string {
  const tail = result.output.trim() || "(命令没有输出)";
  return [
    "下面这条本地命令执行失败。请定位根因、做最小必要修改，并重新运行同一条命令验证。",
    "",
    `命令: ${result.command}`,
    `退出码: ${result.exitCode}`,
    `耗时: ${formatDuration(result.durationMs)}`,
    "",
    "日志（尾部）:",
    "```",
    tail,
    "```",
    "",
    "要求：",
    "1. 阅读报错涉及的源码，直接调用工具定位根因，不要先写长计划。",
    "2. 只做修复所需的最小改动。",
    "3. 改完后用 bash 重新运行上面同一条命令。",
    "4. 用一两句话说明改了什么，以及验证是通过还是仍失败。",
  ].join("\n");
}

export function runWatchedCommand(
  command: string,
  options?: { echo?: boolean }
): Promise<CommandRunResult> {
  const echo = options?.echo !== false;
  return new Promise((resolve) => {
    const start = Date.now();
    const chunks: Buffer[] = [];
    let size = 0;
    const shell = process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "sh";
    const args = process.platform === "win32" ? ["/d", "/s", "/c", command] : ["-c", command];
    const child = spawn(shell, args, { stdio: ["inherit", "pipe", "pipe"] });

    const push = (buf: Buffer, stream: NodeJS.WriteStream) => {
      if (echo) stream.write(buf);
      chunks.push(buf);
      size += buf.length;
      while (size > OUTPUT_LIMIT && chunks.length > 1) {
        const dropped = chunks.shift();
        if (!dropped) break;
        size -= dropped.length;
      }
      if (size > OUTPUT_LIMIT && chunks.length === 1) {
        chunks[0] = chunks[0].subarray(chunks[0].length - OUTPUT_LIMIT);
        size = chunks[0].length;
      }
    };

    child.stdout?.on("data", (data: Buffer | string) => push(Buffer.from(data), process.stdout));
    child.stderr?.on("data", (data: Buffer | string) => push(Buffer.from(data), process.stderr));

    const finish = (exitCode: number, extra = "") => {
      if (extra) chunks.push(Buffer.from(extra));
      resolve({
        command,
        exitCode,
        durationMs: Date.now() - start,
        output: Buffer.concat(chunks).toString("utf-8"),
      });
    };

    child.on("close", (code) => finish(code ?? 1));
    child.on("error", (err) => finish(1, err.message));
  });
}

async function ensureAgentReady(): Promise<{ apiKey: string; defaultModel: string } | null> {
  const piCheck = detectPi();
  if (!piCheck.installed) {
    const shouldInstall = await promptInstallPi();
    if (!shouldInstall) {
      logWarn("已取消。自愈需要 Pi 作为运行底座。");
      return null;
    }
    const installed = await installPi();
    if (!installed) {
      logError("无法自动安装 Pi，请手动运行 `npm install -g @earendil-works/pi-coding-agent` 后重试。");
      return null;
    }
  }

  let { key } = resolveApiKey();
  if (!key) {
    logWarn("未检测到 Monk API Key，正在为您启动配置引导...");
    const ok = await loginCommand();
    if (!ok) return null;
    key = resolveApiKey().key;
  }
  if (!key) {
    logError("未找到有效的 Monk API Key，退出运行。");
    return null;
  }

  syncPiModelsJson(key);
  syncPiExtension();
  return { apiKey: key, defaultModel: getDefaultModel() };
}

async function promptChoice(): Promise<AutoFixChoice | null> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return null;
  const choice = await select({
    message: "检测到命令报错，请选择 Monk 介入处理方式:",
    choices: [
      {
        name: "1. 呼叫 Monk 分析报错并自动修复代码 (一键自愈 Auto-Fix · 推荐)",
        value: "fix" as const,
      },
      {
        name: "2. 进入交互式终端协助排查 (带入报错日志)",
        value: "interactive" as const,
      },
      {
        name: "3. 忽略并直接退出终端",
        value: "ignore" as const,
      },
    ],
  });
  return choice;
}

export async function autoFixCommand(
  args: string[],
  deps?: {
    choose?: (result: CommandRunResult) => Promise<AutoFixChoice | null>;
    launch?: (passthroughArgs: string[]) => Promise<number>;
    run?: (command: string) => Promise<CommandRunResult>;
    prepare?: () => Promise<{ apiKey: string; defaultModel: string } | null>;
  }
): Promise<number> {
  const command = resolveShellCommand(args);
  if (!command || command === "--help" || command === "-h") {
    console.log(`  ${pc.bold("用法:")} monk-pi run <命令>`);
    console.log(`  ${pc.dim("示例:")} monk-pi run "npm test"`);
    console.log(`  ${pc.dim("命令成功则原样退出；失败时可选一键自愈、进入交互终端，或直接退出。")}`);
    return command ? 0 : 1;
  }

  logInfo(`正在监控命令: ${pc.yellow(command)}`);
  const result = await (deps?.run ?? ((cmd: string) => runWatchedCommand(cmd)))(command);

  if (result.exitCode === 0) {
    logSuccess(`命令执行成功 ${pc.dim(`· 耗时 ${formatDuration(result.durationMs)}`)}`);
    return 0;
  }

  console.log();
  logError(
    `命令执行失败 (退出码: ${result.exitCode} · 耗时 ${formatDuration(result.durationMs)})`
  );

  const choose = deps?.choose ?? promptChoice;
  const choice = await choose(result);
  if (!choice || choice === "ignore") {
    if (!choice) logWarn("非交互终端，已跳过自愈向导。");
    return result.exitCode;
  }

  const ready = await (deps?.prepare ?? ensureAgentReady)();
  if (!ready) return result.exitCode;

  const prompt = buildAutoFixPrompt(result);
  const passthrough = choice === "fix" ? ["-p", prompt] : [prompt];
  if (deps?.launch) return deps.launch(passthrough);
  return launchPi({
    apiKey: ready.apiKey,
    defaultModel: ready.defaultModel,
    passthroughArgs: passthrough,
  });
}
