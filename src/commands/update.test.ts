import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
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

		const specSentinel = join(projectDir, ".superharness", "spec", "MY_SPEC.md");
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
		const specSentinel = join(projectDir, ".superharness", "spec", "MY_SPEC.md");
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
			"--platforms",
			"claude-code,cursor",
		]);
		const code = await runCommand(updateCommand, "update", []);
		expect(code).toBe(0);
		expect(existsSync(join(projectDir, ".claude", "commands", "superharness"))).toBe(
			true,
		);
		expect(existsSync(join(projectDir, ".cursor", "commands"))).toBe(true);
	});
});
