import { Command } from "commander";
import {
	existsSync,
	mkdirSync,
	cpSync,
	writeFileSync,
	symlinkSync,
	readFileSync,
} from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import pc from "picocolors";
import { log, logSuccess, logWarn, logError } from "../utils/log.js";

const SUPERHARNESS_DIR = ".superharness";
const PLATFORMS = [
	"claude-code",
	"codex",
	"cursor",
	"qoder",
	"gemini",
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

function setupClaudeCode(packageRoot: string): void {
	const pluginsDir = join(homedir(), ".claude", "plugins");
	const symlinkPath = join(pluginsDir, "superharness");

	if (existsSync(symlinkPath)) {
		log("Claude Code: 插件已链接");
		return;
	}

	mkdirSync(pluginsDir, { recursive: true });
	try {
		symlinkSync(packageRoot, symlinkPath);
		logSuccess("Claude Code: 已链接到 ~/.claude/plugins/superharness");
	} catch (err) {
		logError(
			`Claude Code: 创建符号链接失败 (${(err as Error).message})`,
		);
		log(`手动链接: ln -s ${packageRoot} ${symlinkPath}`);
	}
}

function setupCodex(packageRoot: string): void {
	const skillsDir = join(homedir(), ".agents", "skills");
	const symlinkPath = join(skillsDir, "superharness");

	if (existsSync(symlinkPath)) {
		log("Codex: skills 已链接");
		return;
	}

	mkdirSync(skillsDir, { recursive: true });
	const skillsSrc = join(packageRoot, "skills");
	try {
		symlinkSync(skillsSrc, symlinkPath);
		logSuccess("Codex: 已链接到 ~/.agents/skills/superharness");
	} catch (err) {
		logError(
			`Codex: 创建符号链接失败 (${(err as Error).message})`,
		);
	}
}

function setupQoder(projectDir: string, packageRoot: string): void {
	const qoderSkillsDir = join(projectDir, ".qoder", "skills");
	const skillsSrc = join(packageRoot, "skills");

	if (!existsSync(skillsSrc)) return;

	cpSync(skillsSrc, qoderSkillsDir, { recursive: true });
	logSuccess("Qoder: 已复制 skills 到 .qoder/skills/");
}

function setupPlatform(
	platform: Platform,
	projectDir: string,
	packageRoot: string,
): void {
	switch (platform) {
		case "claude-code":
			setupClaudeCode(packageRoot);
			break;
		case "codex":
			setupCodex(packageRoot);
			break;
		case "qoder":
			setupQoder(projectDir, packageRoot);
			break;
		case "cursor":
			logWarn("Cursor: 插件机制待验证 (Phase 2)");
			break;
		case "gemini":
			logWarn("Gemini CLI: 适配器待开发 (Phase 4)");
			break;
	}
}

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
		const platforms = options.platforms.split(",").map((p) => p.trim()) as Platform[];
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
			`下一步: 在 AI 工具中运行 ${pc.bold('/superharness "你的需求"')}`,
		);
		log(
			`编辑 ${pc.dim(".superharness/spec/")} 自定义项目规范`,
		);
		console.log("");
	});
