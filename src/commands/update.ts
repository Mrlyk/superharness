import { Command } from "commander";
import {
	cpSync,
	existsSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import pc from "picocolors";
import { log, logError, logSuccess, logWarn } from "../utils/log.js";
import { getPackageRoot } from "../utils/fs.js";
import { PLATFORMS, type Platform, setupPlatform } from "../platforms/index.js";
import { fetchLatestVersion, isVersionOutdated } from "../utils/registry.js";
import {
	type PkgManager,
	buildInstallCommand,
	detectPkgManager,
} from "../utils/pkg-manager.js";
import { confirm } from "../utils/prompt.js";
import { readPlatforms, writeMeta } from "../utils/meta.js";

const SUPERHARNESS_DIR = ".superharness";
const PLATFORM_MARKERS: Record<Platform, string[]> = {
	"claude-code": [".claude/commands/superharness"],
	"aone-copilot": [".aone_copilot/skills"],
	codex: [".codex/skills"],
	cursor: [".cursor/commands"],
	qoder: [".qoder/skills"],
	gemini: [".gemini"],
	copilot: [".github/copilot"],
};

interface PkgInfo {
	name: string;
	version: string;
}

function readPackageInfo(packageRoot: string): PkgInfo {
	const pkg = JSON.parse(
		readFileSync(join(packageRoot, "package.json"), "utf-8"),
	) as { name: string; version: string };
	return { name: pkg.name, version: pkg.version };
}

async function maybeUpgradeGlobal(
	packageRoot: string,
	pkg: PkgInfo,
	assumeYes: boolean,
): Promise<"upgraded" | "skipped" | "stay"> {
	const result = await fetchLatestVersion(pkg.name);
	if (!result.latest) return "stay";
	if (!isVersionOutdated(pkg.version, result.latest)) return "stay";

	const manager: PkgManager = detectPkgManager(packageRoot);
	const installCmd = buildInstallCommand(manager, pkg.name);

	console.log("");
	logWarn(
		`superharness 发布新版本啦~ 当前 ${pkg.version} → 最新 ${result.latest}`,
	);
	log(`将为您安装最新版本: ${pc.bold(installCmd)} (检测到包管理器: ${manager})`);

	const proceed = await confirm("是否继续？", {
		defaultYes: true,
		assumeYes,
	});
	if (!proceed) {
		logWarn("跳过升级，将使用当前版本继续 update");
		return "skipped";
	}

	const [bin, ...args] = installCmd.split(" ");
	const installRes = spawnSync(bin, args, { stdio: "inherit" });
	if (installRes.status !== 0) {
		logError(`升级失败 (exit ${installRes.status})。请手动执行: ${installCmd}`);
		process.exit(installRes.status ?? 1);
	}

	logSuccess("升级完成，正在重新执行 update...");
	const reExec = spawnSync("superharness", ["update"], { stdio: "inherit" });
	process.exit(reExec.status ?? 0);
}

function detectPlatformsFromFs(projectDir: string): Platform[] {
	const found: Platform[] = [];
	for (const platform of PLATFORMS) {
		const markers = PLATFORM_MARKERS[platform] || [];
		if (markers.some((m) => existsSync(join(projectDir, m)))) {
			found.push(platform);
		}
	}
	return found;
}

function resolvePlatforms(projectDir: string): Platform[] {
	const configPath = join(projectDir, SUPERHARNESS_DIR, "config.yaml");
	const fromConfig = readPlatforms(configPath);
	if (fromConfig && fromConfig.length) {
		return fromConfig.filter((p): p is Platform =>
			(PLATFORMS as readonly string[]).includes(p),
		);
	}
	return detectPlatformsFromFs(projectDir);
}

function refreshUsingSkill(projectDir: string, packageRoot: string): void {
	const src = join(packageRoot, "skills", "using-superharness", "SKILL.md");
	const dest = join(projectDir, SUPERHARNESS_DIR, "using-superharness.md");
	if (existsSync(src)) {
		writeFileSync(dest, readFileSync(src, "utf-8"));
		logSuccess("已更新 .superharness/using-superharness.md");
	}
}

const FORCE_TARGETS = [
	"config.yaml",
	"workflow.md",
	"worktree.yaml",
] as const;

async function applyForceOverwrite(
	projectDir: string,
	packageRoot: string,
	assumeYes: boolean,
): Promise<boolean> {
	const shDir = join(projectDir, SUPERHARNESS_DIR);
	const targets: string[] = FORCE_TARGETS.map((f) => `${SUPERHARNESS_DIR}/${f}`);
	if (existsSync(join(shDir, "spec"))) {
		targets.push(`${SUPERHARNESS_DIR}/spec/ (重置为 blank 模板)`);
	}

	console.log("");
	logError("--force 将覆盖以下用户文件:");
	for (const t of targets) console.log(`  - ${pc.red(t)}`);

	const ok = await confirm("确认覆盖？", { defaultYes: false, assumeYes });
	if (!ok) {
		logWarn("已取消 --force 覆盖");
		return false;
	}

	const templatesDir = join(packageRoot, "templates");
	for (const file of FORCE_TARGETS) {
		const src = join(templatesDir, `${file}.hbs`);
		if (!existsSync(src)) continue;
		const content = readFileSync(src, "utf-8");
		const projectName = projectDir.split("/").pop() || "my-project";
		const platforms = resolvePlatforms(projectDir);
		const platformsBlock = (platforms.length ? platforms : ["claude-code"])
			.map((p) => `  - ${p}`)
			.join("\n");
		const rendered = content
			.replaceAll("{{projectName}}", projectName)
			.replaceAll("{{platformsBlock}}", platformsBlock)
			.replaceAll(
				"{{verifyCommands}}",
				"  []  # TODO: 根据你的项目补充 verify 命令",
			);
		writeFileSync(join(shDir, file), rendered);
		logSuccess(`已覆盖 ${SUPERHARNESS_DIR}/${file}`);
	}

	const blankSpec = join(packageRoot, "spec-templates", "blank");
	const specDest = join(shDir, "spec");
	if (existsSync(blankSpec)) {
		if (existsSync(specDest)) {
			rmSync(specDest, { recursive: true, force: true });
		}
		cpSync(blankSpec, specDest, { recursive: true });
		logSuccess(`已重置 ${SUPERHARNESS_DIR}/spec/`);
	}

	return true;
}

function reportSkippedUserFiles(projectDir: string): void {
	const shDir = join(projectDir, SUPERHARNESS_DIR);
	const skipped: string[] = [];
	if (existsSync(join(shDir, "spec"))) {
		skipped.push(`${SUPERHARNESS_DIR}/spec/`);
	}
	for (const f of FORCE_TARGETS) {
		if (existsSync(join(shDir, f))) {
			skipped.push(`${SUPERHARNESS_DIR}/${f}`);
		}
	}
	if (skipped.length) {
		console.log("");
		log(pc.dim("已跳过用户文件 (使用 --force 强制覆盖):"));
		for (const s of skipped) console.log(pc.dim(`  ⏭  ${s}`));
	}
}

export const updateCommand = new Command("update")
	.description("同步最新的 superharness 工具产物到当前项目（保留用户规范与配置）")
	.option("-f, --force", "强制覆盖 spec 与配置文件 (需二次确认)", false)
	.option("-y, --yes", "所有交互默认 yes (CI 场景)", false)
	.action(async (options: { force: boolean; yes: boolean }) => {
		const projectDir = process.cwd();
		const packageRoot = getPackageRoot();
		const shDir = join(projectDir, SUPERHARNESS_DIR);

		if (!existsSync(shDir)) {
			logError(
				`未检测到 ${SUPERHARNESS_DIR}/ 目录，请先运行 ${pc.bold("superharness init")}`,
			);
			process.exit(1);
		}

		const pkg = readPackageInfo(packageRoot);
		console.log("");
		log(`正在更新: ${pc.bold(projectDir)} (当前 superharness ${pkg.version})`);

		await maybeUpgradeGlobal(packageRoot, pkg, options.yes);

		const platforms = resolvePlatforms(projectDir);
		if (platforms.length === 0) {
			logWarn(
				`未在 config.yaml 或项目目录中检测到任何平台，跳过平台资源刷新`,
			);
		} else {
			console.log("");
			log(`将刷新平台: ${pc.bold(platforms.join(", "))}`);
			for (const platform of platforms) {
				setupPlatform(platform, projectDir, packageRoot);
			}
		}

		refreshUsingSkill(projectDir, packageRoot);

		if (options.force) {
			await applyForceOverwrite(projectDir, packageRoot, options.yes);
		} else {
			reportSkippedUserFiles(projectDir);
		}

		writeMeta(join(shDir, "config.yaml"), {
			superharnessVersion: pkg.version,
			lastUpdatedAt: new Date().toISOString(),
		});

		console.log("");
		logSuccess("update 完成!");
		console.log("");
	});
