import { logWarn } from "../utils/log.js";
import { ADAPTERS } from "./adapter.js";
import { setupAoneCopilot } from "./aone-copilot.js";
import { setupCursor } from "./cursor.js";

export const PLATFORMS = [
	"claude-code",
	"aone-copilot",
	"codex",
	"cursor",
	"qoder",
	"gemini",
	"copilot",
] as const;

export type Platform = (typeof PLATFORMS)[number];

export function setupPlatform(
	platform: Platform,
	projectDir: string,
	packageRoot: string,
): void {
	// claude-code / codex / qoder are managed by PlatformAdapter; the rest stay on
	// the legacy per-platform setup until they are ported (or removed).
	const adapter = ADAPTERS[platform];
	if (adapter) {
		adapter.installFull(projectDir, packageRoot);
		return;
	}

	switch (platform) {
		case "aone-copilot":
			setupAoneCopilot(projectDir, packageRoot);
			break;
		case "cursor":
			setupCursor(projectDir, packageRoot);
			break;
		case "gemini":
			logWarn("Gemini CLI: Markdown→TOML 转换待开发 (Phase 4)");
			break;
		case "copilot":
			logWarn("GitHub Copilot: 适配器待开发 (Phase 2)");
			break;
		default:
			logWarn(`未知平台 "${platform}"，已跳过`);
			break;
	}
}
