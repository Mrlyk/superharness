// Cross-platform install/uninstall toolbox shared by the claude / codex / qoder
// adapters (and the legacy aone-copilot path). Holding the lite capability sets
// and the reconcile / prune helpers here keeps each adapter free of duplication
// and lets the lite dispatcher import the adapters without a cycle (an adapter
// never imports lite.ts).

import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { copyLiteHooks, copySkillDir, listSkillDirs } from "../utils/fs.js";
import { SUPERHARNESS_HOOK_MARKERS } from "../utils/hooks.js";
import { listAgentNames } from "./agent-format.js";

// Lite ships the four-capability core plus the two reviewers the test skill drives
// — never the heavy greenfield workflow skills/agents. The skills carry an "sh-"
// prefix at the source so their bare names never collide with the user's own
// .claude/skills entries.
export const LITE_SKILLS = ["sh-clarify", "sh-discover", "sh-learn", "sh-test"];
export const LITE_AGENTS = ["spec-reviewer", "code-reviewer"];
export const LITE_HOOKS = [
	"session-start-lite.js",
	"stop-verify-lite.js",
	"stop-learn-lite.js",
];

// Full mode's compiled hook scripts (.js). Lite uses .cjs, so these must go on a
// full→lite switch or both hook sets would fire.
export const FULL_JS_HOOKS = [
	"session-start.js",
	"pre-tool-use.js",
	"subagent-stop.js",
];

export function rmIfExists(p: string): boolean {
	if (!existsSync(p)) return false;
	rmSync(p, { recursive: true, force: true });
	return true;
}

// Reconcile lite skills in a shared skills dir so an update tracks capability
// iteration: prune superharness skills lite no longer ships (a retired skill, or
// full-only ones from a prior install) by known name, then clean-reinstall the
// current set (rm-then-copy) so files dropped inside a skill don't linger. Only
// names superharness ships are ever touched — never the user's own skills.
export function reconcileLiteSkills(
	packageRoot: string,
	skillsDir: string,
): void {
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
export function reconcileLiteHooks(
	packageRoot: string,
	hooksDir: string,
): number {
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

// Remove superharness skill dirs that full installed but lite does not keep, from
// a shared skills dir — by known name only, never the user's own skills.
export function removeFullOnlySkills(
	packageRoot: string,
	skillsDir: string,
): number {
	const liteSet = new Set<string>(LITE_SKILLS);
	let removed = 0;
	for (const name of listSkillDirs(packageRoot)) {
		if (liteSet.has(name)) continue;
		if (rmIfExists(join(skillsDir, name))) removed++;
	}
	return removed;
}

// Remove full-only agents from a shared agents dir, keeping the ones lite reuses.
// `ext` matches the platform's installed agent extension (.md for claude/qoder,
// .toml for codex).
export function removeFullOnlyAgents(
	packageRoot: string,
	agentsDir: string,
	ext: string,
): number {
	const keep = new Set(LITE_AGENTS.map((a) => `${a}${ext}`));
	let removed = 0;
	for (const name of listAgentNames(packageRoot)) {
		const file = `${name}${ext}`;
		if (keep.has(file)) continue;
		if (rmIfExists(join(agentsDir, file))) removed++;
	}
	return removed;
}
