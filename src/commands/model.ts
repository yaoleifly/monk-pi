import pc from "picocolors";
import { getDefaultModel, resolveApiKey, saveMonkConfig } from "../config";
import { fetchOpusKeyInfo } from "../monk-api";
import { MONK_MODELS, MONK_OPUS_TOPUP_URL, matchMonkModel } from "../constants";
import { logInfo, logSuccess, logWarn, printBanner, promptSelectModel } from "../ui";

/** Selecting the metered model only makes sense with a funded Opus wallet. */
async function checkOpusWallet(): Promise<void> {
  const { key } = resolveApiKey();
  if (!key) return;
  const info = await fetchOpusKeyInfo(key);
  if (!info.available) return;
  if (!info.hasWallet) {
    console.log();
    logWarn("还没有 Opus 钱包——monk-opus 是按量付费模型，需要先充值。");
    logInfo(`去用户中心充值: ${pc.cyan(MONK_OPUS_TOPUP_URL)} ${pc.dim("(¥20 起充)")}`);
  } else if (info.low || info.balance <= 0) {
    console.log();
    logWarn(`Opus 钱包余额不足 (¥${info.balance.toFixed(2)})，调用 monk-opus 会被拒。`);
    logInfo(`去充值: ${pc.cyan(MONK_OPUS_TOPUP_URL)}`);
  } else {
    logInfo(`Opus 钱包余额 ${pc.green(`¥${info.balance.toFixed(2)}`)}，可以开始攻坚了。`);
  }
}

export async function modelCommand(targetModel?: string): Promise<void> {
  printBanner();
  const currentModel = getDefaultModel();

  if (targetModel) {
    const matched = matchMonkModel(targetModel);
    if (!matched) {
      logWarn(`未知模型: "${targetModel}"`);
      logInfo(`支持的模型列表: ${MONK_MODELS.map((m) => m.id).join(", ")}`);
      return;
    }
    saveMonkConfig({ defaultModel: matched.id });
    logSuccess(`默认主力模型已切换为: ${pc.bold(pc.yellow(matched.name))}`);
    if (matched.id === "monk-opus") await checkOpusWallet();
    return;
  }

  const selected = await promptSelectModel(currentModel);
  saveMonkConfig({ defaultModel: selected });
  const matched = MONK_MODELS.find((m) => m.id === selected);
  console.log();
  logSuccess(`默认主力模型已成功设定为: ${pc.bold(pc.yellow(matched?.name || selected))}`);
  if (selected === "monk-opus") await checkOpusWallet();
  console.log();
}
