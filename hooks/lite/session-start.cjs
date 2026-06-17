#!/usr/bin/env node
"use strict";
// superharness lite SessionStart hook.
// Injects the project's learnings index, and when the project has no spec yet
// suggests running discover. Silent (exit 0, no output) when there is nothing
// useful to say.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const MAX_INDEX_CHARS = 4000;
const STALE_COMMITS = 30;

function stateDir() {
	return (
		process.env.SUPERHARNESS_STATE_DIR ||
		path.join(os.homedir(), ".superharness", "state")
	);
}

function readStdin() {
	try {
		return fs.readFileSync(0, "utf8");
	} catch {
		return "";
	}
}

function findGitRoot(dir) {
	let cur = dir;
	while (cur && cur !== path.dirname(cur)) {
		if (fs.existsSync(path.join(cur, ".git"))) return cur;
		cur = path.dirname(cur);
	}
	return null;
}

function git(root, args) {
	try {
		return execFileSync("git", ["-C", root, ...args], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
			timeout: 5000,
		}).trim();
	} catch {
		return null;
	}
}

// Number of commits since a file last changed; null when untracked/unknown.
function commitsSince(root, relFile) {
	const last = git(root, ["log", "-1", "--format=%H", "--", relFile]);
	if (!last) return null;
	const count = git(root, ["rev-list", "--count", `${last}..HEAD`]);
	return count === null ? null : Number.parseInt(count, 10);
}

function looksLikeProject(root) {
	const markers = [
		"package.json",
		"pyproject.toml",
		"go.mod",
		"Cargo.toml",
		"pom.xml",
		"build.gradle",
		"build.gradle.kts",
		"Gemfile",
		"composer.json",
	];
	return (
		markers.some((m) => fs.existsSync(path.join(root, m))) ||
		fs.existsSync(path.join(root, "src"))
	);
}

function main() {
	let input = {};
	try {
		input = JSON.parse(readStdin());
	} catch {
		/* tolerate bad input */
	}
	// Qoder has no SessionStart event, so it registers this hook on UserPromptSubmit
	// instead. Default to SessionStart for tools (Claude Code / Codex) that fire it
	// without naming the event.
	const event = input.hook_event_name || "SessionStart";
	const cwd = input.cwd || process.cwd();
	const root = findGitRoot(cwd);
	if (!root) return; // not a project, stay silent

	const parts = [];

	// Operating manual — always injected so the AI knows the project's skills and
	// conventions. For each skill, it uses the Skill tool.
	const manualFile = path.join(
		root,
		".superharness",
		"using-superharness-lite.md",
	);
	if (fs.existsSync(manualFile)) {
		const manual = fs.readFileSync(manualFile, "utf8").trim();
		if (manual) {
			parts.push(
				"<EXTREMELY_IMPORTANT>\n" +
					"Below is the full content of your 'using-superharness' guide — your " +
					"guide to using skills. For all skills, use the Skill tool:\n\n" +
					manual +
					"\n</EXTREMELY_IMPORTANT>",
			);
		}
	}

	const specEntry = path.join(
		root,
		".superharness",
		"spec",
		"guides",
		"index.md",
	);
	const indexFile = path.join(root, ".superharness", "learnings", "INDEX.md");
	// "discover has run" means the superharness spec pointer is wired into
	// AGENTS.md / CLAUDE.md — a pre-existing AGENTS.md from another tool does not count.
	const specWired = ["AGENTS.md", "CLAUDE.md"].some((f) => {
		try {
			return fs
				.readFileSync(path.join(root, f), "utf8")
				.includes(".superharness/spec");
		} catch {
			return false;
		}
	});

	if (fs.existsSync(indexFile)) {
		let index = fs.readFileSync(indexFile, "utf8").trim();
		if (index && index.split("\n").some((l) => l.trim().startsWith("-"))) {
			if (index.length > MAX_INDEX_CHARS) {
				index = index.slice(0, MAX_INDEX_CHARS) + "\n[index truncated]";
			}
			parts.push(
				"Past learnings for this project (from .superharness/learnings/; " +
					"read a linked file before relying on it):\n" +
					index,
			);
		}
	}

	if (specWired) {
		// superharness discover has run — nudge a refresh only when the spec is stale.
		const drift = fs.existsSync(specEntry)
			? commitsSince(root, ".superharness/spec/guides/index.md")
			: null;
		if (drift !== null && drift > STALE_COMMITS) {
			parts.push(
				`.superharness/spec/ is ${drift} commits behind HEAD; suggest running the ` +
					"sh-discover skill to refresh the project spec when convenient.",
			);
		}
	} else if (looksLikeProject(root)) {
		// No superharness spec yet (the blank skeleton `init` writes, or a pre-existing
		// AGENTS.md from another tool, does not count). Suggest generating it.
		parts.push(
			"This project has no superharness project spec yet. Suggest running the " +
				"sh-discover skill once to scan the codebase and generate one.",
		);
	}

	if (parts.length === 0) return;

	// On UserPromptSubmit (Qoder) this hook fires every prompt, so inject only on
	// the first prompt of a session — keyed by session_id. SessionStart-style events
	// already fire once per session and need no guard.
	if (event === "UserPromptSubmit") {
		const sessionId = String(input.session_id || "").replace(
			/[^a-zA-Z0-9_-]/g,
			"",
		);
		if (sessionId) {
			const dir = stateDir();
			try {
				fs.mkdirSync(dir, { recursive: true });
			} catch {
				/* best effort */
			}
			const marker = path.join(dir, `${sessionId}.prompt-injected`);
			if (fs.existsSync(marker)) return; // already injected this session
			try {
				fs.writeFileSync(marker, new Date().toISOString());
			} catch {
				/* best effort */
			}
		}
	}

	process.stdout.write(
		JSON.stringify({
			hookSpecificOutput: {
				hookEventName:
					event === "UserPromptSubmit" ? "UserPromptSubmit" : "SessionStart",
				additionalContext: parts.join("\n\n"),
			},
		}),
	);
}

try {
	main();
} catch {
	/* never break the session */
}
process.exit(0);
