import { logWarn } from "../utils/log.js";
import { setupClaudeCode } from "./claude-code.js";
import { setupAoneCopilot } from "./aone-copilot.js";
import { setupCodex } from "./codex.js";
import { setupQoder } from "./qoder.js";
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
	switch (platform) {
		case "claude-code":
			setupClaudeCode(projectDir, packageRoot);
			break;
		case "aone-copilot":
			setupAoneCopilot(projectDir, packageRoot);
			break;
		case "codex":
			setupCodex(projectDir, packageRoot);
			break;
		case "qoder":
			setupQoder(projectDir, packageRoot);
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
	}
}
