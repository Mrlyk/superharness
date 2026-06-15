import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { listSkillDirs } from "../utils/fs.js";
import { removeSuperharnessHooks } from "../utils/hooks.js";
import { logSuccess, logWarn } from "../utils/log.js";
import { LITE_AGENTS, LITE_SKILLS } from "./lite.js";

// Full mode's compiled hook scripts (.js). Lite uses .cjs, so these must go on
// switch or both hook sets would fire.
const FULL_JS_HOOKS = [
	"session-start.js",
	"pre-tool-use.js",
	"subagent-stop.js",
];

function rmIfExists(p: string): boolean {
	if (!existsSync(p)) return false;
	rmSync(p, { recursive: true, force: true });
	return true;
}

// Remove superharness skill dirs that full installed but lite does not keep,
// from a shared skills dir — by known name only, never the user's own skills.
function removeFullOnlySkills(packageRoot: string, skillsDir: string): number {
	const liteSet = new Set<string>(LITE_SKILLS);
	let removed = 0;
	for (const name of listSkillDirs(packageRoot)) {
		if (liteSet.has(name)) continue;
		if (rmIfExists(join(skillsDir, name))) removed++;
	}
	return removed;
}

function listFullAgentFiles(packageRoot: string): string[] {
	const dir = join(packageRoot, "agents");
	if (!existsSync(dir)) return [];
	return readdirSync(dir).filter((f) => f.endsWith(".md"));
}

// Remove full-only agents from a shared agents dir, keeping the ones lite reuses.
function removeFullOnlyAgents(packageRoot: string, agentsDir: string): number {
	const keep = new Set(LITE_AGENTS.map((a) => `${a}.md`));
	let removed = 0;
	for (const file of listFullAgentFiles(packageRoot)) {
		if (keep.has(file)) continue;
		if (rmIfExists(join(agentsDir, file))) removed++;
	}
	return removed;
}

function uninstallFullClaudeCode(
	projectDir: string,
	packageRoot: string,
): void {
	const claudeDir = join(projectDir, ".claude");
	rmIfExists(join(claudeDir, "commands", "superharness"));
	removeFullOnlyAgents(packageRoot, join(claudeDir, "agents"));
	for (const h of FULL_JS_HOOKS) rmIfExists(join(claudeDir, "hooks", h));
	removeSuperharnessHooks(join(claudeDir, "settings.json"));
	logSuccess("Claude Code: 已移除 full 产物 (commands/agents/hooks/settings)");
}

function uninstallFullCodex(projectDir: string, packageRoot: string): void {
	const codexDir = join(projectDir, ".codex");
	removeFullOnlySkills(packageRoot, join(codexDir, "skills"));
	// Full codex installs no hooks; nothing else to strip.
	logSuccess("Codex: 已移除 full 专属 skill");
}

function uninstallFullAoneCopilot(
	projectDir: string,
	packageRoot: string,
): void {
	const aoneDir = join(projectDir, ".aone_copilot");
	removeFullOnlySkills(packageRoot, join(aoneDir, "skills"));
	for (const h of FULL_JS_HOOKS) rmIfExists(join(aoneDir, "hooks", h));
	removeSuperharnessHooks(join(aoneDir, "hooks.json"));
	logSuccess("Aone Copilot: 已移除 full 产物 (skill/hooks/hooks.json)");
}

// Strip full-mode artifacts for one platform before lite reinstalls. Only the
// lite-supported platforms get cleaned + reinstalled; full-only platforms
// (cursor/qoder) are reported separately and left untouched.
export function uninstallFullPlatform(
	platform: string,
	projectDir: string,
	packageRoot: string,
): void {
	switch (platform) {
		case "claude-code":
			uninstallFullClaudeCode(projectDir, packageRoot);
			break;
		case "codex":
			uninstallFullCodex(projectDir, packageRoot);
			break;
		case "aone-copilot":
			uninstallFullAoneCopilot(projectDir, packageRoot);
			break;
		default:
			logWarn(`无 full 卸载逻辑，跳过 "${platform}"`);
	}
}
