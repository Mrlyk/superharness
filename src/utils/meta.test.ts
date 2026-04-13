import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readPlatforms, writeMeta } from "./meta.js";

describe("meta utils", () => {
	let dir: string;
	let configPath: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "sh-meta-"));
		configPath = join(dir, "config.yaml");
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	it("appends _meta block when missing", () => {
		writeFileSync(configPath, "project:\n  name: demo\n");
		writeMeta(configPath, {
			superharnessVersion: "0.2.1",
			lastUpdatedAt: "2026-04-13T00:00:00.000Z",
		});
		const out = readFileSync(configPath, "utf-8");
		expect(out).toContain('superharnessVersion: "0.2.1"');
		expect(out).toContain('lastUpdatedAt: "2026-04-13T00:00:00.000Z"');
		expect(out.indexOf("project:")).toBeLessThan(out.indexOf("_meta:"));
	});

	it("replaces existing _meta block in place", () => {
		writeFileSync(
			configPath,
			[
				"project:",
				"  name: demo",
				"",
				"_meta:",
				'  superharnessVersion: "0.1.0"',
				'  lastUpdatedAt: "2026-01-01T00:00:00.000Z"',
				"",
			].join("\n"),
		);
		writeMeta(configPath, {
			superharnessVersion: "0.3.0",
			lastUpdatedAt: "2026-04-13T00:00:00.000Z",
		});
		const out = readFileSync(configPath, "utf-8");
		expect(out).toContain('superharnessVersion: "0.3.0"');
		expect(out).not.toContain('superharnessVersion: "0.1.0"');
		// only one _meta header
		expect(out.match(/_meta:/g)?.length).toBe(1);
	});

	it("does nothing when config does not exist", () => {
		writeMeta(configPath, {
			superharnessVersion: "0.3.0",
			lastUpdatedAt: "x",
		});
		expect(() => readFileSync(configPath, "utf-8")).toThrow();
	});

	it("reads platforms list from yaml", () => {
		writeFileSync(
			configPath,
			[
				"project:",
				"  name: demo",
				"",
				"platforms:",
				"  - claude-code",
				"  - cursor",
				"",
				"observability:",
				"  trace: true",
				"",
			].join("\n"),
		);
		expect(readPlatforms(configPath)).toEqual(["claude-code", "cursor"]);
	});

	it("returns null when platforms field absent", () => {
		writeFileSync(configPath, "project:\n  name: demo\n");
		expect(readPlatforms(configPath)).toBeNull();
	});

	it("returns null for non-existent file", () => {
		expect(readPlatforms(join(dir, "missing.yaml"))).toBeNull();
	});
});
