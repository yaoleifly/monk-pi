export const MONK_EXTENSION_CODE = `// @monk-managed-pi-extension
// Monk × Pi Native Extension
// Features: Footer status, /monk slash command, and context overflow auto-compaction

const MONK_MODELS = [
  { id: "monk-coding", label: "monk-coding (代码主力 - 推荐 · 深度工具调用)" },
  { id: "monk-fast", label: "monk-fast (极速推理 · 快速问答与轻量任务)" },
  { id: "monk", label: "monk (融合旗舰 · 质量优先与综合推理)" },
];

const OVERFLOW_PATTERNS = [
  /context.*length/i,
  /maximum.*tokens/i,
  /token.*limit/i,
  /too many tokens/i,
  /prompt.*too long/i,
  /request.*too large/i,
  /context_window_exceeded/i,
  /exceed.*context/i,
];

export default function monkExtension(pi) {
  let turnCount = 0;

  function updateStatus(ctx) {
    if (!ctx.ui) return;
    const model = ctx.model;
    const isMonk = model && model.provider === "monk";

    if (!isMonk) {
      ctx.ui.setStatus("monk", undefined);
      return;
    }

    const theme = ctx.ui.theme;
    const indicator = theme.fg("success", "●");
    const label = theme.fg("accent", \`Monk: \${model.id}\`);
    const meta = theme.fg("dim", " (1M ctx)");
    ctx.ui.setStatus("monk", \`\${indicator} \${label}\${meta}\`);
  }

  // 1. Lifecycle Events: update footer status
  pi.on("session_start", async (_event, ctx) => {
    updateStatus(ctx);
  });

  pi.on("model_select", async (_event, ctx) => {
    updateStatus(ctx);
  });

  pi.on("turn_start", async (_event, ctx) => {
    turnCount++;
    if (!ctx.ui) return;
    const model = ctx.model;
    if (model && model.provider === "monk") {
      const theme = ctx.ui.theme;
      const spinner = theme.fg("warning", "▲");
      const label = theme.fg("accent", \`Monk: \${model.id}\`);
      const text = theme.fg("dim", \` [Turn \${turnCount}]\`);
      ctx.ui.setStatus("monk", \`\${spinner} \${label}\${text}\`);
    }
  });

  pi.on("turn_end", async (_event, ctx) => {
    updateStatus(ctx);
  });

  // 2. Intelligent Context Overflow & Compaction Recovery
  pi.on("message_end", async (event, ctx) => {
    const message = event.message;
    if (!message || message.role !== "assistant") return;
    if (message.stopReason !== "error") return;

    const isMonk = message.provider === "monk" || (ctx.model && ctx.model.provider === "monk");
    if (!isMonk) return;

    const errorMsg = message.errorMessage || "";
    if (errorMsg.includes("context_length_exceeded")) return;

    const isOverflow = OVERFLOW_PATTERNS.some((p) => p.test(errorMsg));
    if (isOverflow) {
      ctx.ui && ctx.ui.notify(
        "Monk: 检测到上下文超长，已自动重写错误并触发智能压缩 (Compaction) 重试...",
        "warning"
      );
      return {
        message: {
          ...message,
          errorMessage: \`context_length_exceeded: \${errorMsg}\`,
        },
      };
    }
  });

  // 3. Custom Slash Command: /monk
  pi.registerCommand("monk", {
    description: "Monk 专属控制台 (/monk [model|ping|status|account])",
    handler: async (args, ctx) => {
      const sub = (args || "").trim().toLowerCase();

      if (sub === "model" || sub === "switch") {
        await handleModelSwitch(pi, ctx);
        return;
      }

      if (sub === "ping" || sub === "status") {
        await handlePing(ctx);
        return;
      }

      if (sub === "account" || sub === "quota") {
        ctx.ui && ctx.ui.notify("Monk 用量与到期查询: https://monk.party/account/", "info");
        return;
      }

      // Default: interactive menu
      await handleMenu(pi, ctx);
    },
  });
}

async function handleModelSwitch(pi, ctx) {
  if (!ctx.ui) return;

  const choices = MONK_MODELS.map((m) => m.label);
  const selectedLabel = await ctx.ui.select("选择当前会话的 Monk 模型:", choices);

  if (!selectedLabel) return;

  const matched = MONK_MODELS.find((m) => m.label === selectedLabel);
  if (!matched) return;

  const model = ctx.modelRegistry.find("monk", matched.id);
  if (!model) {
    ctx.ui.notify(\`未在配置中找到模型: monk/\${matched.id}\`, "error");
    return;
  }

  const success = await pi.setModel(model);
  if (success) {
    ctx.ui.notify(\`主力模型已切换至: \${matched.id}\`, "info");
  } else {
    ctx.ui.notify(\`切换失败，未能设置模型: \${matched.id}\`, "error");
  }
}

async function handlePing(ctx) {
  if (!ctx.ui) return;

  const startTime = Date.now();
  const apiKey = process.env.MONK_API_KEY || "";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch("https://monk.party/v1/models", {
      headers: { Authorization: \`Bearer \${apiKey}\` },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latency = Date.now() - startTime;

    if (res.ok) {
      ctx.ui.notify(\`Monk API 连通正常 · 延迟 \${latency}ms\`, "info");
    } else {
      ctx.ui.notify(\`Monk API 响应异常 (HTTP \${res.status})\`, "warning");
    }
  } catch (err) {
    ctx.ui.notify(
      \`Monk API 连接失败: \${err instanceof Error ? err.message : String(err)}\`,
      "error"
    );
  }
}

async function handleMenu(pi, ctx) {
  if (!ctx.ui) return;

  const choice = await ctx.ui.select("Monk API 控制台", [
    "1. 切换会话模型 (Switch Model)",
    "2. 探测网络延迟 (Ping API)",
    "3. 查询用量与到期时间 (Account Info)",
  ]);

  if (!choice) return;

  if (choice.startsWith("1")) {
    await handleModelSwitch(pi, ctx);
  } else if (choice.startsWith("2")) {
    await handlePing(ctx);
  } else if (choice.startsWith("3")) {
    ctx.ui.notify("请在浏览器打开 https://monk.party/account/ 查看用量与剩余天数", "info");
  }
}
`;
