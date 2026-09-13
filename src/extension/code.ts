export const MONK_EXTENSION_CODE = `// @monk-managed-pi-extension
// Monk × Pi Native Extension
// Features: Footer status, Context macros (@diff, @recent, @git, @staged), Chinese engineering prompt, /undo, /commit, /review, /monk, and auto-compaction

const fs = require("node:fs");
const path = require("node:path");

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

const CHINESE_ENGINEERING_PROMPT = \`
# 中文工程交互规范 (Monk Chinese Engineering Persona)
1. 语言表达准则：
   - 全程使用干练、专业、自然的中文进行沟通与技术分析。
   - 严禁任何形式的客套与铺垫废话（严禁输出诸如“好的”、“没问题”、“收到”、“接下来我将……”、“这是一个很好的问题”等无意义填充词）。
   - 代码中的标识符、类名、函数名、库名、Git 命令、参数选项及业界通用技术名词（如 JWT、Promise、Hook、WebSocket、Props 等）保持英文原貌，切勿生硬翻译。
2. 任务执行准则 (Action First)：
   - 行动先于解释。凡是需要阅读文件、修改代码或执行系统命令的场景，直接调用相应工具 (read / edit / write / bash)，禁止在调用工具前陈述冗余的操作计划。
   - 工具调用后，用最简练的一至两句话总结改动要点（明确指出修改了哪个模块、解决了什么问题），必要时提供验证命令（如测试或启动命令）。
3. 代码质量准则：
   - 严守既有代码库的代码风格与架构规范。
   - 修改代码必须精准微调，避免不必要的格式洗牌或整文件盲目重写。
   - 复杂算法或关键业务逻辑处增加简洁明了的中文行内注释。
\`;

export default function monkExtension(pi) {
  let turnCount = 0;
  let chinesePromptEnabled = true;

  // Undo Checkpoint Storage
  const undoStack = [];
  let currentTurnBackups = new Map();

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
    const cnBadge = chinesePromptEnabled ? theme.fg("dim", " [中]") : "";
    const undoBadge =
      undoStack.length > 0 ? theme.fg("warning", \` [可撤销:\${undoStack.length}]\`) : "";
    const meta = theme.fg("dim", " (1M ctx)");
    ctx.ui.setStatus("monk", \`\${indicator} \${label}\${cnBadge}\${undoBadge}\${meta}\`);
  }

  // 1. Lifecycle Events
  pi.on("session_start", async (_event, ctx) => {
    updateStatus(ctx);

    try {
      if (ctx.ui && typeof ctx.ui.addAutocompleteProvider === "function") {
        ctx.ui.addAutocompleteProvider((current) => ({
          triggerCharacters: ["@"],
          async getSuggestions(lines, cursorLine, cursorCol, options) {
            const line = lines[cursorLine] ?? "";
            const beforeCursor = line.slice(0, cursorCol);
            const match = beforeCursor.match(/(?:^|[ \\t])@([a-zA-Z]*)$/);

            const macros = [
              { value: "@diff", label: "@diff", description: "当前未提交的 Git 改动代码 (Working Tree Diff)" },
              { value: "@staged", label: "@staged", description: "当前 Git 暂存区改动 (git diff --staged)" },
              { value: "@recent", label: "@recent", description: "最近修改过的相关项目文件列表" },
              { value: "@git", label: "@git", description: "当前 Git 分支状态与最新提交记录" },
            ];

            if (!match) {
              return current.getSuggestions(lines, cursorLine, cursorCol, options);
            }

            const query = (match[1] || "").toLowerCase();
            const filtered = macros.filter((m) => m.value.slice(1).startsWith(query));

            const baseResult = await current.getSuggestions(lines, cursorLine, cursorCol, options);
            const baseItems = (baseResult && baseResult.items) || [];

            if (filtered.length > 0) {
              return {
                items: [...filtered, ...baseItems],
                prefix: \`@\${query}\`,
              };
            }

            return baseResult;
          },
          applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
            return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
          },
          shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
            return current.shouldTriggerFileCompletion ? current.shouldTriggerFileCompletion(lines, cursorLine, cursorCol) : true;
          },
        }));
      }
    } catch {}
  });

  pi.on("model_select", async (_event, ctx) => {
    updateStatus(ctx);
  });

  pi.on("turn_start", async (event, ctx) => {
    turnCount = event.turnIndex || turnCount + 1;
    currentTurnBackups = new Map();

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
    if (currentTurnBackups.size > 0) {
      undoStack.push({
        turnIndex: turnCount,
        timestamp: Date.now(),
        files: new Map(currentTurnBackups),
      });

      if (undoStack.length > 10) {
        undoStack.shift();
      }
    }
    currentTurnBackups = new Map();
    updateStatus(ctx);
  });

  // 2. Magic Context Macro Expansion (@diff, @recent, @git, @staged)
  pi.on("input", async (event, ctx) => {
    if (event.source === "extension") return { action: "continue" };

    let text = event.text || "";
    let modified = false;

    if (
      text.includes("@diff") ||
      text.includes("@staged") ||
      text.includes("@git") ||
      text.includes("@recent")
    ) {
      if (text.includes("@diff")) {
        const diffBlock = await getGitDiff(pi);
        text = text.replaceAll("@diff", diffBlock);
        modified = true;
      }

      if (text.includes("@staged")) {
        const stagedBlock = await getGitStagedDiff(pi);
        text = text.replaceAll("@staged", stagedBlock);
        modified = true;
      }

      if (text.includes("@git")) {
        const gitBlock = await getGitSummary(pi);
        text = text.replaceAll("@git", gitBlock);
        modified = true;
      }

      if (text.includes("@recent")) {
        const recentBlock = await getRecentFiles(pi);
        text = text.replaceAll("@recent", recentBlock);
        modified = true;
      }

      if (modified) {
        ctx.ui && ctx.ui.notify("已成功解析并展开上下文宏 (@diff / @recent / @git)", "info");
        return { action: "transform", text };
      }
    }
  });

  // 3. Intercept Tool Calls: File Pre-Snapshot for Undo
  pi.on("tool_call", async (event) => {
    if (event.toolName === "edit" || event.toolName === "write") {
      const rawPath = event.input && event.input.path;
      if (typeof rawPath === "string" && rawPath.trim()) {
        const absPath = path.resolve(process.cwd(), rawPath.trim());

        if (!currentTurnBackups.has(absPath)) {
          const relPath = path.relative(process.cwd(), absPath);
          try {
            if (fs.existsSync(absPath)) {
              const content = fs.readFileSync(absPath, "utf-8");
              currentTurnBackups.set(absPath, {
                path: absPath,
                relativePath: relPath,
                existed: true,
                content,
              });
            } else {
              currentTurnBackups.set(absPath, {
                path: absPath,
                relativePath: relPath,
                existed: false,
              });
            }
          } catch {}
        }
      }
    }
  });

  // 4. Chinese Engineering System Prompt Injection
  pi.on("before_agent_start", async (event, ctx) => {
    if (!chinesePromptEnabled) return;
    const model = ctx.model;
    const isMonk = model && model.provider === "monk";
    if (!isMonk) return;

    const currentPrompt = event.systemPrompt || "";
    if (!currentPrompt.includes("中文工程交互规范")) {
      return {
        systemPrompt: \`\${currentPrompt}\\n\\n\${CHINESE_ENGINEERING_PROMPT.trim()}\`,
      };
    }
  });

  // 5. Intelligent Context Overflow & Compaction Recovery
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

  // 6. Custom Slash Command: /undo (一键撤销)
  pi.registerCommand("undo", {
    description: "一键撤销上一次 AI 对文件的所有修改 (/undo)",
    handler: async (_args, ctx) => {
      await handleUndoCommand(ctx, undoStack, () => updateStatus(ctx));
    },
  });

  pi.registerCommand("回退", {
    description: "一键撤销上一次 AI 对文件的所有修改 (/回退)",
    handler: async (_args, ctx) => {
      await handleUndoCommand(ctx, undoStack, () => updateStatus(ctx));
    },
  });

  // 7. Custom Slash Command: /commit (自动中文语义化提交)
  pi.registerCommand("commit", {
    description: "检查 Git 改动并生成语义化中文 Commit 提交 (/commit [附加说明])",
    handler: async (args, ctx) => {
      await handleCommitCommand(pi, ctx, args);
    },
  });

  // 8. Custom Slash Command: /review (深度中文代码审查)
  pi.registerCommand("review", {
    description: "对当前 Git 改动或指定文件进行专业中文代码审查 (/review [路径/分支])",
    handler: async (args, ctx) => {
      await handleReviewCommand(pi, ctx, args);
    },
  });

  // 9. Custom Slash Command: /monk
  pi.registerCommand("monk", {
    description: "Monk 专属控制台 (/monk [model|undo|commit|review|prompt|ping|status|account])",
    handler: async (args, ctx) => {
      const sub = (args || "").trim().toLowerCase();

      if (sub === "undo" || sub === "rollback") {
        await handleUndoCommand(ctx, undoStack, () => updateStatus(ctx));
        return;
      }

      if (sub === "model" || sub === "switch") {
        await handleModelSwitch(pi, ctx);
        return;
      }

      if (sub === "commit" || sub === "ci") {
        await handleCommitCommand(pi, ctx, "");
        return;
      }

      if (sub === "review" || sub === "cr") {
        await handleReviewCommand(pi, ctx, "");
        return;
      }

      if (sub === "prompt" || sub === "cn") {
        chinesePromptEnabled = !chinesePromptEnabled;
        const state = chinesePromptEnabled ? "已启用 (精炼干练)" : "已关闭 (恢复原生默认)";
        ctx.ui && ctx.ui.notify(\`Monk 中文工程系统提示词: \${state}\`, "info");
        updateStatus(ctx);
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
      await handleMenu(
        pi,
        ctx,
        undoStack,
        () => {
          chinesePromptEnabled = !chinesePromptEnabled;
          updateStatus(ctx);
          return chinesePromptEnabled;
        },
        () => updateStatus(ctx)
      );
    },
  });
}

// ============================================================================
// Context Macro Resolvers (@diff, @staged, @git, @recent)
// ============================================================================

async function getGitDiff(pi) {
  const check = await pi.exec("git", ["rev-parse", "--is-inside-work-tree"]);
  if (check.code !== 0) return "[当前目录非 Git 仓库，无法获取 @diff]";

  const res = await pi.exec("git", ["diff"]);
  const stagedRes = await pi.exec("git", ["diff", "--staged"]);
  const combined = [res.stdout && res.stdout.trim(), stagedRes.stdout && stagedRes.stdout.trim()]
    .filter(Boolean)
    .join("\\n\\n");

  if (!combined) return "[当前 Git 工作区干净，暂无未提交的代码改动]";

  const lines = combined.split("\\n");
  if (lines.length > 500) {
    const truncated = lines.slice(0, 500).join("\\n");
    return \`\\n\`\`\`diff\\n# [Git Diff 变更代码 - 共 \${lines.length} 行，展示前 500 行]\\n\${truncated}\\n\`\`\`\\n\`;
  }

  return \`\\n\`\`\`diff\\n# [Git Diff 变更代码 - 共 \${lines.length} 行]\\n\${combined}\\n\`\`\`\\n\`;
}

async function getGitStagedDiff(pi) {
  const check = await pi.exec("git", ["rev-parse", "--is-inside-work-tree"]);
  if (check.code !== 0) return "[当前目录非 Git 仓库，无法获取 @staged]";

  const res = await pi.exec("git", ["diff", "--staged"]);
  const diff = res.stdout && res.stdout.trim();
  if (!diff) return "[当前 Git 暂存区暂无改动 (Staged is empty)]";

  return \`\\n\`\`\`diff\\n# [Git 暂存区代码变动 (Staged Diff)]\\n\${diff}\\n\`\`\`\\n\`;
}

async function getGitSummary(pi) {
  const check = await pi.exec("git", ["rev-parse", "--is-inside-work-tree"]);
  if (check.code !== 0) return "[当前目录非 Git 仓库，无法获取 @git]";

  const branchRes = await pi.exec("git", ["branch", "--show-current"]);
  const statusRes = await pi.exec("git", ["status", "-s"]);
  const logRes = await pi.exec("git", ["log", "-n", "3", "--oneline"]);

  const branch = (branchRes.stdout && branchRes.stdout.trim()) || "HEAD";
  const status = (statusRes.stdout && statusRes.stdout.trim()) || "(工作区干净)";
  const log = (logRes.stdout && logRes.stdout.trim()) || "(暂无提交记录)";

  return \`\\n\`\`\`\\n# [Git 当前分支与状态信息]\\n分支: \${branch}\\n状态变动:\\n\${status}\\n\\n最近 3 条提交:\\n\${log}\\n\`\`\`\\n\`;
}

async function getRecentFiles(pi) {
  const check = await pi.exec("git", ["rev-parse", "--is-inside-work-tree"]);
  if (check.code === 0) {
    const statusRes = await pi.exec("git", ["status", "--porcelain"]);
    const logRes = await pi.exec("git", ["log", "-n", "5", "--name-only", "--format="]);
    const fileSet = new Set();

    if (statusRes.stdout) {
      statusRes.stdout.split("\\n").forEach((line) => {
        const p = line.slice(3).trim();
        if (p) fileSet.add(p);
      });
    }

    if (logRes.stdout) {
      logRes.stdout.split("\\n").forEach((line) => {
        const p = line.trim();
        if (p) fileSet.add(p);
      });
    }

    const files = Array.from(fileSet).slice(0, 15);
    if (files.length > 0) {
      return \`\\n# [最近变动关联的项目源文件列表]\\n\${files.map((f) => \`- \${f}\`).join("\\n")}\\n\`;
    }
  }

  return "[暂未找到最近变动的关联文件]";
}

// ============================================================================
// Undo, Commit, Review & Control Handlers
// ============================================================================

async function handleUndoCommand(ctx, undoStack, refreshStatus) {
  if (undoStack.length === 0) {
    ctx.ui && ctx.ui.notify("当前没有可撤销的 AI 改动记录 (暂无检查点)", "info");
    return;
  }

  const checkpoint = undoStack[undoStack.length - 1];
  const fileBackups = Array.from(checkpoint.files.values());

  if (fileBackups.length === 0) {
    undoStack.pop();
    ctx.ui && ctx.ui.notify(\`上一个轮次 (Turn \${checkpoint.turnIndex}) 未产生文件改动\`, "info");
    refreshStatus();
    return;
  }

  const fileSummaries = fileBackups.map((f) => {
    return f.existed ? \`  ↺ 恢复原状: \${f.relativePath}\` : \`  🗑 删除新建: \${f.relativePath}\`;
  });

  const promptText = \`确认撤销第 \${checkpoint.turnIndex} 轮的 AI 文件改动？\\n\${fileSummaries.join("\\n")}\`;
  const choice = await (ctx.ui && ctx.ui.select(promptText, [
    \`确认撤销 (\${fileBackups.length} 个文件)\`,
    "取消",
  ]));

  if (!choice || choice.includes("取消")) {
    ctx.ui && ctx.ui.notify("已取消撤销操作", "info");
    return;
  }

  undoStack.pop();
  let restoredCount = 0;
  let deletedCount = 0;
  const errors = [];

  for (const file of fileBackups) {
    try {
      if (!file.existed) {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
          deletedCount++;
        }
      } else if (file.content !== undefined) {
        fs.writeFileSync(file.path, file.content, "utf-8");
        restoredCount++;
      }
    } catch (err) {
      errors.push(\`\${file.relativePath}: \${err instanceof Error ? err.message : String(err)}\`);
    }
  }

  refreshStatus();

  if (errors.length > 0) {
    ctx.ui && ctx.ui.notify(\`撤销部分完成，但存在错误: \${errors.join("; ")}\`, "warning");
  } else {
    ctx.ui && ctx.ui.notify(
      \`已成功撤销改动！共恢复 \${restoredCount} 个文件，清理 \${deletedCount} 个新建文件\`,
      "success"
    );
  }
}

async function handleCommitCommand(pi, ctx, extraArgs) {
  const gitCheck = await pi.exec("git", ["rev-parse", "--is-inside-work-tree"]);
  if (gitCheck.code !== 0) {
    ctx.ui && ctx.ui.notify("当前目录不是 Git 仓库，无法执行 /commit", "warning");
    return;
  }

  const statusCheck = await pi.exec("git", ["status", "--porcelain"]);
  if (!statusCheck.stdout || !statusCheck.stdout.trim()) {
    ctx.ui && ctx.ui.notify("Git 工作区干净，没有待提交的改动 (Working tree clean)", "info");
    return;
  }

  ctx.ui && ctx.ui.notify("正在分析 Git 改动并准备中文语义化提交...", "info");

  const prompt = [
    "请检查当前的 Git 改动，并按照 Conventional Commits 规范生成地道的中文语义化提交信息并完成提交：",
    "1. 先调用 bash 查看当前变更状态 (\`git status -s\`) 与代码改动 (\`git diff --stat\` 和 \`git diff\`)。",
    "2. 根据变更内容确定规范的提交信息：",
    "   格式：<type>(<scope>): <简明清晰的中文提交主题>",
    "   常见类型：feat(新特性)、fix(修复)、docs(文档)、refactor(重构)、perf(性能)、test(测试)、chore(杂项)。",
    "3. 直接调用 bash 执行 \`git add -A\` 并使用 \`git commit -m \\"...\\"\` 执行提交。",
    "4. 提交完成后，用两句话简要汇报 commit hash 与提交信息。",
    extraArgs ? \`\\n附加要求：\${extraArgs}\` : "",
  ].join("\\n");

  pi.sendUserMessage(prompt);
}

async function handleReviewCommand(pi, ctx, targetPath) {
  const target = (targetPath || "").trim();

  if (target) {
    ctx.ui && ctx.ui.notify(\`正在针对指定目标发起深度代码审查: \${target} ...\`, "info");
    const prompt = [
      \`请对指定目标进行专业、深入的代码审查 (Code Review)：\${target}\`,
      "1. 调用 read 工具阅读相关源代码及项目上下文。",
      "2. 从以下四个关键维度输出结构化中文审查报告：",
      "   - 🚨【潜在缺陷与边界异常】：空指针/未定义、并发竞争、未捕获异常、边界越界等隐患。",
      "   - ⚡【性能与资源消耗】：无意义循环、内存泄漏、过多重绘、昂贵计算或连接未释放。",
      "   - 🏗【设计与可维护性】：单一职责原则、模块解耦、代码复用、命名规范与可读性。",
      "   - 💡【具体改进建议】：指出具体有问题的代码位置，并给出优化后的参考实现片段。",
      "3. 语言保持客观专业，突出高价值修改意见。",
    ].join("\\n");

    pi.sendUserMessage(prompt);
    return;
  }

  const gitCheck = await pi.exec("git", ["rev-parse", "--is-inside-work-tree"]);
  if (gitCheck.code !== 0) {
    ctx.ui && ctx.ui.notify("当前目录不是 Git 仓库，请指定具体文件路径审查，例如: /review src/index.ts", "warning");
    return;
  }

  const statusCheck = await pi.exec("git", ["status", "--porcelain"]);
  if (!statusCheck.stdout || !statusCheck.stdout.trim()) {
    ctx.ui && ctx.ui.notify("当前 Git 工作区无未提交改动。可指定特定文件审查，例如: /review src/index.ts", "info");
    return;
  }

  ctx.ui && ctx.ui.notify("正在针对当前未提交的 Git 改动发起深度代码审查...", "info");

  const prompt = [
    "请对当前工作区的所有未提交改动 (Uncommitted Changes) 进行专业、深入的中文代码审查 (Code Review)：",
    "1. 调用 bash 执行 \`git diff\` 及 \`git diff --staged\` 获取完整改动代码。",
    "2. 从以下四个关键维度进行分析并输出结构清晰的 Markdown 审查报告：",
    "   - 🚨【潜在缺陷与边界异常】：空指针/未定义、逻辑死角、未处理的错误、边界异常。",
    "   - ⚡【性能与资源消耗】：不必要的循环、重复渲染、未清理的副作用、高耗时操作。",
    "   - 🏗【设计与架构质量】：代码解耦、单一职责、命名契合度与可读性。",
    "   - 💡【关键重构建议与片段】：给出具体的修改方案与推荐的代码重构写法。",
    "3. 如果改动整体质量优秀，请明确指出亮点并予以肯定。",
  ].join("\\n");

  pi.sendUserMessage(prompt);
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

async function handleMenu(pi, ctx, undoStack, toggleCnPrompt, refreshStatus) {
  if (!ctx.ui) return;

  const undoText =
    undoStack.length > 0
      ? \`2. 一键撤销上次改动 (/undo · \${undoStack.length} 个可回退)\`
      : "2. 一键撤销上次改动 (/undo · 暂无)";

  const choice = await ctx.ui.select("Monk API 控制台", [
    "1. 切换会话模型 (Switch Model)",
    undoText,
    "3. 语义化 Git 提交 (/commit)",
    "4. 深度代码审查 (/review)",
    "5. 切换中文工程提示词开关 (Toggle Chinese Prompt)",
    "6. 探测网络延迟 (Ping API)",
    "7. 查询用量与到期时间 (Account Info)",
  ]);

  if (!choice) return;

  if (choice.startsWith("1")) {
    await handleModelSwitch(pi, ctx);
  } else if (choice.startsWith("2")) {
    await handleUndoCommand(ctx, undoStack, refreshStatus);
  } else if (choice.startsWith("3")) {
    await handleCommitCommand(pi, ctx, "");
  } else if (choice.startsWith("4")) {
    await handleReviewCommand(pi, ctx, "");
  } else if (choice.startsWith("5")) {
    const nowEnabled = toggleCnPrompt();
    const state = nowEnabled ? "已启用 (零废话·行动优先)" : "已关闭 (恢复原生)";
    ctx.ui.notify(\`中文工程系统提示词: \${state}\`, "info");
  } else if (choice.startsWith("6")) {
    await handlePing(ctx);
  } else if (choice.startsWith("7")) {
    ctx.ui.notify("请在浏览器打开 https://monk.party/account/ 查看用量与剩余天数", "info");
  }
}
`;
