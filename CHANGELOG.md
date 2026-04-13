# Changelog

## 2026-04-13

### Added

- **spec-discover: Swift (iOS/macOS) 支持** -- 新增 `reference/swift.md`，识别 `Package.swift` / `*.xcodeproj` / `*.xcworkspace`，覆盖 SwiftUI/UIKit/AppKit、SPM、XCTest/swift-testing、SwiftLint 等维度。Step 0 的 manifest 表改为兼容目录 bundle 匹配。

### Fixed

- **`superharness --version` 返回错误版本** -- 原先版本号在 `src/index.ts` 中硬编码为 `0.1.0`，发布新版本后 CLI 仍显示旧版本。改为运行时从包的 `package.json` 读取，版本号随发布自动同步。
