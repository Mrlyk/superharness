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

const FORMAT = AGENT_FORMATS.qoder;

function installFull(projectDir: string, packageRoot: string): void {
	const qoderDir = join(projectDir, ".qoder");

	const skillNames = listSkillDirs(packageRoot);
	for (const name of skillNames) {
		copySkillDir(packageRoot, name, join(qoderDir, "skills"));
	}
	logSuccess(`Qoder: 已复制 ${skillNames.length} 个 skill 到 .qoder/skills/`);

	// Qoder subagents are Markdown with the same frontmatter contract as the
	// source (.qoder/agents/<name>.md), so the source is consumed verbatim.
	const written = installAgents(packageRoot, listAgentNames(packageRoot), {
		dir: join(qoderDir, "agents"),
		format: FORMAT,
	});
	logSuccess(`Qoder: 已复制 ${written} 个 agent 到 .qoder/agents/`);
}

function installLite(projectDir: string, packageRoot: string): void {
	const qoderDir = join(projectDir, ".qoder");

	reconcileLiteSkills(packageRoot, join(qoderDir, "skills"));
	logSuccess("Qoder (lite): 已复制 skill 到 .qoder/skills/");

	installAgents(packageRoot, LITE_AGENTS, {
		dir: join(qoderDir, "agents"),
		format: FORMAT,
	});
	logSuccess(
		`Qoder (lite): 已复制 ${LITE_AGENTS.length} 个 agent 到 .qoder/agents/`,
	);

	const copied = reconcileLiteHooks(packageRoot, join(qoderDir, "hooks"));
	if (copied > 0) logSuccess(`Qoder (lite): 已复制 ${copied} 个 hook`);

	// Qoder hooks live under "hooks" in .qoder/settings.json (PascalCase events,
	// same shape as Claude Code's settings.json). Qoder has NO SessionStart event,
	// so the operating-manual injection is registered on UserPromptSubmit instead
	// — session-start-lite guards on session_id to inject only on the first prompt.
	removeSuperharnessHooks(join(qoderDir, "settings.json"));
	mergeHookConfig(join(qoderDir, "settings.json"), {
		UserPromptSubmit: [
			{
				hooks: [
					{
						type: "command",
						command: "node .qoder/hooks/session-start-lite.js",
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
						command: "node .qoder/hooks/stop-learn-lite.js",
						timeout: 15,
					},
				],
			},
		],
	});
	logSuccess("Qoder (lite): 已合并 settings.json (UserPromptSubmit + Stop)");
}

function uninstallFull(projectDir: string, packageRoot: string): void {
	const qoderDir = join(projectDir, ".qoder");
	removeFullOnlySkills(packageRoot, join(qoderDir, "skills"));
	removeFullOnlyAgents(packageRoot, join(qoderDir, "agents"), FORMAT.ext);
	logSuccess("Qoder: 已移除 full 专属 skill 与 agent");
}

export const qoderAdapter: PlatformAdapter = {
	installFull,
	installLite,
	uninstallFull,
};
