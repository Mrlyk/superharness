import { join } from "node:path";
import { mergeHookConfig, removeSuperharnessHooks } from "../utils/hooks.js";
import { logSuccess, logWarn } from "../utils/log.js";
import { ADAPTERS } from "./adapter.js";
import {
	LITE_SKILLS,
	reconcileLiteHooks,
	reconcileLiteSkills,
} from "./shared.js";

// Platforms a lite install supports. claude-code / codex / qoder are managed by
// PlatformAdapter; aone-copilot stays on the legacy lite path below.
export const LITE_PLATFORMS = [
	"claude-code",
	"codex",
	"qoder",
	"aone-copilot",
] as const;

function setupAoneCopilotLite(projectDir: string, packageRoot: string): void {
	const aoneDir = join(projectDir, ".aone_copilot");
	reconcileLiteSkills(packageRoot, join(aoneDir, "skills"));
	logSuccess(`Aone Copilot (lite): 已复制 ${LITE_SKILLS.length} 个 skill`);

	const copied = reconcileLiteHooks(packageRoot, join(aoneDir, "hooks"));
	if (copied > 0) logSuccess(`Aone Copilot (lite): 已复制 ${copied} 个 hook`);

	removeSuperharnessHooks(join(aoneDir, "hooks.json"));
	mergeHookConfig(
		join(aoneDir, "hooks.json"),
		{
			sessionStart: [
				{
					hooks: [
						{
							type: "command",
							command: "node .aone_copilot/hooks/session-start.cjs",
							timeout: 10,
						},
					],
				},
			],
			stop: [
				{
					hooks: [
						{
							type: "command",
							command: "node .aone_copilot/hooks/stop-verify.cjs",
							timeout: 15,
						},
						{
							type: "command",
							command: "node .aone_copilot/hooks/stop-learn.cjs",
							timeout: 15,
						},
					],
				},
			],
		},
		true,
	);
	logSuccess("Aone Copilot (lite): 已创建 hooks.json (sessionStart + stop)");
}

export function setupLitePlatform(
	platform: string,
	projectDir: string,
	packageRoot: string,
): void {
	const adapter = ADAPTERS[platform];
	if (adapter) {
		adapter.installLite(projectDir, packageRoot);
		return;
	}
	if (platform === "aone-copilot") {
		setupAoneCopilotLite(projectDir, packageRoot);
		return;
	}
	logWarn(
		`lite 暂只支持 claude-code / codex / qoder / aone-copilot，已跳过 "${platform}"`,
	);
}
