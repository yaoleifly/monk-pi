import pc from "picocolors";
import { getDefaultModel, resolveApiKey, syncPiExtension, syncPiModelsJson } from "../config";
import { PRO_TIPS } from "../extension/monk-extension";
import { detectPi, installPi, launchPi } from "../pi-runner";
import { logError, logInfo, logSuccess, logWarn, promptInstallPi } from "../ui";
import { loginCommand } from "./login";

export async function runCommand(passthroughArgs: string[]): Promise<number> {
  // 1. Check if Pi is installed
  const piCheck = detectPi();
  if (!piCheck.installed) {
    const shouldInstall = await promptInstallPi();
    if (shouldInstall) {
      const installed = await installPi();
      if (!installed) {
        logError("无法自动安装 Pi，请手动运行 `npm install -g @earendil-works/pi-coding-agent` 后重试。");
        return 1;
      }
    } else {
      logWarn("已取消运行。Monk Harness 需要 Pi 作为运行底座。");
      return 1;
    }
  }

  // 2. Check if API Key is configured
  let { key } = resolveApiKey();
  if (!key) {
    logWarn("未检测到 Monk API Key，正在为您启动首次配置引导...");
    const ok = await loginCommand();
    if (!ok) {
      return 1;
    }
    const resolved = resolveApiKey();
    key = resolved.key;
  }

  if (!key) {
    logError("未找到有效的 Monk API Key，退出运行。");
    return 1;
  }

  // 3. Ensure Pi's models.json & native extension are up-to-date
  syncPiModelsJson(key);
  syncPiExtension();

  // 4. Resolve default model
  const defaultModel = getDefaultModel();

  // Print startup pro-tip for interactive sessions
  if (!passthroughArgs.includes("-p") && !passthroughArgs.includes("--print")) {
    const tip = PRO_TIPS[Math.floor(Math.random() * PRO_TIPS.length)];
    console.log(`  ${pc.yellow("💡 极客小贴士:")} ${pc.dim(tip)}`);
    console.log();
  }

  // 5. Launch Pi
  return launchPi({
    apiKey: key,
    defaultModel,
    passthroughArgs,
  });
}
