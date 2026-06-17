// superharness Stop hook — auto-learning.
//
// When a session has done substantial work, persist durable learnings into
// .superharness/learnings/. Instead of blocking the user's main thread, this
// spawns a DETACHED background `claude -p` learner that reads a replay of the
// session and updates the wiki off-thread. It re-triggers as the session grows
// (every few new user messages of real work), so learnings done AFTER the first
// summary are captured too — not just once per session.
//
// Guards: never recurse (the background learner sets SUPERHARNESS_LEARN_CHILD),
// never loop on stop_hook_active, throttle by a per-session cursor, and hold a
// short single-flight lock so two learners never edit the wiki at once.
//
// Works on both Claude Code and Codex: both fire a Stop hook with the same stdin
// shape (session_id, transcript_path, cwd). SUPERHARNESS_LEARN_CLI selects which
// headless learner to spawn — `claude -p` (default) or `codex exec`.
//
// Env:
//   SUPERHARNESS_NO_BG_LEARN=1   disable auto-learning entirely
//   SUPERHARNESS_LEARN_SYNC=1    fall back to the old inline Stop-block (no spawn)
//   SUPERHARNESS_LEARN_CLI=codex spawn `codex exec` instead of `claude -p`
//   SUPERHARNESS_LEARN_MODEL=M   learner model (claude: default sonnet; codex: inherit)
//   SUPERHARNESS_LEARN_DRYRUN=1  print the spawn decision instead of spawning
//   SUPERHARNESS_CLAUDE_BIN=path explicit claude binary (else resolved from PATH)
//   SUPERHARNESS_CODEX_BIN=path  explicit codex binary (else resolved from PATH)
//   SUPERHARNESS_LEARN_EVERY_MESSAGES / _WRITES / _LOCK_MS  throttle tuning

import { spawn } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	readdirSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { LEARN_INSTRUCTION, buildChildPrompt } from "./learn-prompt-lite.js";

interface HookInput {
	cwd?: string;
	session_id?: string;
	transcript_path?: string;
	stop_hook_active?: boolean;
	[key: string]: unknown;
}

interface ContentBlock {
	type?: string;
	text?: string;
	name?: string;
	input?: { file_path?: string; path?: string };
}

interface TranscriptEntry {
	type?: string;
	message?: { content?: string | ContentBlock[] };
}

interface LearnState {
	lastUserMessages: number;
	lastWrites: number;
}

const MIN_USER_MESSAGES = 5;
const MAX_TRANSCRIPT_BYTES = 50 * 1024 * 1024;
const MARKER_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_REPLAY_BYTES = 16 * 1024;
const CHILD_MAX_TURNS = "12";
// The learner runs UNSUPERVISED with acceptEdits, so it gets file tools ONLY —
// no Bash, no git. It must never be able to commit, push, rm, or clean. Its job
// is to edit wiki files in the working tree; the user reviews and commits.
const ALLOWED_TOOLS = "Read,Glob,Grep,Write,Edit,MultiEdit";
// Default model for the claude learner: Sonnet is benchmarked at 100% on the
// learn-auto task (recall + hard precision) and is far cheaper than Opus, so the
// background bookkeeping never needs a frontier model. Override with
// SUPERHARNESS_LEARN_MODEL. The codex learner inherits the user's plan model
// (cheap API minis are not available on ChatGPT-account Codex) unless overridden.
const DEFAULT_CLAUDE_MODEL = "sonnet";
const WRITE_TOOLS = /"name"\s*:\s*"(Edit|Write|MultiEdit|NotebookEdit)"/;

function envInt(name: string, fallback: number): number {
	const n = Number.parseInt(process.env[name] ?? "", 10);
	return Number.isFinite(n) && n >= 0 ? n : fallback;
}
const LEARN_EVERY_MESSAGES = envInt("SUPERHARNESS_LEARN_EVERY_MESSAGES", 5);
const LEARN_EVERY_WRITES = envInt("SUPERHARNESS_LEARN_EVERY_WRITES", 8);
const LOCK_TTL_MS = envInt("SUPERHARNESS_LEARN_LOCK_MS", 90 * 1000);

