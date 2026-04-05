import { join } from "node:path";
import { logSuccess } from "../utils/log.js";
import { listSkillDirs, copySkillDir, copyHookScripts } from "../utils/fs.js";
import { mergeHookConfig } from "../utils/hooks.js";

export function setupAoneCopilot(projectDir: string, packageRoot: string): void {
	const skillNames = listSkillDirs(packageRoot);
	const aoneSkillsDir = join(projectDir, ".aone_copilot", "skills");

	// 1. Copy skills
	for (const name of skillNames) {
		copySkillDir(packageRoot, name, aoneSkillsDir);
	}
	logSuccess(`Aone Copilot: 已复制 ${skillNames.length} 个 skill 到 .aone_copilot/skills/`);

	// 2. Copy hook scripts
	copyHookScripts(packageRoot, join(projectDir, ".aone_copilot", "hooks"));

	// 3. Create hooks.json
	mergeHookConfig(
		join(projectDir, ".aone_copilot", "hooks.json"),
		{
			sessionStart: [{
				hooks: [{ type: "command", command: "node .aone_copilot/hooks/session-start.js", timeout: 10 }],
			}],
			preToolUse: [{
				matcher: "Shell|Read|Write|Edit|Grep",
				hooks: [{ type: "command", command: "node .aone_copilot/hooks/pre-tool-use.js", timeout: 30 }],
			}],
			stop: [{
				hooks: [{ type: "command", command: "node .aone_copilot/hooks/subagent-stop.js", timeout: 10 }],
			}],
		},
		true,
	);
	logSuccess("Aone Copilot: 已创建 hooks.json (sessionStart + preToolUse + stop)");
}
