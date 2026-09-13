import spawn from "cross-spawn";
import pc from "picocolors";
import { password, select, confirm, input } from "@inquirer/prompts";
import { MONK_ACCOUNT_URL, MONK_MODELS, MONK_WEBSITE, MonkModelId } from "./constants";

export function openBrowser(url: string): boolean {
  try {
    if (process.platform === "darwin") {
      spawn("open", [url], { stdio: "ignore", detached: true });
      return true;
    }
    if (process.platform === "win32") {
      spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true });
      return true;
    }
    spawn("xdg-open", [url], { stdio: "ignore", detached: true });
    return true;
  } catch {
    return false;
  }
}

export function printBanner(): void {
  const line = pc.dim("─".repeat(54));
  console.log();
  console.log(pc.bold(pc.yellow("  █▀▄▀█ █▀█ █▄░█ █▄▀") + "   ✕   " + pc.cyan("█▀█ █")));
  console.log(pc.bold(pc.yellow("  █░▀░█ █▄█ █░▀█ █░█") + "       " + pc.cyan("█▀▀ █")));
  console.log(line);
  console.log(
    `  ${pc.bold("Monk × Pi Harness")} ${pc.dim("·")} ${pc.green("OpenAI-Compatible Fusion Agent")}`
  );
  console.log(
    `  ${pc.dim("模型:")} ${pc.yellow("monk-coding")} ${pc.dim("|")} ${pc.cyan("monk-fast")} ${pc.dim("|")} ${pc.magenta("monk")}`
  );
  console.log(line);
  console.log();
}

export function logSuccess(msg: string): void {
  console.log(`  ${pc.green("✔")} ${msg}`);
}

export function logInfo(msg: string): void {
  console.log(`  ${pc.cyan("ℹ")} ${msg}`);
}

export function logWarn(msg: string): void {
  console.log(`  ${pc.yellow("▲")} ${msg}`);
}

export function logError(msg: string): void {
  console.log(`  ${pc.red("✖")} ${msg}`);
}

export function logStep(step: number, total: number, msg: string): void {
  console.log(`  ${pc.dim(`[${step}/${total}]`)} ${pc.bold(msg)}`);
}

/**
 * Interactive prompt for API Key with one-click browser checkout option
 */
export async function promptForApiKey(currentKey?: string): Promise<string> {
  console.log();
  console.log(`  ${pc.bold("欢迎使用 Monk × Pi 编码伴侣！")}`);
  console.log(
    `  ${pc.dim("Monk 专为 Agent 提供极速高吞吐融合模型 (月卡 ¥30 / 100万 Token 上下文)")}`
  );
  console.log();

  if (!currentKey) {
    const action = await select({
      message: "请选择配置或获取 Monk API Key 的方式:",
      choices: [
        {
          name: `1. 我已有 API Key，直接粘贴输入 ${pc.dim("(sk-monk-...)")}`,
          value: "input",
        },
        {
          name: `2. 我还没有 Key，立即打开 monk.party 订阅 ${pc.green("(推荐 · 回车浏览器扫码)")}`,
          value: "open_browser",
        },
      ],
    });

    if (action === "open_browser") {
      logInfo(`正在为您在默认浏览器打开官网: ${pc.cyan(MONK_WEBSITE)} ...`);
      openBrowser(MONK_WEBSITE);
      console.log();
      logSuccess("已唤起浏览器！请在网页完成订阅后，将生成的 sk-monk-... Key 复制并粘贴到下方：");
      console.log();
    }
  } else {
    const action = await select({
      message: `检测到已配置 Key (${maskKey(currentKey)})，请选择操作:`,
      choices: [
        {
          name: "1. 保持并测试当前 Key",
          value: "keep",
        },
        {
          name: "2. 更换为新的 API Key",
          value: "replace",
        },
        {
          name: `3. 在浏览器打开 monk.party 官网 (查询/续费)`,
          value: "open_browser",
        },
      ],
    });

    if (action === "keep") {
      return currentKey;
    }

    if (action === "open_browser") {
      logInfo(`正在为您在浏览器打开官网: ${pc.cyan(MONK_ACCOUNT_URL)} ...`);
      openBrowser(MONK_ACCOUNT_URL);
      console.log();
      logInfo("已打开查询页面。如需更换 Key 请在下方粘贴，直接回车保持当前 Key：");
      console.log();
    }
  }

  const key = await password({
    message: currentKey
      ? `请输入 Monk API Key (直接回车保持当前: ${maskKey(currentKey)}):`
      : "请粘贴您的 Monk API Key (sk-monk-...):",
    mask: "*",
    validate: (val) => {
      const trimmed = val.trim();
      if (!trimmed && currentKey) return true;
      if (!trimmed) return "API Key 不能为空";
      if (!trimmed.startsWith("sk-")) {
        return "Key 格式通常以 sk- 开头，请确认复制完整";
      }
      return true;
    },
  });

  const finalKey = key.trim() || currentKey || "";
  return finalKey;
}

/**
 * Interactive prompt for selecting default model
 */
export async function promptSelectModel(currentModel?: MonkModelId): Promise<MonkModelId> {
  const choices = MONK_MODELS.map((m) => ({
    name: `${m.name.padEnd(28)} ${pc.dim(m.description)}`,
    value: m.id,
    description: m.description,
  }));

  const selected = await select({
    message: "请选择默认主力模型:",
    choices,
    default: currentModel || "monk-coding",
  });

  return selected as MonkModelId;
}

/**
 * Prompt to install pi if missing
 */
export async function promptInstallPi(): Promise<boolean> {
  logWarn("未检测到全局安装的 pi 编码助手 (@earendil-works/pi-coding-agent)。");
  console.log(`  ${pc.dim("Monk Harness 依赖 Pi 作为底层 TUI/Agent 运行时。")}`);
  console.log();

  return await confirm({
    message: "是否立即使用 npm 全局安装 @earendil-works/pi-coding-agent？",
    default: true,
  });
}

export function maskKey(key: string): string {
  if (!key || key.length < 10) return "******";
  return `${key.slice(0, 7)}...${key.slice(-4)}`;
}
