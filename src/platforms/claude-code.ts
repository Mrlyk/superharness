import { join } from "node:path";
import {
	copyHookScripts,
	copySkillToCommands,
	listSkillDirs,
} from "../utils/fs.js";
import { mergeHookConfig, removeSuperharnessHooks } from "../utils/hooks.js";
import { logSuccess, logWarn } from "../utils/log.js";
import type { PlatformAdapter } from "./adapter.js";
import {
	AGENT_FORMATS,
	installAgents,
	listAgentNames,
} from "./agent-format.js";
import {
	FULL_JS_HOOKS,
	LITE_AGENTS,
	LITE_SKILLS,
	reconcileLiteHooks,
	reconcileLiteSkills,
	removeFullOnlyAgents,
	rmIfExists,
} from "./shared.js";

const FORMAT = AGENT_FORMATS["claude-code"];

function installFull(projectDir: string, packageRoot: string): void {
	const claudeDir = join(projectDir, ".claude");
	const commandsDir = join(claudeDir, "commands", "superharness");

	// 1. Skills as slash commands
	const skillNames = listSkillDirs(packageRoot);
	for (const name of skillNames) {
		copySkillToCommands(packageRoot, name, commandsDir);
	}
	logSuccess(
		`Claude Code: 已复制 ${skillNames.length} 个 skill 到 .claude/commands/superharness/`,
	);

	// 2. Agents (Markdown passthrough)
	const written = installAgents(packageRoot, listAgentNames(packageRoot), {
		dir: join(claudeDir, "agents"),
		format: FORMAT,
	});
	logSuccess(`Claude Code: 已复制 ${written} 个 agent 到 .claude/agents/`);

	// 3. Hook scripts
	const hooksCopied = copyHookScripts(packageRoot, join(claudeDir, "hooks"));
	if (hooksCopied > 0) {
		logSuccess(`Claude Code: 已复制 ${hooksCopied} 个 hook 到 .claude/hooks/`);
	} else {
		logWarn("Claude Code: hook 脚本未找到 (需要先 npm run build)");
	}

	// 4. settings.json
	mergeHookConfig(join(claudeDir, "settings.json"), {
		SessionStart: [
			{
				matcher: "startup|clear|compact",
				hooks: [
					{
						type: "command",
						command: "node .claude/hooks/session-start.js",
						timeout: 10,
					},
				],
			},
		],
		PreToolUse: [
			{
				matcher: "Task",
				hooks: [
					{
						type: "command",
						command: "node .claude/hooks/pre-tool-use.js",
						timeout: 30,
					},
				],
			},
			{
				matcher: "Agent",
				hooks: [
					{
						type: "command",
						command: "node .claude/hooks/pre-tool-use.js",
						timeout: 30,
					},
				],
			},
		],
		SubagentStop: [
			{
				matcher: "check",
				hooks: [
					{
						type: "command",
						command: "node .claude/hooks/subagent-stop.js",
						timeout: 10,
					},
				],
			},
		],
	});
	logSuccess(
		"Claude Code: 已合并 settings.json (SessionStart + PreToolUse + SubagentStop)",
	);
}

function installLite(projectDir: string, packageRoot: string): void {
	const claudeDir = join(projectDir, ".claude");

	// Install as Claude Code skills (.claude/skills/) so they auto-trigger by
	// description — not slash commands the user has to type by hand.
	reconcileLiteSkills(packageRoot, join(claudeDir, "skills"));
	logSuccess(
		`Claude Code (lite): 已安装 ${LITE_SKILLS.length} 个 skill 到 .claude/skills/`,
	);

	installAgents(packageRoot, LITE_AGENTS, {
		dir: join(claudeDir, "agents"),
		format: FORMAT,
	});

	const copied = reconcileLiteHooks(packageRoot, join(claudeDir, "hooks"));
	if (copied > 0) logSuccess(`Claude Code (lite): 已复制 ${copied} 个 hook`);

	// Reconcile hook registrations: strip our prior entries then re-add the
	// current set, so a changed command/timeout or a newly-added hook is picked
	// up on update (mergeHookConfig alone skips events we already registered).
	removeSuperharnessHooks(join(claudeDir, "settings.json"));
	mergeHookConfig(join(claudeDir, "settings.json"), {
		SessionStart: [
			{
				matcher: "startup|clear|compact",
				hooks: [
					{
						type: "command",
						command: "node .claude/hooks/session-start.cjs",
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
						command: "node .claude/hooks/stop-verify.cjs",
						timeout: 15,
					},
					{
						type: "command",
						command: "node .claude/hooks/stop-learn.cjs",
						timeout: 15,
					},
				],
			},
		],
	});
	logSuccess("Claude Code (lite): 已合并 settings.json (SessionStart + Stop)");
}

function uninstallFull(projectDir: string, packageRoot: string): void {
	const claudeDir = join(projectDir, ".claude");
	rmIfExists(join(claudeDir, "commands", "superharness"));
	removeFullOnlyAgents(packageRoot, join(claudeDir, "agents"), FORMAT.ext);
	for (const h of FULL_JS_HOOKS) rmIfExists(join(claudeDir, "hooks", h));
	removeSuperharnessHooks(join(claudeDir, "settings.json"));
	logSuccess("Claude Code: 已移除 full 产物 (commands/agents/hooks/settings)");
}

export const claudeCodeAdapter: PlatformAdapter = {
	installFull,
	installLite,
	uninstallFull,
};
