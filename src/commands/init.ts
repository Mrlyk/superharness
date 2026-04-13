import { Command } from "commander";
import {
	existsSync,
	mkdirSync,
	cpSync,
	writeFileSync,
	readFileSync,
	readdirSync,
} from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { log, logSuccess, logWarn } from "../utils/log.js";
import { getPackageRoot } from "../utils/fs.js";
import { PLATFORMS, type Platform, setupPlatform } from "../platforms/index.js";

const SUPERHARNESS_DIR = ".superharness";

const TEMPLATES = [
	"frontend",
	"backend",
	"ai-agent",
	"fullstack",
	"blank",
] as const;
type Template = (typeof TEMPLATES)[number];

function createSuperHarnessDir(projectDir: string, packageRoot: string): void {
	const shDir = join(projectDir, SUPERHARNESS_DIR);
	for (const dir of [
		shDir,
		join(shDir, "spec", "guides"),
		join(shDir, "tasks"),
		join(shDir, "workspace"),
	]) {
		mkdirSync(dir, { recursive: true });
	}

	// Write .gitignore to exclude runtime state files (prevents worktree merge conflicts)
	const gitignorePath = join(shDir, ".gitignore");
	if (!existsSync(gitignorePath)) {
		writeFileSync(
			gitignorePath,
			[
				"# Runtime state (not committed, prevents worktree merge conflicts)",
				"tasks/.current-task",
				".ralph-state.json",
				"workspace/",
				"",
			].join("\n"),
		);
	}

	// Copy using-superharness skill for session-start hook injection
	const usingSkillSrc = join(packageRoot, "skills", "using-superharness", "SKILL.md");
	if (existsSync(usingSkillSrc)) {
		writeFileSync(
			join(shDir, "using-superharness.md"),
			readFileSync(usingSkillSrc, "utf-8"),
		);
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

type DetectedProject = {
	label: string;
	verifyCommands: string[];
};

function detectProject(projectDir: string): DetectedProject {
	const has = (name: string) => existsSync(join(projectDir, name));
	const hasExt = (ext: string) => {
		try {
			return readdirSync(projectDir).some((f) => f.endsWith(ext));
		} catch {
			return false;
		}
	};

	if (has("package.json"))
		return { label: "JS/TS", verifyCommands: ["npm test", "npx tsc --noEmit"] };
	if (
		has("pyproject.toml") ||
		has("requirements.txt") ||
		has("Pipfile") ||
		has("setup.py")
	)
		return { label: "Python", verifyCommands: ["pytest"] };
	if (has("pom.xml")) return { label: "Maven", verifyCommands: ["mvn test"] };
	if (has("build.gradle") || has("build.gradle.kts"))
		return { label: "Gradle", verifyCommands: ["./gradlew test"] };
	if (has("Package.swift"))
		return { label: "Swift (SPM)", verifyCommands: ["swift test"] };
	if (hasExt(".xcodeproj"))
		return { label: "Swift (Xcode)", verifyCommands: [] };
	return { label: "未识别", verifyCommands: [] };
}

function renderVerifyBlock(cmds: string[]): string {
	if (cmds.length === 0)
		return "  []  # TODO: 根据你的项目补充 verify 命令 (e.g., xcodebuild test -scheme ...)";
	return cmds.map((c) => `  - ${c}`).join("\n");
}

function copyInitTemplates(projectDir: string, packageRoot: string): void {
	const templatesDir = join(packageRoot, "templates");
	const shDir = join(projectDir, SUPERHARNESS_DIR);

	const templateFiles: Record<string, string> = {
		"config.yaml.hbs": "config.yaml",
		"workflow.md.hbs": "workflow.md",
		"worktree.yaml.hbs": "worktree.yaml",
	};

	const detected = detectProject(projectDir);
	const verifyBlock = renderVerifyBlock(detected.verifyCommands);

	for (const [src, dest] of Object.entries(templateFiles)) {
		const srcPath = join(templatesDir, src);
		const destPath = join(shDir, dest);
		if (existsSync(srcPath)) {
			const content = readFileSync(srcPath, "utf-8");
			const projectName = projectDir.split("/").pop() || "my-project";
			const rendered = content
				.replaceAll("{{projectName}}", projectName)
				.replaceAll("{{verifyCommands}}", verifyBlock);
			writeFileSync(destPath, rendered);
		}
	}
	logSuccess(`已生成配置文件 (检测到 ${pc.bold(detected.label)} 项目)`);
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
		const platforms = options.platforms
			.split(",")
			.map((p) => p.trim()) as Platform[];
		const template = options.template as Template;

		const isDefaultPlatform =
			platforms.length === 1 && platforms[0] === "claude-code";

		console.log("");
		log(`正在初始化: ${pc.bold(projectDir)}`);
		console.log("");

		createSuperHarnessDir(projectDir, packageRoot);
		copySpecTemplate(projectDir, template, packageRoot);
		copyInitTemplates(projectDir, packageRoot);

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
