#!/usr/bin/env node

import { Command } from "commander";
import pc from "picocolors";
import { autoFixCommand } from "./commands/auto-fix";
import { doctorCommand } from "./commands/doctor";
import { loginCommand } from "./commands/login";
import { modelCommand } from "./commands/model";
import { resumeCommand } from "./commands/resume";
import { runCommand } from "./commands/run";
import { statusCommand } from "./commands/status";
import { MONK_ACCOUNT_URL, MONK_PI_VERSION, MONK_WEBSITE } from "./constants";
import { printBanner } from "./ui";

const rawArgs = process.argv.slice(2);
const firstArg = rawArgs[0];

// Known subcommands
const SUBCOMMANDS = new Set([
  "login",
  "auth",
  "status",
  "check",
  "model",
  "doctor",
  "resume",
  "history",
  "run",
  "exec",
]);

async function main() {
  // Handle run / exec auto-fix command directly (avoids CLI flag collisions)
  if (firstArg === "run" || firstArg === "exec") {
    const exitCode = await autoFixCommand(rawArgs.slice(1));
    process.exit(exitCode);
  }

  // If first argument is one of the dedicated subcommands
  if (firstArg && SUBCOMMANDS.has(firstArg)) {
    const program = new Command();
    program
      .name("monk-pi")
      .description("Monk × Pi: 极速高性价比 Coding Agent Harness")
      .version(MONK_PI_VERSION);

    program
      .command("login")
      .alias("auth")
      .description("配置或更新 Monk API Key，并自动同步到 Pi 配置文件")
      .action(async () => {
        await loginCommand();
      });

    program
      .command("status")
      .alias("check")
      .description("测试 Monk API 延迟、Key 状态及模型连通性")
      .action(async () => {
        await statusCommand();
      });

    program
      .command("model [name]")
      .description("切换默认主力模型 (monk-coding / monk-fast / monk)")
      .action(async (name?: string) => {
        await modelCommand(name);
      });

    program
      .command("doctor")
      .description("全面诊断环境、Node 版本、Pi 核心及网络兼容性")
      .action(async () => {
        await doctorCommand();
      });

    program
      .command("resume")
      .alias("history")
      .description("可视化浏览并恢复历史会话 (断点续写)")
      .action(async () => {
        const exitCode = await resumeCommand(rawArgs.slice(1));
        process.exit(exitCode);
      });

    await program.parseAsync(process.argv);
    return;
  }

  // Quick shortcut flags for resume
  if (firstArg === "-r" || firstArg === "--resume") {
    const exitCode = await resumeCommand(rawArgs.slice(1));
    process.exit(exitCode);
  }

  if (firstArg === "continue") {
    const exitCode = await runCommand(["--continue", ...rawArgs.slice(1)]);
    process.exit(exitCode);
  }

  // Handle run / exec auto-fix command
  if (firstArg === "run" || firstArg === "exec") {
    const exitCode = await autoFixCommand(rawArgs.slice(1));
    process.exit(exitCode);
  }

  // Handle explicit help flag
  if (firstArg === "--help" || firstArg === "-h") {
    printBanner();
    console.log(`  ${pc.bold("用法:")}`);
    console.log(`    ${pc.yellow("monk-pi")}                       进入交互式编码模式 (默认使用 monk-coding)`);
    console.log(`    ${pc.yellow("monk-pi")} [选项/提示词...]        传递指令或文件给 Pi`);
    console.log();
    console.log(`  ${pc.bold("示例:")}`);
    console.log(`    ${pc.dim("# 启动交互式 Agent")}`);
    console.log(`    ${pc.cyan("monk-pi")}`);
    console.log();
    console.log(`    ${pc.dim("# 带初始需求进入交互式终端")}`);
    console.log(`    ${pc.cyan('monk-pi "重构这个目录下的代码"')}`);
    console.log();
    console.log(`    ${pc.dim("# 非交互式命令行模式 (打印结果并退出)")}`);
    console.log(`    ${pc.cyan('monk-pi -p "解释当前 package.json 的依赖"')}`);
    console.log();
    console.log(`    ${pc.dim("# 指定使用极速推理模型")}`);
    console.log(`    ${pc.cyan('monk-pi --model monk-fast "快速审查这个提交"')}`);
    console.log();
    console.log(`    ${pc.dim("# 恢复上一轮历史会话")}`);
    console.log(`    ${pc.cyan("monk-pi --continue (或 monk-pi continue)")}`);
    console.log();
    console.log(`    ${pc.dim("# 可视化浏览并恢复以往历史任务")}`);
    console.log(`    ${pc.cyan("monk-pi -r (或 monk-pi resume)")}`);
    console.log();
    console.log(`    ${pc.dim("# 监控命令运行并享受报错一键自愈")}`);
    console.log(`    ${pc.cyan('monk-pi run "npm run build"')}`);
    console.log(`    ${pc.cyan('monk-pi run "npm test"')}`);
    console.log();
    console.log(`  ${pc.bold("专属管理指令:")}`);
    console.log(`    ${pc.yellow("monk-pi run <命令>")}            监控命令运行并在报错时一键呼叫 AI 自愈代码 (Auto-Fix)`);
    console.log(`    ${pc.yellow("monk-pi resume (或 -r)")}        可视化浏览并恢复历史会话 (断点续写)`);
    console.log(`    ${pc.yellow("monk-pi login")}                 配置 / 更新 Monk API Key`);
    console.log(`    ${pc.yellow("monk-pi status")}                检测 API 延迟、Key 状态与连通性`);
    console.log(`    ${pc.yellow("monk-pi model [name]")}          查看或切换默认主力模型`);
    console.log(`    ${pc.yellow("monk-pi doctor")}                一键诊断环境依赖与兼容配置`);
    console.log();
    console.log(`  ${pc.bold("相关链接:")}`);
    console.log(`    Monk 官网: ${pc.underline(pc.cyan(MONK_WEBSITE))}`);
    console.log(`    用量查询: ${pc.underline(pc.cyan(MONK_ACCOUNT_URL))}`);
    console.log();
    return;
  }

  // Handle version
  if (firstArg === "--version" || firstArg === "-v") {
    console.log(`monk-pi v${MONK_PI_VERSION}`);
    return;
  }

  // Default: pass through everything to Pi runner
  const exitCode = await runCommand(rawArgs);
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(pc.red(`\n[monk-pi 异常]: ${err.message || err}\n`));
  process.exit(1);
});
