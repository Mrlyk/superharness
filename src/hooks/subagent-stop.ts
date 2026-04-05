/**
 * SubagentStop / Stop hook for superharness (Ralph Loop).
 * Prevents check agent from stopping prematurely.
 *
 * Two verification modes:
 * 1. Verify commands (from worktree.yaml) - run shell commands
 * 2. Completion markers (from check.jsonl) - check agent output for markers
 *
 * Cross-platform output:
 * - Claude Code: {decision: "block"/"allow"}
 * - Cursor/Aone Copilot: {followup_message: "..."} or {}
 *
 * Reference: Trellis ralph-loop.py (Python → TS rewrite)
 */

import {
	existsSync,
	readFileSync,
	writeFileSync,
	appendFileSync,
} from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

// ─── Types ───

interface HookInput {
	hook_event_name?: string;
	subagent_type?: string;
	agent_output?: string;
	summary?: string;
	prompt?: string;
	status?: string;
	loop_count?: number;
	cwd?: string;
	[key: string]: unknown;
}

interface RalphState {
	task: string;
	iteration: number;
	started_at: string;
}

interface JsonlEntry {
	file: string;
	reason?: string;
}

// ─── Constants ───

const MAX_ITERATIONS = 5;
const STATE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const SUPERHARNESS_DIR = ".superharness";
const TARGET_AGENT = "check";

// ─── Helpers ───

