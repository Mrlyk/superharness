import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { logSuccess } from "../utils/log.js";
import { listSkillDirs, copySkillFlat, copyHookScripts } from "../utils/fs.js";
import { mergeHookConfig } from "../utils/hooks.js";

export function setupCursor(projectDir: string, packageRoot: string): void {
	const commandsDir = join(projectDir, ".cursor", "commands");
	mkdirSync(commandsDir, { recursive: true });

	// 1. Copy skills (flat, prefix naming)
	const skillNames = listSkillDirs(packageRoot);
	for (const name of skillNames) {
		copySkillFlat(packageRoot, name, "superharness", commandsDir);
	}
	logSuccess(`Cursor: 已复制 ${skillNames.length} 个 skill 到 .cursor/commands/`);

	// 2. Copy hook scripts
	copyHookScripts(packageRoot, join(projectDir, ".cursor", "hooks"));

	// 3. Create hooks.json
	mergeHookConfig(
		join(projectDir, ".cursor", "hooks.json"),
		{
			sessionStart: [{
				hooks: [{ type: "command", command: "node .cursor/hooks/session-start.js", timeout: 10 }],
			}],
			preToolUse: [{
				matcher: "Task|Agent",
				hooks: [{ type: "command", command: "node .cursor/hooks/pre-tool-use.js", timeout: 30 }],
			}],
			subagentStop: [{
				matcher: "check",
				hooks: [{ type: "command", command: "node .cursor/hooks/subagent-stop.js", timeout: 10 }],
			}],
		},
		true,
	);
	logSuccess("Cursor: 已创建 hooks.json (sessionStart + preToolUse + subagentStop)");
}
