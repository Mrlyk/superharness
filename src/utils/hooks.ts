import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { logWarn } from "./log.js";

export interface HookEntry {
	matcher?: string;
	hooks: Array<{ type: string; command: string; timeout?: number }>;
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

		const shExists = existing.some((e) =>
			e.hooks?.some(
				(h) =>
					h.command.includes("session-start.js") ||
					h.command.includes("pre-tool-use.js") ||
					h.command.includes("subagent-stop.js"),
			),
		);

		if (!shExists) {
			existing.push(...newEntries);
		}

		hooks[eventName] = existing;
	}

	config.hooks = hooks;

	mkdirSync(dirname(configPath), { recursive: true });
	writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}
