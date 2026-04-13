import { existsSync, readFileSync, writeFileSync } from "node:fs";

const META_HEADER = "_meta:";
const META_BLOCK_RE = /(^|\n)_meta:\n(?:[ \t]+.*\n?)*/;

export interface MetaInfo {
	superharnessVersion: string;
	lastUpdatedAt: string;
}

function renderMetaBlock(meta: MetaInfo): string {
	return [
		META_HEADER,
		`  superharnessVersion: "${meta.superharnessVersion}"`,
		`  lastUpdatedAt: "${meta.lastUpdatedAt}"`,
		"",
	].join("\n");
}

export function writeMeta(configPath: string, meta: MetaInfo): void {
	if (!existsSync(configPath)) return;
	const content = readFileSync(configPath, "utf-8");
	const block = renderMetaBlock(meta);

	let next: string;
	if (META_BLOCK_RE.test(content)) {
		next = content.replace(META_BLOCK_RE, (match) => {
			const leading = match.startsWith("\n") ? "\n" : "";
			return `${leading}${block}`;
		});
	} else {
		const sep = content.endsWith("\n") ? "\n" : "\n\n";
		next = `${content}${sep}${block}`;
	}
	writeFileSync(configPath, next);
}

export function readPlatforms(configPath: string): string[] | null {
	if (!existsSync(configPath)) return null;
	const content = readFileSync(configPath, "utf-8");
	const match = content.match(/(^|\n)platforms:\s*\n((?:[ \t]+-[^\n]*\n?)+)/);
	if (!match) return null;
	const items = match[2]
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.startsWith("-"))
		.map((line) => line.slice(1).trim().replace(/^["']|["']$/g, ""))
		.filter(Boolean);
	return items.length ? items : null;
}
