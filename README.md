# Monk × Pi Harness (`monk-pi`)

> **开箱即用 · 零配置 · 极速高性价比终端 Coding Agent**  
> 将 [Monk](https://monk.party/) 的 OpenAI 兼容融合模型（月卡 ¥30 / 1M 上下文 / Agent 原生适配）与 [Pi](https://github.com/earendil-works/pi) 的极速灵活终端 Agent 架构深度结合。

---

## 💡 为什么需要 Monk-Pi？

- **极低门槛**：官方 Claude 3.7 / Opus / GPT-4o 价格高昂且易受网络限制。Monk 融合顶尖 Flash 模型，提供 100 万 Token 上下文与 Agent 原生工具调用能力。
- **零配置接入**：彻底告别繁琐的手写 `models.json` 和 `compat` 参数配置。首次启动自动完成密钥检验与环境注入。
- **专为编码调优**：预置代码主力模型（`monk-coding`）、极速推理模型（`monk-fast`）与融合旗舰（`monk`），并自动应用最佳 `max_tokens` 与角色兼容补丁。
- **完全兼容原生 Pi**：保留 Pi 原生的所有命令行参数、会话管理、TUI 快捷键和插件生态。

---

## 🚀 快速开始

### 1. 快速安装与运行

#### 方式 A：纯免安装直接运行 (推荐)
无需全局安装任何环境，直接通过 `npx` 启动：
```bash
npx monk-pi
```

#### 方式 B：使用 Homebrew 安装 (macOS / Linux 首选)
Homebrew 会**自动帮你处理并安装 Node.js 依赖**（完全无需担心电脑缺少环境）：
```bash
brew install yaoleifly/tap/monk-pi
```

#### 方式 C：通过 npm / pnpm / bun 全局安装
```bash
npm install -g monk-pi
# 或者使用 bun (最快)
bun add -g monk-pi
```

安装完成后，在任意项目目录下直接输入：
```bash
monk-pi
```

首次运行会自动弹出智能向导：
- **已有 Key**：直接粘贴即可瞬间完成校验并保存。
- **尚未订阅**：支持**一键回车自动唤起浏览器**打开 [monk.party](https://monk.party) 订阅月卡，网页生成 Key 后直接无缝切回终端粘贴！
- 随后即刻进入极速编码交互终端。

---

## 🛠️ 常用使用场景

### 1. 日常交互式编程

```bash
# 直接进入交互式编码 Agent (默认使用 monk-coding)
monk-pi

# 带着初始任务进入
monk-pi "重构当前目录下的鉴权模块，补充单元测试"

# 恢复上一轮历史会话
monk-pi --continue (或 monk-pi continue)

# 可视化浏览并挑选以往历史任务恢复
monk-pi -r (或 monk-pi resume)
```

### 2. 命令行单次执行 (Print Mode)

```bash
# 检查依赖并直接输出结果后退出
monk-pi -p "解释当前 package.json 的依赖版本"

# 审查 Git 改动
monk-pi -p "检查 git diff，给出简洁的 commit message"
```

### 3. 指定临时模型

```bash
# 使用极速模型进行轻量提问
monk-pi --model monk-fast "这行正则是什么意思？"

# 使用综合质量优先模型
monk-pi --model monk "帮我设计一套分布式系统的架构方案"
```

---

## 🧰 专属管理命令

### 终端 CLI 指令
| 命令 | 说明 |
| :--- | :--- |
| `monk-pi run <命令>` | **监控运行命令**，报错时自动捕获日志并提示一键呼叫 AI 代码自愈 (Auto-Fix) |
| `monk-pi resume` (或 `-r`) | 可视化交互式浏览历史会话列表，带相对时间和摘要快速恢复 (断点续写) |
| `monk-pi login` (或 `auth`) | 交互式配置或更新 Monk API Key，并自动同步至 Pi |
| `monk-pi status` (或 `check`) | 检测 API 网络延迟、认证有效性及推演通道 |
| `monk-pi model [name]` | 查看或切换默认主力模型 (`monk-coding` / `monk-fast` / `monk`) |
| `monk-pi doctor` | 一键诊断 Node、Pi 运行时、配置文件健康度与网络状况 |

### TUI 内部 Slash 指令
在交互式编码过程中，随时输入对应指令即可呼出 Monk 专属能力：
- **/undo** (或 **/回退**)：一键撤销上一次 AI 对文件的所有修改，恢复修改文件并自动删除新建文件（安全感拉满！）
- **/commit** [说明]：自动检查 Git 暂存与改动，按 Conventional Commits 规范生成地道中文 Commit 并自动提交
- **/review** [路径]：对当前 Git 改动或指定源代码文件进行四维度（缺陷/性能/架构/重构片段）专业中文代码审查
- **/tips**：查看 Monk-Pi 精选实用极客技巧清单，随时查阅进阶用法
- **/monk**：呼出图形化快捷控制菜单（包含撤销改动、切模型、测速、用量查询等）
- **/monk model**：在当前会话中秒级免重启切换主力模型 (`monk-coding` / `monk-fast` / `monk`)
- **/monk cn** (或 `/monk prompt`)：一键开启/关闭中文工程精炼系统提示词（零客套·行动优先）
- **/monk ping**：实时测试当前 Monk API 连接与端到端延迟
- **/monk account**：查询用量与账号到期状态

---

## 🛠️ 命令报错一键自愈 (Auto-Fix on Error)

日常开发中最繁琐的痛点就是“编译挂了 / 跑测试挂了，得复制报错去问 AI”。Monk-Pi 提供了零摩擦的包装运行命令：

```bash
# 监控任何本地命令运行
monk-pi run "npm run build"
monk-pi run "npm test"
monk-pi run "cargo check"
monk-pi run "go test ./..."
```

- **命令成功 (exit 0)**：正常透传输出并退出，零额外打扰。
- **命令报错 (exit != 0)**：自动捕获 stderr 与异常堆栈，在终端无缝弹出自愈向导：
  ```text
  ✖ 命令执行失败 (退出码: 1 · 耗时 2.4s)

  ? 检测到命令报错，请选择 Monk 介入处理方式:
  ❯ 1. 呼叫 Monk 分析报错并自动修复代码 (一键自愈 Auto-Fix · 推荐)
    2. 进入交互式终端协助排查 (带入报错日志)
    3. 忽略并直接退出终端
  ```
- **选第 1 项**：AI 自动读取报错涉及的源码文件、分析根因、自动精准编辑修复，并**重新在后台跑一遍命令验证**，整个过程无需复制粘贴一个字符！

---

告别面对空白输入框与闪烁光标“不知道该问什么”的迷茫感：
- **项目画像智能感知**：首次启动或新会话打开时，自动识别当前技术栈（如 `Vue 3 技术栈`、`Next.js 全栈`、`Go 后端应用` 等）及 Git 状态。
- **推荐指令导流**：自动在输入框上方挂载轻量导航气泡，提醒最相关的指令建议（如 `@diff`、`/commit`、`/undo`）。
- **极客小技巧轮播**：每次启动轮播展示一条高价值技巧，帮助开发者自然掌握进阶工作流。
- **优雅自退**：用户一旦开始输入或发出第一条指令，首屏导航气泡便会**优雅自动退场**，还你 100% 纯净的对话空间！

---

---

## 🔮 上下文魔术引用 (@diff, @recent, @git, @staged)

为了彻底消灭繁琐的“切屏敲命令、复制代码、再切回粘贴”操作，Monk-Pi 提供了原生自动补全与即时展开的**上下文魔术宏**：

| 上下文宏 | 自动提取内容 | 推荐场景 |
| :--- | :--- | :--- |
| **`@diff`** | 自动提取当前 Git 工作区与暂存区的所有未提交改动 | `"帮我检查 @diff 看看有没有潜在 bug"` |
| **`@staged`** | 自动提取当前 Git 暂存区改动 (`git diff --staged`) | `"针对 @staged 写一份规范的提交说明"` |
| **`@recent`** | 自动提取最近修改过的项目源文件列表 | `"基于 @recent 里的模块梳理更新日志"` |
| **`@git`** | 自动提取当前 Git 分支、变动状态与最近 3 条提交记录 | `"根据 @git 看看接下来该合哪个分支"` |

> 💡 **自动补全支持**：在输入框中只要敲 `@`，就会自动弹出浮动建议，支持方向键选择或继续输入过滤。提交给 AI 时会自动原地无缝展开并投喂给 Monk 模型！

---

## 🛡️ 智能文件快照与 /undo 一键回退 (Safety First)

AI 改代码最怕“改崩了”、“改乱了却记不得改了哪几个文件”。Monk-Pi 引入了**轮次级文件快照守护机制**：
- **无感快照**：每当 AI 准备调用 `edit` 或 `write` 修改或新建文件时，自动在内存栈留存该文件在当轮改动前的原始状态（即使项目未初始化 Git 仓库也能完美运行）。
- **改动后情境式提示**：AI 只要在当轮实质修改或新建了文件，轮次结束时会自动在屏幕弹出贴心提示：
  `ℹ 已修改 src/auth.ts · 如需撤销可随时输入 /undo 一键还原`
  让新手用户第一次使用就拥有满满的安全感！
- **一键回退**：输入 `/undo` 时，AI 自动展示本轮受影响的文件列表，确认后**秒级恢复修改文件、清理新建垃圾文件**。
- **状态可视化**：底部状态栏会动态呈现 `[可撤销: n]` 徽章，让开发者拥有 100% 的掌控感与安全感。

---

---

## 🇨🇳 中文工程交互规范与提示词强化

为了彻底消除海外 AI 工具常见的“中英混杂”、“翻译腔”以及冗长的客套废话，Monk-Pi 默认注入了专为中国程序员研发的**中文工程人设规范**：
- **零客套废话**：严禁“好的”、“没问题”、“收到”、“接下来我将为您……”等填充词，直奔主题。
- **行动优先 (Action First)**：遇到需要查阅、修改或测试的任务，直接调起 `read/edit/write/bash` 工具，不在调用前长篇大论。
- **术语规范**：变量、函数、参数、Git 命令与标准名词保留英文，逻辑分析与注释采用干练自然中文。
- **随时可控**：会话中随时输入 `/monk cn` 即可一键开启或还原。

---

## 🎨 原生 TUI 状态栏与上下文溢出自动恢复

Monk-Pi 自动为 Pi 部署原生扩展 (`~/.pi/agent/extensions/monk.ts`)：
1. **底部状态栏 (Footer Status)**：实时显示当前激活的 Monk 模型、1M 上下文标识以及 Turn 轮次状态。
2. **上下文溢出自动恢复 (Compaction Recovery)**：在超长代码重构会话中，智能拦截 Monk 上游的 Token/Context 溢出异常，自动标准化为 Pi 识别的溢出信号，**无感触发智能压缩与自动重试**，杜绝会话意外中断。

---

## ⚙️ 自动注入的 Pi 最佳配置

`monk-pi` 会在 `~/.pi/agent/models.json` 中安全注入以下经深度调优的配置，不会覆盖您原有的其他自定义 Provider：

```json
{
  "providers": {
    "monk": {
      "name": "Monk",
      "baseUrl": "https://monk.party/v1",
      "api": "openai-completions",
      "apiKey": "$MONK_API_KEY",
      "compat": {
        "supportsDeveloperRole": false,
        "maxTokensField": "max_tokens",
        "requiresToolResultName": true
      },
      "models": [
        {
          "id": "monk-coding",
          "name": "Monk Coding (代码主力 - 推荐)",
          "reasoning": true,
          "contextWindow": 1000000,
          "maxTokens": 64000
        },
        {
          "id": "monk-fast",
          "name": "Monk Fast (极速推理)",
          "reasoning": true,
          "contextWindow": 1000000,
          "maxTokens": 64000
        },
        {
          "id": "monk",
          "name": "Monk (融合模型)",
          "reasoning": true,
          "contextWindow": 1000000,
          "maxTokens": 64000
        }
      ]
    }
  }
}
```

---

## 🗺️ 后续迭代规划 (Roadmap)

- [x] **Phase 1: 轻量脚手架与启动器**
  - [x] 交互式 Key 引导与实时有效性校验
  - [x] Pi 运行时环境检测与自动注入
  - [x] `status` / `doctor` / `model` 诊断指令
  - [x] 完整参数透传与 TTY 会话继承
- [x] **Phase 2: Monk 原生 Pi Extension**
  - [x] TUI 底部状态栏展示 Monk 状态与活跃模型
  - [x] 针对 Monk 代理的上游报错拦截与自动 Context Compaction 重试机制
  - [x] `/monk` 专属 Slash 快捷指令（秒切模型、测速与用量查询）
- [ ] **Phase 3: 生态共建**
  - [ ] 提交收录至 monk.party 帮助中心客户端推荐列表

---

## 📄 开源许可

MIT License
