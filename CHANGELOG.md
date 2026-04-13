# Changelog

## 2026-04-13

### Added

- **init: worktree.yaml 按项目类型渲染 verify** -- `superharness init` 检测 `package.json` / `pyproject.toml` / `pom.xml` / `build.gradle(.kts)` / `Package.swift` / `*.xcodeproj`，在 `worktree.yaml` 里生成对应的 `verify:` 命令（`pytest` / `mvn test` / `./gradlew test` / `swift test` 等）。非 Node 项目不再继承 `npm test` 而直接失败。
- **test-driven-development: 多语言测试命令解析** -- 新增 "Resolving the Test Command" 节，让 TDD 流程先读 `.superharness/spec/testing/index.md`，读不到则按 manifest 推断 JS/TS、Python、Maven、Gradle、Swift 的测试命令。原先硬编码的 `npm test` 示例改为 `<test command>` 占位，Example: Bug Fix 加语言说明。
- **spec-discover: Swift (iOS/macOS) 支持** -- 新增 `reference/swift.md`，识别 `Package.swift` / `*.xcodeproj` / `*.xcworkspace`，覆盖 SwiftUI/UIKit/AppKit、SPM、XCTest/swift-testing、SwiftLint 等维度。Step 0 的 manifest 表改为兼容目录 bundle 匹配。

### Fixed

- **`superharness --version` 返回错误版本** -- 原先版本号在 `src/index.ts` 中硬编码为 `0.1.0`，发布新版本后 CLI 仍显示旧版本。改为运行时从包的 `package.json` 读取，版本号随发布自动同步。
