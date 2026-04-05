import { Command } from "commander";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { log, logWarn, logError } from "../utils/log.js";

interface TraceEvent {
	ts: string;
	phase: string;
	event: string;
	detail: string;
	task?: string;
}

function readTraceEvents(tracePath: string): TraceEvent[] {
	if (!existsSync(tracePath)) return [];
	const content = readFileSync(tracePath, "utf-8");
	return content
		.split("\n")
		.filter((line) => line.trim())
		.map((line) => {
			try {
				return JSON.parse(line) as TraceEvent;
			} catch {
				return null;
			}
		})
		.filter((e): e is TraceEvent => e !== null);
}

function findTaskDir(taskArg?: string): string | null {
	const shDir = join(process.cwd(), ".superharness", "tasks");
	if (!existsSync(shDir)) return null;

	if (taskArg) {
		// Direct path
		if (existsSync(join(taskArg, "trace.jsonl"))) return taskArg;
		// Relative to .superharness/tasks/
		const relative = join(shDir, taskArg);
		if (existsSync(join(relative, "trace.jsonl"))) return relative;
		return null;
	}

	// Find from .current-task
	const currentTaskFile = join(shDir, ".current-task");
	const currentTask = existsSync(currentTaskFile)
		? readFileSync(currentTaskFile, "utf-8").trim()
		: null;

	if (currentTask) {
		const taskDir = join(process.cwd(), currentTask);
		if (existsSync(join(taskDir, "trace.jsonl"))) return taskDir;
	}

	// Find most recent task with trace.jsonl
	const dirs = readdirSync(shDir)
		.filter((d) => existsSync(join(shDir, d, "trace.jsonl")))
		.sort()
		.reverse();
	return dirs.length > 0 ? join(shDir, dirs[0]) : null;
}

function buildPathSummary(events: TraceEvent[]): string {
	const standardPath =
		"brainstorm → plan → implement(TDD) → check(spec+code) → complete";
	const phases: string[] = [];
	const anomalies: string[] = [];
	let ralphCount = 0;

	for (const event of events) {
		const phaseKey = `${event.phase}:${event.event}`;

		if (event.event.endsWith(":start") || event.event === "start") {
			if (!phases.includes(event.phase)) {
				phases.push(event.phase);
			}
		}

		if (event.event === "check:ralph_loop") {
			ralphCount++;
		}

		if (
			event.event.includes("fail") ||
			event.event.includes("regression") ||
			event.event.includes("escalated")
		) {
			anomalies.push(`- ${event.phase}: ${event.detail}`);
		}
	}

	if (ralphCount > 1) {
		anomalies.push(
			`- check 阶段 Ralph Loop 执行了 ${ralphCount} 次`,
		);
	}

	const actualPath = phases.join(" → ") || "(无事件记录)";

	let summary = `标准路径: ${standardPath}\n实际路径: ${actualPath}\n`;
	if (anomalies.length > 0) {
		summary += `\n异常节点:\n${anomalies.join("\n")}`;
	} else {
		summary += "\n无异常。";
	}
	return summary;
}

function formatEvent(event: TraceEvent): string {
	const time = event.ts.replace("T", " ").replace("Z", "");
	const phase = pc.cyan(event.phase.padEnd(12));
	const eventName = pc.yellow(event.event.padEnd(25));
	return `${pc.dim(time)} ${phase} ${eventName} ${event.detail}`;
}

export const traceCommand = new Command("trace")
	.description("查看任务执行路径摘要")
	.option("--task <dir>", "指定任务目录")
	.option("--diff <tasks...>", "对比两个任务的路径差异")
	.option("--raw", "显示原始事件列表")
	.action(
		(options: { task?: string; diff?: string[]; raw?: boolean }) => {
			if (options.diff && options.diff.length >= 2) {
				// Diff mode
				const dir1 = findTaskDir(options.diff[0]);
				const dir2 = findTaskDir(options.diff[1]);
				if (!dir1 || !dir2) {
					logError("无法找到指定的任务目录");
					process.exit(1);
				}
				const events1 = readTraceEvents(join(dir1, "trace.jsonl"));
				const events2 = readTraceEvents(join(dir2, "trace.jsonl"));
				console.log(
					`\n${pc.bold("任务 1:")} ${options.diff[0]}`,
				);
				console.log(buildPathSummary(events1));
				console.log(
					`\n${pc.bold("任务 2:")} ${options.diff[1]}`,
				);
				console.log(buildPathSummary(events2));
				return;
			}

			const taskDir = findTaskDir(options.task);
			if (!taskDir) {
				logWarn("未找到包含 trace.jsonl 的任务目录");
				log(
					"使用 --task <dir> 指定任务目录，或确保 .superharness/tasks/.current-task 指向有效任务",
				);
				return;
			}

			const events = readTraceEvents(join(taskDir, "trace.jsonl"));
			if (events.length === 0) {
				logWarn("trace.jsonl 为空");
				return;
			}

			const taskName = taskDir.split("/").pop() || taskDir;
			console.log(`\n${pc.bold(`执行路径 - ${taskName}`)}\n`);

			if (options.raw) {
				for (const event of events) {
					console.log(formatEvent(event));
				}
			} else {
				console.log(buildPathSummary(events));
			}
			console.log("");
		},
	);
