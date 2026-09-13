import fs from "node:fs";
import os from "node:os";
import pc from "picocolors";
import { getDefaultModel, resolveApiKey, syncPiModelsJson } from "../config";
import { MONK_BASE_URL, getMonkConfigFile, getPiModelsFile } from "../constants";
import { validateApiKey } from "../monk-api";
import { detectPi } from "../pi-runner";
import { logError, logInfo, logSuccess, logWarn, maskKey, printBanner } from "../ui";

export async function doctorCommand(): Promise<void> {
  printBanner();
  console.log(`  ${pc.bold("【Monk × Pi 环境诊断 (Doctor)】")}`);
  console.log();

  let hasIssue = false;

  // 1. Node.js Check
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split(".")[0], 10);
  if (major >= 18) {
    logSuccess(`Node.js 版本: ${pc.bold(nodeVersion)} (满足 >= 18 要求)`);
  } else {
    hasIssue = true;
    logError(`Node.js 版本: ${pc.bold(nodeVersion)} (过低，请升级到 Node 18+)`);
  }

  // 2. OS Check
  logInfo(`操作系统: ${os.type()} ${os.release()} (${os.arch()})`);

  // 3. Pi CLI Check
  const pi = detectPi();
  if (pi.installed) {
    logSuccess(
      `Pi 核心套件: ${pc.bold(`已就绪 (v${pi.version})`)} · ${pc.dim(`[来源: ${pi.description}]`)}`
    );
  } else {
    hasIssue = true;
    logError(`Pi 核心套件: ${pc.bold("未找到可用运行时")}`);
    console.log(`    ${pc.dim("解决办法: 运行 npm install -g @earendil-works/pi-coding-agent")}`);
  }

  // 4. API Key Check
  const { key, source } = resolveApiKey();
  if (key) {
    logSuccess(`Monk API Key: ${pc.bold(maskKey(key))} (来源: ${source})`);
  } else {
    hasIssue = true;
    logError(`Monk API Key: 未配置`);
    console.log(`    ${pc.dim("解决办法: 运行 monk-pi login")}`);
  }

  // 5. Models.json Check
  const modelsFile = getPiModelsFile();
  if (fs.existsSync(modelsFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(modelsFile, "utf-8"));
      const monk = data?.providers?.monk;
      if (monk) {
        const hasCompat =
          monk.compat?.supportsDeveloperRole === false &&
          monk.compat?.maxTokensField === "max_tokens";
        if (hasCompat) {
          logSuccess(`Pi 配置文件: ${pc.bold("已配置 Monk 专属优化兼容参数")}`);
        } else {
          logWarn(`Pi 配置文件: 存在 Monk 配置，但缺少最佳 compat 参数`);
          console.log(`    ${pc.dim("正在为您自动纠正...")}`);
          syncPiModelsJson(key);
          logSuccess(`Pi 配置文件: 已自动修复优化`);
        }
      } else {
        logWarn(`Pi 配置文件: 尚未注入 Monk 供应商`);
        syncPiModelsJson(key);
        logSuccess(`Pi 配置文件: 已成功自动注入`);
      }
    } catch {
      logError(`Pi 配置文件: ${modelsFile} 存在语法错误`);
    }
  } else {
    logWarn(`Pi 配置文件: 尚未创建，正在为您自动创建...`);
    syncPiModelsJson(key);
    logSuccess(`Pi 配置文件: 创建完成`);
  }

  // 6. Network connectivity to Monk
  if (key) {
    process.stdout.write(`  ${pc.dim("⏳ 正在探测与 monk.party 接口的连通性...")} `);
    const val = await validateApiKey(key);
    process.stdout.write("\r" + " ".repeat(50) + "\r");
    if (val.valid) {
      logSuccess(`Monk 连通性: ${pc.green("优秀")} · 延迟 ${val.latencyMs}ms`);
    } else {
      hasIssue = true;
      logError(`Monk 连通性异常: ${val.error}`);
    }
  }

  console.log();
  console.log(pc.dim("  ──────────────────────────────────────────────────────"));
  if (hasIssue) {
    logWarn("检测到环境存在部分问题，请参考上方提示处理。");
  } else {
    logSuccess(pc.bold("太棒了！所有检查项全部通过，环境处于最佳状态。"));
  }
  console.log();
}
