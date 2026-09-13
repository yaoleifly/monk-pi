import pc from "picocolors";
import { saveMonkConfig, syncPiExtension, syncPiModelsJson, resolveApiKey } from "../config";
import { validateApiKey } from "../monk-api";
import { logError, logInfo, logSuccess, logWarn, maskKey, printBanner, promptForApiKey } from "../ui";

export async function loginCommand(): Promise<boolean> {
  printBanner();
  const current = resolveApiKey();

  const apiKey = await promptForApiKey(current.key || undefined);
  if (!apiKey) {
    logWarn("未输入 API Key，操作已取消。");
    return false;
  }

  logInfo("正在连接 Monk API 验证密钥...");
  const result = await validateApiKey(apiKey);

  if (!result.valid) {
    logError(`验证失败: ${result.error || "未知错误"}`);
    logWarn("请核对后重新运行 `monk-pi login`。");
    return false;
  }

  logSuccess(`验证通过！网络延迟: ${pc.green(`${result.latencyMs}ms`)}`);
  if (result.models.length > 0) {
    logInfo(`可用模型: ${pc.yellow(result.models.join(", "))}`);
  }

  // Save to ~/.monk-pi/config.json
  saveMonkConfig({
    apiKey,
    lastVerified: new Date().toISOString(),
  });
  logSuccess(`凭证已保存至本地配置`);

  // Sync to ~/.pi/agent/models.json & extensions
  const syncResult = syncPiModelsJson(apiKey);
  const extResult = syncPiExtension();
  if (syncResult.success) {
    logSuccess(`已成功同步并优化 Pi 配置文件: ${pc.dim(syncResult.path)}`);
  } else {
    logWarn(`同步 Pi 配置文件失败: ${syncResult.error}`);
  }
  if (extResult.success) {
    logSuccess(`已安装 Monk 原生 TUI 扩展: ${pc.dim(extResult.path)}`);
  }

  console.log();
  logSuccess(`Monk × Pi 就绪！现在您可以直接输入 ${pc.bold(pc.yellow("monk-pi"))} 开始编码。`);
  console.log();
  return true;
}
