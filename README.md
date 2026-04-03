# Superharness

Superharness 是**注入到 AI 工具中的工作流程序**。它让你选择的 AI 工具（Claude Code、Codex、Qoder、Cursor、Gemini CLI）按照经过验证的软件工程纪律工作：需求澄清 → 任务拆解 → TDD 实现 → 双阶段审查 → QA 验收，全程自动化。

## 它解决什么问题

AI 编码工具很强大，但没有约束的强大是危险的：跳过测试、偏离需求、写出能跑但不可维护的代码、"完成"了但没人验证过。

Superharness 把开发纪律变成机械强制的工作流，而不是靠 AI 自觉遵守的建议。

## 工作流程

```
/superharness "做一个旅行规划 app"

  1. 头脑风暴 ── 逐个问题澄清需求，提出 2-3 种方案，用户确认设计
  2. 任务拆解 ── 生成 bite-sized 任务（每个 2-5 分钟），完整代码，精确路径
  3. 隔离开发 ── 自动创建 git worktree，在独立分支上工作
  4. TDD 实现 ── 每个任务：写失败测试 → 写实现 → 测试通过 → 提交
  5. 双阶段审查 ── spec 合规审查 → 代码质量审查，不通过不往下走
  6. QA 验收 ── 调用外部 QA 服务（可选），发现问题自动修复
  7. 合并完成 ── 验证通过后合并 worktree，输出总结
```

整个过程由 AI 工具自主执行，你只需要在头脑风暴阶段参与决策。

## 快速开始

```bash
# 1. 安装
npm install -g superharness

# 2. 在项目中初始化
superharness init --platforms claude-code --template frontend

# 3. 在 AI 工具中使用
/superharness "你的需求描述"
```

`--template` 可选值：`frontend`、`backend`、`ai-agent`、`fullstack`、`blank`

`--platforms` 可选值：`claude-code`、`codex`、`qoder`、`cursor`、`gemini`

## 三条铁律

Superharness 的核心是三条不可协商的规则。每条都预设了"合理化借口"的反驳，防止 AI 工具自我说服绕过规则。

| 铁律 | 规则 | 典型借口 / 反驳 |
|------|------|----------------|
| TDD | 没有失败测试就不写实现代码 | "太简单不用测试" / 简单代码也会坏，测试只要 30 秒 |
| 验证 | 没有新鲜验证证据就不声明完成 | "应该能过" / "应该"不是证据，运行命令 |
| 调试 | 没有根因调查就不尝试修复 | "先试着改改看" / 盲改只会浪费时间 |

## 项目结构

```
.superharness/                    # superharness init 在用户项目中创建
├── config.yaml                   # 项目配置（平台、QA 服务、可观测性）
├── workflow.md                   # 工作流规则（注入到每次 AI 会话）
├── worktree.yaml                 # Worktree 配置（目录、verify 命令）
├── spec/                         # 项目规范（hook 自动注入到 AI 会话）
│   ├── guides/index.md           # 通用指南
│   └── {module}/index.md         # 模块级 Pre-Dev Checklist + Quality Check
├── tasks/                        # 任务管理
│   ├── .current-task              # 当前活跃任务指针
│   └── {MM}-{DD}-{name}/         # 单个任务
│       ├── task.json              # 任务状态（status, phase, sprint 进度）
│       ├── prd.md                 # 需求文档
│       ├── plan.md                # 实现计划
│       ├── contract.md            # Sprint Contract / Done Definition
│       ├── trace.jsonl            # 过程日志（可观测性）
│       ├── qa-report.md           # QA 报告
│       └── qa-issues.json         # QA issues（供 /superharness:fix 消费）
└── workspace/                    # 会话日志（per-developer，自动轮转）
```

## Skill 一览

### 工作流

