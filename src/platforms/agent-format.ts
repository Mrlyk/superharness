import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tomlBasicString, tomlMultilineLiteral } from "../utils/toml.js";

export interface ParsedAgent {
	name: string;
	description: string;
	body: string; // the Markdown after the frontmatter block
	raw: string; // the whole source file, verbatim
}

// How a parsed agent renders to one platform's on-disk format. Claude Code and
// Qoder both consume the source Markdown verbatim (same frontmatter contract);
// Codex needs a TOML definition.
export interface AgentFormat {
	ext: string;
	render(agent: ParsedAgent): string;
}

// Where a platform stores agents and how it renders them — passed to installAgents.
export interface AgentTarget {
	dir: string;
	format: AgentFormat;
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;

function frontmatterValue(frontmatter: string, key: string): string {
	const m = frontmatter.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
	if (!m) return "";
	return m[1].trim().replace(/^["']|["']$/g, "");
}

export function parseAgentMd(raw: string): ParsedAgent {
	const m = raw.match(FRONTMATTER_RE);
	const frontmatter = m ? m[1] : "";
	const body = (m ? raw.slice(m[0].length) : raw).trim();
	return {
		name: frontmatterValue(frontmatter, "name"),
		description: frontmatterValue(frontmatter, "description"),
		body,
		raw,
	};
}

// Codex agent TOML: required name / description / developer_instructions only.
// Optional fields (model, sandbox_mode, …) are left to Codex defaults. The body
// goes in verbatim as a multiline literal so the Markdown stays intact.
export function renderCodexAgentToml(agent: ParsedAgent): string {
	return [
		`name = ${tomlBasicString(agent.name)}`,
		`description = ${tomlBasicString(agent.description)}`,
		`developer_instructions = ${tomlMultilineLiteral(agent.body)}`,
		"",
	].join("\n");
}

const PASSTHROUGH_MD: AgentFormat = { ext: ".md", render: (a) => a.raw };

export const AGENT_FORMATS: Record<
	"claude-code" | "codex" | "qoder",
	AgentFormat
> = {
	"claude-code": PASSTHROUGH_MD,
	qoder: PASSTHROUGH_MD,
	codex: { ext: ".toml", render: renderCodexAgentToml },
};

// Every agent basename the package ships (agents/*.md → name without extension).
export function listAgentNames(packageRoot: string): string[] {
	const dir = join(packageRoot, "agents");
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((f) => f.endsWith(".md"))
		.map((f) => f.slice(0, -".md".length));
}

// Render the named source agents (agents/<name>.md) into a platform's agent dir,
// using that platform's AgentFormat. Overwrites on every run so an update picks up
// edited agent bodies. Returns the number written.
export function installAgents(
	packageRoot: string,
	names: string[],
	target: AgentTarget,
): number {
	mkdirSync(target.dir, { recursive: true });
	let written = 0;
	for (const name of names) {
		const src = join(packageRoot, "agents", `${name}.md`);
		if (!existsSync(src)) continue;
		const parsed = parseAgentMd(readFileSync(src, "utf-8"));
		writeFileSync(
			join(target.dir, `${name}${target.format.ext}`),
			target.format.render(parsed),
		);
		written++;
	}
	return written;
}
