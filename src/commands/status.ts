import pc from "picocolors";
import { getDefaultModel, resolveApiKey } from "../config";
import { fetchOpusKeyInfo, testChatCompletion, validateApiKey } from "../monk-api";
import { detectPi } from "../pi-runner";
import { logError, logInfo, logSuccess, logWarn, maskKey, printBanner } from "../ui";
import { MONK_ACCOUNT_URL, MONK_BASE_URL, MONK_OPUS_TOPUP_URL, MONK_WEBSITE, getMonkConfigFile, getPiModelsFile } from "../constants";

export async function statusCommand(): Promise<void> {
  printBanner();
  console.log(`  ${pc.bold("【服务与环境状态检测】")}`);
  console.log();

  // 1. Pi CLI Status
  const piDetect = detectPi();
  if (piDetect.installed) {
    logSuccess(
      `Pi 运行环境: ${pc.bold("已就绪")} (v${piDetect.version}) · ${pc.dim(`[来源: ${piDetect.description}]`)}`
    );
  } else {
    logWarn(`Pi 运行环境: ${pc.red("未检测到可用运行时")}`);
    console.log(`    ${pc.dim("请运行 npm install -g @earendil-works/pi-coding-agent")}`);
  }

  // 2. API Key Status
  const { key, source } = resolveApiKey();
  const defaultModel = getDefaultModel();

  if (!key) {
    logError(`Monk API Key: ${pc.red("未配置")}`);
    console.log(`    ${pc.dim("请运行 `monk-pi login` 输入您的 Key")}`);
    return;
  }

  const sourceLabels = {
    env: "环境变量 ($MONK_API_KEY)",
    local: `本地配置 (${getMonkConfigFile()})`,
    pi: `Pi 配置文件 (${getPiModelsFile()})`,
    none: "无",
  };

  logSuccess(`Monk API Key: ${pc.bold(maskKey(key))} ${pc.dim(`[来源: ${sourceLabels[source]}]`)}`);
  logInfo(`当前默认主力模型: ${pc.yellow(defaultModel)}`);
  logInfo(`Monk 基础地址: ${pc.dim(MONK_BASE_URL)}`);

  // 3. Network & Auth Check
  process.stdout.write(`  ${pc.dim("⏳ 正在测试 Monk API 连接与认证...")} `);
  const valResult = await validateApiKey(key);

  if (valResult.valid) {
    process.stdout.write("\r" + " ".repeat(50) + "\r");
    logSuccess(
      `Monk API 连接正常 ${pc.dim("·")} 认证有效 ${pc.dim("·")} 延迟: ${pc.green(`${valResult.latencyMs}ms`)}`
    );
    if (valResult.models.length > 0) {
      logInfo(`支持的模型端点: ${pc.dim(valResult.models.join(" · "))}`);
    }
  } else {
    process.stdout.write("\r" + " ".repeat(50) + "\r");
    logError(`Monk API 验证异常: ${valResult.error}`);
    return;
  }

  // 4. Opus Wallet Signal
  process.stdout.write(`  ${pc.dim("⏳ 正在接收 Opus 星球的钱包信号...")} `);
  const wallet = await fetchOpusKeyInfo(key);
  process.stdout.write("\r" + " ".repeat(50) + "\r");
  if (!wallet.available) {
    logInfo(`Opus 钱包: ${pc.dim("信号未到达（不影响订阅模型使用）")}`);
  } else if (!wallet.hasWallet) {
    logInfo(
      `Opus 钱包: ${pc.dim("尚未开通")} · monk-opus 按量付费，充值即用 ${pc.cyan(MONK_OPUS_TOPUP_URL)}`
    );
  } else if (wallet.low || wallet.balance <= 0) {
    logWarn(`Opus 钱包: ${pc.yellow(`余额 ¥${wallet.balance.toFixed(2)}`)} · 偏低，建议充值 ${pc.cyan(MONK_OPUS_TOPUP_URL)}`);
  } else {
    logSuccess(
      `Opus 钱包: 余额 ${pc.green(`¥${wallet.balance.toFixed(2)}`)} · 今日已扣 ¥${wallet.todayCharged.toFixed(4)} · 日限 ¥${wallet.dailyLimit}`
    );
  }

  // 5. Live Chat Completion Test
  process.stdout.write(`  ${pc.dim(`⏳ 正在对 ${defaultModel} 发起极简握手推演...`)} `);
  const testRes = await testChatCompletion(key, defaultModel);

  if (testRes.success) {
    process.stdout.write("\r" + " ".repeat(50) + "\r");
    logSuccess(
      `推理通道握手成功 ${pc.dim("·")} 响应延迟: ${pc.green(`${testRes.latencyMs}ms`)}`
    );
  } else {
    process.stdout.write("\r" + " ".repeat(50) + "\r");
    logWarn(`推理通道握手轻微告警: ${testRes.error || "未返回常规内容"}`);
  }

  console.log();
  console.log(pc.dim("  ──────────────────────────────────────────────────────"));
  console.log(`  ${pc.dim("官方网站:")} ${pc.cyan(MONK_WEBSITE)}`);
  console.log(`  ${pc.dim("用量与到期查询:")} ${pc.cyan(MONK_ACCOUNT_URL)}`);
  console.log();
}