function stateDir(): string {
	return (
		process.env.SUPERHARNESS_STATE_DIR ||
		join(homedir(), ".superharness", "state")
	);
}

function readStdin(): string {
	try {
		return readFileSync(0, "utf8");
	} catch {
		return "";
	}
}

function findGitRoot(dir: string): string | null {
	let cur = dir;
	while (cur && cur !== dirname(cur)) {
		if (existsSync(join(cur, ".git"))) return cur;
		cur = dirname(cur);
	}
	return null;
}

// A real user message has string content, or an array with text but no
// tool_result blocks (tool results also arrive as type:"user").
function isRealUserMessage(entry: TranscriptEntry): boolean {
	if (entry.type !== "user") return false;
	const content = entry.message && entry.message.content;
	if (typeof content === "string") return content.trim().length > 0;
	if (Array.isArray(content)) {
		return (
			content.some((b) => b && b.type === "text") &&
			!content.some((b) => b && b.type === "tool_result")
		);
	}
	return false;
}

function analyzeTranscript(file: string): {
	userMessages: number;
	writes: number;
} {
	const stat = statSync(file);
	if (stat.size > MAX_TRANSCRIPT_BYTES) return { userMessages: 0, writes: 0 };
	const lines = readFileSync(file, "utf8").split("\n");
	let userMessages = 0;
	let writes = 0;
	for (const line of lines) {
		if (!line) continue;
		if (WRITE_TOOLS.test(line)) writes += 1;
		if (line.includes('"type":"user"') || line.includes('"type": "user"')) {
			try {
				if (isRealUserMessage(JSON.parse(line) as TranscriptEntry))
					userMessages += 1;
			} catch {
				/* skip malformed lines */
			}
		}
	}
	return { userMessages, writes };
}

// Render the transcript as a [user]/[assistant] replay — the only context the
// fresh background learner gets. Keep the most recent MAX_REPLAY_BYTES: recent
// corrections matter most, and earlier ones were covered by an earlier spawn.
function buildReplay(file: string): string {
	const stat = statSync(file);
	if (stat.size > MAX_TRANSCRIPT_BYTES) return "";
	const turns: string[] = [];
	for (const line of readFileSync(file, "utf8").split("\n")) {
		if (!line) continue;
		let entry: TranscriptEntry;
		try {
			entry = JSON.parse(line) as TranscriptEntry;
		} catch {
			continue;
		}
		if (isRealUserMessage(entry)) {
			turns.push(`[user] ${flattenText(entry.message?.content).slice(0, 800)}`);
			continue;
		}
		const content = entry.message?.content;
		if (entry.type === "assistant" && Array.isArray(content)) {
			const summary = summarizeAssistant(content);
			if (summary) turns.push(`[assistant] ${summary}`);
		}
	}
	let replay = turns.join("\n");
	if (replay.length > MAX_REPLAY_BYTES)
		replay = replay.slice(replay.length - MAX_REPLAY_BYTES);
	return replay;
}

function flattenText(content: string | ContentBlock[] | undefined): string {
	if (typeof content === "string") return content.trim();
	if (Array.isArray(content)) {
		return content
			.filter((b) => b && b.type === "text")
			.map((b) => b.text)
			.join(" ")
			.trim();
	}
	return "";
}

function summarizeAssistant(blocks: ContentBlock[]): string {
	const parts: string[] = [];
	for (const b of blocks) {
		if (!b) continue;
		if (b.type === "text" && b.text?.trim())
			parts.push(b.text.trim().slice(0, 200));
		else if (b.type === "tool_use") {
			const fp = b.input && (b.input.file_path || b.input.path);
			parts.push(fp ? `(${b.name} ${fp})` : `(${b.name})`);
		}
	}
	return parts.join(" ").slice(0, 300);
}

