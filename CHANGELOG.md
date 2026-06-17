# Changelog

## 2026-06-17

### Changed

- **lite 终检改为模型自主判断，移除 stop-verify 强制门控** -- 删除 `stop-verify-lite` 钩子（连同 `SUPERHARNESS_VERIFY_MIN_LINES` 阈值、`.verify.json` 游标状态、`hooks.ts` 的 `stop-verify` marker）。是否补测试不再在 Stop 阶段强制阻断收尾，改为在 SessionStart 注入的 `using-superharness-lite` 引导里交给模型按本次改动复杂度自行决定；判断需要时写**正式的项目单测**（提交进仓库、长期沉淀），而非跑完即删的一次性脚本。`sh-test` 仍是全部开发完成后的终检（Spec + Code Review + 测试套件）。Stop 阶段只保留后台学习器 `stop-learn-lite`，三平台（claude-code / codex / qoder）与 aone-copilot 同步摘除该钩子。

## 2026-06-15 — 0.9.0

「Less is more」。随着模型能力增强，原来那套从头到尾的强制工作流对**存量项目维护**偏重。0.9.0 引入 **lite 模式**：用最小的套件接入存量项目，以自学习为核，去掉强制工作流。完整 greenfield 工作流保留为 `--full`，零改动、零回归。

### Added

- **Lite 模式（新默认）** -- `superharness init` 默认安装精简版：四个核心能力（clarify / discover / learn / test）+ 自学习，不再铺 `tasks/` / `workspace/` / `workflow.md` / spec 模板等重脚手架。`init --full` 仍装完整 greenfield 工作流。模式写入 `config.yaml` 的 `_meta.mode`，`update` 按模式分流刷新（lite 项目不会被混入 full 的 skill）。
- **自学习（横切核心）** -- 会话中积累的踩坑/修复/决策自动沉淀到 `.superharness/learnings/`（topic wiki，`INDEX.md` 注入后续会话）。`stop-learn` 钩子在会话累积足够新工作时**后台 spawn** 一个 `claude -p` / `codex exec` 学习器离线更新 wiki（游标节流，一个会话可多次触发，非一次性）；`session-start` 钩子注入 learnings 索引。
- **终检门控（verify-before-done）** -- `stop-verify` 钩子在「改了代码但没跑过」时阻断一次收尾，要求先跑改动+对抗性边界用例自测、只修真实失败、**不重构已通过的代码**。新建未跟踪代码文件无视行阈值一律门控；已跟踪文件的小改守 20 行阈值（`SUPERHARNESS_VERIFY_MIN_LINES` 可调）。重的 Spec + Code Review 双规范检查留给**显式** `/superharness:test` 技能，全部任务完成后跑一次。
- **discover retarget 到 spec 模型** -- 沿用 SuperSkills 的 discover 能力，但详细规范落到 SuperHarness 的 `.superharness/spec/` 树（非 `conventions.md`），`AGENTS.md` / `CLAUDE.md` 作每会话只加载的薄入口。spec（项目规范）与 learnings（学习沉淀）职责分清，唯一桥是「沉淀成稳定规范后晋升进 spec」。
- **三平台 lite 接线** -- claude-code（`.claude/skills/` 自动触发 + Stop/SessionStart 钩子）、aone-copilot（`.aone_copilot/`）、codex（`.codex/`，学习器走 `codex exec`）。lite 钩子为提交的 `.cjs`（强制 CommonJS，与项目 `type:module` 无关）。
- **HumanEval+ A/B 基准（北极星）** -- `tests/bench/heval-lite.sh` 复用社区 HumanEval+ 数据集与评分，A/B 对比裸模型 vs lite 安装。`tests/lite-hooks.sh` 锁定钩子行为（11 用例）。
- **同步脚本** -- `scripts/sync-superskills.mjs` 把可逐字移植的 SuperSkills 资产（clarify/learn 技能、stop-learn/learn-prompt 钩子）同步进来并做 `superskills→superharness` 改写。

### Fixed

- **stop-verify 由「每会话一次」改为游标重触发** -- 终检门控原先用一次性 marker，一个会话只触发一次；改为按代码改动量游标重触发，多轮编码每轮都能门控。（上游 SuperSkills 同步修复。）

## 2026-04-13

### Added

- **`superharness update`：增量更新命令** -- 新增 `update` 子命令，把当前已安装的 superharness 工具产物（skills / agents / hooks / `using-superharness.md` / 平台 settings）同步到项目，**保留** `.superharness/spec/`、`config.yaml`、`workflow.md`、`worktree.yaml` 等用户定制内容，解决"重新跑 `init` 会覆盖 spec-discover 结果"的问题。命令开头会查询 npm registry，发现全局包落后时阻塞提示并自动检测包管理器（npm/pnpm/yarn/bun，跑各自的 `* root -g` 与 `packageRoot` 做前缀匹配）执行升级，升级成功后 re-exec 新版本继续 update。`--force` 可强制覆盖用户文件（spec 重置为 blank 模板 + 三个配置重新渲染），执行前需二次确认；`-y` 让所有交互默认 yes，便于 CI。
- **`superharness init`：阻止重复初始化** -- 检测到 `.superharness/` 已存在时不再静默覆盖，改为打印错误并提示改用 `superharness update`；确实要重置项目需 `init --force` 并二次确认。同时修复 `--platforms` 参数没有真正写进 `config.yaml`（之前模板硬编码 `- claude-code`）的问题，init/update 末尾会把当前包版本与时间戳写入 `config.yaml` 的 `_meta` 块以备后续迁移使用。
- **init: worktree.yaml 按项目类型渲染 verify** -- `superharness init` 检测 `package.json` / `pyproject.toml` / `pom.xml` / `build.gradle(.kts)` / `Package.swift` / `*.xcodeproj`，在 `worktree.yaml` 里生成对应的 `verify:` 命令（`pytest` / `mvn test` / `./gradlew test` / `swift test` 等）。非 Node 项目不再继承 `npm test` 而直接失败。
- **test-driven-development: 多语言测试命令解析** -- 新增 "Resolving the Test Command" 节，让 TDD 流程先读 `.superharness/spec/testing/index.md`，读不到则按 manifest 推断 JS/TS、Python、Maven、Gradle、Swift 的测试命令。原先硬编码的 `npm test` 示例改为 `<test command>` 占位，Example: Bug Fix 加语言说明。
- **spec-discover: Swift (iOS/macOS) 支持** -- 新增 `reference/swift.md`，识别 `Package.swift` / `*.xcodeproj` / `*.xcworkspace`，覆盖 SwiftUI/UIKit/AppKit、SPM、XCTest/swift-testing、SwiftLint 等维度。Step 0 的 manifest 表改为兼容目录 bundle 匹配。

### Fixed

- **`superharness --version` 返回错误版本** -- 原先版本号在 `src/index.ts` 中硬编码为 `0.1.0`，发布新版本后 CLI 仍显示旧版本。改为运行时从包的 `package.json` 读取，版本号随发布自动同步。
