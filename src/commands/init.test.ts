import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
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

async function runInit(args: string[]): Promise<number> {
	const exitMock = makeExitMock();
	try {
		await initCommand.parseAsync(["node", "init", ...args]);
		return 0;
	} catch (err) {
		const e = err as ExitError;
		if (e.message?.startsWith("__exit__:")) return e.code;
		throw err;
	} finally {
		exitMock.mockRestore();
	}
}

describe("init command", () => {
	let projectDir: string;
	let originalCwd: string;
	let logSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		originalCwd = process.cwd();
		projectDir = mkdtempSync(join(tmpdir(), "sh-init-"));
		process.chdir(projectDir);
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		process.chdir(originalCwd);
		rmSync(projectDir, { recursive: true, force: true });
		logSpy.mockRestore();
	});

	it("creates .superharness/ with rendered platforms and _meta", async () => {
		const code = await runInit(["--platforms", "claude-code,cursor"]);
		expect(code).toBe(0);

		const configPath = join(projectDir, ".superharness", "config.yaml");
		expect(existsSync(configPath)).toBe(true);

		const config = readFileSync(configPath, "utf-8");
		expect(config).toContain("- claude-code");
		expect(config).toContain("- cursor");
		expect(config).toContain("_meta:");
		expect(config).toMatch(/superharnessVersion: ".+"/);
	});

	it("refuses to re-init when .superharness/ already exists", async () => {
		await runInit([]);
		const code = await runInit([]);
		expect(code).toBe(1);
	});

	it("--force --yes overrides existing .superharness/", async () => {
		await runInit([]);
		const code = await runInit(["--force", "--yes"]);
		expect(code).toBe(0);
		expect(existsSync(join(projectDir, ".superharness", "config.yaml"))).toBe(
			true,
		);
	});
});
