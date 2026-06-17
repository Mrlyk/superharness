import {
	existsSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	AGENT_FORMATS,
	installAgents,
	listAgentNames,
	parseAgentMd,
	renderCodexAgentToml,
} from "./agent-format.js";

const PACKAGE_ROOT = process.cwd();
// Source agents now live under src/ (installAgents/listAgentNames read the
// built copy under dist/, but the guard test inspects the authored source).
const AGENTS_DIR = join(PACKAGE_ROOT, "src", "agents");

describe("parseAgentMd", () => {
	it("extracts name, description and body from frontmatter", () => {
		const raw =
			'---\nname: code-reviewer\ndescription: "Review stuff"\n---\n\n# Body\ntext\n';
		const a = parseAgentMd(raw);
		expect(a.name).toBe("code-reviewer");
		expect(a.description).toBe("Review stuff");
		expect(a.body).toBe("# Body\ntext");
		expect(a.raw).toBe(raw);
	});
});

describe("renderCodexAgentToml", () => {
	it("emits required fields with the body as a multiline literal", () => {
		const toml = renderCodexAgentToml({
			name: "x",
			description: 'a "b"',
			body: "# B\nmore",
			raw: "",
		});
		expect(toml).toContain('name = "x"');
		expect(toml).toContain('description = "a \\"b\\""');
		expect(toml).toContain("developer_instructions = '''\n# B\nmore\n'''");
	});
});

describe("shipped agents", () => {
	const files = readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".md"));

	it("listAgentNames returns the source basenames", () => {
		const names = listAgentNames(PACKAGE_ROOT);
		expect(names).toContain("code-reviewer");
		expect(names).toContain("spec-reviewer");
		expect(names.length).toBe(files.length);
	});

	it("all carry name + description frontmatter", () => {
		for (const f of files) {
			const a = parseAgentMd(readFileSync(join(AGENTS_DIR, f), "utf-8"));
			expect(a.name, f).toBeTruthy();
			expect(a.description, f).toBeTruthy();
		}
	});

	// Guard: a TOML multiline literal cannot contain ''' (and we never use """). A
	// body that did would silently produce a broken Codex TOML file.
	it("no body contains ''' or triple double-quotes", () => {
		for (const f of files) {
			const a = parseAgentMd(readFileSync(join(AGENTS_DIR, f), "utf-8"));
			expect(a.body.includes("'''"), `${f} contains '''`).toBe(false);
			expect(a.body.includes('"""'), `${f} contains triple double-quote`).toBe(
				false,
			);
		}
	});
});

describe("installAgents", () => {
	let dest: string;
	beforeEach(() => {
		dest = mkdtempSync(join(tmpdir(), "sh-agents-"));
	});
	afterEach(() => {
		rmSync(dest, { recursive: true, force: true });
	});

	it("renders codex agents as TOML", () => {
		const written = installAgents(PACKAGE_ROOT, ["code-reviewer"], {
			dir: dest,
			format: AGENT_FORMATS.codex,
		});
		expect(written).toBe(1);
		const toml = readFileSync(join(dest, "code-reviewer.toml"), "utf-8");
		expect(toml).toContain('name = "code-reviewer"');
		expect(toml).toContain("developer_instructions = '''");
	});

	it("passes Markdown through verbatim for claude-code / qoder", () => {
		installAgents(PACKAGE_ROOT, ["code-reviewer"], {
			dir: dest,
			format: AGENT_FORMATS.qoder,
		});
		const out = readFileSync(join(dest, "code-reviewer.md"), "utf-8");
		const src = readFileSync(join(AGENTS_DIR, "code-reviewer.md"), "utf-8");
		expect(out).toBe(src);
	});

	it("skips names with no source file", () => {
		const written = installAgents(PACKAGE_ROOT, ["does-not-exist"], {
			dir: dest,
			format: AGENT_FORMATS.codex,
		});
		expect(written).toBe(0);
		expect(existsSync(join(dest, "does-not-exist.toml"))).toBe(false);
	});
});
