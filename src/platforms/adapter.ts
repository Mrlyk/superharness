import { claudeCodeAdapter } from "./claude-code.js";
import { codexAdapter } from "./codex.js";
import { qoderAdapter } from "./qoder.js";

// One adapter owns everything for a single platform: full install, lite install,
// and the full-artifact strip used by the full→lite switch. Adding a platform =
// add one adapter file implementing this interface plus an entry in ADAPTERS.
// (claude-code / codex / qoder go through here; aone-copilot and cursor remain on
// the legacy switch in index.ts / lite.ts.)
export interface PlatformAdapter {
	installFull(projectDir: string, packageRoot: string): void;
	installLite(projectDir: string, packageRoot: string): void;
	uninstallFull(projectDir: string, packageRoot: string): void;
}

export const ADAPTERS: Record<string, PlatformAdapter> = {
	"claude-code": claudeCodeAdapter,
	codex: codexAdapter,
	qoder: qoderAdapter,
};
