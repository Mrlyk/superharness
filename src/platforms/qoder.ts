import { logSuccess } from "../utils/log.js";
import { listSkillDirs, copySkillDir } from "../utils/fs.js";
import { join } from "node:path";

export function setupQoder(projectDir: string, packageRoot: string): void {
	const skillNames = listSkillDirs(packageRoot);
	const qoderSkillsDir = join(projectDir, ".qoder", "skills");

	for (const name of skillNames) {
		copySkillDir(packageRoot, name, qoderSkillsDir);
	}
	logSuccess(`Qoder: 已复制 ${skillNames.length} 个 skill 到 .qoder/skills/`);
}
