import { Command } from "commander";
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
import pc from "picocolors";
import { log, logSuccess, logWarn } from "../utils/log.js";

const SUPERHARNESS_DIR = ".superharness";
const PLATFORMS = [
	"claude-code",
	"aone-copilot",
	"codex",
	"cursor",
	"qoder",
	"gemini",
	"copilot",
] as const;
type Platform = (typeof PLATFORMS)[number];

const TEMPLATES = [
	"frontend",
	"backend",
	"ai-agent",
	"fullstack",
	"blank",
] as const;
type Template = (typeof TEMPLATES)[number];

function getPackageRoot(): string {
	const currentFile = fileURLToPath(import.meta.url);
	// dist/index.js → package root
	return resolve(dirname(currentFile), "..");
}

// ─── .superharness/ directory ───

function createSuperHarnessDir(projectDir: string): void {
	const shDir = join(projectDir, SUPERHARNESS_DIR);
	const dirs = [
		shDir,
		join(shDir, "spec", "guides"),
		join(shDir, "tasks"),
		join(shDir, "workspace"),
	];
	for (const dir of dirs) {
		mkdirSync(dir, { recursive: true });
	}
	logSuccess(`已创建 ${SUPERHARNESS_DIR}/ 目录`);
}

function copySpecTemplate(
	projectDir: string,
	template: Template,
	packageRoot: string,
): void {
	const srcDir = join(packageRoot, "spec-templates", template);
	const destDir = join(projectDir, SUPERHARNESS_DIR, "spec");

	if (!existsSync(srcDir)) {
		logWarn(`模板 "${template}" 未找到，使用 blank`);
		return;
	}

	cpSync(srcDir, destDir, { recursive: true });
	logSuccess(`已复制规范模板: ${pc.bold(template)}`);
}

function copyInitTemplates(projectDir: string, packageRoot: string): void {
	const templatesDir = join(packageRoot, "templates");
	const shDir = join(projectDir, SUPERHARNESS_DIR);

	const templateFiles: Record<string, string> = {
		"config.yaml.hbs": "config.yaml",
		"workflow.md.hbs": "workflow.md",
		"worktree.yaml.hbs": "worktree.yaml",
	};

	for (const [src, dest] of Object.entries(templateFiles)) {
		const srcPath = join(templatesDir, src);
		const destPath = join(shDir, dest);
		if (existsSync(srcPath)) {
			const content = readFileSync(srcPath, "utf-8");
			const projectName = projectDir.split("/").pop() || "my-project";
			const rendered = content.replaceAll("{{projectName}}", projectName);
			writeFileSync(destPath, rendered);
		}
	}
	logSuccess("已生成配置文件");
}

// ─── Skill format conversion helpers ───

/**
 * List all skill directories under skills/ (each containing SKILL.md)
 */
