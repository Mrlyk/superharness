# Changelog

## 2026-04-13

### Fixed

- **`superharness --version` 返回错误版本** -- 原先版本号在 `src/index.ts` 中硬编码为 `0.1.0`，发布新版本后 CLI 仍显示旧版本。改为运行时从包的 `package.json` 读取，版本号随发布自动同步。
