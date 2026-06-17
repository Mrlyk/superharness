import { join } from "node:path";
import { copySkillDir, listSkillDirs } from "../utils/fs.js";
import { mergeHookConfig, removeSuperharnessHooks } from "../utils/hooks.js";
import { logSuccess } from "../utils/log.js";
import type { PlatformAdapter } from "./adapter.js";
import {
	AGENT_FORMATS,
	installAgents,
	listAgentNames,
} from "./agent-format.js";
import {
	LITE_AGENTS,
	reconcileLiteHooks,
	reconcileLiteSkills,
	removeFullOnlyAgents,
	removeFullOnlySkills,
} from "./shared.js";

const FORMAT = AGENT_FORMATS.codex;

function installFull(projectDir: string, packageRoot: string): void {
	const codexDir = join(projectDir, ".codex");

	const skillNames = listSkillDirs(packageRoot);
	for (const name of skillNames) {
		copySkillDir(packageRoot, name, join(codexDir, "skills"));
	}
	logSuccess(`Codex: 已复制 ${skillNames.length} 个 skill 到 .codex/skills/`);

	// Codex consumes subagents as TOML (.codex/agents/<name>.toml).
	const written = installAgents(packageRoot, listAgentNames(packageRoot), {
		dir: join(codexDir, "agents"),
		format: FORMAT,
	});
	logSuccess(`Codex: 已生成 ${written} 个 agent 到 .codex/agents/ (TOML)`);
}

function installLite(projectDir: string, packageRoot: string): void {
	const codexDir = join(projectDir, ".codex");

	reconcileLiteSkills(packageRoot, join(codexDir, "skills"));
	logSuccess("Codex (lite): 已复制 skill 到 .codex/skills/");

	installAgents(packageRoot, LITE_AGENTS, {
		dir: join(codexDir, "agents"),
		format: FORMAT,
	});
	logSuccess(
		`Codex (lite): 已生成 ${LITE_AGENTS.length} 个 agent 到 .codex/agents/ (TOML)`,
	);

	const copied = reconcileLiteHooks(packageRoot, join(codexDir, "hooks"));
	if (copied > 0) logSuccess(`Codex (lite): 已复制 ${copied} 个 hook`);

	// Codex consumes the same hook-JSON shape (PascalCase events). The background
	// learner runs via `codex exec`, selected by SUPERHARNESS_LEARN_CLI=codex set
	// inline on the command. Codex does file I/O through the shell, so the verify
	// gate's git-based churn detection still works.
	removeSuperharnessHooks(join(codexDir, "hooks.json"));
	mergeHookConfig(
		join(codexDir, "hooks.json"),
		{
			SessionStart: [
				{
					hooks: [
						{
							type: "command",
							command: "node .codex/hooks/session-start.cjs",
							timeout: 10,
						},
					],
				},
			],
			Stop: [
				{
					hooks: [
						{
							type: "command",
							command: "node .codex/hooks/stop-verify.cjs",
							timeout: 15,
						},
						{
							type: "command",
							command:
								"SUPERHARNESS_LEARN_CLI=codex node .codex/hooks/stop-learn.cjs",
							timeout: 15,
						},
					],
				},
			],
		},
		true,
	);
	logSuccess(
		"Codex (lite): 已写 hooks.json (SessionStart + Stop，学习走 codex exec)",
	);
}

function uninstallFull(projectDir: string, packageRoot: string): void {
	const codexDir = join(projectDir, ".codex");
	removeFullOnlySkills(packageRoot, join(codexDir, "skills"));
	removeFullOnlyAgents(packageRoot, join(codexDir, "agents"), FORMAT.ext);
	logSuccess("Codex: 已移除 full 专属 skill 与 agent");
}

export const codexAdapter: PlatformAdapter = {
	installFull,
	installLite,
	uninstallFull,
};
