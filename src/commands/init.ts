import { Command } from "commander";
import { existsSync, mkdirSync, cpSync, writeFileSync, symlinkSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const SUPERHARNESS_DIR = ".superharness";
const PLATFORMS = ["claude-code", "codex", "cursor", "qoder", "gemini"] as const;
type Platform = (typeof PLATFORMS)[number];

const TEMPLATES = ["frontend", "backend", "ai-agent", "fullstack", "blank"] as const;
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
	console.log(`  Created ${SUPERHARNESS_DIR}/ directory`);
}

function copySpecTemplate(
	projectDir: string,
	template: Template,
	packageRoot: string,
): void {
	const srcDir = join(packageRoot, "spec-templates", template);
	const destDir = join(projectDir, SUPERHARNESS_DIR, "spec");

	if (!existsSync(srcDir)) {
		console.log(`  Warning: template "${template}" not found, using blank`);
		return;
	}

	cpSync(srcDir, destDir, { recursive: true });
	console.log(`  Copied spec template: ${template}`);
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
			// Simple template rendering: replace {{projectName}} with directory name
			const projectName = projectDir.split("/").pop() || "my-project";
			const rendered = content.replaceAll("{{projectName}}", projectName);
			writeFileSync(destPath, rendered);
		}
	}
	console.log("  Generated config files");
}

function setupClaudeCode(packageRoot: string): void {
	const pluginsDir = join(homedir(), ".claude", "plugins");
	const symlinkPath = join(pluginsDir, "superharness");

	if (existsSync(symlinkPath)) {
		console.log("  Claude Code: plugin already linked");
		return;
	}

	mkdirSync(pluginsDir, { recursive: true });
	try {
		symlinkSync(packageRoot, symlinkPath);
		console.log(`  Claude Code: linked to ~/.claude/plugins/superharness`);
	} catch (err) {
		console.log(
			`  Claude Code: failed to create symlink (${(err as Error).message})`,
		);
		console.log(`  Manually link: ln -s ${packageRoot} ${symlinkPath}`);
	}
}

function setupCodex(packageRoot: string): void {
	const skillsDir = join(homedir(), ".agents", "skills");
	const symlinkPath = join(skillsDir, "superharness");

	if (existsSync(symlinkPath)) {
		console.log("  Codex: skills already linked");
		return;
	}

	mkdirSync(skillsDir, { recursive: true });
	const skillsSrc = join(packageRoot, "skills");
	try {
		symlinkSync(skillsSrc, symlinkPath);
		console.log("  Codex: linked to ~/.agents/skills/superharness");
	} catch (err) {
		console.log(
			`  Codex: failed to create symlink (${(err as Error).message})`,
		);
	}
}

function setupQoder(projectDir: string, packageRoot: string): void {
	const qoderSkillsDir = join(projectDir, ".qoder", "skills");
	const skillsSrc = join(packageRoot, "skills");

	if (!existsSync(skillsSrc)) return;

	cpSync(skillsSrc, qoderSkillsDir, { recursive: true });
	console.log("  Qoder: copied skills to .qoder/skills/");
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
			console.log("  Cursor: plugin mechanism pending verification (Phase 2)");
			break;
		case "gemini":
			console.log("  Gemini CLI: adapter pending (Phase 4)");
			break;
	}
}

export const initCommand = new Command("init")
	.description("Initialize superharness in current project")
	.option(
		"-p, --platforms <platforms>",
		"comma-separated list of AI platforms",
		"claude-code",
	)
	.option(
		"-t, --template <template>",
		"spec template (frontend|backend|ai-agent|fullstack|blank)",
		"blank",
	)
	.action((options: { platforms: string; template: string }) => {
		const projectDir = process.cwd();
		const packageRoot = getPackageRoot();
		const platforms = options.platforms.split(",").map((p) => p.trim()) as Platform[];
		const template = options.template as Template;

		console.log(`\nInitializing superharness in ${projectDir}\n`);

		// 1. Create .superharness/ directory
		createSuperHarnessDir(projectDir);

		// 2. Copy spec template
		copySpecTemplate(projectDir, template, packageRoot);

		// 3. Generate config files from templates
		copyInitTemplates(projectDir, packageRoot);

		// 4. Setup each platform
		console.log("\nPlatform setup:");
		for (const platform of platforms) {
			if (!PLATFORMS.includes(platform)) {
				console.log(`  Warning: unknown platform "${platform}", skipping`);
				continue;
			}
			setupPlatform(platform, projectDir, packageRoot);
		}

		console.log("\nDone! Next steps:");
		console.log(
			'  1. In your AI tool, run: /superharness "your requirement"',
		);
		console.log("  2. Edit .superharness/spec/ to customize project conventions");
		console.log("");
	});
