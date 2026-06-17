// Copy the verbatim resource dirs (markdown skills/agents + handlebars templates)
// from src/ into dist/ after tsup compiles the TS. The published package ships
// only dist/, so these resources must land there alongside the compiled code and
// hooks. Run by `npm run build` after tsup.

import { cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIRS = ["agents", "skills", "spec-templates", "templates"];

let copied = 0;
for (const d of DIRS) {
	const src = join(root, "src", d);
	if (!existsSync(src)) continue;
	cpSync(src, join(root, "dist", d), { recursive: true });
	copied++;
}
console.log(`copy-assets: copied ${copied} resource dir(s) → dist/`);
