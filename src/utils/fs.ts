import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function getPackageRoot(): string {
	const currentFile = fileURLToPath(import.meta.url);
	// dist/index.js or dist/utils/fs.js → package root
	// Walk up until we find package.json
	let dir = dirname(currentFile);
	for (let i = 0; i < 5; i++) {
		if (existsSync(join(dir, "package.json"))) return dir;
		dir = resolve(dir, "..");
	}
	return resolve(dirname(currentFile), "../..");
}

export function listSkillDirs(packageRoot: string): string[] {
	const skillsDir = join(packageRoot, "dist", "skills");
	if (!existsSync(skillsDir)) return [];
	return readdirSync(skillsDir).filter((name) => {
		const fullPath = join(skillsDir, name);
		return (
			statSync(fullPath).isDirectory() && existsSync(join(fullPath, "SKILL.md"))
		);
	});
}

export function copySkillToCommands(
	packageRoot: string,
	skillName: string,
	commandsNamespaceDir: string,
): void {
	const srcDir = join(packageRoot, "dist", "skills", skillName);
	const destDir = join(commandsNamespaceDir, skillName);
	cpSync(srcDir, destDir, { recursive: true });
}

export function copySkillFlat(
	packageRoot: string,
	skillName: string,
	prefix: string,
	destDir: string,
): void {
	const srcPath = join(packageRoot, "dist", "skills", skillName, "SKILL.md");
	const content = readFileSync(srcPath, "utf-8");
	mkdirSync(destDir, { recursive: true });
	writeFileSync(join(destDir, `${prefix}-${skillName}.md`), content);
}

export function copySkillDir(
	packageRoot: string,
	skillName: string,
	destDir: string,
): void {
	const srcDir = join(packageRoot, "dist", "skills", skillName);
	const targetDir = join(destDir, skillName);
	cpSync(srcDir, targetDir, { recursive: true });
}

export function copyHookScripts(
	packageRoot: string,
	destHooksDir: string,
): number {
	const hookFiles = ["session-start.js", "pre-tool-use.js", "subagent-stop.js"];
	mkdirSync(destHooksDir, { recursive: true });
	let copied = 0;
	for (const hookFile of hookFiles) {
		const hookSrc = join(packageRoot, "dist", "hooks", hookFile);
		if (existsSync(hookSrc)) {
			cpSync(hookSrc, join(destHooksDir, hookFile));
			copied++;
		}
	}
	return copied;
}

// Lite hooks are TypeScript compiled by tsup to dist/hooks/*-lite.js (same as
// the full hooks), then copied verbatim from there. `files` are the built
// filenames (e.g. session-start-lite.js).
export function copyLiteHooks(
	packageRoot: string,
	destHooksDir: string,
	files: string[],
): number {
	mkdirSync(destHooksDir, { recursive: true });
	let copied = 0;
	for (const file of files) {
		const src = join(packageRoot, "dist", "hooks", file);
		if (existsSync(src)) {
			cpSync(src, join(destHooksDir, file));
			copied++;
		}
	}
	return copied;
}