function readFileOrNull(path: string): string | null {
	try {
		return readFileSync(path, "utf-8");
	} catch {
		return null;
	}
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

function loadState(projectDir: string): RalphState {
	const statePath = join(projectDir, SUPERHARNESS_DIR, ".ralph-state.json");
	const raw = readFileOrNull(statePath);
	if (!raw) {
		return { task: "", iteration: 0, started_at: new Date().toISOString() };
	}
	try {
		return JSON.parse(raw);
	} catch {
		return { task: "", iteration: 0, started_at: new Date().toISOString() };
	}
}

function saveState(projectDir: string, state: RalphState): void {
	const statePath = join(projectDir, SUPERHARNESS_DIR, ".ralph-state.json");
	writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
}

function writeTrace(
	projectDir: string,
	taskDir: string,
	event: string,
	detail: string,
): void {
	const tracePath = join(projectDir, taskDir, "trace.jsonl");
	const entry = JSON.stringify({
		ts: new Date().toISOString(),
		phase: "check",
		event,
		detail,
	});
	try {
		appendFileSync(tracePath, entry + "\n");
	} catch {
		// skip
	}
}

// ─── Verification modes ───

function getVerifyCommands(projectDir: string): string[] {
	const worktreeYaml = readFileOrNull(
		join(projectDir, SUPERHARNESS_DIR, "worktree.yaml"),
	);
	if (!worktreeYaml) return [];

	// Simple YAML parsing for verify: section
	const lines = worktreeYaml.split("\n");
	const commands: string[] = [];
	let inVerify = false;
	for (const line of lines) {
		if (line.match(/^verify\s*:/)) {
			inVerify = true;
			continue;
		}
		if (inVerify) {
			if (line.match(/^\s+-\s+/)) {
				commands.push(line.replace(/^\s+-\s+/, "").trim());
			} else if (!line.match(/^\s*$/)) {
				break; // End of verify section
			}
		}
	}
	return commands;
}

function runVerifyCommands(
	projectDir: string,
	commands: string[],
): { passed: boolean; failedCommand?: string; output?: string } {
	for (const cmd of commands) {
		try {
			execSync(cmd, {
				cwd: projectDir,
				timeout: 120000,
				stdio: ["pipe", "pipe", "pipe"],
			});
		} catch (err) {
			const error = err as { stderr?: Buffer; stdout?: Buffer };
			return {
				passed: false,
				failedCommand: cmd,
				output: error.stderr?.toString() || error.stdout?.toString() || "",
			};
		}
	}
	return { passed: true };
}

function getCompletionMarkers(
	projectDir: string,
	taskDir: string,
): string[] {
	const checkJsonlPath = join(projectDir, taskDir, "check.jsonl");
	const raw = readFileOrNull(checkJsonlPath);
	if (!raw) return [];

	return raw
		.split("\n")
		.filter((line) => line.trim())
		.map((line) => {
			try {
				const entry = JSON.parse(line) as JsonlEntry;
				if (entry.reason) {
					// Convert reason to marker: "TypeCheck" → "TYPECHECK_FINISH"
					return `${entry.reason.toUpperCase().replace(/[\s-]+/g, "_")}_FINISH`;
				}
				return null;
			} catch {
				return null;
			}
		})
		.filter((m): m is string => m !== null);
}

function checkMarkers(
	agentOutput: string,
	markers: string[],
): { allPresent: boolean; missing: string[] } {
	const missing = markers.filter(
		(marker) => !agentOutput.includes(marker),
	);
	return { allPresent: missing.length === 0, missing };
}

// ─── Output builders ───

function outputClaudeCode(
	decision: "allow" | "block",
	reason: string,
): void {
	process.stdout.write(JSON.stringify({ decision, reason }));
}

function outputFollowupMessage(message: string | null): void {
	if (message) {
		process.stdout.write(JSON.stringify({ followup_message: message }));
	} else {
		process.stdout.write("{}");
	}
}

// ─── Main ───

function main(): void {
	// Read stdin
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

	const hookEvent = input.hook_event_name || "";
	const subagentType = input.subagent_type || "";
	const agentOutput = input.agent_output || input.summary || "";
	const originalPrompt = input.prompt || "";
	const projectDir =
		input.cwd ||
		process.env.CLAUDE_PROJECT_DIR ||
		process.env.CURSOR_PROJECT_DIR ||
		process.cwd();

	// Determine platform output format
	const isClaudeCode = hookEvent === "SubagentStop";
	// Cursor uses subagentStop, Aone uses stop, Gemini uses AfterAgent

	// Only handle check agent (or if no subagent_type, check status)
	if (subagentType && subagentType !== TARGET_AGENT) {
		if (isClaudeCode) {
			outputClaudeCode("allow", "Not a check agent");
		} else {
			outputFollowupMessage(null);
		}
		process.exit(0);
	}

	// Skip for finish phase
	if (originalPrompt.toLowerCase().includes("[finish]")) {
		if (isClaudeCode) {
			outputClaudeCode("allow", "Finish phase - skip Ralph Loop");
		} else {
			outputFollowupMessage(null);
		}
		process.exit(0);
	}

	// Get current task
	const taskDir = getCurrentTask(projectDir);
	if (!taskDir || !existsSync(join(projectDir, taskDir))) {
		if (isClaudeCode) {
			outputClaudeCode("allow", "No active task");
		} else {
			outputFollowupMessage(null);
		}
		process.exit(0);
	}

	// Load and manage state
	let state = loadState(projectDir);

	// Reset if task changed or state too old
	const stateAge =
		Date.now() - new Date(state.started_at).getTime();
	if (state.task !== taskDir || stateAge > STATE_TIMEOUT_MS) {
		state = {
			task: taskDir,
			iteration: 0,
			started_at: new Date().toISOString(),
		};
	}

	state.iteration++;
	saveState(projectDir, state);

	// Safety limit
	if (state.iteration >= MAX_ITERATIONS) {
		writeTrace(
			projectDir,
			taskDir,
			"check:ralph_loop",
			`iteration ${state.iteration}/${MAX_ITERATIONS}: safety limit reached, allowing stop`,
		);
		// Reset for next run
		state.iteration = 0;
		saveState(projectDir, state);

		if (isClaudeCode) {
			outputClaudeCode(
				"allow",
				`Ralph Loop: max iterations (${MAX_ITERATIONS}) reached`,
			);
		} else {
			outputFollowupMessage(null);
		}
		process.exit(0);
	}

	// Mode 1: Verify commands (from worktree.yaml)
	const verifyCommands = getVerifyCommands(projectDir);
	if (verifyCommands.length > 0) {
		const result = runVerifyCommands(projectDir, verifyCommands);
		if (result.passed) {
			writeTrace(
				projectDir,
				taskDir,
				"check:ralph_loop",
				`iteration ${state.iteration}: all verify commands passed`,
			);
			if (isClaudeCode) {
				outputClaudeCode("allow", "All verify commands passed");
			} else {
				outputFollowupMessage(null);
			}
		} else {
			const reason = `iteration ${state.iteration}/${MAX_ITERATIONS}: verify command failed: ${result.failedCommand}`;
			writeTrace(projectDir, taskDir, "check:ralph_loop", reason);
			if (isClaudeCode) {
				outputClaudeCode("block", `Ralph Loop: ${reason}`);
			} else {
				outputFollowupMessage(
					`验证未通过 (${state.iteration}/${MAX_ITERATIONS}): ${result.failedCommand} 失败。请修复后重试。`,
				);
			}
		}
		process.exit(0);
	}

	// Mode 2: Completion markers (from check.jsonl)
	const markers = getCompletionMarkers(projectDir, taskDir);
	if (markers.length > 0) {
		const { allPresent, missing } = checkMarkers(agentOutput, markers);
		if (allPresent) {
			writeTrace(
				projectDir,
				taskDir,
				"check:ralph_loop",
				`iteration ${state.iteration}: all markers present`,
			);
			if (isClaudeCode) {
				outputClaudeCode("allow", "All completion markers found");
			} else {
				outputFollowupMessage(null);
			}
		} else {
			const reason = `iteration ${state.iteration}/${MAX_ITERATIONS}: missing markers: ${missing.join(", ")}`;
			writeTrace(projectDir, taskDir, "check:ralph_loop", reason);
			if (isClaudeCode) {
				outputClaudeCode("block", `Ralph Loop: ${reason}`);
			} else {
				outputFollowupMessage(
					`检查未完成 (${state.iteration}/${MAX_ITERATIONS}): 缺少标记 ${missing.join(", ")}。请完成所有检查项后再声明完成。`,
				);
			}
		}
		process.exit(0);
	}

	// No verify commands or markers configured - allow
	if (isClaudeCode) {
		outputClaudeCode("allow", "No verification configured");
	} else {
		outputFollowupMessage(null);
	}
	process.exit(0);
}

main();
