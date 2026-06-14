import { existsSync, mkdirSync, cpSync } from "node:fs";
import { join } from "node:path";
import { logSuccess, logWarn } from "../utils/log.js";
import { copySkillDir, copyLiteHooks } from "../utils/fs.js";
import { mergeHookConfig } from "../utils/hooks.js";

// Lite installs the four-capability core plus the two reviewers the test
// skill drives — never the heavy greenfield workflow skills/agents.
export const LITE_SKILLS = ["clarify", "discover", "learn", "test"];
export const LITE_AGENTS = ["spec-reviewer", "code-reviewer"];
export const LITE_HOOKS = [
	"session-start.cjs",
	"stop-verify.cjs",
	"stop-learn.cjs",
	"learn-prompt.cjs",
];

export const LITE_PLATFORMS = ["claude-code", "codex", "aone-copilot"] as const;

function copyLiteAgents(packageRoot: string, agentsDir: string): void {
	mkdirSync(agentsDir, { recursive: true });
	for (const a of LITE_AGENTS) {
		const src = join(packageRoot, "agents", `${a}.md`);
		if (existsSync(src)) cpSync(src, join(agentsDir, `${a}.md`));
	}
}

function setupClaudeCodeLite(projectDir: string, packageRoot: string): void {
	const claudeDir = join(projectDir, ".claude");
	// Install as Claude Code skills (.claude/skills/) so they auto-trigger by
	// description — not slash commands the user has to type by hand.
	const skillsDir = join(claudeDir, "skills");
	mkdirSync(skillsDir, { recursive: true });
	for (const name of LITE_SKILLS) copySkillDir(packageRoot, name, skillsDir);
	logSuccess(
		`Claude Code (lite): 已安装 ${LITE_SKILLS.length} 个 skill 到 .claude/skills/`,
	);

	copyLiteAgents(packageRoot, join(claudeDir, "agents"));

	const copied = copyLiteHooks(packageRoot, join(claudeDir, "hooks"), LITE_HOOKS);
	if (copied > 0) logSuccess(`Claude Code (lite): 已复制 ${copied} 个 hook`);

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

function setupAoneCopilotLite(projectDir: string, packageRoot: string): void {
	const aoneDir = join(projectDir, ".aone_copilot");
	for (const name of LITE_SKILLS)
		copySkillDir(packageRoot, name, join(aoneDir, "skills"));
	logSuccess(`Aone Copilot (lite): 已复制 ${LITE_SKILLS.length} 个 skill`);

	const copied = copyLiteHooks(packageRoot, join(aoneDir, "hooks"), LITE_HOOKS);
	if (copied > 0) logSuccess(`Aone Copilot (lite): 已复制 ${copied} 个 hook`);

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

function setupCodexLite(projectDir: string, packageRoot: string): void {
	const codexDir = join(projectDir, ".codex");
	for (const name of LITE_SKILLS)
		copySkillDir(packageRoot, name, join(codexDir, "skills"));
	logSuccess(`Codex (lite): 已复制 ${LITE_SKILLS.length} 个 skill`);

	const copied = copyLiteHooks(packageRoot, join(codexDir, "hooks"), LITE_HOOKS);
	if (copied > 0) logSuccess(`Codex (lite): 已复制 ${copied} 个 hook`);

	// Codex consumes the same hook-JSON shape (PascalCase events). The background
	// learner runs via `codex exec`, selected by SUPERHARNESS_LEARN_CLI=codex set
	// inline on the command. Codex does file I/O through the shell, so the verify
	// gate's git-based churn detection still works.
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
	logSuccess("Codex (lite): 已写 hooks.json (SessionStart + Stop，学习走 codex exec)");
}

export function setupLitePlatform(
	platform: string,
	projectDir: string,
	packageRoot: string,
): void {
	switch (platform) {
		case "claude-code":
			setupClaudeCodeLite(projectDir, packageRoot);
			break;
		case "aone-copilot":
			setupAoneCopilotLite(projectDir, packageRoot);
			break;
		case "codex":
			setupCodexLite(projectDir, packageRoot);
			break;
		default:
			logWarn(
				`lite 暂只支持 claude-code / codex / aone-copilot，已跳过 "${platform}"`,
			);
	}
}
