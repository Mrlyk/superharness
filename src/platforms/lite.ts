import { existsSync, mkdirSync, cpSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logSuccess, logWarn } from "../utils/log.js";
import { copySkillDir, copyLiteHooks, listSkillDirs } from "../utils/fs.js";
import {
	mergeHookConfig,
	removeSuperharnessHooks,
	SUPERHARNESS_HOOK_MARKERS,
} from "../utils/hooks.js";

// Lite installs the four-capability core plus the two reviewers the test
// skill drives — never the heavy greenfield workflow skills/agents. The skills
// carry an "sh-" prefix at the source so their bare names never collide with
// the user's own .claude/skills entries.
export const LITE_SKILLS = ["sh-clarify", "sh-discover", "sh-learn", "sh-test"];
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

// Reconcile lite skills in a shared skills dir so an update tracks capability
// iteration: prune superharness skills lite no longer ships (a retired skill, or
// full-only ones from a prior install) by known name, then clean-reinstall the
// current set (rm-then-copy) so files dropped inside a skill don't linger. Only
// names superharness ships are ever touched — never the user's own skills.
function reconcileLiteSkills(packageRoot: string, skillsDir: string): void {
	mkdirSync(skillsDir, { recursive: true });
	const keep = new Set<string>(LITE_SKILLS);
	for (const name of listSkillDirs(packageRoot)) {
		if (keep.has(name)) continue;
		rmSync(join(skillsDir, name), { recursive: true, force: true });
	}
	for (const name of LITE_SKILLS) {
		rmSync(join(skillsDir, name), { recursive: true, force: true });
		copySkillDir(packageRoot, name, skillsDir);
	}
}

// Reconcile lite hook scripts: drop superharness-managed hook files no longer in
// the lite set (recognized by name marker — covers retired lite hooks and stray
// full .js), then copy the current lite hooks. The user's own hook files, which
// match no marker, are left alone.
function reconcileLiteHooks(packageRoot: string, hooksDir: string): number {
	if (existsSync(hooksDir)) {
		const keep = new Set<string>(LITE_HOOKS);
		for (const file of readdirSync(hooksDir)) {
			if (keep.has(file)) continue;
			if (SUPERHARNESS_HOOK_MARKERS.some((m) => file.includes(m)))
				rmSync(join(hooksDir, file), { force: true });
		}
	}
	return copyLiteHooks(packageRoot, hooksDir, LITE_HOOKS);
}

function setupClaudeCodeLite(projectDir: string, packageRoot: string): void {
	const claudeDir = join(projectDir, ".claude");
	// Install as Claude Code skills (.claude/skills/) so they auto-trigger by
	// description — not slash commands the user has to type by hand.
	const skillsDir = join(claudeDir, "skills");
	reconcileLiteSkills(packageRoot, skillsDir);
	logSuccess(
		`Claude Code (lite): 已安装 ${LITE_SKILLS.length} 个 skill 到 .claude/skills/`,
	);

	copyLiteAgents(packageRoot, join(claudeDir, "agents"));

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

function setupCodexLite(projectDir: string, packageRoot: string): void {
	const codexDir = join(projectDir, ".codex");
	reconcileLiteSkills(packageRoot, join(codexDir, "skills"));
	logSuccess(`Codex (lite): 已复制 ${LITE_SKILLS.length} 个 skill`);

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
