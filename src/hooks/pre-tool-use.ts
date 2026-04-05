/**
 * PreToolUse hook for superharness.
 * Fires before Task/Agent tool calls. Responsibilities:
 * 1. Read agent type from stdin JSON (tool_input.subagent_type)
 * 2. Read corresponding JSONL file (implement.jsonl / check.jsonl / debug.jsonl)
 * 3. Inject all referenced file contents into the prompt
 * 4. Update task.json current_phase (Phase auto-tracking)
 * 5. Write trace.jsonl event (observability)
 * 6. Output updated prompt via platform-appropriate JSON format
 *
 * Reference: Trellis inject-subagent-context.py (Python → TS rewrite)
 */

import {
	existsSync,
	readFileSync,
	writeFileSync,
	readdirSync,
	appendFileSync,
} from "node:fs";
import { join, resolve, dirname } from "node:path";

// ─── Types ───

interface HookInput {
	tool_name?: string;
	tool_input?: {
		subagent_type?: string;
		prompt?: string;
		[key: string]: unknown;
	};
	tool_use_id?: string;
	cwd?: string;
	hook_event_name?: string;
	[key: string]: unknown;
}

interface JsonlEntry {
	file: string;
	type?: "file" | "directory";
	reason?: string;
}

interface TaskJson {
	name?: string;
	title?: string;
	status?: string;
	phase?: string;
	current_phase?: number;
	next_action?: Array<{ phase: number; action: string }>;
	[key: string]: unknown;
}

// ─── Constants ───

const AGENTS_ALL = ["implement", "check", "debug", "research"] as const;
const AGENTS_REQUIRE_TASK = ["implement", "check", "debug"] as const;
const SUPERHARNESS_DIR = ".superharness";

// ─── Helpers ───

function readFileOrNull(path: string): string | null {
	try {
		return readFileSync(path, "utf-8");
	} catch {
		return null;
	}
}

function readJsonlEntries(filePath: string): JsonlEntry[] {
	const content = readFileOrNull(filePath);
	if (!content) return [];
	return content
		.split("\n")
		.filter((line) => line.trim())
		.map((line) => {
			try {
				return JSON.parse(line) as JsonlEntry;
			} catch {
				return null;
			}
		})
		.filter((entry): entry is JsonlEntry => entry !== null);
}

function readDirectoryMdFiles(dirPath: string, maxFiles = 20): string {
	if (!existsSync(dirPath)) return "";
	const files = readdirSync(dirPath)
		.filter((f) => f.endsWith(".md"))
		.sort()
		.slice(0, maxFiles);
	return files
		.map((f) => {
			const content = readFileOrNull(join(dirPath, f));
			return content ? `=== ${f} ===\n${content}` : null;
		})
		.filter(Boolean)
		.join("\n\n");
}

function readJsonlFileContents(
	projectDir: string,
	entries: JsonlEntry[],
): string {
	const sections: string[] = [];
	for (const entry of entries) {
		const fullPath = resolve(projectDir, entry.file);
		if (entry.type === "directory") {
			const dirContent = readDirectoryMdFiles(fullPath);
			if (dirContent) {
				sections.push(`--- ${entry.file} (${entry.reason || ""}) ---\n${dirContent}`);
			}
		} else {
			const content = readFileOrNull(fullPath);
			if (content) {
				sections.push(`--- ${entry.file} (${entry.reason || ""}) ---\n${content}`);
			}
		}
	}
	return sections.join("\n\n");
}

function getCurrentTask(projectDir: string): string | null {
	const currentTaskFile = join(
		projectDir,
		SUPERHARNESS_DIR,
		"tasks",
		".current-task",
	);
	return readFileOrNull(currentTaskFile)?.trim() || null;
}

function updatePhase(projectDir: string, taskDir: string, agentType: string): void {
	const taskJsonPath = join(projectDir, taskDir, "task.json");
	const raw = readFileOrNull(taskJsonPath);
	if (!raw) return;

	try {
		const task: TaskJson = JSON.parse(raw);

		// Map agent type to phase name
		const phaseMap: Record<string, string> = {
			implement: "implement",
			check: "check",
			debug: "debug",
			research: "research",
		};
		const newPhase = phaseMap[agentType];
		if (newPhase && task.phase !== newPhase) {
			task.phase = newPhase;
			task.updated_at = new Date().toISOString();
			writeFileSync(taskJsonPath, JSON.stringify(task, null, 2) + "\n");
		}
	} catch {
		// Invalid JSON, skip
	}
}

function writeTrace(
	projectDir: string,
	taskDir: string,
	phase: string,
	event: string,
	detail: string,
): void {
	const tracePath = join(projectDir, taskDir, "trace.jsonl");
	const entry = JSON.stringify({
		ts: new Date().toISOString(),
		phase,
		event,
		detail,
	});
	try {
		appendFileSync(tracePath, entry + "\n");
	} catch {
		// trace dir might not exist yet, skip
	}
}

// ─── Context builders ───

