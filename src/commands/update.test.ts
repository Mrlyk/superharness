import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initCommand } from "./init.js";
import { updateCommand } from "./update.js";

interface ExitError extends Error {
	code: number;
}

function makeExitMock() {
	return vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
		const err = new Error(`__exit__:${code ?? 0}`) as ExitError;
		err.code = code ?? 0;
		throw err;
	}) as never);
}

async function runCommand(
	cmd: typeof initCommand | typeof updateCommand,
	name: string,
	args: string[],
): Promise<number> {
	const exitMock = makeExitMock();
	try {
		await cmd.parseAsync(["node", name, ...args]);
		return 0;
	} catch (err) {
		const e = err as ExitError;
		if (e.message?.startsWith("__exit__:")) return e.code;
		throw err;
	} finally {
		exitMock.mockRestore();
	}
}

function stubFetchLatest(version: string): void {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ version }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		),
	);
}

describe("update command", () => {
	let projectDir: string;
	let originalCwd: string;
	let logSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		originalCwd = process.cwd();
		projectDir = mkdtempSync(join(tmpdir(), "sh-update-"));
		process.chdir(projectDir);
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		// Force "no upgrade needed" by claiming latest = 0.0.0
		stubFetchLatest("0.0.0");
	});

	afterEach(() => {
		process.chdir(originalCwd);
		rmSync(projectDir, { recursive: true, force: true });
		logSpy.mockRestore();
		vi.unstubAllGlobals();
	});

	it("exits with error when project is not initialized", async () => {
		const code = await runCommand(updateCommand, "update", []);
		expect(code).toBe(1);
	});

	it("preserves user spec and config files by default", async () => {
		await runCommand(initCommand, "init", []);

		const specSentinel = join(
			projectDir,
			".superharness",
			"spec",
			"MY_SPEC.md",
		);
		writeFileSync(specSentinel, "# user content");

		const configPath = join(projectDir, ".superharness", "config.yaml");
		const beforeConfig = readFileSync(configPath, "utf-8");
		const userMarked = `${beforeConfig}\n# user-edit-marker\n`;
		writeFileSync(configPath, userMarked);

		const code = await runCommand(updateCommand, "update", []);
		expect(code).toBe(0);

		expect(readFileSync(specSentinel, "utf-8")).toBe("# user content");
		expect(readFileSync(configPath, "utf-8")).toContain("# user-edit-marker");
	});

	it("--force --yes overwrites spec and config", async () => {
		await runCommand(initCommand, "init", []);
		const specSentinel = join(
			projectDir,
			".superharness",
			"spec",
			"MY_SPEC.md",
		);
		writeFileSync(specSentinel, "# user content");
		const configPath = join(projectDir, ".superharness", "config.yaml");
		writeFileSync(configPath, "# wiped\n");

		const code = await runCommand(updateCommand, "update", [
			"--force",
			"--yes",
		]);
		expect(code).toBe(0);

		// MY_SPEC.md is not part of blank template → wiped after spec reset
		expect(existsSync(specSentinel)).toBe(false);
		// config.yaml regenerated from template
		const after = readFileSync(configPath, "utf-8");
		expect(after).toContain("project:");
		expect(after).toContain("platforms:");
	});

	it("refreshes _meta block on every update", async () => {
		await runCommand(initCommand, "init", []);
		const configPath = join(projectDir, ".superharness", "config.yaml");
		const before = readFileSync(configPath, "utf-8");
		expect(before).toContain("_meta:");

		await new Promise((r) => setTimeout(r, 5));
		await runCommand(updateCommand, "update", []);
		const after = readFileSync(configPath, "utf-8");
		const beforeTs = before.match(/lastUpdatedAt: "(.+?)"/)?.[1];
		const afterTs = after.match(/lastUpdatedAt: "(.+?)"/)?.[1];
		expect(beforeTs).toBeTruthy();
		expect(afterTs).toBeTruthy();
		expect(afterTs).not.toBe(beforeTs);
	});

	it("reads platforms from config.yaml when present", async () => {
		await runCommand(initCommand, "init", [
			"--full",
			"--platforms",
			"claude-code,cursor",
		]);
		const code = await runCommand(updateCommand, "update", []);
		expect(code).toBe(0);
		expect(
			existsSync(join(projectDir, ".claude", "commands", "superharness")),
		).toBe(true);
		expect(existsSync(join(projectDir, ".cursor", "commands"))).toBe(true);
	});

	it("lite is the default: installs only the four-capability set", async () => {
		await runCommand(initCommand, "init", []);
		const cmds = join(projectDir, ".claude", "skills");
		expect(existsSync(join(cmds, "sh-clarify"))).toBe(true);
		expect(existsSync(join(cmds, "sh-test"))).toBe(true);
		// heavy workflow skills must NOT be installed in lite
		expect(existsSync(join(cmds, "go"))).toBe(false);
		expect(
			existsSync(join(projectDir, ".superharness", "learnings", "INDEX.md")),
		).toBe(true);
		// lite installs the two reviewer agents alongside the skills
		expect(
			existsSync(join(projectDir, ".claude", "agents", "code-reviewer.md")),
		).toBe(true);
		const config = readFileSync(
			join(projectDir, ".superharness", "config.yaml"),
			"utf-8",
		);
		expect(config).toContain('mode: "lite"');

		// update must keep it lite — no full skills leak in, mode preserved
		await runCommand(updateCommand, "update", []);
		expect(existsSync(join(cmds, "go"))).toBe(false);
		expect(
			readFileSync(join(projectDir, ".superharness", "config.yaml"), "utf-8"),
		).toContain('mode: "lite"');
	});

	it("--lite switches a full project to lite", async () => {
		await runCommand(initCommand, "init", ["--full"]);

		// sanity: full artifacts present
		const commandsDir = join(projectDir, ".claude", "commands", "superharness");
		expect(existsSync(commandsDir)).toBe(true);
		expect(
			existsSync(join(projectDir, ".claude", "hooks", "session-start.js")),
		).toBe(true);
		const fullManual = join(
			projectDir,
			".superharness",
			"using-superharness.md",
		);
		expect(existsSync(fullManual)).toBe(true);

		// user spec sentinel must survive the switch
		const specSentinel = join(
			projectDir,
			".superharness",
			"spec",
			"MY_SPEC.md",
		);
		writeFileSync(specSentinel, "# user content");

		const code = await runCommand(updateCommand, "update", ["--lite", "--yes"]);
		expect(code).toBe(0);

		// full platform artifacts removed
		expect(existsSync(commandsDir)).toBe(false);
		expect(
			existsSync(join(projectDir, ".claude", "hooks", "session-start.js")),
		).toBe(false);

		// lite artifacts installed
		const skillsDir = join(projectDir, ".claude", "skills");
		expect(existsSync(join(skillsDir, "sh-clarify"))).toBe(true);
		expect(existsSync(join(skillsDir, "sh-test"))).toBe(true);
		expect(
			existsSync(join(projectDir, ".claude", "hooks", "session-start.cjs")),
		).toBe(true);

		// lite manual present, stale full manual removed, user spec preserved, mode flipped
		expect(
			existsSync(
				join(projectDir, ".superharness", "using-superharness-lite.md"),
			),
		).toBe(true);
		expect(existsSync(fullManual)).toBe(false);
		expect(readFileSync(specSentinel, "utf-8")).toBe("# user content");
		expect(
			readFileSync(join(projectDir, ".superharness", "config.yaml"), "utf-8"),
		).toContain('mode: "lite"');

		// settings.json has no lingering full hook registrations (.js), only lite (.cjs)
		const settings = readFileSync(
			join(projectDir, ".claude", "settings.json"),
			"utf-8",
		);
		expect(settings).not.toContain("session-start.js");
		expect(settings).not.toContain("pre-tool-use.js");
		expect(settings).not.toContain("subagent-stop.js");
		expect(settings).toContain("session-start.cjs");
		expect(settings).toContain("stop-verify.cjs");
	});

	it("lite update prunes skills lite no longer ships, keeps the user's own (even a same bare name) and the sediment", async () => {
		await runCommand(initCommand, "init", []);
		const skillsDir = join(projectDir, ".claude", "skills");

		// a superharness-known skill lite does not ship (a retired / full-only skill)
		mkdirSync(join(skillsDir, "go"), { recursive: true });
		writeFileSync(
			join(skillsDir, "go", "SKILL.md"),
			"stale superharness skill",
		);
		// the user's own skill — must survive (not a name superharness ships)
		mkdirSync(join(skillsDir, "my-own"), { recursive: true });
		writeFileSync(join(skillsDir, "my-own", "SKILL.md"), "mine");
		// the user's own skill that happens to share a lite bare name — must survive untouched
		mkdirSync(join(skillsDir, "clarify"), { recursive: true });
		writeFileSync(join(skillsDir, "clarify", "SKILL.md"), "user clarify");
		// a stale file inside a managed sh- skill — clean reinstall must drop it
		writeFileSync(join(skillsDir, "sh-clarify", "STALE.md"), "leftover");
		// sediment under .superharness/ — must survive
		const learning = join(projectDir, ".superharness", "learnings", "keep.md");
		writeFileSync(learning, "# keep");

		const code = await runCommand(updateCommand, "update", []);
		expect(code).toBe(0);

		expect(existsSync(join(skillsDir, "go"))).toBe(false); // retired pruned
		expect(existsSync(join(skillsDir, "my-own"))).toBe(true); // user kept
		expect(readFileSync(join(skillsDir, "clarify", "SKILL.md"), "utf-8")).toBe(
			"user clarify",
		); // user's bare-name skill left untouched
		expect(existsSync(join(skillsDir, "sh-clarify"))).toBe(true); // current present
		expect(existsSync(join(skillsDir, "sh-clarify", "STALE.md"))).toBe(false); // intra-skill stale gone
		expect(readFileSync(learning, "utf-8")).toBe("# keep"); // sediment kept
	});

	it("lite update reconciles hook registrations and prunes retired hook files", async () => {
		await runCommand(initCommand, "init", []);
		const hooksDir = join(projectDir, ".claude", "hooks");
		const settingsPath = join(projectDir, ".claude", "settings.json");

		// a retired superharness hook file (marker match, not in the lite set)
		writeFileSync(join(hooksDir, "subagent-stop.cjs"), "retired");
		// the user's own hook file — matches no marker, must survive
		writeFileSync(join(hooksDir, "my-hook.cjs"), "mine");

		// tamper an existing registration to an outdated command path
		const before = JSON.parse(readFileSync(settingsPath, "utf-8"));
		before.hooks.SessionStart[0].hooks[0].command =
			"node .claude/hooks/session-start.cjs --OUTDATED";
		writeFileSync(settingsPath, JSON.stringify(before));

		const code = await runCommand(updateCommand, "update", []);
		expect(code).toBe(0);

		expect(existsSync(join(hooksDir, "subagent-stop.cjs"))).toBe(false); // retired pruned
		expect(existsSync(join(hooksDir, "my-hook.cjs"))).toBe(true); // user kept

		const after = JSON.parse(readFileSync(settingsPath, "utf-8"));
		const sessionEntries = after.hooks.SessionStart.filter(
			(e: { hooks: Array<{ command: string }> }) =>
				e.hooks.some((h) => h.command.includes("session-start")),
		);
		expect(sessionEntries).toHaveLength(1); // no duplicate registration
		expect(JSON.stringify(after)).not.toContain("--OUTDATED"); // stale registration refreshed
		expect(JSON.stringify(after)).toContain("session-start.cjs");
	});

	it("lite installs codex TOML agents and qoder markdown agents + hooks", async () => {
		await runCommand(initCommand, "init", [
			"--platforms",
			"claude-code,codex,qoder",
		]);

		// codex: agents converted to TOML, only the two lite reviewers
		const codexAgents = join(projectDir, ".codex", "agents");
		const codexToml = readFileSync(
			join(codexAgents, "code-reviewer.toml"),
			"utf-8",
		);
		expect(codexToml).toContain('name = "code-reviewer"');
		expect(codexToml).toContain("developer_instructions = '''");
		expect(existsSync(join(codexAgents, "spec-reviewer.toml"))).toBe(true);
		// full-only agents must NOT be installed in lite
		expect(existsSync(join(codexAgents, "check.toml"))).toBe(false);

		// qoder: agents are Markdown passthrough, byte-identical to source
		const qoderAgent = readFileSync(
			join(projectDir, ".qoder", "agents", "code-reviewer.md"),
			"utf-8",
		);
		expect(qoderAgent).toBe(
			readFileSync(join(originalCwd, "agents", "code-reviewer.md"), "utf-8"),
		);
		expect(existsSync(join(projectDir, ".qoder", "skills", "sh-test"))).toBe(
			true,
		);

		// qoder hooks live in .qoder/settings.json: UserPromptSubmit (manual) + Stop
		const qoderSettings = readFileSync(
			join(projectDir, ".qoder", "settings.json"),
			"utf-8",
		);
		expect(qoderSettings).toContain("UserPromptSubmit");
		expect(qoderSettings).toContain("session-start.cjs");
		expect(qoderSettings).toContain("stop-verify.cjs");
		expect(qoderSettings).toContain("Stop");

		// claude lite also gets the reviewer agents
		expect(
			existsSync(join(projectDir, ".claude", "agents", "code-reviewer.md")),
		).toBe(true);
	});

	it("full→lite strips full-only codex/qoder agents, keeps the lite reviewers", async () => {
		await runCommand(initCommand, "init", [
			"--full",
			"--platforms",
			"claude-code,codex,qoder",
		]);

		// sanity: full installs ALL agents on both platforms
		expect(existsSync(join(projectDir, ".codex", "agents", "check.toml"))).toBe(
			true,
		);
		expect(existsSync(join(projectDir, ".qoder", "agents", "check.md"))).toBe(
			true,
		);

		const code = await runCommand(updateCommand, "update", ["--lite", "--yes"]);
		expect(code).toBe(0);

		// full-only agents removed on both platforms
		expect(existsSync(join(projectDir, ".codex", "agents", "check.toml"))).toBe(
			false,
		);
		expect(existsSync(join(projectDir, ".qoder", "agents", "check.md"))).toBe(
			false,
		);
		// lite reviewers kept
		expect(
			existsSync(join(projectDir, ".codex", "agents", "code-reviewer.toml")),
		).toBe(true);
		expect(
			existsSync(join(projectDir, ".qoder", "agents", "code-reviewer.md")),
		).toBe(true);
		// lite hook configs now present
		expect(existsSync(join(projectDir, ".codex", "hooks.json"))).toBe(true);
		expect(existsSync(join(projectDir, ".qoder", "settings.json"))).toBe(true);
		// mode flipped to lite
		expect(
			readFileSync(join(projectDir, ".superharness", "config.yaml"), "utf-8"),
		).toContain('mode: "lite"');
	});
});
