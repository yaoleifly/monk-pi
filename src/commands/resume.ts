import { SessionManager } from "@earendil-works/pi-coding-agent";
import pc from "picocolors";
import { select } from "@inquirer/prompts";
import { getDefaultModel, resolveApiKey, syncPiExtension, syncPiModelsJson } from "../config";
import { launchPi } from "../pi-runner";
import { logError, logInfo, logWarn, printBanner } from "../ui";
import { loginCommand } from "./login";

interface SessionItem {
  path: string;
  id: string;
  name?: string;
  modified: Date;
  messageCount: number;
  firstMessage?: string;
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();

  if (diff < 60 * 1000) return "刚刚";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} 分钟前`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))} 小时前`;
  if (diff < 48 * 60 * 60 * 1000) {
    const hours = String(date.getHours()).padStart(2, "0");
    const mins = String(date.getMinutes()).padStart(2, "0");
    return `昨天 ${hours}:${mins}`;
  }
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (24 * 60 * 60 * 1000))} 天前`;
  }

  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const mins = String(date.getMinutes()).padStart(2, "0");
  return `${m}-${d} ${hours}:${mins}`;
}

function formatPromptPreview(text?: string): string {
  if (!text) return "（空白初始会话）";
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 36) return clean;
  return `${clean.slice(0, 36)}...`;
}

export async function resumeCommand(extraArgs: string[] = []): Promise<number> {
  printBanner();

  // 1. Resolve API Key
  let { key } = resolveApiKey();
  if (!key) {
    logWarn("未检测到 Monk API Key，正在为您启动首次配置引导...");
    const ok = await loginCommand();
    if (!ok) return 1;
    key = resolveApiKey().key;
  }

  if (!key) {
    logError("未找到有效的 Monk API Key，退出运行。");
    return 1;
  }

  // 2. Sync config & extension
  syncPiModelsJson(key);
  syncPiExtension();
  const defaultModel = getDefaultModel();

  // 3. Scan sessions for the current project
  const cwd = process.cwd();
  let sessions: SessionItem[] = [];

  try {
    const list = await SessionManager.list(cwd);
    sessions = list.map((s) => ({
      path: s.path,
      id: s.id,
      name: s.name,
      modified: s.modified ? new Date(s.modified) : new Date(),
      messageCount: s.messageCount ?? 0,
      firstMessage: s.firstMessage,
    }));
  } catch {
    // If scanning fails, fallback to Pi native resume picker
    return launchPi({
      apiKey: key,
      defaultModel,
      passthroughArgs: ["--resume", ...extraArgs],
    });
  }

  if (sessions.length === 0) {
    logInfo("当前项目下暂无历史会话记录。");
    console.log(`  ${pc.dim("正在为您开启全新交互式会话...")}`);
    return launchPi({
      apiKey: key,
      defaultModel,
      passthroughArgs: extraArgs,
    });
  }

  // Sort by modified time descending (most recent first)
  sessions.sort((a, b) => b.modified.getTime() - a.modified.getTime());

  // 4. Build options for interactive picker
  const choices = sessions.slice(0, 15).map((s) => {
    const timeStr = pc.cyan(`[${formatRelativeTime(s.modified).padEnd(8)}]`);
    const titleStr = s.name ? pc.bold(pc.yellow(s.name)) : formatPromptPreview(s.firstMessage);
    const countStr = pc.dim(`(${s.messageCount} 条对话)`);
    return {
      name: `${timeStr} ${titleStr} ${countStr}`,
      value: s.path,
      description: s.firstMessage || s.name || "未命名会话",
    };
  });

  // Add "Start New Session" option at the bottom
  choices.push({
    name: pc.green("➕  [开启全新会话] (Start a fresh session)"),
    value: "__NEW_SESSION__",
    description: "不加载历史记录，直接开始新任务",
  });

  const selectedPath = await select({
    message: "请选择要恢复的历史会话 (按修改时间排序):",
    choices,
    pageSize: 10,
  });

  if (selectedPath === "__NEW_SESSION__") {
    return launchPi({
      apiKey: key,
      defaultModel,
      passthroughArgs: extraArgs,
    });
  }

  // Launch with specific session file
  return launchPi({
    apiKey: key,
    defaultModel,
    passthroughArgs: ["--session", selectedPath, ...extraArgs],
  });
}
