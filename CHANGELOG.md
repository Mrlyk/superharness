# Changelog

## 2026-04-13

### Added

- **`superharness update`：增量更新命令** -- 新增 `update` 子命令，把当前已安装的 superharness 工具产物（skills / agents / hooks / `using-superharness.md` / 平台 settings）同步到项目，**保留** `.superharness/spec/`、`config.yaml`、`workflow.md`、`worktree.yaml` 等用户定制内容，解决"重新跑 `init` 会覆盖 spec-discover 结果"的问题。命令开头会查询 npm registry，发现全局包落后时阻塞提示并自动检测包管理器（npm/pnpm/yarn/bun，跑各自的 `* root -g` 与 `packageRoot` 做前缀匹配）执行升级，升级成功后 re-exec 新版本继续 update。`--force` 可强制覆盖用户文件（spec 重置为 blank 模板 + 三个配置重新渲染），执行前需二次确认；`-y` 让所有交互默认 yes，便于 CI。
- **`superharness init`：阻止重复初始化** -- 检测到 `.superharness/` 已存在时不再静默覆盖，改为打印错误并提示改用 `superharness update`；确实要重置项目需 `init --force` 并二次确认。同时修复 `--platforms` 参数没有真正写进 `config.yaml`（之前模板硬编码 `- claude-code`）的问题，init/update 末尾会把当前包版本与时间戳写入 `config.yaml` 的 `_meta` 块以备后续迁移使用。
- **init: worktree.yaml 按项目类型渲染 verify** -- `superharness init` 检测 `package.json` / `pyproject.toml` / `pom.xml` / `build.gradle(.kts)` / `Package.swift` / `*.xcodeproj`，在 `worktree.yaml` 里生成对应的 `verify:` 命令（`pytest` / `mvn test` / `./gradlew test` / `swift test` 等）。非 Node 项目不再继承 `npm test` 而直接失败。
- **test-driven-development: 多语言测试命令解析** -- 新增 "Resolving the Test Command" 节，让 TDD 流程先读 `.superharness/spec/testing/index.md`，读不到则按 manifest 推断 JS/TS、Python、Maven、Gradle、Swift 的测试命令。原先硬编码的 `npm test` 示例改为 `<test command>` 占位，Example: Bug Fix 加语言说明。
- **spec-discover: Swift (iOS/macOS) 支持** -- 新增 `reference/swift.md`，识别 `Package.swift` / `*.xcodeproj` / `*.xcworkspace`，覆盖 SwiftUI/UIKit/AppKit、SPM、XCTest/swift-testing、SwiftLint 等维度。Step 0 的 manifest 表改为兼容目录 bundle 匹配。

### Fixed

- **`superharness --version` 返回错误版本** -- 原先版本号在 `src/index.ts` 中硬编码为 `0.1.0`，发布新版本后 CLI 仍显示旧版本。改为运行时从包的 `package.json` 读取，版本号随发布自动同步。
