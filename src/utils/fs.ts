import {
	existsSync,
	mkdirSync,
	cpSync,
	writeFileSync,
	readFileSync,
	readdirSync,
	statSync,
} from "node:fs";
import { join, resolve, dirname } from "node:path";
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
	const skillsDir = join(packageRoot, "skills");
	if (!existsSync(skillsDir)) return [];
	return readdirSync(skillsDir).filter((name) => {
		const fullPath = join(skillsDir, name);
		return (
			statSync(fullPath).isDirectory() &&
			existsSync(join(fullPath, "SKILL.md"))
		);
	});
}

export function copySkillToCommands(
	packageRoot: string,
	skillName: string,
	commandsNamespaceDir: string,
): void {
	const srcDir = join(packageRoot, "skills", skillName);
	const destDir = join(commandsNamespaceDir, skillName);
	cpSync(srcDir, destDir, { recursive: true });
}

export function copySkillFlat(
	packageRoot: string,
	skillName: string,
	prefix: string,
	destDir: string,
): void {
	const srcPath = join(packageRoot, "skills", skillName, "SKILL.md");
	const content = readFileSync(srcPath, "utf-8");
	mkdirSync(destDir, { recursive: true });
	writeFileSync(join(destDir, `${prefix}-${skillName}.md`), content);
}

export function copySkillDir(
	packageRoot: string,
	skillName: string,
	destDir: string,
): void {
	const srcDir = join(packageRoot, "skills", skillName);
	const targetDir = join(destDir, skillName);
	cpSync(srcDir, targetDir, { recursive: true });
}

export function copyHookScripts(
	packageRoot: string,
	destHooksDir: string,
): number {
	const hookFiles = [
		"session-start.js",
		"pre-tool-use.js",
		"subagent-stop.js",
	];
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

// Lite hooks are committed plain JS (no build step), copied straight from
// hooks/lite/ — not the tsup-compiled dist/hooks/ that full mode uses.
export function copyLiteHooks(
	packageRoot: string,
	destHooksDir: string,
	files: string[],
): number {
	mkdirSync(destHooksDir, { recursive: true });
	let copied = 0;
	for (const file of files) {
		const src = join(packageRoot, "hooks", "lite", file);
		if (existsSync(src)) {
			cpSync(src, join(destHooksDir, file));
			copied++;
		}
	}
	return copied;
}
