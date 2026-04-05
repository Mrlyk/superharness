import { existsSync, mkdirSync, cpSync } from "node:fs";
import { join } from "node:path";
import { logSuccess, logWarn } from "../utils/log.js";
import { listSkillDirs, copySkillToCommands, copyHookScripts } from "../utils/fs.js";
import { mergeHookConfig } from "../utils/hooks.js";

export function setupClaudeCode(projectDir: string, packageRoot: string): void {
	const claudeDir = join(projectDir, ".claude");
	const commandsDir = join(claudeDir, "commands", "superharness");
	const agentsDir = join(claudeDir, "agents");
	const hooksDir = join(claudeDir, "hooks");

	// 1. Copy skills
	mkdirSync(commandsDir, { recursive: true });
	const skillNames = listSkillDirs(packageRoot);
	for (const name of skillNames) {
		copySkillToCommands(packageRoot, name, commandsDir);
	}
	logSuccess(`Claude Code: 已复制 ${skillNames.length} 个 skill 到 .claude/commands/superharness/`);

	// 2. Copy agents
	const agentsSrc = join(packageRoot, "agents");
	if (existsSync(agentsSrc)) {
		cpSync(agentsSrc, agentsDir, { recursive: true });
		logSuccess("Claude Code: 已复制 agent 到 .claude/agents/");
	}

	// 3. Copy hook scripts
	const hooksCopied = copyHookScripts(packageRoot, hooksDir);
	if (hooksCopied > 0) {
		logSuccess(`Claude Code: 已复制 ${hooksCopied} 个 hook 到 .claude/hooks/`);
	} else {
		logWarn("Claude Code: hook 脚本未找到 (需要先 npm run build)");
	}

	// 4. Merge settings.json
	mergeHookConfig(join(projectDir, ".claude", "settings.json"), {
		SessionStart: [{
			matcher: "startup|clear|compact",
			hooks: [{ type: "command", command: "node .claude/hooks/session-start.js", timeout: 10 }],
		}],
		PreToolUse: [
			{ matcher: "Task", hooks: [{ type: "command", command: "node .claude/hooks/pre-tool-use.js", timeout: 30 }] },
			{ matcher: "Agent", hooks: [{ type: "command", command: "node .claude/hooks/pre-tool-use.js", timeout: 30 }] },
		],
		SubagentStop: [{
			matcher: "check",
			hooks: [{ type: "command", command: "node .claude/hooks/subagent-stop.js", timeout: 10 }],
		}],
	});
	logSuccess("Claude Code: 已合并 settings.json (SessionStart + PreToolUse + SubagentStop)");
}
