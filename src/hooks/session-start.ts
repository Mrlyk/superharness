/**
 * SessionStart hook for Claude Code.
 * Injects .superharness/spec/ content + task status into AI session context.
 *
 * Output format: JSON to stdout with hookSpecificOutput.additionalContext
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

interface HookOutput {
	hookSpecificOutput: {
		hookEventName: "SessionStart";
		additionalContext: string;
	};
}

function getProjectDir(): string {
	return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function readFileOrNull(path: string): string | null {
	try {
		return readFileSync(path, "utf-8");
	} catch {
		return null;
	}
}

function collectIndexFiles(specDir: string): string[] {
	const results: string[] = [];

	function walk(dir: string): void {
		if (!existsSync(dir)) return;
		for (const entry of readdirSync(dir)) {
			const fullPath = join(dir, entry);
			const stat = statSync(fullPath);
			if (stat.isDirectory()) {
				walk(fullPath);
			} else if (entry === "index.md") {
				results.push(fullPath);
			}
		}
	}

	walk(specDir);
	return results;
}

function buildContext(projectDir: string): string {
	const shDir = join(projectDir, ".superharness");
	if (!existsSync(shDir)) return "";

	const sections: string[] = [];

	// 1. Workflow
	const workflow = readFileOrNull(join(shDir, "workflow.md"));
	if (workflow) {
		sections.push(`<workflow>\n${workflow}\n</workflow>`);
	}

	// 2. Spec guidelines (index.md files only)
	const specDir = join(shDir, "spec");
	if (existsSync(specDir)) {
		const indexFiles = collectIndexFiles(specDir);
		if (indexFiles.length > 0) {
			const guidelines = indexFiles
				.map((f) => {
					const relativePath = f.replace(`${shDir}/`, "");
					const content = readFileOrNull(f);
					return content
						? `### ${relativePath}\n${content}`
						: null;
				})
				.filter(Boolean)
				.join("\n\n");

			if (guidelines) {
				sections.push(`<guidelines>\n${guidelines}\n</guidelines>`);
			}
		}
	}

	// 3. Current task status
	const currentTaskFile = join(shDir, "tasks", ".current-task");
	const currentTask = readFileOrNull(currentTaskFile)?.trim();
	if (currentTask) {
		const taskDir = resolve(projectDir, currentTask);
		const taskJsonPath = join(taskDir, "task.json");
		const taskJson = readFileOrNull(taskJsonPath);
		if (taskJson) {
			sections.push(`<task-status>\nCurrent task: ${currentTask}\n${taskJson}\n</task-status>`);
		}
	}

	return sections.join("\n\n");
}

function main(): void {
	// Skip in non-interactive mode
	if (process.env.CLAUDE_NON_INTERACTIVE === "1") {
		process.exit(0);
	}

	const projectDir = getProjectDir();
	const context = buildContext(projectDir);

	if (!context) {
		process.exit(0);
	}

	const output: HookOutput = {
		hookSpecificOutput: {
			hookEventName: "SessionStart",
			additionalContext: context,
		},
	};

	process.stdout.write(JSON.stringify(output));
}

main();
