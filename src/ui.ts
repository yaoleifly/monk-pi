import pc from "picocolors";
import { password, select, confirm, input } from "@inquirer/prompts";
import { MONK_ACCOUNT_URL, MONK_MODELS, MONK_WEBSITE, MonkModelId } from "./constants";

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
 * Interactive prompt for API Key
 */
export async function promptForApiKey(currentKey?: string): Promise<string> {
  console.log();
  console.log(`  ${pc.bold("欢迎使用 Monk × Pi 编码伴侣！")}`);
  console.log(`  ${pc.dim("Monk 专为 Agent 提供高并发极速融合模型。请配置您的 API Key。")}`);
  console.log(`  ${pc.dim("还没有 Key？可以在")} ${pc.underline(pc.yellow(MONK_WEBSITE))} ${pc.dim("订阅月卡 (¥30/月)")}`);
  console.log();

  const key = await password({
    message: currentKey
      ? `请输入 Monk API Key (直接回车保持当前: ${maskKey(currentKey)}):`
      : "请输入 Monk API Key (格式 sk-monk-...):",
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