function buildImplementContext(
	projectDir: string,
	taskDir: string,
): string {
	const taskDirFull = join(projectDir, taskDir);
	// Read implement.jsonl, fallback to spec.jsonl
	let entries = readJsonlEntries(join(taskDirFull, "implement.jsonl"));
	if (entries.length === 0) {
		entries = readJsonlEntries(join(taskDirFull, "spec.jsonl"));
	}
	const context = readJsonlFileContents(projectDir, entries);

	// Also read prd.md and info.md
	const prd = readFileOrNull(join(taskDirFull, "prd.md"));
	const info = readFileOrNull(join(taskDirFull, "info.md"));

	const sections = [context];
	if (prd) sections.push(`--- prd.md ---\n${prd}`);
	if (info) sections.push(`--- info.md ---\n${info}`);

	return sections.filter(Boolean).join("\n\n");
}

function buildCheckContext(
	projectDir: string,
	taskDir: string,
): string {
	const taskDirFull = join(projectDir, taskDir);
	let entries = readJsonlEntries(join(taskDirFull, "check.jsonl"));
	if (entries.length === 0) {
		entries = readJsonlEntries(join(taskDirFull, "spec.jsonl"));
	}
	const context = readJsonlFileContents(projectDir, entries);

	const prd = readFileOrNull(join(taskDirFull, "prd.md"));
	const contract = readFileOrNull(join(taskDirFull, "contract.md"));

	const sections = [context];
	if (prd) sections.push(`--- prd.md ---\n${prd}`);
	if (contract) sections.push(`--- contract.md ---\n${contract}`);

	return sections.filter(Boolean).join("\n\n");
}

function buildDebugContext(
	projectDir: string,
	taskDir: string,
): string {
	const taskDirFull = join(projectDir, taskDir);
	let entries = readJsonlEntries(join(taskDirFull, "debug.jsonl"));
	if (entries.length === 0) {
		entries = readJsonlEntries(join(taskDirFull, "spec.jsonl"));
	}
	return readJsonlFileContents(projectDir, entries);
}

function buildResearchContext(projectDir: string): string {
	// Research is lightweight - just inject project structure overview
	const specDir = join(projectDir, SUPERHARNESS_DIR, "spec");
	if (!existsSync(specDir)) return "";
	return `Project spec directory: ${specDir}\nRead relevant spec files as needed.`;
}

// ─── Prompt builders ───

function buildPrompt(
	originalPrompt: string,
	context: string,
	agentType: string,
): string {
	if (!context) return originalPrompt;
	return `## Injected Context (from .superharness JSONL)\n\n${context}\n\n---\n\n## Original Task\n\n${originalPrompt}`;
}

// ─── Main ───

function main(): void {
	// Read stdin JSON
	let inputRaw = "";
	try {
		inputRaw = readFileSync("/dev/stdin", "utf-8");
	} catch {
		process.exit(0);
	}

	let input: HookInput;
	try {
		input = JSON.parse(inputRaw);
	} catch {
		process.exit(0);
	}

	// Only handle Task/Agent tool calls
	const toolName = input.tool_name || "";
	if (toolName !== "Task" && toolName !== "Agent") {
		process.exit(0);
	}

	const toolInput = input.tool_input || {};
	const subagentType = toolInput.subagent_type || "";
	const originalPrompt = toolInput.prompt || "";
	const projectDir =
		input.cwd ||
		process.env.CLAUDE_PROJECT_DIR ||
		process.env.CURSOR_PROJECT_DIR ||
		process.cwd();

	// Only handle known agent types
	if (!AGENTS_ALL.includes(subagentType as (typeof AGENTS_ALL)[number])) {
		process.exit(0);
	}

	// Get current task
	const taskDir = getCurrentTask(projectDir);

	// implement/check/debug require active task
	if (
		AGENTS_REQUIRE_TASK.includes(
			subagentType as (typeof AGENTS_REQUIRE_TASK)[number],
		)
	) {
		if (!taskDir || !existsSync(join(projectDir, taskDir))) {
			process.exit(0);
		}

		// Update phase in task.json
		updatePhase(projectDir, taskDir, subagentType);

		// Write trace event
		writeTrace(
			projectDir,
			taskDir,
			subagentType,
			`${subagentType}:start`,
			`Dispatching ${subagentType} subagent`,
		);
	}

	// Build context based on agent type
	let context = "";
	switch (subagentType) {
		case "implement":
			context = buildImplementContext(projectDir, taskDir!);
			break;
		case "check":
			context = buildCheckContext(projectDir, taskDir!);
			break;
		case "debug":
			context = buildDebugContext(projectDir, taskDir!);
			break;
		case "research":
			context = buildResearchContext(projectDir);
			break;
	}

	if (!context) {
		process.exit(0);
	}

	// Build new prompt with injected context
	const newPrompt = buildPrompt(originalPrompt, context, subagentType);

	// Output format adapts to platform via hook_event_name
	const hookEvent = input.hook_event_name || "PreToolUse";

	// Claude Code / Cursor / Aone Copilot all use similar format
	const output = {
		hookSpecificOutput: {
			hookEventName: hookEvent,
			permissionDecision: "allow",
			updatedInput: { ...toolInput, prompt: newPrompt },
		},
	};

	process.stdout.write(JSON.stringify(output));
	process.exit(0);
}

main();
