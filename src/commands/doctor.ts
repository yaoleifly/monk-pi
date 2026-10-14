import fs from "node:fs";
import os from "node:os";
import pc from "picocolors";
import {
  isMonkProviderCurrent,
  resolveApiKey,
  syncPiExtension,
  syncPiModelsJson,
} from "../config";
import { MIN_NODE_VERSION, getPiModelsFile } from "../constants";
import { compareVersions } from "../semver";
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
  if (compareVersions(nodeVersion, MIN_NODE_VERSION) >= 0) {
    logSuccess(`Node.js 版本: ${pc.bold(nodeVersion)} (满足 >= ${MIN_NODE_VERSION} 要求)`);
  } else if (compareVersions(nodeVersion, "22.0.0") >= 0) {
    hasIssue = true;
    logWarn(
      `Node.js 版本: ${pc.bold(nodeVersion)} (Pi 1.2 需要 >= ${MIN_NODE_VERSION}，当前版本不受支持)`
    );
  } else {
    hasIssue = true;
    logError(`Node.js 版本: ${pc.bold(nodeVersion)} (过低，请升级到 Node ${MIN_NODE_VERSION}+)`);
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
        if (isMonkProviderCurrent(monk)) {
          logSuccess(`Pi 配置文件: ${pc.bold("已配置当前 Monk 模型与 OpenAI 兼容参数")}`);
        } else {
          logWarn(`Pi 配置文件: Monk 配置已过期（模型列表、协议或 compat 与当前服务不一致）`);
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

  // 6. Monk Native Extension Check
  const extRes = syncPiExtension();
  if (extRes.success) {
    if (extRes.updated) {
      logSuccess(
        `Pi 原生扩展: ${pc.bold("已自动更新至最新版")} (中文工程提示词、/monk 指令与自动重试就绪)`
      );
    } else {
      logSuccess(
        `Pi 原生扩展: ${pc.bold("已就绪")} (中文工程提示词、/monk 指令与自动重试就绪)`
      );
    }
  } else {
    logError(`Pi 原生扩展部署失败: ${extRes.error}`);
  }

  // 7. Network connectivity to Monk
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
