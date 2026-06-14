#!/usr/bin/env node
// Sync the verbatim-portable superskills assets into superharness lite.
//
// Only assets that differ from superskills purely by the superskills→superharness
// rename are synced here:
//   - skills: clarify, learn
//   - hooks:  stop-learn.js, learn-prompt.js
//
// Assets that superharness deliberately ADAPTS are NOT synced (they are
// maintained in this repo and would be clobbered by a blind copy):
//   - hooks/lite/stop-verify.js   — drives the terminal Spec+Code review, line threshold
//   - hooks/lite/session-start.js — injects learnings AND points at the spec model
//   - skills/discover             — retargets detail into .superharness/spec/ (not conventions.md)
//   - skills/test                 — the finalizer (spec review → code review → tests)
//
// Usage:
//   SUPERSKILLS_DIR=/path/to/superskills node scripts/sync-superskills.mjs
// Defaults SUPERSKILLS_DIR to a sibling ../superskills checkout.

import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const SRC = process.env.SUPERSKILLS_DIR
	? resolve(process.env.SUPERSKILLS_DIR)
	: resolve(ROOT, "..", "superskills");
const SRC_PLUGIN = join(SRC, "plugins", "superskills");

const SKILLS = ["clarify", "learn"];
const HOOKS = ["stop-learn.js", "learn-prompt.js"];
const TEXT_EXT = /\.(md|js|mjs|cjs|json|txt)$/i;

// The whole point of the sync: rename superskills → superharness in paths,
// env-var prefixes, and prose. Three disjoint cases cover every occurrence.
function rename(text) {
	return text
		.replaceAll("SUPERSKILLS", "SUPERHARNESS")
		.replaceAll("SuperSkills", "SuperHarness")
		.replaceAll("superskills", "superharness");
}

function copyFile(src, dest) {
	mkdirSync(dirname(dest), { recursive: true });
	const raw = readFileSync(src);
	if (TEXT_EXT.test(src)) writeFileSync(dest, rename(raw.toString("utf-8")));
	else writeFileSync(dest, raw);
}

function copyDir(srcDir, destDir) {
	for (const name of readdirSync(srcDir)) {
		const s = join(srcDir, name);
		const d = join(destDir, name);
		if (statSync(s).isDirectory()) copyDir(s, d);
		else copyFile(s, d);
	}
}

function main() {
	if (!existsSync(SRC_PLUGIN)) {
		console.error(
			`superskills source not found at ${SRC_PLUGIN}\n` +
				`set SUPERSKILLS_DIR to your superskills checkout.`,
		);
		process.exit(1);
	}

	const synced = [];
	for (const name of SKILLS) {
		const from = join(SRC_PLUGIN, "skills", name);
		if (!existsSync(from)) {
			console.error(`missing skill: ${from}`);
			process.exit(1);
		}
		copyDir(from, join(ROOT, "skills", name));
		synced.push(`skills/${name}`);
	}
	for (const file of HOOKS) {
		const from = join(SRC_PLUGIN, "hooks", file);
		if (!existsSync(from)) {
			console.error(`missing hook: ${from}`);
			process.exit(1);
		}
		// Lite hooks ship as .cjs so they run as CommonJS regardless of the host
		// project's package.json "type"; point sibling requires at the .cjs copies.
		const cjs = file.replace(/\.js$/, ".cjs");
		const text = rename(readFileSync(from, "utf-8")).replaceAll(
			"require('./learn-prompt.js')",
			"require('./learn-prompt.cjs')",
		);
		mkdirSync(join(ROOT, "hooks", "lite"), { recursive: true });
		writeFileSync(join(ROOT, "hooks", "lite", cjs), text);
		synced.push(`hooks/lite/${cjs}`);
	}

	console.log(`synced from ${SRC_PLUGIN}:`);
	for (const s of synced) console.log(`  ${s}`);
	console.log(
		`\nadapted assets are NOT synced (maintained here): ` +
			`hooks/lite/{stop-verify,session-start}.cjs, skills/{discover,test}`,
	);
}

main();