// Resolve a CLI binary: honor an explicit override path, else scan PATH.
function findBin(base: string, overrideEnv: string): string | null {
	const override = process.env[overrideEnv];
	if (override) {
		try {
			if (existsSync(override)) return override;
		} catch {
			/* ignore */
		}
	}
	const names =
		process.platform === "win32"
			? [`${base}.cmd`, `${base}.exe`, base]
			: [base];
	for (const d of (process.env.PATH || "").split(delimiter)) {
		if (!d) continue;
		for (const n of names) {
			const p = join(d, n);
			try {
				if (existsSync(p)) return p;
			} catch {
				/* ignore */
			}
		}
	}
	return null;
}

function learnerCli(): "claude" | "codex" {
	if (process.env.SUPERHARNESS_LEARN_CLI === "codex") return "codex";
	if (process.env.SUPERHARNESS_LEARN_CLI === "claude") return "claude";
	// Auto-detect: prefer claude; fall back to codex when only codex is reachable
	// (covers a Codex host where the hook command's env prefix didn't propagate).
	if (
		!findBin("claude", "SUPERHARNESS_CLAUDE_BIN") &&
		findBin("codex", "SUPERHARNESS_CODEX_BIN")
	) {
		return "codex";
	}
	return "claude";
}

function learnerBin(cli: string): string | null {
	return cli === "codex"
		? findBin("codex", "SUPERHARNESS_CODEX_BIN")
		: findBin("claude", "SUPERHARNESS_CLAUDE_BIN");
}

// Build the headless learner argv for the target CLI. Claude Code edits via
// file tools (Bash withheld); Codex edits via the shell, sandboxed to
// workspace-write, so it gets no tool allowlist — its guardrails are the prompt
// plus the sandbox.
function learnerArgs(cli: string, prompt: string, root: string): string[] {
	if (cli === "codex") {
		const args = [
			"exec",
			prompt,
			"--sandbox",
			"workspace-write",
			"--skip-git-repo-check",
			"-C",
			root,
			"-c",
			"model_reasoning_effort=medium",
		];
		if (process.env.SUPERHARNESS_LEARN_MODEL)
			args.push("-m", process.env.SUPERHARNESS_LEARN_MODEL);
		return args;
	}
	return [
		"-p",
		prompt,
		"--permission-mode",
		"acceptEdits",
		"--allowedTools",
		ALLOWED_TOOLS,
		"--max-turns",
		CHILD_MAX_TURNS,
		"--model",
		process.env.SUPERHARNESS_LEARN_MODEL || DEFAULT_CLAUDE_MODEL,
	];
}

function readState(file: string): LearnState | null {
	try {
		return JSON.parse(readFileSync(file, "utf8")) as LearnState;
	} catch {
		return null;
	}
}

function lockFresh(file: string): boolean {
	try {
		return Date.now() - statSync(file).mtimeMs < LOCK_TTL_MS;
	} catch {
		return false;
	}
}

function pruneOldMarkers(dir: string): void {
	const cutoff = Date.now() - MARKER_TTL_MS;
	for (const f of readdirSync(dir)) {
		const p = join(dir, f);
		try {
			if (statSync(p).mtimeMs < cutoff) unlinkSync(p);
		} catch {
			/* ignore */
		}
	}
}

// Old behavior: block the stop once per session and let the main model learn
// inline. Used when no `claude` binary is reachable or SUPERHARNESS_LEARN_SYNC=1.
function runSyncFallback(dir: string, sessionId: string): void {
	const marker = join(dir, `${sessionId}.learned`);
	if (existsSync(marker)) return;
	writeFileSync(marker, new Date().toISOString());
	process.stdout.write(
		JSON.stringify({ decision: "block", reason: LEARN_INSTRUCTION }),
	);
}

