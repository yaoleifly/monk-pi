import pc from "picocolors";
import { getDefaultModel, saveMonkConfig } from "../config";
import { MONK_MODELS, MonkModelId } from "../constants";
import { logInfo, logSuccess, logWarn, printBanner, promptSelectModel } from "../ui";

export async function modelCommand(targetModel?: string): Promise<void> {
  printBanner();
  const currentModel = getDefaultModel();

  if (targetModel) {
    const matched = MONK_MODELS.find(
      (m) => m.id === targetModel || m.id.endsWith(targetModel)
    );
    if (!matched) {
      logWarn(`未知模型: "${targetModel}"`);
      logInfo(`支持的模型列表: ${MONK_MODELS.map((m) => m.id).join(", ")}`);
      return;
    }
    saveMonkConfig({ defaultModel: matched.id });
    logSuccess(`默认主力模型已切换为: ${pc.bold(pc.yellow(matched.name))}`);
    return;
  }

  const selected = await promptSelectModel(currentModel);
  saveMonkConfig({ defaultModel: selected });
  const matched = MONK_MODELS.find((m) => m.id === selected);
  console.log();
  logSuccess(`默认主力模型已成功设定为: ${pc.bold(pc.yellow(matched?.name || selected))}`);
  console.log();
}
