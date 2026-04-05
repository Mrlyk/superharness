import { logSuccess } from "../utils/log.js";
import { listSkillDirs, copySkillDir } from "../utils/fs.js";
import { join } from "node:path";

export function setupCodex(projectDir: string, packageRoot: string): void {
	const skillNames = listSkillDirs(packageRoot);
	const codexSkillsDir = join(projectDir, ".codex", "skills");

	for (const name of skillNames) {
		copySkillDir(packageRoot, name, codexSkillsDir);
	}
	logSuccess(`Codex: 已复制 ${skillNames.length} 个 skill 到 .codex/skills/`);
}