function listSkillDirs(packageRoot: string): string[] {
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

/**
 * Copy SKILL.md content as a flat .md file (for .claude/commands/ format).
 * Strips YAML frontmatter or keeps it depending on platform needs.
 */
function copySkillAsCommand(
	packageRoot: string,
	skillName: string,
	destPath: string,
): void {
	const srcPath = join(packageRoot, "skills", skillName, "SKILL.md");
	const content = readFileSync(srcPath, "utf-8");
	mkdirSync(dirname(destPath), { recursive: true });
	writeFileSync(destPath, content);
}

/**
 * Copy skill directory as-is (for SKILL.md standard platforms: Codex/Qoder/Aone).
 */
function copySkillDir(
	packageRoot: string,
	skillName: string,
	destDir: string,
): void {
	const srcDir = join(packageRoot, "skills", skillName);
	const targetDir = join(destDir, skillName);
	cpSync(srcDir, targetDir, { recursive: true });
}

// ─── Claude Code: project-level .claude/ injection ───

function mergeClaudeSettings(
	projectDir: string,
	hookCommand: string,
): void {
	const settingsPath = join(projectDir, ".claude", "settings.json");

	let settings: Record<string, unknown> = {};
	if (existsSync(settingsPath)) {
		try {
			settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		} catch {
			logWarn("无法解析已有 .claude/settings.json，将创建新文件");
		}
	}

	// Ensure hooks.SessionStart array exists
	const hooks = (settings.hooks || {}) as Record<string, unknown[]>;
	const sessionStart = (hooks.SessionStart || []) as Array<{
		matcher?: string;
		hooks?: Array<{ type: string; command: string; timeout?: number }>;
	}>;

	// Check if superharness hook already exists
	const shHookExists = sessionStart.some((entry) =>
		entry.hooks?.some((h) => h.command.includes("superharness")),
	);

	if (!shHookExists) {
		sessionStart.push({
			matcher: "startup|clear|compact",
			hooks: [
				{
					type: "command",
					command: hookCommand,
					timeout: 10,
				},
			],
		});
	}

	hooks.SessionStart = sessionStart;
	settings.hooks = hooks;

	mkdirSync(dirname(settingsPath), { recursive: true });
	writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
}

function setupClaudeCode(projectDir: string, packageRoot: string): void {
	const claudeDir = join(projectDir, ".claude");
	const commandsDir = join(claudeDir, "commands", "superharness");
	const agentsDir = join(claudeDir, "agents");
	const hooksDir = join(claudeDir, "hooks");

	// 1. Copy skills as .claude/commands/superharness/*.md
	mkdirSync(commandsDir, { recursive: true });
	const skillNames = listSkillDirs(packageRoot);
	for (const name of skillNames) {
		copySkillAsCommand(
			packageRoot,
			name,
			join(commandsDir, `${name}.md`),
		);
	}
	logSuccess(
		`Claude Code: 已复制 ${skillNames.length} 个 skill 到 .claude/commands/superharness/`,
	);

	// 2. Copy agents to .claude/agents/
	const agentsSrc = join(packageRoot, "agents");
	if (existsSync(agentsSrc)) {
		cpSync(agentsSrc, agentsDir, { recursive: true });
		logSuccess("Claude Code: 已复制 agent 到 .claude/agents/");
	}

	// 3. Copy hook script to .claude/hooks/
	const hookSrc = join(packageRoot, "dist", "hooks", "session-start.js");
	if (existsSync(hookSrc)) {
		mkdirSync(hooksDir, { recursive: true });
		cpSync(hookSrc, join(hooksDir, "session-start.js"));
		logSuccess("Claude Code: 已复制 hook 到 .claude/hooks/");
	} else {
		logWarn("Claude Code: hook 脚本未找到 (需要先 npm run build)");
	}

	// 4. Merge settings.json (append SessionStart hook)
	mergeClaudeSettings(
		projectDir,
		"node .claude/hooks/session-start.js",
	);
	logSuccess("Claude Code: 已合并 settings.json");
}

// ─── Aone Copilot: .aone_copilot/skills/ + .claude/skills/ ───

function setupAoneCopilot(projectDir: string, packageRoot: string): void {
	const skillNames = listSkillDirs(packageRoot);
	const aoneSkillsDir = join(projectDir, ".aone_copilot", "skills");
	const claudeSkillsDir = join(projectDir, ".claude", "skills");

	// 1. Copy skills to .aone_copilot/skills/
	for (const name of skillNames) {
		copySkillDir(packageRoot, name, aoneSkillsDir);
	}
	logSuccess(
		`Aone Copilot: 已复制 ${skillNames.length} 个 skill 到 .aone_copilot/skills/`,
	);

	// 2. Copy skills to .claude/skills/ (Aone reads both)
	for (const name of skillNames) {
		copySkillDir(packageRoot, name, claudeSkillsDir);
	}
	logSuccess("Aone Copilot: 已复制 skill 到 .claude/skills/");

	// 3. Create .aone_copilot/hooks.json
	const hooksConfig = {
		version: 1,
		hooks: {
			sessionStart: [
				{
					command: "node .claude/hooks/session-start.js",
				},
			],
		},
	};
	const aoneDir = join(projectDir, ".aone_copilot");
	mkdirSync(aoneDir, { recursive: true });
	writeFileSync(
		join(aoneDir, "hooks.json"),
		JSON.stringify(hooksConfig, null, 2) + "\n",
	);
	logSuccess("Aone Copilot: 已创建 hooks.json");

	// 4. Copy hook script to .claude/hooks/ (shared with Claude Code)
	const hookSrc = join(packageRoot, "dist", "hooks", "session-start.js");
	const hooksDir = join(projectDir, ".claude", "hooks");
	if (existsSync(hookSrc)) {
		mkdirSync(hooksDir, { recursive: true });
		if (!existsSync(join(hooksDir, "session-start.js"))) {
			cpSync(hookSrc, join(hooksDir, "session-start.js"));
		}
	}
}

// ─── Codex: .codex/skills/ ───

function setupCodex(projectDir: string, packageRoot: string): void {
	const skillNames = listSkillDirs(packageRoot);
	const codexSkillsDir = join(projectDir, ".codex", "skills");

	for (const name of skillNames) {
		copySkillDir(packageRoot, name, codexSkillsDir);
	}
	logSuccess(
		`Codex: 已复制 ${skillNames.length} 个 skill 到 .codex/skills/`,
	);
}

// ─── Qoder: .qoder/skills/ ───

function setupQoder(projectDir: string, packageRoot: string): void {
	const skillNames = listSkillDirs(packageRoot);
	const qoderSkillsDir = join(projectDir, ".qoder", "skills");

	for (const name of skillNames) {
		copySkillDir(packageRoot, name, qoderSkillsDir);
	}
	logSuccess(
		`Qoder: 已复制 ${skillNames.length} 个 skill 到 .qoder/skills/`,
	);
}

// ─── Cursor: .cursor/commands/ (flat, prefix naming) ───

function setupCursor(projectDir: string, packageRoot: string): void {
	const commandsDir = join(projectDir, ".cursor", "commands");
	mkdirSync(commandsDir, { recursive: true });

	const skillNames = listSkillDirs(packageRoot);
	for (const name of skillNames) {
		copySkillAsCommand(
			packageRoot,
			name,
			join(commandsDir, `superharness-${name}.md`),
		);
	}
	logSuccess(
		`Cursor: 已复制 ${skillNames.length} 个 skill 到 .cursor/commands/`,
	);
}

// ─── Platform dispatcher ───

function setupPlatform(
	platform: Platform,
	projectDir: string,
	packageRoot: string,
): void {
	switch (platform) {
		case "claude-code":
			setupClaudeCode(projectDir, packageRoot);
			break;
		case "aone-copilot":
			setupAoneCopilot(projectDir, packageRoot);
			break;
		case "codex":
			setupCodex(projectDir, packageRoot);
			break;
		case "qoder":
			setupQoder(projectDir, packageRoot);
			break;
		case "cursor":
			setupCursor(projectDir, packageRoot);
			break;
		case "gemini":
			logWarn("Gemini CLI: Markdown→TOML 转换待开发 (Phase 4)");
			break;
		case "copilot":
			logWarn("GitHub Copilot: 适配器待开发 (Phase 2)");
			break;
	}
}

// ─── Command definition ───

export const initCommand = new Command("init")
	.description("在当前项目中初始化 superharness")
	.option(
		"-p, --platforms <platforms>",
		"AI 平台列表，逗号分隔",
		"claude-code",
	)
	.option(
		"-t, --template <template>",
		"规范模板 (frontend|backend|ai-agent|fullstack|blank)",
		"blank",
	)
	.action((options: { platforms: string; template: string }) => {
		const projectDir = process.cwd();
		const packageRoot = getPackageRoot();
		const platforms = options.platforms
			.split(",")
			.map((p) => p.trim()) as Platform[];
		const template = options.template as Template;

		const isDefaultPlatform =
			platforms.length === 1 && platforms[0] === "claude-code";

		console.log("");
		log(`正在初始化: ${pc.bold(projectDir)}`);
		console.log("");

		// 1. Create .superharness/ directory
		createSuperHarnessDir(projectDir);

		// 2. Copy spec template
		copySpecTemplate(projectDir, template, packageRoot);

		// 3. Generate config files from templates
		copyInitTemplates(projectDir, packageRoot);

		// 4. Setup each platform
		console.log("");
		if (isDefaultPlatform) {
			log(
				`平台: ${pc.bold("claude-code")} ${pc.dim("(默认，使用 --platforms 可更改)")}`,
			);
		} else {
			log(`平台: ${pc.bold(platforms.join(", "))}`);
		}
		for (const platform of platforms) {
			if (!PLATFORMS.includes(platform)) {
				logWarn(`未知平台 "${platform}"，已跳过`);
				continue;
			}
			setupPlatform(platform, projectDir, packageRoot);
		}

		console.log("");
		logSuccess("初始化完成!");
		log(
			`下一步: 在 AI 工具中运行 ${pc.bold('/superharness:go "你的需求或需求链接"')}`,
		);
		log(`编辑 ${pc.dim(".superharness/spec/")} 自定义项目规范`);
		console.log("");
	});