// ctx = { root, logFile }. Detached so the hook returns immediately; the learner
// outlives it. SUPERHARNESS_LEARN_CHILD stops the learner from triggering itself.
function spawnLearner(
	cli: string,
	prompt: string,
	ctx: { root: string; logFile: string },
): void {
	const bin = learnerBin(cli);
	if (!bin) return; // binary vanished between the check and here: give up quietly
	let logFd: number | "ignore" = "ignore";
	try {
		logFd = openSync(ctx.logFile, "a");
	} catch {
		/* fall back to ignore */
	}
	const child = spawn(bin, learnerArgs(cli, prompt, ctx.root), {
		cwd: ctx.root,
		detached: true,
		stdio: ["ignore", logFd, logFd],
		env: Object.assign({}, process.env, { SUPERHARNESS_LEARN_CHILD: "1" }),
	});
	child.on("error", () => {
		/* binary vanished mid-spawn: give up quietly */
	});
	child.unref();
}

function main(): void {
	let input: HookInput = {};
	try {
		input = JSON.parse(readStdin()) as HookInput;
	} catch {
		return;
	}

	if (input.stop_hook_active) return; // never loop
	if (process.env.SUPERHARNESS_LEARN_CHILD === "1") return; // the learner itself
	if (process.env.SUPERHARNESS_NO_BG_LEARN === "1") return; // opt-out

	const cwd = input.cwd || process.cwd();
	const root = findGitRoot(cwd);
	if (!root) return;

	const sessionId = String(input.session_id || "").replace(
		/[^a-zA-Z0-9_-]/g,
		"",
	);
	if (!sessionId) return;

	const transcript = input.transcript_path;
	if (!transcript || !existsSync(transcript)) return;
	const { userMessages, writes } = analyzeTranscript(transcript);
	if (userMessages < MIN_USER_MESSAGES || writes < 1) return;

	const dir = stateDir();
	mkdirSync(dir, { recursive: true });
	pruneOldMarkers(dir);

	const dryRun = process.env.SUPERHARNESS_LEARN_DRYRUN === "1";
	const cli = learnerCli();

	// No reachable learner CLI (or explicit opt-in): keep the proven inline behavior.
	if (process.env.SUPERHARNESS_LEARN_SYNC === "1" || !learnerBin(cli)) {
		runSyncFallback(dir, sessionId);
		return;
	}

	// Spawn mode: re-learn once enough NEW work has accumulated since last spawn.
	const stateFile = join(dir, `${sessionId}.learn.json`);
	const st = readState(stateFile) || { lastUserMessages: 0, lastWrites: 0 };
	const first = st.lastUserMessages === 0;
	const newMsgs = userMessages - st.lastUserMessages;
	const newWrites = writes - st.lastWrites;
	if (
		!first &&
		newMsgs < LEARN_EVERY_MESSAGES &&
		newWrites < LEARN_EVERY_WRITES
	)
		return;

	const lock = join(dir, `${sessionId}.learn.lock`);
	if (lockFresh(lock)) return; // a learner is still in flight

	writeFileSync(
		stateFile,
		JSON.stringify({ lastUserMessages: userMessages, lastWrites: writes }),
	);

	if (dryRun) {
		process.stdout.write(
			JSON.stringify({
				superharness_learn: "spawn",
				cli,
				trigger: first ? "first" : "cursor",
				userMessages,
				writes,
				reason: LEARN_INSTRUCTION,
			}),
		);
		return;
	}

	try {
		writeFileSync(lock, new Date().toISOString());
	} catch {
		/* best effort */
	}
	spawnLearner(cli, buildChildPrompt(buildReplay(transcript), cli), {
		root,
		logFile: join(dir, `${sessionId}.learn.log`),
	});
}

try {
	main();
} catch {
	/* never block the stop on our own errors */
}
process.exit(0);
