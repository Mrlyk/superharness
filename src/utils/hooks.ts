import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { logWarn } from "./log.js";

export interface HookEntry {
	matcher?: string;
	hooks: Array<{ type: string; command: string; timeout?: number }>;
}

// Script-name fragments that identify a superharness-installed hook command,
// across both full (.js) and lite (.cjs) modes. Used to recognize our own
// entries for merge-skip and for removal on mode switch.
export const SUPERHARNESS_HOOK_MARKERS = [
	"session-start",
	"pre-tool-use",
	"subagent-stop",
	"stop-learn",
	"learn-prompt",
];

function isSuperharnessEntry(entry: HookEntry): boolean {
	return (
		entry.hooks?.some((h) =>
			SUPERHARNESS_HOOK_MARKERS.some((m) => h.command.includes(m)),
		) ?? false
	);
}

/**
 * Strip every superharness-installed hook entry from a settings.json/hooks.json,
 * leaving the user's own hooks untouched. Used when switching modes so the old
 * mode's registrations don't linger (and double-fire) alongside the new mode's.
 */
export function removeSuperharnessHooks(configPath: string): void {
	if (!existsSync(configPath)) return;
	let config: Record<string, unknown>;
	try {
		config = JSON.parse(readFileSync(configPath, "utf-8"));
	} catch {
		logWarn(`无法解析 ${configPath}，跳过 hook 清理`);
		return;
	}

	const hooks = config.hooks as Record<string, HookEntry[]> | undefined;
	if (!hooks) return;

	for (const eventName of Object.keys(hooks)) {
		const kept = (hooks[eventName] || []).filter(
			(e) => !isSuperharnessEntry(e),
		);
		if (kept.length) hooks[eventName] = kept;
		else delete hooks[eventName];
	}

	config.hooks = hooks;
	writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}

/**
 * Merge hook entries into a settings.json or hooks.json file.
 * Appends new entries, skips if a superharness hook already exists for that event.
 */
export function mergeHookConfig(
	configPath: string,
	hookEntries: Record<string, HookEntry[]>,
	isHooksJson = false,
): void {
	let config: Record<string, unknown> = {};
	if (existsSync(configPath)) {
		try {
			config = JSON.parse(readFileSync(configPath, "utf-8"));
		} catch {
			logWarn(`无法解析已有 ${configPath}，将创建新文件`);
		}
	}

	if (isHooksJson && !config.version) {
		config.version = 1;
	}

	const hooks = (config.hooks || {}) as Record<string, HookEntry[]>;

	for (const [eventName, newEntries] of Object.entries(hookEntries)) {
		const existing = (hooks[eventName] || []) as HookEntry[];

		const shExists = existing.some(isSuperharnessEntry);

		if (!shExists) {
			existing.push(...newEntries);
		}

		hooks[eventName] = existing;
	}

	config.hooks = hooks;

	mkdirSync(dirname(configPath), { recursive: true });
	writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}