| Skill | 用途 |
|-------|------|
| `superharness` | 主入口：端到端工作流编排（含中断恢复） |
| `brainstorm` | 需求澄清：逐个问题、2-3 种方案、用户确认设计 |
| `writing-plans` | 任务拆解：bite-sized 任务、完整代码、精确路径 |
| `subagent-driven-development` | 执行计划：每任务新鲜 subagent + 双阶段审查 |
| `using-git-worktrees` | 隔离开发环境 |
| `finishing-a-development-branch` | 完成工作：merge/PR/keep/discard + trace 摘要 |

### 铁律（刚性 Skill，严格遵守）

| Skill | 用途 |
|-------|------|
| `test-driven-development` | TDD：RED-GREEN-REFACTOR 循环 |
| `verification-before-completion` | 完成前验证：无证据不声明完成 |
| `systematic-debugging` | 系统调试：根因优先 |

### QA

| Skill | 用途 |
|-------|------|
| `qa` | 调用外部 QA 服务（CLI 包装器） |
| `fix` | 读取 qa-issues.json，按 TDD 修复 |

### 辅助

| Skill | 用途 |
|-------|------|
| `using-superharness` | 会话启动指引（hook 注入） |

## CLI 命令

```bash
superharness init       # 初始化项目 + 注册到 AI 平台
superharness sync       # spec 变更后同步到各平台
superharness spec add   # 追加规范模板（monorepo）
superharness task list  # 查看任务进度
superharness qa         # 调用外部 QA 服务
superharness status     # 当前状态
superharness journal    # 会话日志管理
superharness trace      # 查看执行路径摘要 / 对比差异
```

## 多平台支持

一套 skill 文件（SKILL.md + YAML frontmatter），所有平台都能消费。平台差异只体现在注册方式上。

| 平台 | 注册方式 | Hook 支持 | 工作流完整度 |
|------|---------|----------|------------|
| Claude Code | symlink 到 ~/.claude/plugins/ | SessionStart + PreToolUse + SubagentStop | 100% |
| Cursor | 待验证 | hooks-cursor.json | 100% |
| Codex | symlink 到 ~/.agents/skills/ | 有限 | 85-90% |
| Qoder | 复制到 .qoder/skills/ | 待确认 | 85-90% |
| Gemini CLI | 合并到 GEMINI.md | 无 | 85-90% |

无 hook 平台的降级策略：核心工作流（TDD、brainstorm、subagent 驱动开发）100% 等价，hook 增强能力（spec 自动注入、Ralph Loop 强制阻止）靠 skill 措辞降级覆盖。

## 外部 QA 服务

Superharness 本身不调用任何大模型。QA 层完全由外部服务提供，superharness 只负责触发、收集结果、驱动修复闭环。

```yaml
# .superharness/config.yaml
qa:
  services:
    - name: ai-agent-qa
      type: managed           # 托管模式：POST /evaluate
      endpoint: http://localhost:8080
    - name: frontend-e2e
      type: autonomous        # 自治模式：执行命令 + 读结果文件
      command: npm run qa:e2e
      output: .superharness/tasks/{task}/qa-results-e2e.json
```

防振荡机制：最大 3 轮修复 → 回归检测（severity 自动提升）→ 超限升级为人工介入。

## 可观测性

Superharness 在每个关键节点自动记录结构化日志到 `trace.jsonl`，用于事后分析工作流执行路径：

```bash
superharness trace --task .superharness/tasks/04-02-intent
# 输出执行路径摘要，标注与标准路径的偏差

superharness trace --diff task1 task2
# 对比两个 task 的路径差异，发现系统性问题
```

当最终产物有问题时，三步定位：读 trace-summary.md 找偏差 → 读 trace.jsonl 找上下文 → 对比多个 task 找系统性问题。

## 中断恢复

AI 工具 context 满了或 session 断开时，代码不会丢（git worktree），进度不会丢（task.json）。重新输入 `/superharness`，skill 自动检测未完成任务并汇报状态：

```
检测到未完成任务：todo-app
  Sprint 进度：2/5
  当前任务：implement-auth（TDD-GREEN 阶段）
  Worktree：.worktrees/todo-app-sprint2
  代码变更：3 个文件已修改

继续当前任务还是重新开始？
```

## 许可证

MIT License
